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
  assessments,
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
import { CertificatesService } from '../certificates/certificates.service';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(
    private readonly auditService: NelcAuditService,
    private readonly userNotificationsService: UserNotificationsService,
    private readonly emailService: EmailService,
    private readonly certificatesService: CertificatesService,
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

    // Validate enrollment deadline is before start date
    if (dto.enrollmentDeadline && dto.startDate) {
      const deadline = new Date(dto.enrollmentDeadline);
      const start = new Date(dto.startDate);
      if (deadline >= start) {
        throw new BadRequestException('Enrollment deadline must be before the course start date');
      }
    }

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
        // Content fields
        overview: dto.overview,
        overviewAr: dto.overviewAr,
        objectives: dto.objectives,
        objectivesAr: dto.objectivesAr,
        features: dto.features,
        featuresAr: dto.featuresAr,
        targetAudience: dto.targetAudience,
        targetAudienceAr: dto.targetAudienceAr,
        requirements: dto.requirements,
        requirementsAr: dto.requirementsAr,
        notices: dto.notices,
        noticesAr: dto.noticesAr,
        venue: dto.venue,
        venueAr: dto.venueAr,
        showContents: dto.showContents,
        sectionsOrder: dto.sectionsOrder,
      })
      .returning();

    // Notify the assigned instructor (if different from creator)
    if (instructorId !== user.id) {
      this.notifyInstructorAssigned(instructorId, course.title, user.id).catch(() => {});
    }

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

    // Status lifecycle priority: draft first, archived last
    const statusPriority = sql`CASE ${courses.status}
      WHEN 'draft' THEN 1
      WHEN 'pending_review' THEN 2
      WHEN 'changes_requested' THEN 3
      WHEN 'active' THEN 4
      WHEN 'completed' THEN 5
      WHEN 'archived' THEN 6
      ELSE 7
    END`;

    // Determine secondary sort order
    let secondarySort;
    switch (params.sort) {
      case 'oldest':
        secondarySort = asc(courses.createdAt);
        break;
      case 'alphabetical':
        secondarySort = asc(courses.title);
        break;
      case 'students':
        secondarySort = sql`(SELECT COUNT(*) FROM enrollments e WHERE e.course_id = "courses"."id") DESC`;
        break;
      case 'newest':
      default:
        secondarySort = desc(courses.createdAt);
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
        totalModules: sql<number>`(
          SELECT COUNT(*) FROM course_modules cm WHERE cm.course_id = "courses"."id"
        )`.mapWith(Number),
      })
      .from(courses)
      .where(whereClause)
      .orderBy(statusPriority, secondarySort)
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

    // Hide courses where enrollment deadline has passed
    conditions.push(
      or(
        sql`${courses.enrollmentDeadline} IS NULL`,
        sql`${courses.enrollmentDeadline} > NOW()`,
      ) as any,
    );

    // Hide courses that are full (enrolled count >= maxEnrollment)
    // If maxEnrollment is NULL, use NELC default (2000 for non-self-paced)
    conditions.push(
      sql`(
        CASE
          WHEN ${courses.maxEnrollment} IS NOT NULL THEN
            (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = ${courses.id} AND e.status != 'dropped') < ${courses.maxEnrollment}
          WHEN ${courses.deliveryType} = 'self-paced' THEN
            TRUE
          ELSE
            (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = ${courses.id} AND e.status != 'dropped') < 2000
        END
      )` as any,
    );

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

    // Enrich with capacity info
    const enriched = data.map((c) => {
      const isSelfPaced = c.deliveryType === 'self-paced';
      let effectiveMax: number | null;
      if (isSelfPaced) {
        effectiveMax = c.maxEnrollment ?? null; // unlimited if not set
      } else {
        const classification = classifyCourse(c.startDate, c.endDate);
        effectiveMax = c.maxEnrollment ?? getNelcMaxEnrollment(classification);
      }
      const remainingSeats = effectiveMax !== null ? Math.max(0, effectiveMax - c.enrolledCount) : null;
      const isFull = effectiveMax !== null ? remainingSeats === 0 : false;

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
        overview: courses.overview,
        overviewAr: courses.overviewAr,
        objectives: courses.objectives,
        objectivesAr: courses.objectivesAr,
        features: courses.features,
        featuresAr: courses.featuresAr,
        targetAudience: courses.targetAudience,
        targetAudienceAr: courses.targetAudienceAr,
        requirements: courses.requirements,
        requirementsAr: courses.requirementsAr,
        notices: courses.notices,
        noticesAr: courses.noticesAr,
        venue: courses.venue,
        venueAr: courses.venueAr,
        showContents: courses.showContents,
        sectionsOrder: courses.sectionsOrder,
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
          // Hide if enrollment deadline has passed
          or(
            sql`${courses.enrollmentDeadline} IS NULL`,
            sql`${courses.enrollmentDeadline} > NOW()`,
          ),
          // Hide if course is full
          sql`(
            CASE
              WHEN ${courses.maxEnrollment} IS NOT NULL THEN
                (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = ${courses.id} AND e.status != 'dropped') < ${courses.maxEnrollment}
              WHEN ${courses.deliveryType} = 'self-paced' THEN
                TRUE
              ELSE
                (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = ${courses.id} AND e.status != 'dropped') < 2000
            END
          )`,
        ),
      )
      .limit(1);

    if (!data) {
      throw new NotFoundException('Course not found');
    }

    // Fetch sessions for non-self-paced courses
    let sessionsList: Array<{
      id: string; title: string; type: string;
      scheduledAt: Date; durationMinutes: number;
      venueAddress: string | null; roomName: string | null; city: string | null; status: string;
    }> = [];
    if (data.deliveryType !== 'self-paced') {
      sessionsList = await db
        .select({
          id: sessions.id,
          title: sessions.title,
          type: sessions.type,
          scheduledAt: sessions.scheduledAt,
          durationMinutes: sessions.durationMinutes,
          venueAddress: sessions.venueAddress,
          roomName: sessions.roomName,
          city: sessions.city,
          status: sessions.status,
        })
        .from(sessions)
        .where(
          and(
            eq(sessions.courseId, courseId),
            inArray(sessions.status, ['scheduled', 'live', 'completed']),
          ),
        )
        .orderBy(asc(sessions.scheduledAt));
    }

    // Fetch modules for self-paced and blended courses
    let modulesList: Array<{
      id: string; title: string; titleAr: string | null;
      orderIndex: number; type: string; durationMinutes: number | null;
      materials?: Array<{ id: string; title: string; type: string; orderIndex: number }>;
    }> = [];
    if ((data.deliveryType === 'self-paced' || data.deliveryType === 'blended') && data.showContents !== false) {
      modulesList = await db
        .select({
          id: courseModules.id,
          title: courseModules.title,
          titleAr: courseModules.titleAr,
          orderIndex: courseModules.orderIndex,
          type: courseModules.type,
          durationMinutes: courseModules.durationMinutes,
        })
        .from(courseModules)
        .where(eq(courseModules.courseId, courseId))
        .orderBy(asc(courseModules.orderIndex));

      // For the first 2 modules, attach their materials (preview)
      const previewModuleIds = modulesList.slice(0, 2).map((m) => m.id);
      if (previewModuleIds.length > 0) {
        const allMaterials = await db
          .select({
            id: courseMaterials.id,
            title: courseMaterials.title,
            type: courseMaterials.type,
            orderIndex: courseMaterials.orderIndex,
            moduleId: courseMaterials.moduleId,
          })
          .from(courseMaterials)
          .where(
            and(
              inArray(courseMaterials.moduleId, previewModuleIds),
              eq(courseMaterials.status, 'live'),
            ),
          )
          .orderBy(asc(courseMaterials.orderIndex));

        // Group materials by module
        const materialsByModule = new Map<string, typeof allMaterials>();
        for (const mat of allMaterials) {
          if (!mat.moduleId) continue;
          if (!materialsByModule.has(mat.moduleId)) {
            materialsByModule.set(mat.moduleId, []);
          }
          materialsByModule.get(mat.moduleId)!.push(mat);
        }

        modulesList = modulesList.map((mod, i) => ({
          ...mod,
          materials: i < 2 ? (materialsByModule.get(mod.id) || []).map(({ id, title, type, orderIndex }) => ({ id, title, type, orderIndex })) : undefined,
        }));
      }
    }

    // Fetch top 5 recent reviews
    const ratingsList = await db
      .select({
        rating: courseRatings.rating,
        reviewText: courseRatings.reviewText,
        createdAt: courseRatings.createdAt,
        studentName: sql<string>`(
          SELECT CONCAT(u.first_name, ' ', u.last_name) FROM users u
          WHERE u.id = ${courseRatings.studentId}
        )`,
      })
      .from(courseRatings)
      .where(eq(courseRatings.courseId, courseId))
      .orderBy(desc(courseRatings.createdAt))
      .limit(5);

    const isSelfPaced = data.deliveryType === 'self-paced';
    let effectiveMax: number | null;
    if (isSelfPaced) {
      effectiveMax = data.maxEnrollment ?? null;
    } else {
      const classification = classifyCourse(data.startDate, data.endDate);
      effectiveMax = data.maxEnrollment ?? getNelcMaxEnrollment(classification);
    }
    const remainingSeats = effectiveMax !== null ? Math.max(0, effectiveMax - data.enrolledCount) : null;

    return {
      ...data,
      totalHours: Math.round((data.totalHours / 60) * 10) / 10,
      avgRating: Number(Number(data.avgRating || 0).toFixed(1)),
      price: data.price ? Number(data.price) : 0,
      remainingSeats,
      isFull: effectiveMax !== null ? remainingSeats === 0 : false,
      sessions: sessionsList,
      modules: modulesList,
      ratings: ratingsList,
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
    const existing = await this.verifyCourseAccess(courseId, user, { allowCompleted: true });

    // Block all edits for completed/archived courses
    if (existing.status === COURSE_STATUS.COMPLETED || existing.status === COURSE_STATUS.ARCHIVED) {
      throw new BadRequestException('Cannot edit a completed or archived course');
    }

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

    // Validate enrollment deadline changes
    if (dto.enrollmentDeadline !== undefined) {
      // If course already has a deadline that has passed, block edits to it
      if (existing.enrollmentDeadline && new Date(existing.enrollmentDeadline) < new Date()) {
        throw new BadRequestException('Cannot modify enrollment deadline after it has passed');
      }
      // Validate new deadline is before start date
      const newDeadline = new Date(dto.enrollmentDeadline);
      const startDate = dto.startDate ? new Date(dto.startDate) : (existing.startDate ? new Date(existing.startDate) : null);
      if (startDate && newDeadline >= startDate) {
        throw new BadRequestException('Enrollment deadline must be before the course start date');
      }
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
      .select({ id: users.id, email: users.email, firstName: users.firstName, language: users.language })
      .from(users)
      .where(
        sql`${users.activeRole} IN ('MANAGER', 'ADMIN', 'SUPER_ADMIN')`,
      );

    const managerIds = managers.map((m) => m.id);
    if (managerIds.length > 0) {
      const instructorName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;

      // Group managers by locale for bilingual notification
      const arIds: string[] = [];
      const enIds: string[] = [];
      for (const m of managers) {
        if ((m.language || 'en') === 'ar') arIds.push(m.id);
        else enIds.push(m.id);
      }

      if (enIds.length > 0) {
        await this.userNotificationsService.createBulk(enIds, {
          type: 'course_submitted_for_review',
          title: 'Course Submitted for Review',
          message: `${instructorName} submitted "${course.title}" for review.`,
          link: '/dashboard/manager/courses',
          entityType: 'course',
          entityId: courseId,
        });
      }
      if (arIds.length > 0) {
        await this.userNotificationsService.createBulk(arIds, {
          type: 'course_submitted_for_review',
          title: 'تم تقديم دورة للمراجعة',
          message: `${instructorName} قدم "${course.title}" للمراجعة.`,
          link: '/dashboard/manager/courses',
          entityType: 'course',
          entityId: courseId,
        });
      }

      // Email each manager
      for (const mgr of managers) {
        if (mgr.email) {
          const mgrLocale = (mgr.language || 'en') as 'en' | 'ar';
          await this.emailService.sendContentPendingReview(mgr.email, {
            recipientName: mgr.firstName || 'Manager',
            materialTitle: course.title,
            courseName: course.title,
            instructorName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            wcagStatus: 'N/A',
            wcagSummary: 'Course submitted for review',
          }, mgrLocale).catch(() => {});
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

    const [instructor] = await db
      .select({ email: users.email, firstName: users.firstName, language: users.language })
      .from(users)
      .where(eq(users.id, course.instructorId))
      .limit(1);

    const instrIsAr = instructor?.language === 'ar';

    // Notify instructor (in-app + email)
    await this.userNotificationsService.create({
      recipientId: course.instructorId,
      type: 'course_changes_requested',
      title: instrIsAr ? 'تم طلب تعديلات' : 'Changes Requested',
      message: instrIsAr
        ? `تم طلب تعديلات على دورتك "${course.title}": ${note}`
        : `Changes have been requested on your course "${course.title}": ${note}`,
      link: '/dashboard/instructor/courses',
      entityType: 'course',
      entityId: courseId,
    });
    if (instructor?.email) {
      const instrLocale = (instructor.language || 'en') as 'en' | 'ar';
      await this.emailService.sendContentReview(instructor.email, {
        recipientName: instructor.firstName || 'Instructor',
        materialTitle: course.title,
        courseName: course.title,
        decision: 'changes_requested',
        comment: note,
      }, instrLocale).catch(() => {});
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

    // Fetch instructor for notification + email
    const [instructor] = await db
      .select({ email: users.email, firstName: users.firstName, language: users.language })
      .from(users)
      .where(eq(users.id, course.instructorId))
      .limit(1);

    const apIsAr = instructor?.language === 'ar';

    // Notify instructor: course approved
    await this.userNotificationsService.create({
      recipientId: course.instructorId,
      type: 'course_approved',
      title: apIsAr ? 'تمت الموافقة على الدورة' : 'Course Approved',
      message: apIsAr
        ? `تمت الموافقة على دورتك "${course.title}" وهي الآن نشطة.`
        : `Your course "${course.title}" has been approved and is now active.`,
      link: '/dashboard/instructor/courses',
      entityType: 'course',
      entityId: courseId,
    });

    // Email instructor
    if (instructor?.email) {
      const instrLocale = (instructor.language || 'en') as 'en' | 'ar';
      await this.emailService.sendContentReview(instructor.email, {
        recipientName: instructor.firstName || 'Instructor',
        materialTitle: course.title,
        courseName: course.title,
        decision: 'approved',
        comment: null,
      }, instrLocale).catch(() => {});
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

    // Block completion if there are unreviewed materials
    const [pendingMaterials] = await db
      .select({ count: count() })
      .from(courseMaterials)
      .where(
        and(
          eq(courseMaterials.courseId, courseId),
          sql`${courseMaterials.status} IN ('pending_review', 'changes_requested')`,
        ),
      );

    const pendingCount = Number(pendingMaterials?.count || 0);
    if (pendingCount > 0) {
      throw new BadRequestException(
        JSON.stringify({
          code: 'PENDING_MATERIALS_BLOCK',
          pendingCount,
          message: `Cannot complete course: ${pendingCount} material(s) are still pending review. Please approve or reject all content before completing the course.`,
        }),
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
    const [completedInstr] = await db
      .select({ language: users.language })
      .from(users)
      .where(eq(users.id, course.instructorId))
      .limit(1);
    const compIsAr = completedInstr?.language === 'ar';
    await this.userNotificationsService.create({
      recipientId: course.instructorId,
      type: 'course_completed',
      title: compIsAr ? 'اكتملت الدورة' : 'Course Completed',
      message: compIsAr
        ? `تم تعيين دورتك "${course.title}" كمكتملة.`
        : `Your course "${course.title}" has been marked as completed.`,
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
    // Get all active students before finalizing (need studentId for certificates)
    const activeStudents = await db
      .select({ id: enrollments.id, studentId: enrollments.studentId })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, courseId),
          eq(enrollments.status, 'active'),
        ),
      );

    if (activeStudents.length === 0) return 0;

    // Finalize all active enrollments
    await db
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
      );

    // Auto-create certificate requests for all finalized students
    for (const student of activeStudents) {
      try {
        await this.certificatesService.createRequest(courseId, student.studentId, true);
        this.logger.log(
          `Auto-created certificate request for student ${student.studentId} in course ${courseId}`,
        );
      } catch (error) {
        // Skip duplicates or other errors silently
        this.logger.debug(
          `Certificate request skipped for student ${student.studentId}: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      }
    }

    this.logger.log(
      `Finalized ${activeStudents.length} enrollment(s) for course ${courseId}`,
    );
    return activeStudents.length;
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

    // Must have start date and end date — fetch course detail first
    const [courseDetail] = await db
      .select({
        startDate: courses.startDate,
        endDate: courses.endDate,
        cmeHours: courses.cmeHours,
        deliveryType: courses.deliveryType,
      })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    // Must have at least 1 module (required for self-paced and blended; optional for zoom/onsite)
    if (courseDetail.deliveryType === 'self-paced' || courseDetail.deliveryType === 'blended') {
      const moduleCount = await db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(courseModules)
        .where(eq(courseModules.courseId, courseId));
      if (moduleCount[0].count === 0) {
        throw new BadRequestException(
          `Course must have at least one module before ${label}`,
        );
      }
    }

    // Each module must have at least one material (content) — only for self-paced/blended
    // Zoom/onsite: modules are optional supplementary content, no content enforcement
    const allModules = (courseDetail.deliveryType === 'self-paced' || courseDetail.deliveryType === 'blended')
      ? await db
          .select({ id: courseModules.id, title: courseModules.title })
          .from(courseModules)
          .where(eq(courseModules.courseId, courseId))
      : [];

    for (const mod of allModules) {
      const [matCount] = await db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(courseMaterials)
        .where(eq(courseMaterials.moduleId, mod.id));
      if (matCount.count === 0) {
        throw new BadRequestException(
          `Module "${mod.title}" has no content. All modules must have at least one material before ${label}.`,
        );
      }
    }

    // Must have at least 1 session (skip for self-paced courses)
    if (courseDetail.deliveryType !== 'self-paced') {
      const sessionCount = await db
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(sessions)
        .where(eq(sessions.courseId, courseId));
      if (sessionCount[0].count === 0) {
        throw new BadRequestException(
          `Course must have at least one session before ${label}`,
        );
      }
    }

    if (!courseDetail.startDate || !courseDetail.endDate) {
      throw new BadRequestException(
        `Course must have start and end dates set before ${label}`,
      );
    }

    // Total module hours must meet CME hours — only for self-paced/blended
    // Zoom/onsite: CME hours are based on approved lecture duration, not modules
    if (
      courseDetail.cmeHours && courseDetail.cmeHours > 0 &&
      (courseDetail.deliveryType === 'self-paced' || courseDetail.deliveryType === 'blended')
    ) {
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
    // Add 1-day buffer to handle timezone offsets (UTC vs local time)
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
            sql`${sessions.scheduledAt}::date < (${courseDetail.startDate}::date - interval '1 day')`,
            sql`${sessions.scheduledAt}::date > (${courseDetail.endDate}::date + interval '1 day')`,
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
    options?: { allowCompleted?: boolean },
  ) {
    const conditions = [eq(courses.id, courseId)];
    this.addOwnershipCondition(conditions, user);

    const [course] = await db
      .select({
        id: courses.id,
        status: courses.status,
        enrollmentDeadline: courses.enrollmentDeadline,
        startDate: courses.startDate,
      })
      .from(courses)
      .where(and(...conditions))
      .limit(1);

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (!options?.allowCompleted && (course.status === 'completed' || course.status === 'archived')) {
      throw new BadRequestException('Cannot modify a completed or archived course');
    }

    return course;
  }

  /**
   * Notify an instructor that they have been assigned to a course.
   */
  private async notifyInstructorAssigned(instructorId: string, courseTitle: string, assignedById: string) {
    const [instructor] = await db
      .select({ email: users.email, firstName: users.firstName, lastName: users.lastName, language: users.language })
      .from(users)
      .where(eq(users.id, instructorId))
      .limit(1);
    if (!instructor) return;

    const [assigner] = await db
      .select({ firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, assignedById))
      .limit(1);
    const assignerName = assigner ? [assigner.firstName, assigner.lastName].filter(Boolean).join(' ') : 'Admin';
    const instructorName = [instructor.firstName, instructor.lastName].filter(Boolean).join(' ') || 'Instructor';
    const locale = (instructor.language || 'en') as 'en' | 'ar';

    // In-app notification
    await this.userNotificationsService.create({
      recipientId: instructorId,
      type: 'course_assigned',
      title: locale === 'ar' ? `تم تعيين دورة: ${courseTitle}` : `Course Assigned: ${courseTitle}`,
      message: locale === 'ar'
        ? `تم تعيينك كمدرب للدورة "${courseTitle}" بواسطة ${assignerName}.`
        : `You have been assigned as instructor for "${courseTitle}" by ${assignerName}.`,
      link: '/dashboard/instructor',
      entityType: 'course',
      entityId: null,
    });

    // Email
    const { getEmailStrings, t: tt } = await import('../email/email-i18n');
    const s = getEmailStrings(locale);
    this.emailService.sendGenericNotification(
      instructor.email,
      { recipientName: instructorName, subject: tt(s.courseAssignedSubject, { course: courseTitle }), message: `${s.courseAssignedBody}\n\n${s.courseLabel} ${courseTitle}\n${s.assignedByLabel} ${assignerName}\n\n${s.courseAssignedCta}` },
      locale,
    ).catch(() => {});
  }

  /**
   * Notify an instructor that they have been removed from a course.
   */
  private async notifyInstructorUnassigned(instructorId: string, courseTitle: string) {
    const [instructor] = await db
      .select({ email: users.email, firstName: users.firstName, lastName: users.lastName, language: users.language })
      .from(users)
      .where(eq(users.id, instructorId))
      .limit(1);
    if (!instructor) return;

    const instructorName = [instructor.firstName, instructor.lastName].filter(Boolean).join(' ') || 'Instructor';
    const locale = (instructor.language || 'en') as 'en' | 'ar';

    // In-app notification
    await this.userNotificationsService.create({
      recipientId: instructorId,
      type: 'course_unassigned',
      title: locale === 'ar' ? `تم إلغاء تعيين الدورة: ${courseTitle}` : `Course Unassigned: ${courseTitle}`,
      message: locale === 'ar'
        ? `تم إزالتك كمدرب من الدورة "${courseTitle}".`
        : `You have been removed as instructor for "${courseTitle}".`,
      link: '/dashboard/instructor',
      entityType: 'course',
      entityId: null,
    });

    // Email
    const { getEmailStrings, t: tt } = await import('../email/email-i18n');
    const s = getEmailStrings(locale);
    this.emailService.sendGenericNotification(
      instructor.email,
      { recipientName: instructorName, subject: tt(s.courseUnassignedSubject, { course: courseTitle }), message: `${s.courseUnassignedBody}\n\n${s.courseLabel} ${courseTitle}` },
      locale,
    ).catch(() => {});
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

    // Notify old instructor (removed) and new instructor (assigned)
    this.notifyInstructorUnassigned(course.instructorId, course.title).catch(() => {});
    this.notifyInstructorAssigned(newInstructorId, course.title, user.id).catch(() => {});

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
