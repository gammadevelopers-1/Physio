import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../database';
import { users } from '../../database/schema';
import { userPreferences } from '../../database/schema/user-preferences';
import type { MissingRequirement } from '../../database/schema';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';
import { getOtpEmailHtml, getOtpEmailText } from './templates/otp.template';
import {
  getApplicationApprovedHtml,
  getApplicationApprovedText,
} from './templates/application-approved.template';
import {
  getApplicationApprovedSetPasswordHtml,
  getApplicationApprovedSetPasswordText,
} from './templates/application-approved-set-password.template';
import {
  getAdminAccountInviteHtml,
  getAdminAccountInviteText,
} from './templates/admin-account-invite.template';
import {
  getWebinarRegistrationSetupHtml,
  getWebinarRegistrationSetupText,
} from './templates/webinar-registration-setup.template';
import {
  getWebinarPaidEnrollmentNudgeHtml,
  getWebinarPaidEnrollmentNudgeText,
} from './templates/webinar-paid-enrollment-nudge.template';
import {
  getApplicationRejectedHtml,
  getApplicationRejectedText,
} from './templates/application-rejected.template';
import {
  getApplicationMoreInfoHtml,
  getApplicationMoreInfoText,
} from './templates/application-more-info.template';
import {
  getNewApplicationAdminHtml,
  getNewApplicationAdminText,
} from './templates/new-application-admin.template';
import {
  getAtRiskReminderHtml,
  getAtRiskReminderText,
} from './templates/at-risk-reminder.template';
import {
  getSessionReminderHtml,
  getSessionReminderText,
} from './templates/session-reminder.template';
import {
  getCertificateApprovedHtml,
  getCertificateApprovedText,
} from './templates/certificate-approved.template';
import {
  getCertificateRejectedHtml,
  getCertificateRejectedText,
} from './templates/certificate-rejected.template';
import {
  getCertificateHeldHtml,
  getCertificateHeldText,
} from './templates/certificate-held.template';
import {
  getTaAssignmentHtml,
  getTaAssignmentText,
} from './templates/ta-assignment.template';
import {
  getTaRejectionHtml,
  getTaRejectionText,
} from './templates/ta-rejection.template';
import {
  getSessionStartedHtml,
  getSessionStartedText,
} from './templates/session-started.template';
import {
  getWebinarLiveHtml,
  getWebinarLiveText,
} from './templates/webinar-live.template';
import {
  getSessionEndedHtml,
  getSessionEndedText,
} from './templates/session-ended.template';
import {
  getSessionCancelledHtml,
  getSessionCancelledText,
} from './templates/session-cancelled.template';
import {
  getCourseCancelledHtml,
  getCourseCancelledText,
  type CourseCancelRefundKind,
} from './templates/course-cancelled.template';
import {
  getContentReviewHtml,
  getContentReviewText,
} from './templates/content-review.template';
import {
  getContentPendingReviewHtml,
  getContentPendingReviewText,
} from './templates/content-pending-review.template';
import {
  getSessionScheduledHtml,
  getSessionScheduledText,
} from './templates/session-scheduled.template';
import {
  getAssessmentSubmittedHtml,
  getAssessmentSubmittedText,
} from './templates/assessment-submitted.template';
import {
  getRetakeGrantedHtml,
  getRetakeGrantedText,
  type RetakeGrantedParams,
} from './templates/retake-granted.template';
import {
  getTimeExtensionGrantedHtml,
  getTimeExtensionGrantedText,
  type TimeExtensionGrantedParams,
} from './templates/time-extension-granted.template';
import {
  getEnrollmentConfirmationHtml,
  getEnrollmentConfirmationText,
} from './templates/enrollment-confirmation.template';
import {
  getPasswordResetHtml,
  getPasswordResetText,
} from './templates/password-reset.template';
import {
  getReviewPendingApprovalHtml,
  getReviewPendingApprovalText,
} from './templates/review-pending-approval.template';
import {
  getCsatSurveyHtml,
  getCsatSurveyText,
} from './templates/csat-survey.template';
import {
  getCsatFollowupHtml,
  getCsatFollowupText,
} from './templates/csat-followup.template';
import {
  getTicketCreatedLearnerHtml,
  getTicketCreatedLearnerText,
} from './templates/ticket-created-learner.template';
import {
  getTicketAssignedAgentHtml,
  getTicketAssignedAgentText,
} from './templates/ticket-assigned-agent.template';
import {
  getTicketReplyHtml,
  getTicketReplyText,
} from './templates/ticket-reply-notification.template';
import {
  getSlaFrtBreachHtml,
  getSlaFrtBreachText,
} from './templates/sla-frt-breach.template';
import {
  getSlaTtrBreachHtml,
  getSlaTtrBreachText,
} from './templates/sla-ttr-breach.template';
import {
  getTicketResolvedHtml,
  getTicketResolvedText,
} from './templates/ticket-resolved.template';
import {
  getTicketClosedHtml,
  getTicketClosedText,
} from './templates/ticket-closed.template';
import {
  getTicketEscalationHtml,
  getTicketEscalationText,
} from './templates/ticket-escalation.template';
import {
  getTicketStatusChangeHtml,
  getTicketStatusChangeText,
} from './templates/ticket-status-change.template';
import {
  getReconciliationEscalationCreatedHtml,
  getReconciliationEscalationCreatedText,
} from './templates/reconciliation-escalation-created.template';
import {
  getReconciliationEscalationTransitionHtml,
  getReconciliationEscalationTransitionText,
} from './templates/reconciliation-escalation-transition.template';
import {
  getReconciliationDigestHtml,
  getReconciliationDigestText,
  type ReconciliationDigestParams,
} from './templates/reconciliation-digest.template';
import { EmailLocale, getEmailStrings, t, htmlAttrs } from './email-i18n';
import { TemplateResolverService } from '../templates/template-resolver.service';
import { findTemplateMeta } from '../templates/template-registry';
import { AdminSettingsService } from '../admin-settings/admin-settings.service';

// Payment-related template imports (from haseeb/payment-integration merge)
import {
  getPaymentConfirmationHtml,
  getPaymentConfirmationText,
} from './templates/payment-confirmation.template';
import {
  getPaymentFailedHtml,
  getPaymentFailedText,
} from './templates/payment-failed.template';
import {
  getBankTransferReceivedHtml,
  getBankTransferReceivedText,
} from './templates/bank-transfer-received.template';
import {
  getBankTransferRejectedHtml,
  getBankTransferRejectedText,
} from './templates/bank-transfer-rejected.template';
import {
  getTamaraStuckAlertHtml,
  getTamaraStuckAlertText,
  type TamaraStuckSeverity,
} from './templates/tamara-stuck-alert.template';
import {
  getRefundRequestedHtml,
  getRefundRequestedText,
  getRefundApprovedHtml,
  getRefundApprovedText,
  getRefundRejectedHtml,
  getRefundRejectedText,
  getRefundCompletedHtml,
  getRefundCompletedText,
} from './templates/refund-notification.template';
// `eq`, `db`, `users` already imported at the top of this file.
import {
  payments,
  invoices,
  refunds,
  courses,
  roles,
  userRoles,
} from '../../database/schema';

/**
 * Admin-toggleable categories. `account` is intentionally absent —
 * OTP, password reset, and set-password emails are always allowed
 * through regardless of admin toggles. They are security-critical.
 */
type ToggleableCategory =
  | 'applications'
  | 'enrollment'
  | 'sessions'
  | 'webinars'
  | 'certificates'
  | 'assessments'
  | 'content';

interface NotificationChannelsSettings {
  channels?: {
    email?: boolean;
    whatsapp?: boolean;
    emailCategories?: Partial<Record<ToggleableCategory, boolean>>;
  };
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private configService: ConfigService,
    private templateResolver: TemplateResolverService,
    private adminSettings: AdminSettingsService,
  ) {
    const resendApiKey = this.configService.get<string>('RESEND_API_KEY');

    if (resendApiKey) {
      // Production: use Resend
      this.resend = new Resend(resendApiKey);
      this.logger.log('Email configured → Resend API');
    } else {
      // Local dev: fall back to SMTP (Mailpit)
      const host = this.configService.get<string>('SMTP_HOST') || 'localhost';
      const port = parseInt(this.configService.get<string>('SMTP_PORT') || '1025', 10);
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: false,
      } as nodemailer.TransportOptions);
      this.logger.log(`Email configured → SMTP ${host}:${port} (dev)`);
    }
  }

  /**
   * Check if a user (by email) has email notifications enabled.
   * Returns true if no preferences exist (default ON) or any email pref is true.
   * System emails (OTP, password reset) bypass this check — only notification emails check.
   */
  async isEmailEnabled(email: string): Promise<boolean> {
    try {
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) return true; // Unknown user — send anyway

      const [prefs] = await db
        .select({
          emailNewStudent: userPreferences.emailNewStudent,
          emailCourseComplete: userPreferences.emailCourseComplete,
          emailAssessmentSubmit: userPreferences.emailAssessmentSubmit,
          emailCertificateRequest: userPreferences.emailCertificateRequest,
        })
        .from(userPreferences)
        .where(eq(userPreferences.userId, user.id))
        .limit(1);

      if (!prefs) return true; // No prefs row = defaults (all ON)

      return !!(prefs.emailNewStudent || prefs.emailCourseComplete || prefs.emailAssessmentSubmit || prefs.emailCertificateRequest);
    } catch {
      return true; // On error, send anyway
    }
  }

  /**
   * Check the admin's Settings → Notifications channel + category
   * toggles. Returns `true` when sending is allowed. Always returns
   * `true` for the `account` category (OTP / password reset / etc.) —
   * those are security-critical and cannot be turned off.
   */
  private async isCategoryAllowed(eventKey: string): Promise<boolean> {
    const meta = findTemplateMeta(eventKey);
    if (!meta || meta.channel !== 'email') return true;
    // Account-class events bypass admin toggles. Locking them out
    // would lock admins out of their own platform.
    if (meta.category === 'account') return true;
    try {
      const settings = await this.adminSettings.getCategory<NotificationChannelsSettings>(
        'notifications',
      );
      const channels = settings.channels;
      if (!channels) return true; // never configured = open
      if (channels.email === false) {
        this.logger.log(
          `Skipping email ${eventKey} — master Email channel toggled off in admin Settings`,
        );
        return false;
      }
      const cat = meta.category as ToggleableCategory;
      const catEnabled = channels.emailCategories?.[cat];
      if (catEnabled === false) {
        this.logger.log(
          `Skipping email ${eventKey} — category "${cat}" toggled off in admin Settings`,
        );
        return false;
      }
      return true;
    } catch {
      // Fail open — never let a settings DB hiccup block transactional mail.
      return true;
    }
  }

  private async send(options: {
    to: string | string[];
    subject: string;
    html: string;
    text: string;
    attachments?: { filename: string; content: Buffer }[];
    skipPreferenceCheck?: boolean;
    /**
     * When present, the admin's edited template overrides `subject` +
     * `html` if a row exists in `notification_templates` for this
     * (eventKey, locale). `text` always stays as the hardcoded
     * fallback because admin only edits the HTML body.
     */
    template?: {
      eventKey: string;
      locale: EmailLocale;
      params: Record<string, unknown>;
    };
  }): Promise<void> {
    // Category gate — check admin Notifications toggles before any
    // template lookup or recipient-preference filtering. Account-class
    // events (OTP, password reset, set-password) always pass through.
    if (options.template) {
      const allowed = await this.isCategoryAllowed(options.template.eventKey);
      if (!allowed) return;
    }

    // Template override lookup — silently no-ops when admin hasn't
    // edited this template or the row is disabled.
    if (options.template) {
      try {
        const override = await this.templateResolver.resolveEmail(
          options.template.eventKey,
          options.template.locale,
          options.template.params,
          options.subject,
        );
        if (override) {
          options.subject = override.subject;
          options.html = override.html;
        }
      } catch (err) {
        // Never block a send on resolver failure — fall through to the
        // hardcoded defaults the caller already prepared.
        this.logger.warn(
          `Template resolve failed for ${options.template.eventKey} (${options.template.locale}); using hardcoded fallback`,
          err instanceof Error ? err.message : undefined,
        );
      }
    }

    // Check email preferences (skip for system emails like OTP)
    if (!options.skipPreferenceCheck) {
      const recipients = Array.isArray(options.to) ? options.to : [options.to];
      const enabledRecipients: string[] = [];
      for (const email of recipients) {
        if (await this.isEmailEnabled(email)) {
          enabledRecipients.push(email);
        } else {
          this.logger.log(`Skipping email to ${email} — disabled by preference`);
        }
      }
      if (enabledRecipients.length === 0) return;
      options.to = enabledRecipients.length === 1 ? enabledRecipients[0] : enabledRecipients;
    }
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      'noreply@physioguidance.org';
    const replyTo = this.configService.get<string>('MAIL_REPLY_TO');
    const fromHeader = `PhysioGuidance <${from}>`;

    if (this.resend) {
      const { error } = await this.resend.emails.send({
        from: fromHeader,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        ...(replyTo && { reply_to: replyTo }),
        ...(options.attachments && {
          attachments: options.attachments.map((a) => ({
            filename: a.filename,
            content: a.content,
          })),
        }),
      });
      if (error) throw new Error(error.message);
    } else if (this.transporter) {
      await this.transporter!.sendMail({
        from: fromHeader,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        ...(replyTo && { replyTo }),
        ...(options.attachments && { attachments: options.attachments }),
      });
    }
  }

  async sendOTP(to: string, code: string, deviceName: string, locale: EmailLocale = 'en'): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      await this.send({
        to,
        subject: t(s.otpSubject, { code }),
        html: getOtpEmailHtml(code, deviceName, locale),
        text: getOtpEmailText(code, deviceName, locale),
        skipPreferenceCheck: true,
        template: {
          eventKey: 'otp',
          locale,
          params: { recipientName: '', code, expiresInMinutes: 10 },
        },
      });
      this.logger.log(`OTP email sent to ${to} (device: ${deviceName})`);
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${to}`, error);
      if (this.configService.get<string>('NODE_ENV') !== 'production') {
        this.logger.warn(`[DEV FALLBACK] OTP code for ${to}: ${code}`);
      }
    }
  }

  async sendApplicationApproved(to: string, applicantName: string, locale: EmailLocale = 'en'): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      await this.send({
        to,
        subject: s.appApprovedSubject,
        html: getApplicationApprovedHtml(applicantName, locale),
        text: getApplicationApprovedText(applicantName, locale),
        template: {
          eventKey: 'application_approved',
          locale,
          params: { applicantName },
        },
      });
      this.logger.log(`Application approved email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send approval email to ${to}`, error);
    }
  }

  /**
   * Resolve the configured frontend URL. Falls back to the production
   * domain so an unset FRONTEND_URL in a misconfigured environment
   * still produces a clickable email (better than a localhost link).
   */
  private getFrontendBaseUrl(): string {
    return (
      this.configService.get<string>('FRONTEND_URL') ||
      'https://app.physioguidance.com'
    );
  }

  /**
   * Approval email with magic-link "Set Password" button — used for
   * placeholder users who applied via the public Become-Trainer flow
   * and never set a password.
   */
  /**
   * Invite email for an admin-created account. Neutral copy (no role
   * mention) — companion to sendApplicationApprovedSetPassword but
   * used when an administrator creates a user from the admin Users
   * page rather than approving a public trainer application.
   */
  async sendAdminAccountInvite(
    to: string,
    recipientName: string,
    setupUrl: string,
    locale: EmailLocale = 'en',
  ): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      const frontendUrl = this.getFrontendBaseUrl();
      await this.send({
        to,
        subject:
          locale === 'ar'
            ? 'تم إنشاء حسابك في PhysioGuidance'
            : 'Your PhysioGuidance account is ready',
        html: getAdminAccountInviteHtml(recipientName, setupUrl, locale, frontendUrl),
        text: getAdminAccountInviteText(recipientName, setupUrl, locale, frontendUrl),
        template: {
          eventKey: 'admin_account_invite',
          locale,
          params: { recipientName, setupUrl, expiresInHours: 24 },
        },
      });
      this.logger.log(`Admin-created account invite sent to ${to}`);
      // The `s` reference keeps lint quiet — i18n strings reserved
      // for future header/footer customizations.
      void s;
    } catch (error) {
      this.logger.error(`Failed to send admin invite email to ${to}`, error);
    }
  }

  async sendApplicationApprovedSetPassword(
    to: string,
    applicantName: string,
    setupUrl: string,
    locale: EmailLocale = 'en',
  ): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      const frontendUrl = this.getFrontendBaseUrl();
      await this.send({
        to,
        subject: s.appApprovedSubject,
        html: getApplicationApprovedSetPasswordHtml(applicantName, setupUrl, locale, frontendUrl),
        text: getApplicationApprovedSetPasswordText(applicantName, setupUrl, locale, frontendUrl),
        template: {
          eventKey: 'application_approved_set_password',
          locale,
          params: { recipientName: applicantName, setupUrl, expiresInHours: 24 },
        },
      });
      this.logger.log(`Approval+set-password email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send approval+set-password email to ${to}`, error);
    }
  }

  /**
   * Welcome email for a webinar registrant whose account we auto-created on
   * Zoom registration. Includes a magic-link "Set Password" button so they
   * can log into the dashboard and claim their CME certificate.
   */
  async sendWebinarRegistrationSetPassword(
    to: string,
    registrantName: string,
    courseTitle: string,
    setupUrl: string,
    locale: EmailLocale = 'en',
  ): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      await this.send({
        to,
        subject: s.webinarRegSetupSubject,
        html: getWebinarRegistrationSetupHtml(registrantName, courseTitle, setupUrl, locale),
        text: getWebinarRegistrationSetupText(registrantName, courseTitle, setupUrl, locale),
        template: {
          eventKey: 'webinar_registration_setup',
          locale,
          params: { studentName: registrantName, courseName: courseTitle, joinLink: setupUrl },
        },
      });
      this.logger.log(`Webinar set-password email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send webinar set-password email to ${to}`, error);
    }
  }

  /**
   * Nudge email for a paid Webinar Course registrant — they filled the Zoom
   * form (so they have a registration + join link) but haven't paid for the
   * course, so they get no CME / no certificate / no portal access. The
   * email points them to the public course page to complete enrollment.
   */
  async sendWebinarPaidEnrollmentNudge(
    to: string,
    registrantName: string,
    courseTitle: string,
    courseUrl: string,
    locale: EmailLocale = 'en',
  ): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      await this.send({
        to,
        subject: s.webinarPaidNudgeSubject,
        html: getWebinarPaidEnrollmentNudgeHtml(registrantName, courseTitle, courseUrl, locale),
        text: getWebinarPaidEnrollmentNudgeText(registrantName, courseTitle, courseUrl, locale),
        template: {
          eventKey: 'webinar_paid_enrollment_nudge',
          locale,
          params: { recipientName: registrantName, courseName: courseTitle, courseUrl },
        },
      });
      this.logger.log(`Webinar paid-enrollment nudge sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send webinar paid-enrollment nudge to ${to}`, error);
    }
  }

  async sendApplicationRejected(to: string, applicantName: string, reviewNote: string, locale: EmailLocale = 'en'): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      const frontendUrl = this.getFrontendBaseUrl();
      await this.send({
        to,
        subject: s.appRejectedSubject,
        html: getApplicationRejectedHtml(applicantName, reviewNote, locale, frontendUrl),
        text: getApplicationRejectedText(applicantName, reviewNote, locale, frontendUrl),
        template: {
          eventKey: 'application_rejected',
          locale,
          params: { applicantName, reason: reviewNote },
        },
      });
      this.logger.log(`Application rejected email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send rejection email to ${to}`, error);
    }
  }

  async sendApplicationMoreInfo(
    to: string,
    applicantName: string,
    reviewNote: string,
    locale: EmailLocale = 'en',
    missing?: MissingRequirement[],
  ): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      const frontendUrl = this.getFrontendBaseUrl();
      await this.send({
        to,
        subject: s.appMoreInfoSubject,
        html: getApplicationMoreInfoHtml(applicantName, reviewNote, locale, missing, frontendUrl),
        text: getApplicationMoreInfoText(applicantName, reviewNote, locale, missing, frontendUrl),
        template: {
          eventKey: 'application_more_info',
          locale,
          params: { applicantName, reviewerMessage: reviewNote },
        },
      });
      this.logger.log(`More info request email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send more-info email to ${to}`, error);
    }
  }

  async sendNewApplicationAdmin(adminEmails: string[], applicantName: string, applicantEmail: string, locale: EmailLocale = 'en'): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      await this.send({
        to: adminEmails,
        subject: t(s.newAppAdminSubject, { name: applicantName }),
        html: getNewApplicationAdminHtml(applicantName, applicantEmail, locale),
        text: getNewApplicationAdminText(applicantName, applicantEmail, locale),
        template: {
          eventKey: 'new_application_admin',
          locale,
          params: { applicantName, applicationUrl: '' },
        },
      });
      this.logger.log(`New application admin notification sent to ${adminEmails.length} admin(s)`);
    } catch (error) {
      this.logger.error('Failed to send admin notification email', error);
    }
  }

  /**
   * Send at-risk reminder email to student
   */
  async sendAtRiskReminder(
    to: string,
    studentName: string,
    courseName: string,
    customMessage?: string,
    locale: EmailLocale = 'en',
  ): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      await this.send({
        to,
        subject: t(s.atRiskSubject, { course: courseName }),
        html: getAtRiskReminderHtml(studentName, courseName, customMessage, locale),
        text: getAtRiskReminderText(studentName, courseName, customMessage, locale),
        template: {
          eventKey: 'at_risk_reminder',
          locale,
          params: { studentName, courseName, risk: customMessage ?? '' },
        },
      });
      this.logger.log(
        `At-risk reminder email sent to ${to} for course "${courseName}"`,
      );
    } catch (error) {
      this.logger.error(`Failed to send at-risk reminder to ${to}`, error);
    }
  }

  /**
   * Send session reminder email (5 minutes before session starts)
   */
  async sendSessionReminder(
    to: string,
    params: {
      recipientName: string;
      sessionTitle: string;
      courseName: string;
      scheduledAt: string;
      durationMinutes: number;
      zoomLink: string | null;
      isInstructor: boolean;
      numberSystem?: 'western' | 'arabic_indic';
    },
    locale: EmailLocale = 'en',
  ): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      await this.send({
        to,
        subject: t(s.sessionReminderSubject, { title: params.sessionTitle }),
        html: getSessionReminderHtml(params, locale),
        text: getSessionReminderText(params, locale),
        template: {
          eventKey: 'session_reminder_5min',
          locale,
          params: {
            recipientName: params.recipientName,
            sessionTitle: params.sessionTitle,
            courseName: params.courseName,
            scheduledAt: params.scheduledAt,
            durationMinutes: params.durationMinutes,
          },
        },
      });
      this.logger.log(
        `Session reminder sent to ${to} for "${params.sessionTitle}"`,
      );
    } catch (error) {
      this.logger.error(`Failed to send session reminder to ${to}`, error);
    }
  }

  /**
   * Send certificate approved email to student
   */
  async sendCertificateApproved(
    to: string,
    studentName: string,
    courseName: string,
    downloadUrl: string,
    locale: EmailLocale = 'en',
  ): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      await this.send({
        to,
        subject: t(s.certApprovedSubject, { course: courseName }),
        html: getCertificateApprovedHtml(studentName, courseName, downloadUrl, locale),
        text: getCertificateApprovedText(studentName, courseName, downloadUrl, locale),
        template: {
          eventKey: 'certificate_approved',
          locale,
          params: { studentName, courseName, certificateId: '', downloadUrl },
        },
      });
      this.logger.log(
        `Certificate approved email sent to ${to} for "${courseName}"`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send certificate approved email to ${to}`,
        error,
      );
    }
  }

  /**
   * Send certificate rejected email to student
   */
  async sendCertificateRejected(
    to: string,
    studentName: string,
    courseName: string,
    reviewNote: string,
    locale: EmailLocale = 'en',
  ): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      await this.send({
        to,
        subject: t(s.certRejectedSubject, { course: courseName }),
        html: getCertificateRejectedHtml(studentName, courseName, reviewNote, locale),
        text: getCertificateRejectedText(studentName, courseName, reviewNote, locale),
        template: {
          eventKey: 'certificate_rejected',
          locale,
          params: { studentName, courseName, reason: reviewNote },
        },
      });
      this.logger.log(
        `Certificate rejected email sent to ${to} for "${courseName}"`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send certificate rejected email to ${to}`,
        error,
      );
    }
  }

  /**
   * Send a scheduled report as an email attachment
   */
  async sendReportEmail(
    to: string,
    subject: string,
    buffer: Buffer,
    filename: string,
    locale: EmailLocale = 'en',
  ): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      await this.send({
        to,
        subject,
        text: `${s.reportBody} ${filename}`,
        html: `<p>${s.reportBody} <strong>${filename}</strong></p><p>${s.reportAutoGenerated}</p>`,
        attachments: [{ filename, content: buffer }],
      });
      this.logger.log(`Report email sent to ${to} (file: ${filename})`);
    } catch (error) {
      this.logger.error(`Failed to send report email to ${to}`, error);
    }
  }

  /**
   * Send certificate held email to student
   */
  async sendCertificateHeld(
    to: string,
    studentName: string,
    courseName: string,
    reviewNote: string,
    locale: EmailLocale = 'en',
  ): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      await this.send({
        to,
        subject: t(s.certHeldSubject, { course: courseName }),
        html: getCertificateHeldHtml(studentName, courseName, reviewNote, locale),
        text: getCertificateHeldText(studentName, courseName, reviewNote, locale),
        template: {
          eventKey: 'certificate_held',
          locale,
          params: { studentName, courseName, reason: reviewNote },
        },
      });
      this.logger.log(
        `Certificate held email sent to ${to} for "${courseName}"`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send certificate held email to ${to}`,
        error,
      );
    }
  }

  /**
   * Send session scheduled notification email to student
   */
  async sendSessionScheduled(
    to: string,
    params: {
      recipientName: string;
      sessionTitle: string;
      courseName: string;
      scheduledDate: string;
      sessionType: string;
      zoomLink: string | null;
      isRescheduled?: boolean;
    },
    locale: EmailLocale = 'en',
  ): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      const subject = t(
        params.isRescheduled ? s.sessionRescheduledSubject : s.sessionScheduledSubject,
        { title: params.sessionTitle },
      );
      await this.send({
        to,
        subject,
        html: getSessionScheduledHtml(params, locale),
        text: getSessionScheduledText(params, locale),
        template: {
          eventKey: 'session_scheduled',
          locale,
          params: {
            recipientName: params.recipientName,
            sessionTitle: params.sessionTitle,
            courseName: params.courseName,
            scheduledAt: params.scheduledDate,
          },
        },
      });
      this.logger.log(
        `Session scheduled email sent to ${to} for "${params.sessionTitle}"`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send session scheduled email to ${to}`,
        error,
      );
    }
  }

  /**
   * Send session started notification email to student
   */
  async sendSessionStarted(
    to: string,
    params: {
      recipientName: string;
      sessionTitle: string;
      courseName: string;
      zoomLink: string | null;
    },
    locale: EmailLocale = 'en',
  ): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      await this.send({
        to,
        subject: t(s.sessionStartedSubject, { title: params.sessionTitle }),
        html: getSessionStartedHtml(params, locale),
        text: getSessionStartedText(params, locale),
        template: {
          eventKey: 'session_started',
          locale,
          params: {
            recipientName: params.recipientName,
            sessionTitle: params.sessionTitle,
          },
        },
      });
      this.logger.log(
        `Session started email sent to ${to} for "${params.sessionTitle}"`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send session started email to ${to}`,
        error,
      );
    }
  }

  /**
   * Send "Webinar is Live, join now" email to a webinar registrant with
   * their personal Zoom join URL embedded. Used by the webinar.started
   * webhook to blast all registrants the moment the host clicks Start.
   */
  async sendWebinarLive(
    to: string,
    params: {
      recipientName: string;
      webinarTitle: string;
      courseName?: string | null;
      personalJoinUrl: string;
    },
    locale: EmailLocale = 'en',
  ): Promise<void> {
    try {
      const subject =
        locale === 'ar'
          ? `🔴 الندوة "${params.webinarTitle}" بدأت — انضم الآن`
          : `🔴 "${params.webinarTitle}" is LIVE — Join now`;
      await this.send({
        to,
        subject,
        html: getWebinarLiveHtml(params, locale),
        text: getWebinarLiveText(params, locale),
        template: {
          eventKey: 'webinar_live',
          locale,
          params: {
            recipientName: params.recipientName,
            webinarTitle: params.webinarTitle,
          },
        },
      });
      this.logger.log(
        `Webinar live email sent to ${to} for "${params.webinarTitle}"`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send webinar live email to ${to}`,
        error,
      );
    }
  }

  /**
   * Send session ended notification email to student
   */
  async sendSessionEnded(
    to: string,
    params: {
      recipientName: string;
      sessionTitle: string;
      courseName: string;
    },
    locale: EmailLocale = 'en',
  ): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      await this.send({
        to,
        subject: t(s.sessionEndedSubject, { title: params.sessionTitle }),
        html: getSessionEndedHtml(params, locale),
        text: getSessionEndedText(params, locale),
        template: {
          eventKey: 'session_ended',
          locale,
          params: {
            recipientName: params.recipientName,
            sessionTitle: params.sessionTitle,
            recordingUrl: '',
          },
        },
      });
      this.logger.log(
        `Session ended email sent to ${to} for "${params.sessionTitle}"`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send session ended email to ${to}`,
        error,
      );
    }
  }

  /**
   * Send session cancelled notification email to student
   */
  async sendSessionCancelled(
    to: string,
    params: {
      recipientName: string;
      sessionTitle: string;
      courseName: string;
      cancelReason: string | null;
    },
    locale: EmailLocale = 'en',
  ): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      await this.send({
        to,
        subject: t(s.sessionCancelledSubject, { title: params.sessionTitle }),
        html: getSessionCancelledHtml(params, locale),
        text: getSessionCancelledText(params, locale),
        template: {
          eventKey: 'session_cancelled',
          locale,
          params: {
            recipientName: params.recipientName,
            sessionTitle: params.sessionTitle,
            reason: params.cancelReason ?? '',
          },
        },
      });
      this.logger.log(
        `Session cancelled email sent to ${to} for "${params.sessionTitle}"`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send session cancelled email to ${to}`,
        error,
      );
    }
  }

  /**
   * Send course cancelled notification email to an enrolled student.
   * Refund status is embedded so the student knows what to expect
   * (immediate = gateway refund; manual = bank transfer wire by finance;
   * none = free enrolment).
   */
  async sendCourseCancelled(
    to: string,
    params: {
      recipientName: string;
      courseName: string;
      cancelReason: string | null;
      refundKind: CourseCancelRefundKind;
      /** Phase C post-start cancels revoke certs + reverse points; the
       * template appends an extra explanatory block when true. */
      certsRevoked?: boolean;
    },
    locale: EmailLocale = 'en',
  ): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      await this.send({
        to,
        subject: t(s.courseCancelledSubject, { course: params.courseName }),
        html: getCourseCancelledHtml(params, locale),
        text: getCourseCancelledText(params, locale),
        template: {
          eventKey: 'course_cancelled',
          locale,
          params: {
            recipientName: params.recipientName,
            courseName: params.courseName,
            reason: params.cancelReason ?? '',
            refundKind: params.refundKind,
            certsRevoked: params.certsRevoked ? 'true' : 'false',
          },
        },
      });
      this.logger.log(
        `Course cancelled email sent to ${to} for "${params.courseName}"`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send course cancelled email to ${to}`,
        error,
      );
    }
  }

  /**
   * Send TA assignment notification email
   */
  async sendTaAssignment(
    to: string,
    params: {
      recipientName: string;
      sessionTitle: string;
      courseName: string;
      scheduledAt: string;
      durationMinutes: number;
      instructorName: string;
      isAutoAssigned: boolean;
      numberSystem?: 'western' | 'arabic_indic';
    },
    locale: EmailLocale = 'en',
  ): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      await this.send({
        to,
        subject: t(s.taAssignSubject, { title: params.sessionTitle }),
        html: getTaAssignmentHtml(params, locale),
        text: getTaAssignmentText(params, locale),
        template: {
          eventKey: 'ta_assignment',
          locale,
          params: {
            recipientName: params.recipientName,
            courseName: params.courseName,
            instructorName: params.instructorName,
          },
        },
      });
      this.logger.log(
        `TA assignment email sent to ${to} for "${params.sessionTitle}"`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send TA assignment email to ${to}`,
        error,
      );
    }
  }

  /**
   * Send TA rejection notification email to the suggesting instructor
   */
  async sendTaRejection(
    to: string,
    params: {
      recipientName: string;
      courseName: string;
      taName: string;
      rejectionReason: string;
    },
    locale: EmailLocale = 'en',
  ): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      await this.send({
        to,
        subject: t(s.taRejectionSubject, { course: params.courseName }),
        html: getTaRejectionHtml(params, locale),
        text: getTaRejectionText(params, locale),
        template: {
          eventKey: 'ta_rejection',
          locale,
          params: {
            recipientName: params.recipientName,
            courseName: params.courseName,
            reason: params.rejectionReason ?? '',
          },
        },
      });
      this.logger.log(
        `TA rejection email sent to ${to} for "${params.courseName}"`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send TA rejection email to ${to}`,
        error,
      );
    }
  }

  /**
   * Send content review notification email to instructor
   */
  async sendContentReview(
    to: string,
    params: {
      recipientName: string;
      materialTitle: string;
      courseName: string;
      decision: 'approved' | 'rejected' | 'changes_requested';
      comment: string | null;
    },
    locale: EmailLocale = 'en',
  ): Promise<void> {
    const s = getEmailStrings(locale);
    const decisionLabels: Record<string, string> = {
      approved: s.contentDecisionApproved,
      rejected: s.contentDecisionRejected,
      changes_requested: s.contentDecisionChanges,
    };
    const decisionLabel = decisionLabels[params.decision] || params.decision;

    try {
      await this.send({
        to,
        subject: t(s.contentReviewSubject, { decision: decisionLabel, title: params.materialTitle }),
        html: getContentReviewHtml(params, locale),
        text: getContentReviewText(params, locale),
        template: {
          eventKey: 'content_review',
          locale,
          params: {
            instructorName: params.recipientName,
            courseName: params.courseName,
            outcome: decisionLabel,
            feedback: params.comment ?? '',
          },
        },
      });
      this.logger.log(
        `Content review email sent to ${to} for "${params.materialTitle}" (${params.decision})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send content review email to ${to}`,
        error,
      );
    }
  }

  /**
   * Send pending review notification email to course manager
   */
  /**
   * Send notification to course manager about a new review awaiting approval.
   * Uses the branded template shared with other PhysioGuidance system emails.
   */
  async sendReviewPendingApproval(
    to: string,
    params: {
      recipientName: string;
      studentName: string;
      courseName: string;
      rating: number;
      reviewText?: string | null;
    },
    locale: EmailLocale = 'en',
  ): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        'https://www.physioguidance.org';
      const dashboardUrl = `${frontendUrl.replace(/\/$/, '')}/${locale}/dashboard/manager/reviews`;

      await this.send({
        to,
        subject: t(s.reviewPendingSubject, { course: params.courseName }),
        html: getReviewPendingApprovalHtml({ ...params, dashboardUrl }, locale),
        text: getReviewPendingApprovalText({ ...params, dashboardUrl }, locale),
        template: {
          eventKey: 'review_pending_approval',
          locale,
          params: {
            reviewerName: params.recipientName,
            courseName: params.courseName,
            reviewSnippet: params.reviewText ?? '',
          },
        },
      });
      this.logger.log(`Review-pending-approval email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send review-pending-approval email to ${to}`, error);
    }
  }

  async sendContentPendingReview(
    to: string,
    params: {
      recipientName: string;
      materialTitle: string;
      courseName: string;
      instructorName: string;
      wcagStatus: string;
      wcagSummary: string;
    },
    locale: EmailLocale = 'en',
  ): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      await this.send({
        to,
        subject: t(s.contentPendingSubject, { title: params.materialTitle }),
        html: getContentPendingReviewHtml(params, locale),
        text: getContentPendingReviewText(params, locale),
        template: {
          eventKey: 'content_pending_review',
          locale,
          params: {
            instructorName: params.instructorName,
            courseName: params.courseName,
            reviewUrl: '',
          },
        },
      });
      this.logger.log(
        `Content pending review email sent to ${to} for "${params.materialTitle}"`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send content pending review email to ${to}`,
        error,
      );
    }
  }

  /**
   * Send assessment submission notification to instructor
   */
  async sendAssessmentSubmitted(
    to: string,
    params: {
      instructorName: string;
      studentName: string;
      assessmentTitle: string;
      assessmentType: string;
      courseName: string;
    },
    locale: EmailLocale = 'en',
  ): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      const typeLabel =
        params.assessmentType.charAt(0).toUpperCase() +
        params.assessmentType.slice(1);
      await this.send({
        to,
        subject: t(s.assessSubmittedSubject, { type: typeLabel, title: params.assessmentTitle }),
        html: getAssessmentSubmittedHtml(params, locale),
        text: getAssessmentSubmittedText(params, locale),
        template: {
          eventKey: 'assessment_submitted',
          locale,
          params: {
            studentName: params.studentName,
            assessmentTitle: params.assessmentTitle,
            courseName: params.courseName,
          },
        },
      });
      this.logger.log(
        `Assessment submission email sent to ${to} for "${params.assessmentTitle}"`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send assessment submission email to ${to}`,
        error,
      );
    }
  }

  async sendRetakeGranted(
    to: string,
    params: RetakeGrantedParams,
    locale: EmailLocale = 'en',
  ): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      await this.send({
        to,
        subject: t(s.retakeGrantedSubject, { title: params.assessmentTitle }),
        html: getRetakeGrantedHtml(params, locale),
        text: getRetakeGrantedText(params, locale),
        template: {
          eventKey: 'retake_granted',
          locale,
          params: {
            studentName: params.studentName,
            assessmentTitle: params.assessmentTitle,
            courseName: params.courseName,
            reason: params.reason ?? '',
            newDueDate: params.newDueDate ?? '',
          },
        },
      });
      this.logger.log(
        `Retake granted email sent to ${to} for "${params.assessmentTitle}"`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send retake granted email to ${to}`,
        error,
      );
    }
  }

  async sendTimeExtensionGranted(
    to: string,
    params: TimeExtensionGrantedParams,
    locale: EmailLocale = 'en',
  ): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      await this.send({
        to,
        subject: t(s.timeExtensionSubject, {
          minutes: String(params.minutes),
          title: params.assessmentTitle,
        }),
        html: getTimeExtensionGrantedHtml(params, locale),
        text: getTimeExtensionGrantedText(params, locale),
        template: {
          eventKey: 'time_extension_granted',
          locale,
          params: {
            studentName: params.studentName,
            assessmentTitle: params.assessmentTitle,
            newDueDate: '',
          },
        },
      });
      this.logger.log(
        `Time extension email sent to ${to} for "${params.assessmentTitle}" (+${params.minutes} min)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send time extension email to ${to}`,
        error,
      );
    }
  }

  /**
   * Send enrollment confirmation email to student
   */
  /**
   * Send password reset OTP email
   */
  async sendPasswordReset(to: string, code: string, locale: EmailLocale = 'en'): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      await this.send({
        to,
        subject: t(s.passwordResetSubject, { code }),
        html: getPasswordResetHtml(code, locale),
        text: getPasswordResetText(code, locale),
        skipPreferenceCheck: true,
        template: {
          eventKey: 'password_reset',
          locale,
          params: { recipientName: '', code, expiresInMinutes: 10 },
        },
      });
      this.logger.log(`Password reset email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${to}`, error);
      if (this.configService.get<string>('NODE_ENV') !== 'production') {
        this.logger.warn(`[DEV FALLBACK] Password reset code for ${to}: ${code}`);
      }
    }
  }

  async sendEnrollmentConfirmation(
    to: string,
    params: {
      studentName: string;
      courseName: string;
      startDate: string | null;
      instructorName: string;
    },
    locale: EmailLocale = 'en',
  ): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      await this.send({
        to,
        subject: t(s.enrollSubject, { course: params.courseName }),
        html: getEnrollmentConfirmationHtml(params, locale),
        text: getEnrollmentConfirmationText(params, locale),
        template: {
          eventKey: 'enrollment_confirmation',
          locale,
          params: {
            studentName: params.studentName,
            courseName: params.courseName,
            startDate: params.startDate ?? '',
            instructorName: params.instructorName,
          },
        },
      });
      this.logger.log(
        `Enrollment confirmation email sent to ${to} for "${params.courseName}"`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send enrollment confirmation email to ${to}`,
        error,
      );
    }
  }

  /**
   * Send a generic notification email (used for TA deactivation, pre-assignment, etc.)
   */
  async sendGenericNotification(
    to: string,
    params: {
      recipientName: string;
      subject: string;
      message: string;
    },
    locale: EmailLocale = 'en',
  ): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      const html = `<!DOCTYPE html>
<html ${htmlAttrs(locale)}>
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#EEF3F7;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF3F7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:linear-gradient(135deg,#a37f49,#6b4e24);border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
          <h1 style="margin:0;font-size:22px;font-weight:700;"><span style="color:#ffffff;">Physio</span><span style="color:#f5f0e8;">Guidance</span></h1>
          <p style="margin:6px 0 0;font-size:12px;color:rgba(255,255,255,0.7);">${s.nelcBadge}</p>
        </td></tr>
        <tr><td style="background-color:#ffffff;padding:28px 32px;">
          <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#1a1a1a;">${s.hi} ${params.recipientName},</h2>
          <p style="margin:0;font-size:14px;color:#4b5563;line-height:1.6;">${params.message}</p>
        </td></tr>
        <tr><td style="background-color:#ffffff;padding:0 32px 28px;text-align:center;">
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px;" />
          <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      const text = `${s.hi} ${params.recipientName},\n\n${params.message}\n\n© ${new Date().getFullYear()} PhysioGuidance. ${s.allRightsReserved}`;

      await this.send({
        to,
        subject: params.subject,
        html,
        text,
      });
      this.logger.log(`Generic notification email sent to ${to}: ${params.subject}`);
    } catch (error) {
      this.logger.error(
        `Failed to send generic notification email to ${to}`,
        error,
      );
    }
  }

  /**
   * Send CSAT survey email after ticket resolution
   */
  async sendCsatSurvey(
    to: string,
    learnerName: string,
    ticketRef: string,
    surveyId: string,
  ): Promise<void> {
    const baseUrl =
      this.configService.get('NEXT_PUBLIC_API_URL')?.replace('/api', '') ||
      'http://localhost:3000';
    const surveyBaseUrl = `${baseUrl}/en/surveys/csat/${surveyId}`;

    try {
      await this.send({
        to,
        subject: `How did we do? — Ticket ${ticketRef}`,
        html: getCsatSurveyHtml(learnerName, ticketRef, surveyBaseUrl),
        text: getCsatSurveyText(learnerName, ticketRef, surveyBaseUrl),
      });
      this.logger.log(`CSAT survey email sent to ${to} for ticket ${ticketRef}`);
    } catch (error) {
      this.logger.error(`Failed to send CSAT survey email to ${to}`, error);
    }
  }

  /**
   * Send CSAT followup email for low scores
   */
  async sendCsatFollowup(
    to: string,
    learnerName: string,
    ticketRef: string,
    score: number,
  ): Promise<void> {
    try {
      await this.send({
        to,
        subject: `We're sorry — can we help further?`,
        html: getCsatFollowupHtml(learnerName, ticketRef, score),
        text: getCsatFollowupText(learnerName, ticketRef, score),
      });
      this.logger.log(
        `CSAT followup email sent to ${to} for ticket ${ticketRef}`,
      );
    } catch (error) {
      this.logger.error(`Failed to send CSAT followup email to ${to}`, error);
    }
  }

  /**
   * Send ticket created confirmation email to learner
   */
  async sendTicketCreatedLearner(
    to: string,
    learnerName: string,
    ticketRef: string,
    expectedResponse: string,
    mode?: 'in_hours' | 'queued_until_resume',
    // Optional. When provided (guest tickets), the email's CTA points
    // to the public tracking URL instead of the learner dashboard.
    trackingUrl?: string,
  ): Promise<void> {
    try {
      await this.send({
        to,
        subject: `Ticket ${ticketRef} received — PhysioGuidance Support`,
        html: getTicketCreatedLearnerHtml(learnerName, ticketRef, expectedResponse, mode, trackingUrl),
        text: getTicketCreatedLearnerText(learnerName, ticketRef, expectedResponse, mode, trackingUrl),
      });
      this.logger.log(
        `Ticket created email sent to ${to} for ticket ${ticketRef}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send ticket created email to ${to}`,
        error,
      );
    }
  }

  /**
   * Send ticket assigned notification email to agent
   */
  async sendTicketAssignedAgent(
    to: string,
    agentName: string,
    ticketRef: string,
    subject: string,
    priority: string,
    frtDeadline: string,
  ): Promise<void> {
    try {
      await this.send({
        to,
        subject: `New ticket assigned — ${ticketRef}`,
        html: getTicketAssignedAgentHtml(agentName, ticketRef, subject, priority, frtDeadline),
        text: getTicketAssignedAgentText(agentName, ticketRef, subject, priority, frtDeadline),
      });
      this.logger.log(
        `Ticket assigned email sent to ${to} for ticket ${ticketRef}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send ticket assigned email to ${to}`,
        error,
      );
    }
  }

  /**
   * Send ticket reply notification email
   */
  async sendTicketReplyNotification(
    to: string,
    recipientName: string,
    senderName: string,
    ticketRef: string,
    messagePreview: string,
    // Optional. When provided (guest tickets), the email's CTA points
    // to the public tracking URL so the guest can reply without a
    // dashboard login.
    trackingUrl?: string,
  ): Promise<void> {
    try {
      await this.send({
        to,
        subject: `New reply on ticket ${ticketRef}`,
        html: getTicketReplyHtml(recipientName, senderName, ticketRef, messagePreview, trackingUrl),
        text: getTicketReplyText(recipientName, senderName, ticketRef, messagePreview, trackingUrl),
      });
      this.logger.log(
        `Ticket reply notification sent to ${to} for ticket ${ticketRef}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send ticket reply notification to ${to}`,
        error,
      );
    }
  }

  /**
   * Send SLA FRT breach alert email
   */
  async sendSlaFrtBreach(
    to: string,
    agentName: string,
    ticketRef: string,
    subject: string,
    frtTarget: string,
  ): Promise<void> {
    try {
      await this.send({
        to,
        subject: `BREACH ALERT: Ticket ${ticketRef} — FRT exceeded`,
        html: getSlaFrtBreachHtml(agentName, ticketRef, subject, frtTarget),
        text: getSlaFrtBreachText(agentName, ticketRef, subject, frtTarget),
      });
      this.logger.log(
        `SLA FRT breach email sent to ${to} for ticket ${ticketRef}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send SLA FRT breach email to ${to}`,
        error,
      );
    }
  }

  /**
   * Send SLA TTR breach alert email
   */
  async sendSlaTtrBreach(
    to: string,
    agentName: string,
    ticketRef: string,
    subject: string,
    ttrTarget: string,
  ): Promise<void> {
    try {
      await this.send({
        to,
        subject: `BREACH ALERT: Ticket ${ticketRef} — TTR exceeded`,
        html: getSlaTtrBreachHtml(agentName, ticketRef, subject, ttrTarget),
        text: getSlaTtrBreachText(agentName, ticketRef, subject, ttrTarget),
      });
      this.logger.log(
        `SLA TTR breach email sent to ${to} for ticket ${ticketRef}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send SLA TTR breach email to ${to}`,
        error,
      );
    }
  }

  /**
   * Send ticket resolved notification email to learner. When a CSAT
   * survey row is created alongside the resolve (always, for both
   * authed and guest tickets), the surveyId + locale produce a
   * one-click "Rate your experience" CTA so the recipient never
   * has to open the ticket to leave feedback.
   */
  async sendTicketResolved(
    to: string,
    learnerName: string,
    ticketRef: string,
    surveyId?: string | null,
    locale: string = 'en',
  ): Promise<void> {
    try {
      const surveyUrl = surveyId
        ? `${this.getFrontendBaseUrl()}/${locale}/surveys/csat/${surveyId}`
        : null;
      await this.send({
        to,
        subject: `Your ticket ${ticketRef} has been resolved`,
        html: getTicketResolvedHtml(learnerName, ticketRef, surveyUrl),
        text: getTicketResolvedText(learnerName, ticketRef, surveyUrl),
      });
      this.logger.log(
        `Ticket resolved email sent to ${to} for ticket ${ticketRef}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send ticket resolved email to ${to}`,
        error,
      );
    }
  }

  /**
   * Send ticket closed notification email to learner.
   * Distinct from "resolved" — closed tickets cannot be reopened by the
   * student, so the CTA invites them to open a new ticket instead.
   */
  async sendTicketClosed(
    to: string,
    learnerName: string,
    ticketRef: string,
  ): Promise<void> {
    try {
      await this.send({
        to,
        subject: `Your ticket ${ticketRef} has been closed`,
        html: getTicketClosedHtml(learnerName, ticketRef),
        text: getTicketClosedText(learnerName, ticketRef),
      });
      this.logger.log(
        `Ticket closed email sent to ${to} for ticket ${ticketRef}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send ticket closed email to ${to}`,
        error,
      );
    }
  }

  /**
   * Send ticket escalation notification email to supervisor
   */
  /**
   * Send a generic "ticket status updated" email. Used by updateTicket
   * for intermediate transitions (on-hold, manual reopen, etc.) — the
   * dedicated resolved/closed templates fire from their own service
   * methods so this one explicitly skips both to avoid double-sends.
   */
  async sendTicketStatusChange(
    to: string,
    learnerName: string,
    ticketRef: string,
    newStatus: string,
    reason?: string | null,
  ): Promise<void> {
    if (newStatus === 'resolved' || newStatus === 'closed') return;

    try {
      await this.send({
        to,
        subject: `Ticket ${ticketRef} status updated`,
        html: getTicketStatusChangeHtml(learnerName, ticketRef, newStatus, reason),
        text: getTicketStatusChangeText(learnerName, ticketRef, newStatus, reason),
      });
      this.logger.log(
        `Ticket status-change email sent to ${to} for ticket ${ticketRef} (${newStatus})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send ticket status-change email to ${to}`,
        error,
      );
    }
  }

  async sendTicketEscalation(
    to: string,
    supervisorName: string,
    ticketRef: string,
    subject: string,
    agentChain: string,
  ): Promise<void> {
    try {
      await this.send({
        to,
        subject: `CRITICAL: Ticket ${ticketRef} — all agents failed`,
        html: getTicketEscalationHtml(supervisorName, ticketRef, subject, agentChain),
        text: getTicketEscalationText(supervisorName, ticketRef, subject, agentChain),
      });
      this.logger.log(
        `Ticket escalation email sent to ${to} for ticket ${ticketRef}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send ticket escalation email to ${to}`,
        error,
      );
    }
  }

  // Notify supervisor/admin that an agent has requested an on-hold
  // approval. Inline minimal template — the real surface is the
  // in-app alert / supervisor dashboard banner, not the email body.
  async sendHoldRequestEmail(
    to: string,
    approverName: string,
    ticketRef: string,
    subject: string,
    agentName: string,
    reason: string,
    description: string | null,
  ): Promise<void> {
    try {
      await this.send({
        to,
        subject: `Hold approval needed — ${ticketRef}`,
        html: `<p>Hi ${approverName},</p>
<p><strong>${agentName}</strong> requested a hold on <strong>${ticketRef}</strong> — ${subject}.</p>
<p><strong>Reason:</strong> ${reason}</p>${
          description
            ? `<p><strong>Description:</strong> ${description}</p>`
            : ''
        }
<p>Open the ticket to approve or reject the request.</p>`,
        text: `${agentName} requested a hold on ${ticketRef} — ${subject}.
Reason: ${reason}
${description ? `Description: ${description}\n` : ''}Open the ticket to approve or reject.`,
      });
      this.logger.log(
        `Hold request email sent to ${to} for ticket ${ticketRef}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send hold request email to ${to}`,
        error,
      );
    }
  }

  // Notify the requesting agent that their hold request has been
  // approved or rejected.
  async sendHoldDecisionEmail(
    to: string,
    agentName: string,
    ticketRef: string,
    subject: string,
    decision: 'approved' | 'rejected',
    note: string | null,
  ): Promise<void> {
    try {
      await this.send({
        to,
        subject: `Hold request ${decision} — ${ticketRef}`,
        html: `<p>Hi ${agentName},</p>
<p>Your hold request on <strong>${ticketRef}</strong> — ${subject} was <strong>${decision}</strong>.</p>${
          note ? `<p><strong>Note:</strong> ${note}</p>` : ''
        }`,
        text: `Your hold request on ${ticketRef} — ${subject} was ${decision}.${
          note ? `\nNote: ${note}` : ''
        }`,
      });
      this.logger.log(
        `Hold decision email sent to ${to} for ticket ${ticketRef}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send hold decision email to ${to}`,
        error,
      );
    }
  }
  // ─── Payment Email Methods ──────────────────────────────

  private async getUserData(userId: string) {
    const [user] = await db
      .select({
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return user;
  }

  async sendPaymentConfirmation(
    userId: string,
    paymentId: string,
    pdfAttachment?: { buffer: Buffer; filename: string },
  ): Promise<void> {
    try {
      const user = await this.getUserData(userId);
      if (!user) return;

      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId))
        .limit(1);
      if (!payment) return;

      // Multi-line carts: resolve all course titles from payment_items. Legacy
      // single-course payments fall back to payments.courseId.
      const cartCourseIds = ((payment.metadata as any)?.courseIds as string[] | undefined) || [
        payment.courseId,
      ];

      const courseRows = await db
        .select({ id: courses.id, title: courses.title })
        .from(courses)
        .where(inArray(courses.id, cartCourseIds));

      // Preserve cart order in the displayed list.
      const titleById = new Map(courseRows.map((c) => [c.id, c.title]));
      const orderedTitles = cartCourseIds.map((id) => titleById.get(id) || 'Course');

      const [invoice] = await db
        .select({ invoiceNumber: invoices.invoiceNumber })
        .from(invoices)
        .where(eq(invoices.paymentId, paymentId))
        .limit(1);

      const studentName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student';

      // Single-course payments keep the original "Payment Confirmed - {Course}"
      // subject so existing email filters / SLAs are unaffected. Multi-course
      // carts use "Payment Confirmed - N courses".
      const courseName =
        orderedTitles.length === 1
          ? orderedTitles[0]
          : `${orderedTitles.length} courses`;

      const params = {
        studentName,
        courseName,
        amount: String(payment.amount),
        currency: payment.currency,
        invoiceNumber: invoice?.invoiceNumber || 'N/A',
        gateway: payment.gateway,
        transactionId: payment.gatewayChargeId || 'N/A',
      };

      await this.send({
        to: user.email,
        subject: `Payment Confirmed - ${courseName}`,
        html: getPaymentConfirmationHtml(params),
        text: getPaymentConfirmationText(params),
        ...(pdfAttachment && {
          attachments: [
            {
              filename: pdfAttachment.filename,
              content: pdfAttachment.buffer,
            },
          ],
        }),
      });
      this.logger.log(`Payment confirmation email sent to ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send payment confirmation email`, error);
    }
  }

  async sendPaymentFailed(userId: string, paymentId: string): Promise<void> {
    try {
      const user = await this.getUserData(userId);
      if (!user) return;

      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId))
        .limit(1);
      if (!payment) return;

      const [course] = await db
        .select({ title: courses.title })
        .from(courses)
        .where(eq(courses.id, payment.courseId))
        .limit(1);

      const studentName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student';
      const params = {
        studentName,
        courseName: course?.title || 'Course',
        amount: String(payment.amount),
        currency: payment.currency,
      };

      await this.send({
        to: user.email,
        subject: `Payment Failed - ${course?.title || 'Course'}`,
        html: getPaymentFailedHtml(params),
        text: getPaymentFailedText(params),
      });
      this.logger.log(`Payment failed email sent to ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send payment failed email`, error);
    }
  }

  async sendBankTransferReceived(
    userId: string,
    paymentId: string,
  ): Promise<void> {
    try {
      const user = await this.getUserData(userId);
      if (!user) return;

      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId))
        .limit(1);
      if (!payment) return;

      const [course] = await db
        .select({ title: courses.title })
        .from(courses)
        .where(eq(courses.id, payment.courseId))
        .limit(1);

      const studentName =
        `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student';
      const params = {
        studentName,
        courseName: course?.title || 'Course',
        amount: String(payment.amount),
        currency: payment.currency,
        paymentId: payment.id,
        uploadedAt: new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
      };

      await this.send({
        to: user.email,
        subject: `Bank transfer receipt received - ${course?.title || 'Course'}`,
        html: getBankTransferReceivedHtml(params),
        text: getBankTransferReceivedText(params),
      });
      this.logger.log(`Bank transfer receipt acknowledgement sent to ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send bank transfer receipt email`, error);
    }
  }

  async sendBankTransferRejected(
    paymentId: string,
    reviewerNote: string,
  ): Promise<void> {
    try {
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId))
        .limit(1);
      if (!payment) return;

      const user = await this.getUserData(payment.userId);
      if (!user) return;

      const [course] = await db
        .select({ title: courses.title })
        .from(courses)
        .where(eq(courses.id, payment.courseId))
        .limit(1);

      const studentName =
        `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student';
      const appBase =
        process.env.FRONTEND_URL || 'https://physioguidance.org';
      const uploadUrl = `${appBase}/en/payment/bank-transfer/${paymentId}`;

      const params = {
        studentName,
        courseName: course?.title || 'Course',
        amount: String(payment.amount),
        currency: payment.currency,
        paymentId: payment.id,
        reviewerNote,
        uploadUrl,
      };

      await this.send({
        to: user.email,
        subject: `Bank transfer receipt could not be approved - ${course?.title || 'Course'}`,
        html: getBankTransferRejectedHtml(params),
        text: getBankTransferRejectedText(params),
      });
      this.logger.log(`Bank transfer rejection email sent to ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send bank transfer rejection email`, error);
    }
  }

  /**
   * Send the Tamara stuck-payment alert to FINANCE + ADMIN + SUPER_ADMIN.
   * Caller is the cron retry service when a payment crosses 24h/48h/60h
   * thresholds in the Tamara authorise-window. severity controls copy +
   * recipient set:
   *   - warning  (24h): finance team only
   *   - urgent   (48h): finance + admin
   *   - critical (60h): finance + admin + super_admin
   */
  async sendTamaraStuckAlert(
    paymentId: string,
    severity: TamaraStuckSeverity,
    context: {
      hoursStuck: number;
      hoursUntilExpiry: number;
      attempts: number;
      lastError: string | null;
    },
  ): Promise<void> {
    try {
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId))
        .limit(1);
      if (!payment) return;

      const buyer = await this.getUserData(payment.userId);
      if (!buyer) return;

      // Pick recipient role names by severity. We resolve role → user emails
      // dynamically rather than hard-coding addresses so onboarding a new
      // finance hire doesn't require an env-var change.
      const roleNames =
        severity === 'critical'
          ? ['FINANCE', 'ADMIN', 'SUPER_ADMIN']
          : severity === 'urgent'
            ? ['FINANCE', 'ADMIN']
            : ['FINANCE'];

      const recipients = await this.resolveEmailsByRoleNames(roleNames);
      if (recipients.length === 0) {
        this.logger.warn(
          `No recipients found for Tamara stuck alert (severity=${severity}, roles=${roleNames.join(',')})`,
        );
        return;
      }

      const appBase = process.env.FRONTEND_URL || 'https://physioguidance.org';
      const dashboardUrl = `${appBase}/en/dashboard/finance/payments?paymentId=${paymentId}`;

      const params = {
        severity,
        paymentId: payment.id,
        gatewayChargeId: payment.gatewayChargeId || '(none)',
        buyerName:
          `${buyer.firstName || ''} ${buyer.lastName || ''}`.trim() ||
          buyer.email,
        buyerEmail: buyer.email,
        amount: String(payment.amount),
        hoursStuck: context.hoursStuck,
        hoursUntilExpiry: context.hoursUntilExpiry,
        attempts: context.attempts,
        lastError: context.lastError,
        dashboardUrl,
      };

      const subjectPrefix =
        severity === 'critical'
          ? '[CRITICAL]'
          : severity === 'urgent'
            ? '[URGENT]'
            : '[WARNING]';

      // Tamara stuck alerts are operational, not toggleable — send to BCC
      // (each recipient gets one email, doesn't see the others' addresses).
      await this.send({
        to: recipients,
        subject: `${subjectPrefix} Tamara payment stuck ${context.hoursStuck}h — ${buyer.email}`,
        html: getTamaraStuckAlertHtml(params),
        text: getTamaraStuckAlertText(params),
      });
      this.logger.log(
        `Tamara stuck alert (${severity}) sent for payment ${paymentId} to ${recipients.length} recipient(s)`,
      );
    } catch (error) {
      this.logger.error(`Failed to send Tamara stuck alert`, error);
    }
  }

  /**
   * Resolve role names → email addresses of users currently holding any
   * of those roles. Excludes soft-deleted accounts. Used by the Tamara
   * stuck-payment alert escalation.
   */
  private async resolveEmailsByRoleNames(roleNames: string[]): Promise<string[]> {
    if (roleNames.length === 0) return [];

    const roleRows = await db
      .select({ id: roles.id })
      .from(roles)
      .where(inArray(roles.name, roleNames));
    if (roleRows.length === 0) return [];

    const userIdRows = await db
      .selectDistinct({ userId: userRoles.userId })
      .from(userRoles)
      .where(inArray(userRoles.roleId, roleRows.map((r) => r.id)));
    if (userIdRows.length === 0) return [];

    const emailRows = await db
      .select({ email: users.email })
      .from(users)
      .where(inArray(users.id, userIdRows.map((r) => r.userId)));

    return emailRows
      .map((r) => r.email)
      .filter((e): e is string => Boolean(e) && !e.startsWith('deleted-'));
  }

  async sendRefundRequested(
    userId: string,
    refundId: string,
  ): Promise<void> {
    try {
      const user = await this.getUserData(userId);
      if (!user) return;

      const [refund] = await db
        .select()
        .from(refunds)
        .where(eq(refunds.id, refundId))
        .limit(1);
      if (!refund) return;

      const studentName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student';

      await this.send({
        to: user.email,
        subject: 'Refund Request Received - PhysioGuidance',
        html: getRefundRequestedHtml({
          studentName,
          amount: String(refund.refundAmount),
          currency: 'SAR',
        }),
        text: getRefundRequestedText({
          studentName,
          amount: String(refund.refundAmount),
          currency: 'SAR',
        }),
      });
      this.logger.log(`Refund requested email sent to ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send refund requested email`, error);
    }
  }

  async sendRefundApproved(
    userId: string,
    refundId: string,
  ): Promise<void> {
    try {
      const user = await this.getUserData(userId);
      if (!user) return;

      const [refund] = await db
        .select()
        .from(refunds)
        .where(eq(refunds.id, refundId))
        .limit(1);
      if (!refund) return;

      const studentName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student';

      await this.send({
        to: user.email,
        subject: 'Refund Approved - PhysioGuidance',
        html: getRefundApprovedHtml({
          studentName,
          amount: String(refund.refundAmount),
          currency: 'SAR',
        }),
        text: getRefundApprovedText({
          studentName,
          amount: String(refund.refundAmount),
          currency: 'SAR',
        }),
      });
      this.logger.log(`Refund approved email sent to ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send refund approved email`, error);
    }
  }

  async sendRefundRejected(
    userId: string,
    refundId: string,
    rejectionNote: string,
  ): Promise<void> {
    try {
      const user = await this.getUserData(userId);
      if (!user) return;

      const studentName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student';

      await this.send({
        to: user.email,
        subject: 'Refund Request Update - PhysioGuidance',
        html: getRefundRejectedHtml({ studentName, rejectionNote }),
        text: getRefundRejectedText({ studentName, rejectionNote }),
      });
      this.logger.log(`Refund rejected email sent to ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send refund rejected email`, error);
    }
  }

  async sendRefundCompleted(
    userId: string,
    refundId: string,
  ): Promise<void> {
    try {
      const user = await this.getUserData(userId);
      if (!user) return;

      const [refund] = await db
        .select()
        .from(refunds)
        .where(eq(refunds.id, refundId))
        .limit(1);
      if (!refund) return;

      const studentName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student';

      await this.send({
        to: user.email,
        subject: 'Refund Completed - PhysioGuidance',
        html: getRefundCompletedHtml({
          studentName,
          originalAmount: String(refund.originalAmount),
          deductionAmount: String(refund.deductionAmount),
          refundAmount: String(refund.refundAmount),
          currency: 'SAR',
        }),
        text: getRefundCompletedText({
          studentName,
          originalAmount: String(refund.originalAmount),
          deductionAmount: String(refund.deductionAmount),
          refundAmount: String(refund.refundAmount),
          currency: 'SAR',
        }),
      });
      this.logger.log(`Refund completed email sent to ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send refund completed email`, error);
    }
  }

  /**
   * Notify all admins of a new reconciliation escalation. Sent fire-and-
   * forget by EscalationsService — never bubbles errors. High-urgency
   * escalations get an [URGENT] prefix so triage can scan inbox quickly.
   */
  async sendReconciliationEscalationCreated(
    adminEmails: string[],
    escalationId: string,
    urgency: 'low' | 'normal' | 'high',
  ): Promise<void> {
    if (adminEmails.length === 0) return;
    try {
      const base = process.env.FRONTEND_URL || 'https://physioguidance.org';
      const escalationUrl = `${base}/en/dashboard/admin/finance/escalations/${escalationId}`;
      const params = { escalationId, urgency, escalationUrl };
      const subjectPrefix = urgency === 'high' ? '[URGENT] ' : '';
      await this.send({
        to: adminEmails,
        subject: `${subjectPrefix}Reconciliation escalation needs review`,
        html: getReconciliationEscalationCreatedHtml(params),
        text: getReconciliationEscalationCreatedText(params),
      });
      this.logger.log(
        `Reconciliation escalation ${escalationId} (urgency=${urgency}) notified to ${adminEmails.length} admin(s)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send reconciliation escalation notification for ${escalationId}`,
        error,
      );
    }
  }

  /**
   * Notify the finance user who raised the escalation when admin transitions
   * it. `kind` controls subject + body copy via the shared template.
   */
  /**
   * Daily reconciliation digest. Sent by the cron at ~02:30 KSA after the
   * nightly scan completes. Recipients are finance + admin + super_admin.
   */
  async sendReconciliationDigest(
    recipients: string[],
    params: ReconciliationDigestParams,
  ): Promise<void> {
    if (recipients.length === 0) return;
    try {
      await this.send({
        to: recipients,
        subject: `Reconciliation digest — ${params.scanDate}`,
        html: getReconciliationDigestHtml(params),
        text: getReconciliationDigestText(params),
      });
      this.logger.log(
        `Reconciliation digest sent to ${recipients.length} recipient(s) for ${params.scanDate}`,
      );
    } catch (error) {
      this.logger.error(`Failed to send reconciliation digest`, error);
    }
  }

  /**
   * "X escalations have been waiting > Yh — please review" reminder.
   * Sent by the stale-reminder cron at ~10:00 KSA.
   */
  async sendReconciliationStaleReminder(
    recipients: string[],
    kind: 'pending' | 'in_progress',
    count: number,
    hours: number,
  ): Promise<void> {
    if (recipients.length === 0 || count === 0) return;
    try {
      const base = process.env.FRONTEND_URL || 'https://physioguidance.org';
      const dashboardUrl = `${base}/en/dashboard/admin/finance/escalations?status=${kind}`;
      const subject =
        kind === 'pending'
          ? `Reminder: ${count} reconciliation escalation${count === 1 ? '' : 's'} waiting > ${hours}h`
          : `Reminder: ${count} escalation${count === 1 ? '' : 's'} you claimed are open > ${hours}h`;
      const headline =
        kind === 'pending'
          ? 'Pending escalations need a claim'
          : 'In-progress escalations need closure';
      const body =
        kind === 'pending'
          ? `<strong>${count}</strong> reconciliation escalation${count === 1 ? ' has' : 's have'} been pending for over ${hours} hours with no admin claiming them. Open the queue, claim what you can act on, and resolve or send back.`
          : `You have <strong>${count}</strong> escalation${count === 1 ? '' : 's'} in progress for over ${hours} hours. If you're blocked, send them back to finance with a note; otherwise resolve them.`;
      await this.send({
        to: recipients,
        subject,
        html: this.simpleAlertHtml(headline, body, dashboardUrl, 'Open queue'),
        text: `PhysioGuidance — ${headline}\n\n${body.replace(/<[^>]+>/g, '')}\n\nOpen: ${dashboardUrl}`,
      });
    } catch (error) {
      this.logger.error(`Failed to send reconciliation stale reminder`, error);
    }
  }

  async sendReconciliationAutoEscalationSummary(
    recipients: string[],
    count: number,
  ): Promise<void> {
    if (recipients.length === 0 || count === 0) return;
    try {
      const base = process.env.FRONTEND_URL || 'https://physioguidance.org';
      const dashboardUrl = `${base}/en/dashboard/admin/finance/escalations?status=pending`;
      const subject = `${count} reconciliation finding${count === 1 ? '' : 's'} auto-escalated overnight`;
      const body = `The reconciliation cron auto-escalated <strong>${count}</strong> finding${count === 1 ? '' : 's'} based on the per-drift-type thresholds. These need admin action — open the queue, sort by urgency, and resolve them.`;
      await this.send({
        to: recipients,
        subject,
        html: this.simpleAlertHtml('Auto-escalations need review', body, dashboardUrl, 'Open queue'),
        text: `PhysioGuidance — ${subject}\n\n${body.replace(/<[^>]+>/g, '')}\n\nOpen: ${dashboardUrl}`,
      });
    } catch (error) {
      this.logger.error(`Failed to send auto-escalation summary`, error);
    }
  }

  async sendReconciliationScanFailedAlert(
    recipients: string[],
    errorMessage: string,
  ): Promise<void> {
    if (recipients.length === 0) return;
    try {
      const base = process.env.FRONTEND_URL || 'https://physioguidance.org';
      const dashboardUrl = `${base}/en/dashboard/finance/reconciliation`;
      const subject = `[URGENT] Reconciliation cron scan failed`;
      const body = `The daily reconciliation scan failed with the error below. Drift detection is paused until the next successful run. Retry manually from the reconciliation page, and investigate the gateway/DB issue.<br/><br/><pre style="background:#f9fafb;padding:12px;border-radius:6px;font-size:11px;overflow-x:auto;">${errorMessage}</pre>`;
      await this.send({
        to: recipients,
        subject,
        html: this.simpleAlertHtml('Reconciliation scan failed', body, dashboardUrl, 'Open reconciliation page'),
        text: `PhysioGuidance — Reconciliation scan failed\n\n${errorMessage}\n\nManual retry: ${dashboardUrl}`,
      });
    } catch (error) {
      this.logger.error(`Failed to send scan-failure alert`, error);
    }
  }

  /**
   * Minimal HTML alert template — shared by the three short reconciliation
   * alerts above (stale reminder, auto-escalation summary, scan failure).
   * The digest has its own richer template; this one is just "headline +
   * body + button".
   */
  private simpleAlertHtml(
    headline: string,
    bodyHtml: string,
    ctaUrl: string,
    ctaLabel: string,
  ): string {
    return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#EEF3F7;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF3F7;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="background:linear-gradient(135deg,#a37f49,#6b4e24);padding:24px 32px;text-align:center;">
          <span style="font-size:22px;font-weight:700;color:#fff;">Physio</span><span style="font-size:22px;font-weight:700;color:#f5f0e8;">Guidance</span>
          <br/><span style="font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:1px;text-transform:uppercase;">Finance · Reconciliation</span>
        </td></tr>
        <tr><td style="padding:24px 32px 0;">
          <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1a1a1a;">${headline}</h1>
          <p style="margin:0 0 16px;font-size:14px;color:#525252;line-height:1.6;">${bodyHtml}</p>
        </td></tr>
        <tr><td style="padding:0 32px 24px;">
          <a href="${ctaUrl}" style="display:inline-block;padding:12px 24px;background-color:#a37f49;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">${ctaLabel}</a>
        </td></tr>
        <tr><td style="padding:0 32px;"><div style="height:1px;background-color:#e5e7eb;"></div></td></tr>
        <tr><td style="padding:16px 32px 24px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#9ca3af;">&copy; ${new Date().getFullYear()} PhysioGuidance.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  async sendReconciliationEscalationTransition(
    financeEmail: string,
    escalationId: string,
    kind: 'sent_back' | 'declined' | 'resolved',
  ): Promise<void> {
    try {
      const base = process.env.FRONTEND_URL || 'https://physioguidance.org';
      // Finance link goes back to the reconciliation page (the escalated
      // finding is what they care about). The admin escalation detail is a
      // separate route admin-only.
      const escalationUrl = `${base}/en/dashboard/finance/reconciliation`;
      const params = { escalationId, kind, escalationUrl };
      const subject =
        kind === 'sent_back'
          ? 'Admin sent your reconciliation escalation back for more info'
          : kind === 'declined'
            ? 'Admin closed your reconciliation escalation without action'
            : 'Your reconciliation escalation has been resolved';
      await this.send({
        to: financeEmail,
        subject,
        html: getReconciliationEscalationTransitionHtml(params),
        text: getReconciliationEscalationTransitionText(params),
      });
      this.logger.log(
        `Reconciliation escalation ${escalationId} ${kind} notified to ${financeEmail}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send reconciliation transition email for ${escalationId}`,
        error,
      );
    }
  }

  /**
   * Sentry alert summary email — fires when a Sentry alert rule (e.g. new
   * issue, frequency spike) trips, fanned out to every admin + super-admin.
   * Intentionally minimal HTML — these go to ops people who want the title,
   * the count, and a link.
   */
  async sendSentryAlert(
    to: string,
    recipientName: string,
    summary: {
      title: string;
      subtitle: string;
      level: string;
      permalink: string | null;
      triggeredRule: string | null;
    },
  ): Promise<void> {
    const subjectLevel = summary.level
      ? summary.level.toUpperCase()
      : 'ALERT';
    const subject = `[Sentry / ${subjectLevel}] ${summary.title.slice(0, 120)}`;
    const safeTitle = escapeHtml(summary.title);
    const safeSubtitle = escapeHtml(summary.subtitle);
    const safeRule = summary.triggeredRule
      ? escapeHtml(summary.triggeredRule)
      : null;
    const adminPanelUrl = `${this.frontendUrlFromEnv()}/dashboard/admin/settings?tab=system&panel=error-monitoring`;
    const sentryLink = summary.permalink ?? adminPanelUrl;

    const html = `
      <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
        <h2 style="margin: 0 0 8px 0; color: #b91c1c; font-size: 18px;">${escapeHtml(subjectLevel)} alert</h2>
        <p style="margin: 0 0 16px 0; color: #64748b; font-size: 13px;">Hi ${escapeHtml(recipientName)}, a frontend error tripped a Sentry alert rule on PhysioGuidance.</p>
        <div style="border: 1px solid #fee2e2; background: #fef2f2; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <div style="font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 6px;">${safeTitle}</div>
          <div style="font-size: 13px; color: #475569;">${safeSubtitle}</div>
          ${safeRule ? `<div style="font-size: 12px; color: #94a3b8; margin-top: 8px;">Rule: ${safeRule}</div>` : ''}
        </div>
        <p style="margin: 0 0 16px 0;">
          <a href="${sentryLink}" style="display: inline-block; padding: 10px 16px; background: #0f172a; color: #f8fafc; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">Open in Sentry</a>
          &nbsp;
          <a href="${adminPanelUrl}" style="display: inline-block; padding: 10px 16px; background: #f1f5f9; color: #0f172a; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">Admin dashboard</a>
        </p>
        <p style="margin: 0; color: #94a3b8; font-size: 11px;">This is an automated alert. Adjust delivery rules in Sentry → Alerts.</p>
      </div>
    `;

    const text = [
      `${subjectLevel} alert: ${summary.title}`,
      summary.subtitle,
      summary.triggeredRule ? `Rule: ${summary.triggeredRule}` : null,
      ``,
      `Open in Sentry: ${sentryLink}`,
      `Admin dashboard: ${adminPanelUrl}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await this.send({
        to,
        subject,
        html,
        text,
        skipPreferenceCheck: true,
      });
      this.logger.log(`Sentry alert email sent to ${to} — ${summary.title.slice(0, 80)}`);
    } catch (err) {
      this.logger.warn(
        `Sentry alert email to ${to} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private frontendUrlFromEnv(): string {
    return (
      process.env.FRONTEND_URL ||
      this.configService.get<string>('FRONTEND_URL') ||
      'https://physioguidance.org'
    );
  }
}

function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
