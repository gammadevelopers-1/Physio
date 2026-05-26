/**
 * Resolve the default HTML body for a template that has no admin
 * override yet. Each entry calls the corresponding email/* template
 * function with `{{variableName}}` placeholders for every dynamic
 * field, so the admin opens the editor and sees the exact branded
 * markup the platform would normally send — with merge tags visible
 * and ready to tweak.
 *
 * If an entry is missing or the renderer throws, callers fall back
 * to an empty body string (which the canvas-prefill on the admin
 * side already handles by showing a blank slate).
 */
import { getOtpEmailHtml } from '../email/templates/otp.template';
import { getPasswordResetHtml } from '../email/templates/password-reset.template';
import { getApplicationApprovedSetPasswordHtml } from '../email/templates/application-approved-set-password.template';
import { getApplicationApprovedHtml } from '../email/templates/application-approved.template';
import { getApplicationRejectedHtml } from '../email/templates/application-rejected.template';
import { getApplicationMoreInfoHtml } from '../email/templates/application-more-info.template';
import { getNewApplicationAdminHtml } from '../email/templates/new-application-admin.template';
import { getEnrollmentConfirmationHtml } from '../email/templates/enrollment-confirmation.template';
import { getSessionScheduledHtml } from '../email/templates/session-scheduled.template';
import { getSessionReminderHtml } from '../email/templates/session-reminder.template';
import { getSessionStartedHtml } from '../email/templates/session-started.template';
import { getSessionEndedHtml } from '../email/templates/session-ended.template';
import { getSessionCancelledHtml } from '../email/templates/session-cancelled.template';
import { getTaAssignmentHtml } from '../email/templates/ta-assignment.template';
import { getTaRejectionHtml } from '../email/templates/ta-rejection.template';
import { getWebinarRegistrationSetupHtml } from '../email/templates/webinar-registration-setup.template';
import { getWebinarLiveHtml } from '../email/templates/webinar-live.template';
import { getWebinarPaidEnrollmentNudgeHtml } from '../email/templates/webinar-paid-enrollment-nudge.template';
import { getCertificateApprovedHtml } from '../email/templates/certificate-approved.template';
import { getCertificateRejectedHtml } from '../email/templates/certificate-rejected.template';
import { getCertificateHeldHtml } from '../email/templates/certificate-held.template';
import { getAssessmentSubmittedHtml } from '../email/templates/assessment-submitted.template';
import { getRetakeGrantedHtml } from '../email/templates/retake-granted.template';
import { getTimeExtensionGrantedHtml } from '../email/templates/time-extension-granted.template';
import { getAtRiskReminderHtml } from '../email/templates/at-risk-reminder.template';
import { getContentPendingReviewHtml } from '../email/templates/content-pending-review.template';
import { getContentReviewHtml } from '../email/templates/content-review.template';
import { getReviewPendingApprovalHtml } from '../email/templates/review-pending-approval.template';

type Locale = 'en' | 'ar';
type Renderer = (locale: Locale) => string;

// Helper — every placeholder evaluates to its `{{key}}` literal so
// the rendered HTML contains visible merge tags the admin can
// re-arrange without losing the variable wiring. Casting numeric
// params via `as never` is fine: the receiving templates only
// interpolate them into HTML strings.
const P = (key: string) => `{{${key}}}`;

const RENDERERS: Record<string, Renderer | undefined> = {
  // ── Account ──────────────────────────────────────────────────
  otp: (locale) =>
    getOtpEmailHtml(P('code'), P('recipientName'), locale, 10),

  password_reset: (locale) => getPasswordResetHtml(P('code'), locale),

  application_approved_set_password: (locale) =>
    getApplicationApprovedSetPasswordHtml(
      P('recipientName'),
      P('setupUrl'),
      locale,
    ),

  // ── Applications ─────────────────────────────────────────────
  application_approved: (locale) =>
    getApplicationApprovedHtml(P('applicantName'), locale),

  application_rejected: (locale) =>
    getApplicationRejectedHtml(P('applicantName'), P('reason'), locale),

  application_more_info: (locale) =>
    getApplicationMoreInfoHtml(P('applicantName'), P('reviewerMessage'), locale),

  new_application_admin: (locale) =>
    getNewApplicationAdminHtml(P('applicantName'), P('applicantEmail'), locale),

  // ── Enrollment ───────────────────────────────────────────────
  enrollment_confirmation: (locale) =>
    getEnrollmentConfirmationHtml(
      {
        studentName: P('studentName'),
        courseName: P('courseName'),
        startDate: P('startDate'),
        instructorName: P('instructorName'),
      },
      locale,
    ),

  // ── Sessions ─────────────────────────────────────────────────
  session_scheduled: (locale) =>
    getSessionScheduledHtml(
      {
        recipientName: P('recipientName'),
        sessionTitle: P('sessionTitle'),
        courseName: P('courseName'),
        scheduledDate: P('scheduledDate'),
        sessionType: 'zoom',
        zoomLink: null,
      },
      locale,
    ),

  session_reminder_5min: (locale) =>
    getSessionReminderHtml(
      {
        recipientName: P('recipientName'),
        sessionTitle: P('sessionTitle'),
        courseName: P('courseName'),
        scheduledAt: P('scheduledAt'),
        durationMinutes: 60,
        zoomLink: null,
        isInstructor: false,
      },
      locale,
    ),

  session_started: (locale) =>
    getSessionStartedHtml(
      {
        recipientName: P('recipientName'),
        sessionTitle: P('sessionTitle'),
        courseName: P('courseName'),
        zoomLink: null,
      },
      locale,
    ),

  session_ended: (locale) =>
    getSessionEndedHtml(
      {
        recipientName: P('recipientName'),
        sessionTitle: P('sessionTitle'),
        courseName: P('courseName'),
      },
      locale,
    ),

  session_cancelled: (locale) =>
    getSessionCancelledHtml(
      {
        recipientName: P('recipientName'),
        sessionTitle: P('sessionTitle'),
        courseName: P('courseName'),
        cancelReason: P('cancelReason'),
      },
      locale,
    ),

  ta_assignment: (locale) =>
    getTaAssignmentHtml(
      {
        recipientName: P('recipientName'),
        sessionTitle: P('sessionTitle'),
        courseName: P('courseName'),
        scheduledAt: P('scheduledAt'),
        durationMinutes: 60,
        instructorName: P('instructorName'),
        isAutoAssigned: false,
      },
      locale,
    ),

  ta_rejection: (locale) =>
    getTaRejectionHtml(
      {
        recipientName: P('recipientName'),
        courseName: P('courseName'),
        taName: P('taName'),
        rejectionReason: P('rejectionReason'),
      },
      locale,
    ),

  // ── Webinars ─────────────────────────────────────────────────
  webinar_registration_setup: (locale) =>
    getWebinarRegistrationSetupHtml(
      P('registrantName'),
      P('courseTitle'),
      P('setupUrl'),
      locale,
    ),

  webinar_live: (locale) =>
    getWebinarLiveHtml(
      {
        recipientName: P('recipientName'),
        webinarTitle: P('webinarTitle'),
        courseName: P('courseName'),
        personalJoinUrl: P('personalJoinUrl'),
      },
      locale,
    ),

  webinar_paid_enrollment_nudge: (locale) =>
    getWebinarPaidEnrollmentNudgeHtml(
      P('registrantName'),
      P('courseTitle'),
      P('courseUrl'),
      locale,
    ),

  // ── Certificates ─────────────────────────────────────────────
  certificate_approved: (locale) =>
    getCertificateApprovedHtml(
      P('studentName'),
      P('courseName'),
      P('downloadUrl'),
      locale,
    ),

  certificate_rejected: (locale) =>
    getCertificateRejectedHtml(
      P('studentName'),
      P('courseName'),
      P('rejectionReason'),
      locale,
    ),

  certificate_held: (locale) =>
    getCertificateHeldHtml(
      P('studentName'),
      P('courseName'),
      P('reviewNote'),
      locale,
    ),

  // ── Assessments ──────────────────────────────────────────────
  assessment_submitted: (locale) =>
    getAssessmentSubmittedHtml(
      {
        instructorName: P('instructorName'),
        studentName: P('studentName'),
        assessmentTitle: P('assessmentTitle'),
        assessmentType: P('assessmentType'),
        courseName: P('courseName'),
      },
      locale,
    ),

  retake_granted: (locale) =>
    getRetakeGrantedHtml(
      {
        studentName: P('studentName'),
        assessmentTitle: P('assessmentTitle'),
        courseName: P('courseName'),
        reason: P('reason'),
        newDueDate: P('newDueDate'),
      },
      locale,
    ),

  time_extension_granted: (locale) =>
    getTimeExtensionGrantedHtml(
      {
        studentName: P('studentName'),
        assessmentTitle: P('assessmentTitle'),
        courseName: P('courseName'),
        minutes: 30 as never,
        reason: P('reason'),
      },
      locale,
    ),

  at_risk_reminder: (locale) =>
    getAtRiskReminderHtml(P('studentName'), P('courseName'), P('customMessage'), locale),

  // ── Content review (manager + instructor flow) ───────────────
  content_pending_review: (locale) =>
    getContentPendingReviewHtml(
      {
        recipientName: P('recipientName'),
        materialTitle: P('materialTitle'),
        courseName: P('courseName'),
        instructorName: P('instructorName'),
        wcagStatus: P('wcagStatus'),
        wcagSummary: P('wcagSummary'),
      },
      locale,
    ),

  content_review: (locale) =>
    getContentReviewHtml(
      {
        recipientName: P('recipientName'),
        materialTitle: P('materialTitle'),
        courseName: P('courseName'),
        decision: 'approved',
        comment: P('comment'),
      },
      locale,
    ),

  review_pending_approval: (locale) =>
    getReviewPendingApprovalHtml(
      {
        recipientName: P('recipientName'),
        studentName: P('studentName'),
        courseName: P('courseName'),
        rating: 5,
        reviewText: P('reviewText'),
        dashboardUrl: P('dashboardUrl'),
      },
      locale,
    ),
};

/**
 * Return the default rendered HTML body for an event + locale, or an
 * empty string if the eventKey isn't email-renderable (e.g. it's a
 * WhatsApp template, or the renderer threw).
 */
export function renderDefaultEmailBody(
  eventKey: string,
  locale: 'en' | 'ar',
): string {
  const fn = RENDERERS[eventKey];
  if (!fn) return '';
  try {
    return fn(locale);
  } catch {
    return '';
  }
}
