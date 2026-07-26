/**
 * Session scheduled email template for PhysioGuidance
 * Sent when an instructor schedules a new session
 */
import {
  EmailLocale,
  getEmailStrings,
  t,
  htmlAttrs,
  textAlign,
  bodyAttrs,
  infoTable,
  bidi,
} from '../email-i18n';

export function getSessionScheduledHtml(params: {
  recipientName: string;
  sessionTitle: string;
  courseName: string;
  scheduledDate: string;
  sessionType: string;
  zoomLink: string | null;
  isRescheduled?: boolean;
}, locale: EmailLocale = 'en'): string {
  const s = getEmailStrings(locale);
  const { recipientName, sessionTitle, courseName, scheduledDate, sessionType, zoomLink, isRescheduled } = params;

  const typeValue =
    sessionType === 'zoom' ? s.typeZoom :
    sessionType === 'hybrid' ? s.typeHybrid : s.typeOnsite;

  const title = isRescheduled ? s.sessionRescheduledTitle : s.sessionScheduledTitle;
  const body = isRescheduled ? s.sessionRescheduledBody : s.sessionScheduledBody;
  const note = isRescheduled ? s.sessionRescheduledNote : s.sessionScheduledNote;

  const zoomBlock = ''; // Zoom link not shared in emails — students join from platform

  return `<!DOCTYPE html>
<html ${htmlAttrs(locale)}>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} - PhysioGuidance</title>
</head>
<body ${bodyAttrs(locale)} style="margin:0;padding:0;background-color:#EEF3F7;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
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

          <!-- Icon + title -->
          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="width:56px;height:56px;background-color:#dbeafe;border-radius:50%;text-align:center;vertical-align:middle;">
                    <span style="font-size:28px;line-height:56px;">&#128197;</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">${title}</h1>
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
                    <p style="margin:0 0 4px;font-size:12px;color:#737373;font-family:'DM Sans',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${s.lectureLabel}</p>
                    ${infoTable(locale, [
                      { label: s.lectureLabel, value: `<strong>${bidi(sessionTitle)}</strong>` },
                      { label: s.courseLabel, value: `<strong>${bidi(courseName)}</strong>` },
                      { label: s.dateTimeLabel, value: `<strong>${bidi(scheduledDate)}</strong>` },
                      { label: s.typeLabel, value: `<strong>${typeValue}</strong>` },
                    ])}
${zoomBlock}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Info text -->
          <tr>
            <td style="padding:0 32px 24px;text-align:center;">
              <p style="margin:0;font-size:14px;color:#737373;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;text-align:${textAlign(locale)};">
                ${note}
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

export function getSessionScheduledText(params: {
  recipientName: string;
  sessionTitle: string;
  courseName: string;
  scheduledDate: string;
  sessionType: string;
  zoomLink: string | null;
  isRescheduled?: boolean;
}, locale: EmailLocale = 'en'): string {
  const s = getEmailStrings(locale);
  const { recipientName, sessionTitle, courseName, scheduledDate, sessionType, zoomLink, isRescheduled } = params;

  const typeValue =
    sessionType === 'zoom' ? s.typeZoom :
    sessionType === 'hybrid' ? s.typeHybrid : s.typeOnsite;

  const title = isRescheduled ? s.sessionRescheduledTitle : s.sessionScheduledTitle;
  const body = isRescheduled ? s.sessionRescheduledBody : s.sessionScheduledBody;
  const note = isRescheduled ? s.sessionRescheduledNote : s.sessionScheduledNote;

  // Zoom link not shared in emails — students join from platform

  let text = `PhysioGuidance - ${title}

${s.hi} ${recipientName},

${body}

${s.lectureLabel} ${sessionTitle}
${s.courseLabel} ${courseName}
${s.dateTimeLabel} ${scheduledDate}
${s.typeLabel} ${typeValue}`;

  text += `

${note}

\u00a9 ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}
${s.nelcFooter}`;

  return text;
}
