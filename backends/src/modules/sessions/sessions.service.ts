import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, and, desc, asc, count, sql, gte, lte, or } from 'drizzle-orm';
import { db } from '../../database';
import {
  sessions,
  courses,
  users,
  enrollments,
  attendanceLogs,
  sessionRecordings,
  sessionMaterials,
  courseMaterials,
  sessionAssistants,
  assessments,
  SESSION_STATUS,
  SESSION_TYPE,
} from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { isGlobalAdmin, isManager, isManagerOrAbove, isTA } from '../../common/role-helpers';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { CancelSessionDto } from './dto/cancel-session.dto';
import { ZOOM_SERVICE, IZoomService } from '../zoom/zoom.interface';
import { NelcAuditService } from '../nelc-audit/nelc-audit.service';
import { SessionAssistantsService } from '../session-assistants/session-assistants.service';
import { CourseAssistantsService } from '../course-assistants/course-assistants.service';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { SessionNotificationService } from './session-notification.service';
import { NELC_EVENT_TYPE } from '../../database/schema';
import { classifyCourse, getNelcMaxEnrollment } from '../courses/nelc-config';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    @Inject(ZOOM_SERVICE) private readonly zoomService: IZoomService,
    private readonly auditService: NelcAuditService,
    private readonly assistantsService: SessionAssistantsService,
    private readonly auditLogService: AuditLogService,
    private readonly sessionNotificationService: SessionNotificationService,
    private readonly courseAssistantsService: CourseAssistantsService,
  ) {}

  // ─── Role helpers ─────────────────────────────────────────

  /**
   * Add ownership condition for sessions based on user role:
   * - Global admin: no filter
   * - Manager: session must belong to a course they manage
   * - Instructor: session must belong to them
   */
  private addSessionOwnershipCondition(
    conditions: any[],
    user: AuthenticatedUser,
  ): void {
    if (isGlobalAdmin(user)) {
      // No filter
    } else if (isManager(user)) {
      conditions.push(
        sql`${sessions.courseId} IN (SELECT id FROM courses WHERE manager_id = ${user.id} OR manager_id IS NULL)`,
      );
    } else if (isTA(user)) {
      // TAs see sessions for courses they're actively assigned to
      conditions.push(
        sql`${sessions.courseId} IN (SELECT course_id FROM course_assistants WHERE user_id = ${user.id} AND status = 'approved')`,
      );
    } else {
      conditions.push(eq(sessions.instructorId, user.id));
    }
  }

  // ─── Session CRUD ───────────────────────────────────────────

  /**
   * Schedule a new session.
   * - Instructor: verifies course belongs to them, uses own id.
   * - Admin: can specify instructorId, course just needs to exist.
   */
  async create(user: AuthenticatedUser, dto: CreateSessionDto) {
    // Auto-create Zoom meeting if type is zoom or hybrid
    let zoomLink = dto.zoomLink || null;
    let meetingId = dto.meetingId || null;

    if (
      (dto.type === SESSION_TYPE.ZOOM || dto.type === SESSION_TYPE.HYBRID) &&
      !dto.zoomLink
    ) {
      try {
        // Look up instructor email to create meeting under their Zoom account
        const [instructor] = await db
          .select({ email: users.email, zoomEmail: users.zoomEmail })
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1);
        const hostEmail = instructor?.zoomEmail || instructor?.email || undefined;

        const zoomMeeting = await this.zoomService.createMeeting({
          topic: dto.title,
          startTime: new Date(dto.scheduledAt),
          durationMinutes: dto.durationMinutes || 60,
          recordingEnabled: dto.recordingEnabled !== false,
          hostEmail,
        });
        zoomLink = zoomMeeting.joinUrl;
        meetingId = zoomMeeting.meetingId;
        this.logger.log(
          `Zoom meeting auto-created: ${meetingId} for session "${dto.title}"`,
        );
      } catch (error) {
        this.logger.error('Failed to auto-create Zoom meeting', error);
        throw new BadRequestException(
          'Failed to create Zoom meeting. Please try again or provide a manual Zoom link.',
        );
      }
    }

    if (isManagerOrAbove(user)) {
      // Admin/Manager: verify course exists and user has access
      const courseConditions: any[] = [eq(courses.id, dto.courseId)];
      if (isManager(user)) {
        courseConditions.push(or(eq(courses.managerId, user.id), sql`${courses.managerId} IS NULL`)!);
      }

      const [course] = await db
        .select({
          id: courses.id,
          instructorId: courses.instructorId,
          startDate: courses.startDate,
          endDate: courses.endDate,
        })
        .from(courses)
        .where(and(...courseConditions))
        .limit(1);

      if (!course) {
        throw new NotFoundException('Course not found');
      }

      // Validate session date is within course date range
      this.validateSessionDateRange(dto.scheduledAt, course.startDate, course.endDate);

      const instructorId = dto.instructorId || course.instructorId;

      const [session] = await db
        .insert(sessions)
        .values({
          courseId: dto.courseId,
          instructorId,
          title: dto.title,
          type: dto.type,
          scheduledAt: new Date(dto.scheduledAt),
          durationMinutes: dto.durationMinutes,
          zoomLink,
          meetingId,
          roomName: dto.roomName,
          venueAddress: dto.venueAddress,
          recordingEnabled: dto.recordingEnabled !== false,
          isMakeup: dto.isMakeup || false,
          parentSessionId: dto.parentSessionId || null,
          assignedStudents: dto.assignedStudents || null,
        })
        .returning();

      // Auto-allocate assistants based on NELC rules
      await this.assistantsService.checkAndAllocate(session.id).catch((err) => {
        this.logger.warn('Auto-allocation failed for session', err);
      });

      // Propagate course-level TAs to this new session
      await this.courseAssistantsService.propagateToSession(dto.courseId, session.id).catch((err) => {
        this.logger.warn('Course TA propagation failed for session', err);
      });

      // Audit log
      await this.auditLogService.log({
        entityType: 'session',
        entityId: session.id,
        action: 'session.created',
        performedBy: user.id,
        metadata: { courseId: dto.courseId, scheduledAt: dto.scheduledAt },
      }).catch(() => {});

      // Notify enrolled students
      this.sessionNotificationService
        .notifySessionEvent(session, 'session_scheduled')
        .catch(() => {});

      return session;
    }

    // Instructor: verify course belongs to them
    const [course] = await db
      .select({
        id: courses.id,
        startDate: courses.startDate,
        endDate: courses.endDate,
      })
      .from(courses)
      .where(
        and(
          eq(courses.id, dto.courseId),
          eq(courses.instructorId, user.id),
        ),
      )
      .limit(1);

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Validate session date is within course date range
    this.validateSessionDateRange(dto.scheduledAt, course.startDate, course.endDate);

    const [session] = await db
      .insert(sessions)
      .values({
        courseId: dto.courseId,
        instructorId: user.id,
        title: dto.title,
        type: dto.type,
        scheduledAt: new Date(dto.scheduledAt),
        durationMinutes: dto.durationMinutes,
        zoomLink,
        meetingId,
        roomName: dto.roomName,
        venueAddress: dto.venueAddress,
        recordingEnabled: dto.recordingEnabled !== false,
        isMakeup: dto.isMakeup || false,
        parentSessionId: dto.parentSessionId || null,
        assignedStudents: dto.assignedStudents || null,
      })
      .returning();

    // Auto-allocate assistants based on NELC rules
    await this.assistantsService.checkAndAllocate(session.id).catch((err) => {
      this.logger.warn('Auto-allocation failed for session', err);
    });

    // Propagate course-level TAs to this new session
    await this.courseAssistantsService.propagateToSession(dto.courseId, session.id).catch((err) => {
      this.logger.warn('Course TA propagation failed for session', err);
    });

    // Audit log
    await this.auditLogService.log({
      entityType: 'session',
      entityId: session.id,
      action: 'session.created',
      performedBy: user.id,
      metadata: { courseId: dto.courseId, scheduledAt: dto.scheduledAt },
    }).catch(() => {});

    // Notify enrolled students
    this.sessionNotificationService
      .notifySessionEvent(session, 'session_scheduled')
      .catch(() => {});

    return session;
  }

  /**
   * Get sessions assigned to a Teaching Assistant via session_assistants.
   */
  async getAssignedSessions(
    userId: string,
    params: {
      dateRange?: string;
      status?: string;
      courseId?: string;
    } = {},
  ) {
    const conditions = [eq(sessionAssistants.userId, userId)];

    if (params.status) {
      conditions.push(eq(sessions.status, params.status));
    }
    if (params.courseId) {
      conditions.push(eq(sessions.courseId, params.courseId));
    }
    if (params.dateRange) {
      const [startStr, endStr] = params.dateRange.split(',');
      if (startStr) conditions.push(gte(sessions.scheduledAt, new Date(startStr)));
      if (endStr) conditions.push(lte(sessions.scheduledAt, new Date(endStr)));
    }

    const assessmentIdSubquery = db
      .select({ id: assessments.id })
      .from(assessments)
      .where(
        and(
          sql`${assessments.courseId} = ${sessions.courseId}`,
          sql`${assessments.status} != 'draft'`,
        ),
      )
      .limit(1);

    const data = await db
      .select({
        id: sessions.id,
        courseId: sessions.courseId,
        courseName: courses.title,
        instructorId: sessions.instructorId,
        title: sessions.title,
        type: sessions.type,
        scheduledAt: sessions.scheduledAt,
        durationMinutes: sessions.durationMinutes,
        zoomLink: sessions.zoomLink,
        status: sessions.status,
        roomName: sessions.roomName,
        venueAddress: sessions.venueAddress,
        assistantRole: sessionAssistants.role,
        assessmentId: sql<string | null>`(${assessmentIdSubquery})`.as(
          'assessment_id',
        ),
      })
      .from(sessionAssistants)
      .innerJoin(sessions, eq(sessionAssistants.sessionId, sessions.id))
      .innerJoin(courses, eq(sessions.courseId, courses.id))
      .where(and(...conditions))
      .orderBy(desc(sessions.scheduledAt));

    return data;
  }

  /**
   * Generate a Zoom join URL for a TA with their name pre-filled as
   * "Full Name | TA-xxxxxxxx" (platform ID = first 8 chars of user UUID).
   * This allows Zoom sync to identify and skip TAs automatically.
   */
  async getTAJoinUrl(userId: string, sessionId: string) {
    // Verify TA is assigned to this session
    const [assignment] = await db
      .select({ id: sessionAssistants.id })
      .from(sessionAssistants)
      .where(
        and(
          eq(sessionAssistants.sessionId, sessionId),
          eq(sessionAssistants.userId, userId),
        ),
      )
      .limit(1);

    if (!assignment) {
      throw new BadRequestException('You are not assigned to this session');
    }

    const [session] = await db
      .select({ zoomLink: sessions.zoomLink, status: sessions.status })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session) throw new NotFoundException('Session not found');
    if (!session.zoomLink) {
      throw new BadRequestException('This session has no Zoom link');
    }

    const [user] = await db
      .select({ firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const fullName =
      [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Teaching Assistant';
    const platformId = `TA-${userId.substring(0, 8)}`;
    const displayName = `${fullName} | ${platformId}`;

    const separator = session.zoomLink.includes('?') ? '&' : '?';
    const joinUrl = `${session.zoomLink}${separator}uname=${encodeURIComponent(displayName)}`;

    return { joinUrl, displayName };
  }

  /**
   * List sessions with filtering and pagination.
   * - Instructor: only their own sessions.
   * - Admin: all sessions across all instructors.
   */
  async findAll(
    user: AuthenticatedUser,
    params: {
      dateRange?: string;
      status?: string;
      courseId?: string;
      instructorId?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [];

    // Scope by role
    this.addSessionOwnershipCondition(conditions, user);

    // dateRange filter — format: "YYYY-MM-DD,YYYY-MM-DD"
    if (params.dateRange) {
      const parts = params.dateRange.split(',');
      if (parts[0] && parts[0].trim()) {
        conditions.push(
          gte(sessions.scheduledAt, new Date(parts[0].trim())),
        );
      }
      if (parts[1] && parts[1].trim()) {
        const endDate = new Date(parts[1].trim());
        endDate.setHours(23, 59, 59, 999);
        conditions.push(lte(sessions.scheduledAt, endDate));
      }
    }

    if (
      params.status &&
      Object.values(SESSION_STATUS).includes(params.status as any)
    ) {
      conditions.push(eq(sessions.status, params.status));
    }

    if (params.courseId) {
      conditions.push(eq(sessions.courseId, params.courseId));
    }

    if (params.instructorId) {
      conditions.push(eq(sessions.instructorId, params.instructorId));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    // Subquery for enrolled count per course
    const enrolledCountSq = db
      .select({
        courseId: enrollments.courseId,
        enrolledCount: count().as('enrolled_count'),
      })
      .from(enrollments)
      .where(eq(enrollments.status, 'active'))
      .groupBy(enrollments.courseId)
      .as('enrolled_sq');

    const data = await db
      .select({
        id: sessions.id,
        courseId: sessions.courseId,
        instructorId: sessions.instructorId,
        title: sessions.title,
        type: sessions.type,
        status: sessions.status,
        scheduledAt: sessions.scheduledAt,
        durationMinutes: sessions.durationMinutes,
        venueAddress: sessions.venueAddress,
        zoomLink: sessions.zoomLink,
        meetingId: sessions.meetingId,
        cancelReason: sessions.cancelReason,
        createdAt: sessions.createdAt,
        updatedAt: sessions.updatedAt,
        instructorFirstName: users.firstName,
        instructorLastName: users.lastName,
        instructorEmail: users.email,
        // Capacity fields
        enrolledCount: enrolledCountSq.enrolledCount,
        maxEnrollment: courses.maxEnrollment,
        courseStartDate: courses.startDate,
        courseEndDate: courses.endDate,
      })
      .from(sessions)
      .leftJoin(users, eq(sessions.instructorId, users.id))
      .leftJoin(courses, eq(sessions.courseId, courses.id))
      .leftJoin(enrolledCountSq, eq(sessions.courseId, enrolledCountSq.courseId))
      .where(whereClause)
      .orderBy(desc(sessions.scheduledAt))
      .limit(limit)
      .offset(offset);

    // Enrich with NELC capacity
    const enrichedData = data.map((row) => {
      const classification = classifyCourse(row.courseStartDate, row.courseEndDate);
      const nelcLimit = row.maxEnrollment || getNelcMaxEnrollment(classification);
      const enrolled = Number(row.enrolledCount) || 0;
      const capacityPercent = nelcLimit > 0 ? Math.round((enrolled / nelcLimit) * 100) : 0;
      return {
        ...row,
        enrolledCount: enrolled,
        nelcLimit,
        capacityPercent,
      };
    });

    const [countResult] = await db
      .select({ count: count() })
      .from(sessions)
      .where(whereClause);

    return {
      data: enrichedData,
      total: countResult?.count || 0,
      page,
      limit,
      totalPages: Math.ceil((countResult?.count || 0) / limit),
    };
  }

  /**
   * Today's sessions.
   * - Instructor: only theirs.
   * - Admin: all sessions today.
   */
  async findToday(user: AuthenticatedUser) {
    const conditions: ReturnType<typeof eq>[] = [
      sql`DATE(${sessions.scheduledAt}) = CURRENT_DATE` as any,
    ];

    this.addSessionOwnershipCondition(conditions, user);

    const data = await db
      .select()
      .from(sessions)
      .where(and(...conditions))
      .orderBy(asc(sessions.scheduledAt));

    return data;
  }

  /**
   * Upcoming sessions — future sessions ordered by date.
   * - Instructor: only theirs.
   * - Admin: all upcoming sessions.
   */
  async findUpcoming(user: AuthenticatedUser) {
    const conditions: ReturnType<typeof eq>[] = [
      sql`${sessions.scheduledAt} > NOW()` as any,
    ];

    this.addSessionOwnershipCondition(conditions, user);

    const data = await db
      .select()
      .from(sessions)
      .where(and(...conditions))
      .orderBy(asc(sessions.scheduledAt));

    return data;
  }

  /**
   * Session detail.
   * - Instructor: only their own (404 for others).
   * - Admin: any session.
   */
  async findOne(sessionId: string, user: AuthenticatedUser) {
    const conditions = [eq(sessions.id, sessionId)];
    this.addSessionOwnershipCondition(conditions, user);

    const [session] = await db
      .select()
      .from(sessions)
      .where(and(...conditions))
      .limit(1);

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }

  /**
   * Update a session.
   * - Instructor: only their own.
   * - Admin: any session.
   */
  async update(
    sessionId: string,
    user: AuthenticatedUser,
    dto: UpdateSessionDto,
  ) {
    const session = await this.verifySessionAccess(sessionId, user);

    // Prevent modifications to live, completed, or cancelled sessions
    if (session.status !== SESSION_STATUS.SCHEDULED) {
      throw new BadRequestException(
        `Cannot update a ${session.status} session. Only scheduled sessions can be modified.`,
      );
    }

    const updateData: Record<string, unknown> = {
      ...dto,
      updatedAt: new Date(),
    };

    // Convert scheduledAt string to Date for timestamp column
    if (dto.scheduledAt) {
      updateData.scheduledAt = new Date(dto.scheduledAt);
    }

    const [updated] = await db
      .update(sessions)
      .set(updateData)
      .where(eq(sessions.id, sessionId))
      .returning();

    // Audit log the update
    await this.auditLogService.log({
      entityType: 'session',
      entityId: updated.id,
      action: 'session.updated',
      performedBy: user.id,
      metadata: {
        changes: dto,
        previousScheduledAt: session.scheduledAt,
        previousDuration: session.durationMinutes,
      },
    });

    // Sync Zoom meeting if time/duration/title changed on a Zoom/hybrid session
    // Item #14: surface Zoom update failures to user instead of silently swallowing
    let zoomSyncError: string | null = null;
    if (
      updated.meetingId &&
      (updated.type === SESSION_TYPE.ZOOM || updated.type === SESSION_TYPE.HYBRID) &&
      (dto.scheduledAt || dto.durationMinutes || dto.title)
    ) {
      try {
        await this.zoomService.updateMeeting(updated.meetingId, {
          topic: dto.title || undefined,
          startTime: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
          durationMinutes: dto.durationMinutes || undefined,
        });
        this.logger.log(`Zoom meeting ${updated.meetingId} synced with session update`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to sync Zoom meeting ${updated.meetingId} on session update: ${msg}`);
        zoomSyncError = `Session updated but Zoom meeting sync failed: ${msg}`;
      }
    }

    return { ...updated, zoomSyncError };
  }

  // ─── Session Lifecycle ──────────────────────────────────────

  /**
   * Start a session — sets status=live and actualStartedAt=NOW()
   * Cannot start an already live session.
   */
  async start(sessionId: string, user: AuthenticatedUser) {
    const session = await this.verifySessionAccess(sessionId, user);

    if (session.status === SESSION_STATUS.LIVE) {
      throw new BadRequestException(
        'Cannot start an already live session',
      );
    }

    if (session.status !== SESSION_STATUS.SCHEDULED) {
      throw new BadRequestException(
        'Only scheduled sessions can be started',
      );
    }

    // Block starting more than 15 minutes before scheduled time
    const now = new Date();
    const scheduledAt = new Date(session.scheduledAt);
    const fifteenMinBefore = new Date(scheduledAt.getTime() - 15 * 60 * 1000);
    if (now < fifteenMinBefore) {
      const diffMs = scheduledAt.getTime() - now.getTime();
      const diffHours = Math.floor(diffMs / 3600000);
      const diffMins = Math.ceil((diffMs % 3600000) / 60000);
      const timeStr = diffHours > 0
        ? `${diffHours}h ${diffMins}m`
        : `${diffMins} minute(s)`;
      const scheduledStr = scheduledAt.toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
      throw new BadRequestException(
        `Cannot start session yet. The session is scheduled for ${scheduledStr}. You can start it up to 15 minutes before (in ${timeStr}).`,
      );
    }

    const [updated] = await db
      .update(sessions)
      .set({
        status: SESSION_STATUS.LIVE,
        actualStartedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId))
      .returning();

    // If this is a Zoom/hybrid session with a meetingId, fetch the host start URL
    let zoomStartUrl: string | null = null;
    if (
      updated.meetingId &&
      (updated.type === SESSION_TYPE.ZOOM ||
        updated.type === SESSION_TYPE.HYBRID)
    ) {
      try {
        const meetingDetails = await this.zoomService.getMeeting(
          updated.meetingId,
        );
        zoomStartUrl = meetingDetails.startUrl;
      } catch (error) {
        this.logger.warn(
          `Could not fetch Zoom start URL for meeting ${updated.meetingId}`,
          error,
        );
      }
    }

    await this.auditService.log({
      eventType: NELC_EVENT_TYPE.SESSION_STARTED,
      entityType: 'session',
      entityId: updated.id,
      userId: user.id,
      metadata: {
        sessionId: updated.id,
        courseId: updated.courseId,
        instructorId: updated.instructorId,
        method: updated.type,
      },
    });

    await this.auditLogService.log({
      entityType: 'session',
      entityId: updated.id,
      action: 'session.started',
      performedBy: user.id,
      metadata: { courseId: updated.courseId },
    }).catch(() => {});

    // Notify enrolled students
    this.sessionNotificationService
      .notifySessionEvent(updated, 'session_started')
      .catch(() => {});

    return { ...updated, zoomStartUrl };
  }

  /**
   * End a session — sets status=ended and actualEndedAt=NOW()
   * Attendance remains editable until the instructor finalizes (→ completed).
   */
  async end(sessionId: string, user: AuthenticatedUser) {
    const session = await this.verifySessionAccess(sessionId, user);

    if (session.status !== SESSION_STATUS.LIVE) {
      throw new BadRequestException('Cannot end a non-live session');
    }

    // End the Zoom meeting if this is a zoom/hybrid session
    let zoomEndedSuccessfully = true;
    let zoomErrorMessage: string | undefined;

    if (
      session.meetingId &&
      (session.type === SESSION_TYPE.ZOOM ||
        session.type === SESSION_TYPE.HYBRID)
    ) {
      const result = await this.zoomService.endMeeting(session.meetingId);
      zoomEndedSuccessfully = result.ended;
      zoomErrorMessage = result.error;
    } else if (
      !session.meetingId &&
      session.zoomLink &&
      (session.type === SESSION_TYPE.ZOOM ||
        session.type === SESSION_TYPE.HYBRID)
    ) {
      // Fallback: extract meeting ID from Zoom URL
      const extracted = session.zoomLink.match(/\/j\/(\d+)/)?.[1];
      if (extracted) {
        this.logger.log(
          `No meetingId stored — extracted ${extracted} from zoomLink`,
        );
        const result = await this.zoomService.endMeeting(extracted);
        zoomEndedSuccessfully = result.ended;
        zoomErrorMessage = result.error;
      } else {
        zoomEndedSuccessfully = false;
        zoomErrorMessage = 'No meeting ID available';
      }
    }

    const [updated] = await db
      .update(sessions)
      .set({
        status: SESSION_STATUS.ENDED,
        actualEndedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId))
      .returning();

    await this.auditService.log({
      eventType: NELC_EVENT_TYPE.SESSION_ENDED,
      entityType: 'session',
      entityId: updated.id,
      userId: user.id,
      metadata: {
        sessionId: updated.id,
        courseId: updated.courseId,
        actualStartedAt: session.actualStartedAt,
        actualEndedAt: updated.actualEndedAt,
      },
    });

    await this.auditLogService.log({
      entityType: 'session',
      entityId: updated.id,
      action: 'session.ended',
      performedBy: user.id,
      metadata: { courseId: updated.courseId },
    }).catch(() => {});

    // Notify enrolled students
    this.sessionNotificationService
      .notifySessionEvent(updated, 'session_ended')
      .catch(() => {});

    return { ...updated, zoomEndedSuccessfully, zoomErrorMessage };
  }

  /**
   * Finalize a session — moves from 'ended' to 'completed', locking attendance.
   */
  async finalize(sessionId: string, user: AuthenticatedUser) {
    const session = await this.verifySessionAccess(sessionId, user);

    if (session.status !== SESSION_STATUS.ENDED) {
      throw new BadRequestException(
        `Cannot finalize a ${session.status} session. Only ended sessions can be finalized.`,
      );
    }

    const [updated] = await db
      .update(sessions)
      .set({
        status: SESSION_STATUS.COMPLETED,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId))
      .returning();

    await this.auditService.log({
      eventType: NELC_EVENT_TYPE.SESSION_FINALIZED,
      entityType: 'session',
      entityId: updated.id,
      userId: user.id,
      metadata: {
        sessionId: updated.id,
        courseId: updated.courseId,
      },
    });

    await this.auditLogService.log({
      entityType: 'session',
      entityId: updated.id,
      action: 'session.finalized',
      performedBy: user.id,
      metadata: { courseId: updated.courseId },
    }).catch(() => {});

    return updated;
  }

  /**
   * Cancel a session — requires a reason (400 if empty).
   */
  async cancel(
    sessionId: string,
    user: AuthenticatedUser,
    dto: CancelSessionDto,
  ) {
    const session = await this.verifySessionAccess(sessionId, user);

    if (
      session.status === SESSION_STATUS.COMPLETED ||
      session.status === SESSION_STATUS.CANCELLED
    ) {
      throw new BadRequestException(
        `Cannot cancel a ${session.status} session`,
      );
    }

    // Delete Zoom meeting if this is a Zoom/hybrid session
    if (
      session.meetingId &&
      (session.type === SESSION_TYPE.ZOOM || session.type === SESSION_TYPE.HYBRID)
    ) {
      try {
        const result = await this.zoomService.deleteMeeting(session.meetingId);
        if (!result.deleted) {
          this.logger.warn(`Failed to delete Zoom meeting ${session.meetingId}: ${result.error}`);
        }
      } catch (error) {
        this.logger.warn(`Error deleting Zoom meeting ${session.meetingId} on cancel`, error);
      }
    }

    const [updated] = await db
      .update(sessions)
      .set({
        status: SESSION_STATUS.CANCELLED,
        cancelReason: dto.cancelReason,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId))
      .returning();

    await this.auditService.log({
      eventType: NELC_EVENT_TYPE.SESSION_CANCELLED,
      entityType: 'session',
      entityId: updated.id,
      userId: user.id,
      metadata: {
        sessionId: updated.id,
        courseId: updated.courseId,
        cancelReason: dto.cancelReason,
      },
    });

    await this.auditLogService.log({
      entityType: 'session',
      entityId: updated.id,
      action: 'session.cancelled',
      performedBy: user.id,
      metadata: { courseId: updated.courseId, reason: dto.cancelReason },
    }).catch(() => {});

    // Notify enrolled students
    this.sessionNotificationService
      .notifySessionEvent(updated, 'session_cancelled', {
        cancelReason: dto.cancelReason,
      })
      .catch(() => {});

    return updated;
  }

  /**
   * Delete a session — only completed or cancelled sessions can be deleted.
   */
  async delete(sessionId: string, user: AuthenticatedUser) {
    const session = await this.verifySessionAccess(sessionId, user);

    if (
      session.status !== SESSION_STATUS.COMPLETED &&
      session.status !== SESSION_STATUS.CANCELLED
    ) {
      throw new BadRequestException(
        'Only completed or cancelled sessions can be deleted',
      );
    }

    await db.delete(sessions).where(eq(sessions.id, sessionId));

    return { message: 'Session deleted successfully' };
  }

  // ─── Manager Oversight Actions ─────────────────────────────────

  /**
   * Cancel a session on behalf of an instructor (Manager action).
   */
  async cancelOnBehalf(sessionId: string, user: AuthenticatedUser, reason: string) {
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session) throw new NotFoundException('Session not found');

    if (session.status === SESSION_STATUS.COMPLETED || session.status === SESSION_STATUS.CANCELLED) {
      throw new BadRequestException(`Cannot cancel a ${session.status} session`);
    }

    // Delete Zoom meeting
    if (
      session.meetingId &&
      (session.type === SESSION_TYPE.ZOOM || session.type === SESSION_TYPE.HYBRID)
    ) {
      try {
        await this.zoomService.deleteMeeting(session.meetingId);
      } catch (error) {
        this.logger.warn(`Failed to delete Zoom meeting ${session.meetingId} on manager cancel`, error);
      }
    }

    const [updated] = await db
      .update(sessions)
      .set({
        status: SESSION_STATUS.CANCELLED,
        cancelReason: `[Manager] ${reason}`,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId))
      .returning();

    await this.auditService.log({
      eventType: NELC_EVENT_TYPE.SESSION_CANCELLED,
      entityType: 'session',
      entityId: updated.id,
      userId: user.id,
      metadata: { sessionId: updated.id, courseId: updated.courseId, cancelReason: reason, cancelledBy: 'manager' },
    });

    await this.auditLogService.log({
      entityType: 'session',
      entityId: updated.id,
      action: 'session.cancelled',
      performedBy: user.id,
      metadata: { courseId: updated.courseId, reason, cancelledBy: 'manager' },
    }).catch(() => {});

    // Notify enrolled students
    this.sessionNotificationService
      .notifySessionEvent(updated, 'session_cancelled', {
        cancelReason: reason,
      })
      .catch(() => {});

    return updated;
  }

  /**
   * Reschedule a session (Manager action).
   */
  async reschedule(sessionId: string, user: AuthenticatedUser, newDate: string, newDuration?: number) {
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session) throw new NotFoundException('Session not found');

    if (session.status === SESSION_STATUS.COMPLETED || session.status === SESSION_STATUS.CANCELLED) {
      throw new BadRequestException(`Cannot reschedule a ${session.status} session`);
    }

    const updateData: Record<string, unknown> = {
      scheduledAt: new Date(newDate),
      updatedAt: new Date(),
    };
    if (newDuration) {
      updateData.durationMinutes = newDuration;
    }

    const [updated] = await db
      .update(sessions)
      .set(updateData)
      .where(eq(sessions.id, sessionId))
      .returning();

    // Sync Zoom meeting with new schedule
    let zoomSyncError: string | null = null;
    if (
      session.meetingId &&
      (session.type === SESSION_TYPE.ZOOM || session.type === SESSION_TYPE.HYBRID)
    ) {
      try {
        await this.zoomService.updateMeeting(session.meetingId, {
          startTime: new Date(newDate),
          durationMinutes: newDuration || undefined,
        });
        this.logger.log(`Zoom meeting ${session.meetingId} rescheduled`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to reschedule Zoom meeting ${session.meetingId}: ${msg}`);
        zoomSyncError = `Session rescheduled but Zoom meeting sync failed: ${msg}`;
      }
    }

    await this.auditLogService.log({
      entityType: 'session',
      entityId: updated.id,
      action: 'session.rescheduled',
      performedBy: user.id,
      metadata: { newDate, newDuration, oldDate: session.scheduledAt },
    }).catch(() => {});

    // Notify enrolled students
    this.sessionNotificationService
      .notifySessionEvent(updated, 'session_rescheduled')
      .catch(() => {});

    return { ...updated, zoomSyncError };
  }

  /**
   * Assign a substitute instructor (Manager action).
   */
  async assignSubstitute(sessionId: string, user: AuthenticatedUser, newInstructorId: string) {
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session) throw new NotFoundException('Session not found');

    if (session.status === SESSION_STATUS.COMPLETED || session.status === SESSION_STATUS.CANCELLED) {
      throw new BadRequestException(`Cannot reassign a ${session.status} session`);
    }

    const [updated] = await db
      .update(sessions)
      .set({
        instructorId: newInstructorId,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId))
      .returning();

    await this.auditLogService.log({
      entityType: 'session',
      entityId: updated.id,
      action: 'session.substitute_assigned',
      performedBy: user.id,
      metadata: { oldInstructorId: session.instructorId, newInstructorId },
    }).catch(() => {});

    return updated;
  }

  // ─── Conflict Detection ──────────────────────────────────────

  /**
   * Detect scheduling conflicts: sessions that overlap for the same instructor.
   */
  async detectConflicts() {
    // Get all non-cancelled scheduled sessions
    const allSessions = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        instructorId: sessions.instructorId,
        scheduledAt: sessions.scheduledAt,
        durationMinutes: sessions.durationMinutes,
        instructorFirstName: users.firstName,
        instructorLastName: users.lastName,
      })
      .from(sessions)
      .leftJoin(users, eq(sessions.instructorId, users.id))
      .where(
        and(
          sql`${sessions.status} IN ('scheduled', 'live')`,
          sql`${sessions.instructorId} IS NOT NULL`,
        ),
      )
      .orderBy(asc(sessions.scheduledAt));

    const conflicts: Array<{
      sessionA: { id: string; title: string; scheduledAt: Date; durationMinutes: number };
      sessionB: { id: string; title: string; scheduledAt: Date; durationMinutes: number };
      instructorName: string;
      instructorId: string;
    }> = [];

    // Group by instructorId
    const byInstructor = new Map<string, typeof allSessions>();
    for (const s of allSessions) {
      if (!s.instructorId) continue;
      if (!byInstructor.has(s.instructorId)) {
        byInstructor.set(s.instructorId, []);
      }
      byInstructor.get(s.instructorId)!.push(s);
    }

    // Check for time overlaps within each instructor's sessions
    for (const [instructorId, instrSessions] of byInstructor) {
      for (let i = 0; i < instrSessions.length; i++) {
        for (let j = i + 1; j < instrSessions.length; j++) {
          const a = instrSessions[i];
          const b = instrSessions[j];

          const aStart = new Date(a.scheduledAt).getTime();
          const aEnd = aStart + (a.durationMinutes || 60) * 60000;
          const bStart = new Date(b.scheduledAt).getTime();
          const bEnd = bStart + (b.durationMinutes || 60) * 60000;

          // Overlap if one starts before the other ends
          if (aStart < bEnd && bStart < aEnd) {
            conflicts.push({
              sessionA: { id: a.id, title: a.title, scheduledAt: a.scheduledAt, durationMinutes: a.durationMinutes },
              sessionB: { id: b.id, title: b.title, scheduledAt: b.scheduledAt, durationMinutes: b.durationMinutes },
              instructorName: `${a.instructorFirstName || ''} ${a.instructorLastName || ''}`.trim(),
              instructorId,
            });
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Get instructor load for a given week.
   * Returns sessions count and total hours for the instructor.
   */
  async getInstructorLoad(instructorId: string, weekStart?: string) {
    const start = weekStart
      ? new Date(weekStart)
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() - d.getDay()); // start of current week (Sunday)
          d.setHours(0, 0, 0, 0);
          return d;
        })();
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const result = await db
      .select({
        sessionsCount: count(),
        totalMinutes: sql<number>`COALESCE(SUM(${sessions.durationMinutes}), 0)`,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.instructorId, instructorId),
          gte(sessions.scheduledAt, start),
          lte(sessions.scheduledAt, end),
          sql`${sessions.status} IN ('scheduled', 'live', 'ended', 'completed')`,
        ),
      );

    return {
      instructorId,
      weekStart: start.toISOString(),
      sessionsCount: result[0]?.sessionsCount || 0,
      hoursTotal: Math.round((Number(result[0]?.totalMinutes) || 0) / 60 * 10) / 10,
    };
  }

  /**
   * Get an instructor's schedule for the next 2 weeks (or custom range).
   */
  async getInstructorSchedule(
    instructorId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate
      ? new Date(endDate)
      : (() => {
          const d = new Date(start);
          d.setDate(d.getDate() + 14);
          return d;
        })();

    const rows = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        courseId: sessions.courseId,
        courseTitle: courses.title,
        type: sessions.type,
        scheduledAt: sessions.scheduledAt,
        durationMinutes: sessions.durationMinutes,
        status: sessions.status,
      })
      .from(sessions)
      .innerJoin(courses, eq(sessions.courseId, courses.id))
      .where(
        and(
          eq(sessions.instructorId, instructorId),
          gte(sessions.scheduledAt, start),
          lte(sessions.scheduledAt, end),
          sql`${sessions.status} IN ('scheduled', 'live', 'ended', 'completed')`,
        ),
      )
      .orderBy(asc(sessions.scheduledAt));

    return rows;
  }

  // ─── Helpers ────────────────────────────────────────────────

  /**
   * Validate that a session date falls within the course date range.
   */
  private validateSessionDateRange(
    scheduledAt: string,
    courseStartDate: string | null,
    courseEndDate: string | null,
  ) {
    // Compare date portions only (YYYY-MM-DD) to avoid timezone issues.
    // The session datetime from the frontend represents the user's local date,
    // so we extract just the date part for comparison.
    const sessionDateStr = scheduledAt.slice(0, 10); // "YYYY-MM-DD"
    if (courseStartDate) {
      const startStr = new Date(courseStartDate).toISOString().slice(0, 10);
      if (sessionDateStr < startStr) {
        throw new BadRequestException(
          `Session date cannot be before the course start date (${startStr})`,
        );
      }
    }
    if (courseEndDate) {
      const endStr = new Date(courseEndDate).toISOString().slice(0, 10);
      if (sessionDateStr > endStr) {
        throw new BadRequestException(
          `Session date cannot be after the course end date (${endStr})`,
        );
      }
    }
  }

  /**
   * Verify the user can access the session.
   * - Admin: any session (lookup by id only).
   * - Instructor: only their own (lookup by id + instructorId → 404 otherwise).
   */
  private async verifySessionAccess(
    sessionId: string,
    user: AuthenticatedUser,
  ) {
    const conditions = [eq(sessions.id, sessionId)];
    this.addSessionOwnershipCondition(conditions, user);

    const [session] = await db
      .select()
      .from(sessions)
      .where(and(...conditions))
      .limit(1);

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }

  /**
   * Get granular join/leave attendance logs for a session.
   * Includes unmatched Zoom participants (studentId IS NULL).
   */
  async getAttendanceLogs(sessionId: string) {
    const logs = await db
      .select({
        id: attendanceLogs.id,
        sessionId: attendanceLogs.sessionId,
        studentId: attendanceLogs.studentId,
        eventType: attendanceLogs.eventType,
        timestamp: attendanceLogs.timestamp,
        zoomParticipantId: attendanceLogs.zoomParticipantId,
        zoomUserEmail: attendanceLogs.zoomUserEmail,
        rawPayload: attendanceLogs.rawPayload,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
        studentEmail: users.email,
      })
      .from(attendanceLogs)
      .leftJoin(users, eq(attendanceLogs.studentId, users.id))
      .where(eq(attendanceLogs.sessionId, sessionId))
      .orderBy(asc(attendanceLogs.timestamp));

    return logs;
  }

  /** Get session recordings (item #22) */
  async getRecordings(sessionId: string) {
    const recordings = await db
      .select()
      .from(sessionRecordings)
      .where(eq(sessionRecordings.sessionId, sessionId))
      .orderBy(asc(sessionRecordings.recordingStart));

    return recordings;
  }

  // ─── Share Materials (Feature 8) ──────────────────────

  /** Share a course material with a session */
  async shareMaterial(
    sessionId: string,
    materialId: string,
    user: AuthenticatedUser,
  ) {
    const session = await this.verifySessionAccess(sessionId, user);

    // Verify material belongs to the same course
    const [material] = await db
      .select({ id: courseMaterials.id })
      .from(courseMaterials)
      .where(
        and(
          eq(courseMaterials.id, materialId),
          eq(courseMaterials.courseId, session.courseId),
        ),
      )
      .limit(1);

    if (!material) {
      throw new NotFoundException('Material not found in this course');
    }

    // Insert (on conflict do nothing for idempotency)
    await db
      .insert(sessionMaterials)
      .values({
        sessionId,
        materialId,
        sharedBy: user.id,
      })
      .onConflictDoNothing();

    return { message: 'Material shared successfully' };
  }

  /** Unshare a material from a session */
  async unshareMaterial(
    sessionId: string,
    materialId: string,
    user: AuthenticatedUser,
  ) {
    await this.verifySessionAccess(sessionId, user);

    await db
      .delete(sessionMaterials)
      .where(
        and(
          eq(sessionMaterials.sessionId, sessionId),
          eq(sessionMaterials.materialId, materialId),
        ),
      );

    return { message: 'Material unshared successfully' };
  }

  /** Get shared materials for a session */
  async getSharedMaterials(sessionId: string) {
    const shared = await db
      .select({
        id: sessionMaterials.id,
        materialId: sessionMaterials.materialId,
        sharedAt: sessionMaterials.sharedAt,
        materialTitle: courseMaterials.title,
        materialType: courseMaterials.type,
        fileUrl: courseMaterials.fileUrl,
        fileSize: courseMaterials.fileSize,
        mimeType: courseMaterials.mimeType,
        sharerFirstName: users.firstName,
        sharerLastName: users.lastName,
      })
      .from(sessionMaterials)
      .innerJoin(courseMaterials, eq(sessionMaterials.materialId, courseMaterials.id))
      .innerJoin(users, eq(sessionMaterials.sharedBy, users.id))
      .where(eq(sessionMaterials.sessionId, sessionId))
      .orderBy(desc(sessionMaterials.sharedAt));

    return shared;
  }

  /**
   * Update the role of a session assistant (co_host / assistant).
   */
  async updateAssistantRole(
    sessionId: string,
    userId: string,
    role: 'co_host' | 'assistant',
    user: AuthenticatedUser,
  ) {
    if (!['co_host', 'assistant'].includes(role)) {
      throw new BadRequestException('Role must be "co_host" or "assistant"');
    }

    // Verify the user has access to this session
    await this.verifySessionAccess(sessionId, user);

    const [existing] = await db
      .select({ id: sessionAssistants.id })
      .from(sessionAssistants)
      .where(
        and(
          eq(sessionAssistants.sessionId, sessionId),
          eq(sessionAssistants.userId, userId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Session assistant not found');
    }

    const [updated] = await db
      .update(sessionAssistants)
      .set({ role })
      .where(eq(sessionAssistants.id, existing.id))
      .returning();

    return updated;
  }
}
