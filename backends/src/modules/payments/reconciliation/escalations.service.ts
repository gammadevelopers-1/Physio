import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and, desc, sql, inArray, or, isNull } from 'drizzle-orm';
import { db } from '../../../database';
import {
  reconciliationFindings,
  reconciliationEscalations,
  payments,
  paymentReceipts,
  refunds,
  users,
  courses,
  roles,
  userRoles,
  RECONCILIATION_STATUS,
  ESCALATION_STATUS,
  ESCALATION_URGENCY,
  ESCALATION_PROPOSED_ACTION,
  ESCALATION_ACTION_TAKEN,
  PAYMENT_STATUS,
  PAYMENT_METHOD,
  REFUND_STATUS,
  RECEIPT_REVIEW_STATUS,
} from '../../../database/schema';
import { AuditLogService } from '../../audit-logs/audit-logs.service';
import { EmailService } from '../../email/email.service';
import { EnrollmentsService } from '../../enrollments/enrollments.service';
import { RefundService } from '../services/refund.service';
import { InvoiceService } from '../services/invoice.service';
import { GatewayFactory } from '../gateways/gateway.factory';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

type EscalationStatus =
  (typeof ESCALATION_STATUS)[keyof typeof ESCALATION_STATUS];
type EscalationUrgency =
  (typeof ESCALATION_URGENCY)[keyof typeof ESCALATION_URGENCY];
type ProposedAction =
  (typeof ESCALATION_PROPOSED_ACTION)[keyof typeof ESCALATION_PROPOSED_ACTION];

const VALID_PROPOSED_ACTIONS = new Set(
  Object.values(ESCALATION_PROPOSED_ACTION),
);
const VALID_URGENCIES = new Set(Object.values(ESCALATION_URGENCY));

/**
 * Lifecycle of a reconciliation escalation.
 *
 *   finance creates                       admin claims
 *   ──────────────►  pending  ──────────────►  in_progress
 *                       │                          │
 *      send_back  ◄─────┤                          ├─────► resolved (E.2/E.3)
 *                       │                          │
 *                       └──────► declined  ◄───────┘
 *
 * Phase E.1 builds escalate / list / get / claim / sendBack / close.
 * Phase E.2 adds enroll (transactional: payment + enrollment + audit + email).
 * Phase E.3 adds refund (glues into existing RefundsService).
 *
 * Resolve / decline / send-back all flip the underlying finding so finance
 * sees the right state on the reconciliation page:
 *   resolved  → finding RESOLVED
 *   declined  → finding RESOLVED (with note: "Closed without action")
 *   sent_back → finding UNRESOLVED (finance can act again)
 */
@Injectable()
export class EscalationsService {
  private readonly logger = new Logger(EscalationsService.name);

  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly emailService: EmailService,
    private readonly enrollmentsService: EnrollmentsService,
    private readonly refundService: RefundService,
    private readonly invoiceService: InvoiceService,
    private readonly gatewayFactory: GatewayFactory,
  ) {}

  // ─── Create (finance side) ───────────────────────────────────────────

  async escalateFinding(
    findingId: string,
    user: AuthenticatedUser,
    opts: {
      note: string;
      proposedAction: string;
      urgency?: string;
    },
    ipAddress?: string,
  ) {
    const note = (opts.note || '').trim();
    if (note.length < 20) {
      throw new BadRequestException(
        'Escalation note must be at least 20 characters — explain what you think happened and what admin should do.',
      );
    }
    if (!VALID_PROPOSED_ACTIONS.has(opts.proposedAction as ProposedAction)) {
      throw new BadRequestException(
        `proposedAction must be one of: ${[...VALID_PROPOSED_ACTIONS].join(', ')}`,
      );
    }
    const urgency = (opts.urgency || ESCALATION_URGENCY.NORMAL) as EscalationUrgency;
    if (!VALID_URGENCIES.has(urgency)) {
      throw new BadRequestException(
        `urgency must be one of: ${[...VALID_URGENCIES].join(', ')}`,
      );
    }

    const [finding] = await db
      .select()
      .from(reconciliationFindings)
      .where(eq(reconciliationFindings.id, findingId))
      .limit(1);
    if (!finding) throw new NotFoundException('Finding not found');

    if (finding.status === RECONCILIATION_STATUS.ESCALATED) {
      throw new ConflictException(
        'Finding is already escalated. Wait for admin to close the existing escalation before re-escalating.',
      );
    }
    if (finding.status !== RECONCILIATION_STATUS.UNRESOLVED) {
      throw new ConflictException(
        `Cannot escalate a ${finding.status} finding — only unresolved findings can be escalated.`,
      );
    }

    // Atomically: insert escalation, flip finding status + denormalized pointer.
    // The partial unique index on (finding_id WHERE status IN pending,in_progress)
    // guards against races where two finance users escalate the same finding.
    let escalationId: string;
    try {
      const result = await db.transaction(async (tx) => {
        const [escalation] = await tx
          .insert(reconciliationEscalations)
          .values({
            findingId,
            escalatedBy: user.id,
            escalationNote: note,
            proposedAction: opts.proposedAction,
            urgency,
            status: ESCALATION_STATUS.PENDING,
          })
          .returning();

        await tx
          .update(reconciliationFindings)
          .set({
            status: RECONCILIATION_STATUS.ESCALATED,
            escalationId: escalation.id,
            updatedAt: new Date(),
          })
          .where(eq(reconciliationFindings.id, findingId));

        return escalation;
      });
      escalationId = result.id;
    } catch (err: any) {
      if (err.code === '23505') {
        throw new ConflictException(
          'Finding was just escalated by someone else — refresh and check.',
        );
      }
      throw err;
    }

    await this.auditLogService.log({
      entityType: 'reconciliation_escalation',
      entityId: escalationId,
      action: 'reconciliation_escalation_created',
      performedBy: user.id,
      ipAddress,
      metadata: {
        findingId,
        proposedAction: opts.proposedAction,
        urgency,
      },
    });

    // Fire-and-forget email to admins (don't block the API response on SMTP).
    // Email failures are logged inside notifyAdmins and don't bubble up.
    this.notifyAdminsOfNewEscalation(escalationId, urgency).catch((err) => {
      this.logger.error(
        `Failed to dispatch admin notification for escalation ${escalationId}: ${err.message}`,
      );
    });

    return { id: escalationId, status: ESCALATION_STATUS.PENDING };
  }

  // ─── Read ────────────────────────────────────────────────────────────

  async listEscalations(opts: {
    status?: EscalationStatus | 'all';
    gateway?: string;
    urgency?: EscalationUrgency;
    escalatedBy?: string;
    claimedBy?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, opts.page || 1);
    const limit = Math.min(100, Math.max(1, opts.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: any[] = [];
    if (opts.status && opts.status !== 'all') {
      conditions.push(eq(reconciliationEscalations.status, opts.status));
    }
    if (opts.gateway) {
      conditions.push(eq(reconciliationFindings.gateway, opts.gateway));
    }
    if (opts.urgency) {
      conditions.push(eq(reconciliationEscalations.urgency, opts.urgency));
    }
    if (opts.escalatedBy) {
      conditions.push(eq(reconciliationEscalations.escalatedBy, opts.escalatedBy));
    }
    if (opts.claimedBy) {
      conditions.push(eq(reconciliationEscalations.claimedBy, opts.claimedBy));
    }
    const whereExpr = conditions.length > 0 ? and(...conditions) : undefined;

    // We alias the user rows we join for "escalated by" + "claimed by" so the
    // single SQL round-trip returns both names. Drizzle's alias() is verbose
    // for this shape, so we drop down to a sql template for the two display
    // names — it's read-only and the join is straightforward.
    const rows = await db
      .select({
        id: reconciliationEscalations.id,
        findingId: reconciliationEscalations.findingId,
        escalatedBy: reconciliationEscalations.escalatedBy,
        escalatedAt: reconciliationEscalations.escalatedAt,
        escalationNote: reconciliationEscalations.escalationNote,
        proposedAction: reconciliationEscalations.proposedAction,
        urgency: reconciliationEscalations.urgency,
        status: reconciliationEscalations.status,
        claimedBy: reconciliationEscalations.claimedBy,
        claimedAt: reconciliationEscalations.claimedAt,
        actionTaken: reconciliationEscalations.actionTaken,
        resolutionNote: reconciliationEscalations.resolutionNote,
        resolvedBy: reconciliationEscalations.resolvedBy,
        resolvedAt: reconciliationEscalations.resolvedAt,
        linkedEntityType: reconciliationEscalations.linkedEntityType,
        linkedEntityId: reconciliationEscalations.linkedEntityId,
        // Finding context
        driftType: reconciliationFindings.driftType,
        gateway: reconciliationFindings.gateway,
        paymentId: reconciliationFindings.paymentId,
        gatewayChargeId: reconciliationFindings.gatewayChargeId,
        ourValue: reconciliationFindings.ourValue,
        gatewayValue: reconciliationFindings.gatewayValue,
        // Payment + customer + course
        customerName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        customerEmail: users.email,
        courseTitle: courses.title,
        // Display names for who-did-what (subqueries; cheap because indexed)
        escalatedByName: sql<string>`(SELECT CONCAT(first_name, ' ', last_name) FROM users WHERE id = ${reconciliationEscalations.escalatedBy})`,
        claimedByName: sql<string>`(SELECT CONCAT(first_name, ' ', last_name) FROM users WHERE id = ${reconciliationEscalations.claimedBy})`,
        resolvedByName: sql<string>`(SELECT CONCAT(first_name, ' ', last_name) FROM users WHERE id = ${reconciliationEscalations.resolvedBy})`,
      })
      .from(reconciliationEscalations)
      .innerJoin(
        reconciliationFindings,
        eq(reconciliationFindings.id, reconciliationEscalations.findingId),
      )
      .leftJoin(payments, eq(payments.id, reconciliationFindings.paymentId))
      .leftJoin(users, eq(users.id, payments.userId))
      .leftJoin(courses, eq(courses.id, payments.courseId))
      .where(whereExpr)
      // Pending-first, then high-urgency, then newest.
      .orderBy(
        sql`CASE ${reconciliationEscalations.status}
              WHEN 'pending' THEN 0
              WHEN 'in_progress' THEN 1
              WHEN 'sent_back' THEN 2
              ELSE 3 END`,
        sql`CASE ${reconciliationEscalations.urgency}
              WHEN 'high' THEN 0
              WHEN 'normal' THEN 1
              ELSE 2 END`,
        desc(reconciliationEscalations.escalatedAt),
      )
      .limit(limit)
      .offset(offset);

    const [totalRow] = await db
      .select({ value: sql<number>`COUNT(*)::int` })
      .from(reconciliationEscalations)
      .innerJoin(
        reconciliationFindings,
        eq(reconciliationFindings.id, reconciliationEscalations.findingId),
      )
      .where(whereExpr);

    return {
      data: rows,
      pagination: {
        page,
        limit,
        total: Number(totalRow?.value || 0),
        totalPages: Math.ceil(Number(totalRow?.value || 0) / limit) || 1,
      },
    };
  }

  async getEscalation(escalationId: string) {
    const [row] = await db
      .select({
        // Escalation core
        id: reconciliationEscalations.id,
        findingId: reconciliationEscalations.findingId,
        escalatedBy: reconciliationEscalations.escalatedBy,
        escalatedAt: reconciliationEscalations.escalatedAt,
        escalationNote: reconciliationEscalations.escalationNote,
        proposedAction: reconciliationEscalations.proposedAction,
        urgency: reconciliationEscalations.urgency,
        status: reconciliationEscalations.status,
        claimedBy: reconciliationEscalations.claimedBy,
        claimedAt: reconciliationEscalations.claimedAt,
        actionTaken: reconciliationEscalations.actionTaken,
        resolutionNote: reconciliationEscalations.resolutionNote,
        resolvedBy: reconciliationEscalations.resolvedBy,
        resolvedAt: reconciliationEscalations.resolvedAt,
        linkedEntityType: reconciliationEscalations.linkedEntityType,
        linkedEntityId: reconciliationEscalations.linkedEntityId,
        // Finding
        driftType: reconciliationFindings.driftType,
        gateway: reconciliationFindings.gateway,
        paymentId: reconciliationFindings.paymentId,
        gatewayChargeId: reconciliationFindings.gatewayChargeId,
        ourValue: reconciliationFindings.ourValue,
        gatewayValue: reconciliationFindings.gatewayValue,
        findingCreatedAt: reconciliationFindings.createdAt,
        // Customer + course + payment
        customerId: users.id,
        customerName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        customerEmail: users.email,
        courseId: courses.id,
        courseTitle: courses.title,
        paymentAmount: payments.amount,
        paymentCurrency: payments.currency,
        paymentStatus: payments.status,
        paymentGateway: payments.gateway,
        paymentMethod: payments.paymentMethod,
        paymentCreatedAt: payments.createdAt,
        // Display names
        escalatedByName: sql<string>`(SELECT CONCAT(first_name, ' ', last_name) FROM users WHERE id = ${reconciliationEscalations.escalatedBy})`,
        claimedByName: sql<string>`(SELECT CONCAT(first_name, ' ', last_name) FROM users WHERE id = ${reconciliationEscalations.claimedBy})`,
        resolvedByName: sql<string>`(SELECT CONCAT(first_name, ' ', last_name) FROM users WHERE id = ${reconciliationEscalations.resolvedBy})`,
      })
      .from(reconciliationEscalations)
      .innerJoin(
        reconciliationFindings,
        eq(reconciliationFindings.id, reconciliationEscalations.findingId),
      )
      .leftJoin(payments, eq(payments.id, reconciliationFindings.paymentId))
      .leftJoin(users, eq(users.id, payments.userId))
      .leftJoin(courses, eq(courses.id, payments.courseId))
      .where(eq(reconciliationEscalations.id, escalationId))
      .limit(1);

    if (!row) throw new NotFoundException('Escalation not found');
    return row;
  }

  async getStats() {
    const counts = await db
      .select({
        status: reconciliationEscalations.status,
        urgency: reconciliationEscalations.urgency,
        c: sql<number>`COUNT(*)::int`,
      })
      .from(reconciliationEscalations)
      .groupBy(reconciliationEscalations.status, reconciliationEscalations.urgency);

    let pending = 0;
    let inProgress = 0;
    let highUrgencyOpen = 0;
    for (const r of counts) {
      if (r.status === ESCALATION_STATUS.PENDING) pending += r.c;
      if (r.status === ESCALATION_STATUS.IN_PROGRESS) inProgress += r.c;
      if (
        (r.status === ESCALATION_STATUS.PENDING ||
          r.status === ESCALATION_STATUS.IN_PROGRESS) &&
        r.urgency === ESCALATION_URGENCY.HIGH
      ) {
        highUrgencyOpen += r.c;
      }
    }

    // Average resolution time over the last 30 days, in minutes — cheap
    // signal for "is finance escalating things that admin actually has
    // bandwidth to clear?". NULLed when no resolved escalations exist.
    const [avg] = await db
      .select({
        avgMinutes: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - escalated_at)) / 60), 0)::int`,
      })
      .from(reconciliationEscalations)
      .where(
        and(
          inArray(reconciliationEscalations.status, [
            ESCALATION_STATUS.RESOLVED,
            ESCALATION_STATUS.DECLINED,
          ]),
          sql`${reconciliationEscalations.resolvedAt} > NOW() - INTERVAL '30 days'`,
        ),
      );

    return {
      pending,
      inProgress,
      highUrgencyOpen,
      avgResolutionMinutes: Number(avg?.avgMinutes || 0),
    };
  }

  // ─── Admin transitions ───────────────────────────────────────────────

  async claim(escalationId: string, user: AuthenticatedUser, ipAddress?: string) {
    const [updated] = await db
      .update(reconciliationEscalations)
      .set({
        status: ESCALATION_STATUS.IN_PROGRESS,
        claimedBy: user.id,
        claimedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(reconciliationEscalations.id, escalationId),
          eq(reconciliationEscalations.status, ESCALATION_STATUS.PENDING),
        ),
      )
      .returning();

    if (!updated) {
      await this.assertEscalationExists(escalationId);
      throw new ConflictException(
        'Escalation is not in pending state — only pending escalations can be claimed.',
      );
    }

    await this.auditLogService.log({
      entityType: 'reconciliation_escalation',
      entityId: escalationId,
      action: 'reconciliation_escalation_claimed',
      performedBy: user.id,
      ipAddress,
    });

    return { id: updated.id, status: updated.status };
  }

  async sendBack(
    escalationId: string,
    user: AuthenticatedUser,
    note: string | undefined,
    ipAddress?: string,
  ) {
    const trimmed = (note || '').trim();
    if (trimmed.length < 10) {
      throw new BadRequestException(
        'Send-back note must be at least 10 characters — tell finance what more info you need.',
      );
    }

    const finding = await this.transitionEscalation({
      escalationId,
      user,
      toStatus: ESCALATION_STATUS.SENT_BACK,
      actionTaken: ESCALATION_ACTION_TAKEN.SENT_BACK,
      note: trimmed,
      // Send back unlocks the finding so finance can act again, but we
      // KEEP the escalation pointer so finance can see admin's note +
      // who sent it back. listFindings joins the latest escalation when
      // escalationId is present, regardless of the finding's own status.
      findingStatus: RECONCILIATION_STATUS.UNRESOLVED,
      keepEscalationPointer: true,
    });

    await this.auditLogService.log({
      entityType: 'reconciliation_escalation',
      entityId: escalationId,
      action: 'reconciliation_escalation_sent_back',
      performedBy: user.id,
      ipAddress,
      metadata: { note: trimmed },
    });

    this.notifyFinanceOfTransition(escalationId, 'sent_back').catch((err) => {
      this.logger.error(`Failed to notify finance of send-back: ${err.message}`);
    });

    return { id: escalationId, status: ESCALATION_STATUS.SENT_BACK, findingId: finding };
  }

  async close(
    escalationId: string,
    user: AuthenticatedUser,
    note: string | undefined,
    ipAddress?: string,
  ) {
    const trimmed = (note || '').trim();
    if (trimmed.length < 10) {
      throw new BadRequestException(
        'Close note must be at least 10 characters — explain why this needs no action.',
      );
    }

    const finding = await this.transitionEscalation({
      escalationId,
      user,
      toStatus: ESCALATION_STATUS.DECLINED,
      actionTaken: ESCALATION_ACTION_TAKEN.NO_ACTION,
      note: trimmed,
      // Closing without action still resolves the underlying finding so it
      // doesn't sit in the unresolved bucket forever. The resolution note
      // makes it clear it was admin-declined, not actually fixed.
      findingStatus: RECONCILIATION_STATUS.RESOLVED,
      findingNoteOverride: `Closed by admin without action: ${trimmed}`,
      keepEscalationPointer: true,
    });

    await this.auditLogService.log({
      entityType: 'reconciliation_escalation',
      entityId: escalationId,
      action: 'reconciliation_escalation_declined',
      performedBy: user.id,
      ipAddress,
      metadata: { note: trimmed },
    });

    this.notifyFinanceOfTransition(escalationId, 'declined').catch((err) => {
      this.logger.error(`Failed to notify finance of decline: ${err.message}`);
    });

    return { id: escalationId, status: ESCALATION_STATUS.DECLINED, findingId: finding };
  }

  /**
   * Internal helper used by sendBack / close / (later) enroll / refund.
   * Atomically flips the escalation + the underlying finding in one tx.
   * Returns the findingId so callers can include it in responses.
   */
  private async transitionEscalation(args: {
    escalationId: string;
    user: AuthenticatedUser;
    toStatus: EscalationStatus;
    actionTaken: string;
    note: string;
    findingStatus: string;
    findingNoteOverride?: string;
    keepEscalationPointer: boolean;
    linkedEntityType?: string;
    linkedEntityId?: string;
  }): Promise<string> {
    return db.transaction(async (tx) => {
      const [escalation] = await tx
        .select()
        .from(reconciliationEscalations)
        .where(eq(reconciliationEscalations.id, args.escalationId))
        .limit(1);
      if (!escalation) throw new NotFoundException('Escalation not found');

      // Only pending / in_progress can transition. Already-resolved escalations
      // are immutable — finance has to re-escalate to act again.
      if (
        escalation.status !== ESCALATION_STATUS.PENDING &&
        escalation.status !== ESCALATION_STATUS.IN_PROGRESS
      ) {
        throw new ConflictException(
          `Escalation is already ${escalation.status} — cannot transition.`,
        );
      }

      await tx
        .update(reconciliationEscalations)
        .set({
          status: args.toStatus,
          actionTaken: args.actionTaken,
          resolutionNote: args.note,
          resolvedBy: args.user.id,
          resolvedAt: new Date(),
          linkedEntityType: args.linkedEntityType || null,
          linkedEntityId: args.linkedEntityId || null,
          updatedAt: new Date(),
        })
        .where(eq(reconciliationEscalations.id, args.escalationId));

      // Update the underlying finding. If we're sending back, drop the
      // escalation pointer too so finance's "Resolve/Ignore" UI re-enables.
      const findingUpdates: Record<string, any> = {
        status: args.findingStatus,
        updatedAt: new Date(),
      };
      if (args.findingStatus === RECONCILIATION_STATUS.RESOLVED) {
        findingUpdates.resolutionNote =
          args.findingNoteOverride ||
          `Resolved via escalation by ${args.user.email || args.user.id}: ${args.note}`;
        findingUpdates.resolvedBy = args.user.id;
        findingUpdates.resolvedAt = new Date();
      }
      if (!args.keepEscalationPointer) {
        findingUpdates.escalationId = null;
      }
      await tx
        .update(reconciliationFindings)
        .set(findingUpdates)
        .where(eq(reconciliationFindings.id, escalation.findingId));

      return escalation.findingId;
    });
  }

  // ─── Admin actions (E.2 / E.3) ───────────────────────────────────────

  /**
   * E.2 — Manual enrollment from an escalation. Transactional:
   *   1. If the finding is missing_local (no local payment row), create one
   *      using gateway data from the finding's gatewayValue. Marks it PAID.
   *   2. Call EnrollmentsService.createEnrollment — runs the existing NELC
   *      limit checks, waitlist logic, audit, student enrollment-confirmed
   *      email + Zoom auto-registration if the course is a webinar.
   *   3. Mark the escalation resolved (action=enrolled, linked to the new
   *      enrollment id), and the underlying finding resolved.
   *   4. Email finance who escalated.
   *
   * Failure handling:
   *   - If step 1 succeeds but step 2 fails → we DELETE the just-created
   *     payment row to avoid orphaning it (this is the only step where
   *     we hold non-idempotent state outside the final transaction).
   *   - If steps 1+2 succeed but step 3 (escalation update) fails → loud
   *     log + propagate the error. The enrollment is real, so the student
   *     keeps access; finance can re-resolve the escalation manually next
   *     time someone notices.
   */
  async enrollFromEscalation(
    escalationId: string,
    user: AuthenticatedUser,
    opts: {
      studentId: string;
      courseId: string;
      note: string;
    },
    ipAddress?: string,
  ): Promise<{
    escalationId: string;
    findingId: string;
    enrollmentId: string;
    paymentCreated: boolean;
    paymentFlipped: boolean;
    receiptApproved: boolean;
    paymentId: string | null;
  }> {
    const note = (opts.note || '').trim();
    if (note.length < 10) {
      throw new BadRequestException(
        'Enrollment note must be at least 10 characters — captured in the audit log.',
      );
    }
    if (!opts.studentId || !opts.courseId) {
      throw new BadRequestException('studentId and courseId are both required');
    }

    // 1. Validate escalation is still actionable + load the finding.
    const [escalation] = await db
      .select()
      .from(reconciliationEscalations)
      .where(eq(reconciliationEscalations.id, escalationId))
      .limit(1);
    if (!escalation) throw new NotFoundException('Escalation not found');
    if (
      escalation.status !== ESCALATION_STATUS.PENDING &&
      escalation.status !== ESCALATION_STATUS.IN_PROGRESS
    ) {
      throw new ConflictException(
        `Escalation is ${escalation.status} — cannot enroll.`,
      );
    }

    const [finding] = await db
      .select()
      .from(reconciliationFindings)
      .where(eq(reconciliationFindings.id, escalation.findingId))
      .limit(1);
    if (!finding) throw new NotFoundException('Linked finding not found');

    // 2. Verify the student + course exist (cheap sanity check before we
    //    create state — avoids creating an orphan payment for a typo'd id).
    const [student] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, opts.studentId))
      .limit(1);
    if (!student) throw new BadRequestException('Student not found');

    const [course] = await db
      .select({ id: courses.id, title: courses.title })
      .from(courses)
      .where(eq(courses.id, opts.courseId))
      .limit(1);
    if (!course) throw new BadRequestException('Course not found');

    // 3. Optionally create the payment row (only for missing_local where
    //    we don't have one yet). Use gatewayValue for amount/charge id.
    //    Skipping this step for findings where a payment row already exists
    //    (orphan_receipt, paid_no_receipt, stuck_approval, etc.) — those
    //    already have a payment we can link to.
    let paymentId: string | null = finding.paymentId;
    let paymentCreated = false;
    if (!paymentId) {
      const gv = (finding.gatewayValue || {}) as Record<string, any>;
      const amount = gv.amount;
      const currency = gv.currency || 'SAR';
      if (amount == null || isNaN(Number(amount))) {
        throw new BadRequestException(
          'Cannot create payment row — gateway data is missing the amount. Investigate the finding manually.',
        );
      }
      const [createdPayment] = await db
        .insert(payments)
        .values({
          userId: student.id,
          courseId: course.id,
          amount: String(amount),
          currency,
          gateway: finding.gateway,
          paymentMethod: this.inferPaymentMethod(finding.gateway),
          status: PAYMENT_STATUS.PAID,
          gatewayChargeId: finding.gatewayChargeId,
          paidAt: new Date(),
          metadata: {
            createdViaEscalation: escalationId,
            createdByAdmin: user.id,
            note,
            source: 'reconciliation_escalation_enroll',
          } as any,
        })
        .returning();
      paymentId = createdPayment.id;
      paymentCreated = true;
      this.logger.log(
        `Escalation ${escalationId}: created payment ${paymentId} for missing_local finding ${finding.id}`,
      );
    }

    // 4. Create the enrollment. If this throws (NELC limit, already
    //    enrolled, course not found), we roll back the payment row we
    //    just created so we don't orphan it.
    let enrollmentId: string;
    try {
      const enrollment = await this.enrollmentsService.createEnrollment(
        course.id,
        student.id,
        user,
      );
      enrollmentId = enrollment.id;
    } catch (err) {
      if (paymentCreated && paymentId) {
        await db.delete(payments).where(eq(payments.id, paymentId));
        this.logger.warn(
          `Escalation ${escalationId}: enrollment failed, rolled back payment ${paymentId}`,
        );
      }
      throw err;
    }

    // 5. Transactionally:
    //   a. Flip the existing payment to PAID if it's currently non-terminal
    //      (stuck_approval, orphan_receipt, stuck_pending → the payment
    //      row already exists but in a stale state). Without this step
    //      the Bank Transfers + Payments pages still show "pending"
    //      after admin enrolls, which is the whole point of the
    //      escalation — finance assumes "enrolled = payment good".
    //   b. Mark the most-recent non-replaced pending receipt as APPROVED
    //      (bank-transfer only) so the Bank Transfers review queue stops
    //      showing it.
    //   c. Resolve the escalation + finding + link the payment to the
    //      finding for traceability.
    //
    // Race + safety:
    //   - Payment update is conditional on status != PAID, so a concurrent
    //     normal approval doesn't get clobbered.
    //   - Receipt update is conditional on reviewStatus = PENDING for the
    //     same reason.
    //   - If this tx fails we log + re-throw; the enrollment already
    //     succeeded so the student still has access. Admin can re-resolve
    //     manually next pass.
    let paymentFlipped = false;
    let receiptApproved = false;
    try {
      await db.transaction(async (tx) => {
        if (paymentId && !paymentCreated) {
          // Only for the existing-payment case — created payments were
          // already inserted as PAID in step 3 above.
          const [existing] = await tx
            .select({ status: payments.status, gateway: payments.gateway })
            .from(payments)
            .where(eq(payments.id, paymentId))
            .limit(1);

          const terminalGood = [
            PAYMENT_STATUS.PAID,
            PAYMENT_STATUS.REFUNDED,
            PAYMENT_STATUS.PARTIALLY_REFUNDED,
          ] as string[];

          if (existing && !terminalGood.includes(existing.status)) {
            const flipped = await tx
              .update(payments)
              .set({
                status: PAYMENT_STATUS.PAID,
                paidAt: new Date(),
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(payments.id, paymentId),
                  sql`${payments.status} != ${PAYMENT_STATUS.PAID}`,
                ),
              )
              .returning({ id: payments.id });
            paymentFlipped = flipped.length > 0;

            // Bank-transfer side-effect: a pending receipt linked to this
            // payment needs to flip to approved so it disappears from
            // finance's review queue. Other gateways don't have receipts.
            if (paymentFlipped && existing.gateway === 'bank_transfer') {
              const receiptFlip = await tx
                .update(paymentReceipts)
                .set({
                  reviewStatus: RECEIPT_REVIEW_STATUS.APPROVED,
                  reviewedBy: user.id,
                  reviewedAt: new Date(),
                  financeInternalNote: `Approved via reconciliation escalation by admin: ${note}`,
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(paymentReceipts.paymentId, paymentId),
                    eq(paymentReceipts.reviewStatus, RECEIPT_REVIEW_STATUS.PENDING),
                    isNull(paymentReceipts.replacedById),
                  ),
                )
                .returning({ id: paymentReceipts.id });
              receiptApproved = receiptFlip.length > 0;
            }
          }
        }

        await tx
          .update(reconciliationEscalations)
          .set({
            status: ESCALATION_STATUS.RESOLVED,
            actionTaken: ESCALATION_ACTION_TAKEN.ENROLLED,
            resolutionNote: note,
            resolvedBy: user.id,
            resolvedAt: new Date(),
            linkedEntityType: 'enrollment',
            linkedEntityId: enrollmentId,
            updatedAt: new Date(),
          })
          .where(eq(reconciliationEscalations.id, escalationId));

        await tx
          .update(reconciliationFindings)
          .set({
            status: RECONCILIATION_STATUS.RESOLVED,
            resolutionNote: `Resolved via escalation — enrolled ${student.email} in "${course.title}". ${note}`,
            resolvedBy: user.id,
            resolvedAt: new Date(),
            paymentId: paymentId, // link payment we just created or had
            updatedAt: new Date(),
          })
          .where(eq(reconciliationFindings.id, escalation.findingId));
      });
    } catch (err) {
      this.logger.error(
        `Escalation ${escalationId}: enrollment succeeded but escalation/finding update FAILED. ` +
          `Student ${student.email} is enrolled (id=${enrollmentId}) but escalation state is stale. ` +
          `Error: ${(err as Error).message}`,
      );
      throw err;
    }

    // 5b. Async invoice generation when we just flipped a payment to PAID.
    //     Fire-and-forget — matches the canonical bank-transfer approval
    //     pattern. Doesn't block the API response; logs but doesn't throw
    //     if invoice generation hits an issue.
    if (paymentFlipped && paymentId) {
      void this.invoiceService
        .generateInvoice(paymentId)
        .catch((e) =>
          this.logger.error(
            `Invoice generation failed for escalation-enrolled payment ${paymentId}: ${e.message}`,
          ),
        );
    }

    await this.auditLogService.log({
      entityType: 'reconciliation_escalation',
      entityId: escalationId,
      action: 'reconciliation_escalation_enrolled',
      performedBy: user.id,
      ipAddress,
      metadata: {
        studentId: student.id,
        courseId: course.id,
        enrollmentId,
        paymentId,
        paymentCreated,
        paymentFlipped,
        receiptApproved,
        note,
      },
    });

    // 6. Notify finance who escalated. Best-effort; never blocks.
    this.notifyFinanceOfTransition(escalationId, 'resolved').catch((err) => {
      this.logger.error(`Failed to notify finance of resolution: ${err.message}`);
    });

    return {
      escalationId,
      findingId: escalation.findingId,
      enrollmentId,
      paymentCreated,
      paymentFlipped,
      receiptApproved,
      paymentId,
    };
  }

  /**
   * E.3 — Issue a refund from an escalation. Admin-initiated path:
   *   1. Validate escalation + payment is PAID.
   *   2. Create the refund row already in APPROVED state (admin both
   *      requested and approved in one click — bypasses the two-step
   *      student-request → finance-approve flow used elsewhere).
   *   3. Call the gateway's refund API.
   *   4. On success: mark refund PROCESSING + resolve escalation + finding.
   *   5. On failure: refund row stays APPROVED so finance can retry from
   *      the existing Refunds page; escalation stays open with the error.
   */
  async refundFromEscalation(
    escalationId: string,
    user: AuthenticatedUser,
    opts: {
      amount?: number; // defaults to full payment amount
      reason: string;
      note: string;
    },
    ipAddress?: string,
  ): Promise<{
    escalationId: string;
    findingId: string;
    refundId: string;
    gatewayRefundId: string | null;
  }> {
    const note = (opts.note || '').trim();
    const reason = (opts.reason || '').trim();
    if (note.length < 10) {
      throw new BadRequestException(
        'Refund note must be at least 10 characters — captured in audit log.',
      );
    }
    if (!reason) {
      throw new BadRequestException('Refund reason is required');
    }

    const [escalation] = await db
      .select()
      .from(reconciliationEscalations)
      .where(eq(reconciliationEscalations.id, escalationId))
      .limit(1);
    if (!escalation) throw new NotFoundException('Escalation not found');
    if (
      escalation.status !== ESCALATION_STATUS.PENDING &&
      escalation.status !== ESCALATION_STATUS.IN_PROGRESS
    ) {
      throw new ConflictException(
        `Escalation is ${escalation.status} — cannot refund.`,
      );
    }

    const [finding] = await db
      .select()
      .from(reconciliationFindings)
      .where(eq(reconciliationFindings.id, escalation.findingId))
      .limit(1);
    if (!finding) throw new NotFoundException('Linked finding not found');
    if (!finding.paymentId) {
      throw new BadRequestException(
        'Cannot refund — finding has no linked payment. If this is a missing_local finding, use Enroll instead (or investigate why a refund is appropriate here).',
      );
    }

    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, finding.paymentId))
      .limit(1);
    if (!payment) throw new NotFoundException('Linked payment not found');
    if (payment.status !== PAYMENT_STATUS.PAID) {
      throw new BadRequestException(
        `Cannot refund a payment with status=${payment.status}. Only PAID payments can be refunded.`,
      );
    }
    if (!payment.gatewayChargeId) {
      throw new BadRequestException(
        'Cannot refund — payment has no gateway charge ID. Bank transfers without a charge id need to be refunded out-of-band.',
      );
    }

    // Reject overlapping refunds — same guard as the standard request flow.
    const [existingRefund] = await db
      .select()
      .from(refunds)
      .where(
        and(
          eq(refunds.paymentId, payment.id),
          sql`${refunds.status} IN ('pending', 'approved', 'processing')`,
        ),
      )
      .limit(1);
    if (existingRefund) {
      throw new ConflictException(
        'A refund is already in progress for this payment — finish it via the Refunds page before issuing another.',
      );
    }

    const originalAmount = Number(payment.amount);
    const refundAmount = opts.amount != null ? Number(opts.amount) : originalAmount;
    if (refundAmount <= 0 || refundAmount > originalAmount) {
      throw new BadRequestException(
        `Refund amount must be > 0 and <= ${originalAmount} (the original payment amount)`,
      );
    }

    // Create the refund row in APPROVED state (admin both requested and
    // approved this in one action — skip the pending stage). We're NOT
    // applying the BNPL deduction here; the admin entered the explicit
    // amount they want to refund.
    const [refund] = await db
      .insert(refunds)
      .values({
        paymentId: payment.id,
        requestedBy: user.id,
        reason,
        reasonNote: note,
        originalAmount: originalAmount.toFixed(2),
        deductionAmount: '0.00',
        refundAmount: refundAmount.toFixed(2),
        status: REFUND_STATUS.APPROVED,
        processedBy: user.id,
        approvalNote: `Issued via reconciliation escalation: ${note}`,
        approvedAt: new Date(),
      })
      .returning();

    // Call the gateway. If this fails, the refund stays APPROVED — finance
    // can retry from the refunds page. Escalation stays open so admin
    // can see the error and re-try.
    let gatewayRefundId: string | null = null;
    try {
      const gateway = this.gatewayFactory.getGateway(payment.gateway);
      const result = await gateway.refund({
        gatewayChargeId: payment.gatewayChargeId,
        amount: refundAmount,
        reason,
      });
      gatewayRefundId = result.refundId;
      await db
        .update(refunds)
        .set({
          status: REFUND_STATUS.PROCESSING,
          gatewayRefundId,
          updatedAt: new Date(),
        })
        .where(eq(refunds.id, refund.id));
    } catch (err) {
      this.logger.error(
        `Escalation ${escalationId}: gateway refund FAILED for payment ${payment.id}: ${(err as Error).message}. ` +
          `Refund ${refund.id} left in APPROVED state for finance retry.`,
      );
      throw new BadRequestException(
        `Gateway refund failed: ${(err as Error).message}. The refund row was created in APPROVED state — retry it from the Refunds page.`,
      );
    }

    // Resolve escalation + finding in one tx.
    try {
      await db.transaction(async (tx) => {
        await tx
          .update(reconciliationEscalations)
          .set({
            status: ESCALATION_STATUS.RESOLVED,
            actionTaken: ESCALATION_ACTION_TAKEN.REFUNDED,
            resolutionNote: note,
            resolvedBy: user.id,
            resolvedAt: new Date(),
            linkedEntityType: 'refund',
            linkedEntityId: refund.id,
            updatedAt: new Date(),
          })
          .where(eq(reconciliationEscalations.id, escalationId));

        await tx
          .update(reconciliationFindings)
          .set({
            status: RECONCILIATION_STATUS.RESOLVED,
            resolutionNote: `Resolved via escalation — refunded ${refundAmount} ${payment.currency}. ${note}`,
            resolvedBy: user.id,
            resolvedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(reconciliationFindings.id, escalation.findingId));
      });
    } catch (err) {
      this.logger.error(
        `Escalation ${escalationId}: gateway refund succeeded but escalation/finding update failed: ${(err as Error).message}`,
      );
      throw err;
    }

    await this.auditLogService.log({
      entityType: 'reconciliation_escalation',
      entityId: escalationId,
      action: 'reconciliation_escalation_refunded',
      performedBy: user.id,
      ipAddress,
      metadata: {
        refundId: refund.id,
        paymentId: payment.id,
        refundAmount,
        gatewayRefundId,
        reason,
        note,
      },
    });

    this.notifyFinanceOfTransition(escalationId, 'resolved').catch((err) => {
      this.logger.error(`Failed to notify finance of resolution: ${err.message}`);
    });

    return {
      escalationId,
      findingId: escalation.findingId,
      refundId: refund.id,
      gatewayRefundId,
    };
  }

  private inferPaymentMethod(gateway: string): string {
    // Pragmatic mapping — the finding doesn't tell us card-vs-mada for
    // Moyasar charges, so we fall back to the gateway's default method.
    switch (gateway) {
      case 'tamara':
      case 'tabby':
        return PAYMENT_METHOD.BNPL;
      case 'bank_transfer':
        return PAYMENT_METHOD.BANK_TRANSFER;
      case 'moyasar':
      default:
        return PAYMENT_METHOD.CARD;
    }
  }

  private async assertEscalationExists(escalationId: string): Promise<void> {
    const [row] = await db
      .select({ id: reconciliationEscalations.id })
      .from(reconciliationEscalations)
      .where(eq(reconciliationEscalations.id, escalationId))
      .limit(1);
    if (!row) throw new NotFoundException('Escalation not found');
  }

  // ─── Notifications ───────────────────────────────────────────────────

  /**
   * Look up all ADMIN + SUPER_ADMIN users and notify them of a new
   * escalation. High-urgency escalations get a louder subject line.
   * Best-effort — never throws (errors logged + swallowed by the caller).
   */
  private async notifyAdminsOfNewEscalation(
    escalationId: string,
    urgency: EscalationUrgency,
  ): Promise<void> {
    const adminEmails = await this.getAdminEmails();
    if (adminEmails.length === 0) {
      this.logger.warn(
        `No ADMIN/SUPER_ADMIN users found — escalation ${escalationId} created but no one notified.`,
      );
      return;
    }
    await this.emailService.sendReconciliationEscalationCreated(
      adminEmails,
      escalationId,
      urgency,
    );
  }

  private async notifyFinanceOfTransition(
    escalationId: string,
    kind: 'sent_back' | 'declined' | 'resolved',
  ): Promise<void> {
    const [esc] = await db
      .select({
        escalatedBy: reconciliationEscalations.escalatedBy,
        email: users.email,
      })
      .from(reconciliationEscalations)
      .leftJoin(users, eq(users.id, reconciliationEscalations.escalatedBy))
      .where(eq(reconciliationEscalations.id, escalationId))
      .limit(1);
    if (!esc?.email) {
      // System-escalated rows (Phase E.5 cron) have escalatedBy = NULL.
      // Skipping the notification in that case is the correct behavior —
      // there's no human finance recipient to inform.
      return;
    }
    await this.emailService.sendReconciliationEscalationTransition(
      esc.email,
      escalationId,
      kind,
    );
  }

  private async getAdminEmails(): Promise<string[]> {
    const rows = await db
      .selectDistinct({ email: users.email })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(or(eq(roles.name, 'ADMIN'), eq(roles.name, 'SUPER_ADMIN')));
    return rows.map((r) => r.email).filter((e): e is string => !!e);
  }
}
