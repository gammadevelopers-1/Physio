export function getRefundRequestedHtml(params: {
  studentName: string;
  amount: string;
  currency: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#EEF3F7;font-family:'DM Sans',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF3F7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr><td style="background:linear-gradient(135deg,#a37f49,#6b4e24);padding:32px;text-align:center;"><span style="font-size:24px;font-weight:700;color:#fff;">Physio</span><span style="font-size:24px;font-weight:700;color:#f5f0e8;">Guidance</span></td></tr>
          <tr>
            <td style="padding:32px;text-align:center;">
              <h1 style="margin:0 0 16px;font-size:22px;color:#1a1a1a;">Refund Request Received</h1>
              <p style="font-size:14px;color:#737373;">Hi ${params.studentName},</p>
              <p style="font-size:14px;color:#737373;">We have received your refund request for <strong>${params.currency} ${params.amount}</strong>. Our finance team will review it shortly.</p>
            </td>
          </tr>
          <tr><td style="padding:20px 32px;text-align:center;"><p style="font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} PhysioGuidance</p></td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getRefundRequestedText(params: { studentName: string; amount: string; currency: string }): string {
  return `Hi ${params.studentName}, We have received your refund request for ${params.currency} ${params.amount}. Our finance team will review it shortly.`;
}

/**
 * Optional "partial approval" block. Present only when finance approved
 * less than the amount the student requested — carries the delta + reason
 * so the recipient understands why the payout is smaller than the ask.
 */
export type PartialApprovalInfo = {
  requestedAmount: string;
  reason: string;
};

function partialBlockHtml(
  info: PartialApprovalInfo | undefined,
  approvedAmount: string,
  currency: string,
): string {
  if (!info) return '';
  return `
    <div style="margin:16px 0;padding:14px 16px;background-color:#fffbeb;border:1px solid #fde68a;border-radius:8px;text-align:left;">
      <p style="margin:0 0 6px;font-size:13px;color:#92400e;font-weight:700;">Partial approval</p>
      <p style="margin:0 0 4px;font-size:13px;color:#78350f;">You requested <strong>${currency} ${info.requestedAmount}</strong>. This refund was approved for <strong>${currency} ${approvedAmount}</strong>.</p>
      <p style="margin:0;font-size:13px;color:#78350f;"><strong>Reason:</strong> ${info.reason}</p>
    </div>`;
}

function partialBlockText(
  info: PartialApprovalInfo | undefined,
  approvedAmount: string,
  currency: string,
): string {
  if (!info) return '';
  return ` (Partial approval: you requested ${currency} ${info.requestedAmount}, approved for ${currency} ${approvedAmount}. Reason: ${info.reason})`;
}

export function getRefundApprovedHtml(params: {
  studentName: string;
  amount: string;
  currency: string;
  partial?: PartialApprovalInfo;
}): string {
  const partial = partialBlockHtml(params.partial, params.amount, params.currency);
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background-color:#EEF3F7;font-family:'DM Sans',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF3F7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#fff;border-radius:16px;overflow:hidden;">
          <tr><td style="background:linear-gradient(135deg,#a37f49,#6b4e24);padding:32px;text-align:center;"><span style="font-size:24px;font-weight:700;color:#fff;">Physio</span><span style="font-size:24px;font-weight:700;color:#f5f0e8;">Guidance</span></td></tr>
          <tr>
            <td style="padding:32px;text-align:center;">
              <h1 style="margin:0 0 16px;font-size:22px;color:#1a1a1a;">Refund Approved</h1>
              <p style="font-size:14px;color:#737373;">Hi ${params.studentName},</p>
              <p style="font-size:14px;color:#737373;">Your refund of <strong>${params.currency} ${params.amount}</strong> has been approved and is being processed. You will receive the funds shortly.</p>
              ${partial}
            </td>
          </tr>
          <tr><td style="padding:20px 32px;text-align:center;"><p style="font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} PhysioGuidance</p></td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getRefundApprovedText(params: {
  studentName: string;
  amount: string;
  currency: string;
  partial?: PartialApprovalInfo;
}): string {
  return `Hi ${params.studentName}, Your refund of ${params.currency} ${params.amount} has been approved and is being processed.${partialBlockText(params.partial, params.amount, params.currency)}`;
}

export function getRefundRejectedHtml(params: { studentName: string; rejectionNote: string }): string {
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background-color:#EEF3F7;font-family:'DM Sans',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF3F7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#fff;border-radius:16px;overflow:hidden;">
          <tr><td style="background:linear-gradient(135deg,#a37f49,#6b4e24);padding:32px;text-align:center;"><span style="font-size:24px;font-weight:700;color:#fff;">Physio</span><span style="font-size:24px;font-weight:700;color:#f5f0e8;">Guidance</span></td></tr>
          <tr>
            <td style="padding:32px;text-align:center;">
              <h1 style="margin:0 0 16px;font-size:22px;color:#1a1a1a;">Refund Request Update</h1>
              <p style="font-size:14px;color:#737373;">Hi ${params.studentName},</p>
              <p style="font-size:14px;color:#737373;">Unfortunately, your refund request has been declined.</p>
              <p style="font-size:14px;color:#737373;"><strong>Reason:</strong> ${params.rejectionNote}</p>
              <p style="font-size:14px;color:#737373;">If you have questions, please contact our support team.</p>
            </td>
          </tr>
          <tr><td style="padding:20px 32px;text-align:center;"><p style="font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} PhysioGuidance</p></td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getRefundRejectedText(params: { studentName: string; rejectionNote: string }): string {
  return `Hi ${params.studentName}, Your refund request has been declined. Reason: ${params.rejectionNote}. If you have questions, please contact our support team.`;
}

export function getRefundCompletedHtml(params: {
  studentName: string;
  originalAmount: string;
  deductionAmount: string;
  refundAmount: string;
  currency: string;
  partial?: PartialApprovalInfo;
}): string {
  const hasDeduction = Number(params.deductionAmount) > 0;
  const partial = partialBlockHtml(params.partial, params.refundAmount, params.currency);
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background-color:#EEF3F7;font-family:'DM Sans',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF3F7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#fff;border-radius:16px;overflow:hidden;">
          <tr><td style="background:linear-gradient(135deg,#a37f49,#6b4e24);padding:32px;text-align:center;"><span style="font-size:24px;font-weight:700;color:#fff;">Physio</span><span style="font-size:24px;font-weight:700;color:#f5f0e8;">Guidance</span></td></tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;font-size:22px;color:#1a1a1a;text-align:center;">Refund Completed</h1>
              <p style="font-size:14px;color:#737373;">Hi ${params.studentName},</p>
              <p style="font-size:14px;color:#737373;">Your refund has been processed successfully. Here is your refund breakdown:</p>
              <table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;margin:16px 0;font-size:14px;">
                <tr style="background-color:#f9fafb;">
                  <td style="color:#374151;padding:10px 14px;">Original Amount</td>
                  <td style="color:#374151;text-align:right;padding:10px 14px;">${params.currency} ${params.originalAmount}</td>
                </tr>
                ${hasDeduction ? `<tr>
                  <td style="color:#374151;padding:10px 14px;">Processing Fee Deduction</td>
                  <td style="color:#dc2626;text-align:right;padding:10px 14px;">− ${params.currency} ${params.deductionAmount}</td>
                </tr>` : ''}
                <tr style="border-top:2px solid #e5e7eb;">
                  <td style="color:#1a1a1a;font-weight:700;padding:12px 14px;">Refunded to You</td>
                  <td style="color:#16a34a;font-weight:700;text-align:right;padding:12px 14px;">${params.currency} ${params.refundAmount}</td>
                </tr>
              </table>
              ${partial}
              <p style="font-size:14px;color:#737373;">Funds should appear in your account within 5–10 business days depending on your payment provider.</p>
            </td>
          </tr>
          <tr><td style="padding:20px 32px;text-align:center;"><p style="font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} PhysioGuidance</p></td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getRefundCompletedText(params: {
  studentName: string;
  originalAmount: string;
  deductionAmount: string;
  refundAmount: string;
  currency: string;
  partial?: PartialApprovalInfo;
}): string {
  const deductionLine = Number(params.deductionAmount) > 0
    ? ` Processing fee deducted: ${params.currency} ${params.deductionAmount}.`
    : '';
  return `Hi ${params.studentName}, Your refund has been completed. Original amount: ${params.currency} ${params.originalAmount}.${deductionLine} Amount refunded to you: ${params.currency} ${params.refundAmount}. Funds should appear within 5-10 business days.${partialBlockText(params.partial, params.refundAmount, params.currency)}`;
}
