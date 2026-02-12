import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { getOtpEmailHtml, getOtpEmailText } from './templates/otp.template';

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
}
