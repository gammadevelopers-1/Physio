import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { eq, and, inArray, count, sql, max } from 'drizzle-orm';
import { db } from '../../database';
import {
  courseAssistants,
  sessionAssistants,
  sessions,
  courses,
  users,
  userRoles,
  roles,
  enrollments,
  ROLE_NAMES,
  NELC_EVENT_TYPE,
} from '../../database/schema';
import { NelcAuditService } from '../nelc-audit/nelc-audit.service';
import { EmailService } from '../email/email.service';
import { UserNotificationsService } from '../user-notifications/user-notifications.service';
import { ThresholdEvaluationService, ASSISTANT_THRESHOLDS } from './threshold-evaluation.service';

@Injectable()
export class CourseAssistantsService {
  private readonly logger = new Logger(CourseAssistantsService.name);

  constructor(
    private readonly auditService: NelcAuditService,
    private readonly emailService: EmailService,
    private readonly notificationsService: UserNotificationsService,
    private readonly thresholdService: ThresholdEvaluationService,
  ) {}

  /**
   * Verify a user has the TEACHING_ASSISTANT role.
   */
  private async verifyTARole(userId: string): Promise<void> {
    const [taRole] = await db
      .select({ roleId: roles.id })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(roles.name, ROLE_NAMES.TEACHING_ASSISTANT),
        ),
      )
      .limit(1);

    if (!taRole) {
      throw new BadRequestException(
        'User does not have the Teaching Assistant role.',
      );
    }
  }

  /**
   * Verify a course exists and return its data.
   */
  private async getCourse(courseId: string) {
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

    if (!course) {
      throw new NotFoundException('Course not found');
    }
    return course;
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
   * Get notification recipients for a course (EC-26 — Manager Isolation).
   * Uses the course's managerId if set, otherwise falls back to all managers.
   */
  private async getNotificationRecipients(
    courseId: string,
  ): Promise<string[]> {
    return this.thresholdService.getNotificationRecipients(courseId);
  }

  /**
   * Get all user IDs with MANAGER role (legacy fallback).
   */
  private async getManagerIds(): Promise<string[]> {
    const managers = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(userRoles, eq(users.id, userRoles.userId))
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(
          eq(roles.name, ROLE_NAMES.MANAGER),
          eq(users.isActive, true),
        ),
      );
    return managers.map((m) => m.id);
  }

  /**
   * Get the current active enrollment count for a course.
   */
  private async getEnrollmentCount(courseId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, courseId),
          eq(enrollments.status, 'active'),
        ),
      );
    return Number(result?.count || 0);
  }

  /**
   * Get the next priority number for a course.
   */
  private async getNextPriority(courseId: string): Promise<number> {
    const [result] = await db
      .select({ maxPriority: max(courseAssistants.priority) })
      .from(courseAssistants)
      .where(eq(courseAssistants.courseId, courseId));
    return (Number(result?.maxPriority) || 0) + 1;
  }

  /**
   * Manager/Admin directly assigns a TA to a course.
   * EC-1, EC-2: Pre-assigns if below threshold, activates if above.
   * Priority auto-increments.
   */
  async assignTA(courseId: string, userId: string, assignedBy: string) {
    const course = await this.getCourse(courseId);
    await this.verifyTARole(userId);

    // Check not already assigned
    const [existing] = await db
      .select({ id: courseAssistants.id, status: courseAssistants.status })
      .from(courseAssistants)
      .where(
        and(
          eq(courseAssistants.courseId, courseId),
          eq(courseAssistants.userId, userId),
        ),
      )
      .limit(1);

    if (existing && existing.status !== 'rejected') {
      throw new BadRequestException(
        'User is already assigned to this course',
      );
    }

    // Calculate threshold-based status (EC-1, EC-2)
    const enrolledCount = await this.getEnrollmentCount(courseId);
    const requiredTAs = this.thresholdService.calculateRequiredTAs(enrolledCount);
    const priority = existing
      ? (await this.getNextPriority(courseId))
      : (await this.getNextPriority(courseId));

    // Count currently approved TAs
    const [activeResult] = await db
      .select({ count: count() })
      .from(courseAssistants)
      .where(
        and(
          eq(courseAssistants.courseId, courseId),
          eq(courseAssistants.status, 'approved'),
        ),
      );
    const currentActive = Number(activeResult?.count || 0);

    // Determine if this TA should be immediately activated or pre-assigned
    const shouldActivate = currentActive < requiredTAs;
    const status = shouldActivate ? 'approved' : 'pre_assigned';

    let assignment;
    if (existing && existing.status === 'rejected') {
      // Re-assign: update the rejected record
      [assignment] = await db
        .update(courseAssistants)
        .set({
          status,
          priority,
          approvedBy: shouldActivate ? assignedBy : null,
          approvedAt: shouldActivate ? new Date() : null,
          assignedBy,
          deactivationScheduledAt: null,
        })
        .where(eq(courseAssistants.id, existing.id))
        .returning();
    } else {
      [assignment] = await db
        .insert(courseAssistants)
        .values({
          courseId,
          userId,
          status,
          priority,
          approvedBy: shouldActivate ? assignedBy : null,
          approvedAt: shouldActivate ? new Date() : null,
          assignedBy,
        })
        .returning();
    }

    // EC-9: Check workload — warn manager if TA is assigned to other courses
    const [otherCoursesResult] = await db
      .select({ count: count() })
      .from(courseAssistants)
      .where(
        and(
          eq(courseAssistants.userId, userId),
          inArray(courseAssistants.status, ['approved', 'pre_assigned']),
          sql`${courseAssistants.courseId} != ${courseId}`,
        ),
      );
    const otherCourseCount = Number(otherCoursesResult?.count || 0);

    if (otherCourseCount > 0) {
      const recipientIds = await this.getNotificationRecipients(courseId);
      const taUser = await this.getUser(userId);
      if (recipientIds.length > 0) {
        await this.notificationsService.createBulk(recipientIds, {
          type: 'ta_workload_warning',
          title: 'TA Workload Notice',
          message: `TA ${taUser?.firstName || ''} ${taUser?.lastName || ''} assigned to "${course.title}" is also assigned to ${otherCourseCount} other course(s)`,
          link: `/dashboard/manager/courses/${courseId}`,
          entityType: 'course',
          entityId: courseId,
        });
      }
    }

    if (shouldActivate) {
      // Propagate to all existing sessions
      await this.propagateToAllSessions(courseId, userId, assignedBy);

      // Audit log
      await this.auditService.log({
        eventType: NELC_EVENT_TYPE.ASSISTANT_ALLOCATED,
        entityType: 'course',
        entityId: courseId,
        userId,
        metadata: {
          assistantId: userId,
          courseId,
          reason: 'manual',
          assignedBy,
        },
      });

      // Email TA (activation)
      await this.sendAssignmentEmail(userId, course);

      // Notify course instructor
      const taUser = await this.getUser(userId);
      if (course.instructorId) {
        await this.notificationsService.create({
          recipientId: course.instructorId,
          type: 'ta_assigned',
          title: 'Teaching Assistant Assigned',
          message: `TA ${taUser?.firstName || ''} ${taUser?.lastName || ''} has been assigned to your course "${course.title}"`,
          link: `/dashboard/instructor/courses/${courseId}`,
          entityType: 'course',
          entityId: courseId,
        });
      }

      // Notify the TA themselves
      await this.notificationsService.create({
        recipientId: userId,
        type: 'ta_assigned',
        title: 'Assigned as Teaching Assistant',
        message: `You have been assigned as a Teaching Assistant for "${course.title}"`,
        link: `/dashboard/teaching-assistant`,
        entityType: 'course',
        entityId: courseId,
      });
    } else {
      // Pre-assigned — send pre-assignment email and notification (EC-1)
      const taUser = await this.getUser(userId);

      // Email TA about pre-assignment
      if (taUser) {
        await this.emailService.sendGenericNotification(taUser.email, {
          recipientName: `${taUser.firstName} ${taUser.lastName}`,
          subject: `Pre-assigned to ${course.title}`,
          message: `You have been pre-assigned as a Teaching Assistant for "${course.title}". You will be automatically activated when the enrollment reaches the required threshold. No action is needed from you at this time.`,
        });
      }

      // Notify TA in-app
      if (taUser) {
        await this.notificationsService.create({
          recipientId: userId,
          type: 'ta_pre_assigned',
          title: 'Pre-assigned to Course',
          message: `You have been pre-assigned as a TA for "${course.title}". You will be activated when enrollment reaches the threshold.`,
          link: `/dashboard/teaching-assistant`,
          entityType: 'course',
          entityId: courseId,
        });
      }

      // Notify instructor
      if (course.instructorId) {
        await this.notificationsService.create({
          recipientId: course.instructorId,
          type: 'ta_pre_assigned',
          title: 'Teaching Assistant Pre-assigned',
          message: `TA ${taUser?.firstName || ''} ${taUser?.lastName || ''} has been pre-assigned to "${course.title}" (will activate at threshold)`,
          link: `/dashboard/instructor/courses/${courseId}`,
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
          reason: 'pre_assigned',
          assignedBy,
          priority,
        },
      });
    }

    return assignment;
  }

  /**
   * Instructor suggests a TA (status = 'suggested'). Course manager gets notified.
   * EC-10: Includes other course count in notification.
   * EC-26: Notification routed to course's manager.
   */
  async suggestTA(courseId: string, userId: string, suggestedBy: string) {
    const course = await this.getCourse(courseId);

    // Verify the instructor owns this course
    if (course.instructorId !== suggestedBy) {
      throw new ForbiddenException('You can only suggest TAs for your own courses');
    }

    await this.verifyTARole(userId);

    // Check not already assigned
    const [existing] = await db
      .select({ id: courseAssistants.id, status: courseAssistants.status })
      .from(courseAssistants)
      .where(
        and(
          eq(courseAssistants.courseId, courseId),
          eq(courseAssistants.userId, userId),
        ),
      )
      .limit(1);

    if (existing && existing.status !== 'rejected') {
      throw new BadRequestException(
        'User is already assigned or suggested for this course',
      );
    }

    let suggestion;
    if (existing && existing.status === 'rejected') {
      // Re-suggest: update the rejected record back to suggested
      [suggestion] = await db
        .update(courseAssistants)
        .set({
          status: 'suggested',
          suggestedBy,
          approvedBy: null,
          approvedAt: null,
          deactivationScheduledAt: null,
        })
        .where(eq(courseAssistants.id, existing.id))
        .returning();
    } else {
      [suggestion] = await db
        .insert(courseAssistants)
        .values({
          courseId,
          userId,
          status: 'suggested',
          suggestedBy,
        })
        .returning();
    }

    // EC-10: Count how many other courses this TA is assigned to
    const [otherCoursesResult] = await db
      .select({ count: count() })
      .from(courseAssistants)
      .where(
        and(
          eq(courseAssistants.userId, userId),
          sql`${courseAssistants.courseId} != ${courseId}`,
          sql`${courseAssistants.status} IN ('approved', 'pre_assigned')`,
        ),
      );
    const otherCourseCount = Number(otherCoursesResult?.count || 0);

    // Notify course manager (EC-26 — manager isolation)
    const recipientIds = await this.getNotificationRecipients(courseId);
    const suggester = await this.getUser(suggestedBy);
    const taUser = await this.getUser(userId);

    const workloadNote =
      otherCourseCount > 0
        ? ` (Note: This TA is currently assigned to ${otherCourseCount} other course(s))`
        : '';

    if (recipientIds.length > 0) {
      await this.notificationsService.createBulk(recipientIds, {
        type: 'ta_suggestion',
        title: 'TA Suggestion',
        message: `${suggester?.firstName || 'Instructor'} ${suggester?.lastName || ''} suggested TA ${taUser?.firstName || ''} ${taUser?.lastName || ''} for Course "${course.title}"${workloadNote}`,
        link: `/dashboard/manager/courses/${courseId}`,
        entityType: 'course',
        entityId: courseId,
      });
    }

    // Notify the TA that they have been suggested
    await this.notificationsService.create({
      recipientId: userId,
      type: 'ta_suggestion',
      title: 'Suggested as Teaching Assistant',
      message: `You have been suggested as a Teaching Assistant for "${course.title}". Awaiting manager approval.`,
      link: `/dashboard/teaching-assistant`,
      entityType: 'course',
      entityId: courseId,
    });

    return suggestion;
  }

  /**
   * Manager/Admin approves a suggestion.
   * EC-24: Checks enrollment threshold — goes to pre_assigned or approved.
   */
  async approveTA(courseId: string, userId: string, approvedBy: string) {
    const course = await this.getCourse(courseId);

    const [existing] = await db
      .select({
        id: courseAssistants.id,
        status: courseAssistants.status,
        suggestedBy: courseAssistants.suggestedBy,
      })
      .from(courseAssistants)
      .where(
        and(
          eq(courseAssistants.courseId, courseId),
          eq(courseAssistants.userId, userId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('TA suggestion not found');
    }

    if (existing.status !== 'suggested' && existing.status !== 'pre_assigned') {
      throw new BadRequestException('TA suggestion has already been processed');
    }

    // EC-24: Check enrollment threshold to decide status
    const enrolledCount = await this.getEnrollmentCount(courseId);
    const requiredTAs = this.thresholdService.calculateRequiredTAs(enrolledCount);
    const priority = await this.getNextPriority(courseId);

    // Count currently approved TAs
    const [activeResult] = await db
      .select({ count: count() })
      .from(courseAssistants)
      .where(
        and(
          eq(courseAssistants.courseId, courseId),
          eq(courseAssistants.status, 'approved'),
        ),
      );
    const currentActive = Number(activeResult?.count || 0);

    const shouldActivate = currentActive < requiredTAs;
    const newStatus = shouldActivate ? 'approved' : 'pre_assigned';

    // EC-25: Optimistic locking — only update if status is still 'suggested'
    const [updated] = await db
      .update(courseAssistants)
      .set({
        status: newStatus,
        priority,
        approvedBy: shouldActivate ? approvedBy : null,
        approvedAt: shouldActivate ? new Date() : null,
        assignedBy: approvedBy,
      })
      .where(
        and(
          eq(courseAssistants.id, existing.id),
          eq(courseAssistants.status, existing.status),
        ),
      )
      .returning();

    if (!updated) {
      throw new BadRequestException('TA suggestion has already been processed by another manager');
    }

    if (shouldActivate) {
      // Propagate to all sessions
      await this.propagateToAllSessions(courseId, userId, approvedBy);

      // Audit log
      await this.auditService.log({
        eventType: NELC_EVENT_TYPE.ASSISTANT_ALLOCATED,
        entityType: 'course',
        entityId: courseId,
        userId,
        metadata: {
          assistantId: userId,
          courseId,
          reason: 'approved_suggestion',
          approvedBy,
        },
      });

      // Email TA
      await this.sendAssignmentEmail(userId, course);

      // Notify the suggesting instructor
      const taUser = await this.getUser(userId);
      if (existing.suggestedBy) {
        await this.notificationsService.create({
          recipientId: existing.suggestedBy,
          type: 'ta_suggestion_approved',
          title: 'TA Suggestion Approved',
          message: `Your TA suggestion for ${taUser?.firstName || ''} ${taUser?.lastName || ''} on "${course.title}" was approved and activated`,
          link: `/dashboard/instructor/courses/${courseId}`,
          entityType: 'course',
          entityId: courseId,
        });
      }

      // Notify the TA that their assignment has been approved
      await this.notificationsService.create({
        recipientId: userId,
        type: 'ta_suggestion_approved',
        title: 'TA Assignment Approved',
        message: `Your TA assignment for "${course.title}" has been approved. You are now active.`,
        link: `/dashboard/teaching-assistant`,
        entityType: 'course',
        entityId: courseId,
      });
    } else {
      // Pre-assigned — notify instructor
      const taUser = await this.getUser(userId);

      if (existing.suggestedBy) {
        await this.notificationsService.create({
          recipientId: existing.suggestedBy,
          type: 'ta_suggestion_approved',
          title: 'TA Suggestion Approved (Pre-assigned)',
          message: `Your TA suggestion for ${taUser?.firstName || ''} ${taUser?.lastName || ''} on "${course.title}" was approved and pre-assigned (will activate at enrollment threshold)`,
          link: `/dashboard/instructor/courses/${courseId}`,
          entityType: 'course',
          entityId: courseId,
        });
      }

      // Email TA about pre-assignment
      if (taUser) {
        await this.emailService.sendGenericNotification(taUser.email, {
          recipientName: `${taUser.firstName} ${taUser.lastName}`,
          subject: `Pre-assigned to ${course.title}`,
          message: `Your TA suggestion for "${course.title}" has been approved. You have been pre-assigned and will be automatically activated when enrollment reaches the required threshold.`,
        });
      }

      // Notify the TA in-app about pre-assigned approval
      await this.notificationsService.create({
        recipientId: userId,
        type: 'ta_suggestion_approved',
        title: 'TA Suggestion Approved (Pre-assigned)',
        message: `Your TA suggestion for "${course.title}" has been approved. You are pre-assigned and will be activated when enrollment reaches the threshold.`,
        link: `/dashboard/teaching-assistant`,
        entityType: 'course',
        entityId: courseId,
      });
    }

    return updated;
  }

  /**
   * Manager/Admin rejects a suggestion. Notifies the instructor.
   */
  async rejectTA(courseId: string, userId: string, reason: string) {
    const course = await this.getCourse(courseId);

    const [existing] = await db
      .select({
        id: courseAssistants.id,
        status: courseAssistants.status,
        suggestedBy: courseAssistants.suggestedBy,
      })
      .from(courseAssistants)
      .where(
        and(
          eq(courseAssistants.courseId, courseId),
          eq(courseAssistants.userId, userId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('TA suggestion not found');
    }

    if (existing.status === 'rejected') {
      throw new BadRequestException('TA suggestion has already been rejected');
    }

    // EC-25: Optimistic locking — only update if status hasn't changed
    const [updated] = await db
      .update(courseAssistants)
      .set({
        status: 'rejected',
        rejectionReason: reason,
        rejectedAt: new Date(),
      })
      .where(
        and(
          eq(courseAssistants.id, existing.id),
          eq(courseAssistants.status, existing.status),
        ),
      )
      .returning();

    if (!updated) {
      throw new BadRequestException('TA suggestion has already been processed by another manager');
    }

    // Notify the suggesting instructor
    const taUser = await this.getUser(userId);
    if (existing.suggestedBy) {
      await this.notificationsService.create({
        recipientId: existing.suggestedBy,
        type: 'ta_suggestion_rejected',
        title: 'TA Suggestion Rejected',
        message: `Your TA suggestion for ${taUser?.firstName || ''} ${taUser?.lastName || ''} on "${course.title}" was rejected. Reason: ${reason}`,
        link: `/dashboard/instructor/courses/${courseId}`,
        entityType: 'course',
        entityId: courseId,
      });

      // Send rejection email to the suggesting instructor
      const suggester = await this.getUser(existing.suggestedBy);
      if (suggester) {
        try {
          await this.emailService.sendTaRejection(suggester.email, {
            recipientName: `${suggester.firstName} ${suggester.lastName}`,
            courseName: course.title,
            taName: `${taUser?.firstName || ''} ${taUser?.lastName || ''}`.trim(),
            rejectionReason: reason,
          });
        } catch (err) {
          this.logger.warn('Failed to send TA rejection email', err);
        }
      }
    }

    // Notify the TA that their suggestion was not approved
    await this.notificationsService.create({
      recipientId: userId,
      type: 'ta_suggestion_rejected',
      title: 'TA Suggestion Not Approved',
      message: `Your TA suggestion for "${course.title}" was not approved. Reason: ${reason}`,
      link: `/dashboard/teaching-assistant`,
      entityType: 'course',
      entityId: courseId,
    });

    return updated;
  }

  /**
   * Remove a TA from a course + all its session assignments.
   * EC-12: Re-number priorities for remaining TAs after removal.
   */
  async removeTA(courseId: string, userId: string) {
    // Get priority before deletion for re-numbering
    const [existing] = await db
      .select({
        id: courseAssistants.id,
        priority: courseAssistants.priority,
      })
      .from(courseAssistants)
      .where(
        and(
          eq(courseAssistants.courseId, courseId),
          eq(courseAssistants.userId, userId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Course assistant not found');
    }

    const removedPriority = existing.priority;

    const [deleted] = await db
      .delete(courseAssistants)
      .where(eq(courseAssistants.id, existing.id))
      .returning();

    // Remove from all sessions of this course
    const courseSessions = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.courseId, courseId));

    if (courseSessions.length > 0) {
      const sessionIds = courseSessions.map((s) => s.id);
      await db
        .delete(sessionAssistants)
        .where(
          and(
            inArray(sessionAssistants.sessionId, sessionIds),
            eq(sessionAssistants.userId, userId),
          ),
        );
    }

    // EC-12: Re-number priorities for remaining TAs
    await db.execute(sql`
      UPDATE course_assistants
      SET priority = priority - 1
      WHERE course_id = ${courseId}
        AND priority > ${removedPriority}
        AND status IN ('pre_assigned', 'approved')
    `);

    // Audit log
    await this.auditService.log({
      eventType: NELC_EVENT_TYPE.ASSISTANT_DEALLOCATED,
      entityType: 'course',
      entityId: courseId,
      userId,
      metadata: { assistantId: userId, courseId },
    });

    // After removal, re-evaluate thresholds (may need to activate a pre-assigned TA)
    await this.thresholdService.evaluateAndAct(courseId);

    return { message: 'Teaching assistant removed from course and all sessions' };
  }

  /**
   * EC-15: Handle TA account deactivation cascade.
   * When admin deactivates a TA's user account, reject all their active/pre-assigned
   * course assignments, remove from future sessions, and warn managers.
   */
  async handleTAAccountDeactivation(userId: string): Promise<void> {
    try {
      // Get all active course assignments for this user
      const activeAssignments = await db
        .select({
          id: courseAssistants.id,
          courseId: courseAssistants.courseId,
          status: courseAssistants.status,
        })
        .from(courseAssistants)
        .where(
          and(
            eq(courseAssistants.userId, userId),
            inArray(courseAssistants.status, ['approved', 'pre_assigned', 'suggested']),
          ),
        );

      if (activeAssignments.length === 0) return;

      const taUser = await this.getUser(userId);
      const taName = taUser
        ? `${taUser.firstName || ''} ${taUser.lastName || ''}`.trim()
        : 'Unknown TA';

      for (const assignment of activeAssignments) {
        // Set status to rejected
        await db
          .update(courseAssistants)
          .set({
            status: 'rejected',
            rejectionReason: 'TA account deactivated by administrator',
            rejectedAt: new Date(),
          })
          .where(eq(courseAssistants.id, assignment.id));

        // Remove from future scheduled sessions (auto-assigned only)
        const futureSessions = await db
          .select({ id: sessions.id })
          .from(sessions)
          .where(
            and(
              eq(sessions.courseId, assignment.courseId),
              eq(sessions.status, 'scheduled'),
            ),
          );

        for (const session of futureSessions) {
          await db
            .delete(sessionAssistants)
            .where(
              and(
                eq(sessionAssistants.sessionId, session.id),
                eq(sessionAssistants.userId, userId),
                eq(sessionAssistants.isAutoAssigned, true),
              ),
            );
        }

        // NELC audit log
        await this.auditService.log({
          eventType: NELC_EVENT_TYPE.ASSISTANT_DEALLOCATED,
          entityType: 'course',
          entityId: assignment.courseId,
          userId,
          metadata: {
            assistantId: userId,
            courseId: assignment.courseId,
            reason: 'account_deactivated',
          },
        });

        // Warn course manager
        const recipientIds = await this.getNotificationRecipients(assignment.courseId);
        const [course] = await db
          .select({ title: courses.title })
          .from(courses)
          .where(eq(courses.id, assignment.courseId))
          .limit(1);

        if (recipientIds.length > 0 && course) {
          await this.notificationsService.createBulk(recipientIds, {
            type: 'ta_account_deactivated',
            title: 'TA Account Deactivated',
            message: `TA ${taName}'s account has been deactivated. They have been removed from "${course.title}". A replacement may be needed.`,
            link: `/dashboard/manager/courses/${assignment.courseId}`,
            entityType: 'course',
            entityId: assignment.courseId,
          });
        }

        // Re-evaluate thresholds — may activate a backup pre-assigned TA
        if (assignment.status === 'approved') {
          await this.thresholdService.evaluateAndAct(assignment.courseId);
        }
      }

      this.logger.log(
        `EC-15: Deactivation cascade completed for TA ${userId} — ${activeAssignments.length} course assignment(s) affected`,
      );
    } catch (error) {
      this.logger.error(
        `EC-15: TA deactivation cascade failed for user ${userId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Get all TAs for a course with user info, status, priority, and other course count (EC-9).
   */
  async getCourseTAs(courseId: string) {
    const data = await db
      .select({
        id: courseAssistants.id,
        courseId: courseAssistants.courseId,
        userId: courseAssistants.userId,
        status: courseAssistants.status,
        priority: courseAssistants.priority,
        assignedAt: courseAssistants.assignedAt,
        approvedAt: courseAssistants.approvedAt,
        deactivationScheduledAt: courseAssistants.deactivationScheduledAt,
        assignedBy: courseAssistants.assignedBy,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(courseAssistants)
      .innerJoin(users, eq(courseAssistants.userId, users.id))
      .where(eq(courseAssistants.courseId, courseId));

    // EC-9: Add other course count for each TA
    const enriched = await Promise.all(
      data.map(async (ta) => {
        const [otherResult] = await db
          .select({ count: count() })
          .from(courseAssistants)
          .where(
            and(
              eq(courseAssistants.userId, ta.userId),
              sql`${courseAssistants.courseId} != ${courseId}`,
              sql`${courseAssistants.status} IN ('approved', 'pre_assigned')`,
            ),
          );
        return {
          ...ta,
          otherCourseCount: Number(otherResult?.count || 0),
        };
      }),
    );

    return enriched;
  }

  /**
   * Update TA priority (for drag-and-drop reordering).
   */
  async updatePriority(
    courseId: string,
    userId: string,
    newPriority: number,
  ) {
    const [existing] = await db
      .select({
        id: courseAssistants.id,
        priority: courseAssistants.priority,
      })
      .from(courseAssistants)
      .where(
        and(
          eq(courseAssistants.courseId, courseId),
          eq(courseAssistants.userId, userId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundException('Course assistant not found');
    }

    const oldPriority = existing.priority;

    if (oldPriority === newPriority) return existing;

    // Shift other priorities
    if (newPriority < oldPriority) {
      // Moving up: shift others down
      await db.execute(sql`
        UPDATE course_assistants
        SET priority = priority + 1
        WHERE course_id = ${courseId}
          AND priority >= ${newPriority}
          AND priority < ${oldPriority}
          AND status IN ('pre_assigned', 'approved')
      `);
    } else {
      // Moving down: shift others up
      await db.execute(sql`
        UPDATE course_assistants
        SET priority = priority - 1
        WHERE course_id = ${courseId}
          AND priority > ${oldPriority}
          AND priority <= ${newPriority}
          AND status IN ('pre_assigned', 'approved')
      `);
    }

    const [updated] = await db
      .update(courseAssistants)
      .set({ priority: newPriority })
      .where(eq(courseAssistants.id, existing.id))
      .returning();

    return updated;
  }

  /**
   * Get threshold status for a course (for UI display).
   */
  async getThresholdStatus(courseId: string) {
    const enrolledCount = await this.getEnrollmentCount(courseId);
    const requiredTAs = this.thresholdService.calculateRequiredTAs(enrolledCount);

    const allAssistants = await db
      .select({
        status: courseAssistants.status,
      })
      .from(courseAssistants)
      .where(eq(courseAssistants.courseId, courseId));

    const activeTAs = allAssistants.filter((a) => a.status === 'approved').length;
    const preAssignedTAs = allAssistants.filter(
      (a) => a.status === 'pre_assigned',
    ).length;
    const suggestedTAs = allAssistants.filter(
      (a) => a.status === 'suggested',
    ).length;

    return {
      enrolledCount,
      requiredTAs,
      activeTAs,
      preAssignedTAs,
      suggestedTAs,
      deficit: Math.max(0, requiredTAs - activeTAs),
      thresholds: {
        low: ASSISTANT_THRESHOLDS.LOW,
        mid: ASSISTANT_THRESHOLDS.MID,
      },
    };
  }

  /**
   * Propagate all approved course TAs to a specific session.
   * Called when a new session is created for a course.
   */
  async propagateToSession(courseId: string, sessionId: string) {
    const approvedTAs = await db
      .select({ userId: courseAssistants.userId })
      .from(courseAssistants)
      .where(
        and(
          eq(courseAssistants.courseId, courseId),
          eq(courseAssistants.status, 'approved'),
        ),
      );

    for (const ta of approvedTAs) {
      try {
        await db
          .insert(sessionAssistants)
          .values({
            sessionId,
            userId: ta.userId,
            role: 'assistant',
            isAutoAssigned: true,
          })
          .onConflictDoNothing({
            target: [sessionAssistants.sessionId, sessionAssistants.userId],
          });
      } catch (err) {
        this.logger.warn(
          `Failed to propagate TA ${ta.userId} to session ${sessionId}`,
          err,
        );
      }
    }
  }

  /**
   * Propagate a single TA to all existing sessions of a course.
   */
  private async propagateToAllSessions(
    courseId: string,
    userId: string,
    assignedBy: string,
  ) {
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
            assignedBy,
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
   * Send TA assignment email for a course.
   */
  private async sendAssignmentEmail(
    userId: string,
    course: { id: string; title: string; instructorId: string },
  ) {
    try {
      const taUser = await this.getUser(userId);
      const instructor = await this.getUser(course.instructorId);

      if (taUser && instructor) {
        await this.emailService.sendTaAssignment(taUser.email, {
          recipientName: `${taUser.firstName} ${taUser.lastName}`,
          sessionTitle: `All sessions - ${course.title}`,
          courseName: course.title,
          scheduledAt: new Date().toISOString(),
          durationMinutes: 0,
          instructorName: `${instructor.firstName} ${instructor.lastName}`,
          isAutoAssigned: false,
        });
      }
    } catch (err) {
      this.logger.warn('Failed to send TA assignment email', err);
    }
  }

  /**
   * Get all courses assigned to a specific TA (for TA dashboard).
   */
  async getMyCourses(userId: string) {
    const data = await db
      .select({
        id: courseAssistants.id,
        courseId: courseAssistants.courseId,
        status: courseAssistants.status,
        priority: courseAssistants.priority,
        assignedAt: courseAssistants.assignedAt,
        approvedAt: courseAssistants.approvedAt,
        deactivationScheduledAt: courseAssistants.deactivationScheduledAt,
        courseTitle: courses.title,
        courseStatus: courses.status,
        instructorId: courses.instructorId,
        instructorFirstName: users.firstName,
        instructorLastName: users.lastName,
      })
      .from(courseAssistants)
      .innerJoin(courses, eq(courseAssistants.courseId, courses.id))
      .leftJoin(users, eq(courses.instructorId, users.id))
      .where(eq(courseAssistants.userId, userId));

    return data;
  }

  /**
   * List users with the TEACHING_ASSISTANT role available for assignment.
   * When a valid courseId is provided, excludes TAs already assigned to that course (any status).
   */
  async listAvailableTAs(courseId?: string) {
    const tas = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .innerJoin(userRoles, eq(users.id, userRoles.userId))
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(
          eq(roles.name, ROLE_NAMES.TEACHING_ASSISTANT),
          eq(users.isActive, true),
        ),
      );

    // Filter out TAs already assigned to this course (exclude rejected — they can be re-suggested)
    if (courseId && courseId !== '_') {
      const assigned = await db
        .select({ userId: courseAssistants.userId })
        .from(courseAssistants)
        .where(
          and(
            eq(courseAssistants.courseId, courseId),
            sql`${courseAssistants.status} != 'rejected'`,
          ),
        );

      const assignedIds = new Set(assigned.map((a) => a.userId));
      return tas.filter((ta) => !assignedIds.has(ta.id));
    }

    return tas;
  }
}
