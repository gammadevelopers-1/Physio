/**
 * Local smoke test for the invoice PDF renderer.
 *
 * Instantiates InvoiceService with just enough mocks to reach generatePdf(),
 * then writes an English + Arabic sample invoice to ~/Desktop so we can
 * visually verify the AR layout fix before deploying.
 *
 * Run:  npx tsx scripts/smoke-invoice-pdf.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { InvoiceService } from '../src/modules/payments/services/invoice.service';

async function main() {
  // Minimal mocks — generatePdf only touches taxComputationService.getSettings()
  // and the branding arg. Nothing else is dereferenced on `this` inside the
  // render path.
  const svc = new InvoiceService(
    {} as any, // storageService
    {} as any, // auditLogService
    {} as any, // siteSettings
    {
      getSettings: async () => ({
        vatRate: 3,
        taxNumber: '310000000000003',
        companyName: 'PhysioGuidance',
      }),
    } as any,
  );

  const invoice = {
    id: 'inv-uuid',
    invoiceNumber: 'INV-2026-99999',
    paymentId: 'pay-uuid',
    userId: 'user-uuid',
    courseId: 'course-uuid',
    subtotal: '200.00',
    discountAmount: '0.00',
    taxAmount: '6.00',
    totalAmount: '206.00',
    status: 'paid',
    issuedAt: new Date('2026-07-20T17:13:00Z'),
    paidAt: new Date('2026-07-20T17:13:00Z'),
    dueDate: null,
    pdfUrl: null,
    metadata: null,
  };

  const payment = {
    id: 'pay-uuid',
    gateway: 'moyasar',
    paymentMethod: 'card',
    gatewayChargeId: '74baa167-71bc-4c8f-a3b1-1542f9314b31',
    metadata: { taxRate: 3, vatTreatment: 'standard' },
  };

  const userData = {
    email: 'mianabubaka007@gmail.com',
    firstName: 'محمد',
    lastName: 'أبو بكر',
    nationalId: null,
  };

  const course = {
    id: 'course-uuid',
    title: 'test course TA',
    titleAr: null,
    deliveryType: 'webinar',
  };

  const lineItems = [
    {
      description: 'test course TA',
      descriptionAr: null,
      deliveryType: 'webinar',
      amount: 200,
    },
  ];

  const branding = {
    siteNameEn: 'PhysioGuidance',
    siteNameAr: 'فيزيو جايدنس',
    logoUrl: null,
    siteEmail: null,
  } as any;

  const desktop = path.join(os.homedir(), 'Desktop');

  for (const locale of ['en', 'ar'] as const) {
    const buf: Buffer = await (svc as any).generatePdf(
      invoice,
      payment,
      userData,
      course,
      lineItems,
      branding,
      locale,
    );
    const out = path.join(desktop, `smoke-invoice-${locale}.pdf`);
    fs.writeFileSync(out, buf);
    console.log(`wrote ${out} (${buf.length} bytes)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
