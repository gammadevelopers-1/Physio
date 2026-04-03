/**
 * TA (Teaching Assistant) rejection notification email template.
 * Sent to the suggesting instructor when a TA suggestion is rejected.
 */
import { EmailLocale, getEmailStrings, textAlign, htmlAttrs } from '../email-i18n';

export function getTaRejectionHtml(params: {
  recipientName: string;
  courseName: string;
  taName: string;
  rejectionReason: string;
}, locale: EmailLocale = 'en'): string {
  const s = getEmailStrings(locale);
  const { recipientName, courseName, taName, rejectionReason } = params;

  return `<!DOCTYPE html>
<html ${htmlAttrs(locale)}>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${s.taRejectionTitle} - PhysioGuidance</title>
</head>
<body style="margin:0;padding:0;background-color:#EEF3F7;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF3F7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Brand header -->
          <tr>
            <td style="background:linear-gradient(135deg,#a37f49,#6b4e24);border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
              <h1 style="margin:0;font-size:22px;font-weight:700;font-family:'DM Sans',Arial,sans-serif;">
                <span style="color:#ffffff;">Physio</span><span style="color:#f5f0e8;">Guidance</span>
              </h1>
              <p style="margin:6px 0 0;font-size:12px;color:rgba(255,255,255,0.7);font-family:'DM Sans',Arial,sans-serif;">
                ${s.genericNelcTraining}
              </p>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td style="background-color:#ffffff;padding:0;">
              <!-- Icon -->
              <tr>
                <td style="padding:28px 32px 0;text-align:center;">
                  <div style="display:inline-block;width:56px;height:56px;line-height:56px;border-radius:50%;background-color:#FEF2F2;font-size:28px;text-align:center;">
                    &#10005;
                  </div>
                </td>
              </tr>

              <!-- Heading -->
              <tr>
                <td style="padding:16px 32px 0;text-align:center;">
                  <h2 style="margin:0;font-size:20px;font-weight:700;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">
                    ${s.taRejectionTitle}
                  </h2>
                  <p style="margin:8px 0 0;font-size:14px;color:#737373;font-family:'DM Sans',Arial,sans-serif;">
                    ${s.hi} ${recipientName}, ${s.taRejectionBody}
                  </p>
                </td>
              </tr>

              <!-- Details card -->
              <tr>
                <td style="padding:20px 32px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F9FAFB;border:1px solid #e5e7eb;border-radius:10px;padding:20px;">
                    <tr>
                      <td style="padding:0 0 10px;">
                        <p style="margin:0;font-size:12px;color:#9ca3af;font-family:'DM Sans',Arial,sans-serif;">${s.courseLabel}</p>
                        <p style="margin:2px 0 0;font-size:15px;font-weight:600;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">${courseName}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 0 10px;">
                        <p style="margin:0;font-size:12px;color:#9ca3af;font-family:'DM Sans',Arial,sans-serif;">${s.suggestedTaLabel}</p>
                        <p style="margin:2px 0 0;font-size:14px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">${taName}</p>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <p style="margin:0;font-size:12px;color:#9ca3af;font-family:'DM Sans',Arial,sans-serif;">${s.reasonLabel}</p>
                        <p style="margin:2px 0 0;font-size:14px;color:#DC2626;font-weight:600;font-family:'DM Sans',Arial,sans-serif;">${rejectionReason}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Info note -->
              <tr>
                <td style="padding:0 32px 24px;">
                  <p style="margin:0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;text-align:${textAlign(locale)};">
                  </p>
                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="padding:0 32px;">
                  <hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" />
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding:24px 32px 28px;text-align:center;">
                  <p style="margin:0;font-size:12px;color:#9ca3af;font-family:'DM Sans',Arial,sans-serif;">
                    &copy; ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}
                  </p>
                  <p style="margin:4px 0 0;font-size:11px;color:#9ca3af;font-family:'DM Sans',Arial,sans-serif;">
                    ${s.nelcFooter}
                  </p>
                </td>
              </tr>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getTaRejectionText(params: {
  recipientName: string;
  courseName: string;
  taName: string;
  rejectionReason: string;
}, locale: EmailLocale = 'en'): string {
  const s = getEmailStrings(locale);
  const { recipientName, courseName, taName, rejectionReason } = params;

  return `PhysioGuidance - ${s.taRejectionTitle}

${s.hi} ${recipientName},

${s.taRejectionBody}

${s.courseLabel} ${courseName}
${s.suggestedTaLabel} ${taName}
${s.reasonLabel} ${rejectionReason}

© ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}
${s.nelcFooter}`;
}
