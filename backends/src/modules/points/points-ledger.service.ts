import { Injectable, Logger } from '@nestjs/common';
import { and, count, desc, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { db } from '../../database';
import {
  pointTransactions,
  pointRules,
  NewPointTransaction,
} from '../../database/schema';

/**
 * PointsLedgerService — low-level ledger access.
 *
 * Responsible for:
 *  - Inserting transaction rows (with idempotency-key collision handling)
 *  - Computing balances from the ledger
 *  - Reading transaction history
 *
 * NEVER updates or deletes rows. All "changes" are new compensating rows.
 *
 * `getBalance` excludes rows where `expires_at <= NOW()`. Expired rows stay
 * in the ledger for audit but don't count toward the balance.
 */
@Injectable()
export class PointsLedgerService {
  private readonly logger = new Logger(PointsLedgerService.name);

  /**
   * Insert a ledger row. Returns the inserted row, OR null if the
   * idempotency key was already used (the existing row stands).
   */
  async insert(row: NewPointTransaction): Promise<{
    inserted: boolean;
    rowId?: string;
  }> {
    try {
      const [created] = await db
        .insert(pointTransactions)
        .values(row)
        .returning({ id: pointTransactions.id });
      return { inserted: true, rowId: created.id };
    } catch (e) {
      // Postgres unique-violation = idempotency key collision = no-op
      const code = (e as { code?: string })?.code;
      if (code === '23505') {
        this.logger.debug(
          `Idempotent skip for key ${row.idempotencyKey ?? '(none)'}`,
        );
        return { inserted: false };
      }
      throw e;
    }
  }

  /**
   * Sum unexpired ledger deltas for a user.
   * Result is `0` for users with no ledger rows.
   */
  async getBalance(userId: string): Promise<number> {
    const [result] = await db
      .select({
        balance: sql<number>`COALESCE(SUM(${pointTransactions.delta}), 0)`.mapWith(
          Number,
        ),
      })
      .from(pointTransactions)
      .where(
        and(
          eq(pointTransactions.userId, userId),
          or(
            isNull(pointTransactions.expiresAt),
            gt(pointTransactions.expiresAt, new Date()),
          ),
        ),
      );
    return Number(result?.balance ?? 0);
  }

  /**
   * Count ledger rows from a specific rule for a user. Used to enforce
   * `max_per_user` on award rules.
   */
  async countByRule(userId: string, ruleId: string): Promise<number> {
    const [result] = await db
      .select({ c: count() })
      .from(pointTransactions)
      .where(
        and(
          eq(pointTransactions.userId, userId),
          eq(pointTransactions.ruleId, ruleId),
        ),
      );
    return Number(result?.c ?? 0);
  }

  /**
   * Find the most recent ledger row from a specific rule for a user.
   * Used for cooldown enforcement.
   */
  async lastFromRule(userId: string, ruleId: string) {
    const [row] = await db
      .select({ createdAt: pointTransactions.createdAt })
      .from(pointTransactions)
      .where(
        and(
          eq(pointTransactions.userId, userId),
          eq(pointTransactions.ruleId, ruleId),
        ),
      )
      .orderBy(desc(pointTransactions.createdAt))
      .limit(1);
    return row ?? null;
  }

  /**
   * Paginated transaction history for a user with rule metadata joined in.
   */
  async listForUser(
    userId: string,
    params: { page?: number; limit?: number } = {},
  ) {
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
    const page = Math.max(params.page ?? 1, 1);
    const offset = (page - 1) * limit;

    const rows = await db
      .select({
        id: pointTransactions.id,
        delta: pointTransactions.delta,
        reason: pointTransactions.reason,
        sourceEntityType: pointTransactions.sourceEntityType,
        sourceEntityId: pointTransactions.sourceEntityId,
        expiresAt: pointTransactions.expiresAt,
        metadata: pointTransactions.metadata,
        createdAt: pointTransactions.createdAt,
        ruleKey: pointRules.ruleKey,
        ruleDescription: pointRules.description,
        ruleDescriptionAr: pointRules.descriptionAr,
      })
      .from(pointTransactions)
      .leftJoin(pointRules, eq(pointTransactions.ruleId, pointRules.id))
      .where(eq(pointTransactions.userId, userId))
      .orderBy(desc(pointTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalRow] = await db
      .select({ c: count() })
      .from(pointTransactions)
      .where(eq(pointTransactions.userId, userId));

    return {
      data: rows,
      page,
      limit,
      total: Number(totalRow?.c ?? 0),
    };
  }

  /**
   * Sum of positive ledger deltas (earn rows only) from the first
   * moment of the current calendar month, in UTC. Used by the Phase-4
   * hero card's "You've earned +N this month" line. Debits and expiries
   * are excluded — this is a motivational counter, not a net-flow number.
   */
  async earnedThisMonth(userId: string): Promise<number> {
    const [result] = await db
      .select({
        amount: sql<number>`COALESCE(SUM(${pointTransactions.delta}), 0)`.mapWith(
          Number,
        ),
      })
      .from(pointTransactions)
      .where(
        and(
          eq(pointTransactions.userId, userId),
          sql`${pointTransactions.delta} > 0`,
          sql`${pointTransactions.createdAt} >= date_trunc('month', now())`,
        ),
      );
    return Number(result?.amount ?? 0);
  }

  /**
   * Sum of points scheduled to expire within `days` days. Used to surface
   * an "expiring soon" warning on the My Points page.
   */
  async expiringSoonAmount(userId: string, days: number): Promise<number> {
    const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const [result] = await db
      .select({
        amount: sql<number>`COALESCE(SUM(${pointTransactions.delta}), 0)`.mapWith(
          Number,
        ),
      })
      .from(pointTransactions)
      .where(
        and(
          eq(pointTransactions.userId, userId),
          gt(pointTransactions.expiresAt, new Date()),
          sql`${pointTransactions.expiresAt} <= ${cutoff}`,
          // Only positive (earned) rows expire — debits never expire on the user.
          sql`${pointTransactions.delta} > 0`,
        ),
      );
    return Number(result?.amount ?? 0);
  }
}
