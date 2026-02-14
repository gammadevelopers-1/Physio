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

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    // Use Mailpit SMTP for dev; in production, swap to a real provider (SES, Resend, etc.)
    const host = this.configService.get<string>('SMTP_HOST') || 'localhost';
    const port = parseInt(this.configService.get<string>('SMTP_PORT') || '1025', 10);

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false, // Mailpit does not use TLS
      // No auth needed for Mailpit
    });

    this.logger.log(`Email transport configured → ${host}:${port}`);
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
}
