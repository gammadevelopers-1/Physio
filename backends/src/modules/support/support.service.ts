import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import PDFDocument from 'pdfkit';
import { eq, and, or, desc, asc, sql, ilike, count, inArray, gte } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
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
  courseRatings,
  supportConfig,
  supportMacros,
  kbArticles,
  kbCategories,
  escalationPaths,
  enrollments,
  supportTeamMembers,
  supportTeamRequests,
  auditLogs,
  TICKET_STATUS,
  TICKET_PRIORITY,
  ROLE_NAMES,
  SUPPORT_SUB_ROLES,
  SLA_EVENT_TYPES,
  GUEST_USER_ID,
  SUPPORT_TEAM_REQUEST_KIND,
  SUPPORT_TEAM_REQUEST_STATUS,
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
  setBusinessHoursConfig,
  getBusinessHoursConfig,
  refreshBusinessHoursConfigIfStale,
  DEFAULT_BUSINESS_HOURS,
  type BusinessHoursConfig,
} from './business-hours.util';
import { UserNotificationsService } from '../user-notifications/user-notifications.service';
import { EmailService } from '../email/email.service';
import { RecaptchaService } from '../auth/recaptcha.service';
import { NotificationsService } from '../notifications/notifications.service';

// Fallback auto-priority mapping for the 6 built-ins. Used only when the
// stored ticket_categories config row has no entry for that slug (which
// happens for built-ins by default; custom rows always carry their own
// autoPriority because the admin form requires it). See
// resolveCategoryPriority() for the live lookup that wraps this.
const CATEGORY_PRIORITY_MAP: Record<string, string> = {
  billing: TICKET_PRIORITY.HIGH,
  login: TICKET_PRIORITY.HIGH,
  technical: TICKET_PRIORITY.HIGH,
  certificate: TICKET_PRIORITY.MEDIUM,
  content: TICKET_PRIORITY.LOW,
  other: TICKET_PRIORITY.LOW,
};

@Injectable()
export class SupportService implements OnModuleInit {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly notificationsService: UserNotificationsService,
    private readonly emailService: EmailService,
    private readonly recaptchaService: RecaptchaService,
    private readonly adminNotifications: NotificationsService,
  ) {}

  // Load business-hours config from DB on boot so SLA math reflects
  // the admin's saved settings without a process restart. Falls back
  // to the util's defaults if the row is missing or unreadable.
  async onModuleInit() {
    try {
      const cfg = await this.getBusinessHours();
      setBusinessHoursConfig(cfg);
    } catch (err) {
      this.logger.warn(
        `Failed to bootstrap business hours from DB — using defaults. ${err}`,
      );
    }
  }

  // ─── Agent Ownership Check ──────────────────────────────
  // Ensures that non-supervisor agents can only act on tickets
  // assigned to them. Supervisors and admins bypass this check.

  private async assertAgentOwnership(
    user: AuthenticatedUser,
    ticketId: string,
  ) {
    const isSupervisorOrAdmin =
      user.supportSubRole === 'supervisor' ||
      user.roles.includes(ROLE_NAMES.ADMIN) ||
      user.roles.includes(ROLE_NAMES.SUPER_ADMIN);

    // Supervisors and admins can access any ticket
    if (isSupervisorOrAdmin) return;

    // Students are handled separately in each method — skip here
    const isSupportAgent = user.roles.includes(ROLE_NAMES.SUPPORT);
    if (!isSupportAgent) return;

    // Agent: must be the assignee
    const [ticket] = await db
      .select({ assigneeId: tickets.assigneeId })
      .from(tickets)
      .where(eq(tickets.id, ticketId));

    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.assigneeId !== user.id) {
      throw new ForbiddenException(
        'You are not assigned to this ticket',
      );
    }
  }

  // ─── Create Ticket ──────────────────────────────────────

  async createTicket(userId: string, dto: CreateTicketDto) {
    // Refresh business-hours cache if stale before we compute the SLA
    // deadline shown to the customer — guards against the "wrong ETA"
    // race on a Cloud Run instance that didn't handle the admin PATCH.
    await refreshBusinessHoursConfigIfStale(() => this.getBusinessHours());

    // Priority always auto-assigned by category — student input ignored (PR-09).
    // Live resolution consults admin-managed categories so custom slugs work.
    const { priority: autoPriority, isValidSlug } =
      await this.resolveCategoryPriority(dto.category);
    if (!isValidSlug) {
      throw new BadRequestException(
        `Unknown category "${dto.category}". Ask an admin to add it under Settings → Categories.`,
      );
    }

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

      // Notify agent: new ticket assigned (respects support staff in-app master)
      if (assigneeId && (await this.shouldNotifySupport(assigneeId, 'inApp'))) {
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

    // Send email to agent (respects support staff email master)
    if (assigneeId && (await this.shouldNotifySupport(assigneeId, 'email'))) {
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

    // Agent isolation: non-supervisor support agents can only see their
    // own assigned tickets. Supervisors and admins see everything.
    const isSupervisorOrAdmin =
      user.supportSubRole === 'supervisor' ||
      user.roles.includes(ROLE_NAMES.ADMIN) ||
      user.roles.includes(ROLE_NAMES.SUPER_ADMIN);
    if (isSupportOrAdmin && !isSupervisorOrAdmin) {
      conditions.push(eq(tickets.assigneeId, user.id));
    }

    if (query.status) conditions.push(eq(tickets.status, query.status));
    if (query.priority) conditions.push(eq(tickets.priority, query.priority));
    if (query.category) conditions.push(eq(tickets.category, query.category));
    if (query.assigneeId) conditions.push(eq(tickets.assigneeId, query.assigneeId));
    if (query.search) {
      // Match on subject, ticket id (UUID prefix), or customer name/email.
      // Customer columns are on the joined `users` row; the join is added
      // below, so referencing them here is safe.
      conditions.push(
        or(
          ilike(tickets.subject, `%${query.search}%`),
          ilike(tickets.id, `%${query.search}%`),
          ilike(users.firstName, `%${query.search}%`),
          ilike(users.lastName, `%${query.search}%`),
          ilike(users.email, `%${query.search}%`),
        ),
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Second alias of `users` so we can join twice: once for the student
    // (ticket creator) and once for the assignee (support agent).
    const assigneeUsers = alias(users, 'assignee_users');

    const [ticketsList, totalResult, policies] = await Promise.all([
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
          onHoldTotalMinutes: tickets.onHoldTotalMinutes,
          createdAt: tickets.createdAt,
          updatedAt: tickets.updatedAt,
          resolvedAt: tickets.resolvedAt,
          closedAt: tickets.closedAt,
          studentFirstName: users.firstName,
          studentLastName: users.lastName,
          studentEmail: users.email,
          assigneeFirstName: assigneeUsers.firstName,
          assigneeLastName: assigneeUsers.lastName,
        })
        .from(tickets)
        .leftJoin(users, eq(tickets.studentId, users.id))
        .leftJoin(assigneeUsers, eq(tickets.assigneeId, assigneeUsers.id))
        .where(where)
        .orderBy(desc(tickets.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(tickets)
        .leftJoin(users, eq(tickets.studentId, users.id))
        .where(where),
      db.select().from(slaPolicies),
    ]);

    // Compute FRT + TTR remaining-minutes per ticket so the UI can show
    // SLA timers without re-fetching policies. Negative = breached.
    // `null` when the ticket is in a terminal state where the SLA no
    // longer ticks (resolved, closed) or there is no policy for the
    // priority.
    const policyMap = new Map(policies.map((p) => [p.priority, p]));
    const TERMINAL_STATUSES = new Set([
      TICKET_STATUS.RESOLVED,
      TICKET_STATUS.CLOSED,
    ]);

    const enriched = ticketsList.map((t) => {
      const policy = policyMap.get(t.priority);
      const terminal = TERMINAL_STATUSES.has(t.status as any);

      let frtRemainingMinutes: number | null = null;
      let ttrRemainingMinutes: number | null = null;

      if (policy && !terminal) {
        if (!t.firstResponseAt) {
          const elapsed = calculateBusinessMinutesElapsed(
            t.createdAt,
            new Date(),
          );
          frtRemainingMinutes = policy.frtMinutes - elapsed;
        }
        const elapsedTtr = Math.max(
          0,
          calculateBusinessMinutesElapsed(t.createdAt, new Date()) -
            (t.onHoldTotalMinutes || 0),
        );
        ttrRemainingMinutes = policy.ttrMinutes - elapsedTtr;
      }

      return { ...t, frtRemainingMinutes, ttrRemainingMinutes };
    });

    return {
      tickets: enriched,
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

    // Agent isolation: non-supervisor agents can only view their assigned tickets
    if (isSupportOrAdmin) {
      const isSupervisorOrAdmin =
        user.supportSubRole === 'supervisor' ||
        user.roles.includes(ROLE_NAMES.ADMIN) ||
        user.roles.includes(ROLE_NAMES.SUPER_ADMIN);
      if (!isSupervisorOrAdmin && ticket.assigneeId !== user.id) {
        throw new ForbiddenException('You are not assigned to this ticket');
      }
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

  async updateTicket(ticketId: string, dto: UpdateTicketDto, user?: AuthenticatedUser) {
    // Agent isolation: non-supervisor agents can only update their own tickets
    if (user) {
      await this.assertAgentOwnership(user, ticketId);
    }
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
      // M1: Status transition validation.
      // RESOLVED → IN_PROGRESS allows staff to explicitly reopen a
      // resolved ticket (e.g. customer escalated via another channel).
      // CLOSED is terminal — past the 48h student grace window, the
      // customer must open a new ticket so the audit trail stays clean.
      const validTransitions: Record<string, string[]> = {
        [TICKET_STATUS.NEW]: [TICKET_STATUS.IN_PROGRESS],
        [TICKET_STATUS.IN_PROGRESS]: [
          TICKET_STATUS.ON_HOLD,
          TICKET_STATUS.RESOLVED,
          TICKET_STATUS.CLOSED,
        ],
        [TICKET_STATUS.ON_HOLD]: [TICKET_STATUS.IN_PROGRESS],
        [TICKET_STATUS.RESOLVED]: [
          TICKET_STATUS.CLOSED,
          TICKET_STATUS.IN_PROGRESS,
        ],
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

      // Reopening a resolved ticket clears resolvedAt so reporting
      // and SLA counters reflect the active in-progress state again.
      if (
        existing.status === TICKET_STATUS.RESOLVED &&
        dto.status === TICKET_STATUS.IN_PROGRESS
      ) {
        updateData.resolvedAt = null;
      }
    }

    // M1: Block non-status property changes on resolved/closed tickets.
    // Once a ticket is resolved or closed, only status transitions
    // (e.g., RESOLVED → CLOSED) are allowed — not priority, category,
    // or assignee changes, which would corrupt the audit trail.
    const isTerminal =
      existing.status === TICKET_STATUS.RESOLVED ||
      existing.status === TICKET_STATUS.CLOSED;

    if (dto.priority && isTerminal) {
      throw new BadRequestException(
        'Cannot change priority on a resolved/closed ticket',
      );
    }
    if (dto.assigneeId && isTerminal) {
      throw new BadRequestException(
        'Cannot reassign a resolved/closed ticket',
      );
    }

    if (dto.priority && !isTerminal) updateData.priority = dto.priority;
    if (dto.assigneeId && !isTerminal) updateData.assigneeId = dto.assigneeId;

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

    // Access check — students can only comment on their own tickets
    if (!isSupportOrAdmin && ticket.studentId !== user.id) {
      throw new ForbiddenException('You do not have access to this ticket');
    }

    // Agent isolation: non-supervisor agents can only comment on their assigned tickets
    if (isSupportOrAdmin) {
      const isSupervisorOrAdmin =
        user.supportSubRole === 'supervisor' ||
        user.roles.includes(ROLE_NAMES.ADMIN) ||
        user.roles.includes(ROLE_NAMES.SUPER_ADMIN);
      if (!isSupervisorOrAdmin && ticket.assigneeId !== user.id) {
        throw new ForbiddenException('You are not assigned to this ticket');
      }
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

    // 48h grace check for student reopen must happen BEFORE the
    // transaction so we don't open + immediately roll back the comment
    // insert when grace is expired.
    if (
      !isSupportOrAdmin &&
      ticket.status === TICKET_STATUS.CLOSED &&
      ticket.closedAt
    ) {
      const GRACE_PERIOD_MS = 48 * 60 * 60 * 1000;
      if (
        Date.now() - new Date(ticket.closedAt).getTime() >
        GRACE_PERIOD_MS
      ) {
        throw new BadRequestException(
          'This ticket has been closed for more than 48 hours and cannot be reopened.',
        );
      }
    }

    // All writes go in one transaction so a crash mid-flow can't leave
    // an orphaned reply with no corresponding ticket-state update
    // (e.g. firstResponseAt set but status still NEW, or a student
    // reopen reply with the ticket still RESOLVED).
    const comment = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(ticketReplies)
        .values({
          ticketId,
          userId: user.id,
          message: dto.message,
          isStaffReply: isSupportOrAdmin,
          isInternal,
        })
        .returning();

      const now = new Date();
      const ticketUpdate: Record<string, unknown> = { updatedAt: now };

      // First-response + auto NEW → IN_PROGRESS on first public staff reply
      if (isSupportOrAdmin && !isInternal) {
        if (!ticket.firstResponseAt) {
          ticketUpdate.firstResponseAt = now;
        }
        if (ticket.status === TICKET_STATUS.NEW) {
          ticketUpdate.status = TICKET_STATUS.IN_PROGRESS;
        }
      }

      // Student reply on resolved/closed (within 48h grace) → reopen (ST-12, ST-13)
      if (
        !isSupportOrAdmin &&
        (ticket.status === TICKET_STATUS.RESOLVED ||
          ticket.status === TICKET_STATUS.CLOSED)
      ) {
        ticketUpdate.status = TICKET_STATUS.NEW;
        ticketUpdate.resolvedAt = null;
        ticketUpdate.closedAt = null;
      }

      await tx
        .update(tickets)
        .set(ticketUpdate)
        .where(eq(tickets.id, ticketId));

      return inserted;
    });

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
      } else if (
        !isSupportOrAdmin &&
        ticket.assigneeId &&
        (await this.shouldNotifySupport(ticket.assigneeId, 'inApp'))
      ) {
        // Student replied → notify assigned agent (gated by their in-app master)
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
      } else if (
        !isSupportOrAdmin &&
        ticket.assigneeId &&
        (await this.shouldNotifySupport(ticket.assigneeId, 'email'))
      ) {
        // Student replied → email agent (gated by their email master)
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

  async resolveTicket(ticketId: string, userId: string, user?: AuthenticatedUser) {
    // Agent isolation: non-supervisor agents can only resolve their own tickets
    if (user) {
      await this.assertAgentOwnership(user, ticketId);
    }
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

    // Resolving the ticket and creating the CSAT survey placeholder must
    // succeed together. Without this transaction, a crash between the
    // two writes leaves a "resolved" ticket the student never gets
    // surveyed about — silently dropping the CSAT response rate.
    // The SLA event log stays as best-effort outside the tx (it's an
    // analytics signal, not a correctness guarantee).
    const updated = await db.transaction(async (tx) => {
      const [updatedTicket] = await tx
        .update(tickets)
        .set(updateData)
        .where(eq(tickets.id, ticketId))
        .returning();

      await tx
        .insert(csatSurveys)
        .values({
          ticketId,
          userId: ticket.studentId,
          courseId: ticket.courseId || null,
          channel: 'email',
        })
        .onConflictDoNothing();

      return updatedTicket;
    });

    // Log resolved_within_sla event (SB-13) — best-effort, outside the
    // transaction because a failed analytics insert shouldn't roll back
    // a legitimately-resolved ticket.
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

  async closeTicket(ticketId: string, user?: AuthenticatedUser) {
    // Agent isolation: non-supervisor agents can only close their own tickets
    if (user) {
      await this.assertAgentOwnership(user, ticketId);
    }
    const [ticket] = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(eq(tickets.id, ticketId));

    if (!ticket) throw new NotFoundException('Ticket not found');

    // Fetch student info for close notification
    const [ticketFull] = await db
      .select({
        studentId: tickets.studentId,
        subject: tickets.subject,
        guestEmail: tickets.guestEmail,
        guestName: tickets.guestName,
      })
      .from(tickets)
      .where(eq(tickets.id, ticketId));

    const [updated] = await db
      .update(tickets)
      .set({
        status: TICKET_STATUS.CLOSED,
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tickets.id, ticketId))
      .returning();

    // M2: Send ticket-closed notification email to the student/guest
    try {
      if (ticketFull) {
        let recipientEmail: string | null = null;
        let recipientName = 'Student';

        if (ticketFull.guestEmail) {
          recipientEmail = ticketFull.guestEmail;
          recipientName = ticketFull.guestName || 'Guest';
        } else if (ticketFull.studentId !== GUEST_USER_ID) {
          const [studentInfo] = await db
            .select({ email: users.email, firstName: users.firstName })
            .from(users)
            .where(eq(users.id, ticketFull.studentId));
          if (studentInfo?.email) {
            recipientEmail = studentInfo.email;
            recipientName = studentInfo.firstName || 'Student';
          }
        }

        if (recipientEmail) {
          await this.emailService.sendTicketClosed(
            recipientEmail,
            recipientName,
            ticketId,
          );
        }
      }
    } catch {
      // Non-blocking
    }

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

    // Resolved-this-week (rolling 7 days). Drives the AllTickets
    // "Resolved this week" card. Counts both resolved and closed states
    // since both end states are "we sent the customer the answer".
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const oneWeekAgo = new Date(Date.now() - SEVEN_DAYS_MS);
    const [resolvedThisWeekRow] = await db
      .select({ count: count() })
      .from(tickets)
      .where(
        and(
          inArray(tickets.status, [
            TICKET_STATUS.RESOLVED,
            TICKET_STATUS.CLOSED,
          ]),
          gte(tickets.resolvedAt, oneWeekAgo),
        ),
      );

    // Batch 4: business-hours-aware avg FRT / TTR.
    //
    // Pull the last-30-day tickets (cap 500) and reduce in JS using the
    // business-hours util, so AST weekends + off-hours don't inflate the
    // averages. TTR also subtracts onHoldTotalMinutes.
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const since = new Date(Date.now() - THIRTY_DAYS_MS);

    const recentTickets = await db
      .select({
        createdAt: tickets.createdAt,
        firstResponseAt: tickets.firstResponseAt,
        resolvedAt: tickets.resolvedAt,
        onHoldTotalMinutes: tickets.onHoldTotalMinutes,
      })
      .from(tickets)
      .where(gte(tickets.createdAt, since))
      .limit(500);

    const frtMinutesSamples: number[] = [];
    const ttrMinutesSamples: number[] = [];
    for (const row of recentTickets) {
      if (row.firstResponseAt) {
        const m = calculateBusinessMinutesElapsed(
          row.createdAt,
          row.firstResponseAt,
        );
        if (Number.isFinite(m) && m >= 0) frtMinutesSamples.push(m);
      }
      if (row.resolvedAt) {
        const raw = calculateBusinessMinutesElapsed(
          row.createdAt,
          row.resolvedAt,
        );
        const effective = Math.max(0, raw - (row.onHoldTotalMinutes || 0));
        if (Number.isFinite(effective)) ttrMinutesSamples.push(effective);
      }
    }
    const avgFrtMinutes = frtMinutesSamples.length
      ? frtMinutesSamples.reduce((a, b) => a + b, 0) / frtMinutesSamples.length
      : null;
    const avgTtrMinutes = ttrMinutesSamples.length
      ? ttrMinutesSamples.reduce((a, b) => a + b, 0) / ttrMinutesSamples.length
      : null;

    // Status breakdown
    const statusBreakdown = await db
      .select({ status: tickets.status, count: count() })
      .from(tickets)
      .groupBy(tickets.status);

    const statusMap = statusBreakdown.reduce(
      (acc, row) => ({ ...acc, [row.status]: row.count }),
      {} as Record<string, number>,
    );

    // CSAT + NPS summaries — reuse existing methods so we only compute
    // these numbers in one place. Used to populate the main KPI cards
    // and the right-rail CSAT widget.
    const csatSummary = await this.getCsatSummary();
    const npsSummary = await this.getNpsSummary();

    // SLA compliance % = (resolved_or_closed - breached) / resolved_or_closed
    // The breachCount query above counts tickets with either FRT or TTR
    // breached. We divide against resolved+closed because that is the
    // denominator of "what had a chance to meet SLA".
    const totalResolved = Number(statusMap['resolved'] ?? 0);
    const totalClosed = Number(statusMap['closed'] ?? 0);
    const totalResolvedOrClosed = totalResolved + totalClosed;
    const totalBreaches = Number(breachCount?.count ?? 0);
    const slaCompliance =
      totalResolvedOrClosed > 0
        ? Math.max(
            0,
            Math.round(
              ((totalResolvedOrClosed - totalBreaches) /
                totalResolvedOrClosed) *
                100,
            ),
          )
        : 100;

    return {
      openTickets: openCount?.count ?? 0,
      highPriorityOpen: highCount?.count ?? 0,
      slaBreaches: totalBreaches,
      slaCompliance,
      avgFrtMinutes:
        avgFrtMinutes == null ? null : Math.round(avgFrtMinutes),
      avgTtrMinutes:
        avgTtrMinutes == null ? null : Math.round(avgTtrMinutes),
      // Pre-rounded hours for UI display (10ths). Frontend can use the
      // raw avgTtrMinutes if it needs more precision.
      avgResolutionHours:
        avgTtrMinutes == null
          ? null
          : Math.round((avgTtrMinutes / 60) * 10) / 10,
      resolvedThisWeek: Number(resolvedThisWeekRow?.count ?? 0),
      csatAvgScore: csatSummary.avgScore,
      csatResponses: csatSummary.totalResponded,
      csatResponseRate: csatSummary.responseRate,
      npsScore: npsSummary.npsScore,
      npsResponses: npsSummary.totalResponded,
      statusBreakdown: statusMap,
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
   * Pick the next agent for a new ticket, honouring the admin-controlled
   * auto-assignment config:
   *   - enabled=false        → return null (manual queue handover)
   *   - strategy='manual'    → return null (same; supervisor picks up)
   *   - respectBusinessHours → return null outside hours (queue waits)
   *   - maxConcurrentPerAgent → exclude agents already at/above cap
   *   - strategy='least_loaded' → pick the eligible agent with the fewest
   *                               open tickets (tiebreak by round-robin
   *                               pointer for fairness)
   *   - strategy='round_robin'  → existing rotation logic over eligibles
   *
   * Fallbacks asked-about explicitly (avoid orphaned tickets):
   *   - No agents in roster        → fall back to supervisor (if any)
   *   - All agents at/above cap    → fall back to supervisor (if any)
   *   - No supervisor either       → return null (admin sees in queue)
   *
   * Original guarantees preserved: pointer txn with FOR UPDATE prevents
   * two concurrent creates from landing on the same agent; FRT-breached
   * agents are deprioritised (now applied as a soft skip, not a hard
   * filter, so heavy days don't starve the queue).
   */
  private async findNextAgent(): Promise<string | null> {
    const cfg = await this.getAutoAssignment();

    // Master OFF or manual mode → supervisor handles assignment.
    if (!cfg.enabled || cfg.strategy === 'manual') {
      return null;
    }

    // Outside business hours? Don't ping anyone — let it wait in queue
    // for the next opening. Supervisor still sees it in unassigned.
    if (cfg.respectBusinessHours) {
      await refreshBusinessHoursConfigIfStale(() => this.getBusinessHours());
      if (!isWithinBusinessHours(new Date())) {
        return null;
      }
    }

    const agents = await this.getAgentRoster();

    // No agents at all → supervisor is the only option (Q1 you asked).
    if (agents.length === 0) {
      return this.findSupervisorId();
    }

    // Filter by maxConcurrentPerAgent if set (0 = unlimited).
    let eligible = agents;
    if (cfg.maxConcurrentPerAgent > 0) {
      const loads = await this.getAgentOpenTicketCounts(
        agents.map((a) => a.userId),
      );
      eligible = agents.filter(
        (a) => (loads.get(a.userId) || 0) < cfg.maxConcurrentPerAgent,
      );
    }

    // Every agent at/above cap → supervisor takes overflow (Q2 you asked).
    if (eligible.length === 0) {
      return this.findSupervisorId();
    }

    if (eligible.length === 1) return eligible[0].userId;

    // Least-loaded: pick lowest open-ticket count among eligibles.
    // Tiebreak via the round-robin pointer so two equally loaded agents
    // still rotate fairly. No pointer advance — pointer is owned by the
    // round_robin strategy below.
    if (cfg.strategy === 'least_loaded') {
      const loads = await this.getAgentOpenTicketCounts(
        eligible.map((a) => a.userId),
      );
      let bestLoad = Number.POSITIVE_INFINITY;
      const candidates: typeof eligible = [];
      for (const a of eligible) {
        const n = loads.get(a.userId) || 0;
        if (n < bestLoad) {
          bestLoad = n;
          candidates.length = 0;
          candidates.push(a);
        } else if (n === bestLoad) {
          candidates.push(a);
        }
      }
      const [{ value: pointerRow }] = await db
        .select({ value: supportConfig.value })
        .from(supportConfig)
        .where(eq(supportConfig.key, 'round_robin_pointer'))
        .limit(1)
        .then((rows) => (rows.length ? rows : [{ value: 0 as any }]));
      const pointer = Number.isFinite(Number(pointerRow))
        ? Number(pointerRow)
        : 0;
      return candidates[pointer % candidates.length].userId;
    }

    // Default: round-robin with persistent pointer + soft FRT-breach skip.
    // The whole pointer-advance block stays atomic via SELECT ... FOR UPDATE.
    return db.transaction(async (tx) => {
      const [config] = await tx
        .select({ value: supportConfig.value })
        .from(supportConfig)
        .where(eq(supportConfig.key, 'round_robin_pointer'))
        .for('update');

      let pointer = config ? Number(config.value) : 0;
      if (isNaN(pointer)) pointer = 0;

      for (let i = 0; i < eligible.length; i++) {
        const index = (pointer + i) % eligible.length;
        const agent = eligible[index];

        const [breachedTicket] = await tx
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
          const newPointer = (pointer + i + 1) % eligible.length;
          await tx
            .insert(supportConfig)
            .values({
              key: 'round_robin_pointer',
              value: newPointer,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: supportConfig.key,
              set: { value: newPointer, updatedAt: new Date() },
            });

          return agent.userId;
        }
      }

      // All eligibles have FRT breaches — fall back to pointer agent.
      const fallbackIndex = pointer % eligible.length;
      const newPointer = (pointer + 1) % eligible.length;
      await tx
        .insert(supportConfig)
        .values({
          key: 'round_robin_pointer',
          value: newPointer,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: supportConfig.key,
          set: { value: newPointer, updatedAt: new Date() },
        });

      return eligible[fallbackIndex].userId;
    });
  }

  /**
   * Count open tickets per agent. Used by least_loaded strategy and the
   * maxConcurrentPerAgent cap. "Open" = NEW or IN_PROGRESS (ON_HOLD is
   * paused-waiting-on-student and shouldn't count against capacity since
   * the agent isn't actively working it).
   */
  private async getAgentOpenTicketCounts(
    agentIds: string[],
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (agentIds.length === 0) return result;
    const rows = await db
      .select({ assigneeId: tickets.assigneeId, n: count() })
      .from(tickets)
      .where(
        and(
          inArray(tickets.assigneeId, agentIds),
          inArray(tickets.status, [
            TICKET_STATUS.NEW,
            TICKET_STATUS.IN_PROGRESS,
          ]),
        ),
      )
      .groupBy(tickets.assigneeId);
    for (const r of rows) {
      if (r.assigneeId) result.set(r.assigneeId, Number(r.n));
    }
    return result;
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
    let eligible = agents.filter(
      (a) => !excludeAgentIds.includes(a.userId),
    );

    if (eligible.length === 0) return null; // RR-12: all agents exhausted

    // Honour maxConcurrentPerAgent so SLA breach reassignment doesn't
    // dump on someone already at capacity. If the cap squeezes us down
    // to zero candidates, return null and let the caller escalate to
    // the supervisor (same fallback path as "no agents at all").
    const cfg = await this.getAutoAssignment();
    if (cfg.maxConcurrentPerAgent > 0) {
      const loads = await this.getAgentOpenTicketCounts(
        eligible.map((a) => a.userId),
      );
      eligible = eligible.filter(
        (a) => (loads.get(a.userId) || 0) < cfg.maxConcurrentPerAgent,
      );
      if (eligible.length === 0) return null;
    }

    // Read pointer
    const [config] = await db
      .select()
      .from(supportConfig)
      .where(eq(supportConfig.key, 'round_robin_pointer'));

    const pointer = config ? Number(config.value) : 0;

    // Pick next eligible agent from rotation
    for (let i = 0; i < agents.length; i++) {
      const index = (pointer + i) % agents.length;
      const agent = agents[index];
      if (eligible.some((e) => e.userId === agent.userId)) {
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

  /**
   * Find all ADMIN / SUPER_ADMIN user IDs. Used to fan out escalation
   * notifications alongside the supervisor — admins should know when
   * an SLA breaches even though they're not in the day-to-day support
   * rotation. Returns an empty array if no admins exist (safe no-op
   * for senders).
   */
  async findAdminUserIds(): Promise<string[]> {
    const adminRoleRows = await db
      .select({ id: roles.id })
      .from(roles)
      .where(
        inArray(roles.name, [
          ROLE_NAMES.ADMIN,
          ROLE_NAMES.SUPER_ADMIN,
        ] as string[]),
      );
    if (!adminRoleRows.length) return [];

    const rows = await db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(
        inArray(
          userRoles.roleId,
          adminRoleRows.map((r) => r.id),
        ),
      );

    // Dedupe — a single user can hold both ADMIN and SUPER_ADMIN rows.
    return Array.from(new Set(rows.map((r) => r.userId)));
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

    // Detractor follow-up: score 1 or 2 → send follow-up email.
    // For guest tickets the survey userId is the sentinel GUEST_USER_ID —
    // use the ticket's stored guestEmail/guestName instead of the sentinel
    // user's row so the follow-up actually reaches the real guest.
    if (score <= 2) {
      try {
        let recipientEmail: string | null = null;
        let recipientName: string = 'Student';

        if (survey.userId === GUEST_USER_ID) {
          const [guestTicket] = await db
            .select({
              guestEmail: tickets.guestEmail,
              guestName: tickets.guestName,
            })
            .from(tickets)
            .where(eq(tickets.id, survey.ticketId));
          if (guestTicket?.guestEmail) {
            recipientEmail = guestTicket.guestEmail;
            recipientName = guestTicket.guestName || 'Guest';
          }
        } else {
          const [userInfo] = await db
            .select({ email: users.email, firstName: users.firstName })
            .from(users)
            .where(eq(users.id, survey.userId));
          if (userInfo?.email) {
            recipientEmail = userInfo.email;
            recipientName = userInfo.firstName || 'Student';
          }
        }

        if (recipientEmail) {
          await this.emailService.sendCsatFollowup(
            recipientEmail,
            recipientName,
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

  /**
   * NPS-equivalent score derived from the existing student course ratings
   * (1–5 stars). The dedicated nps_surveys flow was removed because it
   * duplicated the in-app review modal — see docs/support-dashboard/work-plan.md.
   *
   * Mapping (1–5 star → standard NPS buckets):
   *   1–2 stars → detractor
   *   3 stars   → passive
   *   4–5 stars → promoter
   *
   * NPS = ((promoters - detractors) / totalScored) × 100, range -100..+100.
   */
  async getNpsSummary() {
    const allRatings = await db
      .select({ rating: courseRatings.rating })
      .from(courseRatings);

    const total = allRatings.length;
    const scores = allRatings.map((r) => r.rating);

    let promoters = 0;
    let passives = 0;
    let detractors = 0;
    for (const s of scores) {
      if (s >= 4) promoters++;
      else if (s === 3) passives++;
      else detractors++;
    }

    const totalScored = scores.length;
    const npsScore =
      totalScored > 0
        ? Math.round(((promoters - detractors) / totalScored) * 100)
        : 0;

    return {
      // Derived from course_ratings — `totalSent` and `responseRate`
      // no longer have an equivalent (ratings are voluntary in-app, not
      // emailed). Kept as 0/100 for response-shape compatibility with
      // the old NPS surveys endpoint.
      totalSent: total,
      totalResponded: total,
      responseRate: total > 0 ? 100 : 0,
      promoters,
      passives,
      detractors,
      npsScore,
    };
  }

  // ─── Guest Ticket (Login Issues Only) ──────────────────

  async createGuestTicket(dto: CreateGuestTicketDto) {
    // Anti-abuse: verify reCAPTCHA before doing anything else.
    // RecaptchaService.verify() is a no-op when the server secret is
    // unset (e.g. local dev) so this stays backwards-compatible.
    if (dto.recaptchaToken) {
      await this.recaptchaService.verify(dto.recaptchaToken, 'guest-ticket');
    }

    // Server-side guard: guest tickets are restricted to login issues.
    // DTO @IsIn(['login']) covers the happy path; this catches any caller
    // that bypasses DTO validation (e.g. a future internal call site).
    if (dto.category !== 'login') {
      throw new BadRequestException(
        'Guest tickets are only allowed for login issues',
      );
    }

    // M8: Rate-limit guest ticket creation — max 3 per email per 24h
    if (dto.email) {
      const TWENTY_FOUR_HOURS_AGO = new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      );
      const [recentCount] = await db
        .select({ count: count() })
        .from(tickets)
        .where(
          and(
            eq(tickets.guestEmail, dto.email.toLowerCase()),
            gte(tickets.createdAt, TWENTY_FOUR_HOURS_AGO),
          ),
        );
      if ((recentCount?.count ?? 0) >= 3) {
        throw new BadRequestException(
          'You have reached the maximum number of tickets (3) for today. Please try again tomorrow.',
        );
      }
    }

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

    // Guest tickets are DTO-locked to 'login' but resolve via the live
    // map anyway so admin overrides on built-in priorities take effect.
    // Fall back to HIGH (the historical guest default) rather than MEDIUM.
    const resolvedGuest = await this.resolveCategoryPriority(dto.category);
    const autoPriority = resolvedGuest.isValidSlug
      ? resolvedGuest.priority
      : TICKET_PRIORITY.HIGH;
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

    // Notify assigned agent (respects support staff in-app master)
    if (assigneeId && (await this.shouldNotifySupport(assigneeId, 'inApp'))) {
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

    // CSAT survey — only attach for resolved/closed tickets so the
    // tracking page can show a rating widget. For still-open tickets
    // we return null (widget hidden).
    let csatSurvey: {
      id: string;
      score: number | null;
      submittedAt: string | null;
      sentAt: string;
      expired: boolean;
      alreadySubmitted: boolean;
    } | null = null;

    if (
      ticket.status === TICKET_STATUS.RESOLVED ||
      ticket.status === TICKET_STATUS.CLOSED
    ) {
      const [survey] = await db
        .select({
          id: csatSurveys.id,
          score: csatSurveys.score,
          submittedAt: csatSurveys.submittedAt,
          sentAt: csatSurveys.sentAt,
        })
        .from(csatSurveys)
        .where(eq(csatSurveys.ticketId, ticket.id))
        .limit(1);

      if (survey) {
        const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;
        const expired =
          Date.now() - new Date(survey.sentAt).getTime() >
          SEVENTY_TWO_HOURS_MS;
        csatSurvey = {
          id: survey.id,
          score: survey.score,
          submittedAt: survey.submittedAt
            ? new Date(survey.submittedAt).toISOString()
            : null,
          sentAt: new Date(survey.sentAt).toISOString(),
          expired,
          alreadySubmitted: !!survey.submittedAt,
        };
      }
    }

    return {
      ...ticket,
      comments,
      slaPolicy: slaPolicy || null,
      csatSurvey,
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

    // Notify agent (respects support staff in-app master)
    if (
      ticket.assigneeId &&
      (await this.shouldNotifySupport(ticket.assigneeId, 'inApp'))
    ) {
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

    const { priority: autoPriority, isValidSlug: validCat } =
      await this.resolveCategoryPriority(dto.category);
    if (!validCat) {
      throw new BadRequestException(
        `Unknown category "${dto.category}". Ask an admin to add it under Settings → Categories.`,
      );
    }
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

  /**
   * Daily ticket trend within the given window — used to render the
   * volume-over-time bar chart on the supervisor Reports page.
   *
   * Returns one row per UTC day where any of the following happened:
   *   - a ticket was created
   *   - a ticket was resolved (only counts created ≤ resolved bucket)
   *
   * Empty days inside the window are emitted with zero counts so the
   * client doesn't have to backfill gaps.
   */
  async getTicketTrend(
    dateFrom?: string,
    dateTo?: string,
    interval: 'day' | 'week' = 'day',
  ) {
    // Default window: last 30 days when no range is supplied.
    const end = dateTo ? new Date(dateTo) : new Date();
    const start = dateFrom
      ? new Date(dateFrom)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const trunc = interval === 'week' ? 'week' : 'day';

    const created = await db
      .select({
        bucket: sql<string>`to_char(date_trunc(${trunc}, ${tickets.createdAt}), 'YYYY-MM-DD')`,
        count: count(),
      })
      .from(tickets)
      .where(
        and(
          sql`${tickets.createdAt} >= ${start}`,
          sql`${tickets.createdAt} <= ${end}`,
        ),
      )
      .groupBy(sql`date_trunc(${trunc}, ${tickets.createdAt})`)
      .orderBy(sql`date_trunc(${trunc}, ${tickets.createdAt})`);

    const resolved = await db
      .select({
        bucket: sql<string>`to_char(date_trunc(${trunc}, ${tickets.resolvedAt}), 'YYYY-MM-DD')`,
        count: count(),
      })
      .from(tickets)
      .where(
        and(
          sql`${tickets.resolvedAt} IS NOT NULL`,
          sql`${tickets.resolvedAt} >= ${start}`,
          sql`${tickets.resolvedAt} <= ${end}`,
        ),
      )
      .groupBy(sql`date_trunc(${trunc}, ${tickets.resolvedAt})`)
      .orderBy(sql`date_trunc(${trunc}, ${tickets.resolvedAt})`);

    // Merge into a single keyed map then backfill empty buckets so the
    // chart shows a continuous timeline.
    const createdMap = new Map(created.map((r) => [r.bucket, Number(r.count)]));
    const resolvedMap = new Map(resolved.map((r) => [r.bucket, Number(r.count)]));

    const out: { bucket: string; created: number; resolved: number }[] = [];
    const step = interval === 'week' ? 7 * 86400_000 : 86400_000;
    // Anchor to UTC midnight so the bucket labels match Postgres' truncation.
    const cursor = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
    );
    if (interval === 'week') {
      // Postgres' date_trunc('week') anchors to Monday — match it client-side.
      const dow = (cursor.getUTCDay() + 6) % 7;
      cursor.setUTCDate(cursor.getUTCDate() - dow);
    }
    const endTs = end.getTime();
    while (cursor.getTime() <= endTs) {
      const key = cursor.toISOString().slice(0, 10);
      out.push({
        bucket: key,
        created: createdMap.get(key) ?? 0,
        resolved: resolvedMap.get(key) ?? 0,
      });
      cursor.setTime(cursor.getTime() + step);
    }
    return out;
  }

  /**
   * Recent CSAT survey comments — feeds the "Latest feedback" strip on
   * the Reports → CSAT/NPS view. Skips submissions without a comment.
   */
  async getRecentCsatComments(limit: number = 10) {
    const rows = await db
      .select({
        id: csatSurveys.id,
        score: csatSurveys.score,
        comment: csatSurveys.comment,
        submittedAt: csatSurveys.submittedAt,
        ticketId: csatSurveys.ticketId,
        ticketSubject: tickets.subject,
        assigneeFirstName: users.firstName,
        assigneeLastName: users.lastName,
      })
      .from(csatSurveys)
      .innerJoin(tickets, eq(csatSurveys.ticketId, tickets.id))
      .leftJoin(users, eq(tickets.assigneeId, users.id))
      .where(
        and(
          sql`${csatSurveys.comment} IS NOT NULL`,
          sql`length(${csatSurveys.comment}) > 0`,
        ),
      )
      .orderBy(desc(csatSurveys.submittedAt))
      .limit(Math.min(Math.max(limit, 1), 50));
    return rows;
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

  // ─── Per-User Performance ──────────────────────────────
  // Used by the support dashboard sidebar profile card to show the
  // logged-in agent or supervisor their own resolved count, CSAT average,
  // and average FRT. Cheaper than getAgentPerformance (which loops all
  // agents) and also includes CSAT, which getAgentPerformance does not.

  async getMyPerformance(userId: string) {
    // 1. All tickets where this user is the assignee
    const userTickets = await db
      .select({
        id: tickets.id,
        firstResponseAt: tickets.firstResponseAt,
        createdAt: tickets.createdAt,
        resolvedAt: tickets.resolvedAt,
        slaBreachedFrt: tickets.slaBreachedFrt,
        slaBreachedTtr: tickets.slaBreachedTtr,
      })
      .from(tickets)
      .where(eq(tickets.assigneeId, userId));

    const totalTickets = userTickets.length;
    const resolvedCount = userTickets.filter((t) => t.resolvedAt).length;

    // Avg FRT in business minutes
    const frtSamples = userTickets
      .filter((t) => t.firstResponseAt)
      .map((t) =>
        calculateBusinessMinutesElapsed(t.createdAt, t.firstResponseAt!),
      )
      .filter((m) => Number.isFinite(m) && m >= 0);
    const avgFrtMinutes =
      frtSamples.length > 0
        ? Math.round(
            frtSamples.reduce((a, b) => a + b, 0) / frtSamples.length,
          )
        : null;

    // 2. Per-user CSAT — join csat_surveys via ticket.assigneeId so we
    // only count ratings on tickets this user actually resolved.
    const userCsat = await db
      .select({ score: csatSurveys.score })
      .from(csatSurveys)
      .innerJoin(tickets, eq(csatSurveys.ticketId, tickets.id))
      .where(
        and(
          eq(tickets.assigneeId, userId),
          sql`${csatSurveys.score} IS NOT NULL`,
        ),
      );

    const csatScores = userCsat
      .map((r) => r.score)
      .filter((s): s is number => s != null);
    const csatAvgScore =
      csatScores.length > 0
        ? Math.round(
            (csatScores.reduce((a, b) => a + b, 0) / csatScores.length) *
              10,
          ) / 10
        : null;

    return {
      totalTickets,
      resolvedCount,
      avgFrtMinutes,
      csatAvgScore,
      csatResponses: csatScores.length,
      frtBreaches: userTickets.filter((t) => t.slaBreachedFrt).length,
      ttrBreaches: userTickets.filter((t) => t.slaBreachedTtr).length,
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
          status: tickets.status,
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

      // Open tickets count (currently NEW / IN_PROGRESS / ON_HOLD)
      const openTickets = agentTickets.filter(
        (t) =>
          t.status === TICKET_STATUS.NEW ||
          t.status === TICKET_STATUS.IN_PROGRESS ||
          t.status === TICKET_STATUS.ON_HOLD,
      ).length;

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

      // Per-agent CSAT avg — only count ratings on tickets this agent
      // was assigned to
      const agentCsat = await db
        .select({ score: csatSurveys.score })
        .from(csatSurveys)
        .innerJoin(tickets, eq(csatSurveys.ticketId, tickets.id))
        .where(
          and(
            eq(tickets.assigneeId, agent.userId),
            sql`${csatSurveys.score} IS NOT NULL`,
          ),
        );
      const csatScores = agentCsat
        .map((r) => r.score)
        .filter((s): s is number => s != null);
      const csatAvgScore =
        csatScores.length > 0
          ? Math.round(
              (csatScores.reduce((a, b) => a + b, 0) / csatScores.length) *
                10,
            ) / 10
          : null;

      results.push({
        userId: agent.userId,
        name: [agent.firstName, agent.lastName].filter(Boolean).join(' '),
        totalTickets: agentTickets.length,
        openTickets,
        resolvedTickets: resolved.length,
        avgFrtMinutes: avgFrt,
        csatAvgScore,
        csatResponses: csatScores.length,
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
    // Each column is [displayLabel, rowKey] — display label is the human
    // text shown in the CSV header; rowKey is the actual property on the
    // result row. The previous "derive key from label by lowercasing"
    // hack turned "Avg FRT (min)" → "avg_frt_min" but the real key is
    // `avgFrtMinutes`, so those cells silently came out empty.
    const columns = this.getReportColumns(type, 'csv');
    const data = await this.fetchReportData(type, dateFrom, dateTo);

    // Generate CSV with NELC audit evidence metadata
    // The first 3 rows contain: report_generated_at, filters_applied,
    // generated_by context so NELC auditors can trace provenance.
    const now = new Date();
    const filtersApplied = [
      dateFrom ? `dateFrom=${dateFrom}` : null,
      dateTo ? `dateTo=${dateTo}` : null,
      `type=${type}`,
    ]
      .filter(Boolean)
      .join('; ');

    const metaRows = [
      `# report_generated_at: ${now.toISOString()}`,
      `# filters_applied: ${filtersApplied}`,
      `# report_type: ${type}`,
    ];

    const headerRow = columns.map(([label]) => label).join(',');
    const csvRows = [...metaRows, '', headerRow];
    for (const row of data) {
      const values = columns.map(([, key]) =>
        JSON.stringify(row[key] ?? ''),
      );
      csvRows.push(values.join(','));
    }

    return {
      csv: csvRows.join('\n'),
      filename: `support_report_${type}_${now.toISOString().split('T')[0]}.csv`,
    };
  }

  // Single source of truth for the columns of each support report.
  // Reused by CSV and PDF exporters so they stay in sync. Adding a
  // column means editing exactly one place.
  private getReportColumns(
    type: string,
    _format: 'csv' | 'pdf',
  ): Array<[string, string]> {
    switch (type) {
      case 'volume':
        return [
          ['Category', 'category'],
          ['Status', 'status'],
          ['Priority', 'priority'],
          ['Count', 'count'],
        ];
      case 'issues':
        return [
          ['Category', 'category'],
          ['Count', 'count'],
        ];
      case 'sla':
        return [
          ['Total Resolved', 'totalResolved'],
          ['Within SLA', 'resolvedWithinSla'],
          ['Compliance %', 'complianceRate'],
          ['FRT Compliance %', 'frtCompliance'],
          ['TTR Compliance %', 'ttrCompliance'],
        ];
      case 'agents':
      case 'agent-performance':
        return [
          ['Agent', 'name'],
          ['Total Tickets', 'totalTickets'],
          ['Open', 'openTickets'],
          ['Resolved', 'resolvedTickets'],
          ['Avg FRT (min)', 'avgFrtMinutes'],
          ['CSAT', 'csatAvgScore'],
          ['FRT Breaches', 'frtBreaches'],
          ['TTR Breaches', 'ttrBreaches'],
        ];
      default:
        throw new BadRequestException('Invalid report type');
    }
  }

  private async fetchReportData(
    type: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<any[]> {
    switch (type) {
      case 'volume':
        return this.getVolumeReport(dateFrom, dateTo);
      case 'issues':
        return this.getTopIssues(dateFrom, dateTo);
      case 'sla': {
        const sla = await this.getSlaComplianceReport(dateFrom, dateTo);
        return [sla];
      }
      case 'agents':
      case 'agent-performance':
        return this.getAgentPerformance(dateFrom, dateTo);
      default:
        throw new BadRequestException('Invalid report type');
    }
  }

  async exportReportPdf(
    type: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<Buffer> {
    const columns = this.getReportColumns(type, 'pdf');
    const data = await this.fetchReportData(type, dateFrom, dateTo);
    const headers = columns.map(([label]) => label);
    const title = (() => {
      switch (type) {
        case 'volume':
          return 'Ticket Volume Report';
        case 'issues':
          return 'Top Issues Report';
        case 'sla':
          return 'SLA Compliance Report';
        case 'agents':
        case 'agent-performance':
          return 'Agent Performance Report';
        default:
          throw new BadRequestException('Invalid report type');
      }
    })();

    const now = new Date();
    const filtersApplied = [
      dateFrom ? `From: ${dateFrom}` : null,
      dateTo ? `To: ${dateTo}` : null,
    ]
      .filter(Boolean)
      .join(' | ');

    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
          info: {
            Title: title,
            Author: 'PhysioGuidance Support System',
            Subject: `${title} — Generated ${now.toISOString()}`,
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // ─── Header ───────────────────────────────
        doc
          .fontSize(8)
          .fillColor('#6B7280')
          .text(
            'PhysioGuidance eLearning Platform  |  Support Dashboard  |  Gamma Developers',
            40,
            25,
          );

        doc
          .moveTo(40, 40)
          .lineTo(555, 40)
          .strokeColor('#E5E7EB')
          .stroke();

        // Title
        doc.fontSize(18).fillColor('#111827').text(title, 40, 55);

        // Meta
        doc
          .fontSize(9)
          .fillColor('#6B7280')
          .text(`Generated: ${now.toLocaleString()}`, 40, 80)
          .text(
            filtersApplied ? `Filters: ${filtersApplied}` : 'Filters: All time',
            40,
            93,
          )
          .text(`Report type: ${type}`, 40, 106);

        doc
          .moveTo(40, 122)
          .lineTo(555, 122)
          .strokeColor('#E5E7EB')
          .stroke();

        // ─── Table ────────────────────────────────
        const tableTop = 135;
        const colWidth = Math.floor(515 / headers.length);
        const rowHeight = 22;

        // Table header
        doc.rect(40, tableTop, 515, rowHeight).fill('#111827');
        headers.forEach((h, i) => {
          doc
            .fontSize(8)
            .fillColor('#FFFFFF')
            .text(h, 44 + i * colWidth, tableTop + 6, {
              width: colWidth - 8,
              align: 'left',
            });
        });

        // Table rows
        data.forEach((row, rowIdx) => {
          const y = tableTop + rowHeight + rowIdx * rowHeight;

          if (y > 760) return; // page overflow guard (simple single-page)

          if (rowIdx % 2 === 0) {
            doc.rect(40, y, 515, rowHeight).fill('#F9FAFB');
          }

          columns.forEach(([, key], colIdx) => {
            const value = String(row[key] ?? '');
            doc
              .fontSize(8)
              .fillColor('#374151')
              .text(value, 44 + colIdx * colWidth, y + 6, {
                width: colWidth - 8,
                align: 'left',
              });
          });
        });

        // ─── Footer ───────────────────────────────
        const footerY = 780;
        doc
          .moveTo(40, footerY)
          .lineTo(555, footerY)
          .strokeColor('#E5E7EB')
          .stroke();
        doc
          .fontSize(7)
          .fillColor('#9CA3AF')
          .text(
            `Confidential — Gamma Developers © ${now.getFullYear()}  |  report_generated_at: ${now.toISOString()}`,
            40,
            footerY + 5,
            { align: 'center', width: 515 },
          );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ─── Admin Support KPIs ────────────────────────────────
  // Kept as a thin alias over getKPIs() since getKPIs now includes
  // CSAT + NPS + SLA compliance fields. Preserved for any existing
  // admin widget that hits /api/tickets/admin/support-kpis.

  async getAdminSupportKpis() {
    const kpis = await this.getKPIs();
    return {
      avgFrtMinutes: kpis.avgFrtMinutes,
      avgTtrMinutes: kpis.avgTtrMinutes,
      openTickets: kpis.openTickets,
      slaBreaches: kpis.slaBreaches,
      csatAvgScore: kpis.csatAvgScore,
      npsScore: kpis.npsScore,
      csatResponseRate: kpis.csatResponseRate,
      statusBreakdown: kpis.statusBreakdown,
    };
  }

  // ─── SLA Policy CRUD ──────────────────────────────────

  // ─── Escalation Paths CRUD ──────────────────────────────

  async getEscalationPaths() {
    return db
      .select()
      .from(escalationPaths)
      .where(eq(escalationPaths.active, true))
      .orderBy(asc(escalationPaths.name));
  }

  async createEscalationPath(dto: {
    name: string;
    steps: { afterMinutes: number; assignToRole: string }[];
  }) {
    // Validate steps are in ascending afterMinutes order
    for (let i = 1; i < dto.steps.length; i++) {
      if (dto.steps[i].afterMinutes <= dto.steps[i - 1].afterMinutes) {
        throw new BadRequestException(
          'Escalation steps must be in ascending afterMinutes order',
        );
      }
    }

    const [path] = await db
      .insert(escalationPaths)
      .values({
        name: dto.name,
        steps: dto.steps,
      })
      .returning();

    return path;
  }

  async updateEscalationPath(
    id: string,
    dto: {
      name?: string;
      steps?: { afterMinutes: number; assignToRole: string }[];
      active?: boolean;
    },
  ) {
    if (dto.steps) {
      for (let i = 1; i < dto.steps.length; i++) {
        if (dto.steps[i].afterMinutes <= dto.steps[i - 1].afterMinutes) {
          throw new BadRequestException(
            'Escalation steps must be in ascending afterMinutes order',
          );
        }
      }
    }

    const updateData: Record<string, any> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.steps !== undefined) updateData.steps = dto.steps;
    if (dto.active !== undefined) updateData.active = dto.active;

    const [updated] = await db
      .update(escalationPaths)
      .set(updateData)
      .where(eq(escalationPaths.id, id))
      .returning();

    if (!updated)
      throw new NotFoundException(`Escalation path ${id} not found`);
    return updated;
  }

  async deleteEscalationPath(id: string) {
    const [updated] = await db
      .update(escalationPaths)
      .set({ active: false })
      .where(eq(escalationPaths.id, id))
      .returning();

    if (!updated)
      throw new NotFoundException(`Escalation path ${id} not found`);
    return updated;
  }

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

    // Fetch ticket with student + course + agent info. Pulls the 5
    // extra ticket fields needed for the expanded variable set so the
    // substitution pass below stays single-query.
    const [ticket] = await db
      .select({
        id: tickets.id,
        studentId: tickets.studentId,
        courseId: tickets.courseId,
        assigneeId: tickets.assigneeId,
        guestName: tickets.guestName,
        subject: tickets.subject,
        priority: tickets.priority,
        category: tickets.category,
        status: tickets.status,
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

    // For a friendlier greeting we expose just the first token of the
    // learner name. Falls back to the full name if there's no whitespace.
    const learnerFirstName = (learnerName.split(/\s+/)[0] || learnerName).trim();

    // Variable resolution — original 4 + 5 new ticket-field shortcuts.
    let resolvedBody = macro.bodyTemplate;
    resolvedBody = resolvedBody.replace(/\{\{learner_name\}\}/g, learnerName);
    resolvedBody = resolvedBody.replace(/\{\{learner_first_name\}\}/g, learnerFirstName);
    resolvedBody = resolvedBody.replace(/\{\{course_name\}\}/g, courseName);
    resolvedBody = resolvedBody.replace(/\{\{ticket_id\}\}/g, ticketId.substring(0, 8));
    resolvedBody = resolvedBody.replace(/\{\{ticket_subject\}\}/g, ticket.subject || '');
    resolvedBody = resolvedBody.replace(/\{\{ticket_priority\}\}/g, ticket.priority || '');
    resolvedBody = resolvedBody.replace(/\{\{ticket_category\}\}/g, ticket.category || '');
    resolvedBody = resolvedBody.replace(/\{\{ticket_status\}\}/g, ticket.status || '');
    resolvedBody = resolvedBody.replace(/\{\{agent_name\}\}/g, agentName);

    // Replace any remaining unresolved {{...}} with empty string
    resolvedBody = resolvedBody.replace(/\{\{[^}]*\}\}/g, '');

    // Append KB article URLs — validate each still points to a published
    // article before including it. Silently skip unpublished/deleted ones
    // so learners never see dead links. External URLs (no UUID match)
    // pass through without validation.
    const urls = macro.kbArticleUrls as string[] | null;
    if (urls && urls.length > 0) {
      const validUrls: string[] = [];
      for (const url of urls) {
        const idMatch = url.match(
          /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
        );
        if (idMatch) {
          const [article] = await db
            .select({ id: kbArticles.id })
            .from(kbArticles)
            .where(
              and(
                eq(kbArticles.id, idMatch[1]),
                eq(kbArticles.published, true),
              ),
            )
            .limit(1);
          if (article) validUrls.push(url);
          // else: article unpublished/deleted — omit silently
        } else {
          validUrls.push(url); // external URL, no validation needed
        }
      }
      if (validUrls.length > 0) {
        resolvedBody += '\n\n---\nRelated articles:';
        for (const vUrl of validUrls) {
          resolvedBody += `\n- ${vUrl}`;
        }
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
          ilike(kbArticles.bodyAr, `%${filters.search}%`),
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

  // ============================================================
  // Support Team Membership + Admin-Mediated Requests
  // ============================================================

  /**
   * Agents on the given supervisor's team, enriched with each agent's
   * live performance metrics. Excludes the supervisor themselves —
   * a supervisor owns a team, they aren't a team member.
   */
  async listMyTeam(supervisorId: string) {
    const rows = await db
      .select({
        membershipId: supportTeamMembers.id,
        agentId: supportTeamMembers.agentId,
        assignedAt: supportTeamMembers.assignedAt,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatar: users.avatar,
        phone: users.phone,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        supportSubRole: userRoles.supportSubRole,
      })
      .from(supportTeamMembers)
      .innerJoin(users, eq(supportTeamMembers.agentId, users.id))
      .leftJoin(
        userRoles,
        and(
          eq(userRoles.userId, supportTeamMembers.agentId),
          // SUPPORT role row only — avoids duplicating per-role join hits.
          sql`${userRoles.roleId} IN (SELECT id FROM ${roles} WHERE name = ${ROLE_NAMES.SUPPORT})`,
        ),
      )
      .where(eq(supportTeamMembers.supervisorId, supervisorId))
      .orderBy(asc(users.firstName));

    if (rows.length === 0) return [];

    // Pull performance for these agents only — reuses the existing
    // agent-performance computation per row to keep the math identical
    // to the Reports page.
    const perfRows = await this.getAgentPerformance();
    const perfById = new Map(perfRows.map((p: any) => [p.userId, p]));

    return rows.map((r) => ({
      membershipId: r.membershipId,
      userId: r.agentId,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email,
      avatar: r.avatar,
      phone: r.phone,
      isActive: r.isActive,
      lastLoginAt: r.lastLoginAt,
      assignedAt: r.assignedAt,
      supportSubRole: r.supportSubRole,
      performance: perfById.get(r.agentId) ?? null,
    }));
  }

  /**
   * Detail view for a single team member — used by the side sheet.
   * Includes their open tickets and last 5 CSAT comments.
   * Guard: only the owning supervisor (or admin) may inspect.
   */
  async getTeamMemberDetail(
    requester: AuthenticatedUser,
    agentId: string,
  ) {
    const isAdmin =
      requester.roles.includes(ROLE_NAMES.ADMIN) ||
      requester.roles.includes(ROLE_NAMES.SUPER_ADMIN);

    const [membership] = await db
      .select()
      .from(supportTeamMembers)
      .where(eq(supportTeamMembers.agentId, agentId))
      .limit(1);

    if (!membership) {
      throw new NotFoundException('Agent is not on any team');
    }
    if (!isAdmin && membership.supervisorId !== requester.id) {
      throw new ForbiddenException(
        'You can only view members of your own team',
      );
    }

    const [agent] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatar: users.avatar,
        phone: users.phone,
        isActive: users.isActive,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(eq(users.id, agentId))
      .limit(1);
    if (!agent) throw new NotFoundException('Agent not found');

    // Open tickets assigned to this agent
    const openTickets = await db
      .select({
        id: tickets.id,
        subject: tickets.subject,
        status: tickets.status,
        priority: tickets.priority,
        createdAt: tickets.createdAt,
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.assigneeId, agentId),
          inArray(tickets.status, [
            TICKET_STATUS.NEW,
            TICKET_STATUS.IN_PROGRESS,
            TICKET_STATUS.ON_HOLD,
          ]),
        ),
      )
      .orderBy(desc(tickets.createdAt))
      .limit(10);

    // Last 5 CSAT comments on this agent's tickets
    const recentCsat = await db
      .select({
        score: csatSurveys.score,
        comment: csatSurveys.comment,
        submittedAt: csatSurveys.submittedAt,
        ticketId: csatSurveys.ticketId,
      })
      .from(csatSurveys)
      .innerJoin(tickets, eq(csatSurveys.ticketId, tickets.id))
      .where(eq(tickets.assigneeId, agentId))
      .orderBy(desc(csatSurveys.submittedAt))
      .limit(5);

    // Cross-link to the existing per-agent performance row
    const perfRows = await this.getAgentPerformance();
    const performance =
      perfRows.find((p: any) => p.userId === agentId) ?? null;

    return {
      agent: {
        ...agent,
        assignedAt: membership.assignedAt,
        supervisorId: membership.supervisorId,
      },
      performance,
      openTickets,
      recentCsat,
    };
  }

  /**
   * Supervisor removes one of their own agents from the team.
   * Leaves the user account intact — only the membership row is dropped.
   */
  async removeMyTeamMember(
    supervisor: AuthenticatedUser,
    agentId: string,
    ipAddress: string,
  ) {
    const [membership] = await db
      .select()
      .from(supportTeamMembers)
      .where(eq(supportTeamMembers.agentId, agentId))
      .limit(1);
    if (!membership) {
      throw new NotFoundException('Agent is not on your team');
    }
    if (membership.supervisorId !== supervisor.id) {
      throw new ForbiddenException(
        'You can only remove members of your own team',
      );
    }

    await db
      .delete(supportTeamMembers)
      .where(eq(supportTeamMembers.id, membership.id));

    await db.insert(auditLogs).values({
      entityType: 'support_team_member',
      entityId: membership.id,
      action: 'removed',
      performedBy: supervisor.id,
      metadata: {
        supervisorId: supervisor.id,
        agentId,
      },
      ipAddress,
    });

    return { success: true };
  }

  /**
   * Returns SUPPORT users who aren't currently on any team and aren't
   * the requesting supervisor — i.e. candidates the supervisor can
   * request to add. Sub-role 'supervisor' rows are also excluded —
   * a supervisor doesn't belong inside another supervisor's team.
   */
  async listAvailableAgents(supervisorId: string) {
    const [supportRole] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, ROLE_NAMES.SUPPORT));
    if (!supportRole) return [];

    const supportUsers = await db
      .select({
        userId: userRoles.userId,
        supportSubRole: userRoles.supportSubRole,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        avatar: users.avatar,
      })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(
        and(
          eq(userRoles.roleId, supportRole.id),
          // Only line agents — supervisors lead, they don't get assigned.
          or(
            eq(userRoles.supportSubRole, SUPPORT_SUB_ROLES.AGENT),
            sql`${userRoles.supportSubRole} IS NULL`,
          ),
        ),
      );

    // Exclude anyone already on a team
    const memberRows = await db
      .select({ agentId: supportTeamMembers.agentId })
      .from(supportTeamMembers);
    const taken = new Set(memberRows.map((m) => m.agentId));

    return supportUsers
      .filter((u) => !taken.has(u.userId) && u.userId !== supervisorId)
      .sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''));
  }

  /**
   * Supervisor creates a request to add an agent to their team.
   * Goes to admin queue + creates an audit row + dashboard notification.
   * Refuses if a duplicate pending request already exists.
   */
  async createTeamRequest(
    supervisor: AuthenticatedUser,
    dto: {
      kind: 'add_existing' | 'add_new';
      candidateUserId?: string;
      candidateEmail?: string;
      candidateFirstName?: string;
      candidateLastName?: string;
      candidatePhone?: string;
      reason?: string;
    },
    ipAddress: string,
  ) {
    // Validate per kind
    if (dto.kind === SUPPORT_TEAM_REQUEST_KIND.ADD_EXISTING) {
      if (!dto.candidateUserId) {
        throw new BadRequestException(
          'candidateUserId is required for add_existing requests',
        );
      }
      if (dto.candidateUserId === supervisor.id) {
        throw new BadRequestException(
          'A supervisor cannot request to add themselves',
        );
      }
      // Make sure the candidate is still available
      const [existingMembership] = await db
        .select()
        .from(supportTeamMembers)
        .where(eq(supportTeamMembers.agentId, dto.candidateUserId))
        .limit(1);
      if (existingMembership) {
        throw new BadRequestException(
          'This agent is already on a supervisor team',
        );
      }
    } else if (dto.kind === SUPPORT_TEAM_REQUEST_KIND.ADD_NEW) {
      if (!dto.candidateEmail || !dto.candidateFirstName || !dto.candidateLastName) {
        throw new BadRequestException(
          'email, first name, and last name are required for new-user requests',
        );
      }
      // Reject if an account with that email already exists
      const [existingUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, dto.candidateEmail.toLowerCase()))
        .limit(1);
      if (existingUser) {
        throw new BadRequestException(
          'An account with this email already exists — submit an add_existing request instead',
        );
      }
    } else {
      throw new BadRequestException('Unknown request kind');
    }

    // Block duplicate-pending for the same candidate
    const dupConds: any[] = [
      eq(supportTeamRequests.supervisorId, supervisor.id),
      eq(supportTeamRequests.status, SUPPORT_TEAM_REQUEST_STATUS.PENDING),
    ];
    if (dto.candidateUserId) {
      dupConds.push(eq(supportTeamRequests.candidateUserId, dto.candidateUserId));
    } else if (dto.candidateEmail) {
      dupConds.push(
        eq(
          supportTeamRequests.candidateEmail,
          dto.candidateEmail.toLowerCase(),
        ),
      );
    }
    const [dup] = await db
      .select()
      .from(supportTeamRequests)
      .where(and(...dupConds))
      .limit(1);
    if (dup) {
      throw new BadRequestException(
        'You already have a pending request for this candidate',
      );
    }

    const [request] = await db
      .insert(supportTeamRequests)
      .values({
        supervisorId: supervisor.id,
        kind: dto.kind,
        candidateUserId: dto.candidateUserId ?? null,
        candidateEmail: dto.candidateEmail?.toLowerCase() ?? null,
        candidateFirstName: dto.candidateFirstName ?? null,
        candidateLastName: dto.candidateLastName ?? null,
        candidatePhone: dto.candidatePhone ?? null,
        reason: dto.reason ?? null,
        status: SUPPORT_TEAM_REQUEST_STATUS.PENDING,
      })
      .returning();

    // Audit log — supervisor submitted
    await db.insert(auditLogs).values({
      entityType: 'support_team_request',
      entityId: request.id,
      action: 'created',
      performedBy: supervisor.id,
      metadata: {
        kind: dto.kind,
        candidateUserId: dto.candidateUserId ?? null,
        candidateEmail: dto.candidateEmail ?? null,
      },
      ipAddress,
    });

    // In-app admin notification
    try {
      const supervisorName =
        [supervisor.firstName, supervisor.lastName].filter(Boolean).join(' ') ||
        supervisor.email;
      const candidateLabel =
        dto.kind === SUPPORT_TEAM_REQUEST_KIND.ADD_NEW
          ? `${dto.candidateFirstName} ${dto.candidateLastName} <${dto.candidateEmail}>`
          : 'an existing support agent';
      await this.adminNotifications.create({
        type: 'info',
        title: 'New support team request',
        description: `${supervisorName} requested to add ${candidateLabel} to their team.`,
        link: `/dashboard/admin/support/team-requests/${request.id}`,
      });
    } catch {
      // Notification failure must not break the request submission.
    }

    return request;
  }

  /**
   * Supervisor's view of their own requests history.
   */
  async listMyTeamRequests(supervisorId: string) {
    const requests = await db
      .select()
      .from(supportTeamRequests)
      .where(eq(supportTeamRequests.supervisorId, supervisorId))
      .orderBy(desc(supportTeamRequests.createdAt))
      .limit(100);
    return requests;
  }

  /**
   * Admin queue. Optional `status` filter (defaults to 'pending'
   * if you pass it; pass 'all' / undefined for everything).
   */
  async listTeamRequests(filter: { status?: string } = {}) {
    const conds: any[] = [];
    if (filter.status && filter.status !== 'all') {
      conds.push(eq(supportTeamRequests.status, filter.status));
    }

    const supervisorUsers = alias(users, 'supervisor_users');
    const candidateUsers = alias(users, 'candidate_users');
    const reviewerUsers = alias(users, 'reviewer_users');

    const rows = await db
      .select({
        id: supportTeamRequests.id,
        supervisorId: supportTeamRequests.supervisorId,
        kind: supportTeamRequests.kind,
        candidateUserId: supportTeamRequests.candidateUserId,
        candidateEmail: supportTeamRequests.candidateEmail,
        candidateFirstName: supportTeamRequests.candidateFirstName,
        candidateLastName: supportTeamRequests.candidateLastName,
        candidatePhone: supportTeamRequests.candidatePhone,
        reason: supportTeamRequests.reason,
        status: supportTeamRequests.status,
        reviewedBy: supportTeamRequests.reviewedBy,
        reviewedAt: supportTeamRequests.reviewedAt,
        decisionReason: supportTeamRequests.decisionReason,
        createdAt: supportTeamRequests.createdAt,
        supervisorFirstName: supervisorUsers.firstName,
        supervisorLastName: supervisorUsers.lastName,
        supervisorEmail: supervisorUsers.email,
        candidateExistingFirstName: candidateUsers.firstName,
        candidateExistingLastName: candidateUsers.lastName,
        candidateExistingEmail: candidateUsers.email,
        reviewerFirstName: reviewerUsers.firstName,
        reviewerLastName: reviewerUsers.lastName,
      })
      .from(supportTeamRequests)
      .leftJoin(
        supervisorUsers,
        eq(supportTeamRequests.supervisorId, supervisorUsers.id),
      )
      .leftJoin(
        candidateUsers,
        eq(supportTeamRequests.candidateUserId, candidateUsers.id),
      )
      .leftJoin(
        reviewerUsers,
        eq(supportTeamRequests.reviewedBy, reviewerUsers.id),
      )
      .where(conds.length > 0 ? and(...conds) : undefined)
      .orderBy(
        // Pending first, then newest
        sql`CASE WHEN ${supportTeamRequests.status} = 'pending' THEN 0 ELSE 1 END`,
        desc(supportTeamRequests.createdAt),
      )
      .limit(200);

    return rows;
  }

  /**
   * Admin approves a team request → creates the team membership (and
   * creates the user account if kind=add_new).
   * On reject → just stamps the decision.
   *
   * @param tempPassword If approving an add_new request, the admin must
   *   pre-set a starter password (≥ 8 chars). The supervisor can then
   *   share it with the new agent out-of-band.
   */
  async decideTeamRequest(
    admin: AuthenticatedUser,
    requestId: string,
    decision: 'approve' | 'reject',
    opts: { reason?: string; tempPassword?: string },
    ipAddress: string,
  ) {
    const [request] = await db
      .select()
      .from(supportTeamRequests)
      .where(eq(supportTeamRequests.id, requestId))
      .limit(1);
    if (!request) throw new NotFoundException('Request not found');
    if (request.status !== SUPPORT_TEAM_REQUEST_STATUS.PENDING) {
      throw new BadRequestException('Request has already been reviewed');
    }

    if (decision === 'reject') {
      const [updated] = await db
        .update(supportTeamRequests)
        .set({
          status: SUPPORT_TEAM_REQUEST_STATUS.REJECTED,
          reviewedBy: admin.id,
          reviewedAt: new Date(),
          decisionReason: opts.reason ?? null,
          updatedAt: new Date(),
        })
        .where(eq(supportTeamRequests.id, requestId))
        .returning();

      await db.insert(auditLogs).values({
        entityType: 'support_team_request',
        entityId: requestId,
        action: 'rejected',
        performedBy: admin.id,
        metadata: {
          reason: opts.reason ?? null,
          supervisorId: request.supervisorId,
        },
        ipAddress,
      });

      return updated;
    }

    // Approve path
    let resolvedAgentId = request.candidateUserId;

    if (request.kind === SUPPORT_TEAM_REQUEST_KIND.ADD_NEW) {
      if (!opts.tempPassword || opts.tempPassword.length < 8) {
        throw new BadRequestException(
          'A starter password (≥ 8 characters) is required when approving a new-user request',
        );
      }
      if (!request.candidateEmail) {
        throw new BadRequestException(
          'Request is missing a candidate email — cannot create user',
        );
      }

      const [existingUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, request.candidateEmail))
        .limit(1);

      if (existingUser) {
        // Edge case: the email was registered between request + approval.
        // Treat as a soft failure rather than silently overwriting the
        // account — admin can resubmit as an add_existing request.
        throw new BadRequestException(
          'A user with this email already exists. Reject this request and ask the supervisor to submit an "add existing" request instead.',
        );
      }

      const [supportRole] = await db
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.name, ROLE_NAMES.SUPPORT));
      if (!supportRole) {
        throw new BadRequestException('SUPPORT role not found in system');
      }

      const passwordHash = await argon2.hash(opts.tempPassword);
      const [newUser] = await db
        .insert(users)
        .values({
          email: request.candidateEmail,
          passwordHash,
          firstName: request.candidateFirstName,
          lastName: request.candidateLastName,
          phone: request.candidatePhone,
          activeRole: ROLE_NAMES.SUPPORT,
          isVerified: true,
          isActive: true,
        })
        .returning({ id: users.id });

      await db.insert(userRoles).values({
        userId: newUser.id,
        roleId: supportRole.id,
        supportSubRole: SUPPORT_SUB_ROLES.AGENT,
      });

      resolvedAgentId = newUser.id;
    }

    if (!resolvedAgentId) {
      throw new BadRequestException('Could not resolve target agent');
    }

    // Re-check membership immediately before insert — someone else
    // could have claimed the agent in the gap between request creation
    // and approval.
    const [conflict] = await db
      .select()
      .from(supportTeamMembers)
      .where(eq(supportTeamMembers.agentId, resolvedAgentId))
      .limit(1);
    if (conflict) {
      throw new BadRequestException(
        'This agent is already on another supervisor team',
      );
    }

    await db.insert(supportTeamMembers).values({
      supervisorId: request.supervisorId,
      agentId: resolvedAgentId,
      addedBy: admin.id,
    });

    const [updated] = await db
      .update(supportTeamRequests)
      .set({
        status: SUPPORT_TEAM_REQUEST_STATUS.APPROVED,
        reviewedBy: admin.id,
        reviewedAt: new Date(),
        decisionReason: opts.reason ?? null,
        candidateUserId: resolvedAgentId,
        updatedAt: new Date(),
      })
      .where(eq(supportTeamRequests.id, requestId))
      .returning();

    await db.insert(auditLogs).values({
      entityType: 'support_team_request',
      entityId: requestId,
      action: 'approved',
      performedBy: admin.id,
      metadata: {
        supervisorId: request.supervisorId,
        agentId: resolvedAgentId,
        kind: request.kind,
        reason: opts.reason ?? null,
      },
      ipAddress,
    });

    return updated;
  }

  /**
   * Pending-request count — used to render a badge on the admin
   * sidebar entry. Cheap COUNT(*) query.
   */
  async countPendingTeamRequests(): Promise<number> {
    const [row] = await db
      .select({ count: count() })
      .from(supportTeamRequests)
      .where(
        eq(supportTeamRequests.status, SUPPORT_TEAM_REQUEST_STATUS.PENDING),
      );
    return row?.count ?? 0;
  }

  // ============================================================
  // Help Center Categories (dynamic — replaces hardcoded slugs)
  // ============================================================

  async listKbCategories() {
    const rows = await db
      .select({
        id: kbCategories.id,
        slug: kbCategories.slug,
        nameEn: kbCategories.nameEn,
        nameAr: kbCategories.nameAr,
        icon: kbCategories.icon,
        sortOrder: kbCategories.sortOrder,
        createdAt: kbCategories.createdAt,
      })
      .from(kbCategories)
      .orderBy(asc(kbCategories.sortOrder), asc(kbCategories.nameEn));

    // Tack on article counts so the management UI can show "5 articles
    // in Billing" without a second roundtrip.
    const countsRaw = await db
      .select({
        category: kbArticles.category,
        total: count(),
      })
      .from(kbArticles)
      .groupBy(kbArticles.category);
    const countsBySlug = new Map(countsRaw.map((r) => [r.category, r.total]));

    return rows.map((r) => ({
      ...r,
      articleCount: countsBySlug.get(r.slug) ?? 0,
    }));
  }

  async createKbCategory(
    userId: string,
    dto: {
      slug?: string;
      nameEn: string;
      nameAr?: string;
      icon?: string;
      sortOrder?: number;
    },
  ) {
    if (!dto.nameEn?.trim()) {
      throw new BadRequestException('English name is required');
    }

    // Derive slug from nameEn if not provided. Lowercase, ascii-only,
    // hyphens for spaces/punctuation. Falls back to a uuid prefix on
    // pathological input (e.g. all-arabic name).
    const slug =
      dto.slug?.trim().toLowerCase() ||
      dto.nameEn
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') ||
      `cat-${crypto.randomUUID().slice(0, 8)}`;

    if (slug.length > 60) {
      throw new BadRequestException('Slug must be 60 characters or fewer');
    }

    const [existing] = await db
      .select({ id: kbCategories.id })
      .from(kbCategories)
      .where(eq(kbCategories.slug, slug))
      .limit(1);
    if (existing) {
      throw new BadRequestException('A category with this slug already exists');
    }

    const [created] = await db
      .insert(kbCategories)
      .values({
        slug,
        nameEn: dto.nameEn.trim(),
        nameAr: dto.nameAr?.trim() || null,
        icon: dto.icon?.trim() || 'BookOpen',
        sortOrder: dto.sortOrder ?? 999,
        createdBy: userId,
      })
      .returning();
    return created;
  }

  async updateKbCategory(
    id: string,
    dto: {
      nameEn?: string;
      nameAr?: string;
      icon?: string;
      sortOrder?: number;
    },
  ) {
    const [existing] = await db
      .select()
      .from(kbCategories)
      .where(eq(kbCategories.id, id))
      .limit(1);
    if (!existing) throw new NotFoundException('Category not found');

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (dto.nameEn !== undefined) {
      if (!dto.nameEn.trim()) {
        throw new BadRequestException('English name cannot be empty');
      }
      updateData.nameEn = dto.nameEn.trim();
    }
    if (dto.nameAr !== undefined) updateData.nameAr = dto.nameAr?.trim() || null;
    if (dto.icon !== undefined) updateData.icon = dto.icon.trim() || 'BookOpen';
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;

    const [updated] = await db
      .update(kbCategories)
      .set(updateData)
      .where(eq(kbCategories.id, id))
      .returning();
    return updated;
  }

  // ============================================================
  // Settings — Business Hours (admin-only)
  // ============================================================

  /**
   * Load business hours from `support_config.business_hours`.
   * Returns the platform defaults if the row is absent or malformed.
   */
  async getBusinessHours(): Promise<BusinessHoursConfig> {
    const [row] = await db
      .select({ value: supportConfig.value })
      .from(supportConfig)
      .where(eq(supportConfig.key, 'business_hours'))
      .limit(1);

    if (!row?.value) return { ...DEFAULT_BUSINESS_HOURS };

    const v = row.value as any;
    return {
      workingDays:
        Array.isArray(v.workingDays) && v.workingDays.length > 0
          ? v.workingDays
              .filter((n: any) => Number.isInteger(n) && n >= 0 && n <= 6)
              .sort((a: number, b: number) => a - b)
          : DEFAULT_BUSINESS_HOURS.workingDays,
      openTime:
        typeof v.openTime === 'string' && /^\d{2}:\d{2}$/.test(v.openTime)
          ? v.openTime
          : DEFAULT_BUSINESS_HOURS.openTime,
      closeTime:
        typeof v.closeTime === 'string' && /^\d{2}:\d{2}$/.test(v.closeTime)
          ? v.closeTime
          : DEFAULT_BUSINESS_HOURS.closeTime,
      timezoneOffsetHours:
        typeof v.timezoneOffsetHours === 'number'
          ? v.timezoneOffsetHours
          : DEFAULT_BUSINESS_HOURS.timezoneOffsetHours,
    };
  }

  /**
   * Persist a new business-hours config and update the in-memory cache
   * so future SLA calculations use the new values immediately.
   */
  async setBusinessHours(input: Partial<BusinessHoursConfig>) {
    const current = await this.getBusinessHours();
    const next: BusinessHoursConfig = {
      workingDays:
        Array.isArray(input.workingDays) && input.workingDays.length > 0
          ? input.workingDays
              .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
              .sort((a, b) => a - b)
          : current.workingDays,
      openTime: input.openTime || current.openTime,
      closeTime: input.closeTime || current.closeTime,
      timezoneOffsetHours:
        typeof input.timezoneOffsetHours === 'number'
          ? input.timezoneOffsetHours
          : current.timezoneOffsetHours,
    };

    if (!/^\d{2}:\d{2}$/.test(next.openTime) || !/^\d{2}:\d{2}$/.test(next.closeTime)) {
      throw new BadRequestException(
        'openTime and closeTime must be "HH:MM" (24-hour format)',
      );
    }
    const open = parseInt(next.openTime.split(':')[0]) * 60 + parseInt(next.openTime.split(':')[1]);
    const close = parseInt(next.closeTime.split(':')[0]) * 60 + parseInt(next.closeTime.split(':')[1]);
    if (close <= open) {
      throw new BadRequestException('closeTime must be after openTime');
    }
    if (next.workingDays.length === 0) {
      throw new BadRequestException('At least one working day is required');
    }

    await db
      .insert(supportConfig)
      .values({ key: 'business_hours', value: next, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: supportConfig.key,
        set: { value: next, updatedAt: new Date() },
      });

    setBusinessHoursConfig(next);
    return next;
  }

  // ============================================================
  // Settings — Auto-Assignment (supervisor + admin)
  // ============================================================

  async getAutoAssignment(): Promise<{
    enabled: boolean;
    strategy: 'round_robin' | 'least_loaded' | 'manual';
    respectBusinessHours: boolean;
    maxConcurrentPerAgent: number;
  }> {
    const [row] = await db
      .select({ value: supportConfig.value })
      .from(supportConfig)
      .where(eq(supportConfig.key, 'auto_assignment'))
      .limit(1);

    const v = (row?.value as any) || {};
    const validStrategies = ['round_robin', 'least_loaded', 'manual'];
    return {
      enabled: typeof v.enabled === 'boolean' ? v.enabled : true,
      strategy: validStrategies.includes(v.strategy) ? v.strategy : 'round_robin',
      respectBusinessHours:
        typeof v.respectBusinessHours === 'boolean' ? v.respectBusinessHours : true,
      maxConcurrentPerAgent:
        Number.isInteger(v.maxConcurrentPerAgent) &&
        v.maxConcurrentPerAgent >= 0
          ? v.maxConcurrentPerAgent
          : 0,
    };
  }

  async setAutoAssignment(input: {
    enabled?: boolean;
    strategy?: 'round_robin' | 'least_loaded' | 'manual';
    respectBusinessHours?: boolean;
    maxConcurrentPerAgent?: number;
  }) {
    const current = await this.getAutoAssignment();
    const next = {
      enabled: typeof input.enabled === 'boolean' ? input.enabled : current.enabled,
      strategy: input.strategy ?? current.strategy,
      respectBusinessHours:
        typeof input.respectBusinessHours === 'boolean'
          ? input.respectBusinessHours
          : current.respectBusinessHours,
      maxConcurrentPerAgent:
        typeof input.maxConcurrentPerAgent === 'number' &&
        input.maxConcurrentPerAgent >= 0
          ? input.maxConcurrentPerAgent
          : current.maxConcurrentPerAgent,
    };

    await db
      .insert(supportConfig)
      .values({ key: 'auto_assignment', value: next, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: supportConfig.key,
        set: { value: next, updatedAt: new Date() },
      });
    return next;
  }

  // ============================================================
  // Settings — Ticket Categories (supervisor + admin)
  // Stored as a JSON array in support_config so admins can add custom
  // categories without a schema migration. The 6 platform defaults are
  // returned when no override exists.
  // ============================================================

  /**
   * Resolve auto-priority for a given category slug. Consults the live
   * ticket_categories config first (admin can override built-in
   * priorities or set one for custom slugs), then falls back to the
   * built-in map, finally to MEDIUM if the slug isn't known.
   *
   * Also returns whether the slug is valid at all — callers use this to
   * 422 unknown slugs at ticket-create time without hitting the DB CHECK.
   */
  async resolveCategoryPriority(
    slug: string,
  ): Promise<{ priority: string; isValidSlug: boolean }> {
    const all = await this.listTicketCategories();
    const match = all.find((c) => c.slug === slug);
    if (!match) {
      return { priority: TICKET_PRIORITY.MEDIUM, isValidSlug: false };
    }
    // Admin-set priority wins (works for built-ins too if they edit later)
    if (match.autoPriority) {
      return { priority: match.autoPriority, isValidSlug: true };
    }
    return {
      priority:
        CATEGORY_PRIORITY_MAP[slug] || TICKET_PRIORITY.MEDIUM,
      isValidSlug: true,
    };
  }

  async listTicketCategories(): Promise<
    {
      slug: string;
      nameEn: string;
      nameAr: string | null;
      autoPriority: 'high' | 'medium' | 'low' | null;
      builtin: boolean;
    }[]
  > {
    const builtins = [
      { slug: 'billing', nameEn: 'Billing', nameAr: 'الفواتير', autoPriority: 'medium' as const },
      { slug: 'login', nameEn: 'Login', nameAr: 'تسجيل الدخول', autoPriority: 'high' as const },
      { slug: 'certificate', nameEn: 'Certificate', nameAr: 'الشهادات', autoPriority: 'medium' as const },
      { slug: 'content', nameEn: 'Content', nameAr: 'المحتوى', autoPriority: 'low' as const },
      { slug: 'technical', nameEn: 'Technical', nameAr: 'تقني', autoPriority: 'medium' as const },
      { slug: 'other', nameEn: 'Other', nameAr: 'أخرى', autoPriority: 'low' as const },
    ];

    const [row] = await db
      .select({ value: supportConfig.value })
      .from(supportConfig)
      .where(eq(supportConfig.key, 'ticket_categories'))
      .limit(1);

    const custom = Array.isArray(row?.value) ? (row!.value as any[]) : [];
    return [
      ...builtins.map((b) => ({ ...b, builtin: true })),
      ...custom.map((c: any) => ({
        slug: String(c.slug || ''),
        nameEn: String(c.nameEn || c.slug || ''),
        nameAr: c.nameAr ? String(c.nameAr) : null,
        autoPriority:
          c.autoPriority && ['high', 'medium', 'low'].includes(c.autoPriority)
            ? c.autoPriority
            : null,
        builtin: false,
      })),
    ];
  }

  async addTicketCategory(input: {
    slug?: string;
    nameEn: string;
    nameAr?: string;
    autoPriority?: 'high' | 'medium' | 'low';
  }) {
    if (!input.nameEn?.trim()) {
      throw new BadRequestException('English name is required');
    }
    const slug =
      input.slug?.trim().toLowerCase() ||
      input.nameEn
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    if (!slug) throw new BadRequestException('Unable to derive a slug');

    const existing = await this.listTicketCategories();
    if (existing.some((c) => c.slug === slug)) {
      throw new BadRequestException(
        'A category with this slug already exists',
      );
    }

    const custom = existing.filter((c) => !c.builtin);
    custom.push({
      slug,
      nameEn: input.nameEn.trim(),
      nameAr: input.nameAr?.trim() || null,
      autoPriority: input.autoPriority ?? null,
      builtin: false,
    });

    await db
      .insert(supportConfig)
      .values({
        key: 'ticket_categories',
        value: custom.map(({ builtin: _builtin, ...c }) => c),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: supportConfig.key,
        set: {
          value: custom.map(({ builtin: _builtin, ...c }) => c),
          updatedAt: new Date(),
        },
      });
    return { slug };
  }

  async removeTicketCategory(slug: string) {
    const existing = await this.listTicketCategories();
    const target = existing.find((c) => c.slug === slug);
    if (!target) throw new NotFoundException('Category not found');
    if (target.builtin) {
      throw new BadRequestException(
        'Built-in categories cannot be deleted. Hide them at the form level if unused.',
      );
    }
    const remaining = existing
      .filter((c) => !c.builtin && c.slug !== slug)
      .map(({ builtin: _builtin, ...c }) => c);

    await db
      .insert(supportConfig)
      .values({
        key: 'ticket_categories',
        value: remaining,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: supportConfig.key,
        set: { value: remaining, updatedAt: new Date() },
      });
    return { success: true };
  }

  // ============================================================
  // Settings — Notification Preferences (per-user, support-specific)
  // ============================================================

  async getSupportNotificationPrefs(userId: string) {
    const [row] = await db
      .select({ value: supportConfig.value })
      .from(supportConfig)
      .where(eq(supportConfig.key, `support_notif_prefs:${userId}`))
      .limit(1);

    const v = (row?.value as any) || {};
    return {
      emailNewTicket: v.emailNewTicket ?? true,
      emailReassigned: v.emailReassigned ?? true,
      emailSlaWarning: v.emailSlaWarning ?? true,
      emailMention: v.emailMention ?? true,
      emailCsatResponse: v.emailCsatResponse ?? false,
      inappNewTicket: v.inappNewTicket ?? true,
      inappReassigned: v.inappReassigned ?? true,
      inappSlaWarning: v.inappSlaWarning ?? true,
      inappMention: v.inappMention ?? true,
      inappCsatResponse: v.inappCsatResponse ?? true,
    };
  }

  /**
   * Channel-master gate for a support recipient. Returns true when the
   * user has at least one event of that channel enabled (master ON),
   * false when all are off (master OFF). Use this to wrap every email
   * or in-app dispatch that targets an agent or supervisor — without
   * it, opting out has no effect.
   *
   * Non-support recipients (students, instructors, etc.) don't have a
   * prefs row, so getSupportNotificationPrefs returns defaults (all on
   * except CSAT-by-email) and this returns true — safe pass-through.
   */
  async shouldNotifySupport(
    userId: string,
    channel: 'email' | 'inApp',
  ): Promise<boolean> {
    try {
      const prefs = await this.getSupportNotificationPrefs(userId);
      const keys =
        channel === 'email'
          ? [
              'emailNewTicket',
              'emailReassigned',
              'emailSlaWarning',
              'emailMention',
              'emailCsatResponse',
            ]
          : [
              'inappNewTicket',
              'inappReassigned',
              'inappSlaWarning',
              'inappMention',
              'inappCsatResponse',
            ];
      return keys.some((k) => (prefs as Record<string, boolean>)[k] === true);
    } catch {
      // Pref read failed — never block notifications on a config glitch.
      return true;
    }
  }

  async setSupportNotificationPrefs(
    userId: string,
    input: Record<string, boolean>,
  ) {
    const current = await this.getSupportNotificationPrefs(userId);
    const next: Record<string, boolean> = { ...current };
    for (const k of Object.keys(current)) {
      if (typeof input[k] === 'boolean') next[k] = input[k];
    }
    await db
      .insert(supportConfig)
      .values({
        key: `support_notif_prefs:${userId}`,
        value: next,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: supportConfig.key,
        set: { value: next, updatedAt: new Date() },
      });
    return next;
  }

  /**
   * Delete a category. Refuses if any articles still belong to it —
   * the supervisor must reassign or delete those articles first to
   * avoid orphaning rows that filter UIs would silently hide.
   */
  async deleteKbCategory(id: string) {
    const [existing] = await db
      .select()
      .from(kbCategories)
      .where(eq(kbCategories.id, id))
      .limit(1);
    if (!existing) throw new NotFoundException('Category not found');

    const [{ total }] = await db
      .select({ total: count() })
      .from(kbArticles)
      .where(eq(kbArticles.category, existing.slug));

    if (total > 0) {
      throw new BadRequestException(
        `Cannot delete — ${total} article(s) still use this category. Move them to another category first.`,
      );
    }

    await db.delete(kbCategories).where(eq(kbCategories.id, id));
    return { success: true };
  }
}
