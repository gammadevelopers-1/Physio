#!/usr/bin/env node
/**
 * One-shot seeder for the Support Page single-type only.
 *
 * Unlike `seed-content.js`, this script touches NOTHING else — no FAQ,
 * no About page, no site settings — so it is safe to run against prod
 * without risk of overwriting other content the admin has edited.
 *
 * Usage:
 *   STRAPI_URL=https://cms.physioguidance.org \
 *   STRAPI_API_TOKEN=<full-access-token> \
 *   node strapi/scripts/seed-support-page-only.js
 *
 * Exit codes:
 *   0 — both locales seeded (or already match)
 *   1 — bad config (missing env vars)
 *   2 — HTTP error from Strapi
 */

const STRAPI_URL = process.env.STRAPI_URL;
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

if (!STRAPI_URL || !STRAPI_API_TOKEN) {
  console.error('STRAPI_URL and STRAPI_API_TOKEN env vars are required');
  process.exit(1);
}

// English copy mirrors the i18n fallbacks in
// frontend/src/components/support/SupportPageContent.tsx so the public
// support page renders identically whether it falls back to next-intl
// or pulls live from Strapi.
const enSupportPage = {
  title: 'How can we help?',
  subtitle:
    "Search our knowledge base or submit a ticket — we typically respond within minutes during business hours.",
  categoriesTitle: 'Browse by Category',
  categoriesSubtitle: 'Pick the area you need help with.',
  faqTitle: 'Frequently Asked Questions',
  faqViewAllLabel: 'View all FAQs',
  submitTicketTitle: 'Submit a Ticket',
  submitTicketSubtitle:
    "Tell us what's going on and we'll get back to you.",
  signInRequiredLabel: 'Sign in required',
  signInRequiredDescription:
    'Sign in to submit a ticket about your account, courses, certificates, or billing.',
  signInLabel: 'Sign In',
  categories: [
    {
      backendValue: 'technical',
      label: 'Technical Issue',
      description: 'Video playback, audio glitches, or session join problems.',
      iconName: 'Video',
      colorClass: 'bg-red-50 text-red-600',
    },
    {
      backendValue: 'login',
      label: 'Login or Access',
      description: 'Forgot password, locked account, or two-factor reset.',
      iconName: 'KeyRound',
      colorClass: 'bg-amber-50 text-amber-600',
    },
    {
      backendValue: 'billing',
      label: 'Billing or Payment',
      description: 'Receipts, refunds, failed payments, or VAT questions.',
      iconName: 'CreditCard',
      colorClass: 'bg-emerald-50 text-emerald-600',
    },
    {
      backendValue: 'certificate',
      label: 'Certificates',
      description:
        'Download, name corrections, or Mumaris Plus reporting.',
      iconName: 'Award',
      colorClass: 'bg-purple-50 text-purple-600',
    },
    {
      backendValue: 'content',
      label: 'Course Content',
      description:
        'Quiz issues, missing materials, or learning-content questions.',
      iconName: 'BookOpen',
      colorClass: 'bg-blue-50 text-blue-600',
    },
    {
      backendValue: 'other',
      label: 'Other Technical',
      description: "Anything else that doesn't fit the categories above.",
      iconName: 'Wrench',
      colorClass: 'bg-orange-50 text-orange-600',
    },
    {
      backendValue: 'other',
      label: 'General Inquiry',
      description: 'Partnerships, careers, or anything else.',
      iconName: 'HelpCircle',
      colorClass: 'bg-gray-100 text-gray-600',
    },
  ],
  items: [
    {
      question: 'How quickly will I get a response?',
      answer:
        'During business hours (Sun-Thu, 9 AM - 6 PM Saudi time) most tickets get a first reply within 30 minutes. Outside business hours we respond first thing the next business day.',
    },
    {
      question: 'Can I submit a ticket without signing in?',
      answer:
        "Yes — for login or access issues only, you can submit a guest ticket. For everything else you'll need to sign in so we can look up your account.",
    },
    {
      question: 'How do I track an open ticket?',
      answer:
        "If you're signed in, head to Dashboard → Support to see all your tickets. Guest tickets come with a tracking link in your confirmation email.",
    },
    {
      question: 'What if I need to add information after I submit?',
      answer:
        'You can reply to your ticket from the support dashboard at any time. Each new reply pings the assigned agent.',
    },
    {
      question: 'Are my conversations private?',
      answer:
        'Yes. Only you, the assigned agent, and senior support staff can see your ticket. Internal notes between agents are never shared with you.',
    },
  ],
};

const arSupportPage = {
  title: 'كيف يمكننا مساعدتك؟',
  subtitle:
    'ابحث في قاعدة المعرفة أو أرسل تذكرة دعم — عادةً ما نرد خلال دقائق خلال ساعات العمل.',
  categoriesTitle: 'تصفّح حسب الفئة',
  categoriesSubtitle: 'اختر المجال الذي تحتاج المساعدة فيه.',
  faqTitle: 'الأسئلة الشائعة',
  faqViewAllLabel: 'عرض كل الأسئلة',
  submitTicketTitle: 'إرسال تذكرة',
  submitTicketSubtitle: 'أخبرنا بما يحدث وسنعاود إليك.',
  signInRequiredLabel: 'تسجيل الدخول مطلوب',
  signInRequiredDescription:
    'سجّل الدخول لإرسال تذكرة تخص حسابك أو دوراتك أو شهاداتك أو فوترتك.',
  signInLabel: 'تسجيل الدخول',
  categories: [
    {
      backendValue: 'technical',
      label: 'مشكلة تقنية',
      description: 'مشاكل الفيديو أو الصوت أو الانضمام للجلسات.',
      iconName: 'Video',
      colorClass: 'bg-red-50 text-red-600',
    },
    {
      backendValue: 'login',
      label: 'تسجيل الدخول أو الوصول',
      description:
        'نسيت كلمة المرور أو حساب مقفل أو إعادة التحقق الثنائي.',
      iconName: 'KeyRound',
      colorClass: 'bg-amber-50 text-amber-600',
    },
    {
      backendValue: 'billing',
      label: 'الفوترة أو الدفع',
      description:
        'الفواتير أو الاسترداد أو الدفعات الفاشلة أو أسئلة ضريبة القيمة المضافة.',
      iconName: 'CreditCard',
      colorClass: 'bg-emerald-50 text-emerald-600',
    },
    {
      backendValue: 'certificate',
      label: 'الشهادات',
      description:
        'تنزيل أو تصحيح الاسم أو الإبلاغ إلى Mumaris Plus.',
      iconName: 'Award',
      colorClass: 'bg-purple-50 text-purple-600',
    },
    {
      backendValue: 'content',
      label: 'محتوى الدورة',
      description:
        'مشاكل الاختبارات أو غياب المواد أو أسئلة حول المحتوى التعليمي.',
      iconName: 'BookOpen',
      colorClass: 'bg-blue-50 text-blue-600',
    },
    {
      backendValue: 'other',
      label: 'مشكلة تقنية أخرى',
      description: 'أي شيء آخر لا يندرج في الفئات أعلاه.',
      iconName: 'Wrench',
      colorClass: 'bg-orange-50 text-orange-600',
    },
    {
      backendValue: 'other',
      label: 'استفسار عام',
      description: 'الشراكات أو الوظائف أو أي شيء آخر.',
      iconName: 'HelpCircle',
      colorClass: 'bg-gray-100 text-gray-600',
    },
  ],
  items: [
    {
      question: 'كم سيستغرق الرد؟',
      answer:
        'خلال ساعات العمل (الأحد-الخميس، 9 صباحًا - 6 مساءً بتوقيت المملكة)، تحصل معظم التذاكر على أول رد خلال 30 دقيقة. خارج ساعات العمل، نرد في بداية يوم العمل التالي.',
    },
    {
      question: 'هل يمكنني إرسال تذكرة دون تسجيل الدخول؟',
      answer:
        'نعم — فقط لمشاكل تسجيل الدخول أو الوصول، يمكنك إرسال تذكرة كضيف. لغير ذلك ستحتاج إلى تسجيل الدخول حتى نتمكن من الوصول إلى حسابك.',
    },
    {
      question: 'كيف يمكنني تتبع تذكرة مفتوحة؟',
      answer:
        'إذا كنت مسجل الدخول، انتقل إلى لوحة التحكم → الدعم لعرض كل تذاكرك. تذاكر الضيف تأتي مع رابط تتبع في بريد التأكيد.',
    },
    {
      question: 'ماذا لو احتجت إضافة معلومات بعد الإرسال؟',
      answer:
        'يمكنك الرد على تذكرتك من لوحة الدعم في أي وقت. كل رد جديد يصل إلى الموظف المسؤول.',
    },
    {
      question: 'هل محادثاتي خاصة؟',
      answer:
        'نعم. فقط أنت والموظف المسؤول وفريق الدعم الأعلى رتبة يمكنهم رؤية تذكرتك. الملاحظات الداخلية بين الموظفين لا تظهر لك أبدًا.',
    },
  ],
};

async function seed(locale, data) {
  // Strapi single-types accept PUT with status=published in one call;
  // 200 = updated, 201 = created. Either is success.
  const url = `${STRAPI_URL}/api/support-page?locale=${locale}&status=published`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data }),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`[${locale}] HTTP ${res.status}: ${body.slice(0, 500)}`);
    process.exit(2);
  }
  console.log(`[${locale}] HTTP ${res.status} — support-page seeded`);
}

(async () => {
  console.log(`Seeding support page → ${STRAPI_URL}`);
  await seed('en', enSupportPage);
  await seed('ar', arSupportPage);
  console.log('Done.');
})().catch((err) => {
  console.error('Unhandled error:', err.message);
  process.exit(2);
});
