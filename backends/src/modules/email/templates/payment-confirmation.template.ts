/**
 * Payment confirmation email — sent to the buyer once a payment settles
 * and their enrollment is active. Bilingual (EN + AR) via email-i18n.
 */
import { EmailLocale, getEmailStrings, htmlAttrs, textAlign } from '../email-i18n';

interface Params {
  studentName: string;
  courseName: string;
  amount: string;
  currency: string;
  invoiceNumber: string;
  gateway: string;
  transactionId: string;
}

export function getPaymentConfirmationHtml(params: Params, locale: EmailLocale = 'en'): string {
  const s = getEmailStrings(locale);
  return `<!DOCTYPE html>
<html ${htmlAttrs(locale)}>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${s.paymentConfirmedTitle} - PhysioGuidance</title>
</head>
<body style="margin:0;padding:0;background-color:#EEF3F7;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF3F7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:linear-gradient(135deg,#a37f49,#6b4e24);padding:32px 32px 24px;text-align:center;">
              <span style="font-size:24px;font-weight:700;color:#ffffff;font-family:'DM Sans',Arial,sans-serif;">Physio</span><span style="font-size:24px;font-weight:700;color:#f5f0e8;font-family:'DM Sans',Arial,sans-serif;">Guidance</span>
              <br/><span style="font-size:11px;color:rgba(255,255,255,0.7);font-family:'DM Sans',Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;">${s.nelcBadge}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="width:56px;height:56px;background-color:#dcfce7;border-radius:50%;text-align:center;vertical-align:middle;">
                    <span style="font-size:28px;line-height:56px;">&#9989;</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">${s.paymentConfirmedTitle}</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#737373;font-family:'DM Sans',Arial,sans-serif;">${s.hi} ${params.studentName},</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 12px;font-size:14px;color:#166534;font-family:'DM Sans',Arial,sans-serif;text-align:${textAlign(locale)};">${s.paymentConfirmedBody}</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="padding:4px 0;font-size:13px;color:#737373;">${s.courseLabel}</td><td style="padding:4px 0;font-size:13px;color:#1a1a1a;font-weight:600;">${params.courseName}</td></tr>
                      <tr><td style="padding:4px 0;font-size:13px;color:#737373;">${s.paymentAmountLabel}</td><td style="padding:4px 0;font-size:13px;color:#1a1a1a;font-weight:600;">${params.currency} ${params.amount}</td></tr>
                      <tr><td style="padding:4px 0;font-size:13px;color:#737373;">${s.paymentInvoiceLabel}</td><td style="padding:4px 0;font-size:13px;color:#1a1a1a;font-weight:600;">${params.invoiceNumber}</td></tr>
                      <tr><td style="padding:4px 0;font-size:13px;color:#737373;">${s.paymentMethodLabel}</td><td style="padding:4px 0;font-size:13px;color:#1a1a1a;font-weight:600;">${params.gateway}</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;text-align:center;">
              <p style="margin:0;font-size:14px;color:#737373;font-family:'DM Sans',Arial,sans-serif;text-align:${textAlign(locale)};">${s.paymentConfirmedInvoiceNote}</p>
            </td>
          </tr>
          <tr><td style="padding:0 32px;"><div style="height:1px;background-color:#e5e7eb;"></div></td></tr>
          <tr>
            <td style="padding:20px 32px 24px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;font-family:'DM Sans',Arial,sans-serif;">&copy; ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}</p>
              <p style="margin:0;font-size:11px;color:#9ca3af;font-family:'DM Sans',Arial,sans-serif;">${s.nelcFooter}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getPaymentConfirmationText(params: Params, locale: EmailLocale = 'en'): string {
  const s = getEmailStrings(locale);
  return `PhysioGuidance - ${s.paymentConfirmedTitle}

${s.hi} ${params.studentName},

${s.paymentConfirmedBody}

${s.courseLabel} ${params.courseName}
${s.paymentAmountLabel} ${params.currency} ${params.amount}
${s.paymentInvoiceLabel} ${params.invoiceNumber}
${s.paymentMethodLabel} ${params.gateway}

${s.paymentConfirmedInvoiceNote}

© ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}
${s.nelcFooter}`;
}
