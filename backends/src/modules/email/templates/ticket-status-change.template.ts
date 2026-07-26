/**
 * Generic ticket status-change notification. Bilingual (EN + AR).
 *
 * Used for intermediate transitions (→ IN_PROGRESS when staff picks it up,
 * → ON_HOLD when waiting on something, → reopened) that the dedicated
 * resolved/closed templates don't cover.
 */
import { EmailLocale, getEmailStrings, htmlAttrs, t as tt, textAlign } from '../email-i18n';

/**
 * Map backend status keys onto the localized label. Falls back to the
 * raw status string when we don't recognise it — better than showing "".
 */
function statusLabel(status: string, locale: EmailLocale): string {
  const s = getEmailStrings(locale);
  switch (status) {
    case 'new':
      return s.ticketStatusOpen;
    case 'in_progress':
      return s.ticketStatusInProgress;
    case 'on_hold':
      return s.ticketStatusOnHold;
    case 'pending':
      return s.ticketStatusPending;
    case 'resolved':
      return s.ticketStatusResolved;
    case 'closed':
      return s.ticketStatusClosed;
    default:
      return status;
  }
}

export function getTicketStatusChangeHtml(
  learnerName: string,
  ticketRef: string,
  newStatus: string,
  reason?: string | null,
  locale: EmailLocale = 'en',
): string {
  const s = getEmailStrings(locale);
  const label = statusLabel(newStatus, locale);
  const reasonRow = reason
    ? `<p style="margin:8px 0 0;font-size:13px;color:#4b5563;text-align:${textAlign(locale)};">${s.reasonLabel} ${reason}</p>`
    : '';
  return `<!DOCTYPE html>
<html ${htmlAttrs(locale)}>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${s.ticketStatusTitle} - PhysioGuidance</title>
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
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;">${s.ticketStatusTitle}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 24px;">
              <p style="margin:0 0 12px;font-size:14px;color:#4b5563;line-height:1.6;text-align:center;">${s.hi} ${learnerName},</p>
              <p style="margin:0;font-size:14px;color:#4b5563;line-height:1.6;text-align:${textAlign(locale)};">${tt(s.ticketStatusNowText, { ref: ticketRef, status: label })}</p>
              ${reasonRow}
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;text-align:center;">
              <a href="https://physioguidance.org/en/dashboard/support" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#a37f49,#6b4e24);color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">${s.ticketCreatedCta}</a>
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

export function getTicketStatusChangeText(
  learnerName: string,
  ticketRef: string,
  newStatus: string,
  reason?: string | null,
  locale: EmailLocale = 'en',
): string {
  const s = getEmailStrings(locale);
  const label = statusLabel(newStatus, locale);
  return `PhysioGuidance - ${s.ticketStatusTitle}

${s.hi} ${learnerName},

${tt(s.ticketStatusNowText, { ref: ticketRef, status: label })}${reason ? `\n${s.reasonLabel} ${reason}` : ''}

${s.ticketCreatedCta}: https://physioguidance.org/en/dashboard/support

© ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}
${s.nelcFooter}`;
}
