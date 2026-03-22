import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, and, desc, asc, count, sql, gte, lte, inArray, or } from 'drizzle-orm';
import { db } from '../../database';
import {
  courses,
  sessions,
  attendance,
  enrollments,
  assessments,
  submissions,
  certificateRequests,
  users,
  scheduledReports,
  courseAssistants,
} from '../../database/schema';
import { courseMaterials } from '../../database/schema/course-materials';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { isGlobalAdmin, isManager } from '../../common/role-helpers';
import { NelcComplianceService } from '../nelc-compliance/nelc-compliance.service';
import { AuditLogService } from '../audit-logs/audit-logs.service';

type ReportFormat = 'csv' | 'pdf' | 'xlsx';

interface ReportMetadata {
  instructorName?: string;
  filters?: string;
}

interface ReportResult {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

const CONTENT_TYPES: Record<ReportFormat, string> = {
  csv: 'text/csv',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly nelcComplianceService: NelcComplianceService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // ─── Role helpers ─────────────────────────────────────────

  private addCourseOwnershipCondition(
    conditions: any[],
    user: AuthenticatedUser,
  ): void {
    if (isGlobalAdmin(user)) {
      // No filter
    } else if (isManager(user)) {
      conditions.push(or(eq(courses.managerId, user.id), sql`${courses.managerId} IS NULL`)!);
    } else {
      conditions.push(eq(courses.instructorId, user.id));
    }
  }

  private validateFormat(format?: string): ReportFormat {
    const f = (format || 'csv').toLowerCase();
    if (!['csv', 'pdf', 'xlsx'].includes(f)) {
      throw new BadRequestException(
        'Format must be one of: csv, pdf, xlsx',
      );
    }
    return f as ReportFormat;
  }

  /**
   * Fetch the instructor's full name for report metadata.
   */
  private async getInstructorName(userId: string): Promise<string> {
    const [instructor] = await db
      .select({ firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return `${instructor?.firstName || ''} ${instructor?.lastName || ''}`.trim() || 'Unknown';
  }

  /**
   * Resolve a course name by ID for filter descriptions.
   */
  private async getCourseName(courseId: string): Promise<string> {
    const [course] = await db
      .select({ title: courses.title })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);
    return course?.title || courseId;
  }

  // ═══════════════════════════════════════════════════════════
  // ─── 1. Attendance Report ─────────────────────────────────
  // Columns: Student Name, Email, Session Date, Session, Status, Total Attendance %
  // ═══════════════════════════════════════════════════════════

  async generateAttendanceReport(
    user: AuthenticatedUser,
    params: {
      courseId?: string;
      sessionId?: string;
      format?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ): Promise<ReportResult> {
    const format = this.validateFormat(params.format);
    const courseIds = await this.resolveCourseIds(user, params.courseId);
    const instructorName = await this.getInstructorName(user.id);

    // Build filter description
    const filterParts: string[] = [];
    if (params.courseId) {
      filterParts.push(`Course: ${await this.getCourseName(params.courseId)}`);
    } else {
      filterParts.push('All Courses');
    }
    if (params.dateFrom) filterParts.push(`From: ${params.dateFrom}`);
    if (params.dateTo) filterParts.push(`To: ${params.dateTo}`);

    const metadata: ReportMetadata = {
      instructorName,
      filters: filterParts.join(', '),
    };

    const headers = [
      'RegistrationClassificationNumber',
      'Student Name',
      'Email',
      'Session Date',
      'Session',
      'Status',
      'Join Time',
      'Leave Time',
      'Total Minutes',
      'Total Attendance %',
      'Completion Status',
    ];

    if (courseIds.length === 0) {
      return this.formatReport('Attendance Report', headers, [], format, metadata);
    }

    // Build session filter conditions (with optional date range and sessionId)
    const sessionConditions: any[] = [
      inArray(sessions.courseId, courseIds),
    ];
    if (params.sessionId) {
      sessionConditions.push(eq(sessions.id, params.sessionId));
    }
    if (params.dateFrom) {
      sessionConditions.push(
        gte(sessions.scheduledAt, new Date(params.dateFrom)),
      );
    }
    if (params.dateTo) {
      sessionConditions.push(
        lte(sessions.scheduledAt, new Date(params.dateTo)),
      );
    }

    // Get instructor IDs for these courses so we can exclude them from attendance
    const courseInstructors = await db
      .select({ id: courses.id, instructorId: courses.instructorId })
      .from(courses)
      .where(inArray(courses.id, courseIds));
    const instructorIds = new Set(
      courseInstructors.map((c) => c.instructorId).filter(Boolean),
    );

    // Get attendance data (filtered by date range), excluding instructor/host
    const data = await db
      .select({
        studentId: attendance.studentId,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
        studentEmail: users.email,
        studentScfhsNumber: users.scfhsNumber,
        courseId: sessions.courseId,
        sessionDate: sessions.scheduledAt,
        sessionTitle: sessions.title,
        status: attendance.status,
        joinedAt: attendance.joinedAt,
        leftAt: attendance.leftAt,
        durationMinutes: attendance.durationMinutes,
      })
      .from(attendance)
      .innerJoin(sessions, eq(attendance.sessionId, sessions.id))
      .innerJoin(users, eq(attendance.studentId, users.id))
      .where(and(...sessionConditions))
      .orderBy(users.lastName, sessions.scheduledAt);

    // Get TA user IDs to exclude from attendance
    const taRecords = await db
      .select({ userId: courseAssistants.userId })
      .from(courseAssistants)
      .where(
        and(
          inArray(courseAssistants.courseId, courseIds),
          sql`${courseAssistants.status} IN ('approved', 'pre_assigned')`,
        ),
      );
    const taIds = new Set(taRecords.map((t) => t.userId));

    // Filter out instructor/host and TAs from attendance data
    const excludeIds = new Set([...instructorIds, ...taIds]);
    const filteredData = excludeIds.size > 0
      ? data.filter((row) => !excludeIds.has(row.studentId))
      : data;

    // Compute total attendance % per student (across ALL sessions, not date-filtered)
    const allCourseSessions = await db
      .select({ id: sessions.id, courseId: sessions.courseId })
      .from(sessions)
      .where(inArray(sessions.courseId, courseIds));

    const totalSessionsPerCourse = new Map<string, number>();
    for (const s of allCourseSessions) {
      totalSessionsPerCourse.set(
        s.courseId,
        (totalSessionsPerCourse.get(s.courseId) || 0) + 1,
      );
    }

    // Count present+late per student per course (from ALL attendance, unfiltered)
    const attendanceCounts = await db
      .select({
        studentId: attendance.studentId,
        courseId: sessions.courseId,
        attendedCount: count(),
      })
      .from(attendance)
      .innerJoin(sessions, eq(attendance.sessionId, sessions.id))
      .where(
        and(
          inArray(sessions.courseId, courseIds),
          sql`${attendance.status} IN ('present', 'late')`,
        ),
      )
      .groupBy(attendance.studentId, sessions.courseId);

    const attendancePctMap = new Map<string, string>();
    for (const ac of attendanceCounts) {
      const total = totalSessionsPerCourse.get(ac.courseId) || 1;
      const pct = ((Number(ac.attendedCount) / total) * 100).toFixed(2);
      attendancePctMap.set(`${ac.studentId}:${ac.courseId}`, `${pct}%`);
    }

    // Build rows from existing attendance records
    const rows = filteredData.map((row) => {
      const pct = attendancePctMap.get(`${row.studentId}:${row.courseId}`) || '0.00%';
      const pctNum = parseFloat(pct);
      const completionStatus =
        row.status === 'present' || row.status === 'late'
          ? pctNum >= 75 ? 'Completed' : 'In Progress'
          : 'Incomplete';

      return [
        row.studentScfhsNumber || '',
        `${row.studentFirstName || ''} ${row.studentLastName || ''}`.trim(),
        row.studentEmail || '',
        this.formatDate(row.sessionDate),
        row.sessionTitle || '',
        row.status || '',
        row.joinedAt ? this.formatDateTime(row.joinedAt) : '',
        row.leftAt ? this.formatDateTime(row.leftAt) : '',
        row.durationMinutes != null ? String(row.durationMinutes) : '',
        pct,
        completionStatus,
      ];
    });

    // Include enrolled students who have NO attendance record (implicit absent)
    const filteredSessions = await db
      .select({ id: sessions.id, courseId: sessions.courseId, title: sessions.title, scheduledAt: sessions.scheduledAt })
      .from(sessions)
      .where(and(...sessionConditions));

    for (const sess of filteredSessions) {
      // Get enrolled students for this course
      const enrolledStudents = await db
        .select({
          studentId: enrollments.studentId,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          scfhsNumber: users.scfhsNumber,
        })
        .from(enrollments)
        .innerJoin(users, eq(enrollments.studentId, users.id))
        .where(
          and(
            eq(enrollments.courseId, sess.courseId),
            sql`${enrollments.status} IN ('active', 'completed')`,
          ),
        );

      // Find students who already have an attendance record for this session
      const existingStudentIds = new Set(
        filteredData
          .filter((r) => r.sessionDate?.getTime() === sess.scheduledAt?.getTime() && r.courseId === sess.courseId)
          .map((r) => r.studentId),
      );

      for (const student of enrolledStudents) {
        if (existingStudentIds.has(student.studentId)) continue;
        if (excludeIds.has(student.studentId)) continue;

        const pct = attendancePctMap.get(`${student.studentId}:${sess.courseId}`) || '0.00%';
        rows.push([
          student.scfhsNumber || '',
          `${student.firstName || ''} ${student.lastName || ''}`.trim(),
          student.email || '',
          this.formatDate(sess.scheduledAt),
          sess.title || '',
          'absent',
          '',
          '',
          '',
          pct,
          'Incomplete',
        ]);
      }
    }

    return this.formatReport('Attendance Report', headers, rows, format, metadata);
  }

  // ═══════════════════════════════════════════════════════════
  // ─── 2. Gradebook Report ──────────────────────────────────
  // Columns: Student Name, Email, [Assessment Titles...], Total Score, Max Possible, Percentage, Pass/Fail
  // ═══════════════════════════════════════════════════════════

  async generateGradebookReport(
    user: AuthenticatedUser,
    params: { courseId?: string; format?: string },
  ): Promise<ReportResult> {
    const format = this.validateFormat(params.format);

    if (!params.courseId) {
      throw new BadRequestException(
        'courseId is required for the gradebook report',
      );
    }

    await this.verifyCourseAccess(params.courseId, user);
    const instructorName = await this.getInstructorName(user.id);
    const courseName = await this.getCourseName(params.courseId);

    const metadata: ReportMetadata = {
      instructorName,
      filters: `Course: ${courseName}`,
    };

    // Get all assessments for this course
    const courseAssessments = await db
      .select({
        id: assessments.id,
        title: assessments.title,
        totalMarks: assessments.totalMarks,
        passingMarks: assessments.passingMarks,
      })
      .from(assessments)
      .where(eq(assessments.courseId, params.courseId))
      .orderBy(asc(assessments.createdAt));

    // Get all enrolled students
    const enrolled = await db
      .select({
        studentId: enrollments.studentId,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.studentId, users.id))
      .where(eq(enrollments.courseId, params.courseId))
      .orderBy(users.lastName);

    // Get all graded submissions for this course's assessments
    const allSubs = await db
      .select({
        studentId: submissions.studentId,
        assessmentId: submissions.assessmentId,
        score: submissions.score,
      })
      .from(submissions)
      .innerJoin(assessments, eq(submissions.assessmentId, assessments.id))
      .where(
        and(
          eq(assessments.courseId, params.courseId),
          eq(submissions.status, 'graded'),
        ),
      );

    // Best score per student per assessment
    const scoreMap = new Map<string, Map<string, number>>();
    for (const sub of allSubs) {
      if (!scoreMap.has(sub.studentId)) {
        scoreMap.set(sub.studentId, new Map());
      }
      const studentScores = scoreMap.get(sub.studentId)!;
      const existing = studentScores.get(sub.assessmentId) ?? -1;
      if ((sub.score ?? 0) > existing) {
        studentScores.set(sub.assessmentId, sub.score ?? 0);
      }
    }

    // Build headers (dynamic — one column per assessment)
    const headers = [
      'Student Name',
      'Email',
      ...courseAssessments.map((a) => a.title),
      'Total Score',
      'Max Possible',
      'Percentage',
      'Pass/Fail',
    ];

    const maxPossible = courseAssessments.reduce(
      (sum, a) => sum + a.totalMarks,
      0,
    );
    const totalPassingMarks = courseAssessments.reduce(
      (sum, a) => sum + (a.passingMarks ?? 0),
      0,
    );

    // Build rows (one per student)
    const rows = enrolled.map((student) => {
      const studentScores =
        scoreMap.get(student.studentId) || new Map<string, number>();
      let totalScore = 0;

      const assessmentCells = courseAssessments.map((a) => {
        const score = studentScores.get(a.id) ?? 0;
        totalScore += score;
        return `${score}/${a.totalMarks}`;
      });

      const pct =
        maxPossible > 0
          ? ((totalScore / maxPossible) * 100).toFixed(2)
          : '0.00';

      const passFail = totalScore >= totalPassingMarks ? 'Pass' : 'Fail';

      return [
        `${student.firstName || ''} ${student.lastName || ''}`.trim(),
        student.email || '',
        ...assessmentCells,
        String(totalScore),
        String(maxPossible),
        `${pct}%`,
        passFail,
      ];
    });

    return this.formatReport('Gradebook Report', headers, rows, format, metadata);
  }

  // ═══════════════════════════════════════════════════════════
  // ─── 3. Enrollment Report ─────────────────────────────────
  // Columns: Student Name, Email, Enrolled Date, Status, Progress, Last Activity
  // ═══════════════════════════════════════════════════════════

  async generateEnrollmentReport(
    user: AuthenticatedUser,
    params: { courseId?: string; format?: string },
  ): Promise<ReportResult> {
    const format = this.validateFormat(params.format);
    const courseIds = await this.resolveCourseIds(user, params.courseId);
    const instructorName = await this.getInstructorName(user.id);

    const metadata: ReportMetadata = {
      instructorName,
      filters: params.courseId
        ? `Course: ${await this.getCourseName(params.courseId)}`
        : 'All Courses',
    };

    const headers = [
      'Student Name',
      'Email',
      'Enrolled Date',
      'Status',
      'Progress',
      'Last Activity',
    ];

    if (courseIds.length === 0) {
      return this.formatReport('Enrollment Report', headers, [], format, metadata);
    }

    const data = await db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        enrolledAt: enrollments.enrolledAt,
        status: enrollments.status,
        progress: enrollments.progress,
        lastAccessedAt: enrollments.lastAccessedAt,
      })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.studentId, users.id))
      .where(inArray(enrollments.courseId, courseIds))
      .orderBy(desc(enrollments.enrolledAt));

    const rows = data.map((row) => [
      `${row.firstName || ''} ${row.lastName || ''}`.trim(),
      row.email || '',
      this.formatDate(row.enrolledAt),
      row.status || '',
      `${row.progress}%`,
      this.formatDate(row.lastAccessedAt),
    ]);

    return this.formatReport('Enrollment Report', headers, rows, format, metadata);
  }

  // ═══════════════════════════════════════════════════════════
  // ─── 4. Completion Report ─────────────────────────────────
  // Columns: Student Name, Email, Completed Date, Certificate Status
  // ═══════════════════════════════════════════════════════════

  async generateCompletionReport(
    user: AuthenticatedUser,
    params: { courseId?: string; format?: string },
  ): Promise<ReportResult> {
    const format = this.validateFormat(params.format);
    const courseIds = await this.resolveCourseIds(user, params.courseId);
    const instructorName = await this.getInstructorName(user.id);

    const metadata: ReportMetadata = {
      instructorName,
      filters: params.courseId
        ? `Course: ${await this.getCourseName(params.courseId)}`
        : 'All Courses',
    };

    const headers = [
      'Student Name',
      'Email',
      'Completed Date',
      'Certificate Status',
    ];

    if (courseIds.length === 0) {
      return this.formatReport('Completion Report', headers, [], format, metadata);
    }

    // Get completed enrollments with certificate request status (LEFT JOIN)
    const data = await db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        completedAt: enrollments.completedAt,
        certStatus: certificateRequests.status,
      })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.studentId, users.id))
      .leftJoin(
        certificateRequests,
        and(
          eq(certificateRequests.courseId, enrollments.courseId),
          eq(certificateRequests.studentId, enrollments.studentId),
        ),
      )
      .where(
        and(
          inArray(enrollments.courseId, courseIds),
          sql`(${enrollments.status} = 'completed' OR ${enrollments.progress} = 100)`,
        ),
      )
      .orderBy(desc(enrollments.completedAt));

    const rows = data.map((row) => [
      `${row.firstName || ''} ${row.lastName || ''}`.trim(),
      row.email || '',
      this.formatDate(row.completedAt),
      row.certStatus || 'No Request',
    ]);

    return this.formatReport('Completion Report', headers, rows, format, metadata);
  }

  // ═══════════════════════════════════════════════════════════
  // ─── Satisfaction Report ──────────────────────────────────
  // ═══════════════════════════════════════════════════════════

  async generateSatisfactionReport(
    user: AuthenticatedUser,
    courseId?: string,
    format?: string,
  ): Promise<ReportResult> {
    const fmt = this.validateFormat(format);
    const courseIds = await this.resolveCourseIds(user, courseId);
    if (courseIds.length === 0) {
      return this.formatReport('Satisfaction Report', [], [], fmt);
    }

    const metadata = await this.buildMetadata(user, courseId);

    // Satisfaction = per-course completion rate, attendance rate, and avg assessment score
    const courseRows = await db
      .select({
        courseId: courses.id,
        title: courses.title,
      })
      .from(courses)
      .where(inArray(courses.id, courseIds));

    const headers = [
      'Course',
      'Total Enrolled',
      'Completed',
      'Completion Rate',
      'Avg Attendance',
      'Avg Assessment Score',
    ];

    const rows: string[][] = [];

    for (const course of courseRows) {
      // Enrollment stats
      const [enrollStats] = await db
        .select({
          total: count(),
          completed: sql<number>`COUNT(CASE WHEN ${enrollments.status} = 'completed' OR ${enrollments.progress} = 100 THEN 1 END)`,
        })
        .from(enrollments)
        .where(eq(enrollments.courseId, course.courseId));

      const totalEnrolled = Number(enrollStats?.total || 0);
      const completedCount = Number(enrollStats?.completed || 0);
      const completionRate = totalEnrolled > 0 ? Math.round((completedCount / totalEnrolled) * 100) : 0;

      // Attendance rate
      const [attStats] = await db
        .select({
          total: count(),
          present: sql<number>`COUNT(CASE WHEN ${attendance.status} IN ('present', 'late') THEN 1 END)`,
        })
        .from(attendance)
        .innerJoin(sessions, eq(attendance.sessionId, sessions.id))
        .where(eq(sessions.courseId, course.courseId));

      const totalAtt = Number(attStats?.total || 0);
      const presentAtt = Number(attStats?.present || 0);
      const attRate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0;

      // Avg assessment score
      const [scoreStats] = await db
        .select({
          avgScore: sql<number>`ROUND(AVG(${submissions.score}::numeric), 1)`,
        })
        .from(submissions)
        .innerJoin(assessments, eq(submissions.assessmentId, assessments.id))
        .where(eq(assessments.courseId, course.courseId));

      rows.push([
        course.title,
        String(totalEnrolled),
        String(completedCount),
        `${completionRate}%`,
        `${attRate}%`,
        scoreStats?.avgScore != null ? String(scoreStats.avgScore) : 'N/A',
      ]);
    }

    return this.formatReport('Satisfaction Report', headers, rows, fmt, metadata);
  }

  // ═══════════════════════════════════════════════════════════
  // ─── Instructor Performance Report ────────────────────────
  // ═══════════════════════════════════════════════════════════

  async generateInstructorPerformanceReport(
    user: AuthenticatedUser,
    format?: string,
  ): Promise<ReportResult> {
    const fmt = this.validateFormat(format);

    if (!isGlobalAdmin(user) && !isManager(user)) {
      // Instructors can only see their own performance
      return this.generateSingleInstructorReport(user.id, fmt, user);
    }

    // Admin/Manager: all instructors (manager sees only their managed courses' instructors)
    const { userRoles, roles } = await import('../../database/schema');

    const instructors = await db
      .selectDistinct({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
      .from(users)
      .innerJoin(userRoles, eq(users.id, userRoles.userId))
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(roles.name, 'INSTRUCTOR'));

    const headers = [
      'Instructor',
      'Email',
      'Courses',
      'Total Students',
      'Avg Completion Rate',
      'Avg Attendance Rate',
      'Sessions This Month',
    ];

    const rows: string[][] = [];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    for (const inst of instructors) {
      const name = `${inst.firstName || ''} ${inst.lastName || ''}`.trim() || 'Unknown';

      // Courses count
      const [courseStats] = await db
        .select({ count: count() })
        .from(courses)
        .where(eq(courses.instructorId, inst.id));

      // Students count
      const [studentStats] = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${enrollments.studentId})` })
        .from(enrollments)
        .innerJoin(courses, eq(enrollments.courseId, courses.id))
        .where(eq(courses.instructorId, inst.id));

      // Avg completion rate
      const [compStats] = await db
        .select({
          total: count(),
          completed: sql<number>`COUNT(CASE WHEN ${enrollments.status} = 'completed' OR ${enrollments.progress} = 100 THEN 1 END)`,
        })
        .from(enrollments)
        .innerJoin(courses, eq(enrollments.courseId, courses.id))
        .where(eq(courses.instructorId, inst.id));

      const compTotal = Number(compStats?.total || 0);
      const compDone = Number(compStats?.completed || 0);
      const compRate = compTotal > 0 ? Math.round((compDone / compTotal) * 100) : 0;

      // Avg attendance rate
      const [attStats] = await db
        .select({
          total: count(),
          present: sql<number>`COUNT(CASE WHEN ${attendance.status} IN ('present', 'late') THEN 1 END)`,
        })
        .from(attendance)
        .innerJoin(sessions, eq(attendance.sessionId, sessions.id))
        .innerJoin(courses, eq(sessions.courseId, courses.id))
        .where(eq(courses.instructorId, inst.id));

      const attTotal = Number(attStats?.total || 0);
      const attPresent = Number(attStats?.present || 0);
      const attRate = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : 0;

      // Sessions this month
      const [sessStats] = await db
        .select({ count: count() })
        .from(sessions)
        .innerJoin(courses, eq(sessions.courseId, courses.id))
        .where(
          and(
            eq(courses.instructorId, inst.id),
            gte(sessions.scheduledAt, monthStart),
          ),
        );

      rows.push([
        name,
        inst.email,
        String(courseStats?.count || 0),
        String(studentStats?.count || 0),
        `${compRate}%`,
        `${attRate}%`,
        String(sessStats?.count || 0),
      ]);
    }

    const metadata: ReportMetadata = { filters: 'All Instructors' };
    return this.formatReport('Instructor Performance Report', headers, rows, fmt, metadata);
  }

  private async generateSingleInstructorReport(
    instructorId: string,
    format: ReportFormat,
    user: AuthenticatedUser,
  ): Promise<ReportResult> {
    const metadata = await this.buildMetadata(user);
    // Same logic but for a single instructor — reuse the loop body
    const [inst] = await db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
      .from(users)
      .where(eq(users.id, instructorId))
      .limit(1);

    if (!inst) {
      return this.formatReport('Instructor Performance Report', [], [], format, metadata);
    }

    const name = `${inst.firstName || ''} ${inst.lastName || ''}`.trim() || 'Unknown';

    const headers = ['Metric', 'Value'];

    const [courseStats] = await db.select({ count: count() }).from(courses).where(eq(courses.instructorId, inst.id));
    const [studentStats] = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${enrollments.studentId})` })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(eq(courses.instructorId, inst.id));

    const rows: string[][] = [
      ['Instructor', name],
      ['Email', inst.email],
      ['Courses', String(courseStats?.count || 0)],
      ['Total Students', String(studentStats?.count || 0)],
    ];

    return this.formatReport('Instructor Performance Report', headers, rows, format, metadata);
  }

  // ═══════════════════════════════════════════════════════════
  // ─── NELC Compliance Matrix Report ──────────────────────
  // ═══════════════════════════════════════════════════════════

  async generateNelcComplianceReport(
    user: AuthenticatedUser,
    params: { courseId?: string; format?: string },
  ): Promise<ReportResult> {
    const format = this.validateFormat(params.format);
    const metadata = await this.buildMetadata(user, params.courseId);

    // Get all courses the user has access to
    const coursesData = await this.nelcComplianceService.getAllCoursesCompliance(user);
    const filtered = params.courseId
      ? coursesData.filter((c) => c.courseId === params.courseId)
      : coursesData;

    const headers = ['Course', 'Category', 'Rule', 'Status', 'Detail'];
    const rows: string[][] = [];

    // For each course, fetch the detailed 7-category scorecard
    for (const course of filtered) {
      const scorecard = await this.nelcComplianceService.getCourseComplianceScorecard(course.courseId);
      for (const cat of scorecard.categories) {
        for (const check of cat.checks) {
          rows.push([
            course.courseTitle,
            cat.label,
            check.rule,
            check.status,
            check.detail,
          ]);
        }
      }
    }

    if (rows.length === 0) {
      rows.push(['No compliance data available', '', '', '', '']);
    }

    return this.formatReport('NELC Compliance Matrix', headers, rows, format, metadata);
  }

  private async buildMetadata(user: AuthenticatedUser, courseId?: string): Promise<ReportMetadata> {
    const instructorName = await this.getInstructorName(user.id);
    const filters = courseId ? `Course: ${await this.getCourseName(courseId)}` : 'All Courses';
    return { instructorName, filters };
  }

  // ═══════════════════════════════════════════════════════════
  // ─── Course Catalog Report ────────────────────────────────
  // Columns: Course Title, Status, Instructor, Enrolled, Completion Rate, Avg Rating
  // ═══════════════════════════════════════════════════════════

  async generateCourseCatalogReport(
    user: AuthenticatedUser,
    params: { courseId?: string; format?: string },
  ): Promise<ReportResult> {
    const format = this.validateFormat(params.format);
    const metadata = await this.buildMetadata(user, params.courseId);

    const headers = [
      'Course Title',
      'Status',
      'Instructor',
      'Enrolled',
      'Completion Rate',
      'Avg Rating',
    ];

    // Build course query conditions
    const conditions: any[] = [];
    if (params.courseId) {
      await this.verifyCourseAccess(params.courseId, user);
      conditions.push(eq(courses.id, params.courseId));
    } else {
      this.addCourseOwnershipCondition(conditions, user);
    }

    const courseData = await db
      .select({
        id: courses.id,
        title: courses.title,
        status: courses.status,
        instructorId: courses.instructorId,
      })
      .from(courses)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(courses.title));

    if (courseData.length === 0) {
      return this.formatReport('Course Catalog Report', headers, [], format, metadata);
    }

    // Batch-fetch instructor names
    const instructorIds = [...new Set(courseData.map((c) => c.instructorId))];
    const instructors = await db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(inArray(users.id, instructorIds));
    const instructorMap = new Map(
      instructors.map((i) => [i.id, `${i.firstName || ''} ${i.lastName || ''}`.trim() || 'Unknown']),
    );

    // Batch-fetch enrollment counts and completion rates
    const courseIds = courseData.map((c) => c.id);
    const enrollmentStats = await db
      .select({
        courseId: enrollments.courseId,
        enrolledCount: count(),
        completedCount: sql<number>`SUM(CASE WHEN ${enrollments.status} = 'completed' THEN 1 ELSE 0 END)`.as('completed'),
      })
      .from(enrollments)
      .where(inArray(enrollments.courseId, courseIds))
      .groupBy(enrollments.courseId);
    const enrollMap = new Map(enrollmentStats.map((e) => [e.courseId, e]));

    // Batch-fetch average ratings
    const { courseRatings: courseRatingsTable } = await import('../../database/schema');
    const ratingStats = await db
      .select({
        courseId: courseRatingsTable.courseId,
        avgRating: sql<number>`ROUND(AVG(${courseRatingsTable.rating}), 1)`.as('avg_rating'),
      })
      .from(courseRatingsTable)
      .where(inArray(courseRatingsTable.courseId, courseIds))
      .groupBy(courseRatingsTable.courseId);
    const ratingMap = new Map(ratingStats.map((r) => [r.courseId, Number(r.avgRating)]));

    const rows = courseData.map((c) => {
      const enroll = enrollMap.get(c.id);
      const enrolled = Number(enroll?.enrolledCount || 0);
      const completed = Number(enroll?.completedCount || 0);
      const completionRate = enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0;
      const rating = ratingMap.get(c.id);

      return [
        c.title,
        c.status || '',
        instructorMap.get(c.instructorId) || 'Unassigned',
        String(enrolled),
        `${completionRate}%`,
        rating !== undefined ? String(rating) : 'N/A',
      ];
    });

    return this.formatReport('Course Catalog Report', headers, rows, format, metadata);
  }

  // ═══════════════════════════════════════════════════════════
  // ─── 9. Revenue Report ─────────────────────────────────────
  // Columns: Course Title, Price, Enrollments, Revenue, Status
  // Manager/Admin only
  // ═══════════════════════════════════════════════════════════

  async generateRevenueReport(
    user: AuthenticatedUser,
    params: { format?: string; dateFrom?: string; dateTo?: string },
  ): Promise<ReportResult> {
    const format = this.validateFormat(params.format);
    const instructorName = await this.getInstructorName(user.id);

    const filterParts: string[] = [];
    if (params.dateFrom) filterParts.push(`From: ${params.dateFrom}`);
    if (params.dateTo) filterParts.push(`To: ${params.dateTo}`);

    const metadata: ReportMetadata = {
      instructorName,
      filters: filterParts.length > 0 ? filterParts.join(', ') : 'All Time',
    };

    const headers = [
      'Course Title',
      'Price (SAR)',
      'Total Enrollments',
      'Active Enrollments',
      'Revenue (SAR)',
      'Status',
    ];

    // Get courses scoped by role
    const conditions: any[] = [];
    this.addCourseOwnershipCondition(conditions, user);

    const courseData = await db
      .select({
        id: courses.id,
        title: courses.title,
        price: courses.price,
        status: courses.status,
      })
      .from(courses)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(courses.createdAt));

    if (courseData.length === 0) {
      return this.formatReport('Revenue Report', headers, [], format, metadata);
    }

    const courseIds = courseData.map((c) => c.id);

    // Enrollment date filters
    const enrollConditions: any[] = [inArray(enrollments.courseId, courseIds)];
    if (params.dateFrom) {
      enrollConditions.push(gte(enrollments.enrolledAt, new Date(params.dateFrom)));
    }
    if (params.dateTo) {
      enrollConditions.push(lte(enrollments.enrolledAt, new Date(params.dateTo)));
    }

    // Get enrollment counts per course
    const enrollStats = await db
      .select({
        courseId: enrollments.courseId,
        totalCount: count(),
        activeCount: sql<number>`SUM(CASE WHEN ${enrollments.status} = 'active' THEN 1 ELSE 0 END)`.as('active'),
      })
      .from(enrollments)
      .where(and(...enrollConditions))
      .groupBy(enrollments.courseId);
    const enrollMap = new Map(enrollStats.map((e) => [e.courseId, e]));

    let grandTotalRevenue = 0;
    let grandTotalEnrollments = 0;

    const rows = courseData.map((c) => {
      const price = parseFloat(c.price || '0');
      const enroll = enrollMap.get(c.id);
      const total = Number(enroll?.totalCount || 0);
      const active = Number(enroll?.activeCount || 0);
      const revenue = price * total;

      grandTotalRevenue += revenue;
      grandTotalEnrollments += total;

      return [
        c.title,
        price.toFixed(2),
        String(total),
        String(active),
        revenue.toFixed(2),
        c.status || '',
      ];
    });

    // Add summary row
    rows.push([
      'TOTAL',
      '',
      String(grandTotalEnrollments),
      '',
      grandTotalRevenue.toFixed(2),
      '',
    ]);

    return this.formatReport('Revenue Report', headers, rows, format, metadata);
  }

  // ═══════════════════════════════════════════════════════════
  // ─── Scheduled Reports CRUD ───────────────────────────────
  // ═══════════════════════════════════════════════════════════

  async getScheduledReports(user: AuthenticatedUser) {
    return db
      .select()
      .from(scheduledReports)
      .where(eq(scheduledReports.userId, user.id))
      .orderBy(desc(scheduledReports.createdAt));
  }

  async createScheduledReport(
    user: AuthenticatedUser,
    data: {
      reportType: string;
      format?: string;
      courseId?: string;
      frequency: string;
      recipientEmail?: string;
    },
  ) {
    const nextRunAt = this.calculateNextRunAt(data.frequency);

    const [created] = await db
      .insert(scheduledReports)
      .values({
        userId: user.id,
        reportType: data.reportType,
        format: data.format || 'csv',
        courseId: data.courseId || null,
        frequency: data.frequency,
        recipientEmail: data.recipientEmail || null,
        enabled: true,
        nextRunAt,
      })
      .returning();

    return created;
  }

  async updateScheduledReport(
    id: string,
    user: AuthenticatedUser,
    data: { enabled?: boolean; frequency?: string; format?: string },
  ) {
    const [existing] = await db
      .select()
      .from(scheduledReports)
      .where(and(eq(scheduledReports.id, id), eq(scheduledReports.userId, user.id)))
      .limit(1);

    if (!existing) throw new NotFoundException('Scheduled report not found');

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.enabled !== undefined) updates.enabled = data.enabled;
    if (data.frequency) {
      updates.frequency = data.frequency;
      updates.nextRunAt = this.calculateNextRunAt(data.frequency);
    }
    if (data.format) updates.format = data.format;

    const [updated] = await db
      .update(scheduledReports)
      .set(updates)
      .where(eq(scheduledReports.id, id))
      .returning();

    return updated;
  }

  async deleteScheduledReport(id: string, user: AuthenticatedUser) {
    const [existing] = await db
      .select()
      .from(scheduledReports)
      .where(and(eq(scheduledReports.id, id), eq(scheduledReports.userId, user.id)))
      .limit(1);

    if (!existing) throw new NotFoundException('Scheduled report not found');

    await db.delete(scheduledReports).where(eq(scheduledReports.id, id));
    return { message: 'Scheduled report deleted' };
  }

  private calculateNextRunAt(frequency: string): Date {
    const now = new Date();
    switch (frequency) {
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      default:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // ─── Generic Table Export ──────────────────────────────────
  // ═══════════════════════════════════════════════════════════

  async exportTable(
    user: AuthenticatedUser,
    type: string,
    format: string,
    filters?: Record<string, string>,
  ): Promise<ReportResult> {
    const fmt = this.validateFormat(format);

    switch (type) {
      case 'sessions':
        return this.exportSessionsTable(user, fmt, filters);
      case 'instructors':
        return this.exportInstructorsTable(user, fmt);
      case 'assessments':
        return this.exportAssessmentsTable(user, fmt, filters);
      case 'content-review':
        return this.exportContentReviewTable(user, fmt);
      case 'nelc-courses':
        return this.exportNelcCoursesTable(user, fmt);
      default:
        throw new BadRequestException(
          `Unknown table type: ${type}. Valid types: sessions, instructors, assessments, content-review, nelc-courses`,
        );
    }
  }

  private async exportSessionsTable(
    user: AuthenticatedUser,
    format: ReportFormat,
    filters?: Record<string, string>,
  ): Promise<ReportResult> {
    const conditions: any[] = [];
    if (filters?.status) {
      conditions.push(eq(sessions.status, filters.status));
    }
    if (filters?.courseId) {
      conditions.push(eq(sessions.courseId, filters.courseId));
    }

    const data = await db
      .select({
        title: sessions.title,
        courseTitle: courses.title,
        type: sessions.type,
        scheduledAt: sessions.scheduledAt,
        durationMinutes: sessions.durationMinutes,
        status: sessions.status,
        instructorFirstName: users.firstName,
        instructorLastName: users.lastName,
        instructorEmail: users.email,
        venueAddress: sessions.venueAddress,
      })
      .from(sessions)
      .innerJoin(courses, eq(sessions.courseId, courses.id))
      .innerJoin(users, eq(courses.instructorId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(sessions.scheduledAt));

    const headers = [
      'Session Title',
      'Course',
      'Type',
      'Scheduled At',
      'Duration (min)',
      'Status',
      'Instructor',
      'Venue',
    ];

    const rows = data.map((row) => [
      row.title || '',
      row.courseTitle || '',
      row.type || '',
      this.formatDate(row.scheduledAt),
      String(row.durationMinutes || 0),
      row.status || '',
      `${row.instructorFirstName || ''} ${row.instructorLastName || ''}`.trim() || row.instructorEmail || '',
      row.venueAddress || '',
    ]);

    return this.formatReport('Sessions Export', headers, rows, format);
  }

  private async exportInstructorsTable(
    user: AuthenticatedUser,
    format: ReportFormat,
  ): Promise<ReportResult> {
    const { userRoles, roles } = await import('../../database/schema');

    const instructors = await db
      .selectDistinct({
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        id: users.id,
      })
      .from(users)
      .innerJoin(userRoles, eq(users.id, userRoles.userId))
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(roles.name, 'INSTRUCTOR'));

    const headers = [
      'Instructor Name',
      'Email',
      'Courses',
      'Total Students',
    ];

    const rows: string[][] = [];

    for (const inst of instructors) {
      const [courseStats] = await db
        .select({ count: count() })
        .from(courses)
        .where(eq(courses.instructorId, inst.id));

      const [studentStats] = await db
        .select({
          count: sql<number>`COUNT(DISTINCT ${enrollments.studentId})`,
        })
        .from(enrollments)
        .innerJoin(courses, eq(enrollments.courseId, courses.id))
        .where(eq(courses.instructorId, inst.id));

      rows.push([
        `${inst.firstName || ''} ${inst.lastName || ''}`.trim() || 'Unknown',
        inst.email,
        String(courseStats?.count || 0),
        String(studentStats?.count || 0),
      ]);
    }

    return this.formatReport('Instructors Export', headers, rows, format);
  }

  private async exportAssessmentsTable(
    user: AuthenticatedUser,
    format: ReportFormat,
    filters?: Record<string, string>,
  ): Promise<ReportResult> {
    const conditions: any[] = [];
    if (filters?.type) {
      conditions.push(eq(assessments.type, filters.type));
    }
    if (filters?.status) {
      conditions.push(eq(assessments.status, filters.status));
    }
    if (filters?.courseId) {
      conditions.push(eq(assessments.courseId, filters.courseId));
    }

    const data = await db
      .select({
        title: assessments.title,
        courseTitle: courses.title,
        type: assessments.type,
        totalMarks: assessments.totalMarks,
        passingMarks: assessments.passingMarks,
        status: assessments.status,
        durationMinutes: assessments.durationMinutes,
      })
      .from(assessments)
      .innerJoin(courses, eq(assessments.courseId, courses.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(assessments.createdAt));

    const headers = [
      'Assessment',
      'Course',
      'Type',
      'Total Marks',
      'Passing Marks',
      'Duration (min)',
      'Status',
    ];

    const rows = data.map((row) => [
      row.title || '',
      row.courseTitle || '',
      row.type || '',
      String(row.totalMarks || 0),
      String(row.passingMarks || 0),
      String(row.durationMinutes || ''),
      row.status || '',
    ]);

    return this.formatReport('Assessments Export', headers, rows, format);
  }

  private async exportContentReviewTable(
    user: AuthenticatedUser,
    format: ReportFormat,
  ): Promise<ReportResult> {
    const data = await db
      .select({
        title: courseMaterials.title,
        type: courseMaterials.type,
        status: courseMaterials.status,
        wcagStatus: courseMaterials.wcagStatus,
        courseTitle: courses.title,
        instructorFirstName: users.firstName,
        instructorLastName: users.lastName,
        instructorEmail: users.email,
        createdAt: courseMaterials.createdAt,
        reviewNote: courseMaterials.reviewNote,
      })
      .from(courseMaterials)
      .innerJoin(courses, eq(courseMaterials.courseId, courses.id))
      .innerJoin(users, eq(courses.instructorId, users.id))
      .where(
        sql`${courseMaterials.status} IN ('pending_review', 'changes_requested')`,
      )
      .orderBy(desc(courseMaterials.createdAt));

    const headers = [
      'Content Title',
      'Type',
      'Course',
      'Instructor',
      'Status',
      'WCAG Status',
      'Submitted At',
      'Review Note',
    ];

    const rows = data.map((row) => [
      row.title || '',
      row.type || '',
      row.courseTitle || '',
      `${row.instructorFirstName || ''} ${row.instructorLastName || ''}`.trim() || row.instructorEmail || '',
      row.status || '',
      row.wcagStatus || '',
      this.formatDate(row.createdAt),
      row.reviewNote || '',
    ]);

    return this.formatReport('Content Review Export', headers, rows, format);
  }

  private async exportNelcCoursesTable(
    user: AuthenticatedUser,
    format: ReportFormat,
  ): Promise<ReportResult> {
    const coursesData =
      await this.nelcComplianceService.getAllCoursesCompliance(user);

    const headers = [
      'Course',
      'Instructor',
      'Overall Status',
      'Passed',
      'Review',
      'Failed',
      'Total Checks',
    ];

    const rows = coursesData.map((c) => [
      c.courseTitle,
      c.instructorName,
      c.overallStatus,
      String(c.summary.passed),
      String(c.summary.review),
      String(c.summary.failed),
      String(c.summary.total),
    ]);

    return this.formatReport('NELC Compliance Export', headers, rows, format);
  }

  // ═══════════════════════════════════════════════════════════
  // ─── Audit Helper ──────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════

  async logReportGenerated(userId: string, reportType: string, format: string) {
    await this.auditLogService.log({
      entityType: 'report',
      entityId: reportType,
      action: 'report.generated',
      performedBy: userId,
      metadata: { reportType, format },
    }).catch(() => {});
  }

  // ═══════════════════════════════════════════════════════════
  // ─── Format Dispatcher ────────────────────────────────────
  // ═══════════════════════════════════════════════════════════

  private async formatReport(
    title: string,
    headers: string[],
    rows: string[][],
    format: ReportFormat,
    metadata?: ReportMetadata,
  ): Promise<ReportResult> {
    const date = new Date().toISOString().split('T')[0];
    const slug = title.toLowerCase().replace(/\s+/g, '-');
    const ext = format;
    const filename = `${slug}-${date}.${ext}`;

    let buffer: Buffer;

    switch (format) {
      case 'csv':
        buffer = this.generateCsv(headers, rows, metadata);
        break;
      case 'pdf':
        buffer = await this.generatePdf(title, headers, rows, metadata);
        break;
      case 'xlsx':
        buffer = await this.generateExcel(title, headers, rows, metadata);
        break;
    }

    return {
      buffer,
      contentType: CONTENT_TYPES[format],
      filename,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // ─── CSV Generator ────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════

  private generateCsv(
    headers: string[],
    rows: string[][],
    metadata?: ReportMetadata,
  ): Buffer {
    const escape = (val: string): string => {
      if (
        val.includes(',') ||
        val.includes('"') ||
        val.includes('\n') ||
        val.includes('\r')
      ) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const metaLines: string[] = [];
    if (metadata?.instructorName) {
      metaLines.push(`# Instructor: ${metadata.instructorName}`);
    }
    if (metadata?.filters) {
      metaLines.push(`# Filters: ${metadata.filters}`);
    }
    metaLines.push(`# Generated: ${this.formatTimestamp(new Date())} | NELC Compliant`);
    metaLines.push('');

    const lines = [
      ...metaLines,
      headers.map(escape).join(','),
      ...rows.map((row) => row.map(escape).join(',')),
    ];

    // Add UTF-8 BOM so Excel correctly renders Arabic/Unicode characters
    const BOM = '\uFEFF';
    return Buffer.from(BOM + lines.join('\r\n'), 'utf-8');
  }

  // ═══════════════════════════════════════════════════════════
  // ─── PDF Generator (PDFKit) ───────────────────────────────
  // ═══════════════════════════════════════════════════════════

  private async generatePdf(
    title: string,
    headers: string[],
    rows: string[][],
    metadata?: ReportMetadata,
  ): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const PDFDocument = require('pdfkit');

    // Load Arabic font for PDF reports (embedded base64 — same as certificates)
    let arabicFontBuf: Buffer | null = null;
    try {
      // Use dynamic path resolution to find the font file
      const path = require('path');
      const fontPath = path.resolve(__dirname, '..', 'certificates', 'amiri-bold-font');
      const { AMIRI_BOLD_BASE64 } = require(fontPath);
      arabicFontBuf = Buffer.from(AMIRI_BOLD_BASE64, 'base64');
    } catch (err) {
      this.logger.warn(`Failed to load Arabic font for PDF: ${err?.message}`);
    }

    const hasArabic = (text: string) => /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 25,
        size: 'A4',
        layout: 'landscape',
      });

      // Register Arabic font
      if (arabicFontBuf) {
        doc.registerFont('Amiri', arabicFontBuf);
      }

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const startX = doc.page.margins.left;

      // Smart column widths — wider for name/email, narrower for status/numbers
      const wideColumns = new Set(['Student Name', 'Email', 'Instructor', 'Course', 'Session']);
      const defaultColWidth = pageWidth / headers.length;
      const wideCount = headers.filter(h => wideColumns.has(h)).length;
      const narrowCount = headers.length - wideCount;
      const wideWidth = wideCount > 0 ? (pageWidth * 0.55) / wideCount : defaultColWidth;
      const narrowWidth = narrowCount > 0 ? (pageWidth * 0.45) / narrowCount : defaultColWidth;
      const colWidths = headers.map(h => wideColumns.has(h) ? wideWidth : narrowWidth);
      const getColX = (i: number) => startX + colWidths.slice(0, i).reduce((s, w) => s + w, 0);

      // ── Title ──
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text(title, { align: 'center' });
      doc.moveDown(0.3);

      // ── Metadata block ──
      if (metadata?.instructorName) {
        doc
          .fontSize(9)
          .font('Helvetica')
          .text(`Instructor: ${metadata.instructorName}`, { align: 'center' });
      }
      if (metadata?.filters) {
        doc
          .fontSize(9)
          .font('Helvetica-Oblique')
          .text(`Filters: ${metadata.filters}`, { align: 'center' });
      }
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(`Generated: ${this.formatTimestamp(new Date())} | NELC Compliant`, {
          align: 'center',
        });
      doc.moveDown(0.8);

      let y = doc.y;

      // ── NELC footer helper ──
      const drawFooter = () => {
        doc
          .fontSize(7)
          .font('Helvetica')
          .text(
            `Total records: ${rows.length}  |  NELC Compliant Report — PhysioGuidance`,
            startX,
            doc.page.height - doc.page.margins.bottom - 10,
          );
      };

      // Shorten long header names for PDF
      const shortHeaders: Record<string, string> = {
        'RegistrationClassificationNumber': 'Reg. No.',
        'Student Name': 'Student',
        'Session Date': 'Date',
        'Total Minutes': 'Min.',
        'Total Attendance %': 'Att. %',
        'Completion Status': 'Status',
        'Join Time': 'Join',
        'Leave Time': 'Leave',
      };

      // ── Header row drawing helper ──
      const centerHeaderColumns = new Set(['Total Minutes', 'Total Attendance %', 'Status', 'Completion Status']);
      const drawHeaders = () => {
        doc.fontSize(6.5).font('Helvetica-Bold');
        headers.forEach((header, i) => {
          doc.text(shortHeaders[header] || header, getColX(i), y, {
            width: colWidths[i] - 2,
            lineBreak: false,
            align: centerHeaderColumns.has(header) ? 'center' : undefined,
          });
        });
        y += 12;
        doc
          .moveTo(startX, y)
          .lineTo(startX + pageWidth, y)
          .stroke();
        y += 4;
        doc.font('Helvetica').fontSize(6.5);
      };

      drawHeaders();

      // ── Data rows ──
      for (const row of rows) {
        // Page break check
        if (y > doc.page.height - doc.page.margins.bottom - 20) {
          drawFooter();
          doc.addPage();
          y = doc.page.margins.top;
          drawHeaders();
        }

        row.forEach((cell, i) => {
          const cellText = String(cell ?? '');
          // Center-align numeric/short columns
          const centerColumns = new Set(['Total Minutes', 'Total Attendance %', 'Status', 'Completion Status']);
          const align = centerColumns.has(headers[i]) ? 'center' as const : undefined;
          // Use Arabic font if cell contains Arabic characters
          if (arabicFontBuf && hasArabic(cellText)) {
            doc.font('Amiri').fontSize(6.5);
            doc.text(cellText, getColX(i), y, {
              width: colWidths[i] - 2,
              lineBreak: false,
              align,
              features: ['rtla'],
            });
            doc.font('Helvetica').fontSize(6.5);
          } else {
            doc.text(cellText, getColX(i), y, {
              width: colWidths[i] - 2,
              lineBreak: false,
              align,
            });
          }
        });
        y += 12;
      }

      // ── Footer on last page ──
      drawFooter();

      doc.end();
    });
  }

  // ═══════════════════════════════════════════════════════════
  // ─── Excel Generator (ExcelJS) ────────────────────────────
  // ═══════════════════════════════════════════════════════════

  private async generateExcel(
    title: string,
    headers: string[],
    rows: string[][],
    metadata?: ReportMetadata,
  ): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PhysioGuidance';
    workbook.created = new Date();

    // Excel sheet name max 31 chars
    const sheetName = title.substring(0, 31);
    const worksheet = workbook.addWorksheet(sheetName);

    let rowNum = 1;

    // Title row
    const titleRow = worksheet.addRow([title]);
    titleRow.font = { bold: true, size: 14 };
    if (headers.length > 1) {
      worksheet.mergeCells(rowNum, 1, rowNum, headers.length);
    }
    rowNum++;

    // Instructor row
    if (metadata?.instructorName) {
      const instrRow = worksheet.addRow([`Instructor: ${metadata.instructorName}`]);
      instrRow.font = { italic: true, size: 10, color: { argb: 'FF666666' } };
      if (headers.length > 1) {
        worksheet.mergeCells(rowNum, 1, rowNum, headers.length);
      }
      rowNum++;
    }

    // Filters row
    if (metadata?.filters) {
      const filterRow = worksheet.addRow([`Filters: ${metadata.filters}`]);
      filterRow.font = { italic: true, size: 10, color: { argb: 'FF666666' } };
      if (headers.length > 1) {
        worksheet.mergeCells(rowNum, 1, rowNum, headers.length);
      }
      rowNum++;
    }

    // Generated date row
    const dateRow = worksheet.addRow([
      `Generated: ${this.formatTimestamp(new Date())} | NELC Compliant`,
    ]);
    dateRow.font = { italic: true, size: 10, color: { argb: 'FF666666' } };
    if (headers.length > 1) {
      worksheet.mergeCells(rowNum, 1, rowNum, headers.length);
    }
    rowNum++;

    // Empty separator row
    worksheet.addRow([]);
    rowNum++;

    // Header row with styling
    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FF333333' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9E1F2' },
    };
    headerRow.eachCell((cell: any) => {
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FF999999' } },
      };
    });

    // Data rows
    for (const row of rows) {
      worksheet.addRow(row);
    }

    // Auto-fit column widths
    for (let i = 0; i < headers.length; i++) {
      let maxLen = headers[i].length;
      for (const row of rows) {
        const len = String(row[i] || '').length;
        if (len > maxLen) maxLen = len;
      }
      const col = worksheet.getColumn(i + 1);
      col.width = Math.min(maxLen + 3, 45);
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  // ═══════════════════════════════════════════════════════════
  // ─── Helpers ──────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════

  private formatDate(date: Date | string | null | undefined): string {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    return `${d.toISOString().split('T')[0]} ${d.toTimeString().split(' ')[0].slice(0, 5)}`;
  }

  private formatDateTime(date: Date | string | null | undefined): string {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    return d.toISOString().replace('T', ' ').slice(0, 19);
  }

  private formatTimestamp(date: Date): string {
    return date.toISOString().replace('T', ' ').slice(0, 16);
  }

  /**
   * Resolve course IDs from either a specific courseId or all instructor's courses.
   * Admin: if no courseId, returns all courses.
   * Instructor: if no courseId, returns their own courses.
   */
  private async resolveCourseIds(
    user: AuthenticatedUser,
    courseId?: string,
  ): Promise<string[]> {
    if (courseId) {
      await this.verifyCourseAccess(courseId, user);
      return [courseId];
    }

    if (isGlobalAdmin(user)) {
      const allCourses = await db
        .select({ id: courses.id })
        .from(courses);
      return allCourses.map((c) => c.id);
    }

    if (isManager(user)) {
      const managedCourses = await db
        .select({ id: courses.id })
        .from(courses)
        .where(or(eq(courses.managerId, user.id), sql`${courses.managerId} IS NULL`));
      return managedCourses.map((c) => c.id);
    }

    return this.getInstructorCourseIds(user.id);
  }

  private async getInstructorCourseIds(
    instructorId: string,
  ): Promise<string[]> {
    const instructorCourses = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.instructorId, instructorId));
    return instructorCourses.map((c) => c.id);
  }

  private async verifyCourseAccess(
    courseId: string,
    user: AuthenticatedUser,
  ) {
    const conditions: any[] = [eq(courses.id, courseId)];
    this.addCourseOwnershipCondition(conditions, user);

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
}
