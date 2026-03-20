import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { eq, and, sql, inArray, count, asc, desc, gte, lte, or } from 'drizzle-orm';
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
  userRoles,
  roles,
  courseRatings,
  materialProgress,
  ATTENDANCE_STATUS,
  INTERVENTION_TYPE,
} from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { isGlobalAdmin, isManager } from '../../common/role-helpers';
import { CoursesService } from '../courses/courses.service';
import { SessionsService } from '../sessions/sessions.service';
import { CertificatesService } from '../certificates/certificates.service';
import { EmailService } from '../email/email.service';
import { UserNotificationsService } from '../user-notifications/user-notifications.service';
import { CreateInterventionDto } from './dto';

@Injectable()
export class InstructorService {
  private readonly logger = new Logger(InstructorService.name);

  constructor(
    private readonly coursesService: CoursesService,
    private readonly sessionsService: SessionsService,
    private readonly certificatesService: CertificatesService,
    private readonly emailService: EmailService,
    private readonly userNotificationsService: UserNotificationsService,
  ) {}

  // ─── Role helpers ─────────────────────────────────────────

  /**
   * Returns course ownership conditions based on user role:
   * - Global admin: [] (no filter)
   * - Manager: [eq(courses.managerId, user.id)]
   * - Instructor: [eq(courses.instructorId, user.id)]
   */
  private getCourseOwnershipConditions(user: AuthenticatedUser): any[] {
    if (isGlobalAdmin(user)) return [];
    if (isManager(user)) return [or(eq(courses.managerId, user.id), sql`${courses.managerId} IS NULL`)!];
    return [eq(courses.instructorId, user.id)];
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

    // Batch-fetch course thumbnails for all sessions (single query, no N+1)
    const allSessionCourseIds = [
      ...new Set([
        ...todaySessions.map((s) => s.courseId),
        ...upcomingSessions.map((s) => s.courseId),
      ]),
    ];
    const courseThumbnails = allSessionCourseIds.length > 0
      ? await db
          .select({ id: courses.id, thumbnail: courses.thumbnail })
          .from(courses)
          .where(inArray(courses.id, allSessionCourseIds))
      : [];
    const thumbnailMap = new Map(courseThumbnails.map((c) => [c.id, c.thumbnail]));

    // Enrich today's sessions with enrollment counts + course thumbnail
    const enrichedTodaySessions = await Promise.all(
      todaySessions.map(async (session) => {
        const [result] = await db
          .select({ count: count() })
          .from(enrollments)
          .where(eq(enrollments.courseId, session.courseId));
        return {
          ...session,
          enrolledCount: result?.count || 0,
          courseThumbnail: thumbnailMap.get(session.courseId) || null,
        };
      }),
    );

    // Enrich upcoming sessions with enrollment counts + course thumbnail
    const enrichedUpcomingSessions = await Promise.all(
      upcomingSessions.map(async (session) => {
        const [result] = await db
          .select({ count: count() })
          .from(enrollments)
          .where(eq(enrollments.courseId, session.courseId));
        return {
          ...session,
          enrolledCount: result?.count || 0,
          courseThumbnail: thumbnailMap.get(session.courseId) || null,
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

    // ─── Module Progress (first active course, real materialProgress data) ──
    let moduleProgress: { name: string; percentage: number }[] = [];

    if (courseIds.length > 0) {
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
        const [enrollCount] = await db
          .select({ count: count() })
          .from(enrollments)
          .where(eq(enrollments.courseId, firstCourseId));
        const totalEnrolledStudents = enrollCount?.count || 0;

        moduleProgress = await Promise.all(
          modules.map(async (mod) => {
            // Count materials in this module
            const moduleMaterials = await db
              .select({ id: courseMaterials.id })
              .from(courseMaterials)
              .where(eq(courseMaterials.moduleId, mod.id));

            const totalMaterials = moduleMaterials.length;

            if (totalMaterials === 0 || totalEnrolledStudents === 0) {
              return { name: mod.title, percentage: 0 };
            }

            const materialIds = moduleMaterials.map((m) => m.id);

            // Count students who completed ALL materials in this module
            const completionRows = await db
              .select({
                studentId: materialProgress.studentId,
                completedCount: count(),
              })
              .from(materialProgress)
              .where(
                and(
                  inArray(materialProgress.materialId, materialIds),
                  sql`${materialProgress.completedAt} IS NOT NULL`,
                ),
              )
              .groupBy(materialProgress.studentId);

            const studentsCompletedAll = completionRows.filter(
              (r) => Number(r.completedCount) >= totalMaterials,
            ).length;

            const percentage = Math.round(
              (studentsCompletedAll / totalEnrolledStudents) * 100,
            );

            return { name: mod.title, percentage };
          }),
        );
      }
    }

    // ─── Published Assessments (shared by analysis + pass/fail) ─
    const courseAssessments = courseIds.length > 0
      ? await db
          .select({
            id: assessments.id,
            title: assessments.title,
            courseId: assessments.courseId,
            type: assessments.type,
            totalMarks: assessments.totalMarks,
            passingMarks: assessments.passingMarks,
            createdAt: assessments.createdAt,
          })
          .from(assessments)
          .where(
            and(
              inArray(assessments.courseId, courseIds),
              eq(assessments.status, 'published'),
            ),
          )
          .orderBy(asc(assessments.createdAt))
      : [];

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
          m.wcagStatus === 'pass' || m.wcagStatus === 'compliant'
            ? true
            : m.wcagStatus === 'pending' || m.wcagStatus === 'warning'
              ? ('warning' as const)
              : false,
        size: m.fileSize
          ? m.fileSize < 1024 * 1024
            ? `${(m.fileSize / 1024).toFixed(1)} KB`
            : `${(m.fileSize / (1024 * 1024)).toFixed(1)} MB`
          : undefined,
      }));
    }

    // ─── Pending Submissions (Assessments Needing Attention) ──
    let pendingSubmissions: {
      id: string;
      studentName: string;
      assessmentTitle: string;
      courseName: string;
      submittedAt: string;
      daysOverdue: number;
      assessmentId: string;
    }[] = [];

    if (courseIds.length > 0) {
      const rawPending = await db
        .select({
          id: submissions.id,
          assessmentId: submissions.assessmentId,
          submittedAt: submissions.submittedAt,
          studentFirstName: users.firstName,
          studentLastName: users.lastName,
          assessmentTitle: assessments.title,
          courseTitle: courses.title,
        })
        .from(submissions)
        .innerJoin(assessments, eq(submissions.assessmentId, assessments.id))
        .innerJoin(courses, eq(assessments.courseId, courses.id))
        .innerJoin(users, eq(submissions.studentId, users.id))
        .where(
          and(
            inArray(assessments.courseId, courseIds),
            eq(submissions.status, 'submitted'),
          ),
        )
        .orderBy(asc(submissions.submittedAt))
        .limit(10);

      const now = Date.now();
      pendingSubmissions = rawPending.map((r) => ({
        id: r.id,
        studentName: `${r.studentFirstName || ''} ${r.studentLastName || ''}`.trim() || 'Unknown',
        assessmentTitle: r.assessmentTitle,
        courseName: r.courseTitle,
        submittedAt: r.submittedAt?.toISOString() || new Date().toISOString(),
        daysOverdue: r.submittedAt
          ? Math.max(0, Math.floor((now - r.submittedAt.getTime()) / 86400000))
          : 0,
        assessmentId: r.assessmentId,
      }));
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

    // ─── Average Course Rating across instructor's courses ──
    let avgCourseRating = 0;
    if (courseIds.length > 0) {
      const [ratingResult] = await db
        .select({ avg: sql<number>`ROUND(AVG(${courseRatings.rating})::numeric, 1)`.as('avg') })
        .from(courseRatings)
        .where(inArray(courseRatings.courseId, courseIds));
      avgCourseRating = Number(ratingResult?.avg ?? 0);
    }

    // ─── Recent Feedback (course ratings) ────────────────────
    let recentFeedback: {
      overallRating: number;
      totalReviews: number;
      feedbackItems: {
        id: string;
        learnerName: string;
        learnerInitials: string;
        courseName: string;
        rating: number;
        comment: string;
        sentiment: 'positive' | 'neutral' | 'negative';
        date: string;
      }[];
    } = { overallRating: 0, totalReviews: 0, feedbackItems: [] };

    if (courseIds.length > 0) {
      // Overall stats
      const [overallStats] = await db
        .select({
          avgRating: sql<number>`COALESCE(ROUND(AVG(${courseRatings.rating})::numeric, 1), 0)`.as('avg_rating'),
          totalReviews: count(),
        })
        .from(courseRatings)
        .where(inArray(courseRatings.courseId, courseIds));

      // 5 most recent ratings with student + course names
      const recentRatings = await db
        .select({
          id: courseRatings.id,
          rating: courseRatings.rating,
          reviewText: courseRatings.reviewText,
          createdAt: courseRatings.createdAt,
          studentFirstName: users.firstName,
          studentLastName: users.lastName,
          courseTitle: courses.title,
        })
        .from(courseRatings)
        .innerJoin(users, eq(courseRatings.studentId, users.id))
        .innerJoin(courses, eq(courseRatings.courseId, courses.id))
        .where(inArray(courseRatings.courseId, courseIds))
        .orderBy(desc(courseRatings.createdAt))
        .limit(5);

      recentFeedback = {
        overallRating: Number(overallStats?.avgRating ?? 0),
        totalReviews: Number(overallStats?.totalReviews ?? 0),
        feedbackItems: recentRatings.map((r) => {
          const firstName = r.studentFirstName || '';
          const lastName = r.studentLastName || '';
          const learnerName = `${firstName} ${lastName}`.trim() || 'Anonymous';
          const learnerInitials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'A';
          const sentiment: 'positive' | 'neutral' | 'negative' =
            r.rating >= 4 ? 'positive' : r.rating === 3 ? 'neutral' : 'negative';
          return {
            id: r.id,
            learnerName,
            learnerInitials,
            courseName: r.courseTitle,
            rating: r.rating,
            comment: r.reviewText || '',
            sentiment,
            date: r.createdAt?.toISOString() || new Date().toISOString(),
          };
        }),
      };
    }

    // ─── Pass/Fail Stats ────────────────────────────────────
    let passFailStats: {
      totalStudents: number;
      passed: number;
      failed: number;
      passRate: number;
    } | null = null;

    if (courseAssessments.length > 0 && courseIds.length > 0) {
      // Get all enrolled students across instructor's courses
      const allEnrolled = await db
        .select({ studentId: enrollments.studentId })
        .from(enrollments)
        .where(inArray(enrollments.courseId, courseIds));

      const uniqueStudentIds = [
        ...new Set(allEnrolled.map((e) => e.studentId)),
      ];

      if (uniqueStudentIds.length > 0) {
        // Get all graded submissions for the instructor's published assessments
        const assessmentIds = courseAssessments.map((a) => a.id);
        const allSubs = await db
          .select({
            studentId: submissions.studentId,
            assessmentId: submissions.assessmentId,
            score: submissions.score,
          })
          .from(submissions)
          .where(
            and(
              inArray(submissions.assessmentId, assessmentIds),
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

        const totalPassingMarks = courseAssessments.reduce(
          (sum, a) => sum + (a.passingMarks ?? 0),
          0,
        );

        let passed = 0;
        for (const studentId of uniqueStudentIds) {
          const studentScores = scoreMap.get(studentId);
          if (!studentScores) continue;
          let totalScore = 0;
          for (const a of courseAssessments) {
            totalScore += studentScores.get(a.id) ?? 0;
          }
          if (totalScore >= totalPassingMarks) {
            passed++;
          }
        }

        const pfTotal = uniqueStudentIds.length;
        passFailStats = {
          totalStudents: pfTotal,
          passed,
          failed: pfTotal - passed,
          passRate: pfTotal > 0 ? Math.round((passed / pfTotal) * 100) : 0,
        };
      }
    }

    // ─── Notifications ─────────────────────────────────────
    let notifications: {
      id: string;
      title: string;
      message: string;
      type: string;
      read: boolean;
      date: string;
    }[] = [];
    try {
      const notifResult = await this.userNotificationsService.findAllForUser(user.id, { limit: 5 });
      notifications = (notifResult.data || []).map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message ?? '',
        type: n.type ?? 'info',
        read: n.isRead ?? false,
        date: n.createdAt?.toISOString?.() ?? new Date().toISOString(),
      }));
    } catch (err) {
      this.logger.warn('Failed to fetch notifications for dashboard', err);
    }

    return {
      kpis: {
        activeCourses: coursesResult.total || 0,
        totalStudents,
        todaysSessions: todaySessions.length,
        atRiskLearners: atRiskLearners.length,
        avgCourseRating,
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
        deliveryType: c.deliveryType,
        cohort: c.cohort,
      })),
      attendanceTrend,
      moduleProgress,
      assessmentScores,
      questionAnalysis,
      materials,
      pendingSubmissions,
      recentFeedback,
      passFailStats,
      notifications,
    };
  }

  // ─── Per-Course Performance ──────────────────────────────

  /**
   * GET /instructor/course-performance?courseId=xxx
   * Returns attendance trend, module progress, and pass/fail stats for a specific course.
   */
  async getCoursePerformance(user: AuthenticatedUser, courseId?: string) {
    // Get instructor's courses to validate access
    const courseConditions = this.getCourseOwnershipConditions(user);

    const instructorCourses = await db
      .select({ id: courses.id })
      .from(courses)
      .where(
        courseConditions.length > 0
          ? and(...courseConditions)
          : undefined,
      );

    const allCourseIds = instructorCourses.map((c) => c.id);
    if (allCourseIds.length === 0) {
      return { attendanceTrend: [0, 0, 0, 0, 0, 0, 0], moduleProgress: [], passFailStats: null };
    }

    // If courseId is provided and not "all", filter to that single course
    const targetCourseIds = courseId && courseId !== 'all' && allCourseIds.includes(courseId)
      ? [courseId]
      : allCourseIds;

    // ─── Attendance Trend ──────────────────────────────────
    let attendanceTrend: number[] = [0, 0, 0, 0, 0, 0, 0];
    const courseSessions = await db
      .select({ id: sessions.id, scheduledAt: sessions.scheduledAt })
      .from(sessions)
      .where(inArray(sessions.courseId, targetCourseIds));

    const sessionIds = courseSessions.map((s) => s.id);

    if (sessionIds.length > 0) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const dailyAttendance = await db
        .select({
          dayOfWeek: sql<number>`EXTRACT(DOW FROM ${sessions.scheduledAt})`.as('dow'),
          totalRecords: count(),
          presentCount:
            sql<number>`SUM(CASE WHEN ${attendance.status} IN ('present', 'late') THEN 1 ELSE 0 END)`.as('present_count'),
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

      const trendMap = new Map<number, number>();
      for (const row of dailyAttendance) {
        const total = Number(row.totalRecords);
        const present = Number(row.presentCount);
        trendMap.set(Number(row.dayOfWeek), total > 0 ? Math.round((present / total) * 100) : 0);
      }
      attendanceTrend = [1, 2, 3, 4, 5, 6, 0].map((dow) => trendMap.get(dow) ?? 0);
    }

    // ─── Module Progress ──────────────────────────────────
    let moduleProgress: { name: string; percentage: number }[] = [];
    const targetCourseId = targetCourseIds[0];

    const modules = await db
      .select({ id: courseModules.id, title: courseModules.title, orderIndex: courseModules.orderIndex })
      .from(courseModules)
      .where(eq(courseModules.courseId, targetCourseId))
      .orderBy(asc(courseModules.orderIndex));

    if (modules.length > 0) {
      const [enrollCount] = await db
        .select({ count: count() })
        .from(enrollments)
        .where(eq(enrollments.courseId, targetCourseId));
      const totalEnrolledStudents = enrollCount?.count || 0;

      moduleProgress = await Promise.all(
        modules.map(async (mod) => {
          const moduleMaterials = await db
            .select({ id: courseMaterials.id })
            .from(courseMaterials)
            .where(eq(courseMaterials.moduleId, mod.id));

          const totalMaterials = moduleMaterials.length;
          if (totalMaterials === 0 || totalEnrolledStudents === 0) {
            return { name: mod.title, percentage: 0 };
          }

          const materialIds = moduleMaterials.map((m) => m.id);
          const completionRows = await db
            .select({ studentId: materialProgress.studentId, completedCount: count() })
            .from(materialProgress)
            .where(
              and(
                inArray(materialProgress.materialId, materialIds),
                sql`${materialProgress.completedAt} IS NOT NULL`,
              ),
            )
            .groupBy(materialProgress.studentId);

          const studentsCompletedAll = completionRows.filter(
            (r) => Number(r.completedCount) >= totalMaterials,
          ).length;

          return { name: mod.title, percentage: Math.round((studentsCompletedAll / totalEnrolledStudents) * 100) };
        }),
      );
    }

    // ─── Pass/Fail Stats ──────────────────────────────────
    let passFailStats: { totalStudents: number; passed: number; failed: number; passRate: number } | null = null;

    const courseAssessments = await db
      .select({ id: assessments.id, passingMarks: assessments.passingMarks })
      .from(assessments)
      .where(
        and(
          inArray(assessments.courseId, targetCourseIds),
          eq(assessments.status, 'published'),
        ),
      );

    if (courseAssessments.length > 0) {
      const allEnrolled = await db
        .select({ studentId: enrollments.studentId })
        .from(enrollments)
        .where(inArray(enrollments.courseId, targetCourseIds));

      const uniqueStudentIds = [...new Set(allEnrolled.map((e) => e.studentId))];

      if (uniqueStudentIds.length > 0) {
        const assessmentIds = courseAssessments.map((a) => a.id);
        const allSubs = await db
          .select({
            studentId: submissions.studentId,
            assessmentId: submissions.assessmentId,
            score: submissions.score,
          })
          .from(submissions)
          .where(
            and(
              inArray(submissions.assessmentId, assessmentIds),
              eq(submissions.status, 'graded'),
            ),
          );

        const scoreMap = new Map<string, Map<string, number>>();
        for (const sub of allSubs) {
          if (!scoreMap.has(sub.studentId)) scoreMap.set(sub.studentId, new Map());
          const studentScores = scoreMap.get(sub.studentId)!;
          const existing = studentScores.get(sub.assessmentId) ?? -1;
          if ((sub.score ?? 0) > existing) studentScores.set(sub.assessmentId, sub.score ?? 0);
        }

        const totalPassingMarks = courseAssessments.reduce((sum, a) => sum + (a.passingMarks ?? 0), 0);
        let passed = 0;
        for (const studentId of uniqueStudentIds) {
          const studentScores = scoreMap.get(studentId);
          if (!studentScores) continue;
          let totalScore = 0;
          for (const a of courseAssessments) totalScore += studentScores.get(a.id) ?? 0;
          if (totalScore >= totalPassingMarks) passed++;
        }

        const pfTotal = uniqueStudentIds.length;
        passFailStats = {
          totalStudents: pfTotal,
          passed,
          failed: pfTotal - passed,
          passRate: pfTotal > 0 ? Math.round((passed / pfTotal) * 100) : 0,
        };
      }
    }

    return { attendanceTrend, moduleProgress, passFailStats };
  }

  // ─── Students View ────────────────────────────────────────

  /**
   * GET /instructor/students
   * GET /instructor/filter-options
   * Return distinct delivery types and cohorts for filter dropdowns.
   */
  async getFilterOptions(user: AuthenticatedUser) {
    const courseConditions = this.getCourseOwnershipConditions(user);

    const instructorCourses = await db
      .select({
        deliveryType: courses.deliveryType,
        cohort: courses.cohort,
      })
      .from(courses)
      .where(
        courseConditions.length > 0
          ? and(...courseConditions)
          : undefined,
      );

    const deliveryTypes = [...new Set(instructorCourses.map((c) => c.deliveryType))];
    const cohorts = [...new Set(instructorCourses.map((c) => c.cohort).filter(Boolean))] as string[];

    return { deliveryTypes, cohorts };
  }

  /**
   * List all unique students across the instructor's courses.
   * - Instructor: students enrolled in their own courses only.
   * - Admin: all enrolled students across all courses.
   */
  async getStudents(user: AuthenticatedUser, courseId?: string) {
    // Get the instructor's course IDs (or all courses for admin)
    const courseConditions = this.getCourseOwnershipConditions(user);

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

    if (studentsData.length === 0) return [];

    const studentIds = studentsData.map((s) => s.studentId);

    // Batch-fetch attendance rates per student
    // Count sessions per course so we can calculate per-student totals
    const sessionCountByCourse = await db
      .select({
        courseId: sessions.courseId,
        count: sql<number>`COUNT(*)`.mapWith(Number),
      })
      .from(sessions)
      .where(inArray(sessions.courseId, courseIds))
      .groupBy(sessions.courseId);

    const sessionCountMap = new Map(
      sessionCountByCourse.map((s) => [s.courseId, s.count]),
    );

    // Get each student's enrolled course IDs for per-student session count
    const studentEnrollmentData = await db
      .select({
        studentId: enrollments.studentId,
        courseId: enrollments.courseId,
      })
      .from(enrollments)
      .where(
        and(
          inArray(enrollments.studentId, studentIds),
          inArray(enrollments.courseId, courseIds),
        ),
      );

    const studentSessionCountMap = new Map<string, number>();
    for (const se of studentEnrollmentData) {
      const current = studentSessionCountMap.get(se.studentId) || 0;
      studentSessionCountMap.set(
        se.studentId,
        current + (sessionCountMap.get(se.courseId) || 0),
      );
    }

    // Get all session IDs for attendance query
    const allSessionIds = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(inArray(sessions.courseId, courseIds));
    const sIds = allSessionIds.map((s) => s.id);

    const attendanceRateMap = new Map<string, number>();
    if (sIds.length > 0) {
      const attendanceData = await db
        .select({
          studentId: attendance.studentId,
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
        .groupBy(attendance.studentId);

      for (const a of attendanceData) {
        const present = Number(a.presentCount);
        const studentTotal = studentSessionCountMap.get(a.studentId) || 1;
        attendanceRateMap.set(
          a.studentId,
          Math.round((present / studentTotal) * 100),
        );
      }
    }

    // Batch-fetch assessment averages per student
    const assessmentAvgMap = new Map<string, number>();
    const submissionData = await db
      .select({
        studentId: submissions.studentId,
        avgPercentage:
          sql<number>`ROUND(AVG(CAST(${submissions.percentage} AS NUMERIC)))`.as(
            'avg_percentage',
          ),
      })
      .from(submissions)
      .innerJoin(assessments, eq(submissions.assessmentId, assessments.id))
      .where(
        and(
          inArray(submissions.studentId, studentIds),
          inArray(assessments.courseId, courseIds),
          eq(submissions.status, 'graded'),
        ),
      )
      .groupBy(submissions.studentId);

    for (const s of submissionData) {
      assessmentAvgMap.set(s.studentId, Number(s.avgPercentage) || 0);
    }

    return studentsData.map((s) => ({
      ...s,
      attendanceRate: attendanceRateMap.has(s.studentId)
        ? attendanceRateMap.get(s.studentId)!
        : null,
      assessmentAverage: assessmentAvgMap.has(s.studentId)
        ? assessmentAvgMap.get(s.studentId)!
        : null,
    }));
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
    const courseConditions = this.getCourseOwnershipConditions(user);

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

    // ─── Per-Course Breakdown ─────────────────────────────────
    const studentCourseIds = studentEnrollments.map((e) => e.courseId);

    // Get all sessions grouped by course
    const allSessions = await db
      .select({ id: sessions.id, courseId: sessions.courseId })
      .from(sessions)
      .where(inArray(sessions.courseId, studentCourseIds));

    const sessionsByCourse = new Map<string, string[]>();
    for (const s of allSessions) {
      const list = sessionsByCourse.get(s.courseId) || [];
      list.push(s.id);
      sessionsByCourse.set(s.courseId, list);
    }

    const allSIds = allSessions.map((s) => s.id);

    // Get all sessions with attendance status (LEFT JOIN so sessions without records show as absent)
    const allAttendanceRecords = allSIds.length > 0
      ? (await db
          .select({
            sessionId: sessions.id,
            status: attendance.status,
            sessionTitle: sessions.title,
            scheduledAt: sessions.scheduledAt,
            courseId: sessions.courseId,
            courseTitle: courses.title,
          })
          .from(sessions)
          .innerJoin(courses, eq(sessions.courseId, courses.id))
          .leftJoin(
            attendance,
            and(
              eq(attendance.sessionId, sessions.id),
              eq(attendance.studentId, studentId),
            ),
          )
          .where(inArray(sessions.id, allSIds))
          .orderBy(desc(sessions.scheduledAt))
        ).map((r) => ({
          ...r,
          status: r.status || 'absent',
        }))
      : [];

    // Get all assessment scores
    const studentScores = await db
      .select({
        assessmentId: assessments.id,
        courseId: assessments.courseId,
        title: assessments.title,
        maxScore: assessments.totalMarks,
        score: submissions.score,
        percentage: submissions.percentage,
        submittedAt: submissions.submittedAt,
      })
      .from(submissions)
      .innerJoin(assessments, eq(submissions.assessmentId, assessments.id))
      .where(
        and(
          eq(submissions.studentId, studentId),
          inArray(assessments.courseId, studentCourseIds),
          eq(submissions.status, 'graded'),
        ),
      )
      .orderBy(desc(submissions.submittedAt));

    // Deduplicate: keep latest submission per assessment
    const seenAssessments = new Set<string>();
    const dedupedScores = studentScores.filter((s) => {
      if (seenAssessments.has(s.assessmentId)) return false;
      seenAssessments.add(s.assessmentId);
      return true;
    });

    // Batch-fetch class averages
    const assessmentIds = dedupedScores.map((s) => s.assessmentId);
    const classAvgMap = new Map<string, number>();
    if (assessmentIds.length > 0) {
      const classAvgData = await db
        .select({
          assessmentId: submissions.assessmentId,
          classAverage:
            sql<number>`ROUND(AVG(CAST(${submissions.percentage} AS NUMERIC)))`.as('class_avg'),
        })
        .from(submissions)
        .where(
          and(
            inArray(submissions.assessmentId, assessmentIds),
            eq(submissions.status, 'graded'),
          ),
        )
        .groupBy(submissions.assessmentId);
      for (const c of classAvgData) {
        classAvgMap.set(c.assessmentId, Number(c.classAverage) || 0);
      }
    }

    // Build per-course performance
    const coursePerformance = studentEnrollments.map((enrollment) => {
      const courseSIds = sessionsByCourse.get(enrollment.courseId) || [];
      const courseAttendance = allAttendanceRecords.filter(
        (r) => r.courseId === enrollment.courseId,
      );

      // Attendance stats for this course
      let present = 0, absent = 0, late = 0, excused = 0;
      for (const r of courseAttendance) {
        switch (r.status) {
          case 'present': present++; break;
          case 'absent': absent++; break;
          case 'late': late++; break;
          case 'excused': excused++; break;
        }
      }
      const totalSessions = courseSIds.length;
      const recorded = present + absent + late + excused;
      if (recorded < totalSessions) absent += (totalSessions - recorded);
      const attended = present + late;
      const attendanceRate = totalSessions > 0
        ? Math.round((attended / totalSessions) * 100)
        : 0;

      // Assessment scores for this course
      const courseScores = dedupedScores
        .filter((s) => s.courseId === enrollment.courseId)
        .map((s) => ({
          assessmentId: s.assessmentId,
          title: s.title,
          score: Number(s.score) || 0,
          maxScore: Number(s.maxScore) || 0,
          percentage: Number(s.percentage) || 0,
          classAverage: classAvgMap.get(s.assessmentId) ?? 0,
        }));

      const assessmentAverage = courseScores.length > 0
        ? Math.round(courseScores.reduce((sum, s) => sum + s.percentage, 0) / courseScores.length)
        : null;

      return {
        courseId: enrollment.courseId,
        courseTitle: enrollment.courseTitle,
        courseTitleAr: enrollment.courseTitleAr,
        enrollmentStatus: enrollment.status,
        progress: enrollment.progress,
        enrolledAt: enrollment.enrolledAt,
        completedAt: enrollment.completedAt,
        attendance: {
          totalSessions,
          present,
          absent,
          late,
          excused,
          attendanceRate,
        },
        assessments: courseScores,
        assessmentAverage,
        attendanceRecords: courseAttendance,
      };
    });

    // Overall summary (aggregated across all enrolled courses)
    const overallAttendance = {
      totalSessions: coursePerformance.reduce((sum, c) => sum + c.attendance.totalSessions, 0),
      present: coursePerformance.reduce((sum, c) => sum + c.attendance.present, 0),
      absent: coursePerformance.reduce((sum, c) => sum + c.attendance.absent, 0),
      late: coursePerformance.reduce((sum, c) => sum + c.attendance.late, 0),
      excused: coursePerformance.reduce((sum, c) => sum + c.attendance.excused, 0),
      attendanceRate: 0,
    };
    const totalAttended = overallAttendance.present + overallAttendance.late;
    overallAttendance.attendanceRate = overallAttendance.totalSessions > 0
      ? Math.round((totalAttended / overallAttendance.totalSessions) * 100)
      : 0;

    return {
      ...student,
      enrollments: studentEnrollments,
      coursePerformance,
      attendanceSummary: overallAttendance,
      assessmentScores: dedupedScores.map((s) => ({
        assessmentId: s.assessmentId,
        title: s.title,
        score: Number(s.score) || 0,
        maxScore: Number(s.maxScore) || 0,
        classAverage: classAvgMap.get(s.assessmentId) ?? 0,
      })),
      attendanceRecords: allAttendanceRecords,
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
    // Get the instructor's courses with thresholds
    const courseConditions = this.getCourseOwnershipConditions(user);
    const instructorCourses = await db
      .select({
        id: courses.id,
        title: courses.title,
        titleAr: courses.titleAr,
        atRiskAttendanceThreshold: courses.atRiskAttendanceThreshold,
        atRiskScoreThreshold: courses.atRiskScoreThreshold,
        atRiskInactivityDays: courses.atRiskInactivityDays,
      })
      .from(courses)
      .where(and(
        ...(courseConditions.length > 0 ? courseConditions : []),
        sql`${courses.status} IN ('active', 'draft', 'pending_review')`,
      ));

    const courseIds = instructorCourses.map((c) => c.id);
    if (courseIds.length === 0) return [];

    const courseMap = new Map(instructorCourses.map((c) => [c.id, c]));

    // Get all enrollments with last access
    const allEnrollments = await db
      .select({
        studentId: enrollments.studentId,
        courseId: enrollments.courseId,
        lastAccessedAt: enrollments.lastAccessedAt,
      })
      .from(enrollments)
      .where(
        and(
          inArray(enrollments.courseId, courseIds),
          eq(enrollments.status, 'active'),
        ),
      );

    if (allEnrollments.length === 0) return [];

    // Get session counts per course
    const sessionCounts = await db
      .select({
        courseId: sessions.courseId,
        count: sql<number>`COUNT(*)`.mapWith(Number),
      })
      .from(sessions)
      .where(inArray(sessions.courseId, courseIds))
      .groupBy(sessions.courseId);
    const sessionCountMap = new Map(sessionCounts.map((s) => [s.courseId, s.count]));

    // Get all session IDs per course
    const allSessions = await db
      .select({ id: sessions.id, courseId: sessions.courseId })
      .from(sessions)
      .where(inArray(sessions.courseId, courseIds));
    const sessionIdsByCourse = new Map<string, string[]>();
    for (const s of allSessions) {
      const list = sessionIdsByCourse.get(s.courseId) || [];
      list.push(s.id);
      sessionIdsByCourse.set(s.courseId, list);
    }
    const allSIds = allSessions.map((s) => s.id);

    // Get attendance per student per course
    const allStudentIds = [...new Set(allEnrollments.map((e) => e.studentId))];
    const attendancePerStudentCourse = allSIds.length > 0
      ? await db
          .select({
            studentId: attendance.studentId,
            courseId: sessions.courseId,
            presentCount: sql<number>`SUM(CASE WHEN ${attendance.status} IN ('present', 'late') THEN 1 ELSE 0 END)`.mapWith(Number),
          })
          .from(attendance)
          .innerJoin(sessions, eq(attendance.sessionId, sessions.id))
          .where(
            and(
              inArray(attendance.studentId, allStudentIds),
              inArray(sessions.courseId, courseIds),
            ),
          )
          .groupBy(attendance.studentId, sessions.courseId)
      : [];

    const attMap = new Map<string, number>(); // key: `studentId:courseId`
    for (const a of attendancePerStudentCourse) {
      attMap.set(`${a.studentId}:${a.courseId}`, a.presentCount);
    }

    // Get assessment averages + count per student per course
    const assessmentData = allStudentIds.length > 0
      ? await db
          .select({
            studentId: submissions.studentId,
            courseId: assessments.courseId,
            avgPercentage: sql<number>`ROUND(AVG(CAST(${submissions.percentage} AS NUMERIC)))`.mapWith(Number),
            assessmentCount: sql<number>`COUNT(DISTINCT ${submissions.assessmentId})`.mapWith(Number),
          })
          .from(submissions)
          .innerJoin(assessments, eq(submissions.assessmentId, assessments.id))
          .where(
            and(
              inArray(submissions.studentId, allStudentIds),
              inArray(assessments.courseId, courseIds),
              eq(submissions.status, 'graded'),
            ),
          )
          .groupBy(submissions.studentId, assessments.courseId)
      : [];

    const assessMap = new Map<string, { avg: number; count: number }>();
    for (const a of assessmentData) {
      assessMap.set(`${a.studentId}:${a.courseId}`, { avg: a.avgPercentage, count: a.assessmentCount });
    }

    // Get student details
    const studentDetails = await db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
      .from(users)
      .where(inArray(users.id, allStudentIds));
    const studentMap = new Map(studentDetails.map((s) => [s.id, s]));

    // Evaluate at-risk PER COURSE
    const atRiskStudents: any[] = [];

    for (const enrollment of allEnrollments) {
      const { studentId, courseId, lastAccessedAt } = enrollment;
      const student = studentMap.get(studentId);
      const course = courseMap.get(courseId);
      if (!student || !course) continue;

      const threshold = {
        attendance: course.atRiskAttendanceThreshold ?? 70,
        score: course.atRiskScoreThreshold ?? 60,
        inactivityDays: course.atRiskInactivityDays ?? 7,
      };

      const totalSessions = sessionCountMap.get(courseId) || 0;
      const presentCount = attMap.get(`${studentId}:${courseId}`) || 0;
      const attendanceRate = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;
      const assessData = assessMap.get(`${studentId}:${courseId}`);
      const assessmentAvg = assessData?.avg ?? null;
      const assessmentCount = assessData?.count ?? 0;

      const riskReasons: string[] = [];

      // Minimum 3 sessions before evaluating attendance risk
      const MIN_SESSIONS_FOR_RISK = 3;
      // Minimum 2 graded assessments before evaluating assessment risk
      const MIN_ASSESSMENTS_FOR_RISK = 2;

      // Criterion 1: Attendance below course threshold (only if 3+ sessions)
      if (totalSessions >= MIN_SESSIONS_FOR_RISK && attendanceRate < threshold.attendance) {
        riskReasons.push(`Attendance rate ${attendanceRate}% (below ${threshold.attendance}%)`);
      }

      // Criterion 2: Assessment average below course threshold (only if 2+ assessments)
      if (assessmentCount >= MIN_ASSESSMENTS_FOR_RISK && assessmentAvg !== null && assessmentAvg < threshold.score) {
        riskReasons.push(`Assessment average ${assessmentAvg}% (below ${threshold.score}%)`);
      }

      // Criterion 3: Inactivity in this course
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - threshold.inactivityDays);
      if (!lastAccessedAt || new Date(lastAccessedAt) < cutoff) {
        riskReasons.push(
          lastAccessedAt
            ? `Last activity on ${new Date(lastAccessedAt).toISOString().split('T')[0]}`
            : 'No recent activity',
        );
      }

      if (riskReasons.length > 0) {
        atRiskStudents.push({
          ...student,
          courseId,
          courseTitle: course.title,
          courseTitleAr: course.titleAr,
          attendanceRate,
          assessmentAverage: assessmentAvg,
          lastAccessedAt: lastAccessedAt || null,
          riskReasons,
        });
      }
    }

    return atRiskStudents;
  }

  /**
   * PATCH /instructor/courses/:courseId/at-risk-settings
   * Update at-risk threshold settings for a course.
   */
  async updateAtRiskSettings(
    courseId: string,
    user: AuthenticatedUser,
    data: {
      atRiskAttendanceThreshold?: number;
      atRiskScoreThreshold?: number;
      atRiskInactivityDays?: number;
    },
  ) {
    // Verify course access
    const accessConditions: any[] = [eq(courses.id, courseId)];
    const ownershipConds = this.getCourseOwnershipConditions(user);
    accessConditions.push(...ownershipConds);

    const [course] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(and(...accessConditions))
      .limit(1);

    if (!course) throw new NotFoundException('Course not found');

    const updateData: Record<string, unknown> = {};
    if (data.atRiskAttendanceThreshold !== undefined) {
      updateData.atRiskAttendanceThreshold = data.atRiskAttendanceThreshold;
    }
    if (data.atRiskScoreThreshold !== undefined) {
      updateData.atRiskScoreThreshold = data.atRiskScoreThreshold;
    }
    if (data.atRiskInactivityDays !== undefined) {
      updateData.atRiskInactivityDays = data.atRiskInactivityDays;
    }

    if (Object.keys(updateData).length === 0) return { message: 'No changes' };

    await db.update(courses).set(updateData).where(eq(courses.id, courseId));
    return { message: 'Thresholds updated' };
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
    const courseConditions = this.getCourseOwnershipConditions(user);

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

    // 6. Dispatch in-app notifications
    switch (dto.type) {
      case INTERVENTION_TYPE.EMAIL: {
        await this.userNotificationsService.create({
          recipientId: dto.studentId,
          type: 'intervention_email',
          title: 'Course Progress Reminder',
          message: `Your instructor sent a reminder about "${courseName}"${dto.message ? `: ${dto.message}` : ''}`,
          link: `/dashboard/student/courses/${resolvedCourseId}`,
          entityType: 'intervention',
          entityId: intervention.id,
        });
        break;
      }
      case INTERVENTION_TYPE.MAKEUP_SESSION: {
        const studentName =
          `${student.firstName || ''} ${student.lastName || ''}`.trim() ||
          student.email;
        await this.userNotificationsService.create({
          recipientId: dto.studentId,
          type: 'intervention_makeup',
          title: 'Make-up Session Scheduled',
          message: `A make-up session has been scheduled for you in "${courseName}"`,
          link: `/dashboard/student/courses/${resolvedCourseId}`,
          entityType: 'intervention',
          entityId: intervention.id,
        });
        await this.emailService.sendAtRiskReminder(
          student.email,
          studentName,
          courseName,
          'A make-up session has been scheduled for you. Please check your dashboard for details.',
        );
        break;
      }
    }

    return intervention;
  }

  /**
   * GET /instructor/students/:studentId/interventions
   * Returns the intervention log for a given student.
   */
  async getStudentInterventions(user: AuthenticatedUser, studentId: string) {
    // Verify instructor has access to student's courses
    const courseConditions = this.getCourseOwnershipConditions(user);

    const instructorCourseIds = (
      await db
        .select({ id: courses.id })
        .from(courses)
        .where(courseConditions.length > 0 ? and(...courseConditions) : undefined)
    ).map((c) => c.id);

    if (!isGlobalAdmin(user) && instructorCourseIds.length === 0) {
      return [];
    }

    // Build where conditions
    const conditions = [eq(interventions.studentId, studentId)];
    if (!isGlobalAdmin(user) && instructorCourseIds.length > 0) {
      conditions.push(inArray(interventions.courseId, instructorCourseIds));
    }

    // Alias for instructor user
    const instructorUser = users;

    const rows = await db
      .select({
        id: interventions.id,
        type: interventions.type,
        message: interventions.message,
        createdAt: interventions.createdAt,
        courseId: interventions.courseId,
        instructorFirstName: instructorUser.firstName,
        instructorLastName: instructorUser.lastName,
      })
      .from(interventions)
      .innerJoin(instructorUser, eq(interventions.instructorId, instructorUser.id))
      .where(and(...conditions))
      .orderBy(desc(interventions.createdAt));

    // Batch-fetch course names
    const uniqueCourseIds = [...new Set(rows.filter((r) => r.courseId).map((r) => r.courseId!))];
    const courseNames =
      uniqueCourseIds.length > 0
        ? await db
            .select({ id: courses.id, title: courses.title })
            .from(courses)
            .where(inArray(courses.id, uniqueCourseIds))
        : [];
    const courseNameMap = new Map(courseNames.map((c) => [c.id, c.title]));

    return rows.map((r) => ({
      id: r.id,
      type: r.type as 'email' | 'makeup_session' | 'ticket',
      message: r.message,
      instructorName: `${r.instructorFirstName || ''} ${r.instructorLastName || ''}`.trim() || 'Unknown',
      courseName: r.courseId ? courseNameMap.get(r.courseId) || null : null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  // ─── Instructor Roster ──────────────────────────────────────

  /**
   * GET /instructor/roster
   * Enriched instructor list with workload metrics.
   * Only available to MANAGER and ADMIN roles.
   */
  async getInstructorRoster(user: AuthenticatedUser) {
    // For managers, only show instructors teaching their managed courses
    let managedInstructorIds: string[] | null = null;
    if (isManager(user)) {
      const managedCourses = await db
        .select({ instructorId: courses.instructorId })
        .from(courses)
        .where(or(eq(courses.managerId, user.id), sql`${courses.managerId} IS NULL`));
      managedInstructorIds = [...new Set(managedCourses.map((c) => c.instructorId))];
      if (managedInstructorIds.length === 0) return [];
    }

    // Get instructors via user_roles junction table
    const baseConditions: any[] = [eq(roles.name, 'INSTRUCTOR')];
    if (managedInstructorIds) {
      baseConditions.push(inArray(users.id, managedInstructorIds));
    }

    const instructorsList = await db
      .selectDistinct({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatar: users.avatar,
        department: users.department,
        specialty: users.specialty,
        instructorStatus: users.instructorStatus,
      })
      .from(users)
      .innerJoin(userRoles, eq(users.id, userRoles.userId))
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(and(...baseConditions))
      .orderBy(asc(users.firstName));

    if (instructorsList.length === 0) return [];

    const instructorIds = instructorsList.map((i) => i.id);

    // Batch: courses per instructor
    const courseCounts = await db
      .select({
        instructorId: courses.instructorId,
        coursesCount: count(),
      })
      .from(courses)
      .where(inArray(courses.instructorId, instructorIds))
      .groupBy(courses.instructorId);

    const courseCountMap = new Map(
      courseCounts.map((c) => [c.instructorId, Number(c.coursesCount)]),
    );

    // Batch: distinct students per instructor (via courses → enrollments)
    const studentCounts = await db
      .select({
        instructorId: courses.instructorId,
        studentsCount: sql<number>`COUNT(DISTINCT ${enrollments.studentId})`.as('students_count'),
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(
        and(
          inArray(courses.instructorId, instructorIds),
          eq(enrollments.status, 'active'),
        ),
      )
      .groupBy(courses.instructorId);

    const studentCountMap = new Map(
      studentCounts.map((s) => [s.instructorId, Number(s.studentsCount)]),
    );

    // Batch: avg rating per instructor (via courses → courseRatings)
    const avgRatings = await db
      .select({
        instructorId: courses.instructorId,
        avgRating: sql<number>`COALESCE(ROUND(AVG(${courseRatings.rating})::NUMERIC, 1), 0)`.as('avg_rating'),
      })
      .from(courseRatings)
      .innerJoin(courses, eq(courseRatings.courseId, courses.id))
      .where(inArray(courses.instructorId, instructorIds))
      .groupBy(courses.instructorId);

    const avgRatingMap = new Map(
      avgRatings.map((r) => [r.instructorId, Number(r.avgRating)]),
    );

    // Batch: completion rate per instructor (avg progress via courses → enrollments)
    const completionRates = await db
      .select({
        instructorId: courses.instructorId,
        completionRate: sql<number>`COALESCE(ROUND(AVG(${enrollments.progress})), 0)`.as('completion_rate'),
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(inArray(courses.instructorId, instructorIds))
      .groupBy(courses.instructorId);

    const completionRateMap = new Map(
      completionRates.map((c) => [c.instructorId, Number(c.completionRate)]),
    );

    // Batch: sessions this week per instructor
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weeklyLoad = await db
      .select({
        instructorId: sessions.instructorId,
        sessionsThisWeek: count(),
        minutesThisWeek: sql<number>`COALESCE(SUM(${sessions.durationMinutes}), 0)`.as('minutes_week'),
      })
      .from(sessions)
      .where(
        and(
          inArray(sessions.instructorId, instructorIds),
          gte(sessions.scheduledAt, weekStart),
          lte(sessions.scheduledAt, weekEnd),
          sql`${sessions.status} IN ('scheduled', 'live', 'completed')`,
        ),
      )
      .groupBy(sessions.instructorId);

    const loadMap = new Map(
      weeklyLoad.map((w) => [
        w.instructorId,
        {
          sessionsThisWeek: Number(w.sessionsThisWeek),
          hoursThisWeek: Math.round((Number(w.minutesThisWeek) / 60) * 10) / 10,
        },
      ]),
    );

    return instructorsList.map((inst) => {
      const load = loadMap.get(inst.id) || { sessionsThisWeek: 0, hoursThisWeek: 0 };
      const status: 'available' | 'busy' | 'overloaded' | 'on_leave' =
        inst.instructorStatus === 'on_leave'
          ? 'on_leave'
          : load.hoursThisWeek > 15
            ? 'overloaded'
            : load.hoursThisWeek >= 10
              ? 'busy'
              : 'available';

      return {
        ...inst,
        department: inst.department,
        specialty: inst.specialty,
        coursesCount: courseCountMap.get(inst.id) || 0,
        studentsCount: studentCountMap.get(inst.id) || 0,
        avgRating: avgRatingMap.get(inst.id) || 0,
        completionRate: completionRateMap.get(inst.id) || 0,
        sessionsThisWeek: load.sessionsThisWeek,
        hoursThisWeek: load.hoursThisWeek,
        status,
      };
    });
  }

  /**
   * Get instructor suggestions sorted by availability (least loaded first).
   */
  async suggestInstructor(user: AuthenticatedUser) {
    const roster = await this.getInstructorRoster(user);
    const sorted = [...roster].sort((a, b) => a.hoursThisWeek - b.hoursThisWeek);
    return sorted.map((inst, idx) => ({
      ...inst,
      recommended: idx === 0,
    }));
  }

  // ─── Instructor Performance ──────────────────────────────────

  /**
   * GET /instructor/:id/performance
   * Returns performance KPIs for a specific instructor.
   */
  async getInstructorPerformance(instructorId: string) {
    // Verify instructor exists
    const [instructor] = await db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email, avatar: users.avatar })
      .from(users)
      .where(eq(users.id, instructorId))
      .limit(1);

    if (!instructor) {
      throw new NotFoundException('Instructor not found');
    }

    // Get instructor's courses
    const instructorCourses = await db
      .select({ id: courses.id, title: courses.title, status: courses.status })
      .from(courses)
      .where(eq(courses.instructorId, instructorId));

    const courseIds = instructorCourses.map((c) => c.id);

    // Completion rate: avg enrollment progress across all active courses
    let completionRate = 0;
    if (courseIds.length > 0) {
      const [avgResult] = await db
        .select({ avg: sql<number>`COALESCE(ROUND(AVG(${enrollments.progress})), 0)`.as('avg_progress') })
        .from(enrollments)
        .where(inArray(enrollments.courseId, courseIds));
      completionRate = Number(avgResult?.avg) || 0;
    }

    // Attendance rate: present+late / total attendance records
    let attendanceRate = 0;
    if (courseIds.length > 0) {
      const sessionIds = await db
        .select({ id: sessions.id })
        .from(sessions)
        .where(inArray(sessions.courseId, courseIds));
      const sIds = sessionIds.map((s) => s.id);

      if (sIds.length > 0) {
        const [attnResult] = await db
          .select({
            total: count(),
            present: sql<number>`SUM(CASE WHEN ${attendance.status} IN ('present', 'late') THEN 1 ELSE 0 END)`.as('present_count'),
          })
          .from(attendance)
          .where(inArray(attendance.sessionId, sIds));
        const total = Number(attnResult?.total) || 0;
        const present = Number(attnResult?.present) || 0;
        attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;
      }
    }

    // Content quality: approved vs rejected materials
    let contentApproved = 0;
    let contentRejected = 0;
    let contentPending = 0;
    if (courseIds.length > 0) {
      const materialStats = await db
        .select({
          status: courseMaterials.status,
          cnt: count(),
        })
        .from(courseMaterials)
        .where(inArray(courseMaterials.courseId, courseIds))
        .groupBy(courseMaterials.status);

      for (const m of materialStats) {
        if (m.status === 'live') contentApproved += Number(m.cnt);
        else if (m.status === 'failed') contentRejected += Number(m.cnt);
        else if (m.status === 'pending_review') contentPending += Number(m.cnt);
      }
    }

    // Total students
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
      totalStudents = Number(studentCount?.count) || 0;
    }

    // Sessions stats
    let totalSessions = 0;
    let completedSessions = 0;
    if (courseIds.length > 0) {
      const sessionStats = await db
        .select({
          status: sessions.status,
          cnt: count(),
        })
        .from(sessions)
        .where(inArray(sessions.courseId, courseIds))
        .groupBy(sessions.status);

      for (const s of sessionStats) {
        totalSessions += Number(s.cnt);
        if (s.status === 'completed') completedSessions += Number(s.cnt);
      }
    }

    return {
      instructor: {
        id: instructor.id,
        firstName: instructor.firstName,
        lastName: instructor.lastName,
        email: instructor.email,
        avatar: instructor.avatar,
      },
      coursesCount: instructorCourses.length,
      totalStudents,
      completionRate,
      attendanceRate,
      contentQuality: {
        approved: contentApproved,
        rejected: contentRejected,
        pending: contentPending,
        total: contentApproved + contentRejected + contentPending,
      },
      sessions: {
        total: totalSessions,
        completed: completedSessions,
      },
      courses: instructorCourses.map((c) => ({ id: c.id, title: c.title, status: c.status })),
    };
  }

  // ─── Make-Up Session (Feature 9) ──────────────────────

  async createMakeupSession(
    user: AuthenticatedUser,
    studentId: string,
    data: {
      courseId: string;
      title: string;
      type: string;
      scheduledAt: string;
      durationMinutes?: number;
      parentSessionId?: string;
    },
  ) {
    // Verify student enrollment
    const [enrollment] = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.courseId, data.courseId),
          eq(enrollments.status, 'active'),
        ),
      )
      .limit(1);

    if (!enrollment) {
      throw new NotFoundException('Student is not enrolled in this course');
    }

    // Create the session with assignedStudents
    const session = await this.sessionsService.create(user, {
      courseId: data.courseId,
      title: data.title,
      type: data.type as any,
      scheduledAt: data.scheduledAt,
      durationMinutes: data.durationMinutes,
      isMakeup: true,
      parentSessionId: data.parentSessionId,
      assignedStudents: [studentId],
    });

    // Create intervention record for audit trail
    await db
      .insert(interventions)
      .values({
        studentId,
        courseId: data.courseId,
        instructorId: user.id,
        type: INTERVENTION_TYPE.MAKEUP_SESSION as string,
        message: `Make-up session "${data.title}" scheduled`,
      });

    return session;
  }
}
