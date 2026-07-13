/**
 * Course cancelled email template for PhysioGuidance
 * Sent to every enrolled student when an admin cancels a course.
 *
 * Refund status is embedded so the student knows what to expect:
 *   - `immediate` — programmatic gateway refund (Moyasar/Tamara/Tabby), lands in 5–10 days
 *   - `manual`    — bank-transfer refund, finance wires it manually
 *   - `none`      — free enrolment or no payment collected
 */
import { EmailLocale, getEmailStrings, htmlAttrs, textAlign } from '../email-i18n';

export type CourseCancelRefundKind = 'immediate' | 'manual' | 'manual_pending' | 'none';

export function getCourseCancelledHtml(params: {
  recipientName: string;
  courseName: string;
  cancelReason: string | null;
  refundKind: CourseCancelRefundKind;
  /** Phase C post-start cancels revoke certs + reverse CME points. When true,
   * the template appends a note explaining that to the student. */
  certsRevoked?: boolean;
}, locale: EmailLocale = 'en'): string {
  const s = getEmailStrings(locale);
  const { recipientName, courseName, cancelReason, refundKind, certsRevoked } = params;

  const refundLine =
    refundKind === 'immediate' ? s.courseCancelledRefundImmediate
    : refundKind === 'manual'  ? s.courseCancelledRefundManual
    : refundKind === 'manual_pending' ? s.courseCancelledRefundManualPending
    : s.courseCancelledRefundNone;

  const certsBlock = certsRevoked
    ? `
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef2f2;border-radius:10px;border:1px solid #fecaca;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0;font-size:13px;color:#7f1d1d;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;">${s.courseCancelledCertsRevoked}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
    : '';

  const reasonBlock = cancelReason
    ? `
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef3c7;border-radius:10px;border:1px solid #fcd34d;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:12px;color:#92400e;font-family:'DM Sans',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${s.reasonLabel}</p>
                    <p style="margin:0;font-size:13px;color:#78350f;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;">${cancelReason}</p>
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
  <title>${s.courseCancelledTitle} - PhysioGuidance</title>
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
                  <td style="width:56px;height:56px;background-color:#fee2e2;border-radius:50%;text-align:center;vertical-align:middle;">
                    <span style="font-size:28px;line-height:56px;">&#10060;</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;">${s.courseCancelledTitle}</h1>
              <p style="margin:0 0 8px;font-size:14px;color:#737373;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;">
                ${s.hi} ${recipientName},
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#737373;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;text-align:${textAlign(locale)};padding:0 8px;">
                ${s.courseCancelledBody}
              </p>
            </td>
          </tr>

          <!-- Course details card -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:10px;border:1px solid #e5e7eb;">
                <tr>
                  <td style="padding:20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#737373;font-family:'DM Sans',Arial,sans-serif;width:120px;">${s.courseLabel}</td>
                        <td style="padding:6px 0;font-size:13px;color:#1a1a1a;font-family:'DM Sans',Arial,sans-serif;font-weight:600;">${courseName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
${reasonBlock}
          <!-- Refund status card -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eff6ff;border-radius:10px;border:1px solid #bfdbfe;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:12px;color:#1e40af;font-family:'DM Sans',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">${s.refundStatusLabel}</p>
                    <p style="margin:0;font-size:13px;color:#1e3a8a;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;">${refundLine}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
${certsBlock}
          <!-- Apology -->
          <tr>
            <td style="padding:0 32px 24px;text-align:center;">
              <p style="margin:0;font-size:14px;color:#737373;font-family:'DM Sans',Arial,sans-serif;line-height:1.5;text-align:${textAlign(locale)};">
                ${s.courseCancelledCta}
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

export function getCourseCancelledText(params: {
  recipientName: string;
  courseName: string;
  cancelReason: string | null;
  refundKind: CourseCancelRefundKind;
  certsRevoked?: boolean;
}, locale: EmailLocale = 'en'): string {
  const s = getEmailStrings(locale);
  const { recipientName, courseName, cancelReason, refundKind, certsRevoked } = params;

  const refundLine =
    refundKind === 'immediate' ? s.courseCancelledRefundImmediate
    : refundKind === 'manual'  ? s.courseCancelledRefundManual
    : refundKind === 'manual_pending' ? s.courseCancelledRefundManualPending
    : s.courseCancelledRefundNone;

  let text = `PhysioGuidance - ${s.courseCancelledTitle}

${s.hi} ${recipientName},

${s.courseCancelledBody}

${s.courseLabel} ${courseName}`;

  if (cancelReason) {
    text += `\n${s.reasonLabel} ${cancelReason}`;
  }

  text += `

${s.refundStatusLabel} ${refundLine}`;

  if (certsRevoked) {
    text += `\n\n${s.courseCancelledCertsRevoked}`;
  }

  text += `

${s.courseCancelledCta}

© ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}
${s.nelcFooter}`;

  return text;
}
