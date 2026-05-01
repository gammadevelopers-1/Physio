/**
 * Email sent to a placeholder user (created via the public Become-Trainer
 * flow) when an admin approves their application. Includes a magic-link
 * button that takes them to a single-use "set password" page.
 */
import { EmailLocale, getEmailStrings, htmlAttrs, textAlign } from '../email-i18n';

export function getApplicationApprovedSetPasswordHtml(
  applicantName: string,
  setupUrl: string,
  locale: EmailLocale = 'en',
): string {
  const s = getEmailStrings(locale);
  const heading = locale === 'ar'
    ? 'تمت الموافقة على طلبك!'
    : 'Your application has been approved!';
  const intro = locale === 'ar'
    ? `مرحبًا ${applicantName}، تم قبولك كمدرب. لإكمال حسابك، يرجى تعيين كلمة المرور الخاصة بك.`
    : `Hello ${applicantName}, you've been accepted as an instructor. To finish setting up your account, please set your password.`;
  const ctaLabel = locale === 'ar' ? 'تعيين كلمة المرور' : 'Set Password';
  const expiryNote = locale === 'ar'
    ? 'ينتهي هذا الرابط خلال 24 ساعة. إذا انتهى، يرجى التواصل مع الدعم.'
    : 'This link expires in 24 hours. If it expires, please contact support.';
  const fallbackLabel = locale === 'ar'
    ? 'إذا لم يعمل الزر، انسخ الرابط التالي والصقه في متصفحك:'
    : 'If the button does not work, copy and paste this link into your browser:';

  return `<!DOCTYPE html>
<html ${htmlAttrs(locale)}>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PhysioGuidance — ${heading}</title>
</head>
<body style="margin:0;padding:0;background-color:#EEF3F7;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF3F7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

          <!-- Header brand bar -->
          <tr>
            <td style="background:linear-gradient(135deg,#a37f49,#6b4e24);padding:28px 32px 24px;text-align:center;">
              <span style="font-size:24px;font-weight:700;color:#ffffff;font-family:'DM Sans',Arial,sans-serif;letter-spacing:-0.5px;">Physio</span><span style="font-size:24px;font-weight:700;color:#f5f0e8;font-family:'DM Sans',Arial,sans-serif;letter-spacing:-0.5px;">Guidance</span>
              <div style="margin-top:6px;font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:1px;text-transform:uppercase;">${s.nelcBadge}</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 32px 8px;text-align:${textAlign(locale)};">
              <h1 style="margin:0 0 14px;font-size:24px;font-weight:700;color:#1a1a1a;line-height:1.3;">
                ${heading}
              </h1>
              <p style="margin:0 0 28px;font-size:15px;color:#4a4a4a;line-height:1.6;">
                ${intro}
              </p>
            </td>
          </tr>

          <!-- CTA button -->
          <tr>
            <td align="center" style="padding:0 32px 12px;">
              <a href="${setupUrl}"
                 style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#a37f49,#6b4e24);color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:12px;font-family:'DM Sans',Arial,sans-serif;">
                ${ctaLabel}
              </a>
            </td>
          </tr>

          <!-- Expiry note -->
          <tr>
            <td style="padding:8px 32px 24px;text-align:center;">
              <p style="margin:0;font-size:13px;color:#a37f49;font-weight:500;">
                ${expiryNote}
              </p>
            </td>
          </tr>

          <!-- Fallback URL -->
          <tr>
            <td style="padding:0 32px 28px;">
              <p style="margin:0 0 6px;font-size:12px;color:#737373;line-height:1.5;text-align:${textAlign(locale)};">
                ${fallbackLabel}
              </p>
              <p style="margin:0;font-size:12px;color:#1a1a1a;word-break:break-all;background:#f8fafc;padding:10px 12px;border-radius:8px;border:1px solid #e5e7eb;">
                ${setupUrl}
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:0 32px;"><div style="height:1px;background:#e5e7eb;"></div></td></tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 32px 24px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">
                &copy; ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}
              </p>
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

export function getApplicationApprovedSetPasswordText(
  applicantName: string,
  setupUrl: string,
  locale: EmailLocale = 'en',
): string {
  const s = getEmailStrings(locale);
  const heading = locale === 'ar' ? 'تمت الموافقة على طلبك!' : 'Your application has been approved!';
  const intro = locale === 'ar'
    ? `مرحبًا ${applicantName}، تم قبولك كمدرب. لإكمال حسابك، يرجى تعيين كلمة المرور الخاصة بك.`
    : `Hello ${applicantName}, you've been accepted as an instructor. To finish setting up your account, please set your password.`;
  const expiryNote = locale === 'ar'
    ? 'ينتهي هذا الرابط خلال 24 ساعة.'
    : 'This link expires in 24 hours.';
  return `PhysioGuidance — ${heading}

${intro}

${locale === 'ar' ? 'تعيين كلمة المرور' : 'Set Password'}: ${setupUrl}

${expiryNote}

© ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}
${s.nelcFooter}`;
}
