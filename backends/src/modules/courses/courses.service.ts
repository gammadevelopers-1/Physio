import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { eq, and, ilike, or, desc, asc, count, sql, inArray, isNull } from 'drizzle-orm';
import { db } from '../../database';
import {
  courses,
  courseModules,
  courseMaterials,
  courseAssistants,
  enrollments,
  payments,
  sessions,
  courseRatings,
  instructorRatings,
  assessments,
  certificateRequests,
  users,
  COURSE_STATUS,
  CERTIFICATE_STATUS,
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
import { PointsService } from '../points/points.service';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { AdminSettingsService } from '../admin-settings/admin-settings.service';
import { SessionsService } from '../sessions/sessions.service';
import { toArabicIndic } from '../../common/platform-locale';
import { sanitizeRichText } from '../../common/sanitize-html';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(
    private readonly auditService: NelcAuditService,
    private readonly userNotificationsService: UserNotificationsService,
    private readonly emailService: EmailService,
    private readonly certificatesService: CertificatesService,
    private readonly pointsService: PointsService,
    private readonly auditLogService: AuditLogService,
    private readonly adminSettings: AdminSettingsService,
    @Inject(forwardRef(() => SessionsService))
    private readonly sessionsService: SessionsService,
  ) {}

  /**
   * Write a course-action entry to audit_logs. Currently only fires for
   * admin-initiated actions — manager actions are covered by NELC audit
   * (which is the regulator-facing log). This second log surfaces
   * platform-level oversight in the admin-only Logs page.
   */
  private async maybeLogAdminAction(
    actor: AuthenticatedUser,
    courseId: string,
    action: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (!isGlobalAdmin(actor)) return;
    await this.auditLogService.log({
      entityType: 'course',
      entityId: courseId,
      action,
      performedBy: actor.id,
      metadata,
    });
  }

  /**
   * Parse an enrollment-deadline input. A bare YYYY-MM-DD is interpreted
   * as end-of-day Asia/Riyadh (UTC+3) — 23:59:59 AST — so a deadline of
   * "2026-05-15" lets students enroll through the end of that day in Saudi time.
   */
  private parseEnrollmentDeadline(value: string): Date {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      // 23:59:59 AST = 20:59:59 UTC
      return new Date(Date.UTC(y, mo - 1, d, 20, 59, 59));
    }
    return new Date(value);
  }

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
      const deadline = this.parseEnrollmentDeadline(dto.enrollmentDeadline);
      const start = new Date(dto.startDate);
      if (deadline >= start) {
        throw new BadRequestException({
          code: 'ENROLLMENT_DEADLINE_AFTER_START',
          message: 'Enrollment deadline must be before the course start date',
        });
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
          ? this.parseEnrollmentDeadline(dto.enrollmentDeadline)
          : undefined,
        isCmeAccredited: dto.isCmeAccredited,
        language: dto.language,
        startDate: dto.startDate,
        endDate: dto.endDate,
        cohort: dto.cohort,
        accreditationNumber: dto.accreditationNumber,
        nelcReviewLink: dto.nelcReviewLink,
        // Content fields. overview / overviewAr are rich-text HTML
        // authored in the TipTap editor by managers/instructors; sanitize
        // before insert so stored data is always safe regardless of which
        // surface renders it.
        overview: sanitizeRichText(dto.overview),
        overviewAr: sanitizeRichText(dto.overviewAr),
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
        ...(dto.visibleOnPublicSite !== undefined && { visibleOnPublicSite: dto.visibleOnPublicSite }),
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
      instructorId?: string;
      managerId?: string;
    },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [
      isNull(courses.deletedAt),
    ];

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

    // Admin-only filters: only honored when the caller's ownership scope
    // doesn't already constrain visibility. Manager/instructor get their
    // own scope; passing these as a manager would still work but the
    // intersection would just narrow further, never widen.
    if (params.instructorId) {
      conditions.push(eq(courses.instructorId, params.instructorId));
    }
    if (params.managerId) {
      conditions.push(eq(courses.managerId, params.managerId));
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
        managerName: sql<string | null>`(
          SELECT CONCAT(u.first_name, ' ', u.last_name) FROM users u
          WHERE u.id = "courses"."manager_id"
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
    /**
     * Top-level visibility scope:
     *   'open'     → currently enrollable: not completed, deadline not passed,
     *                end date hasn't passed yet. This is the DEFAULT for the
     *                public /courses listing.
     *   'archived' → completed OR deadline passed OR end date passed. The
     *                /archived page passes this explicitly.
     *   undefined  → defaults to 'open'.
     */
    scope?: 'open' | 'archived';
    sort?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [
      or(
        eq(courses.status, COURSE_STATUS.ACTIVE),
        eq(courses.status, COURSE_STATUS.COMPLETED),
      ) as any,
      eq(courses.visibleOnPublicSite, true),
      isNull(courses.deletedAt),
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

    // 'featured' sort doubles as a filter — only return featured courses.
    if (params.sort === 'featured') {
      conditions.push(eq(courses.isFeatured, true));
    }

    if (params.language && params.language !== 'all') {
      // 'en' and 'ar' filters include bilingual ('both') courses;
      // 'both' stays strict for students who specifically want bilingual.
      if (params.language === 'en') {
        conditions.push(inArray(courses.language, ['en', 'both']));
      } else if (params.language === 'ar') {
        conditions.push(inArray(courses.language, ['ar', 'both']));
      } else {
        conditions.push(eq(courses.language, params.language));
      }
    }

    const whereClause = and(...conditions);

    // Sort respects the user's choice — "newest" means newest first, regardless
    // of availability status. Availability is filterable separately and shown
    // on the card itself, so it must not push new courses behind older "open"
    // ones in the list.
    let orderBy: any[];
    switch (params.sort) {
      case 'rating':
        orderBy = [
          sql`(SELECT COALESCE(AVG(cr.rating), 0) FROM course_ratings cr WHERE cr.course_id = "courses"."id") DESC`,
          desc(courses.createdAt),
        ];
        break;
      case 'featured':
      case 'newest':
      default:
        orderBy = [desc(courses.createdAt)];
        break;
    }

    const data = await db
      .select({
        id: courses.id,
        title: courses.title,
        titleAr: courses.titleAr,
        description: courses.description,
        descriptionAr: courses.descriptionAr,
        deliveryType: courses.deliveryType,
        status: courses.status,
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
          COALESCE((SELECT SUM(cm.duration_minutes) FROM course_modules cm WHERE cm.course_id = "courses"."id"), 0)
          + COALESCE((SELECT SUM(s.duration_minutes) FROM sessions s WHERE s.course_id = "courses"."id"), 0)
        )`.mapWith(Number),
        sessionCount: sql<number>`(
          SELECT COUNT(*) FROM sessions s WHERE s.course_id = "courses"."id"
        )`.mapWith(Number),
        avgRating: sql<number>`(
          SELECT COALESCE(AVG(cr.rating), 0) FROM course_ratings cr WHERE cr.course_id = "courses"."id" AND cr.is_published = true
        )`.mapWith(Number),
        totalRatings: sql<number>`(
          SELECT COUNT(*) FROM course_ratings cr WHERE cr.course_id = "courses"."id" AND cr.is_published = true
        )`.mapWith(Number),
        instructorName: sql<string>`(
          SELECT CONCAT(u.first_name, ' ', u.last_name) FROM users u
          WHERE u.id = "courses"."instructor_id"
        )`,
      })
      .from(courses)
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);

    // Enrich with capacity info + availability status
    const now = new Date();
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
      const deadlinePassed = !!(c.enrollmentDeadline && new Date(c.enrollmentDeadline) <= now);

      let availabilityStatus: 'open' | 'completed' | 'full' | 'deadline_passed';
      if (c.status === 'completed') {
        availabilityStatus = 'completed';
      } else if (deadlinePassed) {
        availabilityStatus = 'deadline_passed';
      } else if (isFull) {
        availabilityStatus = 'full';
      } else {
        availabilityStatus = 'open';
      }

      return {
        ...c,
        totalHours: Math.round((c.totalHours / 60) * 10) / 10,
        avgRating: Number(Number(c.avgRating || 0).toFixed(1)),
        price: c.price ? Number(c.price) : 0,
        remainingSeats,
        isFull,
        availabilityStatus,
      };
    });

    // Top-level scope: split open (currently enrollable / live) vs archived
    // (completed, deadline passed, or end date passed). Default is 'open' so
    // the main /courses page never shows expired content unless the caller
    // explicitly asks for the archive.
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const hasEnded = (c: { endDate: string | null }) => {
      if (!c.endDate) return false;
      const ed = new Date(c.endDate);
      const edLocal = new Date(ed.getFullYear(), ed.getMonth(), ed.getDate());
      return edLocal < today;
    };
    const isArchived = (c: {
      availabilityStatus: 'open' | 'completed' | 'full' | 'deadline_passed';
      endDate: string | null;
    }) =>
      c.availabilityStatus === 'completed' ||
      c.availabilityStatus === 'deadline_passed' ||
      hasEnded(c);

    const scope = params.scope === 'archived' ? 'archived' : 'open';
    let filtered = enriched.filter((c) =>
      scope === 'archived' ? isArchived(c) : !isArchived(c),
    );

    // Sub-filter inside the active scope (UI-driven availability filter).
    // Only applies on the open scope — on /archived the user already sees
    // a single bucket so additional availability chips are meaningless.
    if (scope === 'open') {
      if (params.availability === 'open') {
        filtered = filtered.filter((c) => c.availabilityStatus === 'open');
      } else if (params.availability === 'starting_soon') {
        filtered = filtered.filter(
          (c) =>
            !c.isFull &&
            c.enrollmentDeadline &&
            new Date(c.enrollmentDeadline) > now,
        );
      } else if (params.availability === 'full') {
        filtered = filtered.filter((c) => c.isFull);
      }
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
   * Toggle a course's featured flag. Manager (own course) or admin only.
   */
  async toggleFeatured(courseId: string, user: AuthenticatedUser) {
    const [course] = await db
      .select({
        id: courses.id,
        managerId: courses.managerId,
        isFeatured: courses.isFeatured,
        title: courses.title,
      })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (!isGlobalAdmin(user) && course.managerId !== user.id) {
      throw new ForbiddenException('You do not manage this course');
    }

    const [updated] = await db
      .update(courses)
      .set({ isFeatured: !course.isFeatured, updatedAt: new Date() })
      .where(eq(courses.id, courseId))
      .returning({ id: courses.id, isFeatured: courses.isFeatured });

    this.logger.log(
      `Course "${course.title}" featured=${updated.isFeatured} by ${user.id}`,
    );

    await this.maybeLogAdminAction(user, courseId, 'course.toggle_featured', {
      title: course.title,
      isFeatured: updated.isFeatured,
    });

    return updated;
  }

  /**
   * Return a fair-distributed random mix of featured courses for the homepage.
   * Round-robin across managers + random shuffle within each manager's pool.
   */
  async findFeaturedForHome(limit: number = 4) {
    const rows = await db
      .select({
        id: courses.id,
        title: courses.title,
        titleAr: courses.titleAr,
        description: courses.description,
        descriptionAr: courses.descriptionAr,
        deliveryType: courses.deliveryType,
        status: courses.status,
        thumbnail: courses.thumbnail,
        maxEnrollment: courses.maxEnrollment,
        price: courses.price,
        cmeHours: courses.cmeHours,
        enrollmentDeadline: courses.enrollmentDeadline,
        isCmeAccredited: courses.isCmeAccredited,
        language: courses.language,
        startDate: courses.startDate,
        endDate: courses.endDate,
        managerId: courses.managerId,
        enrolledCount: sql<number>`(
          SELECT COUNT(*) FROM enrollments e WHERE e.course_id = "courses"."id" AND e.status != 'dropped'
        )`.mapWith(Number),
        totalHours: sql<number>`(
          COALESCE((SELECT SUM(cm.duration_minutes) FROM course_modules cm WHERE cm.course_id = "courses"."id"), 0)
          + COALESCE((SELECT SUM(s.duration_minutes) FROM sessions s WHERE s.course_id = "courses"."id"), 0)
        )`.mapWith(Number),
        sessionCount: sql<number>`(
          SELECT COUNT(*) FROM sessions s WHERE s.course_id = "courses"."id"
        )`.mapWith(Number),
        avgRating: sql<number>`(
          SELECT COALESCE(AVG(cr.rating), 0) FROM course_ratings cr WHERE cr.course_id = "courses"."id" AND cr.is_published = true
        )`.mapWith(Number),
        totalRatings: sql<number>`(
          SELECT COUNT(*) FROM course_ratings cr WHERE cr.course_id = "courses"."id" AND cr.is_published = true
        )`.mapWith(Number),
        instructorName: sql<string>`(
          SELECT CONCAT(u.first_name, ' ', u.last_name) FROM users u
          WHERE u.id = "courses"."instructor_id"
        )`,
      })
      .from(courses)
      .where(
        and(
          eq(courses.isFeatured, true),
          eq(courses.status, COURSE_STATUS.ACTIVE),
          eq(courses.visibleOnPublicSite, true),
        ),
      );

    if (rows.length === 0) return [];

    // Group by manager (null managerId bucketed under '__none__')
    const byManager = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = r.managerId ?? '__none__';
      const bucket = byManager.get(key) ?? [];
      bucket.push(r);
      byManager.set(key, bucket);
    }

    // Fisher-Yates shuffle in place
    const shuffle = <T,>(arr: T[]): T[] => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    // Shuffle within each manager + shuffle manager order
    for (const list of byManager.values()) shuffle(list);
    const managers = shuffle([...byManager.keys()]);

    // Round-robin pick
    const picked: typeof rows = [];
    let progressed = true;
    while (picked.length < limit && progressed) {
      progressed = false;
      for (const m of managers) {
        if (picked.length >= limit) break;
        const list = byManager.get(m)!;
        if (list.length > 0) {
          picked.push(list.shift()!);
          progressed = true;
        }
      }
    }

    // Enrich with capacity/availability (same rules as findAllPublic)
    const now = new Date();
    return picked.map((c) => {
      const isSelfPaced = c.deliveryType === 'self-paced';
      let effectiveMax: number | null;
      if (isSelfPaced) {
        effectiveMax = c.maxEnrollment ?? null;
      } else {
        const classification = classifyCourse(c.startDate, c.endDate);
        effectiveMax = c.maxEnrollment ?? getNelcMaxEnrollment(classification);
      }
      const remainingSeats =
        effectiveMax !== null ? Math.max(0, effectiveMax - c.enrolledCount) : null;
      const isFull = effectiveMax !== null ? remainingSeats === 0 : false;
      const deadlinePassed = !!(
        c.enrollmentDeadline && new Date(c.enrollmentDeadline) <= now
      );

      let availabilityStatus: 'open' | 'completed' | 'full' | 'deadline_passed';
      if (c.status === 'completed') {
        availabilityStatus = 'completed';
      } else if (deadlinePassed) {
        availabilityStatus = 'deadline_passed';
      } else if (isFull) {
        availabilityStatus = 'full';
      } else {
        availabilityStatus = 'open';
      }

      return {
        ...c,
        totalHours: Math.round((c.totalHours / 60) * 10) / 10,
        avgRating: Number(Number(c.avgRating || 0).toFixed(1)),
        price: c.price ? Number(c.price) : 0,
        remainingSeats,
        isFull,
        availabilityStatus,
      };
    });
  }

  /**
   * Get a single public course by ID with enriched data.
   */
  async findOnePublic(courseId: string) {
    // Filter inside the where clause below — keep deleted courses
    // invisible on the public site.
    const [data] = await db
      .select({
        id: courses.id,
        title: courses.title,
        titleAr: courses.titleAr,
        description: courses.description,
        descriptionAr: courses.descriptionAr,
        deliveryType: courses.deliveryType,
        status: courses.status,
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
        faqs: courses.faqs,
        accreditationNumber: courses.accreditationNumber,
        showContents: courses.showContents,
        sectionsOrder: courses.sectionsOrder,
        seoTitle: courses.seoTitle,
        seoDescription: courses.seoDescription,
        seoKeywords: courses.seoKeywords,
        seoOgImage: courses.seoOgImage,
        seoNoindex: courses.seoNoindex,
        enrolledCount: sql<number>`(
          SELECT COUNT(*) FROM enrollments e WHERE e.course_id = "courses"."id" AND e.status != 'dropped'
        )`.mapWith(Number),
        totalHours: sql<number>`(
          COALESCE((SELECT SUM(cm.duration_minutes) FROM course_modules cm WHERE cm.course_id = "courses"."id"), 0)
          + COALESCE((SELECT SUM(s.duration_minutes) FROM sessions s WHERE s.course_id = "courses"."id"), 0)
        )`.mapWith(Number),
        sessionCount: sql<number>`(
          SELECT COUNT(*) FROM sessions s WHERE s.course_id = "courses"."id"
        )`.mapWith(Number),
        avgRating: sql<number>`(
          SELECT COALESCE(AVG(cr.rating), 0) FROM course_ratings cr WHERE cr.course_id = "courses"."id" AND cr.is_published = true
        )`.mapWith(Number),
        totalRatings: sql<number>`(
          SELECT COUNT(*) FROM course_ratings cr WHERE cr.course_id = "courses"."id" AND cr.is_published = true
        )`.mapWith(Number),
        instructorName: sql<string>`(
          SELECT CONCAT(u.first_name, ' ', u.last_name) FROM users u
          WHERE u.id = "courses"."instructor_id"
        )`,
        // Extended instructor profile — joined for the public course-detail
        // instructor card. Each is nullable; the UI hides any missing field.
        instructorId: courses.instructorId,
        instructorFirstName: sql<string | null>`(
          SELECT u.first_name FROM users u WHERE u.id = "courses"."instructor_id"
        )`,
        instructorLastName: sql<string | null>`(
          SELECT u.last_name FROM users u WHERE u.id = "courses"."instructor_id"
        )`,
        instructorFirstNameAr: sql<string | null>`(
          SELECT u.first_name_ar FROM users u WHERE u.id = "courses"."instructor_id"
        )`,
        instructorLastNameAr: sql<string | null>`(
          SELECT u.last_name_ar FROM users u WHERE u.id = "courses"."instructor_id"
        )`,
        instructorAvatar: sql<string | null>`(
          SELECT u.avatar FROM users u WHERE u.id = "courses"."instructor_id"
        )`,
        instructorEmail: sql<string | null>`(
          SELECT u.email FROM users u WHERE u.id = "courses"."instructor_id"
        )`,
        instructorBio: sql<string | null>`(
          SELECT u.bio FROM users u WHERE u.id = "courses"."instructor_id"
        )`,
        instructorSpecialty: sql<string | null>`(
          SELECT u.specialty FROM users u WHERE u.id = "courses"."instructor_id"
        )`,
        instructorProfession: sql<string | null>`(
          SELECT u.profession FROM users u WHERE u.id = "courses"."instructor_id"
        )`,
        instructorQualification: sql<string | null>`(
          SELECT u.qualification FROM users u WHERE u.id = "courses"."instructor_id"
        )`,
        instructorTwitter: sql<string | null>`(
          SELECT u.twitter FROM users u WHERE u.id = "courses"."instructor_id"
        )`,
        instructorLinkedin: sql<string | null>`(
          SELECT u.linkedin FROM users u WHERE u.id = "courses"."instructor_id"
        )`,
        instructorAvgRating: sql<number>`(
          SELECT COALESCE(ROUND(AVG(ir.rating)::numeric, 1), 0)
          FROM instructor_ratings ir
          WHERE ir.instructor_id = "courses"."instructor_id"
            AND ir.moderation_status = 'approved'
            AND ir.is_published = true
        )`.mapWith(Number),
        instructorTotalRatings: sql<number>`(
          SELECT COUNT(*)
          FROM instructor_ratings ir
          WHERE ir.instructor_id = "courses"."instructor_id"
            AND ir.moderation_status = 'approved'
            AND ir.is_published = true
        )`.mapWith(Number),
      })
      .from(courses)
      .where(
        and(
          eq(courses.id, courseId),
          eq(courses.visibleOnPublicSite, true),
          or(
            eq(courses.status, COURSE_STATUS.ACTIVE),
            eq(courses.status, COURSE_STATUS.COMPLETED),
          ),
          isNull(courses.deletedAt),
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
      isWebinar: boolean | null;
      zoomWebinarId: string | null;
      webinarRegistrationUrl: string | null;
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
          isWebinar: sessions.isWebinar,
          zoomWebinarId: sessions.zoomWebinarId,
          webinarRegistrationUrl: sessions.webinarRegistrationUrl,
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
              isNull(courseMaterials.deletedAt),
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
      .where(and(eq(courseRatings.courseId, courseId), eq(courseRatings.isPublished, true)))
      .orderBy(desc(courseRatings.rating), desc(courseRatings.createdAt))
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
    const isFull = effectiveMax !== null ? remainingSeats === 0 : false;
    const deadlinePassed = !!(data.enrollmentDeadline && new Date(data.enrollmentDeadline) <= new Date());

    let availabilityStatus: 'open' | 'completed' | 'full' | 'deadline_passed';
    if (data.status === 'completed') {
      availabilityStatus = 'completed';
    } else if (deadlinePassed) {
      availabilityStatus = 'deadline_passed';
    } else if (isFull) {
      availabilityStatus = 'full';
    } else {
      availabilityStatus = 'open';
    }

    // Pull all instructor.* fields into a nested `instructor` object so the
    // frontend doesn't have to know the flat naming. Hide the flat fields
    // from the response to keep the public payload tidy.
    const {
      instructorId,
      instructorFirstName,
      instructorLastName,
      instructorFirstNameAr,
      instructorLastNameAr,
      instructorAvatar,
      instructorEmail,
      instructorBio,
      instructorSpecialty,
      instructorProfession,
      instructorQualification,
      instructorTwitter,
      instructorLinkedin,
      instructorAvgRating,
      instructorTotalRatings,
      seoTitle,
      seoDescription,
      seoKeywords,
      seoOgImage,
      seoNoindex,
      ...rest
    } = data;

    // Nested SEO object for the public payload. Empty fields are returned
    // as-is — the frontend metadata helper falls back to title /
    // description / thumbnail when a field is missing.
    const seo = {
      title: seoTitle,
      description: seoDescription,
      keywords: seoKeywords,
      ogImage: seoOgImage,
      noindex: !!seoNoindex,
    };

    const instructor = {
      id: instructorId,
      firstName: instructorFirstName,
      lastName: instructorLastName,
      firstNameAr: instructorFirstNameAr,
      lastNameAr: instructorLastNameAr,
      avatar: instructorAvatar,
      email: instructorEmail,
      bio: instructorBio,
      specialty: instructorSpecialty,
      profession: instructorProfession,
      qualification: instructorQualification,
      twitter: instructorTwitter,
      linkedin: instructorLinkedin,
      avgRating: Number(Number(instructorAvgRating || 0).toFixed(1)),
      totalRatings: Number(instructorTotalRatings || 0),
    };

    return {
      ...rest,
      totalHours: Math.round((rest.totalHours / 60) * 10) / 10,
      avgRating: Number(Number(rest.avgRating || 0).toFixed(1)),
      price: rest.price ? Number(rest.price) : 0,
      remainingSeats,
      isFull,
      availabilityStatus,
      instructor,
      seo,
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

    const conditions = [eq(courses.id, courseId), isNull(courses.deletedAt)];
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

    // Instructors can only edit courses in draft or changes_requested status.
    // Managers/admins can edit at any status (including completed and archived).
    if (
      !isManagerOrAbove(user) &&
      existing.status !== COURSE_STATUS.DRAFT &&
      existing.status !== COURSE_STATUS.CHANGES_REQUESTED
    ) {
      throw new ForbiddenException(
        'You can only edit courses in draft or changes requested status',
      );
    }

    // Validate enrollment deadline changes — deadline can only move FORWARD in time
    if (dto.enrollmentDeadline !== undefined) {
      const newDeadline = this.parseEnrollmentDeadline(dto.enrollmentDeadline);

      // Never shorten a previously-set deadline (even if the old one passed)
      if (existing.enrollmentDeadline && newDeadline <= new Date(existing.enrollmentDeadline)) {
        throw new BadRequestException({
          code: 'ENROLLMENT_DEADLINE_NOT_FORWARD',
          message: 'Enrollment deadline can only be extended, not shortened',
        });
      }

      // Deadline must still land before the course start date
      const startDate = dto.startDate ? new Date(dto.startDate) : (existing.startDate ? new Date(existing.startDate) : null);
      if (startDate && newDeadline >= startDate) {
        throw new BadRequestException({
          code: 'ENROLLMENT_DEADLINE_AFTER_START',
          message: 'Enrollment deadline must be before the course start date',
        });
      }
    }

    // Validate maxEnrollment changes — capacity can only go up, never down
    if (dto.maxEnrollment !== undefined) {
      if (existing.maxEnrollment !== null && dto.maxEnrollment < existing.maxEnrollment) {
        throw new BadRequestException({
          code: 'ENROLLMENT_CAPACITY_DECREASE',
          message: 'Enrollment capacity can only be increased, not decreased',
        });
      }
      // Safety: never allow capacity to drop below current enrolled students
      const [enrolledRow] = await db
        .select({ count: count() })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.courseId, courseId),
            sql`${enrollments.status} != 'dropped'`,
          ),
        );
      const enrolledCount = Number(enrolledRow?.count || 0);
      if (dto.maxEnrollment < enrolledCount) {
        throw new BadRequestException({
          code: 'ENROLLMENT_CAPACITY_BELOW_ENROLLED',
          message: `Enrollment capacity (${dto.maxEnrollment}) cannot be less than currently enrolled students (${enrolledCount})`,
          meta: { capacity: dto.maxEnrollment, enrolled: enrolledCount },
        });
      }
    }

    // Switching a course to 'webinar' delivery type is only valid if the
    // course has no modules, no assessments, and no non-webinar sessions.
    // Webinar Courses are attendance-only by contract — we cannot retain
    // pre-existing content that would break that guarantee.
    if (dto.deliveryType === 'webinar' && existing.deliveryType !== 'webinar') {
      const [moduleRow] = await db
        .select({ count: count() })
        .from(courseModules)
        .where(eq(courseModules.courseId, courseId));
      if (Number(moduleRow?.count || 0) > 0) {
        throw new BadRequestException(
          'Cannot switch to Webinar Course: this course already has modules. Remove them first.',
        );
      }
      const [assessmentRow] = await db
        .select({ count: count() })
        .from(assessments)
        .where(eq(assessments.courseId, courseId));
      if (Number(assessmentRow?.count || 0) > 0) {
        throw new BadRequestException(
          'Cannot switch to Webinar Course: this course already has assessments. Remove them first.',
        );
      }
      const [nonWebinarSessionRow] = await db
        .select({ count: count() })
        .from(sessions)
        .where(
          and(
            eq(sessions.courseId, courseId),
            eq(sessions.isWebinar, false),
          ),
        );
      if (Number(nonWebinarSessionRow?.count || 0) > 0) {
        throw new BadRequestException(
          'Cannot switch to Webinar Course: this course already has non-webinar lectures. Remove them first.',
        );
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
      updateData.enrollmentDeadline = this.parseEnrollmentDeadline(enrollmentDeadline);
    }
    // Sanitize rich-text fields on update too (same reason as create —
    // these are HTML rendered by other surfaces). Only touches the
    // fields when present in the payload, so partial updates work.
    if ('overview' in restDto) {
      updateData.overview = sanitizeRichText(restDto.overview);
    }
    if ('overviewAr' in restDto) {
      updateData.overviewAr = sanitizeRichText(restDto.overviewAr);
    }

    const [updated] = await db
      .update(courses)
      .set(updateData)
      .where(eq(courses.id, courseId))
      .returning();

    // Trim the payload before logging — full course objects are noisy
    // and have nothing we'd want to read back from an audit trail. The
    // small set below covers the toggles the admin UI actually flips.
    const auditPayload: Record<string, unknown> = {};
    for (const k of [
      'title',
      'titleAr',
      'price',
      'isFeatured',
      'visibleOnPublicSite',
      'status',
      'maxEnrollment',
    ]) {
      if (k in dto) auditPayload[k] = (dto as any)[k];
    }
    await this.maybeLogAdminAction(user, courseId, 'course.update', auditPayload);

    return updated;
  }

  /**
   * Soft-delete a course.
   *
   * Sets `deleted_at` / `deleted_by` on the row instead of removing it,
   * so the course can be restored later from the admin "Recently
   * deleted courses" panel. All list / detail / catalog queries
   * filter `deleted_at IS NULL`, so the course disappears from
   * every UI surface immediately. Modules, materials, enrollments,
   * sessions, payments, and certificates are NOT touched — they're
   * inaccessible only because their parent course is hidden.
   *
   * Permissions:
   *   - MANAGER: can soft-delete only DRAFT courses (or unassigned).
   *     Matches the prior hard-delete behavior.
   *   - ADMIN / SUPER_ADMIN: can soft-delete a course in ANY status,
   *     including active courses with enrolled students. Audit
   *     captures the full pre-state.
   */
  async remove(courseId: string, user: AuthenticatedUser, reason?: string, ip?: string) {
    if (!isManagerOrAbove(user)) {
      throw new ForbiddenException('Only managers and admins can delete courses');
    }

    // Managers can only delete their own courses (or unassigned ones)
    const conditions = [eq(courses.id, courseId), isNull(courses.deletedAt)];
    if (isManager(user) && !isGlobalAdmin(user)) {
      conditions.push(or(eq(courses.managerId, user.id), sql`${courses.managerId} IS NULL`)!);
    }

    const [existing] = await db
      .select()
      .from(courses)
      .where(and(...conditions))
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Course not found');
    }

    // Managers (non-admin) are still locked to draft-only deletes — this
    // matches the prior hard-delete behavior. Admins can delete any status.
    if (!isGlobalAdmin(user) && existing.status !== COURSE_STATUS.DRAFT) {
      throw new BadRequestException(
        'Only draft courses can be deleted',
      );
    }

    // Block delete when there are pending or paid payments — the finance
    // team needs the row for chargeback/refund reconciliation. Hard-delete
    // would orphan invoices and break the audit trail.
    const [activePayments] = await db
      .select({ count: count() })
      .from(payments)
      .where(
        and(
          eq(payments.courseId, courseId),
          inArray(payments.status, ['pending', 'paid']),
        ),
      );

    if (Number(activePayments?.count || 0) > 0) {
      throw new BadRequestException(
        'Cannot delete course with active or pending payments',
      );
    }

    const impact = await this.computeCourseImpact(courseId);

    // Block delete when certificate requests are pending — a student
    // is waiting on an approve/reject decision and would be stranded
    // if the course vanished mid-review. Force the admin/manager to
    // clear the queue first.
    if (impact.pendingCertificates > 0) {
      throw new BadRequestException(
        `Cannot delete: ${impact.pendingCertificates} certificate request(s) are pending review for this course. Approve or reject them first, then try again.`,
      );
    }

    await db
      .update(courses)
      .set({
        deletedAt: new Date(),
        deletedBy: user.id,
        updatedAt: new Date(),
      })
      .where(eq(courses.id, courseId));

    // Cascade-cancel every upcoming session for this course. Each
    // session gets its Zoom resource torn down, status flipped to
    // cancelled, individual session audit entry, AND a notification
    // to the enrolled students explaining why. Failures per-session
    // are logged but do not roll back the course soft-delete — the
    // course is gone from every UI surface either way; missed
    // cancellations get re-tried by the session-reminder cron's
    // `deletedAt IS NULL` filter as defense-in-depth.
    const cancelReason =
      reason && reason.trim().length > 0
        ? `Course deleted: ${reason.trim()}`
        : 'The course was deleted by an administrator.';
    const cascade = await this.sessionsService
      .cancelUpcomingForCourse(courseId, user.id, cancelReason)
      .catch((err) => {
        this.logger.error(
          `Cascade-cancel of upcoming sessions failed for course ${courseId}`,
          err,
        );
        return { cancelled: 0, failed: impact.upcomingSessions };
      });

    await this.auditLogService
      .log({
        entityType: 'course',
        entityId: courseId,
        action: 'course.soft_deleted',
        performedBy: user.id,
        ipAddress: ip,
        metadata: {
          title: existing.title,
          status: existing.status,
          deliveryType: existing.deliveryType,
          instructorId: existing.instructorId,
          managerId: existing.managerId,
          reason: reason ?? null,
          impact,
          sessionsCancelled: cascade.cancelled,
          sessionsCancelFailed: cascade.failed,
        },
      })
      .catch(() => {});

    return {
      message: 'Course deleted successfully',
      impact,
      sessionsCancelled: cascade.cancelled,
      sessionsCancelFailed: cascade.failed,
    };
  }

  /**
   * GET /admin/courses/:id/delete-impact
   * Pre-delete preview: counts of dependent rows that will be hidden
   * along with the course. Surfaced in the strong-confirmation modal
   * before the admin commits to a non-draft delete.
   */
  async getDeleteImpact(courseId: string, user: AuthenticatedUser) {
    if (!isManagerOrAbove(user)) {
      throw new ForbiddenException('Only managers and admins can preview deletes');
    }
    const [existing] = await db
      .select({
        id: courses.id,
        title: courses.title,
        status: courses.status,
        deletedAt: courses.deletedAt,
      })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    if (!existing) throw new NotFoundException('Course not found');
    if (existing.deletedAt) {
      throw new BadRequestException('Course is already deleted.');
    }
    const impact = await this.computeCourseImpact(courseId);
    return {
      id: existing.id,
      title: existing.title,
      status: existing.status,
      impact,
    };
  }

  private async computeCourseImpact(courseId: string) {
    const [
      moduleRow,
      materialRow,
      enrollmentRow,
      sessionRow,
      upcomingSessionRow,
      assessmentRow,
      pendingCertificateRow,
    ] = await Promise.all([
      db
        .select({ count: count() })
        .from(courseModules)
        .where(eq(courseModules.courseId, courseId)),
      db
        .select({ count: count() })
        .from(courseMaterials)
        .where(
          and(
            eq(courseMaterials.courseId, courseId),
            isNull(courseMaterials.deletedAt),
          ),
        ),
      db
        .select({ count: count() })
        .from(enrollments)
        .where(eq(enrollments.courseId, courseId)),
      db
        .select({ count: count() })
        .from(sessions)
        .where(eq(sessions.courseId, courseId)),
      // Upcoming sessions (future, not already cancelled/missed) — these
      // are what the cascade-cancel pass will need to handle on delete.
      db
        .select({ count: count() })
        .from(sessions)
        .where(
          and(
            eq(sessions.courseId, courseId),
            sql`${sessions.scheduledAt} > NOW()`,
            sql`${sessions.status} NOT IN ('cancelled', 'missed', 'ended')`,
          ),
        ),
      db
        .select({ count: count() })
        .from(assessments)
        .where(eq(assessments.courseId, courseId)),
      // Pending certificate requests — these BLOCK the delete so a
      // student isn't left in limbo waiting on a decision for a
      // course that vanished.
      db
        .select({ count: count() })
        .from(certificateRequests)
        .where(
          and(
            eq(certificateRequests.courseId, courseId),
            eq(certificateRequests.status, CERTIFICATE_STATUS.PENDING),
          ),
        ),
    ]);
    return {
      modules: Number(moduleRow[0]?.count ?? 0),
      materials: Number(materialRow[0]?.count ?? 0),
      enrollments: Number(enrollmentRow[0]?.count ?? 0),
      sessions: Number(sessionRow[0]?.count ?? 0),
      upcomingSessions: Number(upcomingSessionRow[0]?.count ?? 0),
      assessments: Number(assessmentRow[0]?.count ?? 0),
      pendingCertificates: Number(pendingCertificateRow[0]?.count ?? 0),
    };
  }

  // ─── Recently deleted (admin) ─────────────────────────────

  /**
   * GET /admin/backups/courses/deleted
   * Paginated list of soft-deleted courses with full context for the
   * admin recovery panel: instructor / manager / deleter / impact.
   */
  async listDeleted(page = 1, limit = 20) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);
    const offset = (safePage - 1) * safeLimit;

    // Self-join users twice — once for instructor, once for the
    // deleter. Drizzle has no built-in alias helper here, so we
    // run two parallel queries and join in code.
    const rows = await db
      .select({
        id: courses.id,
        title: courses.title,
        status: courses.status,
        deliveryType: courses.deliveryType,
        instructorId: courses.instructorId,
        managerId: courses.managerId,
        deletedAt: courses.deletedAt,
        deletedById: courses.deletedBy,
      })
      .from(courses)
      .where(sql`${courses.deletedAt} IS NOT NULL`)
      .orderBy(desc(courses.deletedAt))
      .limit(safeLimit)
      .offset(offset);

    const userIds = Array.from(
      new Set(
        rows.flatMap((r) =>
          [r.instructorId, r.managerId, r.deletedById].filter(
            (v): v is string => !!v,
          ),
        ),
      ),
    );
    const userMap = new Map<
      string,
      { firstName: string | null; lastName: string | null; email: string }
    >();
    if (userIds.length > 0) {
      const found = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        })
        .from(users)
        .where(inArray(users.id, userIds));
      for (const u of found) {
        userMap.set(u.id, {
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
        });
      }
    }

    const fmtUser = (id: string | null) => {
      if (!id) return null;
      const u = userMap.get(id);
      if (!u) return null;
      return {
        id,
        name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || null,
        email: u.email ?? null,
      };
    };

    const [totalRow] = await db
      .select({ count: count() })
      .from(courses)
      .where(sql`${courses.deletedAt} IS NOT NULL`);
    const total = Number(totalRow?.count ?? 0);

    return {
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        status: r.status,
        deliveryType: r.deliveryType,
        deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
        instructor: fmtUser(r.instructorId),
        manager: fmtUser(r.managerId),
        deletedBy: fmtUser(r.deletedById),
      })),
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    };
  }

  /**
   * POST /admin/backups/courses/:id/restore
   * Reverses remove(): clears deleted_at on the course row. All
   * dependent data (modules, materials, enrollments, sessions,
   * payments, certificates) is intact because soft-delete never
   * touched it.
   */
  async restoreCourse(courseId: string, userId: string, ip?: string) {
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    if (!course) throw new NotFoundException('Course not found');
    if (!course.deletedAt) {
      throw new BadRequestException('Course is not deleted.');
    }

    await db
      .update(courses)
      .set({ deletedAt: null, deletedBy: null, updatedAt: new Date() })
      .where(eq(courses.id, courseId));

    const impact = await this.computeCourseImpact(courseId);

    await this.auditLogService
      .log({
        entityType: 'course',
        entityId: courseId,
        action: 'course.restored',
        performedBy: userId,
        ipAddress: ip,
        metadata: {
          title: course.title,
          status: course.status,
          deliveryType: course.deliveryType,
          instructorId: course.instructorId,
          managerId: course.managerId,
          impact,
        },
      })
      .catch(() => {});

    return {
      ok: true,
      id: course.id,
      title: course.title,
      status: course.status,
      impact,
    };
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
          isNull(courseMaterials.deletedAt),
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

    await this.maybeLogAdminAction(user, courseId, 'course.request_changes', {
      title: course.title,
      note,
    });

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

    // Webinar Courses are attendance-only — modules are not allowed.
    const [course] = await db
      .select({ deliveryType: courses.deliveryType })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    if (course?.deliveryType === 'webinar') {
      throw new BadRequestException(
        'Webinar courses cannot contain modules. Add a webinar lecture instead.',
      );
    }

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
            isNull(courseMaterials.deletedAt),
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

    await this.maybeLogAdminAction(user, courseId, 'course.activate', {
      title: course.title,
      isReactivation,
    });

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

    await this.maybeLogAdminAction(user, courseId, 'course.archive', {
      title: course.title,
    });

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
          isNull(courseMaterials.deletedAt),
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

    await this.maybeLogAdminAction(user, courseId, 'course.complete', {
      title: course.title,
    });

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

    // Award course-completion points (idempotent per enrollment).
    // Idempotency key is shared with the cron path — whichever runs first
    // wins, the other becomes a no-op via DB unique constraint.
    for (const student of activeStudents) {
      this.pointsService
        .award(student.studentId, 'course_completed', {
          idempotencyKey: `course_completed:${student.id}`,
          sourceEntityType: 'enrollment',
          sourceEntityId: student.id,
        })
        .catch((err) =>
          this.logger.warn(
            `Course-completion points failed for enrollment ${student.id}: ${(err as Error).message}`,
          ),
        );
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
        .where(
          and(
            eq(courseMaterials.moduleId, mod.id),
            isNull(courseMaterials.deletedAt),
          ),
        );
      if (matCount.count === 0) {
        throw new BadRequestException(
          `Module "${mod.title}" has no content. All modules must have at least one material before ${label}.`,
        );
      }
    }

    // Note: no minimum-session check. Both review submission and
    // activation/approval allow zoom/onsite/blended courses with zero
    // scheduled lectures — lectures can be added later by the instructor
    // or manager. The card shows the current lecture count so a manager
    // can choose to wait before approving if they want.

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
      const localeSettings = await this.adminSettings.getPublicLocaleSettings().catch(() => ({
        numberSystem: 'western' as const,
        dateFormat: 'DD-MM-YYYY' as const,
      }));
      throw new BadRequestException({
        message: 'Some sessions are scheduled outside the course date range',
        outOfRangeSessions: outOfRangeSessions.map(
          (s) => {
            const dateStr = new Date(s.scheduledAt).toLocaleDateString();
            return `${s.title} (${localeSettings.numberSystem === 'arabic_indic' ? toArabicIndic(dateStr) : dateStr})`;
          },
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
    const conditions = [eq(courses.id, courseId), isNull(courses.deletedAt)];
    this.addOwnershipCondition(conditions, user);

    const [course] = await db
      .select({
        id: courses.id,
        status: courses.status,
        deliveryType: courses.deliveryType,
        enrollmentDeadline: courses.enrollmentDeadline,
        startDate: courses.startDate,
        maxEnrollment: courses.maxEnrollment,
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
   * Create a rating for a course. One-time only — subsequent calls return 409.
   * Student must have a completed enrollment in the course.
   * Review enters moderation in `pending` state and is NOT visible to the public
   * until the assigned course manager approves + publishes it.
   */
  async rateCourse(
    courseId: string,
    studentId: string,
    rating: number,
    reviewText?: string,
  ) {
    const [enrollment] = await db
      .select({ status: enrollments.status })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, courseId),
          eq(enrollments.studentId, studentId),
        ),
      )
      .limit(1);

    if (!enrollment) {
      throw new ForbiddenException('You must be enrolled in this course to leave a review');
    }
    if (enrollment.status !== 'completed') {
      throw new ForbiddenException('You can only review a course after completing it');
    }

    const [existing] = await db
      .select({ id: courseRatings.id })
      .from(courseRatings)
      .where(
        and(
          eq(courseRatings.courseId, courseId),
          eq(courseRatings.studentId, studentId),
        ),
      )
      .limit(1);

    if (existing) {
      throw new ConflictException('You have already reviewed this course');
    }

    const [created] = await db
      .insert(courseRatings)
      .values({
        courseId,
        studentId,
        rating,
        reviewText,
        moderationStatus: 'pending',
        isPublished: false,
      })
      .returning();

    // Notify the course manager (fire-and-forget)
    this.notifyManagerOfPendingReview(courseId, created.id, studentId, rating, reviewText || null).catch((err) =>
      this.logger.warn(`Failed to notify manager of pending review: ${(err as Error).message}`),
    );

    return created;
  }

  /**
   * Send in-app + email notification to the course's assigned manager about a pending review.
   */
  private async notifyManagerOfPendingReview(
    courseId: string,
    ratingId: string,
    studentId: string,
    rating: number,
    reviewText: string | null,
  ): Promise<void> {
    const [course] = await db
      .select({
        title: courses.title,
        titleAr: courses.titleAr,
        managerId: courses.managerId,
      })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    if (!course || !course.managerId) return;

    const [manager] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        language: users.language,
      })
      .from(users)
      .where(eq(users.id, course.managerId))
      .limit(1);
    if (!manager) return;

    const [student] = await db
      .select({ firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, studentId))
      .limit(1);
    const studentName =
      `${student?.firstName || ''} ${student?.lastName || ''}`.trim() || 'A student';

    const locale = (manager.language || 'en') as 'en' | 'ar';
    const isAr = locale === 'ar';
    const courseTitle = isAr && course.titleAr ? course.titleAr : course.title;

    await this.userNotificationsService.create({
      recipientId: manager.id,
      type: 'review_pending_approval',
      title: isAr ? 'مراجعة جديدة بانتظار الموافقة' : 'New Review Pending Approval',
      message: isAr
        ? `ترك ${studentName} مراجعة (${rating}/5) على "${courseTitle}" وتحتاج إلى موافقتك.`
        : `${studentName} left a ${rating}/5 review on "${courseTitle}" that needs your approval.`,
      link: '/dashboard/manager/reviews',
      entityType: 'course_rating',
      entityId: ratingId,
    });

    const name = [manager.firstName, manager.lastName].filter(Boolean).join(' ') || 'Manager';
    this.emailService
      .sendReviewPendingApproval(
        manager.email,
        { recipientName: name, studentName, courseName: courseTitle, rating, reviewText },
        locale,
      )
      .catch(() => {});
  }

  /**
   * Get the current user's rating for a course, or null if they haven't rated.
   */
  async getMyRating(courseId: string, studentId: string) {
    const [row] = await db
      .select({
        id: courseRatings.id,
        rating: courseRatings.rating,
        reviewText: courseRatings.reviewText,
        createdAt: courseRatings.createdAt,
      })
      .from(courseRatings)
      .where(
        and(
          eq(courseRatings.courseId, courseId),
          eq(courseRatings.studentId, studentId),
        ),
      )
      .limit(1);
    return row || null;
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
   * Get ratings for a course with optional filtering, sorting and pagination.
   * Response also includes aggregate stats (avgRating, totalRatings, per-star distribution).
   */
  async getCourseRatings(
    courseId: string,
    params: {
      page?: number;
      limit?: number;
      rating?: number; // filter by specific star count 1-5
      sort?: 'newest' | 'oldest' | 'highest' | 'lowest';
      search?: string;
      onlyPublished?: boolean; // default true — public + manager-published views
    } = {},
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;
    const onlyPublished = params.onlyPublished !== false;

    const conditions: any[] = [eq(courseRatings.courseId, courseId)];
    if (onlyPublished) {
      conditions.push(eq(courseRatings.isPublished, true));
    }
    if (params.rating && params.rating >= 1 && params.rating <= 5) {
      conditions.push(eq(courseRatings.rating, params.rating));
    }
    if (params.search) {
      const term = `%${params.search}%`;
      conditions.push(
        or(
          ilike(users.firstName, term),
          ilike(users.lastName, term),
          ilike(courseRatings.reviewText, term),
        ) as any,
      );
    }
    const whereClause = and(...conditions);

    // Stats queries: aggregate uses the same publish filter as data
    const statsWhere = onlyPublished
      ? and(eq(courseRatings.courseId, courseId), eq(courseRatings.isPublished, true))
      : eq(courseRatings.courseId, courseId);

    // Sort
    let orderBy;
    switch (params.sort) {
      case 'oldest':
        orderBy = asc(courseRatings.createdAt);
        break;
      case 'highest':
        orderBy = [desc(courseRatings.rating), desc(courseRatings.createdAt)];
        break;
      case 'lowest':
        orderBy = [asc(courseRatings.rating), desc(courseRatings.createdAt)];
        break;
      case 'newest':
      default:
        orderBy = desc(courseRatings.createdAt);
    }

    const [rows, [countRow], [statsRow], distRows] = await Promise.all([
      db
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
        .where(whereClause)
        .orderBy(...(Array.isArray(orderBy) ? orderBy : [orderBy]))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(courseRatings)
        .innerJoin(users, eq(courseRatings.studentId, users.id))
        .where(whereClause),
      db
        .select({
          avgRating: sql<number>`COALESCE(AVG(${courseRatings.rating}), 0)`,
          totalRatings: count(),
        })
        .from(courseRatings)
        .where(statsWhere),
      db
        .select({
          rating: courseRatings.rating,
          count: count(),
        })
        .from(courseRatings)
        .where(statsWhere)
        .groupBy(courseRatings.rating),
    ]);

    const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of distRows) {
      if (r.rating >= 1 && r.rating <= 5) {
        distribution[r.rating as 1 | 2 | 3 | 4 | 5] = Number(r.count);
      }
    }

    const data = rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      reviewText: r.reviewText,
      createdAt: r.createdAt,
      studentName: `${r.studentFirstName || ''} ${r.studentLastName || ''}`.trim() || 'Anonymous',
    }));

    const total = Number(countRow?.count || 0);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      avgRating: Number(Number(statsRow?.avgRating || 0).toFixed(1)),
      totalRatings: Number(statsRow?.totalRatings || 0),
      distribution,
    };
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
      .where(eq(courseRatings.isPublished, true))
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
   * Manager review analytics — overall rating across their courses + top 5.
   * Scoped to caller's managed courses (or all courses for admin).
   * Published reviews only, matching public listing semantics.
   */
  async getManagerRatingStats(user: AuthenticatedUser) {
    const isAdmin = isGlobalAdmin(user);

    const courseRows = await db
      .select({
        id: courses.id,
        title: courses.title,
        titleAr: courses.titleAr,
      })
      .from(courses)
      .where(isAdmin ? undefined : eq(courses.managerId, user.id));

    const totalCourses = courseRows.length;

    if (totalCourses === 0) {
      return {
        overall: {
          avgRating: 0,
          totalRatings: 0,
          totalCourses: 0,
          coursesWithReviews: 0,
        },
        topCourses: [] as Array<{
          courseId: string;
          title: string;
          titleAr: string | null;
          avgRating: number;
          totalRatings: number;
        }>,
      };
    }

    const courseIds = courseRows.map((c) => c.id);

    const stats = await db
      .select({
        courseId: courseRatings.courseId,
        avgRating: sql<number>`COALESCE(AVG(${courseRatings.rating}), 0)`,
        totalRatings: count(),
      })
      .from(courseRatings)
      .where(
        and(
          eq(courseRatings.isPublished, true),
          inArray(courseRatings.courseId, courseIds),
        ),
      )
      .groupBy(courseRatings.courseId);

    const statsMap = new Map<
      string,
      { avgRating: number; totalRatings: number }
    >();
    let totalRatings = 0;
    let weightedSum = 0;

    for (const s of stats) {
      const avg = Number(s.avgRating || 0);
      const total = Number(s.totalRatings || 0);
      statsMap.set(s.courseId, { avgRating: avg, totalRatings: total });
      totalRatings += total;
      weightedSum += avg * total;
    }

    const overallAvg = totalRatings > 0 ? weightedSum / totalRatings : 0;

    const topCourses = courseRows
      .filter((c) => statsMap.has(c.id))
      .map((c) => {
        const s = statsMap.get(c.id)!;
        return {
          courseId: c.id,
          title: c.title,
          titleAr: c.titleAr,
          avgRating: Number(s.avgRating.toFixed(1)),
          totalRatings: s.totalRatings,
        };
      })
      .sort((a, b) => {
        if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating;
        return b.totalRatings - a.totalRatings;
      })
      .slice(0, 5);

    return {
      overall: {
        avgRating: Number(overallAvg.toFixed(1)),
        totalRatings,
        totalCourses,
        coursesWithReviews: statsMap.size,
      },
      topCourses,
    };
  }

  // ─── Manager moderation ────────────────────────────────────

  /**
   * Ensure the rating belongs to a course this manager manages (or admin).
   */
  private async verifyRatingAccess(ratingId: string, user: AuthenticatedUser) {
    const [row] = await db
      .select({
        id: courseRatings.id,
        courseId: courseRatings.courseId,
        managerId: courses.managerId,
      })
      .from(courseRatings)
      .innerJoin(courses, eq(courseRatings.courseId, courses.id))
      .where(eq(courseRatings.id, ratingId))
      .limit(1);
    if (!row) {
      throw new NotFoundException('Review not found');
    }
    if (!isGlobalAdmin(user) && row.managerId !== user.id) {
      throw new ForbiddenException('You do not manage this course');
    }
    return row;
  }

  async approveReview(ratingId: string, user: AuthenticatedUser) {
    await this.verifyRatingAccess(ratingId, user);
    const [updated] = await db
      .update(courseRatings)
      .set({
        moderationStatus: 'approved',
        isPublished: true,
        reviewedBy: user.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(courseRatings.id, ratingId))
      .returning();

    if (updated) {
      this.tryAwardDualReviewApproval(updated.courseId, updated.studentId).catch(
        (err) =>
          this.logger.warn(
            `Dual-review points check failed (course rating ${ratingId}): ${(err as Error).message}`,
          ),
      );
    }

    return updated;
  }

  /**
   * Award review-approved points only when BOTH the course review AND the
   * instructor review for this enrollment are in `approved` state. Fires
   * once per enrollment thanks to the idempotency key — re-approving either
   * review is a no-op. If the course has no instructor (data anomaly),
   * the gate falls back to course-review-only.
   */
  private async tryAwardDualReviewApproval(
    courseId: string,
    studentId: string,
  ): Promise<void> {
    const [course] = await db
      .select({ instructorId: courses.instructorId })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    const [courseRating] = await db
      .select({ moderationStatus: courseRatings.moderationStatus })
      .from(courseRatings)
      .where(
        and(
          eq(courseRatings.courseId, courseId),
          eq(courseRatings.studentId, studentId),
        ),
      )
      .limit(1);

    if (courseRating?.moderationStatus !== 'approved') return;

    if (course?.instructorId) {
      const [instrRating] = await db
        .select({ moderationStatus: instructorRatings.moderationStatus })
        .from(instructorRatings)
        .where(
          and(
            eq(instructorRatings.courseId, courseId),
            eq(instructorRatings.studentId, studentId),
          ),
        )
        .limit(1);
      if (instrRating?.moderationStatus !== 'approved') return;
    }

    // sourceEntityId is a UUID column — use the courseId as the canonical
    // entity (the pair is keyed via the idempotency key, not the FK).
    // Earlier this was set to `${courseId}:${studentId}` which silently
    // failed with a uuid-cast error and the .catch in approveReview
    // swallowed it — no ledger rows were created for any approval.
    await this.pointsService.award(studentId, 'review_approved', {
      idempotencyKey: `review_approved:${courseId}:${studentId}`,
      sourceEntityType: 'course',
      sourceEntityId: courseId,
    });
  }

  async rejectReview(ratingId: string, user: AuthenticatedUser) {
    await this.verifyRatingAccess(ratingId, user);
    const [updated] = await db
      .update(courseRatings)
      .set({
        moderationStatus: 'rejected',
        isPublished: false,
        reviewedBy: user.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(courseRatings.id, ratingId))
      .returning();
    return updated;
  }

  async setReviewPublished(ratingId: string, user: AuthenticatedUser, published: boolean) {
    await this.verifyRatingAccess(ratingId, user);
    const [updated] = await db
      .update(courseRatings)
      .set({
        isPublished: published,
        reviewedBy: user.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(courseRatings.id, ratingId))
      .returning();
    return updated;
  }

  /**
   * Delete a rating. Manager may only delete ratings for their own courses.
   */
  async deleteRating(ratingId: string, user: AuthenticatedUser) {
    await this.verifyRatingAccess(ratingId, user);
    const [deleted] = await db
      .delete(courseRatings)
      .where(eq(courseRatings.id, ratingId))
      .returning();
    return deleted;
  }

  /**
   * Manager all-reviews listing across every course they manage, with filters.
   */
  async getManagerReviews(
    user: AuthenticatedUser,
    params: {
      page?: number;
      limit?: number;
      moderationStatus?: 'pending' | 'approved' | 'rejected';
      publishedOnly?: boolean;
      unpublishedOnly?: boolean;
      courseId?: string;
      search?: string;
      sort?: 'newest' | 'oldest' | 'highest' | 'lowest';
    } = {},
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    if (!isGlobalAdmin(user)) {
      conditions.push(eq(courses.managerId, user.id));
    }
    if (params.moderationStatus) {
      conditions.push(eq(courseRatings.moderationStatus, params.moderationStatus));
    }
    if (params.publishedOnly) {
      conditions.push(eq(courseRatings.isPublished, true));
    } else if (params.unpublishedOnly) {
      conditions.push(eq(courseRatings.isPublished, false));
    }
    if (params.courseId) {
      conditions.push(eq(courseRatings.courseId, params.courseId));
    }
    if (params.search) {
      const term = `%${params.search}%`;
      conditions.push(
        or(
          ilike(users.firstName, term),
          ilike(users.lastName, term),
          ilike(courseRatings.reviewText, term),
          ilike(courses.title, term),
          ilike(courses.titleAr, term),
        ) as any,
      );
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Secondary sort
    let orderBy;
    switch (params.sort) {
      case 'oldest':
        orderBy = asc(courseRatings.createdAt);
        break;
      case 'highest':
        orderBy = [desc(courseRatings.rating), desc(courseRatings.createdAt)];
        break;
      case 'lowest':
        orderBy = [asc(courseRatings.rating), desc(courseRatings.createdAt)];
        break;
      case 'newest':
      default:
        orderBy = desc(courseRatings.createdAt);
    }

    // Status-priority first: pending shows on top
    const statusPriority = sql`CASE ${courseRatings.moderationStatus}
      WHEN 'pending' THEN 1
      WHEN 'approved' THEN 2
      WHEN 'rejected' THEN 3
      ELSE 4
    END`;

    const [rows, [countRow], [pendingRow], [approvedRow], [rejectedRow]] = await Promise.all([
      db
        .select({
          id: courseRatings.id,
          courseId: courseRatings.courseId,
          courseTitle: courses.title,
          courseTitleAr: courses.titleAr,
          rating: courseRatings.rating,
          reviewText: courseRatings.reviewText,
          moderationStatus: courseRatings.moderationStatus,
          isPublished: courseRatings.isPublished,
          createdAt: courseRatings.createdAt,
          reviewedAt: courseRatings.reviewedAt,
          studentFirstName: users.firstName,
          studentLastName: users.lastName,
        })
        .from(courseRatings)
        .innerJoin(courses, eq(courseRatings.courseId, courses.id))
        .innerJoin(users, eq(courseRatings.studentId, users.id))
        .where(whereClause)
        .orderBy(statusPriority, ...(Array.isArray(orderBy) ? orderBy : [orderBy]))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(courseRatings)
        .innerJoin(courses, eq(courseRatings.courseId, courses.id))
        .innerJoin(users, eq(courseRatings.studentId, users.id))
        .where(whereClause),
      // Aggregate counts (independent of page-level filters so dashboard tabs stay stable)
      db
        .select({ count: count() })
        .from(courseRatings)
        .innerJoin(courses, eq(courseRatings.courseId, courses.id))
        .where(
          and(
            ...(isGlobalAdmin(user) ? [] : [eq(courses.managerId, user.id)]),
            eq(courseRatings.moderationStatus, 'pending'),
          ),
        ),
      db
        .select({ count: count() })
        .from(courseRatings)
        .innerJoin(courses, eq(courseRatings.courseId, courses.id))
        .where(
          and(
            ...(isGlobalAdmin(user) ? [] : [eq(courses.managerId, user.id)]),
            eq(courseRatings.moderationStatus, 'approved'),
          ),
        ),
      db
        .select({ count: count() })
        .from(courseRatings)
        .innerJoin(courses, eq(courseRatings.courseId, courses.id))
        .where(
          and(
            ...(isGlobalAdmin(user) ? [] : [eq(courses.managerId, user.id)]),
            eq(courseRatings.moderationStatus, 'rejected'),
          ),
        ),
    ]);

    const data = rows.map((r) => ({
      id: r.id,
      courseId: r.courseId,
      courseTitle: r.courseTitle,
      courseTitleAr: r.courseTitleAr,
      rating: r.rating,
      reviewText: r.reviewText,
      moderationStatus: r.moderationStatus,
      isPublished: r.isPublished,
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt,
      studentName:
        `${r.studentFirstName || ''} ${r.studentLastName || ''}`.trim() || 'Anonymous',
    }));

    const total = Number(countRow?.count || 0);
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      counts: {
        pending: Number(pendingRow?.count || 0),
        approved: Number(approvedRow?.count || 0),
        rejected: Number(rejectedRow?.count || 0),
      },
    };
  }

  // ─── Instructor Ratings ────────────────────────────────────

  /**
   * Submit an instructor review for a course the student completed. The
   * review targets the course's assigned instructor — a student leaves one
   * instructor review per enrollment, regardless of how many courses that
   * instructor has taught them. Pending until the course manager moderates.
   */
  async rateInstructor(
    courseId: string,
    studentId: string,
    rating: number,
    reviewText?: string,
  ) {
    const [enrollment] = await db
      .select({ status: enrollments.status })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, courseId),
          eq(enrollments.studentId, studentId),
        ),
      )
      .limit(1);

    if (!enrollment) {
      throw new ForbiddenException(
        'You must be enrolled in this course to review the instructor',
      );
    }
    if (enrollment.status !== 'completed') {
      throw new ForbiddenException(
        'You can only review the instructor after completing the course',
      );
    }

    const [course] = await db
      .select({ instructorId: courses.instructorId })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    if (!course?.instructorId) {
      throw new BadRequestException(
        'This course has no assigned instructor to review',
      );
    }

    const [existing] = await db
      .select({ id: instructorRatings.id })
      .from(instructorRatings)
      .where(
        and(
          eq(instructorRatings.courseId, courseId),
          eq(instructorRatings.studentId, studentId),
        ),
      )
      .limit(1);

    if (existing) {
      throw new ConflictException(
        'You have already reviewed the instructor for this course',
      );
    }

    const [created] = await db
      .insert(instructorRatings)
      .values({
        courseId,
        instructorId: course.instructorId,
        studentId,
        rating,
        reviewText,
        moderationStatus: 'pending',
        isPublished: false,
      })
      .returning();

    this.notifyManagerOfPendingInstructorReview(
      courseId,
      created.id,
      studentId,
      rating,
      reviewText || null,
    ).catch((err) =>
      this.logger.warn(
        `Failed to notify manager of pending instructor review: ${(err as Error).message}`,
      ),
    );

    return created;
  }

  private async notifyManagerOfPendingInstructorReview(
    courseId: string,
    ratingId: string,
    studentId: string,
    rating: number,
    reviewText: string | null,
  ): Promise<void> {
    const [course] = await db
      .select({
        title: courses.title,
        titleAr: courses.titleAr,
        managerId: courses.managerId,
      })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    if (!course || !course.managerId) return;

    const [manager] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        language: users.language,
      })
      .from(users)
      .where(eq(users.id, course.managerId))
      .limit(1);
    if (!manager) return;

    const [student] = await db
      .select({ firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, studentId))
      .limit(1);
    const studentName =
      `${student?.firstName || ''} ${student?.lastName || ''}`.trim() ||
      'A student';

    const locale = (manager.language || 'en') as 'en' | 'ar';
    const isAr = locale === 'ar';
    const courseTitle = isAr && course.titleAr ? course.titleAr : course.title;

    await this.userNotificationsService.create({
      recipientId: manager.id,
      type: 'review_pending_approval',
      title: isAr
        ? 'مراجعة مدرب جديدة بانتظار الموافقة'
        : 'New Instructor Review Pending Approval',
      message: isAr
        ? `ترك ${studentName} مراجعة للمدرب (${rating}/5) في "${courseTitle}" وتحتاج إلى موافقتك.`
        : `${studentName} left a ${rating}/5 instructor review on "${courseTitle}" that needs your approval.`,
      link: '/dashboard/manager/reviews?type=instructor',
      entityType: 'instructor_rating',
      entityId: ratingId,
    });

    const name =
      [manager.firstName, manager.lastName].filter(Boolean).join(' ') ||
      'Manager';
    this.emailService
      .sendReviewPendingApproval(
        manager.email,
        {
          recipientName: name,
          studentName,
          courseName: courseTitle,
          rating,
          reviewText,
        },
        locale,
      )
      .catch(() => {});
  }

  async getMyInstructorRating(courseId: string, studentId: string) {
    const [row] = await db
      .select({
        id: instructorRatings.id,
        rating: instructorRatings.rating,
        reviewText: instructorRatings.reviewText,
        createdAt: instructorRatings.createdAt,
      })
      .from(instructorRatings)
      .where(
        and(
          eq(instructorRatings.courseId, courseId),
          eq(instructorRatings.studentId, studentId),
        ),
      )
      .limit(1);
    return row || null;
  }

  /**
   * Whether a (course, student) pair has both reviews submitted. Used by the
   * certificate-request gate. Submission status only — rejected reviews still
   * count, otherwise a manager could indefinitely block a student. If the
   * course has no instructor, only the course review is required.
   */
  async hasSubmittedRequiredReviews(
    courseId: string,
    studentId: string,
  ): Promise<{
    courseReviewSubmitted: boolean;
    instructorReviewSubmitted: boolean;
    instructorRequired: boolean;
    allRequiredSubmitted: boolean;
  }> {
    const [course] = await db
      .select({ instructorId: courses.instructorId })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    const [courseRow] = await db
      .select({ id: courseRatings.id })
      .from(courseRatings)
      .where(
        and(
          eq(courseRatings.courseId, courseId),
          eq(courseRatings.studentId, studentId),
        ),
      )
      .limit(1);

    const courseReviewSubmitted = !!courseRow;
    const instructorRequired = !!course?.instructorId;
    let instructorReviewSubmitted = !instructorRequired;

    if (instructorRequired) {
      const [instrRow] = await db
        .select({ id: instructorRatings.id })
        .from(instructorRatings)
        .where(
          and(
            eq(instructorRatings.courseId, courseId),
            eq(instructorRatings.studentId, studentId),
          ),
        )
        .limit(1);
      instructorReviewSubmitted = !!instrRow;
    }

    return {
      courseReviewSubmitted,
      instructorReviewSubmitted,
      instructorRequired,
      allRequiredSubmitted:
        courseReviewSubmitted && instructorReviewSubmitted,
    };
  }

  // ─── Manager moderation: instructor reviews ───────────────

  private async verifyInstructorRatingAccess(
    ratingId: string,
    user: AuthenticatedUser,
  ) {
    const [row] = await db
      .select({
        id: instructorRatings.id,
        courseId: instructorRatings.courseId,
        managerId: courses.managerId,
      })
      .from(instructorRatings)
      .innerJoin(courses, eq(instructorRatings.courseId, courses.id))
      .where(eq(instructorRatings.id, ratingId))
      .limit(1);
    if (!row) {
      throw new NotFoundException('Instructor review not found');
    }
    if (!isGlobalAdmin(user) && row.managerId !== user.id) {
      throw new ForbiddenException('You do not manage this course');
    }
    return row;
  }

  async approveInstructorReview(ratingId: string, user: AuthenticatedUser) {
    await this.verifyInstructorRatingAccess(ratingId, user);
    const [updated] = await db
      .update(instructorRatings)
      .set({
        moderationStatus: 'approved',
        isPublished: true,
        reviewedBy: user.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(instructorRatings.id, ratingId))
      .returning();

    if (updated) {
      this.tryAwardDualReviewApproval(updated.courseId, updated.studentId).catch(
        (err) =>
          this.logger.warn(
            `Dual-review points check failed (instructor rating ${ratingId}): ${(err as Error).message}`,
          ),
      );
    }

    return updated;
  }

  async rejectInstructorReview(ratingId: string, user: AuthenticatedUser) {
    await this.verifyInstructorRatingAccess(ratingId, user);
    const [updated] = await db
      .update(instructorRatings)
      .set({
        moderationStatus: 'rejected',
        isPublished: false,
        reviewedBy: user.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(instructorRatings.id, ratingId))
      .returning();
    return updated;
  }

  async setInstructorReviewPublished(
    ratingId: string,
    user: AuthenticatedUser,
    published: boolean,
  ) {
    await this.verifyInstructorRatingAccess(ratingId, user);
    const [updated] = await db
      .update(instructorRatings)
      .set({
        isPublished: published,
        reviewedBy: user.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(instructorRatings.id, ratingId))
      .returning();
    return updated;
  }

  async deleteInstructorRating(ratingId: string, user: AuthenticatedUser) {
    await this.verifyInstructorRatingAccess(ratingId, user);
    const [deleted] = await db
      .delete(instructorRatings)
      .where(eq(instructorRatings.id, ratingId))
      .returning();
    return deleted;
  }

  /**
   * Manager moderation list for instructor reviews. Mirrors getManagerReviews
   * but scoped to instructor_ratings. Returns aggregate counts so the UI
   * segmented control can show pending badges per type.
   */
  async getManagerInstructorReviews(
    user: AuthenticatedUser,
    params: {
      page?: number;
      limit?: number;
      moderationStatus?: 'pending' | 'approved' | 'rejected';
      publishedOnly?: boolean;
      unpublishedOnly?: boolean;
      courseId?: string;
      search?: string;
      sort?: 'newest' | 'oldest' | 'highest' | 'lowest';
    } = {},
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    if (!isGlobalAdmin(user)) {
      conditions.push(eq(courses.managerId, user.id));
    }
    if (params.moderationStatus) {
      conditions.push(
        eq(instructorRatings.moderationStatus, params.moderationStatus),
      );
    }
    if (params.publishedOnly) {
      conditions.push(eq(instructorRatings.isPublished, true));
    } else if (params.unpublishedOnly) {
      conditions.push(eq(instructorRatings.isPublished, false));
    }
    if (params.courseId) {
      conditions.push(eq(instructorRatings.courseId, params.courseId));
    }
    if (params.search) {
      const term = `%${params.search}%`;
      conditions.push(
        or(
          ilike(users.firstName, term),
          ilike(users.lastName, term),
          ilike(instructorRatings.reviewText, term),
          ilike(courses.title, term),
          ilike(courses.titleAr, term),
        ) as any,
      );
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let orderBy;
    switch (params.sort) {
      case 'oldest':
        orderBy = asc(instructorRatings.createdAt);
        break;
      case 'highest':
        orderBy = [
          desc(instructorRatings.rating),
          desc(instructorRatings.createdAt),
        ];
        break;
      case 'lowest':
        orderBy = [
          asc(instructorRatings.rating),
          desc(instructorRatings.createdAt),
        ];
        break;
      case 'newest':
      default:
        orderBy = desc(instructorRatings.createdAt);
    }

    const statusPriority = sql`CASE ${instructorRatings.moderationStatus}
      WHEN 'pending' THEN 1
      WHEN 'approved' THEN 2
      WHEN 'rejected' THEN 3
      ELSE 4
    END`;

    const [rows, [countRow], [pendingRow], [approvedRow], [rejectedRow]] =
      await Promise.all([
        db
          .select({
            id: instructorRatings.id,
            courseId: instructorRatings.courseId,
            instructorId: instructorRatings.instructorId,
            courseTitle: courses.title,
            courseTitleAr: courses.titleAr,
            rating: instructorRatings.rating,
            reviewText: instructorRatings.reviewText,
            moderationStatus: instructorRatings.moderationStatus,
            isPublished: instructorRatings.isPublished,
            createdAt: instructorRatings.createdAt,
            reviewedAt: instructorRatings.reviewedAt,
            studentFirstName: users.firstName,
            studentLastName: users.lastName,
          })
          .from(instructorRatings)
          .innerJoin(courses, eq(instructorRatings.courseId, courses.id))
          .innerJoin(users, eq(instructorRatings.studentId, users.id))
          .where(whereClause)
          .orderBy(
            statusPriority,
            ...(Array.isArray(orderBy) ? orderBy : [orderBy]),
          )
          .limit(limit)
          .offset(offset),
        db
          .select({ count: count() })
          .from(instructorRatings)
          .innerJoin(courses, eq(instructorRatings.courseId, courses.id))
          .innerJoin(users, eq(instructorRatings.studentId, users.id))
          .where(whereClause),
        db
          .select({ count: count() })
          .from(instructorRatings)
          .innerJoin(courses, eq(instructorRatings.courseId, courses.id))
          .where(
            and(
              ...(isGlobalAdmin(user) ? [] : [eq(courses.managerId, user.id)]),
              eq(instructorRatings.moderationStatus, 'pending'),
            ),
          ),
        db
          .select({ count: count() })
          .from(instructorRatings)
          .innerJoin(courses, eq(instructorRatings.courseId, courses.id))
          .where(
            and(
              ...(isGlobalAdmin(user) ? [] : [eq(courses.managerId, user.id)]),
              eq(instructorRatings.moderationStatus, 'approved'),
            ),
          ),
        db
          .select({ count: count() })
          .from(instructorRatings)
          .innerJoin(courses, eq(instructorRatings.courseId, courses.id))
          .where(
            and(
              ...(isGlobalAdmin(user) ? [] : [eq(courses.managerId, user.id)]),
              eq(instructorRatings.moderationStatus, 'rejected'),
            ),
          ),
      ]);

    const data = rows.map((r) => ({
      id: r.id,
      courseId: r.courseId,
      instructorId: r.instructorId,
      courseTitle: r.courseTitle,
      courseTitleAr: r.courseTitleAr,
      rating: r.rating,
      reviewText: r.reviewText,
      moderationStatus: r.moderationStatus,
      isPublished: r.isPublished,
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt,
      studentName:
        `${r.studentFirstName || ''} ${r.studentLastName || ''}`.trim() ||
        'Anonymous',
    }));

    const total = Number(countRow?.count || 0);
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      counts: {
        pending: Number(pendingRow?.count || 0),
        approved: Number(approvedRow?.count || 0),
        rejected: Number(rejectedRow?.count || 0),
      },
    };
  }

  /**
   * Course-detail view of instructor ratings — paginated published list with
   * stats. Used by the manager course detail "switch to instructor reviews"
   * tab. onlyPublished defaults true (matching the course-rating helper).
   */
  async getInstructorRatings(
    courseId: string,
    params: {
      page?: number;
      limit?: number;
      rating?: number;
      sort?: 'newest' | 'oldest' | 'highest' | 'lowest';
      search?: string;
      onlyPublished?: boolean;
    } = {},
  ) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;
    const onlyPublished = params.onlyPublished !== false;

    const conditions: any[] = [eq(instructorRatings.courseId, courseId)];
    if (onlyPublished) {
      conditions.push(eq(instructorRatings.isPublished, true));
    }
    if (params.rating && params.rating >= 1 && params.rating <= 5) {
      conditions.push(eq(instructorRatings.rating, params.rating));
    }
    if (params.search) {
      const term = `%${params.search}%`;
      conditions.push(
        or(
          ilike(users.firstName, term),
          ilike(users.lastName, term),
          ilike(instructorRatings.reviewText, term),
        ) as any,
      );
    }
    const whereClause = and(...conditions);

    const statsWhere = onlyPublished
      ? and(
          eq(instructorRatings.courseId, courseId),
          eq(instructorRatings.isPublished, true),
        )
      : eq(instructorRatings.courseId, courseId);

    let orderBy;
    switch (params.sort) {
      case 'oldest':
        orderBy = asc(instructorRatings.createdAt);
        break;
      case 'highest':
        orderBy = [
          desc(instructorRatings.rating),
          desc(instructorRatings.createdAt),
        ];
        break;
      case 'lowest':
        orderBy = [
          asc(instructorRatings.rating),
          desc(instructorRatings.createdAt),
        ];
        break;
      case 'newest':
      default:
        orderBy = desc(instructorRatings.createdAt);
    }

    const [rows, [countRow], [statsRow], distRows] = await Promise.all([
      db
        .select({
          id: instructorRatings.id,
          rating: instructorRatings.rating,
          reviewText: instructorRatings.reviewText,
          createdAt: instructorRatings.createdAt,
          studentFirstName: users.firstName,
          studentLastName: users.lastName,
        })
        .from(instructorRatings)
        .innerJoin(users, eq(instructorRatings.studentId, users.id))
        .where(whereClause)
        .orderBy(...(Array.isArray(orderBy) ? orderBy : [orderBy]))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(instructorRatings)
        .innerJoin(users, eq(instructorRatings.studentId, users.id))
        .where(whereClause),
      db
        .select({
          avgRating: sql<number>`COALESCE(AVG(${instructorRatings.rating}), 0)`,
          totalRatings: count(),
        })
        .from(instructorRatings)
        .where(statsWhere),
      db
        .select({
          rating: instructorRatings.rating,
          count: count(),
        })
        .from(instructorRatings)
        .where(statsWhere)
        .groupBy(instructorRatings.rating),
    ]);

    const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    for (const r of distRows) {
      if (r.rating >= 1 && r.rating <= 5) {
        distribution[r.rating as 1 | 2 | 3 | 4 | 5] = Number(r.count);
      }
    }

    const data = rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      reviewText: r.reviewText,
      createdAt: r.createdAt,
      studentName:
        `${r.studentFirstName || ''} ${r.studentLastName || ''}`.trim() ||
        'Anonymous',
    }));

    const total = Number(countRow?.count || 0);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      avgRating: Number(Number(statsRow?.avgRating || 0).toFixed(1)),
      totalRatings: Number(statsRow?.totalRatings || 0),
      distribution,
    };
  }

  /**
   * Featured pool of approved+published instructor reviews for the Strapi
   * homepage block. Round-robin across instructors so quieter instructors
   * aren't drowned out by prolific ones, then a final shuffle inside each
   * bucket so the same N reviews don't always appear.
   *
   * Algorithm: bucket by instructor → shuffle inside each bucket → round-
   * robin pick until `limit` is reached.
   */
  async getFeaturedInstructorReviews(params: { limit?: number } = {}) {
    const limit = Math.min(20, Math.max(1, params.limit || 6));
    const rows = await db
      .select({
        id: instructorRatings.id,
        instructorId: instructorRatings.instructorId,
        courseId: instructorRatings.courseId,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
        rating: instructorRatings.rating,
        reviewText: instructorRatings.reviewText,
        createdAt: instructorRatings.createdAt,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
        instructorFirstName: sql<string | null>`(
          SELECT u.first_name FROM users u WHERE u.id = ${instructorRatings.instructorId}
        )`,
        instructorLastName: sql<string | null>`(
          SELECT u.last_name FROM users u WHERE u.id = ${instructorRatings.instructorId}
        )`,
        instructorFirstNameAr: sql<string | null>`(
          SELECT u.first_name_ar FROM users u WHERE u.id = ${instructorRatings.instructorId}
        )`,
        instructorLastNameAr: sql<string | null>`(
          SELECT u.last_name_ar FROM users u WHERE u.id = ${instructorRatings.instructorId}
        )`,
        instructorAvatar: sql<string | null>`(
          SELECT u.avatar FROM users u WHERE u.id = ${instructorRatings.instructorId}
        )`,
      })
      .from(instructorRatings)
      .innerJoin(courses, eq(instructorRatings.courseId, courses.id))
      .innerJoin(users, eq(instructorRatings.studentId, users.id))
      .where(
        and(
          eq(instructorRatings.moderationStatus, 'approved'),
          eq(instructorRatings.isPublished, true),
        ),
      );

    // Bucket by instructor. Map preserves insertion order, but we shuffle the
    // key order below anyway to avoid bias toward instructors with the lowest
    // UUIDs.
    const buckets = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = buckets.get(r.instructorId) ?? [];
      list.push(r);
      buckets.set(r.instructorId, list);
    }

    // Fisher-Yates in place.
    const shuffle = <T,>(arr: T[]): T[] => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    for (const list of buckets.values()) shuffle(list);
    const instructorOrder = shuffle([...buckets.keys()]);

    const picked: (typeof rows)[number][] = [];
    let progressed = true;
    while (picked.length < limit && progressed) {
      progressed = false;
      for (const id of instructorOrder) {
        if (picked.length >= limit) break;
        const list = buckets.get(id)!;
        if (list.length > 0) {
          picked.push(list.shift()!);
          progressed = true;
        }
      }
    }

    return picked.map((r) => ({
      id: r.id,
      courseId: r.courseId,
      courseTitle: r.courseTitle,
      courseTitleAr: r.courseTitleAr,
      rating: r.rating,
      reviewText: r.reviewText,
      createdAt: r.createdAt,
      studentName:
        `${r.studentFirstName || ''} ${r.studentLastName || ''}`.trim() ||
        'Anonymous',
      instructor: {
        id: r.instructorId,
        firstName: r.instructorFirstName,
        lastName: r.instructorLastName,
        firstNameAr: r.instructorFirstNameAr,
        lastNameAr: r.instructorLastNameAr,
        avatar: r.instructorAvatar,
      },
    }));
  }

  /**
   * Public lookup: given a course id, find its instructor and return that
   * instructor's approved+published reviews across every course they teach.
   * Used by the public course-detail Reviews toggle ("Instructor" tab).
   * Each card carries a courseTitle chip for cross-course context.
   */
  async getInstructorAggregatedRatingsByCourse(
    courseId: string,
    params: { limit?: number } = {},
  ) {
    const [course] = await db
      .select({ instructorId: courses.instructorId })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    if (!course?.instructorId) {
      return { data: [], avgRating: 0, totalRatings: 0 };
    }
    return this.listReviewsForInstructor(course.instructorId, params);
  }

  /**
   * All approved instructor reviews for a given instructor, across every
   * course they teach. Used by the manager instructor side-sheet — each
   * card carries the courseTitle so the manager can see which course the
   * review came from. Approved + published only (matches public semantics).
   */
  async listReviewsForInstructor(
    instructorId: string,
    params: { limit?: number } = {},
  ) {
    const limit = Math.min(100, Math.max(1, params.limit || 50));
    const rows = await db
      .select({
        id: instructorRatings.id,
        courseId: instructorRatings.courseId,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
        rating: instructorRatings.rating,
        reviewText: instructorRatings.reviewText,
        createdAt: instructorRatings.createdAt,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
      })
      .from(instructorRatings)
      .innerJoin(courses, eq(instructorRatings.courseId, courses.id))
      .innerJoin(users, eq(instructorRatings.studentId, users.id))
      .where(
        and(
          eq(instructorRatings.instructorId, instructorId),
          eq(instructorRatings.moderationStatus, 'approved'),
          eq(instructorRatings.isPublished, true),
        ),
      )
      .orderBy(desc(instructorRatings.createdAt))
      .limit(limit);

    const [statsRow] = await db
      .select({
        avgRating: sql<number>`COALESCE(AVG(${instructorRatings.rating}), 0)`,
        totalRatings: count(),
      })
      .from(instructorRatings)
      .where(
        and(
          eq(instructorRatings.instructorId, instructorId),
          eq(instructorRatings.moderationStatus, 'approved'),
          eq(instructorRatings.isPublished, true),
        ),
      );

    return {
      data: rows.map((r) => ({
        id: r.id,
        courseId: r.courseId,
        courseTitle: r.courseTitle,
        courseTitleAr: r.courseTitleAr,
        rating: r.rating,
        reviewText: r.reviewText,
        createdAt: r.createdAt,
        studentName:
          `${r.studentFirstName || ''} ${r.studentLastName || ''}`.trim() ||
          'Anonymous',
      })),
      avgRating: Number(Number(statsRow?.avgRating || 0).toFixed(1)),
      totalRatings: Number(statsRow?.totalRatings || 0),
    };
  }

  /**
   * Public instructor profile + their public courses + recent reviews.
   * 404s if the user has zero public-visible courses — protects against
   * arbitrary user IDs being probed via the URL.
   */
  async findInstructorPublicProfile(instructorId: string) {
    const [profile] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        firstNameAr: users.firstNameAr,
        lastNameAr: users.lastNameAr,
        avatar: users.avatar,
        bio: users.bio,
        specialty: users.specialty,
        profession: users.profession,
        qualification: users.qualification,
        twitter: users.twitter,
        linkedin: users.linkedin,
      })
      .from(users)
      .where(eq(users.id, instructorId))
      .limit(1);

    if (!profile) {
      throw new NotFoundException('Instructor not found');
    }

    // Public courses for this instructor (active or completed, visible)
    const courseRows = await db
      .select({
        id: courses.id,
        title: courses.title,
        titleAr: courses.titleAr,
        description: courses.description,
        descriptionAr: courses.descriptionAr,
        deliveryType: courses.deliveryType,
        status: courses.status,
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
          COALESCE((SELECT SUM(cm.duration_minutes) FROM course_modules cm WHERE cm.course_id = "courses"."id"), 0)
          + COALESCE((SELECT SUM(s.duration_minutes) FROM sessions s WHERE s.course_id = "courses"."id"), 0)
        )`.mapWith(Number),
        avgRating: sql<number>`(
          SELECT COALESCE(AVG(cr.rating), 0) FROM course_ratings cr WHERE cr.course_id = "courses"."id" AND cr.is_published = true
        )`.mapWith(Number),
        totalRatings: sql<number>`(
          SELECT COUNT(*) FROM course_ratings cr WHERE cr.course_id = "courses"."id" AND cr.is_published = true
        )`.mapWith(Number),
      })
      .from(courses)
      .where(
        and(
          eq(courses.instructorId, instructorId),
          eq(courses.visibleOnPublicSite, true),
          or(
            eq(courses.status, COURSE_STATUS.ACTIVE),
            eq(courses.status, COURSE_STATUS.COMPLETED),
          ),
        ),
      )
      .orderBy(desc(courses.startDate));

    // Guard against arbitrary user-ID probing: only surface a profile
    // if this person actually teaches a public course.
    if (courseRows.length === 0) {
      throw new NotFoundException('Instructor not found');
    }

    const now = new Date();
    const enrichedCourses = courseRows.map((c) => {
      const isSelfPaced = c.deliveryType === 'self-paced';
      let effectiveMax: number | null;
      if (isSelfPaced) {
        effectiveMax = c.maxEnrollment ?? null;
      } else {
        const classification = classifyCourse(c.startDate, c.endDate);
        effectiveMax = c.maxEnrollment ?? getNelcMaxEnrollment(classification);
      }
      const remainingSeats =
        effectiveMax !== null ? Math.max(0, effectiveMax - c.enrolledCount) : null;
      const isFull = effectiveMax !== null ? remainingSeats === 0 : false;
      const deadlinePassed = !!(
        c.enrollmentDeadline && new Date(c.enrollmentDeadline) <= now
      );
      let availabilityStatus: 'open' | 'completed' | 'full' | 'deadline_passed';
      if (c.status === 'completed') {
        availabilityStatus = 'completed';
      } else if (deadlinePassed) {
        availabilityStatus = 'deadline_passed';
      } else if (isFull) {
        availabilityStatus = 'full';
      } else {
        availabilityStatus = 'open';
      }
      return {
        ...c,
        totalHours: Math.round((c.totalHours / 60) * 10) / 10,
        avgRating: Number(Number(c.avgRating || 0).toFixed(1)),
        price: c.price ? Number(c.price) : 0,
        remainingSeats,
        isFull,
        availabilityStatus,
      };
    });

    // Aggregate stats across the instructor's whole teaching history
    const courseIds = courseRows.map((c) => c.id);
    const [studentRow] = await db
      .select({
        totalStudents: sql<number>`COUNT(DISTINCT ${enrollments.studentId})`.mapWith(Number),
      })
      .from(enrollments)
      .where(
        and(
          inArray(enrollments.courseId, courseIds),
          sql`${enrollments.status} != 'dropped'`,
        ),
      );

    const [ratingRow] = await db
      .select({
        avgRating: sql<number>`COALESCE(AVG(${instructorRatings.rating}), 0)`,
        totalRatings: count(),
      })
      .from(instructorRatings)
      .where(
        and(
          eq(instructorRatings.instructorId, instructorId),
          eq(instructorRatings.moderationStatus, 'approved'),
          eq(instructorRatings.isPublished, true),
        ),
      );

    const reviews = await this.listReviewsForInstructor(instructorId, { limit: 20 });

    return {
      ...profile,
      stats: {
        totalCourses: courseRows.length,
        totalStudents: Number(studentRow?.totalStudents || 0),
        avgRating: Number(Number(ratingRow?.avgRating || 0).toFixed(1)),
        totalRatings: Number(ratingRow?.totalRatings || 0),
      },
      courses: enrichedCourses,
      reviews,
    };
  }
}
