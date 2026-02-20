import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, and, count, isNotNull, isNull, sql } from 'drizzle-orm';
import { db } from '../../database';
import {
  sessions,
  courses,
  enrollments,
  attendance,
  sessionAssistants,
  SESSION_STATUS,
  SESSION_TYPE,
} from '../../database/schema';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import {
  classifyCourse,
  getNelcMaxEnrollment,
} from '../courses/nelc-config';

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
  private readonly ASSISTANT_THRESHOLD_LOW = 25;
  private readonly ASSISTANT_THRESHOLD_MID = 35;

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
    const isAdmin =
      user.roles.includes('ADMIN') ||
      user.roles.includes('SUPER_ADMIN') ||
      user.roles.includes('MANAGER');

    // Get courses
    const conditions = isAdmin ? [] : [eq(courses.instructorId, user.id)];
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
}
