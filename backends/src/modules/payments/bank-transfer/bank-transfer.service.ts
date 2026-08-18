import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  HttpException,
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
import { decryptPII, encryptPII } from '../../../common/crypto';
import { InvoiceService } from '../services/invoice.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { SubmitDraftDto } from './dto/submit-draft.dto';
import { PaymentsService } from '../payments.service';
import { XapiService } from '../../xapi/xapi.service';
import { EnrollmentsService } from '../../enrollments/enrollments.service';
import { PaymentAdminNotifierService } from '../services/payment-admin-notifier.service';
import { GatewayCredentialsService } from '../gateways/gateway-credentials.service';

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
    private readonly paymentsService: PaymentsService,
    private readonly xapiService: XapiService,
    private readonly enrollmentsService: EnrollmentsService,
    private readonly paymentAdminNotifier: PaymentAdminNotifierService,
    private readonly gatewayCredentials: GatewayCredentialsService,
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

    // Block duplicate uploads: if there's already an active receipt sitting in
    // 'pending' review, the student must wait for finance to action it (or
    // refresh and see the rejection) before submitting again. The FE hides the
    // form in this state; this is the API-side belt-and-suspenders.
    const prevReceipt = await this.getActiveReceipt(paymentId);
    if (prevReceipt && prevReceipt.reviewStatus === RECEIPT_REVIEW_STATUS.PENDING) {
      throw new ConflictException(
        'A receipt for this payment is already under review. Wait for the finance team or contact support if you need to make a change.',
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
          refundIban: encryptPII(dto.refundIban),
          refundBankName: dto.refundBankName,
          refundNationalId: encryptPII(dto.refundNationalId || null),
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

    // Phase G: alert admin/finance that a bank-transfer receipt is
    // waiting on their review.
    void this.paymentAdminNotifier
      .notifyBankTransferPending(paymentId)
      .catch(() => {});

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

    // Malware gate — the buyer or finance reviewer must not be handed a
    // download link for a receipt that the scanner hasn't cleared. Throws
    // 403 quarantined / 425 pending. See StorageService.getSignedUrl.
    const url = await this.storageService.getSignedUrl(
      'private',
      receipt.gcsObjectPath,
      { requireCleanScan: true },
    );

    return { url, fileName: receipt.fileName };
  }

  /**
   * Draft submission — the buyer never had a payment row before this call.
   * Validates the cart (capacity, NELC, discount) via PaymentsService.quote,
   * uploads the file, then creates payment + payment_items + receipt in
   * one transaction with status AWAITING_APPROVAL. After this returns, the
   * finance dashboard shows exactly one row and the audit log has exactly
   * one upload event.
   *
   * Idempotency-by-intent: if the buyer somehow already has a pending or
   * awaiting-approval bank transfer for any of these courses (another
   * tab / race), we reject with 409 instead of duplicating.
   */
  async submitDraft(
    user: AuthenticatedUser,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    dto: SubmitDraftDto,
    ipAddress?: string,
  ): Promise<{ paymentId: string; receiptId: string; paymentStatus: string }> {
    // Bank transfer doesn't go through /payments/initiate, so gate it here.
    // Reject before we upload the file to GCS or open a transaction. Doesn't
    // affect in-flight approvals — those live on payment rows already.
    if (!this.gatewayCredentials.isEnabled('bank_transfer')) {
      throw new BadRequestException(
        'Bank transfer is currently unavailable. Please choose another payment method.',
      );
    }

    if (!file?.buffer) {
      throw new BadRequestException('Receipt file is required');
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Unsupported file type. Allowed: PDF, JPG, JPEG, PNG',
      );
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      throw new BadRequestException(
        `File too large. Maximum size is ${Math.floor(MAX_RECEIPT_BYTES / 1024 / 1024)} MB`,
      );
    }

    // Re-run the full validation pipeline (course exists, capacity, NELC,
    // discount). Throws BadRequestException / NotFoundException on failure,
    // same as the regular initiate flow. `applyActiveCampaign` opts into
    // stacking a direct-campaign discount on top of any coupon in
    // `discountCode` — mirrors the /initiate flow.
    const quote = await this.paymentsService.quotePayment(user, {
      courseIds: dto.courseIds,
      discountCode: dto.discountCode,
      applyActiveCampaign: dto.applyActiveCampaign,
    });

    // Belt-and-suspenders: block only when another receipt is actively
    // under finance review. A PENDING row at this point = the previous
    // receipt was rejected and the student is starting over, which is
    // allowed. We'll mark those old rows as FAILED inside the transaction
    // below so the finance dashboard isn't littered with rejected attempts.
    const inFlightSingle = await db
      .select({ id: payments.id, courseId: payments.courseId })
      .from(payments)
      .where(
        and(
          eq(payments.userId, user.id),
          eq(payments.gateway, 'bank_transfer'),
          inArray(payments.status, [
            PAYMENT_STATUS.AWAITING_APPROVAL,
          ] as any),
          inArray(payments.courseId, quote.courseIds),
        ),
      );
    const inFlightMulti = await db
      .select({ id: payments.id, courseId: paymentItems.courseId })
      .from(paymentItems)
      .innerJoin(payments, eq(payments.id, paymentItems.paymentId))
      .where(
        and(
          eq(payments.userId, user.id),
          eq(payments.gateway, 'bank_transfer'),
          inArray(payments.status, [
            PAYMENT_STATUS.AWAITING_APPROVAL,
          ] as any),
          inArray(paymentItems.courseId, quote.courseIds),
        ),
      );
    if (inFlightSingle.length > 0 || inFlightMulti.length > 0) {
      throw new ConflictException(
        'You already have a bank transfer in review for one of these courses. Open the pending payment instead of starting a new one.',
      );
    }

    // First write: file to private GCS. If the transaction below fails, the
    // file is orphaned — cheap and the scanner doesn't care about untracked
    // objects. Inverting the order (DB first, GCS second) would leave a
    // committed row with a missing file, which is worse.
    const safeName = sanitizeFileName(file.originalname);
    // No paymentId yet — use a fresh UUID for the directory so paths stay
    // unique. We move the file's logical "owner" to the payment row below.
    const draftKey = randomUUID();
    const objectPath = `${RECEIPTS_PREFIX}/draft-${draftKey}/${randomUUID()}-${safeName}`;
    await this.storageService.uploadPrivate(
      file.buffer,
      objectPath,
      file.mimetype,
    );

    const { paymentId, receiptId } = await db.transaction(async (tx) => {
      // Primary course = first cart line (legacy column on payments table).
      const primaryCourseId = quote.courseIds[0];

      // Mark prior REJECTED or stale PENDING bank-transfer attempts for these
      // courses as FAILED with reason "Superseded …" so the finance dashboard
      // shows one entry per submission cycle (not a trail of dead rejections).
      // Only sweep this user's own rows.
      const supersedeStatuses = [
        PAYMENT_STATUS.PENDING,
        PAYMENT_STATUS.REJECTED,
      ] as any;
      const supersedeSingle = await tx
        .select({ id: payments.id })
        .from(payments)
        .where(
          and(
            eq(payments.userId, user.id),
            eq(payments.gateway, 'bank_transfer'),
            inArray(payments.status, supersedeStatuses),
            inArray(payments.courseId, quote.courseIds),
          ),
        );
      const supersedeMulti = await tx
        .select({ id: payments.id })
        .from(paymentItems)
        .innerJoin(payments, eq(payments.id, paymentItems.paymentId))
        .where(
          and(
            eq(payments.userId, user.id),
            eq(payments.gateway, 'bank_transfer'),
            inArray(payments.status, supersedeStatuses),
            inArray(paymentItems.courseId, quote.courseIds),
          ),
        );
      const staleIds = Array.from(
        new Set([...supersedeSingle, ...supersedeMulti].map((r) => r.id)),
      );
      if (staleIds.length > 0) {
        await tx
          .update(payments)
          .set({
            status: PAYMENT_STATUS.FAILED,
            failedAt: new Date(),
            failureReason: 'Superseded by new bank transfer attempt',
            updatedAt: new Date(),
          })
          .where(inArray(payments.id, staleIds));
      }

      // Build payment metadata that the proforma PDF + UI rely on. Mirrors
      // the /initiate metadata shape so settlement (recordUsage) can find
      // both discount legs on the same keys.
      const metadata = {
        subtotal: quote.totals.subtotal,
        originalPrice: quote.totals.originalSubtotal,
        saleDiscountAmount: quote.totals.saleDiscount,
        // Legacy combined-discount keys (kept for backward compat with
        // existing invoice + refund readers).
        discountAmount: quote.totals.discountAmount,
        discountCode: quote.totals.discountCode,
        discountId: quote.totals.discountId,
        // Two stacked legs, persisted separately so settlement can record
        // both redemptions.
        couponAmount: quote.totals.couponAmount,
        couponId: quote.totals.couponId,
        couponCode: quote.totals.couponCode,
        campaignAmount: quote.totals.campaignAmount,
        campaignId: quote.totals.campaignId,
        campaignName: quote.totals.campaignName,
        taxAmount: quote.totals.taxAmount,
        source: 'bank_transfer_draft',
      };

      const [paymentRow] = await tx
        .insert(payments)
        .values({
          userId: user.id,
          courseId: primaryCourseId,
          amount: quote.totals.totalAmount.toFixed(2),
          currency: quote.totals.currency,
          gateway: 'bank_transfer',
          paymentMethod: 'bank_transfer',
          status: PAYMENT_STATUS.AWAITING_APPROVAL,
          gatewayChargeId: `bt_draft_${draftKey}`,
          metadata,
        })
        .returning({ id: payments.id });

      // Reserve a pending_payment enrollment for every course in the cart
      // and link it to its paymentItems row. Without this, approveReceipt
      // flips the payment to PAID but has nothing to activate — the student
      // ends up with status=paid but no enrollment and no course access.
      // Mirrors PaymentsService.initiatePayment's enrollment-reservation
      // dance (which the gateway flows go through but the bank-transfer
      // draft skipped).
      const enrollmentByCourseId = new Map<string, string>();
      for (const it of quote.lineItems) {
        const [existing] = await tx
          .select({ id: enrollments.id, status: enrollments.status })
          .from(enrollments)
          .where(
            and(
              eq(enrollments.courseId, it.id),
              eq(enrollments.studentId, user.id),
            ),
          )
          .limit(1);
        if (existing && existing.status === ENROLLMENT_STATUS.ACTIVE) {
          throw new BadRequestException(
            `You are already enrolled in "${it.title}"`,
          );
        }
        let enrollmentId: string;
        if (existing) {
          // Reuse a prior pending_payment / dropped row instead of stacking
          // duplicates (the unique constraint on (course_id, student_id)
          // would block a second insert anyway).
          await tx
            .update(enrollments)
            .set({ status: ENROLLMENT_STATUS.PENDING_PAYMENT })
            .where(eq(enrollments.id, existing.id));
          enrollmentId = existing.id;
        } else {
          const [created] = await tx
            .insert(enrollments)
            .values({
              courseId: it.id,
              studentId: user.id,
              status: ENROLLMENT_STATUS.PENDING_PAYMENT,
              source: 'purchase',
            })
            .returning({ id: enrollments.id });
          enrollmentId = created.id;
        }
        enrollmentByCourseId.set(it.id, enrollmentId);
      }

      // Multi-line items so refund + invoice generation see the full cart.
      // enrollmentId is set per row so approveReceipt can activate them on
      // finance approval.
      if (quote.lineItems.length > 0) {
        await tx.insert(paymentItems).values(
          quote.lineItems.map((it) => ({
            paymentId: paymentRow.id,
            courseId: it.id,
            enrollmentId: enrollmentByCourseId.get(it.id),
            unitPrice: it.price.toFixed(2),
            salePrice: it.effectivePrice.toFixed(2),
            discountAmount: '0.00',
            lineTotal: it.effectivePrice.toFixed(2),
          })),
        );
      }

      const [created] = await tx
        .insert(paymentReceipts)
        .values({
          paymentId: paymentRow.id,
          uploadedBy: user.id,
          fileName: file.originalname,
          mimeType: file.mimetype,
          fileSizeBytes: file.size,
          gcsObjectPath: objectPath,
          scanStatus: RECEIPT_SCAN_STATUS.PENDING,
          reviewStatus: RECEIPT_REVIEW_STATUS.PENDING,
          refundAccountHolder: dto.refundAccountHolder,
          refundIban: encryptPII(dto.refundIban),
          refundBankName: dto.refundBankName,
          refundNationalId: encryptPII(dto.refundNationalId || null),
        })
        .returning({ id: paymentReceipts.id });

      return { paymentId: paymentRow.id, receiptId: created.id };
    });

    await this.auditLogService.log({
      entityType: 'payment',
      entityId: paymentId,
      action: 'bank_transfer_draft_submitted',
      performedBy: user.id,
      ipAddress,
      metadata: {
        receiptId,
        fileName: file.originalname,
        fileSize: file.size,
        courseIds: quote.courseIds,
        totalAmount: quote.totals.totalAmount,
        discountCode: quote.totals.discountCode || null,
      },
    });

    // Email + scan-poll outside the transaction; failures are logged, not fatal.
    void this.emailService
      .sendBankTransferReceived(user.id, paymentId)
      .catch((err) =>
        this.logger.error(
          `Failed to send bank transfer receipt email: ${err.message}`,
        ),
      );

    // Phase G: alert admin/finance that a bank-transfer receipt is
    // waiting on their review.
    void this.paymentAdminNotifier
      .notifyBankTransferPending(paymentId)
      .catch(() => {});

    void this.pollScanStatus(receiptId, objectPath);

    return {
      paymentId,
      receiptId,
      paymentStatus: PAYMENT_STATUS.AWAITING_APPROVAL,
    };
  }

  /**
   * Render a branded proforma-invoice PDF for an unpaid bank-transfer payment
   * and return the raw buffer. The student downloads this from the
   * bank-transfer page so they can forward it to a finance department /
   * employer for reimbursement before they actually make the transfer.
   * Ownership is enforced by the controller.
   */
  async getProformaPdf(
    paymentId: string,
    user: AuthenticatedUser,
    locale: 'en' | 'ar' = 'en',
  ): Promise<Buffer> {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.userId !== user.id) {
      throw new ForbiddenException(
        'You can only download proformas for your own payments',
      );
    }
    if (payment.gateway !== 'bank_transfer') {
      throw new BadRequestException(
        'Proforma invoices are only available for bank-transfer payments',
      );
    }
    return this.invoiceService.generateProformaPdfBuffer(paymentId, locale);
  }

  /**
   * Build a proforma PDF for the draft-mode checkout — the buyer hasn't
   * committed (no payment row yet) but wants to download the proforma to
   * forward to a finance team / employer before making the wire. We run
   * the same quote validation as submitDraft so price / discount / cart
   * limits are honored, then hand off to InvoiceService.
   */
  async getProformaPdfForQuote(
    user: AuthenticatedUser,
    dto: {
      courseIds: string[];
      discountCode?: string;
      applyActiveCampaign?: boolean;
      locale?: 'en' | 'ar';
    },
  ): Promise<{ buffer: Buffer; proformaNumber: string }> {
    const quote = await this.paymentsService.quotePayment(user, dto);

    const userData = await this.getUserData(user.id);

    const lineItems = quote.lineItems.map((li) => ({
      description: li.title,
      descriptionAr: li.titleAr || null,
      deliveryType: li.deliveryType || null,
      amount: li.effectivePrice,
    }));

    return this.invoiceService.generateProformaPdfFromQuote({
      buyer: {
        name:
          `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() ||
          user.email,
        email: user.email,
        nationalId: decryptPII((userData as any)?.nationalId) || null,
      },
      courseIds: quote.courseIds,
      lineItems,
      subtotal: quote.totals.subtotal,
      discountAmount: quote.totals.discountAmount,
      taxAmount: quote.totals.taxAmount,
      totalAmount: quote.totals.totalAmount,
      locale: dto.locale || 'en',
    });
  }

  private async getUserData(userId: string) {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row || null;
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

    // Malware gate — finance must not preview a receipt the scanner has
    // not yet cleared. We degrade gracefully instead of throwing (the
    // review modal has many other useful fields the reviewer needs);
    // the frontend hides the preview and shows a scan-status chip when
    // downloadUrl is null. Approval is separately gated in approveReceipt.
    let downloadUrl: string | null = null;
    try {
      downloadUrl = await this.storageService.getSignedUrl(
        'private',
        row.receipt.gcsObjectPath,
        { requireCleanScan: true },
      );
    } catch (err) {
      const status = (err as HttpException)?.getStatus?.();
      // 403 quarantined, 425 pending — both are expected scan-gate rejects.
      // Any other error is a real failure and must propagate.
      if (status === 403 || status === 425) {
        // Keep downloadUrl null; the modal surfaces scan status separately.
      } else {
        throw err;
      }
    }

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
          iban: decryptPII(row.receipt.refundIban),
          bankName: row.receipt.refundBankName,
          nationalId: decryptPII(row.receipt.refundNationalId),
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
   * KPIs for the bank-transfer queue page header. Splits into:
   *   - "live" metrics that reflect current state (always now-snapshot,
   *     ignore date range) — what finance cares about RIGHT NOW
   *   - "window" metrics in the date range (defaults caller-side to 30d)
   *
   * Single round-trip; mirrors getRefundSummary / getInvoiceSummary shape.
   */
  async getQueueSummary(opts: { startDate?: string; endDate?: string }) {
    const startDate = opts.startDate ? new Date(opts.startDate) : null;
    const endDateRaw = opts.endDate ? new Date(opts.endDate) : null;
    if (endDateRaw) endDateRaw.setHours(23, 59, 59, 999);

    // ─── Live metrics (current state, ignore date range) ────────────
    const [liveRow] = await db
      .select({
        pendingCount: sql<number>`COUNT(CASE WHEN ${paymentReceipts.reviewStatus} = 'pending' AND ${paymentReceipts.scanStatus} = 'clean' THEN 1 END)::int`,
        pendingAmount: sql<string>`COALESCE(SUM(CASE WHEN ${paymentReceipts.reviewStatus} = 'pending' AND ${paymentReceipts.scanStatus} = 'clean' THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
        scanPendingCount: sql<number>`COUNT(CASE WHEN ${paymentReceipts.scanStatus} = 'pending' THEN 1 END)::int`,
        oldestPendingHours: sql<string>`COALESCE(MAX(CASE WHEN ${paymentReceipts.reviewStatus} = 'pending' AND ${paymentReceipts.scanStatus} = 'clean' THEN EXTRACT(EPOCH FROM (NOW() - ${paymentReceipts.createdAt})) / 3600.0 END), 0)`,
        infectedCount: sql<number>`COUNT(CASE WHEN ${paymentReceipts.scanStatus} = 'infected' THEN 1 END)::int`,
      })
      .from(paymentReceipts)
      .innerJoin(payments, eq(payments.id, paymentReceipts.paymentId))
      .where(isNull(paymentReceipts.replacedById));

    // ─── In-window metrics ───────────────────────────────────────────
    const windowConditions: any[] = [];
    if (startDate)
      windowConditions.push(sql`${paymentReceipts.reviewedAt} >= ${startDate}`);
    if (endDateRaw)
      windowConditions.push(sql`${paymentReceipts.reviewedAt} <= ${endDateRaw}`);
    const windowWhere =
      windowConditions.length > 0 ? and(...windowConditions) : undefined;

    const [windowRow] = await db
      .select({
        approvedCount: sql<number>`COUNT(CASE WHEN ${paymentReceipts.reviewStatus} = 'approved' THEN 1 END)::int`,
        approvedAmount: sql<string>`COALESCE(SUM(CASE WHEN ${paymentReceipts.reviewStatus} = 'approved' THEN ${payments.amount}::numeric ELSE 0 END), 0)`,
        rejectedCount: sql<number>`COUNT(CASE WHEN ${paymentReceipts.reviewStatus} = 'rejected' THEN 1 END)::int`,
        avgReviewHours: sql<string>`COALESCE(AVG(CASE WHEN ${paymentReceipts.reviewedAt} IS NOT NULL THEN EXTRACT(EPOCH FROM (${paymentReceipts.reviewedAt} - ${paymentReceipts.createdAt})) / 3600.0 END), 0)`,
      })
      .from(paymentReceipts)
      .innerJoin(payments, eq(payments.id, paymentReceipts.paymentId))
      .where(
        and(
          isNull(paymentReceipts.replacedById),
          sql`${paymentReceipts.reviewedAt} IS NOT NULL`,
          windowWhere,
        ),
      );

    return {
      live: {
        pendingCount: liveRow?.pendingCount ?? 0,
        pendingAmount: Number(liveRow?.pendingAmount ?? 0),
        scanPendingCount: liveRow?.scanPendingCount ?? 0,
        oldestPendingHours: Number(
          Number(liveRow?.oldestPendingHours ?? 0).toFixed(1),
        ),
        infectedCount: liveRow?.infectedCount ?? 0,
      },
      window: {
        approvedCount: windowRow?.approvedCount ?? 0,
        approvedAmount: Number(windowRow?.approvedAmount ?? 0),
        rejectedCount: windowRow?.rejectedCount ?? 0,
        avgReviewHours: Number(
          Number(windowRow?.avgReviewHours ?? 0).toFixed(1),
        ),
      },
    };
  }

  /**
   * Replacement chain for a payment — ALL receipts uploaded for it,
   * including superseded ones, in chronological order. Lets finance see
   * the full upload history (re-uploads after rejection).
   */
  async getReplacementChain(receiptId: string) {
    const [pivot] = await db
      .select({ paymentId: paymentReceipts.paymentId })
      .from(paymentReceipts)
      .where(eq(paymentReceipts.id, receiptId))
      .limit(1);
    if (!pivot) return [];

    const rows = await db
      .select({
        id: paymentReceipts.id,
        uploadedAt: paymentReceipts.createdAt,
        fileName: paymentReceipts.fileName,
        scanStatus: paymentReceipts.scanStatus,
        reviewStatus: paymentReceipts.reviewStatus,
        reviewedAt: paymentReceipts.reviewedAt,
        reviewerNote: paymentReceipts.reviewerNote,
        replacedById: paymentReceipts.replacedById,
      })
      .from(paymentReceipts)
      .where(eq(paymentReceipts.paymentId, pivot.paymentId))
      .orderBy(desc(paymentReceipts.createdAt));

    return rows.map((r) => ({
      ...r,
      isCurrent: r.replacedById === null && r.id !== receiptId ? false : !r.replacedById,
      isThis: r.id === receiptId,
    }));
  }

  /**
   * Audit timeline for a receipt: UNION across receipt-level events
   * (`payment_receipt`) + parent payment events + child invoice events
   * + any refund spawned from that payment. Same pattern as
   * InvoiceService.getInvoiceAudit and RefundService.getRefundAudit.
   */
  async getReceiptAudit(receiptId: string, limit: number = 100) {
    const [pivot] = await db
      .select({ paymentId: paymentReceipts.paymentId })
      .from(paymentReceipts)
      .where(eq(paymentReceipts.id, receiptId))
      .limit(1);
    if (!pivot) return [];

    const cap = Math.min(limit, 200);
    const result = await db.execute(sql`
      SELECT a.id,
             a.action,
             a.entity_type AS "entityType",
             a.entity_id AS "entityId",
             a.performed_by AS "performedBy",
             a.metadata,
             a.created_at AS "createdAt",
             CASE
               WHEN u.id IS NULL THEN NULL
               ELSE CONCAT(u.first_name, ' ', u.last_name)
             END AS "actorName",
             u.email AS "actorEmail"
      FROM audit_logs a
      LEFT JOIN users u ON a.performed_by = u.id
      WHERE
        (a.entity_type = 'payment_receipt' AND a.entity_id IN (
          SELECT id FROM payment_receipts WHERE payment_id = ${pivot.paymentId}
        ))
        OR (a.entity_type = 'payment' AND a.entity_id = ${pivot.paymentId})
        OR (a.entity_type = 'invoice' AND a.entity_id IN (
          SELECT id FROM invoices WHERE payment_id = ${pivot.paymentId}
        ))
        OR (a.entity_type = 'refund' AND a.entity_id IN (
          SELECT id FROM refunds WHERE payment_id = ${pivot.paymentId}
        ))
      ORDER BY a.created_at DESC
      LIMIT ${cap}
    `);
    return result.rows as Array<{
      id: string;
      action: string;
      entityType: string;
      entityId: string;
      performedBy: string | null;
      metadata: Record<string, unknown> | null;
      createdAt: string;
      actorName: string | null;
      actorEmail: string | null;
    }>;
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

    const activatedEnrollments: { id: string; courseId: string; studentId: string }[] = [];
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
        const activated = await tx
          .update(enrollments)
          .set({ status: ENROLLMENT_STATUS.ACTIVE, enrolledAt: new Date() })
          .where(inArray(enrollments.id, enrollmentIdsToActivate))
          .returning({
            id: enrollments.id,
            courseId: enrollments.courseId,
            studentId: enrollments.studentId,
          });
        activatedEnrollments.push(...activated);
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

    // NELC xAPI — emit 'registered' for each enrollment that just went
    // active on this approval. Outside the transaction so a queue/LRS
    // hiccup can't roll back the approval.
    for (const e of activatedEnrollments) {
      void this.xapiService.emitCourseEnrollment(e.studentId, e.courseId, e.id);
      // Webinar auto-register — bank-transfer approval is the third
      // self-service enrollment path that was missing this hook. Past
      // webinars are skipped inside the helper.
      void this.enrollmentsService
        .autoRegisterStudentForWebinarCourse(e.courseId, e.studentId)
        .catch((err) =>
          this.logger.warn(`Webinar auto-register (bank-transfer) failed: ${err.message}`),
        );
    }

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
   * the student sees on re-upload. The payment moves to FAILED with the
   * reviewer note copied into failureReason so the Payments page shows the
   * rejection immediately (rather than the row sitting in "pending" until
   * the student starts a new draft).
   *
   * Student is still unblocked because getEnrollmentStatusBulk treats only
   * AWAITING_APPROVAL as blocking. If the student re-uploads via the old
   * URL, uploadReceipt revives the payment back to AWAITING_APPROVAL.
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

      // Mark payment as REJECTED (semantically distinct from FAILED, which
      // is reserved for platform/gateway failures). failureReason stores the
      // reviewer note so the Payments page can surface it without joining
      // back to paymentReceipts. uploadReceipt revives the payment back to
      // AWAITING_APPROVAL if the student re-uploads on the same URL.
      await tx
        .update(payments)
        .set({
          status: PAYMENT_STATUS.REJECTED,
          failedAt: new Date(),
          failureReason: `Bank transfer receipt rejected: ${opts.reviewerNote.trim()}`,
          updatedAt: new Date(),
        })
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
      paymentStatus: PAYMENT_STATUS.REJECTED,
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

      // Notify the buyer when their receipt was flagged infected so the
      // upload doesn't just sit in "infected" forever waiting for
      // finance to notice. Finance still sees infected receipts in the
      // pending queue with a red scan-status chip; this closes the loop
      // for the student side.
      if (newStatus === RECEIPT_SCAN_STATUS.INFECTED) {
        void this.notifyBuyerReceiptInfected(receiptId);
      }
    } catch (err) {
      this.logger.error(
        `pollScanStatus failed for receipt ${receiptId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Look up the payment for a flagged-infected receipt and email the
   * buyer with a re-upload prompt. Best-effort: any failure here logs a
   * warning and does not disturb the scanner path that fired the
   * verdict update. Called via `void` from pollScanStatus. Email
   * service resolves the buyer's preferred locale internally and
   * renders the branded bilingual template.
   */
  private async notifyBuyerReceiptInfected(receiptId: string): Promise<void> {
    try {
      const [row] = await db
        .select({ paymentId: paymentReceipts.paymentId })
        .from(paymentReceipts)
        .where(eq(paymentReceipts.id, receiptId))
        .limit(1);

      if (!row?.paymentId) {
        this.logger.warn(
          `Cannot notify buyer for infected receipt ${receiptId}: payment not found`,
        );
        return;
      }

      await this.emailService.sendReceiptFlaggedInfected(row.paymentId);
    } catch (err) {
      this.logger.warn(
        `notifyBuyerReceiptInfected failed for ${receiptId}: ${(err as Error).message}`,
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
