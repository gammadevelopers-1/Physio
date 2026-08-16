import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { and, eq, isNotNull } from 'drizzle-orm';
import { db, users } from '../../database';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { EmailService } from '../email/email.service';

/**
 * PDPL Article 12 — Right to Erasure.
 *
 * Flow:
 *  1. requestErasure() — user re-authenticates with password; we mark
 *     deleted_at + isActive=false and email them a signed cancel token
 *     (30-day validity). All access is blocked immediately (isActive
 *     is already checked by existing auth guards).
 *  2. cancelErasure() — clicking the email link within 30 days restores
 *     the account (clears deleted_at + isActive=true).
 *  3. Hard delete after grace — handled by an admin-triggered operation
 *     (NOT this service). 68 tables reference users; each cascade must
 *     be audited individually before physical row removal.
 *
 * Every state change writes to audit_logs so the auditor can prove the
 * request was received and honoured on schedule.
 */
@Injectable()
export class ErasureService {
  private readonly logger = new Logger(ErasureService.name);
  private static readonly TOKEN_PURPOSE = 'account_erasure_cancel';
  private static readonly GRACE_DAYS = 30;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditLog: AuditLogService,
    private readonly emailService: EmailService,
  ) {}

  async requestErasure(
    userId: string,
    password: string,
    reason: string | undefined,
    ipAddress?: string,
  ): Promise<{ scheduledHardDeleteAt: string }> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw new UnauthorizedException('User not found');
    if (user.deletedAt) {
      throw new BadRequestException(
        'Account is already pending deletion. Check your email for the cancel link.',
      );
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Password is incorrect');
    }

    const deletedAt = new Date();
    await db
      .update(users)
      .set({
        deletedAt,
        deletionReason: reason ?? null,
        isActive: false,
        updatedAt: deletedAt,
      })
      .where(eq(users.id, userId));

    const cancelToken = this.jwtService.sign(
      { userId, purpose: ErasureService.TOKEN_PURPOSE },
      { expiresIn: `${ErasureService.GRACE_DAYS}d` },
    );

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      'https://physioguidance.org';
    const cancelUrl = `${frontendUrl}/account/cancel-deletion?token=${cancelToken}`;

    const scheduledHardDelete = new Date(
      deletedAt.getTime() + ErasureService.GRACE_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.auditLog.log({
      entityType: 'user',
      entityId: userId,
      action: 'right_to_erasure_requested',
      performedBy: userId,
      metadata: {
        reason: reason ?? null,
        scheduledHardDeleteAt: scheduledHardDelete.toISOString(),
      },
      ipAddress,
    });

    try {
      await this.emailService.sendAccountErasureConfirmation(
        user.email,
        user.firstName ?? '',
        cancelUrl,
        scheduledHardDelete,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send erasure confirmation email to ${user.email} — request is recorded regardless.`,
        err,
      );
    }

    return { scheduledHardDeleteAt: scheduledHardDelete.toISOString() };
  }

  async cancelErasure(
    token: string,
    ipAddress?: string,
  ): Promise<{ restored: boolean }> {
    let payload: { userId?: string; purpose?: string };
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new BadRequestException('Cancel link is invalid or expired.');
    }

    if (payload.purpose !== ErasureService.TOKEN_PURPOSE || !payload.userId) {
      throw new BadRequestException('Cancel link is invalid.');
    }

    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, payload.userId), isNotNull(users.deletedAt)))
      .limit(1);

    if (!user) {
      throw new BadRequestException(
        'Account is not pending deletion, or was already hard-deleted.',
      );
    }

    await db
      .update(users)
      .set({
        deletedAt: null,
        deletionReason: null,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    await this.auditLog.log({
      entityType: 'user',
      entityId: user.id,
      action: 'right_to_erasure_cancelled',
      performedBy: user.id,
      metadata: {},
      ipAddress,
    });

    return { restored: true };
  }
}
