/**
 * Password reset OTP email template for PhysioGuidance
 */
export function getPasswordResetHtml(
  code: string,
  expiryMinutes: number = 10,
): string {
  const digits = code.split('');

  const digitBoxes = digits
    .map(
      (d) =>
        `<td style="width:48px;height:56px;background-color:#f5f0e8;border:2px solid #a37f49;border-radius:10px;text-align:center;vertical-align:middle;font-size:28px;font-weight:700;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;letter-spacing:0;">${d}</td>`,
    )
    .join('<td style="width:8px;"></td>');

  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PhysioGuidance Password Reset</title>
</head>
<body style="margin:0;padding:0;background-color:#EEF3F7;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF3F7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

          <!-- Header with brand gradient -->
          <tr>
            <td style="background:linear-gradient(135deg,#a37f49,#6b4e24);padding:32px 32px 24px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="padding-bottom:4px;">
                    <span style="font-size:24px;font-weight:700;color:#ffffff;font-family:'DM Sans',Arial,sans-serif;letter-spacing:-0.5px;">Physio</span><span style="font-size:24px;font-weight:700;color:#f5f0e8;font-family:'DM Sans',Arial,sans-serif;letter-spacing:-0.5px;">Guidance</span>
                  </td>
                </tr>
                <tr>
                  <td style="text-align:center;">
                    <span style="font-size:11px;color:rgba(255,255,255,0.7);font-family:'DM Sans',Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;">NELC Accredited Platform</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Icon + title -->
          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="width:56px;height:56px;background-color:#fef3c7;border-radius:50%;text-align:center;vertical-align:middle;">
                    <span style="font-size:28px;line-height:56px;">&#128273;</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">Reset Your Password</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#737373;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;">
                We received a request to reset your password. Enter the code below on the reset page to set a new password.
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
                This code expires in ${expiryMinutes} minutes
              </p>
            </td>
          </tr>

          <!-- Security notice -->
          <tr>
            <td style="padding:24px 32px;">
              <p style="margin:0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;line-height:1.6;text-align:center;">
                If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
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
                &copy; ${new Date().getFullYear()} PhysioGuidance. All rights reserved.
              </p>
              <p style="margin:0;font-size:11px;color:#9ca3af;font-family:'DM Sans',Arial,sans-serif;">
                NELC Accredited &middot; OWASP Compliant &middot; Saudi Arabia
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

export function getPasswordResetText(
  code: string,
  expiryMinutes: number = 10,
): string {
  return `PhysioGuidance - Password Reset

Your password reset code is: ${code}

This code expires in ${expiryMinutes} minutes.

If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.

© ${new Date().getFullYear()} PhysioGuidance. All rights reserved.
NELC Accredited · OWASP Compliant · Saudi Arabia`;
}
