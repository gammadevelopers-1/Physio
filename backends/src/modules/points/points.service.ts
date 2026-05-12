import {
  BadRequestException,
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
      await this.notifications.create({
        recipientId: userId,
        type: 'points_earned',
        title: 'Points earned!',
        message: `+${rule.pointsAmount} points — ${rule.description ?? ruleKey}`,
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
  async redeemCourseForFree(courseId: string, user: AuthenticatedUser) {
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
        'This course is not available for free redemption',
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
      throw new BadRequestException('You are already enrolled in this course');
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
      throw new BadRequestException(
        `Insufficient points: balance ${balance}, need ${cost}`,
      );
    }

    // Step 1 + 2: insert redemption (pending) + ledger debit. Both atomic
    // via db.transaction so no orphaned debit if either insert fails.
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

    // Step 3: Create the enrollment via the canonical service path.
    // This enforces capacity, waitlist, and existing-enrollment rules.
    let enrollment: { id: string };
    try {
      enrollment = (await this.enrollmentsService.createEnrollment(
        courseId,
        user.id,
        user,
      )) as { id: string };
    } catch (err) {
      // Compensate: insert credit, mark redemption released, then re-throw
      this.logger.warn(
        `Enrollment failed during redemption ${redemptionId}, releasing points: ${(err as Error).message}`,
      );
      await this.releaseHold(redemptionId, user.id, cost, 'enrollment_failed');
      throw err;
    }

    // Step 4: commit the redemption to applied
    await db
      .update(pointRedemptions)
      .set({
        status: 'applied',
        enrollmentId: enrollment.id,
        appliedAt: new Date(),
      })
      .where(eq(pointRedemptions.id, redemptionId));

    // Step 5: notify
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
      pointsUsed: cost,
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
