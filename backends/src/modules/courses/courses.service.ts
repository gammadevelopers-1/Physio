import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, and, ilike, or, desc, asc, count, sql } from 'drizzle-orm';
import { db } from '../../database';
import {
  courses,
  courseModules,
  enrollments,
  sessions,
  COURSE_STATUS,
} from '../../database/schema';
import { getTableColumns } from 'drizzle-orm';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { ReorderModulesDto } from './dto/reorder-modules.dto';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  // ─── Role helpers ─────────────────────────────────────────

  private isAdmin(user: AuthenticatedUser): boolean {
    return (
      user.roles.includes('ADMIN') || user.roles.includes('SUPER_ADMIN')
    );
  }

  // ─── Course CRUD ────────────────────────────────────────────

  /**
   * Create a new course.
   * - Instructor: always creates as themselves.
   * - Admin: can specify an instructorId in the body to create on behalf of any instructor.
   */
  async create(user: AuthenticatedUser, dto: CreateCourseDto) {
    const instructorId =
      this.isAdmin(user) && dto.instructorId
        ? dto.instructorId
        : user.id;

    const [course] = await db
      .insert(courses)
      .values({
        instructorId,
        title: dto.title,
        titleAr: dto.titleAr,
        description: dto.description,
        descriptionAr: dto.descriptionAr,
        deliveryType: dto.deliveryType,
        thumbnail: dto.thumbnail,
        maxEnrollment: dto.maxEnrollment,
        startDate: dto.startDate,
        endDate: dto.endDate,
      })
      .returning();

    return course;
  }

  /**
   * List courses with filtering and pagination.
   * - Instructor: only their own courses.
   * - Admin: all courses across all instructors.
   */
  async findAll(
    user: AuthenticatedUser,
    params: {
      status?: string;
      delivery?: string;
      search?: string;
      sort?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [];

    // Instructor: scope to own courses only
    if (!this.isAdmin(user)) {
      conditions.push(eq(courses.instructorId, user.id));
    }

    if (
      params.status &&
      Object.values(COURSE_STATUS).includes(params.status as any)
    ) {
      conditions.push(eq(courses.status, params.status));
    }

    if (params.delivery) {
      conditions.push(eq(courses.deliveryType, params.delivery));
    }

    if (params.search) {
      const searchTerm = `%${params.search}%`;
      conditions.push(
        or(
          ilike(courses.title, searchTerm),
          ilike(courses.titleAr, searchTerm),
          ilike(courses.description, searchTerm),
        ) as any,
      );
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    // Determine sort order
    let orderByExpr;
    switch (params.sort) {
      case 'oldest':
        orderByExpr = asc(courses.createdAt);
        break;
      case 'alphabetical':
        orderByExpr = asc(courses.title);
        break;
      case 'students':
        orderByExpr = sql`(SELECT COUNT(*) FROM enrollments e WHERE e.course_id = ${courses.id}) DESC`;
        break;
      case 'newest':
      default:
        orderByExpr = desc(courses.createdAt);
        break;
    }

    // Enriched query with correlated subqueries for enrollment & session stats
    const data = await db
      .select({
        ...getTableColumns(courses),
        enrolledCount: sql<number>`(
          SELECT COUNT(*) FROM enrollments e WHERE e.course_id = ${courses.id}
        )`.mapWith(Number),
        completionRate: sql<number>`(
          SELECT COALESCE(ROUND(AVG(e.progress)), 0) FROM enrollments e WHERE e.course_id = ${courses.id}
        )`.mapWith(Number),
        totalSessions: sql<number>`(
          SELECT COUNT(*) FROM sessions s WHERE s.course_id = ${courses.id}
        )`.mapWith(Number),
        completedSessions: sql<number>`(
          SELECT COUNT(*) FROM sessions s WHERE s.course_id = ${courses.id} AND s.status = 'completed'
        )`.mapWith(Number),
        nextSessionAt: sql<string | null>`(
          SELECT MIN(s.scheduled_at) FROM sessions s
          WHERE s.course_id = ${courses.id} AND s.scheduled_at > NOW() AND s.status = 'scheduled'
        )`,
      })
      .from(courses)
      .where(whereClause)
      .orderBy(orderByExpr)
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: count() })
      .from(courses)
      .where(whereClause);

    return {
      data,
      total: countResult?.count || 0,
      page,
      limit,
      totalPages: Math.ceil((countResult?.count || 0) / limit),
    };
  }

  /**
   * Get course detail with modules.
   * - Instructor: only their own (404 for others).
   * - Admin: any course.
   */
  async findOne(courseId: string, user: AuthenticatedUser) {
    const conditions = [eq(courses.id, courseId)];
    if (!this.isAdmin(user)) {
      conditions.push(eq(courses.instructorId, user.id));
    }

    const [course] = await db
      .select()
      .from(courses)
      .where(and(...conditions))
      .limit(1);

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const modules = await db
      .select()
      .from(courseModules)
      .where(eq(courseModules.courseId, courseId))
      .orderBy(asc(courseModules.orderIndex));

    return { ...course, modules };
  }

  /**
   * Update a course.
   * - Instructor: only their own.
   * - Admin: any course.
   */
  async update(
    courseId: string,
    user: AuthenticatedUser,
    dto: UpdateCourseDto,
  ) {
    await this.verifyCourseAccess(courseId, user);

    const [updated] = await db
      .update(courses)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(courses.id, courseId))
      .returning();

    return updated;
  }

  /**
   * Delete a course — only draft courses.
   * - Instructor: only their own drafts.
   * - Admin: any draft course.
   */
  async remove(courseId: string, user: AuthenticatedUser) {
    const existing = await this.verifyCourseAccess(courseId, user);

    if (existing.status !== COURSE_STATUS.DRAFT) {
      throw new BadRequestException(
        'Only draft courses can be deleted',
      );
    }

    await db.delete(courses).where(eq(courses.id, courseId));

    return { message: 'Course deleted successfully' };
  }

  // ─── Module CRUD ────────────────────────────────────────────

  /**
   * Add a module to a course.
   */
  async addModule(
    courseId: string,
    user: AuthenticatedUser,
    dto: CreateModuleDto,
  ) {
    await this.verifyCourseAccess(courseId, user);

    // If no orderIndex provided, append at the end
    let orderIndex = dto.orderIndex;
    if (orderIndex === undefined || orderIndex === null) {
      const [maxResult] = await db
        .select({
          maxOrder: sql<number>`COALESCE(MAX(${courseModules.orderIndex}), -1)`,
        })
        .from(courseModules)
        .where(eq(courseModules.courseId, courseId));

      orderIndex = (maxResult?.maxOrder ?? -1) + 1;
    }

    const [module] = await db
      .insert(courseModules)
      .values({
        courseId,
        title: dto.title,
        titleAr: dto.titleAr,
        orderIndex,
        type: dto.type,
        durationMinutes: dto.durationMinutes,
      })
      .returning();

    return module;
  }

  /**
   * Update a module.
   */
  async updateModule(
    courseId: string,
    moduleId: string,
    user: AuthenticatedUser,
    dto: UpdateModuleDto,
  ) {
    await this.verifyCourseAccess(courseId, user);

    const [existing] = await db
      .select({ id: courseModules.id })
      .from(courseModules)
      .where(
        and(
          eq(courseModules.id, moduleId),
          eq(courseModules.courseId, courseId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Module not found');
    }

    const [updated] = await db
      .update(courseModules)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(courseModules.id, moduleId))
      .returning();

    return updated;
  }

  /**
   * Remove a module.
   */
  async removeModule(
    courseId: string,
    moduleId: string,
    user: AuthenticatedUser,
  ) {
    await this.verifyCourseAccess(courseId, user);

    const [existing] = await db
      .select({ id: courseModules.id })
      .from(courseModules)
      .where(
        and(
          eq(courseModules.id, moduleId),
          eq(courseModules.courseId, courseId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Module not found');
    }

    await db
      .delete(courseModules)
      .where(eq(courseModules.id, moduleId));

    return { message: 'Module deleted successfully' };
  }

  /**
   * Reorder modules.
   */
  async reorderModules(
    courseId: string,
    user: AuthenticatedUser,
    dto: ReorderModulesDto,
  ) {
    await this.verifyCourseAccess(courseId, user);

    // Verify all module IDs belong to this course
    const existingModules = await db
      .select({ id: courseModules.id })
      .from(courseModules)
      .where(eq(courseModules.courseId, courseId));

    const existingIds = new Set(existingModules.map((m) => m.id));
    for (const item of dto.modules) {
      if (!existingIds.has(item.id)) {
        throw new BadRequestException(
          `Module ${item.id} does not belong to this course`,
        );
      }
    }

    // Update each module's orderIndex
    for (const item of dto.modules) {
      await db
        .update(courseModules)
        .set({ orderIndex: item.orderIndex, updatedAt: new Date() })
        .where(eq(courseModules.id, item.id));
    }

    // Return updated modules in order
    const updated = await db
      .select()
      .from(courseModules)
      .where(eq(courseModules.courseId, courseId))
      .orderBy(asc(courseModules.orderIndex));

    return updated;
  }

  // ─── Helpers ────────────────────────────────────────────────

  /**
   * Verify the user can access the course.
   * - Admin: any course (lookup by id only).
   * - Instructor: only their own (lookup by id + instructorId → 404 otherwise).
   */
  private async verifyCourseAccess(
    courseId: string,
    user: AuthenticatedUser,
  ) {
    const conditions = [eq(courses.id, courseId)];
    if (!this.isAdmin(user)) {
      conditions.push(eq(courses.instructorId, user.id));
    }

    const [course] = await db
      .select({ id: courses.id, status: courses.status })
      .from(courses)
      .where(and(...conditions))
      .limit(1);

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return course;
  }
}
