import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { and, eq, gte } from 'drizzle-orm';
import { db, users } from '../../database';
import { enrollments } from '../../database/schema/enrollments';
import { certificateRequests } from '../../database/schema/certificate-requests';
import { attendance } from '../../database/schema/attendance';
import { userConsents } from '../../database/schema/user-consents';
import { userPreferences } from '../../database/schema/user-preferences';
import { auditLogs } from '../../database/schema/audit-logs';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { decryptPII } from '../../common/crypto';

/**
 * PDPL Article 13 — Right to Data Portability.
 *
 * Returns the authenticated user's personal data in machine-readable
 * JSON. Includes profile, enrollments, certificate requests,
 * attendance, consents, preferences, and their own audit actions.
 *
 * Excludes:
 *  - Other users' PII (co-attendee names in shared sessions are dropped)
 *  - Internal system columns (password_hash, refresh_tokens, OTP codes)
 *  - Platform-side audit entries about them (retained for legal
 *    compliance; only actions they PERFORMED are included)
 *  - Payment records (financial data — separate compliance path per
 *    SAMA / ZATCA record-retention; included in follow-up when the
 *    invoice service exposes a per-user query)
 *
 * Rate limit: one export per 24h, enforced via audit_logs lookup.
 */
@Injectable()
export class DataExportService {
  private readonly logger = new Logger(DataExportService.name);
  private static readonly RATE_LIMIT_HOURS = 24;
  private static readonly ACTION = 'right_to_portability_export';

  constructor(private readonly auditLog: AuditLogService) {}

  async exportUserData(userId: string, ipAddress?: string) {
    await this.enforceRateLimit(userId);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    const [
      enrollmentRows,
      certificateRows,
      attendanceRows,
      consentRows,
      preferenceRows,
      selfAuditRows,
    ] = await Promise.all([
      db.select().from(enrollments).where(eq(enrollments.studentId, userId)),
      db
        .select()
        .from(certificateRequests)
        .where(eq(certificateRequests.studentId, userId)),
      db.select().from(attendance).where(eq(attendance.studentId, userId)),
      db.select().from(userConsents).where(eq(userConsents.userId, userId)),
      db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, userId)),
      db.select().from(auditLogs).where(eq(auditLogs.performedBy, userId)),
    ]);

    const bundle = {
      exportMeta: {
        generatedAt: new Date().toISOString(),
        userId,
        legalBasis: 'PDPL Article 13 (Right to Data Portability)',
        format: 'JSON v1',
        notes:
          "Contains only personal data belonging to this user. Other users' PII, system internals, and platform-side audit entries about this user (retained for legal compliance) are intentionally excluded.",
      },
      profile: this.sanitizeProfile(user),
      enrollments: enrollmentRows,
      certificateRequests: certificateRows,
      attendance: attendanceRows,
      consents: consentRows,
      preferences: preferenceRows,
      actionsIPerformed: selfAuditRows,
    };

    await this.auditLog.log({
      entityType: 'user',
      entityId: userId,
      action: DataExportService.ACTION,
      performedBy: userId,
      metadata: {
        rowCounts: {
          enrollments: enrollmentRows.length,
          certificateRequests: certificateRows.length,
          attendance: attendanceRows.length,
          consents: consentRows.length,
          preferences: preferenceRows.length,
          selfAudit: selfAuditRows.length,
        },
      },
      ipAddress,
    });

    return bundle;
  }

  private sanitizeProfile(user: typeof users.$inferSelect) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      firstNameAr: user.firstNameAr,
      lastNameAr: user.lastNameAr,
      phone: decryptPII(user.phone),
      avatar: user.avatar,
      bio: user.bio,
      location: user.location,
      language: user.language,
      scfhsNumber: decryptPII(user.scfhsNumber),
      nationalId: decryptPII(user.nationalId),
      nationality: user.nationality,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      department: user.department,
      specialty: user.specialty,
      profession: user.profession,
      qualification: user.qualification,
      twitter: user.twitter,
      linkedin: user.linkedin,
      activeRole: user.activeRole,
      isVerified: user.isVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      zoomEmail: user.zoomEmail,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  private async enforceRateLimit(userId: string): Promise<void> {
    const since = new Date(
      Date.now() - DataExportService.RATE_LIMIT_HOURS * 60 * 60 * 1000,
    );

    const [recent] = await db
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.performedBy, userId),
          eq(auditLogs.action, DataExportService.ACTION),
          gte(auditLogs.createdAt, since),
        ),
      )
      .limit(1);

    if (recent) {
      throw new HttpException(
        {
          message: `Data export is limited to one per ${DataExportService.RATE_LIMIT_HOURS} hours. Try again later.`,
          code: 'PDPL_EXPORT_RATE_LIMIT',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
