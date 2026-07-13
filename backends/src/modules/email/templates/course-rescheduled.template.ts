/**
 * Course rescheduled email template for PhysioGuidance.
 *
 * Sent to every enrolled student whenever an admin/manager reschedules a
 * course. The `variant` distinguishes two cases:
 *   - `shift`  — an active course had its dates moved (still enrolled).
 *   - `revive` — a previously cancelled course is running again; the
 *                student's enrollment was dropped and they need to
 *                re-enroll (payment starts from scratch).
 */
import { EmailLocale, getEmailStrings, htmlAttrs, textAlign } from '../email-i18n';

export type CourseRescheduleVariant = 'shift' | 'revive';

export function getCourseRescheduledHtml(params: {
  recipientName: string;
  courseName: string;
  oldStartDate: string | null;
  newStartDate: string;
  newEndDate: string | null;
  reason: string;
  variant: CourseRescheduleVariant;
  reenrollUrl: string;
}, locale: EmailLocale = 'en'): string {
  const s = getEmailStrings(locale);
  const {
    recipientName,
    courseName,
    oldStartDate,
    newStartDate,
    newEndDate,
    reason,
    variant,
    reenrollUrl,
  } = params;

  const isRevive = variant === 'revive';

  const reasonBlock = `
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef3c7;border-radius:10px;border:1px solid #fcd34d;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:12px;color:#92400e;font-family:'DM Sans',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${s.reasonLabel}</p>
                    <p style="margin:0;font-size:13px;color:#78350f;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;">${reason}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;

  const reviveCtaBlock = isRevive
    ? `
          <tr>
            <td style="padding:0 32px 24px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background-color:#a37f49;border-radius:8px;">
                    <a href="${reenrollUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;color:#ffffff;font-family:'DM Sans',Arial,sans-serif;font-weight:600;text-decoration:none;">${s.courseRescheduledReenrollCta}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
    : '';

  return `<!DOCTYPE html>
<html ${htmlAttrs(locale)}>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${isRevive ? s.courseRescheduledReviveTitle : s.courseRescheduledTitle} - PhysioGuidance</title>
</head>
<body style="margin:0;padding:0;background-color:#EEF3F7;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF3F7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

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

          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="width:56px;height:56px;background-color:#dbeafe;border-radius:50%;text-align:center;vertical-align:middle;">
                    <span style="font-size:28px;line-height:56px;">&#128197;</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">${isRevive ? s.courseRescheduledReviveTitle : s.courseRescheduledTitle}</h1>
              <p style="margin:0 0 8px;font-size:14px;color:#737373;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;">
                ${s.hi} ${recipientName},
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#737373;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;text-align:${textAlign(locale)};padding:0 8px;">
                ${isRevive ? s.courseRescheduledReviveBody : s.courseRescheduledBody}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:10px;border:1px solid #e5e7eb;">
                <tr>
                  <td style="padding:20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;width:140px;">${s.courseLabel}</td>
                        <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;font-weight:600;">${courseName}</td>
                      </tr>
                      ${oldStartDate ? `<tr>
                        <td style="padding:6px 0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;">${s.courseRescheduledPreviousDateLabel}</td>
                        <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;text-decoration:line-through;">${oldStartDate}</td>
                      </tr>` : ''}
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;">${s.courseRescheduledNewDateLabel}</td>
                        <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;font-weight:700;">${newStartDate}</td>
                      </tr>
                      ${newEndDate ? `<tr>
                        <td style="padding:6px 0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;">${s.courseRescheduledEndDateLabel}</td>
                        <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">${newEndDate}</td>
                      </tr>` : ''}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
${reasonBlock}${reviveCtaBlock}
          <tr>
            <td style="padding:0 32px 24px;text-align:center;">
              <p style="margin:0;font-size:14px;color:#737373;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;text-align:${textAlign(locale)};">
                ${isRevive ? s.courseRescheduledReviveCta : s.courseRescheduledCta}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px;background-color:#e5e7eb;"></div>
            </td>
          </tr>

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

export function getCourseRescheduledText(params: {
  recipientName: string;
  courseName: string;
  oldStartDate: string | null;
  newStartDate: string;
  newEndDate: string | null;
  reason: string;
  variant: CourseRescheduleVariant;
  reenrollUrl: string;
}, locale: EmailLocale = 'en'): string {
  const s = getEmailStrings(locale);
  const {
    recipientName,
    courseName,
    oldStartDate,
    newStartDate,
    newEndDate,
    reason,
    variant,
    reenrollUrl,
  } = params;
  const isRevive = variant === 'revive';

  let text = `PhysioGuidance - ${isRevive ? s.courseRescheduledReviveTitle : s.courseRescheduledTitle}

${s.hi} ${recipientName},

${isRevive ? s.courseRescheduledReviveBody : s.courseRescheduledBody}

${s.courseLabel} ${courseName}`;

  if (oldStartDate) {
    text += `\n${s.courseRescheduledPreviousDateLabel} ${oldStartDate}`;
  }
  text += `\n${s.courseRescheduledNewDateLabel} ${newStartDate}`;
  if (newEndDate) {
    text += `\n${s.courseRescheduledEndDateLabel} ${newEndDate}`;
  }

  text += `\n\n${s.reasonLabel} ${reason}`;

  if (isRevive) {
    text += `\n\n${s.courseRescheduledReenrollCta}: ${reenrollUrl}`;
  }

  text += `\n\n${isRevive ? s.courseRescheduledReviveCta : s.courseRescheduledCta}

© ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}
${s.nelcFooter}`;

  return text;
}
