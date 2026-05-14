/**
 * Webinar Live email template for PhysioGuidance
 * Sent to every registrant the moment the host clicks Start on a Zoom
 * webinar (driven by the webinar.started webhook). Each registrant's
 * PERSONAL Zoom join URL is embedded — clicking takes them straight
 * into the webinar, no registration form again.
 */
import { EmailLocale, getEmailStrings, htmlAttrs, textAlign } from '../email-i18n';

export function getWebinarLiveHtml(
  params: {
    recipientName: string;
    webinarTitle: string;
    courseName?: string | null;
    personalJoinUrl: string;
  },
  locale: EmailLocale = 'en',
): string {
  const s = getEmailStrings(locale);
  const { recipientName, webinarTitle, courseName, personalJoinUrl } = params;

  const isAr = locale === 'ar';
  const title = isAr
    ? '🔴 الندوة بدأت مباشرة'
    : '🔴 The Webinar is Live';
  const headline = isAr
    ? 'ندوتك بدأت الآن'
    : 'Your webinar has started';
  const body = isAr
    ? 'لقد بدأ المضيف الندوة. اضغط على زر الانضمام أدناه للدخول مباشرة — لا حاجة لإعادة التسجيل.'
    : 'The host has started the webinar. Click the button below to join now — no need to register again.';
  const cta = isAr ? 'انضم للندوة الآن' : 'Join Webinar Now';
  const fallback = isAr
    ? 'إذا لم يعمل الزر، انسخ والصق الرابط التالي في متصفحك:'
    : "If the button doesn't work, copy and paste this link into your browser:";
  const webinarLabel = isAr ? 'الندوة' : 'Webinar';
  const courseLabel = isAr ? 'الدورة' : 'Course';
  const hi = isAr ? `مرحباً ${recipientName}،` : `Hi ${recipientName},`;
  const courseRow = courseName
    ? `
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;width:100px;">${courseLabel}</td>
                        <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;font-weight:600;">${courseName}</td>
                      </tr>`
    : '';

  return `<!DOCTYPE html>
<html ${htmlAttrs(locale)}>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} - PhysioGuidance</title>
</head>
<body style="margin:0;padding:0;background-color:#EEF3F7;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF3F7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

          <!-- Header with brand gradient -->
          <tr>
            <td style="background:linear-gradient(135deg,#a37f49,#6b4e24);padding:32px 32px 24px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="padding-bottom:4px;">
                    <span style="font-size:24px;font-weight:700;color:#ffffff;font-family:'DM Sans',Arial,sans-serif;letter-spacing:-0.5px;">Physio</span><span style="font-size:24px;font-weight:700;color:#f5f0e8;font-family:'DM Sans',Arial,sans-serif;letter-spacing:-0.5px;">Guidance</span>
                  </td>
                </tr>
                <tr>
                  <td style="text-align:center;">
                    <span style="font-size:11px;color:rgba(255,255,255,0.7);font-family:'DM Sans',Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;">${s.nelcBadge}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Icon + title -->
          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="width:56px;height:56px;background-color:#FAF5FF;border-radius:50%;text-align:center;vertical-align:middle;">
                    <span style="font-size:28px;line-height:56px;">📡</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">${headline}</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#737373;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;text-align:${textAlign(locale)};">
                ${hi}
              </p>
            </td>
          </tr>

          <!-- Webinar details card -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF5FF;border-radius:10px;border:1px solid #E9D5FF;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 4px;font-size:12px;color:#7C3AED;font-family:'DM Sans',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${isAr ? 'مباشر الآن' : 'Live now'}</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;width:100px;">${webinarLabel}</td>
                        <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;font-weight:600;">${webinarTitle}</td>
                      </tr>${courseRow}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body text -->
          <tr>
            <td style="padding:0 32px 16px;">
              <p style="margin:0;font-size:14px;color:#737373;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;text-align:${textAlign(locale)};">
                ${body}
              </p>
            </td>
          </tr>

          <!-- Join button -->
          <tr>
            <td style="padding:0 32px 16px;text-align:center;">
              <a href="${personalJoinUrl}" target="_blank" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#A855F7,#7C3AED);color:#ffffff;font-size:15px;font-weight:600;font-family:'DM Sans',Arial,sans-serif;text-decoration:none;border-radius:8px;">
                📡 ${cta}
              </a>
            </td>
          </tr>

          <!-- Fallback link -->
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="margin:0 0 4px;font-size:11px;color:#9ca3af;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;text-align:${textAlign(locale)};">
                ${fallback}
              </p>
              <p style="margin:0;font-size:11px;color:#7C3AED;font-family:'DM Sans',Arial,sans-serif;word-break:break-all;text-align:${textAlign(locale)};">
                ${personalJoinUrl}
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px;background-color:#e5e7eb;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 24px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;font-family:'DM Sans',Arial,sans-serif;">
                &copy; ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}
              </p>
              <p style="margin:0;font-size:11px;color:#9ca3af;font-family:'DM Sans',Arial,sans-serif;">
                ${s.nelcFooter}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getWebinarLiveText(
  params: {
    recipientName: string;
    webinarTitle: string;
    courseName?: string | null;
    personalJoinUrl: string;
  },
  locale: EmailLocale = 'en',
): string {
  const s = getEmailStrings(locale);
  const { recipientName, webinarTitle, courseName, personalJoinUrl } = params;
  const isAr = locale === 'ar';

  const lines = [
    `PhysioGuidance - ${isAr ? 'الندوة بدأت مباشرة' : 'The Webinar is Live'}`,
    '',
    isAr ? `مرحباً ${recipientName}،` : `Hi ${recipientName},`,
    '',
    isAr
      ? 'لقد بدأ المضيف الندوة. استخدم الرابط أدناه للانضمام مباشرة:'
      : 'The host has started the webinar. Use the link below to join now:',
    '',
    `${isAr ? 'الندوة' : 'Webinar'}: ${webinarTitle}`,
  ];
  if (courseName) lines.push(`${isAr ? 'الدورة' : 'Course'}: ${courseName}`);
  lines.push('');
  lines.push(`${isAr ? 'انضم الآن' : 'Join now'}: ${personalJoinUrl}`);
  lines.push('');
  lines.push(`© ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}`);
  lines.push(s.nelcFooter);

  return lines.join('\n');
}
