import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { db } from '../../database';
import { users } from '../../database/schema';
import { userPreferences } from '../../database/schema/user-preferences';
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
import { EmailLocale, getEmailStrings, t, htmlAttrs } from './email-i18n';
import { TemplateResolverService } from '../templates/template-resolver.service';
import { findTemplateMeta } from '../templates/template-registry';
import { AdminSettingsService } from '../admin-settings/admin-settings.service';

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
   * Approval email with magic-link "Set Password" button — used for
   * placeholder users who applied via the public Become-Trainer flow
   * and never set a password.
   */
  async sendApplicationApprovedSetPassword(
    to: string,
    applicantName: string,
    setupUrl: string,
    locale: EmailLocale = 'en',
  ): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      await this.send({
        to,
        subject: s.appApprovedSubject,
        html: getApplicationApprovedSetPasswordHtml(applicantName, setupUrl, locale),
        text: getApplicationApprovedSetPasswordText(applicantName, setupUrl, locale),
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
      await this.send({
        to,
        subject: s.appRejectedSubject,
        html: getApplicationRejectedHtml(applicantName, reviewNote, locale),
        text: getApplicationRejectedText(applicantName, reviewNote, locale),
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

  async sendApplicationMoreInfo(to: string, applicantName: string, reviewNote: string, locale: EmailLocale = 'en'): Promise<void> {
    try {
      const s = getEmailStrings(locale);
      await this.send({
        to,
        subject: s.appMoreInfoSubject,
        html: getApplicationMoreInfoHtml(applicantName, reviewNote, locale),
        text: getApplicationMoreInfoText(applicantName, reviewNote, locale),
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
  ): Promise<void> {
    try {
      await this.send({
        to,
        subject: `Ticket ${ticketRef} received — PhysioGuidance Support`,
        html: getTicketCreatedLearnerHtml(learnerName, ticketRef, expectedResponse),
        text: getTicketCreatedLearnerText(learnerName, ticketRef, expectedResponse),
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
  ): Promise<void> {
    try {
      await this.send({
        to,
        subject: `New reply on ticket ${ticketRef}`,
        html: getTicketReplyHtml(recipientName, senderName, ticketRef, messagePreview),
        text: getTicketReplyText(recipientName, senderName, ticketRef, messagePreview),
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
   * Send ticket resolved notification email to learner
   */
  async sendTicketResolved(
    to: string,
    learnerName: string,
    ticketRef: string,
  ): Promise<void> {
    try {
      await this.send({
        to,
        subject: `Your ticket ${ticketRef} has been resolved`,
        html: getTicketResolvedHtml(learnerName, ticketRef),
        text: getTicketResolvedText(learnerName, ticketRef),
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
}
