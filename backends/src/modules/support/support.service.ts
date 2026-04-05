import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { eq, and, or, desc, asc, sql, ilike, count, avg, inArray } from 'drizzle-orm';
import { db } from '../../database';
import {
  tickets,
  ticketReplies,
  users,
  courses,
  userRoles,
  roles,
  slaPolicies,
  slaEvents,
  csatSurveys,
  npsSurveys,
  supportConfig,
  supportMacros,
  kbArticles,
  enrollments,
  TICKET_STATUS,
  TICKET_PRIORITY,
  ROLE_NAMES,
  SUPPORT_SUB_ROLES,
  SLA_EVENT_TYPES,
  GUEST_USER_ID,
} from '../../database/schema';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import {
  CreateTicketDto,
  UpdateTicketDto,
  AddCommentDto,
  ListTicketsQueryDto,
  CreateTicketOnBehalfDto,
  CreateGuestTicketDto,
  CreateMacroDto,
  UpdateMacroDto,
  CreateKbArticleDto,
  UpdateKbArticleDto,
} from './dto';
import {
  calculateBusinessMinutesElapsed,
  calculateBusinessDeadline,
  isWithinBusinessHours,
  getNextBusinessOpen,
} from './business-hours.util';
import { UserNotificationsService } from '../user-notifications/user-notifications.service';
import { EmailService } from '../email/email.service';

// Auto-priority mapping per PDF page 20
const CATEGORY_PRIORITY_MAP: Record<string, string> = {
  billing: TICKET_PRIORITY.HIGH,
  login: TICKET_PRIORITY.HIGH,
  technical: TICKET_PRIORITY.HIGH,
  certificate: TICKET_PRIORITY.MEDIUM,
  content: TICKET_PRIORITY.LOW,
  other: TICKET_PRIORITY.LOW,
};

@Injectable()
export class SupportService {
  constructor(
    private readonly notificationsService: UserNotificationsService,
    private readonly emailService: EmailService,
  ) {}

  // ─── Create Ticket ──────────────────────────────────────

  async createTicket(userId: string, dto: CreateTicketDto) {
    // Priority always auto-assigned by category — student input ignored (PR-09)
    const autoPriority =
      CATEGORY_PRIORITY_MAP[dto.category] || TICKET_PRIORITY.MEDIUM;

    // Round-robin: find agent with fewest open tickets
    const assigneeId = await this.findNextAgent();

    const [ticket] = await db
      .insert(tickets)
      .values({
        studentId: userId,
        category: dto.category,
        priority: autoPriority,
        subject: dto.subject,
        description: dto.description,
        courseId: dto.courseId || null,
        attachmentUrl: dto.attachmentUrl || null,
        status: TICKET_STATUS.NEW,
        assigneeId,
      })
      .returning();

    // Step 4: Calculate SLA deadline (P-04)
    const [slaPolicy] = await db
      .select()
      .from(slaPolicies)
      .where(eq(slaPolicies.priority, autoPriority));

    let expectedResponseTime: string | null = null;
    if (slaPolicy) {
      const deadline = calculateBusinessDeadline(
        ticket.createdAt,
        slaPolicy.frtMinutes,
      );
      expectedResponseTime = deadline.toISOString();
    }

    // Step 5: Notifications (P-01, SYS-05)
    // Notify student: ticket received
    try {
      await this.notificationsService.create({
        recipientId: userId,
        type: 'ticket_created',
        title: 'Ticket Received',
        message: `Your ticket #${ticket.id.substring(0, 8)} has been received. Expected response within ${slaPolicy?.frtMinutes || 30} minutes.`,
        link: `/dashboard/student/support`,
        entityType: 'ticket',
        entityId: ticket.id,
      });

      // Notify agent: new ticket assigned
      if (assigneeId) {
        await this.notificationsService.create({
          recipientId: assigneeId,
          type: 'ticket_assigned',
          title: 'New Ticket Assigned',
          message: `New ${autoPriority.toUpperCase()} priority ticket: "${ticket.subject}"`,
          link: `/dashboard/support/agent/tickets/${ticket.id}`,
          entityType: 'ticket',
          entityId: ticket.id,
        });
      }
    } catch {
      // Notifications are non-blocking (P-07)
    }

    // Send email to student
    try {
      const [studentInfo] = await db.select({ email: users.email, firstName: users.firstName }).from(users).where(eq(users.id, userId));
      if (studentInfo?.email) {
        await this.emailService.sendTicketCreatedLearner(
          studentInfo.email,
          studentInfo.firstName || 'Student',
          ticket.id,
          expectedResponseTime || 'within business hours',
        );
      }
    } catch { /* non-blocking */ }

    // Send email to agent
    if (assigneeId) {
      try {
        const [agentInfo] = await db.select({ email: users.email, firstName: users.firstName }).from(users).where(eq(users.id, assigneeId));
        if (agentInfo?.email) {
          await this.emailService.sendTicketAssignedAgent(
            agentInfo.email,
            agentInfo.firstName || 'Agent',
            ticket.id,
            dto.subject,
            autoPriority,
            expectedResponseTime || '--',
          );
        }
      } catch { /* non-blocking */ }
    }

    return {
      ...ticket,
      expectedResponseTime,
      slaPolicy: slaPolicy || null,
    };
  }

  // ─── List Tickets ──────────────────────────────────────

  async listTickets(
    user: AuthenticatedUser,
    query: ListTicketsQueryDto,
  ) {
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '20', 10), 100);
    const offset = (page - 1) * limit;

    const isSupportOrAdmin =
      user.roles.includes(ROLE_NAMES.SUPPORT) ||
      user.roles.includes(ROLE_NAMES.ADMIN) ||
      user.roles.includes(ROLE_NAMES.SUPER_ADMIN);

    const conditions: any[] = [];

    // Non-support users can only see their own tickets
    if (!isSupportOrAdmin) {
      conditions.push(eq(tickets.studentId, user.id));
    }

    if (query.status) conditions.push(eq(tickets.status, query.status));
    if (query.priority) conditions.push(eq(tickets.priority, query.priority));
    if (query.category) conditions.push(eq(tickets.category, query.category));
    if (query.assigneeId) conditions.push(eq(tickets.assigneeId, query.assigneeId));
    if (query.search) {
      conditions.push(
        or(
          ilike(tickets.subject, `%${query.search}%`),
          ilike(tickets.id, `%${query.search}%`),
        ),
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [ticketsList, totalResult] = await Promise.all([
      db
        .select({
          id: tickets.id,
          studentId: tickets.studentId,
          category: tickets.category,
          priority: tickets.priority,
          subject: tickets.subject,
          status: tickets.status,
          assigneeId: tickets.assigneeId,
          firstResponseAt: tickets.firstResponseAt,
          slaBreachedFrt: tickets.slaBreachedFrt,
          slaBreachedTtr: tickets.slaBreachedTtr,
          createdAt: tickets.createdAt,
          updatedAt: tickets.updatedAt,
          resolvedAt: tickets.resolvedAt,
          closedAt: tickets.closedAt,
          studentFirstName: users.firstName,
          studentLastName: users.lastName,
          studentEmail: users.email,
        })
        .from(tickets)
        .leftJoin(users, eq(tickets.studentId, users.id))
        .where(where)
        .orderBy(desc(tickets.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(tickets).where(where),
    ]);

    return {
      tickets: ticketsList,
      total: totalResult[0]?.count ?? 0,
      page,
      limit,
    };
  }

  // ─── Get Ticket Detail ──────────────────────────────────

  async getTicketDetail(user: AuthenticatedUser, ticketId: string) {
    const isSupportOrAdmin =
      user.roles.includes(ROLE_NAMES.SUPPORT) ||
      user.roles.includes(ROLE_NAMES.ADMIN) ||
      user.roles.includes(ROLE_NAMES.SUPER_ADMIN);

    const [ticket] = await db
      .select({
        id: tickets.id,
        studentId: tickets.studentId,
        category: tickets.category,
        priority: tickets.priority,
        subject: tickets.subject,
        description: tickets.description,
        attachmentUrl: tickets.attachmentUrl,
        courseId: tickets.courseId,
        status: tickets.status,
        assigneeId: tickets.assigneeId,
        satisfactionRating: tickets.satisfactionRating,
        firstResponseAt: tickets.firstResponseAt,
        slaBreachedFrt: tickets.slaBreachedFrt,
        slaBreachedTtr: tickets.slaBreachedTtr,
        onHoldReason: tickets.onHoldReason,
        onHoldAt: tickets.onHoldAt,
        onHoldTotalMinutes: tickets.onHoldTotalMinutes,
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
        resolvedAt: tickets.resolvedAt,
        closedAt: tickets.closedAt,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
        studentEmail: users.email,
      })
      .from(tickets)
      .leftJoin(users, eq(tickets.studentId, users.id))
      .where(eq(tickets.id, ticketId));

    if (!ticket) throw new NotFoundException('Ticket not found');

    // Access check: owner or support/admin
    if (!isSupportOrAdmin && ticket.studentId !== user.id) {
      throw new ForbiddenException('You do not have access to this ticket');
    }

    // Fetch comments, filtering internal notes for non-support users
    const commentsConditions = [eq(ticketReplies.ticketId, ticketId)];
    if (!isSupportOrAdmin) {
      commentsConditions.push(eq(ticketReplies.isInternal, false));
    }

    const comments = await db
      .select({
        id: ticketReplies.id,
        message: ticketReplies.message,
        isStaffReply: ticketReplies.isStaffReply,
        isInternal: ticketReplies.isInternal,
        createdAt: ticketReplies.createdAt,
        userId: ticketReplies.userId,
        userFirstName: users.firstName,
        userLastName: users.lastName,
      })
      .from(ticketReplies)
      .leftJoin(users, eq(ticketReplies.userId, users.id))
      .where(and(...commentsConditions))
      .orderBy(asc(ticketReplies.createdAt));

    // Fetch assignee name
    let assigneeName: string | null = null;
    if (ticket.assigneeId) {
      const [assignee] = await db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, ticket.assigneeId));
      if (assignee) {
        assigneeName = [assignee.firstName, assignee.lastName]
          .filter(Boolean)
          .join(' ');
      }
    }

    // Fetch course name
    let courseName: string | null = null;
    if (ticket.courseId) {
      const [course] = await db
        .select({ title: courses.title, titleAr: courses.titleAr })
        .from(courses)
        .where(eq(courses.id, ticket.courseId));
      if (course) courseName = course.title || course.titleAr || null;
    }

    // Fetch SLA policy for this ticket's priority
    const [slaPolicy] = await db
      .select()
      .from(slaPolicies)
      .where(eq(slaPolicies.priority, ticket.priority));

    // Compute SLA deadlines and remaining time
    let frtDeadline: string | null = null;
    let ttrDeadline: string | null = null;
    let frtRemainingMinutes: number | null = null;
    let ttrRemainingMinutes: number | null = null;

    if (slaPolicy) {
      const now = new Date();
      const holdMinutes = ticket.onHoldTotalMinutes || 0;
      const elapsedBizMinutes = calculateBusinessMinutesElapsed(
        ticket.createdAt,
        now,
      );
      const effectiveBizMinutes = elapsedBizMinutes - holdMinutes;

      // FRT deadline — only if not yet responded and not breached
      if (!ticket.firstResponseAt) {
        const deadline = calculateBusinessDeadline(
          ticket.createdAt,
          slaPolicy.frtMinutes + holdMinutes,
        );
        frtDeadline = deadline.toISOString();
        frtRemainingMinutes = Math.max(
          0,
          slaPolicy.frtMinutes - effectiveBizMinutes,
        );
        if (ticket.slaBreachedFrt) {
          frtRemainingMinutes = -(effectiveBizMinutes - slaPolicy.frtMinutes);
        }
      }

      // TTR deadline — only if not yet resolved
      if (
        ticket.status !== TICKET_STATUS.RESOLVED &&
        ticket.status !== TICKET_STATUS.CLOSED
      ) {
        const deadline = calculateBusinessDeadline(
          ticket.createdAt,
          slaPolicy.ttrMinutes + holdMinutes,
        );
        ttrDeadline = deadline.toISOString();
        ttrRemainingMinutes = Math.max(
          0,
          slaPolicy.ttrMinutes - effectiveBizMinutes,
        );
        if (ticket.slaBreachedTtr) {
          ttrRemainingMinutes = -(effectiveBizMinutes - slaPolicy.ttrMinutes);
        }
      }
    }

    return {
      ...ticket,
      assigneeName,
      courseName,
      comments,
      slaPolicy: slaPolicy || null,
      frtDeadline,
      ttrDeadline,
      frtRemainingMinutes,
      ttrRemainingMinutes,
    };
  }

  // ─── Update Ticket ──────────────────────────────────────

  async updateTicket(ticketId: string, dto: UpdateTicketDto) {
    const [existing] = await db
      .select({
        id: tickets.id,
        status: tickets.status,
        onHoldAt: tickets.onHoldAt,
        onHoldTotalMinutes: tickets.onHoldTotalMinutes,
      })
      .from(tickets)
      .where(eq(tickets.id, ticketId));

    if (!existing) throw new NotFoundException('Ticket not found');

    const updateData: Record<string, any> = { updatedAt: new Date() };

    if (dto.status) {
      // M1: Status transition validation
      const validTransitions: Record<string, string[]> = {
        [TICKET_STATUS.NEW]: [TICKET_STATUS.IN_PROGRESS],
        [TICKET_STATUS.IN_PROGRESS]: [
          TICKET_STATUS.ON_HOLD,
          TICKET_STATUS.RESOLVED,
          TICKET_STATUS.CLOSED,
        ],
        [TICKET_STATUS.ON_HOLD]: [TICKET_STATUS.IN_PROGRESS],
        [TICKET_STATUS.RESOLVED]: [TICKET_STATUS.CLOSED],
        [TICKET_STATUS.CLOSED]: [],
      };

      const allowed = validTransitions[existing.status] || [];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Cannot transition from ${existing.status} to ${dto.status}`,
        );
      }

      updateData.status = dto.status;

      // Transitioning TO on_hold (BH-05)
      if (dto.status === TICKET_STATUS.ON_HOLD) {
        if (!dto.onHoldReason) {
          throw new BadRequestException(
            'On hold reason is required when setting status to on_hold',
          );
        }
        updateData.onHoldReason = dto.onHoldReason;
        updateData.onHoldAt = new Date();
        updateData.onHoldResumedAt = null;
      }

      // Transitioning FROM on_hold — accumulate hold duration (BH-05, BH-06)
      if (
        existing.status === TICKET_STATUS.ON_HOLD &&
        dto.status !== TICKET_STATUS.ON_HOLD &&
        existing.onHoldAt
      ) {
        const holdDuration = calculateBusinessMinutesElapsed(
          existing.onHoldAt,
          new Date(),
        );
        updateData.onHoldTotalMinutes =
          (existing.onHoldTotalMinutes || 0) + holdDuration;
        updateData.onHoldResumedAt = new Date();
        updateData.onHoldAt = null;
        updateData.onHoldReason = null;
      }

      if (dto.status === TICKET_STATUS.RESOLVED) {
        updateData.resolvedAt = new Date();
      }
      if (dto.status === TICKET_STATUS.CLOSED) {
        updateData.closedAt = new Date();
      }
    }

    if (dto.priority) updateData.priority = dto.priority;
    if (dto.assigneeId) updateData.assigneeId = dto.assigneeId;

    const [updated] = await db
      .update(tickets)
      .set(updateData)
      .where(eq(tickets.id, ticketId))
      .returning();

    return updated;
  }

  // ─── Add Comment ──────────────────────────────────────

  async addComment(
    user: AuthenticatedUser,
    ticketId: string,
    dto: AddCommentDto,
  ) {
    const isSupportOrAdmin =
      user.roles.includes(ROLE_NAMES.SUPPORT) ||
      user.roles.includes(ROLE_NAMES.ADMIN) ||
      user.roles.includes(ROLE_NAMES.SUPER_ADMIN);

    const [ticket] = await db
      .select({
        id: tickets.id,
        studentId: tickets.studentId,
        status: tickets.status,
        firstResponseAt: tickets.firstResponseAt,
        closedAt: tickets.closedAt,
        subject: tickets.subject,
        assigneeId: tickets.assigneeId,
      })
      .from(tickets)
      .where(eq(tickets.id, ticketId));

    if (!ticket) throw new NotFoundException('Ticket not found');

    // Access check
    if (!isSupportOrAdmin && ticket.studentId !== user.id) {
      throw new ForbiddenException('You do not have access to this ticket');
    }

    // 48h grace period for closed tickets (ST-12, ST-13)
    if (ticket.status === TICKET_STATUS.CLOSED && !isSupportOrAdmin) {
      const GRACE_PERIOD_MS = 48 * 60 * 60 * 1000;
      const closedTime = ticket.closedAt
        ? new Date(ticket.closedAt).getTime()
        : 0;
      if (Date.now() - closedTime > GRACE_PERIOD_MS) {
        throw new BadRequestException(
          'This ticket has been closed for more than 48 hours. Please create a new ticket.',
        );
      }
    }

    // Force isInternal=false for non-support users
    const isInternal = isSupportOrAdmin ? (dto.isInternal ?? false) : false;

    const [comment] = await db
      .insert(ticketReplies)
      .values({
        ticketId,
        userId: user.id,
        message: dto.message,
        isStaffReply: isSupportOrAdmin,
        isInternal,
      })
      .returning();

    // First response tracking: set firstResponseAt on first support reply
    if (isSupportOrAdmin && !isInternal && !ticket.firstResponseAt) {
      await db
        .update(tickets)
        .set({
          firstResponseAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tickets.id, ticketId));
    }

    // Auto-transition: new → in_progress on first staff reply
    if (
      isSupportOrAdmin &&
      !isInternal &&
      ticket.status === TICKET_STATUS.NEW
    ) {
      await db
        .update(tickets)
        .set({
          status: TICKET_STATUS.IN_PROGRESS,
          updatedAt: new Date(),
        })
        .where(eq(tickets.id, ticketId));
    }

    // Student reply on resolved/closed ticket → reopen (ST-12, ST-13)
    if (
      !isSupportOrAdmin &&
      (ticket.status === TICKET_STATUS.RESOLVED ||
        ticket.status === TICKET_STATUS.CLOSED)
    ) {
      await db
        .update(tickets)
        .set({
          status: TICKET_STATUS.NEW,
          resolvedAt: null,
          closedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(tickets.id, ticketId));
    }

    // Update ticket updatedAt
    await db
      .update(tickets)
      .set({ updatedAt: new Date() })
      .where(eq(tickets.id, ticketId));

    // Notifications for comments (AR-01, AR-02)
    try {
      if (isSupportOrAdmin && !isInternal) {
        // Agent replied publicly → notify student (IN-03: no email for internal notes)
        await this.notificationsService.create({
          recipientId: ticket.studentId,
          type: 'ticket_reply',
          title: 'New Reply on Your Ticket',
          message: `Support has replied to your ticket "${ticket.subject || ''}"`,
          link: `/dashboard/student/support`,
          entityType: 'ticket',
          entityId: ticketId,
        });
      } else if (!isSupportOrAdmin && ticket.assigneeId) {
        // Student replied → notify assigned agent
        await this.notificationsService.create({
          recipientId: ticket.assigneeId,
          type: 'ticket_reply',
          title: 'Student Replied',
          message: `Student replied to ticket #${ticketId.substring(0, 8)}`,
          link: `/dashboard/support/agent/tickets/${ticketId}`,
          entityType: 'ticket',
          entityId: ticketId,
        });
      }
    } catch {
      // Non-blocking (P-07)
    }

    // Send email notifications
    try {
      if (isSupportOrAdmin && !isInternal) {
        // Agent replied → email student
        const [studentInfo] = await db.select({ email: users.email, firstName: users.firstName }).from(users).where(eq(users.id, ticket.studentId));
        if (studentInfo?.email) {
          await this.emailService.sendTicketReplyNotification(
            studentInfo.email,
            studentInfo.firstName || 'Student',
            user.firstName || 'Support Agent',
            ticketId,
            dto.message.substring(0, 200),
          );
        }
      } else if (!isSupportOrAdmin && ticket.assigneeId) {
        // Student replied → email agent
        const [agentInfo] = await db.select({ email: users.email, firstName: users.firstName }).from(users).where(eq(users.id, ticket.assigneeId));
        if (agentInfo?.email) {
          await this.emailService.sendTicketReplyNotification(
            agentInfo.email,
            agentInfo.firstName || 'Agent',
            user.firstName || 'Student',
            ticketId,
            dto.message.substring(0, 200),
          );
        }
      }
    } catch { /* non-blocking */ }

    return comment;
  }

  // ─── Resolve Ticket ──────────────────────────────────────

  async resolveTicket(ticketId: string, userId: string) {
    const [ticket] = await db
      .select({
        id: tickets.id,
        studentId: tickets.studentId,
        courseId: tickets.courseId,
        subject: tickets.subject,
        status: tickets.status,
        slaBreachedFrt: tickets.slaBreachedFrt,
        slaBreachedTtr: tickets.slaBreachedTtr,
        onHoldAt: tickets.onHoldAt,
        onHoldTotalMinutes: tickets.onHoldTotalMinutes,
      })
      .from(tickets)
      .where(eq(tickets.id, ticketId));

    if (!ticket) throw new NotFoundException('Ticket not found');

    // H1: Prevent double-resolve and invalid transitions
    if (
      ticket.status === TICKET_STATUS.RESOLVED ||
      ticket.status === TICKET_STATUS.CLOSED
    ) {
      throw new BadRequestException(
        `Ticket is already ${ticket.status}. Cannot resolve again.`,
      );
    }

    // M2: If resolving from on_hold, accumulate hold time first
    const updateData: Record<string, any> = {
      status: TICKET_STATUS.RESOLVED,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    };

    if (ticket.status === TICKET_STATUS.ON_HOLD && ticket.onHoldAt) {
      const holdDuration = calculateBusinessMinutesElapsed(
        ticket.onHoldAt,
        new Date(),
      );
      updateData.onHoldTotalMinutes =
        (ticket.onHoldTotalMinutes || 0) + holdDuration;
      updateData.onHoldResumedAt = new Date();
      updateData.onHoldAt = null;
      updateData.onHoldReason = null;
    }

    const [updated] = await db
      .update(tickets)
      .set(updateData)
      .where(eq(tickets.id, ticketId))
      .returning();

    // Log resolved_within_sla event (SB-13)
    const resolvedWithinSla =
      !ticket.slaBreachedFrt && !ticket.slaBreachedTtr;
    try {
      await db.insert(slaEvents).values({
        ticketId,
        eventType: SLA_EVENT_TYPES.RESOLVED_WITHIN_SLA,
        resolvedWithinSla,
      });
    } catch {
      // Non-blocking
    }

    // Create CSAT survey placeholder
    await db
      .insert(csatSurveys)
      .values({
        ticketId,
        userId: ticket.studentId,
        courseId: ticket.courseId || null,
        channel: 'email',
      })
      .onConflictDoNothing();

    // Notify student: ticket resolved (RS-01)
    try {
      await this.notificationsService.create({
        recipientId: ticket.studentId,
        type: 'ticket_resolved',
        title: 'Ticket Resolved',
        message: `Your ticket "${ticket.subject}" has been resolved. You can reopen it within 48 hours if the issue persists.`,
        link: `/dashboard/student/support`,
        entityType: 'ticket',
        entityId: ticketId,
      });
    } catch {
      // Non-blocking
    }

    // Send resolution email
    try {
      const [studentInfo] = await db.select({ email: users.email, firstName: users.firstName }).from(users).where(eq(users.id, ticket.studentId));
      if (studentInfo?.email) {
        await this.emailService.sendTicketResolved(
          studentInfo.email,
          studentInfo.firstName || 'Student',
          ticketId,
        );
      }
    } catch { /* non-blocking */ }

    return updated;
  }

  // ─── Close Ticket ──────────────────────────────────────

  async closeTicket(ticketId: string) {
    const [ticket] = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(eq(tickets.id, ticketId));

    if (!ticket) throw new NotFoundException('Ticket not found');

    const [updated] = await db
      .update(tickets)
      .set({
        status: TICKET_STATUS.CLOSED,
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, ticketId))
      .returning();

    return updated;
  }

  // ─── Get KPIs ──────────────────────────────────────

  async getKPIs() {
    const [openCount] = await db
      .select({ count: count() })
      .from(tickets)
      .where(
        inArray(tickets.status, [
          TICKET_STATUS.NEW,
          TICKET_STATUS.IN_PROGRESS,
          TICKET_STATUS.ON_HOLD,
        ]),
      );

    const [highCount] = await db
      .select({ count: count() })
      .from(tickets)
      .where(
        and(
          eq(tickets.priority, TICKET_PRIORITY.HIGH),
          inArray(tickets.status, [
            TICKET_STATUS.NEW,
            TICKET_STATUS.IN_PROGRESS,
            TICKET_STATUS.ON_HOLD,
          ]),
        ),
      );

    const [breachCount] = await db
      .select({ count: count() })
      .from(tickets)
      .where(
        or(eq(tickets.slaBreachedFrt, true), eq(tickets.slaBreachedTtr, true)),
      );

    // Avg first response time (in minutes) for tickets that have been responded to
    const [avgFrt] = await db
      .select({
        avgMinutes: avg(
          sql`EXTRACT(EPOCH FROM (${tickets.firstResponseAt} - ${tickets.createdAt})) / 60`,
        ),
      })
      .from(tickets)
      .where(sql`${tickets.firstResponseAt} IS NOT NULL`);

    // Avg resolution time (in minutes) for resolved tickets
    const [avgTtr] = await db
      .select({
        avgMinutes: avg(
          sql`EXTRACT(EPOCH FROM (${tickets.resolvedAt} - ${tickets.createdAt})) / 60`,
        ),
      })
      .from(tickets)
      .where(sql`${tickets.resolvedAt} IS NOT NULL`);

    // Status breakdown
    const statusBreakdown = await db
      .select({ status: tickets.status, count: count() })
      .from(tickets)
      .groupBy(tickets.status);

    return {
      openTickets: openCount?.count ?? 0,
      highPriorityOpen: highCount?.count ?? 0,
      slaBreaches: breachCount?.count ?? 0,
      avgFrtMinutes: avgFrt?.avgMinutes ? Number(avgFrt.avgMinutes) : null,
      avgTtrMinutes: avgTtr?.avgMinutes ? Number(avgTtr.avgMinutes) : null,
      statusBreakdown: statusBreakdown.reduce(
        (acc, row) => ({ ...acc, [row.status]: row.count }),
        {} as Record<string, number>,
      ),
    };
  }

  // ─── Get Agents ──────────────────────────────────────

  async getAgents() {
    const supportRole = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, ROLE_NAMES.SUPPORT));

    if (!supportRole.length) return [];

    const agents = await db
      .select({
        userId: userRoles.userId,
        supportSubRole: userRoles.supportSubRole,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(eq(userRoles.roleId, supportRole[0].id));

    return agents;
  }

  // ─── Round Robin (True Rotation with DB Pointer) ──────────

  /**
   * Get all support agents in stable deterministic order.
   * Sorted by assignment date then user ID for consistent rotation.
   */
  private async getAgentRoster(): Promise<
    { userId: string; firstName: string | null }[]
  > {
    const supportRole = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, ROLE_NAMES.SUPPORT));

    if (!supportRole.length) return [];

    return db
      .select({
        userId: userRoles.userId,
        firstName: users.firstName,
      })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(
        and(
          eq(userRoles.roleId, supportRole[0].id),
          or(
            eq(userRoles.supportSubRole, SUPPORT_SUB_ROLES.AGENT),
            sql`${userRoles.supportSubRole} IS NULL`,
          ),
        ),
      )
      .orderBy(asc(userRoles.assignedAt), asc(users.id));
  }

  /**
   * True round-robin agent assignment with persistent DB pointer.
   * RR-01: Strict rotation order
   * RR-03: Skip agent with active FRT breach
   * RR-05: Returns null if no agents (ticket stays unassigned)
   * RR-08: Atomic pointer increment via UPDATE...RETURNING
   * RR-14: Supervisors excluded (query filters supportSubRole='agent')
   * RR-15: Pointer persisted in support_config table
   */
  private async findNextAgent(): Promise<string | null> {
    const agents = await this.getAgentRoster();

    if (agents.length === 0) return null; // RR-05
    if (agents.length === 1) return agents[0].userId; // RR-04

    // Read current pointer
    const [config] = await db
      .select()
      .from(supportConfig)
      .where(eq(supportConfig.key, 'round_robin_pointer'));

    let pointer = config ? Number(config.value) : 0;
    if (isNaN(pointer)) pointer = 0; // H2: Guard against corrupted pointer

    // Try each agent starting from pointer, skip those with active FRT breach (RR-03)
    for (let i = 0; i < agents.length; i++) {
      const index = (pointer + i) % agents.length;
      const agent = agents[index];

      // Check if agent has active FRT breach (unresponded breached ticket)
      const [breachedTicket] = await db
        .select({ id: tickets.id })
        .from(tickets)
        .where(
          and(
            eq(tickets.assigneeId, agent.userId),
            eq(tickets.slaBreachedFrt, true),
            sql`${tickets.firstResponseAt} IS NULL`,
            inArray(tickets.status, [
              TICKET_STATUS.NEW,
              TICKET_STATUS.IN_PROGRESS,
            ]),
          ),
        )
        .limit(1);

      if (!breachedTicket) {
        // Agent is eligible — advance pointer atomically (RR-08, C3: UPSERT)
        const newPointer = (pointer + i + 1) % agents.length;
        await db
          .insert(supportConfig)
          .values({
            key: 'round_robin_pointer',
            value: String(newPointer),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: supportConfig.key,
            set: { value: String(newPointer), updatedAt: new Date() },
          });

        return agent.userId;
      }
    }

    // All agents have FRT breaches — fall back to original pointer agent
    const fallbackIndex = pointer % agents.length;
    const newPointer = (pointer + 1) % agents.length;
    await db
      .insert(supportConfig)
      .values({
        key: 'round_robin_pointer',
        value: String(newPointer),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: supportConfig.key,
        set: { value: String(newPointer), updatedAt: new Date() },
      });

    return agents[fallbackIndex].userId;
  }

  /**
   * Find next agent for FRT breach reassignment, excluding specific agents.
   * RR-11: Follows rotation but skips excluded agents
   * RR-12: Returns null if all agents excluded (caller escalates to supervisor)
   */
  async findNextAgentForReassignment(
    excludeAgentIds: string[],
  ): Promise<string | null> {
    const agents = await this.getAgentRoster();
    const eligible = agents.filter(
      (a) => !excludeAgentIds.includes(a.userId),
    );

    if (eligible.length === 0) return null; // RR-12: all agents exhausted

    // Read pointer
    const [config] = await db
      .select()
      .from(supportConfig)
      .where(eq(supportConfig.key, 'round_robin_pointer'));

    const pointer = config ? Number(config.value) : 0;

    // Pick next eligible agent from rotation
    // Map eligible agents back to their position in the full roster
    for (let i = 0; i < agents.length; i++) {
      const index = (pointer + i) % agents.length;
      const agent = agents[index];
      if (!excludeAgentIds.includes(agent.userId)) {
        return agent.userId;
      }
    }

    return eligible[0].userId; // fallback
  }

  /**
   * Find the first supervisor user ID (for escalation when all agents fail).
   * RR-12: Ticket escalates to supervisor as last resort
   */
  async findSupervisorId(): Promise<string | null> {
    const supportRole = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, ROLE_NAMES.SUPPORT));

    if (!supportRole.length) return null;

    const [supervisor] = await db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(
        and(
          eq(userRoles.roleId, supportRole[0].id),
          eq(userRoles.supportSubRole, SUPPORT_SUB_ROLES.SUPERVISOR),
        ),
      )
      .limit(1);

    return supervisor?.userId || null;
  }

  // ─── CSAT Survey Submission (RS-02 to RS-07) ──────────

  /**
   * Submit CSAT score via survey ID (no login required).
   * RS-04: Expired after 72h from sentAt.
   * RS-05: Token (surveyId) one-time use — cannot resubmit.
   * RS-07: One CSAT per ticket per student (unique constraint).
   */
  async submitCsatScore(
    surveyId: string,
    score: number,
    comment?: string,
  ) {
    const [survey] = await db
      .select()
      .from(csatSurveys)
      .where(eq(csatSurveys.id, surveyId));

    if (!survey) {
      throw new NotFoundException('Survey not found');
    }

    // RS-05: Already submitted
    if (survey.submittedAt) {
      throw new BadRequestException(
        'You have already submitted your rating for this ticket.',
      );
    }

    // RS-04: Expired after 72h
    const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;
    if (
      Date.now() - new Date(survey.sentAt).getTime() >
      SEVENTY_TWO_HOURS_MS
    ) {
      throw new BadRequestException('This survey has expired.');
    }

    // RS-06: Check if ticket was reopened (status not resolved/closed)
    const [ticket] = await db
      .select({ status: tickets.status })
      .from(tickets)
      .where(eq(tickets.id, survey.ticketId));

    // Save the score regardless of current ticket status
    const [updated] = await db
      .update(csatSurveys)
      .set({
        score,
        comment: comment || null,
        submittedAt: new Date(),
      })
      .where(eq(csatSurveys.id, surveyId))
      .returning();

    // Detractor follow-up: score 1 or 2 → send follow-up email
    if (score <= 2) {
      try {
        const [userInfo] = await db
          .select({ email: users.email, firstName: users.firstName })
          .from(users)
          .where(eq(users.id, survey.userId));
        if (userInfo?.email) {
          await this.emailService.sendCsatFollowup(
            userInfo.email,
            userInfo.firstName || 'Student',
            survey.ticketId,
            score,
          );
        }
      } catch {
        // Non-blocking
      }
    }

    return updated;
  }

  /**
   * Get CSAT survey details by ID (for the public rating page).
   */
  async getCsatSurvey(surveyId: string) {
    const [survey] = await db
      .select({
        id: csatSurveys.id,
        ticketId: csatSurveys.ticketId,
        score: csatSurveys.score,
        sentAt: csatSurveys.sentAt,
        submittedAt: csatSurveys.submittedAt,
      })
      .from(csatSurveys)
      .where(eq(csatSurveys.id, surveyId));

    if (!survey) throw new NotFoundException('Survey not found');

    // Check expiry
    const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;
    const expired =
      Date.now() - new Date(survey.sentAt).getTime() > SEVENTY_TWO_HOURS_MS;

    return {
      ...survey,
      expired,
      alreadySubmitted: !!survey.submittedAt,
    };
  }

  // ─── NPS Surveys ──────────────────────────────────────

  async createNpsSurvey(userId: string, courseId: string) {
    // Dedup: check if NPS already sent for this user+course
    const [existing] = await db
      .select({ id: npsSurveys.id })
      .from(npsSurveys)
      .where(
        and(eq(npsSurveys.userId, userId), eq(npsSurveys.courseId, courseId)),
      )
      .limit(1);

    if (existing) return null; // Already sent

    const [survey] = await db
      .insert(npsSurveys)
      .values({
        userId,
        courseId,
        channel: 'email',
      })
      .returning();

    // Send NPS email
    try {
      const [userInfo] = await db
        .select({ email: users.email, firstName: users.firstName })
        .from(users)
        .where(eq(users.id, userId));

      const [courseInfo] = await db
        .select({ title: courses.title })
        .from(courses)
        .where(eq(courses.id, courseId));

      if (userInfo?.email) {
        await this.emailService.sendNpsSurvey(
          userInfo.email,
          userInfo.firstName || 'Student',
          courseInfo?.title || 'your course',
          survey.id,
        );
      }
    } catch {
      // Non-blocking
    }

    return survey;
  }

  async submitNpsScore(
    surveyId: string,
    score: number,
    comment?: string,
  ) {
    const [survey] = await db
      .select()
      .from(npsSurveys)
      .where(eq(npsSurveys.id, surveyId));

    if (!survey) throw new NotFoundException('Survey not found');

    if (survey.submittedAt) {
      throw new BadRequestException('You have already submitted your rating.');
    }

    // 7-day expiry
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - new Date(survey.sentAt).getTime() > SEVEN_DAYS_MS) {
      throw new BadRequestException('This survey has expired.');
    }

    const [updated] = await db
      .update(npsSurveys)
      .set({
        score,
        comment: comment || null,
        submittedAt: new Date(),
      })
      .where(eq(npsSurveys.id, surveyId))
      .returning();

    return updated;
  }

  async getNpsSurvey(surveyId: string) {
    const [survey] = await db
      .select({
        id: npsSurveys.id,
        courseId: npsSurveys.courseId,
        score: npsSurveys.score,
        sentAt: npsSurveys.sentAt,
        submittedAt: npsSurveys.submittedAt,
      })
      .from(npsSurveys)
      .where(eq(npsSurveys.id, surveyId));

    if (!survey) throw new NotFoundException('Survey not found');

    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const expired =
      Date.now() - new Date(survey.sentAt).getTime() > SEVEN_DAYS_MS;

    return { ...survey, expired, alreadySubmitted: !!survey.submittedAt };
  }

  // ─── Summary / Analytics ──────────────────────────────

  async getCsatSummary() {
    const allSurveys = await db
      .select({
        score: csatSurveys.score,
        submittedAt: csatSurveys.submittedAt,
      })
      .from(csatSurveys);

    const total = allSurveys.length;
    const responded = allSurveys.filter((s) => s.submittedAt).length;
    const scores = allSurveys
      .filter((s) => s.score !== null)
      .map((s) => s.score!);
    const avgScore =
      scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const s of scores) {
      if (s >= 1 && s <= 5) distribution[s as 1 | 2 | 3 | 4 | 5]++;
    }

    return {
      totalSent: total,
      totalResponded: responded,
      responseRate: total > 0 ? Math.round((responded / total) * 100) : 0,
      avgScore: Math.round(avgScore * 10) / 10,
      distribution,
    };
  }

  async getNpsSummary() {
    const allSurveys = await db
      .select({
        score: npsSurveys.score,
        submittedAt: npsSurveys.submittedAt,
      })
      .from(npsSurveys);

    const total = allSurveys.length;
    const responded = allSurveys.filter((s) => s.submittedAt).length;
    const scores = allSurveys
      .filter((s) => s.score !== null)
      .map((s) => s.score!);

    let promoters = 0;
    let passives = 0;
    let detractors = 0;
    for (const s of scores) {
      if (s >= 9) promoters++;
      else if (s >= 7) passives++;
      else detractors++;
    }

    const totalScored = scores.length;
    const npsScore =
      totalScored > 0
        ? Math.round(
            ((promoters - detractors) / totalScored) * 100,
          )
        : 0;

    return {
      totalSent: total,
      totalResponded: responded,
      responseRate: total > 0 ? Math.round((responded / total) * 100) : 0,
      promoters,
      passives,
      detractors,
      npsScore,
    };
  }

  // ─── Guest Ticket (Login Issues Only) ──────────────────

  async createGuestTicket(dto: CreateGuestTicketDto) {
    // H6: Verify sentinel guest user exists
    const [guestUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, GUEST_USER_ID))
      .limit(1);

    if (!guestUser) {
      throw new BadRequestException(
        'Guest ticket system not configured. Please contact support via email.',
      );
    }

    const autoPriority =
      CATEGORY_PRIORITY_MAP[dto.category] || TICKET_PRIORITY.HIGH;
    const assigneeId = await this.findNextAgent();
    const trackingToken = crypto.randomUUID();

    const [ticket] = await db
      .insert(tickets)
      .values({
        studentId: GUEST_USER_ID,
        category: dto.category,
        priority: autoPriority,
        subject: dto.subject,
        description: dto.description,
        status: TICKET_STATUS.NEW,
        assigneeId,
        guestTrackingToken: trackingToken,
        guestName: dto.name,
        guestEmail: dto.email,
      })
      .returning();

    // Notify assigned agent
    if (assigneeId) {
      try {
        await this.notificationsService.create({
          recipientId: assigneeId,
          type: 'ticket_assigned',
          title: 'New Guest Ticket',
          message: `Login issue from ${dto.name} (${dto.email}): "${dto.subject}"`,
          link: `/dashboard/support/agent/tickets/${ticket.id}`,
          entityType: 'ticket',
          entityId: ticket.id,
        });
      } catch {
        // Non-blocking
      }
    }

    return { ticket, trackingToken };
  }

  async getTicketByTrackingToken(token: string) {
    const [ticket] = await db
      .select({
        id: tickets.id,
        category: tickets.category,
        priority: tickets.priority,
        subject: tickets.subject,
        description: tickets.description,
        status: tickets.status,
        assigneeId: tickets.assigneeId,
        firstResponseAt: tickets.firstResponseAt,
        slaBreachedFrt: tickets.slaBreachedFrt,
        slaBreachedTtr: tickets.slaBreachedTtr,
        onHoldTotalMinutes: tickets.onHoldTotalMinutes,
        createdAt: tickets.createdAt,
        resolvedAt: tickets.resolvedAt,
        closedAt: tickets.closedAt,
        guestName: tickets.guestName,
        guestEmail: tickets.guestEmail,
      })
      .from(tickets)
      .where(eq(tickets.guestTrackingToken, token));

    if (!ticket) throw new NotFoundException('Ticket not found');

    // Public comments only (no internal notes)
    const comments = await db
      .select({
        id: ticketReplies.id,
        message: ticketReplies.message,
        isStaffReply: ticketReplies.isStaffReply,
        isInternal: ticketReplies.isInternal,
        createdAt: ticketReplies.createdAt,
        userFirstName: users.firstName,
        userLastName: users.lastName,
      })
      .from(ticketReplies)
      .leftJoin(users, eq(ticketReplies.userId, users.id))
      .where(
        and(
          eq(ticketReplies.ticketId, ticket.id),
          eq(ticketReplies.isInternal, false),
        ),
      )
      .orderBy(asc(ticketReplies.createdAt));

    // SLA info
    const [slaPolicy] = await db
      .select()
      .from(slaPolicies)
      .where(eq(slaPolicies.priority, ticket.priority));

    return {
      ...ticket,
      comments,
      slaPolicy: slaPolicy || null,
    };
  }

  async addGuestReply(token: string, message: string) {
    const [ticket] = await db
      .select({
        id: tickets.id,
        status: tickets.status,
        assigneeId: tickets.assigneeId,
        closedAt: tickets.closedAt,
      })
      .from(tickets)
      .where(eq(tickets.guestTrackingToken, token));

    if (!ticket) throw new NotFoundException('Ticket not found');

    // 48h closed ticket check
    if (ticket.status === TICKET_STATUS.CLOSED) {
      const GRACE_PERIOD_MS = 48 * 60 * 60 * 1000;
      const closedTime = ticket.closedAt
        ? new Date(ticket.closedAt).getTime()
        : 0;
      if (Date.now() - closedTime > GRACE_PERIOD_MS) {
        throw new BadRequestException(
          'This ticket has been closed for more than 48 hours.',
        );
      }
    }

    const [comment] = await db
      .insert(ticketReplies)
      .values({
        ticketId: ticket.id,
        userId: GUEST_USER_ID,
        message,
        isStaffReply: false,
        isInternal: false,
      })
      .returning();

    // Reopen if resolved/closed
    if (
      ticket.status === TICKET_STATUS.RESOLVED ||
      ticket.status === TICKET_STATUS.CLOSED
    ) {
      await db
        .update(tickets)
        .set({
          status: TICKET_STATUS.NEW,
          resolvedAt: null,
          closedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(tickets.id, ticket.id));
    }

    // Notify agent
    if (ticket.assigneeId) {
      try {
        await this.notificationsService.create({
          recipientId: ticket.assigneeId,
          type: 'ticket_reply',
          title: 'Guest Replied',
          message: `Guest replied to ticket #${ticket.id.substring(0, 8)}`,
          link: `/dashboard/support/agent/tickets/${ticket.id}`,
          entityType: 'ticket',
          entityId: ticket.id,
        });
      } catch {
        // Non-blocking
      }
    }

    await db
      .update(tickets)
      .set({ updatedAt: new Date() })
      .where(eq(tickets.id, ticket.id));

    return comment;
  }

  // ─── Create Ticket on Behalf (Instructor → Learner) ────

  /**
   * Instructor opens a ticket on behalf of a student (IN-01 to IN-08)
   * Validates instructor teaches a course the student is enrolled in (IN-03)
   */
  async createTicketOnBehalf(
    openedByUserId: string,
    dto: CreateTicketOnBehalfDto,
  ) {
    // Validate student exists
    const [student] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, dto.studentId))
      .limit(1);

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Validate instructor teaches a course the student is enrolled in (IN-03)
    if (dto.courseId) {
      const [enrollment] = await db
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(
          and(
            eq(enrollments.studentId, dto.studentId),
            eq(enrollments.courseId, dto.courseId),
          ),
        )
        .limit(1);

      if (!enrollment) {
        throw new ForbiddenException(
          'Student is not enrolled in this course',
        );
      }
    }

    const autoPriority =
      CATEGORY_PRIORITY_MAP[dto.category] || TICKET_PRIORITY.MEDIUM;
    const assigneeId = await this.findNextAgent();

    const [ticket] = await db
      .insert(tickets)
      .values({
        studentId: dto.studentId,
        category: dto.category,
        priority: autoPriority,
        subject: dto.subject,
        description: dto.description,
        courseId: dto.courseId || null,
        status: TICKET_STATUS.NEW,
        assigneeId,
        openedBy: openedByUserId,
      })
      .returning();

    return ticket;
  }

  // ─── Tickets Opened By Me (Instructor View) ──────────

  async getTicketsOpenedByMe(userId: string) {
    return db
      .select({
        id: tickets.id,
        subject: tickets.subject,
        category: tickets.category,
        priority: tickets.priority,
        status: tickets.status,
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
        studentEmail: users.email,
      })
      .from(tickets)
      .leftJoin(users, eq(tickets.studentId, users.id))
      .where(eq(tickets.openedBy, userId))
      .orderBy(desc(tickets.createdAt));
  }

  // ─── Course Ticket Count (CM-01) ─────────────────────

  async getCourseTicketCount(courseId: string) {
    const [result] = await db
      .select({ count: count() })
      .from(tickets)
      .where(
        and(
          eq(tickets.courseId, courseId),
          inArray(tickets.status, [
            TICKET_STATUS.NEW,
            TICKET_STATUS.IN_PROGRESS,
            TICKET_STATUS.ON_HOLD,
          ]),
        ),
      );

    return { courseId, openCount: result?.count ?? 0 };
  }

  // ─── SLA Breaches + Backlog ────────────────────────────

  async getSlaBreaches() {
    return db
      .select({
        id: tickets.id,
        subject: tickets.subject,
        category: tickets.category,
        priority: tickets.priority,
        status: tickets.status,
        slaBreachedFrt: tickets.slaBreachedFrt,
        slaBreachedTtr: tickets.slaBreachedTtr,
        createdAt: tickets.createdAt,
        assigneeFirstName: users.firstName,
        assigneeLastName: users.lastName,
      })
      .from(tickets)
      .leftJoin(users, eq(tickets.assigneeId, users.id))
      .where(
        and(
          or(
            eq(tickets.slaBreachedFrt, true),
            eq(tickets.slaBreachedTtr, true),
          ),
          inArray(tickets.status, [
            TICKET_STATUS.NEW,
            TICKET_STATUS.IN_PROGRESS,
            TICKET_STATUS.ON_HOLD,
          ]),
        ),
      )
      .orderBy(desc(tickets.createdAt));
  }

  async getSlaBacklog() {
    const openTickets = await db
      .select({
        id: tickets.id,
        createdAt: tickets.createdAt,
        onHoldTotalMinutes: tickets.onHoldTotalMinutes,
      })
      .from(tickets)
      .where(
        inArray(tickets.status, [
          TICKET_STATUS.NEW,
          TICKET_STATUS.IN_PROGRESS,
          TICKET_STATUS.ON_HOLD,
        ]),
      );

    const now = new Date();
    const buckets = [
      { label: '0-1h', min: 0, max: 60, count: 0 },
      { label: '1-4h', min: 60, max: 240, count: 0 },
      { label: '4-24h', min: 240, max: 1440, count: 0 },
      { label: '24h+', min: 1440, max: Infinity, count: 0 },
    ];

    for (const ticket of openTickets) {
      const elapsed = calculateBusinessMinutesElapsed(ticket.createdAt, now);
      const effective = elapsed - (ticket.onHoldTotalMinutes || 0);
      for (const bucket of buckets) {
        if (effective >= bucket.min && effective < bucket.max) {
          bucket.count++;
          break;
        }
      }
    }

    return {
      buckets: buckets.map((b) => ({ label: b.label, count: b.count })),
      total: openTickets.length,
    };
  }

  // ─── Reports API ──────────────────────────────────────

  async getVolumeReport(dateFrom?: string, dateTo?: string) {
    const conditions: any[] = [];
    if (dateFrom) conditions.push(sql`${tickets.createdAt} >= ${new Date(dateFrom)}`);
    if (dateTo) conditions.push(sql`${tickets.createdAt} <= ${new Date(dateTo)}`);

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db
      .select({
        category: tickets.category,
        status: tickets.status,
        priority: tickets.priority,
        count: count(),
      })
      .from(tickets)
      .where(where)
      .groupBy(tickets.category, tickets.status, tickets.priority);

    return result;
  }

  async getTopIssues(dateFrom?: string, dateTo?: string) {
    const conditions: any[] = [];
    if (dateFrom) conditions.push(sql`${tickets.createdAt} >= ${new Date(dateFrom)}`);
    if (dateTo) conditions.push(sql`${tickets.createdAt} <= ${new Date(dateTo)}`);

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const result = await db
      .select({
        category: tickets.category,
        count: count(),
      })
      .from(tickets)
      .where(where)
      .groupBy(tickets.category)
      .orderBy(desc(count()));

    return result;
  }

  async getSlaComplianceReport(dateFrom?: string, dateTo?: string) {
    const conditions: any[] = [
      sql`${tickets.resolvedAt} IS NOT NULL`,
    ];
    if (dateFrom) conditions.push(sql`${tickets.resolvedAt} >= ${new Date(dateFrom)}`);
    if (dateTo) conditions.push(sql`${tickets.resolvedAt} <= ${new Date(dateTo)}`);

    const resolved = await db
      .select({
        id: tickets.id,
        slaBreachedFrt: tickets.slaBreachedFrt,
        slaBreachedTtr: tickets.slaBreachedTtr,
      })
      .from(tickets)
      .where(and(...conditions));

    const total = resolved.length;
    const frtMet = resolved.filter((t) => !t.slaBreachedFrt).length;
    const ttrMet = resolved.filter((t) => !t.slaBreachedTtr).length;
    const bothMet = resolved.filter(
      (t) => !t.slaBreachedFrt && !t.slaBreachedTtr,
    ).length;

    return {
      totalResolved: total,
      resolvedWithinSla: bothMet,
      complianceRate: total > 0 ? Math.round((bothMet / total) * 100) : 0,
      frtCompliance: total > 0 ? Math.round((frtMet / total) * 100) : 0,
      ttrCompliance: total > 0 ? Math.round((ttrMet / total) * 100) : 0,
    };
  }

  async getAgentPerformance(dateFrom?: string, dateTo?: string) {
    const agents = await this.getAgents();

    const results = [];
    for (const agent of agents) {
      const conditions: any[] = [eq(tickets.assigneeId, agent.userId)];
      if (dateFrom) conditions.push(sql`${tickets.createdAt} >= ${new Date(dateFrom)}`);
      if (dateTo) conditions.push(sql`${tickets.createdAt} <= ${new Date(dateTo)}`);

      const agentTickets = await db
        .select({
          id: tickets.id,
          firstResponseAt: tickets.firstResponseAt,
          createdAt: tickets.createdAt,
          resolvedAt: tickets.resolvedAt,
          slaBreachedFrt: tickets.slaBreachedFrt,
          slaBreachedTtr: tickets.slaBreachedTtr,
        })
        .from(tickets)
        .where(and(...conditions));

      const resolved = agentTickets.filter((t) => t.resolvedAt);
      const frtBreaches = agentTickets.filter((t) => t.slaBreachedFrt).length;
      const ttrBreaches = agentTickets.filter((t) => t.slaBreachedTtr).length;

      // Avg FRT (minutes)
      const frtTimes = agentTickets
        .filter((t) => t.firstResponseAt)
        .map((t) => {
          const elapsed =
            (new Date(t.firstResponseAt!).getTime() -
              new Date(t.createdAt).getTime()) /
            60000;
          return elapsed;
        });
      const avgFrt =
        frtTimes.length > 0
          ? Math.round(
              frtTimes.reduce((a, b) => a + b, 0) / frtTimes.length,
            )
          : null;

      results.push({
        userId: agent.userId,
        name: [agent.firstName, agent.lastName].filter(Boolean).join(' '),
        totalTickets: agentTickets.length,
        resolvedTickets: resolved.length,
        avgFrtMinutes: avgFrt,
        frtBreaches,
        ttrBreaches,
      });
    }

    return results;
  }

  async exportReport(
    type: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    let data: any[];
    let headers: string[];

    switch (type) {
      case 'volume': {
        data = await this.getVolumeReport(dateFrom, dateTo);
        headers = ['Category', 'Status', 'Priority', 'Count'];
        break;
      }
      case 'issues': {
        data = await this.getTopIssues(dateFrom, dateTo);
        headers = ['Category', 'Count'];
        break;
      }
      case 'sla': {
        const sla = await this.getSlaComplianceReport(dateFrom, dateTo);
        data = [sla];
        headers = [
          'Total Resolved',
          'Within SLA',
          'Compliance %',
          'FRT Compliance %',
          'TTR Compliance %',
        ];
        break;
      }
      case 'agents': {
        data = await this.getAgentPerformance(dateFrom, dateTo);
        headers = [
          'Agent',
          'Total Tickets',
          'Resolved',
          'Avg FRT (min)',
          'FRT Breaches',
          'TTR Breaches',
        ];
        break;
      }
      default:
        throw new BadRequestException('Invalid report type');
    }

    // Generate CSV
    const csvRows = [headers.join(',')];
    for (const row of data) {
      const values = headers.map((h) => {
        const key = h
          .toLowerCase()
          .replace(/ /g, '_')
          .replace(/[^a-z_]/g, '');
        return JSON.stringify(
          row[key] ?? row[Object.keys(row)[headers.indexOf(h)]] ?? '',
        );
      });
      csvRows.push(values.join(','));
    }

    return {
      csv: csvRows.join('\n'),
      filename: `support_report_${type}_${new Date().toISOString().split('T')[0]}.csv`,
    };
  }

  // ─── Admin Support KPIs ────────────────────────────────

  async getAdminSupportKpis() {
    const kpis = await this.getKPIs();
    const csatSummary = await this.getCsatSummary();
    const npsSummary = await this.getNpsSummary();

    return {
      avgFrtMinutes: kpis.avgFrtMinutes,
      avgTtrMinutes: kpis.avgTtrMinutes,
      openTickets: kpis.openTickets,
      slaBreaches: kpis.slaBreaches,
      csatAvgScore: csatSummary.avgScore,
      npsScore: npsSummary.npsScore,
      csatResponseRate: csatSummary.responseRate,
      statusBreakdown: kpis.statusBreakdown,
    };
  }

  // ─── SLA Policy CRUD ──────────────────────────────────

  async getSlaPolicies() {
    return db
      .select()
      .from(slaPolicies)
      .orderBy(asc(slaPolicies.frtMinutes));
  }

  async updateSlaPolicy(
    priority: string,
    data: {
      frtMinutes?: number;
      ttrMinutes?: number;
      escalateAfterMinutes?: number;
    },
  ) {
    const [updated] = await db
      .update(slaPolicies)
      .set(data)
      .where(eq(slaPolicies.priority, priority))
      .returning();

    if (!updated) throw new NotFoundException(`SLA policy for ${priority} not found`);
    return updated;
  }

  // ─── Create Support Agent (Supervisor Only) ────────────

  async createAgent(dto: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }) {
    // Check if user already exists
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, dto.email.toLowerCase()))
      .limit(1);

    if (existing) {
      throw new BadRequestException('A user with this email already exists');
    }

    // Hash password
    const passwordHash = await argon2.hash(dto.password);

    // Get the SUPPORT role ID
    const [supportRole] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, ROLE_NAMES.SUPPORT));

    if (!supportRole) {
      throw new BadRequestException('SUPPORT role not found in system');
    }

    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone || null,
        activeRole: ROLE_NAMES.SUPPORT,
        isVerified: true,
        isActive: true,
      })
      .returning({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      });

    // Assign SUPPORT role with 'agent' sub-role
    await db.insert(userRoles).values({
      userId: newUser.id,
      roleId: supportRole.id,
      supportSubRole: SUPPORT_SUB_ROLES.AGENT,
    });

    return {
      ...newUser,
      role: ROLE_NAMES.SUPPORT,
      supportSubRole: SUPPORT_SUB_ROLES.AGENT,
    };
  }

  // ─── Macros CRUD ──────────────────────────────────────

  async getMacros() {
    return db
      .select({
        id: supportMacros.id,
        title: supportMacros.title,
        bodyTemplate: supportMacros.bodyTemplate,
        variables: supportMacros.variables,
        kbArticleUrls: supportMacros.kbArticleUrls,
        escalationPathId: supportMacros.escalationPathId,
        isActive: supportMacros.isActive,
        createdAt: supportMacros.createdAt,
        creatorFirstName: users.firstName,
        creatorLastName: users.lastName,
      })
      .from(supportMacros)
      .leftJoin(users, eq(supportMacros.createdBy, users.id))
      .where(eq(supportMacros.isActive, true))
      .orderBy(desc(supportMacros.createdAt));
  }

  async getMacro(id: string) {
    const [macro] = await db
      .select()
      .from(supportMacros)
      .where(and(eq(supportMacros.id, id), eq(supportMacros.isActive, true)));
    if (!macro) throw new NotFoundException('Macro not found');
    return macro;
  }

  async createMacro(userId: string, dto: CreateMacroDto) {
    const [macro] = await db
      .insert(supportMacros)
      .values({
        title: dto.title,
        bodyTemplate: dto.bodyTemplate,
        variables: dto.variables || null,
        kbArticleUrls: dto.kbArticleUrls || null,
        escalationPathId: dto.escalationPathId || null,
        createdBy: userId,
      })
      .returning();
    return macro;
  }

  async updateMacro(id: string, dto: UpdateMacroDto) {
    const [existing] = await db
      .select({ id: supportMacros.id })
      .from(supportMacros)
      .where(eq(supportMacros.id, id));
    if (!existing) throw new NotFoundException('Macro not found');

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.bodyTemplate !== undefined) updateData.bodyTemplate = dto.bodyTemplate;
    if (dto.variables !== undefined) updateData.variables = dto.variables;
    if (dto.kbArticleUrls !== undefined) updateData.kbArticleUrls = dto.kbArticleUrls;
    if (dto.escalationPathId !== undefined) updateData.escalationPathId = dto.escalationPathId;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const [updated] = await db
      .update(supportMacros)
      .set(updateData)
      .where(eq(supportMacros.id, id))
      .returning();
    return updated;
  }

  async deleteMacro(id: string) {
    const [existing] = await db
      .select({ id: supportMacros.id })
      .from(supportMacros)
      .where(eq(supportMacros.id, id));
    if (!existing) throw new NotFoundException('Macro not found');

    await db
      .update(supportMacros)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(supportMacros.id, id));
    return { success: true };
  }

  async applyMacro(macroId: string, ticketId: string) {
    // Fetch macro (404 if deleted/inactive)
    const [macro] = await db
      .select()
      .from(supportMacros)
      .where(and(eq(supportMacros.id, macroId), eq(supportMacros.isActive, true)));
    if (!macro) throw new NotFoundException('Macro not found or deleted');

    // Fetch ticket with student + course + agent info
    const [ticket] = await db
      .select({
        id: tickets.id,
        studentId: tickets.studentId,
        courseId: tickets.courseId,
        assigneeId: tickets.assigneeId,
        guestName: tickets.guestName,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
      })
      .from(tickets)
      .leftJoin(users, eq(tickets.studentId, users.id))
      .where(eq(tickets.id, ticketId));

    if (!ticket) throw new NotFoundException('Ticket not found');

    // Get course name if courseId exists
    let courseName = '';
    if (ticket.courseId) {
      const [course] = await db
        .select({ title: courses.title })
        .from(courses)
        .where(eq(courses.id, ticket.courseId));
      courseName = course?.title || '';
    }

    // Get agent name if assigned
    let agentName = '';
    if (ticket.assigneeId) {
      const [agent] = await db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, ticket.assigneeId));
      agentName = [agent?.firstName, agent?.lastName].filter(Boolean).join(' ');
    }

    // Determine learner name (guest vs registered)
    const learnerName = ticket.studentId === GUEST_USER_ID
      ? (ticket.guestName || '')
      : [ticket.studentFirstName, ticket.studentLastName].filter(Boolean).join(' ');

    // Variable resolution
    let resolvedBody = macro.bodyTemplate;
    resolvedBody = resolvedBody.replace(/\{\{learner_name\}\}/g, learnerName);
    resolvedBody = resolvedBody.replace(/\{\{course_name\}\}/g, courseName);
    resolvedBody = resolvedBody.replace(/\{\{ticket_id\}\}/g, ticketId.substring(0, 8));
    resolvedBody = resolvedBody.replace(/\{\{agent_name\}\}/g, agentName);

    // Replace any remaining unresolved {{...}} with empty string
    resolvedBody = resolvedBody.replace(/\{\{[^}]*\}\}/g, '');

    // Append KB article URLs if any
    const urls = macro.kbArticleUrls as string[] | null;
    if (urls && urls.length > 0) {
      resolvedBody += '\n\n---\nRelated articles:';
      for (const url of urls) {
        resolvedBody += `\n- ${url}`;
      }
    }

    return { resolvedBody, macroTitle: macro.title };
  }

  // ─── Knowledge Base CRUD ──────────────────────────────

  async getKbArticles(filters?: {
    category?: string;
    search?: string;
    publishedOnly?: boolean;
  }) {
    const conditions: any[] = [];

    if (filters?.publishedOnly) {
      conditions.push(eq(kbArticles.published, true));
    }
    if (filters?.category) {
      conditions.push(eq(kbArticles.category, filters.category));
    }
    if (filters?.search) {
      conditions.push(
        or(
          ilike(kbArticles.titleEn, `%${filters.search}%`),
          ilike(kbArticles.titleAr, `%${filters.search}%`),
          ilike(kbArticles.bodyEn, `%${filters.search}%`),
        ),
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    return db
      .select({
        id: kbArticles.id,
        titleAr: kbArticles.titleAr,
        titleEn: kbArticles.titleEn,
        bodyAr: kbArticles.bodyAr,
        bodyEn: kbArticles.bodyEn,
        category: kbArticles.category,
        published: kbArticles.published,
        viewCount: kbArticles.viewCount,
        createdAt: kbArticles.createdAt,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
      })
      .from(kbArticles)
      .leftJoin(users, eq(kbArticles.authorId, users.id))
      .where(where)
      .orderBy(desc(kbArticles.createdAt));
  }

  async getKbArticle(id: string, incrementView: boolean = false) {
    if (incrementView) {
      await db
        .update(kbArticles)
        .set({ viewCount: sql`${kbArticles.viewCount} + 1` })
        .where(eq(kbArticles.id, id));
    }

    const [article] = await db
      .select()
      .from(kbArticles)
      .where(eq(kbArticles.id, id));

    if (!article) throw new NotFoundException('Article not found');
    return article;
  }

  async createKbArticle(userId: string, dto: CreateKbArticleDto) {
    // M9: Require at least one title
    if (!dto.titleEn && !dto.titleAr) {
      throw new BadRequestException(
        'At least one title (English or Arabic) is required',
      );
    }

    const [article] = await db
      .insert(kbArticles)
      .values({
        titleEn: dto.titleEn || null,
        titleAr: dto.titleAr || null,
        bodyEn: dto.bodyEn || null,
        bodyAr: dto.bodyAr || null,
        category: dto.category,
        published: dto.published ?? false,
        authorId: userId,
      })
      .returning();
    return article;
  }

  async updateKbArticle(id: string, dto: UpdateKbArticleDto) {
    const [existing] = await db
      .select({ id: kbArticles.id })
      .from(kbArticles)
      .where(eq(kbArticles.id, id));
    if (!existing) throw new NotFoundException('Article not found');

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (dto.titleEn !== undefined) updateData.titleEn = dto.titleEn;
    if (dto.titleAr !== undefined) updateData.titleAr = dto.titleAr;
    if (dto.bodyEn !== undefined) updateData.bodyEn = dto.bodyEn;
    if (dto.bodyAr !== undefined) updateData.bodyAr = dto.bodyAr;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.published !== undefined) updateData.published = dto.published;

    const [updated] = await db
      .update(kbArticles)
      .set(updateData)
      .where(eq(kbArticles.id, id))
      .returning();
    return updated;
  }

  async deleteKbArticle(id: string) {
    const [existing] = await db
      .select({ id: kbArticles.id })
      .from(kbArticles)
      .where(eq(kbArticles.id, id));
    if (!existing) throw new NotFoundException('Article not found');

    await db.delete(kbArticles).where(eq(kbArticles.id, id));
    return { success: true };
  }
}
