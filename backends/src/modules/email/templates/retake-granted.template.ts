/**
 * Retake granted notification email for students.
 * Sent when a manager grants a student permission to retake an assessment.
 */
import { EmailLocale, getEmailStrings, textAlign, htmlAttrs } from '../email-i18n';

export interface RetakeGrantedParams {
  studentName: string;
  assessmentTitle: string;
  courseName: string;
  reason?: string | null;
  newDueDate?: string | null;
}

export function getRetakeGrantedHtml(
  params: RetakeGrantedParams,
  locale: EmailLocale = 'en',
): string {
  const s = getEmailStrings(locale);
  const reasonRow = params.reason
    ? `<tr>
         <td style="padding:4px 0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;">${s.retakeGrantedReasonLabel}</td>
         <td style="padding:4px 0;font-size:13px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">${params.reason}</td>
       </tr>`
    : '';
  const deadlineRow = params.newDueDate
    ? `<tr>
         <td style="padding:4px 0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;">${s.retakeGrantedNewDeadline}</td>
         <td style="padding:4px 0;font-size:13px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;font-weight:600;">${params.newDueDate}</td>
       </tr>`
    : '';

  return `<!DOCTYPE html>
<html ${htmlAttrs(locale)}>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${s.retakeGrantedTitle} - PhysioGuidance</title>
</head>
<body style="margin:0;padding:0;background-color:#EEF3F7;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF3F7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

          <!-- Header -->
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

          <!-- Icon + Title -->
          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="width:56px;height:56px;background-color:#dcfce7;border-radius:50%;text-align:center;vertical-align:middle;">
                    <span style="font-size:28px;line-height:56px;">&#128260;</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">${s.retakeGrantedTitle}</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#737373;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;">
                ${s.hi} ${params.studentName},
              </p>
            </td>
          </tr>

          <!-- Details -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 12px;font-size:14px;color:#14532d;font-family:'DM Sans',Arial,sans-serif;line-height:1.6;text-align:${textAlign(locale)};">
                      ${s.retakeGrantedBody}
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;">${s.assessmentLabel}</td>
                        <td style="padding:4px 0;font-size:13px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;font-weight:600;">${params.assessmentTitle}</td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;">${s.courseLabel}</td>
                        <td style="padding:4px 0;font-size:13px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;font-weight:600;">${params.courseName}</td>
                      </tr>
                      ${deadlineRow}
                      ${reasonRow}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 24px;text-align:center;">
              <p style="margin:0;font-size:13px;color:#525252;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;">
                ${s.retakeGrantedCta}
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

export function getRetakeGrantedText(
  params: RetakeGrantedParams,
  locale: EmailLocale = 'en',
): string {
  const s = getEmailStrings(locale);
  const lines = [
    `PhysioGuidance - ${s.retakeGrantedTitle}`,
    '',
    `${s.hi} ${params.studentName},`,
    '',
    s.retakeGrantedBody,
    '',
    `${s.assessmentLabel} ${params.assessmentTitle}`,
    `${s.courseLabel} ${params.courseName}`,
  ];
  if (params.newDueDate) lines.push(`${s.retakeGrantedNewDeadline} ${params.newDueDate}`);
  if (params.reason) lines.push(`${s.retakeGrantedReasonLabel} ${params.reason}`);
  lines.push('', s.retakeGrantedCta, '');
  lines.push(`\u00a9 ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}`);
  lines.push(s.nelcFooter);
  return lines.join('\n');
}
