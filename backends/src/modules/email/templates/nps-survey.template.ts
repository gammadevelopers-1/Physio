/**
 * NPS survey email template for PhysioGuidance
 */

const NPS_COLORS = [
  '#dc2626', // 0
  '#e03b20', // 1
  '#e4501a', // 2
  '#e86514', // 3
  '#ea780e', // 4
  '#ca8a04', // 5
  '#a3950a', // 6
  '#7ca010', // 7
  '#54ab16', // 8
  '#2db61c', // 9
  '#16a34a', // 10
];

export function getNpsSurveyHtml(
  learnerName: string,
  courseName: string,
  surveyBaseUrl: string,
): string {
  const scoreButtons = NPS_COLORS.map(
    (color, i) =>
      `<td style="padding:0 2px;"><a href="${surveyBaseUrl}?score=${i}" style="display:block;width:36px;height:36px;line-height:36px;background-color:${color};color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;border-radius:6px;font-family:'DM Sans',Arial,sans-serif;text-align:center;">${i}</a></td>`,
  ).join('\n                  ');

  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>How likely would you recommend PhysioGuidance?</title>
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

          <!-- Title -->
          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="width:56px;height:56px;background-color:#f0fdf4;border-radius:50%;text-align:center;vertical-align:middle;">
                    <span style="font-size:28px;line-height:56px;">&#127891;</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">We'd Love Your Feedback</h1>
            </td>
          </tr>

          <!-- Message -->
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="margin:0 0 16px;font-size:14px;color:#4b5563;font-family:'DM Sans',Arial,sans-serif;line-height:1.6;text-align:center;">
                Hi ${learnerName},
              </p>
              <p style="margin:0 0 16px;font-size:14px;color:#4b5563;font-family:'DM Sans',Arial,sans-serif;line-height:1.6;text-align:center;">
                Congratulations on completing <strong>${courseName}</strong>! How likely are you to recommend PhysioGuidance to a colleague?
              </p>
            </td>
          </tr>

          <!-- NPS score buttons (0-10) -->
          <tr>
            <td style="padding:0 16px 8px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  ${scoreButtons}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Scale labels -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align:left;font-size:11px;color:#737373;font-family:'DM Sans',Arial,sans-serif;">
                    0 = Not at all likely
                  </td>
                  <td style="text-align:right;font-size:11px;color:#737373;font-family:'DM Sans',Arial,sans-serif;">
                    10 = Definitely would recommend
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Expiry note -->
          <tr>
            <td style="padding:0 32px 24px;text-align:center;">
              <p style="margin:0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;">
                This survey expires in 7 days. No login required.
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

export function getNpsSurveyText(
  learnerName: string,
  courseName: string,
  surveyBaseUrl: string,
): string {
  const scoreLinks = Array.from({ length: 11 }, (_, i) => `${i}: ${surveyBaseUrl}?score=${i}`).join('\n');

  return `PhysioGuidance - How likely would you recommend PhysioGuidance?

Hi ${learnerName},

Congratulations on completing "${courseName}"! How likely are you to recommend PhysioGuidance to a colleague?

Rate from 0 (Not at all likely) to 10 (Definitely would recommend):

${scoreLinks}

This survey expires in 7 days. No login required.

\u00a9 ${new Date().getFullYear()} PhysioGuidance. All rights reserved.
NELC Accredited \u00b7 Saudi Arabia`;
}
