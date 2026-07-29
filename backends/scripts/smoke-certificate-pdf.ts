/**
 * Local smoke test for the certificate PDF renderer.
 *
 * Instantiates CertificatesService with no-op mocks, then calls the private
 * renderCertificatePdfBuffer helper directly via bracket access so we exercise
 * the EXACT same layout code that ships in production. Writes EN + AR samples
 * to ~/Desktop for design approval before deploying.
 *
 * Run:  npx tsx scripts/smoke-certificate-pdf.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as QRCode from 'qrcode';
import { CertificatesService } from '../src/modules/certificates/certificates.service';

async function main() {
  // No dependencies matter for the pure render helper — passing empty
  // stubs satisfies the constructor signature.
  const svc = new CertificatesService(
    {} as any, // storage
    {} as any, // email
    {} as any, // nelc audit
    {} as any, // audit log
    {} as any, // admin settings
    {} as any, // xapi
  );

  // Load the black-background certificate logo the same way the real
  // service will in production (fetched over HTTP there; read from local
  // frontend/public here).
  const logoPath = path.resolve(
    __dirname,
    '../../frontend/public/logo-certificate.jpeg',
  );
  const logoBuffer = fs.existsSync(logoPath) ? fs.readFileSync(logoPath) : null;
  if (!logoBuffer) {
    console.warn(
      `[warn] logo not found at ${logoPath} — sample will show text watermark.`,
    );
  }

  // Secondary accreditation logo (Saudi Commission for Health Specialties).
  const secondaryLogoPath = path.resolve(
    __dirname,
    '../../frontend/public/saudi-health.svg',
  );
  const secondaryLogoSvg = fs.existsSync(secondaryLogoPath)
    ? fs.readFileSync(secondaryLogoPath, 'utf8')
    : null;
  if (!secondaryLogoSvg) {
    console.warn(`[warn] secondary logo not found at ${secondaryLogoPath}`);
  }

  // Amiri font — same embedded base64 the production render uses.
  const { AMIRI_BOLD_BASE64 } = require('../src/modules/certificates/amiri-bold-font');
  const arabicFontBuf = Buffer.from(AMIRI_BOLD_BASE64, 'base64');

  const qrBuffer = await QRCode.toBuffer(
    'https://physioguidance.org/en/verify/sample',
    { width: 140, margin: 1, errorCorrectionLevel: 'M' },
  );

  const hasArabicChars = (text: string | null | undefined): boolean => {
    if (!text) return false;
    return /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/.test(text);
  };

  const enLabels = {
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
  const arLabels = {
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
  };

  // Two long-ish samples so we stress the wrap + measure logic that the
  // production bug report highlighted.
  const enBuffer = await (svc as any).renderCertificatePdfBuffer({
    displayName: 'Mohammed Alfaifi',
    courseTitle:
      "Activating Kaizen's strategies to achieve excellence in healthcare",
    cmeHours: 2,
    regNumber: '23456',
    dateFormatted: 'JULY 23, 2026',
    accreditationDate: '23-07-2026',
    courseAccreditationNumber: 's112',
    logoBuffer,
    secondaryLogoSvg,
    qrBuffer,
    arabicFontBuf,
    lang: 'en' as const,
    L: enLabels,
    hasArabicChars,
  });

  const arBuffer = await (svc as any).renderCertificatePdfBuffer({
    displayName: 'أحمد خالد',
    courseTitle: 'تفعيل استراتيجيات كايزن لتحقيق التميز في الرعاية الصحية',
    cmeHours: 2,
    regNumber: '23456',
    dateFormatted: '23 يوليو 2026',
    accreditationDate: '23-07-2026',
    courseAccreditationNumber: 's112',
    logoBuffer,
    secondaryLogoSvg,
    qrBuffer,
    arabicFontBuf,
    lang: 'ar' as const,
    L: arLabels,
    hasArabicChars,
  });

  const desktop = path.join(os.homedir(), 'Desktop');
  const enOut = path.join(desktop, 'certificate-sample-en.pdf');
  const arOut = path.join(desktop, 'certificate-sample-ar.pdf');
  fs.writeFileSync(enOut, enBuffer);
  fs.writeFileSync(arOut, arBuffer);
  console.log(`Wrote ${enOut}`);
  console.log(`Wrote ${arOut}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
