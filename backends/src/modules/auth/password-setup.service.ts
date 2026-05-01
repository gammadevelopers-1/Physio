import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { and, eq, gt } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { db } from '../../database';
import {
  emailVerifications,
  users,
  refreshTokens,
  userRoles,
  roles,
} from '../../database/schema';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';

const PURPOSE = 'password-setup';
const TOKEN_EXPIRY_HOURS = 24;

@Injectable()
export class PasswordSetupService {
  private readonly logger = new Logger(PasswordSetupService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Generate a single-use, time-limited token for setting a new password.
   * Returns the plaintext token — caller is responsible for delivering it
   * via email (we store only the hash).
   */
  async issueToken(email: string): Promise<string> {
    const normalizedEmail = email.toLowerCase().trim();
    const token = randomBytes(32).toString('hex'); // 64 hex chars
    const codeHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Invalidate any prior unused tokens for this email + purpose
    await db
      .update(emailVerifications)
      .set({ isUsed: true })
      .where(
        and(
          eq(emailVerifications.email, normalizedEmail),
          eq(emailVerifications.purpose, PURPOSE),
          eq(emailVerifications.isUsed, false),
        ),
      );

    await db.insert(emailVerifications).values({
      email: normalizedEmail,
      codeHash,
      purpose: PURPOSE,
      expiresAt,
    });

    this.logger.log(`Password-setup token issued for ${normalizedEmail}`);
    return token;
  }

  /**
   * Validate a token without consuming it (for the page-load check).
   * Returns the associated email if the token is valid.
   */
  async validateToken(token: string): Promise<{ email: string }> {
    if (!token || token.length < 32) {
      throw new UnauthorizedException('Invalid token');
    }
    const codeHash = createHash('sha256').update(token).digest('hex');
    const [row] = await db
      .select()
      .from(emailVerifications)
      .where(
        and(
          eq(emailVerifications.codeHash, codeHash),
          eq(emailVerifications.purpose, PURPOSE),
          eq(emailVerifications.isUsed, false),
          gt(emailVerifications.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!row) {
      throw new UnauthorizedException('Token is invalid or expired');
    }
    return { email: row.email };
  }

  /**
   * Consume token + set the user's password + return access + refresh tokens.
   * After this, the user is effectively logged in.
   */
  async completeSetup(params: {
    token: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{
    user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      activeRole: string;
      roles: string[];
    };
    accessToken: string;
    refreshToken: string;
  }> {
    if (!params.password || params.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(params.password)) {
      throw new BadRequestException(
        'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      );
    }

    const codeHash = createHash('sha256').update(params.token).digest('hex');

    // Find + lock the verification row
    const [row] = await db
      .select()
      .from(emailVerifications)
      .where(
        and(
          eq(emailVerifications.codeHash, codeHash),
          eq(emailVerifications.purpose, PURPOSE),
          eq(emailVerifications.isUsed, false),
          gt(emailVerifications.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!row) {
      throw new UnauthorizedException('Token is invalid or expired');
    }

    // Look up the user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, row.email))
      .limit(1);
    if (!user) {
      throw new UnauthorizedException('Account not found');
    }

    // Hash + update password
    const passwordHash = await argon2.hash(params.password);
    await db
      .update(users)
      .set({ passwordHash, isVerified: true, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    // Mark token used
    await db
      .update(emailVerifications)
      .set({ isUsed: true })
      .where(eq(emailVerifications.id, row.id));

    // Fetch user roles for token claims
    const userRolesList = (
      await db
        .select({ roleName: roles.name })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, user.id))
    ).map((r) => r.roleName);

    // Issue tokens
    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        activeRole: user.activeRole,
        roles: userRolesList,
      } as any,
      {
        expiresIn:
          (this.configService.get<string>('JWT_ACCESS_EXPIRATION') || '15m') as any,
      },
    );

    const refreshToken = randomBytes(64).toString('hex');
    const refreshExpiresAt = new Date(
      Date.now() +
        parseInt(
          this.configService.get<string>('JWT_REFRESH_EXPIRATION_DAYS') || '7',
        ) *
          24 *
          60 *
          60 *
          1000,
    );
    await db.insert(refreshTokens).values({
      userId: user.id,
      token: refreshToken,
      expiresAt: refreshExpiresAt,
      ipAddress: params.ipAddress,
      deviceInfo: params.userAgent,
    });

    this.logger.log(`Password set + auto-login for user ${user.id}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        activeRole: user.activeRole,
        roles: userRolesList,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Convenience helper used by role-requests after approval — issues the
   * token and sends the email in one call.
   */
  async sendSetupEmail(params: {
    email: string;
    applicantName: string;
    locale: 'en' | 'ar';
  }): Promise<void> {
    const token = await this.issueToken(params.email);
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      'https://physioguidance.org';
    const url = `${frontendUrl}/${params.locale}/set-password?token=${token}`;

    await this.emailService.sendApplicationApprovedSetPassword(
      params.email,
      params.applicantName,
      url,
      params.locale,
    );
  }
}
