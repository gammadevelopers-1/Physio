import { Injectable, Inject, Logger, StreamableFile } from '@nestjs/common';
import { eq, and, count, isNotNull, isNull, sql, or } from 'drizzle-orm';
import { db } from '../../database';
import {
  sessions,
  courses,
  courseModules,
  enrollments,
  attendance,
  sessionAssistants,
  courseMaterials,
  assessments,
  submissions,
  users,
  userPreferences,
  roleRequests,
  userRoles,
  roles,
  SESSION_STATUS,
  SESSION_TYPE,
  MATERIAL_STATUS,
  courseRatings,
} from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { isGlobalAdmin, isManager } from '../../common/role-helpers';
import {
  classifyCourse,
  getNelcMaxEnrollment,
} from '../courses/nelc-config';
import * as archiver from 'archiver';

export type ComplianceStatus = 'passed' | 'review' | 'failed';

export interface ComplianceCheck {
  rule: string;
  status: ComplianceStatus;
  detail: string;
}

export interface SessionComplianceResult {
  sessionId: string;
  overallStatus: ComplianceStatus;
  checks: ComplianceCheck[];
}

export interface CourseComplianceResult {
  courseId: string;
  overallStatus: ComplianceStatus;
  sessionResults: SessionComplianceResult[];
  summary: {
    passed: number;
    review: number;
    failed: number;
    total: number;
  };
}

export interface ComplianceSummary {
  totalCourses: number;
  totalSessions: number;
  passed: number;
  review: number;
  failed: number;
}

@Injectable()
export class NelcComplianceService {
  private readonly logger = new Logger(NelcComplianceService.name);

  // ─── NELC thresholds for assistant allocation ───
  private readonly ASSISTANT_THRESHOLD_LOW = 25;  // >25 (≥26): 1 TA
  private readonly ASSISTANT_THRESHOLD_MID = 35;  // >35 (≥36): 2 TAs

  /**
   * Validate session compliance against NELC rules.
   * Checks: enrollment limits, assistant allocation, Zoom settings, scheduling.
   */
  async validateSessionCompliance(
    sessionId: string,
  ): Promise<SessionComplianceResult> {
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session) {
      return {
        sessionId,
        overallStatus: 'failed',
        checks: [
          { rule: 'session_exists', status: 'failed', detail: 'Session not found' },
        ],
      };
    }

    const checks: ComplianceCheck[] = [];

    // 1. Enrollment limit check
    const enrollmentCheck = await this.checkEnrollmentLimit(session.courseId);
    checks.push(enrollmentCheck);

    // 2. Assistant allocation check
    const assistantCheck = await this.checkAssistantAllocation(
      sessionId,
      session.courseId,
    );
    checks.push(assistantCheck);

    // 3. Zoom configuration check (for zoom/hybrid sessions)
    if (
      session.type === SESSION_TYPE.ZOOM ||
      session.type === SESSION_TYPE.HYBRID
    ) {
      const zoomCheck = this.checkZoomConfiguration(session);
      checks.push(zoomCheck);
    }

    // 4. Scheduling check
    const scheduleCheck = this.checkScheduling(session);
    checks.push(scheduleCheck);

    // 5. Attendance tracking check (for completed sessions)
    if (session.status === SESSION_STATUS.COMPLETED) {
      const attendanceCheck = await this.checkAttendanceTracking(sessionId);
      checks.push(attendanceCheck);
    }

    // Determine overall status
    const overallStatus = this.calculateOverallStatus(checks);

    return {
      sessionId,
      overallStatus,
      checks,
    };
  }

  /**
   * Get compliance for an entire course across all sessions.
   */
  async getCourseCompliance(
    courseId: string,
  ): Promise<CourseComplianceResult> {
    const courseSessions = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.courseId, courseId));

    const sessionResults: SessionComplianceResult[] = [];
    for (const s of courseSessions) {
      const result = await this.validateSessionCompliance(s.id);
      sessionResults.push(result);
    }

    const summary = {
      passed: sessionResults.filter((r) => r.overallStatus === 'passed').length,
      review: sessionResults.filter((r) => r.overallStatus === 'review').length,
      failed: sessionResults.filter((r) => r.overallStatus === 'failed').length,
      total: sessionResults.length,
    };

    const overallStatus: ComplianceStatus =
      summary.failed > 0
        ? 'failed'
        : summary.review > 0
          ? 'review'
          : 'passed';

    return {
      courseId,
      overallStatus,
      sessionResults,
      summary,
    };
  }

  /**
   * Dashboard-level compliance summary.
   * Shows passed/review/failed counts across all the user's courses.
   */
  async getComplianceSummary(
    user: AuthenticatedUser,
  ): Promise<ComplianceSummary> {
    // Get courses scoped by role
    const conditions: any[] = isGlobalAdmin(user)
      ? []
      : isManager(user)
        ? [or(eq(courses.managerId, user.id), sql`${courses.managerId} IS NULL`)!]
        : [eq(courses.instructorId, user.id)];
    const userCourses = await db
      .select({ id: courses.id })
      .from(courses)
      .where(conditions.length ? and(...conditions) : undefined);

    let totalSessions = 0;
    let passed = 0;
    let review = 0;
    let failed = 0;

    for (const course of userCourses) {
      const courseResult = await this.getCourseCompliance(course.id);
      totalSessions += courseResult.summary.total;
      passed += courseResult.summary.passed;
      review += courseResult.summary.review;
      failed += courseResult.summary.failed;
    }

    return {
      totalCourses: userCourses.length,
      totalSessions,
      passed,
      review,
      failed,
    };
  }

  /**
   * All-courses compliance report for the Course Manager dashboard page.
   * Returns per-course compliance with course title + instructor name.
   */
  async getAllCoursesCompliance(
    user: AuthenticatedUser,
  ): Promise<
    Array<{
      courseId: string;
      courseTitle: string;
      instructorName: string;
      overallStatus: ComplianceStatus;
      summary: { passed: number; review: number; failed: number; total: number };
    }>
  > {
    const conditions: any[] = isGlobalAdmin(user)
      ? []
      : isManager(user)
        ? [or(eq(courses.managerId, user.id), sql`${courses.managerId} IS NULL`)!]
        : [eq(courses.instructorId, user.id)];

    const allCourses = await db
      .select({
        id: courses.id,
        title: courses.title,
        instructorId: courses.instructorId,
      })
      .from(courses)
      .where(conditions.length ? and(...conditions) : undefined);

    // Batch-fetch instructor names
    const instructorIds = [...new Set(allCourses.map((c) => c.instructorId).filter(Boolean))];
    const instructorMap = new Map<string, string>();

    if (instructorIds.length > 0) {
      const { users } = await import('../../database/schema');
      const instructors = await db
        .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(sql`${users.id} IN (${sql.join(instructorIds.map((id) => sql`${id}`), sql`, `)})`);
      for (const inst of instructors) {
        instructorMap.set(
          inst.id,
          `${inst.firstName || ''} ${inst.lastName || ''}`.trim() || 'Unknown',
        );
      }
    }

    const results = [];

    for (const course of allCourses) {
      const scorecard = await this.getCourseComplianceScorecard(course.id);
      // Compute summary from scorecard categories (not just sessions)
      const summary = {
        passed: scorecard.categories.filter((c: any) => c.status === 'passed').length,
        review: scorecard.categories.filter((c: any) => c.status === 'review').length,
        failed: scorecard.categories.filter((c: any) => c.status === 'failed').length,
        total: scorecard.categories.length,
      };
      results.push({
        courseId: course.id,
        courseTitle: course.title,
        instructorName: instructorMap.get(course.instructorId!) || 'Unknown',
        overallStatus: scorecard.overallStatus,
        summary,
      });
    }

    return results;
  }

  /**
   * 5-category course-level scorecard per NELC spec:
   * 1. Course Structure — modules, materials, bilingual content/descriptions, CME hours
   * 2. Accessibility — WCAG, captions, transcripts
   * 3. Virtual Classes — Zoom configuration, attendance tracking
   * 4. Assessment Quality — blueprint coverage, graded submissions
   * 5. Instructor Qualifications — role request approved, credentials uploaded
   */
  async getCourseComplianceScorecard(courseId: string) {
    // Fetch course
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) {
      return { courseId, overallStatus: 'failed' as ComplianceStatus, overallScore: 0, categories: [] };
    }

    // Fetch related data in parallel
    const [modules, materials, courseAssessments, courseSessions] = await Promise.all([
      db.select().from(courseModules).where(eq(courseModules.courseId, courseId)),
      db.select().from(courseMaterials).where(
        and(eq(courseMaterials.courseId, courseId), sql`${courseMaterials.status} != 'archived'`),
      ),
      db.select().from(assessments).where(eq(assessments.courseId, courseId)),
      db.select().from(sessions).where(eq(sessions.courseId, courseId)),
    ]);

    const categories: Array<{
      category: string;
      label: string;
      icon: string;
      status: ComplianceStatus;
      checks: Array<{ rule: string; status: ComplianceStatus; detail: string }>;
    }> = [];

    // ─── 1. Course Structure ───
    const structureChecks: ComplianceCheck[] = [];
    const moduleCount = modules.length;
    const isSelfPacedCourse = course.deliveryType === 'self-paced';
    const isZoomOnly = course.deliveryType === 'zoom';
    // Modules required for self-paced/blended; optional (review-level) for zoom/onsite
    if (isZoomOnly || course.deliveryType === 'onsite') {
      structureChecks.push({
        rule: 'modules_count',
        status: moduleCount >= 3 ? 'passed' : moduleCount > 0 ? 'review' : 'review',
        detail: moduleCount >= 3
          ? `${moduleCount} modules (min 3)`
          : moduleCount > 0
            ? `${moduleCount} module(s) — modules are optional for ${course.deliveryType} courses`
            : `No modules — optional for ${course.deliveryType} courses`,
      });
    } else {
      structureChecks.push({
        rule: 'modules_count',
        status: moduleCount >= 3 ? 'passed' : 'failed',
        detail: moduleCount >= 3 ? `${moduleCount} modules (min 3)` : `Only ${moduleCount} module(s)`,
      });
    }

    const modulesWithMaterials = new Set(materials.filter((m) => m.moduleId).map((m) => m.moduleId));
    const modulesLackingMaterials = modules.filter((m) => !modulesWithMaterials.has(m.id));
    structureChecks.push({
      rule: 'modules_with_materials',
      status: modules.length > 0 && modulesLackingMaterials.length === 0 ? 'passed' : 'failed',
      detail: modulesLackingMaterials.length === 0
        ? 'All modules have materials'
        : `${modulesLackingMaterials.length} module(s) lack materials`,
    });

    structureChecks.push({
      rule: 'bilingual_content',
      status: course.title && course.titleAr ? 'passed' : 'failed',
      detail: course.titleAr ? 'Course has EN + AR titles' : 'Missing Arabic title (titleAr)',
    });

    structureChecks.push({
      rule: 'bilingual_descriptions',
      status: course.description && course.descriptionAr ? 'passed' : 'failed',
      detail: course.descriptionAr
        ? 'Course has EN + AR descriptions'
        : 'Missing Arabic description',
    });

    structureChecks.push({
      rule: 'cme_hours_configured',
      status: course.cmeHours && course.cmeHours > 0 ? 'passed' : 'review',
      detail: course.cmeHours && course.cmeHours > 0
        ? `CME hours configured: ${course.cmeHours}`
        : 'CME hours not configured',
    });

    categories.push({
      category: 'course_structure',
      label: 'Course Structure',
      icon: 'BookOpen',
      status: this.calculateOverallStatus(structureChecks),
      checks: structureChecks,
    });

    // ─── 2. Accessibility ───
    const accessChecks: ComplianceCheck[] = [];
    const videoMaterials = materials.filter((m) => m.type === 'video');
    const wcagCompliant = materials.filter((m) => m.wcagStatus === 'pass' || m.wcagStatus === 'compliant').length;
    accessChecks.push({
      rule: 'wcag_status',
      status: materials.length === 0 || wcagCompliant === materials.length ? 'passed' : 'failed',
      detail: `${wcagCompliant}/${materials.length} materials WCAG compliant`,
    });

    const videosWithCaptions = videoMaterials.filter((m) => m.captionsUrl).length;
    accessChecks.push({
      rule: 'video_captions',
      status: videoMaterials.length === 0 || videosWithCaptions === videoMaterials.length ? 'passed' : 'failed',
      detail: videoMaterials.length === 0
        ? 'No videos to caption'
        : `${videosWithCaptions}/${videoMaterials.length} videos have captions`,
    });

    const videosWithTranscript = videoMaterials.filter((m) => m.transcriptUrl).length;
    accessChecks.push({
      rule: 'video_transcripts',
      status: videoMaterials.length === 0 || videosWithTranscript === videoMaterials.length ? 'passed' : 'review',
      detail: videoMaterials.length === 0
        ? 'No videos'
        : `${videosWithTranscript}/${videoMaterials.length} videos have transcripts`,
    });

    categories.push({
      category: 'accessibility',
      label: 'Accessibility',
      icon: 'Eye',
      status: this.calculateOverallStatus(accessChecks),
      checks: accessChecks,
    });

    // ─── 3. Virtual Classes (reuse existing session checks) ───
    // Skip virtual classes category entirely for self-paced courses
    const vcChecks: ComplianceCheck[] = [];
    if (isSelfPacedCourse) {
      vcChecks.push({ rule: 'sessions_exist', status: 'passed', detail: 'Not applicable for self-paced courses' });
    } else if (courseSessions.length === 0) {
      vcChecks.push({ rule: 'sessions_exist', status: 'review', detail: 'No sessions created yet' });
    } else {
      const zoomSessions = courseSessions.filter(
        (s) => s.type === SESSION_TYPE.ZOOM || s.type === SESSION_TYPE.HYBRID,
      );
      const zoomConfigured = zoomSessions.filter((s) => s.meetingId || s.zoomLink).length;
      if (zoomSessions.length > 0) {
        vcChecks.push({
          rule: 'zoom_configuration',
          status: zoomConfigured === zoomSessions.length ? 'passed' : 'failed',
          detail: `${zoomConfigured}/${zoomSessions.length} virtual sessions configured`,
        });
      }

      const completedSessions = courseSessions.filter((s) => s.status === SESSION_STATUS.COMPLETED);
      if (completedSessions.length > 0) {
        const sessionsWithAttendance = await Promise.all(
          completedSessions.map(async (s) => {
            const [c] = await db.select({ count: count() }).from(attendance).where(eq(attendance.sessionId, s.id));
            return Number(c?.count || 0) > 0;
          }),
        );
        const tracked = sessionsWithAttendance.filter(Boolean).length;
        vcChecks.push({
          rule: 'attendance_tracking',
          status: tracked === completedSessions.length ? 'passed' : 'failed',
          detail: `${tracked}/${completedSessions.length} completed sessions have attendance`,
        });
      }

      // TA allocation check — required when enrollment exceeds thresholds
      const enrolled = await db.select({ count: count() }).from(enrollments).where(
        and(eq(enrollments.courseId, courseId), eq(enrollments.status, 'active')),
      );
      const enrolledCount = Number(enrolled[0]?.count || 0);
      if (enrolledCount > 0 && courseSessions.length > 0) {
        const requiredTAs = enrolledCount > 100 ? 2 : enrolledCount > 50 ? 1 : 0;
        if (requiredTAs > 0) {
          // Check if any session has TAs assigned
          const [taCount] = await db
            .select({ count: count() })
            .from(sessionAssistants)
            .where(sql`${sessionAssistants.sessionId} IN (${sql.join(courseSessions.map((s) => sql`${s.id}`), sql`, `)})`);
          const assignedTAs = Number(taCount?.count || 0);
          vcChecks.push({
            rule: 'ta_allocation',
            status: assignedTAs >= requiredTAs ? 'passed' : 'failed',
            detail: `${assignedTAs} TA(s) assigned, ${requiredTAs} required (${enrolledCount} enrolled)`,
          });
        }
      }
    }

    categories.push({
      category: 'virtual_classes',
      label: isSelfPacedCourse ? 'Virtual Classes (N/A)' : 'Virtual Classes',
      icon: 'Video',
      status: this.calculateOverallStatus(vcChecks),
      checks: vcChecks,
    });

    // ─── 4. Assessment Quality ───
    const assessChecks: ComplianceCheck[] = [];
    if (courseAssessments.length === 0) {
      assessChecks.push({ rule: 'assessments_exist', status: 'failed', detail: 'No assessments created' });
    } else {
      const modulesWithAssessments = new Set(courseAssessments.filter((a) => a.moduleId).map((a) => a.moduleId));
      const coveredCount = modules.filter((m) => modulesWithAssessments.has(m.id)).length;
      const coveragePercent = modules.length > 0 ? Math.round((coveredCount / modules.length) * 100) : 0;
      assessChecks.push({
        rule: 'blueprint_coverage',
        status: coveragePercent >= 80 ? 'passed' : coveragePercent >= 50 ? 'review' : 'failed',
        detail: `${coveragePercent}% module coverage (${coveredCount}/${modules.length} modules)`,
      });

      const publishedAssessments = courseAssessments.filter((a) => a.status === 'published');
      const assessmentIds = publishedAssessments.map((a) => a.id);
      if (assessmentIds.length > 0) {
        const submissionCounts = await db
          .select({
            assessmentId: submissions.assessmentId,
            count: count(),
          })
          .from(submissions)
          .where(sql`${submissions.assessmentId} IN (${sql.join(assessmentIds.map((id) => sql`${id}`), sql`, `)})`)
          .groupBy(submissions.assessmentId);
        const withSubmissions = submissionCounts.filter((s) => Number(s.count) > 0).length;
        assessChecks.push({
          rule: 'graded_submissions',
          status: withSubmissions === publishedAssessments.length ? 'passed' : 'review',
          detail: `${withSubmissions}/${publishedAssessments.length} published assessments have submissions`,
        });
      }
    }

    categories.push({
      category: 'assessment_quality',
      label: 'Assessment Quality',
      icon: 'FileText',
      status: this.calculateOverallStatus(assessChecks),
      checks: assessChecks,
    });

    // ─── 5. Instructor Qualifications ───
    const qualChecks: ComplianceCheck[] = [];
    if (course.instructorId) {
      // Check if user currently has the INSTRUCTOR role (not just request status)
      const [hasRole] = await db
        .select({ userId: userRoles.userId })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(and(eq(userRoles.userId, course.instructorId), eq(roles.name, 'INSTRUCTOR')))
        .limit(1);

      qualChecks.push({
        rule: 'instructor_role',
        status: hasRole ? 'passed' : 'failed',
        detail: hasRole
          ? 'Instructor has active instructor role'
          : 'User does not have instructor role assigned',
      });

      // Check if instructor has credentials on file (from role request)
      const [roleRequest] = await db
        .select({ resumeFiles: roleRequests.resumeFiles })
        .from(roleRequests)
        .where(and(eq(roleRequests.userId, course.instructorId), eq(roleRequests.requestedRole, 'INSTRUCTOR')))
        .limit(1);

      const hasResume = roleRequest?.resumeFiles && (Array.isArray(roleRequest.resumeFiles) ? (roleRequest.resumeFiles as any[]).length > 0 : true);
      qualChecks.push({
        rule: 'credentials_uploaded',
        status: hasResume ? 'passed' : 'review',
        detail: hasResume ? 'Resume/credentials on file' : 'No resume/credentials uploaded',
      });
    } else {
      qualChecks.push({
        rule: 'instructor_assigned',
        status: 'failed',
        detail: 'No instructor assigned to course',
      });
    }

    categories.push({
      category: 'instructor_qualifications',
      label: 'Instructor Qualifications',
      icon: 'GraduationCap',
      status: this.calculateOverallStatus(qualChecks),
      checks: qualChecks,
    });

    // Calculate overall score
    const passedCategories = categories.filter((c) => c.status === 'passed').length;
    const overallScore = Math.round((passedCategories / categories.length) * 100);
    const overallStatus: ComplianceStatus =
      categories.some((c) => c.status === 'failed')
        ? 'failed'
        : categories.some((c) => c.status === 'review')
          ? 'review'
          : 'passed';

    return {
      courseId,
      overallStatus,
      overallScore,
      categories,
    };
  }

  /**
   * Generate a ZIP evidence bundle for a course's NELC compliance.
   * Contains: compliance-checks.json, attendance.csv, sessions.csv, materials.csv
   */
  async generateEvidenceBundle(courseId: string): Promise<archiver.Archiver> {
    // 1. Compliance checks JSON
    const compliance = await this.getCourseCompliance(courseId);

    // 2. Course info (expanded for evidence bundle)
    const [course] = await db
      .select({
        id: courses.id,
        title: courses.title,
        titleAr: courses.titleAr,
        description: courses.description,
        descriptionAr: courses.descriptionAr,
        instructorId: courses.instructorId,
        startDate: courses.startDate,
        endDate: courses.endDate,
      })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    // 3. Session records
    const sessionRows = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        type: sessions.type,
        scheduledAt: sessions.scheduledAt,
        durationMinutes: sessions.durationMinutes,
        status: sessions.status,
        zoomLink: sessions.zoomLink,
        meetingId: sessions.meetingId,
      })
      .from(sessions)
      .where(eq(sessions.courseId, courseId));

    // 4. Attendance records
    const attendanceRows = await db
      .select({
        sessionId: attendance.sessionId,
        studentId: attendance.studentId,
        status: attendance.status,
        joinedAt: attendance.joinedAt,
        leftAt: attendance.leftAt,
        durationMinutes: attendance.durationMinutes,
      })
      .from(attendance)
      .innerJoin(sessions, eq(attendance.sessionId, sessions.id))
      .where(eq(sessions.courseId, courseId));

    // 5. Materials audit (with reviewer info)
    const materialRows = await db
      .select({
        id: courseMaterials.id,
        title: courseMaterials.title,
        type: courseMaterials.type,
        status: courseMaterials.status,
        wcagStatus: courseMaterials.wcagStatus,
        version: courseMaterials.version,
        createdAt: courseMaterials.createdAt,
        reviewedBy: courseMaterials.reviewedBy,
        reviewNote: courseMaterials.reviewNote,
      })
      .from(courseMaterials)
      .where(eq(courseMaterials.courseId, courseId));

    // 6. Assessment results
    const courseAssessments = await db
      .select({ id: assessments.id, title: assessments.title })
      .from(assessments)
      .where(eq(assessments.courseId, courseId));

    const assessmentIds = courseAssessments.map((a) => a.id);
    const submissionRows = assessmentIds.length > 0
      ? await db
          .select({
            assessmentId: submissions.assessmentId,
            studentId: submissions.studentId,
            score: submissions.score,
            totalMarks: submissions.totalMarks,
            percentage: submissions.percentage,
            status: submissions.status,
            submittedAt: submissions.submittedAt,
          })
          .from(submissions)
          .where(sql`${submissions.assessmentId} IN (${sql.join(assessmentIds.map((id) => sql`${id}`), sql`, `)})`)
      : [];

    // 7. Instructor credentials (role request + profile)
    const instructorCredentials = course?.instructorId
      ? await db
          .select({
            userId: roleRequests.userId,
            requestedRole: roleRequests.requestedRole,
            status: roleRequests.status,
            profileData: roleRequests.profileData,
            resumeFiles: roleRequests.resumeFiles,
            createdAt: roleRequests.createdAt,
          })
          .from(roleRequests)
          .where(eq(roleRequests.userId, course.instructorId))
          .limit(1)
      : [];

    // 8. Student feedback / ratings
    const ratingsRows = await db
      .select({
        studentId: courseRatings.studentId,
        rating: courseRatings.rating,
        reviewText: courseRatings.reviewText,
        createdAt: courseRatings.createdAt,
      })
      .from(courseRatings)
      .where(eq(courseRatings.courseId, courseId));

    // 9. Accessibility report (aggregate materials WCAG)
    const allMaterials = materialRows;
    const videoMaterials = allMaterials.filter((m) => m.type === 'video');
    const accessibilityReport = {
      courseId,
      generatedAt: new Date().toISOString(),
      totalMaterials: allMaterials.length,
      wcagCompliant: allMaterials.filter((m) => m.wcagStatus === 'pass' || m.wcagStatus === 'compliant').length,
      wcagNonCompliant: allMaterials.filter((m) => m.wcagStatus === 'fail' || m.wcagStatus === 'non_compliant').length,
      wcagPending: allMaterials.filter((m) => m.wcagStatus === 'pending' || m.wcagStatus === 'warning' || m.wcagStatus === 'not_applicable').length,
      totalVideos: videoMaterials.length,
      complianceRate: allMaterials.length > 0
        ? Math.round((allMaterials.filter((m) => m.wcagStatus === 'pass' || m.wcagStatus === 'compliant').length / allMaterials.length) * 100)
        : 100,
    };

    // 10. Instructor policy settings
    const policyRows = course?.instructorId
      ? await db
          .select({
            policyEnrollmentLimit: userPreferences.policyEnrollmentLimit,
            policyRequireContentReview: userPreferences.policyRequireContentReview,
            policyAutoApproveCertificates: userPreferences.policyAutoApproveCertificates,
            policyCancellationNoticeHours: userPreferences.policyCancellationNoticeHours,
            policyMaxInstructorWeeklyHours: userPreferences.policyMaxInstructorWeeklyHours,
            policyEnforceNelcCompliance: userPreferences.policyEnforceNelcCompliance,
          })
          .from(userPreferences)
          .where(eq(userPreferences.userId, course.instructorId))
          .limit(1)
      : [];

    // NELC clause mapping (static)
    const NELC_CLAUSE_MAP: Record<string, string> = {
      enrollment_limit: 'NELC-VC-001',
      zoom_config: 'NELC-VC-002',
      assistant_allocation: 'NELC-VC-003',
      attendance_tracking: 'NELC-VC-004',
      attendance_sync: 'NELC-VC-005',
      modules_count: 'NELC-CS-001',
      hours_compliance: 'NELC-CS-002',
      modules_with_materials: 'NELC-CS-003',
      bilingual_content: 'NELC-CS-004',
      wcag_status: 'NELC-AC-001',
      video_captions: 'NELC-AC-002',
      video_transcripts: 'NELC-AC-003',
      blueprint_coverage: 'NELC-AQ-001',
      graded_submissions: 'NELC-AQ-002',
      content_review_policy: 'NELC-PL-001',
      nelc_compliance_policy: 'NELC-PL-002',
      bilingual_descriptions: 'NELC-PL-003',
      data_protection_pdp: 'NELC-DP-001',
      data_retention: 'NELC-DP-002',
      privacy_policy: 'NELC-DP-003',
      consent_management: 'NELC-DP-004',
      role_request_approved: 'NELC-IQ-001',
      credentials_uploaded: 'NELC-IQ-002',
    };

    // Build ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } });

    // Cover summary (text)
    const coverText = [
      '=== NELC Compliance Evidence Bundle ===',
      '',
      `Course: ${course?.title || 'Unknown'}`,
      `Course ID: ${courseId}`,
      `Generated: ${new Date().toISOString()}`,
      '',
      '--- Compliance Summary ---',
      `Overall Status: ${compliance.overallStatus.toUpperCase()}`,
      `Sessions Passed: ${compliance.summary.passed}`,
      `Sessions Review: ${compliance.summary.review}`,
      `Sessions Failed: ${compliance.summary.failed}`,
      `Total Sessions: ${compliance.summary.total}`,
      '',
      '--- Data Included ---',
      `Sessions: ${sessionRows.length}`,
      `Attendance Records: ${attendanceRows.length}`,
      `Materials: ${materialRows.length}`,
      `Assessments: ${courseAssessments.length}`,
      `Submissions: ${submissionRows.length}`,
      `Student Ratings: ${ratingsRows.length}`,
      '',
      'Files:',
      '  compliance-checks.json     — Compliance checks with NELC clause references',
      '  sessions.csv               — All session records',
      '  attendance.csv             — Full attendance log with timestamps',
      '  materials-audit.csv        — Material audit trail with review status',
      '  assessment-results.csv     — Assessment submission results',
      '  instructor-credentials.json — Instructor role request and profile data',
      '  student-feedback.csv       — Student ratings and feedback',
      '  accessibility-report.json  — WCAG compliance summary for all materials',
      '  policies.json              — Instructor policy configuration',
      '  cover-summary.txt          — This file',
    ].join('\n');
    archive.append(coverText, { name: 'cover-summary.txt' });

    // compliance-checks.json (with NELC clause mapping)
    const enrichedSessionResults = compliance.sessionResults.map((sr: any) => ({
      ...sr,
      checks: sr.checks.map((chk: ComplianceCheck) => ({
        ...chk,
        nelcClause: NELC_CLAUSE_MAP[chk.rule] || null,
      })),
    }));
    archive.append(
      JSON.stringify(
        {
          courseId,
          courseTitle: course?.title || 'Unknown',
          generatedAt: new Date().toISOString(),
          overallStatus: compliance.overallStatus,
          summary: compliance.summary,
          clauseMapping: NELC_CLAUSE_MAP,
          sessionResults: enrichedSessionResults,
        },
        null,
        2,
      ),
      { name: 'compliance-checks.json' },
    );

    // sessions.csv
    const sessionsCsv = [
      'session_id,title,type,scheduled_at,duration_minutes,status,zoom_link,meeting_id',
      ...sessionRows.map(
        (s) =>
          `"${s.id}","${(s.title || '').replace(/"/g, '""')}","${s.type}","${s.scheduledAt?.toISOString() || ''}",${s.durationMinutes || ''},"${s.status}","${s.zoomLink || ''}","${s.meetingId || ''}"`,
      ),
    ].join('\n');
    archive.append(sessionsCsv, { name: 'sessions.csv' });

    // attendance.csv
    const attendanceCsv = [
      'session_id,student_id,status,joined_at,left_at,duration_minutes',
      ...attendanceRows.map(
        (a) =>
          `"${a.sessionId}","${a.studentId}","${a.status}","${a.joinedAt?.toISOString() || ''}","${a.leftAt?.toISOString() || ''}",${a.durationMinutes || ''}`,
      ),
    ].join('\n');
    archive.append(attendanceCsv, { name: 'attendance.csv' });

    // materials-audit.csv (enhanced with review info)
    const materialsCsv = [
      'material_id,title,type,status,wcag_status,version,reviewed_by,review_note,created_at',
      ...materialRows.map(
        (m) =>
          `"${m.id}","${(m.title || '').replace(/"/g, '""')}","${m.type}","${m.status}","${m.wcagStatus}",${m.version},"${m.reviewedBy || ''}","${(m.reviewNote || '').replace(/"/g, '""')}","${m.createdAt?.toISOString() || ''}"`,
      ),
    ].join('\n');
    archive.append(materialsCsv, { name: 'materials-audit.csv' });

    // assessment-results.csv
    const assessmentMap = new Map(courseAssessments.map((a) => [a.id, a.title]));
    const assessmentsCsv = [
      'assessment_id,assessment_title,student_id,score,total_marks,percentage,status,submitted_at',
      ...submissionRows.map(
        (s) =>
          `"${s.assessmentId}","${(assessmentMap.get(s.assessmentId) || '').replace(/"/g, '""')}","${s.studentId}",${s.score ?? ''},${s.totalMarks ?? ''},${s.percentage ?? ''},"${s.status}","${s.submittedAt?.toISOString() || ''}"`,
      ),
    ].join('\n');
    archive.append(assessmentsCsv, { name: 'assessment-results.csv' });

    // instructor-credentials.json
    const credentialData = instructorCredentials[0] || null;
    archive.append(
      JSON.stringify(
        {
          courseId,
          instructorId: course?.instructorId || null,
          generatedAt: new Date().toISOString(),
          roleRequest: credentialData
            ? {
                status: credentialData.status,
                requestedRole: credentialData.requestedRole,
                profileData: credentialData.profileData,
                resumeFiles: credentialData.resumeFiles,
                submittedAt: credentialData.createdAt?.toISOString() || null,
              }
            : { note: 'No role request found for this instructor' },
        },
        null,
        2,
      ),
      { name: 'instructor-credentials.json' },
    );

    // student-feedback.csv
    const avgRating = ratingsRows.length > 0
      ? (ratingsRows.reduce((sum, r) => sum + r.rating, 0) / ratingsRows.length).toFixed(2)
      : 'N/A';
    const feedbackCsv = [
      `# Summary: ${ratingsRows.length} ratings, Average: ${avgRating}`,
      'student_id,rating,review_text,created_at',
      ...ratingsRows.map(
        (r) =>
          `"${r.studentId}",${r.rating},"${(r.reviewText || '').replace(/"/g, '""')}","${r.createdAt?.toISOString() || ''}"`,
      ),
    ].join('\n');
    archive.append(feedbackCsv, { name: 'student-feedback.csv' });

    // accessibility-report.json
    archive.append(
      JSON.stringify(accessibilityReport, null, 2),
      { name: 'accessibility-report.json' },
    );

    // policies.json
    const policyData = policyRows[0] || null;
    archive.append(
      JSON.stringify(
        {
          courseId,
          instructorId: course?.instructorId || null,
          generatedAt: new Date().toISOString(),
          policies: policyData || { note: 'No policy preferences found for this instructor' },
        },
        null,
        2,
      ),
      { name: 'policies.json' },
    );

    archive.finalize();
    return archive;
  }

  // ─── Individual Compliance Checks ─────────────────────────

  private async checkEnrollmentLimit(
    courseId: string,
  ): Promise<ComplianceCheck> {
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) {
      return {
        rule: 'enrollment_limit',
        status: 'failed',
        detail: 'Course not found',
      };
    }

    const classification = classifyCourse(course.startDate, course.endDate);
    const nelcMax = getNelcMaxEnrollment(classification);

    const [countResult] = await db
      .select({ count: count() })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, courseId),
          eq(enrollments.status, 'active'),
        ),
      );
    const enrolled = Number(countResult?.count || 0);

    if (enrolled > nelcMax) {
      return {
        rule: 'enrollment_limit',
        status: 'failed',
        detail: `${enrolled}/${nelcMax} — exceeds NELC max for ${classification} course`,
      };
    }

    if (enrolled >= nelcMax * 0.9) {
      return {
        rule: 'enrollment_limit',
        status: 'review',
        detail: `${enrolled}/${nelcMax} — approaching NELC limit for ${classification} course`,
      };
    }

    return {
      rule: 'enrollment_limit',
      status: 'passed',
      detail: `${enrolled}/${nelcMax} — within NELC limit for ${classification} course`,
    };
  }

  private async checkAssistantAllocation(
    sessionId: string,
    courseId: string,
  ): Promise<ComplianceCheck> {
    // Get enrolled count
    const [countResult] = await db
      .select({ count: count() })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, courseId),
          eq(enrollments.status, 'active'),
        ),
      );
    const enrolled = Number(countResult?.count || 0);

    // Calculate required assistants
    let required = 0;
    if (enrolled > this.ASSISTANT_THRESHOLD_MID) {
      required = 2;
    } else if (enrolled > this.ASSISTANT_THRESHOLD_LOW) {
      required = 1;
    }

    // Count assigned assistants
    const [assistantCount] = await db
      .select({ count: count() })
      .from(sessionAssistants)
      .where(eq(sessionAssistants.sessionId, sessionId));
    const assigned = Number(assistantCount?.count || 0);

    if (required === 0) {
      return {
        rule: 'assistant_allocation',
        status: 'passed',
        detail: `${enrolled} enrolled — no assistants required`,
      };
    }

    if (assigned >= required) {
      return {
        rule: 'assistant_allocation',
        status: 'passed',
        detail: `${assigned}/${required} assistants assigned (${enrolled} enrolled)`,
      };
    }

    return {
      rule: 'assistant_allocation',
      status: 'failed',
      detail: `${assigned}/${required} assistants assigned — ${required - assigned} more needed (${enrolled} enrolled)`,
    };
  }

  private checkZoomConfiguration(session: any): ComplianceCheck {
    if (!session.meetingId && !session.zoomLink) {
      return {
        rule: 'zoom_configuration',
        status: 'failed',
        detail: 'Zoom/hybrid session has no meeting link configured',
      };
    }

    return {
      rule: 'zoom_configuration',
      status: 'passed',
      detail: 'Zoom meeting configured',
    };
  }

  private checkScheduling(session: any): ComplianceCheck {
    if (!session.scheduledAt) {
      return {
        rule: 'scheduling',
        status: 'failed',
        detail: 'Session has no scheduled date',
      };
    }

    if (!session.durationMinutes || session.durationMinutes < 15) {
      return {
        rule: 'scheduling',
        status: 'review',
        detail: `Duration is ${session.durationMinutes || 0} minutes — should be at least 15 minutes`,
      };
    }

    return {
      rule: 'scheduling',
      status: 'passed',
      detail: `Scheduled for ${session.durationMinutes} minutes`,
    };
  }

  private async checkAttendanceTracking(
    sessionId: string,
  ): Promise<ComplianceCheck> {
    const [attendanceCount] = await db
      .select({ count: count() })
      .from(attendance)
      .where(eq(attendance.sessionId, sessionId));
    const tracked = Number(attendanceCount?.count || 0);

    if (tracked === 0) {
      return {
        rule: 'attendance_tracking',
        status: 'failed',
        detail: 'No attendance records for completed session',
      };
    }

    return {
      rule: 'attendance_tracking',
      status: 'passed',
      detail: `${tracked} attendance records tracked`,
    };
  }

  private calculateOverallStatus(
    checks: ComplianceCheck[],
  ): ComplianceStatus {
    if (checks.some((c) => c.status === 'failed')) return 'failed';
    if (checks.some((c) => c.status === 'review')) return 'review';
    return 'passed';
  }

  /**
   * Get virtual class (Zoom/hybrid) sessions with compliance details.
   * Returns per-session compliance checks for Zoom-specific NELC rules.
   */
  async getVirtualClassCompliance(
    user: AuthenticatedUser,
  ): Promise<
    Array<{
      sessionId: string;
      sessionTitle: string;
      courseTitle: string;
      instructorName: string;
      type: string;
      scheduledAt: Date | null;
      durationMinutes: number;
      status: string;
      hasZoomLink: boolean;
      hasRecording: boolean;
      overallStatus: ComplianceStatus;
      checks: ComplianceCheck[];
    }>
  > {
    const conditions: any[] = [
      sql`${sessions.type} IN ('zoom', 'hybrid')`,
    ];
    if (isGlobalAdmin(user)) {
      // No filter
    } else if (isManager(user)) {
      conditions.push(
        sql`${sessions.courseId} IN (SELECT id FROM courses WHERE manager_id = ${user.id} OR manager_id IS NULL)`,
      );
    } else {
      conditions.push(eq(sessions.instructorId, user.id));
    }

    const virtualSessions = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        type: sessions.type,
        scheduledAt: sessions.scheduledAt,
        durationMinutes: sessions.durationMinutes,
        status: sessions.status,
        zoomLink: sessions.zoomLink,
        meetingId: sessions.meetingId,
        zoomSyncedAt: sessions.zoomSyncedAt,
        courseId: sessions.courseId,
        courseTitle: courses.title,
        instructorId: sessions.instructorId,
        instructorFirstName: users.firstName,
        instructorLastName: users.lastName,
      })
      .from(sessions)
      .innerJoin(courses, eq(sessions.courseId, courses.id))
      .innerJoin(users, eq(sessions.instructorId, users.id))
      .where(and(...conditions))
      .orderBy(sessions.scheduledAt);

    const results = [];
    for (const s of virtualSessions) {
      const compliance = await this.validateSessionCompliance(s.id);
      results.push({
        sessionId: s.id,
        sessionTitle: s.title,
        courseTitle: s.courseTitle,
        instructorName: `${s.instructorFirstName || ''} ${s.instructorLastName || ''}`.trim() || 'Unknown',
        type: s.type,
        scheduledAt: s.scheduledAt,
        durationMinutes: s.durationMinutes,
        status: s.status,
        hasZoomLink: !!(s.zoomLink || s.meetingId),
        hasRecording: !!s.zoomSyncedAt,
        overallStatus: compliance.overallStatus,
        checks: compliance.checks,
      });
    }

    return results;
  }
}
