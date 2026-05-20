/**
 * Shared helpers for sharing a webinar's public registration link via
 * WhatsApp. One source of truth so manager + instructor surfaces never
 * drift out of sync.
 *
 * The WhatsApp message is ALWAYS bilingual (English block, then divider,
 * then Arabic block) and ALWAYS uses Riyadh time — by client request, so
 * the same prefilled text works for any recipient regardless of the
 * sender's UI locale.
 */

interface ShareOpts {
  title: string;
  scheduledAt: string;
  durationMinutes?: number | null;
  registrationUrl: string;
  /**
   * Course this webinar belongs to. Surfaced as a "Course / الدورة"
   * line above the topic so recipients know the context. Optional —
   * omitted if not passed in.
   */
  courseName?: string | null;
  /**
   * Zoom webinar ID — surfaced in the message as "Meeting ID" the way
   * Zoom itself labels it on the registration confirmation page.
   * Optional: omitted line if the session predates Zoom integration.
   */
  zoomWebinarId?: string | null;
  /**
   * Kept for backwards-compat at the call sites — the template no
   * longer branches on it, but pass it anyway so future changes can
   * pick it up without touching every caller.
   */
  locale?: string;
}

const SUPPORT_PHONE = "0555614285";

// Always format in Riyadh time so the message reads the same to any
// recipient regardless of the manager's browser timezone.
function formatRiyadh(scheduledAt: string, lang: "en" | "ar"): string {
  const d = new Date(scheduledAt);
  return d.toLocaleString(lang === "ar" ? "ar-SA" : "en-US", {
    timeZone: "Asia/Riyadh",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Build a polished, copy-paste-ready bilingual WhatsApp message
 * announcing a webinar.
 */
export function buildWebinarWhatsAppMessage(opts: ShareOpts): string {
  const enDateTime = formatRiyadh(opts.scheduledAt, "en");
  const arDateTime = formatRiyadh(opts.scheduledAt, "ar");

  const meetingIdLine = opts.zoomWebinarId
    ? `Meeting ID: ${opts.zoomWebinarId}\n`
    : "";

  const enCourseLine = opts.courseName ? `Course: ${opts.courseName}\n` : "";
  const arCourseLine = opts.courseName ? `الدورة: ${opts.courseName}\n` : "";

  const en =
    `Hi there,\n` +
    `You are invited to register for a Zoom webinar\n\n` +
    `When: ${enDateTime} Riyadh Time\n` +
    enCourseLine +
    `Topic: ${opts.title}\n\n` +
    `Register in advance for this webinar:\n` +
    `${opts.registrationUrl}\n\n` +
    `After registering, you will receive a confirmation email containing information about joining the webinar.`;

  const ar =
    `أهلاً،\n` +
    `أنت مدعو للتسجيل في ندوة عبر الإنترنت Zoom\n\n` +
    `الزمان: ${arDateTime} بتوقيت الرياض\n` +
    arCourseLine +
    `الموضوع: ${opts.title}\n\n` +
    `يمكنك التسجيل مسبقاً لهذه الندوة عبر الويب:\n` +
    `${opts.registrationUrl}\n\n` +
    `بعد التسجيل، ستتلقى رسالة تأكيد بالبريد الإلكتروني تحتوي على معلومات حول الانضمام إلى الندوة عبر الويب.\n\n` +
    `في حال واجهتكم أي مشكلة، الرجاء التواصل مع الدعم الفني عبر واتس اب على الرقم الموحد:\n` +
    `${SUPPORT_PHONE}`;

  return (
    `${en}\n\n` +
    `---\n\n` +
    `${ar}\n\n` +
    `${meetingIdLine}` +
    `-----------------------------------------------`
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

/**
 * Variant for PAID Webinar Courses. We do NOT share the raw Zoom
 * registration URL because that would let outsiders register and join
 * without paying. Instead the share points to the public course page
 * where the outsider goes through checkout → enrollment → backend
 * programmatically registers them in Zoom and emails the personal join
 * link. The Zoom URL itself never leaves our UI.
 */
interface CoursePageShareOpts {
  webinarTitle: string;
  scheduledAt: string;
  courseName?: string | null;
  courseUrl: string;
}

export function buildCoursePageWhatsAppMessage(opts: CoursePageShareOpts): string {
  // Date/time formatting per client template:
  //   EN: "DD/MM/YYYY" + "h:mm AM/PM (Riyadh Time)"
  //   AR: "YYYY/MM/DD" (Arabic-Indic digits) + "h:mm صباحاً/مساءً بتوقيت الرياض"
  // Both blocks always render in Asia/Riyadh regardless of sender TZ.
  const dt = new Date(opts.scheduledAt);
  const partsEn = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(dt);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    partsEn.find((p) => p.type === type)?.value ?? "";
  const yyyy = get("year");
  const mm = get("month");
  const dd = get("day");
  const hh = get("hour");
  const min = get("minute");
  const ampm = get("dayPeriod"); // "AM" | "PM"

  const enDate = `${dd}/${mm}/${yyyy}`;
  const enTime = `${hh}:${min} ${ampm}`;

  const toArabicDigits = (s: string) =>
    s.replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
  const arDate = toArabicDigits(`${yyyy}/${mm}/${dd}`);
  const arTime = `${toArabicDigits(`${hh}:${min}`)} ${ampm === "AM" ? "صباحاً" : "مساءً"}`;

  const enCourseLine = opts.courseName ? `Course: ${opts.courseName}\n` : "";
  const arCourseLine = opts.courseName ? `الدورة: ${opts.courseName}\n` : "";

  // Markdown-style links: WhatsApp does NOT render `[label](url)` as a
  // hyperlink, but it DOES auto-linkify the bare URL inside the parens,
  // so the user sees `[Enroll in the Course](` then a clickable URL
  // then `)`. That's the exact format the client supplied — keep it.
  const en =
    `Hi there,\n` +
    `You are invited to attend an upcoming live webinar hosted by Physioguidance.\n\n` +
    `Date: ${enDate}\n` +
    `Time: ${enTime} (Riyadh Time)\n` +
    enCourseLine +
    `\n` +
    `To join the webinar, please complete your course enrollment through the link below:\n` +
    `[Enroll in the Course](${opts.courseUrl})\n\n` +
    `After successfully completing your enrollment, your personal webinar access link will be automatically sent to your registered email address.\n\n` +
    `Please note that webinar access is available exclusively for officially enrolled participants.`;

  const ar =
    `أهلاً،\n` +
    `يسرنا دعوتكم لحضور دورة مباشرة مقدمة من منصة Physioguidance.\n\n` +
    `التاريخ: ${arDate}\n` +
    `الوقت: ${arTime} بتوقيت الرياض\n` +
    arCourseLine +
    `\n` +
    `للانضمام إلى الدورة، يرجى إكمال التسجيل عبر الرابط التالي:\n` +
    `[التسجيل في الدورة](${opts.courseUrl})\n\n` +
    `بعد إتمام التسجيل بنجاح، سيتم إرسال رابط الدخول الشخصي الخاص بالدورة تلقائياً إلى بريدكم الإلكتروني المسجل.\n\n` +
    `يرجى ملاحظة أن حضور الدورة متاح فقط للمشاركين المسجلين رسمياً.\n\n` +
    `في حال واجهتكم أي مشكلة، يرجى التواصل مع الدعم الفني عبر واتس اب على الرقم الموحد:\n` +
    `${SUPPORT_PHONE}`;

  // No divider line, no trailing dashes — per client template the two
  // blocks sit back-to-back with a blank line between them.
  return `${en}\n\n${ar}`;
}

export function openCoursePageWhatsAppShare(opts: CoursePageShareOpts): void {
  const msg = buildCoursePageWhatsAppMessage(opts);
  window.open(
    `https://wa.me/?text=${encodeURIComponent(msg)}`,
    "_blank",
    "noopener,noreferrer",
  );
}
