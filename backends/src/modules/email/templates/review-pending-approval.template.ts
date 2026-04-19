/**
 * Review pending approval email template for PhysioGuidance.
 * Sent to a course manager when a student leaves a new review on a course
 * they manage — review awaits their approval before going live.
 */
import { EmailLocale, getEmailStrings, textAlign, htmlAttrs } from '../email-i18n';

export interface ReviewPendingApprovalParams {
  recipientName: string;
  studentName: string;
  courseName: string;
  rating: number;
  reviewText?: string | null;
  dashboardUrl: string;
}

function renderStars(rating: number): string {
  const full = '&#9733;'.repeat(Math.max(0, Math.min(5, rating)));
  const empty = '&#9734;'.repeat(5 - Math.max(0, Math.min(5, rating)));
  return `<span style="color:#B8860B;font-size:18px;letter-spacing:2px;">${full}</span><span style="color:#D1D5DB;font-size:18px;letter-spacing:2px;">${empty}</span>`;
}

export function getReviewPendingApprovalHtml(
  params: ReviewPendingApprovalParams,
  locale: EmailLocale = 'en',
): string {
  const s = getEmailStrings(locale);
  const { recipientName, studentName, courseName, rating, reviewText, dashboardUrl } = params;

  const reviewTextBlock = reviewText
    ? `
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFFBEB;border-radius:10px;border:1px solid #FDE68A;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:12px;color:#92400E;font-family:'DM Sans',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${s.reviewTextLabel}</p>
                    <p style="margin:0;font-size:14px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;line-height:1.6;white-space:pre-line;text-align:${textAlign(locale)};">${escapeHtml(reviewText)}</p>
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
  <title>${s.reviewPendingTitle} - PhysioGuidance</title>
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
                  <td style="width:56px;height:56px;background-color:#FEF3C7;border-radius:50%;text-align:center;vertical-align:middle;">
                    <span style="font-size:28px;line-height:56px;">&#11088;</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">${s.reviewPendingTitle}</h1>
              <p style="margin:0 0 24px;font-size:14px;color:#737373;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;">
                ${s.hi} ${escapeHtml(recipientName)}, ${s.reviewPendingBody}
              </p>
            </td>
          </tr>

          <!-- Details card -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:10px;border:1px solid #e5e7eb;">
                <tr>
                  <td style="padding:20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;width:100px;">${s.studentLabel}</td>
                        <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;font-weight:600;">${escapeHtml(studentName)}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;">${s.courseLabel}</td>
                        <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;font-weight:600;">${escapeHtml(courseName)}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;vertical-align:middle;">${s.ratingLabel}</td>
                        <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;font-weight:600;">
                          ${renderStars(rating)}
                          <span style="margin-left:8px;font-size:13px;color:#4a4c4f;">${rating}/5</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
${reviewTextBlock}
          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 32px;text-align:center;">
              <a href="${dashboardUrl}" style="display:inline-block;background:linear-gradient(135deg,#a37f49,#6b4e24);color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:10px;font-family:'DM Sans',Arial,sans-serif;">
                ${s.reviewCtaLabel}
              </a>
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

export function getReviewPendingApprovalText(
  params: ReviewPendingApprovalParams,
  locale: EmailLocale = 'en',
): string {
  const s = getEmailStrings(locale);
  const { recipientName, studentName, courseName, rating, reviewText, dashboardUrl } = params;

  let text = `PhysioGuidance - ${s.reviewPendingTitle}

${s.hi} ${recipientName}, ${s.reviewPendingBody}

${s.studentLabel} ${studentName}
${s.courseLabel} ${courseName}
${s.ratingLabel} ${rating}/5`;

  if (reviewText) {
    text += `\n\n${s.reviewTextLabel}\n${reviewText}`;
  }

  text += `\n\n${s.reviewCtaLabel}: ${dashboardUrl}`;
  text += `\n\n\u00a9 ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}\n${s.nelcFooter}`;

  return text;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
