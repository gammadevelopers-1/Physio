/**
 * Handover sample-PDF generator. Runs standalone (no NestJS bootstrap,
 * no DB) and produces six PDFs — invoice EN/AR + proforma EN/AR +
 * certificate EN/AR — using the SAME renderer methods the production
 * code uses.
 *
 * Why standalone: the samples are for the handover pack under
 * PhysioGuidance-Handover/04-missing-deliverables/design-assets/. They
 * need to show what the platform actually generates. Rather than
 * bootstrap the full app (needing DB + Redis + Strapi), this script
 * instantiates just the InvoiceService + CertificatesService with mocked
 * peripheral dependencies and pre-populates the tax/branding caches with
 * current production values. The PDF layout code is untouched — samples
 * are pixel-identical to what a real paid transaction produces.
 *
 * Run:
 *   npm run build && node dist/src/main-samples.js
 * or:
 *   npx ts-node src/main-samples.ts
 *
 * Output: writes six PDFs to $OUTPUT_DIR (default ./samples-output).
 */

import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import { InvoiceService } from './modules/payments/services/invoice.service';
import { CertificatesService } from './modules/certificates/certificates.service';
import { SiteSettingsService } from './modules/site-settings/site-settings.service';
import { TaxComputationService } from './modules/payments/services/tax-computation.service';

const SAMPLE = {
  buyerNameEn: 'Sample Student',
  buyerNameAr: 'طالب نموذجي',
  buyerEmail: 'sample.student@example.com',
  nationalId: '1000000008',
  courseTitleEn: 'Introduction to Physiotherapy (SAMPLE)',
  courseTitleAr: 'مقدمة في العلاج الطبيعي (نموذج)',
  courseId1: 'sample-course-uuid-000000000001',
  courseId2: 'sample-course-uuid-000000000002',
  lineItems: [
    {
      description: 'Introduction to Physiotherapy (SAMPLE)',
      descriptionAr: 'مقدمة في العلاج الطبيعي (نموذج)',
      deliveryType: 'zoom',
      amount: 500,
    },
    {
      description: 'Advanced Manual Therapy Techniques (SAMPLE)',
      descriptionAr: 'تقنيات العلاج اليدوي المتقدمة (نموذج)',
      deliveryType: 'self_paced',
      amount: 750,
    },
  ],
  subtotal: 1250,
  vatAmount: 187.5,
  total: 1437.5,
};

function log(msg: string) {
  console.log(`[samples] ${msg}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockStorageService: any = {
  uploadObject: async () => 'sample-key',
  getSignedUrl: async () => 'https://example.com/sample',
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAuditLogService: any = {
  log: async () => undefined,
  create: async () => undefined,
};

async function buildSiteSettings(): Promise<SiteSettingsService> {
  const svc = new SiteSettingsService();
  // Force fallback branding — no Strapi call attempted.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (svc as any).cache = {
    value: {
      siteNameEn: 'PhysioGuidance',
      siteNameAr: 'فيزيوقايدنس',
      vatNumber: '312345678900003',
      commercialRegistrationNumber: '1010101010',
      nelcLicenseNumber: 'NELC-SAMPLE',
      nelcLicenseText: 'Licensed by the National eLearning Center',
    },
    expiresAt: Date.now() + 60 * 60 * 1000,
  };
  return svc;
}

function buildTaxService(): TaxComputationService {
  const svc = new TaxComputationService(mockAuditLogService);
  // Pre-populate cache so getSettings() doesn't hit the DB.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (svc as any).cached = {
    settings: {
      vatEnabled: true,
      vatRate: 15,
      taxNumber: '312345678900003',
      companyNameEn: 'PhysioGuidance',
      companyNameAr: 'فيزيوقايدنس',
      defaultVatTreatment: 'standard',
    },
    expiresAt: Date.now() + 60 * 60 * 1000,
  };
  return svc;
}

async function main() {
  const outDir = process.env.OUTPUT_DIR || path.join(process.cwd(), 'samples-output');
  await fs.promises.mkdir(outDir, { recursive: true });
  log(`output dir: ${outDir}`);

  const siteSettings = await buildSiteSettings();
  const taxService = buildTaxService();
  const invoiceService = new InvoiceService(
    mockStorageService,
    mockAuditLogService,
    siteSettings,
    taxService,
  );

  // CertificatesService has many DI deps — most aren't used by the
  // private renderCertificatePdfBuffer method. We only need the render
  // method itself, so we build the class with any-cast and call the
  // renderer directly (it takes all data via args).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const certService: any = Object.create(CertificatesService.prototype);
  // no constructor deps needed — the render method uses only its args.

  // ─── Proforma ─────────────────────────────────────────────────────
  for (const locale of ['en', 'ar'] as const) {
    const { buffer } = await invoiceService.generateProformaPdfFromQuote({
      buyer: {
        name: locale === 'ar' ? SAMPLE.buyerNameAr : SAMPLE.buyerNameEn,
        email: SAMPLE.buyerEmail,
        nationalId: SAMPLE.nationalId,
      },
      courseIds: [SAMPLE.courseId1, SAMPLE.courseId2],
      lineItems: SAMPLE.lineItems,
      subtotal: SAMPLE.subtotal,
      discountAmount: 0,
      taxAmount: SAMPLE.vatAmount,
      totalAmount: SAMPLE.total,
      locale,
    });
    const out = path.join(outDir, `sample-proforma-${locale}.pdf`);
    await fs.promises.writeFile(out, buffer);
    log(`wrote sample-proforma-${locale}.pdf (${(buffer.length / 1024).toFixed(1)} KB)`);
  }

  // ─── Invoice ──────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoiceAny = invoiceService as any;
  const branding = await siteSettings.getBranding();

  for (const locale of ['en', 'ar'] as const) {
    const sampleInvoice = {
      id: 'sample-invoice-uuid',
      invoiceNumber: 'INV-2026-99999',
      subtotal: '1250.00',
      taxAmount: '187.50',
      totalAmount: '1437.50',
      currency: 'SAR',
      buyerName: locale === 'ar' ? SAMPLE.buyerNameAr : SAMPLE.buyerNameEn,
      buyerEmail: SAMPLE.buyerEmail,
      courseTitle: SAMPLE.courseTitleEn,
      courseTitleAr: SAMPLE.courseTitleAr,
      issuedAt: new Date(),
      paidAt: new Date(),
      gateway: 'moyasar',
      paymentMethod: 'mada',
      itemCount: SAMPLE.lineItems.length,
    };
    const samplePayment = {
      id: 'sample-payment-uuid',
      gateway: 'moyasar',
      paymentMethod: 'mada',
      amount: '1437.50',
      currency: 'SAR',
      status: 'PAID',
      metadata: { taxRate: 15, vatTreatment: 'standard' },
    };
    const sampleUserData = {
      firstName: locale === 'ar' ? 'طالب' : 'Sample',
      lastName: locale === 'ar' ? 'نموذجي' : 'Student',
      email: SAMPLE.buyerEmail,
    };
    const sampleCourse = {
      title: SAMPLE.courseTitleEn,
      titleAr: SAMPLE.courseTitleAr,
    };
    const buffer: Buffer = await invoiceAny.generatePdf(
      sampleInvoice,
      samplePayment,
      sampleUserData,
      sampleCourse,
      SAMPLE.lineItems,
      branding,
      locale,
    );
    const out = path.join(outDir, `sample-invoice-${locale}.pdf`);
    await fs.promises.writeFile(out, buffer);
    log(`wrote sample-invoice-${locale}.pdf (${(buffer.length / 1024).toFixed(1)} KB)`);
  }

  // ─── Certificate ──────────────────────────────────────────────────
  const frontendUrl = process.env.FRONTEND_URL || 'https://physioguidance.org';
  const sampleVerifyUrl = `${frontendUrl}/en/verify/PG-SAMPLE0`;
  const qrBuffer = await QRCode.toBuffer(sampleVerifyUrl, {
    width: 140,
    margin: 1,
    errorCorrectionLevel: 'M',
  });

  const tryFetch = (url: string): Promise<Buffer> =>
    new Promise((res, rej) => {
      const https = require('https');
      https
        .get(url, (r: NodeJS.ReadableStream & { on: any }) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => res(Buffer.concat(chunks)));
          r.on('error', rej);
        })
        .on('error', rej);
    });

  let logoBuffer: Buffer | null = null;
  try {
    logoBuffer = await tryFetch(`${frontendUrl}/logo-certificate.jpeg`);
    log(`fetched cert logo (${(logoBuffer.length / 1024).toFixed(1)} KB)`);
  } catch {
    try {
      logoBuffer = await tryFetch(`${frontendUrl}/images/logo.png`);
      log(`fetched fallback logo (${(logoBuffer.length / 1024).toFixed(1)} KB)`);
    } catch {
      log('WARN: no logo available (both cert + fallback logo fetch failed)');
    }
  }

  let secondaryLogoSvg: string | null = null;
  try {
    const buf = await tryFetch(`${frontendUrl}/saudi-health.svg`);
    secondaryLogoSvg = buf.toString('utf8');
    log('fetched Saudi Health secondary logo');
  } catch {
    log('note: no Saudi Health secondary logo (optional)');
  }

  const { AMIRI_BOLD_BASE64 } = require('./modules/certificates/amiri-bold-font');
  const arabicFontBuf = Buffer.from(AMIRI_BOLD_BASE64, 'base64');

  const hasArabicChars = (s: string | null | undefined) =>
    !!s && /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(s);

  for (const lang of ['en', 'ar'] as const) {
    const displayName =
      lang === 'ar' ? SAMPLE.buyerNameAr : SAMPLE.buyerNameEn;
    const courseTitle =
      lang === 'ar' ? SAMPLE.courseTitleAr : SAMPLE.courseTitleEn;

    const L =
      lang === 'ar'
        ? {
            title: 'شهادة',
            subtitle: 'حضور',
            awardedTo: 'ممنوحة بكل فخر إلى',
            forAttending: 'لحضور',
            accreditedBy:
              'هذا النشاط معتمد من الهيئة السعودية للتخصصات الصحية',
            numberDate: (n: string, d: string) =>
              `رقم الاعتماد ${n}   التاريخ: ${d}`,
            courseAccreditation: (n: string) => `اعتماد الدورة: ${n}`,
            cmeHours: (h: number) => `${h} ساعات معتمدة CME/PD`,
            cmeBadge: 'ساعات معتمدة',
            scanToVerify: 'امسح للتحقق',
          }
        : {
            title: 'CERTIFICATE',
            subtitle: 'OF ATTENDANCE',
            awardedTo: 'PROUDLY AWARDED TO',
            forAttending: 'FOR ATTENDING',
            accreditedBy:
              'This activity has been accredited by the Saudi Commission for Health Specialties',
            numberDate: (n: string, d: string) =>
              `with accreditation number ${n}   Date: ${d}`,
            courseAccreditation: (n: string) => `Course Accreditation: ${n}`,
            cmeHours: (h: number) => `${h} CME/PD Credit Hours`,
            cmeBadge: 'CME HOURS',
            scanToVerify: 'Scan to verify',
          };

    const buffer: Buffer = await certService.renderCertificatePdfBuffer({
      displayName,
      courseTitle,
      cmeHours: 10,
      regNumber: 'SAMPLE-2026',
      dateFormatted: lang === 'ar' ? '١٧ أغسطس ٢٠٢٦' : '17 AUGUST 2026',
      accreditationDate: lang === 'ar' ? '١٧ أغسطس ٢٠٢٦' : '17 AUGUST 2026',
      courseAccreditationNumber: 'CRS001-SAMPLE',
      logoBuffer,
      secondaryLogoSvg,
      qrBuffer,
      arabicFontBuf,
      lang,
      L,
      hasArabicChars,
    });
    const out = path.join(outDir, `sample-certificate-${lang}.pdf`);
    await fs.promises.writeFile(out, buffer);
    log(`wrote sample-certificate-${lang}.pdf (${(buffer.length / 1024).toFixed(1)} KB)`);
  }

  log('\nAll six samples generated. Copy from $OUTPUT_DIR to the handover folder.');
}

main().catch((err) => {
  console.error('[samples] FATAL:', err);
  process.exit(1);
});
