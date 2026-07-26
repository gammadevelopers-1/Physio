/**
 * Single source of truth for every admin-editable transactional
 * template the platform sends. The admin Templates page lists from
 * here; the email/whatsapp dispatchers look up by eventKey + locale
 * to honor admin edits (with the hardcoded function as fallback).
 *
 * Adding a new template = add an entry here + (optionally) wire the
 * dispatcher to consume the DB row. The list page picks it up
 * automatically.
 */

export type TemplateChannel = 'email' | 'whatsapp';
export type TemplateCategory =
  | 'account'
  | 'applications'
  | 'enrollment'
  | 'sessions'
  | 'webinars'
  | 'certificates'
  | 'assessments'
  | 'content'
  | 'payments'
  | 'support'
  | 'csat'
  | 'whatsapp';

export interface TemplateVariable {
  key: string; // e.g. "studentName"
  label: string; // e.g. "Student name"
  example: string; // shown in preview
}

export interface TemplateMeta {
  eventKey: string;
  channel: TemplateChannel;
  category: TemplateCategory;
  /** Display name for the list page (bilingual). */
  nameEn: string;
  nameAr: string;
  /** One-line context for the editor. */
  descriptionEn: string;
  descriptionAr: string;
  variables: TemplateVariable[];
  /** Default subject if the template's hardcoded function uses one. */
  defaultSubjectEn?: string;
  defaultSubjectAr?: string;
}

const STUDENT_NAME: TemplateVariable = {
  key: 'studentName',
  label: 'Student name',
  example: 'Ahmed Al-Otaibi',
};
const COURSE_NAME: TemplateVariable = {
  key: 'courseName',
  label: 'Course name',
  example: 'Sports Physiotherapy Fundamentals',
};
const RECIPIENT_NAME: TemplateVariable = {
  key: 'recipientName',
  label: 'Recipient name',
  example: 'Ahmed Al-Otaibi',
};

export const TEMPLATE_REGISTRY: TemplateMeta[] = [
  // ─── Account ─────────────────────────────────────────────────
  {
    eventKey: 'otp',
    channel: 'email',
    category: 'account',
    nameEn: 'One-Time Password',
    nameAr: 'رمز المرور لمرة واحدة',
    descriptionEn: 'Email-based OTP sent during 2FA verification.',
    descriptionAr: 'يُرسَل أثناء التحقق من المصادقة الثنائية.',
    variables: [
      RECIPIENT_NAME,
      { key: 'code', label: 'OTP code', example: '482190' },
      { key: 'expiresInMinutes', label: 'Expiry minutes', example: '10' },
    ],
    defaultSubjectEn: 'Your verification code',
    defaultSubjectAr: 'رمز التحقق الخاص بك',
  },
  {
    eventKey: 'password_reset',
    channel: 'email',
    category: 'account',
    nameEn: 'Password Reset',
    nameAr: 'إعادة تعيين كلمة المرور',
    descriptionEn: 'Sent when a user requests a password reset.',
    descriptionAr: 'يُرسَل عند طلب إعادة تعيين كلمة المرور.',
    variables: [
      RECIPIENT_NAME,
      { key: 'code', label: 'Reset code', example: '482190' },
      { key: 'expiresInMinutes', label: 'Expiry minutes', example: '10' },
    ],
    defaultSubjectEn: 'Reset your password',
    defaultSubjectAr: 'إعادة تعيين كلمة المرور',
  },
  {
    eventKey: 'application_approved_set_password',
    channel: 'email',
    category: 'account',
    nameEn: 'Set Password (Invite)',
    nameAr: 'تعيين كلمة المرور (دعوة)',
    descriptionEn: 'Sent to invited admin-created users with a set-password link.',
    descriptionAr: 'يُرسَل للمستخدمين المنشأين من قِبَل المدير مع رابط تعيين كلمة المرور.',
    variables: [
      RECIPIENT_NAME,
      { key: 'setupUrl', label: 'Set-password URL', example: 'https://physioguidance.org/en/set-password?token=…' },
      { key: 'expiresInHours', label: 'Expiry hours', example: '24' },
    ],
    defaultSubjectEn: 'Set your password',
    defaultSubjectAr: 'قم بتعيين كلمة المرور',
  },

  // ─── Applications ────────────────────────────────────────────
  {
    eventKey: 'application_approved',
    channel: 'email',
    category: 'applications',
    nameEn: 'Application Approved',
    nameAr: 'تمت الموافقة على الطلب',
    descriptionEn: 'Sent when an instructor application is approved.',
    descriptionAr: 'يُرسَل عند الموافقة على طلب المدرّب.',
    variables: [{ key: 'applicantName', label: 'Applicant name', example: 'Dr. Sara Al-Qahtani' }],
    defaultSubjectEn: 'Your application is approved',
    defaultSubjectAr: 'تمت الموافقة على طلبك',
  },
  {
    eventKey: 'application_rejected',
    channel: 'email',
    category: 'applications',
    nameEn: 'Application Rejected',
    nameAr: 'تم رفض الطلب',
    descriptionEn: 'Sent when an application is declined.',
    descriptionAr: 'يُرسَل عند رفض الطلب.',
    variables: [
      { key: 'applicantName', label: 'Applicant name', example: 'Dr. Sara Al-Qahtani' },
      { key: 'reason', label: 'Reason', example: 'Insufficient qualifications for the role.' },
    ],
    defaultSubjectEn: 'Application update',
    defaultSubjectAr: 'تحديث بشأن طلبك',
  },
  {
    eventKey: 'application_more_info',
    channel: 'email',
    category: 'applications',
    nameEn: 'Application — More Info Needed',
    nameAr: 'الطلب — مطلوب معلومات إضافية',
    descriptionEn: 'Sent when an admin asks an applicant to clarify or upload more documents.',
    descriptionAr: 'يُرسَل عند طلب توضيح أو وثائق إضافية من المتقدم.',
    variables: [
      { key: 'applicantName', label: 'Applicant name', example: 'Dr. Sara Al-Qahtani' },
      { key: 'reviewerMessage', label: 'Reviewer message', example: 'Please upload a scanned copy of your SCFHS license.' },
    ],
    defaultSubjectEn: 'Action required on your application',
    defaultSubjectAr: 'إجراء مطلوب على طلبك',
  },
  {
    eventKey: 'new_application_admin',
    channel: 'email',
    category: 'applications',
    nameEn: 'New Application (Admin)',
    nameAr: 'طلب جديد (للمدير)',
    descriptionEn: 'Internal alert to admins when a new instructor application is submitted.',
    descriptionAr: 'تنبيه داخلي للمدراء عند تقديم طلب مدرّب جديد.',
    variables: [
      { key: 'applicantName', label: 'Applicant name', example: 'Dr. Sara Al-Qahtani' },
      { key: 'applicationUrl', label: 'Review URL', example: 'https://physioguidance.org/en/dashboard/admin/role-requests/abc' },
    ],
    defaultSubjectEn: 'New instructor application',
    defaultSubjectAr: 'طلب مدرّب جديد',
  },

  // ─── Enrollment ──────────────────────────────────────────────
  {
    eventKey: 'enrollment_confirmation',
    channel: 'email',
    category: 'enrollment',
    nameEn: 'Enrollment Confirmation',
    nameAr: 'تأكيد التسجيل',
    descriptionEn: 'Sent immediately after a student is enrolled into a course.',
    descriptionAr: 'يُرسَل فور تسجيل الطالب في الدورة.',
    variables: [
      STUDENT_NAME,
      COURSE_NAME,
      { key: 'startDate', label: 'Course start date', example: 'Dec 24, 2026' },
      { key: 'instructorName', label: 'Instructor name', example: 'Dr. Sara Al-Qahtani' },
    ],
    defaultSubjectEn: "You're enrolled — {{courseName}}",
    defaultSubjectAr: 'تم تسجيلك — {{courseName}}',
  },

  // ─── Sessions ────────────────────────────────────────────────
  {
    eventKey: 'session_scheduled',
    channel: 'email',
    category: 'sessions',
    nameEn: 'Session Scheduled',
    nameAr: 'تم جدولة الجلسة',
    descriptionEn: 'Sent when a new live session is added to a course.',
    descriptionAr: 'يُرسَل عند إضافة جلسة مباشرة جديدة إلى الدورة.',
    variables: [
      RECIPIENT_NAME,
      { key: 'sessionTitle', label: 'Session title', example: 'Module 3: ACL Rehabilitation' },
      COURSE_NAME,
      { key: 'scheduledAt', label: 'Date/time', example: 'Sat, Dec 24, 2026 6:00 PM (Riyadh Time)' },
    ],
  },
  {
    eventKey: 'session_reminder_5min',
    channel: 'email',
    category: 'sessions',
    nameEn: 'Session Reminder (5 min before)',
    nameAr: 'تذكير الجلسة (قبل 5 دقائق)',
    descriptionEn: 'Sent 5 minutes before a Zoom/hybrid session starts.',
    descriptionAr: 'يُرسَل قبل 5 دقائق من بدء الجلسة.',
    variables: [
      RECIPIENT_NAME,
      { key: 'sessionTitle', label: 'Session title', example: 'Module 3: ACL Rehabilitation' },
      COURSE_NAME,
      { key: 'scheduledAt', label: 'Date/time', example: 'Sat, Dec 24, 2026 6:00 PM (Riyadh Time)' },
      { key: 'durationMinutes', label: 'Duration (minutes)', example: '90' },
    ],
    defaultSubjectEn: 'Starting soon: {{sessionTitle}}',
    defaultSubjectAr: 'يبدأ قريباً: {{sessionTitle}}',
  },
  {
    eventKey: 'session_started',
    channel: 'email',
    category: 'sessions',
    nameEn: 'Session Started',
    nameAr: 'بدأت الجلسة',
    descriptionEn: 'Confirmation that a live session has gone live.',
    descriptionAr: 'تأكيد أن الجلسة بدأت بالفعل.',
    variables: [RECIPIENT_NAME, { key: 'sessionTitle', label: 'Session title', example: 'Module 3' }],
  },
  {
    eventKey: 'session_ended',
    channel: 'email',
    category: 'sessions',
    nameEn: 'Session Ended',
    nameAr: 'انتهت الجلسة',
    descriptionEn: 'Recording-ready notification once a session is over.',
    descriptionAr: 'إشعار جاهزية التسجيل بعد انتهاء الجلسة.',
    variables: [
      RECIPIENT_NAME,
      { key: 'sessionTitle', label: 'Session title', example: 'Module 3' },
      { key: 'recordingUrl', label: 'Recording URL', example: 'https://physioguidance.org/dashboard/student/sessions/abc/recording' },
    ],
  },
  {
    eventKey: 'session_cancelled',
    channel: 'email',
    category: 'sessions',
    nameEn: 'Session Cancelled',
    nameAr: 'تم إلغاء الجلسة',
    descriptionEn: 'Sent when an instructor cancels a scheduled session.',
    descriptionAr: 'يُرسَل عند إلغاء المدرّب لجلسة مجدولة.',
    variables: [
      RECIPIENT_NAME,
      { key: 'sessionTitle', label: 'Session title', example: 'Module 3' },
      { key: 'reason', label: 'Reason', example: 'Instructor unavailable.' },
    ],
  },
  {
    eventKey: 'ta_assignment',
    channel: 'email',
    category: 'sessions',
    nameEn: 'TA Assignment',
    nameAr: 'تعيين مساعد مدرّب',
    descriptionEn: 'Sent to a TA when they are assigned to a course/session.',
    descriptionAr: 'يُرسَل للمساعد عند تعيينه لدورة/جلسة.',
    variables: [
      RECIPIENT_NAME,
      COURSE_NAME,
      { key: 'instructorName', label: 'Instructor name', example: 'Dr. Sara Al-Qahtani' },
    ],
  },
  {
    eventKey: 'ta_rejection',
    channel: 'email',
    category: 'sessions',
    nameEn: 'TA Rejection',
    nameAr: 'رفض المساعد',
    descriptionEn: 'Sent when a TA assignment is withdrawn.',
    descriptionAr: 'يُرسَل عند سحب تعيين المساعد.',
    variables: [RECIPIENT_NAME, COURSE_NAME, { key: 'reason', label: 'Reason', example: 'Schedule conflict.' }],
  },

  // ─── Webinars ────────────────────────────────────────────────
  {
    eventKey: 'webinar_registration_setup',
    channel: 'email',
    category: 'webinars',
    nameEn: 'Webinar Registration Setup',
    nameAr: 'إعداد تسجيل الندوة',
    descriptionEn: 'Sent to a paid-webinar enrollee with their personal Zoom join link.',
    descriptionAr: 'يُرسَل للمسجّل في ندوة مدفوعة مع رابط Zoom الشخصي.',
    variables: [STUDENT_NAME, COURSE_NAME, { key: 'joinLink', label: 'Personal join link', example: 'https://zoom.us/j/…' }],
  },
  {
    eventKey: 'webinar_live',
    channel: 'email',
    category: 'webinars',
    nameEn: 'Webinar Live',
    nameAr: 'الندوة مباشرة الآن',
    descriptionEn: 'Sent when a webinar starts broadcasting.',
    descriptionAr: 'يُرسَل عند بدء بث الندوة.',
    variables: [RECIPIENT_NAME, { key: 'webinarTitle', label: 'Webinar title', example: 'Knee Rehab Live' }],
  },
  {
    eventKey: 'webinar_paid_enrollment_nudge',
    channel: 'email',
    category: 'webinars',
    nameEn: 'Webinar — Paid Enrollment Nudge',
    nameAr: 'تذكير التسجيل في الندوة المدفوعة',
    descriptionEn: 'Follow-up to people who started but didn\'t complete paid webinar checkout.',
    descriptionAr: 'متابعة للأشخاص الذين بدأوا ولم يُكملوا الدفع.',
    variables: [RECIPIENT_NAME, COURSE_NAME, { key: 'courseUrl', label: 'Course URL', example: 'https://physioguidance.org/en/courses/knee-rehab' }],
  },

  // ─── Certificates ────────────────────────────────────────────
  {
    eventKey: 'certificate_approved',
    channel: 'email',
    category: 'certificates',
    nameEn: 'Certificate Approved',
    nameAr: 'تمت الموافقة على الشهادة',
    descriptionEn: 'Sent when a certificate request is approved and the PDF is ready.',
    descriptionAr: 'يُرسَل عند الموافقة على طلب الشهادة وجاهزية ملف PDF.',
    variables: [
      STUDENT_NAME,
      COURSE_NAME,
      { key: 'certificateId', label: 'Certificate ID', example: 'PG-A1B2C3D4E5F6G7H8' },
      { key: 'downloadUrl', label: 'Download URL', example: 'https://physioguidance.org/en/dashboard/student/certificates/PG-…' },
    ],
    defaultSubjectEn: 'Your certificate is ready',
    defaultSubjectAr: 'شهادتك جاهزة',
  },
  {
    eventKey: 'certificate_rejected',
    channel: 'email',
    category: 'certificates',
    nameEn: 'Certificate Rejected',
    nameAr: 'تم رفض الشهادة',
    descriptionEn: 'Sent when a certificate request is declined.',
    descriptionAr: 'يُرسَل عند رفض طلب الشهادة.',
    variables: [STUDENT_NAME, COURSE_NAME, { key: 'reason', label: 'Reason', example: 'Attendance below 75% threshold.' }],
  },
  {
    eventKey: 'certificate_held',
    channel: 'email',
    category: 'certificates',
    nameEn: 'Certificate Held',
    nameAr: 'الشهادة معلّقة',
    descriptionEn: 'Sent when a certificate is placed on hold pending review.',
    descriptionAr: 'يُرسَل عند تعليق الشهادة بانتظار المراجعة.',
    variables: [STUDENT_NAME, COURSE_NAME, { key: 'reason', label: 'Reason', example: 'Awaiting accreditation body approval.' }],
  },

  // ─── Assessments / Content ───────────────────────────────────
  {
    eventKey: 'assessment_submitted',
    channel: 'email',
    category: 'assessments',
    nameEn: 'Assessment Submitted',
    nameAr: 'تم تسليم التقييم',
    descriptionEn: 'Confirmation that an assessment was submitted for grading.',
    descriptionAr: 'تأكيد تسليم التقييم للتصحيح.',
    variables: [STUDENT_NAME, { key: 'assessmentTitle', label: 'Assessment title', example: 'Midterm Quiz' }, COURSE_NAME],
  },
  {
    eventKey: 'retake_granted',
    channel: 'email',
    category: 'assessments',
    nameEn: 'Retake Granted',
    nameAr: 'مُنح حق إعادة المحاولة',
    descriptionEn: 'Sent when a manager grants a student a retake.',
    descriptionAr: 'يُرسَل عند منح المدير الطالب فرصة إعادة.',
    variables: [
      STUDENT_NAME,
      { key: 'assessmentTitle', label: 'Assessment title', example: 'Midterm Quiz' },
      COURSE_NAME,
      { key: 'reason', label: 'Reason', example: 'Documented illness during first attempt.' },
      { key: 'newDueDate', label: 'New due date', example: 'Dec 31, 2026 11:59 PM' },
    ],
  },
  {
    eventKey: 'time_extension_granted',
    channel: 'email',
    category: 'assessments',
    nameEn: 'Time Extension Granted',
    nameAr: 'مُنح تمديد الوقت',
    descriptionEn: 'Sent when an assessment deadline is extended for a student.',
    descriptionAr: 'يُرسَل عند تمديد موعد التقييم للطالب.',
    variables: [
      STUDENT_NAME,
      { key: 'assessmentTitle', label: 'Assessment title', example: 'Midterm Quiz' },
      { key: 'newDueDate', label: 'New due date', example: 'Dec 31, 2026 11:59 PM' },
    ],
  },
  {
    eventKey: 'at_risk_reminder',
    channel: 'email',
    category: 'assessments',
    nameEn: 'At-Risk Reminder',
    nameAr: 'تذكير الطلاب المعرّضين للخطر',
    descriptionEn: 'Weekly nudge to students whose attendance or scores are below threshold.',
    descriptionAr: 'تذكير أسبوعي للطلاب ذوي الحضور أو الدرجات المتدنية.',
    variables: [STUDENT_NAME, COURSE_NAME, { key: 'risk', label: 'Risk reason', example: 'Attendance below 50%' }],
  },
  {
    eventKey: 'content_pending_review',
    channel: 'email',
    category: 'content',
    nameEn: 'Content — Pending Review',
    nameAr: 'محتوى بانتظار المراجعة',
    descriptionEn: 'Notification to the manager that new course content was submitted.',
    descriptionAr: 'إشعار للمدير بأن محتوى دورة جديد قد قُدّم.',
    variables: [
      { key: 'instructorName', label: 'Instructor name', example: 'Dr. Sara Al-Qahtani' },
      COURSE_NAME,
      { key: 'reviewUrl', label: 'Review URL', example: 'https://physioguidance.org/en/dashboard/manager/courses/abc/review' },
    ],
  },
  {
    eventKey: 'content_review',
    channel: 'email',
    category: 'content',
    nameEn: 'Content Review Outcome',
    nameAr: 'نتيجة مراجعة المحتوى',
    descriptionEn: 'Sent to the instructor with approve/reject feedback from the manager.',
    descriptionAr: 'يُرسَل للمدرّب بنتيجة الموافقة أو الرفض من المدير.',
    variables: [
      { key: 'instructorName', label: 'Instructor name', example: 'Dr. Sara Al-Qahtani' },
      COURSE_NAME,
      { key: 'outcome', label: 'Outcome', example: 'Approved' },
      { key: 'feedback', label: 'Feedback', example: 'Looks great. Just rename module 2.' },
    ],
  },
  {
    eventKey: 'review_pending_approval',
    channel: 'email',
    category: 'content',
    nameEn: 'Review — Pending Approval',
    nameAr: 'مراجعة بانتظار الموافقة',
    descriptionEn: 'Sent when a review needs admin sign-off before going public.',
    descriptionAr: 'يُرسَل عند الحاجة لموافقة المدير قبل نشر المراجعة.',
    variables: [
      { key: 'reviewerName', label: 'Reviewer name', example: 'Mona Al-Harbi' },
      COURSE_NAME,
      { key: 'reviewSnippet', label: 'Review snippet', example: 'Excellent practical examples…' },
    ],
  },

  // ─── WhatsApp ────────────────────────────────────────────────
  {
    eventKey: 'whatsapp_webinar_share',
    channel: 'whatsapp',
    category: 'whatsapp',
    nameEn: 'Webinar Share (free)',
    nameAr: 'مشاركة الندوة (مجاني)',
    descriptionEn:
      'Bilingual message a manager copy-pastes when inviting outsiders to a free webinar via WhatsApp. Includes the public Zoom registration URL.',
    descriptionAr:
      'رسالة ثنائية اللغة يستخدمها المدير لدعوة الزوار إلى ندوة مجانية عبر واتساب. تتضمن رابط تسجيل Zoom العام.',
    variables: [
      { key: 'title', label: 'Webinar title', example: 'Knee Injury Workshop' },
      COURSE_NAME,
      { key: 'scheduledAt', label: 'Date/time (Riyadh)', example: 'Dec 24, 2026 6:00 PM' },
      { key: 'registrationUrl', label: 'Registration URL', example: 'https://zoom.us/webinar/register/…' },
      { key: 'zoomWebinarId', label: 'Zoom webinar ID', example: '845 1234 5678' },
      { key: 'supportPhone', label: 'Support phone', example: '0555614285' },
    ],
  },
  {
    eventKey: 'whatsapp_paid_course_share',
    channel: 'whatsapp',
    category: 'whatsapp',
    nameEn: 'Paid Course Share',
    nameAr: 'مشاركة دورة مدفوعة',
    descriptionEn:
      'Bilingual message for paid Webinar Courses — points to the public course page so outsiders go through checkout before getting the Zoom link.',
    descriptionAr:
      'رسالة ثنائية اللغة للدورات المدفوعة — توجّه إلى صفحة الدورة العامة ليُكمل الزوار الدفع قبل استلام رابط Zoom.',
    variables: [
      { key: 'webinarTitle', label: 'Webinar title', example: 'Knee Rehabilitation Course' },
      COURSE_NAME,
      { key: 'scheduledAt', label: 'Date/time (Riyadh)', example: 'Dec 24, 2026 6:00 PM' },
      { key: 'courseUrl', label: 'Course page URL', example: 'https://physioguidance.org/en/courses/knee-rehab' },
      { key: 'supportPhone', label: 'Support phone', example: '0555614285' },
    ],
  },
  // ─── Payments ────────────────────────────────────────────────
  {
    eventKey: 'payment_confirmation',
    channel: 'email',
    category: 'payments',
    nameEn: 'Payment Confirmation',
    nameAr: 'تأكيد الدفع',
    descriptionEn: 'Sent to the buyer after a successful payment. Invoice PDF attached.',
    descriptionAr: 'يُرسَل إلى المشتري بعد نجاح الدفع مع إرفاق فاتورة PDF.',
    variables: [
      STUDENT_NAME,
      COURSE_NAME,
      { key: 'amount', label: 'Amount', example: '515.00' },
      { key: 'currency', label: 'Currency', example: 'SAR' },
      { key: 'invoiceNumber', label: 'Invoice number', example: 'INV-2026-00050' },
      { key: 'gateway', label: 'Gateway', example: 'Moyasar' },
      { key: 'transactionId', label: 'Transaction ID', example: '321d8523-2a88…' },
    ],
    defaultSubjectEn: 'Payment Confirmed - {courseName}',
    defaultSubjectAr: 'تم تأكيد الدفع - {courseName}',
  },
  {
    eventKey: 'payment_failed',
    channel: 'email',
    category: 'payments',
    nameEn: 'Payment Failed',
    nameAr: 'فشل الدفع',
    descriptionEn: 'Sent when a payment attempt is declined by the gateway.',
    descriptionAr: 'يُرسَل عند فشل محاولة الدفع من قِبل بوابة الدفع.',
    variables: [
      STUDENT_NAME,
      COURSE_NAME,
      { key: 'amount', label: 'Amount', example: '515.00' },
      { key: 'currency', label: 'Currency', example: 'SAR' },
    ],
    defaultSubjectEn: 'Payment Failed - {courseName}',
    defaultSubjectAr: 'فشل الدفع - {courseName}',
  },
  {
    eventKey: 'bank_transfer_received',
    channel: 'email',
    category: 'payments',
    nameEn: 'Bank Transfer Receipt Received',
    nameAr: 'تم استلام إيصال التحويل البنكي',
    descriptionEn: 'Sent immediately after the buyer uploads a bank transfer receipt for finance review.',
    descriptionAr: 'يُرسَل مباشرة بعد أن يرفع المشتري إيصال التحويل البنكي للمراجعة.',
    variables: [
      STUDENT_NAME,
      COURSE_NAME,
      { key: 'amount', label: 'Amount', example: '515.00' },
      { key: 'currency', label: 'Currency', example: 'SAR' },
      { key: 'paymentId', label: 'Payment reference', example: 'PAY-9d02…' },
      { key: 'uploadedAt', label: 'Upload time', example: '2026-07-23 22:13 UTC' },
    ],
    defaultSubjectEn: 'Bank Transfer Receipt Received',
    defaultSubjectAr: 'تم استلام إيصال التحويل البنكي',
  },
  {
    eventKey: 'bank_transfer_rejected',
    channel: 'email',
    category: 'payments',
    nameEn: 'Bank Transfer Rejected',
    nameAr: 'تم رفض التحويل البنكي',
    descriptionEn: 'Sent when finance rejects a bank transfer receipt — includes reviewer notes + a re-upload link.',
    descriptionAr: 'يُرسَل عند رفض إيصال التحويل البنكي مع ملاحظات المراجع ورابط لإعادة الرفع.',
    variables: [
      STUDENT_NAME,
      COURSE_NAME,
      { key: 'amount', label: 'Amount', example: '515.00' },
      { key: 'currency', label: 'Currency', example: 'SAR' },
      { key: 'paymentId', label: 'Payment reference', example: 'PAY-9d02…' },
      { key: 'reviewerNote', label: 'Reviewer note', example: 'Amount on receipt does not match invoice.' },
      { key: 'uploadUrl', label: 'Re-upload URL', example: 'https://physioguidance.org/en/payment/bank-transfer/PAY-9d02' },
    ],
    defaultSubjectEn: 'Bank Transfer Rejected — Action Required',
    defaultSubjectAr: 'تم رفض التحويل البنكي — مطلوب إجراء',
  },
  {
    eventKey: 'refund_requested',
    channel: 'email',
    category: 'payments',
    nameEn: 'Refund Request Received',
    nameAr: 'تم استلام طلب الاسترداد',
    descriptionEn: 'Sent when a learner opens a refund request. Sets expectations of a 3–5 business day review.',
    descriptionAr: 'يُرسَل عند فتح طلب الاسترداد. يوضح مدة المراجعة (3–5 أيام عمل).',
    variables: [
      STUDENT_NAME,
      { key: 'amount', label: 'Refund amount', example: '515.00' },
      { key: 'currency', label: 'Currency', example: 'SAR' },
    ],
    defaultSubjectEn: 'Refund Request Received',
    defaultSubjectAr: 'تم استلام طلب الاسترداد',
  },
  {
    eventKey: 'refund_approved',
    channel: 'email',
    category: 'payments',
    nameEn: 'Refund Approved',
    nameAr: 'تمت الموافقة على الاسترداد',
    descriptionEn: 'Sent when finance approves the refund. Includes an ETA for funds to arrive.',
    descriptionAr: 'يُرسَل عند الموافقة على الاسترداد مع الوقت المتوقع لوصول الأموال.',
    variables: [
      STUDENT_NAME,
      { key: 'amount', label: 'Refund amount', example: '515.00' },
      { key: 'currency', label: 'Currency', example: 'SAR' },
    ],
    defaultSubjectEn: 'Refund Approved',
    defaultSubjectAr: 'تمت الموافقة على الاسترداد',
  },
  {
    eventKey: 'refund_rejected',
    channel: 'email',
    category: 'payments',
    nameEn: 'Refund Request Not Approved',
    nameAr: 'لم تتم الموافقة على الاسترداد',
    descriptionEn: 'Sent when finance declines a refund request with a reason.',
    descriptionAr: 'يُرسَل عند رفض طلب الاسترداد مع ذكر السبب.',
    variables: [
      STUDENT_NAME,
      { key: 'rejectionNote', label: 'Rejection reason', example: 'Course was fully completed before the request date.' },
    ],
    defaultSubjectEn: 'Refund Request Update',
    defaultSubjectAr: 'تحديث طلب الاسترداد',
  },
  {
    eventKey: 'refund_completed',
    channel: 'email',
    category: 'payments',
    nameEn: 'Refund Completed',
    nameAr: 'اكتمل الاسترداد',
    descriptionEn: 'Sent when funds are released. Shows the original amount, deductions, and final refunded total.',
    descriptionAr: 'يُرسَل عند إتمام الاسترداد. يعرض المبلغ الأصلي والخصومات والمبلغ النهائي.',
    variables: [
      STUDENT_NAME,
      { key: 'originalAmount', label: 'Original amount', example: '515.00' },
      { key: 'deductionAmount', label: 'Deduction', example: '15.00' },
      { key: 'refundAmount', label: 'Refunded amount', example: '500.00' },
      { key: 'currency', label: 'Currency', example: 'SAR' },
    ],
    defaultSubjectEn: 'Refund Completed',
    defaultSubjectAr: 'اكتمل الاسترداد',
  },

  // ─── Support (customer-facing) ───────────────────────────────
  {
    eventKey: 'ticket_created_learner',
    channel: 'email',
    category: 'support',
    nameEn: 'Support Ticket Created',
    nameAr: 'تم إنشاء تذكرة الدعم',
    descriptionEn: 'Confirmation sent to the learner when they open a support ticket.',
    descriptionAr: 'يُرسَل إلى المتعلم عند فتحه تذكرة دعم.',
    variables: [
      { key: 'learnerName', label: 'Learner name', example: 'Ahmed Al-Otaibi' },
      { key: 'ticketRef', label: 'Ticket ID', example: 'TKT-2026-1042' },
      { key: 'expectedResponse', label: 'Expected response', example: '4 hours' },
    ],
    defaultSubjectEn: 'Ticket Received #{ticketRef}',
    defaultSubjectAr: 'تم استلام التذكرة #{ticketRef}',
  },
  {
    eventKey: 'ticket_reply_notification',
    channel: 'email',
    category: 'support',
    nameEn: 'Support Ticket Reply',
    nameAr: 'رد على تذكرة الدعم',
    descriptionEn: 'Sent to a learner or agent when a new public reply is posted on their ticket.',
    descriptionAr: 'يُرسَل عند إضافة رد جديد على التذكرة (لكل من المتعلم والوكيل).',
    variables: [
      { key: 'recipientName', label: 'Recipient name', example: 'Ahmed Al-Otaibi' },
      { key: 'senderName', label: 'Sender name', example: 'Sarah — Support' },
      { key: 'ticketRef', label: 'Ticket ID', example: 'TKT-2026-1042' },
      { key: 'messagePreview', label: 'Message preview', example: 'Thanks for the extra details — I can help with…' },
    ],
    defaultSubjectEn: 'New Reply on Ticket #{ticketRef}',
    defaultSubjectAr: 'رد جديد على التذكرة #{ticketRef}',
  },
  {
    eventKey: 'ticket_resolved',
    channel: 'email',
    category: 'support',
    nameEn: 'Ticket Resolved',
    nameAr: 'تم حل التذكرة',
    descriptionEn: 'Sent when a support ticket is marked as resolved. Includes inline star rating + reopen CTA.',
    descriptionAr: 'يُرسَل عند تحديد التذكرة كمحلولة، مع تقييم بالنجوم وإمكانية إعادة الفتح.',
    variables: [
      { key: 'learnerName', label: 'Learner name', example: 'Ahmed Al-Otaibi' },
      { key: 'ticketRef', label: 'Ticket ID', example: 'TKT-2026-1042' },
    ],
    defaultSubjectEn: 'Your ticket #{ticketRef} has been resolved',
    defaultSubjectAr: 'تم حل تذكرتك #{ticketRef}',
  },
  {
    eventKey: 'ticket_closed',
    channel: 'email',
    category: 'support',
    nameEn: 'Ticket Closed',
    nameAr: 'تم إغلاق التذكرة',
    descriptionEn: 'Sent when a support ticket is finalized after resolution — a closed ticket cannot be reopened.',
    descriptionAr: 'يُرسَل عند إغلاق التذكرة نهائياً — لا يمكن إعادة فتحها.',
    variables: [
      { key: 'learnerName', label: 'Learner name', example: 'Ahmed Al-Otaibi' },
      { key: 'ticketRef', label: 'Ticket ID', example: 'TKT-2026-1042' },
    ],
    defaultSubjectEn: 'Your ticket #{ticketRef} has been closed',
    defaultSubjectAr: 'تم إغلاق تذكرتك #{ticketRef}',
  },
  {
    eventKey: 'ticket_status_change',
    channel: 'email',
    category: 'support',
    nameEn: 'Ticket Status Update',
    nameAr: 'تحديث حالة التذكرة',
    descriptionEn: 'Generic status-change notification used for intermediate transitions (on-hold, reopened, etc.).',
    descriptionAr: 'إشعار عام لتحديث الحالة يُستخدم للانتقالات (موقوفة، أُعيد فتحها…).',
    variables: [
      { key: 'learnerName', label: 'Learner name', example: 'Ahmed Al-Otaibi' },
      { key: 'ticketRef', label: 'Ticket ID', example: 'TKT-2026-1042' },
      { key: 'newStatus', label: 'New status', example: 'In progress' },
      { key: 'reason', label: 'Reason (optional)', example: 'Assigned to a specialist' },
    ],
    defaultSubjectEn: 'Ticket #{ticketRef} status: {newStatus}',
    defaultSubjectAr: 'حالة التذكرة #{ticketRef}: {newStatus}',
  },

  // ─── CSAT ───────────────────────────────────────────────────
  {
    eventKey: 'csat_survey',
    channel: 'email',
    category: 'csat',
    nameEn: 'CSAT Survey',
    nameAr: 'استبيان رضا العملاء',
    descriptionEn: 'Post-resolution satisfaction survey. Star buttons deep-link into the public CSAT page.',
    descriptionAr: 'استبيان الرضا بعد حل التذكرة. أزرار النجوم مرتبطة مباشرة بصفحة الاستبيان.',
    variables: [
      { key: 'learnerName', label: 'Learner name', example: 'Ahmed Al-Otaibi' },
      { key: 'ticketRef', label: 'Ticket ID', example: 'TKT-2026-1042' },
      { key: 'surveyId', label: 'Survey ID', example: 'SVY-9c8a…' },
    ],
    defaultSubjectEn: 'How did we do? — {ticketRef}',
    defaultSubjectAr: 'كيف كان أداؤنا؟ — {ticketRef}',
  },
  {
    eventKey: 'csat_followup',
    channel: 'email',
    category: 'csat',
    nameEn: 'CSAT Low-Score Followup',
    nameAr: 'متابعة تقييم منخفض',
    descriptionEn: 'Sent after a learner submits a ≤3 star rating — invites them to reopen the ticket or contact support.',
    descriptionAr: 'يُرسَل بعد تقييم منخفض (≤3 نجوم) لدعوة المتعلم للتواصل مع الدعم.',
    variables: [
      { key: 'learnerName', label: 'Learner name', example: 'Ahmed Al-Otaibi' },
      { key: 'ticketRef', label: 'Ticket ID', example: 'TKT-2026-1042' },
      { key: 'score', label: 'Rating (1-5)', example: '2' },
    ],
    defaultSubjectEn: "We're Sorry",
    defaultSubjectAr: 'نعتذر منك',
  },
];

export function findTemplateMeta(eventKey: string): TemplateMeta | undefined {
  return TEMPLATE_REGISTRY.find((tpl) => tpl.eventKey === eventKey);
}
