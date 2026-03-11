import {
  Injectable,
  NotFoundException,
  BadRequestException,
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
import { ThresholdEvaluationService } from './threshold-evaluation.service';

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
      .select({ id: courseAssistants.id })
      .from(courseAssistants)
      .where(
        and(
          eq(courseAssistants.courseId, courseId),
          eq(courseAssistants.userId, userId),
        ),
      )
      .limit(1);

    if (existing) {
      throw new BadRequestException(
        'User is already assigned to this course',
      );
    }

    // Calculate threshold-based status (EC-1, EC-2)
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

    // Determine if this TA should be immediately activated or pre-assigned
    const shouldActivate = currentActive < requiredTAs;
    const status = shouldActivate ? 'approved' : 'pre_assigned';

    const [assignment] = await db
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
          link: `/dashboard/ta`,
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
    await this.verifyTARole(userId);

    // Check not already assigned
    const [existing] = await db
      .select({ id: courseAssistants.id })
      .from(courseAssistants)
      .where(
        and(
          eq(courseAssistants.courseId, courseId),
          eq(courseAssistants.userId, userId),
        ),
      )
      .limit(1);

    if (existing) {
      throw new BadRequestException(
        'User is already assigned or suggested for this course',
      );
    }

    const [suggestion] = await db
      .insert(courseAssistants)
      .values({
        courseId,
        userId,
        status: 'suggested',
        suggestedBy,
      })
      .returning();

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

    if (existing.status === 'approved') {
      throw new BadRequestException('TA is already approved');
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

    const [updated] = await db
      .update(courseAssistants)
      .set({
        status: newStatus,
        priority,
        approvedBy: shouldActivate ? approvedBy : null,
        approvedAt: shouldActivate ? new Date() : null,
        assignedBy: approvedBy,
      })
      .where(eq(courseAssistants.id, existing.id))
      .returning();

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
      if (existing.suggestedBy) {
        const taUser = await this.getUser(userId);
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
    }

    return updated;
  }

  /**
   * Manager/Admin rejects a suggestion. Notifies the instructor.
   */
  async rejectTA(courseId: string, userId: string) {
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

    const [updated] = await db
      .update(courseAssistants)
      .set({ status: 'rejected' })
      .where(eq(courseAssistants.id, existing.id))
      .returning();

    // Notify the suggesting instructor
    if (existing.suggestedBy) {
      const taUser = await this.getUser(userId);
      await this.notificationsService.create({
        recipientId: existing.suggestedBy,
        type: 'ta_suggestion_rejected',
        title: 'TA Suggestion Rejected',
        message: `Your TA suggestion for ${taUser?.firstName || ''} ${taUser?.lastName || ''} on "${course.title}" was rejected`,
        link: `/dashboard/instructor/courses/${courseId}`,
        entityType: 'course',
        entityId: courseId,
      });
    }

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
        low: 1, // Testing values
        mid: 3,
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
   * List all users with the TEACHING_ASSISTANT role (for assignment dropdown).
   */
  async listAvailableTAs() {
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
    return tas;
  }
}
