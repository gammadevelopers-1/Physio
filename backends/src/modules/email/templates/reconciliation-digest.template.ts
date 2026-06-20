/**
 * Daily reconciliation digest. Sent by the cron after the nightly scan,
 * to all finance + admin users. Summarises what was scanned, what drifted,
 * what auto-escalated, and the current backlog. Quiet by design — even on
 * a clean day finance still gets a "0 drifts found" line so they know the
 * cron ran.
 */

export interface ReconciliationDigestParams {
  scanDate: string; // human-friendly date string
  perGateway: Array<{
    gateway: string;
    scanned: number;
    drifts: number;
    autoEscalated: number;
  }>;
  topAutoEscalations: Array<{
    urgency: 'low' | 'normal' | 'high';
    driftType: string;
    amount: string | null;
    customer: string;
    ageHours: number;
    url: string;
  }>;
  pendingFromPriorDays: number;
  oldestPendingDays: number | null;
  dashboardUrl: string;
}

export function getReconciliationDigestHtml(p: ReconciliationDigestParams): string {
  const totalDrifts = p.perGateway.reduce((s, g) => s + g.drifts, 0);
  const totalAuto = p.perGateway.reduce((s, g) => s + g.autoEscalated, 0);

  const gatewayRows = p.perGateway
    .map(
      (g) => `
      <tr>
        <td style="padding:6px 8px;font-size:13px;color:#1a1a1a;text-transform:capitalize;">${g.gateway.replace(/_/g, ' ')}</td>
        <td style="padding:6px 8px;font-size:13px;color:#525252;text-align:right;">${g.scanned}</td>
        <td style="padding:6px 8px;font-size:13px;color:${g.drifts > 0 ? '#b91c1c' : '#525252'};text-align:right;font-weight:${g.drifts > 0 ? '600' : 'normal'};">${g.drifts}</td>
        <td style="padding:6px 8px;font-size:13px;color:${g.autoEscalated > 0 ? '#7c3aed' : '#525252'};text-align:right;font-weight:${g.autoEscalated > 0 ? '600' : 'normal'};">${g.autoEscalated}</td>
      </tr>`,
    )
    .join('');

  const escalationRows = p.topAutoEscalations.length
    ? p.topAutoEscalations
        .map((e) => {
          const urgencyBg = e.urgency === 'high' ? '#fee2e2' : '#dbeafe';
          const urgencyText = e.urgency === 'high' ? '#b91c1c' : '#1d4ed8';
          return `
          <tr>
            <td style="padding:8px;font-size:12px;border-bottom:1px solid #f3f4f6;">
              <span style="display:inline-block;padding:2px 8px;background-color:${urgencyBg};color:${urgencyText};border-radius:4px;font-size:10px;font-weight:600;text-transform:uppercase;">${e.urgency}</span>
              <strong style="margin-left:6px;">${e.driftType.replace(/_/g, ' ')}</strong>
              ${e.amount ? ` · ${e.amount}` : ''}<br/>
              <span style="color:#737373;">${e.customer} · ${e.ageHours}h old</span><br/>
              <a href="${e.url}" style="color:#a37f49;font-size:11px;">Open escalation →</a>
            </td>
          </tr>`;
        })
        .join('')
    : `<tr><td style="padding:12px 8px;font-size:13px;color:#737373;text-align:center;">No new auto-escalations today.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reconciliation Digest - ${p.scanDate}</title>
</head>
<body style="margin:0;padding:0;background-color:#EEF3F7;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF3F7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:linear-gradient(135deg,#a37f49,#6b4e24);padding:28px 32px;text-align:center;">
              <span style="font-size:22px;font-weight:700;color:#ffffff;">Physio</span><span style="font-size:22px;font-weight:700;color:#f5f0e8;">Guidance</span>
              <br/><span style="font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:1px;text-transform:uppercase;">Reconciliation Digest · ${p.scanDate}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 0;">
              <p style="margin:0 0 12px;font-size:15px;color:#1a1a1a;line-height:1.5;">
                Yesterday's scan found <strong>${totalDrifts} drift${totalDrifts === 1 ? '' : 's'}</strong> across all gateways.${totalAuto > 0 ? ` <strong style="color:#7c3aed;">${totalAuto} auto-escalated</strong> for admin action.` : ''}
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:12px 0;">
                <thead>
                  <tr style="background-color:#f9fafb;">
                    <th style="padding:8px;font-size:11px;color:#737373;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Gateway</th>
                    <th style="padding:8px;font-size:11px;color:#737373;text-align:right;text-transform:uppercase;letter-spacing:0.5px;">Scanned</th>
                    <th style="padding:8px;font-size:11px;color:#737373;text-align:right;text-transform:uppercase;letter-spacing:0.5px;">Drifts</th>
                    <th style="padding:8px;font-size:11px;color:#737373;text-align:right;text-transform:uppercase;letter-spacing:0.5px;">Auto-esc</th>
                  </tr>
                </thead>
                <tbody>${gatewayRows}</tbody>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px;">
              <h2 style="margin:16px 0 8px;font-size:14px;font-weight:600;color:#1a1a1a;text-transform:uppercase;letter-spacing:0.5px;">Top auto-escalations</h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                ${escalationRows}
              </table>
            </td>
          </tr>
          ${
            p.pendingFromPriorDays > 0
              ? `<tr>
            <td style="padding:16px 32px 0;">
              <div style="padding:12px;background-color:#fef3c7;border-radius:8px;font-size:13px;color:#92400e;">
                <strong>${p.pendingFromPriorDays}</strong> escalation${p.pendingFromPriorDays === 1 ? '' : 's'} still pending from prior days${p.oldestPendingDays ? ` (oldest: ${p.oldestPendingDays} days)` : ''}.
              </div>
            </td>
          </tr>`
              : ''
          }
          <tr>
            <td style="padding:24px 32px;text-align:center;">
              <a href="${p.dashboardUrl}" style="display:inline-block;padding:10px 22px;background-color:#a37f49;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Open reconciliation dashboard</a>
            </td>
          </tr>
          <tr><td style="padding:0 32px;"><div style="height:1px;background-color:#e5e7eb;"></div></td></tr>
          <tr>
            <td style="padding:16px 32px 24px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#9ca3af;">Daily 02:00 KSA · Configure thresholds in admin → finance → settings.</p>
              <p style="margin:6px 0 0;font-size:11px;color:#9ca3af;">&copy; ${new Date().getFullYear()} PhysioGuidance.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getReconciliationDigestText(p: ReconciliationDigestParams): string {
  const totalDrifts = p.perGateway.reduce((s, g) => s + g.drifts, 0);
  const totalAuto = p.perGateway.reduce((s, g) => s + g.autoEscalated, 0);
  const gatewayLines = p.perGateway
    .map((g) => `  ${g.gateway}: ${g.scanned} scanned, ${g.drifts} drifts, ${g.autoEscalated} auto-escalated`)
    .join('\n');
  const escalationLines = p.topAutoEscalations.length
    ? p.topAutoEscalations
        .map(
          (e) =>
            `  [${e.urgency.toUpperCase()}] ${e.driftType} ${e.amount ? '· ' + e.amount + ' ' : ''}· ${e.customer} · ${e.ageHours}h old\n    ${e.url}`,
        )
        .join('\n')
    : '  No new auto-escalations today.';

  return `PhysioGuidance - Reconciliation Digest ${p.scanDate}

Yesterday's scan found ${totalDrifts} drifts across all gateways.${totalAuto > 0 ? ' ' + totalAuto + ' auto-escalated.' : ''}

Per gateway:
${gatewayLines}

Top auto-escalations:
${escalationLines}

${p.pendingFromPriorDays > 0 ? p.pendingFromPriorDays + ' escalations still pending from prior days' + (p.oldestPendingDays ? ' (oldest: ' + p.oldestPendingDays + ' days).' : '.') + '\n\n' : ''}Dashboard: ${p.dashboardUrl}

Daily 02:00 KSA. © ${new Date().getFullYear()} PhysioGuidance.`;
}
