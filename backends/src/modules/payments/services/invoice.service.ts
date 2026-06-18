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
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import * as path from 'path';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async generateInvoice(paymentId: string) {
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
        nationalId: (userData as any).nationalId || null,
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
      const pdfBuffer = await this.generatePdf(
        invoice,
        payment,
        userData,
        primaryCourse,
        lineItemsSnapshot,
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
    lineItems?: Array<{
      description: string;
      descriptionAr: string | null;
      deliveryType: string | null;
      amount: number;
    }>,
  ): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Register Arabic-supporting fonts
        // fontkit (PDFKit's font engine) handles Arabic GSUB shaping natively
        const fontsDir = path.join(process.cwd(), 'src', 'assets', 'fonts');
        doc.registerFont('NotoArabic', path.join(fontsDir, 'NotoSansArabic-Regular.ttf'));
        doc.registerFont('NotoArabicBold', path.join(fontsDir, 'NotoSansArabic-Bold.ttf'));

        // wordSpacing fixes collapsed spaces between Arabic words in PDFKit
        const ws = { wordSpacing: 2 };

        // ── Header: left side (company info) ──
        doc.font('Helvetica-Bold').fontSize(20)
          .text('Roya Almustaqbal for Health Training', 50, 50);
        doc.font('NotoArabic').fontSize(10)
          .text('رؤيا المستقبل للتدريب الصحي', 50, 78, ws);
        doc.font('Helvetica').fontSize(10)
          .text('nelc@physioguidance.org', 50, 95);

        // ── Header: right side (invoice title + meta) ──
        doc.font('Helvetica-Bold').fontSize(18)
          .text('INVOICE / ', 350, 50, { continued: true, align: 'right' });
        doc.font('NotoArabicBold').text('فاتورة', ws);

        doc.font('Helvetica').fontSize(10)
          .text(`Invoice #: ${invoice.invoiceNumber}`, 350, 78, { align: 'right' })
          .text(`Date: ${new Date(invoice.issuedAt).toLocaleDateString('en-US')}`, 350, 93, { align: 'right' });

        let headerY = 108;
        if (invoice.paidAt) {
          doc.text(`Paid: ${new Date(invoice.paidAt).toLocaleDateString('en-US')}`, 350, headerY, { align: 'right' });
          headerY += 15;
        }
        if (invoice.dueDate) {
          doc.text(`Due: ${new Date(invoice.dueDate).toLocaleDateString('en-US')}`, 350, headerY, { align: 'right' });
          headerY += 15;
        }

        // ── Divider ──
        const dividerY = Math.max(120, headerY + 5);
        doc.moveTo(50, dividerY).lineTo(545, dividerY).stroke();

        // ── Customer info (left) ──
        const sectionTop = dividerY + 20;
        doc.font('Helvetica-Bold').fontSize(12)
          .text('Bill To / ', 50, sectionTop, { continued: true });
        doc.font('NotoArabicBold').text('فاتورة إلى', ws);

        doc.font('Helvetica').fontSize(10)
          .text(`${userData.firstName || ''} ${userData.lastName || ''}`.trim(), 50, sectionTop + 20)
          .text(userData.email, 50, sectionTop + 35);

        let customerInfoY = sectionTop + 50;
        if ((userData as any).nationalId) {
          doc.text(`National ID: ${(userData as any).nationalId}`, 50, customerInfoY);
          customerInfoY += 15;
        }

        // ── Payment info (right) ──
        doc.font('Helvetica-Bold').fontSize(12)
          .text('Payment Details / ', 350, sectionTop, { continued: true, align: 'right' });
        doc.font('NotoArabicBold').text('تفاصيل الدفع', ws);

        doc.font('Helvetica').fontSize(10)
          .text(`Gateway: ${payment.gateway}`, 350, sectionTop + 20, { align: 'right' })
          .text(`Method: ${payment.paymentMethod || 'N/A'}`, 350, sectionTop + 35, { align: 'right' })
          .text(`Transaction: ${payment.gatewayChargeId || 'N/A'}`, 350, sectionTop + 50, { align: 'right' });

        // ── Line items table ──
        const tableTop = Math.max(customerInfoY, sectionTop + 65) + 20;
        doc.fontSize(10).font('Helvetica-Bold').text('Description', 50, tableTop);
        doc.font('Helvetica').text('Amount', 450, tableTop, { align: 'right' });
        doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

        // Render line items. Multi-line carts pass the full list; legacy
        // single-course invoices fall back to a one-row synthesis from
        // the primary course + subtotal.
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

        let y = tableTop + 25;
        for (const item of itemsToRender) {
          const rowTop = y;
          doc.font('Helvetica').fontSize(10).text(item.description, 50, y, { width: 380 });
          let rowExtra = 0;
          if (item.descriptionAr) {
            doc.font('NotoArabic').text(item.descriptionAr, 50, y + 15, ws);
            rowExtra += 15;
          }
          if (item.deliveryType) {
            doc.font('Helvetica').fontSize(9)
              .text(`Delivery: ${item.deliveryType}`, 50, y + 15 + rowExtra);
            doc.fontSize(10);
            rowExtra += 15;
          }
          doc.font('Helvetica').fontSize(10)
            .text(`SAR ${Number(item.amount).toFixed(2)}`, 450, rowTop, { align: 'right' });
          y += 25 + rowExtra;
        }
        // Light divider between items and the totals block.
        doc.moveTo(50, y - 5).lineTo(545, y - 5).strokeColor('#e5e5e5').stroke().strokeColor('#000');

        // Discount
        if (Number(invoice.discountAmount) > 0) {
          doc.font('Helvetica').fontSize(10).text('Discount / ', 50, y, { continued: true });
          doc.font('NotoArabic').text('خصم');
          doc.font('Helvetica').text(`- SAR ${Number(invoice.discountAmount).toFixed(2)}`, 450, y, { align: 'right' });
          y += 20;
        }

        // Tax
        if (Number(invoice.taxAmount) > 0) {
          doc.font('Helvetica').fontSize(10).text('VAT (15%) / ', 50, y, { continued: true });
          doc.font('NotoArabic').text('ضريبة القيمة المضافة', ws);
          doc.font('Helvetica').text(`SAR ${Number(invoice.taxAmount).toFixed(2)}`, 450, y, { align: 'right' });
          y += 20;
        }

        // ── Total ──
        doc.moveTo(50, y).lineTo(545, y).stroke();
        y += 10;
        doc.font('Helvetica-Bold').fontSize(14).text('Total / ', 50, y, { continued: true });
        doc.font('NotoArabicBold').text('المجموع', ws);
        doc.font('Helvetica-Bold').text(`SAR ${Number(invoice.totalAmount).toFixed(2)}`, 450, y, { align: 'right' });

        // ── QR Code ──
        y += 40;
        try {
          const qrDataUrl = await QRCode.toDataURL(
            `https://physioguidance.org/verify-invoice/${invoice.invoiceNumber}`,
            { width: 100 },
          );
          const qrBuffer = Buffer.from(
            qrDataUrl.replace('data:image/png;base64,', ''),
            'base64',
          );
          doc.image(qrBuffer, 230, y, { width: 80, height: 80 });
          y += 90;
          doc.font('Helvetica').fontSize(8)
            .text('Scan to verify invoice', 230, y, { width: 80, align: 'center' });
        } catch (err) {
          this.logger.warn('Failed to generate QR code for invoice');
        }

        // ── Footer ──
        doc.font('Helvetica').fontSize(8)
          .text('Thank you for your purchase! | ', 50, 750, { continued: true, align: 'center', width: 495 });
        doc.font('NotoArabic').text('شكراً لك على الشراء', ws);

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
          const pdfBuffer = await this.generatePdf(
            invoice,
            payment,
            userData,
            course,
            persistedLineItems,
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
  ) {
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    if (status) conditions.push(eq(invoices.status, status as any));
    if (startDate) conditions.push(gte(invoices.issuedAt, new Date(startDate)));
    if (endDate) conditions.push(lte(invoices.issuedAt, new Date(endDate)));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const invoicesList = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
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
      })
      .from(invoices)
      .leftJoin(courses, eq(invoices.courseId, courses.id))
      .leftJoin(users, eq(invoices.userId, users.id))
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
        issuedAt: invoices.issuedAt,
        paidAt: invoices.paidAt,
      })
      .from(invoices)
      .where(eq(invoices.invoiceNumber, invoiceNumber))
      .limit(1);

    return invoice || null;
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
