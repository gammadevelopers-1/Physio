/**
 * Centralised email translation strings.
 * Every template pulls its copy from here so we have one source of truth.
 *
 * Usage:  const s = getEmailStrings(locale);
 *         s.enrollmentConfirmed   → "Enrollment Confirmed!" or "تم تأكيد التسجيل!"
 */

export type EmailLocale = 'en' | 'ar';

const strings = {
  /* ── shared / layout ─────────────────────────────────── */
  platformName:        { en: 'PhysioGuidance',            ar: 'PhysioGuidance' },
  nelcBadge:           { en: 'NELC Accredited Platform',   ar: 'منصة معتمدة من المركز الوطني للتعليم الإلكتروني' },
  allRightsReserved:   { en: 'All rights reserved.',       ar: 'جميع الحقوق محفوظة.' },
  nelcFooter:          { en: 'NELC Accredited · Saudi Arabia', ar: 'معتمدة من المركز الوطني · المملكة العربية السعودية' },
  hi:                  { en: 'Hi',                         ar: 'مرحباً' },

  /* ── OTP ─────────────────────────────────────────────── */
  otpSubject:          { en: '{code} is your PhysioGuidance verification code', ar: '{code} هو رمز التحقق الخاص بك في PhysioGuidance' },
  verificationCode:    { en: 'Verification Code',          ar: 'رمز التحقق' },
  otpIntro:            { en: 'Use this one-time code to verify your identity:', ar: 'استخدم هذا الرمز لمرة واحدة للتحقق من هويتك:' },
  otpExpiry:           { en: 'This code expires in {min} minutes. If you didn\'t request this, ignore this email.', ar: 'ينتهي هذا الرمز خلال {min} دقيقة. إذا لم تطلب ذلك، تجاهل هذا البريد.' },
  otpDevice:           { en: 'Requested from:',            ar: 'تم الطلب من:' },
  otpSecurity:         { en: 'Never share this code with anyone. PhysioGuidance will never ask you for this code.', ar: 'لا تشارك هذا الرمز مع أي شخص. لن تطلب PhysioGuidance منك هذا الرمز أبداً.' },

  /* ── Password reset ──────────────────────────────────── */
  passwordResetSubject:    { en: '{code} - Password Reset Code', ar: '{code} - رمز إعادة تعيين كلمة المرور' },
  passwordResetTitle:      { en: 'Password Reset',             ar: 'إعادة تعيين كلمة المرور' },
  passwordResetIntro:      { en: 'Use this code to reset your password:', ar: 'استخدم هذا الرمز لإعادة تعيين كلمة المرور:' },
  passwordResetExpiry:     { en: 'This code expires in 10 minutes. If you didn\'t request a password reset, please ignore this email.', ar: 'ينتهي هذا الرمز خلال 10 دقائق. إذا لم تطلب إعادة تعيين كلمة المرور، تجاهل هذا البريد.' },

  /* ── Application ─────────────────────────────────────── */
  appApprovedSubject:  { en: 'Your Trainer Application Has Been Approved!', ar: 'تمت الموافقة على طلب المدرب الخاص بك!' },
  appApprovedTitle:    { en: 'Application Approved!',      ar: 'تمت الموافقة على الطلب!' },
  appApprovedBody:     { en: 'Congratulations! Your trainer application has been approved. You now have full access to the instructor dashboard where you can create courses, schedule sessions, and manage your content.', ar: 'تهانينا! تمت الموافقة على طلب المدرب الخاص بك. يمكنك الآن الوصول الكامل إلى لوحة تحكم المدرب حيث يمكنك إنشاء الدورات وجدولة المحاضرات وإدارة المحتوى.' },
  appApprovedCta:      { en: 'Log in to your instructor dashboard to get started.', ar: 'سجل الدخول إلى لوحة تحكم المدرب للبدء.' },

  appRejectedSubject:  { en: 'Update on Your Trainer Application', ar: 'تحديث بشأن طلب المدرب الخاص بك' },
  appRejectedTitle:    { en: 'Application Update',         ar: 'تحديث الطلب' },
  appRejectedBody:     { en: 'Thank you for your interest in becoming a trainer. After reviewing your application, we are unable to approve it at this time.', ar: 'شكراً لاهتمامك بأن تصبح مدرباً. بعد مراجعة طلبك، لا يمكننا الموافقة عليه في الوقت الحالي.' },
  reviewerFeedback:    { en: 'Reviewer Feedback:',         ar: 'ملاحظات المراجع:' },

  appMoreInfoSubject:  { en: 'Additional Information Needed for Your Application', ar: 'مطلوب معلومات إضافية لطلبك' },
  appMoreInfoTitle:    { en: 'More Information Needed',    ar: 'مطلوب معلومات إضافية' },
  appMoreInfoBody:     { en: 'We are reviewing your trainer application and need some additional information before we can proceed.', ar: 'نحن نراجع طلب المدرب الخاص بك ونحتاج إلى بعض المعلومات الإضافية قبل المتابعة.' },

  newAppAdminSubject:  { en: 'New Instructor Application from {name}', ar: 'طلب مدرب جديد من {name}' },
  newAppAdminTitle:    { en: 'New Application Received',   ar: 'تم استلام طلب جديد' },
  newAppAdminBody:     { en: 'A new instructor application has been submitted and requires your review.', ar: 'تم تقديم طلب مدرب جديد ويتطلب مراجعتك.' },
  applicantLabel:      { en: 'Applicant:',                 ar: 'المتقدم:' },
  emailLabel:          { en: 'Email:',                     ar: 'البريد الإلكتروني:' },

  /* ── Enrollment ──────────────────────────────────────── */
  enrollSubject:       { en: 'Enrollment Confirmed: {course}', ar: 'تم تأكيد التسجيل: {course}' },
  enrollTitle:         { en: 'Enrollment Confirmed!',      ar: 'تم تأكيد التسجيل!' },
  enrollBody:          { en: 'You have been successfully enrolled in the following course:', ar: 'تم تسجيلك بنجاح في الدورة التالية:' },
  courseLabel:          { en: 'Course:',                    ar: 'الدورة:' },
  instructorLabel:     { en: 'Instructor:',                ar: 'المدرب:' },
  startsLabel:         { en: 'Starts:',                    ar: 'تبدأ:' },
  enrollCta:           { en: 'Log in to your student dashboard to access course materials and upcoming sessions.', ar: 'سجل الدخول إلى لوحة تحكم الطالب للوصول إلى مواد الدورة والمحاضرات القادمة.' },

  /* ── Session ─────────────────────────────────────────── */
  sessionScheduledSubject:   { en: 'New Lecture Scheduled: {title}', ar: 'تمت جدولة محاضرة جديدة: {title}' },
  sessionRescheduledSubject: { en: 'Lecture Rescheduled: {title}',   ar: 'تمت إعادة جدولة المحاضرة: {title}' },
  sessionScheduledTitle:     { en: 'New Lecture Scheduled',          ar: 'تمت جدولة محاضرة جديدة' },
  sessionRescheduledTitle:   { en: 'Lecture Rescheduled',            ar: 'تمت إعادة جدولة المحاضرة' },
  sessionScheduledBody:      { en: 'A new lecture has been scheduled for your course. Here are the details:', ar: 'تمت جدولة محاضرة جديدة لدورتك. إليك التفاصيل:' },
  sessionRescheduledBody:    { en: 'A lecture has been rescheduled. Please review the updated details:', ar: 'تمت إعادة جدولة محاضرة. يرجى مراجعة التفاصيل المحدثة:' },
  lectureLabel:              { en: 'Lecture:',                       ar: 'المحاضرة:' },
  dateTimeLabel:             { en: 'Date & Time:',                   ar: 'التاريخ والوقت:' },
  typeLabel:                 { en: 'Type:',                          ar: 'النوع:' },
  typeZoom:                  { en: 'Online (Zoom)',                  ar: 'عبر الإنترنت (زووم)' },
  typeHybrid:                { en: 'Hybrid',                         ar: 'هجين' },
  typeOnsite:                { en: 'On-Site',                        ar: 'حضوري' },
  sessionScheduledNote:      { en: 'Join from your dashboard when the lecture begins.', ar: 'انضم من لوحة التحكم عند بدء المحاضرة.' },
  sessionRescheduledNote:    { en: 'Please update your schedule accordingly.', ar: 'يرجى تحديث جدولك وفقاً لذلك.' },

  sessionReminderSubject: { en: 'Session Starting Soon: {title}', ar: 'المحاضرة ستبدأ قريباً: {title}' },
  sessionReminderTitle:   { en: 'Session Starting Soon',          ar: 'المحاضرة ستبدأ قريباً' },
  sessionReminderBody:    { en: 'Your session is about to start. Here are the details:', ar: 'محاضرتك على وشك البدء. إليك التفاصيل:' },
  sessionLabel:           { en: 'Session:',                       ar: 'المحاضرة:' },
  timeLabel:              { en: 'Time:',                          ar: 'الوقت:' },
  durationLabel:          { en: 'Duration:',                      ar: 'المدة:' },
  minutesLabel:           { en: 'minutes',                        ar: 'دقيقة' },
  roleLabel:              { en: 'Your role:',                     ar: 'دورك:' },
  roleInstructor:         { en: 'Instructor',                     ar: 'مدرب' },
  roleStudent:            { en: 'Student',                        ar: 'طالب' },
  sessionReminderCta:     { en: 'Log in to your dashboard to join when the session begins.', ar: 'سجل الدخول إلى لوحة التحكم للانضمام عند بدء المحاضرة.' },

  sessionStartedSubject: { en: 'Session Live: {title}',   ar: 'المحاضرة مباشرة: {title}' },
  sessionStartedTitle:   { en: 'Session is Live',         ar: 'المحاضرة مباشرة' },
  sessionStartedBody:    { en: 'The following session is now live:', ar: 'المحاضرة التالية مباشرة الآن:' },
  sessionStartedCta:     { en: 'Join from your dashboard now.', ar: 'انضم من لوحة التحكم الآن.' },

  sessionEndedSubject:   { en: 'Session Ended: {title}',  ar: 'انتهت المحاضرة: {title}' },
  sessionEndedTitle:     { en: 'Session Ended',            ar: 'انتهت المحاضرة' },
  sessionEndedBody:      { en: 'The following session has ended:', ar: 'انتهت المحاضرة التالية:' },
  sessionEndedCta:       { en: 'Visit your dashboard to review materials and recordings.', ar: 'قم بزيارة لوحة التحكم لمراجعة المواد والتسجيلات.' },

  sessionCancelledSubject: { en: 'Session Cancelled: {title}', ar: 'تم إلغاء المحاضرة: {title}' },
  sessionCancelledTitle:   { en: 'Session Cancelled',          ar: 'تم إلغاء المحاضرة' },
  sessionCancelledBody:    { en: 'The following session has been cancelled:', ar: 'تم إلغاء المحاضرة التالية:' },
  reasonLabel:             { en: 'Reason:',                    ar: 'السبب:' },
  sessionCancelledCta:     { en: 'Please check your dashboard for any schedule updates.', ar: 'يرجى التحقق من لوحة التحكم لأي تحديثات في الجدول.' },

  /* ── Certificates ────────────────────────────────────── */
  certApprovedSubject: { en: 'Certificate Approved - {course}', ar: 'تمت الموافقة على الشهادة - {course}' },
  certApprovedTitle:   { en: 'Certificate Approved!',           ar: 'تمت الموافقة على الشهادة!' },
  certApprovedBody:    { en: 'Your certificate for the following course has been approved and is ready for download:', ar: 'تمت الموافقة على شهادتك للدورة التالية وهي جاهزة للتحميل:' },
  downloadLabel:       { en: 'Download:',                       ar: 'التحميل:' },
  downloadCert:        { en: 'Download Certificate',            ar: 'تحميل الشهادة' },

  certRejectedSubject: { en: 'Certificate Request Update - {course}', ar: 'تحديث طلب الشهادة - {course}' },
  certRejectedTitle:   { en: 'Certificate Request Update',            ar: 'تحديث طلب الشهادة' },
  certRejectedBody:    { en: 'Your certificate request for the following course has been reviewed:', ar: 'تمت مراجعة طلب شهادتك للدورة التالية:' },

  certHeldSubject:     { en: 'Certificate Request On Hold - {course}', ar: 'طلب الشهادة قيد الانتظار - {course}' },
  certHeldTitle:       { en: 'Certificate On Hold',                    ar: 'الشهادة قيد الانتظار' },
  certHeldBody:        { en: 'Your certificate request for the following course has been placed on hold:', ar: 'تم وضع طلب شهادتك للدورة التالية قيد الانتظار:' },

  /* ── TA ──────────────────────────────────────────────── */
  taAssignSubject:     { en: 'TA Assignment: {title}',     ar: 'تعيين مساعد تدريس: {title}' },
  taAssignTitle:       { en: 'TA Assignment',              ar: 'تعيين مساعد تدريس' },
  taAssignBody:        { en: 'You have been assigned as a teaching assistant for the following session:', ar: 'تم تعيينك كمساعد تدريس للمحاضرة التالية:' },
  taAutoAssigned:      { en: 'Auto-assigned',              ar: 'تعيين تلقائي' },
  taManualAssigned:    { en: 'Assigned by instructor',     ar: 'تعيين من المدرب' },

  taRejectionSubject:  { en: 'TA Suggestion Rejected: {course}', ar: 'تم رفض اقتراح المساعد: {course}' },
  taRejectionTitle:    { en: 'TA Suggestion Rejected',           ar: 'تم رفض اقتراح المساعد' },
  taRejectionBody:     { en: 'Your suggestion for a teaching assistant has been rejected.', ar: 'تم رفض اقتراحك لمساعد التدريس.' },
  suggestedTaLabel:    { en: 'Suggested TA:',                    ar: 'المساعد المقترح:' },

  /* ── Content review ──────────────────────────────────── */
  contentReviewTitle:          { en: 'Content Review Update',          ar: 'تحديث مراجعة المحتوى' },
  contentDecisionApproved:     { en: 'Approved',                       ar: 'تمت الموافقة' },
  contentDecisionRejected:     { en: 'Rejected',                       ar: 'مرفوض' },
  contentDecisionChanges:      { en: 'Changes Requested',              ar: 'مطلوب تعديلات' },
  contentReviewSubject:        { en: 'Content {decision}: {title}',    ar: 'المحتوى {decision}: {title}' },
  contentReviewBody:           { en: 'Your uploaded content has been reviewed:', ar: 'تمت مراجعة المحتوى الذي قمت بتحميله:' },
  materialLabel:               { en: 'Material:',                      ar: 'المادة:' },
  decisionLabel:               { en: 'Decision:',                      ar: 'القرار:' },
  commentLabel:                { en: 'Comment:',                       ar: 'التعليق:' },

  contentPendingSubject:       { en: 'Content Pending Review: {title}', ar: 'محتوى بانتظار المراجعة: {title}' },
  contentPendingTitle:         { en: 'Content Pending Review',          ar: 'محتوى بانتظار المراجعة' },
  contentPendingBody:          { en: 'New content has been uploaded and requires your review:', ar: 'تم تحميل محتوى جديد ويتطلب مراجعتك:' },
  uploadedByLabel:             { en: 'Uploaded by:',                    ar: 'تم التحميل بواسطة:' },
  wcagStatusLabel:             { en: 'WCAG Status:',                    ar: 'حالة WCAG:' },
  wcagSummaryLabel:            { en: 'Summary:',                        ar: 'الملخص:' },

  /* ── Assessment ──────────────────────────────────────── */
  assessSubmittedSubject:      { en: '{type} Submitted: {title}',      ar: 'تم تقديم {type}: {title}' },
  assessSubmittedTitle:        { en: 'Assessment Submitted',            ar: 'تم تقديم تقييم' },
  assessSubmittedBody:         { en: 'A student has submitted an assessment that may require your review:', ar: 'قام طالب بتقديم تقييم قد يتطلب مراجعتك:' },
  studentLabel:                { en: 'Student:',                        ar: 'الطالب:' },
  assessmentLabel:             { en: 'Assessment:',                     ar: 'التقييم:' },

  /* ── At-risk reminder ────────────────────────────────── */
  atRiskSubject:               { en: 'Course Progress Reminder - {course}', ar: 'تذكير بتقدم الدورة - {course}' },
  atRiskTitle:                 { en: 'Course Progress Reminder',            ar: 'تذكير بتقدم الدورة' },
  atRiskBody:                  { en: 'Your instructor has sent you a reminder about your progress in:', ar: 'أرسل لك مدربك تذكيراً بخصوص تقدمك في:' },
  atRiskCta:                   { en: 'Log in to your dashboard to review your progress and catch up.', ar: 'سجل الدخول إلى لوحة التحكم لمراجعة تقدمك.' },

  /* ── Generic ─────────────────────────────────────────── */
  genericNelcTraining:         { en: 'NELC Accredited Training Platform', ar: 'منصة تدريب معتمدة من المركز الوطني للتعليم الإلكتروني' },

  /* ── Report ──────────────────────────────────────────── */
  reportBody:                  { en: 'Please find the attached scheduled report:', ar: 'يرجى الاطلاع على التقرير المجدول المرفق:' },
  reportAutoGenerated:         { en: 'This report was automatically generated by PhysioGuidance.', ar: 'تم إنشاء هذا التقرير تلقائياً بواسطة PhysioGuidance.' },
} as const;

type StringKey = keyof typeof strings;

export type EmailStrings = { [K in StringKey]: string };

/**
 * Returns all email copy for the given locale.
 * Falls back to English for any missing key.
 */
export function getEmailStrings(locale: EmailLocale = 'en'): EmailStrings {
  const result = {} as Record<string, string>;
  for (const key of Object.keys(strings) as StringKey[]) {
    result[key] = strings[key][locale] || strings[key].en;
  }
  return result as EmailStrings;
}

/**
 * Simple placeholder replacer:  t('Hello {name}', { name: 'Ali' })  →  'Hello Ali'
 */
export function t(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
    template,
  );
}

/**
 * Returns HTML dir and lang attributes for the locale.
 */
export function htmlAttrs(locale: EmailLocale): string {
  return locale === 'ar' ? 'lang="ar" dir="rtl"' : 'lang="en" dir="ltr"';
}

/**
 * Returns text-align for body copy (right for Arabic).
 */
export function textAlign(locale: EmailLocale): string {
  return locale === 'ar' ? 'right' : 'left';
}
