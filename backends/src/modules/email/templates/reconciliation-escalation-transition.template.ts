/**
 * Sent to the finance user who created an escalation when admin transitions
 * it (sent_back, declined, or resolved). Single template + variant copy so
 * we don't fan out into three near-identical files.
 */

type TransitionKind = 'sent_back' | 'declined' | 'resolved';

const COPY: Record<TransitionKind, { heading: string; body: string; cta: string }> = {
  sent_back: {
    heading: 'Admin sent your escalation back',
    body: "Admin needs more information before they can act on the escalation you raised. Open the finding in the reconciliation page and add the requested details, then re-escalate.",
    cta: 'Open finding',
  },
  declined: {
    heading: 'Admin closed your escalation without action',
    body: "Admin reviewed the escalation and decided it doesn't need action. Their reasoning is recorded on the escalation page.",
    cta: 'View escalation',
  },
  resolved: {
    heading: 'Your escalation has been resolved',
    body: 'Admin completed the action you requested. The underlying reconciliation finding is now marked resolved with the resolution note recorded.',
    cta: 'View escalation',
  },
};

export function getReconciliationEscalationTransitionHtml(params: {
  escalationId: string;
  kind: TransitionKind;
  escalationUrl: string;
}): string {
  const copy = COPY[params.kind];
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${copy.heading} - PhysioGuidance</title>
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
              <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1a1a1a;">${copy.heading}</h1>
              <p style="margin:0 0 16px;font-size:14px;color:#525252;line-height:1.6;">${copy.body}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <a href="${params.escalationUrl}" style="display:inline-block;padding:12px 24px;background-color:#a37f49;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">${copy.cta}</a>
              <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;">Reference: <span style="font-family:monospace;">${params.escalationId}</span></p>
            </td>
          </tr>
          <tr><td style="padding:0 32px;"><div style="height:1px;background-color:#e5e7eb;"></div></td></tr>
          <tr>
            <td style="padding:20px 32px 24px;text-align:center;">
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

export function getReconciliationEscalationTransitionText(params: {
  escalationId: string;
  kind: TransitionKind;
  escalationUrl: string;
}): string {
  const copy = COPY[params.kind];
  return `PhysioGuidance - ${copy.heading}

${copy.body}

Open: ${params.escalationUrl}
Reference: ${params.escalationId}

© ${new Date().getFullYear()} PhysioGuidance.`;
}
