import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { db } from '../../database';
import {
  pointRules,
  pointTransactions,
  courses,
  courseRedemptionSettings,
  pointsConfig,
  pointRedemptions,
  enrollments,
  type NewPointTransaction,
} from '../../database/schema';
import { PointsLedgerService } from './points-ledger.service';
import { UserNotificationsService } from '../user-notifications/user-notifications.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { randomUUID } from 'crypto';

/**
 * AwardOptions — passed to PointsService.award() at every earn-hook site.
 *
 * idempotencyKey is REQUIRED at the call site. The convention is:
 *   `${ruleKey}:${sourceEntityId}` — e.g. `course_completed:enrollment-uuid`
 *
 * The ledger's UNIQUE constraint on idempotency_key turns "did we already
 * award this?" into a database invariant. No race conditions, no duplicate
 * awards on cron retries.
 */
export interface AwardOptions {
  idempotencyKey: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  metadata?: Record<string, unknown>;
}

export interface AwardResult {
  awarded: boolean;
  pointsAmount?: number;
  reason: 'inserted' | 'idempotent' | 'rule_inactive' | 'rule_missing' | 'cap_reached' | 'cooldown';
}

/**
 * PointsService — public API for awarding and reading points.
 *
 * Award flow (one method covers all 3 earn hooks):
 *   1. Look up the rule by key. If missing or inactive → no-op (rule_missing/rule_inactive).
 *   2. If `max_per_user` set, count existing ledger rows from this rule.
 *      If at cap → no-op (cap_reached).
 *   3. If `cooldown_seconds` set, check last earn timestamp.
 *      If too recent → no-op (cooldown).
 *   4. Insert ledger row with idempotency key.
 *      DB unique violation → no-op (idempotent — already awarded).
 *   5. Send in-app notification.
 *
 * Award is FIRE-AND-FORGET friendly — it never throws on the soft cases
 * (rule disabled, cap reached, dup key). Hook callers can safely chain it
 * after their core action without wrapping in try/catch.
 */
@Injectable()
export class PointsService {
  private readonly logger = new Logger(PointsService.name);

  constructor(
    private readonly ledger: PointsLedgerService,
    private readonly notifications: UserNotificationsService,
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  /**
   * Award points to a user via a named rule.
   * Returns { awarded: false, reason } when the award was not granted
   * (rule disabled, cap reached, idempotent duplicate, etc.).
   */
  async award(
    userId: string,
    ruleKey: string,
    options: AwardOptions,
  ): Promise<AwardResult> {
    const [rule] = await db
      .select()
      .from(pointRules)
      .where(eq(pointRules.ruleKey, ruleKey))
      .limit(1);

    if (!rule) {
      this.logger.warn(`Award skipped: rule '${ruleKey}' not found`);
      return { awarded: false, reason: 'rule_missing' };
    }
    if (!rule.isActive) {
      return { awarded: false, reason: 'rule_inactive' };
    }

    if (rule.maxPerUser != null) {
      const earned = await this.ledger.countByRule(userId, rule.id);
      if (earned >= rule.maxPerUser) {
        return { awarded: false, reason: 'cap_reached' };
      }
    }

    if (rule.cooldownSeconds && rule.cooldownSeconds > 0) {
      const last = await this.ledger.lastFromRule(userId, rule.id);
      if (last) {
        const elapsedSec = (Date.now() - last.createdAt.getTime()) / 1000;
        if (elapsedSec < rule.cooldownSeconds) {
          return { awarded: false, reason: 'cooldown' };
        }
      }
    }

    const expiresAt = rule.expiresAfterDays
      ? new Date(Date.now() + rule.expiresAfterDays * 24 * 60 * 60 * 1000)
      : null;

    const insert = await this.ledger.insert({
      userId,
      delta: rule.pointsAmount,
      reason: `earn:${ruleKey}`,
      ruleId: rule.id,
      sourceEntityType: options.sourceEntityType,
      sourceEntityId: options.sourceEntityId,
      idempotencyKey: options.idempotencyKey,
      expiresAt,
      metadata: options.metadata as never,
    });

    if (!insert.inserted) {
      return { awarded: false, reason: 'idempotent' };
    }

    // Best-effort notification — failure here shouldn't fail the award.
    try {
      const reason = rule.description ?? ruleKey;
      await this.notifications.create({
        recipientId: userId,
        type: 'points_earned',
        title: 'Points earned!',
        message: `+${rule.pointsAmount} points — ${reason}`,
        titleKey: 'notifications.pointsEarned.title',
        titleParams: {},
        messageKey: 'notifications.pointsEarned.body',
        messageParams: { points: rule.pointsAmount, reason },
        link: `/dashboard/student/invite-friends`,
        entityType: 'point_transaction',
        entityId: insert.rowId ?? null,
      });
    } catch (e) {
      this.logger.warn(
        `Failed to send points_earned notification for ${userId}: ${(e as Error).message}`,
      );
    }

    return {
      awarded: true,
      pointsAmount: rule.pointsAmount,
      reason: 'inserted',
    };
  }

  /**
   * Convenience read — wraps the ledger.
   */
  getBalance(userId: string) {
    return this.ledger.getBalance(userId);
  }

  /**
   * Convenience read — wraps the ledger.
   */
  getHistory(userId: string, params: { page?: number; limit?: number } = {}) {
    return this.ledger.listForUser(userId, params);
  }

  /**
   * Insert a raw ledger row — public wrapper around the ledger service
   * for callers that need to post compensating rows for their own
   * bookkeeping (e.g. course cancel reversals). The idempotency key
   * MUST be unique per logical event so a re-run of the cancellation
   * no-ops instead of double-crediting.
   *
   * For normal earn-hook writes use `award()` — this bypasses the rule
   * lookup, caps, and cooldown, so it's only safe for admin-initiated
   * / system-initiated reversals.
   */
  async insertLedger(row: {
    userId: string;
    delta: number;
    reason: string;
    idempotencyKey: string;
    sourceEntityType?: string;
    sourceEntityId?: string;
    metadata?: unknown;
    createdBy?: string;
  }): Promise<{ inserted: boolean; rowId?: string }> {
    return this.ledger.insert({
      userId: row.userId,
      delta: row.delta,
      reason: row.reason,
      idempotencyKey: row.idempotencyKey,
      sourceEntityType: row.sourceEntityType,
      sourceEntityId: row.sourceEntityId,
      metadata: row.metadata as never,
      createdBy: row.createdBy,
      // Reversals inherit the same non-expiring nature as the underlying
      // debit/credit; expiry only makes sense for earn rules.
      expiresAt: null,
    });
  }

  /**
   * Redeem points to unlock a course for free (Phase 2).
   *
   * Saga (no global transaction; each step is reversible):
   *   1. Validate eligibility (course exists, redeemable_for_free, not already enrolled)
   *   2. Compute cost (per-course override OR price × conversion_rate)
   *   3. Check balance
   *   4. Insert ledger debit + redemption row (status='pending')
   *   5. Call EnrollmentsService.createEnrollment() — handles capacity / waitlist
   *   6. On success: redemption status → 'applied', enrollmentId set
   *   7. On enrollment failure: insert compensating credit, redemption → 'released'
   *
   * The compensating credit on failure means a student never loses points to
   * an enrollment that didn't go through (e.g. course at capacity).
   */
  async redeemCourseForFree(
    courseId: string,
    user: AuthenticatedUser,
    options: { source?: 'points_redemption' | 'reward' } = {},
  ) {
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    if (!course) throw new NotFoundException('Course not found');

    const [redemptionSettings] = await db
      .select()
      .from(courseRedemptionSettings)
      .where(eq(courseRedemptionSettings.courseId, courseId))
      .limit(1);
    if (!redemptionSettings || !redemptionSettings.redeemableForFree) {
      throw new BadRequestException(
        'This course is not available for point redemption',
      );
    }

    const [existing] = await db
      .select({ id: enrollments.id, status: enrollments.status })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, courseId),
          eq(enrollments.studentId, user.id),
        ),
      )
      .limit(1);
    if (existing && (existing.status === 'active' || existing.status === 'completed')) {
      // 409 (not 400) so the FE can distinguish "you already own this" from
      // "your input was invalid" and route the buyer straight to the course.
      throw new ConflictException({
        code: 'ALREADY_ENROLLED',
        message: 'You are already enrolled in this course',
        enrollmentId: existing.id,
      });
    }

    const [config] = await db.select().from(pointsConfig).limit(1);
    const conversionRate = config?.conversionRatePointsPerSar ?? 10;
    const priceNum = Number(course.price ?? 0);
    const computedCost = Math.ceil(priceNum * conversionRate);
    const cost = redemptionSettings.freeUnlockCostPoints ?? computedCost;

    if (cost <= 0) {
      throw new BadRequestException('Course cost cannot be zero');
    }

    const balance = await this.ledger.getBalance(user.id);
    if (balance < cost) {
      const deficit = cost - balance;
      // Structured shape so the FE can render "Earn X more points to unlock"
      // and dedicated toast copy without regex-scraping the message string.
      throw new BadRequestException({
        code: 'INSUFFICIENT_POINTS',
        message: `You need ${deficit} more point${deficit === 1 ? '' : 's'} to redeem this course`,
        required: cost,
        balance,
        deficit,
      });
    }

    // Atomic hold: insert the redemption row + the ledger debit in a single
    // DB transaction. If either write fails the whole thing rolls back so
    // no orphaned debit or unbacked hold row can survive a crash mid-write.
    const redemptionId = randomUUID();
    const debitIdempotencyKey = `redeem_hold:${redemptionId}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

    await db.transaction(async (tx) => {
      await tx.insert(pointRedemptions).values({
        id: redemptionId,
        userId: user.id,
        courseId,
        pointsUsed: cost,
        discountAmountSar: String(priceNum),
        status: 'pending',
        expiresAt,
      });

      const debitRow: NewPointTransaction = {
        userId: user.id,
        delta: -cost,
        reason: 'redeem:hold',
        sourceEntityType: 'redemption',
        sourceEntityId: redemptionId,
        idempotencyKey: debitIdempotencyKey,
      };
      await tx.insert(pointTransactions).values(debitRow);
    });

    // Enrollment. Delegates to EnrollmentsService which enforces capacity,
    // waitlist, and existing-enrollment rules and fires the auto-webinar
    // registration + xAPI 'registered' hooks the paid path relies on.
    // We tag the source as 'points_redemption' by default; the reward
    // catalog's free_course flow passes `source: 'reward'` so the FE
    // shows an amber "reward" chip instead of the violet "points" one.
    const source = options.source ?? 'points_redemption';
    let enrollment: { id: string };
    try {
      enrollment = (await this.enrollmentsService.createEnrollment(
        courseId,
        user.id,
        user,
        { source },
      )) as { id: string };
    } catch (err) {
      // Compensate: refund the hold + mark the redemption 'released'. The
      // shape mirrors the reward-fulfilment saga so both flows leave the
      // ledger balanced even under partial failure.
      this.logger.warn(
        `Enrollment failed during redemption ${redemptionId}, releasing points: ${(err as Error).message}`,
      );
      await this.releaseHold(redemptionId, user.id, cost, 'enrollment_failed');
      throw err;
    }

    // Commit: flip the redemption row to 'applied' + insert a permanent
    // marker ledger row so the ledger view shows "Committed" rather than a
    // dangling 'hold' whose meaning depends on the redemption row's state.
    // The paymentReference is the enrollment id — that's what finance
    // reports join on when reconciling point spend to seat count.
    await db.transaction(async (tx) => {
      await tx
        .update(pointRedemptions)
        .set({
          status: 'applied',
          enrollmentId: enrollment.id,
          appliedAt: new Date(),
        })
        .where(eq(pointRedemptions.id, redemptionId));

      const commitRow: NewPointTransaction = {
        userId: user.id,
        // Zero delta — the hold above already moved the balance. This row
        // is a bookkeeping marker linking the enrollment to the debit for
        // audit + reporting.
        delta: 0,
        reason: 'redeem:course:committed',
        sourceEntityType: 'enrollment',
        sourceEntityId: enrollment.id,
        idempotencyKey: `redeem_committed:${redemptionId}`,
        metadata: { redemptionId, courseId, cost } as never,
      };
      await tx.insert(pointTransactions).values(commitRow);
    });

    // Notify — best-effort, never blocks the redemption.
    try {
      await this.notifications.create({
        recipientId: user.id,
        type: 'points_redeemed',
        title: 'Course unlocked!',
        message: `You redeemed ${cost} points to unlock "${course.title}"`,
        link: `/dashboard/student/courses/${courseId}`,
        entityType: 'point_redemption',
        entityId: redemptionId,
      });
    } catch (e) {
      this.logger.warn(
        `points_redeemed notification failed: ${(e as Error).message}`,
      );
    }

    return {
      redemptionId,
      enrollmentId: enrollment.id,
      courseId,
      pointsUsed: cost,
      // FE-friendly alias — matches the field the CourseDetail confirm modal
      // shows in the success toast without needing a follow-up balance fetch.
      pointsSpent: cost,
      newBalance: balance - cost,
    };
  }

  /**
   * Insert a compensating credit row to release a held redemption.
   * Sets the redemption row's status to 'released'.
   */
  private async releaseHold(
    redemptionId: string,
    userId: string,
    points: number,
    reasonCode: string,
  ) {
    await this.ledger.insert({
      userId,
      delta: points,
      reason: 'redeem:released',
      sourceEntityType: 'redemption',
      sourceEntityId: redemptionId,
      idempotencyKey: `redeem_released:${redemptionId}`,
      metadata: { reasonCode } as never,
    });
    await db
      .update(pointRedemptions)
      .set({ status: 'released', releasedAt: new Date() })
      .where(eq(pointRedemptions.id, redemptionId));
  }
}
