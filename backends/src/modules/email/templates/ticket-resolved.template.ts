/**
 * Ticket resolved email — sent when an agent marks a ticket as resolved.
 * Includes an inline star rating (deep-linked to the CSAT page) plus a
 * "reopen ticket" fallback CTA. Bilingual (EN + AR).
 */
import { EmailLocale, getEmailStrings, htmlAttrs, t as tt, textAlign } from '../email-i18n';

export function getTicketResolvedHtml(
  learnerName: string,
  ticketId: string,
  surveyUrl: string | null,
  locale: EmailLocale = 'en',
): string {
  const s = getEmailStrings(locale);
  const ratingBlock = surveyUrl
    ? `
          <tr>
            <td style="padding:0 32px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:12px;">
                <tr>
                  <td style="padding:18px 20px;text-align:center;">
                    <p style="margin:0 0 6px;font-size:13px;color:#92400e;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${s.ticketRatingTitle}</p>
                    <p style="margin:0 0 12px;font-size:13px;color:#78350f;line-height:1.5;">
                      ${s.ticketRatingBody}
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                      <tr>
                        ${[1, 2, 3, 4, 5]
                          .map(
                            (n) => `<td style="padding:0 4px;">
                          <a href="${surveyUrl}?score=${n}" style="display:inline-block;width:34px;height:34px;line-height:34px;background-color:#ffffff;border:1px solid #fde68a;border-radius:50%;color:#b45309;font-size:18px;text-decoration:none;text-align:center;font-family:Arial,sans-serif;" aria-label="${n}/5">&#9733;</a>
                        </td>`,
                          )
                          .join('')}
                      </tr>
                    </table>
                    <p style="margin:14px 0 0;font-size:12px;color:#a16207;">
                      <a href="${surveyUrl}" style="color:#a16207;text-decoration:underline;">${s.ticketRatingLink}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
`
    : '';
  return `<!DOCTYPE html>
<html ${htmlAttrs(locale)}>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${s.ticketResolvedTitle} - PhysioGuidance</title>
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
                  <td style="width:56px;height:56px;background-color:#ecfdf5;border-radius:50%;text-align:center;vertical-align:middle;">
                    <span style="font-size:28px;line-height:56px;">&#10004;</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;">${s.ticketResolvedTitle}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="margin:0 0 16px;font-size:14px;color:#4b5563;line-height:1.6;text-align:center;">
                ${s.hi} ${learnerName},
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#4b5563;line-height:1.6;text-align:${textAlign(locale)};">
                ${s.ticketResolvedBrief}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ecfdf5;border:1px solid #bbf7d0;border-radius:12px;">
                <tr>
                  <td style="padding:16px 20px;text-align:center;">
                    <span style="font-size:20px;">&#9989;</span>
                    <p style="margin:8px 0 0;font-size:14px;color:#166534;font-weight:600;">${tt(s.ticketResolvedBadge, { id: ticketId })}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
${ratingBlock}
          <tr>
            <td style="padding:8px 32px 24px;text-align:center;">
              <a href="https://physioguidance.org/en/dashboard/support" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#a37f49,#6b4e24);color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
                ${s.ticketResolvedReopenCta}
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

export function getTicketResolvedText(
  learnerName: string,
  ticketId: string,
  surveyUrl: string | null,
  locale: EmailLocale = 'en',
): string {
  const s = getEmailStrings(locale);
  const ratingLine = surveyUrl ? `\n\n${s.ticketRatingLink}: ${surveyUrl}\n` : '';
  return `PhysioGuidance - ${s.ticketResolvedTitle}

${s.hi} ${learnerName},

${s.ticketResolvedBrief}

${tt(s.ticketResolvedBadge, { id: ticketId })}.${ratingLine}
${s.ticketResolvedReopenCta}: https://physioguidance.org/en/dashboard/support

© ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}
${s.nelcFooter}`;
}
