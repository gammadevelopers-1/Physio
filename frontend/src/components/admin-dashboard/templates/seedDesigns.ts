/**
 * Pre-authored Unlayer designs for shipped email templates.
 *
 * Each entry provides BOTH an English and Arabic variant so the admin
 * editor renders the right seed content when the AR toggle is active.
 *
 * When admin opens a template in the editor:
 *   1. If DB has a saved designJson → load that (admin's own edits).
 *   2. Else if this file has a seed design for the eventKey AT THE
 *      CURRENT LOCALE → load that (block-by-block editable).
 *   3. Else wrap the shipped default HTML in a single html block
 *      (legacy fallback; not block-editable).
 *
 * {{variable}} tokens are preserved verbatim so the backend template
 * resolver substitutes them at send time. Event keys MUST match the
 * strings in backends/src/modules/templates/template-registry.ts.
 */

// Typed block spec — the author-friendly shape. Convert to Unlayer
// JSON via `designFromBlocks()` below.
export type SeedBlock =
  | { kind: 'heading'; text: string; align?: 'left' | 'center' | 'right'; level?: 1 | 2 | 3 }
  | { kind: 'paragraph'; text: string; align?: 'left' | 'center' | 'right' }
  | { kind: 'button'; label: string; href: string; align?: 'left' | 'center' | 'right' }
  | { kind: 'divider' }
  | { kind: 'html'; html: string };

export type SeedLocale = 'en' | 'ar';

/** Localised string pair — every user-visible string in a seed is bilingual. */
type L10n = { en: string; ar: string };

/** Each seed compiles down to two SeedBlock lists — one per locale. */
export type SeedPair = { en: SeedBlock[]; ar: SeedBlock[] };

// Body-text alignment: paragraphs and greetings sit on the reading edge.
const bodyAlign = (loc: SeedLocale): 'left' | 'right' => (loc === 'ar' ? 'right' : 'left');

// ─── Brand chrome (reusable header/footer) ─────────────────────────

function brandHeader(loc: SeedLocale): SeedBlock {
  const nelcBadge =
    loc === 'ar'
      ? 'معتمد من المركز الوطني للتعلم الإلكتروني'
      : 'Accredited by the National eLearning Center';
  return {
    kind: 'html',
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#a37f49,#6b4e24);border-radius:16px 16px 0 0;" dir="${loc === 'ar' ? 'rtl' : 'ltr'}">
  <tr>
    <td style="padding:32px;text-align:center;">
      <div style="font-size:24px;font-weight:700;color:#ffffff;font-family:Arial,sans-serif;letter-spacing:-0.5px;">PhysioGuidance</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.7);font-family:Arial,sans-serif;letter-spacing:1px;text-transform:uppercase;margin-top:4px;">${nelcBadge}</div>
    </td>
  </tr>
</table>`,
  };
}

function brandFooter(loc: SeedLocale): SeedBlock {
  const allRights =
    loc === 'ar' ? 'جميع الحقوق محفوظة.' : 'All rights reserved.';
  const nelcLine =
    loc === 'ar'
      ? 'محتوى تعليمي معتمد وفقاً لمعايير المركز الوطني للتعلم الإلكتروني (سدايا).'
      : 'Accredited educational content per NELC (SDAIA) standards.';
  return {
    kind: 'html',
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;margin-top:20px;" dir="${loc === 'ar' ? 'rtl' : 'ltr'}">
  <tr>
    <td style="padding:20px 0 4px;text-align:center;font-size:12px;color:#9ca3af;font-family:Arial,sans-serif;">
      &copy; ${new Date().getFullYear()} PhysioGuidance. ${allRights}
    </td>
  </tr>
  <tr>
    <td style="padding:0 0 12px;text-align:center;font-size:11px;color:#9ca3af;font-family:Arial,sans-serif;">
      ${nelcLine}
    </td>
  </tr>
</table>`,
  };
}

// ─── Author-friendly factories (return {en, ar} pair) ─────────────
//
// Each factory takes bilingual inputs (`L10n`) for every text field
// and returns both variants in one shot — the pair is the unit the
// editor consumes.

interface L10nRow {
  label: L10n;
  value: L10n;
}

/** OTP/reset-code style: big centered code card with expiry note. */
function codeSeed(opts: {
  title: L10n;
  greetingVar: string;
  intro: L10n;
  codeVar: string;
  expiryVar: string;
  outroAfter?: L10n;
}): SeedPair {
  const buildOne = (loc: SeedLocale): SeedBlock[] => {
    const greeting =
      loc === 'ar' ? `مرحباً {{${opts.greetingVar}}}،` : `Hi {{${opts.greetingVar}}},`;
    const expiryLine =
      loc === 'ar'
        ? `تنتهي صلاحية هذا الرمز خلال {{${opts.expiryVar}}} دقيقة. ${
            opts.outroAfter?.ar ??
            'إذا لم تطلب ذلك، يرجى تجاهل هذا البريد — لا يلزم أي إجراء.'
          }`
        : `This code expires in {{${opts.expiryVar}}} minutes. ${
            opts.outroAfter?.en ??
            'If you didn\'t request it, please ignore this email — no action needed.'
          }`;
    return [
      brandHeader(loc),
      { kind: 'heading', text: opts.title[loc], align: 'center', level: 1 },
      { kind: 'paragraph', text: greeting, align: bodyAlign(loc) },
      { kind: 'paragraph', text: opts.intro[loc], align: bodyAlign(loc) },
      {
        kind: 'html',
        html: `<div style="text-align:center;padding:24px 0;" dir="ltr">
  <span style="display:inline-block;font-size:36px;font-weight:700;letter-spacing:12px;color:#111827;font-family:'Courier New',monospace;padding:20px 32px;background:#f3f4f6;border:2px solid #a37f49;border-radius:12px;">{{${opts.codeVar}}}</span>
</div>`,
      },
      { kind: 'paragraph', text: expiryLine, align: bodyAlign(loc) },
      { kind: 'divider' },
      brandFooter(loc),
    ];
  };
  return { en: buildOne('en'), ar: buildOne('ar') };
}

/** Action-button style: heading → greeting → intro → CTA button → fallback URL. */
function actionSeed(opts: {
  title: L10n;
  greeting: L10n;
  intro: L10n;
  buttonLabel: L10n;
  hrefVar: string;
  fallbackNote?: L10n | '';
  outro?: L10n;
}): SeedPair {
  const buildOne = (loc: SeedLocale): SeedBlock[] => {
    const blocks: SeedBlock[] = [
      brandHeader(loc),
      { kind: 'heading', text: opts.title[loc], align: 'center', level: 1 },
      { kind: 'paragraph', text: opts.greeting[loc], align: bodyAlign(loc) },
      { kind: 'paragraph', text: opts.intro[loc], align: bodyAlign(loc) },
      {
        kind: 'button',
        label: opts.buttonLabel[loc],
        href: `{{${opts.hrefVar}}}`,
        align: 'center',
      },
    ];
    if (opts.fallbackNote !== '') {
      const note =
        opts.fallbackNote?.[loc] ??
        (loc === 'ar'
          ? 'إذا لم يعمل الزر، انسخ الرابط التالي والصقه في متصفحك:'
          : 'If the button doesn\'t work, copy and paste this link into your browser:');
      blocks.push({ kind: 'paragraph', text: note, align: bodyAlign(loc) });
      blocks.push({
        kind: 'html',
        html: `<div style="padding:12px;background:#f3f4f6;border-radius:6px;font-family:'Courier New',monospace;font-size:12px;color:#374151;word-break:break-all;text-align:center;" dir="ltr">{{${opts.hrefVar}}}</div>`,
      });
    }
    if (opts.outro) {
      blocks.push({ kind: 'paragraph', text: opts.outro[loc], align: bodyAlign(loc) });
    }
    blocks.push({ kind: 'divider' });
    blocks.push(brandFooter(loc));
    return blocks;
  };
  return { en: buildOne('en'), ar: buildOne('ar') };
}

/** Notice style: heading + greeting + one or more body paragraphs, no CTA. */
function noticeSeed(opts: {
  title: L10n;
  greeting: L10n;
  paragraphs: L10n[];
  highlight?: L10n;
}): SeedPair {
  const buildOne = (loc: SeedLocale): SeedBlock[] => {
    const blocks: SeedBlock[] = [
      brandHeader(loc),
      { kind: 'heading', text: opts.title[loc], align: 'center', level: 1 },
      { kind: 'paragraph', text: opts.greeting[loc], align: bodyAlign(loc) },
    ];
    for (const p of opts.paragraphs) {
      blocks.push({ kind: 'paragraph', text: p[loc], align: bodyAlign(loc) });
    }
    if (opts.highlight) {
      const align = loc === 'ar' ? 'right' : 'left';
      blocks.push({
        kind: 'html',
        html: `<div style="padding:14px 18px;background:#fff8e6;border-${
          loc === 'ar' ? 'right' : 'left'
        }:4px solid #a37f49;border-radius:6px;font-size:14px;color:#374151;font-family:Arial,sans-serif;margin:12px 0;text-align:${align};" dir="${
          loc === 'ar' ? 'rtl' : 'ltr'
        }">${opts.highlight[loc]}</div>`,
      });
    }
    blocks.push({ kind: 'divider' });
    blocks.push(brandFooter(loc));
    return blocks;
  };
  return { en: buildOne('en'), ar: buildOne('ar') };
}

/** Info-list style: labeled details table + optional CTA. */
function infoListSeed(opts: {
  title: L10n;
  greeting: L10n;
  intro: L10n;
  rows: L10nRow[];
  buttonLabel?: L10n;
  hrefVar?: string;
  outro?: L10n;
}): SeedPair {
  const buildOne = (loc: SeedLocale): SeedBlock[] => {
    const dir = loc === 'ar' ? 'rtl' : 'ltr';
    const align = loc === 'ar' ? 'right' : 'left';
    const tableRows = opts.rows
      .map(
        (r) =>
          `<tr>
          <td style="padding:10px 14px;background:#f9fafb;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;font-family:Arial,sans-serif;width:34%;text-align:${align};">${r.label[loc]}</td>
          <td style="padding:10px 14px;background:#ffffff;border:1px solid #e5e7eb;font-size:14px;color:#111827;font-family:Arial,sans-serif;font-weight:500;text-align:${align};">${r.value[loc]}</td>
        </tr>`,
      )
      .join('\n');
    const blocks: SeedBlock[] = [
      brandHeader(loc),
      { kind: 'heading', text: opts.title[loc], align: 'center', level: 1 },
      { kind: 'paragraph', text: opts.greeting[loc], align: bodyAlign(loc) },
      { kind: 'paragraph', text: opts.intro[loc], align: bodyAlign(loc) },
      {
        kind: 'html',
        html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:8px 0;" dir="${dir}">
${tableRows}
</table>`,
      },
    ];
    if (opts.buttonLabel && opts.hrefVar) {
      blocks.push({
        kind: 'button',
        label: opts.buttonLabel[loc],
        href: `{{${opts.hrefVar}}}`,
        align: 'center',
      });
    }
    if (opts.outro) {
      blocks.push({ kind: 'paragraph', text: opts.outro[loc], align: bodyAlign(loc) });
    }
    blocks.push({ kind: 'divider' });
    blocks.push(brandFooter(loc));
    return blocks;
  };
  return { en: buildOne('en'), ar: buildOne('ar') };
}

// ─── Seed designs by eventKey ─────────────────────────────────────
// Keys MUST match backends/src/modules/templates/template-registry.ts.

export const SEED_DESIGNS: Record<string, SeedPair> = {
  // Account
  otp: codeSeed({
    title: { en: 'Your Verification Code', ar: 'رمز التحقق الخاص بك' },
    greetingVar: 'recipientName',
    intro: {
      en: 'Use this one-time verification code to complete your sign-in:',
      ar: 'استخدم رمز التحقق التالي لمرة واحدة لإكمال تسجيل الدخول:',
    },
    codeVar: 'code',
    expiryVar: 'expiresInMinutes',
  }),

  password_reset: codeSeed({
    title: { en: 'Reset Your Password', ar: 'إعادة تعيين كلمة المرور' },
    greetingVar: 'recipientName',
    intro: {
      en: 'Use this code to reset your PhysioGuidance password:',
      ar: 'استخدم هذا الرمز لإعادة تعيين كلمة مرور حسابك في PhysioGuidance:',
    },
    codeVar: 'code',
    expiryVar: 'expiresInMinutes',
    outroAfter: {
      en: 'If you didn\'t request a password reset, someone may have entered your email by mistake. You can safely ignore this email — your password won\'t change.',
      ar: 'إذا لم تطلب إعادة تعيين كلمة المرور، فقد يكون شخصٌ ما أدخل بريدك الإلكتروني عن طريق الخطأ. يمكنك تجاهل هذا البريد بأمان — لن تتغير كلمة المرور.',
    },
  }),

  application_approved_set_password: actionSeed({
    title: { en: 'Set Your Password', ar: 'تعيين كلمة المرور' },
    greeting: { en: 'Hi {{recipientName}},', ar: 'مرحباً {{recipientName}}،' },
    intro: {
      en: 'Your PhysioGuidance account has been created. Click the button below to set your password and get started. This link expires in {{expiresInHours}} hours.',
      ar: 'تم إنشاء حسابك في PhysioGuidance. اضغط على الزر أدناه لتعيين كلمة المرور والبدء. تنتهي صلاحية هذا الرابط خلال {{expiresInHours}} ساعة.',
    },
    buttonLabel: { en: 'Set Password', ar: 'تعيين كلمة المرور' },
    hrefVar: 'setupUrl',
  }),

  // Applications
  application_approved: noticeSeed({
    title: { en: 'Your Application Is Approved', ar: 'تمت الموافقة على طلبك' },
    greeting: { en: 'Hi {{applicantName}},', ar: 'مرحباً {{applicantName}}،' },
    paragraphs: [
      {
        en: 'Congratulations — your instructor application has been approved. You now have access to the instructor dashboard, where you can build courses, schedule sessions, and connect with students.',
        ar: 'تهانينا — تمت الموافقة على طلب انضمامك كمدرّس. لديك الآن صلاحية الوصول إلى لوحة تحكم المدرّس، حيث يمكنك إنشاء الدورات، وجدولة الجلسات، والتواصل مع الطلاب.',
      },
      {
        en: 'Sign in with your existing credentials to get started.',
        ar: 'سجّل الدخول باستخدام بيانات اعتمادك الحالية للبدء.',
      },
    ],
  }),

  application_rejected: noticeSeed({
    title: { en: 'Application Update', ar: 'تحديث بشأن طلبك' },
    greeting: { en: 'Hi {{applicantName}},', ar: 'مرحباً {{applicantName}}،' },
    paragraphs: [
      {
        en: 'Thank you for applying to join PhysioGuidance as an instructor. After reviewing your submission, we\'re unable to move forward at this time.',
        ar: 'شكراً لتقديم طلب الانضمام إلى PhysioGuidance كمدرّس. بعد مراجعة طلبك، لا يمكننا المضي قدماً في الوقت الحالي.',
      },
    ],
    highlight: {
      en: '<strong>Reason:</strong> {{reason}}',
      ar: '<strong>السبب:</strong> {{reason}}',
    },
  }),

  application_more_info: noticeSeed({
    title: { en: 'More Information Needed', ar: 'يلزم المزيد من المعلومات' },
    greeting: { en: 'Hi {{applicantName}},', ar: 'مرحباً {{applicantName}}،' },
    paragraphs: [
      {
        en: 'Thanks for your application. Our reviewer needs a bit more information before we can proceed.',
        ar: 'شكراً لتقديم طلبك. يحتاج المراجع إلى مزيد من المعلومات قبل أن نتمكن من المتابعة.',
      },
    ],
    highlight: {
      en: '<strong>Reviewer message:</strong><br/>{{reviewerMessage}}',
      ar: '<strong>رسالة المراجع:</strong><br/>{{reviewerMessage}}',
    },
  }),

  new_application_admin: actionSeed({
    title: { en: 'New Instructor Application', ar: 'طلب مدرّس جديد' },
    greeting: { en: 'Hi team,', ar: 'مرحباً بالفريق،' },
    intro: {
      en: 'A new instructor application from <strong>{{applicantName}}</strong> is awaiting review.',
      ar: 'طلب مدرّس جديد من <strong>{{applicantName}}</strong> بانتظار المراجعة.',
    },
    buttonLabel: { en: 'Review Application', ar: 'مراجعة الطلب' },
    hrefVar: 'applicationUrl',
  }),

  // Enrollment
  enrollment_confirmation: infoListSeed({
    title: { en: 'You\'re Enrolled!', ar: 'تم تسجيلك!' },
    greeting: { en: 'Hi {{studentName}},', ar: 'مرحباً {{studentName}}،' },
    intro: {
      en: 'Welcome to <strong>{{courseName}}</strong>. Here\'s a quick summary of your enrollment:',
      ar: 'مرحباً بك في <strong>{{courseName}}</strong>. إليك ملخصاً سريعاً لتسجيلك:',
    },
    rows: [
      { label: { en: 'Course', ar: 'الدورة' }, value: { en: '{{courseName}}', ar: '{{courseName}}' } },
      { label: { en: 'Starts', ar: 'تاريخ البدء' }, value: { en: '{{startDate}}', ar: '{{startDate}}' } },
      { label: { en: 'Instructor', ar: 'المدرّس' }, value: { en: '{{instructorName}}', ar: '{{instructorName}}' } },
    ],
    outro: {
      en: 'You\'ll find the course in your student dashboard. Session invites will arrive by email as they\'re scheduled.',
      ar: 'ستجد الدورة في لوحة تحكم الطالب. ستصلك دعوات الجلسات بالبريد الإلكتروني حال جدولتها.',
    },
  }),

  // Sessions
  session_scheduled: infoListSeed({
    title: { en: 'New Session Scheduled', ar: 'تم جدولة جلسة جديدة' },
    greeting: { en: 'Hi {{recipientName}},', ar: 'مرحباً {{recipientName}}،' },
    intro: {
      en: 'A new live session has been added to <strong>{{courseName}}</strong>.',
      ar: 'تم إضافة جلسة مباشرة جديدة إلى <strong>{{courseName}}</strong>.',
    },
    rows: [
      { label: { en: 'Session', ar: 'الجلسة' }, value: { en: '{{sessionTitle}}', ar: '{{sessionTitle}}' } },
      { label: { en: 'Course', ar: 'الدورة' }, value: { en: '{{courseName}}', ar: '{{courseName}}' } },
      { label: { en: 'Date & Time', ar: 'التاريخ والوقت' }, value: { en: '{{scheduledAt}}', ar: '{{scheduledAt}}' } },
    ],
    outro: {
      en: 'You\'ll get a reminder 5 minutes before it starts.',
      ar: 'ستصلك رسالة تذكير قبل 5 دقائق من بدء الجلسة.',
    },
  }),

  session_reminder_5min: infoListSeed({
    title: { en: 'Session Starting Soon', ar: 'الجلسة على وشك البدء' },
    greeting: { en: 'Hi {{recipientName}},', ar: 'مرحباً {{recipientName}}،' },
    intro: {
      en: 'Your live session starts in about 5 minutes. Get ready to join.',
      ar: 'تبدأ جلستك المباشرة خلال حوالي 5 دقائق. استعد للانضمام.',
    },
    rows: [
      { label: { en: 'Session', ar: 'الجلسة' }, value: { en: '{{sessionTitle}}', ar: '{{sessionTitle}}' } },
      { label: { en: 'Course', ar: 'الدورة' }, value: { en: '{{courseName}}', ar: '{{courseName}}' } },
      { label: { en: 'Starts', ar: 'يبدأ' }, value: { en: '{{scheduledAt}}', ar: '{{scheduledAt}}' } },
      {
        label: { en: 'Duration', ar: 'المدة' },
        value: { en: '{{durationMinutes}} minutes', ar: '{{durationMinutes}} دقيقة' },
      },
    ],
    outro: {
      en: 'The join link is in your dashboard under Live Sessions.',
      ar: 'رابط الانضمام موجود في لوحة التحكم تحت قسم الجلسات المباشرة.',
    },
  }),

  session_started: noticeSeed({
    title: { en: 'Session Is Live', ar: 'الجلسة مباشرة الآن' },
    greeting: { en: 'Hi {{recipientName}},', ar: 'مرحباً {{recipientName}}،' },
    paragraphs: [
      {
        en: '<strong>{{sessionTitle}}</strong> has just gone live. Head to your dashboard now to join.',
        ar: 'بدأت <strong>{{sessionTitle}}</strong> للتو. توجّه إلى لوحة التحكم الآن للانضمام.',
      },
    ],
  }),

  session_ended: actionSeed({
    title: { en: 'Session Recording Ready', ar: 'تسجيل الجلسة جاهز' },
    greeting: { en: 'Hi {{recipientName}},', ar: 'مرحباً {{recipientName}}،' },
    intro: {
      en: '<strong>{{sessionTitle}}</strong> has ended. The recording is ready to watch on-demand.',
      ar: 'انتهت <strong>{{sessionTitle}}</strong>. أصبح التسجيل جاهزاً للمشاهدة عند الطلب.',
    },
    buttonLabel: { en: 'Watch Recording', ar: 'مشاهدة التسجيل' },
    hrefVar: 'recordingUrl',
    fallbackNote: '',
  }),

  session_cancelled: noticeSeed({
    title: { en: 'Session Cancelled', ar: 'تم إلغاء الجلسة' },
    greeting: { en: 'Hi {{recipientName}},', ar: 'مرحباً {{recipientName}}،' },
    paragraphs: [
      {
        en: 'The session <strong>{{sessionTitle}}</strong> has been cancelled. We\'ll notify you as soon as it\'s rescheduled.',
        ar: 'تم إلغاء الجلسة <strong>{{sessionTitle}}</strong>. سنُعلمك بمجرد إعادة جدولتها.',
      },
    ],
    highlight: {
      en: '<strong>Reason:</strong> {{reason}}',
      ar: '<strong>السبب:</strong> {{reason}}',
    },
  }),

  ta_assignment: noticeSeed({
    title: {
      en: 'You\'ve Been Assigned as a Teaching Assistant',
      ar: 'تم تعيينك كمساعد تدريس',
    },
    greeting: { en: 'Hi {{recipientName}},', ar: 'مرحباً {{recipientName}}،' },
    paragraphs: [
      {
        en: 'You\'ve been assigned to support <strong>{{courseName}}</strong> alongside instructor <strong>{{instructorName}}</strong>.',
        ar: 'تم تعيينك لدعم <strong>{{courseName}}</strong> إلى جانب المدرّس <strong>{{instructorName}}</strong>.',
      },
      {
        en: 'You can now view the course roster, assist during live sessions, and answer student questions from your dashboard.',
        ar: 'يمكنك الآن الاطلاع على قائمة الطلاب، والمساعدة أثناء الجلسات المباشرة، والإجابة عن أسئلة الطلاب من لوحة التحكم.',
      },
    ],
  }),

  ta_rejection: noticeSeed({
    title: { en: 'TA Assignment Withdrawn', ar: 'تم سحب تعيين مساعد التدريس' },
    greeting: { en: 'Hi {{recipientName}},', ar: 'مرحباً {{recipientName}}،' },
    paragraphs: [
      {
        en: 'Your Teaching Assistant assignment for <strong>{{courseName}}</strong> has been withdrawn.',
        ar: 'تم سحب تعيينك كمساعد تدريس لـ <strong>{{courseName}}</strong>.',
      },
    ],
    highlight: {
      en: '<strong>Reason:</strong> {{reason}}',
      ar: '<strong>السبب:</strong> {{reason}}',
    },
  }),

  // Webinars
  webinar_registration_setup: actionSeed({
    title: { en: 'Your Webinar Access Link', ar: 'رابط الوصول إلى الندوة' },
    greeting: { en: 'Hi {{studentName}},', ar: 'مرحباً {{studentName}}،' },
    intro: {
      en: 'Thanks for registering for <strong>{{courseName}}</strong>. Your personal join link is below — keep it handy, it\'s tied to your account.',
      ar: 'شكراً لتسجيلك في <strong>{{courseName}}</strong>. رابط الانضمام الشخصي أدناه — احتفظ به، فهو مرتبط بحسابك.',
    },
    buttonLabel: { en: 'Join Webinar', ar: 'الانضمام إلى الندوة' },
    hrefVar: 'joinLink',
  }),

  webinar_live: noticeSeed({
    title: { en: 'Webinar Is Live', ar: 'الندوة مباشرة الآن' },
    greeting: { en: 'Hi {{recipientName}},', ar: 'مرحباً {{recipientName}}،' },
    paragraphs: [
      {
        en: '<strong>{{webinarTitle}}</strong> has just started broadcasting. Head to your dashboard to join now.',
        ar: 'بدأ بث <strong>{{webinarTitle}}</strong> للتو. توجّه إلى لوحة التحكم للانضمام الآن.',
      },
    ],
  }),

  webinar_paid_enrollment_nudge: actionSeed({
    title: { en: 'Complete Your Enrollment', ar: 'أكمل تسجيلك' },
    greeting: { en: 'Hi {{recipientName}},', ar: 'مرحباً {{recipientName}}،' },
    intro: {
      en: 'You started enrolling in <strong>{{courseName}}</strong> but didn\'t finish checkout. Seats are limited — complete your registration to secure your spot.',
      ar: 'بدأت التسجيل في <strong>{{courseName}}</strong> لكنك لم تُكمل الدفع. المقاعد محدودة — أكمل تسجيلك لتأمين مقعدك.',
    },
    buttonLabel: { en: 'Finish Checkout', ar: 'إكمال الدفع' },
    hrefVar: 'courseUrl',
  }),

  // Certificates
  certificate_approved: infoListSeed({
    title: { en: 'Your Certificate Is Ready', ar: 'شهادتك جاهزة' },
    greeting: { en: 'Hi {{studentName}},', ar: 'مرحباً {{studentName}}،' },
    intro: {
      en: 'Congratulations on completing <strong>{{courseName}}</strong>. Your accredited certificate is ready to download.',
      ar: 'تهانينا على إكمال <strong>{{courseName}}</strong>. شهادتك المعتمدة جاهزة للتنزيل.',
    },
    rows: [
      { label: { en: 'Course', ar: 'الدورة' }, value: { en: '{{courseName}}', ar: '{{courseName}}' } },
      {
        label: { en: 'Certificate ID', ar: 'معرّف الشهادة' },
        value: { en: '{{certificateId}}', ar: '{{certificateId}}' },
      },
    ],
    buttonLabel: { en: 'Download Certificate', ar: 'تنزيل الشهادة' },
    hrefVar: 'downloadUrl',
    outro: {
      en: 'Keep the Certificate ID for your records — it can be used to verify authenticity at any time.',
      ar: 'احتفظ بمعرّف الشهادة لسجلاتك — يمكن استخدامه للتحقق من صحة الشهادة في أي وقت.',
    },
  }),

  certificate_rejected: noticeSeed({
    title: { en: 'Certificate Request Update', ar: 'تحديث طلب الشهادة' },
    greeting: { en: 'Hi {{studentName}},', ar: 'مرحباً {{studentName}}،' },
    paragraphs: [
      {
        en: 'Your certificate request for <strong>{{courseName}}</strong> has been declined.',
        ar: 'تم رفض طلب الشهادة الخاص بك لـ <strong>{{courseName}}</strong>.',
      },
    ],
    highlight: {
      en: '<strong>Reason:</strong> {{reason}}',
      ar: '<strong>السبب:</strong> {{reason}}',
    },
  }),

  certificate_held: noticeSeed({
    title: { en: 'Certificate On Hold', ar: 'الشهادة قيد المراجعة' },
    greeting: { en: 'Hi {{studentName}},', ar: 'مرحباً {{studentName}}،' },
    paragraphs: [
      {
        en: 'Your certificate for <strong>{{courseName}}</strong> is temporarily on hold pending review. We\'ll email you again as soon as it\'s cleared.',
        ar: 'شهادتك لـ <strong>{{courseName}}</strong> قيد المراجعة حالياً. سنُرسل لك بريداً إلكترونياً حال الانتهاء من المراجعة.',
      },
    ],
    highlight: {
      en: '<strong>Reason:</strong> {{reason}}',
      ar: '<strong>السبب:</strong> {{reason}}',
    },
  }),

  // Assessments
  assessment_submitted: noticeSeed({
    title: { en: 'Assessment Submitted', ar: 'تم تسليم التقييم' },
    greeting: { en: 'Hi {{studentName}},', ar: 'مرحباً {{studentName}}،' },
    paragraphs: [
      {
        en: 'We\'ve received your submission for <strong>{{assessmentTitle}}</strong> in <strong>{{courseName}}</strong>. You\'ll be notified once it\'s graded.',
        ar: 'استلمنا تسليمك لـ <strong>{{assessmentTitle}}</strong> في <strong>{{courseName}}</strong>. سنُعلمك بمجرد إتمام التصحيح.',
      },
    ],
  }),

  retake_granted: infoListSeed({
    title: { en: 'Retake Granted', ar: 'تم منح إعادة المحاولة' },
    greeting: { en: 'Hi {{studentName}},', ar: 'مرحباً {{studentName}}،' },
    intro: {
      en: 'You\'ve been granted a retake attempt.',
      ar: 'تم منحك محاولة إعادة.',
    },
    rows: [
      {
        label: { en: 'Assessment', ar: 'التقييم' },
        value: { en: '{{assessmentTitle}}', ar: '{{assessmentTitle}}' },
      },
      { label: { en: 'Course', ar: 'الدورة' }, value: { en: '{{courseName}}', ar: '{{courseName}}' } },
      {
        label: { en: 'New due date', ar: 'الموعد النهائي الجديد' },
        value: { en: '{{newDueDate}}', ar: '{{newDueDate}}' },
      },
    ],
    outro: { en: 'Reason: {{reason}}', ar: 'السبب: {{reason}}' },
  }),

  time_extension_granted: infoListSeed({
    title: { en: 'Deadline Extended', ar: 'تم تمديد الموعد النهائي' },
    greeting: { en: 'Hi {{studentName}},', ar: 'مرحباً {{studentName}}،' },
    intro: {
      en: 'The deadline for your assessment has been extended.',
      ar: 'تم تمديد الموعد النهائي لتقييمك.',
    },
    rows: [
      {
        label: { en: 'Assessment', ar: 'التقييم' },
        value: { en: '{{assessmentTitle}}', ar: '{{assessmentTitle}}' },
      },
      {
        label: { en: 'New due date', ar: 'الموعد النهائي الجديد' },
        value: { en: '{{newDueDate}}', ar: '{{newDueDate}}' },
      },
    ],
  }),

  at_risk_reminder: noticeSeed({
    title: {
      en: 'Let\'s Get You Back On Track',
      ar: 'لنعدك إلى المسار الصحيح',
    },
    greeting: { en: 'Hi {{studentName}},', ar: 'مرحباً {{studentName}}،' },
    paragraphs: [
      {
        en: 'We noticed you\'re falling behind in <strong>{{courseName}}</strong>. A small push now goes a long way toward your certificate — we\'re here to help if you need it.',
        ar: 'لاحظنا أنك متأخر في <strong>{{courseName}}</strong>. دفعة صغيرة الآن تقرّبك كثيراً من شهادتك — نحن هنا للمساعدة إذا احتجت.',
      },
    ],
    highlight: {
      en: '<strong>Flagged for:</strong> {{risk}}',
      ar: '<strong>سبب التنبيه:</strong> {{risk}}',
    },
  }),

  // Content
  content_pending_review: actionSeed({
    title: { en: 'Content Submitted for Review', ar: 'تم تسليم محتوى للمراجعة' },
    greeting: { en: 'Hi team,', ar: 'مرحباً بالفريق،' },
    intro: {
      en: '<strong>{{instructorName}}</strong> has submitted new content for <strong>{{courseName}}</strong>. Please review before publishing.',
      ar: 'قام <strong>{{instructorName}}</strong> بتسليم محتوى جديد لـ <strong>{{courseName}}</strong>. يرجى المراجعة قبل النشر.',
    },
    buttonLabel: { en: 'Review Content', ar: 'مراجعة المحتوى' },
    hrefVar: 'reviewUrl',
  }),

  content_review: noticeSeed({
    title: { en: 'Content Review Outcome', ar: 'نتيجة مراجعة المحتوى' },
    greeting: { en: 'Hi {{instructorName}},', ar: 'مرحباً {{instructorName}}،' },
    paragraphs: [
      {
        en: 'Your submitted content for <strong>{{courseName}}</strong> has been reviewed.',
        ar: 'تمت مراجعة المحتوى الذي قدّمته لـ <strong>{{courseName}}</strong>.',
      },
    ],
    highlight: {
      en: '<strong>Outcome:</strong> {{outcome}}<br/><br/><strong>Feedback:</strong><br/>{{feedback}}',
      ar: '<strong>النتيجة:</strong> {{outcome}}<br/><br/><strong>الملاحظات:</strong><br/>{{feedback}}',
    },
  }),

  review_pending_approval: noticeSeed({
    title: { en: 'Review Awaiting Approval', ar: 'مراجعة بانتظار الموافقة' },
    greeting: { en: 'Hi team,', ar: 'مرحباً بالفريق،' },
    paragraphs: [
      {
        en: '<strong>{{reviewerName}}</strong> submitted a new review for <strong>{{courseName}}</strong> that needs admin sign-off before it goes public.',
        ar: 'قدّم <strong>{{reviewerName}}</strong> مراجعة جديدة لـ <strong>{{courseName}}</strong> تحتاج إلى موافقة الإدارة قبل نشرها.',
      },
    ],
    highlight: {
      en: '<em>"{{reviewSnippet}}"</em>',
      ar: '<em>"{{reviewSnippet}}"</em>',
    },
  }),
};

// ─── Unlayer design generator ─────────────────────────────────
//
// Produces the JSON shape Unlayer's `loadDesign` accepts. Each seed
// block becomes one row → one column → one typed content. Admin can
// click each block in the canvas to edit its text/color/spacing
// independently.

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `u_${idCounter}_${Math.floor(Math.random() * 100000)}`;
}

function textBlockValues(html: string, align: 'left' | 'center' | 'right' = 'left') {
  return {
    text: `<p style="line-height: 140%; text-align:${align};">${html}</p>`,
    hideDesktop: false,
    hideMobile: false,
    containerPadding: '10px',
    textAlign: align,
    lineHeight: '140%',
    linkStyle: {
      inherit: true,
      linkColor: '#0000ee',
      linkHoverColor: '#0000ee',
      linkUnderline: true,
      linkHoverUnderline: true,
    },
    _meta: { htmlID: nextId(), htmlClassNames: 'u_content_text' },
  };
}

function headingBlockValues(
  text: string,
  align: 'left' | 'center' | 'right' = 'center',
  level: 1 | 2 | 3 = 1,
) {
  const fontSize = level === 1 ? 24 : level === 2 ? 20 : 18;
  return {
    text: `<h${level} style="line-height: 140%; text-align:${align}; font-size:${fontSize}px; font-weight:700; color:#111827;">${text}</h${level}>`,
    hideDesktop: false,
    hideMobile: false,
    containerPadding: '10px',
    _meta: { htmlID: nextId(), htmlClassNames: 'u_content_heading' },
  };
}

function buttonBlockValues(
  label: string,
  href: string,
  align: 'left' | 'center' | 'right' = 'center',
) {
  return {
    href: { name: 'web', values: { href, target: '_blank' } },
    buttonColors: {
      color: '#ffffff',
      backgroundColor: '#a37f49',
      hoverColor: '#ffffff',
      hoverBackgroundColor: '#6b4e24',
    },
    size: { autoWidth: true, width: '100%' },
    fontWeight: 700,
    textAlign: align,
    lineHeight: '120%',
    padding: '12px 28px',
    borderRadius: '8px',
    border: {},
    hideDesktop: false,
    hideMobile: false,
    containerPadding: '10px',
    text: label,
    calculatedWidth: 200,
    calculatedHeight: 44,
    _meta: { htmlID: nextId(), htmlClassNames: 'u_content_button' },
  };
}

function dividerBlockValues() {
  return {
    width: '100%',
    border: { borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: '#e5e7eb' },
    textAlign: 'center',
    containerPadding: '10px',
    hideDesktop: false,
    hideMobile: false,
    _meta: { htmlID: nextId(), htmlClassNames: 'u_content_divider' },
  };
}

function htmlBlockValues(html: string) {
  return {
    html,
    hideDesktop: false,
    hideMobile: false,
    containerPadding: '0px',
    _meta: { htmlID: nextId(), htmlClassNames: 'u_content_html' },
  };
}

function contentForBlock(b: SeedBlock): { type: string; values: object; id: string } {
  const id = nextId();
  switch (b.kind) {
    case 'heading':
      return { id, type: 'heading', values: headingBlockValues(b.text, b.align, b.level) };
    case 'paragraph':
      return { id, type: 'text', values: textBlockValues(b.text, b.align) };
    case 'button':
      return { id, type: 'button', values: buttonBlockValues(b.label, b.href, b.align) };
    case 'divider':
      return { id, type: 'divider', values: dividerBlockValues() };
    case 'html':
      return { id, type: 'html', values: htmlBlockValues(b.html) };
  }
}

function rowValues() {
  return {
    displayCondition: null,
    columns: false,
    backgroundColor: '',
    columnsBackgroundColor: '',
    backgroundImage: { url: '', fullWidth: true, repeat: false, center: true, cover: false },
    padding: '0px',
    hideDesktop: false,
    hideMobile: false,
    noStackMobile: false,
    _meta: { htmlID: nextId(), htmlClassNames: 'u_row' },
    selectable: true,
    draggable: true,
    duplicatable: true,
    deletable: true,
  };
}

function columnValues() {
  return { _meta: { htmlID: nextId(), htmlClassNames: 'u_column' } };
}

/**
 * Convert the author-friendly seed block list into a full Unlayer
 * design tree the editor can load.
 */
export function designFromBlocks(blocks: SeedBlock[]): Record<string, unknown> {
  const rows = blocks.map((b) => ({
    id: nextId(),
    cells: [1],
    columns: [
      {
        id: nextId(),
        contents: [contentForBlock(b)],
        values: columnValues(),
      },
    ],
    values: rowValues(),
  }));

  return {
    counters: {
      u_column: blocks.length,
      u_row: blocks.length,
      u_content_text: blocks.length,
    },
    body: {
      id: 'body',
      rows,
      values: {
        textColor: '#111827',
        backgroundColor: '#EEF3F7',
        backgroundImage: { url: '', fullWidth: true, repeat: false, center: true, cover: false },
        contentWidth: '600px',
        fontFamily: { label: 'Arial', value: 'arial,helvetica,sans-serif' },
        preheaderText: '',
        linkStyle: {
          body: true,
          linkColor: '#0000ee',
          linkHoverColor: '#0000ee',
          linkUnderline: true,
          linkHoverUnderline: true,
        },
        _meta: { htmlID: 'u_body', htmlClassNames: 'u_body' },
      },
    },
    schemaVersion: 12,
  };
}
