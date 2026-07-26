/**
 * Bank transfer receipt received email — sent to the buyer immediately after
 * they upload proof of transfer. Sets expectations that finance will review
 * within ~1 business day. Bilingual (EN + AR).
 */
import { EmailLocale, getEmailStrings, htmlAttrs, textAlign } from '../email-i18n';

interface Params {
  studentName: string;
  courseName: string;
  amount: string;
  currency: string;
  paymentId: string;
  uploadedAt: string;
}

export function getBankTransferReceivedHtml(params: Params, locale: EmailLocale = 'en'): string {
  const s = getEmailStrings(locale);
  return `<!DOCTYPE html>
<html ${htmlAttrs(locale)}>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${s.bankReceivedTitle} - PhysioGuidance</title>
</head>
<body style="margin:0;padding:0;background-color:#EEF3F7;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF3F7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:linear-gradient(135deg,#a37f49,#6b4e24);padding:32px 32px 24px;text-align:center;">
              <span style="font-size:24px;font-weight:700;color:#ffffff;">Physio</span><span style="font-size:24px;font-weight:700;color:#f5f0e8;">Guidance</span>
              <br/><span style="font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:1px;text-transform:uppercase;">${s.nelcBadge}</span>
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
              <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;">${s.bankReceivedTitle}</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#737373;">${s.hi} ${params.studentName},</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 16px;">
              <p style="margin:0 0 16px;font-size:14px;color:#404040;line-height:1.6;text-align:${textAlign(locale)};">
                ${s.bankReceivedBody}
              </p>
              <p style="margin:0;font-size:13px;color:#737373;line-height:1.6;text-align:${textAlign(locale)};">
                ${s.bankReceivedReviewTime}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:10px;border:1px solid #e5e7eb;">
                <tr>
                  <td style="padding:20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="padding:4px 0;font-size:13px;color:#737373;">${s.courseLabel}</td><td style="padding:4px 0;font-size:13px;color:#1a1a1a;font-weight:600;">${params.courseName}</td></tr>
                      <tr><td style="padding:4px 0;font-size:13px;color:#737373;">${s.paymentAmountLabel}</td><td style="padding:4px 0;font-size:13px;color:#1a1a1a;font-weight:600;">${params.currency} ${params.amount}</td></tr>
                      <tr><td style="padding:4px 0;font-size:13px;color:#737373;">${s.ticketIdLabel}</td><td style="padding:4px 0;font-size:13px;color:#1a1a1a;font-weight:600;font-family:monospace;">${params.paymentId}</td></tr>
                      <tr><td style="padding:4px 0;font-size:13px;color:#737373;">${s.submittedAtLabel}</td><td style="padding:4px 0;font-size:13px;color:#1a1a1a;font-weight:600;">${params.uploadedAt}</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="padding:0 32px;"><div style="height:1px;background-color:#e5e7eb;"></div></td></tr>
          <tr>
            <td style="padding:20px 32px 24px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getBankTransferReceivedText(params: Params, locale: EmailLocale = 'en'): string {
  const s = getEmailStrings(locale);
  return `PhysioGuidance - ${s.bankReceivedTitle}

${s.hi} ${params.studentName},

${s.bankReceivedBody}
${s.bankReceivedReviewTime}

${s.courseLabel} ${params.courseName}
${s.paymentAmountLabel} ${params.currency} ${params.amount}
${s.ticketIdLabel} ${params.paymentId}
${s.submittedAtLabel} ${params.uploadedAt}

© ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}`;
}
