/**
 * TA (Teaching Assistant) assignment notification email template.
 * Sent when an instructor is assigned as a TA to a session.
 */
export function getTaAssignmentHtml(params: {
  recipientName: string;
  sessionTitle: string;
  courseName: string;
  scheduledAt: string;
  durationMinutes: number;
  instructorName: string;
  isAutoAssigned: boolean;
}): string {
  const {
    recipientName,
    sessionTitle,
    courseName,
    scheduledAt,
    durationMinutes,
    instructorName,
    isAutoAssigned,
  } = params;

  const date = new Date(scheduledAt);
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const assignmentNote = isAutoAssigned
    ? 'You have been automatically assigned based on NELC enrollment thresholds.'
    : 'You have been manually assigned by the course manager.';

  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Teaching Assistant Assignment - PhysioGuidance</title>
</head>
<body style="margin:0;padding:0;background-color:#EEF3F7;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF3F7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Brand header -->
          <tr>
            <td style="background:linear-gradient(135deg,#a37f49,#6b4e24);border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
              <h1 style="margin:0;font-size:22px;font-weight:700;font-family:'DM Sans',Arial,sans-serif;">
                <span style="color:#ffffff;">Physio</span><span style="color:#f5f0e8;">Guidance</span>
              </h1>
              <p style="margin:6px 0 0;font-size:12px;color:rgba(255,255,255,0.7);font-family:'DM Sans',Arial,sans-serif;">
                NELC Accredited Training Platform
              </p>
            </td>
          </tr>

          <!-- Main content -->
          <tr>
            <td style="background-color:#ffffff;padding:0;">
              <!-- Icon -->
              <tr>
                <td style="padding:28px 32px 0;text-align:center;">
                  <div style="display:inline-block;width:56px;height:56px;line-height:56px;border-radius:50%;background-color:#EFF6FF;font-size:28px;text-align:center;">
                    👨‍🏫
                  </div>
                </td>
              </tr>

              <!-- Heading -->
              <tr>
                <td style="padding:16px 32px 0;text-align:center;">
                  <h2 style="margin:0;font-size:20px;font-weight:700;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">
                    Teaching Assistant Assignment
                  </h2>
                  <p style="margin:8px 0 0;font-size:14px;color:#737373;font-family:'DM Sans',Arial,sans-serif;">
                    Hi ${recipientName}, you've been assigned as a TA.
                  </p>
                </td>
              </tr>

              <!-- Session details card -->
              <tr>
                <td style="padding:20px 32px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F9FAFB;border:1px solid #e5e7eb;border-radius:10px;padding:20px;">
                    <tr>
                      <td style="padding:0 0 10px;">
                        <p style="margin:0;font-size:12px;color:#9ca3af;font-family:'DM Sans',Arial,sans-serif;">Session</p>
                        <p style="margin:2px 0 0;font-size:15px;font-weight:600;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">${sessionTitle}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 0 10px;">
                        <p style="margin:0;font-size:12px;color:#9ca3af;font-family:'DM Sans',Arial,sans-serif;">Course</p>
                        <p style="margin:2px 0 0;font-size:14px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">${courseName}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 0 10px;">
                        <p style="margin:0;font-size:12px;color:#9ca3af;font-family:'DM Sans',Arial,sans-serif;">Lead Instructor</p>
                        <p style="margin:2px 0 0;font-size:14px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">${instructorName}</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 0 10px;">
                        <p style="margin:0;font-size:12px;color:#9ca3af;font-family:'DM Sans',Arial,sans-serif;">Date &amp; Time</p>
                        <p style="margin:2px 0 0;font-size:14px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">${formattedDate} at ${formattedTime}</p>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <p style="margin:0;font-size:12px;color:#9ca3af;font-family:'DM Sans',Arial,sans-serif;">Duration</p>
                        <p style="margin:2px 0 0;font-size:14px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">${durationMinutes} minutes</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Assignment note -->
              <tr>
                <td style="padding:0 32px 24px;">
                  <p style="margin:0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;">
                    ${assignmentNote}
                  </p>
                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="padding:0 32px;">
                  <hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" />
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding:24px 32px 28px;text-align:center;">
                  <p style="margin:0;font-size:12px;color:#9ca3af;font-family:'DM Sans',Arial,sans-serif;">
                    &copy; ${new Date().getFullYear()} PhysioGuidance. All rights reserved.
                  </p>
                  <p style="margin:4px 0 0;font-size:11px;color:#9ca3af;font-family:'DM Sans',Arial,sans-serif;">
                    NELC Accredited &middot; Saudi Arabia
                  </p>
                </td>
              </tr>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getTaAssignmentText(params: {
  recipientName: string;
  sessionTitle: string;
  courseName: string;
  scheduledAt: string;
  durationMinutes: number;
  instructorName: string;
  isAutoAssigned: boolean;
}): string {
  const {
    recipientName,
    sessionTitle,
    courseName,
    scheduledAt,
    durationMinutes,
    instructorName,
    isAutoAssigned,
  } = params;

  const date = new Date(scheduledAt);
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const assignmentNote = isAutoAssigned
    ? 'You have been automatically assigned based on NELC enrollment thresholds.'
    : 'You have been manually assigned by the course manager.';

  return `PhysioGuidance - Teaching Assistant Assignment

Hi ${recipientName},

You have been assigned as a Teaching Assistant for the following session:

Session: ${sessionTitle}
Course: ${courseName}
Lead Instructor: ${instructorName}
Date & Time: ${formattedDate} at ${formattedTime}
Duration: ${durationMinutes} minutes

${assignmentNote}

© ${new Date().getFullYear()} PhysioGuidance. All rights reserved.
NELC Accredited · Saudi Arabia`;
}
