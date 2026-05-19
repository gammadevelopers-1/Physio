/**
 * Session reminder email template for PhysioGuidance
 * Sent 5 minutes before a Zoom/hybrid session starts
 */
import { EmailLocale, getEmailStrings, t, htmlAttrs, textAlign } from '../email-i18n';

export function getSessionReminderHtml(params: {
  recipientName: string;
  sessionTitle: string;
  courseName: string;
  scheduledAt: string;
  durationMinutes: number;
  zoomLink: string | null;
  isInstructor: boolean;
}, locale: EmailLocale = 'en'): string {
  const s = getEmailStrings(locale);
  const { recipientName, sessionTitle, courseName, scheduledAt, durationMinutes, zoomLink, isInstructor } = params;

  // Format every lecture time in Asia/Riyadh — the platform serves
  // Saudi Arabia, and our WhatsApp share/dashboard already use Riyadh.
  // Without an explicit timeZone these calls would render in the
  // server's UTC, which is what the user reported as the bug.
  const date = new Date(scheduledAt);
  const formattedDate = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Riyadh' });
  const formattedTime = `${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' })} (Riyadh Time)`;

  const roleText = isInstructor ? s.roleInstructor : s.roleStudent;
  const platformUrl = process.env.FRONTEND_URL || 'https://physioguidance.org';

  // No Zoom links in emails — everyone joins from platform
  const dashboardPath = isInstructor ? '/en/dashboard/instructor' : '/en/dashboard/student';
  const buttonLabel = isInstructor ? 'Start from Platform' : 'Join from Platform';
  const joinBlock = `
          <!-- Platform button -->
          <tr>
            <td style="padding:0 32px 24px;text-align:center;">
              <a href="${platformUrl}${dashboardPath}" target="_blank" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#a37f49,#6b4e24);color:#ffffff;font-size:15px;font-weight:600;font-family:'DM Sans',Arial,sans-serif;text-decoration:none;border-radius:8px;">
                ${buttonLabel}
              </a>
              <p style="margin:10px 0 0;font-size:12px;color:#9ca3af;font-family:'DM Sans',Arial,sans-serif;">
                Please ${isInstructor ? 'start' : 'join'} the lecture through your PhysioGuidance dashboard.
              </p>
            </td>
          </tr>`;

  return `<!DOCTYPE html>
<html ${htmlAttrs(locale)}>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Lecture Starting Soon - PhysioGuidance</title>
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
                    <span style="font-size:11px;color:rgba(255,255,255,0.7);font-family:'DM Sans',Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;">${s.nelcBadge}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Clock icon + title -->
          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="width:56px;height:56px;background-color:#eff6ff;border-radius:50%;text-align:center;vertical-align:middle;">
                    <span style="font-size:28px;line-height:56px;">&#9200;</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">${s.sessionReminderTitle}</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#737373;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;">
                ${s.hi} ${recipientName},
              </p>
            </td>
          </tr>

          <!-- Session details card -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:10px;border:1px solid #e5e7eb;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 4px;font-size:12px;color:#737373;font-family:'DM Sans',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${s.sessionLabel}</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;width:100px;">${s.sessionLabel}</td>
                        <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;font-weight:600;">${sessionTitle}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;">${s.courseLabel}</td>
                        <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;font-weight:600;">${courseName}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;">${s.timeLabel}</td>
                        <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">${formattedTime}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;">${s.durationLabel}</td>
                        <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">${durationMinutes} ${s.minutesLabel}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;">${s.roleLabel}</td>
                        <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">${roleText}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Role info -->
          <tr>
            <td style="padding:0 32px 24px;text-align:center;">
              <p style="margin:0;font-size:14px;color:#737373;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;text-align:${textAlign(locale)};">
                ${s.sessionReminderCta}
              </p>
            </td>
          </tr>
${joinBlock}
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

export function getSessionReminderText(params: {
  recipientName: string;
  sessionTitle: string;
  courseName: string;
  scheduledAt: string;
  durationMinutes: number;
  zoomLink: string | null;
  isInstructor: boolean;
}, locale: EmailLocale = 'en'): string {
  const s = getEmailStrings(locale);
  const { recipientName, sessionTitle, courseName, scheduledAt, durationMinutes, zoomLink, isInstructor } = params;

  // Same Riyadh-time formatting as the HTML variant above — see comment
  // there for why we hardcode timeZone instead of using the server TZ.
  const date = new Date(scheduledAt);
  const formattedDate = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Riyadh' });
  const formattedTime = `${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' })} (Riyadh Time)`;

  const roleText = isInstructor ? s.roleInstructor : s.roleStudent;

  let text = `PhysioGuidance - ${s.sessionReminderTitle}

${s.hi} ${recipientName},

${s.sessionReminderBody}

${s.sessionLabel} ${sessionTitle}
${s.courseLabel} ${courseName}
${s.timeLabel} ${formattedTime}
${s.durationLabel} ${durationMinutes} ${s.minutesLabel}
${s.roleLabel} ${roleText}`;

  const platformUrlText = process.env.FRONTEND_URL || 'https://physioguidance.org';
  const dashboardPathText = isInstructor ? '/en/dashboard/instructor' : '/en/dashboard/student';
  text += `\n\n${s.sessionReminderCta}\n${platformUrlText}${dashboardPathText}`;

  text += `

\u00a9 ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}
${s.nelcFooter}`;

  return text;
}
