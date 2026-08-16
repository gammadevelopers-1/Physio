import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '../../database';
import { auditLogs } from '../../database/schema/audit-logs';
import { users } from '../../database/schema/users';

/**
 * PDPL — admin/audit visibility over privacy-related requests.
 *
 * Every erasure/portability/consent action already writes a row to
 * `audit_logs` (see ErasureService, DataExportService, ConsentsService).
 * This service exposes that trail so an auditor can prove requests are
 * being received and honoured within statutory deadlines — no need to
 * hand-grep the DB during an inspection.
 *
 * Uses fixed prefix `pdpl.` and hard-coded action list rather than a
 * LIKE scan for two reasons: (1) actions are a controlled vocabulary
 * we own, and (2) an accidental new `pdpl.*` action shouldn't quietly
 * appear on the auditor's report until we've documented what it means.
 */
// Values must match the exact strings written by ErasureService (legacy
// two names) and pdpl.* prefixed strings written by DataExportService /
// ConsentsService. If a new PDPL action is added, add it here explicitly
// so it appears on the auditor report — the report is a closed-list view.
const PDPL_ACTIONS = [
  'right_to_erasure_requested',
  'right_to_erasure_cancelled',
  'right_to_portability_export',
  'pdpl.consent_granted',
  'pdpl.consent_withdrawn',
] as const;

type PdplAction = (typeof PDPL_ACTIONS)[number];

interface RequestFilter {
  action?: PdplAction;
  userId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class PdplAdminService {
  async listRequests(filter: RequestFilter): Promise<{
    total: number;
    requests: Array<{
      id: string;
      action: string;
      userId: string;
      userEmail: string | null;
      metadata: unknown;
      ipAddress: string | null;
      createdAt: string;
    }>;
  }> {
    const limit = Math.min(filter.limit ?? 50, 500);
    const offset = filter.offset ?? 0;

    const conditions = [
      filter.action
        ? eq(auditLogs.action, filter.action)
        : inArray(auditLogs.action, [...PDPL_ACTIONS]),
      filter.userId ? eq(auditLogs.performedBy, filter.userId) : undefined,
      filter.from ? gte(auditLogs.createdAt, filter.from) : undefined,
      filter.to ? lte(auditLogs.createdAt, filter.to) : undefined,
    ].filter((c): c is NonNullable<typeof c> => c !== undefined);

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [{ total }] = await db
      .select({ total: count() })
      .from(auditLogs)
      .where(whereClause);

    const rows = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        userId: auditLogs.performedBy,
        userEmail: users.email,
        metadata: auditLogs.metadata,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.performedBy, users.id))
      .where(whereClause)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      total: Number(total),
      requests: rows.map((r) => ({
        id: r.id,
        action: r.action,
        userId: r.userId ?? '',
        userEmail: r.userEmail,
        metadata: r.metadata,
        ipAddress: r.ipAddress,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Summary counters for the admin dashboard tile — how many privacy
   * requests received in the given window, broken down by action.
   */
  async getSummary(from: Date, to: Date): Promise<{
    from: string;
    to: string;
    byAction: Record<string, number>;
    total: number;
  }> {
    const rows = await db
      .select({
        action: auditLogs.action,
        n: count(),
      })
      .from(auditLogs)
      .where(
        and(
          inArray(auditLogs.action, [...PDPL_ACTIONS]),
          gte(auditLogs.createdAt, from),
          lte(auditLogs.createdAt, to),
        ),
      )
      .groupBy(auditLogs.action);

    const byAction: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      byAction[r.action] = Number(r.n);
      total += Number(r.n);
    }
    for (const a of PDPL_ACTIONS) {
      if (byAction[a] == null) byAction[a] = 0;
    }
    return { from: from.toISOString(), to: to.toISOString(), byAction, total };
  }
}

export { PDPL_ACTIONS, PdplAction };
