import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, and, count, notInArray } from 'drizzle-orm';
import { db } from '../../database';
import {
  sessionAssistants,
  sessions,
  courses,
  enrollments,
  users,
  userRoles,
  roles,
  NELC_EVENT_TYPE,
} from '../../database/schema';
import { NelcAuditService } from '../nelc-audit/nelc-audit.service';
import { EmailService } from '../email/email.service';

// NELC allocation rules (for reference — auto-allocation is disabled per client request)
// NOTE: Thresholds lowered for testing (production: LOW=25, MID=35)
const ASSISTANT_THRESHOLDS = {
  LOW: 1,    // ≤1: no assistant needed
  MID: 3,    // 2-3: 1 assistant
  // >3: 2 assistants
} as const;

@Injectable()
export class SessionAssistantsService {
  private readonly logger = new Logger(SessionAssistantsService.name);

  constructor(
    private readonly auditService: NelcAuditService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Calculate how many assistants are required based on NELC rules.
   */
  calculateRequiredAssistants(enrolledCount: number): number {
    if (enrolledCount > ASSISTANT_THRESHOLDS.MID) return 2;
    if (enrolledCount > ASSISTANT_THRESHOLDS.LOW) return 1;
    return 0;
  }

  /**
   * Check TA requirements for a session based on enrollment count.
   * Auto-allocation is disabled per client request.
   * Returns the deficit so the UI can display a warning.
   */
  async checkAndAllocate(sessionId: string): Promise<void> {
    const [session] = await db
      .select({
        id: sessions.id,
        courseId: sessions.courseId,
      })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session) return;

    // Count active enrollments for the course
    const [enrollmentCount] = await db
      .select({ count: count() })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, session.courseId),
          eq(enrollments.status, 'active'),
        ),
      );
    const enrolledCount = Number(enrollmentCount?.count || 0);
    const required = this.calculateRequiredAssistants(enrolledCount);

    if (required === 0) return;

    // Count current assistants for this session
    const [currentCount] = await db
      .select({ count: count() })
      .from(sessionAssistants)
      .where(eq(sessionAssistants.sessionId, sessionId));
    const currentAssistants = Number(currentCount?.count || 0);
    const deficit = required - currentAssistants;

    if (deficit > 0) {
      this.logger.warn(
        `Session ${sessionId} needs ${deficit} more TA(s) (${enrolledCount} enrolled, ${required} required, ${currentAssistants} assigned). ` +
          'Auto-allocation is disabled — please assign TAs manually.',
      );
    }
  }

  /**
   * Manually assign a Teaching Assistant to a session.
   * Only users with the TEACHING_ASSISTANT role can be assigned.
   */
  async manualAssign(
    sessionId: string,
    userId: string,
    role: string,
    assignedBy: string,
  ) {
    // Verify session exists
    const [session] = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        courseId: sessions.courseId,
        instructorId: sessions.instructorId,
        scheduledAt: sessions.scheduledAt,
        durationMinutes: sessions.durationMinutes,
      })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    // Verify user has TEACHING_ASSISTANT role
    const [taRole] = await db
      .select({ roleId: roles.id })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(roles.name, 'TEACHING_ASSISTANT'),
        ),
      )
      .limit(1);

    if (!taRole) {
      throw new BadRequestException(
        'User does not have the Teaching Assistant role. Only users with the TEACHING_ASSISTANT role can be assigned as TAs.',
      );
    }

    // Check not already assigned
    const [existing] = await db
      .select({ id: sessionAssistants.id })
      .from(sessionAssistants)
      .where(
        and(
          eq(sessionAssistants.sessionId, sessionId),
          eq(sessionAssistants.userId, userId),
        ),
      )
      .limit(1);

    if (existing) {
      throw new BadRequestException('User is already assigned to this session');
    }

    const [assistant] = await db
      .insert(sessionAssistants)
      .values({
        sessionId,
        userId,
        role,
        assignedBy,
        isAutoAssigned: false,
      })
      .returning();

    await this.auditService.log({
      eventType: NELC_EVENT_TYPE.ASSISTANT_ALLOCATED,
      entityType: 'session',
      entityId: sessionId,
      userId,
      metadata: {
        assistantId: userId,
        sessionId,
        role,
        reason: 'manual',
        assignedBy,
      },
    });

    // Send TA assignment email
    try {
      const [courseData] = await db
        .select({ courseName: courses.title })
        .from(courses)
        .where(eq(courses.id, session.courseId))
        .limit(1);

      const [instructorData] = await db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, session.instructorId))
        .limit(1);

      const [taUser] = await db
        .select({ email: users.email, firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (courseData && instructorData && taUser) {
        this.emailService
          .sendTaAssignment(taUser.email, {
            recipientName: `${taUser.firstName} ${taUser.lastName}`,
            sessionTitle: session.title,
            courseName: courseData.courseName,
            scheduledAt: session.scheduledAt.toISOString(),
            durationMinutes: session.durationMinutes,
            instructorName: `${instructorData.firstName} ${instructorData.lastName}`,
            isAutoAssigned: false,
          })
          .catch((err) =>
            this.logger.warn(`Failed to send TA email to ${taUser.email}`, err),
          );
      }
    } catch (err) {
      this.logger.warn('Failed to send TA assignment email', err);
    }

    return assistant;
  }

  /**
   * Remove an assistant from a session.
   */
  async remove(sessionId: string, userId: string) {
    const [deleted] = await db
      .delete(sessionAssistants)
      .where(
        and(
          eq(sessionAssistants.sessionId, sessionId),
          eq(sessionAssistants.userId, userId),
        ),
      )
      .returning();

    if (!deleted) {
      throw new NotFoundException('Assistant assignment not found');
    }

    await this.auditService.log({
      eventType: NELC_EVENT_TYPE.ASSISTANT_DEALLOCATED,
      entityType: 'session',
      entityId: sessionId,
      userId,
      metadata: { assistantId: userId, sessionId },
    });

    return { message: 'Assistant removed successfully' };
  }

  /**
   * Get all assistants assigned to a session.
   */
  async getAssistants(sessionId: string) {
    const data = await db
      .select({
        id: sessionAssistants.id,
        sessionId: sessionAssistants.sessionId,
        userId: sessionAssistants.userId,
        role: sessionAssistants.role,
        assignedAt: sessionAssistants.assignedAt,
        isAutoAssigned: sessionAssistants.isAutoAssigned,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(sessionAssistants)
      .innerJoin(users, eq(sessionAssistants.userId, users.id))
      .where(eq(sessionAssistants.sessionId, sessionId));

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
          eq(roles.name, 'TEACHING_ASSISTANT'),
          eq(users.isActive, true),
        ),
      );

    return tas;
  }
}
