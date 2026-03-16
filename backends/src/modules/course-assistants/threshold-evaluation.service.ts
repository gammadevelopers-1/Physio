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
// <=LOW: 0 TAs recommended | LOW+1 to MID: 1 TA recommended | >MID: 2 TAs recommended
export const ASSISTANT_THRESHOLDS = {
  LOW: 25,
  MID: 35,
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
   * Advisory notification — called after enrollment changes.
   * Sends a notification to the course manager ONLY if the number of
   * active TAs is below the NELC recommendation.
   * Does NOT auto-assign or auto-activate any TAs.
   */
  async checkAndNotify(courseId: string): Promise<void> {
    try {
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

      // Calculate recommended TAs
      const recommendedTAs = this.calculateRequiredTAs(enrolledCount);
      if (recommendedTAs === 0) return; // No TAs needed

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

      // Only notify if TAs are insufficient
      if (activeTAs >= recommendedTAs) return;

      // Get course info
      const [course] = await db
        .select({
          title: courses.title,
          managerId: courses.managerId,
        })
        .from(courses)
        .where(eq(courses.id, courseId))
        .limit(1);

      if (!course) return;

      const recipientIds = await this.getNotificationRecipients(courseId);
      if (recipientIds.length === 0) return;

      const message =
        recommendedTAs === 1
          ? `Course "${course.title}" has ${enrolledCount} students. NELC recommends assigning at least 1 Teaching Assistant.`
          : `Course "${course.title}" has ${enrolledCount} students. NELC recommends assigning ${recommendedTAs} Teaching Assistants (currently ${activeTAs}).`;

      await this.notificationsService.createBulk(recipientIds, {
        type: 'ta_recommendation',
        title: 'NELC TA Recommendation',
        message,
        link: `/dashboard/manager/courses/${courseId}`,
        entityType: 'course',
        entityId: courseId,
      });

      this.logger.log(
        `TA recommendation sent for course ${courseId}: ${enrolledCount} enrolled, ${recommendedTAs} recommended, ${activeTAs} active`,
      );
    } catch (error) {
      this.logger.warn(
        `TA threshold check failed for course ${courseId}: ${(error as Error).message}`,
      );
    }
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
