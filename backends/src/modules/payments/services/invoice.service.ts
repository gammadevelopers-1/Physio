import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import { db } from '../../../database';
import {
  invoices,
  payments,
  courses,
  users,
  INVOICE_STATUS,
  PAYMENT_STATUS,
} from '../../../database/schema';
import { StorageService } from '../../storage/storage.service';
import { AuditLogService } from '../../audit-logs/audit-logs.service';
import * as PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';

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

    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, payment.courseId))
      .limit(1);

    if (!userData || !course) {
      throw new NotFoundException('User or course not found');
    }

    // Generate invoice number: INV-YYYY-XXXXX
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

    // Calculate amounts from payment metadata
    const metadata = payment.metadata as any;
    const subtotal = Number(metadata?.subtotal || payment.amount);
    const discountAmount = Number(metadata?.discountAmount || 0);
    const taxAmount = Number(metadata?.taxAmount || 0);
    const totalAmount = Number(payment.amount);

    // Create invoice record
    const [invoice] = await db
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
      })
      .returning();

    // Generate PDF
    try {
      const pdfBuffer = await this.generatePdf(
        invoice,
        payment,
        userData,
        course,
      );

      // Upload to storage
      const filename = `invoices/${invoiceNumber}.pdf`;
      const url = await this.storageService.uploadPrivate(
        pdfBuffer,
        filename,
        'application/pdf',
      );

      // Update invoice with PDF URL
      await db
        .update(invoices)
        .set({ pdfUrl: filename, updatedAt: new Date() })
        .where(eq(invoices.id, invoice.id));

      this.logger.log(`Invoice ${invoiceNumber} generated for payment ${paymentId}`);
    } catch (err) {
      this.logger.error(
        `Failed to generate PDF for invoice ${invoiceNumber}: ${err.message}`,
      );
    }

    await this.auditLogService.log({
      entityType: 'invoice',
      entityId: invoice.id,
      action: 'invoice_generated',
      performedBy: payment.userId,
      metadata: { invoiceNumber, paymentId, amount: totalAmount },
    });

    return invoice;
  }

  private async generatePdf(
    invoice: any,
    payment: any,
    userData: any,
    course: any,
  ): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc
          .fontSize(24)
          .text('PhysioGuidance', 50, 50)
          .fontSize(10)
          .text('Healthcare eLearning Platform', 50, 80)
          .text('nelc@physioguidance.org', 50, 95);

        // Invoice Title
        doc
          .fontSize(20)
          .text('INVOICE / فاتورة', 350, 50, { align: 'right' })
          .fontSize(10)
          .text(`Invoice #: ${invoice.invoiceNumber}`, 350, 80, {
            align: 'right',
          })
          .text(
            `Date: ${new Date(invoice.issuedAt).toLocaleDateString('en-US')}`,
            350,
            95,
            { align: 'right' },
          );

        // Divider
        doc
          .moveTo(50, 120)
          .lineTo(545, 120)
          .stroke();

        // Customer info
        doc
          .fontSize(12)
          .text('Bill To / فاتورة إلى:', 50, 140)
          .fontSize(10)
          .text(
            `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
            50,
            158,
          )
          .text(userData.email, 50, 173);

        // Payment info
        doc
          .fontSize(12)
          .text('Payment Details / تفاصيل الدفع:', 350, 140, {
            align: 'right',
          })
          .fontSize(10)
          .text(`Gateway: ${payment.gateway}`, 350, 158, { align: 'right' })
          .text(`Method: ${payment.paymentMethod || 'N/A'}`, 350, 173, {
            align: 'right',
          })
          .text(`Transaction: ${payment.gatewayChargeId || 'N/A'}`, 350, 188, {
            align: 'right',
          });

        // Line items table
        const tableTop = 220;
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .text('Description', 50, tableTop)
          .font('Helvetica')
          .text('Amount', 450, tableTop, { align: 'right' });

        doc
          .moveTo(50, tableTop + 15)
          .lineTo(545, tableTop + 15)
          .stroke();

        // Course line item
        let y = tableTop + 25;
        doc.text(course.title || 'Course', 50, y);
        if (course.titleAr) {
          doc.text(course.titleAr, 50, y + 15);
          y += 15;
        }
        doc.text(`SAR ${Number(invoice.subtotal).toFixed(2)}`, 450, tableTop + 25, {
          align: 'right',
        });

        y += 25;

        // Discount
        if (Number(invoice.discountAmount) > 0) {
          doc
            .text('Discount / خصم', 50, y)
            .text(
              `- SAR ${Number(invoice.discountAmount).toFixed(2)}`,
              450,
              y,
              { align: 'right' },
            );
          y += 20;
        }

        // Tax
        if (Number(invoice.taxAmount) > 0) {
          doc
            .text('VAT / ضريبة القيمة المضافة', 50, y)
            .text(`SAR ${Number(invoice.taxAmount).toFixed(2)}`, 450, y, {
              align: 'right',
            });
          y += 20;
        }

        // Total
        doc
          .moveTo(50, y)
          .lineTo(545, y)
          .stroke();

        y += 10;
        doc
          .fontSize(14)
          .text('Total / المجموع', 50, y)
          .text(`SAR ${Number(invoice.totalAmount).toFixed(2)}`, 450, y, {
            align: 'right',
          });

        // QR Code
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
          doc
            .fontSize(8)
            .text('Scan to verify invoice', 230, y, { width: 80, align: 'center' });
        } catch (err) {
          this.logger.warn('Failed to generate QR code for invoice');
        }

        // Footer
        doc
          .fontSize(8)
          .text(
            'Thank you for your purchase! | شكراً لك على الشراء',
            50,
            750,
            { align: 'center', width: 495 },
          );

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
  ) {
    const offset = (page - 1) * limit;

    const invoicesList = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
        totalAmount: invoices.totalAmount,
        status: invoices.status,
        issuedAt: invoices.issuedAt,
        paidAt: invoices.paidAt,
      })
      .from(invoices)
      .leftJoin(courses, eq(invoices.courseId, courses.id))
      .where(eq(invoices.userId, userId))
      .orderBy(desc(invoices.issuedAt))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ count: count() })
      .from(invoices)
      .where(eq(invoices.userId, userId));

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

  async getAllInvoices(page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;

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
      .orderBy(desc(invoices.issuedAt))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await db
      .select({ count: count() })
      .from(invoices);

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
}
