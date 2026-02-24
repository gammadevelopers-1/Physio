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
  COURSE_STATUS,
  NELC_EVENT_TYPE,
} from '../../database/schema';
import type { SubmissionAnswer } from '../../database/schema/submissions';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { NelcAuditService } from '../nelc-audit/nelc-audit.service';
import {
  classifyCourse,
  getNelcMaxEnrollment,
} from '../courses/nelc-config';
import { UpdateProgressDto } from './dto/update-progress.dto';

@Injectable()
export class StudentService {
  private readonly logger = new Logger(StudentService.name);

  constructor(private readonly auditService: NelcAuditService) {}

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
      // Upcoming sessions (from enrolled courses)
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
      // Attendance stats (across all enrolled courses)
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
            or(
              eq(sessions.status, 'completed'),
              eq(sessions.status, 'live'),
            ),
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
    },
  ) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [
      eq(enrollments.studentId, studentId),
    ];

    // Filter by enrollment status
    if (params.status && params.status !== 'all') {
      conditions.push(eq(enrollments.status, params.status));
    } else {
      // By default show active + completed (not dropped/suspended)
      conditions.push(
        or(
          eq(enrollments.status, 'active'),
          eq(enrollments.status, 'completed'),
        ) as any,
      );
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
          SELECT COUNT(*) FROM course_modules cm WHERE cm.course_id = ${courses.id}
        )`.mapWith(Number),
        totalHours: sql<number>`(
          SELECT COALESCE(SUM(cm.duration_minutes), 0) FROM course_modules cm WHERE cm.course_id = ${courses.id}
        )`.mapWith(Number),
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(whereClause)
      .orderBy(desc(enrollments.enrolledAt))
      .limit(limit)
      .offset(offset);

    // Batch enrich with missing tasks, next deadline, and next action
    const courseIds = data.map((c) => c.id);

    let missingTasksMap: Record<string, number> = {};
    let nextSessionsMap: Record<string, { scheduledAt: Date; sessionType: string; zoomLink: string | null }> = {};

    if (courseIds.length > 0) {
      // Count unsubmitted published assessments per course
      const missingTasks = await db
        .select({
          courseId: assessments.courseId,
          cnt: count(),
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
        missingTasks.map((r) => [r.courseId, Number(r.cnt)]),
      );

      // Next upcoming session per course
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
        ORDER BY s.course_id, s.scheduled_at ASC
      `);

      for (const row of nextSessions.rows as any[]) {
        nextSessionsMap[row.courseId] = {
          scheduledAt: new Date(row.scheduledAt),
          sessionType: row.sessionType,
          zoomLink: row.zoomLink,
        };
      }
    }

    const enriched = data.map((c) => {
      const missingTasksCount = missingTasksMap[c.id] || 0;
      const nextSess = nextSessionsMap[c.id];
      const nextDeadline = nextSess ? nextSess.scheduledAt.toISOString() : null;

      // Compute next action
      let nextAction = 'start_course';
      if (nextSess) {
        const diff = nextSess.scheduledAt.getTime() - Date.now();
        if (diff <= 15 * 60 * 1000 && (nextSess.sessionType === 'zoom' || nextSess.sessionType === 'blended')) {
          nextAction = 'join_zoom';
        } else if (missingTasksCount > 0) {
          nextAction = 'take_quiz';
        } else if (c.progress > 0) {
          nextAction = 'resume_lesson';
        }
      } else if (missingTasksCount > 0) {
        nextAction = 'take_quiz';
      } else if (c.progress > 0) {
        nextAction = 'resume_lesson';
      }

      return {
        ...c,
        totalHours: Math.round((c.totalHours / 60) * 10) / 10,
        missingTasksCount,
        nextDeadline,
        nextAction,
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

    // Get upcoming sessions for this course
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
          ),
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

    // Build submission map
    const submissionMap = new Map<string, any>();
    for (const sub of studentSubmissions) {
      submissionMap.set(sub.assessmentId, sub);
    }

    const assessmentsWithStatus = courseAssessments.map((a) => ({
      ...a,
      submission: submissionMap.get(a.id) || null,
    }));

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
      modules,
      sessions: upcomingSessions,
      assessments: assessmentsWithStatus,
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

    // Get total sessions and attended count
    const [sessionStats] = await db
      .select({
        totalSessions: sql<number>`(
          SELECT COUNT(*) FROM sessions s WHERE s.course_id = ${courseId}
          AND s.status IN ('completed', 'live', 'scheduled')
        )`.mapWith(Number),
        attendedSessions: sql<number>`(
          SELECT COUNT(*) FROM attendance a
          INNER JOIN sessions s ON a.session_id = s.id
          WHERE a.student_id = ${studentId}
          AND s.course_id = ${courseId}
          AND a.status IN ('present', 'late')
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

    // Get total modules for this course
    const [moduleCount] = await db
      .select({ count: count() })
      .from(courseModules)
      .where(eq(courseModules.courseId, courseId));

    const totalModules = Number(moduleCount?.count || 1);

    // Calculate new progress (simple: increment by module weight)
    // For now, each module is equal weight
    const progressPerModule = Math.round(100 / totalModules);
    const newProgress = Math.min(
      enrollment.progress + progressPerModule,
      100,
    );

    const updateData: Record<string, unknown> = {
      progress: newProgress,
      lastAccessedAt: new Date(),
    };

    // If progress reaches 100, mark as completed
    if (newProgress >= 100) {
      updateData.status = 'completed';
      updateData.completedAt = new Date();
    }

    const [updated] = await db
      .update(enrollments)
      .set(updateData)
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

    return enrollment;
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
    if (assessment.attemptsAllowed && attemptCount >= assessment.attemptsAllowed) {
      throw new BadRequestException('Maximum attempts reached for this assessment');
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

    // Strip isCorrect from options for the student
    const sanitizedQuestions = assessmentQuestions.map((q) => ({
      ...q,
      options: (q.options || []).map((opt: any) => ({
        text: opt.text,
        textAr: opt.textAr,
      })),
    }));

    return {
      id: assessment.id,
      title: assessment.title,
      type: assessment.type,
      totalMarks: assessment.totalMarks,
      passingMarks: assessment.passingMarks,
      durationMinutes: assessment.durationMinutes,
      attemptsAllowed: assessment.attemptsAllowed,
      attemptsTaken: attemptCount,
      questions: sanitizedQuestions,
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
        // For MCQ: check if the selected option is the correct one
        let isCorrect = false;
        if (question.options && Array.isArray(question.options)) {
          const selectedOption = question.options.find(
            (opt: any) => opt.text === a.answer,
          );
          isCorrect = selectedOption?.isCorrect === true;
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

    const [submission] = await db
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

    return {
      submissionId: submission.id,
      score: totalScore,
      totalMarks: totalPossibleMarks,
      percentage: Number(percentage),
      status: submission.status,
      passed:
        !hasManualGrading &&
        totalScore >= (assessment.passingMarks || 0),
    };
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
        createdAt: certificateRequests.createdAt,
        reviewedAt: certificateRequests.reviewedAt,
        courseTitle: courses.title,
        courseTitleAr: courses.titleAr,
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
        ),
      )
      .orderBy(asc(sessions.scheduledAt));

    const events = sessionEvents.map((s) => ({
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

    return events;
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
          SELECT COALESCE(SUM(cm.duration_minutes), 0) FROM course_modules cm WHERE cm.course_id = ${courses.id}
        )`.mapWith(Number),
        certificateStatus: sql<string>`(
          SELECT cr.status FROM certificate_requests cr
          WHERE cr.course_id = ${courses.id} AND cr.student_id = ${studentId}
          LIMIT 1
        )`,
        certificateUrl: sql<string>`(
          SELECT cr.certificate_url FROM certificate_requests cr
          WHERE cr.course_id = ${courses.id} AND cr.student_id = ${studentId}
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
}
