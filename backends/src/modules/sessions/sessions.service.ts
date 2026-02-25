import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, and, desc, asc, count, sql, gte, lte } from 'drizzle-orm';
import { db } from '../../database';
import {
  sessions,
  courses,
  users,
  enrollments,
  attendanceLogs,
  SESSION_STATUS,
  SESSION_TYPE,
} from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { CancelSessionDto } from './dto/cancel-session.dto';
import { ZOOM_SERVICE, IZoomService } from '../zoom/zoom.interface';
import { NelcAuditService } from '../nelc-audit/nelc-audit.service';
import { SessionAssistantsService } from '../session-assistants/session-assistants.service';
import { AuditLogService } from '../audit-logs/audit-logs.service';
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
  ) {}

  // ─── Role helpers ─────────────────────────────────────────

  private isAdmin(user: AuthenticatedUser): boolean {
    return (
      user.roles.includes('ADMIN') ||
      user.roles.includes('SUPER_ADMIN') ||
      user.roles.includes('MANAGER')
    );
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
        const zoomMeeting = await this.zoomService.createMeeting({
          topic: dto.title,
          startTime: new Date(dto.scheduledAt),
          durationMinutes: dto.durationMinutes || 60,
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

    if (this.isAdmin(user)) {
      // Admin: verify course exists (any course)
      const [course] = await db
        .select({ id: courses.id, instructorId: courses.instructorId })
        .from(courses)
        .where(eq(courses.id, dto.courseId))
        .limit(1);

      if (!course) {
        throw new NotFoundException('Course not found');
      }

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
        })
        .returning();

      // Auto-allocate assistants based on NELC rules
      await this.assistantsService.checkAndAllocate(session.id).catch((err) => {
        this.logger.warn('Auto-allocation failed for session', err);
      });

      // Audit log
      await this.auditLogService.log({
        entityType: 'session',
        entityId: session.id,
        action: 'session.created',
        performedBy: user.id,
        metadata: { courseId: dto.courseId, scheduledAt: dto.scheduledAt },
      }).catch(() => {});

      return session;
    }

    // Instructor: verify course belongs to them
    const [course] = await db
      .select({ id: courses.id })
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
      })
      .returning();

    // Auto-allocate assistants based on NELC rules
    await this.assistantsService.checkAndAllocate(session.id).catch((err) => {
      this.logger.warn('Auto-allocation failed for session', err);
    });

    // Audit log
    await this.auditLogService.log({
      entityType: 'session',
      entityId: session.id,
      action: 'session.created',
      performedBy: user.id,
      metadata: { courseId: dto.courseId, scheduledAt: dto.scheduledAt },
    }).catch(() => {});

    return session;
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

    // Instructor: scope to own sessions only
    if (!this.isAdmin(user)) {
      conditions.push(eq(sessions.instructorId, user.id));
    }

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

    if (!this.isAdmin(user)) {
      conditions.push(eq(sessions.instructorId, user.id));
    }

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

    if (!this.isAdmin(user)) {
      conditions.push(eq(sessions.instructorId, user.id));
    }

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
    if (!this.isAdmin(user)) {
      conditions.push(eq(sessions.instructorId, user.id));
    }

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
        this.logger.warn(`Failed to sync Zoom meeting ${updated.meetingId} on session update`, error);
      }
    }

    return updated;
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

    return { ...updated, zoomStartUrl };
  }

  /**
   * End a session — sets status=completed and actualEndedAt=NOW()
   * Cannot end a non-live session.
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
        status: SESSION_STATUS.COMPLETED,
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

    return { ...updated, zoomEndedSuccessfully, zoomErrorMessage };
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
        this.logger.warn(`Failed to reschedule Zoom meeting ${session.meetingId}`, error);
      }
    }

    await this.auditLogService.log({
      entityType: 'session',
      entityId: updated.id,
      action: 'session.rescheduled',
      performedBy: user.id,
      metadata: { newDate, newDuration, oldDate: session.scheduledAt },
    }).catch(() => {});

    return updated;
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
          sql`${sessions.status} IN ('scheduled', 'live', 'completed')`,
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
          sql`${sessions.status} IN ('scheduled', 'live', 'completed')`,
        ),
      )
      .orderBy(asc(sessions.scheduledAt));

    return rows;
  }

  // ─── Helpers ────────────────────────────────────────────────

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
    if (!this.isAdmin(user)) {
      conditions.push(eq(sessions.instructorId, user.id));
    }

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
}
