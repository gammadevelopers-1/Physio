import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { db } from '../../database';
import {
  enrollments,
  attendance,
  sessions,
  courses,
  users,
  ATTENDANCE_STATUS,
} from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

@Injectable()
export class InstructorService {
  private readonly logger = new Logger(InstructorService.name);

  // ─── Role helpers ─────────────────────────────────────────

  private isAdmin(user: AuthenticatedUser): boolean {
    return (
      user.roles.includes('ADMIN') || user.roles.includes('SUPER_ADMIN')
    );
  }

  // ─── Students View ────────────────────────────────────────

  /**
   * GET /instructor/students
   * List all unique students across the instructor's courses.
   * - Instructor: students enrolled in their own courses only.
   * - Admin: all enrolled students across all courses.
   */
  async getStudents(user: AuthenticatedUser) {
    // Get the instructor's course IDs (or all courses for admin)
    const courseConditions = this.isAdmin(user)
      ? []
      : [eq(courses.instructorId, user.id)];

    const instructorCourses = await db
      .select({ id: courses.id })
      .from(courses)
      .where(
        courseConditions.length > 0
          ? and(...courseConditions)
          : undefined,
      );

    const courseIds = instructorCourses.map((c) => c.id);

    if (courseIds.length === 0) {
      return [];
    }

    // Get unique students with aggregated data
    const studentsData = await db
      .select({
        studentId: enrollments.studentId,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        totalEnrollments: sql<number>`COUNT(DISTINCT ${enrollments.courseId})`.as(
          'total_enrollments',
        ),
        averageProgress: sql<number>`ROUND(AVG(${enrollments.progress}))`.as(
          'average_progress',
        ),
        lastAccessedAt: sql<string>`MAX(${enrollments.lastAccessedAt})`.as(
          'last_accessed_at',
        ),
      })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.studentId, users.id))
      .where(inArray(enrollments.courseId, courseIds))
      .groupBy(
        enrollments.studentId,
        users.firstName,
        users.lastName,
        users.email,
      )
      .orderBy(users.firstName);

    return studentsData;
  }

  /**
   * GET /instructor/students/:id
   * Get detailed student information with enrollments, attendance summary,
   * and assessment scores.
   * - Instructor: only for students in their own courses.
   * - Admin: any student.
   */
  async getStudentDetail(
    studentId: string,
    user: AuthenticatedUser,
  ) {
    // Verify student exists
    const [student] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, studentId))
      .limit(1);

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Get the instructor's course IDs (or all for admin)
    const courseConditions = this.isAdmin(user)
      ? []
      : [eq(courses.instructorId, user.id)];

    const instructorCourses = await db
      .select({ id: courses.id })
      .from(courses)
      .where(
        courseConditions.length > 0
          ? and(...courseConditions)
          : undefined,
      );

    const courseIds = instructorCourses.map((c) => c.id);

    if (courseIds.length === 0) {
      throw new NotFoundException('Student not found');
    }

    // Get enrollments for this student in instructor's courses
    const studentEnrollments = await db
      .select({
        id: enrollments.id,
        courseId: enrollments.courseId,
        status: enrollments.status,
        progress: enrollments.progress,
        enrolledAt: enrollments.enrolledAt,
        completedAt: enrollments.completedAt,
        lastAccessedAt: enrollments.lastAccessedAt,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(
        and(
          eq(enrollments.studentId, studentId),
          inArray(enrollments.courseId, courseIds),
        ),
      );

    if (studentEnrollments.length === 0) {
      throw new NotFoundException('Student not found');
    }

    // Get attendance summary for this student in instructor's sessions
    const sessionIds = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(inArray(sessions.courseId, courseIds));

    const sIds = sessionIds.map((s) => s.id);

    let attendanceSummary = {
      totalSessions: 0,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      attendanceRate: 0,
    };

    if (sIds.length > 0) {
      const attendanceRecords = await db
        .select({
          status: attendance.status,
          count: sql<number>`COUNT(*)`.as('count'),
        })
        .from(attendance)
        .where(
          and(
            eq(attendance.studentId, studentId),
            inArray(attendance.sessionId, sIds),
          ),
        )
        .groupBy(attendance.status);

      let totalAttended = 0;
      for (const record of attendanceRecords) {
        const cnt = Number(record.count);
        switch (record.status) {
          case ATTENDANCE_STATUS.PRESENT:
            attendanceSummary.present = cnt;
            totalAttended += cnt;
            break;
          case ATTENDANCE_STATUS.ABSENT:
            attendanceSummary.absent = cnt;
            break;
          case ATTENDANCE_STATUS.LATE:
            attendanceSummary.late = cnt;
            totalAttended += cnt;
            break;
          case ATTENDANCE_STATUS.EXCUSED:
            attendanceSummary.excused = cnt;
            break;
        }
      }

      attendanceSummary.totalSessions =
        attendanceSummary.present +
        attendanceSummary.absent +
        attendanceSummary.late +
        attendanceSummary.excused;

      attendanceSummary.attendanceRate =
        attendanceSummary.totalSessions > 0
          ? Math.round(
              (totalAttended / attendanceSummary.totalSessions) * 100,
            )
          : 0;
    }

    // Assessment scores — placeholder (no assessments table yet)
    const assessmentScores: { assessmentId: string; title: string; score: number; maxScore: number }[] = [];

    return {
      ...student,
      enrollments: studentEnrollments,
      attendanceSummary,
      assessmentScores,
    };
  }

  /**
   * GET /instructor/at-risk
   * List students at risk based on:
   * 1. Attendance rate < 70%
   * 2. Assessment average < 60% (placeholder — no assessments table yet)
   * 3. No activity in the last 7 days
   * - Instructor: only students in their own courses.
   * - Admin: all students.
   */
  async getAtRiskStudents(user: AuthenticatedUser) {
    // Get the instructor's course IDs (or all for admin)
    const courseConditions = this.isAdmin(user)
      ? []
      : [eq(courses.instructorId, user.id)];

    const instructorCourses = await db
      .select({ id: courses.id })
      .from(courses)
      .where(
        courseConditions.length > 0
          ? and(...courseConditions)
          : undefined,
      );

    const courseIds = instructorCourses.map((c) => c.id);

    if (courseIds.length === 0) {
      return [];
    }

    // Get all unique student IDs enrolled in instructor's courses
    const enrolledStudents = await db
      .select({
        studentId: enrollments.studentId,
        lastAccessedAt: sql<string>`MAX(${enrollments.lastAccessedAt})`.as(
          'last_accessed_at',
        ),
      })
      .from(enrollments)
      .where(inArray(enrollments.courseId, courseIds))
      .groupBy(enrollments.studentId);

    if (enrolledStudents.length === 0) {
      return [];
    }

    const studentIds = enrolledStudents.map((s) => s.studentId);

    // Get all session IDs for instructor's courses
    const sessionIds = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(inArray(sessions.courseId, courseIds));

    const sIds = sessionIds.map((s) => s.id);

    // Get attendance data per student
    const attendanceData =
      sIds.length > 0
        ? await db
            .select({
              studentId: attendance.studentId,
              totalSessions: sql<number>`COUNT(*)`.as('total_sessions'),
              presentCount:
                sql<number>`SUM(CASE WHEN ${attendance.status} IN ('present', 'late') THEN 1 ELSE 0 END)`.as(
                  'present_count',
                ),
            })
            .from(attendance)
            .where(
              and(
                inArray(attendance.studentId, studentIds),
                inArray(attendance.sessionId, sIds),
              ),
            )
            .groupBy(attendance.studentId)
        : [];

    const attendanceMap = new Map(
      attendanceData.map((a) => [
        a.studentId,
        {
          totalSessions: Number(a.totalSessions),
          presentCount: Number(a.presentCount),
          rate:
            Number(a.totalSessions) > 0
              ? Math.round(
                  (Number(a.presentCount) / Number(a.totalSessions)) * 100,
                )
              : 0,
        },
      ]),
    );

    // Get student details
    const studentDetails = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(inArray(users.id, studentIds));

    const studentMap = new Map(studentDetails.map((s) => [s.id, s]));

    // Build last-access map
    const lastAccessMap = new Map(
      enrolledStudents.map((s) => [s.studentId, s.lastAccessedAt]),
    );

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Evaluate at-risk criteria for each student
    const atRiskStudents = [];

    for (const studentId of studentIds) {
      const student = studentMap.get(studentId);
      if (!student) continue;

      const attnData = attendanceMap.get(studentId);
      const lastAccess = lastAccessMap.get(studentId);

      const riskReasons: string[] = [];

      // Criterion 1: Attendance rate < 70%
      const attendanceRate = attnData?.rate ?? 0;
      if (attnData && attnData.totalSessions > 0 && attendanceRate < 70) {
        riskReasons.push(
          `Attendance rate ${attendanceRate}% (below 70%)`,
        );
      }

      // Criterion 2: Assessment average < 60% (placeholder)
      // No assessments table yet — will be added when assessments module is created

      // Criterion 3: No activity in last 7 days
      if (!lastAccess || new Date(lastAccess) < sevenDaysAgo) {
        riskReasons.push(
          lastAccess
            ? `Last activity on ${new Date(lastAccess).toISOString().split('T')[0]}`
            : 'No recent activity recorded',
        );
      }

      if (riskReasons.length > 0) {
        atRiskStudents.push({
          ...student,
          attendanceRate,
          lastAccessedAt: lastAccess || null,
          riskReasons,
        });
      }
    }

    return atRiskStudents;
  }
}
