import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomInt } from 'crypto';
import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '../../database';
import { emailVerifications } from '../../database/schema';
import { EmailService } from '../email/email.service';

const OTP_EXPIRY_MINUTES = 10;
const OTP_COOLDOWN_SECONDS = 60; // anti-spam: one code per email per minute
const MAX_ATTEMPTS = 5;
const MAX_PER_IP_PER_HOUR = 10; // soft cap on /request-otp per IP

type Purpose = 'trainer-application' | 'trainer-application-portal';

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(private readonly emailService: EmailService) {}

  private hash(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async issueCode(params: {
    email: string;
    purpose: Purpose;
    locale?: 'en' | 'ar';
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    const email = this.normalizeEmail(params.email);
    const purpose = params.purpose;
    const ipHash = params.ipAddress ? this.hash(params.ipAddress) : null;

    // Per-IP rate limit (last hour)
    if (ipHash) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const [recent] = await db
        .select({ c: sql<number>`COUNT(*)` })
        .from(emailVerifications)
        .where(
          and(
            eq(emailVerifications.ipHash, ipHash),
            gt(emailVerifications.createdAt, oneHourAgo),
          ),
        );
      if (recent && Number(recent.c) >= MAX_PER_IP_PER_HOUR) {
        throw new BadRequestException(
          'Too many verification requests from this IP. Try again later.',
        );
      }
    }

    // Per-email cooldown
    const [latest] = await db
      .select()
      .from(emailVerifications)
      .where(
        and(
          eq(emailVerifications.email, email),
          eq(emailVerifications.purpose, purpose),
        ),
      )
      .orderBy(sql`${emailVerifications.createdAt} DESC`)
      .limit(1);

    if (latest && !latest.isUsed) {
      const secondsSince =
        (Date.now() - new Date(latest.createdAt).getTime()) / 1000;
      if (secondsSince < OTP_COOLDOWN_SECONDS) {
        throw new BadRequestException(
          `Please wait ${Math.ceil(OTP_COOLDOWN_SECONDS - secondsSince)} seconds before requesting a new code`,
        );
      }
    }

    // Generate code
    const code = String(randomInt(100000, 999999));
    const codeHash = this.hash(code);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Invalidate prior unused codes for this email/purpose
    await db
      .update(emailVerifications)
      .set({ isUsed: true })
      .where(
        and(
          eq(emailVerifications.email, email),
          eq(emailVerifications.purpose, purpose),
          eq(emailVerifications.isUsed, false),
        ),
      );

    // Insert new
    await db.insert(emailVerifications).values({
      email,
      codeHash,
      purpose,
      expiresAt,
      ipHash,
    });

    // Send (reuses existing branded OTP template)
    const deviceName = params.userAgent
      ? this.parseDeviceName(params.userAgent)
      : 'Web';
    await this.emailService.sendOTP(email, code, deviceName, params.locale ?? 'en');

    this.logger.log(`OTP issued: email=${email} purpose=${purpose}`);
  }

  /**
   * Verify a code. Returns the verified email on success.
   * Marks the row as used so it can't be reused.
   */
  async verifyCode(params: {
    email: string;
    code: string;
    purpose: Purpose;
  }): Promise<string> {
    const email = this.normalizeEmail(params.email);
    const codeHash = this.hash(params.code.trim());

    const [row] = await db
      .select()
      .from(emailVerifications)
      .where(
        and(
          eq(emailVerifications.email, email),
          eq(emailVerifications.purpose, params.purpose),
          eq(emailVerifications.isUsed, false),
        ),
      )
      .orderBy(sql`${emailVerifications.createdAt} DESC`)
      .limit(1);

    if (!row) {
      throw new UnauthorizedException(
        'No active verification code. Request a new one.',
      );
    }

    if (new Date(row.expiresAt) < new Date()) {
      await db
        .update(emailVerifications)
        .set({ isUsed: true })
        .where(eq(emailVerifications.id, row.id));
      throw new UnauthorizedException(
        'Verification code expired. Request a new one.',
      );
    }

    if (row.attempts >= MAX_ATTEMPTS) {
      await db
        .update(emailVerifications)
        .set({ isUsed: true })
        .where(eq(emailVerifications.id, row.id));
      throw new UnauthorizedException(
        'Too many incorrect attempts. Request a new code.',
      );
    }

    if (row.codeHash !== codeHash) {
      await db
        .update(emailVerifications)
        .set({ attempts: row.attempts + 1 })
        .where(eq(emailVerifications.id, row.id));
      throw new UnauthorizedException('Invalid verification code');
    }

    // Success — mark used
    await db
      .update(emailVerifications)
      .set({ isUsed: true })
      .where(eq(emailVerifications.id, row.id));

    return email;
  }

  private parseDeviceName(userAgent: string): string {
    if (/Mobile|Android|iPhone/i.test(userAgent)) return 'Mobile browser';
    if (/Mac|Windows|Linux/i.test(userAgent)) return 'Desktop browser';
    return 'Web';
  }
}
