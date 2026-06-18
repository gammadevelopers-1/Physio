/**
 * Sent to the student when finance rejects their bank transfer receipt.
 * Includes the reviewer's note (always required from finance) and tells
 * them how to re-upload — the payment row stays in 'pending' so re-upload
 * works without a brand-new checkout.
 */
export function getBankTransferRejectedHtml(params: {
  studentName: string;
  courseName: string;
  amount: string;
  currency: string;
  paymentId: string;
  reviewerNote: string;
  uploadUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bank Transfer Receipt Rejected - PhysioGuidance</title>
</head>
<body style="margin:0;padding:0;background-color:#EEF3F7;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF3F7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:linear-gradient(135deg,#a37f49,#6b4e24);padding:32px 32px 24px;text-align:center;">
              <span style="font-size:24px;font-weight:700;color:#ffffff;font-family:'DM Sans',Arial,sans-serif;">Physio</span><span style="font-size:24px;font-weight:700;color:#f5f0e8;font-family:'DM Sans',Arial,sans-serif;">Guidance</span>
              <br/><span style="font-size:11px;color:rgba(255,255,255,0.7);font-family:'DM Sans',Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;">NELC Accredited Platform</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="width:56px;height:56px;background-color:#fee2e2;border-radius:50%;text-align:center;vertical-align:middle;">
                    <span style="font-size:28px;line-height:56px;">&#9888;&#65039;</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">We couldn't approve your receipt</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#737373;font-family:'DM Sans',Arial,sans-serif;">Hi ${params.studentName},</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 16px;">
              <p style="margin:0 0 16px;font-size:14px;color:#404040;line-height:1.6;font-family:'DM Sans',Arial,sans-serif;">
                Our finance team reviewed your bank transfer receipt for <strong>${params.courseName}</strong> but couldn't approve it. Here's what they noted:
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff7ed;border-radius:10px;border:1px solid #fed7aa;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0;font-size:14px;color:#7c2d12;line-height:1.5;font-family:'DM Sans',Arial,sans-serif;">${escapeHtml(params.reviewerNote)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="margin:0 0 16px;font-size:14px;color:#404040;line-height:1.6;font-family:'DM Sans',Arial,sans-serif;">
                You can upload a new receipt — your payment is still active. If you've already transferred the amount, please attach a clearer copy of the proof. If you've not yet transferred, the payment details are still on the upload page.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td align="center" style="background:#a37f49;border-radius:8px;">
                    <a href="${params.uploadUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;font-family:'DM Sans',Arial,sans-serif;">Upload a new receipt</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:10px;border:1px solid #e5e7eb;">
                <tr>
                  <td style="padding:18px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="padding:4px 0;font-size:13px;color:#737373;">Course:</td><td style="padding:4px 0;font-size:13px;color:#1a1a1a;font-weight:600;">${params.courseName}</td></tr>
                      <tr><td style="padding:4px 0;font-size:13px;color:#737373;">Amount:</td><td style="padding:4px 0;font-size:13px;color:#1a1a1a;font-weight:600;">${params.currency} ${params.amount}</td></tr>
                      <tr><td style="padding:4px 0;font-size:13px;color:#737373;">Reference:</td><td style="padding:4px 0;font-size:13px;color:#1a1a1a;font-weight:600;font-family:monospace;">${params.paymentId}</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="padding:0 32px;"><div style="height:1px;background-color:#e5e7eb;"></div></td></tr>
          <tr>
            <td style="padding:20px 32px 24px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;font-family:'DM Sans',Arial,sans-serif;">If you have questions, reply to this email or contact our support team.</p>
              <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;font-family:'DM Sans',Arial,sans-serif;">&copy; ${new Date().getFullYear()} PhysioGuidance. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getBankTransferRejectedText(params: {
  studentName: string;
  courseName: string;
  amount: string;
  currency: string;
  paymentId: string;
  reviewerNote: string;
  uploadUrl: string;
}): string {
  return `PhysioGuidance - Receipt Rejected

Hi ${params.studentName},

Our finance team reviewed your bank transfer receipt for ${params.courseName} but couldn't approve it. Here's what they noted:

"${params.reviewerNote}"

You can upload a new receipt — your payment is still active. Upload here: ${params.uploadUrl}

Course: ${params.courseName}
Amount: ${params.currency} ${params.amount}
Reference: ${params.paymentId}

If you have questions, reply to this email or contact our support team.

© ${new Date().getFullYear()} PhysioGuidance. All rights reserved.`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
