import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { createHash, randomInt } from 'crypto';
import { eq, and, gt, desc } from 'drizzle-orm';
import { db } from '../../database';
import {
  trustedDevices,
  twoFactorChallenges,
  users,
} from '../../database/schema';
import { EmailService } from '../email/email.service';
import { AuditLogService } from '../audit-logs/audit-logs.service';

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  // OTP expiry in minutes
  private readonly OTP_EXPIRY_MINUTES = 10;
  // Max verification attempts per challenge
  private readonly MAX_ATTEMPTS = 3;
  // Rate limit: min seconds between OTP requests per user
  private readonly OTP_COOLDOWN_SECONDS = 60;

  constructor(
    private emailService: EmailService,
    private auditLogService: AuditLogService,
  ) {}

  // ===========================================
  // Device Fingerprinting
  // ===========================================

  /**
   * Generate a SHA-256 fingerprint from User-Agent + device cookie
   */
  generateFingerprint(userAgent: string, deviceCookie: string): string {
    return createHash('sha256')
      .update(`${userAgent}::${deviceCookie}`)
      .digest('hex')
      .substring(0, 64);
  }

  /**
   * Parse a User-Agent string into a human-readable device name
   */
  parseDeviceName(userAgent: string): string {
    if (!userAgent) return 'Unknown Device';

    let browser = 'Unknown Browser';
    let os = 'Unknown OS';

    // Detect browser
    if (userAgent.includes('Edg/')) browser = 'Edge';
    else if (userAgent.includes('OPR/') || userAgent.includes('Opera'))
      browser = 'Opera';
    else if (userAgent.includes('Chrome/') && !userAgent.includes('Edg/'))
      browser = 'Chrome';
    else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome'))
      browser = 'Safari';
    else if (userAgent.includes('Firefox/')) browser = 'Firefox';

    // Detect OS
    if (userAgent.includes('Windows')) os = 'Windows';
    else if (userAgent.includes('Macintosh') || userAgent.includes('Mac OS'))
      os = 'macOS';
    else if (userAgent.includes('Linux') && !userAgent.includes('Android'))
      os = 'Linux';
    else if (userAgent.includes('Android')) os = 'Android';
    else if (
      userAgent.includes('iPhone') ||
      userAgent.includes('iPad') ||
      userAgent.includes('iPod')
    )
      os = 'iOS';

    return `${browser} on ${os}`;
  }

  // ===========================================
  // Trust Management
  // ===========================================

  /**
   * Check if a device fingerprint is trusted for the given user
   */
  async isDeviceTrusted(userId: string, fingerprint: string): Promise<boolean> {
    const [device] = await db
      .select()
      .from(trustedDevices)
      .where(
        and(
          eq(trustedDevices.userId, userId),
          eq(trustedDevices.fingerprint, fingerprint),
        ),
      )
      .limit(1);

    if (device) {
      // Update lastUsedAt
      await db
        .update(trustedDevices)
        .set({ lastUsedAt: new Date() })
        .where(eq(trustedDevices.id, device.id));
      return true;
    }

    return false;
  }

  /**
   * Trust a device for the given user
   */
  async trustDevice(
    userId: string,
    fingerprint: string,
    deviceName: string,
    ipAddress: string,
  ): Promise<void> {
    // Upsert: if device already trusted, update it
    const [existing] = await db
      .select()
      .from(trustedDevices)
      .where(
        and(
          eq(trustedDevices.userId, userId),
          eq(trustedDevices.fingerprint, fingerprint),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(trustedDevices)
        .set({
          deviceName,
          ipAddress,
          lastUsedAt: new Date(),
        })
        .where(eq(trustedDevices.id, existing.id));
    } else {
      await db.insert(trustedDevices).values({
        userId,
        fingerprint,
        deviceName,
        ipAddress,
      });
    }

    this.logger.log(
      `Device trusted for user ${userId}: ${deviceName} (${fingerprint.substring(0, 8)}...)`,
    );
  }

  /**
   * Get all trusted devices for a user.
   * If currentFingerprint is provided, marks the matching device as current.
   */
  async getUserTrustedDevices(userId: string, currentFingerprint?: string) {
    const rows = await db
      .select({
        id: trustedDevices.id,
        fingerprint: trustedDevices.fingerprint,
        deviceName: trustedDevices.deviceName,
        ipAddress: trustedDevices.ipAddress,
        lastUsedAt: trustedDevices.lastUsedAt,
        createdAt: trustedDevices.createdAt,
      })
      .from(trustedDevices)
      .where(eq(trustedDevices.userId, userId))
      .orderBy(desc(trustedDevices.lastUsedAt));

    return rows.map(({ fingerprint, ...device }) => ({
      ...device,
      isCurrentDevice: currentFingerprint
        ? fingerprint === currentFingerprint
        : false,
    }));
  }

  /**
   * Revoke a single trusted device
   */
  async revokeDevice(userId: string, deviceId: string): Promise<void> {
    const [device] = await db
      .select()
      .from(trustedDevices)
      .where(
        and(
          eq(trustedDevices.id, deviceId),
          eq(trustedDevices.userId, userId),
        ),
      )
      .limit(1);

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    await db.delete(trustedDevices).where(eq(trustedDevices.id, deviceId));
  }

  /**
   * Revoke all trusted devices for a user
   */
  async revokeAllDevices(userId: string): Promise<void> {
    await db
      .delete(trustedDevices)
      .where(eq(trustedDevices.userId, userId));
  }

  // ===========================================
  // OTP Challenge
  // ===========================================

  /**
   * Create a new OTP challenge for the user.
   * Sends the OTP via email. Returns the challenge ID.
   */
  async createChallenge(
    userId: string,
    fingerprint: string,
    email: string,
    userAgent: string,
    userLanguage?: string,
  ): Promise<string> {
    // Rate limit: check most recent challenge for this user
    const [recentChallenge] = await db
      .select()
      .from(twoFactorChallenges)
      .where(eq(twoFactorChallenges.userId, userId))
      .orderBy(desc(twoFactorChallenges.createdAt))
      .limit(1);

    if (recentChallenge) {
      const secondsSince =
        (Date.now() - new Date(recentChallenge.createdAt).getTime()) / 1000;
      if (secondsSince < this.OTP_COOLDOWN_SECONDS) {
        throw new BadRequestException(
          `Please wait ${Math.ceil(this.OTP_COOLDOWN_SECONDS - secondsSince)} seconds before requesting a new code`,
        );
      }
    }

    // Generate 6-digit OTP
    const code = String(randomInt(100000, 999999));

    // SHA-256 hash the code before storing
    const codeHash = createHash('sha256').update(code).digest('hex');

    // Set expiry
    const expiresAt = new Date(
      Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000,
    );

    // Invalidate any existing unused challenges for this user
    await db
      .update(twoFactorChallenges)
      .set({ isUsed: true })
      .where(
        and(
          eq(twoFactorChallenges.userId, userId),
          eq(twoFactorChallenges.isUsed, false),
        ),
      );

    // Create the new challenge
    const [challenge] = await db
      .insert(twoFactorChallenges)
      .values({
        userId,
        codeHash,
        fingerprint,
        expiresAt,
      })
      .returning({ id: twoFactorChallenges.id });

    // Send email
    const deviceName = this.parseDeviceName(userAgent);
    const locale = (userLanguage || 'en') as 'en' | 'ar';
    await this.emailService.sendOTP(email, code, deviceName, locale);

    this.logger.log(
      `2FA challenge created for user ${userId} → challenge ${challenge.id}`,
    );

    return challenge.id;
  }

  /**
   * Verify an OTP code against a challenge.
   * Returns true if valid.
   */
  async verifyChallenge(
    challengeId: string,
    code: string,
    fingerprint: string,
  ): Promise<{ userId: string; fingerprint: string }> {
    const [challenge] = await db
      .select()
      .from(twoFactorChallenges)
      .where(eq(twoFactorChallenges.id, challengeId))
      .limit(1);

    if (!challenge) {
      throw new UnauthorizedException('Invalid verification challenge');
    }

    // Check if already used
    if (challenge.isUsed) {
      throw new UnauthorizedException(
        'This verification code has already been used. Please request a new one.',
      );
    }

    // Check expiry
    if (new Date(challenge.expiresAt) < new Date()) {
      throw new UnauthorizedException(
        'Verification code has expired. Please request a new one.',
      );
    }

    // Check max attempts
    if (challenge.attempts >= this.MAX_ATTEMPTS) {
      // Mark as used (invalidated)
      await db
        .update(twoFactorChallenges)
        .set({ isUsed: true })
        .where(eq(twoFactorChallenges.id, challengeId));

      throw new UnauthorizedException(
        'Too many incorrect attempts. Please request a new code.',
      );
    }

    // Hash the submitted code and compare
    const submittedHash = createHash('sha256').update(code).digest('hex');

    if (submittedHash !== challenge.codeHash) {
      // Increment attempts
      await db
        .update(twoFactorChallenges)
        .set({ attempts: challenge.attempts + 1 })
        .where(eq(twoFactorChallenges.id, challengeId));

      const remaining = this.MAX_ATTEMPTS - (challenge.attempts + 1);
      throw new UnauthorizedException(
        remaining > 0
          ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Too many incorrect attempts. Please request a new code.',
      );
    }

    // Mark challenge as used
    await db
      .update(twoFactorChallenges)
      .set({ isUsed: true })
      .where(eq(twoFactorChallenges.id, challengeId));

    return {
      userId: challenge.userId,
      fingerprint: challenge.fingerprint,
    };
  }

  /**
   * Check if 2FA is enabled for a user
   */
  async is2FAEnabled(userId: string): Promise<boolean> {
    const [user] = await db
      .select({ twoFactorEnabled: users.twoFactorEnabled })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user?.twoFactorEnabled ?? true;
  }

  /**
   * Toggle 2FA for a user
   */
  async toggle2FA(
    userId: string,
    enabled: boolean,
  ): Promise<{ twoFactorEnabled: boolean }> {
    await db
      .update(users)
      .set({ twoFactorEnabled: enabled, updatedAt: new Date() })
      .where(eq(users.id, userId));

    if (!enabled) {
      // If disabling 2FA, also remove all trusted devices
      await this.revokeAllDevices(userId);
    }

    // Audit log — best-effort, never blocks the toggle response.
    await this.auditLogService
      .log({
        entityType: 'user',
        entityId: userId,
        action: enabled ? 'auth.2fa_enabled' : 'auth.2fa_disabled',
        performedBy: userId, // self-action (user toggling own 2FA)
      })
      .catch(() => {});

    return { twoFactorEnabled: enabled };
  }
}
