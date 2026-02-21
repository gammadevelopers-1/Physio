import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { eq, and, sql, inArray, count, asc, desc } from 'drizzle-orm';
import { db } from '../../database';
import {
  enrollments,
  attendance,
  sessions,
  courses,
  courseModules,
  courseMaterials,
  users,
  assessments,
  submissions,
  questions,
  interventions,
  ATTENDANCE_STATUS,
  INTERVENTION_TYPE,
} from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CoursesService } from '../courses/courses.service';
import { SessionsService } from '../sessions/sessions.service';
import { CertificatesService } from '../certificates/certificates.service';
import { EmailService } from '../email/email.service';
import { CreateInterventionDto } from './dto';

@Injectable()
export class InstructorService {
  private readonly logger = new Logger(InstructorService.name);

  constructor(
    private readonly coursesService: CoursesService,
    private readonly sessionsService: SessionsService,
    private readonly certificatesService: CertificatesService,
    private readonly emailService: EmailService,
  ) {}

  // ─── Role helpers ─────────────────────────────────────────

  private isAdmin(user: AuthenticatedUser): boolean {
    return (
      user.roles.includes('ADMIN') ||
      user.roles.includes('SUPER_ADMIN') ||
      user.roles.includes('MANAGER')
    );
  }

  // ─── Dashboard Summary ──────────────────────────────────────

  /**
   * GET /instructor/dashboard-summary
   * Aggregated endpoint returning data for all dashboard widgets.
   * Uses Promise.all for concurrent fetching.
   */
  async getDashboardSummary(user: AuthenticatedUser) {
    const [
      coursesResult,
      todaySessions,
      upcomingSessions,
      atRiskLearners,
      certificatesResult,
    ] = await Promise.all([
      this.coursesService.findAll(user, { status: 'active', limit: 100 }),
      this.sessionsService.findToday(user),
      this.sessionsService.findUpcoming(user),
      this.getAtRiskStudents(user),
      this.certificatesService.findPending(user, { status: 'pending', limit: 50 }),
    ]);

    // Enrich today's sessions with enrollment counts
    const enrichedTodaySessions = await Promise.all(
      todaySessions.map(async (session) => {
        const [result] = await db
          .select({ count: count() })
          .from(enrollments)
          .where(eq(enrollments.courseId, session.courseId));
        return {
          ...session,
          enrolledCount: result?.count || 0,
        };
      }),
    );

    // Enrich upcoming sessions with enrollment counts
    const enrichedUpcomingSessions = await Promise.all(
      upcomingSessions.map(async (session) => {
        const [result] = await db
          .select({ count: count() })
          .from(enrollments)
          .where(eq(enrollments.courseId, session.courseId));
        return {
          ...session,
          enrolledCount: result?.count || 0,
        };
      }),
    );

    // Enrich pending certificates with course name
    const enrichedCertificates = await Promise.all(
      (certificatesResult.data || []).map(async (cert) => {
        const [course] = await db
          .select({ title: courses.title })
          .from(courses)
          .where(eq(courses.id, cert.courseId))
          .limit(1);
        return {
          ...cert,
          courseName: course?.title || 'Unknown Course',
        };
      }),
    );

    // ─── Attendance Trend (last 7 days) ──────────────────────
    const courseIds = (coursesResult.data || []).map((c) => c.id);
    let attendanceTrend: number[] = [0, 0, 0, 0, 0, 0, 0];

    if (courseIds.length > 0) {
      // Get all session IDs for instructor's courses
      const courseSessions = await db
        .select({ id: sessions.id, scheduledAt: sessions.scheduledAt })
        .from(sessions)
        .where(inArray(sessions.courseId, courseIds));

      const sessionIds = courseSessions.map((s) => s.id);

      if (sessionIds.length > 0) {
        // Attendance per day for last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const dailyAttendance = await db
          .select({
            dayOfWeek: sql<number>`EXTRACT(DOW FROM ${sessions.scheduledAt})`.as('dow'),
            totalRecords: count(),
            presentCount:
              sql<number>`SUM(CASE WHEN ${attendance.status} IN ('present', 'late') THEN 1 ELSE 0 END)`.as(
                'present_count',
              ),
          })
          .from(attendance)
          .innerJoin(sessions, eq(attendance.sessionId, sessions.id))
          .where(
            and(
              inArray(attendance.sessionId, sessionIds),
              sql`${sessions.scheduledAt} >= ${sevenDaysAgo.toISOString()}`,
            ),
          )
          .groupBy(sql`EXTRACT(DOW FROM ${sessions.scheduledAt})`);

        // Map to Mon-Sun array (1=Mon ... 0=Sun → index 0-6)
        const trendMap = new Map<number, number>();
        for (const row of dailyAttendance) {
          const total = Number(row.totalRecords);
          const present = Number(row.presentCount);
          const rate = total > 0 ? Math.round((present / total) * 100) : 0;
          trendMap.set(Number(row.dayOfWeek), rate);
        }

        // PostgreSQL DOW: 0=Sun, 1=Mon, ..., 6=Sat
        // Frontend expects: [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
        attendanceTrend = [1, 2, 3, 4, 5, 6, 0].map(
          (dow) => trendMap.get(dow) ?? 0,
        );
      }
    }

    // ─── Module Progress (first active course or all) ──────
    let moduleProgress: { name: string; percentage: number }[] = [];

    if (courseIds.length > 0) {
      // Get the first active course's modules
      const firstCourseId = courseIds[0];
      const modules = await db
        .select({
          id: courseModules.id,
          title: courseModules.title,
          orderIndex: courseModules.orderIndex,
        })
        .from(courseModules)
        .where(eq(courseModules.courseId, firstCourseId))
        .orderBy(asc(courseModules.orderIndex));

      if (modules.length > 0) {
        // Get total enrolled students for this course
        const [enrollCount] = await db
          .select({ count: count() })
          .from(enrollments)
          .where(eq(enrollments.courseId, firstCourseId));
        const totalStudents = enrollCount?.count || 0;

        // Approximate module completion from overall enrollment progress
        // Each module's completion = students whose progress >= (moduleIndex+1)/totalModules * 100
        const totalModules = modules.length;
        const studentProgresses = totalStudents > 0
          ? await db
              .select({ progress: enrollments.progress })
              .from(enrollments)
              .where(eq(enrollments.courseId, firstCourseId))
          : [];

        moduleProgress = modules.map((mod, idx) => {
          const threshold = ((idx + 1) / totalModules) * 100;
          const completed = studentProgresses.filter(
            (s) => (s.progress ?? 0) >= threshold,
          ).length;
          const percentage =
            totalStudents > 0
              ? Math.round((completed / totalStudents) * 100)
              : 0;
          return { name: mod.title, percentage };
        });
      }
    }

    // ─── Assessment Analysis (pre/post comparison) ─────────
    let assessmentScores: {
      id: string;
      name: string;
      preScore: number;
      postScore: number;
    }[] = [];
    let questionAnalysis: {
      id: string;
      question: string;
      difficulty: 'easy' | 'medium' | 'hard';
      correctRate: number;
    }[] = [];

    if (courseIds.length > 0) {
      // Get all published assessments across instructor's courses
      const courseAssessments = await db
        .select({
          id: assessments.id,
          title: assessments.title,
          courseId: assessments.courseId,
          type: assessments.type,
          createdAt: assessments.createdAt,
        })
        .from(assessments)
        .where(
          and(
            inArray(assessments.courseId, courseIds),
            eq(assessments.status, 'published'),
          ),
        )
        .orderBy(asc(assessments.createdAt));

      if (courseAssessments.length > 0) {
        // Build pre/post comparison: first assessment is "pre", rest are "post" progression
        const comparisons = [];
        for (const ca of courseAssessments) {
          const [avgResult] = await db
            .select({
              avgPercentage:
                sql<number>`COALESCE(ROUND(AVG(CAST(${submissions.percentage} AS NUMERIC)), 2), 0)`.as(
                  'avg_pct',
                ),
              totalSubs: count(),
            })
            .from(submissions)
            .where(
              and(
                eq(submissions.assessmentId, ca.id),
                eq(submissions.status, 'graded'),
              ),
            );

          comparisons.push({
            id: ca.id,
            title: ca.title,
            avgPercentage: Number(avgResult?.avgPercentage ?? 0),
            totalSubmissions: Number(avgResult?.totalSubs ?? 0),
          });
        }

        // Create pre/post pairs: for each assessment, preScore = first assessment avg, postScore = this assessment avg
        const firstAvg = comparisons[0]?.avgPercentage ?? 0;
        assessmentScores = comparisons.map((c) => ({
          id: c.id,
          name: c.title,
          preScore: Math.round(firstAvg),
          postScore: Math.round(c.avgPercentage),
        }));

        // Get question analysis for the most recent assessment
        const latestAssessment =
          courseAssessments[courseAssessments.length - 1];
        const assessmentQuestions = await db
          .select({
            id: questions.id,
            questionText: questions.questionText,
            difficultyLevel: questions.difficultyLevel,
          })
          .from(questions)
          .where(eq(questions.assessmentId, latestAssessment.id));

        if (assessmentQuestions.length > 0) {
          // Get graded submissions for this assessment
          const gradedSubs = await db
            .select({ answers: submissions.answers })
            .from(submissions)
            .where(
              and(
                eq(submissions.assessmentId, latestAssessment.id),
                eq(submissions.status, 'graded'),
              ),
            );

          questionAnalysis = assessmentQuestions.map((q) => {
            let totalAttempts = 0;
            let correctAnswers = 0;

            for (const sub of gradedSubs) {
              const answers = (sub.answers as { questionId: string; isCorrect: boolean | null }[]) || [];
              const answer = answers.find((a) => a.questionId === q.id);
              if (answer && answer.isCorrect !== null) {
                totalAttempts++;
                if (answer.isCorrect) correctAnswers++;
              }
            }

            const correctRate =
              totalAttempts > 0
                ? Math.round((correctAnswers / totalAttempts) * 100)
                : 0;

            // Map difficulty level
            let difficulty: 'easy' | 'medium' | 'hard' = 'medium';
            if (q.difficultyLevel === 'easy') difficulty = 'easy';
            else if (q.difficultyLevel === 'hard') difficulty = 'hard';
            else if (!q.difficultyLevel) {
              // Auto-detect from correct rate
              if (correctRate >= 70) difficulty = 'easy';
              else if (correctRate < 40) difficulty = 'hard';
            }

            return {
              id: q.id,
              question: q.questionText,
              difficulty,
              correctRate,
            };
          });
        }
      }
    }

    // ─── Materials for Content Management tab ────────────────
    let materials: {
      id: string;
      type: string;
      name: string;
      version: string;
      status: string;
      wcagCompliant: boolean | 'warning';
      size?: string;
    }[] = [];

    if (courseIds.length > 0) {
      const rawMaterials = await db
        .select({
          id: courseMaterials.id,
          title: courseMaterials.title,
          type: courseMaterials.type,
          version: courseMaterials.version,
          status: courseMaterials.status,
          wcagStatus: courseMaterials.wcagStatus,
          fileSize: courseMaterials.fileSize,
        })
        .from(courseMaterials)
        .where(inArray(courseMaterials.courseId, courseIds))
        .orderBy(desc(courseMaterials.createdAt));

      materials = rawMaterials.map((m) => ({
        id: m.id,
        type: m.type as 'video' | 'pdf' | 'document' | 'image',
        name: m.title,
        version: `v${m.version}`,
        status: m.status === 'failed' ? 'draft' : m.status,
        wcagCompliant:
          m.wcagStatus === 'compliant'
            ? true
            : m.wcagStatus === 'pending'
              ? ('warning' as const)
              : false,
        size: m.fileSize
          ? m.fileSize < 1024 * 1024
            ? `${(m.fileSize / 1024).toFixed(1)} KB`
            : `${(m.fileSize / (1024 * 1024)).toFixed(1)} MB`
          : undefined,
      }));
    }

    // ─── Assessments for Assessments tab ────────────────────
    let tabAssessments: {
      id: string;
      title: string;
      questions: number;
      submissions: number;
      avgScore: number;
    }[] = [];

    if (courseIds.length > 0) {
      const allAssessments = await db
        .select({
          id: assessments.id,
          title: assessments.title,
        })
        .from(assessments)
        .where(inArray(assessments.courseId, courseIds))
        .orderBy(desc(assessments.createdAt));

      tabAssessments = await Promise.all(
        allAssessments.map(async (a) => {
          const [qCount] = await db
            .select({ count: count() })
            .from(questions)
            .where(eq(questions.assessmentId, a.id));

          const [subStats] = await db
            .select({
              count: count(),
              avgPct: sql<number>`COALESCE(ROUND(AVG(CAST(${submissions.percentage} AS NUMERIC))), 0)`.as('avg_pct'),
            })
            .from(submissions)
            .where(eq(submissions.assessmentId, a.id));

          return {
            id: a.id,
            title: a.title,
            questions: qCount?.count || 0,
            submissions: subStats?.count || 0,
            avgScore: Number(subStats?.avgPct ?? 0),
          };
        }),
      );
    }

    // ─── Total Students across all instructor courses ────────
    let totalStudents = 0;
    if (courseIds.length > 0) {
      const [studentCount] = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${enrollments.studentId})`.as('count') })
        .from(enrollments)
        .where(
          and(
            inArray(enrollments.courseId, courseIds),
            eq(enrollments.status, 'active'),
          ),
        );
      totalStudents = Number(studentCount?.count ?? 0);
    }

    return {
      kpis: {
        activeCourses: coursesResult.total || 0,
        totalStudents,
        todaysSessions: todaySessions.length,
        atRiskLearners: atRiskLearners.length,
      },
      todaySessions: enrichedTodaySessions,
      upcomingSessions: enrichedUpcomingSessions,
      atRiskLearners,
      pendingCertificates: enrichedCertificates,
      activeCourses: (coursesResult.data || []).map((c) => ({
        id: c.id,
        title: c.title,
        titleAr: c.titleAr,
        status: c.status,
      })),
      attendanceTrend,
      moduleProgress,
      assessmentScores,
      questionAnalysis,
      materials,
      tabAssessments,
    };
  }

  // ─── Students View ────────────────────────────────────────

  /**
   * GET /instructor/students
   * List all unique students across the instructor's courses.
   * - Instructor: students enrolled in their own courses only.
   * - Admin: all enrolled students across all courses.
   */
  async getStudents(user: AuthenticatedUser, courseId?: string) {
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

    let courseIds = instructorCourses.map((c) => c.id);

    if (courseIds.length === 0) {
      return [];
    }

    // If a specific courseId filter is provided, narrow down
    if (courseId && courseIds.includes(courseId)) {
      courseIds = [courseId];
    } else if (courseId) {
      return []; // courseId not in instructor's courses
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

    // Get per-student course enrollments (for intervention context)
    const studentCourseEnrollments = await db
      .select({
        studentId: enrollments.studentId,
        courseId: enrollments.courseId,
      })
      .from(enrollments)
      .where(inArray(enrollments.courseId, courseIds));

    const studentCoursesMap = new Map<string, string[]>();
    for (const e of studentCourseEnrollments) {
      const existing = studentCoursesMap.get(e.studentId) || [];
      existing.push(e.courseId);
      studentCoursesMap.set(e.studentId, existing);
    }

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

      // Criterion 2: Assessment average < 60%
      const studentCourseIds = studentCoursesMap.get(studentId) || [];
      if (studentCourseIds.length > 0) {
        const studentSubmissions = await db
          .select({
            percentage: submissions.percentage,
          })
          .from(submissions)
          .innerJoin(assessments, eq(submissions.assessmentId, assessments.id))
          .where(
            and(
              eq(submissions.studentId, studentId),
              eq(submissions.status, 'graded'),
              inArray(assessments.courseId, studentCourseIds),
            ),
          );

        if (studentSubmissions.length > 0) {
          const avgPercentage =
            studentSubmissions.reduce(
              (sum, s) => sum + parseFloat(s.percentage || '0'),
              0,
            ) / studentSubmissions.length;

          if (avgPercentage < 60) {
            riskReasons.push(
              `Assessment average ${avgPercentage.toFixed(1)}% (below 60%)`,
            );
          }
        }
      }

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
          enrolledCourseIds: studentCoursesMap.get(studentId) || [],
        });
      }
    }

    return atRiskStudents;
  }

  // ─── Interventions ──────────────────────────────────────────

  /**
   * POST /instructor/interventions
   * Create an intervention for an at-risk student.
   */
  async createIntervention(
    user: AuthenticatedUser,
    dto: CreateInterventionDto,
  ) {
    // 1. Verify student exists
    const [student] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, dto.studentId))
      .limit(1);

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // 2. Verify instructor has access to this student
    const courseConditions = this.isAdmin(user)
      ? []
      : [eq(courses.instructorId, user.id)];

    const instructorCourses = await db
      .select({ id: courses.id, title: courses.title })
      .from(courses)
      .where(
        courseConditions.length > 0
          ? and(...courseConditions)
          : undefined,
      );

    const instructorCourseIds = instructorCourses.map((c) => c.id);

    if (instructorCourseIds.length === 0) {
      throw new NotFoundException('No courses found');
    }

    // Verify student is enrolled in at least one of the instructor's courses
    const studentEnrollment = await db
      .select({ courseId: enrollments.courseId })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, dto.studentId),
          inArray(enrollments.courseId, instructorCourseIds),
        ),
      )
      .limit(1);

    if (studentEnrollment.length === 0) {
      throw new NotFoundException('Student is not enrolled in your courses');
    }

    // 3. Resolve courseId
    const resolvedCourseId = dto.courseId || studentEnrollment[0].courseId;
    const courseName =
      instructorCourses.find((c) => c.id === resolvedCourseId)?.title ||
      'your course';

    // 4. Handle action by type
    let metadata: Record<string, unknown> = {};

    switch (dto.type) {
      case INTERVENTION_TYPE.EMAIL: {
        const studentName =
          `${student.firstName || ''} ${student.lastName || ''}`.trim() ||
          student.email;
        await this.emailService.sendAtRiskReminder(
          student.email,
          studentName,
          courseName,
          dto.message || undefined,
        );
        metadata = { emailSentTo: student.email, courseName };
        this.logger.log(
          `At-risk email sent to ${student.email} for course "${courseName}"`,
        );
        break;
      }

      case INTERVENTION_TYPE.MAKEUP_SESSION: {
        metadata = {
          action: 'navigate_to_session_form',
          courseId: resolvedCourseId,
          courseName,
          studentId: dto.studentId,
        };
        this.logger.log(
          `Make-up session intervention logged for student ${dto.studentId}`,
        );
        break;
      }

      case INTERVENTION_TYPE.TICKET: {
        metadata = {
          action: 'ticket_placeholder',
          courseName,
          message: dto.message || 'Support ticket requested',
        };
        this.logger.log(
          `Support ticket placeholder logged for student ${dto.studentId}`,
        );
        break;
      }
    }

    // 5. Insert audit log
    const [intervention] = await db
      .insert(interventions)
      .values({
        instructorId: user.id,
        studentId: dto.studentId,
        courseId: resolvedCourseId,
        type: dto.type,
        message: dto.message || null,
        metadata,
      })
      .returning();

    return intervention;
  }
}
