/**
 * Receipt flagged infected email — sent when the malware scanner
 * quarantines an uploaded bank-transfer receipt. Prompts the buyer to
 * re-upload from a clean source. Bilingual (EN + AR), branded to match
 * the rest of the payment-lifecycle emails.
 *
 * Kept as a file-based template (not admin-editable via the Templates
 * area) because the wording is security-sensitive and must not be
 * softened operationally.
 */
import { EmailLocale, getEmailStrings, htmlAttrs, textAlign } from '../email-i18n';

interface Params {
  studentName: string;
  paymentReference: string;
  uploadUrl: string;
}

export function getReceiptFlaggedInfectedHtml(
  params: Params,
  locale: EmailLocale = 'en',
): string {
  const s = getEmailStrings(locale);
  return `<!DOCTYPE html>
<html ${htmlAttrs(locale)}>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${s.receiptInfectedTitle} - PhysioGuidance</title>
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
                  <td style="width:56px;height:56px;background-color:#fee2e2;border-radius:50%;text-align:center;vertical-align:middle;">
                    <span style="font-size:28px;line-height:56px;">&#128737;&#65039;</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;">${s.receiptInfectedTitle}</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#737373;">${s.hi} ${escapeHtml(params.studentName)},</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 16px;">
              <p style="margin:0 0 16px;font-size:14px;color:#404040;line-height:1.6;text-align:${textAlign(locale)};">
                ${s.receiptInfectedBody}
              </p>
              <p style="margin:0 0 16px;font-size:14px;color:#404040;line-height:1.6;text-align:${textAlign(locale)};">
                ${s.receiptInfectedInstruction}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td align="center" style="background:#a37f49;border-radius:8px;">
                    <a href="${params.uploadUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${s.receiptInfectedCta}</a>
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
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#737373;text-align:${textAlign(locale)};">${s.paymentReferenceLabel}</td>
                        <td style="padding:4px 0;font-size:13px;color:#1a1a1a;font-weight:600;font-family:monospace;text-align:${locale === 'ar' ? 'left' : 'right'};">${escapeHtml(params.paymentReference)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 20px;">
              <p style="margin:0;font-size:12px;color:#737373;line-height:1.55;text-align:${textAlign(locale)};">
                ${s.receiptInfectedCauses}
              </p>
            </td>
          </tr>
          <tr><td style="padding:0 32px;"><div style="height:1px;background-color:#e5e7eb;"></div></td></tr>
          <tr>
            <td style="padding:16px 32px 8px;">
              <p style="margin:0;font-size:12px;color:#737373;line-height:1.55;text-align:${textAlign(locale)};">
                ${s.receiptInfectedSupport}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 32px 24px;text-align:center;">
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

export function getReceiptFlaggedInfectedText(
  params: Params,
  locale: EmailLocale = 'en',
): string {
  const s = getEmailStrings(locale);
  return `PhysioGuidance - ${s.receiptInfectedTitle}

${s.hi} ${params.studentName},

${s.receiptInfectedBody}

${s.receiptInfectedInstruction}

${s.receiptInfectedCta}: ${params.uploadUrl}

${s.paymentReferenceLabel} ${params.paymentReference}

${s.receiptInfectedCauses}

${s.receiptInfectedSupport}

© ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
