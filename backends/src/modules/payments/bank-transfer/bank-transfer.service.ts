import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { eq, and, isNull, desc, count, ilike, or, sql, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { db } from '../../../database';
import {
  payments,
  paymentItems,
  paymentReceipts,
  courses,
  users,
  enrollments,
  systemSettings,
  PAYMENT_STATUS,
  ENROLLMENT_STATUS,
  RECEIPT_SCAN_STATUS,
  RECEIPT_REVIEW_STATUS,
  type PaymentReceipt,
} from '../../../database/schema';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { StorageService } from '../../storage/storage.service';
import { AuditLogService } from '../../audit-logs/audit-logs.service';
import { EmailService } from '../../email/email.service';
import { InvoiceService } from '../services/invoice.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
];

// Matches Amna's reference screenshot upload limit (15.63 MB).
const MAX_RECEIPT_BYTES = Math.floor(15.63 * 1024 * 1024);

// GCS prefix within the private bucket. Lifecycle rules scoped to this prefix
// will set the 10-year retention per Saudi accounting law.
const RECEIPTS_PREFIX = 'bank-transfer-receipts';

// Polling cadence for malware-scan verdict after upload. The Eventarc-driven
// ClamAV scanner usually completes inside ~10s for typical receipt sizes; we
// poll for up to 5 min before giving up and leaving the row in 'pending' for
// the finance dashboard to refresh on demand.
const SCAN_POLL_INTERVAL_MS = 10_000;
const SCAN_POLL_MAX_ATTEMPTS = 30;

export interface BankTransferDetails {
  bankNameEn: string;
  bankNameAr: string;
  beneficiaryEn: string;
  beneficiaryAr: string;
  accountNumber: string;
  iban: string;
  swiftCode: string;
  instructionsEn: string;
  instructionsAr: string;
}

@Injectable()
export class BankTransferService {
  private readonly logger = new Logger(BankTransferService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly auditLogService: AuditLogService,
    private readonly emailService: EmailService,
    private readonly invoiceService: InvoiceService,
  ) {}

  /**
   * Read the bank account details + instructions out of system_settings so
   * the public bank-transfer page can render them. Returns a normalized
   * object with empty-string fallbacks so the page never sees `undefined`.
   */
  async getBankDetails(): Promise<BankTransferDetails> {
    const [row] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.category, 'payments'))
      .limit(1);

    const bt = (row?.value as { bankTransfer?: Partial<BankTransferDetails> } | undefined)
      ?.bankTransfer || {};

    return {
      bankNameEn: bt.bankNameEn || '',
      bankNameAr: bt.bankNameAr || '',
      beneficiaryEn: bt.beneficiaryEn || '',
      beneficiaryAr: bt.beneficiaryAr || '',
      accountNumber: bt.accountNumber || '',
      iban: bt.iban || '',
      swiftCode: bt.swiftCode || '',
      instructionsEn: bt.instructionsEn || '',
      instructionsAr: bt.instructionsAr || '',
    };
  }

  /**
   * Look up a payment + its active receipt (if any). Used by the public
   * bank-transfer page so it can show the right state to the buyer:
   * - no receipt yet  → show upload form
   * - receipt pending → show "in review" banner + allow re-upload
   * - rejected        → show rejection note + allow re-upload
   * - approved/paid   → redirect to success
   */
  async getPaymentForBuyer(paymentId: string, user: AuthenticatedUser) {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.userId !== user.id) {
      throw new ForbiddenException('You can only view your own payments');
    }
    if (payment.gateway !== 'bank_transfer') {
      throw new BadRequestException(
        'This payment is not a bank transfer; use the regular checkout flow',
      );
    }

    const [course] = await db
      .select({ id: courses.id, title: courses.title })
      .from(courses)
      .where(eq(courses.id, payment.courseId))
      .limit(1);

    // Active receipt = the one not yet replaced (most recent in the chain).
    const activeReceipt = await this.getActiveReceipt(paymentId);

    return {
      payment,
      course,
      activeReceipt: activeReceipt ? sanitizeReceiptForBuyer(activeReceipt) : null,
    };
  }

  /**
   * Persist a receipt file + the student's refund-info snapshot, transition
   * the payment to 'awaiting_approval', send an acknowledgement email, kick
   * off the async malware-scan poll.
   *
   * Re-upload: any prior active receipt for this payment gets its
   * replaced_by_id set to the new one so finance always sees the latest.
   */
  async uploadReceipt(
    paymentId: string,
    user: AuthenticatedUser,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    dto: CreateReceiptDto,
    ipAddress?: string,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Receipt file is required');
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type. Allowed: PDF, JPG, JPEG, PNG`,
      );
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      throw new BadRequestException(
        `File too large. Maximum size is ${Math.floor(MAX_RECEIPT_BYTES / 1024 / 1024)} MB`,
      );
    }

    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.userId !== user.id) {
      throw new ForbiddenException('You can only upload receipts for your own payments');
    }
    if (payment.gateway !== 'bank_transfer') {
      throw new BadRequestException(
        'This payment is not a bank transfer',
      );
    }
    if (
      payment.status === PAYMENT_STATUS.PAID ||
      payment.status === PAYMENT_STATUS.REFUNDED ||
      payment.status === PAYMENT_STATUS.PARTIALLY_REFUNDED
    ) {
      throw new BadRequestException(
        'This payment is already finalized; receipt upload is no longer possible',
      );
    }

    // Build the GCS object path: <prefix>/<paymentId>/<uuid>-<sanitized-name>.
    // The UUID makes re-uploads collision-free; sanitized name preserves the
    // original extension for downstream tools (PDF readers, image viewers).
    const safeName = sanitizeFileName(file.originalname);
    const objectPath = `${RECEIPTS_PREFIX}/${paymentId}/${randomUUID()}-${safeName}`;

    // Upload to the private bucket. The Eventarc malware scanner will pick
    // this up automatically (the bucket is in WATCHED_BUCKETS).
    await this.storageService.uploadPrivate(
      file.buffer,
      objectPath,
      file.mimetype,
    );
    this.logger.log(`Uploaded bank transfer receipt to private/${objectPath}`);

    const prevReceipt = await this.getActiveReceipt(paymentId);

    // Insert the new receipt + transition payment status in one transaction.
    const newReceipt = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(paymentReceipts)
        .values({
          paymentId,
          uploadedBy: user.id,
          fileName: file.originalname,
          mimeType: file.mimetype,
          fileSizeBytes: file.size,
          gcsObjectPath: objectPath,
          scanStatus: RECEIPT_SCAN_STATUS.PENDING,
          reviewStatus: RECEIPT_REVIEW_STATUS.PENDING,
          refundAccountHolder: dto.refundAccountHolder,
          refundIban: dto.refundIban,
          refundBankName: dto.refundBankName,
          refundNationalId: dto.refundNationalId || null,
        })
        .returning();

      // Chain: previous active receipt → new one. Lets finance see the
      // history while always landing on the latest by default.
      if (prevReceipt) {
        await tx
          .update(paymentReceipts)
          .set({ replacedById: created.id, updatedAt: new Date() })
          .where(eq(paymentReceipts.id, prevReceipt.id));
      }

      // Payment is now awaiting finance approval.
      await tx
        .update(payments)
        .set({
          status: PAYMENT_STATUS.AWAITING_APPROVAL,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, paymentId));

      return created;
    });

    await this.auditLogService.log({
      entityType: 'payment',
      entityId: paymentId,
      action: prevReceipt ? 'bank_transfer_receipt_replaced' : 'bank_transfer_receipt_uploaded',
      performedBy: user.id,
      ipAddress,
      metadata: {
        receiptId: newReceipt.id,
        fileName: file.originalname,
        fileSize: file.size,
        previousReceiptId: prevReceipt?.id || null,
      },
    });

    // Fire the acknowledgement email + scan poll without blocking the response.
    void this.emailService
      .sendBankTransferReceived(user.id, paymentId)
      .catch((err) =>
        this.logger.error(
          `Failed to send bank transfer receipt email: ${err.message}`,
        ),
      );

    void this.pollScanStatus(newReceipt.id, objectPath);

    return {
      receiptId: newReceipt.id,
      paymentStatus: PAYMENT_STATUS.AWAITING_APPROVAL,
      scanStatus: newReceipt.scanStatus,
    };
  }

  /**
   * Issue a short-lived signed URL for the buyer to re-download their own
   * receipt (re-confirm what they uploaded) or for finance to view it in
   * the review queue. Owner-or-finance enforcement is the controller's job.
   */
  async getReceiptDownloadUrl(receiptId: string): Promise<{ url: string; fileName: string }> {
    const [receipt] = await db
      .select()
      .from(paymentReceipts)
      .where(eq(paymentReceipts.id, receiptId))
      .limit(1);

    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }

    const url = await this.storageService.getSignedUrl(
      'private',
      receipt.gcsObjectPath,
    );

    return { url, fileName: receipt.fileName };
  }

  async getReceiptById(receiptId: string): Promise<PaymentReceipt | null> {
    const [receipt] = await db
      .select()
      .from(paymentReceipts)
      .where(eq(paymentReceipts.id, receiptId))
      .limit(1);
    return receipt || null;
  }

  // ─── Finance review (queue + approve + reject) ──────────────────────

  /**
   * Paginated list of receipts for the finance review queue. Shows only the
   * active receipt per payment (replaced ones are hidden) plus enriched
   * fields the queue UI needs: student name/email, course title, payment
   * amount + age. Filters by review status; supports search on student
   * name/email/payment id.
   */
  async listFinanceQueue(opts: {
    status?: 'pending' | 'approved' | 'rejected' | 'all';
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const status = opts.status || 'pending';
    const page = Math.max(1, opts.page || 1);
    const limit = Math.min(50, Math.max(1, opts.limit || 10));
    const offset = (page - 1) * limit;

    const conditions = [isNull(paymentReceipts.replacedById)];
    if (status !== 'all') {
      conditions.push(eq(paymentReceipts.reviewStatus, status));
    }
    if (opts.search?.trim()) {
      const s = `%${opts.search.trim()}%`;
      conditions.push(
        or(
          ilike(users.firstName, s),
          ilike(users.lastName, s),
          ilike(users.email, s),
          ilike(paymentReceipts.paymentId, s),
        )!,
      );
    }

    const whereExpr = and(...conditions);

    const rows = await db
      .select({
        receiptId: paymentReceipts.id,
        receiptCreatedAt: paymentReceipts.createdAt,
        receiptScanStatus: paymentReceipts.scanStatus,
        receiptReviewStatus: paymentReceipts.reviewStatus,
        receiptReviewedAt: paymentReceipts.reviewedAt,
        receiptFileName: paymentReceipts.fileName,
        receiptFileSize: paymentReceipts.fileSizeBytes,
        paymentId: payments.id,
        paymentAmount: payments.amount,
        paymentCurrency: payments.currency,
        paymentStatus: payments.status,
        paymentCreatedAt: payments.createdAt,
        userId: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        userEmail: users.email,
        courseId: courses.id,
        courseTitle: courses.title,
      })
      .from(paymentReceipts)
      .innerJoin(payments, eq(payments.id, paymentReceipts.paymentId))
      .innerJoin(users, eq(users.id, payments.userId))
      .innerJoin(courses, eq(courses.id, payments.courseId))
      .where(whereExpr)
      .orderBy(desc(paymentReceipts.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ value: total }] = await db
      .select({ value: count() })
      .from(paymentReceipts)
      .innerJoin(payments, eq(payments.id, paymentReceipts.paymentId))
      .innerJoin(users, eq(users.id, payments.userId))
      .where(whereExpr);

    return {
      data: rows.map((r) => ({
        receiptId: r.receiptId,
        uploadedAt: r.receiptCreatedAt,
        scanStatus: r.receiptScanStatus,
        reviewStatus: r.receiptReviewStatus,
        reviewedAt: r.receiptReviewedAt,
        fileName: r.receiptFileName,
        fileSizeBytes: r.receiptFileSize,
        payment: {
          id: r.paymentId,
          amount: r.paymentAmount,
          currency: r.paymentCurrency,
          status: r.paymentStatus,
          createdAt: r.paymentCreatedAt,
        },
        student: {
          id: r.userId,
          name: `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.userEmail,
          email: r.userEmail,
        },
        course: { id: r.courseId, title: r.courseTitle },
      })),
      pagination: {
        page,
        limit,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limit) || 1,
      },
    };
  }

  /**
   * Full receipt detail for the review modal. Includes refund-info snapshot,
   * a fresh signed URL for previewing the file inline, plus the student +
   * course context. Used only by the review modal; the list endpoint
   * deliberately keeps refund fields out.
   */
  async getReceiptForReview(receiptId: string) {
    const [row] = await db
      .select({
        receipt: paymentReceipts,
        payment: payments,
        userId: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        userEmail: users.email,
        courseId: courses.id,
        courseTitle: courses.title,
      })
      .from(paymentReceipts)
      .innerJoin(payments, eq(payments.id, paymentReceipts.paymentId))
      .innerJoin(users, eq(users.id, payments.userId))
      .innerJoin(courses, eq(courses.id, payments.courseId))
      .where(eq(paymentReceipts.id, receiptId))
      .limit(1);

    if (!row) {
      throw new NotFoundException('Receipt not found');
    }

    const downloadUrl = await this.storageService.getSignedUrl(
      'private',
      row.receipt.gcsObjectPath,
    );

    return {
      receipt: {
        id: row.receipt.id,
        uploadedAt: row.receipt.createdAt,
        fileName: row.receipt.fileName,
        mimeType: row.receipt.mimeType,
        fileSizeBytes: row.receipt.fileSizeBytes,
        scanStatus: row.receipt.scanStatus,
        scanCompletedAt: row.receipt.scanCompletedAt,
        reviewStatus: row.receipt.reviewStatus,
        reviewedBy: row.receipt.reviewedBy,
        reviewedAt: row.receipt.reviewedAt,
        reviewerNote: row.receipt.reviewerNote,
        financeInternalNote: row.receipt.financeInternalNote,
        refundInfo: {
          accountHolder: row.receipt.refundAccountHolder,
          iban: row.receipt.refundIban,
          bankName: row.receipt.refundBankName,
          nationalId: row.receipt.refundNationalId,
        },
        downloadUrl,
      },
      payment: row.payment,
      student: {
        id: row.userId,
        name:
          `${row.firstName || ''} ${row.lastName || ''}`.trim() || row.userEmail,
        email: row.userEmail,
      },
      course: { id: row.courseId, title: row.courseTitle },
    };
  }

  /**
   * Finance approves a receipt: flip review_status → approved, flip payment
   * to PAID + activate enrollment in one transaction (matches the same
   * post-payment dance other gateways trigger via webhook), then generate
   * the invoice and email the buyer.
   *
   * Optimistic lock: the receipt-status UPDATE filters on review_status =
   * 'pending', so double-clicks throw ConflictException instead of
   * double-approving.
   */
  async approveReceipt(
    receiptId: string,
    financeUser: AuthenticatedUser,
    opts: { internalNote?: string } = {},
    ipAddress?: string,
  ) {
    const [receipt] = await db
      .select()
      .from(paymentReceipts)
      .where(eq(paymentReceipts.id, receiptId))
      .limit(1);

    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }
    if (receipt.scanStatus === RECEIPT_SCAN_STATUS.INFECTED) {
      throw new BadRequestException(
        'Cannot approve a receipt flagged as infected by the malware scanner',
      );
    }
    if (receipt.scanStatus === RECEIPT_SCAN_STATUS.PENDING) {
      throw new BadRequestException(
        'Malware scan has not completed yet — wait a moment and try again',
      );
    }
    if (receipt.replacedById) {
      throw new BadRequestException(
        'This receipt has been superseded by a newer upload',
      );
    }

    const result = await db.transaction(async (tx) => {
      // Optimistic lock: only the first concurrent caller succeeds.
      const updated = await tx
        .update(paymentReceipts)
        .set({
          reviewStatus: RECEIPT_REVIEW_STATUS.APPROVED,
          reviewedBy: financeUser.id,
          reviewedAt: new Date(),
          financeInternalNote: opts.internalNote || receipt.financeInternalNote,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(paymentReceipts.id, receiptId),
            eq(paymentReceipts.reviewStatus, RECEIPT_REVIEW_STATUS.PENDING),
          ),
        )
        .returning({ id: paymentReceipts.id });

      if (updated.length === 0) {
        throw new ConflictException(
          'This receipt has already been actioned by another reviewer',
        );
      }

      // Flip the payment to PAID + activate enrollment. Mirrors the
      // canonical post-payment dance in PaymentsService.processPaymentSuccess.
      const [payment] = await tx
        .update(payments)
        .set({
          status: PAYMENT_STATUS.PAID,
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(payments.id, receipt.paymentId),
            sql`${payments.status} != ${PAYMENT_STATUS.PAID}`,
          ),
        )
        .returning();

      // Activate enrollments — multi-line carts pull from payment_items,
      // legacy single-line payments fall back to payment.enrollmentId.
      const lineEnrollmentRows = await tx
        .select({ enrollmentId: paymentItems.enrollmentId })
        .from(paymentItems)
        .where(eq(paymentItems.paymentId, receipt.paymentId));

      const enrollmentIdsToActivate = lineEnrollmentRows
        .map((r) => r.enrollmentId)
        .filter((id): id is string => Boolean(id));

      if (enrollmentIdsToActivate.length === 0 && payment?.enrollmentId) {
        enrollmentIdsToActivate.push(payment.enrollmentId);
      }

      if (enrollmentIdsToActivate.length > 0) {
        await tx
          .update(enrollments)
          .set({ status: ENROLLMENT_STATUS.ACTIVE, enrolledAt: new Date() })
          .where(inArray(enrollments.id, enrollmentIdsToActivate));
      }

      return payment;
    });

    if (!result) {
      // Payment was already paid (race with another path). Receipt flip stands.
      this.logger.warn(
        `Receipt ${receiptId} approved but payment was already paid; no enrollment change`,
      );
    }

    await this.auditLogService.log({
      entityType: 'payment',
      entityId: receipt.paymentId,
      action: 'bank_transfer_approved',
      performedBy: financeUser.id,
      ipAddress,
      metadata: { receiptId, internalNote: opts.internalNote || null },
    });

    // Fire-and-forget: generate invoice + send confirmation email outside the
    // transaction (both can block on network IO). All failures are logged but
    // don't roll back the approval — the payment is paid either way.
    void this.completeApprovalAsync(receipt.paymentId);

    return {
      receiptId,
      paymentId: receipt.paymentId,
      paymentStatus: PAYMENT_STATUS.PAID,
    };
  }

  private async completeApprovalAsync(paymentId: string): Promise<void> {
    try {
      await this.invoiceService.generateInvoice(paymentId);
    } catch (err) {
      this.logger.error(
        `Invoice generation failed for bank-transfer payment ${paymentId}: ${(err as Error).message}`,
      );
    }

    let pdf: { buffer: Buffer; filename: string } | undefined;
    try {
      const buf = await this.invoiceService.getInvoicePdfBuffer(paymentId);
      if (buf) pdf = buf;
    } catch {
      /* non-fatal — email goes out without the attachment */
    }

    const userId = await this.getUserIdForPayment(paymentId);
    if (!userId) {
      this.logger.warn(`Cannot send approval email: payment ${paymentId} has no user`);
      return;
    }

    try {
      await this.emailService.sendPaymentConfirmation(userId, paymentId, pdf);
    } catch (err) {
      this.logger.error(
        `Bank-transfer approval confirmation email failed for payment ${paymentId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Finance rejects a receipt: marks it rejected with a reviewer note that
   * the student sees on re-upload. The payment goes back to PENDING (not
   * FAILED) so the student can fix the issue and re-upload without starting
   * a brand-new checkout — the bank-transfer page handles the re-upload UX.
   *
   * Reviewer note is required and shown to the student verbatim. Internal
   * note (optional) stays private to finance.
   */
  async rejectReceipt(
    receiptId: string,
    financeUser: AuthenticatedUser,
    opts: { reviewerNote: string; internalNote?: string },
    ipAddress?: string,
  ) {
    if (!opts.reviewerNote?.trim() || opts.reviewerNote.trim().length < 5) {
      throw new BadRequestException(
        'Rejection requires a note (at least 5 characters) explaining why — the student will see this',
      );
    }

    const [receipt] = await db
      .select()
      .from(paymentReceipts)
      .where(eq(paymentReceipts.id, receiptId))
      .limit(1);

    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }
    if (receipt.replacedById) {
      throw new BadRequestException(
        'This receipt has been superseded by a newer upload',
      );
    }

    await db.transaction(async (tx) => {
      const updated = await tx
        .update(paymentReceipts)
        .set({
          reviewStatus: RECEIPT_REVIEW_STATUS.REJECTED,
          reviewedBy: financeUser.id,
          reviewedAt: new Date(),
          reviewerNote: opts.reviewerNote.trim(),
          financeInternalNote: opts.internalNote || receipt.financeInternalNote,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(paymentReceipts.id, receiptId),
            eq(paymentReceipts.reviewStatus, RECEIPT_REVIEW_STATUS.PENDING),
          ),
        )
        .returning({ id: paymentReceipts.id });

      if (updated.length === 0) {
        throw new ConflictException(
          'This receipt has already been actioned by another reviewer',
        );
      }

      // Roll payment back to PENDING so the student can upload a replacement
      // (the bank-transfer page allows uploads on any non-finalized status).
      await tx
        .update(payments)
        .set({ status: PAYMENT_STATUS.PENDING, updatedAt: new Date() })
        .where(eq(payments.id, receipt.paymentId));
    });

    await this.auditLogService.log({
      entityType: 'payment',
      entityId: receipt.paymentId,
      action: 'bank_transfer_rejected',
      performedBy: financeUser.id,
      ipAddress,
      metadata: {
        receiptId,
        reviewerNote: opts.reviewerNote.trim(),
        internalNote: opts.internalNote || null,
      },
    });

    void this.emailService
      .sendBankTransferRejected(receipt.paymentId, opts.reviewerNote.trim())
      .catch((err) =>
        this.logger.error(`Bank-transfer rejection email failed: ${err.message}`),
      );

    return {
      receiptId,
      paymentId: receipt.paymentId,
      paymentStatus: PAYMENT_STATUS.PENDING,
    };
  }

  private async getUserIdForPayment(paymentId: string): Promise<string | null> {
    const [row] = await db
      .select({ userId: payments.userId })
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);
    return row?.userId || null;
  }

  // ─── Internals ──────────────────────────────────────────────────────

  private async getActiveReceipt(paymentId: string): Promise<PaymentReceipt | null> {
    const [active] = await db
      .select()
      .from(paymentReceipts)
      .where(
        and(
          eq(paymentReceipts.paymentId, paymentId),
          isNull(paymentReceipts.replacedById),
        ),
      )
      .orderBy(desc(paymentReceipts.createdAt))
      .limit(1);
    return active || null;
  }

  /**
   * Background poll: every SCAN_POLL_INTERVAL_MS, ask GCS for the receipt's
   * scan verdict and update the DB. Stops after a verdict is reached or the
   * attempt cap is hit. setTimeout is fine here — this runs inside the API
   * process and we tolerate restarts (finance dashboard re-checks pending
   * receipts on read).
   */
  private async pollScanStatus(receiptId: string, gcsPath: string, attempts = 0): Promise<void> {
    try {
      const { status, scannedAt } = await this.storageService.getScanStatus(
        'private',
        gcsPath,
      );

      if (status === 'pending' || status === 'unknown') {
        if (attempts >= SCAN_POLL_MAX_ATTEMPTS) {
          this.logger.warn(
            `Scan still pending after ${attempts} attempts for receipt ${receiptId}; leaving DB row pending`,
          );
          return;
        }
        setTimeout(
          () => void this.pollScanStatus(receiptId, gcsPath, attempts + 1),
          SCAN_POLL_INTERVAL_MS,
        );
        return;
      }

      // Verdict in. Map GCS status → our schema's scan_status.
      const newStatus =
        status === 'clean'
          ? RECEIPT_SCAN_STATUS.CLEAN
          : RECEIPT_SCAN_STATUS.INFECTED;

      await db
        .update(paymentReceipts)
        .set({
          scanStatus: newStatus,
          scanEngine: 'clamav-eventarc',
          scanCompletedAt: scannedAt ? new Date(scannedAt) : new Date(),
          updatedAt: new Date(),
        })
        .where(eq(paymentReceipts.id, receiptId));

      this.logger.log(
        `Receipt ${receiptId} scan verdict: ${newStatus} (attempt ${attempts + 1})`,
      );

      // TODO Phase 1C: if infected, email student to re-upload + flag in finance queue
    } catch (err) {
      this.logger.error(
        `pollScanStatus failed for receipt ${receiptId}: ${(err as Error).message}`,
      );
    }
  }
}

/**
 * Strip filesystem-unsafe characters from a user-supplied filename while
 * keeping the extension. Limits length so GCS object names stay sane.
 */
function sanitizeFileName(name: string): string {
  const base = (name || 'receipt').replace(/[^a-zA-Z0-9._-]/g, '_');
  return base.length > 100 ? base.slice(0, 100) : base;
}

/**
 * Hide finance-internal fields from the buyer-facing payload. Buyers can
 * see whether their upload is being scanned/reviewed and the rejection note
 * (if any), but never the private finance comment.
 */
function sanitizeReceiptForBuyer(r: PaymentReceipt) {
  return {
    id: r.id,
    fileName: r.fileName,
    scanStatus: r.scanStatus,
    reviewStatus: r.reviewStatus,
    reviewerNote: r.reviewStatus === 'rejected' ? r.reviewerNote : null,
    uploadedAt: r.createdAt,
  };
}
