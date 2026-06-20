/**
 * Sent to ADMIN + SUPER_ADMIN users when finance escalates a reconciliation
 * finding. High-urgency escalations get a URGENT prefix in the subject (the
 * EmailService caller adds it) and a coloured warning band in the body.
 */
export function getReconciliationEscalationCreatedHtml(params: {
  escalationId: string;
  urgency: 'low' | 'normal' | 'high';
  escalationUrl: string;
}): string {
  const isHigh = params.urgency === 'high';
  const bandColor = isHigh ? '#fee2e2' : '#dbeafe';
  const bandText = isHigh ? '#b91c1c' : '#1d4ed8';
  const urgencyLabel = isHigh ? 'High urgency' : params.urgency === 'low' ? 'Low urgency' : 'Normal urgency';

  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reconciliation Escalation - PhysioGuidance</title>
</head>
<body style="margin:0;padding:0;background-color:#EEF3F7;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF3F7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:linear-gradient(135deg,#a37f49,#6b4e24);padding:32px 32px 24px;text-align:center;">
              <span style="font-size:24px;font-weight:700;color:#ffffff;">Physio</span><span style="font-size:24px;font-weight:700;color:#f5f0e8;">Guidance</span>
              <br/><span style="font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:1px;text-transform:uppercase;">Finance · Reconciliation</span>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 0;">
              <div style="display:inline-block;padding:6px 12px;background-color:${bandColor};color:${bandText};border-radius:6px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">
                ${urgencyLabel}
              </div>
              <h1 style="margin:16px 0 8px;font-size:20px;font-weight:700;color:#1a1a1a;">A reconciliation finding needs your review</h1>
              <p style="margin:0 0 16px;font-size:14px;color:#525252;line-height:1.6;">
                Finance has escalated a drift between our payment records and a gateway. The full context — who, what gateway, customer, payment details, and finance's note — is on the escalation page.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <a href="${params.escalationUrl}" style="display:inline-block;padding:12px 24px;background-color:#a37f49;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Open escalation</a>
              <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">Reference: <span style="font-family:monospace;">${params.escalationId}</span></p>
            </td>
          </tr>
          <tr><td style="padding:0 32px;"><div style="height:1px;background-color:#e5e7eb;"></div></td></tr>
          <tr>
            <td style="padding:20px 32px 24px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">You're receiving this because you have admin access to the finance dashboard.</p>
              <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} PhysioGuidance. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getReconciliationEscalationCreatedText(params: {
  escalationId: string;
  urgency: 'low' | 'normal' | 'high';
  escalationUrl: string;
}): string {
  const urgencyLabel =
    params.urgency === 'high' ? '[URGENT]' : params.urgency === 'low' ? '[Low]' : '[Normal]';
  return `PhysioGuidance - Reconciliation Escalation ${urgencyLabel}

Finance has escalated a reconciliation finding that needs admin review.

Open the escalation: ${params.escalationUrl}

Reference: ${params.escalationId}

© ${new Date().getFullYear()} PhysioGuidance.`;
}
