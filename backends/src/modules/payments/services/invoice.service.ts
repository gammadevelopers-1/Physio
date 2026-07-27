import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq, and, desc, count, sql, gte, lte, inArray } from 'drizzle-orm';
import { db } from '../../../database';
import {
  invoices,
  payments,
  paymentItems,
  courses,
  users,
  refunds,
  INVOICE_STATUS,
  PAYMENT_STATUS,
} from '../../../database/schema';
import { StorageService } from '../../storage/storage.service';
import { AuditLogService } from '../../audit-logs/audit-logs.service';
import { TaxComputationService } from './tax-computation.service';
import { parseStartDate, parseEndDate } from '../../../common/date-range';
import { toCsvString } from '../../../common/exports/csv.util';
import { decryptPII } from '../../../common/crypto';
import {
  SiteSettingsService,
  SiteBranding,
} from '../../site-settings/site-settings.service';
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import * as path from 'path';
import * as fs from 'fs';

// Lazy-cached brand logo — read once from disk, reused for every
// invoice/proforma. Falls back to null if the asset is missing so PDF
// generation never breaks on a bad deploy.
let cachedLogo: Buffer | null | undefined = undefined;
function getBrandLogo(): Buffer | null {
  if (cachedLogo !== undefined) return cachedLogo;
  try {
    cachedLogo = fs.readFileSync(
      path.join(process.cwd(), 'src', 'assets', 'logo.png'),
    );
  } catch {
    cachedLogo = null;
  }
  return cachedLogo;
}

export type InvoiceLocale = 'en' | 'ar';

// Every user-visible label in both invoice and proforma templates. The
// EN dict is authoritative; AR mirrors it 1:1 so a missing key surfaces
// as a TS error, not a rendered "undefined" on a customer-facing PDF.
const INVOICE_LABELS = {
  en: {
    invoiceTitle: 'INVOICE',
    proformaTitle: 'PROFORMA INVOICE',
    statusPaid: 'PAID',
    statusRefunded: 'REFUNDED',
    statusCancelled: 'CANCELLED',
    statusIssued: 'ISSUED',
    statusAwaiting: 'AWAITING PAYMENT',
    invoiceNumber: 'Invoice #',
    issuedDate: 'Issued',
    paidDate: 'Paid',
    dueDate: 'Due',
    validUntil: 'Valid until',
    billTo: 'BILL TO',
    paymentDetails: 'PAYMENT DETAILS',
    gateway: 'Gateway',
    method: 'Method',
    reference: 'Reference',
    bankName: 'Bank',
    accountName: 'Account',
    iban: 'IBAN',
    description: 'DESCRIPTION',
    qty: 'QTY',
    unit: 'UNIT',
    amount: 'AMOUNT',
    subtotal: 'Subtotal',
    discount: 'Discount',
    zeroRated: 'Zero-rated (0%)',
    total: 'TOTAL',
    scanToVerify: 'Scan to verify',
    verifyLine: 'Authenticate this invoice via QR or:',
    footerThankYou:
      'Thank you for your purchase. This invoice serves as your official tax receipt.',
    footerProforma:
      'Pay via bank transfer to activate your enrollment. Once received, a tax invoice will be emailed automatically.',
    proformaNumber: 'Proforma #',
    paymentIntent: 'PAYMENT INTENT',
    statusLabel: 'Status',
    awaitingTransfer: 'Awaiting transfer',
    amountDue: 'AMOUNT DUE',
    noticeTitle: 'Notice',
    noticeBody:
      'This is a PROFORMA invoice issued before payment. It is NOT a tax invoice. A final tax invoice (with QR-verifiable invoice number) will be issued once your bank transfer is received and approved by our finance team.',
    pageOf: (n: number, total: number) => `Page ${n} of ${total}`,
    vatNo: (n: string) => `VAT No: ${n}`,
    vatRow: (rate: number) => `VAT (${rate}%)`,
    gatewayName: (g: string) =>
      g === 'bank_transfer'
        ? 'Bank Transfer'
        : g.charAt(0).toUpperCase() + g.slice(1),
    methodName: (m: string) => m.replace(/_/g, ' ').toUpperCase(),
    deliveryType: (d: string) => d.toUpperCase(),
    currency: (n: number) => `SAR ${n.toFixed(2)}`,
    currencyNeg: (n: number) => `- SAR ${n.toFixed(2)}`,
    dash: '—',
  },
  ar: {
    invoiceTitle: 'فاتورة',
    proformaTitle: 'فاتورة مبدئية',
    statusPaid: 'مدفوعة',
    statusRefunded: 'مستردة',
    statusCancelled: 'ملغاة',
    statusIssued: 'صادرة',
    statusAwaiting: 'بانتظار الدفع',
    invoiceNumber: 'رقم الفاتورة',
    issuedDate: 'تاريخ الإصدار',
    paidDate: 'تاريخ الدفع',
    dueDate: 'تاريخ الاستحقاق',
    validUntil: 'صالحة حتى',
    billTo: 'الفاتورة إلى',
    paymentDetails: 'تفاصيل الدفع',
    gateway: 'بوابة الدفع',
    method: 'طريقة الدفع',
    reference: 'المرجع',
    bankName: 'البنك',
    accountName: 'الحساب',
    iban: 'رقم الآيبان',
    description: 'الوصف',
    qty: 'الكمية',
    unit: 'السعر',
    amount: 'الإجمالي',
    subtotal: 'المجموع الفرعي',
    discount: 'الخصم',
    zeroRated: 'صفر ضريبي 0٪',
    total: 'الإجمالي الكلي',
    scanToVerify: 'امسح للتحقق',
    verifyLine: 'تحقق من صحة هذه الفاتورة بالرمز أو:',
    footerThankYou:
      'شكراً لك على الشراء. تُعد هذه الفاتورة إيصالاً ضريبياً رسمياً.',
    footerProforma:
      'يرجى الدفع عبر التحويل البنكي لتفعيل التسجيل. سيتم إرسال فاتورة ضريبية عبر البريد الإلكتروني تلقائياً عند استلام الدفعة.',
    proformaNumber: 'رقم الفاتورة المبدئية',
    paymentIntent: 'طريقة الدفع المتوقعة',
    statusLabel: 'الحالة',
    awaitingTransfer: 'بانتظار التحويل',
    amountDue: 'المبلغ المستحق',
    noticeTitle: 'تنبيه',
    noticeBody:
      'هذه فاتورة مبدئية صادرة قبل الدفع، وليست فاتورة ضريبية. سيتم إصدار فاتورة ضريبية نهائية (برقم قابل للتحقق عبر رمز QR) عند استلام التحويل البنكي واعتماده من قِبل فريق المالية.',
    pageOf: (n: number, total: number) => `صفحة ${n} من ${total}`,
    vatNo: (n: string) => `الرقم الضريبي: ${n}`,
    // Use the Arabic percent sign U+066A and drop parens — a Latin
    // "(3%)" fragment inside an Arabic sentence flips awkwardly in bidi
    // rendering, whereas "3٪" reads naturally right-to-left.
    vatRow: (rate: number) => `ضريبة القيمة المضافة ${rate}٪`,
    gatewayName: (g: string) => {
      switch (g) {
        case 'bank_transfer':
          return 'حوالة بنكية';
        case 'moyasar':
          return 'ميسر';
        case 'tamara':
          return 'تمارا';
        case 'tabby':
          return 'تابي';
        default:
          return g.charAt(0).toUpperCase() + g.slice(1);
      }
    },
    methodName: (m: string) => {
      const up = m.toLowerCase();
      switch (up) {
        case 'card':
          return 'بطاقة';
        case 'mada':
          return 'مدى';
        case 'apple_pay':
        case 'applepay':
          return 'أبل باي';
        case 'stcpay':
        case 'stc_pay':
          return 'STC Pay';
        case 'bank_transfer':
        case 'banktransfer':
          return 'حوالة بنكية';
        case 'bnpl':
          return 'تقسيط';
        default:
          // Fallback returns Latin — the render site MUST route through
          // fontFor() so pdfkit picks Helvetica for this, not NotoArabic
          // (which has no Latin glyphs → .notdef squares).
          return m.replace(/_/g, ' ').toUpperCase();
      }
    },
    deliveryType: (d: string) => {
      const key = d.toLowerCase();
      switch (key) {
        case 'self_paced':
        case 'self-paced':
          return 'ذاتي المسار';
        case 'live':
          return 'مباشر';
        case 'hybrid':
        case 'blended':
          return 'مدمج';
        case 'zoom':
          return 'زووم';
        case 'onsite':
        case 'on_site':
        case 'on-site':
          return 'حضوري';
        case 'webinar':
          return 'ندوة';
        case 'instructor_led':
        case 'instructor-led':
          return 'بإشراف مدرب';
        default:
          // Latin fallback — see methodName comment above.
          return d.toUpperCase();
      }
    },
    // Currency stays "SAR 200.00" in Latin. Rendering "ر.س" in the same
    // Helvetica run as digits produces broken glyphs (Helvetica has no
    // Arabic coverage), and mixing NotoArabic mid-cell breaks alignment.
    // ZATCA accepts either symbol; Latin is universally legible.
    currency: (n: number) => `SAR ${n.toFixed(2)}`,
    currencyNeg: (n: number) => `- SAR ${n.toFixed(2)}`,
    dash: '—',
  },
} as const;

/**
 * Reverse word order for Arabic multi-word strings so PDFKit's L→R
 * placement reads correctly R→L on the page. PDFKit/fontkit handles
 * letter-level shaping per word but does not run the Unicode bidi
 * algorithm to reorder runs, which leaves multi-word Arabic visually
 * mirrored unless we pre-reverse it.
 */
function arRtl(text: string): string {
  return text.split(/\s+/).filter(Boolean).reverse().join(' ');
}

/**
 * True if the string contains any Arabic-script character. Used at PDF
 * render sites to decide whether to swap to NotoArabic (which has Arabic
 * glyphs) rather than Helvetica (which renders Arabic codepoints as
 * garbage Latin-ish characters — the visible "dV-dV/ b6(d..." mojibake).
 */
function hasArabicChars(text: string | null | undefined): boolean {
  if (!text) return false;
  return /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/.test(text);
}

/**
 * Pick the pdfkit font that can render this text. Both NotoArabic and
 * NotoArabicBold are registered at the top of every generate/render PDF
 * method — see registerFont calls. Latin defaults keep Helvetica so we
 * don't disturb existing character metrics for tables that were tuned
 * for it.
 */
function fontFor(text: string, bold = false): string {
  if (hasArabicChars(text)) return bold ? 'NotoArabicBold' : 'NotoArabic';
  return bold ? 'Helvetica-Bold' : 'Helvetica';
}

/**
 * Pick the best-looking display name for a customer, preferring whichever
 * field actually holds a real value:
 *   1. Latin name (firstName + lastName)
 *   2. Arabic name (firstNameAr + lastNameAr) — used when Latin is empty
 *   3. Sanitized fallback (see sanitizeCustomerName) — for junk / email
 *
 * The Latin name is preferred even if it happens to contain Arabic script,
 * because some users type Arabic into the "first name" field directly and
 * expect their invoice to show that spelling.
 */
function pickCustomerName(
  userData: {
    firstName?: string | null;
    lastName?: string | null;
    firstNameAr?: string | null;
    lastNameAr?: string | null;
    email?: string | null;
  },
): string {
  const latin = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
  if (latin.length >= 2) return sanitizeCustomerName(latin, userData.email);
  const arabic = `${userData.firstNameAr || ''} ${userData.lastNameAr || ''}`.trim();
  if (arabic.length >= 2) return sanitizeCustomerName(arabic, userData.email);
  return sanitizeCustomerName('', userData.email);
}

/**
 * Best-effort clean-up of the buyer name for display on the invoice PDF.
 * Real names contain letters (any script — Latin, Arabic, CJK, etc.), spaces,
 * and joiner punctuation (hyphens, apostrophes, periods). If the raw input
 * contains anything else — digits, parens, `@`, symbols — it is data-entry
 * garbage and we don't try to salvage the letter fragments (they read as
 * nonsense too). We use the email's local-part as a friendlier fallback.
 *
 * This is display sanitation only; the underlying user record is untouched.
 */
function sanitizeCustomerName(
  raw: string | null | undefined,
  emailFallback?: string | null,
): string {
  const source = (raw || '').trim();
  // Signal that the name is bogus: anything that never appears in a real name.
  const hasJunkChars = /[0-9()@#$%^*+={}\[\]<>\/\\|~`!?:;"]/.test(source);
  if (!hasJunkChars) {
    const cleaned = source
      .replace(/[^\p{L}\p{M}\s'\-\.]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length >= 2) return cleaned;
  }
  // Fall through to email-derived fallback.
  const email = (emailFallback || '').trim();
  if (!email) return 'Customer';
  const local = (email.split('@')[0] || '')
    .replace(/[._-]+/g, ' ')
    .replace(/\d+/g, '')       // strip trailing digits like "mianabubaka007"
    .replace(/\s+/g, ' ')
    .trim();
  if (local.length < 2) return 'Customer';
  return local.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly auditLogService: AuditLogService,
    private readonly siteSettings: SiteSettingsService,
    private readonly taxComputationService: TaxComputationService,
  ) {}

  /**
   * Storage-key naming for per-locale invoice PDFs.
   *  - `invoices/{invoiceNumber}-{locale}.pdf` for anything generated post-locale-split
   *  - `invoices/{invoiceNumber}.pdf` is the LEGACY EN-only path (kept for reads only)
   * Reads check the locale-suffixed key first; if missing, callers regenerate
   * from the persisted snapshot and upload to the locale key.
   */
  private storageKeyFor(invoiceNumber: string, locale: InvoiceLocale): string {
    return `invoices/${invoiceNumber}-${locale}.pdf`;
  }
  private legacyStorageKey(invoiceNumber: string): string {
    return `invoices/${invoiceNumber}.pdf`;
  }

  async generateInvoice(paymentId: string, locale: InvoiceLocale = 'en') {
    // Idempotency guard. generateInvoice is called from BOTH the webhook
    // path AND the verify path (self-heal); without this check a payment
    // that gets settled inline by verify and then receives a delayed
    // webhook would end up with two invoice rows pointing at the same
    // payment (no DB-level UNIQUE on invoices.payment_id). Return the
    // existing row so callers get a stable result either way.
    const [existing] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.paymentId, paymentId))
      .limit(1);
    if (existing) {
      return existing;
    }

    // Get payment with user and course data
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const [userData] = await db
      .select()
      .from(users)
      .where(eq(users.id, payment.userId))
      .limit(1);

    // Multi-line carts: load all line items + their courses for the snapshot.
    // Legacy single-course payments have no payment_items rows; fall back to
    // payments.courseId so old invoices keep generating identically.
    const items = await db
      .select({
        courseId: paymentItems.courseId,
        unitPrice: paymentItems.unitPrice,
        salePrice: paymentItems.salePrice,
        lineDiscount: paymentItems.discountAmount,
        lineTotal: paymentItems.lineTotal,
      })
      .from(paymentItems)
      .where(eq(paymentItems.paymentId, paymentId));

    const lineCourseIds =
      items.length > 0 ? items.map((i) => i.courseId) : [payment.courseId];

    const lineCourses = await db
      .select()
      .from(courses)
      .where(inArray(courses.id, lineCourseIds));
    const courseById = new Map(lineCourses.map((c) => [c.id, c]));

    // Primary course for the invoice's top-level course column (legacy field
    // on the invoices table). For multi-line, use the first line course.
    const primaryCourse = courseById.get(payment.courseId) || lineCourses[0];
    if (!userData || !primaryCourse) {
      throw new NotFoundException('User or course not found');
    }

    // Calculate amounts from payment metadata
    const paymentMeta = payment.metadata as any;
    const subtotal = Number(paymentMeta?.subtotal || payment.amount);
    const discountAmount = Number(paymentMeta?.discountAmount || 0);
    const taxAmount = Number(paymentMeta?.taxAmount || 0);
    const totalAmount = Number(payment.amount);

    // BNPL invoices get a 90-day due date
    const isBnpl = payment.gateway === 'tamara' || payment.gateway === 'tabby';
    const dueDate = isBnpl
      ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      : null;

    // Build the line items snapshot — one row per cart course for multi-line
    // payments, one row for legacy single-course payments.
    const lineItemsSnapshot =
      items.length > 0
        ? items.map((it) => {
            const c = courseById.get(it.courseId);
            return {
              courseId: it.courseId,
              description: c?.title || 'Course',
              descriptionAr: c?.titleAr || null,
              deliveryType: c?.deliveryType || null,
              unitPrice: Number(it.unitPrice),
              salePrice: Number(it.salePrice),
              discount: Number(it.lineDiscount),
              amount: Number(it.lineTotal),
            };
          })
        : [
            {
              courseId: primaryCourse.id,
              description: primaryCourse.title,
              descriptionAr: primaryCourse.titleAr || null,
              deliveryType: primaryCourse.deliveryType || null,
              unitPrice: subtotal,
              salePrice: subtotal,
              discount: 0,
              amount: subtotal,
            },
          ];

    const invoiceMetadata = {
      buyer: {
        name: pickCustomerName(userData),
        email: userData.email,
        // nationalId is AES-GCM encrypted at rest via encryptPII; decrypt
        // so invoice readers (and the snapshot we persist on the invoice
        // row) see the plain national ID, not the v1:iv:tag:ct ciphertext.
        nationalId: decryptPII((userData as any).nationalId) || null,
      },
      // Kept for backwards-compat with any reader that uses .course; first line.
      course: {
        title: primaryCourse.title,
        titleAr: primaryCourse.titleAr || null,
        deliveryType: primaryCourse.deliveryType || null,
        startDate: primaryCourse.startDate || null,
        endDate: primaryCourse.endDate || null,
      },
      lineItems: lineItemsSnapshot,
      discount:
        discountAmount > 0
          ? { code: paymentMeta?.discountCode || null, amount: discountAmount }
          : null,
      tax: { amount: taxAmount },
    };

    // Generate invoice number with retry on unique constraint violation
    let invoice: any;
    for (let attempt = 0; attempt < 3; attempt++) {
      const year = new Date().getFullYear();
      const [maxResult] = await db
        .select({
          maxNum: sql<string>`MAX(${invoices.invoiceNumber})`,
        })
        .from(invoices)
        .where(sql`${invoices.invoiceNumber} LIKE ${'INV-' + year + '-%'}`);

      let nextSeq = 1;
      if (maxResult?.maxNum) {
        const parts = maxResult.maxNum.split('-');
        nextSeq = parseInt(parts[2], 10) + 1;
      }
      const invoiceNumber = `INV-${year}-${String(nextSeq).padStart(5, '0')}`;

      try {
        const [created] = await db
          .insert(invoices)
          .values({
            invoiceNumber,
            paymentId: payment.id,
            userId: payment.userId,
            courseId: payment.courseId,
            subtotal: subtotal.toFixed(2),
            discountAmount: discountAmount.toFixed(2),
            taxAmount: taxAmount.toFixed(2),
            totalAmount: totalAmount.toFixed(2),
            status: INVOICE_STATUS.PAID,
            paidAt: payment.paidAt || new Date(),
            dueDate,
            metadata: invoiceMetadata,
          })
          .returning();
        invoice = created;
        break;
      } catch (err: any) {
        // PostgreSQL unique violation code
        if (err.code === '23505' && attempt < 2) {
          this.logger.warn(
            `Invoice number collision on ${invoiceNumber}, retrying (attempt ${attempt + 1})`,
          );
          continue;
        }
        throw err;
      }
    }

    if (!invoice) {
      throw new Error('Failed to generate unique invoice number after 3 attempts');
    }

    // Generate PDF at requested locale.
    try {
      const branding = await this.siteSettings.getBranding();
      const pdfBuffer = await this.generatePdf(
        invoice,
        payment,
        userData,
        primaryCourse,
        lineItemsSnapshot,
        branding,
        locale,
      );

      const filename = this.storageKeyFor(invoice.invoiceNumber, locale);
      await this.storageService.uploadPrivate(
        pdfBuffer,
        filename,
        'application/pdf',
      );

      // pdfUrl on the invoice row remains a "first-generation succeeded"
      // marker + convenience field for legacy readers. Locale-specific
      // URLs are always resolved via storageKeyFor() at read time.
      await db
        .update(invoices)
        .set({ pdfUrl: filename, updatedAt: new Date() })
        .where(eq(invoices.id, invoice.id));

      this.logger.log(`Invoice ${invoice.invoiceNumber} (${locale}) generated for payment ${paymentId}`);
    } catch (err) {
      this.logger.error(
        `Failed to generate PDF for invoice ${invoice.invoiceNumber} (${locale}): ${err.message}`,
      );
    }

    await this.auditLogService.log({
      entityType: 'invoice',
      entityId: invoice.id,
      action: 'invoice_generated',
      performedBy: payment.userId,
      metadata: { invoiceNumber: invoice.invoiceNumber, paymentId, amount: totalAmount },
    });

    return invoice;
  }

  private async generatePdf(
    invoice: any,
    payment: any,
    userData: any,
    course: any,
    lineItems: Array<{
      description: string;
      descriptionAr: string | null;
      deliveryType: string | null;
      amount: number;
    }> | undefined,
    branding: SiteBranding,
    locale: InvoiceLocale = 'en',
  ): Promise<Buffer> {
    const L = INVOICE_LABELS[locale];
    const rtl = locale === 'ar';
    const startAlign: 'left' | 'right' = rtl ? 'right' : 'left';
    const endAlign: 'left' | 'right' = rtl ? 'left' : 'right';
    const PAGE_W = 595;
    // Mirror an LTR x-coordinate for a block of `w` width against page width,
    // so a card that lives on the left in EN slides to the right in AR at
    // the same visual inset from the outer edge.
    const mirror = (x: number, w: number) => (rtl ? PAGE_W - x - w : x);
    // Font selector for user-provided free-text (name, item descriptions)
    // stays behavior-preserving — pdfkit's rtla feature already handles
    // the Arabic-in-EN and Latin-in-AR mixed-content cases correctly.
    // Pull current tax settings for tax number + company name on the PDF.
    // The VAT rate label uses the snapshot stored on the invoice/payment
    // metadata so historical invoices keep their original rate.
    const taxSettings = await this.taxComputationService.getSettings();
    const paymentMeta = (payment?.metadata ?? {}) as {
      taxRate?: number;
      vatTreatment?: string;
    };
    const invoiceVatRate = typeof paymentMeta.taxRate === 'number'
      ? paymentMeta.taxRate
      : taxSettings.vatRate;
    const invoiceVatTreatment = paymentMeta.vatTreatment ?? 'standard';
    return new Promise(async (resolve, reject) => {
      try {
        // bufferPages keeps page generation lazy so we can verify the doc
        // never spills past page 1; if it does, we explicitly remove the
        // overflow page rather than letting it ship blank.
        const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const fontsDir = path.join(process.cwd(), 'src', 'assets', 'fonts');
        doc.registerFont('NotoArabic', path.join(fontsDir, 'NotoSansArabic-Regular.ttf'));
        doc.registerFont('NotoArabicBold', path.join(fontsDir, 'NotoSansArabic-Bold.ttf'));
        const ws = { wordSpacing: 2 };

        // ── Brand palette ──
        const BRAND = '#1A2747';
        const ACCENT = '#B8860B';
        const MUTED = '#6B7280';
        const SOFT = '#F3F4F6';
        const SUCCESS = '#16A34A';
        const VIOLET = '#7C3AED';
        const DANGER = '#DC2626';

        const status = (invoice.status as string) || 'issued';
        const statusBadge =
          status === 'paid'
            ? { bg: '#DCFCE7', fg: SUCCESS, label: L.statusPaid }
            : status === 'refunded'
              ? { bg: '#EDE9FE', fg: VIOLET, label: L.statusRefunded }
              : status === 'cancelled'
                ? { bg: '#FEE2E2', fg: DANGER, label: L.statusCancelled }
                : { bg: '#DBEAFE', fg: '#1D4ED8', label: L.statusIssued };

        // Date+time formatter — always en-US Latin digits, 24h time so the
        // invoice reads identically for any locale viewer.
        const fmtDT = (d: Date | string | null | undefined) => {
          if (!d) return '';
          const date = new Date(d);
          const dd = date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
          const tt = date.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
          return `${dd} · ${tt}`;
        };

        // ── Header band ──
        doc.rect(0, 0, PAGE_W, 100).fill(BRAND);
        const logoBuf = getBrandLogo();
        const logoW = 50;
        // Logo hugs the outer edge of the reading direction.
        const logoX = rtl ? PAGE_W - 40 - logoW : 40;
        if (logoBuf) {
          doc.image(logoBuf, logoX, 25, { width: logoW, height: logoW });
        }
        // Brand text column: 320 wide, sits next to the logo on its inner side.
        const brandBlockW = 320 - (logoBuf ? logoW + 10 : 0);
        const brandTextX = rtl
          ? PAGE_W - 40 - (logoBuf ? logoW + 10 : 0) - brandBlockW
          : logoBuf
            ? 40 + logoW + 10
            : 40;
        doc
          .fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(22)
          .text(branding.siteNameEn, brandTextX, 32, {
            width: brandBlockW,
            align: startAlign,
          });
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#CBD5E1')
          .text('physioguidance.org', brandTextX, 62, {
            width: brandBlockW,
            align: startAlign,
          });
        if (taxSettings.taxNumber) {
          // ZATCA-compliant header line.
          doc
            .font(rtl ? 'NotoArabic' : 'Helvetica')
            .fontSize(9)
            .fillColor('#CBD5E1')
            .text(L.vatNo(taxSettings.taxNumber), brandTextX, 78, {
              width: brandBlockW,
              align: startAlign,
              features: rtl ? ['rtla'] : undefined,
            });
        }

        // "INVOICE" title sits opposite the brand block.
        const titleW = 195;
        const titleX = rtl ? 40 : PAGE_W - 40 - titleW;
        doc
          .fillColor('#FFFFFF')
          .font(rtl ? 'NotoArabicBold' : 'Helvetica-Bold')
          .fontSize(26)
          .text(L.invoiceTitle, titleX, 26, {
            width: titleW,
            align: endAlign,
            features: rtl ? ['rtla'] : undefined,
          });
        // Arabic "فاتورة ضريبية" subtitle removed per client request. Note:
        // ZATCA (Saudi VAT authority) technically requires tax invoices to
        // include the phrase in Arabic. If a Saudi auditor rejects an invoice
        // for this reason, restore the block above.
        doc.rect(0, 100, 595, 4).fill(ACCENT);
        doc.fillColor('#000000');

        // ── Status badge + meta strip ──
        const metaTop = 124;
        const badgeWidth = 110;
        const badgeHeight = 24;
        // Badge slides to the opposite edge from the meta lines.
        const badgeX = mirror(40, badgeWidth);
        doc.roundedRect(badgeX, metaTop, badgeWidth, badgeHeight, 4).fill(statusBadge.bg);
        // NotoArabic has a larger ascender / higher line-box than Helvetica,
        // so the same top-y makes AR text drift to the bottom of the pill.
        // Nudge AR up by 3px.
        const badgeTextY = metaTop + (rtl ? 4 : 7);
        doc
          .fillColor(statusBadge.fg)
          .font(rtl ? 'NotoArabicBold' : 'Helvetica-Bold')
          .fontSize(10)
          .text(statusBadge.label, badgeX, badgeTextY, {
            width: badgeWidth,
            align: 'center',
            features: rtl ? (['rtla'] as any) : undefined,
          });
        doc.fillColor('#000000');

        // Meta lines: dates always render Latin — invoice numbers and
        // timestamps stay legible for any auditor.
        const metaLines: Array<[string, string]> = [
          [L.invoiceNumber, invoice.invoiceNumber],
          [L.issuedDate, fmtDT(invoice.issuedAt)],
        ];
        if (invoice.paidAt) {
          metaLines.push([L.paidDate, fmtDT(invoice.paidAt)]);
        }
        if (invoice.dueDate) {
          metaLines.push([L.dueDate, fmtDT(invoice.dueDate)]);
        }
        // The meta section is a 255-wide block placed on the OPPOSITE edge
        // from the badge. In LTR: right of page (300..555). In RTL: left of
        // page (40..295) — mirrored.
        const metaLabelW = 100;
        const metaValueW = 150;
        const metaGap = 5;
        const metaBlockW = metaLabelW + metaGap + metaValueW;
        const metaBlockLeft = rtl ? 40 : PAGE_W - 40 - metaBlockW;
        const metaBlockRight = metaBlockLeft + metaBlockW;
        // Within the block: label on reading-start edge, value on the opposite.
        const metaLabelX = rtl ? metaBlockRight - metaLabelW : metaBlockLeft;
        const metaValueX = rtl ? metaBlockLeft : metaBlockRight - metaValueW;
        let mY = metaTop;
        for (const [label, value] of metaLines) {
          // Both texts share a common typographic baseline. Passing baseline:
          // 'alphabetic' makes pdfkit interpret y as the baseline position,
          // so Latin and Arabic fonts of different sizes align perfectly
          // instead of drifting apart at their tops.
          const baselineY = mY + 10;
          doc
            .font(rtl ? 'NotoArabic' : 'Helvetica')
            .fontSize(9)
            .fillColor(MUTED)
            .text(label, metaLabelX, baselineY, {
              width: metaLabelW,
              align: startAlign,
              features: rtl ? (['rtla'] as any) : undefined,
              baseline: 'alphabetic' as any,
              lineBreak: false,
            });
          doc
            .font('Helvetica-Bold')
            .fontSize(10)
            .fillColor('#111827')
            .text(value, metaValueX, baselineY, {
              width: metaValueW,
              align: endAlign,
              baseline: 'alphabetic' as any,
              lineBreak: false,
            });
          mY += 14;
        }

        // ── Bill-To / Payment-Details two-column block in soft cards ──
        const sectionTop = Math.max(metaTop + 40, mY + 12);
        const cardW = 252;
        const cardH = 92;
        // In LTR: BillTo left, PaymentDetails right. In RTL: swap.
        const billToX = mirror(40, cardW);
        const payDetailsX = mirror(303, cardW);
        doc
          .roundedRect(billToX, sectionTop, cardW, cardH, 6)
          .lineWidth(1)
          .strokeColor('#E5E7EB')
          .stroke();
        doc
          .font(rtl ? 'NotoArabicBold' : 'Helvetica-Bold')
          .fontSize(9)
          .fillColor(MUTED)
          .text(L.billTo, billToX + 12, sectionTop + 10, {
            width: cardW - 24,
            align: startAlign,
            features: rtl ? ['rtla'] : undefined,
          });
        {
          const displayName = pickCustomerName(userData);
          const isNameArabic = hasArabicChars(displayName);
          // Alignment follows the PDF locale, NOT the name's script.
          // An Arabic name on an EN invoice still left-aligns (reads
          // right-to-left within the field but the field itself hugs
          // the LTR reading edge). Keeps name+email as one visual column.
          const bodyAlign = rtl ? 'right' : 'left';
          // rtla features only ever needed for actual Arabic strings so
          // pdfkit shapes them right-to-left. Set independently of align.
          const nameFeatures = isNameArabic ? (['rtla'] as any) : undefined;
          doc
            .font(fontFor(displayName, true))
            .fontSize(12)
            .fillColor('#111827')
            .text(displayName, billToX + 12, sectionTop + 26, {
              width: cardW - 24,
              features: nameFeatures,
              align: bodyAlign,
            });
          doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor(MUTED)
            // +24px baseline gives ~10px of visible whitespace between
            // 12pt name and 9pt email (12pt line-box is ~15px tall).
            .text(userData.email, billToX + 12, sectionTop + 50, {
              width: cardW - 24,
              align: bodyAlign,
            });
        }

        doc
          .roundedRect(payDetailsX, sectionTop, cardW, cardH, 6)
          .lineWidth(1)
          .strokeColor('#E5E7EB')
          .stroke();
        doc
          .font(rtl ? 'NotoArabicBold' : 'Helvetica-Bold')
          .fontSize(9)
          .fillColor(MUTED)
          .text(L.paymentDetails, payDetailsX + 12, sectionTop + 10, {
            width: cardW - 24,
            align: startAlign,
            features: rtl ? ['rtla'] : undefined,
          });
        const gatewayLabel = L.gatewayName(payment.gateway);
        const methodLabel = payment.paymentMethod
          ? L.methodName(payment.paymentMethod)
          : L.dash;
        const referenceShort = payment.gatewayChargeId
          ? payment.gatewayChargeId.length > 30
            ? `${payment.gatewayChargeId.slice(0, 14)}…${payment.gatewayChargeId.slice(-12)}`
            : payment.gatewayChargeId
          : L.dash;
        const payRows: Array<[string, string, boolean]> = [
          [L.gateway, gatewayLabel, false],
          [L.method, methodLabel, false],
          [L.reference, referenceShort, true],
        ];
        let pY = sectionTop + 28;
        // widthOfString for x + baseline:'alphabetic' for y. Same baseline
        // y for both label + value → typographic baselines match regardless
        // of font/size.
        const payInteriorLeft = payDetailsX + 12;
        const payInteriorRight = payDetailsX + cardW - 12;
        for (const [k, v, isRef] of payRows) {
          const rowBaseline = pY + 10;
          // Label
          doc
            .font(rtl ? 'NotoArabic' : 'Helvetica')
            .fontSize(9)
            .fillColor(MUTED);
          const labelW = doc.widthOfString(k);
          const labelX = rtl ? payInteriorRight - labelW : payInteriorLeft;
          doc.text(k, labelX, rowBaseline, {
            lineBreak: false,
            features: rtl ? (['rtla'] as any) : undefined,
            baseline: 'alphabetic' as any,
          });
          // Value — pick the font by the actual script of `v` so that
          // Latin fallbacks (e.g. AR methodName without a case for the
          // input like the legacy path did for bank_transfer) render as
          // real text instead of tofu boxes from NotoSansArabic.
          const valueFont = isRef ? 'Helvetica' : fontFor(v, true);
          const valueIsArabic = hasArabicChars(v);
          doc
            .font(valueFont)
            .fontSize(isRef ? 8 : 10)
            .fillColor('#111827');
          const valueW = doc.widthOfString(v);
          const valueX = rtl ? payInteriorLeft : payInteriorRight - valueW;
          doc.text(v, valueX, rowBaseline, {
            lineBreak: false,
            features: valueIsArabic && !isRef ? (['rtla'] as any) : undefined,
            baseline: 'alphabetic' as any,
          });
          pY += 18;
        }

        // ── Line items table ──
        // Column geometry (LTR): DESC 50→350 (w300), QTY 360 (w40 center),
        // UNIT 400 (w75 right), AMOUNT 475 (w75 right). In RTL we swap the
        // horizontal order end-to-end while keeping each column's width.
        const tableTop = sectionTop + cardH + 22;
        doc.rect(40, tableTop, 515, 24).fill(SOFT);
        const colDescW = 300;
        const colQtyW = 40;
        const colUnitW = 75;
        const colAmtW = 75;
        const colDescX = rtl ? PAGE_W - 50 - colDescW : 50;
        const colQtyX = rtl ? PAGE_W - 360 - colQtyW : 360;
        const colUnitX = rtl ? PAGE_W - 400 - colUnitW : 400;
        const colAmtX = rtl ? PAGE_W - 475 - colAmtW : 475;
        doc.fillColor(MUTED).font(rtl ? 'NotoArabicBold' : 'Helvetica-Bold').fontSize(9);
        doc.text(L.description, colDescX, tableTop + 8, {
          width: colDescW,
          align: startAlign,
          features: rtl ? ['rtla'] : undefined,
        });
        doc.text(L.qty, colQtyX, tableTop + 8, { width: colQtyW, align: 'center', features: rtl ? ['rtla'] : undefined });
        doc.text(L.unit, colUnitX, tableTop + 8, { width: colUnitW, align: endAlign, features: rtl ? ['rtla'] : undefined });
        doc.text(L.amount, colAmtX, tableTop + 8, { width: colAmtW, align: endAlign, features: rtl ? ['rtla'] : undefined });
        doc.fillColor('#000000');

        const itemsToRender =
          lineItems && lineItems.length > 0
            ? lineItems
            : [
                {
                  description: course.title || 'Course',
                  descriptionAr: course.titleAr || null,
                  deliveryType: course.deliveryType || null,
                  amount: Number(invoice.subtotal),
                },
              ];

        let y = tableTop + 32;
        let rowIdx = 0;
        for (const item of itemsToRender) {
          const rowTop = y;
          if (rowIdx % 2 === 1) {
            doc.rect(40, rowTop - 4, 515, 26).fill('#FAFAFA');
            doc.fillColor('#000000');
          }
          {
            // In AR mode, prefer the Arabic description when the snapshot has one.
            const desc =
              (rtl && item.descriptionAr) || item.description || '';
            const isDescArabic = hasArabicChars(desc);
            const descAlign = isDescArabic || rtl ? 'right' : 'left';
            doc
              .font(fontFor(desc))
              .fontSize(10)
              .fillColor('#111827')
              .text(desc, colDescX, y, {
                width: colDescW,
                features: isDescArabic || rtl ? ['rtla'] : undefined,
                align: descAlign,
              });
          }
          let rowExtra = 0;
          if (item.deliveryType) {
            // Delivery type may fall back to Latin (e.g. legacy types
            // with no AR label). Route through fontFor() so Latin text
            // renders in Helvetica — not tofu from the Arabic-only font.
            const dtLabel = L.deliveryType(item.deliveryType);
            const dtIsArabic = hasArabicChars(dtLabel);
            doc
              .font(fontFor(dtLabel))
              .fontSize(8)
              .fillColor(MUTED)
              .text(dtLabel, colDescX, y + 14, {
                width: colDescW,
                align: rtl ? 'right' : 'left',
                features: dtIsArabic ? ['rtla'] : undefined,
              });
            rowExtra += 12;
          }
          doc
            .font('Helvetica')
            .fontSize(10)
            .fillColor('#111827')
            .text('1', colQtyX, rowTop + 1, { width: colQtyW, align: 'center' });
          doc.text(L.currency(Number(item.amount)), colUnitX, rowTop + 1, {
            width: colUnitW,
            align: endAlign,
          });
          doc
            .font('Helvetica-Bold')
            .text(L.currency(Number(item.amount)), colAmtX, rowTop + 1, {
              width: colAmtW,
              align: endAlign,
            });
          y += Math.max(24, 16 + rowExtra);
          rowIdx += 1;
        }

        // ── Totals block ──
        let tY = y + 12;
        const totalsWidth = 235;
        const totalsLeft = mirror(320, totalsWidth);
        const totalsRight = totalsLeft + totalsWidth;
        // Explicit-x positioning (same pattern as the payment card fix).
        const totalsRow = (label: string, value: string, bold = false) => {
          const rowBaseline = tY + 10;
          const labelFont = bold
            ? rtl ? 'NotoArabicBold' : 'Helvetica-Bold'
            : rtl ? 'NotoArabic' : 'Helvetica';
          doc
            .font(labelFont)
            .fontSize(bold ? 11 : 10)
            .fillColor(bold ? '#111827' : MUTED);
          const labelW = doc.widthOfString(label);
          const labelX = rtl ? totalsRight - labelW : totalsLeft;
          doc.text(label, labelX, rowBaseline, {
            lineBreak: false,
            features: rtl ? (['rtla'] as any) : undefined,
            baseline: 'alphabetic' as any,
          });
          doc
            .font(bold ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(bold ? 11 : 10)
            .fillColor('#111827');
          const valueW = doc.widthOfString(value);
          const valueX = rtl ? totalsLeft : totalsRight - valueW;
          doc.text(value, valueX, rowBaseline, {
            lineBreak: false,
            baseline: 'alphabetic' as any,
          });
          tY += 16;
        };

        totalsRow(L.subtotal, L.currency(Number(invoice.subtotal)));
        if (Number(invoice.discountAmount) > 0) {
          totalsRow(L.discount, L.currencyNeg(Number(invoice.discountAmount)));
        }
        if (Number(invoice.taxAmount) > 0) {
          totalsRow(
            L.vatRow(invoiceVatRate),
            L.currency(Number(invoice.taxAmount)),
          );
        } else if (invoiceVatTreatment === 'zero_rated') {
          // ZATCA reporting line — show the row even though value is 0.
          totalsRow(L.zeroRated, L.currency(0));
        }
        doc
          .moveTo(totalsLeft, tY + 2)
          .lineTo(totalsLeft + totalsWidth, tY + 2)
          .strokeColor('#E5E7EB')
          .stroke()
          .strokeColor('#000000');
        tY += 8;

        // Highlighted total box — 30px tall. baseline:'alphabetic' + a shared
        // baselineY places both label + value bottoms on the same visual line
        // at the box's vertical center regardless of font/size.
        const totalBoxH = 30;
        doc.rect(totalsLeft, tY, totalsWidth, totalBoxH).fill(BRAND);
        const totalBaseline = tY + 20; // ~= center-baseline for 12-14pt text
        // Label
        doc
          .fillColor('#FFFFFF')
          .font(rtl ? 'NotoArabicBold' : 'Helvetica-Bold')
          .fontSize(12);
        const totalLabelW = doc.widthOfString(L.total);
        const totalLabelX = rtl
          ? totalsRight - 12 - totalLabelW
          : totalsLeft + 12;
        doc.text(L.total, totalLabelX, totalBaseline, {
          lineBreak: false,
          features: rtl ? (['rtla'] as any) : undefined,
          baseline: 'alphabetic' as any,
        });
        // Value (always Latin — SAR + digits)
        doc.font('Helvetica-Bold').fontSize(14);
        const totalValueStr = L.currency(Number(invoice.totalAmount));
        const totalValueW = doc.widthOfString(totalValueStr);
        const totalValueX = rtl
          ? totalsLeft + 12
          : totalsRight - 12 - totalValueW;
        doc.text(totalValueStr, totalValueX, totalBaseline, {
          lineBreak: false,
          baseline: 'alphabetic' as any,
        });
        doc.fillColor('#000000');
        tY += 44;

        // ── QR + verify panel — text hugs the QR side, vertically centered
        //    against the QR image (72×72). Text uses a fixed-width block that
        //    sits immediately next to the QR (12px gap), right-aligned in RTL
        //    so it hugs the QR, left-aligned in LTR for the same reason.
        const qrTop = Math.min(Math.max(tY, 600), 660);
        try {
          const verifyUrl = `https://physioguidance.org/${locale}/verify-invoice/${invoice.invoiceNumber}`;
          const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
            width: 80,
            margin: 0,
            color: { dark: BRAND, light: '#FFFFFF' },
          });
          const qrBuffer = Buffer.from(
            qrDataUrl.replace('data:image/png;base64,', ''),
            'base64',
          );
          const qrW = 72;
          const qrH = 72;
          const qrX = rtl ? PAGE_W - 40 - qrW : 40;
          const textBlockW = 320;
          const textBlockX = rtl
            ? qrX - 12 - textBlockW
            : qrX + qrW + 12;
          const textAlign = rtl ? 'right' : 'left';
          doc.image(qrBuffer, qrX, qrTop, { width: qrW, height: qrH });
          // Three lines: heading, subhead, url. Center the group against the
          // QR image so the block feels visually paired instead of drifting up.
          const lineHeights = { heading: 12, sub: 11, url: 11 };
          const gap = 2;
          const blockH = lineHeights.heading + gap + lineHeights.sub + gap + lineHeights.url;
          const firstLineBaseline = qrTop + (qrH - blockH) / 2 + lineHeights.heading;
          const secondLineBaseline = firstLineBaseline + gap + lineHeights.sub;
          const thirdLineBaseline = secondLineBaseline + gap + lineHeights.url;
          doc
            .font(rtl ? 'NotoArabicBold' : 'Helvetica-Bold')
            .fontSize(9)
            .fillColor('#111827')
            .text(L.scanToVerify, textBlockX, firstLineBaseline, {
              width: textBlockW,
              align: textAlign,
              features: rtl ? (['rtla'] as any) : undefined,
              baseline: 'alphabetic' as any,
              lineBreak: false,
            });
          doc
            .font(rtl ? 'NotoArabic' : 'Helvetica')
            .fontSize(8)
            .fillColor(MUTED)
            .text(L.verifyLine, textBlockX, secondLineBaseline, {
              width: textBlockW,
              align: textAlign,
              features: rtl ? (['rtla'] as any) : undefined,
              baseline: 'alphabetic' as any,
              lineBreak: false,
            });
          doc
            .font('Helvetica')
            .fontSize(8)
            .fillColor(ACCENT)
            .text(
              `physioguidance.org/verify-invoice/${invoice.invoiceNumber}`,
              textBlockX,
              thirdLineBaseline,
              {
                width: textBlockW,
                align: textAlign,
                lineBreak: false,
                baseline: 'alphabetic' as any,
              },
            );
        } catch {
          this.logger.warn('Failed to generate QR code for invoice');
        }

        // ── Footer band ──
        doc.rect(0, 770, PAGE_W, 72).fill('#F9FAFB');
        const footerBrandX = rtl ? PAGE_W - 40 - 200 : 40;
        const footerBrandW = 200;
        doc
          .fillColor(BRAND)
          .font('Helvetica-Bold')
          .fontSize(9)
          .text(branding.siteNameEn, footerBrandX, 786, {
            width: footerBrandW,
            align: startAlign,
          });
        const footerMsgX = rtl ? PAGE_W - 40 - 360 : 40;
        doc
          .font(rtl ? 'NotoArabic' : 'Helvetica')
          .fontSize(8)
          .fillColor(MUTED)
          .text(L.footerThankYou, footerMsgX, 802, {
            width: 360,
            align: startAlign,
            features: rtl ? ['rtla'] : undefined,
          });
        const pageOfX = rtl ? 40 : PAGE_W - 40 - 115;
        doc
          .font(rtl ? 'NotoArabic' : 'Helvetica')
          .fontSize(8)
          .fillColor(MUTED)
          .text(L.pageOf(1, 1), pageOfX, 802, {
            width: 115,
            align: endAlign,
            features: rtl ? ['rtla'] : undefined,
          });
        doc.fillColor('#000000');

        // ── Force single page ──
        // bufferPages mode lets us count pages after laying everything down.
        // If any of the absolute-positioned writes above triggered an auto-
        // page-break (it shouldn't, with margin:0 + bounded layout, but be
        // defensive), keep only page 1.
        const range = doc.bufferedPageRange();
        if (range.count > 1) {
          for (let i = range.start + range.count - 1; i > range.start; i--) {
            doc.switchToPage(i);
            // PDFKit doesn't expose a "remove" — best we can do here is
            // ensure nothing else gets written. Switch back to page 0 so
            // doc.end() finalizes from there.
          }
          doc.switchToPage(range.start);
        }
        doc.flushPages();
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Build a branded "proforma invoice" PDF for an unpaid payment so the
   * student can hand it to a finance department / employer for reimbursement
   * before they make the bank transfer. Same template as the real invoice
   * but tagged PROFORMA and explicitly NOT a tax invoice. Nothing is
   * persisted — the buffer is returned for direct download.
   */
  async generateProformaPdfBuffer(
    paymentId: string,
    locale: InvoiceLocale = 'en',
  ): Promise<Buffer> {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);
    if (!payment) throw new NotFoundException('Payment not found');

    const [userData] = await db
      .select()
      .from(users)
      .where(eq(users.id, payment.userId))
      .limit(1);

    const items = await db
      .select({
        courseId: paymentItems.courseId,
        unitPrice: paymentItems.unitPrice,
        salePrice: paymentItems.salePrice,
        lineDiscount: paymentItems.discountAmount,
        lineTotal: paymentItems.lineTotal,
      })
      .from(paymentItems)
      .where(eq(paymentItems.paymentId, paymentId));

    const lineCourseIds =
      items.length > 0 ? items.map((i) => i.courseId) : [payment.courseId];
    const lineCourses = await db
      .select()
      .from(courses)
      .where(inArray(courses.id, lineCourseIds));
    const courseById = new Map(lineCourses.map((c) => [c.id, c]));
    const primaryCourse =
      courseById.get(payment.courseId) || lineCourses[0];
    if (!userData || !primaryCourse) {
      throw new NotFoundException('User or course not found');
    }

    const paymentMeta = payment.metadata as any;
    const subtotal = Number(paymentMeta?.subtotal || payment.amount);
    const discountAmount = Number(paymentMeta?.discountAmount || 0);
    const taxAmount = Number(paymentMeta?.taxAmount || 0);
    const totalAmount = Number(payment.amount);

    const lineItemsSnapshot =
      items.length > 0
        ? items.map((it) => {
            const c = courseById.get(it.courseId);
            return {
              description: c?.title || 'Course',
              descriptionAr: c?.titleAr || null,
              deliveryType: c?.deliveryType || null,
              amount: Number(it.lineTotal),
            };
          })
        : [
            {
              description: primaryCourse.title,
              descriptionAr: primaryCourse.titleAr || null,
              deliveryType: primaryCourse.deliveryType || null,
              amount: subtotal,
            },
          ];

    const branding = await this.siteSettings.getBranding();

    return this.renderProformaPdf({
      proformaNumber: `PRO-${paymentId.slice(0, 8).toUpperCase()}`,
      issuedAt: new Date(),
      buyer: {
        name: pickCustomerName(userData),
        email: userData.email,
        nationalId: decryptPII((userData as any).nationalId) || null,
      },
      payment: {
        gateway: payment.gateway,
        amount: totalAmount,
      },
      lineItems: lineItemsSnapshot,
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
      branding,
      locale,
    });
  }

  /**
   * Build a proforma PDF directly from a quote payload (no persisted payment
   * row). Used by the draft-mode bank-transfer page so the buyer can download
   * the proforma BEFORE submitting — useful for their employer/finance team to
   * approve the spend before the actual transfer is made.
   *
   * The proforma number is content-hashed from courseIds + total so the same
   * cart always produces the same number (so a re-downloaded proforma matches
   * one the buyer already shared).
   */
  async generateProformaPdfFromQuote(args: {
    buyer: { name: string; email: string; nationalId: string | null };
    courseIds: string[];
    lineItems: Array<{
      description: string;
      descriptionAr: string | null;
      deliveryType: string | null;
      amount: number;
    }>;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    totalAmount: number;
    locale?: InvoiceLocale;
  }): Promise<{ buffer: Buffer; proformaNumber: string }> {
    const branding = await this.siteSettings.getBranding();

    // Stable per-cart number: short hash of sorted courseIds + total amount.
    const seed = `${args.courseIds.slice().sort().join('|')}|${args.totalAmount.toFixed(2)}`;
    const proformaNumber = `PRO-${this.shortHash(seed)}`;

    const buffer = await this.renderProformaPdf({
      proformaNumber,
      issuedAt: new Date(),
      buyer: args.buyer,
      payment: { gateway: 'bank_transfer', amount: args.totalAmount },
      lineItems: args.lineItems,
      subtotal: args.subtotal,
      discountAmount: args.discountAmount,
      taxAmount: args.taxAmount,
      totalAmount: args.totalAmount,
      branding,
      locale: args.locale || 'en',
    });
    return { buffer, proformaNumber };
  }

  private shortHash(input: string): string {
    // 8-char base36 hash — collision risk irrelevant; just for a stable label.
    let h = 0;
    for (let i = 0; i < input.length; i++) {
      h = (h * 31 + input.charCodeAt(i)) >>> 0;
    }
    return h.toString(36).toUpperCase().padStart(8, '0').slice(0, 8);
  }

  private async renderProformaPdf(args: {
    proformaNumber: string;
    issuedAt: Date;
    buyer: { name: string; email: string; nationalId: string | null };
    payment: { gateway: string; amount: number };
    lineItems: Array<{
      description: string;
      descriptionAr: string | null;
      deliveryType: string | null;
      amount: number;
    }>;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    totalAmount: number;
    branding: SiteBranding;
    locale?: InvoiceLocale;
  }): Promise<Buffer> {
    const locale: InvoiceLocale = args.locale || 'en';
    const L = INVOICE_LABELS[locale];
    const rtl = locale === 'ar';
    const startAlign: 'left' | 'right' = rtl ? 'right' : 'left';
    const endAlign: 'left' | 'right' = rtl ? 'left' : 'right';
    const PAGE_W = 595;
    const mirror = (x: number, w: number) => (rtl ? PAGE_W - x - w : x);
    // Proforma uses current global settings — it's a pre-payment preview,
    // not a tax record. Once paid, the final invoice locks in its own rate.
    const taxSettings = await this.taxComputationService.getSettings();
    return new Promise(async (resolve, reject) => {
      try {
        // Same engine + brand palette as the final invoice (generatePdf
        // above) so a buyer's proforma → invoice journey looks like one
        // continuous document instead of jumping between two templates.
        // Differences: title says PROFORMA INVOICE, status pill always
        // AWAITING PAYMENT, no QR / verify-URL (proforma numbers are not
        // resolvable on /verify-invoice/), footer carries the "not a tax
        // invoice" disclaimer.
        const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const fontsDir = path.join(process.cwd(), 'src', 'assets', 'fonts');
        doc.registerFont('NotoArabic', path.join(fontsDir, 'NotoSansArabic-Regular.ttf'));
        doc.registerFont('NotoArabicBold', path.join(fontsDir, 'NotoSansArabic-Bold.ttf'));
        const ws = { wordSpacing: 2 };

        const BRAND = '#1A2747';
        const ACCENT = '#B8860B';
        const MUTED = '#6B7280';
        const SOFT = '#F3F4F6';

        // Always AWAITING PAYMENT — proforma has no other state.
        const statusBadge = {
          bg: '#FEF3C7',
          fg: '#92400E',
          label: L.statusAwaiting,
        };

        const fmtDT = (d: Date | string | null | undefined) => {
          if (!d) return '';
          const date = new Date(d);
          const dd = date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
          const tt = date.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
          return `${dd} · ${tt}`;
        };

        // ── Header band ──
        doc.rect(0, 0, PAGE_W, 100).fill(BRAND);
        const logoBuf = getBrandLogo();
        const logoW = 50;
        const logoX = rtl ? PAGE_W - 40 - logoW : 40;
        if (logoBuf) {
          doc.image(logoBuf, logoX, 25, { width: logoW, height: logoW });
        }
        const brandBlockW = 320 - (logoBuf ? logoW + 10 : 0);
        const brandTextX = rtl
          ? PAGE_W - 40 - (logoBuf ? logoW + 10 : 0) - brandBlockW
          : logoBuf
            ? 40 + logoW + 10
            : 40;
        doc
          .fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(22)
          .text(args.branding.siteNameEn, brandTextX, 32, {
            width: brandBlockW,
            align: startAlign,
          });
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#CBD5E1')
          .text('physioguidance.org', brandTextX, 62, {
            width: brandBlockW,
            align: startAlign,
          });
        if (taxSettings.taxNumber) {
          doc
            .font(rtl ? 'NotoArabic' : 'Helvetica')
            .fontSize(9)
            .fillColor('#CBD5E1')
            .text(L.vatNo(taxSettings.taxNumber), brandTextX, 78, {
              width: brandBlockW,
              align: startAlign,
              features: rtl ? ['rtla'] : undefined,
            });
        }

        const titleW = 235;
        const titleX = rtl ? 40 : PAGE_W - 40 - titleW;
        doc
          .fillColor('#FFFFFF')
          .font(rtl ? 'NotoArabicBold' : 'Helvetica-Bold')
          .fontSize(22)
          .text(L.proformaTitle, titleX, 26, {
            width: titleW,
            align: endAlign,
            features: rtl ? ['rtla'] : undefined,
          });
        doc.rect(0, 100, PAGE_W, 4).fill(ACCENT);
        doc.fillColor('#000000');

        // ── Status badge + meta strip ── (same layout logic as paid invoice)
        const metaTop = 124;
        const badgeWidth = 140;
        const badgeX = mirror(40, badgeWidth);
        doc.roundedRect(badgeX, metaTop, badgeWidth, 24, 4).fill(statusBadge.bg);
        const badgeTextY = metaTop + (rtl ? 4 : 7);
        doc
          .fillColor(statusBadge.fg)
          .font(rtl ? 'NotoArabicBold' : 'Helvetica-Bold')
          .fontSize(10)
          .text(statusBadge.label, badgeX, badgeTextY, {
            width: badgeWidth,
            align: 'center',
            features: rtl ? (['rtla'] as any) : undefined,
          });
        doc.fillColor('#000000');

        const metaLines: Array<[string, string]> = [
          [L.proformaNumber, args.proformaNumber],
          [L.issuedDate, fmtDT(args.issuedAt)],
        ];
        const metaLabelW = 100;
        const metaValueW = 150;
        const metaGap = 5;
        const metaBlockW = metaLabelW + metaGap + metaValueW;
        const metaBlockLeft = rtl ? 40 : PAGE_W - 40 - metaBlockW;
        const metaBlockRight = metaBlockLeft + metaBlockW;
        const metaLabelX = rtl ? metaBlockRight - metaLabelW : metaBlockLeft;
        const metaValueX = rtl ? metaBlockLeft : metaBlockRight - metaValueW;
        let mY = metaTop;
        for (const [label, value] of metaLines) {
          const baselineY = mY + 10;
          doc
            .font(rtl ? 'NotoArabic' : 'Helvetica')
            .fontSize(9)
            .fillColor(MUTED)
            .text(label, metaLabelX, baselineY, {
              width: metaLabelW,
              align: startAlign,
              features: rtl ? (['rtla'] as any) : undefined,
              baseline: 'alphabetic' as any,
              lineBreak: false,
            });
          doc
            .font('Helvetica-Bold')
            .fontSize(10)
            .fillColor('#111827')
            .text(value, metaValueX, baselineY, {
              width: metaValueW,
              align: endAlign,
              baseline: 'alphabetic' as any,
              lineBreak: false,
            });
          mY += 14;
        }

        // ── Bill-To / Payment-Details two-column block ──
        const sectionTop = Math.max(metaTop + 40, mY + 12);
        const cardW = 252;
        const cardH = 92;
        const billToX = mirror(40, cardW);
        const payDetailsX = mirror(303, cardW);

        doc
          .roundedRect(billToX, sectionTop, cardW, cardH, 6)
          .lineWidth(1)
          .strokeColor('#E5E7EB')
          .stroke();
        doc
          .font(rtl ? 'NotoArabicBold' : 'Helvetica-Bold')
          .fontSize(9)
          .fillColor(MUTED)
          .text(L.billTo, billToX + 12, sectionTop + 10, {
            width: cardW - 24,
            align: startAlign,
            features: rtl ? ['rtla'] : undefined,
          });
        {
          const displayName = args.buyer.name || args.buyer.email;
          const isNameArabic = hasArabicChars(displayName);
          // Alignment follows PDF locale, not name script; rtla features
          // only track the actual name script so Arabic text still shapes.
          const bodyAlign = rtl ? 'right' : 'left';
          const nameFeatures = isNameArabic ? (['rtla'] as any) : undefined;
          doc
            .font(fontFor(displayName, true))
            .fontSize(12)
            .fillColor('#111827')
            .text(displayName, billToX + 12, sectionTop + 26, {
              width: cardW - 24,
              features: nameFeatures,
              align: bodyAlign,
            });
          doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor(MUTED)
            .text(args.buyer.email, billToX + 12, sectionTop + 50, {
              width: cardW - 24,
              align: bodyAlign,
            });
        }

        doc
          .roundedRect(payDetailsX, sectionTop, cardW, cardH, 6)
          .lineWidth(1)
          .strokeColor('#E5E7EB')
          .stroke();
        doc
          .font(rtl ? 'NotoArabicBold' : 'Helvetica-Bold')
          .fontSize(9)
          .fillColor(MUTED)
          .text(L.paymentIntent, payDetailsX + 12, sectionTop + 10, {
            width: cardW - 24,
            align: startAlign,
            features: rtl ? ['rtla'] : undefined,
          });
        const gatewayLabel = L.gatewayName(args.payment.gateway);
        const intentRows: Array<[string, string]> = [
          [L.method, gatewayLabel],
          [L.statusLabel, L.awaitingTransfer],
        ];
        let pY = sectionTop + 28;
        // Baseline-aligned label + value (same pattern as paid invoice).
        const payInteriorLeft = payDetailsX + 12;
        const payInteriorRight = payDetailsX + cardW - 12;
        for (const [k, v] of intentRows) {
          const rowBaseline = pY + 10;
          doc
            .font(rtl ? 'NotoArabic' : 'Helvetica')
            .fontSize(9)
            .fillColor(MUTED);
          const labelW = doc.widthOfString(k);
          const labelX = rtl ? payInteriorRight - labelW : payInteriorLeft;
          doc.text(k, labelX, rowBaseline, {
            lineBreak: false,
            features: rtl ? (['rtla'] as any) : undefined,
            baseline: 'alphabetic' as any,
          });
          // Value — font by actual script of `v` (Latin fallbacks for
          // AR labels would tofu-box in NotoArabicBold otherwise).
          const valueIsArabic = hasArabicChars(v);
          doc
            .font(fontFor(v, true))
            .fontSize(10)
            .fillColor('#111827');
          const valueW = doc.widthOfString(v);
          const valueX = rtl ? payInteriorLeft : payInteriorRight - valueW;
          doc.text(v, valueX, rowBaseline, {
            lineBreak: false,
            features: valueIsArabic ? (['rtla'] as any) : undefined,
            baseline: 'alphabetic' as any,
          });
          pY += 18;
        }

        // ── Line items table ──
        const tableTop = sectionTop + cardH + 22;
        doc.rect(40, tableTop, 515, 24).fill(SOFT);
        const colDescW = 300;
        const colQtyW = 40;
        const colUnitW = 75;
        const colAmtW = 75;
        const colDescX = rtl ? PAGE_W - 50 - colDescW : 50;
        const colQtyX = rtl ? PAGE_W - 360 - colQtyW : 360;
        const colUnitX = rtl ? PAGE_W - 400 - colUnitW : 400;
        const colAmtX = rtl ? PAGE_W - 475 - colAmtW : 475;
        doc.fillColor(MUTED).font(rtl ? 'NotoArabicBold' : 'Helvetica-Bold').fontSize(9);
        doc.text(L.description, colDescX, tableTop + 8, {
          width: colDescW,
          align: startAlign,
          features: rtl ? ['rtla'] : undefined,
        });
        doc.text(L.qty, colQtyX, tableTop + 8, { width: colQtyW, align: 'center', features: rtl ? ['rtla'] : undefined });
        doc.text(L.unit, colUnitX, tableTop + 8, { width: colUnitW, align: endAlign, features: rtl ? ['rtla'] : undefined });
        doc.text(L.amount, colAmtX, tableTop + 8, { width: colAmtW, align: endAlign, features: rtl ? ['rtla'] : undefined });
        doc.fillColor('#000000');

        let y = tableTop + 32;
        let rowIdx = 0;
        for (const item of args.lineItems) {
          const rowTop = y;
          if (rowIdx % 2 === 1) {
            doc.rect(40, rowTop - 4, 515, 26).fill('#FAFAFA');
            doc.fillColor('#000000');
          }
          {
            const desc =
              (rtl && item.descriptionAr) || item.description || '';
            const isDescArabic = hasArabicChars(desc);
            const descAlign = isDescArabic || rtl ? 'right' : 'left';
            doc
              .font(fontFor(desc))
              .fontSize(10)
              .fillColor('#111827')
              .text(desc, colDescX, y, {
                width: colDescW,
                features: isDescArabic || rtl ? ['rtla'] : undefined,
                align: descAlign,
              });
          }
          let rowExtra = 0;
          if (item.deliveryType) {
            // Delivery type may fall back to Latin (e.g. legacy types
            // with no AR label). Route through fontFor() so Latin text
            // renders in Helvetica — not tofu from the Arabic-only font.
            const dtLabel = L.deliveryType(item.deliveryType);
            const dtIsArabic = hasArabicChars(dtLabel);
            doc
              .font(fontFor(dtLabel))
              .fontSize(8)
              .fillColor(MUTED)
              .text(dtLabel, colDescX, y + 14, {
                width: colDescW,
                align: rtl ? 'right' : 'left',
                features: dtIsArabic ? ['rtla'] : undefined,
              });
            rowExtra += 12;
          }
          doc
            .font('Helvetica')
            .fontSize(10)
            .fillColor('#111827')
            .text('1', colQtyX, rowTop + 1, { width: colQtyW, align: 'center' });
          doc.text(L.currency(Number(item.amount)), colUnitX, rowTop + 1, {
            width: colUnitW,
            align: endAlign,
          });
          doc
            .font('Helvetica-Bold')
            .text(L.currency(Number(item.amount)), colAmtX, rowTop + 1, {
              width: colAmtW,
              align: endAlign,
            });
          y += Math.max(24, 16 + rowExtra);
          rowIdx += 1;
        }

        // ── Totals block ──
        let tY = y + 12;
        const totalsWidth = 235;
        const totalsLeft = mirror(320, totalsWidth);
        const totalsRight = totalsLeft + totalsWidth;
        const totalsRow = (label: string, value: string, bold = false) => {
          const rowBaseline = tY + 10;
          const labelFont = bold
            ? rtl ? 'NotoArabicBold' : 'Helvetica-Bold'
            : rtl ? 'NotoArabic' : 'Helvetica';
          doc
            .font(labelFont)
            .fontSize(bold ? 11 : 10)
            .fillColor(bold ? '#111827' : MUTED);
          const labelW = doc.widthOfString(label);
          const labelX = rtl ? totalsRight - labelW : totalsLeft;
          doc.text(label, labelX, rowBaseline, {
            lineBreak: false,
            features: rtl ? (['rtla'] as any) : undefined,
            baseline: 'alphabetic' as any,
          });
          doc
            .font(bold ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(bold ? 11 : 10)
            .fillColor('#111827');
          const valueW = doc.widthOfString(value);
          const valueX = rtl ? totalsLeft : totalsRight - valueW;
          doc.text(value, valueX, rowBaseline, {
            lineBreak: false,
            baseline: 'alphabetic' as any,
          });
          tY += 16;
        };

        totalsRow(L.subtotal, L.currency(Number(args.subtotal)));
        if (args.discountAmount > 0) {
          totalsRow(L.discount, L.currencyNeg(Number(args.discountAmount)));
        }
        if (args.taxAmount > 0) {
          totalsRow(
            L.vatRow(taxSettings.vatRate),
            L.currency(Number(args.taxAmount)),
          );
        }
        doc
          .moveTo(totalsLeft, tY + 2)
          .lineTo(totalsLeft + totalsWidth, tY + 2)
          .strokeColor('#E5E7EB')
          .stroke()
          .strokeColor('#000000');
        tY += 8;

        // AMOUNT DUE box — baseline-aligned label + value at box vertical center.
        const dueBoxH = 30;
        doc.rect(totalsLeft, tY, totalsWidth, dueBoxH).fill(BRAND);
        const dueBaseline = tY + 20;
        doc
          .fillColor('#FFFFFF')
          .font(rtl ? 'NotoArabicBold' : 'Helvetica-Bold')
          .fontSize(12);
        const dueLabelW = doc.widthOfString(L.amountDue);
        const dueLabelX = rtl
          ? totalsRight - 12 - dueLabelW
          : totalsLeft + 12;
        doc.text(L.amountDue, dueLabelX, dueBaseline, {
          lineBreak: false,
          features: rtl ? (['rtla'] as any) : undefined,
          baseline: 'alphabetic' as any,
        });
        doc.font('Helvetica-Bold').fontSize(14);
        const dueValueStr = L.currency(Number(args.totalAmount));
        const dueValueW = doc.widthOfString(dueValueStr);
        const dueValueX = rtl
          ? totalsLeft + 12
          : totalsRight - 12 - dueValueW;
        doc.text(dueValueStr, dueValueX, dueBaseline, {
          lineBreak: false,
          baseline: 'alphabetic' as any,
        });
        doc.fillColor('#000000');

        // ── Notice band (replaces the QR strip used on real invoices) ──
        const noticeTop = Math.min(Math.max(tY + 44, 600), 660);
        doc.roundedRect(40, noticeTop, 515, 64, 6).fill('#FFFBEB');
        doc
          .fillColor('#92400E')
          .font(rtl ? 'NotoArabicBold' : 'Helvetica-Bold')
          .fontSize(10)
          .text(L.noticeTitle, 52, noticeTop + 10, {
            width: 491,
            align: startAlign,
            features: rtl ? ['rtla'] : undefined,
          });
        doc
          .font(rtl ? 'NotoArabic' : 'Helvetica')
          .fontSize(9)
          .fillColor('#78350F')
          .text(L.noticeBody, 52, noticeTop + 26, {
            width: 491,
            align: startAlign,
            features: rtl ? ['rtla'] : undefined,
          });
        doc.fillColor('#000000');

        // ── Footer band ──
        doc.rect(0, 770, PAGE_W, 72).fill('#F9FAFB');
        const footerBrandX = rtl ? PAGE_W - 40 - 200 : 40;
        doc
          .fillColor(BRAND)
          .font('Helvetica-Bold')
          .fontSize(9)
          .text(args.branding.siteNameEn, footerBrandX, 786, {
            width: 200,
            align: startAlign,
          });
        const footerMsgX = rtl ? PAGE_W - 40 - 360 : 40;
        doc
          .font(rtl ? 'NotoArabic' : 'Helvetica')
          .fontSize(8)
          .fillColor(MUTED)
          .text(L.footerProforma, footerMsgX, 802, {
            width: 360,
            align: startAlign,
            features: rtl ? ['rtla'] : undefined,
          });
        const pageOfX = rtl ? 40 : PAGE_W - 40 - 115;
        doc
          .font(rtl ? 'NotoArabic' : 'Helvetica')
          .fontSize(8)
          .fillColor(MUTED)
          .text(L.pageOf(1, 1), pageOfX, 802, {
            width: 115,
            align: endAlign,
            features: rtl ? ['rtla'] : undefined,
          });
        doc.fillColor('#000000');

        const range = doc.bufferedPageRange();
        if (range.count > 1) {
          for (let i = range.start + range.count - 1; i > range.start; i--) {
            doc.switchToPage(i);
          }
          doc.switchToPage(range.start);
        }
        doc.flushPages();
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  async getInvoicePdfUrl(
    invoiceId: string,
    userId?: string,
    locale: InvoiceLocale = 'en',
  ) {
    const conditions = [eq(invoices.id, invoiceId)];
    if (userId) {
      conditions.push(eq(invoices.userId, userId));
    }

    const [invoice] = await db
      .select()
      .from(invoices)
      .where(and(...conditions))
      .limit(1);

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const localeKey = this.storageKeyFor(invoice.invoiceNumber, locale);

    // Check if the locale-specific PDF already exists in storage. For legacy
    // EN invoices generated before the locale split, fall back to the old
    // no-suffix key so we don't force a needless regeneration.
    const localeBuffer = await this.storageService.getFileBuffer('private', localeKey);
    if (localeBuffer) {
      const signedUrl = await this.storageService.getSignedUrl('private', localeKey);
      return { url: signedUrl, invoiceNumber: invoice.invoiceNumber };
    }
    if (locale === 'en') {
      const legacyKey = this.legacyStorageKey(invoice.invoiceNumber);
      const legacyBuffer = await this.storageService.getFileBuffer('private', legacyKey);
      if (legacyBuffer) {
        const signedUrl = await this.storageService.getSignedUrl('private', legacyKey);
        return { url: signedUrl, invoiceNumber: invoice.invoiceNumber };
      }
    }

    // Not in storage yet — regenerate from the persisted snapshot at the
    // requested locale, upload, then hand back the signed URL.
    try {
      const [payment] = await db.select().from(payments).where(eq(payments.id, invoice.paymentId)).limit(1);
      const [userData] = await db.select().from(users).where(eq(users.id, invoice.userId)).limit(1);
      const [course] = await db.select().from(courses).where(eq(courses.id, invoice.courseId)).limit(1);

      if (!payment || !userData || !course) {
        throw new NotFoundException('Invoice source data missing');
      }
      const meta = (invoice.metadata as any) || {};
      const persistedLineItems = Array.isArray(meta.lineItems) ? meta.lineItems : undefined;
      const branding = await this.siteSettings.getBranding();
      const pdfBuffer = await this.generatePdf(
        invoice,
        payment,
        userData,
        course,
        persistedLineItems,
        branding,
        locale,
      );
      await this.storageService.uploadPrivate(pdfBuffer, localeKey, 'application/pdf');
      // Preserve pdfUrl pointing to whatever it already had (EN default); if
      // the invoice never got a first-generation URL, set it to the locale key
      // so downstream "is generated?" checks succeed.
      if (!invoice.pdfUrl) {
        await db
          .update(invoices)
          .set({ pdfUrl: localeKey, updatedAt: new Date() })
          .where(eq(invoices.id, invoice.id));
      }
      this.logger.log(`On-demand PDF generated for invoice ${invoice.invoiceNumber} (${locale})`);

      const signedUrl = await this.storageService.getSignedUrl('private', localeKey);
      return { url: signedUrl, invoiceNumber: invoice.invoiceNumber };
    } catch (err: any) {
      this.logger.error(`On-demand PDF generation failed for ${invoiceId} (${locale}): ${err.message}`);
      throw new NotFoundException('Invoice PDF generation failed');
    }
  }

  async getInvoicesByUser(
    userId: string,
    page: number = 1,
    limit: number = 10,
    status?: string,
  ) {
    const offset = (page - 1) * limit;

    const conditions: any[] = [eq(invoices.userId, userId)];
    if (status) conditions.push(eq(invoices.status, status as any));
    const whereClause = and(...conditions);

    const invoicesList = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        paymentId: invoices.paymentId,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
        totalAmount: invoices.totalAmount,
        status: invoices.status,
        issuedAt: invoices.issuedAt,
        paidAt: invoices.paidAt,
        refundStatus: sql<string | null>`(
          SELECT ${refunds.status} FROM ${refunds}
          WHERE ${refunds.paymentId} = ${invoices.paymentId}
          ORDER BY ${refunds.createdAt} DESC LIMIT 1
        )`.as('refund_status'),
      })
      .from(invoices)
      .leftJoin(courses, eq(invoices.courseId, courses.id))
      .where(whereClause)
      .orderBy(desc(invoices.issuedAt))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ count: count() })
      .from(invoices)
      .where(whereClause);

    return {
      data: invoicesList,
      pagination: {
        page,
        limit,
        total: Number(totalResult?.count || 0),
        totalPages: Math.ceil(Number(totalResult?.count || 0) / limit),
      },
    };
  }

  async getAllInvoices(
    page: number = 1,
    limit: number = 10,
    status?: string,
    startDate?: string,
    endDate?: string,
    search?: string,
    gateway?: string,
  ) {
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    if (status) conditions.push(eq(invoices.status, status as any));
    const start = parseStartDate(startDate);
    const end = parseEndDate(endDate);
    if (start) conditions.push(gte(invoices.issuedAt, start));
    if (end) conditions.push(lte(invoices.issuedAt, end));
    if (gateway) conditions.push(eq(payments.gateway, gateway));
    if (search) {
      const q = `%${search}%`;
      conditions.push(
        sql`(${invoices.invoiceNumber} ILIKE ${q}
             OR ${users.email} ILIKE ${q}
             OR ${users.firstName} ILIKE ${q}
             OR ${users.lastName} ILIKE ${q}
             OR ${courses.title} ILIKE ${q})`,
      );
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const invoicesList = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        paymentId: invoices.paymentId,
        userName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        userEmail: users.email,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
        subtotal: invoices.subtotal,
        discountAmount: invoices.discountAmount,
        taxAmount: invoices.taxAmount,
        totalAmount: invoices.totalAmount,
        status: invoices.status,
        issuedAt: invoices.issuedAt,
        paidAt: invoices.paidAt,
        dueDate: invoices.dueDate,
        gateway: payments.gateway,
        refundStatus: sql<string | null>`(
          SELECT ${refunds.status} FROM ${refunds}
          WHERE ${refunds.paymentId} = ${invoices.paymentId}
          ORDER BY ${refunds.createdAt} DESC LIMIT 1
        )`.as('refund_status'),
      })
      .from(invoices)
      .leftJoin(courses, eq(invoices.courseId, courses.id))
      .leftJoin(users, eq(invoices.userId, users.id))
      .leftJoin(payments, eq(invoices.paymentId, payments.id))
      .where(whereClause)
      .orderBy(desc(invoices.issuedAt))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ count: count() })
      .from(invoices)
      .leftJoin(payments, eq(invoices.paymentId, payments.id))
      .leftJoin(users, eq(invoices.userId, users.id))
      .leftJoin(courses, eq(invoices.courseId, courses.id))
      .where(whereClause);

    return {
      data: invoicesList,
      pagination: {
        page,
        limit,
        total: Number(totalResult?.count || 0),
        totalPages: Math.ceil(Number(totalResult?.count || 0) / limit),
      },
    };
  }

  /**
   * Aggregates for the Invoices page KPI strip — real sums + per-status
   * counts across the full filtered dataset (not the current page).
   * Same filter set as getAllInvoices so the stats match what the table
   * lists. Single query so the page loads as one round-trip.
   */
  async getInvoiceSummary(opts: {
    status?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    gateway?: string;
  }) {
    const conditions: any[] = [];
    if (opts.status) conditions.push(eq(invoices.status, opts.status as any));
    const start = parseStartDate(opts.startDate);
    const end = parseEndDate(opts.endDate);
    if (start) conditions.push(gte(invoices.issuedAt, start));
    if (end) conditions.push(lte(invoices.issuedAt, end));
    if (opts.gateway) conditions.push(eq(payments.gateway, opts.gateway));
    if (opts.search) {
      const q = `%${opts.search}%`;
      conditions.push(
        sql`(${invoices.invoiceNumber} ILIKE ${q}
             OR ${users.email} ILIKE ${q}
             OR ${users.firstName} ILIKE ${q}
             OR ${users.lastName} ILIKE ${q}
             OR ${courses.title} ILIKE ${q})`,
      );
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [row] = await db
      .select({
        totalCount: sql<number>`COUNT(*)::int`,
        totalAmount: sql<string>`COALESCE(SUM(${invoices.totalAmount}::numeric), 0)`,
        paidCount: sql<number>`COUNT(CASE WHEN ${invoices.status} = 'paid' THEN 1 END)::int`,
        paidAmount: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'paid' THEN ${invoices.totalAmount}::numeric ELSE 0 END), 0)`,
        overdueCount: sql<number>`COUNT(CASE WHEN ${invoices.status} = 'overdue' THEN 1 END)::int`,
        overdueAmount: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'overdue' THEN ${invoices.totalAmount}::numeric ELSE 0 END), 0)`,
        refundedCount: sql<number>`COUNT(CASE WHEN ${invoices.status} = 'refunded' THEN 1 END)::int`,
        refundedAmount: sql<string>`COALESCE(SUM(CASE WHEN ${invoices.status} = 'refunded' THEN ${invoices.totalAmount}::numeric ELSE 0 END), 0)`,
        cancelledCount: sql<number>`COUNT(CASE WHEN ${invoices.status} = 'cancelled' THEN 1 END)::int`,
      })
      .from(invoices)
      .leftJoin(payments, eq(invoices.paymentId, payments.id))
      .leftJoin(users, eq(invoices.userId, users.id))
      .leftJoin(courses, eq(invoices.courseId, courses.id))
      .where(whereClause);

    return {
      totalCount: row?.totalCount ?? 0,
      totalAmount: Number(row?.totalAmount ?? 0),
      paidCount: row?.paidCount ?? 0,
      paidAmount: Number(row?.paidAmount ?? 0),
      overdueCount: row?.overdueCount ?? 0,
      overdueAmount: Number(row?.overdueAmount ?? 0),
      refundedCount: row?.refundedCount ?? 0,
      refundedAmount: Number(row?.refundedAmount ?? 0),
      cancelledCount: row?.cancelledCount ?? 0,
    };
  }

  /**
   * Full detail for the invoice drawer — invoice row + payment + buyer +
   * line items + refund list + matching audit-log entries. One method so
   * the drawer opens in a single round-trip.
   */
  async getInvoiceDetail(invoiceId: string) {
    const [base] = await db
      .select({
        invoice: invoices,
        userName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        userEmail: users.email,
        userId: users.id,
        gateway: payments.gateway,
        paymentMethod: payments.paymentMethod,
        paymentStatus: payments.status,
        gatewayChargeId: payments.gatewayChargeId,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
      })
      .from(invoices)
      .leftJoin(users, eq(invoices.userId, users.id))
      .leftJoin(payments, eq(invoices.paymentId, payments.id))
      .leftJoin(courses, eq(invoices.courseId, courses.id))
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!base) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    // Persisted line items snapshot lives on metadata — use it (don't re-query
    // courses since a renamed course would silently rewrite a paid invoice).
    const meta = (base.invoice.metadata as any) || {};
    const lineItems = Array.isArray(meta.lineItems) ? meta.lineItems : [];

    const refundRows = await db
      .select({
        id: refunds.id,
        amount: refunds.refundAmount,
        reason: refunds.reason,
        reasonNote: refunds.reasonNote,
        status: refunds.status,
        requestedAt: refunds.createdAt,
        approvedAt: refunds.approvedAt,
        completedAt: refunds.completedAt,
        rejectedAt: refunds.rejectedAt,
      })
      .from(refunds)
      .where(eq(refunds.paymentId, base.invoice.paymentId))
      .orderBy(desc(refunds.createdAt));

    return {
      invoice: base.invoice,
      buyer: {
        id: base.userId,
        name: base.userName,
        email: base.userEmail,
        nationalId: meta.buyer?.nationalId || null,
      },
      payment: {
        id: base.invoice.paymentId,
        gateway: base.gateway,
        paymentMethod: base.paymentMethod,
        status: base.paymentStatus,
        gatewayChargeId: base.gatewayChargeId,
      },
      course: {
        id: base.invoice.courseId,
        title: base.courseTitle,
        titleAr: base.courseTitleAr,
      },
      lineItems,
      refunds: refundRows,
    };
  }

  /**
   * Force-regenerate the invoice PDF — useful when the template has been
   * updated, the file was lost, or the buyer reports a corrupt download.
   * Re-renders using the persisted line-items snapshot so the invoice
   * content is unchanged; only the rendering refreshes. Audits the action
   * with the actor.
   */
  async regeneratePdf(
    invoiceId: string,
    actorUserId: string,
    locale: InvoiceLocale = 'en',
  ) {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoice) throw new NotFoundException('Invoice not found');

    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, invoice.paymentId))
      .limit(1);
    const [userData] = await db
      .select()
      .from(users)
      .where(eq(users.id, invoice.userId))
      .limit(1);
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, invoice.courseId))
      .limit(1);

    if (!payment || !userData || !course) {
      throw new NotFoundException('Linked payment / user / course missing');
    }

    const meta = (invoice.metadata as any) || {};
    const persistedLineItems = Array.isArray(meta.lineItems)
      ? meta.lineItems
      : undefined;
    const branding = await this.siteSettings.getBranding();
    const pdfBuffer = await this.generatePdf(
      invoice,
      payment,
      userData,
      course,
      persistedLineItems,
      branding,
      locale,
    );
    const filename = this.storageKeyFor(invoice.invoiceNumber, locale);
    await this.storageService.uploadPrivate(
      pdfBuffer,
      filename,
      'application/pdf',
    );
    // Leave `invoice.pdfUrl` alone (it points to whichever locale was first
    // generated); locale-specific reads always go through storageKeyFor.
    // Only set it if this is the very first PDF for this invoice row.
    if (!invoice.pdfUrl) {
      await db
        .update(invoices)
        .set({ pdfUrl: filename, updatedAt: new Date() })
        .where(eq(invoices.id, invoice.id));
    } else {
      await db
        .update(invoices)
        .set({ updatedAt: new Date() })
        .where(eq(invoices.id, invoice.id));
    }

    await this.auditLogService.log({
      entityType: 'invoice',
      entityId: invoice.id,
      action: 'invoice_pdf_regenerated',
      performedBy: actorUserId,
      metadata: { invoiceNumber: invoice.invoiceNumber, locale },
    });

    return { ok: true, invoiceNumber: invoice.invoiceNumber };
  }

  /**
   * Admin action to void an invoice — flips status to 'cancelled' and
   * audits the action with a required reason. Idempotent: cancelling an
   * already-cancelled invoice is a no-op. Does NOT touch the underlying
   * payment (refund flow handles that side); finance can cancel a
   * mis-issued invoice without forcing a refund.
   */
  async cancelInvoice(
    invoiceId: string,
    reason: string,
    actorUserId: string,
  ) {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === INVOICE_STATUS.CANCELLED) {
      return { ok: true, invoiceNumber: invoice.invoiceNumber, alreadyCancelled: true };
    }

    await db
      .update(invoices)
      .set({ status: INVOICE_STATUS.CANCELLED, updatedAt: new Date() })
      .where(eq(invoices.id, invoiceId));

    await this.auditLogService.log({
      entityType: 'invoice',
      entityId: invoiceId,
      action: 'invoice_cancelled',
      performedBy: actorUserId,
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        previousStatus: invoice.status,
        reason,
      },
    });

    return { ok: true, invoiceNumber: invoice.invoiceNumber };
  }

  /**
   * Overdue sweep — invoices with a due date in the past that are still
   * issued (not paid/cancelled/refunded) get flipped to 'overdue'. Only
   * relevant for bank-transfer / future net-N invoices since direct
   * gateway-paid rows write status=paid up front. Returns swept count.
   */
  async sweepOverdueInvoices() {
    const now = new Date();
    const result = await db
      .update(invoices)
      .set({ status: INVOICE_STATUS.OVERDUE, updatedAt: new Date() })
      .where(
        and(
          eq(invoices.status, INVOICE_STATUS.ISSUED),
          sql`${invoices.dueDate} IS NOT NULL`,
          lte(invoices.dueDate, now),
        ),
      )
      .returning({ id: invoices.id, invoiceNumber: invoices.invoiceNumber });

    for (const row of result) {
      await this.auditLogService.log({
        entityType: 'invoice',
        entityId: row.id,
        action: 'invoice_overdue_flagged',
        performedBy: 'system',
        ipAddress: 'cron',
        metadata: { invoiceNumber: row.invoiceNumber, sweptAt: now.toISOString() },
      });
    }

    this.logger.log(`Overdue sweep: flagged ${result.length} invoice(s) as overdue`);
    return { sweptCount: result.length, sweptAt: now.toISOString() };
  }

  /**
   * CSV export of the current filtered invoice set. Same filters as the
   * admin list query. No pagination — returns the full match. Includes
   * line items inline as a pipe-separated summary so the spreadsheet
   * is one row per invoice (common ask from finance).
   */
  async exportInvoicesCsv(opts: {
    status?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    gateway?: string;
  }): Promise<string> {
    const { data } = await this.getAllInvoices(
      1,
      10000,
      opts.status,
      opts.startDate,
      opts.endDate,
      opts.search,
      opts.gateway,
    );

    const headers = [
      'Invoice Number',
      'Status',
      'Customer Name',
      'Customer Email',
      'Course',
      'Gateway',
      'Subtotal (SAR)',
      'Discount (SAR)',
      'VAT (SAR)',
      'Total (SAR)',
      'Issued At',
      'Paid At',
      'Due Date',
      'Refund Status',
    ];

    const rows: (string | number | null)[][] = data.map((r) => [
      r.invoiceNumber,
      r.status,
      (r as any).userName?.trim() || '',
      (r as any).userEmail || '',
      (r as any).courseTitle || '',
      (r as any).gateway || '',
      Number((r as any).subtotal || 0).toFixed(2),
      Number((r as any).discountAmount || 0).toFixed(2),
      Number((r as any).taxAmount || 0).toFixed(2),
      Number((r as any).totalAmount || 0).toFixed(2),
      (r as any).issuedAt ? new Date((r as any).issuedAt).toISOString() : '',
      (r as any).paidAt ? new Date((r as any).paidAt).toISOString() : '',
      (r as any).dueDate ? new Date((r as any).dueDate).toISOString() : '',
      (r as any).refundStatus || '',
    ]);

    return toCsvString(rows, { headers });
  }

  /**
   * Audit-trail for the invoice drawer — pulls direct invoice events plus
   * the linked payment + refund events so the drawer shows the full
   * lifecycle (generation, regen, cancel, refund-requested/approved/
   * completed, payment_completed). Same UNION pattern as
   * PaymentsService.getPaymentAudit.
   */
  async getInvoiceAudit(invoiceId: string, limit: number = 100) {
    const [invoice] = await db
      .select({ paymentId: invoices.paymentId })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);
    if (!invoice) return [];

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
        (a.entity_type = 'invoice' AND a.entity_id = ${invoiceId})
        OR (a.entity_type = 'payment' AND a.entity_id = ${invoice.paymentId})
        OR (a.entity_type = 'refund' AND a.entity_id IN (
          SELECT id FROM refunds WHERE payment_id = ${invoice.paymentId}
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

  async getInvoiceById(invoiceId: string) {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    return invoice || null;
  }

  async getByInvoiceNumber(invoiceNumber: string) {
    const [invoice] = await db
      .select({
        invoiceNumber: invoices.invoiceNumber,
        status: invoices.status,
        totalAmount: invoices.totalAmount,
        subtotal: invoices.subtotal,
        taxAmount: invoices.taxAmount,
        issuedAt: invoices.issuedAt,
        paidAt: invoices.paidAt,
        buyerName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
        gateway: payments.gateway,
        paymentMethod: payments.paymentMethod,
        metadata: invoices.metadata,
      })
      .from(invoices)
      .leftJoin(users, eq(invoices.userId, users.id))
      .leftJoin(courses, eq(invoices.courseId, courses.id))
      .leftJoin(payments, eq(invoices.paymentId, payments.id))
      .where(eq(invoices.invoiceNumber, invoiceNumber))
      .limit(1);

    if (!invoice) return null;

    // Strip line-items / sensitive details from metadata — the verify
    // endpoint is PUBLIC, so we only surface the buyer-facing summary,
    // not the full snapshot.
    const meta = (invoice.metadata as any) || {};
    return {
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      totalAmount: invoice.totalAmount,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      issuedAt: invoice.issuedAt,
      paidAt: invoice.paidAt,
      buyerName: (invoice.buyerName || '').trim() || null,
      courseTitle: invoice.courseTitle,
      courseTitleAr: invoice.courseTitleAr,
      gateway: invoice.gateway,
      paymentMethod: invoice.paymentMethod,
      itemCount: Array.isArray(meta.lineItems) ? meta.lineItems.length : 1,
    };
  }

  async getInvoicePdfBuffer(
    paymentId: string,
    locale: InvoiceLocale = 'en',
  ): Promise<{ buffer: Buffer; filename: string } | null> {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.paymentId, paymentId))
      .limit(1);

    if (!invoice) return null;

    const localeKey = this.storageKeyFor(invoice.invoiceNumber, locale);
    try {
      // Prefer the locale-specific PDF.
      let buffer = await this.storageService.getFileBuffer('private', localeKey);
      // Legacy EN objects live at the no-suffix path — check that too.
      if (!buffer && locale === 'en') {
        const legacyKey = this.legacyStorageKey(invoice.invoiceNumber);
        buffer = await this.storageService.getFileBuffer('private', legacyKey);
      }
      // Not yet on disk in this locale — render + upload once so email jobs
      // and future reads succeed.
      if (!buffer) {
        const [payment] = await db
          .select()
          .from(payments)
          .where(eq(payments.id, invoice.paymentId))
          .limit(1);
        const [userData] = await db
          .select()
          .from(users)
          .where(eq(users.id, invoice.userId))
          .limit(1);
        const [course] = await db
          .select()
          .from(courses)
          .where(eq(courses.id, invoice.courseId))
          .limit(1);
        if (!payment || !userData || !course) return null;
        const meta = (invoice.metadata as any) || {};
        const persistedLineItems = Array.isArray(meta.lineItems)
          ? meta.lineItems
          : undefined;
        const branding = await this.siteSettings.getBranding();
        buffer = await this.generatePdf(
          invoice,
          payment,
          userData,
          course,
          persistedLineItems,
          branding,
          locale,
        );
        await this.storageService.uploadPrivate(buffer, localeKey, 'application/pdf');
      }

      return {
        buffer,
        filename: `${invoice.invoiceNumber}-${locale}.pdf`,
      };
    } catch (err: any) {
      this.logger.error(
        `Failed to retrieve PDF buffer for invoice ${invoice.invoiceNumber} (${locale}): ${err.message}`,
      );
      return null;
    }
  }
}
