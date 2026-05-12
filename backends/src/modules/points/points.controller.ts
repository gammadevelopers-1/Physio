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
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../auth/decorators';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

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
   * Redeem points to unlock a course for free (Phase 2).
   * Body: { courseId }. Returns { redemptionId, enrollmentId, pointsUsed, newBalance }.
   */
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

    // Filter out already-enrolled courses
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
          // Exclude both active and completed — they've already had access
          sql`${enrollments.status} IN ('active', 'completed')`,
        ),
      );
    const enrolledIds = new Set(enrolledRows.map((r) => r.courseId));

    const enriched = candidates
      .filter((c) => !enrolledIds.has(c.id))
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
        };
      })
      // Most-affordable first; affordable ones float to the top
      .sort((a, b) => {
        if (a.affordable !== b.affordable) return a.affordable ? -1 : 1;
        return a.costPoints - b.costPoints;
      });

    return { balance, courses: enriched };
  }
}
