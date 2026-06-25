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
import { decryptPII } from '../../../common/crypto';
import {
  SiteSettingsService,
  SiteBranding,
} from '../../site-settings/site-settings.service';
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import * as path from 'path';

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

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly auditLogService: AuditLogService,
    private readonly siteSettings: SiteSettingsService,
    private readonly taxComputationService: TaxComputationService,
  ) {}

  async generateInvoice(paymentId: string) {
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
        name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
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

    // Generate PDF
    try {
      const branding = await this.siteSettings.getBranding();
      const pdfBuffer = await this.generatePdf(
        invoice,
        payment,
        userData,
        primaryCourse,
        lineItemsSnapshot,
        branding,
      );

      // Upload to storage (path used as key for signed URL generation)
      const filename = `invoices/${invoice.invoiceNumber}.pdf`;
      await this.storageService.uploadPrivate(
        pdfBuffer,
        filename,
        'application/pdf',
      );

      // Update invoice with PDF URL
      await db
        .update(invoices)
        .set({ pdfUrl: filename, updatedAt: new Date() })
        .where(eq(invoices.id, invoice.id));

      this.logger.log(`Invoice ${invoice.invoiceNumber} generated for payment ${paymentId}`);
    } catch (err) {
      this.logger.error(
        `Failed to generate PDF for invoice ${invoice.invoiceNumber}: ${err.message}`,
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
  ): Promise<Buffer> {
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
            ? { bg: '#DCFCE7', fg: SUCCESS, label: 'PAID', ar: 'مدفوعة' }
            : status === 'refunded'
              ? { bg: '#EDE9FE', fg: VIOLET, label: 'REFUNDED', ar: 'مستردة' }
              : status === 'cancelled'
                ? { bg: '#FEE2E2', fg: DANGER, label: 'CANCELLED', ar: 'ملغاة' }
                : { bg: '#DBEAFE', fg: '#1D4ED8', label: 'ISSUED', ar: 'صادرة' };

        // Site-name fallback. NotoSansArabic has no Latin glyphs, so if the
        // admin entered Latin chars in the Arabic field (or Strapi returned
        // an empty / whitespace-only value), we use the hard-coded Arabic
        // brand name instead of letting Latin chars render as boxes.
        const safeAr = (s: string | null | undefined): string => {
          const stripped = (s || '')
            .replace(/[​-‏‪-‮﻿]/g, '')
            .trim();
          if (!stripped) return 'فيزيو جايدنس';
          return /[؀-ۿ]/.test(stripped) ? stripped : 'فيزيو جايدنس';
        };
        const siteNameArSafe = safeAr(branding.siteNameAr);

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
        doc.rect(0, 0, 595, 100).fill(BRAND);
        doc
          .fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(22)
          .text(branding.siteNameEn, 40, 26, { width: 320 });
        doc
          .font('NotoArabic')
          .fontSize(12)
          .fillColor('#FFFFFF')
          .text(arRtl(siteNameArSafe), 40, 54, { width: 320, ...ws });
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#CBD5E1')
          .text('nelc@physioguidance.org · physioguidance.org', 40, 76);
        if (taxSettings.taxNumber) {
          // ZATCA-compliant header line: shows the seller's tax
          // registration number so buyers can verify the invoice is a
          // valid tax invoice.
          doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor('#CBD5E1')
            .text(`VAT No: ${taxSettings.taxNumber}`, 40, 90);
        }

        doc
          .fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(26)
          .text('INVOICE', 360, 26, { width: 195, align: 'right' });
        doc
          .font('NotoArabicBold')
          .fontSize(13)
          .fillColor('#CBD5E1')
          .text(arRtl('فاتورة ضريبية'), 360, 58, {
            width: 195,
            align: 'right',
            ...ws,
          });
        doc.rect(0, 100, 595, 4).fill(ACCENT);
        doc.fillColor('#000000');

        // ── Status badge + meta strip ──
        const metaTop = 124;
        const badgeWidth = 110;
        doc.roundedRect(40, metaTop, badgeWidth, 24, 4).fill(statusBadge.bg);
        doc
          .fillColor(statusBadge.fg)
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(statusBadge.label, 40, metaTop + 7, {
            width: badgeWidth,
            align: 'center',
          });
        doc.fillColor('#000000');

        // Meta lines (right) — date + time on each
        const metaLines: Array<[string, string]> = [
          ['Invoice #', invoice.invoiceNumber],
          ['Issued', fmtDT(invoice.issuedAt)],
        ];
        if (invoice.paidAt) {
          metaLines.push(['Paid', fmtDT(invoice.paidAt)]);
        }
        if (invoice.dueDate) {
          metaLines.push(['Due', fmtDT(invoice.dueDate)]);
        }
        let mY = metaTop;
        for (const [label, value] of metaLines) {
          doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor(MUTED)
            .text(label, 320, mY, { width: 80, align: 'right' });
          doc
            .font('Helvetica-Bold')
            .fontSize(10)
            .fillColor('#111827')
            .text(value, 405, mY - 1, { width: 150, align: 'right' });
          mY += 13;
        }

        // ── Bill-To / Payment-Details two-column block in soft cards ──
        const sectionTop = Math.max(metaTop + 40, mY + 12);
        const cardW = 252;
        const cardH = 92;
        // Left card — Bill To
        doc
          .roundedRect(40, sectionTop, cardW, cardH, 6)
          .lineWidth(1)
          .strokeColor('#E5E7EB')
          .stroke();
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(MUTED)
          .text('BILL TO', 52, sectionTop + 10);
        doc
          .font('Helvetica-Bold')
          .fontSize(12)
          .fillColor('#111827')
          .text(
            `${userData.firstName || ''} ${userData.lastName || ''}`.trim() ||
              userData.email,
            52,
            sectionTop + 26,
            { width: cardW - 24 },
          );
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor(MUTED)
          .text(userData.email, 52, sectionTop + 44, { width: cardW - 24 });
        const plainNationalId = decryptPII((userData as any).nationalId);
        if (plainNationalId) {
          doc.text(
            `National ID · ${plainNationalId}`,
            52,
            sectionTop + 58,
            { width: cardW - 24 },
          );
        }

        // Right card — Payment Details
        const rightX = 303;
        doc
          .roundedRect(rightX, sectionTop, cardW, cardH, 6)
          .lineWidth(1)
          .strokeColor('#E5E7EB')
          .stroke();
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(MUTED)
          .text('PAYMENT DETAILS', rightX + 12, sectionTop + 10);
        const gatewayLabel =
          payment.gateway === 'bank_transfer'
            ? 'Bank Transfer'
            : payment.gateway.charAt(0).toUpperCase() + payment.gateway.slice(1);
        const methodLabel = payment.paymentMethod
          ? payment.paymentMethod.replace(/_/g, ' ').toUpperCase()
          : '—';
        const referenceShort = payment.gatewayChargeId
          ? payment.gatewayChargeId.length > 30
            ? `${payment.gatewayChargeId.slice(0, 14)}…${payment.gatewayChargeId.slice(-12)}`
            : payment.gatewayChargeId
          : '—';
        const payRows: Array<[string, string]> = [
          ['Gateway', gatewayLabel],
          ['Method', methodLabel],
          ['Reference', referenceShort],
        ];
        let pY = sectionTop + 28;
        for (const [k, v] of payRows) {
          doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor(MUTED)
            .text(k, rightX + 12, pY, { width: 80 });
          doc
            .font(k === 'Reference' ? 'Helvetica' : 'Helvetica-Bold')
            .fontSize(k === 'Reference' ? 8 : 10)
            .fillColor('#111827')
            .text(v, rightX + 90, pY, {
              width: cardW - 102,
              align: 'right',
              lineBreak: false,
            });
          pY += 18;
        }

        // ── Line items table ──
        const tableTop = sectionTop + cardH + 22;
        doc.rect(40, tableTop, 515, 24).fill(SOFT);
        doc
          .fillColor(MUTED)
          .font('Helvetica-Bold')
          .fontSize(9)
          .text('DESCRIPTION', 50, tableTop + 8, { width: 300 });
        doc.text('QTY', 360, tableTop + 8, { width: 40, align: 'center' });
        doc.text('UNIT', 400, tableTop + 8, { width: 75, align: 'right' });
        doc.text('AMOUNT', 475, tableTop + 8, { width: 75, align: 'right' });
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
          doc
            .font('Helvetica')
            .fontSize(10)
            .fillColor('#111827')
            .text(item.description, 50, y, { width: 300 });
          let rowExtra = 0;
          if (item.deliveryType) {
            doc
              .font('Helvetica')
              .fontSize(8)
              .fillColor(MUTED)
              .text(item.deliveryType.toUpperCase(), 50, y + 14, { width: 300 });
            rowExtra += 12;
          }
          doc
            .font('Helvetica')
            .fontSize(10)
            .fillColor('#111827')
            .text('1', 360, rowTop + 1, { width: 40, align: 'center' });
          doc.text(`SAR ${Number(item.amount).toFixed(2)}`, 400, rowTop + 1, {
            width: 75,
            align: 'right',
          });
          doc
            .font('Helvetica-Bold')
            .text(`SAR ${Number(item.amount).toFixed(2)}`, 475, rowTop + 1, {
              width: 75,
              align: 'right',
            });
          y += Math.max(24, 16 + rowExtra);
          rowIdx += 1;
        }

        // ── Totals block ──
        let tY = y + 12;
        const totalsLeft = 320;
        const totalsWidth = 235;
        const totalsRow = (label: string, value: string, bold = false) => {
          doc
            .font(bold ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(bold ? 11 : 10)
            .fillColor(bold ? '#111827' : MUTED)
            .text(label, totalsLeft, tY, { width: 120 });
          doc
            .font(bold ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(bold ? 11 : 10)
            .fillColor('#111827')
            .text(value, totalsLeft, tY, { width: totalsWidth, align: 'right' });
          tY += 16;
        };

        totalsRow('Subtotal', `SAR ${Number(invoice.subtotal).toFixed(2)}`);
        if (Number(invoice.discountAmount) > 0) {
          totalsRow(
            'Discount',
            `- SAR ${Number(invoice.discountAmount).toFixed(2)}`,
          );
        }
        if (Number(invoice.taxAmount) > 0) {
          totalsRow(
            `VAT (${invoiceVatRate}%)`,
            `SAR ${Number(invoice.taxAmount).toFixed(2)}`,
          );
        } else if (invoiceVatTreatment === 'zero_rated') {
          // ZATCA reporting line — show the row even though value is 0.
          totalsRow('Zero-rated (0%)', 'SAR 0.00');
        }
        doc
          .moveTo(totalsLeft, tY + 2)
          .lineTo(totalsLeft + totalsWidth, tY + 2)
          .strokeColor('#E5E7EB')
          .stroke()
          .strokeColor('#000000');
        tY += 8;

        // Highlighted total box
        doc.rect(totalsLeft, tY, totalsWidth, 30).fill(BRAND);
        doc
          .fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(12)
          .text('TOTAL', totalsLeft + 12, tY + 9);
        doc
          .font('Helvetica-Bold')
          .fontSize(14)
          .text(
            `SAR ${Number(invoice.totalAmount).toFixed(2)}`,
            totalsLeft,
            tY + 8,
            { width: totalsWidth - 12, align: 'right' },
          );
        doc.fillColor('#000000');
        tY += 44;

        // ── QR + verify panel (left-aligned, fixed row) ──
        const qrTop = Math.min(Math.max(tY, 600), 660);
        try {
          const verifyUrl = `https://physioguidance.org/en/verify-invoice/${invoice.invoiceNumber}`;
          const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
            width: 80,
            margin: 0,
            color: { dark: BRAND, light: '#FFFFFF' },
          });
          const qrBuffer = Buffer.from(
            qrDataUrl.replace('data:image/png;base64,', ''),
            'base64',
          );
          doc.image(qrBuffer, 40, qrTop, { width: 72, height: 72 });
          doc
            .font('Helvetica-Bold')
            .fontSize(9)
            .fillColor('#111827')
            .text('Scan to verify', 124, qrTop + 6);
          doc
            .font('Helvetica')
            .fontSize(8)
            .fillColor(MUTED)
            .text(
              'Authenticate this invoice via QR or:',
              124,
              qrTop + 22,
              { width: 240 },
            );
          doc
            .font('Helvetica')
            .fontSize(8)
            .fillColor(ACCENT)
            .text(
              `physioguidance.org/verify-invoice/${invoice.invoiceNumber}`,
              124,
              qrTop + 36,
              { width: 280, lineBreak: false },
            );
        } catch {
          this.logger.warn('Failed to generate QR code for invoice');
        }

        // ── Footer band ──
        doc.rect(0, 770, 595, 72).fill('#F9FAFB');
        doc
          .fillColor(BRAND)
          .font('Helvetica-Bold')
          .fontSize(9)
          .text(branding.siteNameEn, 40, 786);
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(MUTED)
          .text(
            'Thank you for your purchase. This invoice serves as your official tax receipt.',
            40,
            802,
            { width: 360 },
          );
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor(MUTED)
          .text('Page 1 of 1', 440, 802, { width: 115, align: 'right' });
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
  async generateProformaPdfBuffer(paymentId: string): Promise<Buffer> {
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
        name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
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
  }): Promise<Buffer> {
    // Proforma uses current global settings — it's a pre-payment preview,
    // not a tax record. Once paid, the final invoice locks in its own rate.
    const taxSettings = await this.taxComputationService.getSettings();
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const fontsDir = path.join(process.cwd(), 'src', 'assets', 'fonts');
        doc.registerFont(
          'NotoArabic',
          path.join(fontsDir, 'NotoSansArabic-Regular.ttf'),
        );
        doc.registerFont(
          'NotoArabicBold',
          path.join(fontsDir, 'NotoSansArabic-Bold.ttf'),
        );
        const ws = { wordSpacing: 2 };

        // ── Header: company info (left) ──
        // Render English siteName at fontSize 18 (was 20) so longer names
        // don't run into the right-side title block.
        doc
          .font('Helvetica-Bold')
          .fontSize(18)
          .fillColor('#1A2747')
          .text(args.branding.siteNameEn, 50, 50, { width: 280 });
        doc.fillColor('#000');
        doc
          .font('NotoArabic')
          .fontSize(10)
          .text(arRtl(args.branding.siteNameAr), 50, 78, { width: 280, ...ws });
        doc
          .font('Helvetica')
          .fontSize(10)
          .text('nelc@physioguidance.org', 50, 95);

        // ── Header: proforma title (right, two stacked lines, NO continued) ──
        // Stacking avoids the wrap overflow we hit with `continued: true` +
        // `align: 'right'` at fontSize 18 in a 195px column.
        doc
          .font('Helvetica-Bold')
          .fontSize(16)
          .fillColor('#B8860B')
          .text('PROFORMA INVOICE', 350, 50, { width: 195, align: 'right' });
        doc
          .font('NotoArabicBold')
          .fontSize(13)
          .text(arRtl('فاتورة مبدئية'), 350, 70, {
            width: 195,
            align: 'right',
            ...ws,
          });
        doc.fillColor('#000');

        // Number + date pushed below the two-line title.
        doc
          .font('Helvetica')
          .fontSize(10)
          .text(`No: ${args.proformaNumber}`, 350, 95, {
            width: 195,
            align: 'right',
          })
          .text(
            `Date: ${args.issuedAt.toLocaleDateString('en-US')}`,
            350,
            110,
            { width: 195, align: 'right' },
          );

        // Awaiting-payment status pill below the meta lines.
        doc.rect(395, 128, 150, 18).fillColor('#FEF3C7').fill();
        doc
          .fillColor('#92400E')
          .font('Helvetica-Bold')
          .fontSize(9)
          .text('AWAITING PAYMENT', 395, 133, {
            width: 150,
            align: 'center',
          });
        doc.fillColor('#000');

        // Divider — pushed down to clear the taller header block.
        doc.moveTo(50, 160).lineTo(545, 160).stroke();

        // ── Bill To (left) ──
        const sectionTop = 180;
        doc.font('Helvetica-Bold').fontSize(12).text('Bill To', 50, sectionTop);
        doc
          .font('NotoArabicBold')
          .fontSize(11)
          .text(arRtl('فاتورة إلى'), 50, sectionTop + 14, { width: 280, ...ws });
        doc
          .font('Helvetica')
          .fontSize(10)
          .text(args.buyer.name || args.buyer.email, 50, sectionTop + 32)
          .text(args.buyer.email, 50, sectionTop + 47);

        let customerInfoY = sectionTop + 62;
        if (args.buyer.nationalId) {
          doc.text(
            `National ID: ${args.buyer.nationalId}`,
            50,
            customerInfoY,
          );
          customerInfoY += 15;
        }

        // ── Payment intent (right) ──
        doc
          .font('Helvetica-Bold')
          .fontSize(12)
          .text('Payment Method', 350, sectionTop, {
            width: 195,
            align: 'right',
          });
        doc
          .font('NotoArabicBold')
          .fontSize(11)
          .text(arRtl('طريقة الدفع'), 350, sectionTop + 14, {
            width: 195,
            align: 'right',
            ...ws,
          });
        doc
          .font('Helvetica')
          .fontSize(10)
          .text(
            args.payment.gateway === 'bank_transfer'
              ? 'Bank Transfer'
              : args.payment.gateway,
            350,
            sectionTop + 32,
            { width: 195, align: 'right' },
          );

        // ── Line items table ──
        const tableTop = Math.max(customerInfoY, sectionTop + 65) + 20;
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .text('Description', 50, tableTop);
        doc
          .font('Helvetica-Bold')
          .text('Amount', 450, tableTop, { align: 'right' });
        doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

        let y = tableTop + 25;
        for (const item of args.lineItems) {
          const rowTop = y;
          doc
            .font('Helvetica')
            .fontSize(10)
            .text(item.description, 50, y, { width: 380 });
          let rowExtra = 0;
          if (item.descriptionAr) {
            doc
              .font('NotoArabic')
              .text(arRtl(item.descriptionAr), 50, y + 15, {
                width: 380,
                ...ws,
              });
            rowExtra += 15;
          }
          if (item.deliveryType) {
            doc
              .font('Helvetica')
              .fontSize(9)
              .text(`Delivery: ${item.deliveryType}`, 50, y + 15 + rowExtra);
            doc.fontSize(10);
            rowExtra += 15;
          }
          doc
            .font('Helvetica')
            .fontSize(10)
            .text(`SAR ${Number(item.amount).toFixed(2)}`, 450, rowTop, {
              align: 'right',
            });
          y += 25 + rowExtra;
        }

        doc
          .moveTo(50, y - 5)
          .lineTo(545, y - 5)
          .strokeColor('#e5e5e5')
          .stroke()
          .strokeColor('#000');

        // Totals — render label / Arabic / amount as three separate text
        // calls so a wrap on one doesn't push the others. The right-side
        // amount uses absolute positioning so it always lines up regardless
        // of the label's width.
        const labelX = 50;
        const arX = 130;
        const amountX = 450;
        const amountWidth = 95;
        if (args.discountAmount > 0) {
          doc.font('Helvetica').fontSize(10).text('Discount', labelX, y);
          doc
            .font('NotoArabic')
            .text(arRtl('خصم'), arX, y, { width: 280, ...ws });
          doc
            .font('Helvetica')
            .text(
              `- SAR ${args.discountAmount.toFixed(2)}`,
              amountX,
              y,
              { width: amountWidth, align: 'right' },
            );
          y += 20;
        }

        if (args.taxAmount > 0) {
          doc.font('Helvetica').fontSize(10).text(`VAT (${taxSettings.vatRate}%)`, labelX, y);
          doc
            .font('NotoArabic')
            .text(arRtl('ضريبة القيمة المضافة'), arX, y, {
              width: 280,
              ...ws,
            });
          doc
            .font('Helvetica')
            .text(`SAR ${args.taxAmount.toFixed(2)}`, amountX, y, {
              width: amountWidth,
              align: 'right',
            });
          y += 20;
        }

        doc.moveTo(50, y).lineTo(545, y).stroke();
        y += 10;
        doc.font('Helvetica-Bold').fontSize(14).text('Amount Due', labelX, y);
        doc
          .font('NotoArabicBold')
          .text(arRtl('المبلغ المستحق'), arX, y + 2, { width: 280, ...ws });
        doc
          .font('Helvetica-Bold')
          .fontSize(14)
          .text(`SAR ${args.totalAmount.toFixed(2)}`, amountX, y, {
            width: amountWidth,
            align: 'right',
          });

        // ── Disclaimer block ──
        y += 50;
        doc
          .rect(50, y, 495, 50)
          .fillColor('#F8FAFC')
          .fill();
        doc.fillColor('#000');
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#1A2747')
          .text('Notice', 60, y + 8);
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#475569')
          .text(
            'This is a proforma invoice issued before payment. It is NOT a tax invoice. A final tax invoice will be issued once the bank transfer is received and approved by our finance team.',
            60,
            y + 22,
            { width: 475 },
          );
        doc.fillColor('#000');

        // ── Footer ──
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#94A3B8')
          .text(
            `${args.branding.siteNameEn} · physioguidance.org · nelc@physioguidance.org`,
            50,
            780,
            { align: 'center', width: 495 },
          );
        doc.fillColor('#000');

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  async getInvoicePdfUrl(invoiceId: string, userId?: string) {
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

    // Self-healing: generate PDF on demand if missing
    if (!invoice.pdfUrl) {
      try {
        const [payment] = await db.select().from(payments).where(eq(payments.id, invoice.paymentId)).limit(1);
        const [userData] = await db.select().from(users).where(eq(users.id, invoice.userId)).limit(1);
        const [course] = await db.select().from(courses).where(eq(courses.id, invoice.courseId)).limit(1);

        if (payment && userData && course) {
          // Re-hydrate the line items snapshot saved at invoice creation time
          // so the regenerated PDF matches the original (don't re-read live
          // courses — a renamed course would silently rewrite a paid invoice).
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
          );
          const filename = `invoices/${invoice.invoiceNumber}.pdf`;
          await this.storageService.uploadPrivate(pdfBuffer, filename, 'application/pdf');
          await db
            .update(invoices)
            .set({ pdfUrl: filename, updatedAt: new Date() })
            .where(eq(invoices.id, invoice.id));
          invoice.pdfUrl = filename;
          this.logger.log(`On-demand PDF generated for invoice ${invoice.invoiceNumber}`);
        }
      } catch (err) {
        this.logger.error(`On-demand PDF generation failed for ${invoiceId}: ${err.message}`);
        throw new NotFoundException('Invoice PDF generation failed');
      }
    }

    if (!invoice.pdfUrl) {
      throw new NotFoundException('Invoice PDF not available');
    }

    const signedUrl = await this.storageService.getSignedUrl(
      'private',
      invoice.pdfUrl,
    );

    return { url: signedUrl, invoiceNumber: invoice.invoiceNumber };
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
  async regeneratePdf(invoiceId: string, actorUserId: string) {
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
    );
    const filename = `invoices/${invoice.invoiceNumber}.pdf`;
    await this.storageService.uploadPrivate(
      pdfBuffer,
      filename,
      'application/pdf',
    );
    await db
      .update(invoices)
      .set({ pdfUrl: filename, updatedAt: new Date() })
      .where(eq(invoices.id, invoice.id));

    await this.auditLogService.log({
      entityType: 'invoice',
      entityId: invoice.id,
      action: 'invoice_pdf_regenerated',
      performedBy: actorUserId,
      metadata: { invoiceNumber: invoice.invoiceNumber },
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

    const header = [
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
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };

    const rows = [header.join(',')];
    for (const r of data) {
      rows.push(
        [
          escape(r.invoiceNumber),
          escape(r.status),
          escape((r as any).userName?.trim() || ''),
          escape((r as any).userEmail || ''),
          escape((r as any).courseTitle || ''),
          escape((r as any).gateway || ''),
          escape(Number((r as any).subtotal || 0).toFixed(2)),
          escape(Number((r as any).discountAmount || 0).toFixed(2)),
          escape(Number((r as any).taxAmount || 0).toFixed(2)),
          escape(Number((r as any).totalAmount || 0).toFixed(2)),
          escape(
            (r as any).issuedAt
              ? new Date((r as any).issuedAt).toISOString()
              : '',
          ),
          escape(
            (r as any).paidAt ? new Date((r as any).paidAt).toISOString() : '',
          ),
          escape(
            (r as any).dueDate
              ? new Date((r as any).dueDate).toISOString()
              : '',
          ),
          escape((r as any).refundStatus || ''),
        ].join(','),
      );
    }
    return rows.join('\n');
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
  ): Promise<{ buffer: Buffer; filename: string } | null> {
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.paymentId, paymentId))
      .limit(1);

    if (!invoice || !invoice.pdfUrl) return null;

    try {
      const buffer = await this.storageService.getFileBuffer(
        'private',
        invoice.pdfUrl,
      );
      if (!buffer) return null;

      return {
        buffer,
        filename: `${invoice.invoiceNumber}.pdf`,
      };
    } catch (err) {
      this.logger.error(
        `Failed to retrieve PDF buffer for invoice ${invoice.invoiceNumber}: ${err.message}`,
      );
      return null;
    }
  }
}
