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
