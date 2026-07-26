/**
 * Ticket-created confirmation email for learners. Two phrasings, branched
 * by `mode`: in_hours (SLA countdown) or queued_until_resume (wait for
 * next business day open). Bilingual (EN + AR).
 */
import { EmailLocale, getEmailStrings, htmlAttrs, t as tt, textAlign } from '../email-i18n';

type ExpectedMode = 'in_hours' | 'queued_until_resume';

export function getTicketCreatedLearnerHtml(
  learnerName: string,
  ticketId: string,
  expectedResponse: string,
  mode: ExpectedMode = 'in_hours',
  trackingUrl?: string,
  locale: EmailLocale = 'en',
): string {
  const s = getEmailStrings(locale);
  const isGuest = Boolean(trackingUrl);
  const trackHint = isGuest ? s.ticketTrackHintGuest : s.ticketTrackHintDashboard;
  const bodyLine = mode === 'queued_until_resume'
    ? `${tt(s.ticketBodyOutOfHours, { id: ticketId, eta: expectedResponse })} ${trackHint}`
    : `${tt(s.ticketBodyInHours, { id: ticketId, eta: expectedResponse })} ${trackHint}`;
  const expectedLabel = mode === 'queued_until_resume' ? s.ticketExpectedAt : s.ticketExpectedWithin;
  const ctaHref = trackingUrl || 'https://physioguidance.org/en/dashboard/support';
  const ctaLabel = isGuest ? s.ticketCtaGuest : s.ticketCtaDashboard;
  return `<!DOCTYPE html>
<html ${htmlAttrs(locale)}>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${s.ticketReceivedTitle} - PhysioGuidance</title>
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
                    <span style="font-size:28px;line-height:56px;">&#9993;</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;">${s.ticketReceivedTitle}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="margin:0 0 16px;font-size:14px;color:#4b5563;line-height:1.6;text-align:center;">
                ${s.hi} ${learnerName},
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#4b5563;line-height:1.6;text-align:${textAlign(locale)};">
                ${bodyLine}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ecfdf5;border:1px solid #bbf7d0;border-radius:12px;">
                <tr>
                  <td style="padding:16px 20px;text-align:${textAlign(locale)};">
                    <p style="margin:0 0 8px;font-size:13px;color:#166534;font-weight:600;">${s.ticketIdLabel} #${ticketId}</p>
                    <p style="margin:0;font-size:13px;color:#166534;">${expectedLabel} ${expectedResponse}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;text-align:center;">
              <a href="${ctaHref}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#a37f49,#6b4e24);color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
                ${ctaLabel}
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

export function getTicketCreatedLearnerText(
  learnerName: string,
  ticketId: string,
  expectedResponse: string,
  mode: ExpectedMode = 'in_hours',
  trackingUrl?: string,
  locale: EmailLocale = 'en',
): string {
  const s = getEmailStrings(locale);
  const isGuest = Boolean(trackingUrl);
  const trackHint = isGuest ? s.ticketTrackHintGuest : s.ticketTrackHintDashboard;
  const bodyLine = mode === 'queued_until_resume'
    ? tt(s.ticketBodyOutOfHours, { id: ticketId, eta: expectedResponse })
    : tt(s.ticketBodyInHours, { id: ticketId, eta: expectedResponse });
  const expectedLabel = mode === 'queued_until_resume' ? s.ticketExpectedAt : s.ticketExpectedWithin;
  const ctaUrl = trackingUrl || 'https://physioguidance.org/en/dashboard/support';
  const ctaLabel = isGuest ? s.ticketCtaGuest : s.ticketCtaDashboard;
  return `PhysioGuidance - ${s.ticketReceivedTitle}

${s.hi} ${learnerName},

${bodyLine} ${trackHint}

${s.ticketIdLabel} #${ticketId}
${expectedLabel} ${expectedResponse}

${ctaLabel}: ${ctaUrl}

© ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}
${s.nelcFooter}`;
}
