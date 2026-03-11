import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../../database';
import {
  courseAssistants,
  sessionAssistants,
  sessions,
  courses,
  users,
  userRoles,
  roles,
  ROLE_NAMES,
  NELC_EVENT_TYPE,
} from '../../database/schema';
import { NelcAuditService } from '../nelc-audit/nelc-audit.service';
import { EmailService } from '../email/email.service';
import { UserNotificationsService } from '../user-notifications/user-notifications.service';

@Injectable()
export class CourseAssistantsService {
  private readonly logger = new Logger(CourseAssistantsService.name);

  constructor(
    private readonly auditService: NelcAuditService,
    private readonly emailService: EmailService,
    private readonly notificationsService: UserNotificationsService,
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
   * Get all user IDs with MANAGER role (for notifications).
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
   * Manager/Admin directly assigns a TA to a course (status = 'approved').
   * Auto-propagates to all existing sessions.
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

    const [assignment] = await db
      .insert(courseAssistants)
      .values({
        courseId,
        userId,
        status: 'approved',
        approvedBy: assignedBy,
        approvedAt: new Date(),
      })
      .returning();

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

    // Email TA
    await this.sendAssignmentEmail(userId, course);

    // Notify course instructor in-app
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

    return assignment;
  }

  /**
   * Instructor suggests a TA (status = 'suggested'). Managers get notified.
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

    // Notify all managers
    const managerIds = await this.getManagerIds();
    const suggester = await this.getUser(suggestedBy);
    const taUser = await this.getUser(userId);

    if (managerIds.length > 0) {
      await this.notificationsService.createBulk(managerIds, {
        type: 'ta_suggestion',
        title: 'TA Suggestion',
        message: `${suggester?.firstName || 'Instructor'} ${suggester?.lastName || ''} suggested TA ${taUser?.firstName || ''} ${taUser?.lastName || ''} for Course "${course.title}"`,
        link: `/dashboard/manager/courses/${courseId}`,
        entityType: 'course',
        entityId: courseId,
      });
    }

    return suggestion;
  }

  /**
   * Manager/Admin approves a suggestion. Propagates to sessions, emails TA.
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

    const [updated] = await db
      .update(courseAssistants)
      .set({
        status: 'approved',
        approvedBy,
        approvedAt: new Date(),
      })
      .where(eq(courseAssistants.id, existing.id))
      .returning();

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
        message: `Your TA suggestion for ${taUser?.firstName || ''} ${taUser?.lastName || ''} on "${course.title}" was approved`,
        link: `/dashboard/instructor/courses/${courseId}`,
        entityType: 'course',
        entityId: courseId,
      });
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
   */
  async removeTA(courseId: string, userId: string) {
    const [deleted] = await db
      .delete(courseAssistants)
      .where(
        and(
          eq(courseAssistants.courseId, courseId),
          eq(courseAssistants.userId, userId),
        ),
      )
      .returning();

    if (!deleted) {
      throw new NotFoundException('Course assistant not found');
    }

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

    // Audit log
    await this.auditService.log({
      eventType: NELC_EVENT_TYPE.ASSISTANT_DEALLOCATED,
      entityType: 'course',
      entityId: courseId,
      userId,
      metadata: { assistantId: userId, courseId },
    });

    return { message: 'Teaching assistant removed from course and all sessions' };
  }

  /**
   * Get all TAs for a course with user info and status.
   */
  async getCourseTAs(courseId: string) {
    const data = await db
      .select({
        id: courseAssistants.id,
        courseId: courseAssistants.courseId,
        userId: courseAssistants.userId,
        status: courseAssistants.status,
        assignedAt: courseAssistants.assignedAt,
        approvedAt: courseAssistants.approvedAt,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(courseAssistants)
      .innerJoin(users, eq(courseAssistants.userId, users.id))
      .where(eq(courseAssistants.courseId, courseId));

    return data;
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
          sessionTitle: `All sessions — ${course.title}`,
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
}
