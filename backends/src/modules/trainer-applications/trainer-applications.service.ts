import {
  Injectable,
  Logger,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { db } from '../../database';
import { users, ROLE_NAMES } from '../../database/schema';
import { EmailVerificationService } from '../auth/email-verification.service';
import { RecaptchaService } from '../auth/recaptcha.service';
import { RoleRequestsService } from '../role-requests/role-requests.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { SubmitApplicationDto } from './dto/submit-application.dto';

@Injectable()
export class TrainerApplicationsService {
  private readonly logger = new Logger(TrainerApplicationsService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly recaptchaService: RecaptchaService,
    private readonly roleRequestsService: RoleRequestsService,
  ) {}

  /**
   * Step 1 — Validate captcha + send OTP to applicant's email.
   */
  async requestOtp(
    dto: RequestOtpDto,
    meta: { ipAddress?: string; userAgent?: string },
  ): Promise<{ message: string }> {
    await this.recaptchaService.verify(
      dto.recaptchaToken,
      'trainer-application-request-otp',
    );

    await this.emailVerificationService.issueCode({
      email: dto.email,
      purpose: 'trainer-application',
      locale: (dto.locale as 'en' | 'ar') || 'en',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { message: 'Verification code sent' };
  }

  /**
   * Step 2 — Verify OTP, return short-lived scoped JWT (15 min) authorising
   * file upload + final form submission.
   */
  async verifyOtp(dto: VerifyOtpDto): Promise<{ token: string; email: string }> {
    const verifiedEmail = await this.emailVerificationService.verifyCode({
      email: dto.email,
      code: dto.code,
      purpose: 'trainer-application',
    });

    const token = await this.jwtService.signAsync(
      { purpose: 'trainer-application', email: verifiedEmail },
      { expiresIn: '15m' },
    );

    return { token, email: verifiedEmail };
  }

  /**
   * Step 3 — Submit the actual application. Email comes from the verified
   * scoped JWT, NOT from the form body, so an attacker can't substitute it.
   *
   * If a user already exists with that email, link the application to them.
   * Otherwise create a placeholder user with NO roles in user_roles — they
   * are not a student, instructor, or anything until admin approves.
   */
  async submit(
    verifiedEmail: string,
    dto: SubmitApplicationDto,
  ): Promise<{ requestId: string; userId: string }> {
    const email = verifiedEmail.toLowerCase().trim();

    // Find or create user
    let userId: string;
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      userId = existing.id;
    } else {
      // Create placeholder user with random unguessable password.
      // They'll set a real password via forgot-password flow on approval.
      const profile = dto.profileData as Record<string, string>;
      const firstName = (profile.firstName ||
        profile.fullNameEnglish ||
        email.split('@')[0]) as string;
      const lastName = (profile.lastName || '—') as string;

      const randomPassword = randomBytes(48).toString('hex');
      const passwordHash = await argon2.hash(randomPassword);

      const [created] = await db
        .insert(users)
        .values({
          email,
          passwordHash,
          firstName,
          lastName,
          phone: (profile.mobileNumber as string) || null,
          scfhsNumber: (profile.scfhsNumber as string) || null,
          activeRole: ROLE_NAMES.STUDENT, // label only — no STUDENT row in user_roles
          isVerified: true,
        })
        .returning({ id: users.id });

      userId = created.id;
      // Intentionally NO insert into user_roles — placeholder has zero roles.
      this.logger.log(`Created placeholder user ${userId} for trainer application`);
    }

    // Reuse existing role-requests creation (handles dedup, conflicts, admin notifications)
    const request = await this.roleRequestsService.create(userId, {
      requestedRole: 'INSTRUCTOR',
      profileData: dto.profileData,
      bankData: dto.bankData,
      resumeFiles: dto.resumeFiles,
      structuredResume: dto.structuredResume,
    });

    return { requestId: request.id, userId };
  }
}
