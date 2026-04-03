import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';
import { getOtpEmailHtml, getOtpEmailText } from './templates/otp.template';
import {
  getApplicationApprovedHtml,
  getApplicationApprovedText,
} from './templates/application-approved.template';
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
  getEnrollmentConfirmationHtml,
  getEnrollmentConfirmationText,
} from './templates/enrollment-confirmation.template';
import {
  getPasswordResetHtml,
  getPasswordResetText,
} from './templates/password-reset.template';
import { EmailLocale, getEmailStrings, t, htmlAttrs } from './email-i18n';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private transporter: nodemailer.Transporter | null = null;

  constructor(private configService: ConfigService) {
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

  private async send(options: {
    to: string | string[];
    subject: string;
    html: string;
    text: string;
    attachments?: { filename: string; content: Buffer }[];
  }): Promise<void> {
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
      });
      this.logger.log(`Application approved email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send approval email to ${to}`, error);
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
}
