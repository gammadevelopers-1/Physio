-- Migration 0060: Seed 10 starter macros for the 5 common ticket
-- categories Amna listed (login, billing, certificate, webinar, cme),
-- two per category, in English + Arabic.
--
-- created_by = NULL marks these as system-seeded. Admins can edit or
-- soft-delete them after install. INSERT ... WHERE NOT EXISTS keeps
-- the migration idempotent — re-running on a populated DB is a no-op,
-- and the same titles won't double up if an admin clones the seed.

INSERT INTO "support_macros" ("id", "title", "body_template", "body_ar", "category_key", "created_by", "is_active")
SELECT gen_random_uuid(), 'Login — Password reset instructions',
$$Hi {{learner_first_name}},

Thanks for reaching out about your login issue. To reset your password:

1. Open the sign-in page.
2. Click "Forgot password?" under the password field.
3. Enter the email you registered with — {{learner_name}} — and submit.
4. Check your inbox for the reset link (it expires in 30 minutes).

If you don't see the email after 5 minutes, check Spam / Promotions. Reply here if it still doesn't arrive and we'll send a manual reset.

Best,
{{agent_name}}$$,
$$مرحبًا {{learner_first_name}}،

شكرًا لتواصلك معنا بشأن مشكلة تسجيل الدخول. لإعادة تعيين كلمة المرور:

١. افتح صفحة تسجيل الدخول.
٢. اضغط على "نسيت كلمة المرور؟" أسفل حقل كلمة المرور.
٣. أدخل البريد الإلكتروني المسجّل — {{learner_name}} — ثم أرسل.
٤. تحقّق من بريدك الوارد للحصول على رابط إعادة التعيين (ينتهي بعد ٣٠ دقيقة).

إذا لم يصلك البريد خلال ٥ دقائق، تفقّد مجلد الرسائل غير المرغوب فيها (Spam / Promotions). ردّ علينا هنا إذا لم يصل وسنرسل إعادة تعيين يدويًا.

مع التحيات،
{{agent_name}}$$,
'login', NULL, TRUE
WHERE NOT EXISTS (SELECT 1 FROM "support_macros" WHERE "title" = 'Login — Password reset instructions');

INSERT INTO "support_macros" ("id", "title", "body_template", "body_ar", "category_key", "created_by", "is_active")
SELECT gen_random_uuid(), 'Login — Account locked after failed attempts',
$$Hi {{learner_first_name}},

Your account was locked after too many failed login attempts — this is an automatic security measure.

I've unlocked it from our side. Please try signing in again in the next 5 minutes. If you've forgotten the password, use "Forgot password?" on the sign-in page first.

If you weren't the one trying to log in, reply here and we'll review the access log together.

Reference: {{ticket_id}}

{{agent_name}}$$,
$$مرحبًا {{learner_first_name}}،

تم قفل حسابك بعد عدد كبير من محاولات تسجيل الدخول الفاشلة — هذا إجراء أمني تلقائي.

قمنا بفتح القفل من جانبنا. الرجاء محاولة تسجيل الدخول مرّة أخرى خلال الـ ٥ دقائق القادمة. إذا نسيت كلمة المرور، استخدم "نسيت كلمة المرور؟" أوّلًا.

إذا لم تكن أنت من حاول تسجيل الدخول، ردّ علينا هنا وسنراجع سجلّ الوصول معًا.

المرجع: {{ticket_id}}

{{agent_name}}$$,
'login', NULL, TRUE
WHERE NOT EXISTS (SELECT 1 FROM "support_macros" WHERE "title" = 'Login — Account locked after failed attempts');

INSERT INTO "support_macros" ("id", "title", "body_template", "body_ar", "category_key", "created_by", "is_active")
SELECT gen_random_uuid(), 'Payment — Receipt request',
$$Hi {{learner_first_name}},

Thanks for the request. I've located your most recent payment of {{payment_amount}} for {{course_name}}.

A copy of the receipt is now in your inbox at the address on file. If you need it reissued in a different name (for reimbursement, etc.), just send the exact name and we'll regenerate it within one business day.

Reference: {{ticket_id}}

{{agent_name}}$$,
$$مرحبًا {{learner_first_name}}،

شكرًا لطلبك. وجدت دفعتك الأخيرة بقيمة {{payment_amount}} لـ {{course_name}}.

تم إرسال نسخة من الإيصال إلى بريدك الإلكتروني المسجّل لدينا. إذا كنت بحاجة إلى إصداره باسم مختلف (لأغراض السداد مثلًا)، فقط أرسل لنا الاسم المطلوب وسنُصدره خلال يوم عمل واحد.

المرجع: {{ticket_id}}

{{agent_name}}$$,
'billing', NULL, TRUE
WHERE NOT EXISTS (SELECT 1 FROM "support_macros" WHERE "title" = 'Payment — Receipt request');

INSERT INTO "support_macros" ("id", "title", "body_template", "body_ar", "category_key", "created_by", "is_active")
SELECT gen_random_uuid(), 'Payment — Refund process explainer',
$$Hi {{learner_first_name}},

Thanks for raising this. Refund timelines depend on the original payment method:

• Credit/debit card — 5–10 business days back to the same card.
• Bank transfer — 3–5 business days to the originating account.

I've passed your refund request to our finance team. You'll receive a confirmation email once it's processed. Please don't initiate a chargeback in the meantime — it slows the refund down on our side.

Reference: {{ticket_id}}

{{agent_name}}$$,
$$مرحبًا {{learner_first_name}}،

شكرًا لإثارة الموضوع. تختلف مدّة الاسترداد حسب طريقة الدفع الأصلية:

• بطاقة ائتمان/خصم — من ٥ إلى ١٠ أيام عمل إلى نفس البطاقة.
• تحويل بنكي — من ٣ إلى ٥ أيام عمل إلى الحساب المصدر.

أرسلت طلب الاسترداد إلى فريقنا المالي. ستتلقّى بريدًا تأكيديًا حين تتمّ المعالجة. الرجاء عدم البدء في عمليّة مطالبة (chargeback) في هذه الأثناء — فذلك يُبطئ الاسترداد من جانبنا.

المرجع: {{ticket_id}}

{{agent_name}}$$,
'billing', NULL, TRUE
WHERE NOT EXISTS (SELECT 1 FROM "support_macros" WHERE "title" = 'Payment — Refund process explainer');

INSERT INTO "support_macros" ("id", "title", "body_template", "body_ar", "category_key", "created_by", "is_active")
SELECT gen_random_uuid(), 'Certificate — Current status',
$$Hi {{learner_first_name}},

I checked your certificate for {{course_name}} — current status: {{certificate_status}}.

What each status means:
• Pending — under review by our certification team (1–3 business days)
• Approved — ready to download from your dashboard → Certificates
• Held — needs additional documentation (we'll reach out separately)
• Rejected — eligibility criteria not met (we'll explain why)

If anything looks off, reply here and we'll re-check.

{{agent_name}}$$,
$$مرحبًا {{learner_first_name}}،

راجعت شهادتك لـ {{course_name}} — الحالة الحالية: {{certificate_status}}.

ما تعنيه كل حالة:
• Pending — قيد المراجعة من فريق الاعتماد (من ١ إلى ٣ أيام عمل)
• Approved — جاهزة للتحميل من لوحة التحكّم → الشهادات
• Held — تحتاج إلى وثائق إضافية (سنتواصل معك بشكل منفصل)
• Rejected — لم يتم استيفاء شروط الأهلية (سنوضّح السبب)

إذا بدا أيّ شيء غير صحيح، ردّ علينا هنا وسنراجع الموضوع.

{{agent_name}}$$,
'certificate', NULL, TRUE
WHERE NOT EXISTS (SELECT 1 FROM "support_macros" WHERE "title" = 'Certificate — Current status');

INSERT INTO "support_macros" ("id", "title", "body_template", "body_ar", "category_key", "created_by", "is_active")
SELECT gen_random_uuid(), 'Certificate — How to download',
$$Hi {{learner_first_name}},

To download your certificate for {{course_name}}:

1. Sign in to your dashboard.
2. Click "Certificates" in the left sidebar.
3. Find {{course_name}} and click the download icon.
4. The PDF saves to your device — it's verifiable via the QR code on the certificate.

If "Certificates" doesn't show your course, your status is still {{certificate_status}}. Approved certificates appear within 5 minutes of approval.

{{agent_name}}$$,
$$مرحبًا {{learner_first_name}}،

لتحميل شهادتك لـ {{course_name}}:

١. سجّل الدخول إلى لوحة التحكّم.
٢. اضغط على "الشهادات" في الشريط الجانبي.
٣. ابحث عن {{course_name}} واضغط على أيقونة التحميل.
٤. يُحفظ ملف PDF على جهازك — يمكن التحقّق منه عبر رمز QR على الشهادة.

إذا لم تظهر "الشهادات" لدورتك، فالحالة لا تزال {{certificate_status}}. تظهر الشهادات المعتمدة خلال ٥ دقائق من الاعتماد.

{{agent_name}}$$,
'certificate', NULL, TRUE
WHERE NOT EXISTS (SELECT 1 FROM "support_macros" WHERE "title" = 'Certificate — How to download');

INSERT INTO "support_macros" ("id", "title", "body_template", "body_ar", "category_key", "created_by", "is_active")
SELECT gen_random_uuid(), 'Webinar — Join URL not working',
$$Hi {{learner_first_name}},

Sorry the join link isn't working. Here's your personal join URL for the upcoming session:

{{webinar_join_url}}

A few quick checks if it still fails:
• Open the link in Chrome, Edge, or Safari (Internet Explorer isn't supported).
• If you see "registration required", reload — sometimes the Zoom page caches old state.
• On mobile, install the Zoom app first; the browser link will hand off to it.

If none of the above work, reply with a screenshot and we'll regenerate the registration on our side.

{{agent_name}}$$,
$$مرحبًا {{learner_first_name}}،

نأسف أنّ رابط الانضمام لا يعمل. هذا هو رابطك الشخصي للجلسة القادمة:

{{webinar_join_url}}

تحقّقات سريعة إذا استمرّت المشكلة:
• افتح الرابط من Chrome أو Edge أو Safari (متصفّح Internet Explorer غير مدعوم).
• إذا ظهرت رسالة "registration required"، أعد تحميل الصفحة — أحيانًا تحتفظ صفحة Zoom بحالة قديمة.
• على الجوّال، ثبّت تطبيق Zoom أوّلًا؛ سيُحوَّل الرابط من المتصفّح إلى التطبيق.

إذا لم تنجح أيّ من هذه الخطوات، أرسل لنا صورة الشاشة وسنُعيد إنشاء التسجيل من جانبنا.

{{agent_name}}$$,
'webinar', NULL, TRUE
WHERE NOT EXISTS (SELECT 1 FROM "support_macros" WHERE "title" = 'Webinar — Join URL not working');

INSERT INTO "support_macros" ("id", "title", "body_template", "body_ar", "category_key", "created_by", "is_active")
SELECT gen_random_uuid(), 'Webinar — Recording access',
$$Hi {{learner_first_name}},

The recording for {{course_name}} is typically published 5–60 minutes after the session ends — Zoom takes time to process it on their side.

Where to find it: your dashboard → Courses → {{course_name}} → "Recording" tab. You'll see it as soon as the instructor's manager publishes it.

If 24 hours have passed since the session ended and it's still not visible, reply here and we'll check whether the recording was enabled for that session.

{{agent_name}}$$,
$$مرحبًا {{learner_first_name}}،

عادةً ما يُنشر تسجيل {{course_name}} بعد ٥ إلى ٦٠ دقيقة من انتهاء الجلسة — يحتاج Zoom إلى وقت لمعالجة التسجيل من جانبه.

أين تجده: لوحة التحكّم → الدورات → {{course_name}} → علامة التبويب "التسجيل". سيظهر بمجرّد أن يقوم مدير المدرّب بنشره.

إذا مرّت ٢٤ ساعة على انتهاء الجلسة ولم يظهر بعد، ردّ علينا هنا وسنتحقّق من تفعيل التسجيل لتلك الجلسة.

{{agent_name}}$$,
'webinar', NULL, TRUE
WHERE NOT EXISTS (SELECT 1 FROM "support_macros" WHERE "title" = 'Webinar — Recording access');

INSERT INTO "support_macros" ("id", "title", "body_template", "body_ar", "category_key", "created_by", "is_active")
SELECT gen_random_uuid(), 'CME — How credits are awarded',
$$Hi {{learner_first_name}},

CME / CPD credits for {{course_name}} are awarded automatically once all four conditions are met:

1. Course marked completed in your dashboard
2. Attendance ≥ 75% across all live sessions
3. All required assessments passed
4. Certificate approved by our certification team

Once approved, the credit is reflected in your CME ledger within 24 hours. NELC submission is handled on our side — you don't need to upload anything separately.

Your current status for this course is {{certificate_status}}. If you'd like a detailed breakdown of each condition, let me know.

{{agent_name}}$$,
$$مرحبًا {{learner_first_name}}،

تُمنح ساعات CME / CPD لـ {{course_name}} تلقائيًا حالما تتحقّق الشروط الأربعة:

١. وضع الدورة كمكتملة في لوحة التحكّم.
٢. حضور ≥ ٧٥٪ في جميع الجلسات المباشرة.
٣. اجتياز جميع التقييمات المطلوبة.
٤. اعتماد الشهادة من فريق الاعتماد.

بعد الاعتماد، تظهر الساعات في سجلّ CME الخاصّ بك خلال ٢٤ ساعة. إرسال البيانات إلى المركز الوطني للتعلّم الإلكتروني (NELC) يتمّ من جانبنا — لا حاجة لرفع أيّ شيء بشكل منفصل.

حالتك الحالية لهذه الدورة: {{certificate_status}}. إذا أردت تفصيلًا دقيقًا لكلّ شرط، أخبرني.

{{agent_name}}$$,
'cme', NULL, TRUE
WHERE NOT EXISTS (SELECT 1 FROM "support_macros" WHERE "title" = 'CME — How credits are awarded');

INSERT INTO "support_macros" ("id", "title", "body_template", "body_ar", "category_key", "created_by", "is_active")
SELECT gen_random_uuid(), 'CME — Compliance documentation request',
$$Hi {{learner_first_name}},

For compliance documentation, we can provide:

• A NELC-compliant transcript of all CME credits you've earned with us
• An itemised letter listing each course, hours awarded, and approval date
• Individual certificate PDFs (you can also download these yourself from Certificates)

Let me know which you need and the format (PDF / printed), and I'll prepare it within 2 business days.

Reference: {{ticket_id}}

{{agent_name}}$$,
$$مرحبًا {{learner_first_name}}،

لأغراض التوثيق التنظيمي، يمكننا توفير:

• كشف معتمد من NELC بكافّة ساعات CME التي حصلت عليها لدينا
• خطاب تفصيلي يسرد كل دورة، الساعات الممنوحة، وتاريخ الاعتماد
• ملفات PDF فردية لكل شهادة (يمكنك تحميلها بنفسك أيضًا من قسم الشهادات)

أخبرني بما تحتاجه والصيغة المطلوبة (PDF / مطبوعة)، وسأُعدّه خلال يومَي عمل.

المرجع: {{ticket_id}}

{{agent_name}}$$,
'cme', NULL, TRUE
WHERE NOT EXISTS (SELECT 1 FROM "support_macros" WHERE "title" = 'CME — Compliance documentation request');
