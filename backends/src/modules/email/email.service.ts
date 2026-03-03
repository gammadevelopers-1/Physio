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
  getPaymentConfirmationHtml,
  getPaymentConfirmationText,
} from './templates/payment-confirmation.template';
import {
  getPaymentFailedHtml,
  getPaymentFailedText,
} from './templates/payment-failed.template';
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
import { eq } from 'drizzle-orm';
import { db } from '../../database';
import {
  users,
  payments,
  invoices,
  refunds,
  courses,
} from '../../database/schema';

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

  async sendOTP(to: string, code: string, deviceName: string): Promise<void> {
    try {
      await this.send({
        to,
        subject: `${code} is your PhysioGuidance verification code`,
        html: getOtpEmailHtml(code, deviceName),
        text: getOtpEmailText(code, deviceName),
      });
      this.logger.log(`OTP email sent to ${to} (device: ${deviceName})`);
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${to}`, error);
      if (this.configService.get<string>('NODE_ENV') !== 'production') {
        this.logger.warn(`[DEV FALLBACK] OTP code for ${to}: ${code}`);
      }
    }
  }

  async sendApplicationApproved(to: string, applicantName: string): Promise<void> {
    try {
      await this.send({
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

  async sendApplicationRejected(to: string, applicantName: string, reviewNote: string): Promise<void> {
    try {
      await this.send({
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

  async sendApplicationMoreInfo(to: string, applicantName: string, reviewNote: string): Promise<void> {
    try {
      await this.send({
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

  async sendNewApplicationAdmin(adminEmails: string[], applicantName: string, applicantEmail: string): Promise<void> {
    try {
      await this.send({
        to: adminEmails,
        subject: `New Instructor Application from ${applicantName}`,
        html: getNewApplicationAdminHtml(applicantName, applicantEmail),
        text: getNewApplicationAdminText(applicantName, applicantEmail),
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
  ): Promise<void> {
    try {
      await this.send({
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
    try {
      await this.send({
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
    try {
      await this.send({
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
    try {
      await this.send({
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
    try {
      await this.send({
        to,
        subject,
        text: `Please find the attached scheduled report: ${filename}`,
        html: `<p>Please find the attached scheduled report: <strong>${filename}</strong></p><p>This report was automatically generated by PhysioGuidance.</p>`,
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
  ): Promise<void> {
    try {
      await this.send({
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
    },
  ): Promise<void> {
    try {
      await this.send({
        to,
        subject: `New Session Scheduled: ${params.sessionTitle}`,
        html: getSessionScheduledHtml(params),
        text: getSessionScheduledText(params),
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
  ): Promise<void> {
    try {
      await this.send({
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
    try {
      await this.send({
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
    try {
      await this.send({
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
    try {
      await this.send({
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
    const decisionLabels: Record<string, string> = {
      approved: 'Approved',
      rejected: 'Rejected',
      changes_requested: 'Changes Requested',
    };
    const decisionLabel = decisionLabels[params.decision] || params.decision;

    try {
      await this.send({
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
  ): Promise<void> {
    try {
      await this.send({
        to,
        subject: `Content Pending Review: ${params.materialTitle}`,
        html: getContentPendingReviewHtml(params),
        text: getContentPendingReviewText(params),
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
  ): Promise<void> {
    try {
      const typeLabel =
        params.assessmentType.charAt(0).toUpperCase() +
        params.assessmentType.slice(1);
      await this.send({
        to,
        subject: `${typeLabel} Submitted: ${params.assessmentTitle}`,
        html: getAssessmentSubmittedHtml(params),
        text: getAssessmentSubmittedText(params),
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
  async sendEnrollmentConfirmation(
    to: string,
    params: {
      studentName: string;
      courseName: string;
      startDate: string | null;
      instructorName: string;
    },
  ): Promise<void> {
    try {
      await this.send({
        to,
        subject: `Enrollment Confirmed: ${params.courseName}`,
        html: getEnrollmentConfirmationHtml(params),
        text: getEnrollmentConfirmationText(params),
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

      const [course] = await db
        .select({ title: courses.title })
        .from(courses)
        .where(eq(courses.id, payment.courseId))
        .limit(1);

      const [invoice] = await db
        .select({ invoiceNumber: invoices.invoiceNumber })
        .from(invoices)
        .where(eq(invoices.paymentId, paymentId))
        .limit(1);

      const studentName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Student';
      const params = {
        studentName,
        courseName: course?.title || 'Course',
        amount: String(payment.amount),
        currency: payment.currency,
        invoiceNumber: invoice?.invoiceNumber || 'N/A',
        gateway: payment.gateway,
        transactionId: payment.gatewayChargeId || 'N/A',
      };

      await this.send({
        to: user.email,
        subject: `Payment Confirmed - ${course?.title || 'Course'}`,
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
          amount: String(refund.refundAmount),
          currency: 'SAR',
        }),
        text: getRefundCompletedText({
          studentName,
          amount: String(refund.refundAmount),
          currency: 'SAR',
        }),
      });
      this.logger.log(`Refund completed email sent to ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send refund completed email`, error);
    }
  }
}
