/**
 * Email sent to someone who registered on the public Zoom form for a PAID
 * Webinar Course. We deliberately do NOT auto-enroll them — they'd skip the
 * paid course fee. Instead this email points them to the public course page
 * so they can enroll (and pay) to unlock CME credit and the certificate.
 *
 * Without enrollment they can still attend the live webinar (Zoom approves
 * the registration), but no attendance is recorded against the course, so
 * no certificate / no CME / no portal access.
 */
import { EmailLocale, getEmailStrings, htmlAttrs, textAlign } from '../email-i18n';

export function getWebinarPaidEnrollmentNudgeHtml(
  registrantName: string,
  courseTitle: string,
  courseUrl: string,
  locale: EmailLocale = 'en',
): string {
  const s = getEmailStrings(locale);
  const heading = locale === 'ar'
    ? 'تم تسجيلك في الندوة'
    : 'You\'re registered for the webinar';
  const intro = locale === 'ar'
    ? `مرحبًا ${registrantName}، شكرًا على التسجيل في ندوة "${courseTitle}". سيصلك رابط الانضمام من Zoom مباشرة.`
    : `Hello ${registrantName}, thanks for registering for the "${courseTitle}" webinar. Your personal join link will arrive directly from Zoom.`;
  const cmeHeading = locale === 'ar'
    ? 'هل تريد الحصول على ساعات CME والشهادة؟'
    : 'Want CME credit and a certificate?';
  const cmeBody = locale === 'ar'
    ? 'هذه الندوة جزء من دورة مدفوعة. لتلقي ساعات التطوير المهني المستمر والحصول على الشهادة المعتمدة، يجب التسجيل في الدورة وإتمام الدفع. بدون التسجيل في الدورة يمكنك حضور البث المباشر فقط، دون الحصول على ساعات CME أو الشهادة.'
    : 'This webinar is part of a paid course. To receive CME hours and the accredited certificate, you need to enroll in the full course and complete payment. Without course enrollment you can still attend the live broadcast, but you will not earn CME credit or the certificate.';
  const ctaLabel = locale === 'ar' ? 'عرض الدورة والتسجيل' : 'View course & enroll';
  const fallbackLabel = locale === 'ar'
    ? 'إذا لم يعمل الزر، انسخ الرابط التالي والصقه في متصفحك:'
    : 'If the button does not work, copy and paste this link into your browser:';

  return `<!DOCTYPE html>
<html ${htmlAttrs(locale)}>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PhysioGuidance — ${heading}</title>
</head>
<body style="margin:0;padding:0;background-color:#EEF3F7;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF3F7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

          <!-- Header brand bar -->
          <tr>
            <td style="background:linear-gradient(135deg,#a37f49,#6b4e24);padding:28px 32px 24px;text-align:center;">
              <span style="font-size:24px;font-weight:700;color:#ffffff;font-family:'DM Sans',Arial,sans-serif;letter-spacing:-0.5px;">Physio</span><span style="font-size:24px;font-weight:700;color:#f5f0e8;font-family:'DM Sans',Arial,sans-serif;letter-spacing:-0.5px;">Guidance</span>
              <div style="margin-top:6px;font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:1px;text-transform:uppercase;">${s.nelcBadge}</div>
            </td>
          </tr>

          <!-- Body intro -->
          <tr>
            <td style="padding:36px 32px 8px;text-align:${textAlign(locale)};">
              <h1 style="margin:0 0 14px;font-size:24px;font-weight:700;color:#1a1a1a;line-height:1.3;">
                ${heading}
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#4a4a4a;line-height:1.6;">
                ${intro}
              </p>
            </td>
          </tr>

          <!-- CME callout -->
          <tr>
            <td style="padding:0 32px 24px;">
              <div style="background:#FFF7ED;border:1px solid #FDBA74;border-radius:12px;padding:18px 20px;text-align:${textAlign(locale)};">
                <h2 style="margin:0 0 8px;font-size:16px;font-weight:700;color:#9A3412;">
                  ${cmeHeading}
                </h2>
                <p style="margin:0;font-size:14px;color:#7C2D12;line-height:1.6;">
                  ${cmeBody}
                </p>
              </div>
            </td>
          </tr>

          <!-- CTA button -->
          <tr>
            <td align="center" style="padding:0 32px 28px;">
              <a href="${courseUrl}"
                 style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#a37f49,#6b4e24);color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:12px;font-family:'DM Sans',Arial,sans-serif;">
                ${ctaLabel}
              </a>
            </td>
          </tr>

          <!-- Fallback URL -->
          <tr>
            <td style="padding:0 32px 28px;">
              <p style="margin:0 0 6px;font-size:12px;color:#737373;line-height:1.5;text-align:${textAlign(locale)};">
                ${fallbackLabel}
              </p>
              <p style="margin:0;font-size:12px;color:#1a1a1a;word-break:break-all;background:#f8fafc;padding:10px 12px;border-radius:8px;border:1px solid #e5e7eb;">
                ${courseUrl}
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:0 32px;"><div style="height:1px;background:#e5e7eb;"></div></td></tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 32px 24px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">
                &copy; ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}
              </p>
              <p style="margin:0;font-size:11px;color:#9ca3af;">${s.nelcFooter}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getWebinarPaidEnrollmentNudgeText(
  registrantName: string,
  courseTitle: string,
  courseUrl: string,
  locale: EmailLocale = 'en',
): string {
  const s = getEmailStrings(locale);
  const heading = locale === 'ar'
    ? 'تم تسجيلك في الندوة'
    : 'You\'re registered for the webinar';
  const intro = locale === 'ar'
    ? `مرحبًا ${registrantName}، شكرًا على التسجيل في ندوة "${courseTitle}". سيصلك رابط الانضمام من Zoom مباشرة.`
    : `Hello ${registrantName}, thanks for registering for the "${courseTitle}" webinar. Your personal join link will arrive directly from Zoom.`;
  const body = locale === 'ar'
    ? 'هذه الندوة جزء من دورة مدفوعة. لتلقي ساعات CME والشهادة المعتمدة، يجب التسجيل في الدورة وإتمام الدفع. بدون التسجيل في الدورة يمكنك حضور البث المباشر فقط دون الحصول على ساعات CME أو الشهادة.'
    : 'This webinar is part of a paid course. To receive CME hours and the accredited certificate, you need to enroll in the full course and complete payment. Without course enrollment you can still attend the live broadcast, but you will not earn CME credit or the certificate.';
  return `PhysioGuidance — ${heading}

${intro}

${body}

${locale === 'ar' ? 'عرض الدورة والتسجيل' : 'View course & enroll'}: ${courseUrl}

© ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}
${s.nelcFooter}`;
}
