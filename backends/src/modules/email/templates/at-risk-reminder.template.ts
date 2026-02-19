/**
 * At-risk student reminder email template for PhysioGuidance
 */
export function getAtRiskReminderHtml(
  studentName: string,
  courseName: string,
  customMessage?: string,
): string {
  const messageBlock = customMessage
    ? `
          <!-- Custom message from instructor -->
          <tr>
            <td style="padding:0 32px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:10px;border:1px solid #e5e7eb;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 4px;font-size:12px;color:#737373;font-family:'DM Sans',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Message from your instructor</p>
                    <p style="margin:0;font-size:14px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;line-height:1.6;">${customMessage}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Course Reminder - PhysioGuidance</title>
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

          <!-- Warning icon + title -->
          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="width:56px;height:56px;background-color:#fefce8;border-radius:50%;text-align:center;vertical-align:middle;">
                    <span style="font-size:28px;line-height:56px;">&#9888;&#65039;</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">Course Progress Reminder</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#737373;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;">
                Hi ${studentName},
              </p>
            </td>
          </tr>

          <!-- Message -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fefce8;border-radius:10px;border:1px solid #fde68a;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0;font-size:14px;color:#854d0e;font-family:'DM Sans',Arial,sans-serif;line-height:1.6;">
                      Your instructor has noticed that your progress in <strong>${courseName}</strong> needs attention. We encourage you to review your recent activity, attend upcoming sessions, and reach out if you need any support.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
${messageBlock}
          <!-- Encouragement -->
          <tr>
            <td style="padding:0 32px 24px;text-align:center;">
              <p style="margin:0;font-size:14px;color:#737373;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;">
                Log in to your account to catch up on materials and upcoming sessions. Your success matters to us!
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
                NELC Accredited &middot; Saudi Arabia
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

export function getAtRiskReminderText(
  studentName: string,
  courseName: string,
  customMessage?: string,
): string {
  let text = `PhysioGuidance - Course Progress Reminder

Hi ${studentName},

Your instructor has noticed that your progress in "${courseName}" needs attention. We encourage you to review your recent activity, attend upcoming sessions, and reach out if you need any support.`;

  if (customMessage) {
    text += `\n\nMessage from your instructor:\n${customMessage}`;
  }

  text += `

Log in to your account to catch up on materials and upcoming sessions. Your success matters to us!

\u00a9 ${new Date().getFullYear()} PhysioGuidance. All rights reserved.
NELC Accredited \u00b7 Saudi Arabia`;

  return text;
}
