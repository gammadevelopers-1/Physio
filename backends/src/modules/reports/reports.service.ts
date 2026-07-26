import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, and, desc, asc, count, sql, gte, lte, inArray, or, isNull } from 'drizzle-orm';
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
  webinarRegistrations,
  payments,
} from '../../database/schema';
import { courseMaterials } from '../../database/schema/course-materials';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { isGlobalAdmin, isManager, isTA, hasRole } from '../../common/role-helpers';

// Reports use "maximum-permission" role checks: if a user *has* the ADMIN
// role at all (even if their activeRole is currently INSTRUCTOR for viewing
// their own courses), they see admin-scope reports. Without this, an admin
// whose current activeRole isn't ADMIN gets empty results — because the
// scope filter falls through to "courses I teach" and admins rarely teach.
const hasAdminScope = (user: AuthenticatedUser): boolean =>
  isGlobalAdmin(user) || hasRole(user, 'ADMIN') || hasRole(user, 'SUPER_ADMIN');
const hasManagerScope = (user: AuthenticatedUser): boolean =>
  isManager(user) || hasRole(user, 'MANAGER');
import { decryptPII } from '../../common/crypto';
import { computeEffectiveScore } from '../../common/score-policy';
import { NelcComplianceService } from '../nelc-compliance/nelc-compliance.service';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { AdminSettingsService } from '../admin-settings/admin-settings.service';
import {
  formatPlatformDate as fmtPlatformDate,
  toArabicIndic,
  type PlatformLocaleSettings,
} from '../../common/platform-locale';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
// Historical note: the ES-style `import PDFDocument from 'pdfkit'` compiled to
// `pdfkit_1.default` which is undefined (pdfkit uses `module.exports = ctor`,
// not `.default`) — so every report PDF 500'd in production. The rest of the
// codebase uses `import * as PDFDocument from 'pdfkit'` for the same reason.

type ReportFormat = 'csv' | 'pdf' | 'xlsx';

/** All date/time formatting uses Asia/Riyadh (UTC+3) to match the business timezone */
const TZ = 'Asia/Riyadh';

interface ReportMetadata {
  /** Kept for backwards compat — treated as the exporter's display name. */
  instructorName?: string;
  /** Role of the exporter, used to label the metadata line correctly. */
  exporterRole?: 'ADMIN' | 'MANAGER' | 'INSTRUCTOR' | 'TEACHING_ASSISTANT';
  filters?: string;
}

const EXPORTER_LABEL: Record<NonNullable<ReportMetadata['exporterRole']>, string> = {
  ADMIN: 'Administrator',
  MANAGER: 'Manager',
  INSTRUCTOR: 'Instructor',
  TEACHING_ASSISTANT: 'Teaching Assistant',
};

interface ReportResult {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

const CONTENT_TYPES: Record<ReportFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  /** Active timezone for current report generation (set per-request, defaults to TZ) */
  private activeTz: string = TZ;
  /** Platform locale settings — loaded per request, honors admin dateFormat / numberSystem */
  private activeLocale: Pick<PlatformLocaleSettings, 'dateFormat' | 'numberSystem'> = {
    dateFormat: 'DD-MM-YYYY',
    numberSystem: 'western',
  };

  constructor(
    private readonly nelcComplianceService: NelcComplianceService,
    private readonly auditLogService: AuditLogService,
    private readonly adminSettings: AdminSettingsService,
  ) {}

  /** Load admin-configured locale settings into the request-scope cache.
   *  Called at the top of every public report entry method. */
  private async loadPlatformLocale(): Promise<void> {
    try {
      const s = await this.adminSettings.getPublicLocaleSettings();
      this.activeLocale = {
        dateFormat: s.dateFormat,
        numberSystem: s.numberSystem,
      };
    } catch {
      // Keep defaults on failure — never block report generation.
      this.activeLocale = { dateFormat: 'DD-MM-YYYY', numberSystem: 'western' };
    }
  }

  // ─── Role helpers ─────────────────────────────────────────

  private addCourseOwnershipCondition(
    conditions: any[],
    user: AuthenticatedUser,
  ): void {
    if (hasAdminScope(user)) {
      // No filter — see all courses
    } else if (hasManagerScope(user)) {
      conditions.push(or(eq(courses.managerId, user.id), sql`${courses.managerId} IS NULL`)!);
    } else if (isTA(user)) {
      // TA can access courses they are assigned to
      conditions.push(
        or(
          eq(courses.instructorId, user.id),
          sql`${courses.id} IN (SELECT course_id FROM course_assistants WHERE user_id = ${user.id} AND status = 'approved')`,
        )!,
      );
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
   * Fetch the exporter's full name for report metadata. Name kept legacy to
   * avoid a giant callsite rename — the "instructor" label is corrected at
   * render time via metadata.exporterRole + EXPORTER_LABEL.
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
   * Resolve the label role for report metadata from the exporter's active
   * role. Falls back to INSTRUCTOR when no role can be inferred (matches
   * pre-existing behavior — the endpoint is under /instructor/reports).
   */
  private resolveExporterRole(user: AuthenticatedUser): ReportMetadata['exporterRole'] {
    if (hasAdminScope(user)) return 'ADMIN';
    if (hasManagerScope(user)) return 'MANAGER';
    if (isTA(user)) return 'TEACHING_ASSISTANT';
    return 'INSTRUCTOR';
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
      tz?: string;
    },
  ): Promise<ReportResult> {
    const format = this.validateFormat(params.format);
    await this.loadPlatformLocale();
    const userTz = params.tz || TZ; // Use user's timezone if provided, else default
    this.activeTz = userTz; // Set for formatTimestamp/formatDate used in rendering
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
      exporterRole: this.resolveExporterRole(user),
      filters: filterParts.join(', '),
    };

    const headers = [
      'RegistrationClassificationNumber',
      'Student Name',
      'Email',
      'Date',
      'Session',
      'Status',
      'Join',
      'Leave',
      'Min.',
      'Presence %',
      'Att. %',
      'Marked By',
      'Role',
      'Marked At',
    ];

    if (courseIds.length === 0) {
      return this.formatReport('Attendance Report', headers, [], format, metadata);
    }

    // Build session filter conditions — only finalized (completed) sessions
    const sessionConditions: any[] = [
      inArray(sessions.courseId, courseIds),
      eq(sessions.status, 'completed'),
    ];
    if (params.sessionId) {
      sessionConditions.push(eq(sessions.id, params.sessionId));
    }
    if (params.dateFrom) {
      // Convert local date (YYYY-MM-DD) to start of day in user's timezone
      const startOfDay = this.toStartOfDayInTz(params.dateFrom, userTz);
      sessionConditions.push(gte(sessions.scheduledAt, startOfDay));
    }
    if (params.dateTo) {
      // Convert local date to end of day in user's timezone
      const endOfDay = this.toEndOfDayInTz(params.dateTo, userTz);
      sessionConditions.push(lte(sessions.scheduledAt, endOfDay));
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
        markedBy: attendance.markedBy,
        attendanceUpdatedAt: attendance.updatedAt,
        sessionDurationMinutes: sessions.durationMinutes,
        actualStartedAt: sessions.actualStartedAt,
        actualEndedAt: sessions.actualEndedAt,
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

    // Compute total attendance % per student (only finalized sessions)
    const allCourseSessions = await db
      .select({ id: sessions.id, courseId: sessions.courseId })
      .from(sessions)
      .where(and(
        inArray(sessions.courseId, courseIds),
        eq(sessions.status, 'completed'),
      ));

    const totalSessionsPerCourse = new Map<string, number>();
    for (const s of allCourseSessions) {
      totalSessionsPerCourse.set(
        s.courseId,
        (totalSessionsPerCourse.get(s.courseId) || 0) + 1,
      );
    }

    // Count present+late per student per course (only finalized sessions)
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
          eq(sessions.status, 'completed'),
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

    // Resolve markedBy user names for export
    const markerIds = [...new Set(filteredData.map((d) => d.markedBy).filter(Boolean))] as string[];
    const markerMap = new Map<string, { name: string; role: string | null }>();
    if (markerIds.length > 0) {
      const markers = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, activeRole: users.activeRole })
        .from(users)
        .where(inArray(users.id, markerIds));
      for (const m of markers) {
        const roleName = m.activeRole === 'TEACHING_ASSISTANT' ? 'TA' : m.activeRole === 'INSTRUCTOR' ? 'Instructor' : m.activeRole || 'System';
        markerMap.set(m.id, { name: `${m.firstName || ''} ${m.lastName || ''}`.trim(), role: roleName });
      }
    }

    // Build rows from existing attendance records
    const rows = filteredData.map((row) => {
      const pct = attendancePctMap.get(`${row.studentId}:${row.courseId}`) || '0.00%';

      // Per-lecture presence % — use actual duration (start→end) if available, else planned
      // Credit lobby wait: if student joined within 2 min of session start, add the gap
      const actualStartMs = row.actualStartedAt ? new Date(row.actualStartedAt).getTime() : null;
      const actualEndMs = row.actualEndedAt ? new Date(row.actualEndedAt).getTime() : null;
      const actualDurMin = actualStartMs && actualEndMs
        ? Math.round((actualEndMs - actualStartMs) / 60000)
        : null;
      const sessDur = actualDurMin && actualDurMin > 0 ? actualDurMin : (Number(row.sessionDurationMinutes) || 60);
      let studentDur = Number(row.durationMinutes);
      if (row.durationMinutes != null && actualStartMs && row.joinedAt) {
        const lobbyDelay = new Date(row.joinedAt).getTime() - actualStartMs;
        if (lobbyDelay > 0 && lobbyDelay <= 2 * 60000) {
          studentDur += Math.round(lobbyDelay / 60000);
        }
      }
      const presencePercent = row.durationMinutes != null && sessDur > 0
        ? Math.min(Math.round((studentDur / sessDur) * 100), 100)
        : 0;

      return [
        decryptPII(row.studentScfhsNumber) || '',
        `${row.studentFirstName || ''} ${row.studentLastName || ''}`.trim(),
        row.studentEmail || '',
        row.sessionDate ? new Date(row.sessionDate).toLocaleDateString('en-GB', { timeZone: userTz, day: '2-digit', month: 'short', year: 'numeric' }) : '',
        row.sessionTitle || '',
        row.status || '',
        row.joinedAt ? new Date(row.joinedAt).toLocaleTimeString('en-GB', { timeZone: userTz, hour: '2-digit', minute: '2-digit' }) : '',
        row.leftAt ? new Date(row.leftAt).toLocaleTimeString('en-GB', { timeZone: userTz, hour: '2-digit', minute: '2-digit' }) : '',
        row.durationMinutes != null ? String(row.durationMinutes) : '',
        presencePercent > 0 ? `${presencePercent}%` : '',
        pct,
        row.markedBy ? (markerMap.get(row.markedBy)?.name || '') : '',
        row.markedBy ? (markerMap.get(row.markedBy)?.role || '') : '',
        row.attendanceUpdatedAt ? new Date(row.attendanceUpdatedAt).toLocaleTimeString('en-GB', { timeZone: userTz, hour: '2-digit', minute: '2-digit' }) : '',
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
          decryptPII(student.scfhsNumber) || '',
          `${student.firstName || ''} ${student.lastName || ''}`.trim(),
          student.email || '',
          sess.scheduledAt ? new Date(sess.scheduledAt).toLocaleDateString('en-GB', { timeZone: userTz, day: '2-digit', month: 'short', year: 'numeric' }) : '',
          sess.title || '',
          'absent',
          '',
          '',
          '',
          '0%',
          pct,
          '',
          '',
          '',
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
    await this.loadPlatformLocale();

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
      exporterRole: this.resolveExporterRole(user),
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
    await this.loadPlatformLocale();
    const courseIds = await this.resolveCourseIds(user, params.courseId);
    const instructorName = await this.getInstructorName(user.id);

    const metadata: ReportMetadata = {
      instructorName,
      exporterRole: this.resolveExporterRole(user),
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
    await this.loadPlatformLocale();
    const courseIds = await this.resolveCourseIds(user, params.courseId);
    const instructorName = await this.getInstructorName(user.id);

    const metadata: ReportMetadata = {
      instructorName,
      exporterRole: this.resolveExporterRole(user),
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
  // ─── CME Eligibility Report ──────────────────────────────
  // ═══════════════════════════════════════════════════════════

  async generateCmeEligibilityReport(
    user: AuthenticatedUser,
    params: { courseId?: string; format?: string },
  ): Promise<ReportResult> {
    const format = this.validateFormat(params.format);
    await this.loadPlatformLocale();
    const courseIds = await this.resolveCourseIds(user, params.courseId);
    const metadata = await this.buildMetadata(user, params.courseId);

    const headers = [
      'Course',
      'CME Hours',
      'Student Name',
      'Email',
      'Enrollment Status',
      'Attendance %',
      'Assessment Passed',
      'CME Earned',
      'Reason (if not earned)',
    ];

    if (courseIds.length === 0) {
      return this.formatReport('CME Eligibility Report', headers, [], format, metadata);
    }

    // Get all CME-accredited courses
    const cmeCourses = await db
      .select({
        id: courses.id,
        title: courses.title,
        cmeHours: courses.cmeHours,
      })
      .from(courses)
      .where(inArray(courses.id, courseIds));

    const rows: string[][] = [];

    for (const course of cmeCourses) {
      const cmeHours = course.cmeHours || 0;

      // Get all enrollments for this course
      const enrollmentData = await db
        .select({
          studentId: enrollments.studentId,
          status: enrollments.status,
          progress: enrollments.progress,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        })
        .from(enrollments)
        .innerJoin(users, eq(enrollments.studentId, users.id))
        .where(eq(enrollments.courseId, course.id))
        .orderBy(asc(users.firstName));

      for (const enrollment of enrollmentData) {
        const studentName = `${enrollment.firstName || ''} ${enrollment.lastName || ''}`.trim();
        const isCompleted = enrollment.status === 'completed' || (enrollment.progress ?? 0) >= 100;

        // Attendance percentage for this student in this course's sessions
        const courseSessions = await db
          .select({ id: sessions.id })
          .from(sessions)
          .where(eq(sessions.courseId, course.id));

        let attendancePercent = 0;
        if (courseSessions.length > 0) {
          const sessionIds = courseSessions.map((s) => s.id);
          const [attStats] = await db
            .select({
              total: count(),
              present: sql<number>`COUNT(CASE WHEN ${attendance.status} IN ('present', 'late') THEN 1 END)`,
            })
            .from(attendance)
            .where(
              and(
                eq(attendance.studentId, enrollment.studentId),
                inArray(attendance.sessionId, sessionIds),
              ),
            );
          const totalAtt = Number(attStats?.total || 0);
          const presentAtt = Number(attStats?.present || 0);
          attendancePercent = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0;
        }

        // Assessment: check if student passed all assessments for this course
        const courseAssessmentList = await db
          .select({ id: assessments.id, passingMarks: assessments.passingMarks })
          .from(assessments)
          .where(eq(assessments.courseId, course.id));

        let assessmentPassed = true;
        let hasAssessments = courseAssessmentList.length > 0;
        if (hasAssessments) {
          for (const assessment of courseAssessmentList) {
            const [bestSubmission] = await db
              .select({ score: sql<number>`MAX(${submissions.score})` })
              .from(submissions)
              .where(
                and(
                  eq(submissions.assessmentId, assessment.id),
                  eq(submissions.studentId, enrollment.studentId),
                ),
              );
            const bestScore = Number(bestSubmission?.score || 0);
            const passingScore = assessment.passingMarks || 0;
            if (passingScore > 0 && bestScore < passingScore) {
              assessmentPassed = false;
            }
          }
        }

        // Determine CME eligibility
        const reasons: string[] = [];
        if (!isCompleted) reasons.push('Course not completed');
        if (attendancePercent < 75) reasons.push(`Attendance ${attendancePercent}% (min 75%)`);
        if (hasAssessments && !assessmentPassed) reasons.push('Assessment not passed');
        if (cmeHours === 0) reasons.push('No CME hours configured');

        const eligible = reasons.length === 0 && cmeHours > 0;

        rows.push([
          course.title,
          cmeHours.toString(),
          studentName,
          enrollment.email || '',
          isCompleted ? 'Completed' : `In Progress (${enrollment.progress || 0}%)`,
          `${attendancePercent}%`,
          hasAssessments ? (assessmentPassed ? 'Yes' : 'No') : 'N/A',
          eligible ? `Yes (${cmeHours}h)` : 'No',
          eligible ? '' : reasons.join('; '),
        ]);
      }
    }

    return this.formatReport('CME Eligibility Report', headers, rows, format, metadata);
  }

  // ═══════════════════════════════════════════════════════════
  // ─── Webinar Registrants Report ───────────────────────────
  // ═══════════════════════════════════════════════════════════

  /**
   * Export every webinar registrant the user can see — across all their
   * courses (or scoped to a single course / single session). Same rows
   * the manager's in-drawer "Download CSV" button surfaces, but rolled up
   * for the whole catalogue so they can pull a single audit-friendly file.
   */
  async generateWebinarRegistrantsReport(
    user: AuthenticatedUser,
    params: { courseId?: string; sessionId?: string; format?: string; tz?: string },
  ): Promise<ReportResult> {
    const format = this.validateFormat(params.format);
    await this.loadPlatformLocale();
    const userTz = params.tz || TZ;
    this.activeTz = userTz;
    const courseIds = await this.resolveCourseIds(user, params.courseId);
    const metadata = await this.buildMetadata(user, params.courseId);

    // The full audit set (CSV / XLSX). Payment + CME + certificate columns
    // sit at the end so Webinar Course audits surface all the SCFHS-relevant
    // fields in one row. Non-Webinar webinars leave those columns blank.
    // The PDF view below uses a slimmer subset for landscape-A4 readability.
    const fullHeaders = [
      'Course',
      'Webinar',
      'Webinar Date',
      'First Name',
      'Last Name',
      'Email',
      'Phone',
      'National ID / Iqama',
      'SCFHS Number',
      'Source',
      'Registration Status',
      'Registered At',
      'Attended',
      'Joined At',
      'Left At',
      'Attended Duration (min)',
      'Payment Status',
      'CME Hours',
      'Certificate Status',
    ];
    const pdfHeaders = [
      'Course',
      'Webinar',
      'Name',
      'Email',
      'Phone',
      'National ID',
      'Source',
      'Attended',
      'Min.',
      'Payment',
      'Cert',
    ];
    const isPdf = format === 'pdf';
    const headers = isPdf ? pdfHeaders : fullHeaders;

    if (courseIds.length === 0) {
      return this.formatReport(
        'Webinar Registrants Report',
        headers,
        [],
        format,
        metadata,
      );
    }

    const conditions: any[] = [
      inArray(sessions.courseId, courseIds),
      eq(sessions.isWebinar, true),
    ];
    if (params.sessionId) {
      conditions.push(eq(sessions.id, params.sessionId));
    }

    const rowsData = await db
      .select({
        courseId: courses.id,
        courseTitle: courses.title,
        courseDeliveryType: courses.deliveryType,
        courseCmeHours: courses.cmeHours,
        sessionTitle: sessions.title,
        scheduledAt: sessions.scheduledAt,
        firstName: webinarRegistrations.firstName,
        lastName: webinarRegistrations.lastName,
        email: webinarRegistrations.email,
        phone: webinarRegistrations.phone,
        nationalId: webinarRegistrations.nationalId,
        scfhsNumber: webinarRegistrations.scfhsNumber,
        userId: webinarRegistrations.userId,
        status: webinarRegistrations.status,
        registeredAt: webinarRegistrations.createdAt,
        attended: webinarRegistrations.attended,
        joinedAt: webinarRegistrations.joinedAt,
        leftAt: webinarRegistrations.leftAt,
        attendedMin: webinarRegistrations.attendedDurationMinutes,
      })
      .from(webinarRegistrations)
      .innerJoin(sessions, eq(webinarRegistrations.sessionId, sessions.id))
      .innerJoin(courses, eq(sessions.courseId, courses.id))
      .where(and(...conditions))
      .orderBy(
        asc(courses.title),
        asc(sessions.scheduledAt),
        asc(webinarRegistrations.createdAt),
      );

    // Pre-fetch payment + certificate status keyed by (userId, courseId) so
    // we don't N+1 across rows. Only relevant for registrants we matched
    // to a system user (external registrants stay blank).
    const userCourseKeys = Array.from(
      new Set(
        rowsData
          .filter((r) => r.userId)
          .map((r) => `${r.userId}|${r.courseId}`),
      ),
    );
    const paymentByKey = new Map<string, string>();
    const certStatusByKey = new Map<string, string>();
    if (userCourseKeys.length > 0) {
      const userIds = Array.from(
        new Set(rowsData.filter((r) => r.userId).map((r) => r.userId as string)),
      );
      const courseIdsForLookup = Array.from(
        new Set(rowsData.map((r) => r.courseId)),
      );
      const paymentRows = await db
        .select({
          userId: payments.userId,
          courseId: payments.courseId,
          status: payments.status,
          createdAt: payments.createdAt,
        })
        .from(payments)
        .where(
          and(
            inArray(payments.userId, userIds),
            inArray(payments.courseId, courseIdsForLookup),
          ),
        )
        .orderBy(desc(payments.createdAt));
      for (const p of paymentRows) {
        const key = `${p.userId}|${p.courseId}`;
        // First (latest by ORDER BY) wins per key.
        if (!paymentByKey.has(key)) paymentByKey.set(key, p.status);
      }
      const certRows = await db
        .select({
          studentId: certificateRequests.studentId,
          courseId: certificateRequests.courseId,
          status: certificateRequests.status,
        })
        .from(certificateRequests)
        .where(
          and(
            inArray(certificateRequests.studentId, userIds),
            inArray(certificateRequests.courseId, courseIdsForLookup),
          ),
        );
      for (const c of certRows) {
        certStatusByKey.set(`${c.studentId}|${c.courseId}`, c.status);
      }
    }

    const fmtNullable = (d: Date | null) =>
      d ? this.formatTimestamp(d) : '';
    const rows: string[][] = rowsData.map((r) => {
      const fullName = [r.firstName, r.lastName].filter(Boolean).join(' ');
      const source = r.userId ? 'Student' : 'External';
      const key = r.userId ? `${r.userId}|${r.courseId}` : null;
      const paymentStatus = key ? (paymentByKey.get(key) ?? '') : '';
      const certStatus = key ? (certStatusByKey.get(key) ?? '') : '';
      // CME hours only meaningful for Webinar Courses where attendance =
      // certificate eligibility. For non-Webinar webinars the CME column
      // would mislead, so blank it.
      const cmeHours =
        r.courseDeliveryType === 'webinar'
          ? String(r.courseCmeHours ?? 0)
          : '';
      if (isPdf) {
        return [
          r.courseTitle ?? '',
          r.sessionTitle ?? '',
          fullName,
          r.email ?? '',
          r.phone ?? '',
          r.nationalId ?? '',
          source,
          r.attended ? 'Yes' : 'No',
          String(r.attendedMin ?? 0),
          paymentStatus || '—',
          certStatus || '—',
        ];
      }
      return [
        r.courseTitle ?? '',
        r.sessionTitle ?? '',
        this.formatTimestamp(r.scheduledAt),
        r.firstName ?? '',
        r.lastName ?? '',
        r.email ?? '',
        r.phone ?? '',
        r.nationalId ?? '',
        r.scfhsNumber ?? '',
        source,
        r.status ?? '',
        this.formatTimestamp(r.registeredAt),
        r.attended ? 'Yes' : 'No',
        fmtNullable(r.joinedAt),
        fmtNullable(r.leftAt),
        String(r.attendedMin ?? 0),
        paymentStatus,
        cmeHours,
        certStatus,
      ];
    });

    return this.formatReport(
      'Webinar Registrants Report',
      headers,
      rows,
      format,
      metadata,
    );
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
    await this.loadPlatformLocale();
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

      // Avg assessment score — applies each assessment's retakeScorePolicy to
      // pick the effective attempt per (student, assessment) before averaging.
      // Naive AVG(submissions.score) double-counts retakes and breaks the
      // metric whenever a student has multiple attempts.
      const courseSubs = await db
        .select({
          id: submissions.id,
          assessmentId: submissions.assessmentId,
          studentId: submissions.studentId,
          score: submissions.score,
          submittedAt: submissions.submittedAt,
          createdAt: submissions.createdAt,
          retakeScorePolicy: assessments.retakeScorePolicy,
        })
        .from(submissions)
        .innerJoin(assessments, eq(submissions.assessmentId, assessments.id))
        .where(eq(assessments.courseId, course.courseId));

      // Group by (assessmentId, studentId) and pick the effective attempt
      const grouped = new Map<string, typeof courseSubs>();
      for (const s of courseSubs) {
        const key = `${s.assessmentId}::${s.studentId}`;
        const list = grouped.get(key);
        if (list) list.push(s);
        else grouped.set(key, [s]);
      }
      const effectiveScores: number[] = [];
      for (const [, attempts] of grouped) {
        const policy = attempts[0].retakeScorePolicy || 'highest';
        const eff = computeEffectiveScore(
          attempts.map((a) => ({
            id: a.id,
            score: a.score,
            orderedAt: a.submittedAt || a.createdAt,
          })),
          policy,
        );
        if (eff.score !== null) effectiveScores.push(eff.score);
      }
      const avgEffective =
        effectiveScores.length > 0
          ? Math.round((effectiveScores.reduce((a, b) => a + b, 0) / effectiveScores.length) * 10) / 10
          : null;

      rows.push([
        course.title,
        String(totalEnrolled),
        String(completedCount),
        `${completionRate}%`,
        `${attRate}%`,
        avgEffective != null ? String(avgEffective) : 'N/A',
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
    await this.loadPlatformLocale();

    if (!hasAdminScope(user) && !hasManagerScope(user)) {
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
    await this.loadPlatformLocale();
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
    return { instructorName, exporterRole: this.resolveExporterRole(user), filters };
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
    await this.loadPlatformLocale();
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
    await this.loadPlatformLocale();
    const instructorName = await this.getInstructorName(user.id);

    const filterParts: string[] = [];
    if (params.dateFrom) filterParts.push(`From: ${params.dateFrom}`);
    if (params.dateTo) filterParts.push(`To: ${params.dateTo}`);

    const metadata: ReportMetadata = {
      instructorName,
      exporterRole: this.resolveExporterRole(user),
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
      enrollConditions.push(gte(enrollments.enrolledAt, new Date(`${params.dateFrom}T00:00:00+03:00`)));
    }
    if (params.dateTo) {
      enrollConditions.push(lte(enrollments.enrolledAt, new Date(`${params.dateTo}T23:59:59+03:00`)));
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
    await this.loadPlatformLocale();

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
        and(
          sql`${courseMaterials.status} IN ('pending_review', 'changes_requested')`,
          isNull(courseMaterials.deletedAt),
        ),
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
    const date = new Date().toLocaleDateString('en-CA', { timeZone: this.activeTz });
    // Build filename: courseName-reportType-date.ext
    const courseMatch = metadata?.filters?.match(/^Course:\s*(.+)$/);
    const coursePart = courseMatch ? courseMatch[1].trim().replace(/[^a-zA-Z0-9\u0600-\u06FF\s-]/g, '').replace(/\s+/g, '-') + '-' : '';
    const slug = title.toLowerCase().replace(/\s+/g, '-');
    const ext = format;
    const filename = `${coursePart}${slug}-${date}.${ext}`;

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
      const label = metadata.exporterRole
        ? EXPORTER_LABEL[metadata.exporterRole]
        : 'Generated by';
      metaLines.push(`# ${label}: ${metadata.instructorName}`);
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

    const logger = this.logger;
    return new Promise<Buffer>((resolve, reject) => {
      // Everything inside pdfkit's synchronous drawing pipeline can throw
      // (font swaps, addPage callbacks, layout overflow, etc). Without this
      // wrapper those throws bubble out of the executor as an unhandled
      // rejection and the controller returns a bare 500 with no context.
      try {
      // Top margin leaves room for the branded title band (drawn manually
      // on every page so the layout looks like a designed report, not a
      // raw table dump).
      const TITLE_BAND_H = 56;
      const doc = new PDFDocument({
        margins: { top: TITLE_BAND_H + 18, bottom: 28, left: 25, right: 25 },
        size: 'A4',
        layout: 'landscape',
        bufferPages: true, // needed to back-fill "Page X of Y" after end
      });

      // Register Arabic font
      if (arabicFontBuf) {
        doc.registerFont('Amiri', arabicFontBuf);
      }

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      // Log the real error to Cloud Run before propagating — without this the
      // controller just emits a bare "Internal server error" JSON with no clue.
      doc.on('error', (err: unknown) => {
        const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
        logger.error(`PDF generation failed [title=${title}, rows=${rows.length}]: ${msg}`);
        reject(err);
      });

      // PhysioGuidance brand palette — kept close to existing UI.
      const BRAND_PRIMARY = '#002D87'; // deep blue title band
      const HEADER_ROW_FILL = '#EEF2FF'; // very light indigo
      const ZEBRA_FILL = '#F7F8FB'; // near-white tint for alt rows
      const BORDER_LINE = '#D1D5DB';
      const TEXT_MUTED = '#4B5563';

      const pageWidth =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const startX = doc.page.margins.left;

      // Smart column widths — wider for name/email/reason, narrower for status/numbers
      const wideColumns = new Set(['Student Name', 'Student', 'Name', 'Email', 'Instructor', 'Course', 'Session', 'Webinar', 'Reason (if not earned)']);
      const wrapColumns = new Set(['Reason (if not earned)']);
      const defaultColWidth = pageWidth / headers.length;
      const wideCount = headers.filter(h => wideColumns.has(h)).length;
      const narrowCount = headers.length - wideCount;
      const widePct = headers.length > 7 ? 0.6 : 0.55;
      const wideWidth = wideCount > 0 ? (pageWidth * widePct) / wideCount : defaultColWidth;
      const narrowWidth = narrowCount > 0 ? (pageWidth * (1 - widePct)) / narrowCount : defaultColWidth;
      const colWidths = headers.map(h => wideColumns.has(h) ? wideWidth : narrowWidth);
      const getColX = (i: number) => startX + colWidths.slice(0, i).reduce((s, w) => s + w, 0);

      // Draws the branded title band + metadata. Called on every page so
      // multi-page reports stay consistent and self-identifying.
      const drawTitleBand = () => {
        // Filled brand bar
        doc.save();
        doc.rect(0, 0, doc.page.width, TITLE_BAND_H).fill(BRAND_PRIMARY);
        doc.restore();

        // White title + subtle PG mark
        doc.fillColor('white').font('Helvetica-Bold').fontSize(16);
        doc.text(title, startX, 14, {
          width: pageWidth,
          align: 'left',
          lineBreak: false,
        });
        doc.font('Helvetica').fontSize(9).fillColor('#CBD5E1');
        const metaBits: string[] = [];
        if (metadata?.instructorName) {
          const label = metadata.exporterRole
            ? EXPORTER_LABEL[metadata.exporterRole]
            : 'Generated by';
          metaBits.push(`${label}: ${metadata.instructorName}`);
        }
        if (metadata?.filters) metaBits.push(`Filters: ${metadata.filters}`);
        metaBits.push(`Generated: ${this.formatTimestamp(new Date())}`);
        doc.text(metaBits.join('  ·  '), startX, 34, {
          width: pageWidth,
          align: 'left',
          lineBreak: false,
        });

        // Brand mark on the right
        doc.font('Helvetica-Bold').fontSize(11).fillColor('white');
        doc.text('PhysioGuidance', startX, 18, {
          width: pageWidth,
          align: 'right',
          lineBreak: false,
        });
        doc.font('Helvetica').fontSize(8).fillColor('#CBD5E1');
        doc.text('NELC Compliant Report', startX, 34, {
          width: pageWidth,
          align: 'right',
          lineBreak: false,
        });

        doc.fillColor('black');
      };

      // Shorten long header names for the PDF column heads.
      const shortHeaders: Record<string, string> = {
        'RegistrationClassificationNumber': 'Reg. No.',
        'Student Name': 'Student',
        'Session Date': 'Date',
        'Total Minutes': 'Min.',
        'Total Attendance %': 'Att. %',
        'Completion Status': 'Status',
        'Join Time': 'Join',
        'Leave Time': 'Leave',
        'Reason (if not earned)': 'Reason',
        'Enrollment Status': 'Status',
        'Assessment Passed': 'Assess.',
        'CME Earned': 'CME',
        'Attendance %': 'Att. %',
        'CME Hours': 'Hours',
      };

      const centerHeaderColumns = new Set(['Min.', 'Att. %', 'Status', 'Total Minutes', 'Total Attendance %']);
      const HEADER_ROW_H = 16;

      // Draws the table header row at current `y` and advances `y`.
      // Filled background + bold text + bottom border.
      const drawHeaders = () => {
        doc.save();
        doc.rect(startX, y, pageWidth, HEADER_ROW_H).fill(HEADER_ROW_FILL);
        doc.restore();

        doc.fontSize(7).font('Helvetica-Bold').fillColor(BRAND_PRIMARY);
        headers.forEach((header, i) => {
          doc.text(shortHeaders[header] || header, getColX(i) + 2, y + 4, {
            width: colWidths[i] - 4,
            lineBreak: false,
            align: centerHeaderColumns.has(header) ? 'center' : undefined,
          });
        });
        y += HEADER_ROW_H;

        doc
          .strokeColor(BORDER_LINE)
          .lineWidth(0.5)
          .moveTo(startX, y)
          .lineTo(startX + pageWidth, y)
          .stroke();
        y += 4;
        doc.font('Helvetica').fontSize(6.5).fillColor('black');
      };

      // First page setup.
      drawTitleBand();
      let y = doc.page.margins.top;
      drawHeaders();

      // Hook future pages to redraw the title band + headers so the
      // report identifies itself on every sheet.
      doc.on('pageAdded', () => {
        drawTitleBand();
        y = doc.page.margins.top;
        drawHeaders();
      });

      // ── Data rows ──
      let rowIndex = 0;
      const centerColumns = centerHeaderColumns;
      for (const row of rows) {
        // Calculate row height — wrap-allowed columns may push it up.
        const rowHeight = row.reduce((maxH, cell, i) => {
          if (wrapColumns.has(headers[i]) && cell && cell.length > 30) {
            const lines = Math.ceil(cell.length / 40);
            return Math.max(maxH, lines * 8 + 4);
          }
          return maxH;
        }, 12);

        // Page break check — leave room for the footer line.
        if (y + rowHeight > doc.page.height - doc.page.margins.bottom - 4) {
          doc.addPage();
          // `pageAdded` hook has redrawn title + headers and reset `y`
        }

        // Zebra stripe — fill the row background on every other row.
        if (rowIndex % 2 === 1) {
          doc.save();
          doc.rect(startX, y - 2, pageWidth, rowHeight).fill(ZEBRA_FILL);
          doc.restore();
        }

        row.forEach((cell, i) => {
          const cellText = String(cell ?? '');
          const allowWrap = wrapColumns.has(headers[i]);
          const align = centerColumns.has(headers[i]) ? 'center' as const : undefined;

          // Use Arabic font if cell contains Arabic characters
          if (arabicFontBuf && hasArabic(cellText)) {
            doc.font('Amiri').fontSize(6.5).fillColor('black');
            doc.text(cellText, getColX(i) + 2, y, {
              width: colWidths[i] - 4,
              lineBreak: allowWrap,
              align,
              features: ['rtla'],
            });
            doc.font('Helvetica').fontSize(6.5);
          } else {
            doc.fillColor('black');
            doc.text(cellText, getColX(i) + 2, y, {
              width: colWidths[i] - 4,
              lineBreak: allowWrap,
              align,
            });
          }
        });
        y += rowHeight;
        rowIndex++;
      }

      // Back-fill "Page X of Y" + record count on every page. Requires
      // `bufferPages: true` above so pages are still mutable here.
      const range = doc.bufferedPageRange();
      const totalPages = range.count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(range.start + i);
        const footerY = doc.page.height - doc.page.margins.bottom + 4;
        doc.font('Helvetica').fontSize(7).fillColor(TEXT_MUTED);
        doc.text(
          `Total records: ${rows.length}  ·  PhysioGuidance — Confidential`,
          startX,
          footerY,
          { width: pageWidth, align: 'left', lineBreak: false },
        );
        doc.text(
          `Page ${i + 1} of ${totalPages}`,
          startX,
          footerY,
          { width: pageWidth, align: 'right', lineBreak: false },
        );
      }

      try {
        doc.end();
      } catch (err) {
        const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
        logger.error(`PDF doc.end() threw [title=${title}, rows=${rows.length}]: ${msg}`);
        reject(err);
      }
      } catch (err) {
        const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
        logger.error(`PDF sync throw [title=${title}, rows=${rows.length}]: ${msg}`);
        reject(err);
      }
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

    // Exporter row (role-aware — "Administrator: …" / "Manager: …" / etc.)
    if (metadata?.instructorName) {
      const label = metadata.exporterRole
        ? EXPORTER_LABEL[metadata.exporterRole]
        : 'Generated by';
      const instrRow = worksheet.addRow([`${label}: ${metadata.instructorName}`]);
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
    // Get parts in the active timezone, then re-assemble using admin's dateFormat
    const tzDate = new Date(d.toLocaleString('en-US', { timeZone: this.activeTz }));
    const datePart = fmtPlatformDate(tzDate, this.activeLocale);
    const hm = d.toLocaleTimeString('en-GB', {
      timeZone: this.activeTz,
      hour: '2-digit',
      minute: '2-digit',
    });
    const time =
      this.activeLocale.numberSystem === 'arabic_indic' ? toArabicIndic(hm) : hm;
    return `${datePart} ${time}`;
  }

  private formatDateTime(date: Date | string | null | undefined): string {
    return this.formatDate(date);
  }

  private formatTimestamp(date: Date): string {
    return this.formatDate(date);
  }

  /** Convert a YYYY-MM-DD string to start of day (00:00:00) in the given timezone */
  private toStartOfDayInTz(dateStr: string, tz: string): Date {
    // Create a date at midnight in the target timezone by finding the UTC offset
    const probe = new Date(`${dateStr}T12:00:00Z`); // noon UTC to avoid DST edge cases
    const localStr = probe.toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD in tz
    const midnightLocal = new Date(`${localStr}T00:00:00`);
    // Get the offset by comparing local representation
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false, timeZoneName: 'shortOffset' });
    const parts = formatter.formatToParts(probe);
    const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value || '+03:00';
    const offsetMatch = offsetPart.match(/GMT([+-]\d{1,2}(?::?\d{2})?)/);
    const offset = offsetMatch ? offsetMatch[1].replace(/^([+-])(\d)$/, '$10$2').replace(/^([+-]\d{2})$/, '$1:00') : '+03:00';
    return new Date(`${dateStr}T00:00:00${offset}`);
  }

  /** Convert a YYYY-MM-DD string to end of day (23:59:59) in the given timezone */
  private toEndOfDayInTz(dateStr: string, tz: string): Date {
    const probe = new Date(`${dateStr}T12:00:00Z`);
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false, timeZoneName: 'shortOffset' });
    const parts = formatter.formatToParts(probe);
    const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value || '+03:00';
    const offsetMatch = offsetPart.match(/GMT([+-]\d{1,2}(?::?\d{2})?)/);
    const offset = offsetMatch ? offsetMatch[1].replace(/^([+-])(\d)$/, '$10$2').replace(/^([+-]\d{2})$/, '$1:00') : '+03:00';
    return new Date(`${dateStr}T23:59:59${offset}`);
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

    if (hasAdminScope(user)) {
      const allCourses = await db
        .select({ id: courses.id })
        .from(courses);
      return allCourses.map((c) => c.id);
    }

    if (hasManagerScope(user)) {
      const managedCourses = await db
        .select({ id: courses.id })
        .from(courses)
        .where(or(eq(courses.managerId, user.id), sql`${courses.managerId} IS NULL`));
      return managedCourses.map((c) => c.id);
    }

    if (isTA(user)) {
      const taCourses = await db
        .select({ id: courseAssistants.courseId })
        .from(courseAssistants)
        .where(and(eq(courseAssistants.userId, user.id), eq(courseAssistants.status, 'approved')));
      return taCourses.map((c) => c.id);
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
