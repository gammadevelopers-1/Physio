/**
 * Refund lifecycle emails — 4 variants: requested, approved, rejected,
 * completed. All bilingual (EN + AR).
 */
import { EmailLocale, getEmailStrings, htmlAttrs, t as tt, textAlign } from '../email-i18n';

export type PartialApprovalInfo = {
  requestedAmount: string;
  reason: string;
};

/**
 * Partial-approval highlight block. Present only when finance approved less
 * than the full requested amount.
 */
function partialBlockHtml(
  info: PartialApprovalInfo | undefined,
  approvedAmount: string,
  currency: string,
  locale: EmailLocale,
): string {
  if (!info) return '';
  const s = getEmailStrings(locale);
  const align = textAlign(locale);
  return `
    <div style="margin:16px 0;padding:14px 16px;background-color:#fffbeb;border:1px solid #fde68a;border-radius:8px;text-align:${align};">
      <p style="margin:0 0 6px;font-size:13px;color:#92400e;font-weight:700;">${s.refundPartialTitle}</p>
      <p style="margin:0 0 4px;font-size:13px;color:#78350f;">${tt(s.refundPartialBody, { currency, requested: info.requestedAmount, approved: approvedAmount })}</p>
      <p style="margin:0;font-size:13px;color:#78350f;"><strong>${s.refundReasonLabel}</strong> ${info.reason}</p>
    </div>`;
}

function partialBlockText(
  info: PartialApprovalInfo | undefined,
  approvedAmount: string,
  currency: string,
  locale: EmailLocale,
): string {
  if (!info) return '';
  const s = getEmailStrings(locale);
  return ` (${s.refundPartialTitle}: ${tt(s.refundPartialBody, { currency, requested: info.requestedAmount, approved: approvedAmount })} ${s.refundReasonLabel} ${info.reason})`;
}

/* ── requested ───────────────────────────────────────── */
interface RequestedParams {
  studentName: string;
  amount: string;
  currency: string;
}
export function getRefundRequestedHtml(params: RequestedParams, locale: EmailLocale = 'en'): string {
  const s = getEmailStrings(locale);
  return `<!DOCTYPE html>
<html ${htmlAttrs(locale)}>
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#EEF3F7;font-family:'DM Sans',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF3F7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr><td style="background:linear-gradient(135deg,#a37f49,#6b4e24);padding:32px;text-align:center;"><span style="font-size:24px;font-weight:700;color:#fff;">Physio</span><span style="font-size:24px;font-weight:700;color:#f5f0e8;">Guidance</span></td></tr>
          <tr>
            <td style="padding:32px;text-align:center;">
              <h1 style="margin:0 0 16px;font-size:22px;color:#1a1a1a;">${s.refundSubmittedTitle}</h1>
              <p style="font-size:14px;color:#737373;text-align:${textAlign(locale)};">${s.hi} ${params.studentName},</p>
              <p style="font-size:14px;color:#737373;text-align:${textAlign(locale)};">${s.refundSubmittedBody}</p>
              <p style="font-size:14px;color:#1a1a1a;font-weight:600;">${s.refundAmountLabel} ${params.currency} ${params.amount}</p>
              <p style="font-size:13px;color:#9ca3af;text-align:${textAlign(locale)};">${s.refundReviewTimeNote}</p>
            </td>
          </tr>
          <tr><td style="padding:20px 32px;text-align:center;"><p style="font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}</p></td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
export function getRefundRequestedText(params: RequestedParams, locale: EmailLocale = 'en'): string {
  const s = getEmailStrings(locale);
  return `${s.hi} ${params.studentName},\n\n${s.refundSubmittedBody}\n${s.refundAmountLabel} ${params.currency} ${params.amount}\n\n${s.refundReviewTimeNote}\n\n© ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}`;
}

/* ── approved ────────────────────────────────────────── */
interface ApprovedParams {
  studentName: string;
  amount: string;
  currency: string;
  partial?: PartialApprovalInfo;
}
export function getRefundApprovedHtml(params: ApprovedParams, locale: EmailLocale = 'en'): string {
  const s = getEmailStrings(locale);
  const partial = partialBlockHtml(params.partial, params.amount, params.currency, locale);
  return `<!DOCTYPE html>
<html ${htmlAttrs(locale)}>
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background-color:#EEF3F7;font-family:'DM Sans',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF3F7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#fff;border-radius:16px;overflow:hidden;">
          <tr><td style="background:linear-gradient(135deg,#a37f49,#6b4e24);padding:32px;text-align:center;"><span style="font-size:24px;font-weight:700;color:#fff;">Physio</span><span style="font-size:24px;font-weight:700;color:#f5f0e8;">Guidance</span></td></tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;font-size:22px;color:#1a1a1a;text-align:center;">${s.refundApprovedTitle}</h1>
              <p style="font-size:14px;color:#737373;text-align:${textAlign(locale)};">${s.hi} ${params.studentName},</p>
              <p style="font-size:14px;color:#737373;text-align:${textAlign(locale)};">${s.refundApprovedBody}</p>
              <p style="font-size:14px;color:#1a1a1a;font-weight:600;text-align:${textAlign(locale)};">${s.refundAmountLabel} ${params.currency} ${params.amount}</p>
              <p style="font-size:13px;color:#9ca3af;text-align:${textAlign(locale)};">${s.refundApprovedEta}</p>
              ${partial}
            </td>
          </tr>
          <tr><td style="padding:20px 32px;text-align:center;"><p style="font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}</p></td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
export function getRefundApprovedText(params: ApprovedParams, locale: EmailLocale = 'en'): string {
  const s = getEmailStrings(locale);
  return `${s.hi} ${params.studentName},\n\n${s.refundApprovedBody}\n${s.refundAmountLabel} ${params.currency} ${params.amount}\n${s.refundApprovedEta}${partialBlockText(params.partial, params.amount, params.currency, locale)}\n\n© ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}`;
}

/* ── rejected ────────────────────────────────────────── */
interface RejectedParams {
  studentName: string;
  rejectionNote: string;
}
export function getRefundRejectedHtml(params: RejectedParams, locale: EmailLocale = 'en'): string {
  const s = getEmailStrings(locale);
  return `<!DOCTYPE html>
<html ${htmlAttrs(locale)}>
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background-color:#EEF3F7;font-family:'DM Sans',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF3F7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#fff;border-radius:16px;overflow:hidden;">
          <tr><td style="background:linear-gradient(135deg,#a37f49,#6b4e24);padding:32px;text-align:center;"><span style="font-size:24px;font-weight:700;color:#fff;">Physio</span><span style="font-size:24px;font-weight:700;color:#f5f0e8;">Guidance</span></td></tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;font-size:22px;color:#1a1a1a;text-align:center;">${s.refundRejectedTitle}</h1>
              <p style="font-size:14px;color:#737373;text-align:${textAlign(locale)};">${s.hi} ${params.studentName},</p>
              <p style="font-size:14px;color:#737373;text-align:${textAlign(locale)};">${s.refundRejectedBody}</p>
              <p style="font-size:14px;color:#1a1a1a;text-align:${textAlign(locale)};"><strong>${s.refundRejectedReason}</strong> ${params.rejectionNote}</p>
              <p style="font-size:13px;color:#9ca3af;text-align:${textAlign(locale)};">${s.refundRejectedContact}</p>
            </td>
          </tr>
          <tr><td style="padding:20px 32px;text-align:center;"><p style="font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}</p></td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
export function getRefundRejectedText(params: RejectedParams, locale: EmailLocale = 'en'): string {
  const s = getEmailStrings(locale);
  return `${s.hi} ${params.studentName},\n\n${s.refundRejectedBody}\n${s.refundRejectedReason} ${params.rejectionNote}\n\n${s.refundRejectedContact}\n\n© ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}`;
}

/* ── completed ───────────────────────────────────────── */
interface CompletedParams {
  studentName: string;
  originalAmount: string;
  deductionAmount: string;
  refundAmount: string;
  currency: string;
  partial?: PartialApprovalInfo;
}
export function getRefundCompletedHtml(params: CompletedParams, locale: EmailLocale = 'en'): string {
  const s = getEmailStrings(locale);
  const hasDeduction = Number(params.deductionAmount) > 0;
  const partial = partialBlockHtml(params.partial, params.refundAmount, params.currency, locale);
  return `<!DOCTYPE html>
<html ${htmlAttrs(locale)}>
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background-color:#EEF3F7;font-family:'DM Sans',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF3F7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#fff;border-radius:16px;overflow:hidden;">
          <tr><td style="background:linear-gradient(135deg,#a37f49,#6b4e24);padding:32px;text-align:center;"><span style="font-size:24px;font-weight:700;color:#fff;">Physio</span><span style="font-size:24px;font-weight:700;color:#f5f0e8;">Guidance</span></td></tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;font-size:22px;color:#1a1a1a;text-align:center;">${s.refundCompletedTitle}</h1>
              <p style="font-size:14px;color:#737373;text-align:${textAlign(locale)};">${s.hi} ${params.studentName},</p>
              <p style="font-size:14px;color:#737373;text-align:${textAlign(locale)};">${s.refundBreakdownIntro}</p>
              <table role="presentation" width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;margin:16px 0;font-size:14px;">
                <tr style="background-color:#f9fafb;">
                  <td style="color:#374151;padding:10px 14px;">${s.refundOriginalAmount}</td>
                  <td style="color:#374151;text-align:${textAlign(locale) === 'right' ? 'left' : 'right'};padding:10px 14px;">${params.currency} ${params.originalAmount}</td>
                </tr>
                ${hasDeduction ? `<tr>
                  <td style="color:#374151;padding:10px 14px;">${s.refundProcessingFee}</td>
                  <td style="color:#dc2626;text-align:${textAlign(locale) === 'right' ? 'left' : 'right'};padding:10px 14px;">− ${params.currency} ${params.deductionAmount}</td>
                </tr>` : ''}
                <tr style="border-top:2px solid #e5e7eb;">
                  <td style="color:#1a1a1a;font-weight:700;padding:12px 14px;">${s.refundToYou}</td>
                  <td style="color:#16a34a;font-weight:700;text-align:${textAlign(locale) === 'right' ? 'left' : 'right'};padding:12px 14px;">${params.currency} ${params.refundAmount}</td>
                </tr>
              </table>
              ${partial}
              <p style="font-size:14px;color:#737373;text-align:${textAlign(locale)};">${s.refundCompletedNote}</p>
            </td>
          </tr>
          <tr><td style="padding:20px 32px;text-align:center;"><p style="font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}</p></td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
export function getRefundCompletedText(params: CompletedParams, locale: EmailLocale = 'en'): string {
  const s = getEmailStrings(locale);
  const deductionLine = Number(params.deductionAmount) > 0
    ? `${s.refundProcessingFee}: ${params.currency} ${params.deductionAmount}. `
    : '';
  return `${s.hi} ${params.studentName},\n\n${s.refundBreakdownIntro}\n${s.refundOriginalAmount}: ${params.currency} ${params.originalAmount}\n${deductionLine}${s.refundToYou}: ${params.currency} ${params.refundAmount}\n\n${s.refundCompletedNote}${partialBlockText(params.partial, params.refundAmount, params.currency, locale)}\n\n© ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}`;
}
