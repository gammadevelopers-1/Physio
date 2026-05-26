import { Injectable } from '@nestjs/common';
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  notLike,
  or,
  sql,
} from 'drizzle-orm';
import { db } from '../../database';
import {
  auditLogs,
  trustedDevices,
  users,
} from '../../database/schema';

export interface SessionRow {
  deviceId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  deviceName: string | null;
  ipAddress: string | null;
  fingerprint: string;
  lastUsedAt: string;
  createdAt: string;
}

export interface FailedLoginRow {
  id: string;
  attemptedEmail: string | null;
  performedById: string;
  ipAddress: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export interface SuspiciousIp {
  ipAddress: string;
  attempts: number;
  lastAttemptAt: string;
}

const DELETED_PREFIX = 'deleted-%@deleted.local';

@Injectable()
export class AdminSecurityService {
  /**
   * Platform-wide list of trusted devices joined with the owning user.
   * Powers the admin Security page's "Sessions" tab so an admin can
   * see every member's logged-in browsers and revoke any of them.
   */
  async listSessions(params: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ rows: SessionRow[]; total: number }> {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const offset = Math.max(params.offset ?? 0, 0);
    const search = params.search?.trim();

    const conditions = [notLike(users.email, DELETED_PREFIX)];
    if (search) {
      const wild = `%${search}%`;
      conditions.push(
        or(
          ilike(users.email, wild),
          ilike(users.firstName, wild),
          ilike(users.lastName, wild),
          ilike(trustedDevices.deviceName, wild),
          ilike(trustedDevices.ipAddress, wild),
        )!,
      );
    }

    const where = and(...conditions);

    const [totalRow] = await db
      .select({ value: count() })
      .from(trustedDevices)
      .innerJoin(users, eq(users.id, trustedDevices.userId))
      .where(where);

    const rows = await db
      .select({
        deviceId: trustedDevices.id,
        userId: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        activeRole: users.activeRole,
        deviceName: trustedDevices.deviceName,
        ipAddress: trustedDevices.ipAddress,
        fingerprint: trustedDevices.fingerprint,
        lastUsedAt: trustedDevices.lastUsedAt,
        createdAt: trustedDevices.createdAt,
      })
      .from(trustedDevices)
      .innerJoin(users, eq(users.id, trustedDevices.userId))
      .where(where)
      .orderBy(desc(trustedDevices.lastUsedAt))
      .limit(limit)
      .offset(offset);

    return {
      total: Number(totalRow.value),
      rows: rows.map((r) => ({
        deviceId: r.deviceId,
        userId: r.userId,
        userName:
          [r.firstName, r.lastName].filter(Boolean).join(' ').trim() ||
          r.email,
        userEmail: r.email,
        userRole: r.activeRole,
        deviceName: r.deviceName,
        ipAddress: r.ipAddress,
        fingerprint: r.fingerprint,
        lastUsedAt: r.lastUsedAt.toISOString(),
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Recent failed-login attempts from audit_logs. We treat any audit row
   * with action='login_failed' as a failed attempt; the metadata column
   * carries the attempted email so the admin can see who was targeted
   * even when no actual user row exists for that address.
   */
  async listFailedLogins(params: {
    limit?: number;
    offset?: number;
    hours?: number;
  }): Promise<{ rows: FailedLoginRow[]; total: number }> {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const offset = Math.max(params.offset ?? 0, 0);
    const hours = Math.min(Math.max(params.hours ?? 24, 1), 24 * 30);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const where = and(
      eq(auditLogs.action, 'login_failed'),
      gte(auditLogs.createdAt, since),
    );

    const [totalRow] = await db
      .select({ value: count() })
      .from(auditLogs)
      .where(where);

    const rows = await db
      .select({
        id: auditLogs.id,
        performedBy: auditLogs.performedBy,
        ipAddress: auditLogs.ipAddress,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      total: Number(totalRow.value),
      rows: rows.map((r) => ({
        id: r.id,
        attemptedEmail:
          typeof r.metadata?.email === 'string'
            ? (r.metadata.email as string)
            : null,
        performedById: r.performedBy,
        ipAddress: r.ipAddress,
        createdAt: r.createdAt.toISOString(),
        metadata: r.metadata as Record<string, unknown> | null,
      })),
    };
  }

  /**
   * IPs with ≥ threshold failed logins in the last 24 hours. Used by
   * the Security page's "Blocked / suspicious IPs" tab as a stand-in
   * until a real IP block-list table exists.
   */
  async listSuspiciousIps(threshold = 5): Promise<SuspiciousIp[]> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await db.execute<{
      ip_address: string;
      attempts: number;
      last_attempt_at: Date;
    }>(sql`
      SELECT ip_address,
             cast(count(*) as int) AS attempts,
             max(created_at) AS last_attempt_at
      FROM audit_logs
      WHERE action = 'login_failed'
        AND created_at >= ${since}
        AND ip_address IS NOT NULL
      GROUP BY ip_address
      HAVING count(*) >= ${threshold}
      ORDER BY attempts DESC, last_attempt_at DESC
      LIMIT 100
    `);

    const list = Array.isArray(rows.rows) ? rows.rows : [];
    return list.map((r: any) => ({
      ipAddress: r.ip_address,
      attempts: Number(r.attempts),
      lastAttemptAt: new Date(r.last_attempt_at).toISOString(),
    }));
  }
}
