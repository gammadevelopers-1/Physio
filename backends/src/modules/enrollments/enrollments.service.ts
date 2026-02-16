import {
  Injectable,
  NotFoundException,
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
} from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { BulkMarkAttendanceDto } from './dto/bulk-mark-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

@Injectable()
export class EnrollmentsService {
  private readonly logger = new Logger(EnrollmentsService.name);

  // ─── Role helpers ─────────────────────────────────────────

  private isAdmin(user: AuthenticatedUser): boolean {
    return (
      user.roles.includes('ADMIN') || user.roles.includes('SUPER_ADMIN')
    );
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
    await this.verifySessionAccess(sessionId, user);

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
    await this.verifySessionAccess(sessionId, user);

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

    return updated;
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
      .select({ id: sessions.id })
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
}
