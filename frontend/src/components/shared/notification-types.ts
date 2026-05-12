/**
 * Allowlist of notification types that are relevant to STUDENT users.
 *
 * The backend stores notifications with role-agnostic types in a single user_notifications
 * table; some types (course_assigned, content_pending_review, etc.) are written for
 * instructors/managers. This list keeps the student dashboard bell focused on events
 * a student would actually care about.
 *
 * Keep in sync with backend `userNotificationsService.create(...)` callsites that
 * use `recipientId: studentId`.
 */
export const STUDENT_NOTIFICATION_TYPES = [
  // Enrollment + course lifecycle
  "enrollment_confirmed",
  "course_enrolled",
  "course_completed",
  "course_auto_completed",

  // Assessments
  "assessment_published",
  "assessment_graded",
  "time_extension_granted",
  "retake_granted",

  // Sessions / lectures
  "session_scheduled",
  "session_started",
  "session_ended",
  "session_cancelled",
  "session_rescheduled",
  "session_attended",

  // Certificates
  "certificate_issued",
  "certificate_earned",
  "certificate_revoked",

  // Interventions (attendance warnings, makeup offers)
  "intervention_email",
  "intervention_makeup",

  // Points system
  "points_earned",
  "points_redeemed",

  // Generic system messages
  "system",
] as const;
