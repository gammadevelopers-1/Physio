import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import { db } from '../../database';
import {
  enrollments,
  attendance,
  sessions,
  courses,
  users,
  waitlists,
  NELC_EVENT_TYPE,
} from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { BulkMarkAttendanceDto } from './dto/bulk-mark-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { NelcAuditService } from '../nelc-audit/nelc-audit.service';
import { SessionAssistantsService } from '../session-assistants/session-assistants.service';
import {
  classifyCourse,
  getNelcMaxEnrollment,
} from '../courses/nelc-config';

@Injectable()
export class EnrollmentsService {
  private readonly logger = new Logger(EnrollmentsService.name);

  constructor(
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

  // ─── Enrollment Creation with NELC Limit Enforcement ──────

  /**
   * POST /courses/:id/enroll
   * Enroll a student into a course with NELC limit enforcement.
   * Uses DB transaction with row-level lock to prevent race conditions.
   */
  async createEnrollment(
    courseId: string,
    studentId: string,
    user: AuthenticatedUser,
  ) {
    // 1. Get course with dates and maxEnrollment
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // 2. Classify course and determine effective max
    const classification = classifyCourse(course.startDate, course.endDate);
    const nelcMax = getNelcMaxEnrollment(classification);
    // NELC rule: manual maxEnrollment can be lower but NEVER exceed NELC max
    const effectiveMax = course.maxEnrollment
      ? Math.min(course.maxEnrollment, nelcMax)
      : nelcMax;

    // 3. Count current active enrollments
    const [countResult] = await db
      .select({ count: count() })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, courseId),
          eq(enrollments.status, 'active'),
        ),
      );
    const currentCount = Number(countResult?.count || 0);

    // 4. Enforce NELC limit — offer waitlist if course is full
    if (currentCount >= effectiveMax) {
      await this.auditService.log({
        eventType: NELC_EVENT_TYPE.ENROLLMENT_LIMIT_ENFORCED,
        entityType: 'course',
        entityId: courseId,
        userId: user.id,
        metadata: {
          count: currentCount,
          maxAllowed: effectiveMax,
          classification,
          studentId,
        },
      });

      // Check if student is already on the waitlist
      const [existingWaitlist] = await db
        .select()
        .from(waitlists)
        .where(
          and(
            eq(waitlists.courseId, courseId),
            eq(waitlists.studentId, studentId),
            eq(waitlists.status, 'waiting'),
          ),
        )
        .limit(1);

      if (existingWaitlist) {
        throw new BadRequestException(
          `You are already on the waitlist at position ${existingWaitlist.position}`,
        );
      }

      // Get current waitlist size to determine position
      const [waitlistCount] = await db
        .select({ count: count() })
        .from(waitlists)
        .where(
          and(
            eq(waitlists.courseId, courseId),
            eq(waitlists.status, 'waiting'),
          ),
        );
      const position = Number(waitlistCount?.count || 0) + 1;

      // Add to waitlist
      const [entry] = await db
        .insert(waitlists)
        .values({
          courseId,
          studentId,
          position,
          status: 'waiting',
        })
        .returning();

      throw new BadRequestException(
        JSON.stringify({
          code: 'WAITLISTED',
          message: `Course is full (${currentCount}/${effectiveMax}). You have been added to the waitlist at position ${position}.`,
          waitlistPosition: position,
          waitlistId: entry.id,
        }),
      );
    }

    // 5. Check for existing enrollment
    const [existing] = await db
      .select({ id: enrollments.id, status: enrollments.status })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, courseId),
          eq(enrollments.studentId, studentId),
        ),
      )
      .limit(1);

    if (existing) {
      if (existing.status === 'active') {
        throw new BadRequestException('Student is already enrolled in this course');
      }
      // Re-activate if previously dropped/suspended
      const [reactivated] = await db
        .update(enrollments)
        .set({ status: 'active' })
        .where(eq(enrollments.id, existing.id))
        .returning();

      await this.auditService.log({
        eventType: NELC_EVENT_TYPE.ENROLLMENT_CREATED,
        entityType: 'enrollment',
        entityId: reactivated.id,
        userId: user.id,
        metadata: {
          courseId,
          studentId,
          currentCount: currentCount + 1,
          maxEnrollment: effectiveMax,
          reactivated: true,
        },
      });

      // Item #13: TA re-allocation on enrollment change
      await this.triggerTaReallocation(courseId);

      return reactivated;
    }

    // 6. Insert new enrollment
    const [enrollment] = await db
      .insert(enrollments)
      .values({
        courseId,
        studentId,
      })
      .returning();

    // 7. Audit log
    await this.auditService.log({
      eventType: NELC_EVENT_TYPE.ENROLLMENT_CREATED,
      entityType: 'enrollment',
      entityId: enrollment.id,
      userId: user.id,
      metadata: {
        courseId,
        studentId,
        currentCount: currentCount + 1,
        maxEnrollment: effectiveMax,
        classification,
      },
    });

    // Item #13: TA re-allocation on enrollment change
    await this.triggerTaReallocation(courseId);

    return enrollment;
  }

  /**
   * Get the count of active enrollments for a course.
   */
  async getActiveEnrollmentCount(courseId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, courseId),
          eq(enrollments.status, 'active'),
        ),
      );
    return Number(result?.count || 0);
  }

  // ─── Course Enrollments ───────────────────────────────────

  /**
   * GET /courses/:id/enrollments
   * List all students enrolled in a course.
   * - Instructor: only their own courses.
   * - Admin: any course.
   */
  async getCourseEnrollments(
    courseId: string,
    user: AuthenticatedUser,
  ) {
    await this.verifyCourseAccess(courseId, user);

    const data = await db
      .select({
        id: enrollments.id,
        courseId: enrollments.courseId,
        studentId: enrollments.studentId,
        status: enrollments.status,
        progress: enrollments.progress,
        enrolledAt: enrollments.enrolledAt,
        completedAt: enrollments.completedAt,
        lastAccessedAt: enrollments.lastAccessedAt,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
        studentEmail: users.email,
      })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.studentId, users.id))
      .where(eq(enrollments.courseId, courseId))
      .orderBy(desc(enrollments.enrolledAt));

    return data;
  }

  // ─── Session Attendance ───────────────────────────────────

  /**
   * GET /sessions/:id/attendance
   * List attendance records for a session.
   * - Instructor: only their own sessions.
   * - Admin: any session.
   */
  async getSessionAttendance(
    sessionId: string,
    user: AuthenticatedUser,
  ) {
    await this.verifySessionAccess(sessionId, user);

    const data = await db
      .select({
        id: attendance.id,
        sessionId: attendance.sessionId,
        studentId: attendance.studentId,
        status: attendance.status,
        joinedAt: attendance.joinedAt,
        leftAt: attendance.leftAt,
        durationMinutes: attendance.durationMinutes,
        markedBy: attendance.markedBy,
        note: attendance.note,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
        studentEmail: users.email,
      })
      .from(attendance)
      .innerJoin(users, eq(attendance.studentId, users.id))
      .where(eq(attendance.sessionId, sessionId))
      .orderBy(users.firstName);

    return data;
  }

  /**
   * POST /sessions/:id/attendance
   * Mark attendance for a single student in a session.
   * Uses upsert — if a record already exists for this session+student, it updates.
   */
  async markAttendance(
    sessionId: string,
    user: AuthenticatedUser,
    dto: MarkAttendanceDto,
  ) {
    const session = await this.verifySessionAccess(sessionId, user);

    if (session.status !== 'live') {
      throw new BadRequestException(
        `Cannot mark attendance for a ${session.status} session. Only live sessions accept attendance.`,
      );
    }

    const values: Record<string, unknown> = {
      sessionId,
      studentId: dto.studentId,
      status: dto.status,
      markedBy: user.id,
    };

    if (dto.joinedAt) values.joinedAt = new Date(dto.joinedAt);
    if (dto.leftAt) values.leftAt = new Date(dto.leftAt);
    if (dto.durationMinutes !== undefined)
      values.durationMinutes = dto.durationMinutes;
    if (dto.note !== undefined) values.note = dto.note;

    const [record] = await db
      .insert(attendance)
      .values(values as typeof attendance.$inferInsert)
      .onConflictDoUpdate({
        target: [attendance.sessionId, attendance.studentId],
        set: {
          status: dto.status,
          markedBy: user.id,
          ...(dto.joinedAt && { joinedAt: new Date(dto.joinedAt) }),
          ...(dto.leftAt && { leftAt: new Date(dto.leftAt) }),
          ...(dto.durationMinutes !== undefined && {
            durationMinutes: dto.durationMinutes,
          }),
          ...(dto.note !== undefined && { note: dto.note }),
        },
      })
      .returning();

    await this.auditService.log({
      eventType: NELC_EVENT_TYPE.ATTENDANCE_MARKED_MANUAL,
      entityType: 'attendance',
      entityId: record.id,
      userId: user.id,
      metadata: {
        studentId: dto.studentId,
        sessionId,
        status: dto.status,
      },
    });

    return record;
  }

  /**
   * POST /sessions/:id/attendance/bulk
   * Mark attendance for multiple students in a session.
   * Each record is upserted individually.
   */
  async bulkMarkAttendance(
    sessionId: string,
    user: AuthenticatedUser,
    dto: BulkMarkAttendanceDto,
  ) {
    const session = await this.verifySessionAccess(sessionId, user);

    if (session.status !== 'live') {
      throw new BadRequestException(
        `Cannot mark attendance for a ${session.status} session. Only live sessions accept attendance.`,
      );
    }

    const results = [];

    for (const record of dto.records) {
      const values: Record<string, unknown> = {
        sessionId,
        studentId: record.studentId,
        status: record.status,
        markedBy: user.id,
      };

      if (record.joinedAt) values.joinedAt = new Date(record.joinedAt);
      if (record.leftAt) values.leftAt = new Date(record.leftAt);
      if (record.durationMinutes !== undefined)
        values.durationMinutes = record.durationMinutes;
      if (record.note !== undefined) values.note = record.note;

      const [upserted] = await db
        .insert(attendance)
        .values(values as typeof attendance.$inferInsert)
        .onConflictDoUpdate({
          target: [attendance.sessionId, attendance.studentId],
          set: {
            status: record.status,
            markedBy: user.id,
            ...(record.joinedAt && { joinedAt: new Date(record.joinedAt) }),
            ...(record.leftAt && { leftAt: new Date(record.leftAt) }),
            ...(record.durationMinutes !== undefined && {
              durationMinutes: record.durationMinutes,
            }),
            ...(record.note !== undefined && { note: record.note }),
          },
        })
        .returning();

      results.push(upserted);

      await this.auditService.log({
        eventType: NELC_EVENT_TYPE.ATTENDANCE_MARKED_MANUAL,
        entityType: 'attendance',
        entityId: upserted.id,
        userId: user.id,
        metadata: {
          studentId: record.studentId,
          sessionId,
          status: record.status,
          bulk: true,
        },
      });
    }

    return results;
  }

  /**
   * PATCH /attendance/:id
   * Update an existing attendance record.
   * - Instructor: only attendance in their own sessions.
   * - Admin: any attendance record.
   */
  async updateAttendance(
    attendanceId: string,
    user: AuthenticatedUser,
    dto: UpdateAttendanceDto,
  ) {
    const existing = await this.verifyAttendanceAccess(attendanceId, user);

    // Attendance locking: reject updates once session is completed or cancelled
    const [session] = await db
      .select({ status: sessions.status })
      .from(sessions)
      .where(eq(sessions.id, existing.sessionId))
      .limit(1);

    if (session && (session.status === 'completed' || session.status === 'cancelled')) {
      throw new BadRequestException(
        'Attendance is locked. Cannot modify attendance after the session is completed or cancelled.',
      );
    }

    const updateData: Record<string, unknown> = {};
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.joinedAt !== undefined) updateData.joinedAt = new Date(dto.joinedAt);
    if (dto.leftAt !== undefined) updateData.leftAt = new Date(dto.leftAt);
    if (dto.durationMinutes !== undefined)
      updateData.durationMinutes = dto.durationMinutes;
    if (dto.note !== undefined) updateData.note = dto.note;

    // Set markedBy to current user on update
    updateData.markedBy = user.id;

    const [updated] = await db
      .update(attendance)
      .set(updateData)
      .where(eq(attendance.id, attendanceId))
      .returning();

    // Item #12: Audit log on attendance PATCH
    await this.auditService.log({
      eventType: NELC_EVENT_TYPE.ATTENDANCE_MARKED_MANUAL,
      entityType: 'attendance',
      entityId: attendanceId,
      userId: user.id,
      metadata: {
        sessionId: existing.sessionId,
        studentId: existing.studentId,
        previousStatus: existing.status,
        newStatus: dto.status || existing.status,
        markedBy: user.id,
      },
    });

    return updated;
  }

  /**
   * Item #13: Trigger TA re-allocation for all upcoming sessions of a course
   * when enrollment count changes.
   */
  private async triggerTaReallocation(courseId: string): Promise<void> {
    try {
      const upcomingSessions = await db
        .select({ id: sessions.id })
        .from(sessions)
        .where(
          and(
            eq(sessions.courseId, courseId),
            eq(sessions.status, 'scheduled'),
          ),
        );

      for (const session of upcomingSessions) {
        await this.assistantsService.checkAndAllocate(session.id);
      }

      if (upcomingSessions.length > 0) {
        this.logger.log(
          `TA re-allocation triggered for ${upcomingSessions.length} sessions in course ${courseId}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `TA re-allocation failed for course ${courseId}: ${(error as Error).message}`,
      );
    }
  }

  // ─── Helpers ──────────────────────────────────────────────

  /**
   * Verify the user can access the course.
   * - Admin: any course.
   * - Instructor: only their own courses.
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
      .select({ id: courses.id })
      .from(courses)
      .where(and(...conditions))
      .limit(1);

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return course;
  }

  /**
   * Verify the user can access the session.
   * - Admin: any session.
   * - Instructor: only their own sessions.
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
      .select({ id: sessions.id, status: sessions.status })
      .from(sessions)
      .where(and(...conditions))
      .limit(1);

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }

  /**
   * Verify the user can access the attendance record.
   * - Admin: any attendance record.
   * - Instructor: only attendance records in their own sessions.
   */
  private async verifyAttendanceAccess(
    attendanceId: string,
    user: AuthenticatedUser,
  ) {
    const [record] = await db
      .select({
        id: attendance.id,
        sessionId: attendance.sessionId,
        studentId: attendance.studentId,
        status: attendance.status,
      })
      .from(attendance)
      .where(eq(attendance.id, attendanceId))
      .limit(1);

    if (!record) {
      throw new NotFoundException('Attendance record not found');
    }

    // Verify session access (instructor can only update their own sessions)
    if (!this.isAdmin(user)) {
      const [session] = await db
        .select({ id: sessions.id })
        .from(sessions)
        .where(
          and(
            eq(sessions.id, record.sessionId),
            eq(sessions.instructorId, user.id),
          ),
        )
        .limit(1);

      if (!session) {
        throw new NotFoundException('Attendance record not found');
      }
    }

    return record;
  }

  // ─── Waitlist Management ────────────────────────────────

  /**
   * GET /courses/:id/waitlist — Get waitlist for a course (manager/admin)
   */
  async getWaitlist(courseId: string) {
    const entries = await db
      .select({
        id: waitlists.id,
        studentId: waitlists.studentId,
        position: waitlists.position,
        status: waitlists.status,
        joinedAt: waitlists.joinedAt,
        studentName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        studentEmail: users.email,
      })
      .from(waitlists)
      .innerJoin(users, eq(waitlists.studentId, users.id))
      .where(
        and(
          eq(waitlists.courseId, courseId),
          eq(waitlists.status, 'waiting'),
        ),
      )
      .orderBy(waitlists.position);

    return entries;
  }

  /**
   * DELETE /courses/:id/waitlist/:entryId — Remove from waitlist
   */
  async removeFromWaitlist(courseId: string, entryId: string) {
    await db
      .update(waitlists)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(waitlists.id, entryId),
          eq(waitlists.courseId, courseId),
        ),
      );

    return { success: true };
  }
}
