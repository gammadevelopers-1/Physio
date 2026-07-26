import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RedeemCourseDto } from './dto';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../database';
import {
  courses,
  courseRedemptionSettings,
  enrollments,
  pointRules,
  pointsConfig,
} from '../../database/schema';
import { PointsService } from './points.service';
import { PointsLedgerService } from './points-ledger.service';
import { RewardsService } from './rewards/rewards.service';
import { RedeemRewardDto } from './rewards/dto/reward.dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../auth/decorators';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Param } from '@nestjs/common';

/**
 * Student-facing points endpoints. All require authentication; no role
 * restriction so non-student roles (e.g. instructor browsing the demo)
 * still get a sensible empty balance rather than a 403.
 */
@Controller('points/me')
@UseGuards(JwtAuthGuard)
export class PointsController {
  constructor(
    private readonly points: PointsService,
    private readonly ledger: PointsLedgerService,
    private readonly rewards: RewardsService,
  ) {}

  @Get('balance')
  async getBalance(@CurrentUser() user: AuthenticatedUser) {
    const [balance, expiringSoon] = await Promise.all([
      this.points.getBalance(user.id),
      this.ledger.expiringSoonAmount(user.id, 30),
    ]);
    return { balance, expiringSoon };
  }

  /**
   * Phase-4 hero summary — `balance` + `earnedThisMonth`. The month
   * counter sums positive ledger deltas from `date_trunc('month', now())`.
   * Debits (redemptions) and expiries are excluded. Separate from
   * `/balance` because that endpoint is used elsewhere and its shape is
   * load-bearing; this one is dedicated to the My Points hero card.
   */
  @Get()
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    const [balance, earnedThisMonth] = await Promise.all([
      this.points.getBalance(user.id),
      this.ledger.earnedThisMonth(user.id),
    ]);
    return { balance, earnedThisMonth };
  }

  /**
   * Active earn rules — used by the student MyPoints page to display
   * current point amounts. Returns only `is_active = true` rules so a
   * disabled rule doesn't show in the "How to earn" section.
   */
  @Get('rules')
  async getActiveRules() {
    return db
      .select({
        ruleKey: pointRules.ruleKey,
        pointsAmount: pointRules.pointsAmount,
        description: pointRules.description,
        descriptionAr: pointRules.descriptionAr,
        expiresAfterDays: pointRules.expiresAfterDays,
        maxPerUser: pointRules.maxPerUser,
      })
      .from(pointRules)
      .where(eq(pointRules.isActive, true))
      .orderBy(asc(pointRules.ruleKey));
  }

  @Get('transactions')
  async getTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.points.getHistory(user.id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  /**
   * Courses this user could unlock right now using points.
   *
   * A course shows up here only when:
   *  - Admin has enabled it (course_redemption_settings.redeemable_for_free = true)
   *  - User has enough points to cover the cost
   *  - User is not already enrolled
   *
   * Cost is `free_unlock_cost_points` if the per-course override is set;
   * otherwise it's `price × conversion_rate_points_per_sar` from global config.
   */
  /**
   * Redeem points to unlock a course.
   *
   * Two shapes accepted — the RESTful path-param variant is the one the FE
   * uses for the "Redeem for X points" CTA on the course-detail page; the
   * body-based shape is kept for backward compat with earlier callers.
   *
   * Returns { redemptionId, enrollmentId, courseId, pointsSpent, pointsUsed,
   *          newBalance }. See PointsService.redeemCourseForFree for the
   * atomic hold→commit→marker saga and the compensating-credit fallback.
   */
  @Post('redeem-course/:courseId')
  @HttpCode(HttpStatus.CREATED)
  async redeemCourseByPath(
    @Param('courseId') courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.points.redeemCourseForFree(courseId, user);
  }

  @Post('redeem-course')
  @HttpCode(HttpStatus.CREATED)
  async redeemCourse(
    @Body() dto: RedeemCourseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.points.redeemCourseForFree(dto.courseId, user);
  }

  @Get('redeemable-courses')
  async getRedeemableCourses(@CurrentUser() user: AuthenticatedUser) {
    const balance = await this.ledger.getBalance(user.id);

    const [config] = await db.select().from(pointsConfig).limit(1);
    const conversionRate = config?.conversionRatePointsPerSar ?? 10;

    // All redeemable-eligible courses with their settings + price
    const candidates = await db
      .select({
        id: courses.id,
        title: courses.title,
        titleAr: courses.titleAr,
        thumbnail: courses.thumbnail,
        deliveryType: courses.deliveryType,
        price: courses.price,
        cmeHours: courses.cmeHours,
        isCmeAccredited: courses.isCmeAccredited,
        freeUnlockCostPoints: courseRedemptionSettings.freeUnlockCostPoints,
      })
      .from(courseRedemptionSettings)
      .innerJoin(courses, eq(courseRedemptionSettings.courseId, courses.id))
      .where(
        and(
          eq(courseRedemptionSettings.redeemableForFree, true),
          eq(courses.status, 'active'),
        ),
      );

    if (candidates.length === 0) {
      return { balance, courses: [] };
    }

    // Look up which candidates the user is already enrolled in. We keep
    // enrolled courses in the response (rather than filtering them out)
    // and mark them with `alreadyEnrolled: true` so the Phase-4 grid can
    // render an "Enrolled" badge in place of the redeem CTA.
    const enrolledRows = await db
      .select({ courseId: enrollments.courseId })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, user.id),
          inArray(
            enrollments.courseId,
            candidates.map((c) => c.id),
          ),
          // Active + completed count as "already had access".
          sql`${enrollments.status} IN ('active', 'completed')`,
        ),
      );
    const enrolledIds = new Set(enrolledRows.map((r) => r.courseId));

    const enriched = candidates
      .map((c) => {
        const priceNum = Number(c.price ?? 0);
        const computedCost = Math.ceil(priceNum * conversionRate);
        const cost = c.freeUnlockCostPoints ?? computedCost;
        return {
          id: c.id,
          title: c.title,
          titleAr: c.titleAr,
          thumbnail: c.thumbnail,
          deliveryType: c.deliveryType,
          price: priceNum,
          cmeHours: c.cmeHours,
          isCmeAccredited: c.isCmeAccredited,
          costPoints: cost,
          affordable: balance >= cost,
          alreadyEnrolled: enrolledIds.has(c.id),
        };
      })
      // Sort priority: not-enrolled first, then affordable first, then
      // cheapest. Enrolled cards drop to the tail since the CTA is gone.
      .sort((a, b) => {
        if (a.alreadyEnrolled !== b.alreadyEnrolled)
          return a.alreadyEnrolled ? 1 : -1;
        if (a.affordable !== b.affordable) return a.affordable ? -1 : 1;
        return a.costPoints - b.costPoints;
      });

    return { balance, courses: enriched };
  }

  // ─── Rewards catalog ───────────────────────────────────────────
  //
  // These are separate from the free-course path above: the catalog
  // is admin-curated (any type — coupon / free_course / free_webinar
  // / other) and each item has its own points_cost + per-user cap.
  // Free-course rewards internally delegate to redeemCourseForFree.

  @Get('rewards')
  async getRewards(@CurrentUser() user: AuthenticatedUser) {
    return this.rewards.listForUser(user);
  }

  @Get('rewards/redemptions')
  async getMyRedemptions(@CurrentUser() user: AuthenticatedUser) {
    return this.rewards.listUserRedemptions(user.id);
  }

  /**
   * Paginated My-Rewards history with per-type projections. Backs the
   * dedicated /dashboard/student/my-rewards page. Unlike the barer
   * `rewards/redemptions` endpoint above (still used by other surfaces),
   * this one enriches each row with the resolved artifact (coupon status,
   * course thumbnail, webinar session details, etc).
   */
  @Get('rewards/history')
  async getMyRewardHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.rewards.listMyRewardHistory(
      user.id,
      Number(page || 1),
      Number(limit || 20),
    );
  }

  @Post('rewards/:id/redeem')
  @HttpCode(HttpStatus.CREATED)
  async redeemReward(
    @Param('id') id: string,
    @Body() dto: RedeemRewardDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rewards.redeem(id, user, {
      selectedCourseId: dto.selectedCourseId,
      selectedDeliveryType: dto.selectedDeliveryType,
    });
  }
}
