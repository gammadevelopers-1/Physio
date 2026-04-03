/**
 * Content review email template for PhysioGuidance
 * Sent when a manager approves, rejects, or requests changes on uploaded content
 */
import { EmailLocale, getEmailStrings, textAlign, htmlAttrs } from '../email-i18n';

interface ContentReviewParams {
  recipientName: string;
  materialTitle: string;
  courseName: string;
  decision: 'approved' | 'rejected' | 'changes_requested';
  comment: string | null;
}

export function getContentReviewHtml(params: ContentReviewParams, locale: EmailLocale = 'en'): string {
  const s = getEmailStrings(locale);
  const { recipientName, materialTitle, courseName, decision, comment } = params;

  const decisionLabels: Record<string, string> = {
    approved: s.contentDecisionApproved,
    rejected: s.contentDecisionRejected,
    changes_requested: s.contentDecisionChanges,
  };

  const decisionColors: Record<string, { icon: string; bgColor: string; borderColor: string; titleColor: string }> = {
    approved: {
      icon: '&#9989;',
      bgColor: '#dcfce7',
      borderColor: '#86efac',
      titleColor: '#166534',
    },
    rejected: {
      icon: '&#10060;',
      bgColor: '#fee2e2',
      borderColor: '#fca5a5',
      titleColor: '#991b1b',
    },
    changes_requested: {
      icon: '&#9888;&#65039;',
      bgColor: '#fef3c7',
      borderColor: '#fcd34d',
      titleColor: '#92400e',
    },
  };

  const config = decisionColors[decision];
  const label = decisionLabels[decision];

  const commentBlock = comment
    ? `
          <!-- Comment -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef3c7;border-radius:10px;border:1px solid #fcd34d;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:12px;color:#92400e;font-family:'DM Sans',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${s.commentLabel}</p>
                    <p style="margin:0;font-size:13px;color:#78350f;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;text-align:${textAlign(locale)};">${comment}</p>
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
  <title>${s.contentReviewTitle} - PhysioGuidance</title>
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

          <!-- Icon + title -->
          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="width:56px;height:56px;background-color:${config.bgColor};border-radius:50%;text-align:center;vertical-align:middle;">
                    <span style="font-size:28px;line-height:56px;">${config.icon}</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">${s.contentReviewTitle}</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#737373;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;">
                ${s.hi} ${recipientName},
              </p>
            </td>
          </tr>

          <!-- Content details card -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:10px;border:1px solid #e5e7eb;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 12px;font-size:14px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;line-height:1.6;text-align:${textAlign(locale)};">
                      ${s.contentReviewBody}
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;width:100px;">${s.materialLabel}</td>
                        <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;font-weight:600;">${materialTitle}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;">${s.courseLabel}</td>
                        <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;font-weight:600;">${courseName}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;">${s.decisionLabel}</td>
                        <td style="padding:6px 0;font-size:13px;color:${config.titleColor};font-family:'DM Sans',Arial,sans-serif;font-weight:600;">${label}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
${commentBlock}
          <!-- Action note -->
          <tr>
            <td style="padding:0 32px 24px;text-align:center;">
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

export function getContentReviewText(params: ContentReviewParams, locale: EmailLocale = 'en'): string {
  const s = getEmailStrings(locale);
  const { recipientName, materialTitle, courseName, decision, comment } = params;

  const decisionLabels: Record<string, string> = {
    approved: s.contentDecisionApproved,
    rejected: s.contentDecisionRejected,
    changes_requested: s.contentDecisionChanges,
  };
  const label = decisionLabels[decision];

  let text = `PhysioGuidance - ${s.contentReviewTitle}

${s.hi} ${recipientName},

${s.contentReviewBody}

${s.materialLabel} ${materialTitle}
${s.courseLabel} ${courseName}
${s.decisionLabel} ${label}`;

  if (comment) {
    text += `\n${s.commentLabel} ${comment}`;
  }

  text += `

\u00a9 ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}
${s.nelcFooter}`;

  return text;
}
