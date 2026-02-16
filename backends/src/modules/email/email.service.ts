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
  }): Promise<void> {
    const from =
      this.configService.get<string>('MAIL_FROM') ||
      'noreply@physioguidance.org';
    const fromHeader = `PhysioGuidance <${from}>`;

    if (this.resend) {
      const { error } = await this.resend.emails.send({
        from: fromHeader,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      if (error) throw new Error(error.message);
    } else if (this.transporter) {
      await this.transporter.sendMail({
        from: fromHeader,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
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
}
