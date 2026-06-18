/**
 * Sent to FINANCE / ADMIN / SUPER_ADMIN when a Tamara payment is stuck in
 * post-checkout retry (we got the order_approved webhook but our
 * authorise/capture calls keep failing). Three severity levels mapped to
 * how close we are to Tamara's 72-hour auto-cancel deadline.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type TamaraStuckSeverity = 'warning' | 'urgent' | 'critical';

interface StuckParams {
  severity: TamaraStuckSeverity;
  paymentId: string;
  gatewayChargeId: string;
  buyerName: string;
  buyerEmail: string;
  amount: string;
  hoursStuck: number;
  hoursUntilExpiry: number;
  attempts: number;
  lastError: string | null;
  dashboardUrl: string;
}

function severityCopy(s: TamaraStuckSeverity): {
  emoji: string;
  badge: string;
  badgeBg: string;
  badgeFg: string;
  title: string;
  intro: string;
} {
  if (s === 'critical') {
    return {
      emoji: '\u{1F6A8}',
      badge: 'CRITICAL',
      badgeBg: '#7f1d1d',
      badgeFg: '#ffffff',
      title: 'Tamara payment needs manual intervention NOW',
      intro:
        "A Tamara payment has been stuck for over 60 hours and is hours away from Tamara's 72-hour auto-cancel deadline. Manual capture from the Finance dashboard is required immediately, or Tamara will refund the buyer.",
    };
  }
  if (s === 'urgent') {
    return {
      emoji: '⚠️',
      badge: 'URGENT',
      badgeBg: '#b45309',
      badgeFg: '#ffffff',
      title: 'Tamara payment stuck — finance review needed',
      intro:
        "A Tamara payment hasn't successfully captured after 48 hours of automatic retries. Please open the Finance dashboard and click 'Retry Capture'. If retry continues failing, escalate.",
    };
  }
  return {
    emoji: '⚡',
    badge: 'WARNING',
    badgeBg: '#1d4ed8',
    badgeFg: '#ffffff',
    title: 'Tamara payment retry in progress',
    intro:
      "A Tamara payment received its approval webhook but our authorise/capture calls keep failing. The retry job is still trying every 10 minutes. No action needed yet unless you want to investigate.",
  };
}

export function getTamaraStuckAlertHtml(params: StuckParams): string {
  const c = severityCopy(params.severity);
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tamara payment alert - PhysioGuidance</title>
</head>
<body style="margin:0;padding:0;background-color:#EEF3F7;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF3F7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:linear-gradient(135deg,#a37f49,#6b4e24);padding:32px 32px 24px;text-align:center;">
              <span style="font-size:24px;font-weight:700;color:#ffffff;">Physio</span><span style="font-size:24px;font-weight:700;color:#f5f0e8;">Guidance</span>
              <br/><span style="font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:1px;text-transform:uppercase;">Finance Alert</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <span style="display:inline-block;padding:6px 14px;background-color:${c.badgeBg};color:${c.badgeFg};font-size:11px;font-weight:700;letter-spacing:1px;border-radius:999px;">${c.emoji} ${c.badge}</span>
              <h1 style="margin:18px 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;">${escapeHtml(c.title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 16px;">
              <p style="margin:0 0 16px;font-size:14px;color:#404040;line-height:1.6;">${escapeHtml(c.intro)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:10px;border:1px solid #e5e7eb;">
                <tr><td style="padding:20px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr><td style="padding:4px 0;font-size:13px;color:#737373;width:40%;">Buyer:</td><td style="padding:4px 0;font-size:13px;color:#1a1a1a;font-weight:600;">${escapeHtml(params.buyerName)}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#737373;">Buyer email:</td><td style="padding:4px 0;font-size:13px;color:#1a1a1a;">${escapeHtml(params.buyerEmail)}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#737373;">Amount:</td><td style="padding:4px 0;font-size:13px;color:#1a1a1a;font-weight:600;">SAR ${escapeHtml(params.amount)}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#737373;">Payment ID:</td><td style="padding:4px 0;font-size:12px;color:#1a1a1a;font-family:monospace;">${escapeHtml(params.paymentId)}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#737373;">Tamara order:</td><td style="padding:4px 0;font-size:12px;color:#1a1a1a;font-family:monospace;">${escapeHtml(params.gatewayChargeId)}</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#737373;">Stuck for:</td><td style="padding:4px 0;font-size:13px;color:#b91c1c;font-weight:600;">${params.hoursStuck} hours</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#737373;">Time until Tamara cancels:</td><td style="padding:4px 0;font-size:13px;color:#b91c1c;font-weight:600;">${params.hoursUntilExpiry} hours</td></tr>
                    <tr><td style="padding:4px 0;font-size:13px;color:#737373;">Retry attempts:</td><td style="padding:4px 0;font-size:13px;color:#1a1a1a;">${params.attempts}</td></tr>
                    ${params.lastError ? `<tr><td style="padding:4px 0;font-size:13px;color:#737373;vertical-align:top;">Last error:</td><td style="padding:4px 0;font-size:12px;color:#b91c1c;font-family:monospace;word-break:break-all;">${escapeHtml(params.lastError)}</td></tr>` : ''}
                  </table>
                </td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;text-align:center;">
              <a href="${params.dashboardUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#a37f49,#6b4e24);color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;">Open finance dashboard</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getTamaraStuckAlertText(params: StuckParams): string {
  const c = severityCopy(params.severity);
  return [
    `[${c.badge}] ${c.title}`,
    '',
    c.intro,
    '',
    `Buyer:                 ${params.buyerName} <${params.buyerEmail}>`,
    `Amount:                SAR ${params.amount}`,
    `Payment ID:            ${params.paymentId}`,
    `Tamara order id:       ${params.gatewayChargeId}`,
    `Stuck for:             ${params.hoursStuck} hours`,
    `Hours until cancel:    ${params.hoursUntilExpiry}`,
    `Retry attempts so far: ${params.attempts}`,
    params.lastError ? `Last error:            ${params.lastError}` : null,
    '',
    `Open finance dashboard: ${params.dashboardUrl}`,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}
