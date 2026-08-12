/**
 * Certificate preview with placeholders.
 *
 * Calls the SAME private renderCertificatePdfBuffer helper that
 * smoke-certificate-pdf.ts uses (so the layout is identical to the real
 * download that ships in production) — but passes bracketed placeholder
 * strings for every user-supplied field. Intended for uploading to Strapi
 * on the public course detail page so buyers see the cert design without
 * any real recipient data.
 *
 * Run:  npx tsx scripts/smoke-certificate-placeholder.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as QRCode from 'qrcode';
import { CertificatesService } from '../src/modules/certificates/certificates.service';

async function main() {
  const svc = new CertificatesService(
    {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
  );

  // Same asset lookups as the real smoke script — the production render
  // needs the primary + secondary logos and the Amiri font to lay out
  // correctly. Missing files degrade gracefully.
  const logoPath = path.resolve(__dirname, '../../frontend/public/logo-certificate.jpeg');
  const logoBuffer = fs.existsSync(logoPath) ? fs.readFileSync(logoPath) : null;

  const secondaryLogoPath = path.resolve(__dirname, '../../frontend/public/saudi-health.svg');
  const secondaryLogoSvg = fs.existsSync(secondaryLogoPath)
    ? fs.readFileSync(secondaryLogoPath, 'utf8')
    : null;

  const { AMIRI_BOLD_BASE64 } = require('../src/modules/certificates/amiri-bold-font');
  const arabicFontBuf = Buffer.from(AMIRI_BOLD_BASE64, 'base64');

  // Placeholder QR — same visual weight as real, points at the site root
  // so if anyone scans the preview they land on something reasonable.
  const qrBuffer = await QRCode.toBuffer(
    'https://physioguidance.org',
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
    accreditedBy: 'This activity has been accredited by the Saudi Commission for Health Specialties',
    numberDate: (n: string, d: string) => `with accreditation number ${n}   Date: ${d}`,
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
    accreditedBy: 'هذا النشاط معتمد من الهيئة السعودية للتخصصات الصحية',
    numberDate: (n: string, d: string) => `رقم الاعتماد ${n}   التاريخ: ${d}`,
    courseAccreditation: (n: string) => `اعتماد الدورة: ${n}`,
    cmeHours: (h: number) => `${h} ساعات معتمدة CME/PD`,
    cmeBadge: 'ساعات معتمدة',
    scanToVerify: 'امسح للتحقق',
  };

  // Bracketed placeholders — cmeHours has to be a number for the layout
  // (used in a template literal like `${h} CME/PD Credit Hours`); passing
  // a display-only "[N]" is fine but would show as text. We keep it as
  // 0 so the numeric position stays clean and readable.
  const enBuffer = await (svc as any).renderCertificatePdfBuffer({
    displayName: '[Recipient Name]',
    courseTitle: '[Course Name]',
    cmeHours: 0,
    regNumber: '[Certificate Number]',
    dateFormatted: '[Issue Date]',
    accreditationDate: '[Accreditation Date]',
    courseAccreditationNumber: '[Course Accreditation]',
    logoBuffer,
    secondaryLogoSvg,
    qrBuffer,
    arabicFontBuf,
    lang: 'en' as const,
    L: enLabels,
    hasArabicChars,
  });

  const arBuffer = await (svc as any).renderCertificatePdfBuffer({
    displayName: '[اسم المتلقي]',
    courseTitle: '[اسم الدورة]',
    cmeHours: 0,
    regNumber: '[رقم الشهادة]',
    dateFormatted: '[تاريخ الإصدار]',
    accreditationDate: '[تاريخ الاعتماد]',
    courseAccreditationNumber: '[اعتماد الدورة]',
    logoBuffer,
    secondaryLogoSvg,
    qrBuffer,
    arabicFontBuf,
    lang: 'ar' as const,
    L: arLabels,
    hasArabicChars,
  });

  const desktop = path.join(os.homedir(), 'Desktop');
  const enOut = path.join(desktop, 'certificate-preview-en.pdf');
  const arOut = path.join(desktop, 'certificate-preview-ar.pdf');
  fs.writeFileSync(enOut, enBuffer);
  fs.writeFileSync(arOut, arBuffer);
  console.log(`Wrote ${enOut}`);
  console.log(`Wrote ${arOut}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
