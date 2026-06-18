/**
 * Sent to the student immediately after they upload a bank transfer receipt.
 * Acknowledges the upload, tells them finance will review within ~1 business
 * day, and sets expectations (no enrollment until approval).
 */
export function getBankTransferReceivedHtml(params: {
  studentName: string;
  courseName: string;
  amount: string;
  currency: string;
  paymentId: string;
  uploadedAt: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Receipt Received - PhysioGuidance</title>
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
                  <td style="width:56px;height:56px;background-color:#dbeafe;border-radius:50%;text-align:center;vertical-align:middle;">
                    <span style="font-size:28px;line-height:56px;">&#128229;</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">We received your receipt</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#737373;font-family:'DM Sans',Arial,sans-serif;">Hi ${params.studentName},</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 16px;">
              <p style="margin:0 0 16px;font-size:14px;color:#404040;line-height:1.6;font-family:'DM Sans',Arial,sans-serif;">
                Thank you. Your bank transfer receipt has been received and is now in our finance team's review queue.
                We typically complete reviews within <strong>1 business day</strong>. You'll get another email as soon as your payment is approved and your enrollment is active.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:10px;border:1px solid #e5e7eb;">
                <tr>
                  <td style="padding:20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="padding:4px 0;font-size:13px;color:#737373;">Course:</td><td style="padding:4px 0;font-size:13px;color:#1a1a1a;font-weight:600;">${params.courseName}</td></tr>
                      <tr><td style="padding:4px 0;font-size:13px;color:#737373;">Amount:</td><td style="padding:4px 0;font-size:13px;color:#1a1a1a;font-weight:600;">${params.currency} ${params.amount}</td></tr>
                      <tr><td style="padding:4px 0;font-size:13px;color:#737373;">Reference:</td><td style="padding:4px 0;font-size:13px;color:#1a1a1a;font-weight:600;font-family:monospace;">${params.paymentId}</td></tr>
                      <tr><td style="padding:4px 0;font-size:13px;color:#737373;">Uploaded:</td><td style="padding:4px 0;font-size:13px;color:#1a1a1a;font-weight:600;">${params.uploadedAt}</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;text-align:center;">
              <p style="margin:0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;">
                If your receipt needs to be re-uploaded, you can do so from your dashboard under "Payment History."
              </p>
            </td>
          </tr>
          <tr><td style="padding:0 32px;"><div style="height:1px;background-color:#e5e7eb;"></div></td></tr>
          <tr>
            <td style="padding:20px 32px 24px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;font-family:'DM Sans',Arial,sans-serif;">&copy; ${new Date().getFullYear()} PhysioGuidance. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getBankTransferReceivedText(params: {
  studentName: string;
  courseName: string;
  amount: string;
  currency: string;
  paymentId: string;
  uploadedAt: string;
}): string {
  return `PhysioGuidance - Receipt Received

Hi ${params.studentName},

Thank you. Your bank transfer receipt has been received and is now in our finance team's review queue. We typically complete reviews within 1 business day. You'll get another email as soon as your payment is approved and your enrollment is active.

Course: ${params.courseName}
Amount: ${params.currency} ${params.amount}
Reference: ${params.paymentId}
Uploaded: ${params.uploadedAt}

If your receipt needs to be re-uploaded, you can do so from your dashboard under "Payment History."

© ${new Date().getFullYear()} PhysioGuidance. All rights reserved.`;
}
