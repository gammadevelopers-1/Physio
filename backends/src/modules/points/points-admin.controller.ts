import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { and, asc, desc, eq, gt, gte, ilike, isNull, lte, or, sql, count, inArray } from 'drizzle-orm';
import { Response } from 'express';
import { db } from '../../database';
import {
  pointRules,
  pointsConfig,
  pointRedemptions,
  courses,
  courseRedemptionSettings,
  enrollments,
  sessions,
  users,
  userRoles,
  roles,
  ROLE_NAMES,
} from '../../database/schema';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { CurrentUser, Roles } from '../auth/decorators';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { UserRole } from '../../database/schema';
import { PointsService } from './points.service';
import { PointsLedgerService } from './points-ledger.service';
import { RewardsService } from './rewards/rewards.service';
import { CreateRewardDto, TransitionRedemptionDto, UpdateRewardDto } from './rewards/dto/reward.dto';
import { Delete } from '@nestjs/common';
import { CSV_CONTENT_TYPE, toCsvBuffer } from '../../common/exports/csv.util';
import {
  GrantPointsDto,
  UpdateConfigDto,
  UpdateCourseRedemptionDto,
  UpdateRuleDto,
} from './dto';

/**
 * Admin endpoints for the Points System.
 * - Earn rules CRUD (read + patch — keys are seeded, never deleted)
 * - Singleton config patch
 * - Manual point grant (positive or negative delta)
 * - User audit (read any user's ledger)
 */
@SkipThrottle()
@Controller('admin/points')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN' as UserRole, 'SUPER_ADMIN' as UserRole)
export class PointsAdminController {
  constructor(
    private readonly points: PointsService,
    private readonly ledger: PointsLedgerService,
    private readonly rewards: RewardsService,
  ) {}

  // ─── Rules ───────────────────────────────────────────────

  @Get('rules')
  async listRules() {
    const rows = await db.select().from(pointRules).orderBy(pointRules.ruleKey);
    return rows;
  }

  @Patch('rules/:ruleKey')
  async updateRule(
    @Param('ruleKey') ruleKey: string,
    @Body() dto: UpdateRuleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const [updated] = await db
      .update(pointRules)
      .set({
        ...dto,
        updatedAt: new Date(),
        updatedBy: user.id,
      })
      .where(eq(pointRules.ruleKey, ruleKey))
      .returning();
    if (!updated) {
      throw new NotFoundException(`Point rule '${ruleKey}' not found`);
    }
    return updated;
  }

  // ─── Config (singleton) ──────────────────────────────────

  @Get('config')
  async getConfig() {
    const [row] = await db.select().from(pointsConfig).limit(1);
    if (!row) {
      // Seed-time invariant — should never happen post-seed
      throw new NotFoundException(
        'points_config singleton missing — run db:seed',
      );
    }
    return row;
  }

  @Patch('config')
  async updateConfig(
    @Body() dto: UpdateConfigDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const [updated] = await db
      .update(pointsConfig)
      .set({
        ...dto,
        updatedAt: new Date(),
        updatedBy: user.id,
      })
      .where(eq(pointsConfig.id, 1))
      .returning();
    return updated;
  }

  // ─── Manual grant / deduction ────────────────────────────

  @Post('grant')
  @HttpCode(HttpStatus.CREATED)
  async grant(
    @Body() dto: GrantPointsDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    if (dto.delta === 0) {
      throw new BadRequestException('delta cannot be 0');
    }

    // Student-only: points are a learner-engagement mechanism. Granting
    // points to an instructor / manager / TA is a class of mistake we
    // can prevent at the API layer rather than relying on UI hygiene.
    const isStudent = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(and(eq(users.id, dto.userId), eq(roles.name, ROLE_NAMES.STUDENT)))
      .limit(1);
    if (isStudent.length === 0) {
      throw new BadRequestException(
        'Points can only be granted to users with the STUDENT role',
      );
    }

    // For deductions, ensure the user has enough — otherwise we'd allow
    // negative balances which break invariants.
    if (dto.delta < 0) {
      const balance = await this.ledger.getBalance(dto.userId);
      if (balance + dto.delta < 0) {
        throw new BadRequestException(
          `Cannot deduct ${Math.abs(dto.delta)} — user only has ${balance}`,
        );
      }
    }

    const reason = dto.delta > 0 ? 'admin:grant' : 'admin:deduct';
    // Manual grants get a unique idempotency key per call (timestamp +
    // admin id) so support staff can issue repeated grants without
    // collisions.
    const idempotencyKey = `${reason}:${admin.id}:${Date.now()}`;

    const result = await this.ledger.insert({
      userId: dto.userId,
      delta: dto.delta,
      reason,
      idempotencyKey,
      metadata: { reason: dto.reason } as never,
      createdBy: admin.id,
    });
    return { rowId: result.rowId };
  }

  // ─── Per-course redemption settings ───────────────────────

  /**
   * List courses with their redemption settings (LEFT JOIN — most courses
   * won't have a row in course_redemption_settings yet, so we get nulls).
   */
  @Get('courses')
  async listCoursesWithRedemption(@Query('search') search?: string) {
    // Reward-picker eligibility: any active, non-deleted course whose
    // enrollment deadline hasn't passed. We deliberately do NOT filter on
    // price=0 — free courses are legitimate points-reward targets (e.g.
    // bundling a free intro course into a rewards catalog entry).
    const now = new Date();
    const where = and(
      eq(courses.status, 'active'),
      isNull(courses.deletedAt),
      or(isNull(courses.enrollmentDeadline), gt(courses.enrollmentDeadline, now))!,
      search
        ? or(
            ilike(courses.title, `%${search}%`),
            ilike(courses.titleAr, `%${search}%`),
          )
        : undefined,
    );

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Correlated subquery for the 30-day redemption count. Cheaper than a
    // GROUP BY + LEFT JOIN when the redemptions table is much smaller than
    // the courses page and keeps the SQL readable. Only counts 'applied'
    // point_redemptions rows so pending holds and released cancellations
    // don't inflate the "these many students actually spent points" number.
    const rows = await db
      .select({
        id: courses.id,
        title: courses.title,
        titleAr: courses.titleAr,
        thumbnail: courses.thumbnail,
        deliveryType: courses.deliveryType,
        price: courses.price,
        cmeHours: courses.cmeHours,
        isCmeAccredited: courses.isCmeAccredited,
        redeemableForFree: courseRedemptionSettings.redeemableForFree,
        freeUnlockCostPoints: courseRedemptionSettings.freeUnlockCostPoints,
        maxRedemptionPct: courseRedemptionSettings.maxRedemptionPct,
        redemptionsLast30d: sql<number>`(
          SELECT COUNT(*) FROM point_redemptions pr
          WHERE pr.course_id = ${courses.id}
            AND pr.status = 'applied'
            AND pr.applied_at >= ${thirtyDaysAgo}
        )`.mapWith(Number),
      })
      .from(courses)
      .leftJoin(
        courseRedemptionSettings,
        eq(courses.id, courseRedemptionSettings.courseId),
      )
      .where(where)
      .orderBy(asc(courses.title))
      .limit(200);

    return rows.map((r) => ({
      ...r,
      redeemableForFree: r.redeemableForFree ?? false,
      redemptionsLast30d: Number(r.redemptionsLast30d ?? 0),
      // Distinguish "never configured" (no row) from "configured off" (row
      // with redeemableForFree=false). FE uses this for the filter chips.
      configured: r.freeUnlockCostPoints != null || r.maxRedemptionPct != null,
    }));
  }

  /**
   * DELETE a per-course redemption row entirely — used when an admin wants
   * to remove a course from eligibility (not merely disable it). The
   * FE's card X button hits this; disabling flips redeemableForFree via PATCH.
   */
  @Delete('courses/:courseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCourseRedemption(@Param('courseId') courseId: string) {
    await db
      .delete(courseRedemptionSettings)
      .where(eq(courseRedemptionSettings.courseId, courseId));
  }

  /**
   * Bulk-enable every paid+active course that lacks a redemption row.
   * Body: { multiplier: number } — the FE passes points_per_currency (or a
   * scaled variant) so pointsCost = round(price * multiplier). Skips
   * courses that already have a row so the admin doesn't accidentally
   * overwrite fine-tuned per-course prices.
   */
  @Post('courses/bulk-enable')
  @HttpCode(HttpStatus.OK)
  async bulkEnableCourseRedemption(@Body() dto: { multiplier: number }) {
    const multiplier = Number(dto.multiplier);
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      throw new BadRequestException('multiplier must be a positive number');
    }

    const now = new Date();
    // Eligible = paid (price > 0) + active + not deleted + deadline not passed.
    // Left-join filters out courses that already have a row so we don't
    // clobber admin-set prices with the auto-derived one.
    const eligible = await db
      .select({
        id: courses.id,
        price: courses.price,
      })
      .from(courses)
      .leftJoin(
        courseRedemptionSettings,
        eq(courses.id, courseRedemptionSettings.courseId),
      )
      .where(
        and(
          eq(courses.status, 'active'),
          isNull(courses.deletedAt),
          sql`${courses.price}::numeric > 0`,
          isNull(courseRedemptionSettings.courseId),
          or(isNull(courses.enrollmentDeadline), gt(courses.enrollmentDeadline, now))!,
        ),
      );

    let inserted = 0;
    for (const c of eligible) {
      const priceNum = Number(c.price ?? 0);
      const pointsCost = Math.max(1, Math.round(priceNum * multiplier));
      await db.insert(courseRedemptionSettings).values({
        courseId: c.id,
        redeemableForFree: true,
        freeUnlockCostPoints: pointsCost,
      });
      inserted++;
    }

    return { inserted, skipped: 0, multiplier };
  }

  /**
   * Upcoming webinar sessions the admin can bind to a free_webinar reward.
   * Scoped to sessions whose parent course is a webinar (or the session
   * itself is a Zoom Webinar) and whose start time is in the future — no
   * point offering a redemption for a session that already happened.
   */
  @Get('webinar-sessions')
  async listWebinarSessions(@Query('search') search?: string) {
    const now = new Date();
    const term = search && search.trim().length >= 2 ? `%${search.trim()}%` : null;
    const where = and(
      gt(sessions.scheduledAt, now),
      or(
        eq(courses.deliveryType, 'webinar'),
        eq(sessions.isWebinar, true),
      )!,
      eq(sessions.status, 'scheduled'),
      isNull(courses.deletedAt),
      term
        ? or(
            ilike(sessions.title, term),
            ilike(courses.title, term),
            ilike(courses.titleAr, term),
          )
        : undefined,
    );

    const rows = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        scheduledAt: sessions.scheduledAt,
        courseId: sessions.courseId,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
        isWebinar: sessions.isWebinar,
      })
      .from(sessions)
      .innerJoin(courses, eq(sessions.courseId, courses.id))
      .where(where)
      .orderBy(asc(sessions.scheduledAt))
      .limit(100);
    return rows;
  }

  /**
   * Upsert redemption settings for a single course.
   */
  @Patch('courses/:courseId')
  async updateCourseRedemption(
    @Param('courseId') courseId: string,
    @Body() dto: UpdateCourseRedemptionDto,
  ) {
    const [existing] = await db
      .select({ courseId: courseRedemptionSettings.courseId })
      .from(courseRedemptionSettings)
      .where(eq(courseRedemptionSettings.courseId, courseId))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(courseRedemptionSettings)
        .set({ ...dto, updatedAt: new Date() })
        .where(eq(courseRedemptionSettings.courseId, courseId))
        .returning();
      return updated;
    }

    const [inserted] = await db
      .insert(courseRedemptionSettings)
      .values({ courseId, ...dto })
      .returning();
    return inserted;
  }

  // ─── User audit ──────────────────────────────────────────

  /**
   * Search students for the admin "Manual Grants" / "User History" tabs.
   *
   * Student-only by design: points only apply to enrolled learners, so
   * granting points to an instructor/manager is meaningless. The query
   * INNER JOINs user_roles → roles and filters role.name = 'STUDENT'.
   *
   * Empty / short query (`q` < 2 chars) returns the most recent 30 students
   * — gives admins a default list to scroll without forcing them to type.
   */
  @Get('users/search')
  async searchUsers(@Query('q') q?: string) {
    const term = q && q.trim().length >= 2 ? `%${q.trim()}%` : null;

    const baseQuery = db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(
        and(
          eq(roles.name, ROLE_NAMES.STUDENT),
          eq(users.isActive, true),
          term
            ? or(
                ilike(users.email, term),
                ilike(users.firstName, term),
                ilike(users.lastName, term),
              )
            : undefined,
        ),
      );

    const rows = await (term
      ? baseQuery.orderBy(asc(users.email)).limit(30)
      : baseQuery.orderBy(sql`${users.createdAt} DESC`).limit(30));

    return rows;
  }

  @Get('users/:userId/transactions')
  async listUserTransactions(
    @Param('userId') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ledger.listForUser(userId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get('users/:userId/balance')
  async getUserBalance(@Param('userId') userId: string) {
    return { balance: await this.ledger.getBalance(userId) };
  }

  // ─── Rewards catalog CRUD ────────────────────────────────────

  @Get('rewards')
  async listRewards() {
    return this.rewards.listForAdmin();
  }

  @Post('rewards')
  @HttpCode(HttpStatus.CREATED)
  async createReward(
    @Body() dto: CreateRewardDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rewards.createReward(dto, user.id);
  }

  @Patch('rewards/:id')
  async updateReward(@Param('id') id: string, @Body() dto: UpdateRewardDto) {
    return this.rewards.updateReward(id, dto);
  }

  @Delete('rewards/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteReward(@Param('id') id: string) {
    await this.rewards.deleteReward(id);
  }

  // ─── Redemptions ─────────────────────────────────────────────

  @Get('redemptions')
  async listRedemptions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('rewardId') rewardId?: string,
  ) {
    return this.rewards.listAllRedemptions({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 25,
      status,
      rewardId,
    });
  }

  @Post('redemptions/:id/transition')
  async transitionRedemption(
    @Param('id') id: string,
    @Body() dto: TransitionRedemptionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rewards.transitionRedemption(
      id,
      {
        status: dto.status,
        artifact: dto.artifact,
        adminNote: dto.adminNote,
        reason: dto.reason,
      },
      user.id,
    );
  }

  // ─── Course redemptions (point-based course unlocks) ──────────
  //
  // Every row in `point_redemptions` is a course-unlock event (the table
  // predates the reward catalog which lives in `reward_redemptions`), so
  // the filter here is just status='applied' AND courseId IS NOT NULL —
  // there's no `redemption_type` column to filter on. The enrollment link
  // is a plain FK column populated by `PointsService.redeemCourseForFree`
  // once payment succeeds — no need to dig through `paymentReference` or
  // metadata.

  @Get('course-redemptions')
  async listCourseRedemptions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('courseId') courseId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (p - 1) * l;

    const where = this.buildCourseRedemptionsFilter({
      search,
      courseId,
      status,
      startDate,
      endDate,
    });

    // Conversion rate: SAR equivalent = pointsUsed / conversionRatePointsPerSar.
    const [config] = await db.select().from(pointsConfig).limit(1);
    const rate = config?.conversionRatePointsPerSar ?? 10;

    const [rowsRaw, [{ total } = { total: 0 }], summary] = await Promise.all([
      db
        .select({
          redemptionId: pointRedemptions.id,
          redeemedAt: pointRedemptions.appliedAt,
          createdAt: pointRedemptions.createdAt,
          pointsSpent: pointRedemptions.pointsUsed,
          discountAmountSar: pointRedemptions.discountAmountSar,
          userId: users.id,
          userEmail: users.email,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          courseId: courses.id,
          courseTitle: courses.title,
          courseTitleAr: courses.titleAr,
          coursePrice: courses.price,
          enrollmentId: enrollments.id,
          enrollmentStatus: enrollments.status,
        })
        .from(pointRedemptions)
        .innerJoin(users, eq(pointRedemptions.userId, users.id))
        .innerJoin(courses, eq(pointRedemptions.courseId, courses.id))
        .leftJoin(enrollments, eq(pointRedemptions.enrollmentId, enrollments.id))
        .where(where)
        .orderBy(desc(pointRedemptions.appliedAt))
        .limit(l)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(pointRedemptions)
        .innerJoin(users, eq(pointRedemptions.userId, users.id))
        .innerJoin(courses, eq(pointRedemptions.courseId, courses.id))
        .leftJoin(enrollments, eq(pointRedemptions.enrollmentId, enrollments.id))
        .where(where),
      db
        .select({
          count: sql<number>`count(*)::int`,
          totalPointsSpent: sql<number>`COALESCE(SUM(${pointRedemptions.pointsUsed}), 0)::int`,
        })
        .from(pointRedemptions)
        .innerJoin(users, eq(pointRedemptions.userId, users.id))
        .innerJoin(courses, eq(pointRedemptions.courseId, courses.id))
        .leftJoin(enrollments, eq(pointRedemptions.enrollmentId, enrollments.id))
        .where(where),
    ]);

    const items = rowsRaw.map((r) => ({
      redemptionId: r.redemptionId,
      redeemedAt: (r.redeemedAt ?? r.createdAt).toISOString(),
      pointsSpent: r.pointsSpent,
      equivalentSar: rate > 0 ? Number((r.pointsSpent / rate).toFixed(2)) : 0,
      user: {
        id: r.userId,
        firstName: r.userFirstName,
        lastName: r.userLastName,
        email: r.userEmail,
      },
      course: {
        id: r.courseId,
        title: r.courseTitle,
        titleAr: r.courseTitleAr,
        priceSar: Number(r.coursePrice ?? 0),
      },
      enrollment: r.enrollmentId
        ? { id: r.enrollmentId, status: r.enrollmentStatus }
        : null,
    }));

    const summaryRow = summary[0] ?? { count: 0, totalPointsSpent: 0 };
    const totalPointsSpent = Number(summaryRow.totalPointsSpent ?? 0);
    return {
      items,
      total: Number(total ?? 0),
      page: p,
      limit: l,
      summary: {
        count: Number(summaryRow.count ?? 0),
        totalPointsSpent,
        equivalentValueSar:
          rate > 0 ? Number((totalPointsSpent / rate).toFixed(2)) : 0,
      },
    };
  }

  @Get('course-redemptions/export.csv')
  async exportCourseRedemptions(
    @Query('search') search?: string,
    @Query('courseId') courseId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<StreamableFile> {
    const where = this.buildCourseRedemptionsFilter({
      search,
      courseId,
      status,
      startDate,
      endDate,
    });

    const [config] = await db.select().from(pointsConfig).limit(1);
    const rate = config?.conversionRatePointsPerSar ?? 10;

    // No pagination — export the full filtered set. Volume is bounded (per
    // month + per admin action) so a single query is fine.
    const rows = await db
      .select({
        redemptionId: pointRedemptions.id,
        redeemedAt: pointRedemptions.appliedAt,
        createdAt: pointRedemptions.createdAt,
        pointsSpent: pointRedemptions.pointsUsed,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
        enrollmentStatus: enrollments.status,
      })
      .from(pointRedemptions)
      .innerJoin(users, eq(pointRedemptions.userId, users.id))
      .innerJoin(courses, eq(pointRedemptions.courseId, courses.id))
      .leftJoin(enrollments, eq(pointRedemptions.enrollmentId, enrollments.id))
      .where(where)
      .orderBy(desc(pointRedemptions.appliedAt));

    const dataRows = rows.map((r) => {
      const when = r.redeemedAt ?? r.createdAt;
      const studentName = [r.userFirstName, r.userLastName]
        .filter(Boolean)
        .join(' ');
      const sar = rate > 0 ? (r.pointsSpent / rate).toFixed(2) : '0.00';
      return [
        when ? when.toISOString() : '',
        studentName || r.userEmail,
        r.userEmail,
        r.courseTitle ?? r.courseTitleAr ?? '',
        r.pointsSpent,
        sar,
        r.enrollmentStatus ?? '',
      ];
    });

    const buffer = toCsvBuffer(dataRows, {
      headers: [
        'Date',
        'Student Name',
        'Student Email',
        'Course Title',
        'Points Spent',
        'SAR Equivalent',
        'Enrollment Status',
      ],
    });

    const ts = new Date().toISOString().split('T')[0];
    res!.set({
      'Content-Type': CSV_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="course-redemptions-${ts}.csv"`,
    });
    return new StreamableFile(buffer);
  }

  /**
   * Build the shared WHERE clause used by both the list and the CSV export.
   * Keeps filter semantics identical so the CSV can never disagree with the
   * on-screen table.
   */
  private buildCourseRedemptionsFilter(opts: {
    search?: string;
    courseId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const term =
      opts.search && opts.search.trim().length >= 2
        ? `%${opts.search.trim()}%`
        : null;

    const conditions: Array<ReturnType<typeof eq> | undefined> = [
      eq(pointRedemptions.status, 'applied'),
      // courseId is nullable on the schema (set null on course deletion); we
      // filter it out here so the report only ever surfaces course-unlock rows.
      sql`${pointRedemptions.courseId} IS NOT NULL` as unknown as ReturnType<typeof eq>,
      term
        ? (or(
            ilike(users.email, term),
            ilike(users.firstName, term),
            ilike(users.lastName, term),
          ) as ReturnType<typeof eq>)
        : undefined,
      opts.courseId ? eq(pointRedemptions.courseId, opts.courseId) : undefined,
    ];

    // Status filter maps to the enrollment status; 'all' is a no-op. Only
    // the set that actually exists on the enrollments table is honored.
    if (
      opts.status &&
      ['active', 'completed', 'dropped', 'suspended', 'pending_payment'].includes(
        opts.status,
      )
    ) {
      conditions.push(eq(enrollments.status, opts.status));
    }

    if (opts.startDate) {
      const parsed = new Date(opts.startDate);
      if (!Number.isNaN(parsed.getTime())) {
        conditions.push(gte(pointRedemptions.appliedAt, parsed));
      }
    }
    if (opts.endDate) {
      const parsed = new Date(opts.endDate);
      if (!Number.isNaN(parsed.getTime())) {
        // Inclusive end-of-day so the picker's YYYY-MM-DD covers the whole day.
        parsed.setHours(23, 59, 59, 999);
        conditions.push(lte(pointRedemptions.appliedAt, parsed));
      }
    }

    return and(...conditions.filter(Boolean));
  }
}
