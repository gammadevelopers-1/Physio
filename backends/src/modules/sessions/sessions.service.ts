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
import { NELC_EVENT_TYPE } from '../../database/schema';

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    @Inject(ZOOM_SERVICE) private readonly zoomService: IZoomService,
    private readonly auditService: NelcAuditService,
    private readonly assistantsService: SessionAssistantsService,
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

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db
      .select()
      .from(sessions)
      .where(whereClause)
      .orderBy(desc(sessions.scheduledAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: count() })
      .from(sessions)
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
}
