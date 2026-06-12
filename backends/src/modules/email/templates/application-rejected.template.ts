/**
 * Application rejected email template for PhysioGuidance
 */
import { EmailLocale, getEmailStrings, htmlAttrs, textAlign } from '../email-i18n';
import {
  renderTrainerAppCtasHtml,
  renderTrainerAppCtasText,
} from './trainer-application-ctas';

export function getApplicationRejectedHtml(
  applicantName: string,
  reviewNote: string,
  locale: EmailLocale = 'en',
  frontendUrl: string = 'https://app.physioguidance.com',
): string {
  const s = getEmailStrings(locale);
  return `<!DOCTYPE html>
<html ${htmlAttrs(locale)}>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${s.appRejectedTitle} - PhysioGuidance</title>
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
                  <td style="width:56px;height:56px;background-color:#fef2f2;border-radius:50%;text-align:center;vertical-align:middle;">
                    <span style="font-size:28px;line-height:56px;">&#10060;</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">${s.appRejectedTitle}</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#737373;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;">
                ${s.hi}, ${applicantName},
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:0 32px 16px;">
              <p style="margin:0;font-size:14px;color:#737373;font-family:'DM Sans',Arial,sans-serif;line-height:1.6;text-align:${textAlign(locale)};">
                ${s.appRejectedBody}
              </p>
            </td>
          </tr>

          <!-- Reason -->
          <tr>
            <td style="padding:0 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef2f2;border-radius:10px;border:1px solid #fecaca;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 8px;font-size:12px;color:#991b1b;font-family:'DM Sans',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${s.reviewerFeedback}</p>
                    <p style="margin:0;font-size:14px;color:#991b1b;font-family:'DM Sans',Arial,sans-serif;line-height:1.6;">
                      ${reviewNote}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Action buttons: Check status / Contact support
               (no primary CTA — rejections are terminal) -->
          ${renderTrainerAppCtasHtml({ frontendUrl, locale, primary: null })}

          <!-- Divider -->
          <tr>
            <td style="padding:16px 32px 0;">
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

export function getApplicationRejectedText(
  applicantName: string,
  reviewNote: string,
  locale: EmailLocale = 'en',
  frontendUrl: string = 'https://app.physioguidance.com',
): string {
  const s = getEmailStrings(locale);
  const ctas = renderTrainerAppCtasText({ frontendUrl, locale, primary: null });
  return `PhysioGuidance - ${s.appRejectedTitle}

${s.hi}, ${applicantName},

${s.appRejectedBody}

${s.reviewerFeedback} ${reviewNote}
${ctas}
© ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}
${s.nelcFooter}`;
}
