/**
 * SLA First Response Time breach alert email template
 */
export function getSlaFrtBreachHtml(
  agentName: string,
  ticketId: string,
  subject: string,
  frtTarget: string,
): string {
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FRT Breach Alert - PhysioGuidance</title>
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
                  <td style="width:56px;height:56px;background-color:#fef2f2;border-radius:50%;text-align:center;vertical-align:middle;">
                    <span style="font-size:28px;line-height:56px;">&#9888;</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#dc2626;font-family:'DM Sans',Arial,sans-serif;">BREACH ALERT: FRT Exceeded</h1>
            </td>
          </tr>

          <!-- Message -->
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="margin:0 0 16px;font-size:14px;color:#4b5563;font-family:'DM Sans',Arial,sans-serif;line-height:1.6;text-align:center;">
                Hi ${agentName},
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#4b5563;font-family:'DM Sans',Arial,sans-serif;line-height:1.6;text-align:center;">
                Ticket <strong>#${ticketId}</strong> has exceeded the First Response Time target of <strong>${frtTarget} minutes</strong>.
              </p>
              <p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;text-align:center;">
                Subject: ${subject}
              </p>
            </td>
          </tr>

          <!-- Red alert box -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:12px;">
                <tr>
                  <td style="padding:16px 20px;text-align:center;">
                    <p style="margin:0;font-size:14px;color:#991b1b;font-family:'DM Sans',Arial,sans-serif;font-weight:600;">This ticket has been auto-reassigned to the next agent.</p>
                  </td>
                </tr>
              </table>
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

export function getSlaFrtBreachText(
  agentName: string,
  ticketId: string,
  subject: string,
  frtTarget: string,
): string {
  return `PhysioGuidance - BREACH ALERT: FRT Exceeded

Hi ${agentName},

Ticket #${ticketId} has exceeded the First Response Time target of ${frtTarget} minutes.

Subject: ${subject}

This ticket has been auto-reassigned to the next agent.

\u00a9 ${new Date().getFullYear()} PhysioGuidance. All rights reserved.
NELC Accredited \u00b7 Saudi Arabia`;
}
