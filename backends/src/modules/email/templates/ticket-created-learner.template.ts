/**
 * Ticket created confirmation email template for learners.
 *
 * Two phrasings, branched by `mode`:
 *   - in_hours              → "Our team will respond within 4 hours."
 *   - queued_until_resume   → "We'll respond when business hours resume
 *                              on Sunday at 9:00 AM AST."
 *
 * The body line and the green "Expected Response" line are both
 * branched so the email is internally consistent. The `mode` arg
 * defaults to in_hours for callers that haven't been updated yet.
 */
type ExpectedMode = 'in_hours' | 'queued_until_resume';

function buildBodyLine(expectedResponse: string, mode: ExpectedMode): string {
  if (mode === 'queued_until_resume') {
    return `We've received your support ticket <strong>#${''}</strong>. Your ticket is queued — our team will respond when business hours resume on <strong>${expectedResponse}</strong>. You can track your ticket status from your dashboard.`;
  }
  return `We've received your support ticket <strong>#${''}</strong>. Our team will respond within <strong>${expectedResponse}</strong>. You can track your ticket status from your dashboard.`;
}

function buildExpectedLabel(mode: ExpectedMode): string {
  return mode === 'queued_until_resume'
    ? 'Expected Response: when business hours resume on'
    : 'Expected Response: within';
}

export function getTicketCreatedLearnerHtml(
  learnerName: string,
  ticketId: string,
  expectedResponse: string,
  mode: ExpectedMode = 'in_hours',
  trackingUrl?: string,
): string {
  // Guests don't have a dashboard, so the CTA needs to point to the
  // tracking URL instead — and the body line should call out that this
  // is their only path back to the conversation.
  const isGuest = Boolean(trackingUrl);
  const trackHint = isGuest
    ? ` You can reply or check progress at the tracking link below — keep it safe, it's your only way back to this ticket.`
    : ` You can track your ticket status from your dashboard.`;
  const bodyLine =
    mode === 'queued_until_resume'
      ? `We've received your support ticket <strong>#${ticketId}</strong>. Your ticket is queued — our team will respond when business hours resume on <strong>${expectedResponse}</strong>.${trackHint}`
      : `We've received your support ticket <strong>#${ticketId}</strong>. Our team will respond within <strong>${expectedResponse}</strong>.${trackHint}`;
  const expectedLabel = buildExpectedLabel(mode);
  const ctaHref = trackingUrl || 'https://physioguidance.org/en/dashboard/support';
  const ctaLabel = isGuest ? 'Track Your Ticket' : 'View My Tickets';
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ticket Received - PhysioGuidance</title>
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
                    <span style="font-size:11px;color:rgba(255,255,255,0.7);font-family:'DM Sans',Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;">NELC Accredited Platform</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="width:56px;height:56px;background-color:#ecfdf5;border-radius:50%;text-align:center;vertical-align:middle;">
                    <span style="font-size:28px;line-height:56px;">&#9993;</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">Ticket Received</h1>
            </td>
          </tr>

          <!-- Message -->
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="margin:0 0 16px;font-size:14px;color:#4b5563;font-family:'DM Sans',Arial,sans-serif;line-height:1.6;text-align:center;">
                Hi ${learnerName},
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#4b5563;font-family:'DM Sans',Arial,sans-serif;line-height:1.6;text-align:center;">
                ${bodyLine}
              </p>
            </td>
          </tr>

          <!-- Green info box -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ecfdf5;border:1px solid #bbf7d0;border-radius:12px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 8px;font-size:13px;color:#166534;font-family:'DM Sans',Arial,sans-serif;font-weight:600;">Ticket ID: #${ticketId}</p>
                    <p style="margin:0;font-size:13px;color:#166534;font-family:'DM Sans',Arial,sans-serif;">${expectedLabel} ${expectedResponse}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Button -->
          <tr>
            <td style="padding:0 32px 24px;text-align:center;">
              <a href="${ctaHref}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#a37f49,#6b4e24);color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;font-family:'DM Sans',Arial,sans-serif;">
                ${ctaLabel}
              </a>
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
                &copy; ${new Date().getFullYear()} PhysioGuidance. All rights reserved.
              </p>
              <p style="margin:0;font-size:11px;color:#9ca3af;font-family:'DM Sans',Arial,sans-serif;">
                NELC Accredited &middot; Saudi Arabia
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

export function getTicketCreatedLearnerText(
  learnerName: string,
  ticketId: string,
  expectedResponse: string,
  mode: ExpectedMode = 'in_hours',
  trackingUrl?: string,
): string {
  const isGuest = Boolean(trackingUrl);
  const trackHint = isGuest
    ? `You can reply or check progress at the tracking link below — keep it safe, it's your only way back to this ticket.`
    : `You can track your ticket status from your dashboard.`;
  const bodyLine =
    mode === 'queued_until_resume'
      ? `We've received your support ticket #${ticketId}. Your ticket is queued — our team will respond when business hours resume on ${expectedResponse}.`
      : `We've received your support ticket #${ticketId}. Our team will respond within ${expectedResponse}.`;
  const expectedLabel = buildExpectedLabel(mode);
  const ctaUrl = trackingUrl || 'https://physioguidance.org/en/dashboard/support';
  const ctaLabel = isGuest ? 'Track Your Ticket' : 'View My Tickets';
  return `PhysioGuidance - Ticket Received

Hi ${learnerName},

${bodyLine} ${trackHint}

Ticket ID: #${ticketId}
${expectedLabel} ${expectedResponse}

${ctaLabel}: ${ctaUrl}

© ${new Date().getFullYear()} PhysioGuidance. All rights reserved.
NELC Accredited · Saudi Arabia`;
}

// buildBodyLine is exported only for tests; keep it lazy
export { buildBodyLine as __buildBodyLine };
