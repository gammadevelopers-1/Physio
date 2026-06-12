/**
 * Shared blocks for the trainer-application email family. Renders the
 * "Submit changes" + "Check status" + "Contact support" CTAs and the
 * structured "what's missing" list using existing email-i18n strings,
 * so the three templates stay consistent visually and copy-wise.
 */
import { EmailLocale, getEmailStrings, textAlign } from '../email-i18n';
import type { MissingRequirement, MissingRequirementCode } from '../../../database/schema';

/** Trim trailing slash so URL concatenation is predictable. */
function base(url: string): string {
  return url.replace(/\/$/, '');
}

/** Map a missing-requirement code to its translated label. */
function missingReqLabel(req: MissingRequirement, locale: EmailLocale): string {
  const s = getEmailStrings(locale);
  const map: Record<MissingRequirementCode, string> = {
    CV_MISSING: s.missingReqCV,
    SCFHS_VERIFICATION: s.missingReqScfhs,
    QUALIFICATION_DOC: s.missingReqQualification,
    PHOTO: s.missingReqPhoto,
    BANK_DETAILS: s.missingReqBank,
    NATIONAL_ID: s.missingReqNationalId,
    OTHER: req.label?.trim() || '—',
  };
  return map[req.code];
}

/**
 * Renders the structured "what's missing" panel HTML block. Returns
 * an empty string when there are no missing reqs so the template can
 * unconditionally interpolate it.
 */
export function renderMissingRequirementsHtml(
  missing: MissingRequirement[] | undefined,
  locale: EmailLocale,
): string {
  if (!missing || missing.length === 0) return '';
  const s = getEmailStrings(locale);
  const align = textAlign(locale);

  const items = missing
    .map((req) => {
      const label = missingReqLabel(req, locale);
      const noteHtml = req.note
        ? `<div style="margin-top:4px;font-size:12px;color:#92400e;font-style:italic;">${req.note}</div>`
        : '';
      return `<li style="margin:0 0 8px;font-size:14px;color:#1a1a1a;line-height:1.5;text-align:${align};">
        <strong>${label}</strong>${noteHtml}
      </li>`;
    })
    .join('');

  return `
    <tr>
      <td style="padding:16px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:10px;border:1px solid #fde68a;">
          <tr>
            <td style="padding:20px;">
              <p style="margin:0 0 12px;font-size:12px;color:#92400e;font-family:'DM Sans',Arial,sans-serif;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;text-align:${align};">${s.appMissingHeading}</p>
              <ul style="margin:0;padding:${locale === 'ar' ? '0 20px 0 0' : '0 0 0 20px'};font-family:'DM Sans',Arial,sans-serif;">
                ${items}
              </ul>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

export function renderMissingRequirementsText(
  missing: MissingRequirement[] | undefined,
  locale: EmailLocale,
): string {
  if (!missing || missing.length === 0) return '';
  const s = getEmailStrings(locale);
  const items = missing
    .map((req) => {
      const label = missingReqLabel(req, locale);
      const note = req.note ? `\n   - ${req.note}` : '';
      return `• ${label}${note}`;
    })
    .join('\n');
  return `\n${s.appMissingHeading}:\n${items}\n`;
}

/**
 * Renders the action-button row at the bottom of the email body.
 * `primaryHref` (e.g. "submit changes") gets the brand-gradient
 * button; everything else gets a quieter outline button. Both render
 * as visually-correct `<a>` anchors that look like buttons.
 *
 * Passing an empty/undefined href omits that button entirely so the
 * same renderer works for emails that don't have a primary CTA
 * (e.g. rejected — only secondary "Contact support").
 */
export function renderTrainerAppCtasHtml(
  opts: {
    frontendUrl: string;
    locale: EmailLocale;
    primary?: { href: string; label: string } | null;
  },
): string {
  const s = getEmailStrings(opts.locale);
  const fe = base(opts.frontendUrl);
  const checkStatusUrl = `${fe}/${opts.locale}/become-trainer`;
  const supportUrl = `${fe}/${opts.locale}/support`;

  const primaryBtn = opts.primary
    ? `
      <tr>
        <td align="center" style="padding:8px 0;">
          <a href="${opts.primary.href}"
             style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#a37f49,#6b4e24);color:#ffffff;text-decoration:none;border-radius:999px;font-size:14px;font-weight:600;font-family:'DM Sans',Arial,sans-serif;">
            ${opts.primary.label}
          </a>
        </td>
      </tr>`
    : '';

  return `
    <tr>
      <td style="padding:24px 32px 8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${primaryBtn}
          <tr>
            <td align="center" style="padding:8px 0;">
              <a href="${checkStatusUrl}"
                 style="display:inline-block;padding:10px 24px;background:#ffffff;color:#a37f49;text-decoration:none;border:1.5px solid #a37f49;border-radius:999px;font-size:13px;font-weight:600;font-family:'DM Sans',Arial,sans-serif;margin:4px;">
                ${s.appCheckStatusCta}
              </a>
              <a href="${supportUrl}"
                 style="display:inline-block;padding:10px 24px;background:#ffffff;color:#525252;text-decoration:none;border:1.5px solid #e5e7eb;border-radius:999px;font-size:13px;font-weight:600;font-family:'DM Sans',Arial,sans-serif;margin:4px;">
                ${s.appContactSupportCta}
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 0 0;">
              <p style="margin:0;font-size:12px;color:#9ca3af;font-family:'DM Sans',Arial,sans-serif;">
                ${s.appContactSupportHint}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

export function renderTrainerAppCtasText(
  opts: {
    frontendUrl: string;
    locale: EmailLocale;
    primary?: { href: string; label: string } | null;
  },
): string {
  const s = getEmailStrings(opts.locale);
  const fe = base(opts.frontendUrl);
  const lines: string[] = [];
  if (opts.primary) {
    lines.push(`${opts.primary.label}: ${opts.primary.href}`);
  }
  lines.push(`${s.appCheckStatusCta}: ${fe}/${opts.locale}/become-trainer`);
  lines.push(`${s.appContactSupportCta}: ${fe}/${opts.locale}/support`);
  return '\n' + lines.join('\n') + '\n';
}
