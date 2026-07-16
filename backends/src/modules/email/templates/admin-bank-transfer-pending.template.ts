/**
 * Admin/finance alert — a bank-transfer receipt was submitted and is
 * awaiting review. Phase G.
 *
 * Sent to every user with role ADMIN, SUPER_ADMIN, or FINANCE when the
 * bank-transfer flow flips a payment to AWAITING_APPROVAL. Finance has
 * to review the uploaded receipt and either approve (→ PAID + enrol) or
 * reject (→ FAILED + notify buyer).
 */
import { EmailLocale, getEmailStrings, htmlAttrs, textAlign } from '../email-i18n';

export function getAdminBankTransferPendingHtml(
  params: {
    recipientName: string;
    buyerName: string;
    courseName: string;
    amount: string;
    currency: string;
    submittedAt: string;
    reviewUrl: string;
  },
  locale: EmailLocale = 'en',
): string {
  const s = getEmailStrings(locale);
  const {
    recipientName,
    buyerName,
    courseName,
    amount,
    currency,
    submittedAt,
    reviewUrl,
  } = params;

  return `<!DOCTYPE html>
<html ${htmlAttrs(locale)}>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${s.adminBankTransferPendingTitle} - PhysioGuidance</title>
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
                  <td style="width:56px;height:56px;background-color:#fef3c7;border-radius:50%;text-align:center;vertical-align:middle;">
                    <span style="font-size:28px;line-height:56px;">&#128260;</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">${s.adminBankTransferPendingTitle}</h1>
              <p style="margin:0 0 8px;font-size:14px;color:#737373;font-family:'DM Sans',Arial,sans-serif;">${s.hi} ${recipientName},</p>
              <p style="margin:0 0 24px;font-size:14px;color:#737373;line-height:1.5;text-align:${textAlign(locale)};padding:0 8px;">${s.adminBankTransferPendingIntro}</p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:10px;border:1px solid #e5e7eb;">
                <tr>
                  <td style="padding:20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#737373;width:120px;">${s.courseLabel}</td>
                        <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-weight:600;">${courseName}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#737373;">${s.buyerLabel}</td>
                        <td style="padding:6px 0;font-size:13px;color:#1a1a1a;">${buyerName}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#737373;">${s.amountLabel}</td>
                        <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-weight:700;">${amount} ${currency}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#737373;">${s.submittedAtLabel}</td>
                        <td style="padding:6px 0;font-size:13px;color:#1a1a1a;">${submittedAt}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 24px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background-color:#a37f49;border-radius:8px;">
                    <a href="${reviewUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;color:#ffffff;font-weight:600;text-decoration:none;">${s.adminBankTransferPendingCta}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr><td style="padding:0 32px;"><div style="height:1px;background-color:#e5e7eb;"></div></td></tr>
          <tr>
            <td style="padding:20px 32px 24px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}</p>
              <p style="margin:0;font-size:11px;color:#9ca3af;">${s.nelcFooter}</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getAdminBankTransferPendingText(
  params: {
    recipientName: string;
    buyerName: string;
    courseName: string;
    amount: string;
    currency: string;
    submittedAt: string;
    reviewUrl: string;
  },
  locale: EmailLocale = 'en',
): string {
  const s = getEmailStrings(locale);
  return `PhysioGuidance - ${s.adminBankTransferPendingTitle}

${s.hi} ${params.recipientName},

${s.adminBankTransferPendingIntro}

${s.courseLabel} ${params.courseName}
${s.buyerLabel} ${params.buyerName}
${s.amountLabel} ${params.amount} ${params.currency}
${s.submittedAtLabel} ${params.submittedAt}

${s.adminBankTransferPendingCta}: ${params.reviewUrl}

© ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}
${s.nelcFooter}`;
}
