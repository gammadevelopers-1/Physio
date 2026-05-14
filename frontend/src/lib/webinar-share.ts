/**
 * Shared helpers for sharing a webinar's public registration link via
 * WhatsApp (and elsewhere). One source of truth so manager + instructor
 * surfaces never drift out of sync.
 */

interface ShareOpts {
  title: string;
  scheduledAt: string;
  durationMinutes?: number | null;
  registrationUrl: string;
  locale: string;
}

/**
 * Build a polished, copy-paste-ready WhatsApp message announcing a
 * webinar. Includes title, formatted date/time, duration, and the
 * registration link with a brief instruction.
 */
export function buildWebinarWhatsAppMessage(opts: ShareOpts): string {
  const isRTL = opts.locale === "ar";
  const dateObj = new Date(opts.scheduledAt);
  const formattedDateTime = dateObj.toLocaleString(
    isRTL ? "ar-SA" : "en-US",
    {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  );
  const durationLine =
    opts.durationMinutes && opts.durationMinutes > 0
      ? isRTL
        ? `⏱️ المدة: ${opts.durationMinutes} دقيقة\n`
        : `⏱️ Duration: ${opts.durationMinutes} minutes\n`
      : "";

  if (isRTL) {
    return (
      `🎙️ *دعوة لحضور ندوة عبر Zoom*\n\n` +
      `📚 *${opts.title}*\n` +
      `📅 ${formattedDateTime}\n` +
      durationLine +
      `\n` +
      `سجّل مجاناً عبر الرابط التالي:\n` +
      `${opts.registrationUrl}\n\n` +
      `يُرجى التسجيل مسبقاً، وستصلك رسالة تأكيد إلى بريدك الإلكتروني تحتوي على رابط الانضمام الشخصي.\n\n` +
      `نتطلع لرؤيتك! 🌟`
    );
  }
  return (
    `🎙️ *You're invited to a Zoom Webinar*\n\n` +
    `📚 *${opts.title}*\n` +
    `📅 ${formattedDateTime}\n` +
    durationLine +
    `\n` +
    `Register for free here:\n` +
    `${opts.registrationUrl}\n\n` +
    `Please register in advance — you'll receive a confirmation email with your personal join link.\n\n` +
    `Looking forward to seeing you there! 🌟`
  );
}

/**
 * Open WhatsApp's web share intent in a new tab with the message
 * pre-filled.
 */
export function openWebinarWhatsAppShare(opts: ShareOpts): void {
  const msg = buildWebinarWhatsAppMessage(opts);
  window.open(
    `https://wa.me/?text=${encodeURIComponent(msg)}`,
    "_blank",
    "noopener,noreferrer",
  );
}
