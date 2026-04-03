/**
 * Branded OTP email template for PhysioGuidance
 * Inline styles for maximum email client compatibility
 */
import { EmailLocale, getEmailStrings, t, htmlAttrs, textAlign } from '../email-i18n';

export function getOtpEmailHtml(
  code: string,
  deviceName: string,
  locale: EmailLocale = 'en',
  expiryMinutes: number = 10,
): string {
  const s = getEmailStrings(locale);
  // Split code into individual digits for the styled boxes
  const digits = code.split('');

  const digitBoxes = digits
    .map(
      (d) =>
        `<td style="width:48px;height:56px;background-color:#f5f0e8;border:2px solid #a37f49;border-radius:10px;text-align:center;vertical-align:middle;font-size:28px;font-weight:700;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;letter-spacing:0;">${d}</td>`,
    )
    .join('<td style="width:8px;"></td>');

  return `<!DOCTYPE html>
<html ${htmlAttrs(locale)}>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PhysioGuidance ${s.verificationCode}</title>
</head>
<body style="margin:0;padding:0;background-color:#EEF3F7;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF3F7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

          <!-- Header with brand gradient -->
          <tr>
            <td style="background:linear-gradient(135deg,#a37f49,#6b4e24);padding:32px 32px 24px;text-align:center;">
              <!-- Logo text -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="padding-bottom:4px;">
                    <span style="font-size:24px;font-weight:700;color:#ffffff;font-family:'DM Sans',Arial,sans-serif;letter-spacing:-0.5px;">Physio</span><span style="font-size:24px;font-weight:700;color:#f5f0e8;font-family:'DM Sans',Arial,sans-serif;letter-spacing:-0.5px;">Guidance</span>
                  </td>
                </tr>
                <tr>
                  <td style="text-align:center;">
                    <span style="font-size:11px;color:rgba(255,255,255,0.7);font-family:'DM Sans',Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;">${s.nelcBadge}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Shield icon + title -->
          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="width:56px;height:56px;background-color:#f0fdf4;border-radius:50%;text-align:center;vertical-align:middle;">
                    <span style="font-size:28px;line-height:56px;">&#128274;</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">${s.verificationCode}</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#737373;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;text-align:${textAlign(locale)};">
                ${s.otpIntro}
              </p>
            </td>
          </tr>

          <!-- OTP Code Boxes -->
          <tr>
            <td style="padding:0 32px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  ${digitBoxes}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Expiry notice -->
          <tr>
            <td style="padding:16px 32px 0;text-align:center;">
              <p style="margin:0;font-size:13px;color:#a37f49;font-weight:600;font-family:'DM Sans',Arial,sans-serif;">
                ${t(s.otpExpiry, { min: String(expiryMinutes) })}
              </p>
            </td>
          </tr>

          <!-- Device info -->
          <tr>
            <td style="padding:24px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:10px;border:1px solid #e5e7eb;">
                <tr>
                  <td style="padding:16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:12px;color:#737373;font-family:'DM Sans',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:8px;font-weight:600;">${s.otpDevice}</td>
                      </tr>
                      <tr>
                        <td style="font-size:14px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;font-weight:500;">${deviceName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Security notice -->
          <tr>
            <td style="padding:24px 32px;">
              <p style="margin:0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;line-height:1.6;text-align:center;">
                ${s.otpSecurity}
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px;background-color:#e5e7eb;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 24px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;font-family:'DM Sans',Arial,sans-serif;">
                &copy; ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}
              </p>
              <p style="margin:0;font-size:11px;color:#9ca3af;font-family:'DM Sans',Arial,sans-serif;">
                ${s.nelcFooter}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Plain text fallback for the OTP email
 */
export function getOtpEmailText(
  code: string,
  deviceName: string,
  locale: EmailLocale = 'en',
  expiryMinutes: number = 10,
): string {
  const s = getEmailStrings(locale);
  return `PhysioGuidance - ${s.verificationCode}

${s.otpIntro} ${code}

${t(s.otpExpiry, { min: String(expiryMinutes) })}

${s.otpDevice} ${deviceName}

${s.otpSecurity}

© ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}
${s.nelcFooter}`;
}
