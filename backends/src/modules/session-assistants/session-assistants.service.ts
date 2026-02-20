import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, and, count, ne, notInArray } from 'drizzle-orm';
import { db } from '../../database';
import {
  sessionAssistants,
  sessions,
  enrollments,
  users,
  NELC_EVENT_TYPE,
} from '../../database/schema';
import { NelcAuditService } from '../nelc-audit/nelc-audit.service';

// NELC allocation rules
const ASSISTANT_THRESHOLDS = {
  LOW: 25,   // ≤25: no assistant needed
  MID: 35,   // 26-35: 1 assistant
  // >35: 2 assistants
} as const;

@Injectable()
export class SessionAssistantsService {
  private readonly logger = new Logger(SessionAssistantsService.name);

  constructor(private readonly auditService: NelcAuditService) {}

  /**
   * Calculate how many assistants are required based on NELC rules.
   */
  calculateRequiredAssistants(enrolledCount: number): number {
    if (enrolledCount > ASSISTANT_THRESHOLDS.MID) return 2;
    if (enrolledCount > ASSISTANT_THRESHOLDS.LOW) return 1;
    return 0;
  }

  /**
   * Check and auto-allocate assistants for a session based on enrollment count.
   */
  async checkAndAllocate(sessionId: string): Promise<void> {
    // 1. Get session and its course
    const [session] = await db
      .select({
        id: sessions.id,
        courseId: sessions.courseId,
        instructorId: sessions.instructorId,
        scheduledAt: sessions.scheduledAt,
      })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session) return;

    // 2. Count active enrollments for the course
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

    // 3. Calculate required assistants
    const required = this.calculateRequiredAssistants(enrolledCount);
    if (required === 0) return;

    // 4. Count current assistants for this session
    const [currentCount] = await db
      .select({ count: count() })
      .from(sessionAssistants)
      .where(eq(sessionAssistants.sessionId, sessionId));
    const currentAssistants = Number(currentCount?.count || 0);

    const deficit = required - currentAssistants;
    if (deficit <= 0) return;

    // 5. Find available instructors (not the session's main instructor, not already assigned)
    const assignedUserIds = await db
      .select({ userId: sessionAssistants.userId })
      .from(sessionAssistants)
      .where(eq(sessionAssistants.sessionId, sessionId));

    const excludeIds = [
      session.instructorId,
      ...assignedUserIds.map((a) => a.userId),
    ];

    const availableInstructors = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.activeRole, 'INSTRUCTOR'),
          eq(users.isActive, true),
          excludeIds.length > 0
            ? notInArray(users.id, excludeIds)
            : undefined,
        ),
      )
      .limit(deficit);

    // 6. Auto-assign available instructors
    for (const instructor of availableInstructors) {
      await db.insert(sessionAssistants).values({
        sessionId,
        userId: instructor.id,
        role: 'assistant',
        isAutoAssigned: true,
      });

      await this.auditService.log({
        eventType: NELC_EVENT_TYPE.ASSISTANT_ALLOCATED,
        entityType: 'session',
        entityId: sessionId,
        userId: instructor.id,
        metadata: {
          assistantId: instructor.id,
          sessionId,
          reason: 'auto',
          enrolledCount,
          required,
        },
      });

      this.logger.log(
        `Auto-assigned instructor ${instructor.id} to session ${sessionId}`,
      );
    }
  }

  /**
   * Manually assign an assistant to a session.
   */
  async manualAssign(
    sessionId: string,
    userId: string,
    role: string,
    assignedBy: string,
  ) {
    // Verify session exists
    const [session] = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session) {
      throw new NotFoundException('Session not found');
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
}
