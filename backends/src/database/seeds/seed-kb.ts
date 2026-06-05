// ===========================================
// Help Center Seed — categories + starter articles
// ===========================================
// Run with: npm run db:seed:kb
//
// Idempotent:
//   - categories: skip if slug exists
//   - articles:   UPSERT by titleEn — body fields are overwritten so we
//                 can refine seed content over time and re-run.
//
// Bodies are authored in lightweight Markdown for readability in source,
// then converted to HTML at seed time because the frontend renderer uses
// `dangerouslySetInnerHTML` (it expects HTML, not Markdown).
// ===========================================

import { db, pool } from '../index';
import { kbCategories, kbArticles } from '../schema';
import { eq } from 'drizzle-orm';

/**
 * Tiny Markdown → HTML converter covering only the subset we use in the
 * seed bodies: paragraphs, **bold**, ordered (`1. `) and unordered (`- `)
 * lists. Anything fancier would need a real library; we deliberately
 * avoid adding a dep just for a one-shot seed.
 */
function mdToHtml(md: string): string {
  const blocks = md.replace(/\r\n/g, '\n').split(/\n{2,}/);
  const html: string[] = [];

  for (const raw of blocks) {
    const block = raw.trim();
    if (!block) continue;

    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const isOl = lines.every((l) => /^\d+\.\s+/.test(l));
    const isUl = lines.every((l) => /^[-*]\s+/.test(l));

    if (isOl && lines.length > 0) {
      html.push(
        '<ol>' +
          lines
            .map((l) => `<li>${inline(l.replace(/^\d+\.\s+/, ''))}</li>`)
            .join('') +
          '</ol>',
      );
    } else if (isUl && lines.length > 0) {
      html.push(
        '<ul>' +
          lines
            .map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ''))}</li>`)
            .join('') +
          '</ul>',
      );
    } else {
      html.push(`<p>${inline(block.replace(/\n/g, ' '))}</p>`);
    }
  }
  return html.join('\n');
}

// Convert **bold**. Other inline syntax intentionally omitted.
function inline(s: string): string {
  return s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

interface CategorySeed {
  slug: string;
  nameEn: string;
  nameAr: string;
  icon: string;
  sortOrder: number;
}

interface ArticleSeed {
  category: string;
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
}

const CATEGORIES: CategorySeed[] = [
  // FAQ is the catch-all for general "how does this work" questions
  // that don't belong in a specific feature category. Treated as a
  // first-class category (vs a separate entity) per Amna's review:
  // simpler editing surface, same publish/draft state machine.
  { slug: 'faq', nameEn: 'FAQs', nameAr: 'الأسئلة الشائعة', icon: 'HelpCircle', sortOrder: 5 },
  { slug: 'login', nameEn: 'Account & Login', nameAr: 'الحساب وتسجيل الدخول', icon: 'KeyRound', sortOrder: 10 },
  { slug: 'content', nameEn: 'Courses & Content', nameAr: 'الدورات والمحتوى', icon: 'BookOpen', sortOrder: 20 },
  { slug: 'certificate', nameEn: 'Certificates', nameAr: 'الشهادات', icon: 'Award', sortOrder: 30 },
  { slug: 'billing', nameEn: 'Billing & Payments', nameAr: 'الفوترة والمدفوعات', icon: 'CreditCard', sortOrder: 40 },
  { slug: 'technical', nameEn: 'Technical Issues', nameAr: 'مشاكل تقنية', icon: 'Wrench', sortOrder: 50 },
  { slug: 'other', nameEn: 'Other', nameAr: 'أخرى', icon: 'HelpCircle', sortOrder: 60 },
];

const ARTICLES: ArticleSeed[] = [
  // ─── Login / Account ───────────────────────────────────────────────
  {
    category: 'login',
    titleEn: 'How to reset your password',
    titleAr: 'كيفية إعادة تعيين كلمة المرور',
    bodyEn:
      `If you can't remember your password, you can reset it in under a minute:

1. Go to the sign-in page and click **Forgot password**.
2. Enter the email address you registered with.
3. Open the reset link we email you (check your spam folder if you don't see it within 2 minutes).
4. Choose a new password — at least 12 characters, with a mix of letters, numbers, and a symbol.

The reset link expires after 30 minutes for security. If it has expired, just request a new one. If the email never arrives, make sure the address you entered matches your account exactly; emails are case-insensitive but typos are common.`,
    bodyAr:
      `إذا لم تتذكر كلمة المرور، يمكنك إعادة تعيينها خلال دقيقة:

1. اذهب إلى صفحة تسجيل الدخول واضغط **نسيت كلمة المرور**.
2. أدخل البريد الإلكتروني المسجَّل به حسابك.
3. افتح رابط إعادة التعيين المُرسل إليك (تحقق من مجلد الرسائل غير المرغوب فيها إذا لم يصلك خلال دقيقتين).
4. اختر كلمة مرور جديدة — لا تقل عن 12 حرفًا، وتجمع بين الحروف والأرقام ورمز خاص.

تنتهي صلاحية رابط إعادة التعيين بعد 30 دقيقة لأسباب أمنية. إذا انتهت الصلاحية، فقط اطلب رابطًا جديدًا.`,
  },
  {
    category: 'login',
    titleEn: 'Enabling two-factor authentication (2FA)',
    titleAr: 'تفعيل المصادقة الثنائية',
    bodyEn:
      `Two-factor authentication adds a second check whenever you sign in from a new device, so a stolen password isn't enough to access your account.

**To enable 2FA**:

1. Open **Settings → Security**.
2. Click **Enable two-factor authentication**.
3. Scan the QR code with an authenticator app — Google Authenticator, Microsoft Authenticator, or 1Password all work.
4. Enter the 6-digit code your app shows to confirm.
5. Save the recovery codes somewhere safe (e.g. a password manager). They're your only way back in if you lose your phone.

After 2FA is on, you'll be asked for a code in addition to your password the next time you log in from a new browser or device.`,
    bodyAr:
      `تضيف المصادقة الثنائية فحصًا إضافيًا عند تسجيل الدخول من جهاز جديد، حتى لا يكفي تسريب كلمة المرور للوصول إلى حسابك.

**لتفعيل المصادقة الثنائية**:

1. افتح **الإعدادات ← الأمان**.
2. اضغط **تفعيل المصادقة الثنائية**.
3. امسح رمز QR بتطبيق مصادقة — Google Authenticator أو Microsoft Authenticator أو 1Password.
4. أدخل الرمز المكوّن من 6 أرقام للتأكيد.
5. احفظ رموز الاسترداد في مكان آمن (مثل مدير كلمات المرور). هذه طريقتك الوحيدة للدخول إذا فقدت هاتفك.

بعد التفعيل، ستُطلَب رمزًا إضافيًا مع كلمة المرور عند تسجيل الدخول من متصفح أو جهاز جديد.`,
  },

  // ─── Content / Courses ─────────────────────────────────────────────
  {
    category: 'content',
    titleEn: 'How to enroll in a course',
    titleAr: 'كيفية التسجيل في دورة',
    bodyEn:
      `Browse the catalogue from your dashboard and pick any course that matches your CPD goals:

1. Open **Courses** from the sidebar.
2. Use the search bar or filter by topic, hours, or level.
3. Click any course tile to see the full outline, instructor, and CPD credit value.
4. Click **Enroll** — paid courses go through checkout first; free courses enroll instantly.

Once you're enrolled the course appears in your **My Courses** list and you can start the first module right away. Your progress is saved automatically as you watch videos or finish modules.`,
    bodyAr:
      `تصفّح الكتالوج من لوحة التحكم واختر أي دورة تتوافق مع أهداف التطوير المهني المستمر:

1. افتح **الدورات** من الشريط الجانبي.
2. استخدم شريط البحث أو فلتر حسب الموضوع أو الساعات أو المستوى.
3. اضغط أي بطاقة دورة لرؤية الخطة الكاملة والمحاضر وقيمة ساعات CPD.
4. اضغط **سجّل الآن** — الدورات المدفوعة تمرّ بالدفع أولًا، والمجانية يتم التسجيل بها فورًا.

بعد التسجيل تظهر الدورة في قائمة **دوراتي** ويمكنك بدء الوحدة الأولى فورًا. يُحفظ تقدّمك تلقائيًا أثناء مشاهدة الفيديو أو إنهاء الوحدات.`,
  },
  {
    category: 'content',
    titleEn: 'Downloading course materials for offline use',
    titleAr: 'تنزيل مواد الدورة للاستخدام دون اتصال',
    bodyEn:
      `Most courses include PDFs, slide decks, and reference sheets you can keep for later. To download them:

1. Open the course detail page.
2. Scroll to **Course Materials**.
3. Each downloadable file has a 📥 download icon — click it.

Videos are streaming-only to protect the rights of our instructors and to keep CPD attendance auditable. If you need to study a video without internet, you can read the auto-generated transcript inside the player instead. Materials are linked to your enrollment, so removing your enrollment also revokes access to the downloads.`,
    bodyAr:
      `تحتوي معظم الدورات على ملفات PDF وعروض تقديمية وأوراق مرجعية يمكنك الاحتفاظ بها للاستخدام لاحقًا. لتنزيلها:

1. افتح صفحة تفاصيل الدورة.
2. انتقل إلى **مواد الدورة**.
3. كل ملف قابل للتنزيل بجانبه أيقونة 📥 — اضغط عليها.

الفيديوهات بنظام البث المباشر فقط لحماية حقوق المحاضرين وضمان قابلية تدقيق حضور CPD. إذا احتجت لمراجعة فيديو دون إنترنت، يمكنك قراءة النص التلقائي داخل المشغّل بدلًا من ذلك. ترتبط المواد بتسجيلك في الدورة، فإلغاء التسجيل يلغي صلاحية التنزيلات.`,
  },

  // ─── Certificate ──────────────────────────────────────────────────
  {
    category: 'certificate',
    titleEn: 'Downloading your CPD certificate',
    titleAr: 'تنزيل شهادة التطوير المهني المستمر',
    bodyEn:
      `Your certificate is issued the moment you meet the course requirements — usually that means watching all modules, passing the final assessment, and meeting the attendance threshold for live sessions.

**To download your certificate**:

1. Go to **My Certificates** from the sidebar.
2. Find the course in the list.
3. Click **Download PDF**.

Each certificate has a unique verification code printed on it. Anyone can verify it on our public verification page using that code — no account needed. Certificates are issued in both English and Arabic in the same PDF.`,
    bodyAr:
      `تُصدر شهادتك فور استيفائك متطلبات الدورة — عادةً مشاهدة جميع الوحدات واجتياز الاختبار النهائي واستيفاء حدّ الحضور للجلسات المباشرة.

**لتنزيل الشهادة**:

1. اذهب إلى **شهاداتي** من الشريط الجانبي.
2. ابحث عن الدورة في القائمة.
3. اضغط **تنزيل PDF**.

تحتوي كل شهادة على رمز تحقق فريد. يمكن لأي شخص التحقق منها على صفحة التحقق العامة باستخدام الرمز — دون الحاجة لحساب. تُصدَر الشهادات باللغتين الإنجليزية والعربية في نفس ملف PDF.`,
  },
  {
    category: 'certificate',
    titleEn: 'Sharing certificates with SCFHS',
    titleAr: 'مشاركة الشهادات مع الهيئة السعودية للتخصصات الصحية',
    bodyEn:
      `Your CPD hours are reported to the Saudi Commission for Health Specialties (SCFHS) automatically through our integration. There's nothing you need to upload manually.

**How it works**:

- When a certificate is issued, the CPD hours are added to your SCFHS record using the SCFHS number on your profile.
- The transfer typically completes within 24 hours.
- You can check your SCFHS record on the official Mumaris+ portal.

**If your SCFHS number is missing**: open **Settings → Profile** and add it. Hours earned before you added the number can be back-filled by contacting support — we'll need your SCFHS number and the certificate's verification code.`,
    bodyAr:
      `يتم تقديم ساعات التطوير المهني المستمر إلى الهيئة السعودية للتخصصات الصحية تلقائيًا عبر التكامل لدينا. لا تحتاج لرفع أي شيء يدويًا.

**كيف يعمل ذلك**:

- عند إصدار شهادة، تُضاف ساعات CPD إلى سجلك لدى الهيئة باستخدام رقم SCFHS الموجود في ملفك الشخصي.
- يكتمل النقل عادةً خلال 24 ساعة.
- يمكنك التحقق من سجلك عبر بوابة ممارس+ الرسمية.

**إذا كان رقم SCFHS مفقودًا**: افتح **الإعدادات ← الملف الشخصي** وأضفه. الساعات المكتسبة قبل إضافة الرقم يمكن استدراكها بالتواصل مع الدعم — سنحتاج رقمك ورمز التحقق الموجود على الشهادة.`,
  },

  // ─── Billing ──────────────────────────────────────────────────────
  {
    category: 'billing',
    titleEn: 'Viewing and downloading invoices',
    titleAr: 'عرض وتنزيل الفواتير',
    bodyEn:
      `Every paid enrollment generates a VAT-compliant tax invoice you can download for your records or your employer's reimbursement:

1. Open **Settings → Billing**.
2. Under **Invoices**, you'll see every transaction with date, course, and amount.
3. Click the download icon next to any invoice to get the PDF.

The invoice includes your VAT number if you've added it to your billing profile — otherwise it's issued without one. If you need to update an invoice that was already issued (for example to add a VAT number), contact support; we can re-issue it within 7 days of the original transaction.`,
    bodyAr:
      `يولّد كل تسجيل مدفوع فاتورة ضريبية متوافقة مع نظام ضريبة القيمة المضافة يمكنك تنزيلها لسجلاتك أو لاسترداد المبلغ من جهة عملك:

1. افتح **الإعدادات ← الفوترة**.
2. تحت **الفواتير** ستجد كل عملية مع التاريخ والدورة والمبلغ.
3. اضغط أيقونة التنزيل بجانب أي فاتورة للحصول على ملف PDF.

تتضمن الفاتورة رقم الضريبة الخاص بك إذا كنت قد أضفته في ملف الفوترة — وإلا فستُصدَر بدونه. إذا احتجت لتعديل فاتورة صدرت بالفعل (مثلًا لإضافة الرقم الضريبي)، تواصل مع الدعم؛ يمكننا إعادة إصدارها خلال 7 أيام من المعاملة الأصلية.`,
  },
  {
    category: 'billing',
    titleEn: 'Refund policy',
    titleAr: 'سياسة الاسترداد',
    bodyEn:
      `You can request a full refund within **7 days of purchase** as long as you haven't accessed more than 20% of the course content. After either of those limits, refunds are evaluated case-by-case.

**To request a refund**:

1. Open the course in **My Courses**.
2. Click **Get help with this course → Request a refund**.
3. Tell us briefly why you're requesting one. (This isn't required, but it helps us improve.)

Approved refunds are returned to the original payment method within 5–10 business days. Once the refund is processed, your enrollment is removed and any certificate or CPD hours associated with the course are revoked.`,
    bodyAr:
      `يمكنك طلب استرداد كامل خلال **7 أيام من الشراء** طالما لم تتجاوز 20% من محتوى الدورة. بعد أيٍّ من هذين الحدّين، يُقيَّم الاسترداد حسب كل حالة.

**لطلب الاسترداد**:

1. افتح الدورة من **دوراتي**.
2. اضغط **احصل على مساعدة بشأن هذه الدورة ← طلب استرداد**.
3. أخبرنا بإيجاز سبب طلبك. (غير إلزامي، لكن يساعدنا على التحسين.)

تُعاد الأموال إلى وسيلة الدفع الأصلية خلال 5–10 أيام عمل بعد الموافقة. بمجرد إتمام الاسترداد، يُلغى تسجيلك وتُسحَب أي شهادة أو ساعات CPD مرتبطة بالدورة.`,
  },

  // ─── Technical ────────────────────────────────────────────────────
  {
    category: 'technical',
    titleEn: 'Supported browsers and devices',
    titleAr: 'المتصفحات والأجهزة المدعومة',
    bodyEn:
      `The platform works on any modern browser. For the best experience we recommend:

- **Chrome / Edge** (last 2 major versions)
- **Safari** 16 and later (macOS + iOS)
- **Firefox** 110 and later

**Mobile**: iOS 16+ and Android 10+ are fully supported via the browser. We recommend Safari on iOS and Chrome on Android.

**Internet Explorer is not supported** — it has been end-of-life since 2022.

**Hardware**: any device made in the last 5 years that can play HD video should handle the platform smoothly. For the best video quality you'll want at least a 4 Mbps internet connection.`,
    bodyAr:
      `يعمل النظام على أي متصفح حديث. للحصول على أفضل تجربة نوصي بـ:

- **Chrome / Edge** (آخر إصدارين رئيسيين)
- **Safari** 16 وما فوق (macOS + iOS)
- **Firefox** 110 وما فوق

**الجوال**: iOS 16+ و Android 10+ مدعومان بالكامل عبر المتصفح. نوصي بـ Safari على iOS و Chrome على Android.

**Internet Explorer غير مدعوم** — انتهى عمره الافتراضي منذ 2022.

**العتاد**: أي جهاز صُنع في آخر 5 سنوات ويمكنه تشغيل فيديو عالي الدقة سيعمل بسلاسة. للحصول على أفضل جودة فيديو يُفضَّل اتصال 4 ميغابت/ثانية على الأقل.`,
  },
  {
    category: 'technical',
    titleEn: 'Fixing video playback issues',
    titleAr: 'حل مشاكل تشغيل الفيديو',
    bodyEn:
      `If a video keeps buffering, freezes, or refuses to play, try these in order — most issues are fixed by one of the first two:

1. **Lower the quality**: open the gear icon in the player and pick 720p or 480p. Auto quality can over-estimate your bandwidth.
2. **Refresh the page** after waiting 10–15 seconds.
3. **Check your internet**: anything under 2 Mbps will struggle with HD video. Try a speed test at fast.com.
4. **Try a different browser**: switching from Chrome to Safari (or vice versa) often clears stuck sessions.
5. **Disable browser extensions** — ad blockers and privacy extensions sometimes block the video CDN.

If none of these work, contact support with the course name, the timestamp where the issue happens, and what device + browser you're on.`,
    bodyAr:
      `إذا استمر الفيديو في التحميل أو تجمّد أو رفض التشغيل، جرّب الخطوات التالية بالترتيب — معظم المشاكل تُحلّ بإحدى أول خطوتين:

1. **خفّض الجودة**: افتح أيقونة الترس في المشغّل واختر 720p أو 480p. الجودة التلقائية قد تبالغ في تقدير سرعة اتصالك.
2. **حدّث الصفحة** بعد الانتظار 10–15 ثانية.
3. **تحقق من الإنترنت**: أي سرعة أقل من 2 ميغابت/ثانية ستعاني مع الفيديو عالي الدقة. جرّب اختبار السرعة على fast.com.
4. **جرّب متصفحًا آخر**: التبديل من Chrome إلى Safari (أو العكس) كثيرًا ما يزيل الجلسات العالقة.
5. **عطّل إضافات المتصفح** — تمنع إضافات حجب الإعلانات والخصوصية أحيانًا شبكة توصيل المحتوى للفيديو.

إذا لم تنجح أيّ من هذه الخطوات، تواصل مع الدعم مع ذكر اسم الدورة والوقت الذي تحدث فيه المشكلة ونوع جهازك ومتصفحك.`,
  },

  // ─── Other ────────────────────────────────────────────────────────
  {
    category: 'other',
    titleEn: 'How to contact support',
    titleAr: 'كيفية التواصل مع الدعم',
    bodyEn:
      `We're here to help. The fastest way to reach us depends on what you need:

- **Quick question or how-to**: try the Help Center first — most answers are here, and the search bar at the top is good.
- **Stuck on a specific course or session**: open the course and click **Get help with this course**. That ticket goes straight to the team familiar with your enrollment.
- **Billing, refunds, certificates**: go to **Support → New Ticket** and pick the right category. Including order or certificate IDs helps us respond faster.
- **Account locked, can't log in**: use the contact form on the sign-in page — that one doesn't need you to be logged in.

Our support team works **Sunday–Thursday, 9:00 AM – 6:00 PM (Riyadh time)**. We aim to respond to every ticket within 4 working hours.`,
    bodyAr:
      `نحن هنا للمساعدة. أسرع طريقة للوصول إلينا تعتمد على ما تحتاجه:

- **سؤال سريع أو طريقة الاستخدام**: جرّب مركز المساعدة أولًا — معظم الإجابات هنا، وشريط البحث في الأعلى مفيد.
- **عالق في دورة أو جلسة محددة**: افتح الدورة واضغط **احصل على مساعدة بشأن هذه الدورة**. تذهب التذكرة مباشرة إلى الفريق المطلع على تسجيلك.
- **الفوترة والاسترداد والشهادات**: اذهب إلى **الدعم ← تذكرة جديدة** واختر الفئة المناسبة. تضمين أرقام الطلب أو الشهادة يساعدنا على الرد بسرعة أكبر.
- **الحساب مقفل، تعذّر تسجيل الدخول**: استخدم نموذج التواصل على صفحة تسجيل الدخول — لا يتطلب أن تكون مسجَّلًا.

يعمل فريق الدعم **الأحد–الخميس، 9:00 صباحًا – 6:00 مساءً (بتوقيت الرياض)**. نسعى للرد على كل تذكرة خلال 4 ساعات عمل.`,
  },
  {
    category: 'other',
    titleEn: 'Accessibility features',
    titleAr: 'ميزات إمكانية الوصول',
    bodyEn:
      `The platform is built to be usable by everyone. Built-in features include:

- **Full keyboard navigation** — every action that you can do with a mouse can be done with Tab and Enter.
- **Screen reader support** — pages use semantic HTML and ARIA labels so VoiceOver, NVDA, and JAWS read them correctly.
- **High-contrast mode** — turn it on under **Settings → Accessibility** if you need stronger contrast.
- **Video captions** — captions are available on every video; toggle them with the CC button. Auto-generated transcripts let you skim a video's content quickly.
- **Adjustable playback speed** — slow videos down or speed them up to match your pace.
- **Right-to-left support** — Arabic content is fully RTL-aware throughout the platform.

If you hit an accessibility issue, please report it via support — we treat these as high-priority bugs.`,
    bodyAr:
      `صُمِّمت المنصة لتكون قابلة للاستخدام من قِبَل الجميع. تشمل الميزات المضمَّنة:

- **تنقّل كامل بلوحة المفاتيح** — يمكن تنفيذ كل إجراء يمكن فعله بالفأرة باستخدام Tab و Enter.
- **دعم قارئ الشاشة** — تستخدم الصفحات HTML دلاليًا وعلامات ARIA لتُقرأ بشكل صحيح في VoiceOver و NVDA و JAWS.
- **وضع التباين العالي** — يمكن تشغيله من **الإعدادات ← إمكانية الوصول** إذا احتجت تباينًا أقوى.
- **ترجمات الفيديو** — متوفرة على كل فيديو؛ يمكن تفعيلها بزر CC. النصوص المُولّدة تلقائيًا تتيح لك تصفّح محتوى الفيديو بسرعة.
- **سرعة تشغيل قابلة للضبط** — أبطئ الفيديوهات أو سرّعها بما يناسب وتيرتك.
- **دعم الكتابة من اليمين لليسار** — المحتوى العربي يدعم RTL بالكامل في جميع أنحاء المنصة.

إذا واجهت مشكلة في إمكانية الوصول، أبلِغ عنها عبر الدعم — نتعامل معها كأخطاء عالية الأولوية.`,
  },
];

async function seed() {
  console.log('Seeding Help Center categories + articles...');
  try {
    // ─── Categories — upsert by slug ────────────────────────────────
    let catInserted = 0;
    for (const cat of CATEGORIES) {
      const [existing] = await db
        .select({ id: kbCategories.id })
        .from(kbCategories)
        .where(eq(kbCategories.slug, cat.slug))
        .limit(1);
      if (existing) {
        console.log(`  category '${cat.slug}' exists — skipping`);
        continue;
      }
      await db.insert(kbCategories).values(cat);
      catInserted++;
      console.log(`  seeded category: ${cat.slug}`);
    }
    console.log(`Categories: ${catInserted} new, ${CATEGORIES.length - catInserted} existing`);

    // ─── Articles — UPSERT by titleEn so body refinements re-apply ──
    let articleInserted = 0;
    let articleUpdated = 0;
    for (const article of ARTICLES) {
      const bodyEnHtml = mdToHtml(article.bodyEn);
      const bodyArHtml = mdToHtml(article.bodyAr);

      const [existing] = await db
        .select({ id: kbArticles.id })
        .from(kbArticles)
        .where(eq(kbArticles.titleEn, article.titleEn))
        .limit(1);

      if (existing) {
        await db
          .update(kbArticles)
          .set({
            titleAr: article.titleAr,
            bodyEn: bodyEnHtml,
            bodyAr: bodyArHtml,
            category: article.category,
            updatedAt: new Date(),
          })
          .where(eq(kbArticles.id, existing.id));
        articleUpdated++;
        console.log(`  updated article: ${article.titleEn.substring(0, 60)}`);
        continue;
      }

      await db.insert(kbArticles).values({
        titleEn: article.titleEn,
        titleAr: article.titleAr,
        bodyEn: bodyEnHtml,
        bodyAr: bodyArHtml,
        category: article.category,
        published: true,
      });
      articleInserted++;
      console.log(`  seeded article: ${article.titleEn.substring(0, 60)}`);
    }
    console.log(
      `Articles: ${articleInserted} new, ${articleUpdated} updated, ${ARTICLES.length - articleInserted - articleUpdated} unchanged`,
    );

    console.log('Help Center seed complete!');
  } catch (error) {
    console.error('Help Center seed failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
