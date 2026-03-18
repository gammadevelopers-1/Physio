import { Injectable, Logger } from '@nestjs/common';
import { eq, and, count } from 'drizzle-orm';
import { db } from '../../database';
import {
  courseAssistants,
  courses,
  enrollments,
  users,
  userRoles,
  roles,
  ROLE_NAMES,
} from '../../database/schema';
import { UserNotificationsService } from '../user-notifications/user-notifications.service';

// NELC thresholds (advisory only — Course Manager has full control)
// TESTING VALUES (production: LOW=25, MID=35)
export const ASSISTANT_THRESHOLDS = {
  LOW: 0, // >0 (i.e. ≥1): 1 TA recommended
  MID: 1, // >1 (i.e. ≥2): 2 TAs recommended
} as const;

@Injectable()
export class ThresholdEvaluationService {
  private readonly logger = new Logger(ThresholdEvaluationService.name);

  constructor(
    private readonly notificationsService: UserNotificationsService,
  ) {}

  /**
   * Calculate how many TAs are recommended based on NELC enrollment guidelines.
   */
  calculateRequiredTAs(enrolledCount: number): number {
    if (enrolledCount > ASSISTANT_THRESHOLDS.MID) return 2;
    if (enrolledCount > ASSISTANT_THRESHOLDS.LOW) return 1;
    return 0;
  }

  /**
   * Advisory notification — called after enrollment changes or TA removal.
   * Sends a notification to the course manager ONLY if the number of
   * active TAs is below the NELC recommendation.
   * Messages are specific: tells exactly how many TAs are needed.
   */
  async checkAndNotify(courseId: string): Promise<void> {
    try {
      const { warning } = await this.getWarning(courseId);
      if (!warning) return;

      const recipientIds = await this.getNotificationRecipients(courseId);
      if (recipientIds.length === 0) return;

      await this.notificationsService.createBulk(recipientIds, {
        type: 'ta_recommendation',
        title: 'NELC TA Recommendation',
        message: warning,
        link: `/dashboard/manager/courses/${courseId}`,
        entityType: 'course',
        entityId: courseId,
      });

      this.logger.log(`TA recommendation sent for course ${courseId}: ${warning}`);
    } catch (error) {
      this.logger.warn(
        `TA threshold check failed for course ${courseId}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Get the current warning message for a course (if any).
   * Returns null if TAs are sufficient or no TAs are needed.
   * Used by both checkAndNotify (for push notifications) and
   * getThresholdStatus (for inline UI warnings).
   */
  async getWarning(courseId: string): Promise<{
    warning: string | null;
    enrolledCount: number;
    recommendedTAs: number;
    activeTAs: number;
  }> {
    // Count active enrollments
    const [enrollmentCount] = await db
      .select({ count: count() })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, courseId),
          eq(enrollments.status, 'active'),
        ),
      );
    const enrolledCount = Number(enrollmentCount?.count || 0);
    const recommendedTAs = this.calculateRequiredTAs(enrolledCount);

    // Count currently active TAs
    const [activeResult] = await db
      .select({ count: count() })
      .from(courseAssistants)
      .where(
        and(
          eq(courseAssistants.courseId, courseId),
          eq(courseAssistants.status, 'approved'),
        ),
      );
    const activeTAs = Number(activeResult?.count || 0);

    // No TAs needed or requirement fulfilled
    if (recommendedTAs === 0 || activeTAs >= recommendedTAs) {
      return { warning: null, enrolledCount, recommendedTAs, activeTAs };
    }

    // Get course title for the message
    const [course] = await db
      .select({ title: courses.title })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    const courseTitle = course?.title || 'this course';
    const deficit = recommendedTAs - activeTAs;

    let warning: string;
    if (activeTAs === 0 && recommendedTAs === 1) {
      warning = `"${courseTitle}" has ${enrolledCount} student(s). NELC recommends assigning 1 Teaching Assistant.`;
    } else if (activeTAs === 0 && recommendedTAs === 2) {
      warning = `"${courseTitle}" has ${enrolledCount} student(s). NELC recommends assigning 2 Teaching Assistants — none are currently assigned.`;
    } else if (activeTAs === 1 && recommendedTAs === 2) {
      warning = `"${courseTitle}" has ${enrolledCount} student(s). NELC recommends 2 Teaching Assistants — please assign 1 more.`;
    } else {
      warning = `"${courseTitle}" has ${enrolledCount} student(s). NELC recommends ${recommendedTAs} TA(s) but only ${activeTAs} assigned. Please assign ${deficit} more.`;
    }

    return { warning, enrolledCount, recommendedTAs, activeTAs };
  }

  /**
   * Get notification recipients for a course.
   * Returns the course's manager if set, otherwise all managers.
   */
  async getNotificationRecipients(courseId: string): Promise<string[]> {
    const [course] = await db
      .select({ managerId: courses.managerId })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (course?.managerId) {
      return [course.managerId];
    }

    const managers = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(userRoles, eq(users.id, userRoles.userId))
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(eq(roles.name, ROLE_NAMES.MANAGER), eq(users.isActive, true)),
      );
    return managers.map((m) => m.id);
  }
}
