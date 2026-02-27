import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST') || 'localhost';
    const port = parseInt(this.configService.get<string>('SMTP_PORT') || '1025', 10);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    const transportOptions: nodemailer.TransportOptions & Record<string, unknown> = {
      host,
      port,
      secure: port === 465,
    };

    if (user && pass) {
      transportOptions.auth = { user, pass };
    }

    this.transporter = nodemailer.createTransport(transportOptions);
    this.logger.log(`Email transport configured → ${host}:${port} (auth: ${!!user})`);
  }

  /**
   * Send a branded OTP verification email
   */
  async sendOTP(
    to: string,
    code: string,
    deviceName: string,
  ): Promise<void> {
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      'noreply@physioguidance.org';

    const html = getOtpEmailHtml(code, deviceName);
    const text = getOtpEmailText(code, deviceName);

    try {
      await this.transporter.sendMail({
        from: `"PhysioGuidance" <${from}>`,
        to,
        subject: `${code} is your PhysioGuidance verification code`,
        html,
        text,
      });

      this.logger.log(`OTP email sent to ${to} (device: ${deviceName})`);
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${to}`, error);

      // In dev, also log the code to console as a fallback
      if (this.configService.get<string>('NODE_ENV') !== 'production') {
        this.logger.warn(`[DEV FALLBACK] OTP code for ${to}: ${code}`);
      }
    }
  }

  /**
   * Send application approved email to applicant
   */
  async sendApplicationApproved(
    to: string,
    applicantName: string,
  ): Promise<void> {
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      'noreply@physioguidance.org';

    try {
      await this.transporter.sendMail({
        from: `"PhysioGuidance" <${from}>`,
        to,
        subject: 'Your Trainer Application Has Been Approved!',
        html: getApplicationApprovedHtml(applicantName),
        text: getApplicationApprovedText(applicantName),
      });
      this.logger.log(`Application approved email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send approval email to ${to}`, error);
    }
  }

  /**
   * Send application rejected email to applicant
   */
  async sendApplicationRejected(
    to: string,
    applicantName: string,
    reviewNote: string,
  ): Promise<void> {
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      'noreply@physioguidance.org';

    try {
      await this.transporter.sendMail({
        from: `"PhysioGuidance" <${from}>`,
        to,
        subject: 'Update on Your Trainer Application',
        html: getApplicationRejectedHtml(applicantName, reviewNote),
        text: getApplicationRejectedText(applicantName, reviewNote),
      });
      this.logger.log(`Application rejected email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send rejection email to ${to}`, error);
    }
  }

  /**
   * Send more info request email to applicant
   */
  async sendApplicationMoreInfo(
    to: string,
    applicantName: string,
    reviewNote: string,
  ): Promise<void> {
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      'noreply@physioguidance.org';

    try {
      await this.transporter.sendMail({
        from: `"PhysioGuidance" <${from}>`,
        to,
        subject: 'Additional Information Needed for Your Application',
        html: getApplicationMoreInfoHtml(applicantName, reviewNote),
        text: getApplicationMoreInfoText(applicantName, reviewNote),
      });
      this.logger.log(`More info request email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send more-info email to ${to}`, error);
    }
  }

  /**
   * Send new application notification to all admins
   */
  async sendNewApplicationAdmin(
    adminEmails: string[],
    applicantName: string,
    applicantEmail: string,
  ): Promise<void> {
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      'noreply@physioguidance.org';

    try {
      await this.transporter.sendMail({
        from: `"PhysioGuidance" <${from}>`,
        to: adminEmails.join(', '),
        subject: `New Instructor Application from ${applicantName}`,
        html: getNewApplicationAdminHtml(applicantName, applicantEmail),
        text: getNewApplicationAdminText(applicantName, applicantEmail),
      });
      this.logger.log(
        `New application admin notification sent to ${adminEmails.length} admin(s)`,
      );
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
  ): Promise<void> {
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      'noreply@physioguidance.org';

    try {
      await this.transporter.sendMail({
        from: `"PhysioGuidance" <${from}>`,
        to,
        subject: `Course Progress Reminder - ${courseName}`,
        html: getAtRiskReminderHtml(studentName, courseName, customMessage),
        text: getAtRiskReminderText(studentName, courseName, customMessage),
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
  ): Promise<void> {
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      'noreply@physioguidance.org';

    try {
      await this.transporter.sendMail({
        from: `"PhysioGuidance" <${from}>`,
        to,
        subject: `Session Starting Soon: ${params.sessionTitle}`,
        html: getSessionReminderHtml(params),
        text: getSessionReminderText(params),
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
  ): Promise<void> {
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      'noreply@physioguidance.org';

    try {
      await this.transporter.sendMail({
        from: `"PhysioGuidance" <${from}>`,
        to,
        subject: `Certificate Approved - ${courseName}`,
        html: getCertificateApprovedHtml(studentName, courseName, downloadUrl),
        text: getCertificateApprovedText(studentName, courseName, downloadUrl),
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
  ): Promise<void> {
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      'noreply@physioguidance.org';

    try {
      await this.transporter.sendMail({
        from: `"PhysioGuidance" <${from}>`,
        to,
        subject: `Certificate Request Update - ${courseName}`,
        html: getCertificateRejectedHtml(studentName, courseName, reviewNote),
        text: getCertificateRejectedText(studentName, courseName, reviewNote),
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
  ): Promise<void> {
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      'noreply@physioguidance.org';

    try {
      await this.transporter.sendMail({
        from: `"PhysioGuidance" <${from}>`,
        to,
        subject,
        text: `Please find the attached scheduled report: ${filename}`,
        html: `<p>Please find the attached scheduled report: <strong>${filename}</strong></p><p>This report was automatically generated by PhysioGuidance.</p>`,
        attachments: [
          {
            filename,
            content: buffer,
          },
        ],
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
  ): Promise<void> {
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      'noreply@physioguidance.org';

    try {
      await this.transporter.sendMail({
        from: `"PhysioGuidance" <${from}>`,
        to,
        subject: `Certificate Request On Hold - ${courseName}`,
        html: getCertificateHeldHtml(studentName, courseName, reviewNote),
        text: getCertificateHeldText(studentName, courseName, reviewNote),
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
  ): Promise<void> {
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      'noreply@physioguidance.org';

    try {
      await this.transporter.sendMail({
        from: `"PhysioGuidance" <${from}>`,
        to,
        subject: `Session Live: ${params.sessionTitle}`,
        html: getSessionStartedHtml(params),
        text: getSessionStartedText(params),
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
  ): Promise<void> {
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      'noreply@physioguidance.org';

    try {
      await this.transporter.sendMail({
        from: `"PhysioGuidance" <${from}>`,
        to,
        subject: `Session Ended: ${params.sessionTitle}`,
        html: getSessionEndedHtml(params),
        text: getSessionEndedText(params),
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
  ): Promise<void> {
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      'noreply@physioguidance.org';

    try {
      await this.transporter.sendMail({
        from: `"PhysioGuidance" <${from}>`,
        to,
        subject: `Session Cancelled: ${params.sessionTitle}`,
        html: getSessionCancelledHtml(params),
        text: getSessionCancelledText(params),
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
  ): Promise<void> {
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      'noreply@physioguidance.org';

    try {
      await this.transporter.sendMail({
        from: `"PhysioGuidance" <${from}>`,
        to,
        subject: `TA Assignment: ${params.sessionTitle}`,
        html: getTaAssignmentHtml(params),
        text: getTaAssignmentText(params),
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
  ): Promise<void> {
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      'noreply@physioguidance.org';

    const decisionLabels: Record<string, string> = {
      approved: 'Approved',
      rejected: 'Rejected',
      changes_requested: 'Changes Requested',
    };
    const decisionLabel = decisionLabels[params.decision] || params.decision;

    try {
      await this.transporter.sendMail({
        from: `"PhysioGuidance" <${from}>`,
        to,
        subject: `Content ${decisionLabel}: ${params.materialTitle}`,
        html: getContentReviewHtml(params),
        text: getContentReviewText(params),
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
}
