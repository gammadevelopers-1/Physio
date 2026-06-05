/**
 * Generic ticket status-change notification.
 *
 * Used for intermediate transitions (e.g. → IN_PROGRESS when staff
 * picks the ticket up, → ON_HOLD when staff is waiting on something,
 * → reopened) that the dedicated resolved/closed templates don't cover.
 * Kept brand-consistent with `ticket-resolved.template.ts` but visually
 * neutral so it works for any status.
 */

const STATUS_LABELS: Record<string, string> = {
  new: 'Open',
  in_progress: 'In progress',
  on_hold: 'On hold',
  resolved: 'Resolved',
  closed: 'Closed',
};

function formatStatus(status: string): string {
  return STATUS_LABELS[status] || status;
}

export function getTicketStatusChangeHtml(
  learnerName: string,
  ticketRef: string,
  newStatus: string,
  reason?: string | null,
): string {
  const label = formatStatus(newStatus);
  const reasonRow = reason
    ? `<p style="margin:8px 0 0;font-size:13px;color:#4b5563;font-family:'DM Sans',Arial,sans-serif;">Reason: ${reason}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ticket status updated - PhysioGuidance</title>
</head>
<body style="margin:0;padding:0;background-color:#EEF3F7;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF3F7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

          <tr>
            <td style="background:linear-gradient(135deg,#a37f49,#6b4e24);padding:32px 32px 24px;text-align:center;">
              <span style="font-size:24px;font-weight:700;color:#ffffff;font-family:'DM Sans',Arial,sans-serif;letter-spacing:-0.5px;">Physio</span><span style="font-size:24px;font-weight:700;color:#f5f0e8;font-family:'DM Sans',Arial,sans-serif;letter-spacing:-0.5px;">Guidance</span>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">Ticket status updated</h1>
            </td>
          </tr>

          <tr>
            <td style="padding:8px 32px 24px;">
              <p style="margin:0 0 12px;font-size:14px;color:#4b5563;font-family:'DM Sans',Arial,sans-serif;line-height:1.6;text-align:center;">Hi ${learnerName},</p>
              <p style="margin:0;font-size:14px;color:#4b5563;font-family:'DM Sans',Arial,sans-serif;line-height:1.6;text-align:center;">Ticket <strong>${ticketRef}</strong> is now <strong>${label}</strong>.</p>
              ${reasonRow}
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 24px;text-align:center;">
              <a href="https://physioguidance.org/en/dashboard/support" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#a37f49,#6b4e24);color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;font-family:'DM Sans',Arial,sans-serif;">View ticket</a>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px;background-color:#e5e7eb;"></div>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px 24px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;font-family:'DM Sans',Arial,sans-serif;">&copy; ${new Date().getFullYear()} PhysioGuidance. All rights reserved.</p>
              <p style="margin:0;font-size:11px;color:#9ca3af;font-family:'DM Sans',Arial,sans-serif;">NELC Accredited &middot; Saudi Arabia</p>
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
): string {
  const label = formatStatus(newStatus);
  return `PhysioGuidance - Ticket status updated

Hi ${learnerName},

Ticket ${ticketRef} is now ${label}.${reason ? `\nReason: ${reason}` : ''}

View ticket: https://physioguidance.org/en/dashboard/support

© ${new Date().getFullYear()} PhysioGuidance. All rights reserved.
NELC Accredited · Saudi Arabia`;
}
