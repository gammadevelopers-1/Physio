import { Injectable, Logger } from '@nestjs/common';
import { eq, and, count, asc, desc, sql, lte, isNotNull } from 'drizzle-orm';
import { db } from '../../database';
import {
  courseAssistants,
  sessionAssistants,
  sessions,
  courses,
  enrollments,
  users,
  userRoles,
  roles,
  ROLE_NAMES,
  NELC_EVENT_TYPE,
} from '../../database/schema';
import { NelcAuditService } from '../nelc-audit/nelc-audit.service';
import { EmailService } from '../email/email.service';
import { UserNotificationsService } from '../user-notifications/user-notifications.service';

// NELC thresholds
// <=LOW: 0 TAs | LOW+1 to MID: 1 TA | >MID: 2 TAs
export const ASSISTANT_THRESHOLDS = {
  LOW: 25, // ≤25: no assistant needed
  MID: 35, // 26-35: 1 assistant, >35: 2 assistants
} as const;

@Injectable()
export class ThresholdEvaluationService {
  private readonly logger = new Logger(ThresholdEvaluationService.name);

  constructor(
    private readonly auditService: NelcAuditService,
    private readonly emailService: EmailService,
    private readonly notificationsService: UserNotificationsService,
  ) {}

  /**
   * Calculate how many TAs are required based on NELC enrollment rules.
   */
  calculateRequiredTAs(enrolledCount: number): number {
    if (enrolledCount > ASSISTANT_THRESHOLDS.MID) return 2;
    if (enrolledCount > ASSISTANT_THRESHOLDS.LOW) return 1;
    return 0;
  }

  /**
   * Main entry point — called after every enrollment change.
   * Evaluates whether TAs need to be activated or deactivated for a course.
   * Idempotent: safe to call multiple times concurrently (EC-19).
   */
  async evaluateAndAct(courseId: string): Promise<void> {
    try {
      // 1. Count active enrollments
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

      // 2. Calculate required TAs
      const requiredTAs = this.calculateRequiredTAs(enrolledCount);

      // 3. Get all course assistants ordered by priority
      const allAssistants = await db
        .select({
          id: courseAssistants.id,
          userId: courseAssistants.userId,
          status: courseAssistants.status,
          priority: courseAssistants.priority,
          deactivationScheduledAt: courseAssistants.deactivationScheduledAt,
        })
        .from(courseAssistants)
        .where(eq(courseAssistants.courseId, courseId))
        .orderBy(asc(courseAssistants.priority));

      const activeTAs = allAssistants.filter((a) => a.status === 'approved');
      const preAssignedTAs = allAssistants.filter(
        (a) => a.status === 'pre_assigned',
      );
      const currentActive = activeTAs.length;
      const deficit = requiredTAs - currentActive;

      this.logger.log(
        `Course ${courseId}: enrolled=${enrolledCount}, required=${requiredTAs}, active=${currentActive}, preAssigned=${preAssignedTAs.length}, deficit=${deficit}`,
      );

      if (deficit > 0) {
        // Need more TAs — activate pre-assigned ones
        // First, cancel any pending deactivations on active TAs (EC-11)
        for (const ta of activeTAs) {
          if (ta.deactivationScheduledAt) {
            await this.cancelDeactivation(ta.id, courseId);
          }
        }

        // Activate pre-assigned TAs by priority order
        let activated = 0;
        for (const ta of preAssignedTAs) {
          if (activated >= deficit) break;

          // Cancel any pending deactivation (EC-11)
          if (ta.deactivationScheduledAt) {
            await this.cancelDeactivation(ta.id, courseId);
          }

          const success = await this.activateTA(ta.id, ta.userId, courseId);
          if (success) activated++;
        }

        // If still deficit after activating all pre-assigned TAs, warn manager (EC-23)
        if (activated < deficit) {
          await this.sendDeficitWarning(
            courseId,
            requiredTAs,
            currentActive + activated,
          );
        }
      } else if (deficit < 0) {
        // Too many TAs — schedule deactivation (highest priority number first)
        const surplus = Math.abs(deficit);
        const sortedByPriorityDesc = [...activeTAs].sort(
          (a, b) => b.priority - a.priority,
        );

        let scheduled = 0;
        for (const ta of sortedByPriorityDesc) {
          if (scheduled >= surplus) break;

          // Only schedule if not already scheduled
          if (!ta.deactivationScheduledAt) {
            await this.scheduleDeactivation(ta.id, courseId);
            scheduled++;
          }
        }
      } else {
        // Balanced — cancel any pending deactivations
        for (const ta of activeTAs) {
          if (ta.deactivationScheduledAt) {
            await this.cancelDeactivation(ta.id, courseId);
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `Threshold evaluation failed for course ${courseId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Activate a pre-assigned TA (EC-3, EC-4).
   * Uses WHERE status='pre_assigned' for idempotency (EC-19).
   * Returns true if activation succeeded.
   */
  private async activateTA(
    courseAssistantId: string,
    userId: string,
    courseId: string,
  ): Promise<boolean> {
    // Idempotent: only updates if still pre_assigned
    const [updated] = await db
      .update(courseAssistants)
      .set({
        status: 'approved',
        approvedAt: new Date(),
        deactivationScheduledAt: null,
      })
      .where(
        and(
          eq(courseAssistants.id, courseAssistantId),
          eq(courseAssistants.status, 'pre_assigned'),
        ),
      )
      .returning();

    if (!updated) return false;

    // Propagate to all sessions (EC-17)
    await this.propagateToAllSessions(courseId, userId);

    // Get course and user info for notifications
    const [course] = await db
      .select({
        id: courses.id,
        title: courses.title,
        instructorId: courses.instructorId,
        managerId: courses.managerId,
      })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    const taUser = await this.getUser(userId);

    // Send activation email to TA
    if (taUser && course) {
      await this.sendActivationEmail(
        { email: taUser.email, firstName: taUser.firstName || '', lastName: taUser.lastName || '' },
        course,
      );
    }

    // Notify instructor
    if (course?.instructorId) {
      await this.notificationsService.create({
        recipientId: course.instructorId,
        type: 'ta_activated',
        title: 'Teaching Assistant Activated',
        message: `TA ${taUser?.firstName || ''} ${taUser?.lastName || ''} has been activated for "${course.title}" (enrollment threshold reached)`,
        link: `/dashboard/instructor/courses/${courseId}`,
        entityType: 'course',
        entityId: courseId,
      });
    }

    // Notify TA
    if (taUser) {
      await this.notificationsService.create({
        recipientId: userId,
        type: 'ta_activated',
        title: 'You Have Been Activated',
        message: `You are now an active Teaching Assistant for "${course?.title}". You have access to all sessions.`,
        link: `/dashboard/teaching-assistant/courses/${courseId}`,
        entityType: 'course',
        entityId: courseId,
      });
    }

    // Audit log
    await this.auditService.log({
      eventType: NELC_EVENT_TYPE.ASSISTANT_ALLOCATED,
      entityType: 'course',
      entityId: courseId,
      userId,
      metadata: {
        assistantId: userId,
        courseId,
        reason: 'threshold_activation',
        courseAssistantId,
      },
    });

    this.logger.log(
      `Activated TA ${userId} for course ${courseId} (threshold reached)`,
    );

    return true;
  }

  /**
   * Schedule deactivation with 24h grace period (EC-5, EC-6, EC-11).
   */
  private async scheduleDeactivation(
    courseAssistantId: string,
    courseId: string,
  ): Promise<void> {
    await db
      .update(courseAssistants)
      .set({ deactivationScheduledAt: new Date() })
      .where(eq(courseAssistants.id, courseAssistantId));

    this.logger.log(
      `Scheduled deactivation for course assistant ${courseAssistantId} in course ${courseId} (24h grace period)`,
    );
  }

  /**
   * Cancel a pending deactivation (EC-11 — enrollment recovered).
   */
  private async cancelDeactivation(
    courseAssistantId: string,
    courseId: string,
  ): Promise<void> {
    await db
      .update(courseAssistants)
      .set({ deactivationScheduledAt: null })
      .where(eq(courseAssistants.id, courseAssistantId));

    this.logger.log(
      `Cancelled deactivation for course assistant ${courseAssistantId} in course ${courseId}`,
    );
  }

  /**
   * Process scheduled deactivations that have passed the 24h grace period.
   * Called by the cron job (TaDeactivationCronService).
   */
  async processScheduledDeactivations(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h ago

    const pendingDeactivations = await db
      .select({
        id: courseAssistants.id,
        courseId: courseAssistants.courseId,
        userId: courseAssistants.userId,
        priority: courseAssistants.priority,
      })
      .from(courseAssistants)
      .where(
        and(
          isNotNull(courseAssistants.deactivationScheduledAt),
          lte(courseAssistants.deactivationScheduledAt, cutoff),
          eq(courseAssistants.status, 'approved'),
        ),
      );

    for (const row of pendingDeactivations) {
      // Re-check current enrollment (EC-22 — enrollment may have recovered)
      const [enrollmentCount] = await db
        .select({ count: count() })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.courseId, row.courseId),
            eq(enrollments.status, 'active'),
          ),
        );
      const enrolledCount = Number(enrollmentCount?.count || 0);
      const requiredTAs = this.calculateRequiredTAs(enrolledCount);

      // Count currently approved TAs
      const [activeCount] = await db
        .select({ count: count() })
        .from(courseAssistants)
        .where(
          and(
            eq(courseAssistants.courseId, row.courseId),
            eq(courseAssistants.status, 'approved'),
          ),
        );
      const currentActive = Number(activeCount?.count || 0);

      if (currentActive > requiredTAs) {
        // Still surplus — execute deactivation
        await this.executeDeactivation(row.id, row.userId, row.courseId);
      } else {
        // Enrollment recovered — cancel deactivation
        await this.cancelDeactivation(row.id, row.courseId);
        this.logger.log(
          `Deactivation cancelled for TA ${row.userId} in course ${row.courseId} (enrollment recovered)`,
        );
      }
    }
  }

  /**
   * Execute TA deactivation: status -> pre_assigned, remove from future sessions (EC-5, EC-20).
   */
  private async executeDeactivation(
    courseAssistantId: string,
    userId: string,
    courseId: string,
  ): Promise<void> {
    // Set status back to pre_assigned, clear deactivation timestamp
    await db
      .update(courseAssistants)
      .set({
        status: 'pre_assigned',
        deactivationScheduledAt: null,
        approvedAt: null,
      })
      .where(eq(courseAssistants.id, courseAssistantId));

    // Remove from future scheduled sessions only (keep completed — EC-20)
    // Only remove auto-assigned ones
    const futureSessions = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.courseId, courseId),
          eq(sessions.status, 'scheduled'),
        ),
      );

    if (futureSessions.length > 0) {
      const sessionIds = futureSessions.map((s) => s.id);
      for (const sessionId of sessionIds) {
        await db
          .delete(sessionAssistants)
          .where(
            and(
              eq(sessionAssistants.sessionId, sessionId),
              eq(sessionAssistants.userId, userId),
              eq(sessionAssistants.isAutoAssigned, true),
            ),
          );
      }
    }

    // Get course and user info for notifications
    const [course] = await db
      .select({
        id: courses.id,
        title: courses.title,
        instructorId: courses.instructorId,
        managerId: courses.managerId,
      })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    const taUser = await this.getUser(userId);

    // Notify TA
    if (taUser) {
      await this.notificationsService.create({
        recipientId: userId,
        type: 'ta_deactivated',
        title: 'TA Assignment Paused',
        message: `Your active assignment for "${course?.title}" has been paused due to reduced enrollment. You remain pre-assigned and will be reactivated if enrollment increases.`,
        link: `/dashboard/teaching-assistant/courses/${courseId}`,
        entityType: 'course',
        entityId: courseId,
      });
    }

    // Notify instructor
    if (course?.instructorId) {
      await this.notificationsService.create({
        recipientId: course.instructorId,
        type: 'ta_deactivated',
        title: 'Teaching Assistant Deactivated',
        message: `TA ${taUser?.firstName || ''} ${taUser?.lastName || ''} has been deactivated for "${course.title}" due to reduced enrollment`,
        link: `/dashboard/instructor/courses/${courseId}`,
        entityType: 'course',
        entityId: courseId,
      });
    }

    // Notify course manager (EC-26)
    if (course?.managerId) {
      await this.notificationsService.create({
        recipientId: course.managerId,
        type: 'ta_deactivated',
        title: 'Teaching Assistant Deactivated',
        message: `TA ${taUser?.firstName || ''} ${taUser?.lastName || ''} has been deactivated for "${course.title}" due to reduced enrollment`,
        link: `/dashboard/manager/courses/${courseId}`,
        entityType: 'course',
        entityId: courseId,
      });
    }

    // Send deactivation email
    if (taUser && course) {
      await this.sendDeactivationEmail(
        { email: taUser.email, firstName: taUser.firstName || '', lastName: taUser.lastName || '' },
        course,
      );
    }

    // Audit log
    await this.auditService.log({
      eventType: NELC_EVENT_TYPE.ASSISTANT_DEALLOCATED,
      entityType: 'course',
      entityId: courseId,
      userId,
      metadata: {
        assistantId: userId,
        courseId,
        reason: 'threshold_deactivation',
        courseAssistantId,
      },
    });

    this.logger.log(
      `Deactivated TA ${userId} from course ${courseId} (enrollment below threshold)`,
    );
  }

  /**
   * Send deficit warning to course manager (EC-23, EC-26).
   */
  private async sendDeficitWarning(
    courseId: string,
    required: number,
    active: number,
  ): Promise<void> {
    const [course] = await db
      .select({
        id: courses.id,
        title: courses.title,
        managerId: courses.managerId,
      })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) return;

    // Get notification recipients (manager isolation — EC-26)
    const recipientIds = await this.getNotificationRecipients(courseId);

    if (recipientIds.length > 0) {
      await this.notificationsService.createBulk(recipientIds, {
        type: 'ta_deficit_warning',
        title: 'TA Deficit Warning',
        message: `Course "${course.title}" needs ${required} TA(s) but only has ${active}. Please pre-assign additional TAs.`,
        link: `/dashboard/manager/courses/${courseId}`,
        entityType: 'course',
        entityId: courseId,
      });
    }
  }

  /**
   * Get notification recipients for a course (EC-26 — Manager Isolation).
   * Returns only the course's manager if set, otherwise falls back to all managers.
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

    // Fallback: all managers (legacy courses without managerId)
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

  /**
   * Propagate a TA to all existing sessions of a course.
   */
  private async propagateToAllSessions(
    courseId: string,
    userId: string,
  ): Promise<void> {
    const courseSessions = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.courseId, courseId));

    for (const session of courseSessions) {
      try {
        await db
          .insert(sessionAssistants)
          .values({
            sessionId: session.id,
            userId,
            role: 'assistant',
            isAutoAssigned: true,
          })
          .onConflictDoNothing({
            target: [sessionAssistants.sessionId, sessionAssistants.userId],
          });
      } catch (err) {
        this.logger.warn(
          `Failed to propagate TA ${userId} to session ${session.id}`,
          err,
        );
      }
    }
  }

  /**
   * Get user details by ID.
   */
  private async getUser(userId: string) {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return user;
  }

  /**
   * Send activation email to TA.
   */
  private async sendActivationEmail(
    taUser: { email: string; firstName: string; lastName: string },
    course: { title: string; instructorId: string },
  ): Promise<void> {
    try {
      const instructor = await this.getUser(course.instructorId);
      await this.emailService.sendTaAssignment(taUser.email, {
        recipientName: `${taUser.firstName} ${taUser.lastName}`,
        sessionTitle: `All sessions - ${course.title}`,
        courseName: course.title,
        scheduledAt: new Date().toISOString(),
        durationMinutes: 0,
        instructorName: instructor
          ? `${instructor.firstName} ${instructor.lastName}`
          : 'N/A',
        isAutoAssigned: true,
      });
    } catch (err) {
      this.logger.warn('Failed to send TA activation email', err);
    }
  }

  /**
   * Send deactivation email to TA.
   */
  private async sendDeactivationEmail(
    taUser: { email: string; firstName: string; lastName: string },
    course: { title: string },
  ): Promise<void> {
    try {
      // Reuse the existing email service — send a generic notification
      // In production, you'd create a dedicated template
      await this.emailService.sendGenericNotification(taUser.email, {
        recipientName: `${taUser.firstName} ${taUser.lastName}`,
        subject: `TA Assignment Paused - ${course.title}`,
        message: `Due to reduced enrollment in "${course.title}", your active TA assignment has been paused. You remain pre-assigned and will be reactivated if enrollment increases. No action is needed from you.`,
      });
    } catch (err) {
      this.logger.warn('Failed to send TA deactivation email', err);
    }
  }
}
