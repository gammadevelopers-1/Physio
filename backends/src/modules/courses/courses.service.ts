import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { eq, and, ilike, or, desc, asc, count, sql, inArray } from 'drizzle-orm';
import { db } from '../../database';
import {
  courses,
  courseModules,
  courseMaterials,
  courseAssistants,
  enrollments,
  sessions,
  courseRatings,
  users,
  COURSE_STATUS,
  NELC_EVENT_TYPE,
} from '../../database/schema';
import { getTableColumns } from 'drizzle-orm';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { isGlobalAdmin, isManager, isManagerOrAbove, isTA } from '../../common/role-helpers';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { ReorderModulesDto } from './dto/reorder-modules.dto';
import { classifyCourse, getNelcMaxEnrollment } from './nelc-config';
import { NelcAuditService } from '../nelc-audit/nelc-audit.service';
import { UserNotificationsService } from '../user-notifications/user-notifications.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(
    private readonly auditService: NelcAuditService,
    private readonly userNotificationsService: UserNotificationsService,
    private readonly emailService: EmailService,
  ) {}

  // ─── Role helpers ─────────────────────────────────────────

  /**
   * Add ownership condition to a conditions array based on user role:
   * - Global admin: no filter (sees all)
   * - Manager: filter by courses.managerId
   * - Instructor: filter by courses.instructorId
   */
  private addOwnershipCondition(
    conditions: any[],
    user: AuthenticatedUser,
  ): void {
    if (isGlobalAdmin(user)) {
      // No filter — sees everything
    } else if (isManager(user)) {
      conditions.push(
        or(
          eq(courses.managerId, user.id),
          sql`${courses.managerId} IS NULL`,
        )!,
      );
    } else {
      conditions.push(eq(courses.instructorId, user.id));
    }
  }

  // ─── Course CRUD ────────────────────────────────────────────

  /**
   * Create a new course.
   * - Instructor: always creates as themselves.
   * - Admin: can specify an instructorId in the body to create on behalf of any instructor.
   */
  async create(user: AuthenticatedUser, dto: CreateCourseDto) {
    const instructorId =
      isManagerOrAbove(user) && dto.instructorId
        ? dto.instructorId
        : user.id;

    // Auto-set managerId based on role
    let managerId: string | null = null;
    if (isManager(user)) {
      managerId = user.id;
    } else if (isGlobalAdmin(user) && dto.managerId) {
      managerId = dto.managerId;
    }

    const [course] = await db
      .insert(courses)
      .values({
        instructorId,
        managerId,
        title: dto.title,
        titleAr: dto.titleAr,
        description: dto.description,
        descriptionAr: dto.descriptionAr,
        deliveryType: dto.deliveryType,
        thumbnail: dto.thumbnail,
        maxEnrollment: dto.maxEnrollment,
        price: dto.price !== undefined ? dto.price.toString() : undefined,
        cmeHours: dto.cmeHours,
        enrollmentDeadline: dto.enrollmentDeadline
          ? new Date(dto.enrollmentDeadline)
          : undefined,
        isCmeAccredited: dto.isCmeAccredited,
        language: dto.language,
        startDate: dto.startDate,
        endDate: dto.endDate,
        cohort: dto.cohort,
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

    // Scope by role: admin sees all, manager sees their courses, instructor sees own
    this.addOwnershipCondition(conditions, user);

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
        orderByExpr = sql`(SELECT COUNT(*) FROM enrollments e WHERE e.course_id = "courses"."id") DESC`;
        break;
      case 'newest':
      default:
        orderByExpr = desc(courses.createdAt);
        break;
    }

    // Enriched query with correlated subqueries for enrollment & session stats
    // NOTE: We use "courses"."id" (table-qualified) instead of ${courses.id} because
    // Drizzle generates unqualified "id" which is ambiguous with the subquery table's own "id" column.
    const data = await db
      .select({
        ...getTableColumns(courses),
        enrolledCount: sql<number>`(
          SELECT COUNT(*) FROM enrollments e WHERE e.course_id = "courses"."id" AND e.status != 'dropped'
        )`.mapWith(Number),
        completionRate: sql<number>`(
          SELECT COALESCE(ROUND(AVG(e.progress)), 0) FROM enrollments e WHERE e.course_id = "courses"."id"
        )`.mapWith(Number),
        totalSessions: sql<number>`(
          SELECT COUNT(*) FROM sessions s WHERE s.course_id = "courses"."id"
        )`.mapWith(Number),
        completedSessions: sql<number>`(
          SELECT COUNT(*) FROM sessions s WHERE s.course_id = "courses"."id" AND s.status = 'completed'
        )`.mapWith(Number),
        nextSessionAt: sql<string | null>`(
          SELECT MIN(s.scheduled_at) FROM sessions s
          WHERE s.course_id = "courses"."id" AND s.scheduled_at > NOW() AND s.status = 'scheduled'
        )`,
        instructorName: sql<string | null>`(
          SELECT CONCAT(u.first_name, ' ', u.last_name) FROM users u
          WHERE u.id = "courses"."instructor_id"
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
   * List active courses publicly (no auth required).
   * Returns enriched data: instructor name, enrolled count, total hours, ratings, seats info.
   */
  async findAllPublic(params: {
    search?: string;
    delivery?: string;
    pricing?: string;
    cmeAccredited?: boolean;
    language?: string;
    availability?: string;
    sort?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [
      eq(courses.status, COURSE_STATUS.ACTIVE),
    ];

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

    if (params.pricing === 'free') {
      conditions.push(
        or(
          sql`${courses.price} = 0`,
          sql`${courses.price} IS NULL`,
        ) as any,
      );
    } else if (params.pricing === 'paid') {
      conditions.push(sql`${courses.price} > 0` as any);
    }

    if (params.cmeAccredited !== undefined) {
      conditions.push(eq(courses.isCmeAccredited, params.cmeAccredited));
    }

    if (params.language && params.language !== 'all') {
      conditions.push(eq(courses.language, params.language));
    }

    const whereClause = and(...conditions);

    // Determine sort order
    let orderByClause;
    switch (params.sort) {
      case 'starting_soon':
        orderByClause = asc(courses.startDate);
        break;
      case 'popular':
        orderByClause = sql`(SELECT COUNT(*) FROM enrollments e WHERE e.course_id = "courses"."id") DESC`;
        break;
      case 'rating':
        orderByClause = sql`(SELECT COALESCE(AVG(cr.rating), 0) FROM course_ratings cr WHERE cr.course_id = "courses"."id") DESC`;
        break;
      default:
        orderByClause = desc(courses.createdAt);
    }

    const data = await db
      .select({
        id: courses.id,
        title: courses.title,
        titleAr: courses.titleAr,
        description: courses.description,
        descriptionAr: courses.descriptionAr,
        deliveryType: courses.deliveryType,
        thumbnail: courses.thumbnail,
        maxEnrollment: courses.maxEnrollment,
        price: courses.price,
        cmeHours: courses.cmeHours,
        enrollmentDeadline: courses.enrollmentDeadline,
        isCmeAccredited: courses.isCmeAccredited,
        language: courses.language,
        startDate: courses.startDate,
        endDate: courses.endDate,
        enrolledCount: sql<number>`(
          SELECT COUNT(*) FROM enrollments e WHERE e.course_id = "courses"."id" AND e.status != 'dropped'
        )`.mapWith(Number),
        totalHours: sql<number>`(
          SELECT COALESCE(SUM(cm.duration_minutes), 0) FROM course_modules cm WHERE cm.course_id = "courses"."id"
        )`.mapWith(Number),
        sessionCount: sql<number>`(
          SELECT COUNT(*) FROM sessions s WHERE s.course_id = "courses"."id"
        )`.mapWith(Number),
        avgRating: sql<number>`(
          SELECT COALESCE(AVG(cr.rating), 0) FROM course_ratings cr WHERE cr.course_id = "courses"."id"
        )`.mapWith(Number),
        totalRatings: sql<number>`(
          SELECT COUNT(*) FROM course_ratings cr WHERE cr.course_id = "courses"."id"
        )`.mapWith(Number),
        instructorName: sql<string>`(
          SELECT CONCAT(u.first_name, ' ', u.last_name) FROM users u
          WHERE u.id = "courses"."instructor_id"
        )`,
      })
      .from(courses)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    // Enrich with NELC capacity info (no longer hiding full courses)
    const enriched = data.map((c) => {
      const classification = classifyCourse(c.startDate, c.endDate);
      const nelcMax = getNelcMaxEnrollment(classification);
      const effectiveMax = c.maxEnrollment
        ? Math.min(c.maxEnrollment, nelcMax)
        : nelcMax;
      const remainingSeats = Math.max(0, effectiveMax - c.enrolledCount);
      const isFull = remainingSeats === 0;

      return {
        ...c,
        totalHours: Math.round((c.totalHours / 60) * 10) / 10,
        avgRating: Number(Number(c.avgRating || 0).toFixed(1)),
        price: c.price ? Number(c.price) : 0,
        remainingSeats,
        isFull,
      };
    });

    // Post-query availability filter (depends on computed isFull)
    let filtered = enriched;
    if (params.availability === 'open') {
      filtered = enriched.filter((c) => !c.isFull);
    } else if (params.availability === 'starting_soon') {
      const twoWeeksFromNow = new Date();
      twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
      filtered = enriched.filter(
        (c) =>
          !c.isFull &&
          c.startDate &&
          new Date(c.startDate) <= twoWeeksFromNow &&
          new Date(c.startDate) >= new Date(),
      );
    } else if (params.availability === 'full') {
      filtered = enriched.filter((c) => c.isFull);
    }

    const [countResult] = await db
      .select({ count: count() })
      .from(courses)
      .where(whereClause);

    return {
      data: filtered,
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil((countResult?.count || 0) / limit),
    };
  }

  /**
   * Get a single public course by ID with enriched data.
   */
  async findOnePublic(courseId: string) {
    const [data] = await db
      .select({
        id: courses.id,
        title: courses.title,
        titleAr: courses.titleAr,
        description: courses.description,
        descriptionAr: courses.descriptionAr,
        deliveryType: courses.deliveryType,
        thumbnail: courses.thumbnail,
        maxEnrollment: courses.maxEnrollment,
        price: courses.price,
        cmeHours: courses.cmeHours,
        enrollmentDeadline: courses.enrollmentDeadline,
        isCmeAccredited: courses.isCmeAccredited,
        language: courses.language,
        startDate: courses.startDate,
        endDate: courses.endDate,
        enrolledCount: sql<number>`(
          SELECT COUNT(*) FROM enrollments e WHERE e.course_id = "courses"."id" AND e.status != 'dropped'
        )`.mapWith(Number),
        totalHours: sql<number>`(
          SELECT COALESCE(SUM(cm.duration_minutes), 0) FROM course_modules cm WHERE cm.course_id = "courses"."id"
        )`.mapWith(Number),
        sessionCount: sql<number>`(
          SELECT COUNT(*) FROM sessions s WHERE s.course_id = "courses"."id"
        )`.mapWith(Number),
        avgRating: sql<number>`(
          SELECT COALESCE(AVG(cr.rating), 0) FROM course_ratings cr WHERE cr.course_id = "courses"."id"
        )`.mapWith(Number),
        totalRatings: sql<number>`(
          SELECT COUNT(*) FROM course_ratings cr WHERE cr.course_id = "courses"."id"
        )`.mapWith(Number),
        instructorName: sql<string>`(
          SELECT CONCAT(u.first_name, ' ', u.last_name) FROM users u
          WHERE u.id = "courses"."instructor_id"
        )`,
      })
      .from(courses)
      .where(
        and(
          eq(courses.id, courseId),
          or(
            eq(courses.status, COURSE_STATUS.ACTIVE),
            eq(courses.status, COURSE_STATUS.COMPLETED),
          ),
        ),
      )
      .limit(1);

    if (!data) {
      throw new NotFoundException('Course not found');
    }

    const classification = classifyCourse(data.startDate, data.endDate);
    const nelcMax = getNelcMaxEnrollment(classification);
    const effectiveMax = data.maxEnrollment
      ? Math.min(data.maxEnrollment, nelcMax)
      : nelcMax;
    const remainingSeats = Math.max(0, effectiveMax - data.enrolledCount);

    return {
      ...data,
      totalHours: Math.round((data.totalHours / 60) * 10) / 10,
      avgRating: Number(Number(data.avgRating || 0).toFixed(1)),
      price: data.price ? Number(data.price) : 0,
      remainingSeats,
      isFull: remainingSeats === 0,
    };
  }

  /**
   * Get course detail with modules.
   * - Instructor: only their own (404 for others).
   * - Admin: any course.
   */
  async findOne(courseId: string, user: AuthenticatedUser) {
    // TAs access courses via their assignment, not ownership
    if (isTA(user)) {
      const [assignment] = await db
        .select()
        .from(courseAssistants)
        .where(
          and(
            eq(courseAssistants.courseId, courseId),
            eq(courseAssistants.userId, user.id),
            eq(courseAssistants.status, 'approved'),
          ),
        )
        .limit(1);
      if (!assignment) {
        throw new NotFoundException('Course not found');
      }
    }

    const conditions = [eq(courses.id, courseId)];
    if (!isTA(user)) {
      this.addOwnershipCondition(conditions, user);
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
   * - Instructor: only their own, and only when status is draft or changes_requested.
   * - Admin/Manager: any course, any status.
   */
  async update(
    courseId: string,
    user: AuthenticatedUser,
    dto: UpdateCourseDto,
  ) {
    const existing = await this.verifyCourseAccess(courseId, user);

    // Instructors can only edit courses in draft or changes_requested status
    if (
      !isManagerOrAbove(user) &&
      existing.status !== COURSE_STATUS.DRAFT &&
      existing.status !== COURSE_STATUS.CHANGES_REQUESTED
    ) {
      throw new ForbiddenException(
        'You can only edit courses in draft or changes requested status',
      );
    }

    const { price, enrollmentDeadline, ...restDto } = dto;
    const updateData: Record<string, any> = {
      ...restDto,
      updatedAt: new Date(),
    };
    if (price !== undefined) {
      updateData.price = price.toString();
    }
    if (enrollmentDeadline !== undefined) {
      updateData.enrollmentDeadline = new Date(enrollmentDeadline);
    }

    const [updated] = await db
      .update(courses)
      .set(updateData)
      .where(eq(courses.id, courseId))
      .returning();

    return updated;
  }

  /**
   * Delete a course — only draft courses, only MANAGER/ADMIN.
   */
  async remove(courseId: string, user: AuthenticatedUser) {
    if (!isManagerOrAbove(user)) {
      throw new ForbiddenException('Only managers and admins can delete courses');
    }

    // Managers can only delete their own courses (or unassigned ones)
    const conditions = [eq(courses.id, courseId)];
    if (isManager(user)) {
      conditions.push(or(eq(courses.managerId, user.id), sql`${courses.managerId} IS NULL`)!);
    }

    const [existing] = await db
      .select({ id: courses.id, status: courses.status })
      .from(courses)
      .where(and(...conditions))
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Course not found');
    }

    if (existing.status !== COURSE_STATUS.DRAFT) {
      throw new BadRequestException(
        'Only draft courses can be deleted',
      );
    }

    await db.delete(courses).where(eq(courses.id, courseId));

    return { message: 'Course deleted successfully' };
  }

  // ─── Course Review Workflow ────────────────────────────────

  /**
   * Instructor submits a course for manager review.
   */
  async submitForReview(courseId: string, user: AuthenticatedUser) {
    const [course] = await db
      .select({
        id: courses.id,
        status: courses.status,
        title: courses.title,
        instructorId: courses.instructorId,
        managerId: courses.managerId,
      })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Verify the user has access to this course
    if (course.instructorId !== user.id && !isManagerOrAbove(user)) {
      throw new ForbiddenException('You are not the instructor of this course');
    }
    // Managers must own the course (or course is unassigned)
    if (isManager(user) && course.managerId !== null && course.managerId !== user.id) {
      throw new ForbiddenException('You do not manage this course');
    }

    if (
      course.status !== COURSE_STATUS.DRAFT &&
      course.status !== COURSE_STATUS.CHANGES_REQUESTED
    ) {
      throw new BadRequestException(
        'Only draft or changes-requested courses can be submitted for review',
      );
    }

    // Validate all materials are live or archived
    const pendingMaterials = await db
      .select({
        id: courseMaterials.id,
        title: courseMaterials.title,
        status: courseMaterials.status,
      })
      .from(courseMaterials)
      .where(
        and(
          eq(courseMaterials.courseId, courseId),
          sql`${courseMaterials.status} NOT IN ('live', 'archived')`,
        ),
      );

    if (pendingMaterials.length > 0) {
      const pendingList = pendingMaterials.map(
        (m) => `${m.title || m.id} (${m.status})`,
      );
      throw new BadRequestException({
        message: 'Cannot submit for review: some materials have not been approved',
        pendingMaterials: pendingList,
      });
    }

    // Validate course readiness (modules, sessions, dates, CME hours)
    await this.validateCourseReadiness(courseId);

    const [updated] = await db
      .update(courses)
      .set({
        status: COURSE_STATUS.PENDING_REVIEW,
        submittedAt: new Date(),
        reviewNote: null,
        updatedAt: new Date(),
      })
      .where(eq(courses.id, courseId))
      .returning();

    // Log NELC audit event
    await this.auditService.log({
      eventType: NELC_EVENT_TYPE.COURSE_SUBMITTED_FOR_REVIEW,
      entityType: 'course',
      entityId: courseId,
      userId: user.id,
      metadata: { courseTitle: course.title },
    });

    // Notify all managers (in-app + email)
    const managers = await db
      .select({ id: users.id, email: users.email, firstName: users.firstName })
      .from(users)
      .where(
        sql`${users.activeRole} IN ('MANAGER', 'ADMIN', 'SUPER_ADMIN')`,
      );

    const managerIds = managers.map((m) => m.id);
    if (managerIds.length > 0) {
      const instructorName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
      await this.userNotificationsService.createBulk(managerIds, {
        type: 'course_submitted_for_review',
        title: 'Course Submitted for Review',
        message: `${instructorName} submitted "${course.title}" for review.`,
        link: '/dashboard/manager/courses',
        entityType: 'course',
        entityId: courseId,
      });

      // Email each manager
      for (const mgr of managers) {
        if (mgr.email) {
          await this.emailService.sendContentPendingReview(mgr.email, {
            recipientName: mgr.firstName || 'Manager',
            materialTitle: course.title,
            courseName: course.title,
            instructorName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            wcagStatus: 'N/A',
            wcagSummary: 'Course submitted for review',
          }).catch(() => {});
        }
      }
    }

    this.logger.log(`Course "${course.title}" submitted for review by ${user.id}`);

    return updated;
  }

  /**
   * Manager requests changes on a course.
   */
  async requestChanges(courseId: string, user: AuthenticatedUser, note: string) {
    const [course] = await db
      .select({
        id: courses.id,
        status: courses.status,
        title: courses.title,
        instructorId: courses.instructorId,
      })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (course.status !== COURSE_STATUS.PENDING_REVIEW) {
      throw new BadRequestException(
        'Only courses pending review can have changes requested',
      );
    }

    const [updated] = await db
      .update(courses)
      .set({
        status: COURSE_STATUS.CHANGES_REQUESTED,
        reviewNote: note,
        reviewedBy: user.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(courses.id, courseId))
      .returning();

    // Log NELC audit event
    await this.auditService.log({
      eventType: NELC_EVENT_TYPE.COURSE_CHANGES_REQUESTED,
      entityType: 'course',
      entityId: courseId,
      userId: user.id,
      metadata: { courseTitle: course.title, reviewNote: note },
    });

    // Notify instructor (in-app + email)
    await this.userNotificationsService.create({
      recipientId: course.instructorId,
      type: 'course_changes_requested',
      title: 'Changes Requested',
      message: `Changes have been requested on your course "${course.title}": ${note}`,
      link: '/dashboard/instructor/courses',
      entityType: 'course',
      entityId: courseId,
    });

    const [instructor] = await db
      .select({ email: users.email, firstName: users.firstName })
      .from(users)
      .where(eq(users.id, course.instructorId))
      .limit(1);
    if (instructor?.email) {
      await this.emailService.sendContentReview(instructor.email, {
        recipientName: instructor.firstName || 'Instructor',
        materialTitle: course.title,
        courseName: course.title,
        decision: 'changes_requested',
        comment: note,
      }).catch(() => {});
    }

    this.logger.log(`Changes requested on course "${course.title}" by ${user.id}: ${note}`);

    return updated;
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

  // ─── Course Activation / Deactivation ──────────────────────

  /**
   * Activate (approve) a course — validates all materials have been reviewed (status = 'live').
   * Only MANAGER and ADMIN can activate a course.
   * Course must be in pending_review status.
   */
  async activate(courseId: string, user: AuthenticatedUser) {
    const [course] = await db
      .select({
        id: courses.id,
        status: courses.status,
        title: courses.title,
        instructorId: courses.instructorId,
        managerId: courses.managerId,
      })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (course.status === COURSE_STATUS.ACTIVE) {
      throw new BadRequestException('Course is already active');
    }

    const allowedStatuses = [
      COURSE_STATUS.PENDING_REVIEW,
      COURSE_STATUS.DRAFT,
      COURSE_STATUS.ARCHIVED,
      COURSE_STATUS.COMPLETED,
    ];

    if (!allowedStatuses.includes(course.status as any)) {
      throw new BadRequestException(
        'Course cannot be activated from its current status',
      );
    }

    const isReactivation =
      course.status === COURSE_STATUS.ARCHIVED ||
      course.status === COURSE_STATUS.COMPLETED;

    // Only validate readiness and materials for first-time activation (not reactivation)
    if (!isReactivation) {
      // Validate course readiness (modules, sessions, dates, CME hours)
      await this.validateCourseReadiness(courseId, 'activation');

      // Check all materials have been reviewed (status = 'live')
      const pendingMaterials = await db
        .select({
          id: courseMaterials.id,
          title: courseMaterials.title,
          status: courseMaterials.status,
        })
        .from(courseMaterials)
        .where(
          and(
            eq(courseMaterials.courseId, courseId),
            sql`${courseMaterials.status} NOT IN ('live', 'archived')`,
          ),
        );

      if (pendingMaterials.length > 0) {
        const pendingList = pendingMaterials.map(
          (m) => `${m.title || m.id} (${m.status})`,
        );
        throw new BadRequestException({
          message: 'Cannot activate course: some materials have not been reviewed',
          pendingMaterials: pendingList,
        });
      }
    }

    const [updated] = await db
      .update(courses)
      .set({
        status: COURSE_STATUS.ACTIVE,
        reviewedBy: user.id,
        reviewedAt: new Date(),
        reviewNote: null,
        // EC-26: Set managerId if not already set (manager who activates becomes the course manager)
        ...(course.managerId ? {} : { managerId: user.id }),
        updatedAt: new Date(),
      })
      .where(eq(courses.id, courseId))
      .returning();

    // Log NELC audit event
    await this.auditService.log({
      eventType: NELC_EVENT_TYPE.COURSE_ACTIVATED,
      entityType: 'course',
      entityId: courseId,
      userId: user.id,
      metadata: { courseTitle: course.title },
    });

    // Notify instructor: course approved
    await this.userNotificationsService.create({
      recipientId: course.instructorId,
      type: 'course_approved',
      title: 'Course Approved',
      message: `Your course "${course.title}" has been approved and is now active.`,
      link: '/dashboard/instructor/courses',
      entityType: 'course',
      entityId: courseId,
    });

    // Email instructor
    const [instructor] = await db
      .select({ email: users.email, firstName: users.firstName })
      .from(users)
      .where(eq(users.id, course.instructorId))
      .limit(1);
    if (instructor?.email) {
      await this.emailService.sendContentReview(instructor.email, {
        recipientName: instructor.firstName || 'Instructor',
        materialTitle: course.title,
        courseName: course.title,
        decision: 'approved',
        comment: null,
      }).catch(() => {});
    }

    this.logger.log(`Course "${course.title}" activated by ${user.id}`);

    return updated;
  }

  /**
   * Deactivate (archive) an active course.
   * Only MANAGER and ADMIN can deactivate a course.
   */
  async deactivate(courseId: string, user: AuthenticatedUser) {
    const [course] = await db
      .select({ id: courses.id, status: courses.status, title: courses.title })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (course.status !== COURSE_STATUS.ACTIVE) {
      throw new BadRequestException(
        'Only active courses can be deactivated',
      );
    }

    const [updated] = await db
      .update(courses)
      .set({ status: COURSE_STATUS.ARCHIVED, updatedAt: new Date() })
      .where(eq(courses.id, courseId))
      .returning();

    // Log NELC audit event
    await this.auditService.log({
      eventType: NELC_EVENT_TYPE.COURSE_DEACTIVATED,
      entityType: 'course',
      entityId: courseId,
      userId: user.id,
      metadata: { courseTitle: course.title },
    });

    this.logger.log(`Course "${course.title}" deactivated by ${user.id}`);

    return updated;
  }

  /**
   * Mark an active course as completed.
   * Only MANAGER and ADMIN can complete a course.
   */
  async complete(courseId: string, user: AuthenticatedUser) {
    const [course] = await db
      .select({ id: courses.id, status: courses.status, title: courses.title, instructorId: courses.instructorId })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (course.status !== COURSE_STATUS.ACTIVE) {
      throw new BadRequestException(
        'Only active courses can be marked as completed',
      );
    }

    const [updated] = await db
      .update(courses)
      .set({ status: COURSE_STATUS.COMPLETED, updatedAt: new Date() })
      .where(eq(courses.id, courseId))
      .returning();

    // Finalize all active enrollments → completed
    await this.finalizeEnrollments(courseId);

    // Log NELC audit event
    await this.auditService.log({
      eventType: NELC_EVENT_TYPE.COURSE_DEACTIVATED,
      entityType: 'course',
      entityId: courseId,
      userId: user.id,
      metadata: { courseTitle: course.title, action: 'completed' },
    });

    // Notify instructor
    await this.userNotificationsService.create({
      recipientId: course.instructorId,
      type: 'course_approved',
      title: 'Course Completed',
      message: `Your course "${course.title}" has been marked as completed.`,
      link: '/dashboard/instructor/courses',
      entityType: 'course',
      entityId: courseId,
    });

    this.logger.log(`Course "${course.title}" marked as completed by ${user.id}`);

    return updated;
  }

  /**
   * Finalize all active enrollments for a course.
   * Called when course is completed (manually by instructor or auto by end date).
   * Sets enrollment status to 'completed' with current timestamp.
   * Students' progress and grades are frozen at whatever they submitted.
   */
  private async finalizeEnrollments(courseId: string): Promise<number> {
    const result = await db
      .update(enrollments)
      .set({
        status: 'completed',
        completedAt: new Date(),
      })
      .where(
        and(
          eq(enrollments.courseId, courseId),
          eq(enrollments.status, 'active'),
        ),
      )
      .returning({ id: enrollments.id });

    this.logger.log(
      `Finalized ${result.length} enrollment(s) for course ${courseId}`,
    );
    return result.length;
  }

  // ─── Validation ────────────────────────────────────────────

  /**
   * Validate that a course is ready for activation/review.
   * Checks: modules, sessions, dates, CME hours, session date ranges.
   */
  private async validateCourseReadiness(
    courseId: string,
    context: 'review' | 'activation' = 'review',
  ) {
    const label =
      context === 'activation' ? 'activation' : 'submitting for review';

    // Must have at least 1 module
    const moduleCount = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(courseModules)
      .where(eq(courseModules.courseId, courseId));
    if (moduleCount[0].count === 0) {
      throw new BadRequestException(
        `Course must have at least one module before ${label}`,
      );
    }

    // Must have at least 1 session
    const sessionCount = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(sessions)
      .where(eq(sessions.courseId, courseId));
    if (sessionCount[0].count === 0) {
      throw new BadRequestException(
        `Course must have at least one session before ${label}`,
      );
    }

    // Must have start date and end date
    const [courseDetail] = await db
      .select({
        startDate: courses.startDate,
        endDate: courses.endDate,
        cmeHours: courses.cmeHours,
      })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!courseDetail.startDate || !courseDetail.endDate) {
      throw new BadRequestException(
        `Course must have start and end dates set before ${label}`,
      );
    }

    // Total module hours must meet CME hours (if CME accredited)
    if (courseDetail.cmeHours && courseDetail.cmeHours > 0) {
      const totalMinutes = await db
        .select({
          total: sql<number>`COALESCE(SUM(${courseModules.durationMinutes}), 0)`.mapWith(Number),
        })
        .from(courseModules)
        .where(eq(courseModules.courseId, courseId));
      const totalHours = Math.floor(totalMinutes[0].total / 60);
      if (totalHours < courseDetail.cmeHours) {
        throw new BadRequestException(
          `Total module duration (${totalHours}h) is less than the required CME hours (${courseDetail.cmeHours}h). Add more modules or increase their duration.`,
        );
      }
    }

    // All sessions must be within course date range
    const outOfRangeSessions = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        scheduledAt: sessions.scheduledAt,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.courseId, courseId),
          sql`${sessions.status} != 'cancelled'`,
          or(
            sql`${sessions.scheduledAt}::date < ${courseDetail.startDate}::date`,
            sql`${sessions.scheduledAt}::date > ${courseDetail.endDate}::date`,
          ),
        ),
      );
    if (outOfRangeSessions.length > 0) {
      throw new BadRequestException({
        message: 'Some sessions are scheduled outside the course date range',
        outOfRangeSessions: outOfRangeSessions.map(
          (s) =>
            `${s.title} (${new Date(s.scheduledAt).toLocaleDateString()})`,
        ),
      });
    }
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
    this.addOwnershipCondition(conditions, user);

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

  /**
   * Reassign instructor for a course.
   * Only MANAGER and ADMIN can do this.
   */
  async reassignInstructor(
    courseId: string,
    newInstructorId: string,
    user: AuthenticatedUser,
  ) {
    // Verify the course exists and user has access
    const conditions: any[] = [eq(courses.id, courseId)];
    if (isManager(user)) {
      conditions.push(or(eq(courses.managerId, user.id), sql`${courses.managerId} IS NULL`)!);
    }

    const [course] = await db
      .select({ id: courses.id, title: courses.title, instructorId: courses.instructorId })
      .from(courses)
      .where(and(...conditions))
      .limit(1);

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (course.instructorId === newInstructorId) {
      throw new BadRequestException('This instructor is already assigned to this course');
    }

    // Update the course's instructorId
    const [updated] = await db
      .update(courses)
      .set({ instructorId: newInstructorId, updatedAt: new Date() })
      .where(eq(courses.id, courseId))
      .returning();

    // Also update sessions for this course to the new instructor
    await db
      .update(sessions)
      .set({ instructorId: newInstructorId, updatedAt: new Date() })
      .where(
        and(
          eq(sessions.courseId, courseId),
          sql`${sessions.status} IN ('scheduled')`,
        ),
      );

    this.logger.log(
      `Course "${course.title}" reassigned from ${course.instructorId} to ${newInstructorId} by ${user.id}`,
    );

    return updated;
  }

  // ─── Course Ratings ─────────────────────────────────────────

  /**
   * Create or update a rating for a course.
   */
  async rateCourse(
    courseId: string,
    studentId: string,
    rating: number,
    reviewText?: string,
  ) {
    const [existing] = await db
      .select()
      .from(courseRatings)
      .where(
        and(
          eq(courseRatings.courseId, courseId),
          eq(courseRatings.studentId, studentId),
        ),
      )
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(courseRatings)
        .set({ rating, reviewText, updatedAt: new Date() })
        .where(eq(courseRatings.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(courseRatings)
      .values({ courseId, studentId, rating, reviewText })
      .returning();
    return created;
  }

  /**
   * Get average rating and count for a course.
   */
  async getCourseRatingStats(courseId: string) {
    const [result] = await db
      .select({
        avgRating: sql<number>`COALESCE(AVG(${courseRatings.rating}), 0)`,
        totalRatings: count(),
      })
      .from(courseRatings)
      .where(eq(courseRatings.courseId, courseId));

    return {
      avgRating: Number(Number(result?.avgRating || 0).toFixed(1)),
      totalRatings: Number(result?.totalRatings || 0),
    };
  }

  /**
   * Get all ratings for a course, including student name.
   */
  async getCourseRatings(courseId: string) {
    const ratings = await db
      .select({
        id: courseRatings.id,
        rating: courseRatings.rating,
        reviewText: courseRatings.reviewText,
        createdAt: courseRatings.createdAt,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
      })
      .from(courseRatings)
      .innerJoin(users, eq(courseRatings.studentId, users.id))
      .where(eq(courseRatings.courseId, courseId))
      .orderBy(desc(courseRatings.createdAt));

    return ratings.map((r) => ({
      id: r.id,
      rating: r.rating,
      reviewText: r.reviewText,
      createdAt: r.createdAt,
      studentName: `${r.studentFirstName || ''} ${r.studentLastName || ''}`.trim() || 'Anonymous',
    }));
  }

  /**
   * Get average ratings for all courses (bulk query for dashboard).
   */
  async getAllCourseRatings() {
    const stats = await db
      .select({
        courseId: courseRatings.courseId,
        avgRating: sql<number>`COALESCE(AVG(${courseRatings.rating}), 0)`,
        totalRatings: count(),
      })
      .from(courseRatings)
      .groupBy(courseRatings.courseId);

    const map: Record<string, { avgRating: number; totalRatings: number }> = {};
    for (const s of stats) {
      map[s.courseId] = {
        avgRating: Number(Number(s.avgRating || 0).toFixed(1)),
        totalRatings: Number(s.totalRatings || 0),
      };
    }
    return map;
  }

  /**
   * Delete a rating (admin/manager).
   */
  async deleteRating(ratingId: string) {
    const [deleted] = await db
      .delete(courseRatings)
      .where(eq(courseRatings.id, ratingId))
      .returning();
    return deleted;
  }
}
