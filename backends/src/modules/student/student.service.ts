import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, and, desc, asc, count, sql, ilike, or, gte, lte } from 'drizzle-orm';
import { db } from '../../database';
import {
  enrollments,
  courses,
  courseModules,
  sessions,
  assessments,
  submissions,
  certificateRequests,
  attendance,
  users,
  questions,
  courseMaterials,
  materialVariants,
  materialProgress,
  tickets,
  ticketReplies,
  COURSE_STATUS,
  NELC_EVENT_TYPE,
  videoWatchEvents,
  assessmentRetakeGrants,
} from '../../database/schema';
import type { SubmissionAnswer } from '../../database/schema/submissions';
import { computeEffectiveScore } from '../../common/score-policy';
import { ThresholdEvaluationService } from '../course-assistants/threshold-evaluation.service';
import type { AssessmentFile } from '../../database/schema/assessments';
import { randomUUID } from 'crypto';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { NelcAuditService } from '../nelc-audit/nelc-audit.service';
import { StorageService } from '../storage/storage.service';
import {
  classifyCourse,
  getNelcMaxEnrollment,
} from '../courses/nelc-config';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ReplyTicketDto } from './dto/reply-ticket.dto';
import { RateTicketDto } from './dto/rate-ticket.dto';
import { CertificatesService } from '../certificates/certificates.service';
import { UserNotificationsService } from '../user-notifications/user-notifications.service';
import { EmailService } from '../email/email.service';
import { createHash } from 'crypto';

/** Deterministic seeded shuffle using LCG PRNG (Fisher-Yates) */
function seededShuffle<T>(array: T[], seed: number): T[] {
  const result = [...array];
  let s = seed >>> 0;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Create a numeric seed from string inputs */
function makeSeed(...parts: string[]): number {
  const hash = createHash('md5').update(parts.join(':')).digest();
  return hash.readUInt32BE(0);
}

@Injectable()
export class StudentService {
  private readonly logger = new Logger(StudentService.name);

  constructor(
    private readonly auditService: NelcAuditService,
    private readonly certificatesService: CertificatesService,
    private readonly storageService: StorageService,
    private readonly userNotificationsService: UserNotificationsService,
    private readonly emailService: EmailService,
    private readonly thresholdEvaluationService: ThresholdEvaluationService,
  ) {}

  // ─── Dashboard Stats ────────────────────────────────────

  async getDashboardStats(studentId: string) {
    // Run all counts in parallel
    const [
      enrolledResult,
      completedResult,
      inProgressResult,
      certificatesResult,
      upcomingSessionsResult,
      avgProgressResult,
      attendanceResult,
      certsPendingResult,
      certsExpiringResult,
      avgScoreResult,
    ] = await Promise.all([
      // Total enrolled (active + completed)
      db
        .select({ count: count() })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.studentId, studentId),
            or(
              eq(enrollments.status, 'active'),
              eq(enrollments.status, 'completed'),
            ),
          ),
        ),
      // Completed courses
      db
        .select({ count: count() })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.studentId, studentId),
            eq(enrollments.status, 'completed'),
          ),
        ),
      // In-progress courses (active status)
      db
        .select({ count: count() })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.studentId, studentId),
            eq(enrollments.status, 'active'),
          ),
        ),
      // Certificates earned (approved)
      db
        .select({ count: count() })
        .from(certificateRequests)
        .where(
          and(
            eq(certificateRequests.studentId, studentId),
            eq(certificateRequests.status, 'approved'),
          ),
        ),
      // Upcoming sessions (from enrolled courses — exclude unassigned make-ups)
      db
        .select({ count: count() })
        .from(sessions)
        .innerJoin(enrollments, eq(sessions.courseId, enrollments.courseId))
        .where(
          and(
            eq(enrollments.studentId, studentId),
            eq(enrollments.status, 'active'),
            eq(sessions.status, 'scheduled'),
            gte(sessions.scheduledAt, new Date()),
            sql`(${sessions.isMakeup} = false OR ${sessions.assignedStudents} IS NULL OR ${sessions.assignedStudents}::jsonb @> ${JSON.stringify([studentId])}::jsonb)`,
          ),
        ),
      // Average progress across active enrollments
      db
        .select({
          avgProgress: sql<number>`COALESCE(AVG(${enrollments.progress}), 0)`.mapWith(Number),
        })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.studentId, studentId),
            eq(enrollments.status, 'active'),
          ),
        ),
      // Attendance stats (across all enrolled courses — only completed/ended sessions, exclude unassigned make-ups)
      db
        .select({
          totalSessions: sql<number>`COUNT(DISTINCT ${sessions.id})`.mapWith(Number),
          attendedSessions: sql<number>`COUNT(DISTINCT CASE WHEN ${attendance.status} IN ('present', 'late') THEN ${attendance.sessionId} END)`.mapWith(Number),
        })
        .from(sessions)
        .innerJoin(enrollments, eq(sessions.courseId, enrollments.courseId))
        .leftJoin(
          attendance,
          and(
            eq(attendance.sessionId, sessions.id),
            eq(attendance.studentId, studentId),
          ),
        )
        .where(
          and(
            eq(enrollments.studentId, studentId),
            eq(enrollments.status, 'active'),
            sql`${sessions.status} IN ('completed', 'ended')`,
            sql`(${sessions.isMakeup} = false OR ${sessions.assignedStudents} IS NULL OR ${sessions.assignedStudents}::jsonb @> ${JSON.stringify([studentId])}::jsonb)`,
          ),
        ),
      // Certificates pending
      db
        .select({ count: count() })
        .from(certificateRequests)
        .where(
          and(
            eq(certificateRequests.studentId, studentId),
            eq(certificateRequests.status, 'pending'),
          ),
        ),
      // Certificates expiring soon (approved + course ending within 30 days)
      db
        .select({ count: count() })
        .from(certificateRequests)
        .innerJoin(courses, eq(certificateRequests.courseId, courses.id))
        .where(
          and(
            eq(certificateRequests.studentId, studentId),
            eq(certificateRequests.status, 'approved'),
            sql`${courses.endDate} IS NOT NULL AND ${courses.endDate} <= CURRENT_DATE + INTERVAL '30 days' AND ${courses.endDate} >= CURRENT_DATE`,
          ),
        ),
      // Average score from graded submissions
      db
        .select({
          avgScore: sql<number>`COALESCE(AVG(${submissions.percentage}::numeric), 0)`.mapWith(Number),
        })
        .from(submissions)
        .where(
          and(
            eq(submissions.studentId, studentId),
            eq(submissions.status, 'graded'),
          ),
        ),
    ]);

    // Next upcoming session (separate query - needs full row not count)
    const [nextSessionResult] = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
        scheduledAt: sessions.scheduledAt,
        durationMinutes: sessions.durationMinutes,
        sessionType: sessions.type,
        zoomLink: sessions.zoomLink,
        roomName: sessions.roomName,
        venueAddress: sessions.venueAddress,
        instructorName: sql<string>`(
          SELECT CONCAT(u.first_name, ' ', u.last_name) FROM users u
          WHERE u.id = ${courses.instructorId}
        )`,
      })
      .from(sessions)
      .innerJoin(courses, eq(sessions.courseId, courses.id))
      .innerJoin(enrollments, eq(sessions.courseId, enrollments.courseId))
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.status, 'active'),
          or(eq(sessions.status, 'scheduled'), eq(sessions.status, 'live')),
          gte(sessions.scheduledAt, new Date()),
          // Exclude make-up lectures not assigned to this student
          sql`(${sessions.isMakeup} = false OR ${sessions.assignedStudents} IS NULL OR ${sessions.assignedStudents}::jsonb @> ${JSON.stringify([studentId])}::jsonb)`,
        ),
      )
      .orderBy(asc(sessions.scheduledAt))
      .limit(1);

    const totalSessions = Number(attendanceResult[0]?.totalSessions || 0);
    const sessionsAttended = Number(attendanceResult[0]?.attendedSessions || 0);
    const attendanceRate =
      totalSessions > 0
        ? Number(((sessionsAttended / totalSessions) * 100).toFixed(1))
        : 0;

    return {
      enrolledCourses: Number(enrolledResult[0]?.count || 0),
      completedCourses: Number(completedResult[0]?.count || 0),
      inProgressCourses: Number(inProgressResult[0]?.count || 0),
      averageScore: Number(Number(avgScoreResult[0]?.avgScore || 0).toFixed(1)),
      certificatesEarned: Number(certificatesResult[0]?.count || 0),
      upcomingSessions: Number(upcomingSessionsResult[0]?.count || 0),
      // New KPI fields
      averageProgress: Number(Number(avgProgressResult[0]?.avgProgress || 0).toFixed(1)),
      attendanceRate,
      sessionsAttended,
      totalSessions,
      certificatesPending: Number(certsPendingResult[0]?.count || 0),
      certificatesExpiringSoon: Number(certsExpiringResult[0]?.count || 0),
      nextSession: nextSessionResult
        ? {
            id: nextSessionResult.id,
            title: nextSessionResult.title,
            courseTitle: nextSessionResult.courseTitle,
            courseTitleAr: nextSessionResult.courseTitleAr,
            scheduledAt: nextSessionResult.scheduledAt,
            durationMinutes: nextSessionResult.durationMinutes,
            sessionType: nextSessionResult.sessionType,
            zoomLink: nextSessionResult.zoomLink,
            roomName: nextSessionResult.roomName,
            venueAddress: nextSessionResult.venueAddress,
            instructorName: nextSessionResult.instructorName,
          }
        : null,
    };
  }

  // ─── Enrolled Courses ───────────────────────────────────

  async getEnrolledCourses(
    studentId: string,
    params: {
      status?: string;
      search?: string;
      page?: number;
      limit?: number;
      sort?: string;
    },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [
      eq(enrollments.studentId, studentId),
    ];

    // Filter by enrollment status
    // When "all" or undefined, show ALL enrollments including dropped
    if (params.status && params.status !== 'all') {
      conditions.push(eq(enrollments.status, params.status));
    }

    // Search by course title
    if (params.search) {
      const searchTerm = `%${params.search}%`;
      conditions.push(
        or(
          ilike(courses.title, searchTerm),
          ilike(courses.titleAr, searchTerm),
        ) as any,
      );
    }

    const whereClause = and(...conditions);

    const data = await db
      .select({
        id: courses.id,
        title: courses.title,
        titleAr: courses.titleAr,
        description: courses.description,
        descriptionAr: courses.descriptionAr,
        deliveryType: courses.deliveryType,
        thumbnail: courses.thumbnail,
        startDate: courses.startDate,
        endDate: courses.endDate,
        enrollmentId: enrollments.id,
        enrollmentStatus: enrollments.status,
        progress: enrollments.progress,
        enrolledAt: enrollments.enrolledAt,
        completedAt: enrollments.completedAt,
        lastAccessedAt: enrollments.lastAccessedAt,
        instructorName: sql<string>`(
          SELECT CONCAT(u.first_name, ' ', u.last_name) FROM users u
          WHERE u.id = ${courses.instructorId}
        )`,
        instructorAvatar: sql<string | null>`(
          SELECT u.avatar FROM users u WHERE u.id = ${courses.instructorId}
        )`,
        totalModules: sql<number>`(
          SELECT COUNT(*) FROM course_modules cm WHERE cm.course_id = "courses"."id"
        )`.mapWith(Number),
        totalHours: sql<number>`(
          SELECT COALESCE(SUM(cm.duration_minutes), 0) FROM course_modules cm WHERE cm.course_id = "courses"."id"
        )`.mapWith(Number),
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(whereClause)
      .orderBy(
        sql`CASE ${enrollments.status}
          WHEN 'active' THEN 1
          WHEN 'completed' THEN 2
          WHEN 'dropped' THEN 3
          WHEN 'suspended' THEN 4
          ELSE 5
        END`,
        params.sort === 'recent'
          ? desc(enrollments.lastAccessedAt)
          : params.sort === 'completed_date'
            ? desc(enrollments.completedAt)
            : params.sort === 'start_date'
              ? asc(courses.startDate)
              : desc(enrollments.enrolledAt),
      )
      .limit(limit)
      .offset(offset);

    // Batch enrich with missing tasks, next deadline, and next action
    const courseIds = data.map((c) => c.id);

    let missingTasksMap: Record<string, { count: number; assignmentCount: number }> = {};
    let nextSessionsMap: Record<string, { scheduledAt: Date; sessionType: string; zoomLink: string | null }> = {};
    let attendanceMap: Record<string, { total: number; attended: number }> = {};

    if (courseIds.length > 0) {
      // Count unsubmitted published assessments per course (with assignment type breakdown)
      const missingTasks = await db
        .select({
          courseId: assessments.courseId,
          cnt: count(),
          assignmentCnt: sql<number>`COUNT(CASE WHEN ${assessments.type} = 'assignment' THEN 1 END)`.mapWith(Number),
        })
        .from(assessments)
        .leftJoin(
          submissions,
          and(
            eq(submissions.assessmentId, assessments.id),
            eq(submissions.studentId, studentId),
          ),
        )
        .where(
          and(
            sql`${assessments.courseId} IN (${sql.join(courseIds.map((id) => sql`${id}`), sql`, `)})`,
            eq(assessments.status, 'published'),
            sql`${submissions.id} IS NULL`,
          ),
        )
        .groupBy(assessments.courseId);

      missingTasksMap = Object.fromEntries(
        missingTasks.map((r) => [r.courseId, { count: Number(r.cnt), assignmentCount: Number(r.assignmentCnt) }]),
      );

      // Next upcoming session per course (exclude unassigned make-ups)
      const nextSessions = await db.execute(sql`
        SELECT DISTINCT ON (s.course_id)
          s.course_id AS "courseId",
          s.scheduled_at AS "scheduledAt",
          s.type AS "sessionType",
          s.zoom_link AS "zoomLink"
        FROM sessions s
        WHERE s.course_id IN (${sql.join(courseIds.map((id) => sql`${id}`), sql`, `)})
          AND s.status IN ('scheduled', 'live')
          AND s.scheduled_at >= NOW()
          AND (s.is_makeup = false OR s.assigned_students IS NULL OR s.assigned_students::jsonb @> ${JSON.stringify([studentId])}::jsonb)
        ORDER BY s.course_id, s.scheduled_at ASC
      `);

      for (const row of nextSessions.rows as any[]) {
        nextSessionsMap[row.courseId] = {
          scheduledAt: new Date(row.scheduledAt),
          sessionType: row.sessionType,
          zoomLink: row.zoomLink,
        };
      }

      // Per-course attendance stats (only completed/ended, exclude cancelled and unassigned make-ups)
      const attendanceStats = await db.execute(sql`
        SELECT s.course_id AS "courseId",
          COUNT(*) AS "total",
          COUNT(CASE WHEN a.status IN ('present', 'late') THEN 1 END) AS "attended"
        FROM sessions s
        LEFT JOIN attendance a ON a.session_id = s.id AND a.student_id = ${studentId}
        WHERE s.course_id IN (${sql.join(courseIds.map((id) => sql`${id}`), sql`, `)})
          AND s.status IN ('completed', 'ended')
          AND (s.is_makeup = false OR s.assigned_students IS NULL OR s.assigned_students::jsonb @> ${JSON.stringify([studentId])}::jsonb)
        GROUP BY s.course_id
      `);

      for (const row of attendanceStats.rows as any[]) {
        attendanceMap[row.courseId] = {
          total: Number(row.total),
          attended: Number(row.attended),
        };
      }
    }

    const enriched = data.map((c) => {
      const missingInfo = missingTasksMap[c.id] || { count: 0, assignmentCount: 0 };
      const missingTasksCount = missingInfo.count;
      const nextSess = nextSessionsMap[c.id];
      const nextDeadline = nextSess ? nextSess.scheduledAt.toISOString() : null;
      const att = attendanceMap[c.id] || { total: 0, attended: 0 };
      const attendanceRate = att.total > 0 ? Math.round((att.attended / att.total) * 100) : 0;

      // Determine the appropriate action for missing assessments
      const missingAssessmentAction =
        missingInfo.assignmentCount > 0 ? 'upload_assignment' : 'take_quiz';

      // Compute next action
      let nextAction = 'start_course';
      if (nextSess) {
        const diff = nextSess.scheduledAt.getTime() - Date.now();
        if (diff <= 15 * 60 * 1000 && (nextSess.sessionType === 'zoom' || nextSess.sessionType === 'blended')) {
          nextAction = 'join_zoom';
        } else if (missingTasksCount > 0) {
          nextAction = missingAssessmentAction;
        } else if (c.progress > 0) {
          nextAction = 'resume_lesson';
        }
      } else if (missingTasksCount > 0) {
        nextAction = missingAssessmentAction;
      } else if (c.progress > 0) {
        nextAction = 'resume_lesson';
      }

      return {
        ...c,
        totalHours: Math.round((c.totalHours / 60) * 10) / 10,
        missingTasksCount,
        nextDeadline,
        nextAction,
        sessionsAttended: att.attended,
        totalSessions: att.total,
        attendanceRate,
      };
    });

    const [countResult] = await db
      .select({ count: count() })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(whereClause);

    return {
      data: enriched,
      total: Number(countResult?.count || 0),
      page,
      limit,
      totalPages: Math.ceil(Number(countResult?.count || 0) / limit),
    };
  }

  // ─── Course Detail (for Learning Page) ──────────────────

  async getEnrolledCourseDetail(studentId: string, courseId: string) {
    // Verify student is enrolled
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.courseId, courseId),
          or(
            eq(enrollments.status, 'active'),
            eq(enrollments.status, 'completed'),
          ),
        ),
      )
      .limit(1);

    if (!enrollment) {
      throw new NotFoundException('You are not enrolled in this course');
    }

    // Get course with instructor info
    const [course] = await db
      .select({
        id: courses.id,
        title: courses.title,
        titleAr: courses.titleAr,
        description: courses.description,
        descriptionAr: courses.descriptionAr,
        deliveryType: courses.deliveryType,
        thumbnail: courses.thumbnail,
        startDate: courses.startDate,
        endDate: courses.endDate,
        isCmeAccredited: courses.isCmeAccredited,
        cmeHours: courses.cmeHours,
        instructorName: sql<string>`(
          SELECT CONCAT(u.first_name, ' ', u.last_name) FROM users u
          WHERE u.id = ${courses.instructorId}
        )`,
      })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    // Get modules ordered
    const modules = await db
      .select()
      .from(courseModules)
      .where(eq(courseModules.courseId, courseId))
      .orderBy(asc(courseModules.orderIndex));

    // Get sessions for this course (scheduled, live, and completed)
    const upcomingSessions = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        type: sessions.type,
        scheduledAt: sessions.scheduledAt,
        durationMinutes: sessions.durationMinutes,
        status: sessions.status,
        zoomLink: sessions.zoomLink,
        roomName: sessions.roomName,
        venueAddress: sessions.venueAddress,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.courseId, courseId),
          or(
            eq(sessions.status, 'scheduled'),
            eq(sessions.status, 'live'),
            eq(sessions.status, 'completed'),
          ),
          // Exclude make-up lectures not assigned to this student
          sql`(${sessions.isMakeup} = false OR ${sessions.assignedStudents} IS NULL OR ${sessions.assignedStudents}::jsonb @> ${JSON.stringify([studentId])}::jsonb)`,
        ),
      )
      .orderBy(asc(sessions.scheduledAt));

    // Get assessments for this course (published only)
    const courseAssessments = await db
      .select({
        id: assessments.id,
        title: assessments.title,
        type: assessments.type,
        totalMarks: assessments.totalMarks,
        passingMarks: assessments.passingMarks,
        durationMinutes: assessments.durationMinutes,
        attemptsAllowed: assessments.attemptsAllowed,
        retakeScorePolicy: assessments.retakeScorePolicy,
        moduleId: assessments.moduleId,
        dueDate: assessments.dueDate,
      })
      .from(assessments)
      .where(
        and(
          eq(assessments.courseId, courseId),
          eq(assessments.status, 'published'),
        ),
      );

    // Get student's submissions for this course's assessments
    const assessmentIds = courseAssessments.map((a) => a.id);
    let studentSubmissions: any[] = [];
    if (assessmentIds.length > 0) {
      studentSubmissions = await db
        .select({
          id: submissions.id,
          assessmentId: submissions.assessmentId,
          score: submissions.score,
          totalMarks: submissions.totalMarks,
          percentage: submissions.percentage,
          status: submissions.status,
          submittedAt: submissions.submittedAt,
          createdAt: submissions.createdAt,
        })
        .from(submissions)
        .where(
          and(
            eq(submissions.studentId, studentId),
            sql`${submissions.assessmentId} IN (${sql.join(
              assessmentIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          ),
        );
    }

    // Group submissions by assessment, then apply each assessment's score
    // policy to pick the effective attempt. Previously this used a Map that
    // silently overwrote on collision (arbitrary pick) when the student had
    // multiple attempts (retakes).
    const submissionsByAssessment = new Map<string, any[]>();
    for (const sub of studentSubmissions) {
      const list = submissionsByAssessment.get(sub.assessmentId);
      if (list) list.push(sub);
      else submissionsByAssessment.set(sub.assessmentId, [sub]);
    }

    const assessmentsWithStatus = courseAssessments.map((a) => {
      const attempts = submissionsByAssessment.get(a.id) || [];
      if (attempts.length === 0) return { ...a, submission: null };
      const eff = computeEffectiveScore(
        attempts.map((s) => ({
          id: s.id,
          score: s.score,
          orderedAt: s.submittedAt || s.createdAt,
        })),
        a.retakeScorePolicy || 'highest',
      );
      let chosen: any | null = null;
      if (eff.isAggregate) {
        // For 'average', synthesize a row using the aggregate score and the
        // most recent submission's metadata so the student progress UI keeps
        // working without leaking the multi-attempt details.
        const mostRecent = [...attempts].sort(
          (x, y) =>
            new Date(y.submittedAt || y.createdAt).getTime() -
            new Date(x.submittedAt || x.createdAt).getTime(),
        )[0];
        chosen = { ...mostRecent, score: eff.score };
      } else if (eff.effectiveAttempt) {
        chosen = attempts.find((s) => s.id === eff.effectiveAttempt!.id) || null;
      } else {
        chosen = attempts[0];
      }
      return { ...a, submission: chosen };
    });

    // Attendance summary — only finalized (completed) sessions visible to students
    const [attSummary] = await db
      .select({
        totalSessions: sql<number>`(
          SELECT COUNT(*) FROM sessions s WHERE s.course_id = ${courseId}
          AND s.status = 'completed'
          AND (s.is_makeup = false OR s.assigned_students IS NULL OR s.assigned_students::jsonb @> ${JSON.stringify([studentId])}::jsonb)
        )`.mapWith(Number),
        attendedSessions: sql<number>`(
          SELECT COUNT(*) FROM attendance a
          INNER JOIN sessions s ON a.session_id = s.id
          WHERE a.student_id = ${studentId}
          AND s.course_id = ${courseId}
          AND a.status IN ('present', 'late')
          AND s.status = 'completed'
          AND (s.is_makeup = false OR s.assigned_students IS NULL OR s.assigned_students::jsonb @> ${JSON.stringify([studentId])}::jsonb)
        )`.mapWith(Number),
      })
      .from(sql`(SELECT 1) AS dummy`);

    const attendanceSummary = {
      total: attSummary?.totalSessions || 0,
      attended: attSummary?.attendedSessions || 0,
      percentage:
        attSummary?.totalSessions > 0
          ? Math.round(
              (attSummary.attendedSessions / attSummary.totalSessions) * 100,
            )
          : 0,
    };

    // Assessment summary
    const completedAssessments = assessmentsWithStatus.filter(
      (a) => a.submission !== null,
    ).length;
    const gradedSubmissions = studentSubmissions.filter(
      (s) => s.status === 'graded' && s.percentage !== null,
    );
    const avgScore =
      gradedSubmissions.length > 0
        ? Math.round(
            gradedSubmissions.reduce(
              (sum: number, s: any) => sum + Number(s.percentage),
              0,
            ) / gradedSubmissions.length,
          )
        : 0;

    const assessmentSummary = {
      total: courseAssessments.length,
      completed: completedAssessments,
      averageScore: avgScore,
    };

    // Add module completion flags (based on progress %)
    const totalModules = modules.length;
    const completedModulesCount =
      totalModules > 0
        ? Math.floor((enrollment.progress / 100) * totalModules)
        : 0;

    const modulesWithCompletion = modules.map((m, index) => ({
      ...m,
      isCompleted: index < completedModulesCount,
    }));

    // Per-session attendance records for this student+course
    // LEFT JOIN — only show finalized (completed) sessions to students
    const attendanceRecordsRaw = await db
      .select({
        sessionId: sessions.id,
        sessionTitle: sessions.title,
        sessionType: sessions.type,
        scheduledAt: sessions.scheduledAt,
        sessionDurationMinutes: sessions.durationMinutes,
        actualStartedAt: sessions.actualStartedAt,
        actualEndedAt: sessions.actualEndedAt,
        sessionStatus: sessions.status,
        status: attendance.status,
        joinedAt: attendance.joinedAt,
        leftAt: attendance.leftAt,
        durationMinutes: attendance.durationMinutes,
      })
      .from(sessions)
      .leftJoin(
        attendance,
        and(
          eq(attendance.sessionId, sessions.id),
          eq(attendance.studentId, studentId),
        ),
      )
      .where(
        and(
          eq(sessions.courseId, courseId),
          eq(sessions.status, 'completed'),
          sql`(${sessions.isMakeup} = false OR ${sessions.assignedStudents} IS NULL OR ${sessions.assignedStudents}::jsonb @> ${JSON.stringify([studentId])}::jsonb)`,
        ),
      )
      .orderBy(desc(sessions.scheduledAt));

    const LOBBY_GRACE_MS = 2 * 60000; // 2 min grace for lobby admission
    const attendanceRecords = attendanceRecordsRaw.map((r) => {
      const actualStartMs = r.actualStartedAt ? new Date(r.actualStartedAt).getTime() : null;
      const actualEndMs = r.actualEndedAt ? new Date(r.actualEndedAt).getTime() : null;
      const actualDurationMin = actualStartMs && actualEndMs
        ? Math.round((actualEndMs - actualStartMs) / 60000)
        : null;
      const sessionDur = actualDurationMin && actualDurationMin > 0 ? actualDurationMin : (r.sessionDurationMinutes || 60);
      // Credit lobby wait: if student joined within 2 min of session start
      let studentDuration = r.durationMinutes;
      if (studentDuration != null && actualStartMs && r.joinedAt) {
        const lobbyDelay = new Date(r.joinedAt).getTime() - actualStartMs;
        if (lobbyDelay > 0 && lobbyDelay <= LOBBY_GRACE_MS) {
          studentDuration += Math.round(lobbyDelay / 60000);
        }
      }
      return {
        ...r,
        sessionDurationMinutes: sessionDur,
        status: r.status || 'absent',
        presencePercent: studentDuration != null && sessionDur > 0
          ? Math.min(Math.round((studentDuration / sessionDur) * 100), 100)
          : null,
      };
    });

    // Update lastAccessedAt
    await db
      .update(enrollments)
      .set({ lastAccessedAt: new Date() })
      .where(eq(enrollments.id, enrollment.id));

    return {
      course,
      enrollment: {
        id: enrollment.id,
        status: enrollment.status,
        progress: enrollment.progress,
        enrolledAt: enrollment.enrolledAt,
        completedAt: enrollment.completedAt,
      },
      modules: modulesWithCompletion,
      sessions: upcomingSessions,
      assessments: assessmentsWithStatus,
      attendanceSummary,
      attendanceRecords,
      assessmentSummary,
    };
  }

  // ─── Course Progress ────────────────────────────────────

  async getCourseProgress(studentId: string, courseId: string) {
    // Verify enrollment
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.courseId, courseId),
        ),
      )
      .limit(1);

    if (!enrollment) {
      throw new NotFoundException('You are not enrolled in this course');
    }

    // Get modules
    const modules = await db
      .select()
      .from(courseModules)
      .where(eq(courseModules.courseId, courseId))
      .orderBy(asc(courseModules.orderIndex));

    // Get attendance for this course's sessions
    const attendanceRecords = await db
      .select({
        sessionId: attendance.sessionId,
        status: attendance.status,
        sessionTitle: sessions.title,
        scheduledAt: sessions.scheduledAt,
      })
      .from(attendance)
      .innerJoin(sessions, eq(attendance.sessionId, sessions.id))
      .where(
        and(
          eq(attendance.studentId, studentId),
          eq(sessions.courseId, courseId),
        ),
      )
      .orderBy(asc(sessions.scheduledAt));

    // Get total sessions and attended count — only finalized (completed) for students
    const [sessionStats] = await db
      .select({
        totalSessions: sql<number>`(
          SELECT COUNT(*) FROM sessions s WHERE s.course_id = ${courseId}
          AND s.status = 'completed'
          AND (s.is_makeup = false OR s.assigned_students IS NULL OR s.assigned_students::jsonb @> ${JSON.stringify([studentId])}::jsonb)
        )`.mapWith(Number),
        attendedSessions: sql<number>`(
          SELECT COUNT(*) FROM attendance a
          INNER JOIN sessions s ON a.session_id = s.id
          WHERE a.student_id = ${studentId}
          AND s.course_id = ${courseId}
          AND a.status IN ('present', 'late')
          AND s.status = 'completed'
          AND (s.is_makeup = false OR s.assigned_students IS NULL OR s.assigned_students::jsonb @> ${JSON.stringify([studentId])}::jsonb)
        )`.mapWith(Number),
      })
      .from(sql`(SELECT 1) AS dummy`);

    return {
      enrollment: {
        id: enrollment.id,
        progress: enrollment.progress,
        status: enrollment.status,
      },
      modules,
      attendance: attendanceRecords,
      sessionStats: {
        total: sessionStats?.totalSessions || 0,
        attended: sessionStats?.attendedSessions || 0,
        percentage:
          sessionStats?.totalSessions > 0
            ? Math.round(
                (sessionStats.attendedSessions / sessionStats.totalSessions) *
                  100,
              )
            : 0,
      },
    };
  }

  // ─── Update Progress ────────────────────────────────────

  async updateProgress(
    studentId: string,
    courseId: string,
    dto: UpdateProgressDto,
  ) {
    // Verify enrollment
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.courseId, courseId),
          eq(enrollments.status, 'active'),
        ),
      )
      .limit(1);

    if (!enrollment) {
      throw new NotFoundException(
        'Active enrollment not found for this course',
      );
    }

    // Verify the module belongs to this course
    const [module] = await db
      .select()
      .from(courseModules)
      .where(
        and(
          eq(courseModules.id, dto.moduleId),
          eq(courseModules.courseId, courseId),
        ),
      )
      .limit(1);

    if (!module) {
      throw new NotFoundException('Module not found in this course');
    }

    // Persist video watch progress if materialId + watchedSeconds provided
    if (dto.materialId && dto.watchedSeconds !== undefined) {
      const [existing] = await db
        .select()
        .from(materialProgress)
        .where(
          and(
            eq(materialProgress.studentId, studentId),
            eq(materialProgress.materialId, dto.materialId),
          ),
        )
        .limit(1);

      const furthestWatched = Math.max(
        existing?.furthestWatchedSecond || 0,
        dto.watchedSeconds,
      );
      const totalSec = dto.totalSeconds || existing?.totalSeconds || 0;
      const isComplete = totalSec > 0 && furthestWatched / totalSec >= 0.9;

      if (existing) {
        await db
          .update(materialProgress)
          .set({
            watchedSeconds: dto.watchedSeconds,
            totalSeconds: totalSec,
            furthestWatchedSecond: furthestWatched,
            completedAt: isComplete && !existing.completedAt ? new Date() : existing.completedAt,
            updatedAt: new Date(),
          })
          .where(eq(materialProgress.id, existing.id));
      } else {
        await db.insert(materialProgress).values({
          studentId,
          materialId: dto.materialId,
          courseId,
          moduleId: dto.moduleId,
          watchedSeconds: dto.watchedSeconds,
          totalSeconds: totalSec,
          furthestWatchedSecond: furthestWatched,
          completedAt: isComplete ? new Date() : null,
        });
      }
    }

    // If this is a video auto-save (no status), only update lastAccessedAt
    // Progress should only increment on explicit module completion
    if (!dto.status) {
      const [updated] = await db
        .update(enrollments)
        .set({ lastAccessedAt: new Date() })
        .where(eq(enrollments.id, enrollment.id))
        .returning();
      return updated;
    }

    // NELC: Enforce minimum watch time (80%) for video materials before module completion
    if (dto.status === 'completed') {
      const videoMaterials = await db
        .select({ id: courseMaterials.id })
        .from(courseMaterials)
        .where(
          and(
            eq(courseMaterials.moduleId, dto.moduleId),
            eq(courseMaterials.type, 'video'),
            eq(courseMaterials.status, 'live'),
          ),
        );

      if (videoMaterials.length > 0) {
        const videoIds = videoMaterials.map((v) => v.id);
        const progressRows = await db
          .select({
            materialId: materialProgress.materialId,
            furthestWatchedSecond: materialProgress.furthestWatchedSecond,
            totalSeconds: materialProgress.totalSeconds,
          })
          .from(materialProgress)
          .where(
            and(
              eq(materialProgress.studentId, studentId),
              sql`${materialProgress.materialId} IN (${sql.join(
                videoIds.map((id) => sql`${id}`),
                sql`, `,
              )})`,
            ),
          );

        const progressMap = new Map(
          progressRows.map((p) => [p.materialId, p]),
        );

        for (const video of videoMaterials) {
          const prog = progressMap.get(video.id);
          if (!prog || prog.totalSeconds === 0) {
            throw new BadRequestException(
              'You must watch all video materials before completing this module',
            );
          }
          const watchedPercent = prog.furthestWatchedSecond / prog.totalSeconds;
          if (watchedPercent < 0.8) {
            throw new BadRequestException(
              `You must watch at least 80% of all videos to complete this module (currently ${Math.round(watchedPercent * 100)}%)`,
            );
          }
        }
      }
    }

    // Fetch course delivery type to determine progress calculation method
    const [courseForProgress] = await db
      .select({ deliveryType: courses.deliveryType })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    const deliveryType = courseForProgress?.deliveryType;

    // For zoom/onsite courses: progress is attendance-based (calculated on session finalize)
    // Module completion is supplementary and should NOT override attendance progress
    if (deliveryType === 'zoom' || deliveryType === 'onsite') {
      const [updated] = await db
        .update(enrollments)
        .set({ lastAccessedAt: new Date() })
        .where(eq(enrollments.id, enrollment.id))
        .returning();
      return updated;
    }

    // For self-paced and blended: progress is module-based
    const [moduleCount] = await db
      .select({ count: count() })
      .from(courseModules)
      .where(eq(courseModules.courseId, courseId));

    const totalModules = Number(moduleCount?.count || 1);
    const progressPerModule = Math.round(100 / totalModules);
    const newProgress = Math.min(
      enrollment.progress + progressPerModule,
      100,
    );

    const [updated] = await db
      .update(enrollments)
      .set({
        progress: newProgress,
        lastAccessedAt: new Date(),
      })
      .where(eq(enrollments.id, enrollment.id))
      .returning();

    return updated;
  }

  // ─── Self-Enrollment ────────────────────────────────────

  async selfEnroll(
    studentId: string,
    courseId: string,
    user: AuthenticatedUser,
  ) {
    // 1. Verify course exists and is active
    const [course] = await db
      .select()
      .from(courses)
      .where(
        and(eq(courses.id, courseId), eq(courses.status, COURSE_STATUS.ACTIVE)),
      )
      .limit(1);

    if (!course) {
      throw new NotFoundException('Course not found or not available');
    }

    // 2. NELC limit enforcement
    const classification = classifyCourse(course.startDate, course.endDate);
    const nelcMax = getNelcMaxEnrollment(classification);
    const effectiveMax = course.maxEnrollment
      ? Math.min(course.maxEnrollment, nelcMax)
      : nelcMax;

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
          selfEnroll: true,
        },
      });

      throw new BadRequestException(
        'This course is no longer available for enrollment',
      );
    }

    // 3. Check for existing enrollment
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
        throw new BadRequestException('You are already enrolled in this course');
      }
      // Re-activate dropped/suspended enrollment
      const [reactivated] = await db
        .update(enrollments)
        .set({ status: 'active', lastAccessedAt: new Date() })
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
          selfEnroll: true,
          reactivated: true,
        },
      });

      // Trigger TA threshold evaluation (auto-activate pre-assigned TAs)
      this.thresholdEvaluationService
        .checkAndNotify(courseId)
        .catch((err) => this.logger.warn('TA threshold evaluation failed after self-enrollment', err));

      return reactivated;
    }

    // 4. Create new enrollment
    const [enrollment] = await db
      .insert(enrollments)
      .values({ courseId, studentId })
      .returning();

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
        selfEnroll: true,
      },
    });

    // Trigger TA threshold evaluation (auto-activate pre-assigned TAs)
    this.thresholdEvaluationService
      .checkAndNotify(courseId)
      .catch((err) => this.logger.warn('TA threshold evaluation failed after self-enrollment', err));

    return enrollment;
  }

  // ─── Drop Course ──────────────────────────────────────

  async dropCourse(studentId: string, courseId: string) {
    // 1. Verify enrollment exists and is active
    const [enrollment] = await db
      .select({ id: enrollments.id, status: enrollments.status })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, courseId),
          eq(enrollments.studentId, studentId),
        ),
      )
      .limit(1);

    if (!enrollment) {
      throw new NotFoundException('You are not enrolled in this course');
    }

    if (enrollment.status === 'dropped') {
      throw new BadRequestException('You have already dropped this course');
    }

    if (enrollment.status === 'completed') {
      throw new BadRequestException(
        'Cannot drop a completed course',
      );
    }

    // 2. Update status to dropped
    const [updated] = await db
      .update(enrollments)
      .set({ status: 'dropped' })
      .where(eq(enrollments.id, enrollment.id))
      .returning();

    // 3. Audit log
    await this.auditService.log({
      eventType: NELC_EVENT_TYPE.ENROLLMENT_DROPPED,
      entityType: 'enrollment',
      entityId: updated.id,
      userId: studentId,
      metadata: {
        courseId,
        studentId,
        previousStatus: enrollment.status,
      },
    });

    // 4. Re-evaluate TA thresholds (enrollment count decreased)
    this.thresholdEvaluationService
      .checkAndNotify(courseId)
      .catch((err) => this.logger.warn('TA threshold re-evaluation failed after drop', err));

    return updated;
  }

  // ─── Assessment Taking ─────────────────────────────────

  async getAssessmentForStudent(studentId: string, assessmentId: string) {
    // Get the assessment
    const [assessment] = await db
      .select()
      .from(assessments)
      .where(
        and(
          eq(assessments.id, assessmentId),
          eq(assessments.status, 'published'),
        ),
      )
      .limit(1);

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    // Verify student is enrolled in the course
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.courseId, assessment.courseId),
          eq(enrollments.status, 'active'),
        ),
      )
      .limit(1);

    if (!enrollment) {
      throw new BadRequestException(
        'You must be enrolled in the course to take this assessment',
      );
    }

    // Check existing submissions to enforce attempt limits
    const existingSubmissions = await db
      .select({ count: count() })
      .from(submissions)
      .where(
        and(
          eq(submissions.assessmentId, assessmentId),
          eq(submissions.studentId, studentId),
          eq(submissions.status, 'graded'),
        ),
      );

    const attemptCount = Number(existingSubmissions[0]?.count || 0);

    // Also count 'submitted' (pending grading) attempts
    const allSubmissionsResult = await db
      .select({ count: count() })
      .from(submissions)
      .where(
        and(
          eq(submissions.assessmentId, assessmentId),
          eq(submissions.studentId, studentId),
          sql`${submissions.status} IN ('graded', 'submitted')`,
        ),
      );
    const totalAttempts = Number(allSubmissionsResult[0]?.count || 0);

    // Count retake grants for this student so we can extend attemptsAllowed.
    // Each grant adds exactly one extra attempt.
    const retakeGrantRows = await db
      .select({
        id: assessmentRetakeGrants.id,
        usedAt: assessmentRetakeGrants.usedAt,
        newDueDate: assessmentRetakeGrants.newDueDate,
        createdAt: assessmentRetakeGrants.createdAt,
      })
      .from(assessmentRetakeGrants)
      .where(
        and(
          eq(assessmentRetakeGrants.assessmentId, assessmentId),
          eq(assessmentRetakeGrants.studentId, studentId),
        ),
      )
      .orderBy(desc(assessmentRetakeGrants.createdAt));
    const totalGrants = retakeGrantRows.length;
    const unusedGrants = retakeGrantRows.filter((g) => !g.usedAt).length;
    // Most recent unused grant — its newDueDate (if any) overrides the assessment dueDate
    const activeUnusedGrant = retakeGrantRows.find((g) => !g.usedAt) || null;

    // Effective attempts allowed = baseline (assessment.attemptsAllowed, default 1)
    // plus any retake grants the manager has issued.
    const baseAttemptsAllowed = assessment.attemptsAllowed ?? 1;
    const effectiveAttemptsAllowed = baseAttemptsAllowed + totalGrants;
    const maxAttemptsReached = totalAttempts >= effectiveAttemptsAllowed;

    // Retake info — with the new model, canRetake is simply "an unused grant exists"
    let canRetake = unusedGrants > 0;
    const retakeAvailableAt: string | null = null;

    // Fetch latest submission for review info
    let latestSubmission: {
      id: string;
      status: string;
      score: number | null;
      submittedAt: Date | null;
    } | null = null;

    if (totalAttempts > 0) {
      const [latestSub] = await db
        .select({
          id: submissions.id,
          status: submissions.status,
          score: submissions.score,
          submittedAt: submissions.submittedAt,
        })
        .from(submissions)
        .where(
          and(
            eq(submissions.assessmentId, assessmentId),
            eq(submissions.studentId, studentId),
            sql`${submissions.status} IN ('graded', 'submitted')`,
          ),
        )
        .orderBy(desc(submissions.submittedAt))
        .limit(1);

      latestSubmission = latestSub || null;
    }

    // Get questions — omit correctAnswer for student view
    const assessmentQuestions = await db
      .select({
        id: questions.id,
        type: questions.type,
        questionText: questions.questionText,
        questionTextAr: questions.questionTextAr,
        options: questions.options,
        marks: questions.marks,
      })
      .from(questions)
      .where(eq(questions.assessmentId, assessmentId))
      .orderBy(asc(questions.createdAt));

    // Strip isCorrect from options; detect multi-select MCQ
    const sanitizedQuestions = assessmentQuestions.map((q) => {
      const correctCount = (q.options || []).filter(
        (opt: any) => opt.isCorrect,
      ).length;
      return {
        ...q,
        isMultiSelect: q.type === 'mcq' && correctCount > 1,
        options: (q.options || []).map((opt: any) => ({
          text: opt.text,
          textAr: opt.textAr,
        })),
      };
    });

    // For assignments, compute canSubmit flag
    const isAssignment = assessment.type === 'assignment';

    // ─── Randomization / subset logic ─────────────────────────
    let finalQuestions = sanitizedQuestions;
    let questionOrder: string[] | undefined;

    if (assessment.randomizeOrder && !isAssignment) {
      // Check for existing in-progress submission with stored order
      const [inProgressSub] = await db
        .select({ id: submissions.id, questionOrder: submissions.questionOrder })
        .from(submissions)
        .where(
          and(
            eq(submissions.assessmentId, assessmentId),
            eq(submissions.studentId, studentId),
            eq(submissions.status, 'in_progress'),
          ),
        )
        .orderBy(desc(submissions.createdAt))
        .limit(1);

      if (inProgressSub?.questionOrder && Array.isArray(inProgressSub.questionOrder)) {
        // Resume: use the stored order
        questionOrder = inProgressSub.questionOrder as string[];
        const orderMap = new Map(questionOrder.map((id, idx) => [id, idx]));
        finalQuestions = finalQuestions
          .filter((q) => orderMap.has(q.id))
          .sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
      } else {
        // New attempt: generate deterministic order
        const attemptNum = totalAttempts + 1;
        const seed = makeSeed(assessmentId, studentId, String(attemptNum));
        let shuffled = seededShuffle(finalQuestions, seed);

        // If questionsPerAttempt is set, take a subset
        if (
          assessment.questionsPerAttempt &&
          assessment.questionsPerAttempt > 0 &&
          assessment.questionsPerAttempt < shuffled.length
        ) {
          shuffled = shuffled.slice(0, assessment.questionsPerAttempt);
        }

        finalQuestions = shuffled;
        questionOrder = shuffled.map((q) => q.id);
      }
    }

    // For assignments, the effective deadline is either the per-student override
    // from an active retake grant, or the assessment's global dueDate.
    const effectiveDueDate =
      isAssignment && activeUnusedGrant?.newDueDate
        ? new Date(activeUnusedGrant.newDueDate)
        : assessment.dueDate
          ? new Date(assessment.dueDate)
          : null;
    const pastDeadline =
      isAssignment && effectiveDueDate ? new Date() > effectiveDueDate : false;
    // If time limit is not enforced, the deadline is advisory and does not block submission.
    const deadlineBlocks = pastDeadline && assessment.timeLimitEnforced;
    // For assignments: student can submit if (a) within deadline AND (b) either
    // they haven't submitted yet OR they have an unused retake grant.
    const canSubmit = isAssignment
      ? !deadlineBlocks && (totalAttempts === 0 || unusedGrants > 0)
      : undefined;

    // The next attempt the student is about to start: total submissions + 1.
    // First attempt = 1, retakes = 2, 3, 4...
    const currentAttemptNumber = totalAttempts + 1;
    const isRetakeAttempt = totalAttempts > 0 && unusedGrants > 0;

    return {
      id: assessment.id,
      title: assessment.title,
      type: assessment.type,
      totalMarks: assessment.totalMarks,
      passingMarks: assessment.passingMarks,
      durationMinutes: assessment.durationMinutes,
      attemptsAllowed: effectiveAttemptsAllowed,
      attemptsTaken: totalAttempts,
      currentAttemptNumber,
      isRetakeAttempt,
      canRetake,
      retakeAvailableAt,
      maxAttemptsReached,
      randomizeOrder: assessment.randomizeOrder,
      questionsPerAttempt: assessment.questionsPerAttempt,
      // Time limit policy — false means duration/dueDate is advisory only
      timeLimitEnforced: assessment.timeLimitEnforced,
      latestSubmission: latestSubmission
        ? {
            id: latestSubmission.id,
            status: latestSubmission.status,
            score: latestSubmission.score,
          }
        : null,
      questions: maxAttemptsReached && !isAssignment ? [] : (isAssignment ? [] : finalQuestions),
      questionOrder,
      // Assignment-specific fields
      ...(isAssignment && {
        assignmentFiles: assessment.assignmentFiles || [],
        // Show the effective deadline (per-student override if any) so the
        // student sees the correct cutoff in the UI.
        dueDate: effectiveDueDate?.toISOString() || null,
        instructions: assessment.instructions || null,
        canSubmit,
      }),
    };
  }

  async submitAssessment(
    studentId: string,
    assessmentId: string,
    answers: { questionId: string; answer: string }[],
  ) {
    // Get the assessment
    const [assessment] = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .limit(1);

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    // Verify enrollment
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.courseId, assessment.courseId),
          eq(enrollments.status, 'active'),
        ),
      )
      .limit(1);

    if (!enrollment) {
      throw new BadRequestException('You must be enrolled in the course');
    }

    // Look up any unused retake grant — its newDueDate (if any) overrides
    // the assessment's global dueDate for this student.
    const [activeRetakeGrant] = await db
      .select({
        id: assessmentRetakeGrants.id,
        newDueDate: assessmentRetakeGrants.newDueDate,
      })
      .from(assessmentRetakeGrants)
      .where(
        and(
          eq(assessmentRetakeGrants.assessmentId, assessmentId),
          eq(assessmentRetakeGrants.studentId, studentId),
          sql`${assessmentRetakeGrants.usedAt} IS NULL`,
        ),
      )
      .orderBy(desc(assessmentRetakeGrants.createdAt))
      .limit(1);

    // ─── Time limit enforcement ───────────────────────────
    // Assignment past deadline: reject. Auto-zero rows are created lazily by the
    // manager getSubmissions read path (see assessments.service.backfillExpiredSubmissions).
    // If a retake grant has a per-student newDueDate, that overrides assessment.dueDate.
    if (assessment.type === 'assignment' && assessment.timeLimitEnforced) {
      const effectiveDueDate = activeRetakeGrant?.newDueDate
        ? new Date(activeRetakeGrant.newDueDate)
        : assessment.dueDate
          ? new Date(assessment.dueDate)
          : null;
      if (effectiveDueDate && new Date() > effectiveDueDate) {
        throw new BadRequestException(
          'The deadline for this assignment has passed. Submission is no longer accepted.',
        );
      }
    }

    // Quiz/exam: if the draft has been around longer than durationMinutes, the
    // student is past their window. Reject the fresh answers (closes refresh-to-reset
    // exploit). The expired draft will be lazily finalized using the previously
    // saved answers when the manager opens the submissions list.
    if (
      (assessment.type === 'quiz' || assessment.type === 'exam') &&
      assessment.timeLimitEnforced &&
      assessment.durationMinutes
    ) {
      const [draft] = await db
        .select({ startedAt: submissions.startedAt })
        .from(submissions)
        .where(
          and(
            eq(submissions.assessmentId, assessmentId),
            eq(submissions.studentId, studentId),
            eq(submissions.status, 'in_progress'),
          ),
        )
        .limit(1);
      if (draft?.startedAt) {
        const elapsedMs = Date.now() - new Date(draft.startedAt).getTime();
        const allowedMs = assessment.durationMinutes * 60 * 1000;
        // Allow a 10-second grace window for clock skew / network latency
        if (elapsedMs > allowedMs + 10_000) {
          throw new BadRequestException(
            'The time limit for this assessment has expired. Your previous answers have been saved and will be graded.',
          );
        }
      }
    }

    // Get questions with correct answers for grading
    const assessmentQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.assessmentId, assessmentId));

    const questionMap = new Map(assessmentQuestions.map((q) => [q.id, q]));

    // Grade MCQ and true/false automatically; mark essay/short_answer as null
    let totalScore = 0;
    let totalPossibleMarks = 0;

    const gradedAnswers: SubmissionAnswer[] = answers.map((a) => {
      const question = questionMap.get(a.questionId);
      if (!question) {
        return {
          questionId: a.questionId,
          answer: a.answer,
          isCorrect: null,
          marksAwarded: 0,
        };
      }

      totalPossibleMarks += question.marks;

      if (question.type === 'mcq' || question.type === 'true_false') {
        let isCorrect = false;
        if (question.options && Array.isArray(question.options)) {
          const correctOptions = question.options.filter(
            (opt: any) => opt.isCorrect,
          );

          if (question.type === 'mcq' && correctOptions.length > 1) {
            // Multi-select MCQ: answer is JSON array of selected texts
            try {
              const selected: string[] = JSON.parse(a.answer);
              const correctTexts = correctOptions.map((o: any) => o.text);
              isCorrect =
                selected.length === correctTexts.length &&
                selected.every((s) => correctTexts.includes(s));
            } catch {
              isCorrect = false;
            }
          } else {
            // Single-select MCQ or True/False
            const selectedOption = question.options.find(
              (opt: any) => opt.text === a.answer,
            );
            isCorrect = selectedOption?.isCorrect === true;
          }
        } else if (question.correctAnswer) {
          isCorrect =
            a.answer.toLowerCase().trim() ===
            question.correctAnswer.toLowerCase().trim();
        }

        if (isCorrect) totalScore += question.marks;

        return {
          questionId: a.questionId,
          answer: a.answer,
          isCorrect,
          marksAwarded: isCorrect ? question.marks : 0,
        };
      }

      // Essay / short_answer — needs manual grading
      return {
        questionId: a.questionId,
        answer: a.answer,
        isCorrect: null,
        marksAwarded: null,
      };
    });

    const hasManualGrading = gradedAnswers.some((a) => a.isCorrect === null);
    const percentage =
      totalPossibleMarks > 0
        ? ((totalScore / totalPossibleMarks) * 100).toFixed(2)
        : '0';

    // Check for existing in_progress submission to update instead of insert
    const [existingDraft] = await db
      .select()
      .from(submissions)
      .where(
        and(
          eq(submissions.assessmentId, assessmentId),
          eq(submissions.studentId, studentId),
          eq(submissions.status, 'in_progress'),
        ),
      )
      .limit(1);

    let submission;
    if (existingDraft) {
      // Update draft to final submission
      const [updated] = await db
        .update(submissions)
        .set({
          answers: gradedAnswers,
          score: totalScore,
          totalMarks: totalPossibleMarks,
          percentage,
          submittedAt: new Date(),
          status: hasManualGrading ? 'submitted' : 'graded',
        })
        .where(eq(submissions.id, existingDraft.id))
        .returning();
      submission = updated;
    } else {
      const [inserted] = await db
        .insert(submissions)
        .values({
          assessmentId,
          studentId,
          answers: gradedAnswers,
          score: totalScore,
          totalMarks: totalPossibleMarks,
          percentage,
          startedAt: new Date(),
          submittedAt: new Date(),
          status: hasManualGrading ? 'submitted' : 'graded',
        })
        .returning();
      submission = inserted;
    }

    // If this submission is consuming a retake grant, mark it as used so the
    // student doesn't get an unbounded number of attempts from one grant.
    if (activeRetakeGrant) {
      await db
        .update(assessmentRetakeGrants)
        .set({ usedAt: new Date() })
        .where(eq(assessmentRetakeGrants.id, activeRetakeGrant.id));
    }

    // Enrich graded answers with question details for per-question breakdown
    const enrichedAnswers = gradedAnswers.map((a) => {
      const q = questionMap.get(a.questionId);
      return {
        ...a,
        questionText: q?.questionText || '',
        questionType: q?.type || '',
        questionMarks: q?.marks || 0,
      };
    });

    // Notify instructor about submission (fire-and-forget)
    this.notifyInstructorOfSubmission(
      assessment.courseId,
      studentId,
      assessment.title,
      assessment.type,
      assessmentId,
    ).catch((err) => this.logger.warn(`Failed to notify instructor: ${err.message}`));

    return {
      submissionId: submission.id,
      score: totalScore,
      totalMarks: totalPossibleMarks,
      percentage: Number(percentage),
      status: submission.status,
      passed:
        !hasManualGrading &&
        totalScore >= (assessment.passingMarks || 0),
      hasManualGrading,
      gradedAnswers: enrichedAnswers,
    };
  }

  // ─── Assessment Auto-Save ──────────────────────────────

  async saveAssessmentProgress(
    studentId: string,
    assessmentId: string,
    answersData: { questionId: string; answer: string }[],
    questionOrder?: string[],
  ) {
    // Block draft saves past assignment deadline when enforced.
    // Check per-student retake-grant deadline override first.
    const [assessmentRow] = await db
      .select({
        type: assessments.type,
        dueDate: assessments.dueDate,
        timeLimitEnforced: assessments.timeLimitEnforced,
      })
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .limit(1);
    if (assessmentRow?.type === 'assignment' && assessmentRow.timeLimitEnforced) {
      const [activeGrant] = await db
        .select({ newDueDate: assessmentRetakeGrants.newDueDate })
        .from(assessmentRetakeGrants)
        .where(
          and(
            eq(assessmentRetakeGrants.assessmentId, assessmentId),
            eq(assessmentRetakeGrants.studentId, studentId),
            sql`${assessmentRetakeGrants.usedAt} IS NULL`,
          ),
        )
        .orderBy(desc(assessmentRetakeGrants.createdAt))
        .limit(1);
      const effectiveDue = activeGrant?.newDueDate
        ? new Date(activeGrant.newDueDate)
        : assessmentRow.dueDate
          ? new Date(assessmentRow.dueDate)
          : null;
      if (effectiveDue && new Date() > effectiveDue) {
        throw new BadRequestException(
          'The deadline for this assignment has passed.',
        );
      }
    }

    const draftAnswers: SubmissionAnswer[] = answersData.map((a) => ({
      questionId: a.questionId,
      answer: a.answer,
      isCorrect: null,
      marksAwarded: null,
    }));

    const [existing] = await db
      .select()
      .from(submissions)
      .where(
        and(
          eq(submissions.assessmentId, assessmentId),
          eq(submissions.studentId, studentId),
          eq(submissions.status, 'in_progress'),
        ),
      )
      .limit(1);

    if (existing) {
      const updateData: Record<string, unknown> = { answers: draftAnswers };
      if (questionOrder && !existing.questionOrder) {
        updateData.questionOrder = questionOrder;
      }
      await db
        .update(submissions)
        .set(updateData)
        .where(eq(submissions.id, existing.id));
      return { submissionId: existing.id, saved: true };
    }

    // New draft. If the student has prior graded submissions AND has an unused
    // retake grant, claim the most recent grant now (mark usedAt) so an
    // abandoned-then-lazy-finalized retake still consumes its grant.
    const [priorSub] = await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(
        and(
          eq(submissions.assessmentId, assessmentId),
          eq(submissions.studentId, studentId),
          sql`${submissions.status} IN ('graded', 'submitted')`,
        ),
      )
      .limit(1);
    if (priorSub) {
      const [grantToClaim] = await db
        .select({ id: assessmentRetakeGrants.id })
        .from(assessmentRetakeGrants)
        .where(
          and(
            eq(assessmentRetakeGrants.assessmentId, assessmentId),
            eq(assessmentRetakeGrants.studentId, studentId),
            sql`${assessmentRetakeGrants.usedAt} IS NULL`,
          ),
        )
        .orderBy(desc(assessmentRetakeGrants.createdAt))
        .limit(1);
      if (grantToClaim) {
        await db
          .update(assessmentRetakeGrants)
          .set({ usedAt: new Date() })
          .where(eq(assessmentRetakeGrants.id, grantToClaim.id));
      }
    }

    const [draft] = await db
      .insert(submissions)
      .values({
        assessmentId,
        studentId,
        answers: draftAnswers,
        questionOrder: questionOrder || null,
        startedAt: new Date(),
        status: 'in_progress',
      })
      .returning();

    return { submissionId: draft.id, saved: true };
  }

  async getAssessmentProgress(studentId: string, assessmentId: string) {
    const [draft] = await db
      .select()
      .from(submissions)
      .where(
        and(
          eq(submissions.assessmentId, assessmentId),
          eq(submissions.studentId, studentId),
          eq(submissions.status, 'in_progress'),
        ),
      )
      .limit(1);

    if (!draft) return null;
    return {
      answers: (draft.answers || []).map((a: any) => ({
        questionId: a.questionId,
        answer: a.answer,
      })),
      startedAt: draft.startedAt?.toISOString() || null,
    };
  }

  // ─── Submission Review ────────────────────────────────

  async getSubmissionReview(studentId: string, submissionId: string) {
    const [submission] = await db
      .select()
      .from(submissions)
      .where(
        and(
          eq(submissions.id, submissionId),
          eq(submissions.studentId, studentId),
          eq(submissions.status, 'graded'),
        ),
      )
      .limit(1);

    if (!submission) {
      throw new NotFoundException('Graded submission not found');
    }

    const assessmentQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.assessmentId, submission.assessmentId))
      .orderBy(asc(questions.createdAt));

    const reviewQuestions = assessmentQuestions.map((q) => ({
      id: q.id,
      type: q.type,
      questionText: q.questionText,
      questionTextAr: q.questionTextAr,
      options: q.options,
      correctAnswer: q.correctAnswer,
      marks: q.marks,
    }));

    return {
      submissionId: submission.id,
      assessmentId: submission.assessmentId,
      score: submission.score,
      totalMarks: submission.totalMarks,
      percentage: Number(submission.percentage),
      answers: submission.answers,
      questions: reviewQuestions,
      submissionFiles: submission.submissionFiles || [],
      instructorComment: submission.instructorComment || null,
      questionComments: submission.questionComments || {},
    };
  }

  // ─── Assignment Submission ─────────────────────────────

  async submitAssignmentFiles(
    studentId: string,
    assessmentId: string,
    files: { buffer: Buffer; originalname: string; mimetype: string; size: number }[],
  ) {
    // Get the assessment
    const [assessment] = await db
      .select()
      .from(assessments)
      .where(
        and(
          eq(assessments.id, assessmentId),
          eq(assessments.status, 'published'),
        ),
      )
      .limit(1);

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    if (assessment.type !== 'assignment') {
      throw new BadRequestException('This endpoint is only for assignment submissions');
    }

    // Look up an unused retake grant. If present, the student has been
    // authorized for one extra attempt and the grant may carry a per-student
    // newDueDate that overrides the assessment's global dueDate.
    const [activeRetakeGrant] = await db
      .select({
        id: assessmentRetakeGrants.id,
        newDueDate: assessmentRetakeGrants.newDueDate,
      })
      .from(assessmentRetakeGrants)
      .where(
        and(
          eq(assessmentRetakeGrants.assessmentId, assessmentId),
          eq(assessmentRetakeGrants.studentId, studentId),
          sql`${assessmentRetakeGrants.usedAt} IS NULL`,
        ),
      )
      .orderBy(desc(assessmentRetakeGrants.createdAt))
      .limit(1);

    // Deadline check — honors per-student override if a retake grant supplies one
    if (assessment.timeLimitEnforced) {
      const effectiveDue = activeRetakeGrant?.newDueDate
        ? new Date(activeRetakeGrant.newDueDate)
        : assessment.dueDate
          ? new Date(assessment.dueDate)
          : null;
      if (effectiveDue && new Date() > effectiveDue) {
        throw new BadRequestException('Deadline has passed');
      }
    }

    // Verify enrollment
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.courseId, assessment.courseId),
          eq(enrollments.status, 'active'),
        ),
      )
      .limit(1);

    if (!enrollment) {
      throw new BadRequestException('You must be enrolled in the course');
    }

    // Check existing terminal submissions. The student is allowed 1 baseline
    // attempt + 1 attempt per retake grant. The total grants count includes
    // both used and unused grants since used grants represent attempts already
    // consumed by submissions.
    const [existingSub] = await db
      .select({ count: count() })
      .from(submissions)
      .where(
        and(
          eq(submissions.assessmentId, assessmentId),
          eq(submissions.studentId, studentId),
          sql`${submissions.status} IN ('submitted', 'graded')`,
        ),
      );
    const existingCount = Number(existingSub?.count || 0);

    // Total grants ever issued for this student on this assessment
    const allGrants = await db
      .select({ id: assessmentRetakeGrants.id })
      .from(assessmentRetakeGrants)
      .where(
        and(
          eq(assessmentRetakeGrants.assessmentId, assessmentId),
          eq(assessmentRetakeGrants.studentId, studentId),
        ),
      );
    const allowedAttempts = 1 + allGrants.length;

    if (existingCount >= allowedAttempts) {
      throw new BadRequestException('You have already submitted this assignment');
    }

    // Upload each file
    const submissionFiles: AssessmentFile[] = [];
    for (const file of files) {
      const ext = file.originalname.split('.').pop() || 'bin';
      const storagePath = `submissions/${assessment.courseId}/${assessmentId}/${studentId}/${randomUUID()}.${ext}`;

      const fileUrl = await this.storageService.uploadPublic(
        file.buffer,
        storagePath,
        file.mimetype,
      );

      submissionFiles.push({
        id: randomUUID(),
        fileUrl,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedAt: new Date().toISOString(),
      });
    }

    // Create submission
    const [submission] = await db
      .insert(submissions)
      .values({
        assessmentId,
        studentId,
        answers: [],
        submissionFiles,
        score: null,
        totalMarks: assessment.totalMarks,
        startedAt: new Date(),
        submittedAt: new Date(),
        status: 'submitted',
      })
      .returning();

    // If this is a retake (consumed an unused grant), mark the grant as used.
    if (activeRetakeGrant) {
      await db
        .update(assessmentRetakeGrants)
        .set({ usedAt: new Date() })
        .where(eq(assessmentRetakeGrants.id, activeRetakeGrant.id));
    }

    // Notify instructor about assignment submission (fire-and-forget)
    this.notifyInstructorOfSubmission(
      assessment.courseId,
      studentId,
      assessment.title,
      'assignment',
      assessmentId,
    ).catch((err) => this.logger.warn(`Failed to notify instructor: ${err.message}`));

    return {
      submissionId: submission.id,
      filesCount: submissionFiles.length,
      status: 'submitted',
    };
  }

  // ─── Instructor Notification Helper ────────────────────

  private async notifyInstructorOfSubmission(
    courseId: string,
    studentId: string,
    assessmentTitle: string,
    assessmentType: string,
    assessmentId: string,
  ) {
    // Get instructor ID from course
    const [course] = await db
      .select({ instructorId: courses.instructorId, title: courses.title })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course?.instructorId) return;

    // Get student name
    const [student] = await db
      .select({ firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, studentId))
      .limit(1);

    const studentName = student
      ? `${student.firstName || ''} ${student.lastName || ''}`.trim()
      : 'A student';

    const typeLabel = assessmentType === 'assignment' ? 'assignment' : assessmentType;

    // Email notification to instructor (fetch first so we know language)
    const [instructor] = await db
      .select({ email: users.email, firstName: users.firstName, language: users.language })
      .from(users)
      .where(eq(users.id, course.instructorId))
      .limit(1);

    const instrIsAr = instructor?.language === 'ar';

    // In-app notification
    await this.userNotificationsService.create({
      recipientId: course.instructorId,
      type: 'assessment_submitted',
      title: instrIsAr
        ? 'تم تقديم تقييم'
        : `${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} Submitted`,
      message: instrIsAr
        ? `${studentName} قدم "${assessmentTitle}" في ${course.title}`
        : `${studentName} submitted "${assessmentTitle}" in ${course.title}`,
      link: `/dashboard/instructor/assessments`,
      entityType: 'submission',
      entityId: assessmentId,
    });

    if (instructor?.email) {
      const instrLocale = (instructor.language || 'en') as 'en' | 'ar';
      await this.emailService.sendAssessmentSubmitted(instructor.email, {
        instructorName: instructor.firstName || 'Instructor',
        studentName,
        assessmentTitle,
        assessmentType,
        courseName: course.title,
      }, instrLocale);
    }
  }

  // ─── Certificates ──────────────────────────────────────

  async getCertificates(studentId: string) {
    const certs = await db
      .select({
        id: certificateRequests.id,
        courseId: certificateRequests.courseId,
        status: certificateRequests.status,
        attendancePercent: certificateRequests.attendancePercent,
        assessmentPassed: certificateRequests.assessmentPassed,
        courseCompleted: certificateRequests.courseCompleted,
        certificateUrl: certificateRequests.certificateUrl,
        reviewNote: certificateRequests.reviewNote,
        createdAt: certificateRequests.createdAt,
        reviewedAt: certificateRequests.reviewedAt,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
        cmeHours: courses.cmeHours,
        instructorName: sql<string>`(
          SELECT CONCAT(u.first_name, ' ', u.last_name) FROM users u
          WHERE u.id = ${courses.instructorId}
        )`,
      })
      .from(certificateRequests)
      .innerJoin(courses, eq(certificateRequests.courseId, courses.id))
      .where(eq(certificateRequests.studentId, studentId))
      .orderBy(desc(certificateRequests.createdAt));

    return certs;
  }

  async downloadStudentCertificate(
    certId: string,
    studentId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    return this.certificatesService.downloadStudentCertificate(certId, studentId);
  }

  // ─── Calendar Events ───────────────────────────────────

  async getCalendarEvents(
    studentId: string,
    params: { from?: string; to?: string },
  ) {
    const conditions: ReturnType<typeof eq>[] = [
      eq(enrollments.studentId, studentId),
      eq(enrollments.status, 'active'),
    ];

    // Build date filters for sessions
    const sessionConditions: ReturnType<typeof eq>[] = [];
    if (params.from) {
      sessionConditions.push(gte(sessions.scheduledAt, new Date(params.from)));
    }
    if (params.to) {
      sessionConditions.push(lte(sessions.scheduledAt, new Date(params.to)));
    }

    // Get upcoming sessions from enrolled courses
    const sessionEvents = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        date: sessions.scheduledAt,
        durationMinutes: sessions.durationMinutes,
        type: sessions.type,
        status: sessions.status,
        courseId: sessions.courseId,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
        zoomLink: sessions.zoomLink,
        roomName: sessions.roomName,
        venueAddress: sessions.venueAddress,
        instructorName: sql<string>`(
          SELECT CONCAT(u.first_name, ' ', u.last_name) FROM users u
          WHERE u.id = ${courses.instructorId}
        )`,
      })
      .from(sessions)
      .innerJoin(courses, eq(sessions.courseId, courses.id))
      .innerJoin(enrollments, eq(sessions.courseId, enrollments.courseId))
      .where(
        and(
          ...conditions,
          or(eq(sessions.status, 'scheduled'), eq(sessions.status, 'live')),
          ...sessionConditions,
          // Exclude make-up lectures not assigned to this student
          sql`(${sessions.isMakeup} = false OR ${sessions.assignedStudents} IS NULL OR ${sessions.assignedStudents}::jsonb @> ${JSON.stringify([studentId])}::jsonb)`,
        ),
      )
      .orderBy(asc(sessions.scheduledAt));

    const sessionMapped = sessionEvents.map((s) => ({
      id: s.id,
      title: s.title,
      date: s.date,
      durationMinutes: s.durationMinutes,
      eventType: 'session' as const,
      sessionType: s.type,
      status: s.status,
      courseId: s.courseId,
      courseTitle: s.courseTitle,
      courseTitleAr: s.courseTitleAr,
      zoomLink: s.zoomLink,
      roomName: s.roomName,
      venueAddress: s.venueAddress,
      instructorName: s.instructorName,
    }));

    // Also fetch assessments with due dates from enrolled courses
    const assessmentConditions: ReturnType<typeof eq>[] = [];
    if (params.from) {
      assessmentConditions.push(gte(assessments.dueDate, new Date(params.from)));
    }
    if (params.to) {
      assessmentConditions.push(lte(assessments.dueDate, new Date(params.to)));
    }

    const assessmentEvents = await db
      .select({
        id: assessments.id,
        title: assessments.title,
        date: assessments.dueDate,
        durationMinutes: assessments.durationMinutes,
        type: assessments.type,
        courseId: assessments.courseId,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
      })
      .from(assessments)
      .innerJoin(courses, eq(assessments.courseId, courses.id))
      .innerJoin(enrollments, eq(assessments.courseId, enrollments.courseId))
      .where(
        and(
          ...conditions,
          eq(assessments.status, 'published'),
          sql`${assessments.dueDate} IS NOT NULL`,
          ...assessmentConditions,
        ),
      )
      .orderBy(asc(assessments.dueDate));

    const assessmentMapped = assessmentEvents.map((a) => ({
      id: a.id,
      title: a.title,
      date: a.date,
      durationMinutes: a.durationMinutes,
      eventType: a.type === 'assignment' ? ('assignment' as const) : ('assessment' as const),
      sessionType: a.type,
      status: 'scheduled',
      courseId: a.courseId,
      courseTitle: a.courseTitle,
      courseTitleAr: a.courseTitleAr,
      zoomLink: null,
      roomName: null,
      venueAddress: null,
      instructorName: '',
    }));

    // Merge and sort by date
    const events = [...sessionMapped, ...assessmentMapped].sort(
      (a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime(),
    );

    return events;
  }

  /**
   * Export student calendar events as .ics (iCalendar) format.
   */
  async exportCalendarIcs(
    studentId: string,
    params: { from?: string; to?: string },
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const events = await this.getCalendarEvents(studentId, params);

    const formatIcsDate = (d: Date): string => {
      return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    };

    const icsLines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//PhysioGuidance//Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];

    for (const event of events) {
      if (!event.date) continue;
      const start = new Date(event.date);
      const duration = event.durationMinutes || 60;
      const end = new Date(start.getTime() + duration * 60 * 1000);

      const description = event.courseTitle
        ? `Course: ${event.courseTitle}`
        : '';
      const location = event.zoomLink || event.roomName || event.venueAddress || '';

      icsLines.push(
        'BEGIN:VEVENT',
        `UID:${event.id}@physioguidance.com`,
        `DTSTART:${formatIcsDate(start)}`,
        `DTEND:${formatIcsDate(end)}`,
        `SUMMARY:${(event.title || '').replace(/[,;\\]/g, ' ')}`,
        `DESCRIPTION:${description.replace(/[,;\\]/g, ' ')}`,
        `LOCATION:${location.replace(/[,;\\]/g, ' ')}`,
        `STATUS:CONFIRMED`,
        'END:VEVENT',
      );
    }

    icsLines.push('END:VCALENDAR');

    return {
      buffer: Buffer.from(icsLines.join('\r\n'), 'utf-8'),
      filename: 'physioguidance-calendar.ics',
      contentType: 'text/calendar',
    };
  }

  // ─── Zoom Join URL ─────────────────────────────────────

  /**
   * Generate a Zoom join URL with the student's name pre-filled as
   * "Full Name | PG-xxxxxxxx" (platform ID = first 8 chars of user UUID).
   * This allows Zoom sync to match attendance by platform ID instead of email.
   */
  async getSessionJoinUrl(
    studentId: string,
    sessionId: string,
  ): Promise<{ joinUrl: string }> {
    const [session] = await db
      .select({
        id: sessions.id,
        courseId: sessions.courseId,
        type: sessions.type,
        status: sessions.status,
        zoomLink: sessions.zoomLink,
      })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session) throw new NotFoundException('Session not found');
    if (!session.zoomLink) {
      throw new BadRequestException('This session has no Zoom link');
    }
    if (session.type !== 'zoom' && session.type !== 'hybrid') {
      throw new BadRequestException('This is not a Zoom session');
    }
    if (session.status === 'cancelled') {
      throw new BadRequestException('This session has been cancelled');
    }

    // Verify student is enrolled
    const [enrollment] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.courseId, session.courseId),
          eq(enrollments.status, 'active'),
        ),
      )
      .limit(1);

    if (!enrollment) {
      throw new NotFoundException('You are not enrolled in this course');
    }

    // Get student name
    const [student] = await db
      .select({ firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, studentId))
      .limit(1);

    const fullName =
      [student?.firstName, student?.lastName].filter(Boolean).join(' ') ||
      'Student';
    const platformId = `PG-${studentId.substring(0, 8)}`;
    const displayName = `${fullName} | ${platformId}`;

    // Append ?uname= to the Zoom join URL
    const separator = session.zoomLink.includes('?') ? '&' : '?';
    const joinUrl = `${session.zoomLink}${separator}uname=${encodeURIComponent(displayName)}`;

    // Audit log (fire and forget)
    this.auditService
      .log({
        eventType: NELC_EVENT_TYPE.ZOOM_JOIN_LINK_GENERATED,
        entityType: 'session',
        entityId: sessionId,
        userId: studentId,
        metadata: {
          sessionId,
          courseId: session.courseId,
          platformId,
          displayName,
        },
      })
      .catch(() => {});

    return { joinUrl };
  }

  // ─── Recent Activity ───────────────────────────────────

  async getRecentActivity(studentId: string, limit = 10) {
    // Derive activity timeline from existing tables (no separate notifications table)
    const [recentSubmissions, recentAttendance, recentEnrollments, recentCertificates] =
      await Promise.all([
        // Recent assessment submissions
        db
          .select({
            id: submissions.id,
            type: sql<string>`'assessment_submitted'`,
            title: assessments.title,
            courseTitle: courses.title,
            courseTitleAr: courses.titleAr,
            timestamp: submissions.submittedAt,
            metadata: sql<string>`json_build_object(
              'score', ${submissions.score},
              'status', ${submissions.status},
              'assessmentType', ${assessments.type}
            )`,
          })
          .from(submissions)
          .innerJoin(assessments, eq(submissions.assessmentId, assessments.id))
          .innerJoin(courses, eq(assessments.courseId, courses.id))
          .where(
            and(
              eq(submissions.studentId, studentId),
              sql`${submissions.submittedAt} IS NOT NULL`,
            ),
          )
          .orderBy(desc(submissions.submittedAt))
          .limit(limit),

        // Recent attendance records
        db
          .select({
            id: attendance.id,
            type: sql<string>`'session_attended'`,
            title: sessions.title,
            courseTitle: courses.title,
            courseTitleAr: courses.titleAr,
            timestamp: attendance.joinedAt,
            metadata: sql<string>`json_build_object(
              'status', ${attendance.status},
              'sessionType', ${sessions.type}
            )`,
          })
          .from(attendance)
          .innerJoin(sessions, eq(attendance.sessionId, sessions.id))
          .innerJoin(courses, eq(sessions.courseId, courses.id))
          .where(
            and(
              eq(attendance.studentId, studentId),
              sql`${attendance.status} IN ('present', 'late')`,
            ),
          )
          .orderBy(desc(attendance.joinedAt))
          .limit(limit),

        // Recent enrollments
        db
          .select({
            id: enrollments.id,
            type: sql<string>`'course_enrolled'`,
            title: courses.title,
            courseTitle: courses.title,
            courseTitleAr: courses.titleAr,
            timestamp: enrollments.enrolledAt,
            metadata: sql<string>`'{}'::json`,
          })
          .from(enrollments)
          .innerJoin(courses, eq(enrollments.courseId, courses.id))
          .where(eq(enrollments.studentId, studentId))
          .orderBy(desc(enrollments.enrolledAt))
          .limit(limit),

        // Recent certificates earned
        db
          .select({
            id: certificateRequests.id,
            type: sql<string>`'certificate_earned'`,
            title: courses.title,
            courseTitle: courses.title,
            courseTitleAr: courses.titleAr,
            timestamp: certificateRequests.reviewedAt,
            metadata: sql<string>`json_build_object('status', ${certificateRequests.status})`,
          })
          .from(certificateRequests)
          .innerJoin(courses, eq(certificateRequests.courseId, courses.id))
          .where(
            and(
              eq(certificateRequests.studentId, studentId),
              eq(certificateRequests.status, 'approved'),
            ),
          )
          .orderBy(desc(certificateRequests.reviewedAt))
          .limit(limit),
      ]);

    // Merge all, sort by timestamp desc, take top N
    const all = [
      ...recentSubmissions,
      ...recentAttendance,
      ...recentEnrollments,
      ...recentCertificates,
    ]
      .filter((a) => a.timestamp !== null)
      .sort(
        (a, b) =>
          new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime(),
      )
      .slice(0, limit);

    return all;
  }

  // ─── Transcript ────────────────────────────────────────

  async getTranscript(studentId: string) {
    // Get all completed enrollments with course details
    const completedCourses = await db
      .select({
        courseId: courses.id,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
        deliveryType: courses.deliveryType,
        startDate: courses.startDate,
        endDate: courses.endDate,
        enrolledAt: enrollments.enrolledAt,
        completedAt: enrollments.completedAt,
        progress: enrollments.progress,
        status: enrollments.status,
        instructorName: sql<string>`(
          SELECT CONCAT(u.first_name, ' ', u.last_name) FROM users u
          WHERE u.id = ${courses.instructorId}
        )`,
        totalHours: sql<number>`(
          SELECT COALESCE(SUM(cm.duration_minutes), 0) FROM course_modules cm WHERE cm.course_id = "courses"."id"
        )`.mapWith(Number),
        certificateStatus: sql<string>`(
          SELECT cr.status FROM certificate_requests cr
          WHERE cr.course_id = "courses"."id" AND cr.student_id = ${studentId}
          LIMIT 1
        )`,
        certificateUrl: sql<string>`(
          SELECT cr.certificate_url FROM certificate_requests cr
          WHERE cr.course_id = "courses"."id" AND cr.student_id = ${studentId}
          LIMIT 1
        )`,
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(eq(enrollments.studentId, studentId))
      .orderBy(desc(enrollments.completedAt));

    const enriched = completedCourses.map((c) => ({
      ...c,
      totalHours: Math.round((c.totalHours / 60) * 10) / 10,
    }));

    // Get student info
    const [student] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        firstNameAr: users.firstNameAr,
        lastNameAr: users.lastNameAr,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, studentId))
      .limit(1);

    return {
      student,
      courses: enriched,
      totalCompleted: enriched.filter((c) => c.status === 'completed').length,
      totalInProgress: enriched.filter((c) => c.status === 'active').length,
      totalHours: enriched
        .filter((c) => c.status === 'completed')
        .reduce((sum, c) => sum + c.totalHours, 0),
    };
  }

  // ─── Module Materials ────────────────────────────────────

  async getModuleMaterials(
    studentId: string,
    courseId: string,
    moduleId: string,
  ) {
    // Verify enrollment
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.courseId, courseId),
          or(
            eq(enrollments.status, 'active'),
            eq(enrollments.status, 'completed'),
          ),
        ),
      )
      .limit(1);

    if (!enrollment) {
      throw new NotFoundException('You are not enrolled in this course');
    }

    // Verify module belongs to course
    const [module] = await db
      .select()
      .from(courseModules)
      .where(
        and(
          eq(courseModules.id, moduleId),
          eq(courseModules.courseId, courseId),
        ),
      )
      .limit(1);

    if (!module) {
      throw new NotFoundException('Module not found in this course');
    }

    // NELC: Enforce sequential module access
    // Students must complete previous modules before accessing later ones
    if (module.orderIndex > 0) {
      const allModules = await db
        .select({ id: courseModules.id, orderIndex: courseModules.orderIndex })
        .from(courseModules)
        .where(eq(courseModules.courseId, courseId))
        .orderBy(asc(courseModules.orderIndex));

      const currentIdx = allModules.findIndex((m) => m.id === moduleId);
      if (currentIdx > 0) {
        const prevModule = allModules[currentIdx - 1];
        // Check if previous module's video materials are sufficiently watched
        const prevVideoMaterials = await db
          .select({ id: courseMaterials.id })
          .from(courseMaterials)
          .where(
            and(
              eq(courseMaterials.moduleId, prevModule.id),
              eq(courseMaterials.type, 'video'),
              eq(courseMaterials.status, 'live'),
            ),
          );

        if (prevVideoMaterials.length > 0) {
          const prevProgressRows = await db
            .select({
              materialId: materialProgress.materialId,
              furthestWatchedSecond: materialProgress.furthestWatchedSecond,
              totalSeconds: materialProgress.totalSeconds,
            })
            .from(materialProgress)
            .where(
              and(
                eq(materialProgress.studentId, studentId),
                sql`${materialProgress.materialId} IN (${sql.join(
                  prevVideoMaterials.map((v) => sql`${v.id}`),
                  sql`, `,
                )})`,
              ),
            );

          const allPrevWatched = prevVideoMaterials.every((v) => {
            const prog = prevProgressRows.find((p) => p.materialId === v.id);
            return prog && prog.totalSeconds > 0 && prog.furthestWatchedSecond / prog.totalSeconds >= 0.8;
          });

          if (!allPrevWatched) {
            throw new BadRequestException(
              'You must complete the previous module before accessing this one',
            );
          }
        }
      }
    }

    // Get live materials for this module
    const materials = await db
      .select({
        id: courseMaterials.id,
        title: courseMaterials.title,
        type: courseMaterials.type,
        fileUrl: courseMaterials.fileUrl,
        fileSize: courseMaterials.fileSize,
        mimeType: courseMaterials.mimeType,
        captionsUrl: courseMaterials.captionsUrl,
        transcriptUrl: courseMaterials.transcriptUrl,
        orderIndex: courseMaterials.orderIndex,
      })
      .from(courseMaterials)
      .where(
        and(
          eq(courseMaterials.moduleId, moduleId),
          eq(courseMaterials.status, 'live'),
        ),
      )
      .orderBy(asc(courseMaterials.orderIndex));

    // Batch fetch variants for video materials
    const videoMaterialIds = materials
      .filter((m) => m.type === 'video')
      .map((m) => m.id);

    let variantsMap: Record<string, any[]> = {};
    if (videoMaterialIds.length > 0) {
      const variants = await db
        .select({
          id: materialVariants.id,
          materialId: materialVariants.materialId,
          resolution: materialVariants.resolution,
          fileUrl: materialVariants.fileUrl,
          fileSize: materialVariants.fileSize,
          width: materialVariants.width,
          height: materialVariants.height,
          bitrate: materialVariants.bitrate,
          mimeType: materialVariants.mimeType,
        })
        .from(materialVariants)
        .where(
          sql`${materialVariants.materialId} IN (${sql.join(
            videoMaterialIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        );

      for (const v of variants) {
        if (!variantsMap[v.materialId]) {
          variantsMap[v.materialId] = [];
        }
        variantsMap[v.materialId].push({
          id: v.id,
          resolution: v.resolution,
          fileUrl: v.fileUrl,
          fileSize: v.fileSize,
          width: v.width,
          height: v.height,
          bitrate: v.bitrate,
          mimeType: v.mimeType,
        });
      }
    }

    // Batch fetch student's progress for these materials
    const materialIds = materials.map((m) => m.id);
    let progressMap: Record<string, { watchedSeconds: number; totalSeconds: number; furthestWatchedSecond: number; isCompleted: boolean }> = {};
    if (materialIds.length > 0) {
      const progressRows = await db
        .select({
          materialId: materialProgress.materialId,
          watchedSeconds: materialProgress.watchedSeconds,
          totalSeconds: materialProgress.totalSeconds,
          furthestWatchedSecond: materialProgress.furthestWatchedSecond,
          completedAt: materialProgress.completedAt,
        })
        .from(materialProgress)
        .where(
          and(
            eq(materialProgress.studentId, studentId),
            sql`${materialProgress.materialId} IN (${sql.join(
              materialIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          ),
        );

      for (const p of progressRows) {
        progressMap[p.materialId] = {
          watchedSeconds: p.watchedSeconds,
          totalSeconds: p.totalSeconds,
          furthestWatchedSecond: p.furthestWatchedSecond,
          isCompleted: !!p.completedAt,
        };
      }
    }

    return {
      materials: materials.map((m) => ({
        ...m,
        variants: variantsMap[m.id] || [],
        progress: progressMap[m.id] || null,
      })),
    };
  }

  // ─── Support Tickets ────────────────────────────────────

  /**
   * Create a new support ticket
   */
  async createTicket(studentId: string, dto: CreateTicketDto) {
    const [ticket] = await db
      .insert(tickets)
      .values({
        studentId,
        category: dto.category,
        priority: dto.priority ?? 'medium',
        subject: dto.subject,
        description: dto.description,
        courseId: dto.courseId ?? null,
        attachmentUrl: dto.attachmentUrl ?? null,
      })
      .returning();

    return ticket;
  }

  /**
   * List student's tickets with optional status filter
   */
  async getTickets(
    studentId: string,
    params?: { status?: string; page?: number; limit?: number },
  ) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions = [eq(tickets.studentId, studentId)];

    if (
      params?.status &&
      ['new', 'in_progress', 'resolved', 'closed'].includes(params.status)
    ) {
      conditions.push(eq(tickets.status, params.status));
    }

    const whereClause = and(...conditions);

    const [ticketRows, totalResult] = await Promise.all([
      db
        .select({
          id: tickets.id,
          category: tickets.category,
          priority: tickets.priority,
          subject: tickets.subject,
          status: tickets.status,
          courseTitle: courses.title,
          courseTitleAr: courses.titleAr,
          createdAt: tickets.createdAt,
          updatedAt: tickets.updatedAt,
          resolvedAt: tickets.resolvedAt,
        })
        .from(tickets)
        .leftJoin(courses, eq(tickets.courseId, courses.id))
        .where(whereClause)
        .orderBy(desc(tickets.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(tickets)
        .where(whereClause),
    ]);

    return {
      tickets: ticketRows,
      total: totalResult[0]?.count ?? 0,
      page,
      limit,
    };
  }

  /**
   * Get a single ticket with its replies
   */
  async getTicketDetail(studentId: string, ticketId: string) {
    const [ticket] = await db
      .select({
        id: tickets.id,
        category: tickets.category,
        priority: tickets.priority,
        subject: tickets.subject,
        description: tickets.description,
        attachmentUrl: tickets.attachmentUrl,
        status: tickets.status,
        satisfactionRating: tickets.satisfactionRating,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
        resolvedAt: tickets.resolvedAt,
        closedAt: tickets.closedAt,
      })
      .from(tickets)
      .leftJoin(courses, eq(tickets.courseId, courses.id))
      .where(and(eq(tickets.id, ticketId), eq(tickets.studentId, studentId)));

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Fetch replies with user info
    const replies = await db
      .select({
        id: ticketReplies.id,
        message: ticketReplies.message,
        isStaffReply: ticketReplies.isStaffReply,
        createdAt: ticketReplies.createdAt,
        userFirstName: users.firstName,
        userLastName: users.lastName,
      })
      .from(ticketReplies)
      .leftJoin(users, eq(ticketReplies.userId, users.id))
      .where(eq(ticketReplies.ticketId, ticketId))
      .orderBy(asc(ticketReplies.createdAt));

    return {
      ...ticket,
      replies: replies.map((r) => ({
        id: r.id,
        message: r.message,
        isStaffReply: r.isStaffReply,
        createdAt: r.createdAt,
        userName: [r.userFirstName, r.userLastName].filter(Boolean).join(' ') || 'Unknown',
      })),
    };
  }

  /**
   * Add a reply to a ticket
   */
  async replyToTicket(
    studentId: string,
    ticketId: string,
    dto: ReplyTicketDto,
  ) {
    // Verify the ticket belongs to this student and is not closed
    const [ticket] = await db
      .select({ id: tickets.id, status: tickets.status })
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), eq(tickets.studentId, studentId)));

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.status === 'closed') {
      throw new BadRequestException('Cannot reply to a closed ticket');
    }

    const [reply] = await db
      .insert(ticketReplies)
      .values({
        ticketId,
        userId: studentId,
        message: dto.message,
        isStaffReply: false,
      })
      .returning();

    // Update ticket's updatedAt
    await db
      .update(tickets)
      .set({ updatedAt: new Date() })
      .where(eq(tickets.id, ticketId));

    return reply;
  }

  /**
   * Rate a resolved ticket (satisfaction 1-5)
   */
  async rateTicket(studentId: string, ticketId: string, dto: RateTicketDto) {
    const [ticket] = await db
      .select({ id: tickets.id, status: tickets.status })
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), eq(tickets.studentId, studentId)));

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.status !== 'resolved' && ticket.status !== 'closed') {
      throw new BadRequestException(
        'Can only rate resolved or closed tickets',
      );
    }

    await db
      .update(tickets)
      .set({ satisfactionRating: dto.rating })
      .where(eq(tickets.id, ticketId));

    return { success: true };
  }

  // ─── FAQ ──────────────────────────────────────────────────

  async getFaqs(): Promise<{
    categories: { id: string; title: string; titleAr: string; items: { question: string; questionAr: string; answer: string; answerAr: string }[] }[];
  }> {
    return {
      categories: [
        {
          id: 'enrollment',
          title: 'Enrollment & Registration',
          titleAr: 'التسجيل والقبول',
          items: [
            {
              question: 'How do I enroll in a course?',
              questionAr: 'كيف أسجل في دورة؟',
              answer: 'Browse the Course Catalog, select a course, and click "Enroll Now". You will receive a confirmation email once enrolled.',
              answerAr: 'تصفح كتالوج الدورات، اختر الدورة، وانقر على "سجل الآن". ستتلقى بريدًا إلكترونيًا للتأكيد بمجرد التسجيل.',
            },
            {
              question: 'What are the enrollment limits?',
              questionAr: 'ما هي حدود التسجيل؟',
              answer: 'Per NELC guidelines, long courses (>5 days) are limited to 40 learners, and short courses (≤5 days) are limited to 50 learners.',
              answerAr: 'وفقًا لإرشادات المركز الوطني للتعليم الإلكتروني، الدورات الطويلة (أكثر من 5 أيام) محدودة بـ 40 متعلمًا، والدورات القصيرة (5 أيام أو أقل) محدودة بـ 50 متعلمًا.',
            },
          ],
        },
        {
          id: 'certificates',
          title: 'Certificates',
          titleAr: 'الشهادات',
          items: [
            {
              question: 'How do I get my certificate?',
              questionAr: 'كيف أحصل على شهادتي؟',
              answer: 'Certificates are automatically requested when you complete a course. Requirements: ≥70% attendance, all assessments passed, and course 100% complete. A reviewer will approve your certificate.',
              answerAr: 'يتم طلب الشهادات تلقائيًا عند إكمال الدورة. المتطلبات: حضور ≥70%، اجتياز جميع التقييمات، وإكمال الدورة بنسبة 100%. سيقوم المراجع بالموافقة على شهادتك.',
            },
            {
              question: 'How do I verify a certificate?',
              questionAr: 'كيف أتحقق من صحة الشهادة؟',
              answer: 'Each certificate has a QR code. Scan it or visit the verification link to confirm its authenticity.',
              answerAr: 'كل شهادة تحتوي على رمز QR. امسحه ضوئيًا أو زر رابط التحقق للتأكد من صحتها.',
            },
          ],
        },
        {
          id: 'technical',
          title: 'Technical Support',
          titleAr: 'الدعم الفني',
          items: [
            {
              question: 'How do I join a Zoom session?',
              questionAr: 'كيف أنضم إلى جلسة زوم؟',
              answer: 'Go to your Calendar or Dashboard, find the upcoming session, and click "Join" when the session is about to start (available 15 minutes before).',
              answerAr: 'انتقل إلى التقويم أو لوحة التحكم، ابحث عن الجلسة القادمة، وانقر على "انضم" عندما توشك الجلسة على البدء (متاح قبل 15 دقيقة).',
            },
            {
              question: 'My video is not playing. What should I do?',
              questionAr: 'الفيديو لا يعمل. ماذا أفعل؟',
              answer: 'Try refreshing the page, clearing your browser cache, or switching to a different browser. If the problem persists, submit a support ticket.',
              answerAr: 'حاول تحديث الصفحة، مسح ذاكرة التخزين المؤقت للمتصفح، أو التبديل إلى متصفح مختلف. إذا استمرت المشكلة، أرسل تذكرة دعم.',
            },
          ],
        },
        {
          id: 'assessments',
          title: 'Assessments & Grades',
          titleAr: 'التقييمات والدرجات',
          items: [
            {
              question: 'Can I retake an assessment?',
              questionAr: 'هل يمكنني إعادة التقييم؟',
              answer: 'Retakes depend on the course settings. If allowed, there is a cooling period between attempts. Check the assessment page for details.',
              answerAr: 'تعتمد إعادة التقييم على إعدادات الدورة. إذا كان مسموحًا، هناك فترة انتظار بين المحاولات. تحقق من صفحة التقييم للتفاصيل.',
            },
          ],
        },
      ],
    };
  }

  // ─── Video Tutorials ──────────────────────────────────────

  async getVideoTutorials(): Promise<{
    tutorials: { id: string; title: string; titleAr: string; description: string; descriptionAr: string; videoUrl: string; thumbnailUrl: string; durationMinutes: number; category: string }[];
  }> {
    return {
      tutorials: [
        {
          id: 'tut-1',
          title: 'Getting Started with PhysioGuidance',
          titleAr: 'البدء مع PhysioGuidance',
          description: 'Learn how to navigate the platform, enroll in courses, and access your dashboard.',
          descriptionAr: 'تعلم كيفية التنقل في المنصة والتسجيل في الدورات والوصول إلى لوحة التحكم.',
          videoUrl: '/tutorials/getting-started.mp4',
          thumbnailUrl: '/tutorials/thumbnails/getting-started.jpg',
          durationMinutes: 5,
          category: 'getting-started',
        },
        {
          id: 'tut-2',
          title: 'How to Take an Assessment',
          titleAr: 'كيفية إجراء التقييم',
          description: 'Step-by-step guide on taking quizzes, exams, and submitting assignments.',
          descriptionAr: 'دليل خطوة بخطوة لإجراء الاختبارات والامتحانات وتقديم المهام.',
          videoUrl: '/tutorials/taking-assessment.mp4',
          thumbnailUrl: '/tutorials/thumbnails/taking-assessment.jpg',
          durationMinutes: 7,
          category: 'assessments',
        },
        {
          id: 'tut-3',
          title: 'Using the Calendar & Joining Sessions',
          titleAr: 'استخدام التقويم والانضمام إلى الجلسات',
          description: 'Learn how to view your schedule, set reminders, and join Zoom sessions.',
          descriptionAr: 'تعلم كيفية عرض جدولك وتعيين التذكيرات والانضمام إلى جلسات زوم.',
          videoUrl: '/tutorials/calendar-sessions.mp4',
          thumbnailUrl: '/tutorials/thumbnails/calendar-sessions.jpg',
          durationMinutes: 4,
          category: 'sessions',
        },
        {
          id: 'tut-4',
          title: 'Understanding Certificates & Transcripts',
          titleAr: 'فهم الشهادات والنصوص الأكاديمية',
          description: 'How to earn certificates, download them, and access your academic transcript.',
          descriptionAr: 'كيفية الحصول على الشهادات وتنزيلها والوصول إلى النص الأكاديمي.',
          videoUrl: '/tutorials/certificates-transcripts.mp4',
          thumbnailUrl: '/tutorials/thumbnails/certificates-transcripts.jpg',
          durationMinutes: 6,
          category: 'certificates',
        },
        {
          id: 'tut-5',
          title: 'Accessibility Features',
          titleAr: 'ميزات إمكانية الوصول',
          description: 'Learn about language switching, font size controls, high contrast mode, and captions.',
          descriptionAr: 'تعرف على تبديل اللغة وأدوات حجم الخط ووضع التباين العالي والترجمة.',
          videoUrl: '/tutorials/accessibility.mp4',
          thumbnailUrl: '/tutorials/thumbnails/accessibility.jpg',
          durationMinutes: 3,
          category: 'accessibility',
        },
      ],
    };
  }

  // ─── Video Watch Events (Feature 7) ───────────────────

  async recordWatchEvents(
    studentId: string,
    materialId: string,
    events: { eventType: string; position: number; fromPosition?: number }[],
  ) {
    if (events.length === 0) return { recorded: 0 };

    const values = events.map((e) => ({
      materialId,
      studentId,
      eventType: e.eventType,
      position: e.position,
      fromPosition: e.fromPosition ?? null,
    }));

    await db.insert(videoWatchEvents).values(values);

    return { recorded: events.length };
  }
}
