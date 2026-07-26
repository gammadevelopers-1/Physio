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

  /* ── Webinar Course auto-enrollment ──────────────────── */
  webinarRegSetupSubject: { en: 'Welcome to PhysioGuidance — Set Your Password', ar: 'مرحبًا بك في PhysioGuidance — قم بتعيين كلمة المرور' },
  webinarPaidNudgeSubject: { en: 'Webinar registered — enroll to earn CME + certificate', ar: 'تم تسجيلك في الندوة — سجّل في الدورة لكسب CME والشهادة' },

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

  /* ── Application CTAs (status portal + support) ──────── */
  appMissingHeading:    { en: 'What we still need',      ar: 'المطلوب لإكمال طلبك' },
  appSubmitChangesCta:  { en: 'Submit changes',          ar: 'إرسال التعديلات' },
  appCheckStatusCta:    { en: 'Check application status', ar: 'تحقق من حالة الطلب' },
  appContactSupportCta: { en: 'Contact support',         ar: 'تواصل مع الدعم' },
  appContactSupportHint:{ en: 'Have a question? Our support team is here to help.', ar: 'هل لديك سؤال؟ فريق الدعم لدينا هنا لمساعدتك.' },

  /* ── Structured "what's missing" labels (matches FE) ─── */
  missingReqCV:             { en: 'CV / Resume',             ar: 'السيرة الذاتية' },
  missingReqScfhs:          { en: 'SCFHS verification',      ar: 'إثبات التسجيل في الهيئة السعودية للتخصصات الصحية' },
  missingReqQualification:  { en: 'Qualification document',  ar: 'وثيقة المؤهلات' },
  missingReqPhoto:          { en: 'Profile photo',           ar: 'الصورة الشخصية' },
  missingReqBank:           { en: 'Bank account details',    ar: 'تفاصيل الحساب البنكي' },
  missingReqNationalId:     { en: 'National / Iqama ID',     ar: 'الهوية الوطنية / الإقامة' },


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

  /* ── Course cancelled (Phase B) ───────────────────────── */
  courseCancelledSubject: { en: 'Course Cancelled: {course}', ar: 'تم إلغاء الدورة: {course}' },
  courseCancelledTitle:   { en: 'Course Cancelled',           ar: 'تم إلغاء الدورة' },
  courseCancelledBody:    { en: 'We are sorry to inform you that the following course has been cancelled:', ar: 'يؤسفنا إبلاغك بأنه تم إلغاء الدورة التالية:' },
  courseCancelledRefundImmediate: { en: 'A full refund has been issued to your original payment method. It should arrive within 5–10 business days depending on your bank.', ar: 'تم إصدار استرداد كامل إلى طريقة الدفع الأصلية. من المتوقع وصولها خلال 5–10 أيام عمل حسب البنك.' },
  courseCancelledRefundManual:    { en: 'Because you paid by bank transfer, your refund will be processed manually by our finance team and wired to your bank account. This typically takes 3–7 business days.', ar: 'نظرًا لأنك دفعت عبر التحويل البنكي، سيتم معالجة الاسترداد يدويًا من قِبل فريق المالية وتحويله إلى حسابك المصرفي. عادةً ما تستغرق هذه العملية 3–7 أيام عمل.' },
  courseCancelledRefundManualPending: { en: 'Your refund is under review by our finance team. A decision will be communicated to you separately based on the reason for cancellation and the portion of the course you have completed.', ar: 'استرداد أموالك قيد المراجعة من قِبل فريق المالية. سيتم إبلاغك بالقرار بشكل منفصل بناءً على سبب الإلغاء والجزء الذي أكملته من الدورة.' },
  courseCancelledRefundNone:      { en: 'Since no payment was collected for your enrolment, no refund is required.', ar: 'نظرًا لعدم تحصيل أي دفعة مقابل تسجيلك، فلا حاجة لأي استرداد.' },
  courseCancelledCertsRevoked: { en: 'Any certificate you may have received for this course has been revoked, and CME credits have been reversed.', ar: 'تم إبطال أي شهادة تلقيتها لهذه الدورة، وتمت استعادة رصيد التعليم الطبي المستمر (CME).' },
  courseCancelledCta:     { en: 'We apologise for the inconvenience. Feel free to browse other courses from your dashboard.', ar: 'نعتذر عن أي إزعاج. يمكنك تصفح الدورات الأخرى من لوحة التحكم.' },
  refundStatusLabel:      { en: 'Refund status:',             ar: 'حالة الاسترداد:' },

  /* ── Course rescheduled (Phase D) ─────────────────────── */
  courseRescheduledSubject: { en: 'Course Rescheduled: {course}', ar: 'تم إعادة جدولة الدورة: {course}' },
  courseRescheduledTitle:   { en: 'Course Rescheduled',           ar: 'تم إعادة جدولة الدورة' },
  courseRescheduledBody:    { en: 'The dates for the following course have been updated. Your enrollment remains active — no action is required from you.', ar: 'تم تحديث تواريخ الدورة التالية. تسجيلك لا يزال ساريًا — لا يتطلب منك أي إجراء.' },
  courseRescheduledCta:     { en: 'Check your dashboard for the updated session times.', ar: 'يرجى مراجعة لوحة التحكم لمشاهدة أوقات المحاضرات المحدثة.' },
  courseRescheduledReviveSubject: { en: 'Course Reopened: {course}', ar: 'تمت إعادة تشغيل الدورة: {course}' },
  courseRescheduledReviveTitle:   { en: 'Course Reopened',           ar: 'تمت إعادة تشغيل الدورة' },
  courseRescheduledReviveBody:    { en: 'A course you were previously enrolled in has been rescheduled and is running again. Because your original enrollment was cancelled with a full refund, you will need to enroll and pay again if you wish to attend the new session.', ar: 'تمت إعادة جدولة دورة كنت مسجلًا فيها سابقًا وستُقام من جديد. بما أنه تم إلغاء تسجيلك الأصلي واسترداد أموالك بالكامل، ستحتاج إلى إعادة التسجيل والدفع مرة أخرى إذا رغبت في الحضور.' },
  courseRescheduledReviveCta:     { en: 'You are not automatically re-enrolled. Use the button above to re-enroll if you are interested.', ar: 'لن يتم تسجيلك تلقائيًا. استخدم الزر أعلاه لإعادة التسجيل إذا كنت مهتمًا.' },
  courseRescheduledReenrollCta:   { en: 'Re-enroll now',              ar: 'إعادة التسجيل الآن' },
  courseRescheduledPreviousDateLabel: { en: 'Previous start:',        ar: 'التاريخ السابق:' },
  courseRescheduledNewDateLabel:      { en: 'New start:',              ar: 'التاريخ الجديد:' },
  courseRescheduledEndDateLabel:      { en: 'Ends:',                  ar: 'تنتهي:' },

  /* ── Admin/finance payment alerts (Phase G) ──────────── */
  adminPaymentReceivedSubject: { en: 'Payment received — {course}', ar: 'تم استلام دفعة — {course}' },
  adminPaymentReceivedTitle:   { en: 'Payment received',              ar: 'تم استلام دفعة' },
  adminPaymentReceivedIntro:   { en: 'A new payment has been received for the following course:', ar: 'تم استلام دفعة جديدة للدورة التالية:' },
  adminPaymentReceivedCta:     { en: 'View in Finance → Payments',   ar: 'عرض في المالية ← المدفوعات' },
  adminBankTransferPendingSubject: { en: 'Bank transfer pending review — {course}', ar: 'تحويل بنكي قيد المراجعة — {course}' },
  adminBankTransferPendingTitle:   { en: 'Bank transfer pending review', ar: 'تحويل بنكي قيد المراجعة' },
  adminBankTransferPendingIntro:   { en: 'A bank transfer receipt has been submitted for review:', ar: 'تم تقديم إيصال تحويل بنكي للمراجعة:' },
  adminBankTransferPendingCta:     { en: 'Review in Finance → Bank Transfers', ar: 'مراجعة في المالية ← التحويلات البنكية' },
  buyerLabel:                  { en: 'Buyer:',                       ar: 'المشتري:' },
  amountLabel:                 { en: 'Amount:',                      ar: 'المبلغ:' },
  gatewayLabel:                { en: 'Gateway:',                     ar: 'البوابة:' },
  submittedAtLabel:            { en: 'Submitted:',                   ar: 'تاريخ التقديم:' },

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

  /* ── Review pending approval ─────────────────────────── */
  reviewPendingSubject:        { en: 'New Review Pending Approval: {course}', ar: 'مراجعة جديدة بانتظار الموافقة: {course}' },
  reviewPendingTitle:          { en: 'New Review Pending Approval',     ar: 'مراجعة جديدة بانتظار الموافقة' },
  reviewPendingBody:           { en: 'A student left a review on one of your courses. Approve or reject it before it appears on the public course page.', ar: 'ترك أحد الطلاب مراجعة على إحدى دوراتك. قم بالموافقة أو الرفض قبل ظهورها على صفحة الدورة العامة.' },
  ratingLabel:                 { en: 'Rating:',                         ar: 'التقييم:' },
  reviewTextLabel:             { en: 'Review:',                         ar: 'المراجعة:' },
  reviewCtaLabel:              { en: 'Open in Dashboard',               ar: 'فتح في لوحة التحكم' },

  /* ── Assessment ──────────────────────────────────────── */
  assessSubmittedSubject:      { en: '{type} Submitted: {title}',      ar: 'تم تقديم {type}: {title}' },
  assessSubmittedTitle:        { en: 'Assessment Submitted',            ar: 'تم تقديم تقييم' },
  assessSubmittedBody:         { en: 'A student has submitted an assessment that may require your review:', ar: 'قام طالب بتقديم تقييم قد يتطلب مراجعتك:' },
  studentLabel:                { en: 'Student:',                        ar: 'الطالب:' },
  assessmentLabel:             { en: 'Assessment:',                     ar: 'التقييم:' },

  /* ── Retake granted ──────────────────────────────────── */
  retakeGrantedSubject:        { en: 'You have been granted a retake: {title}', ar: 'تم منحك فرصة إعادة التقييم: {title}' },
  retakeGrantedTitle:          { en: 'Retake Granted',                  ar: 'تم منحك فرصة إعادة التقييم' },
  retakeGrantedBody:           { en: 'Your course manager has granted you a retake for the following assessment:', ar: 'منحك مدير الدورة فرصة لإعادة التقييم التالي:' },
  retakeGrantedReasonLabel:    { en: 'Reason:',                         ar: 'السبب:' },
  retakeGrantedNewDeadline:    { en: 'New deadline:',                   ar: 'الموعد النهائي الجديد:' },
  retakeGrantedCta:            { en: 'Log in to start the retake.',     ar: 'سجل الدخول لبدء إعادة التقييم.' },

  /* ── Time extension granted ──────────────────────────── */
  timeExtensionSubject:        { en: '{minutes} extra minutes granted: {title}', ar: 'تم منحك {minutes} دقيقة إضافية: {title}' },
  timeExtensionTitle:          { en: 'Extra Time Granted',              ar: 'تم منحك وقتاً إضافياً' },
  timeExtensionBody:           { en: 'Your course manager has granted you extra time for the following assessment:', ar: 'منحك مدير الدورة وقتاً إضافياً للتقييم التالي:' },
  timeExtensionMinutesLabel:   { en: 'Extra minutes:',                  ar: 'الدقائق الإضافية:' },
  timeExtensionCta:            { en: 'Log in to use your extra time.',  ar: 'سجل الدخول لاستخدام الوقت الإضافي.' },

  /* ── At-risk reminder ────────────────────────────────── */
  atRiskSubject:               { en: 'Course Progress Reminder - {course}', ar: 'تذكير بتقدم الدورة - {course}' },
  atRiskTitle:                 { en: 'Course Progress Reminder',            ar: 'تذكير بتقدم الدورة' },
  atRiskBody:                  { en: 'Your instructor has sent you a reminder about your progress in:', ar: 'أرسل لك مدربك تذكيراً بخصوص تقدمك في:' },
  atRiskCta:                   { en: 'Log in to your dashboard to review your progress and catch up.', ar: 'سجل الدخول إلى لوحة التحكم لمراجعة تقدمك.' },

  /* ── Course assignment ────────────────────────────────── */
  courseAssignedSubject:        { en: 'Course Assigned: {course}',              ar: 'تم تعيين دورة: {course}' },
  courseAssignedTitle:          { en: 'Course Assigned',                        ar: 'تم تعيين دورة' },
  courseAssignedBody:           { en: 'You have been assigned as the instructor for the following course:', ar: 'تم تعيينك كمدرب للدورة التالية:' },
  courseAssignedCta:            { en: 'Log in to your instructor dashboard to review course details and start preparing.', ar: 'سجل الدخول إلى لوحة تحكم المدرب لمراجعة تفاصيل الدورة والبدء في التحضير.' },
  courseUnassignedSubject:      { en: 'Course Unassigned: {course}',            ar: 'تم إلغاء تعيين الدورة: {course}' },
  courseUnassignedTitle:        { en: 'Course Unassigned',                      ar: 'تم إلغاء تعيين الدورة' },
  courseUnassignedBody:         { en: 'You have been removed as the instructor for the following course:', ar: 'تم إزالتك كمدرب من الدورة التالية:' },
  assignedByLabel:             { en: 'Assigned by:',                           ar: 'تم التعيين بواسطة:' },
  deliveryTypeLabel:           { en: 'Type:',                                  ar: 'النوع:' },

  /* ── Generic ─────────────────────────────────────────── */
  genericNelcTraining:         { en: 'NELC Accredited Training Platform', ar: 'منصة تدريب معتمدة من المركز الوطني للتعليم الإلكتروني' },

  /* ── Report ──────────────────────────────────────────── */
  reportBody:                  { en: 'Please find the attached scheduled report:', ar: 'يرجى الاطلاع على التقرير المجدول المرفق:' },
  reportAutoGenerated:         { en: 'This report was automatically generated by PhysioGuidance.', ar: 'تم إنشاء هذا التقرير تلقائياً بواسطة PhysioGuidance.' },

  /* ── Payment confirmation ────────────────────────────── */
  paymentConfirmedSubject:     { en: 'Payment Confirmed - {course}', ar: 'تم تأكيد الدفع - {course}' },
  paymentConfirmedTitle:       { en: 'Payment Confirmed',            ar: 'تم تأكيد الدفع' },
  paymentConfirmedBody:        { en: 'Thank you! Your payment has been received and your enrollment is active.', ar: 'شكراً لك! تم استلام دفعتك وتم تفعيل تسجيلك في الدورة.' },
  paymentAmountLabel:          { en: 'Amount:',                       ar: 'المبلغ:' },
  paymentInvoiceLabel:         { en: 'Invoice #:',                    ar: 'رقم الفاتورة:' },
  paymentMethodLabel:          { en: 'Method:',                       ar: 'طريقة الدفع:' },
  paymentDateLabel:            { en: 'Paid on:',                      ar: 'تاريخ الدفع:' },
  paymentConfirmedCta:         { en: 'Go to your course',             ar: 'انتقل إلى دورتك' },
  paymentConfirmedInvoiceNote: { en: 'A copy of your tax invoice is attached to this email for your records.', ar: 'تم إرفاق نسخة من الفاتورة الضريبية بهذا البريد للاحتفاظ بها.' },

  /* ── Payment failed ──────────────────────────────────── */
  paymentFailedSubject:        { en: 'Payment Failed - {course}',    ar: 'فشل الدفع - {course}' },
  paymentFailedTitle:          { en: 'Payment Could Not Be Processed', ar: 'تعذّرت معالجة الدفع' },
  paymentFailedBody:           { en: 'We were unable to process your payment for the following course. Your enrollment has not been activated.', ar: 'لم نتمكن من معالجة دفعتك للدورة التالية. لم يتم تفعيل تسجيلك بعد.' },
  paymentFailedReason:         { en: 'Reason:',                       ar: 'السبب:' },
  paymentFailedCta:            { en: 'Try again',                     ar: 'حاول مرة أخرى' },
  paymentFailedHint:           { en: 'Please check your card details or try a different payment method. Contact your bank if the problem persists.', ar: 'يرجى التحقق من بيانات البطاقة أو تجربة طريقة دفع أخرى. تواصل مع البنك إذا استمرت المشكلة.' },

  /* ── Bank transfer received ──────────────────────────── */
  bankReceivedSubject:         { en: 'Bank Transfer Receipt Received', ar: 'تم استلام إيصال التحويل البنكي' },
  bankReceivedTitle:           { en: 'Receipt Received — Under Review', ar: 'تم استلام الإيصال — قيد المراجعة' },
  bankReceivedBody:            { en: 'Thanks — we\'ve received your bank transfer receipt. Our finance team will review it, and you\'ll get a confirmation email once your enrollment is activated.', ar: 'شكراً لك — استلمنا إيصال التحويل البنكي. سيقوم فريق المالية بمراجعته وستصلك رسالة تأكيد بمجرد تفعيل تسجيلك.' },
  bankReceivedReviewTime:      { en: 'Review usually takes 1–2 business days.', ar: 'تستغرق المراجعة عادةً من يوم إلى يومي عمل.' },
  bankReceivedCta:             { en: 'View payment status',           ar: 'عرض حالة الدفع' },

  /* ── Bank transfer rejected ──────────────────────────── */
  bankRejectedSubject:         { en: 'Bank Transfer Rejected — Action Required', ar: 'تم رفض التحويل البنكي — مطلوب إجراء' },
  bankRejectedTitle:           { en: 'Bank Transfer Rejected',        ar: 'تم رفض التحويل البنكي' },
  bankRejectedBody:            { en: 'Our finance team was unable to verify your bank transfer receipt. Please review the reason below and upload a corrected receipt.', ar: 'لم يتمكن فريق المالية من التحقق من إيصال التحويل البنكي. يرجى مراجعة السبب أدناه ورفع إيصال مصحح.' },
  bankRejectedReason:          { en: 'Rejection reason:',             ar: 'سبب الرفض:' },
  bankRejectedCta:             { en: 'Upload a new receipt',          ar: 'رفع إيصال جديد' },

  /* ── Refund notifications (4 variants) ──────────────── */
  refundSubmittedSubject:      { en: 'Refund Request Received - {course}', ar: 'تم استلام طلب الاسترداد - {course}' },
  refundSubmittedTitle:        { en: 'Refund Request Received',       ar: 'تم استلام طلب الاسترداد' },
  refundSubmittedBody:         { en: 'We received your refund request. Our finance team will review it shortly.', ar: 'استلمنا طلب الاسترداد الخاص بك. سيقوم فريق المالية بمراجعته قريباً.' },
  refundAmountLabel:           { en: 'Refund amount:',                ar: 'مبلغ الاسترداد:' },
  refundReasonLabel:           { en: 'Reason:',                       ar: 'السبب:' },
  refundReviewTimeNote:        { en: 'Reviews typically complete within 3–5 business days.', ar: 'تكتمل المراجعة عادةً خلال 3–5 أيام عمل.' },

  refundApprovedSubject:       { en: 'Refund Approved - {course}',    ar: 'تمت الموافقة على الاسترداد - {course}' },
  refundApprovedTitle:         { en: 'Refund Approved',                ar: 'تمت الموافقة على الاسترداد' },
  refundApprovedBody:          { en: 'Good news — your refund has been approved and is being processed to your original payment method.', ar: 'خبر سار — تمت الموافقة على طلب الاسترداد وجارٍ معالجته إلى طريقة الدفع الأصلية.' },
  refundApprovedEta:           { en: 'Funds usually arrive within 5–10 business days depending on your bank.', ar: 'عادةً ما تصل الأموال خلال 5–10 أيام عمل حسب البنك.' },
  refundManualEta:             { en: 'Since you paid by bank transfer, our finance team will wire the refund to your account. This typically takes 3–7 business days.', ar: 'نظراً لأنك دفعت عبر التحويل البنكي، سيقوم فريق المالية بتحويل مبلغ الاسترداد إلى حسابك. تستغرق العملية عادةً 3–7 أيام عمل.' },

  refundRejectedSubject:       { en: 'Refund Request Update - {course}', ar: 'تحديث طلب الاسترداد - {course}' },
  refundRejectedTitle:         { en: 'Refund Request Not Approved',   ar: 'لم تتم الموافقة على طلب الاسترداد' },
  refundRejectedBody:          { en: 'After reviewing your refund request, we\'re unable to approve it at this time. See the reason below.', ar: 'بعد مراجعة طلب الاسترداد، لا يمكننا الموافقة عليه في الوقت الحالي. اطلع على السبب أدناه.' },
  refundRejectedReason:        { en: 'Review notes:',                  ar: 'ملاحظات المراجعة:' },
  refundRejectedContact:       { en: 'If you believe this was decided in error, reply to this email or contact support.', ar: 'إذا كنت تعتقد أن القرار خاطئ، يرجى الرد على هذا البريد أو التواصل مع الدعم.' },

  refundCompletedSubject:      { en: 'Refund Completed - {course}',   ar: 'اكتمل الاسترداد - {course}' },
  refundCompletedTitle:        { en: 'Refund Completed',               ar: 'اكتمل الاسترداد' },
  refundCompletedBody:         { en: 'Your refund has been successfully processed. The funds have been returned to your original payment method.', ar: 'تمت معالجة الاسترداد بنجاح. تم إرجاع المبلغ إلى طريقة الدفع الأصلية.' },
  refundCompletedNote:         { en: 'Please allow up to 10 business days for the amount to reflect in your account.', ar: 'يرجى الانتظار حتى 10 أيام عمل لظهور المبلغ في حسابك.' },
  refundOriginalAmount:        { en: 'Original amount',                ar: 'المبلغ الأصلي' },
  refundProcessingFee:         { en: 'Processing fee deduction',       ar: 'رسوم المعالجة المخصومة' },
  refundToYou:                 { en: 'Refunded to you',                ar: 'المبلغ المسترد لك' },
  refundBreakdownIntro:        { en: 'Here is your refund breakdown:', ar: 'إليك تفاصيل الاسترداد:' },
  refundPartialTitle:          { en: 'Partial approval',               ar: 'موافقة جزئية' },
  refundPartialBody:           { en: 'You requested {currency} {requested}. This refund was approved for {currency} {approved}.', ar: 'طلبت مبلغ {requested} {currency}. تمت الموافقة على استرداد {approved} {currency}.' },

  /* ── Support tickets (customer-facing) ───────────────── */
  ticketCreatedSubject:        { en: 'Support ticket #{id} created',  ar: 'تم إنشاء تذكرة الدعم #{id}' },
  ticketCreatedTitle:          { en: 'We\'ve got your request',       ar: 'استلمنا طلبك' },
  ticketCreatedBody:           { en: 'Thanks for reaching out. Our support team has received your ticket and will get back to you shortly.', ar: 'شكراً لتواصلك معنا. استلم فريق الدعم تذكرتك وسنعود إليك قريباً.' },
  ticketIdLabel:               { en: 'Ticket ID:',                    ar: 'رقم التذكرة:' },
  ticketSubjectLabel:          { en: 'Subject:',                      ar: 'الموضوع:' },
  ticketCategoryLabel:         { en: 'Category:',                     ar: 'الفئة:' },
  ticketPriorityLabel:         { en: 'Priority:',                     ar: 'الأولوية:' },
  ticketStatusLabel:           { en: 'Status:',                       ar: 'الحالة:' },
  ticketCreatedCta:            { en: 'View ticket',                   ar: 'عرض التذكرة' },
  ticketExpectedResponse:      { en: 'Expected response:',            ar: 'وقت الرد المتوقع:' },
  ticketReceivedTitle:         { en: 'Ticket Received',                ar: 'تم استلام التذكرة' },
  ticketBodyInHours:           { en: 'We\'ve received your support ticket #{id}. Our team will respond within {eta}.', ar: 'استلمنا تذكرة الدعم #{id}. سيقوم فريقنا بالرد خلال {eta}.' },
  ticketBodyOutOfHours:        { en: 'We\'ve received your support ticket #{id}. Your ticket is queued — our team will respond when business hours resume on {eta}.', ar: 'استلمنا تذكرة الدعم #{id}. تذكرتك في قائمة الانتظار — سيرد فريقنا عند استئناف ساعات العمل يوم {eta}.' },
  ticketTrackHintDashboard:    { en: 'You can track your ticket status from your dashboard.', ar: 'يمكنك تتبع حالة تذكرتك من لوحة التحكم.' },
  ticketTrackHintGuest:        { en: 'You can reply or check progress at the tracking link below — keep it safe, it\'s your only way back to this ticket.', ar: 'يمكنك الرد أو متابعة التقدم عبر رابط التتبع أدناه — احتفظ به بأمان، فهو الطريقة الوحيدة للعودة إلى هذه التذكرة.' },
  ticketExpectedWithin:        { en: 'Expected Response: within',      ar: 'الرد المتوقع: خلال' },
  ticketExpectedAt:            { en: 'Expected Response: when business hours resume on', ar: 'الرد المتوقع: عند استئناف ساعات العمل يوم' },
  ticketCtaGuest:              { en: 'Track Your Ticket',              ar: 'تتبّع تذكرتك' },
  ticketCtaDashboard:          { en: 'View My Tickets',                ar: 'عرض تذاكري' },

  ticketReplySubject:          { en: 'New reply on your ticket #{id}', ar: 'رد جديد على تذكرتك #{id}' },
  ticketReplyTitle:            { en: 'You\'ve got a new reply',       ar: 'لديك رد جديد' },
  ticketReplyBody:             { en: 'Our support team just replied to your ticket:', ar: 'قام فريق الدعم بالرد على تذكرتك:' },
  ticketReplyFromLabel:        { en: 'From:',                         ar: 'من:' },
  ticketReplyCta:              { en: 'Open ticket & reply',           ar: 'فتح التذكرة والرد' },
  ticketReplyHeadingWithId:    { en: 'New Reply on Ticket #{id}',      ar: 'رد جديد على التذكرة #{id}' },
  ticketReplyIntro:            { en: '{sender} has replied to ticket #{id}.', ar: 'قام {sender} بالرد على التذكرة #{id}.' },
  ticketReplyPreviewLabel:     { en: 'Message Preview',                ar: 'معاينة الرسالة' },
  ticketReplyCtaGuest:         { en: 'View & Reply',                   ar: 'عرض والرد' },
  ticketReplyCtaAuth:          { en: 'View Full Reply',                ar: 'عرض الرد الكامل' },

  ticketResolvedSubject:       { en: 'Your ticket #{id} has been resolved', ar: 'تم حل تذكرتك #{id}' },
  ticketResolvedTitle:         { en: 'Ticket Resolved',                ar: 'تم حل التذكرة' },
  ticketResolvedBody:          { en: 'Great news — your support ticket has been marked as resolved. If you feel the issue is not fully addressed, you can reopen it below.', ar: 'خبر سار — تم تعيين تذكرة الدعم كمحلولة. إذا شعرت أن المشكلة لم تُحل بالكامل، يمكنك إعادة فتحها أدناه.' },
  ticketResolvedResolutionLabel: { en: 'Resolution:',                 ar: 'الحل:' },
  ticketResolvedReopenHint:    { en: 'Reply to this thread within 7 days to automatically reopen it.', ar: 'يمكنك الرد على هذه التذكرة خلال 7 أيام لإعادة فتحها تلقائياً.' },
  ticketResolvedCta:           { en: 'View ticket',                   ar: 'عرض التذكرة' },
  ticketResolvedBrief:         { en: 'Your support issue has been resolved. If your issue is not fully resolved, you can reopen this ticket within 48 hours.', ar: 'تم حل مشكلة الدعم الخاصة بك. إذا لم تُحل المشكلة بالكامل، يمكنك إعادة فتح التذكرة خلال 48 ساعة.' },
  ticketResolvedBadge:         { en: 'Ticket #{id} has been resolved', ar: 'تم حل التذكرة #{id}' },
  ticketResolvedReopenCta:     { en: 'Reopen Ticket',                  ar: 'إعادة فتح التذكرة' },
  ticketRatingTitle:           { en: 'How did we do?',                 ar: 'كيف كان أداؤنا؟' },
  ticketRatingBody:            { en: 'Tap a star to rate your support experience.', ar: 'انقر على نجمة لتقييم تجربتك مع الدعم.' },
  ticketRatingLink:            { en: 'Rate your experience',           ar: 'قيّم تجربتك' },

  ticketClosedSubject:         { en: 'Your ticket #{id} has been closed', ar: 'تم إغلاق تذكرتك #{id}' },
  ticketClosedTitle:           { en: 'Ticket Closed',                  ar: 'تم إغلاق التذكرة' },
  ticketClosedBody:            { en: 'Your ticket has been closed. If you need further assistance, please open a new ticket from your dashboard.', ar: 'تم إغلاق تذكرتك. إذا كنت بحاجة إلى مزيد من المساعدة، يرجى فتح تذكرة جديدة من لوحة التحكم.' },
  ticketClosedCta:             { en: 'Open a new ticket',             ar: 'فتح تذكرة جديدة' },
  ticketClosedBrief:           { en: 'Your support ticket is now closed. Thank you for working with our team. If you need further help, please open a new ticket.', ar: 'تم إغلاق تذكرة الدعم الخاصة بك. شكراً لتعاونك مع فريقنا. إذا احتجت مزيداً من المساعدة، يرجى فتح تذكرة جديدة.' },
  ticketClosedBadge:           { en: 'Ticket #{id} has been closed',   ar: 'تم إغلاق التذكرة #{id}' },

  ticketStatusSubject:         { en: 'Ticket #{id} status: {status}', ar: 'حالة التذكرة #{id}: {status}' },
  ticketStatusTitle:           { en: 'Ticket Status Updated',          ar: 'تم تحديث حالة التذكرة' },
  ticketStatusBody:            { en: 'The status of your support ticket has been updated:', ar: 'تم تحديث حالة تذكرة الدعم الخاصة بك:' },
  ticketOldStatusLabel:        { en: 'Previous:',                     ar: 'السابقة:' },
  ticketNewStatusLabel:        { en: 'Current:',                      ar: 'الحالية:' },
  ticketStatusNowText:         { en: 'Ticket {ref} is now {status}.',  ar: 'التذكرة {ref} أصبحت الآن {status}.' },

  /* ── Ticket priorities (localized) ───────────────────── */
  ticketPriorityLow:           { en: 'Low',                            ar: 'منخفضة' },
  ticketPriorityMedium:        { en: 'Medium',                         ar: 'متوسطة' },
  ticketPriorityHigh:          { en: 'High',                           ar: 'عالية' },
  ticketPriorityUrgent:        { en: 'Urgent',                         ar: 'عاجلة' },

  /* ── Ticket statuses (localized) ─────────────────────── */
  ticketStatusOpen:            { en: 'Open',                           ar: 'مفتوحة' },
  ticketStatusInProgress:      { en: 'In progress',                    ar: 'قيد المعالجة' },
  ticketStatusPending:         { en: 'Pending',                        ar: 'قيد الانتظار' },
  ticketStatusOnHold:          { en: 'On hold',                        ar: 'موقوفة' },
  ticketStatusResolved:        { en: 'Resolved',                       ar: 'محلولة' },
  ticketStatusClosed:          { en: 'Closed',                         ar: 'مغلقة' },

  /* ── CSAT ────────────────────────────────────────────── */
  csatSurveySubject:           { en: 'How was your support experience?', ar: 'كيف كانت تجربتك مع الدعم؟' },
  csatSurveyTitle:             { en: 'Rate your experience',            ar: 'قيّم تجربتك' },
  csatSurveyBody:              { en: 'Your ticket was resolved recently. We\'d love your quick feedback on how our team handled it — it takes 15 seconds.', ar: 'تم حل تذكرتك مؤخراً. نود سماع رأيك السريع حول كيفية معالجتها من قبل فريقنا — الأمر لا يستغرق سوى 15 ثانية.' },
  csatRate1:                   { en: 'Very poor',                       ar: 'ضعيف جداً' },
  csatRate2:                   { en: 'Poor',                            ar: 'ضعيف' },
  csatRate3:                   { en: 'Okay',                            ar: 'مقبول' },
  csatRate4:                   { en: 'Good',                            ar: 'جيد' },
  csatRate5:                   { en: 'Excellent',                       ar: 'ممتاز' },
  csatSurveyCta:               { en: 'Give feedback',                   ar: 'إرسال الرأي' },
  csatExpiryNote:              { en: 'This survey link expires in 14 days.', ar: 'ينتهي رابط الاستبيان خلال 14 يوماً.' },
  csatSurveyIntro:             { en: 'We recently resolved your support ticket #{id}. How satisfied were you with our support?', ar: 'قمنا مؤخراً بحل تذكرة الدعم #{id}. ما مدى رضاك عن الدعم المقدَّم؟' },
  csatSurveyExpiryShort:       { en: 'This survey expires in 72 hours. No login required.', ar: 'ينتهي هذا الاستبيان خلال 72 ساعة. لا يتطلب تسجيل دخول.' },
  csatRateVeryBad:             { en: 'Very Bad',                        ar: 'سيئ جداً' },
  csatRateBad:                 { en: 'Bad',                             ar: 'سيئ' },
  csatRateOkay:                { en: 'Okay',                            ar: 'مقبول' },
  csatRateGood:                { en: 'Good',                            ar: 'جيد' },
  csatRateExcellent:           { en: 'Excellent',                       ar: 'ممتاز' },

  csatFollowupSubject:         { en: 'We\'d still love your feedback', ar: 'نود سماع رأيك' },
  csatFollowupTitle:           { en: 'One quick tap — really',          ar: 'نقرة سريعة — فقط' },
  csatFollowupBody:            { en: 'We noticed you didn\'t get a chance to rate your recent support experience. It only takes a moment and helps us improve.', ar: 'لاحظنا أنك لم تتمكن من تقييم تجربتك الأخيرة مع الدعم. الأمر يستغرق لحظة فقط ويساعدنا على التحسّن.' },
  csatFollowupCta:             { en: 'Rate now',                        ar: 'قيّم الآن' },
  csatLowScoreTitle:           { en: 'We\'re Sorry',                    ar: 'نعتذر منك' },
  csatLowScoreBody:            { en: 'We noticed you rated your recent support experience as {score}/5. We\'re sorry it didn\'t meet your expectations.', ar: 'لاحظنا أنك قيّمت تجربتك الأخيرة مع الدعم بـ {score}/5. نأسف لأنها لم ترقَ إلى مستوى توقعاتك.' },
  csatLowScoreCta:             { en: 'We\'d like to understand what went wrong. You can reopen your ticket or contact us.', ar: 'نود أن نفهم ما حدث. يمكنك إعادة فتح تذكرتك أو التواصل معنا.' },
  csatContactSupportCta:       { en: 'Contact Support',                 ar: 'تواصل مع الدعم' },
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

// ─── RTL layout primitives ────────────────────────────────────────
// All shared helpers below emit table-based HTML because flexbox and
// CSS grid remain unreliable in Outlook / older Gmail. Every helper
// also renders correctly in both directions — pass the caller's
// `locale` and the layout mirrors itself.
//
// The Arabic-side layout deliberately puts LABELS on the right and
// VALUES on the left, matching the RTL reading order requested by
// marketing. Dynamic values (dates, names, URLs, course titles that
// may contain English glyphs) are wrapped in `unicode-bidi: isolate`
// so a Latin course name inside an Arabic sentence doesn't get its
// order flipped by the browser's bidi resolution.

/**
 * Direction attr for the <body> tag. `htmlAttrs` covers <html>; this
 * covers <body> so email clients that strip <html>-level attributes
 * (Gmail webmail, historically) still get the RTL context.
 */
export function bodyAttrs(locale: EmailLocale): string {
  return locale === 'ar' ? 'dir="rtl"' : 'dir="ltr"';
}

/**
 * Render one "label: value" row. In RTL the label sits on the right,
 * the value on the left. In LTR the reverse. Static labels use the
 * paragraph text color; dynamic values use the primary text color and
 * a bidi-isolated span so Latin-in-Arabic (course names, dates, URLs)
 * doesn't reorder.
 *
 * Colors are inlined because most email clients strip <style> blocks
 * or downgrade CSS variables — self-contained inline styles are the
 * only reliable path.
 */
export function infoRow(
  locale: EmailLocale,
  label: string,
  value: string,
): string {
  const isRTL = locale === 'ar';
  const labelCell = `<td style="padding:6px 0;font-size:14px;color:#6b7280;font-weight:500;text-align:${isRTL ? 'right' : 'left'};vertical-align:top;white-space:nowrap;">${label}</td>`;
  const valueCell = `<td style="padding:6px 0;font-size:14px;color:#111827;text-align:${isRTL ? 'left' : 'right'};vertical-align:top;"><span style="unicode-bidi:isolate;">${value}</span></td>`;
  return `<tr>${isRTL ? labelCell + valueCell : labelCell + valueCell}</tr>`;
}

/**
 * Render a stack of infoRow() rows inside a properly-attributed
 * <table>. Use this instead of hand-building the table so the dir
 * attribute + spacing stay consistent across templates.
 */
export function infoTable(
  locale: EmailLocale,
  rows: { label: string; value: string }[],
): string {
  const inner = rows.map((r) => infoRow(locale, r.label, r.value)).join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" dir="${locale === 'ar' ? 'rtl' : 'ltr'}" style="border-collapse:collapse;margin:16px 0;">${inner}</table>`;
}

/**
 * Primary action button. Full-width table cell centered — Outlook 2016
 * ignores width:auto + margin:auto on the anchor itself, so we wrap
 * in a centered <td>.
 */
export function actionButton(
  locale: EmailLocale,
  href: string,
  label: string,
): string {
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const safeHref = href.replace(/"/g, '&quot;');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" dir="${dir}" style="border-collapse:collapse;margin:24px 0;"><tr><td align="center"><a href="${safeHref}" style="display:inline-block;padding:12px 28px;background:#a37f49;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;font-family:Arial,Helvetica,sans-serif;">${label}</a></td></tr></table>`;
}

/**
 * Wrap ANY dynamic user-visible value (course name, ticket subject,
 * date, url) so bidi resolution doesn't reorder Latin chunks inside
 * an Arabic sentence. Cheap and safe to over-apply.
 */
export function bidi(value: string): string {
  return `<span style="unicode-bidi:isolate;">${value}</span>`;
}
