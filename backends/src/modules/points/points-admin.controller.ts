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
  UseGuards,
} from '@nestjs/common';
import { and, asc, eq, ilike, or, sql, count, inArray } from 'drizzle-orm';
import { db } from '../../database';
import {
  pointRules,
  pointsConfig,
  courses,
  courseRedemptionSettings,
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
    const where = and(
      eq(courses.status, 'active'),
      search
        ? or(
            ilike(courses.title, `%${search}%`),
            ilike(courses.titleAr, `%${search}%`),
          )
        : undefined,
    );

    const rows = await db
      .select({
        id: courses.id,
        title: courses.title,
        titleAr: courses.titleAr,
        deliveryType: courses.deliveryType,
        price: courses.price,
        cmeHours: courses.cmeHours,
        isCmeAccredited: courses.isCmeAccredited,
        redeemableForFree: courseRedemptionSettings.redeemableForFree,
        freeUnlockCostPoints: courseRedemptionSettings.freeUnlockCostPoints,
        maxRedemptionPct: courseRedemptionSettings.maxRedemptionPct,
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
    }));
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
}
