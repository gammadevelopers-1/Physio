/**
 * CSAT survey email template for PhysioGuidance
 */
export function getCsatSurveyHtml(
  learnerName: string,
  ticketId: string,
  surveyBaseUrl: string,
): string {
  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>How did we do? - PhysioGuidance</title>
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
                  <td style="width:56px;height:56px;background-color:#eff6ff;border-radius:50%;text-align:center;vertical-align:middle;">
                    <span style="font-size:28px;line-height:56px;">&#11088;</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">How did we do?</h1>
            </td>
          </tr>

          <!-- Message -->
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="margin:0 0 16px;font-size:14px;color:#4b5563;font-family:'DM Sans',Arial,sans-serif;line-height:1.6;text-align:center;">
                Hi ${learnerName},
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#4b5563;font-family:'DM Sans',Arial,sans-serif;line-height:1.6;text-align:center;">
                We recently resolved your support ticket <strong>#${ticketId}</strong>. How satisfied were you with our support?
              </p>
            </td>
          </tr>

          <!-- Star rating buttons -->
          <tr>
            <td style="padding:0 32px 24px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="padding:0 4px;">
                    <a href="${surveyBaseUrl}?score=1" style="display:inline-block;width:72px;padding:12px 0;background-color:#dc2626;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;border-radius:8px;font-family:'DM Sans',Arial,sans-serif;text-align:center;">
                      1<br/><span style="font-size:11px;font-weight:400;">Very Bad</span>
                    </a>
                  </td>
                  <td style="padding:0 4px;">
                    <a href="${surveyBaseUrl}?score=2" style="display:inline-block;width:72px;padding:12px 0;background-color:#ea580c;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;border-radius:8px;font-family:'DM Sans',Arial,sans-serif;text-align:center;">
                      2<br/><span style="font-size:11px;font-weight:400;">Bad</span>
                    </a>
                  </td>
                  <td style="padding:0 4px;">
                    <a href="${surveyBaseUrl}?score=3" style="display:inline-block;width:72px;padding:12px 0;background-color:#ca8a04;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;border-radius:8px;font-family:'DM Sans',Arial,sans-serif;text-align:center;">
                      3<br/><span style="font-size:11px;font-weight:400;">Okay</span>
                    </a>
                  </td>
                  <td style="padding:0 4px;">
                    <a href="${surveyBaseUrl}?score=4" style="display:inline-block;width:72px;padding:12px 0;background-color:#2563eb;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;border-radius:8px;font-family:'DM Sans',Arial,sans-serif;text-align:center;">
                      4<br/><span style="font-size:11px;font-weight:400;">Good</span>
                    </a>
                  </td>
                  <td style="padding:0 4px;">
                    <a href="${surveyBaseUrl}?score=5" style="display:inline-block;width:72px;padding:12px 0;background-color:#16a34a;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;border-radius:8px;font-family:'DM Sans',Arial,sans-serif;text-align:center;">
                      5<br/><span style="font-size:11px;font-weight:400;">Excellent</span>
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Expiry note -->
          <tr>
            <td style="padding:0 32px 24px;text-align:center;">
              <p style="margin:0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;">
                This survey expires in 72 hours. No login required.
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

export function getCsatSurveyText(
  learnerName: string,
  ticketId: string,
  surveyBaseUrl: string,
): string {
  return `PhysioGuidance - How did we do?

Hi ${learnerName},

We recently resolved your support ticket #${ticketId}. How satisfied were you with our support?

Rate your experience (click a link):

1 - Very Bad: ${surveyBaseUrl}?score=1
2 - Bad: ${surveyBaseUrl}?score=2
3 - Okay: ${surveyBaseUrl}?score=3
4 - Good: ${surveyBaseUrl}?score=4
5 - Excellent: ${surveyBaseUrl}?score=5

This survey expires in 72 hours. No login required.

\u00a9 ${new Date().getFullYear()} PhysioGuidance. All rights reserved.
NELC Accredited \u00b7 Saudi Arabia`;
}
