/**
 * Ticket closed notification email template for learners.
 *
 * Sent when a supervisor or agent finalizes a previously-resolved ticket.
 * Distinct from "resolved" — closed tickets cannot be reopened by the
 * student, so the CTA points at "open a new ticket" instead of "reopen".
 */
export function getTicketClosedHtml(
  learnerName: string,
  ticketId: string,
): string {
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ticket Closed - PhysioGuidance</title>
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
                  <td style="width:56px;height:56px;background-color:#f3f4f6;border-radius:50%;text-align:center;vertical-align:middle;">
                    <span style="font-size:28px;line-height:56px;color:#6b7280;">&#128274;</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">Ticket Closed</h1>
            </td>
          </tr>

          <!-- Message -->
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="margin:0 0 16px;font-size:14px;color:#4b5563;font-family:'DM Sans',Arial,sans-serif;line-height:1.6;text-align:center;">
                Hi ${learnerName},
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#4b5563;font-family:'DM Sans',Arial,sans-serif;line-height:1.6;text-align:center;">
                Your support ticket is now closed. Thank you for working with our team. If you need further help, please open a new ticket.
              </p>
            </td>
          </tr>

          <!-- Gray closed-status box -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;">
                <tr>
                  <td style="padding:16px 20px;text-align:center;">
                    <span style="font-size:20px;color:#6b7280;">&#128274;</span>
                    <p style="margin:8px 0 0;font-size:14px;color:#374151;font-family:'DM Sans',Arial,sans-serif;font-weight:600;">Ticket #${ticketId} has been closed</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Button -->
          <tr>
            <td style="padding:0 32px 24px;text-align:center;">
              <a href="https://physioguidance.org/en/support" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#a37f49,#6b4e24);color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;font-family:'DM Sans',Arial,sans-serif;">
                Open a New Ticket
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

export function getTicketClosedText(
  learnerName: string,
  ticketId: string,
): string {
  return `PhysioGuidance - Ticket Closed

Hi ${learnerName},

Your support ticket is now closed. Thank you for working with our team. If you need further help, please open a new ticket.

Ticket #${ticketId} has been closed.

Open a New Ticket: https://physioguidance.org/en/support

© ${new Date().getFullYear()} PhysioGuidance. All rights reserved.
NELC Accredited · Saudi Arabia`;
}
