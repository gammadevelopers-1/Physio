/**
 * CSAT low-score followup email — sent when a learner gives ≤3 stars.
 * Prompts them to reopen the ticket or contact support. Bilingual (EN + AR).
 */
import { EmailLocale, getEmailStrings, htmlAttrs, t as tt, textAlign } from '../email-i18n';

export function getCsatFollowupHtml(
  learnerName: string,
  ticketId: string,
  score: number,
  locale: EmailLocale = 'en',
): string {
  const s = getEmailStrings(locale);
  const supportUrl = `${(process.env.FRONTEND_URL || 'https://physioguidance.org').replace(/\/$/, '')}/${locale}/support`;
  return `<!DOCTYPE html>
<html ${htmlAttrs(locale)}>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${s.csatLowScoreTitle} - PhysioGuidance</title>
</head>
<body style="margin:0;padding:0;background-color:#EEF3F7;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF3F7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:linear-gradient(135deg,#a37f49,#6b4e24);padding:32px 32px 24px;text-align:center;">
              <span style="font-size:24px;font-weight:700;color:#ffffff;">Physio</span><span style="font-size:24px;font-weight:700;color:#f5f0e8;">Guidance</span>
              <br/><span style="font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:1px;text-transform:uppercase;">${s.nelcBadge}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="width:56px;height:56px;background-color:#fef2f2;border-radius:50%;text-align:center;vertical-align:middle;">
                    <span style="font-size:28px;line-height:56px;">&#128172;</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;">${s.csatLowScoreTitle}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="margin:0 0 16px;font-size:14px;color:#4b5563;line-height:1.6;text-align:center;">
                ${s.hi} ${learnerName},
              </p>
              <p style="margin:0 0 16px;font-size:14px;color:#4b5563;line-height:1.6;text-align:${textAlign(locale)};">
                ${tt(s.csatLowScoreBody, { score })}
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#4b5563;line-height:1.6;text-align:${textAlign(locale)};">
                ${s.csatLowScoreCta}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;text-align:center;">
              <a href="${supportUrl}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#a37f49,#6b4e24);color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
                ${s.csatContactSupportCta}
              </a>
            </td>
          </tr>
          <tr><td style="padding:0 32px;"><div style="height:1px;background-color:#e5e7eb;"></div></td></tr>
          <tr>
            <td style="padding:20px 32px 24px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}</p>
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

export function getCsatFollowupText(
  learnerName: string,
  ticketId: string,
  score: number,
  locale: EmailLocale = 'en',
): string {
  const s = getEmailStrings(locale);
  const supportUrl = `${(process.env.FRONTEND_URL || 'https://physioguidance.org').replace(/\/$/, '')}/${locale}/support`;
  return `PhysioGuidance - ${s.csatLowScoreTitle}

${s.hi} ${learnerName},

${tt(s.csatLowScoreBody, { score })}

${s.csatLowScoreCta}

${s.csatContactSupportCta}: ${supportUrl}

© ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}
${s.nelcFooter}`;
}
