import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { isCronExternalized } from '../../common/is-cron-externalized.helper';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { db } from '../../database';
import {
  tickets,
  slaPolicies,
  slaEvents,
  csatSurveys,
  cronRuns,
  users,
  TICKET_STATUS,
  TICKET_PRIORITY,
  SLA_EVENT_TYPES,
  ON_HOLD_REASONS,
} from '../../database/schema';

// Stable identifiers for the per-cron rows in `cron_runs`. The admin
// Support Overview UI maps these to translated display names.
export const CRON_NAMES = {
  SLA_BREACH_CHECK: 'SLA_BREACH_CHECK',
  PRIORITY_ESCALATION: 'PRIORITY_ESCALATION',
  AUTO_CLOSE_RESOLVED: 'AUTO_CLOSE_RESOLVED',
  AUTO_CLOSE_WAITING_STUDENT: 'AUTO_CLOSE_WAITING_STUDENT',
  CSAT_EMAIL_SEND: 'CSAT_EMAIL_SEND',
  BUSINESS_RESUME_SWEEP: 'BUSINESS_RESUME_SWEEP',
} as const;
export type CronName = (typeof CRON_NAMES)[keyof typeof CRON_NAMES];
import {
  calculateBusinessMinutesElapsed,
  effectiveBusinessMinutesElapsed,
  isWithinBusinessHours,
  refreshBusinessHoursConfigIfStale,
} from './business-hours.util';
import { SupportService } from './support.service';
import { EmailService } from '../email/email.service';
import { UserNotificationsService } from '../user-notifications/user-notifications.service';
import { DistributedLockService } from '../tasks/distributed-lock.service';
import { TasksService } from '../tasks/tasks.service';
import { SafetyNetSweep } from '../tasks/safety-net-sweep';

// Cloud Tasks constants for the support/CSAT flow. Kept adjacent so
// name-scheme and handler wiring don't drift.
export const TICKETS_QUEUE = 'ticket-events';
export const TICKET_HANDLERS = {
  CSAT_SEND: 'ticket.csat-send',
  AUTO_CLOSE_RESOLVED: 'ticket.auto-close-resolved',
  AUTO_CLOSE_WAITING: 'ticket.auto-close-waiting',
} as const;

export interface CsatTaskPayload {
  surveyId: string;
}

export interface TicketTaskPayload {
  ticketId: string;
}

// CSAT email fires at ticket.resolvedAt + CSAT_EMAIL_DELAY_MS. Keeping
// the 15-min delay from the legacy cron so student sees the email once
// they've had a chance to leave the app and come back.
export const CSAT_EMAIL_DELAY_MS = 15 * 60_000;
// Auto-close-resolved fires at ticket.resolvedAt + AUTO_CLOSE_DELAY_MS
export const AUTO_CLOSE_DELAY_MS = 48 * 60 * 60 * 1000; // 48h

@Injectable()
export class SlaMonitorService {
  private readonly logger = new Logger(SlaMonitorService.name);

  private readonly csatSafetyNet: SafetyNetSweep;

  constructor(
    @Inject(forwardRef(() => SupportService))
    private readonly supportService: SupportService,
    private readonly emailService: EmailService,
    private readonly notificationsService: UserNotificationsService,
    private readonly lock: DistributedLockService,
    private readonly tasks: TasksService,
  ) {
    this.csatSafetyNet = new SafetyNetSweep(this.tasks, this.lock);
  }

  /**
   * Wrap a cron tick so each run records a row in `cron_runs`. The
   * admin Support Overview reads the most-recent row per cron_name to
   * surface "last run X seconds ago / status". Best-effort — a tracking
   * failure never blocks the underlying work.
   *
   * Pattern: INSERT row with status='running' → run body → UPDATE row
   * with finished_at + duration + status. If the body throws, we still
   * UPDATE with status='error' and a truncated message so the strip
   * shows a red state instead of going silent.
   */
  private async trackCronRun(
    name: CronName,
    body: () => Promise<void>,
  ): Promise<void> {
    let runId: string | null = null;
    const startedAt = new Date();
    try {
      const [row] = await db
        .insert(cronRuns)
        .values({ cronName: name, startedAt, status: 'running' })
        .returning({ id: cronRuns.id });
      runId = row?.id ?? null;
    } catch {
      // Tracking shouldn't shadow the work — proceed without a row.
    }

    try {
      await body();
      if (runId) {
        const finishedAt = new Date();
        await db
          .update(cronRuns)
          .set({
            status: 'success',
            finishedAt,
            durationMs: finishedAt.getTime() - startedAt.getTime(),
          })
          .where(eq(cronRuns.id, runId));
      }
    } catch (err) {
      if (runId) {
        const finishedAt = new Date();
        await db
          .update(cronRuns)
          .set({
            status: 'error',
            finishedAt,
            durationMs: finishedAt.getTime() - startedAt.getTime(),
            errorMessage: String(err).slice(0, 500),
          })
          .where(eq(cronRuns.id, runId));
      }
      throw err;
    }
  }

  /**
   * SLA Breach Detection — runs every 5 minutes
   * Checks all open tickets against their SLA policy
   *
   * SLA-03: FRT breach → auto-reassign
   * SLA-04: TTR breach → notify supervisor, no reassign
   * SLA-07: 75% FRT warning
   * SLA-10: Dedup via sla_events check
   * BH-05: On-hold tickets skip TTR check
   */
  @Cron('*/5 * * * *')
  async checkSlaBreaches() {
    if (isCronExternalized('support.sla-breach')) return;
    // Distributed lock so this cron is safe running in-process on
    // multi-instance api-web (Phase 4 flip). The per-ticket CAS UPDATEs
    // inside already prevent duplicate breach events, but the lock
    // avoids N-instance duplication of the whole 5-min scan.
    await this.lock.withLock('lock:cron:support.sla-breach', 5 * 60_000, () =>
      this.trackCronRun(CRON_NAMES.SLA_BREACH_CHECK, async () => {
    try {
      // Refresh business-hours cache if stale — protects against another
      // Cloud Run instance having handled the admin PATCH while this one
      // still holds an old config.
      await refreshBusinessHoursConfigIfStale(() =>
        this.supportService.getBusinessHours(),
      );

      // Get all open tickets
      const openTickets = await db
        .select({
          id: tickets.id,
          referenceNumber: tickets.referenceNumber,
          priority: tickets.priority,
          status: tickets.status,
          assigneeId: tickets.assigneeId,
          firstResponseAt: tickets.firstResponseAt,
          slaBreachedFrt: tickets.slaBreachedFrt,
          slaBreachedTtr: tickets.slaBreachedTtr,
          onHoldAt: tickets.onHoldAt,
          onHoldTotalMinutes: tickets.onHoldTotalMinutes,
          createdAt: tickets.createdAt,
        })
        .from(tickets)
        .where(
          inArray(tickets.status, [
            TICKET_STATUS.NEW,
            TICKET_STATUS.IN_PROGRESS,
            TICKET_STATUS.ON_HOLD,
          ]),
        );

      if (!openTickets.length) return;

      // Fetch all SLA policies
      const policies = await db.select().from(slaPolicies);
      const policyMap = new Map(policies.map((p) => [p.priority, p]));

      const now = new Date();

      for (const ticket of openTickets) {
        try {
          const policy = policyMap.get(ticket.priority);
          if (!policy) continue;

          // Effective math — accounts for completed AND in-flight hold
          // minutes. Without this, a ticket parked on hold mid-clock
          // would breach FRT/TTR even though the timer was supposed
          // to be paused. This is the back-end half of the
          // "ticket was on hold but timer never stopped" fix.
          const effectiveBizMinutes = effectiveBusinessMinutesElapsed(
            ticket,
            now,
          );

          // ─── FRT Check (only if no first response yet) ────────
          if (!ticket.firstResponseAt) {
            // FRT Breach (SLA-03)
            if (
              effectiveBizMinutes >= policy.frtMinutes &&
              !ticket.slaBreachedFrt
            ) {
              // Atomic compare-and-swap: flip slaBreachedFrt from false
              // → true in a single statement. Combines the SELECT-then-
              // flag-set into one operation so two Cloud Run instances
              // can't both win the dedup check and both reassign the
              // ticket to (potentially different) agents. Loser sees
              // zero affected rows and skips ALL side-effects below.
              const claimed = await db
                .update(tickets)
                .set({
                  slaBreachedFrt: true,
                  // Stamp escalated_at so the FE chip + admin filter
                  // light up on FRT breach. Only set on first breach;
                  // re-running the cron is a no-op because we just
                  // claimed the row from breached=false → breached=true.
                  escalatedAt: sql`COALESCE(${tickets.escalatedAt}, ${now})`,
                  updatedAt: now,
                })
                .where(
                  and(
                    eq(tickets.id, ticket.id),
                    eq(tickets.slaBreachedFrt, false),
                  ),
                )
                .returning({ id: tickets.id });

              if (claimed.length > 0) {
                // Log breach event
                await db.insert(slaEvents).values({
                  ticketId: ticket.id,
                  eventType: SLA_EVENT_TYPES.FRT_BREACH,
                  notifiedUserIds: ticket.assigneeId
                    ? [ticket.assigneeId]
                    : [],
                });

                // Auto-reassign to next agent (RR-11)
                const excludeIds = ticket.assigneeId
                  ? [ticket.assigneeId]
                  : [];
                let newAssignee =
                  await this.supportService.findNextAgentForReassignment(
                    excludeIds,
                  );

                // If all agents exhausted, escalate to supervisor (RR-12)
                if (!newAssignee) {
                  newAssignee =
                    await this.supportService.findSupervisorId();
                }

                if (newAssignee) {
                  await db
                    .update(tickets)
                    .set({
                      assigneeId: newAssignee,
                      // Batch 3: do NOT reset slaBreachedFrt here. The
                      // breach is a historical fact needed by reports and
                      // the breach banner on the detail view. The
                      // `frt_breach_reassigned` slaEvents row records the
                      // remediation; the flag stays true.
                      updatedAt: now,
                    })
                    .where(eq(tickets.id, ticket.id));

                  await db.insert(slaEvents).values({
                    ticketId: ticket.id,
                    eventType: SLA_EVENT_TYPES.FRT_BREACH_REASSIGNED,
                    notifiedUserIds: [newAssignee],
                  });
                }

                this.logger.warn(
                  `FRT breach on ticket ${ticket.id} — reassigned to ${newAssignee || 'supervisor'}`,
                );

                // Send FRT breach emails (gated by recipient's email master)
                try {
                  if (
                    ticket.assigneeId &&
                    (await this.supportService.shouldNotifySupport(
                      ticket.assigneeId,
                      'email',
                    ))
                  ) {
                    const [agentInfo] = await db.select({ email: users.email, firstName: users.firstName }).from(users).where(eq(users.id, ticket.assigneeId));
                    if (agentInfo?.email) {
                      await this.emailService.sendSlaFrtBreach(
                        agentInfo.email,
                        agentInfo.firstName || 'Agent',
                        ticket.referenceNumber,
                        '',
                        String(policy.frtMinutes),
                      );
                    }
                  }
                } catch { /* non-blocking */ }

                // Send escalation email to supervisor (gated)
                try {
                  if (
                    newAssignee &&
                    (await this.supportService.shouldNotifySupport(
                      newAssignee,
                      'email',
                    ))
                  ) {
                    const [supervisorInfo] = await db.select({ email: users.email, firstName: users.firstName }).from(users).where(eq(users.id, newAssignee));
                    if (supervisorInfo?.email) {
                      await this.emailService.sendTicketEscalation(
                        supervisorInfo.email,
                        supervisorInfo.firstName || 'Supervisor',
                        ticket.referenceNumber,
                        '',
                        'All agents missed FRT deadline',
                      );
                    }
                  }
                } catch { /* non-blocking */ }

                // Fan the FRT-breach escalation email out to all admins.
                // Mirrors the TTR-breach fan-out below; admins own
                // platform-wide support health and need to see FRT
                // breaches without having to dig into the supervisor
                // alerts page.
                try {
                  const adminIds = await this.supportService.findAdminUserIds();
                  const adminRecipients = adminIds.filter(
                    (id) => id !== newAssignee && id !== ticket.assigneeId,
                  );
                  if (adminRecipients.length) {
                    const adminInfo = await db
                      .select({ id: users.id, email: users.email, firstName: users.firstName })
                      .from(users)
                      .where(inArray(users.id, adminRecipients));
                    await Promise.all(
                      adminInfo.map(async (a) => {
                        if (!a.email) return;
                        if (!(await this.supportService.shouldNotifySupport(a.id, 'email'))) return;
                        await this.emailService.sendTicketEscalation(
                          a.email,
                          a.firstName || 'Admin',
                          ticket.referenceNumber,
                          '',
                          `FRT breached: ${policy.frtMinutes}m target exceeded — reassigned`,
                        );
                      }),
                    );
                  }
                } catch { /* non-blocking */ }
              }
            }

            // 75% FRT Warning (SLA-07)
            if (
              !ticket.slaBreachedFrt &&
              effectiveBizMinutes >= policy.frtMinutes * 0.75
            ) {
              const [existingWarning] = await db
                .select({ id: slaEvents.id })
                .from(slaEvents)
                .where(
                  and(
                    eq(slaEvents.ticketId, ticket.id),
                    eq(slaEvents.eventType, SLA_EVENT_TYPES.FRT_WARNING_75),
                  ),
                )
                .limit(1);

              if (!existingWarning) {
                await db.insert(slaEvents).values({
                  ticketId: ticket.id,
                  eventType: SLA_EVENT_TYPES.FRT_WARNING_75,
                  notifiedUserIds: ticket.assigneeId
                    ? [ticket.assigneeId]
                    : [],
                });

                this.logger.log(
                  `75% FRT warning on ticket ${ticket.id}`,
                );
              }
            }
          }

          // ─── TTR Check (skip on-hold tickets — BH-05) ────────
          if (ticket.status !== TICKET_STATUS.ON_HOLD) {
            if (
              effectiveBizMinutes >= policy.ttrMinutes &&
              !ticket.slaBreachedTtr
            ) {
              // Same atomic compare-and-swap as the FRT branch above.
              // Combines the dedup check and the flag set so concurrent
              // cron ticks across Cloud Run instances can't both
              // reassign the same ticket. Loser sees zero rows
              // returned and skips all side-effects (events insert,
              // reassignment, breach emails, supervisor escalation).
              const claimedTtr = await db
                .update(tickets)
                .set({
                  slaBreachedTtr: true,
                  // Same escalated_at stamp as the FRT branch — TTR
                  // breach also lights up the chip + admin filter.
                  escalatedAt: sql`COALESCE(${tickets.escalatedAt}, ${now})`,
                  updatedAt: now,
                })
                .where(
                  and(
                    eq(tickets.id, ticket.id),
                    eq(tickets.slaBreachedTtr, false),
                  ),
                )
                .returning({ id: tickets.id });

              if (claimedTtr.length > 0) {

                // Look up the supervisor once so we can (a) record them in
                // the sla_events audit row and (b) email them below. Spec:
                // "breach-alert notifications to the assigned agent AND
                // their supervisor."
                const supervisorId =
                  await this.supportService.findSupervisorId();

                if (!supervisorId) {
                  this.logger.warn(
                    `TTR breach on ticket ${ticket.id}: no supervisor configured — escalation email skipped. Configure at least one SUPPORT user with supportSubRole='supervisor'.`,
                  );
                }

                const notifiedIds: string[] = [];
                if (ticket.assigneeId) notifiedIds.push(ticket.assigneeId);
                if (supervisorId && supervisorId !== ticket.assigneeId)
                  notifiedIds.push(supervisorId);

                await db.insert(slaEvents).values({
                  ticketId: ticket.id,
                  eventType: SLA_EVENT_TYPES.TTR_BREACH,
                  notifiedUserIds: notifiedIds,
                });

                // TTR breach: auto-reassign to next agent. Combined with
                // the agent isolation checks in Batch 1, the breaching
                // agent automatically loses access once assigneeId changes.
                const excludeIds = ticket.assigneeId
                  ? [ticket.assigneeId]
                  : [];
                let newTtrAssignee =
                  await this.supportService.findNextAgentForReassignment(
                    excludeIds,
                  );
                if (!newTtrAssignee) {
                  newTtrAssignee = supervisorId || null;
                }

                if (newTtrAssignee) {
                  await db
                    .update(tickets)
                    .set({
                      assigneeId: newTtrAssignee,
                      updatedAt: now,
                    })
                    .where(eq(tickets.id, ticket.id));

                  await db.insert(slaEvents).values({
                    ticketId: ticket.id,
                    eventType: SLA_EVENT_TYPES.TTR_BREACH_REASSIGNED,
                    notifiedUserIds: [newTtrAssignee],
                  });
                }

                this.logger.warn(
                  `TTR breach on ticket ${ticket.id} — reassigned to ${newTtrAssignee || 'supervisor'}`,
                );

                // Send TTR breach email to the breaching agent (gated)
                try {
                  if (
                    ticket.assigneeId &&
                    (await this.supportService.shouldNotifySupport(
                      ticket.assigneeId,
                      'email',
                    ))
                  ) {
                    const [agentInfo] = await db.select({ email: users.email, firstName: users.firstName }).from(users).where(eq(users.id, ticket.assigneeId));
                    if (agentInfo?.email) {
                      await this.emailService.sendSlaTtrBreach(
                        agentInfo.email,
                        agentInfo.firstName || 'Agent',
                        ticket.referenceNumber,
                        '',
                        String(policy.ttrMinutes),
                      );
                    }
                  }
                } catch { /* non-blocking */ }

                // Send assignment email to the new agent (gated)
                try {
                  if (
                    newTtrAssignee &&
                    (await this.supportService.shouldNotifySupport(
                      newTtrAssignee,
                      'email',
                    ))
                  ) {
                    const [newAgentInfo] = await db
                      .select({ email: users.email, firstName: users.firstName })
                      .from(users)
                      .where(eq(users.id, newTtrAssignee));
                    if (newAgentInfo?.email) {
                      await this.emailService.sendTicketEscalation(
                        newAgentInfo.email,
                        newAgentInfo.firstName || 'Agent',
                        ticket.referenceNumber,
                        '',
                        `TTR breach — ticket reassigned to you`,
                      );
                    }
                  }
                } catch { /* non-blocking */ }

                // Send escalation email to the supervisor (gated)
                try {
                  if (
                    supervisorId &&
                    (await this.supportService.shouldNotifySupport(
                      supervisorId,
                      'email',
                    ))
                  ) {
                    const [supInfo] = await db
                      .select({ email: users.email, firstName: users.firstName })
                      .from(users)
                      .where(eq(users.id, supervisorId));
                    if (supInfo?.email) {
                      await this.emailService.sendTicketEscalation(
                        supInfo.email,
                        supInfo.firstName || 'Supervisor',
                        ticket.referenceNumber,
                        '',
                        `TTR breached: ${policy.ttrMinutes}m target exceeded — reassigned`,
                      );
                    }
                  }
                } catch { /* non-blocking */ }

                // Fan the same escalation email out to all admins. They
                // own platform-wide health and should see SLA breaches
                // even though they're not in the support rotation.
                try {
                  const adminIds = await this.supportService.findAdminUserIds();
                  const adminRecipients = adminIds.filter(
                    (id) => id !== supervisorId && id !== ticket.assigneeId,
                  );
                  if (adminRecipients.length) {
                    const adminInfo = await db
                      .select({ id: users.id, email: users.email, firstName: users.firstName })
                      .from(users)
                      .where(inArray(users.id, adminRecipients));
                    await Promise.all(
                      adminInfo.map(async (a) => {
                        if (!a.email) return;
                        if (!(await this.supportService.shouldNotifySupport(a.id, 'email'))) return;
                        await this.emailService.sendTicketEscalation(
                          a.email,
                          a.firstName || 'Admin',
                          ticket.referenceNumber,
                          '',
                          `TTR breached: ${policy.ttrMinutes}m target exceeded — reassigned`,
                        );
                      }),
                    );
                  }
                } catch { /* non-blocking */ }
              }
            }
          }
        } catch (err) {
          this.logger.error(
            `Error checking SLA for ticket ${ticket.id}: ${err}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(`SLA breach check failed: ${err}`);
    }
    }),
    );
  }

  /**
   * Priority Age Escalation — runs every hour
   * PR-03: LOW → MEDIUM after `escalateAfterMinutes` of the LOW policy
   * PR-04: MEDIUM → HIGH after `escalateAfterMinutes` of the MEDIUM policy
   * PR-05: HIGH never escalates further
   *
   * Thresholds are read live from `sla_policies.escalate_after_minutes`,
   * which supervisors edit via the SLA Targets settings panel. If a
   * policy row is missing for either priority, that priority is silently
   * skipped this cycle — supervisors are expected to seed all three
   * priority rows (seed migration `0037_support_system.sql:140` does so).
   */
  @Cron('0 * * * *')
  async checkPriorityEscalations() {
    if (isCronExternalized('support.priority-escalation')) return;
    // Distributed lock — multi-instance safe when this moves in-process.
    await this.lock.withLock(
      'lock:cron:support.priority-escalation',
      5 * 60_000,
      () =>
        this.trackCronRun(CRON_NAMES.PRIORITY_ESCALATION, async () => {
    try {
      // Same anti-stale guard as checkSlaBreaches — see that method.
      await refreshBusinessHoursConfigIfStale(() =>
        this.supportService.getBusinessHours(),
      );

      // Fetch live policies once per cron tick so supervisor edits take
      // effect on the next run without restart. A Map<priority, threshold>
      // keeps the per-ticket lookup constant-time.
      const policyRows = await db
        .select({
          priority: slaPolicies.priority,
          escalateAfterMinutes: slaPolicies.escalateAfterMinutes,
        })
        .from(slaPolicies);
      const escalateAfterByPriority = new Map<string, number>(
        policyRows.map((p) => [p.priority, p.escalateAfterMinutes]),
      );
      const lowThreshold = escalateAfterByPriority.get(TICKET_PRIORITY.LOW);
      const mediumThreshold = escalateAfterByPriority.get(
        TICKET_PRIORITY.MEDIUM,
      );

      const openTickets = await db
        .select({
          id: tickets.id,
          referenceNumber: tickets.referenceNumber,
          priority: tickets.priority,
          status: tickets.status,
          assigneeId: tickets.assigneeId,
          onHoldAt: tickets.onHoldAt,
          onHoldTotalMinutes: tickets.onHoldTotalMinutes,
          createdAt: tickets.createdAt,
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

      for (const ticket of openTickets) {
        try {
          // Same hold-aware math as the FRT/TTR breach loop above.
          const effectiveBizMinutes = effectiveBusinessMinutesElapsed(
            ticket,
            now,
          );

          let newPriority: string | null = null;

          if (
            ticket.priority === TICKET_PRIORITY.LOW &&
            lowThreshold != null &&
            effectiveBizMinutes > lowThreshold
          ) {
            newPriority = TICKET_PRIORITY.MEDIUM;
          }

          if (
            ticket.priority === TICKET_PRIORITY.MEDIUM &&
            mediumThreshold != null &&
            effectiveBizMinutes > mediumThreshold
          ) {
            newPriority = TICKET_PRIORITY.HIGH;
          }

          if (newPriority) {
            // Dedup: check if already escalated
            const [existing] = await db
              .select({ id: slaEvents.id })
              .from(slaEvents)
              .where(
                and(
                  eq(slaEvents.ticketId, ticket.id),
                  eq(
                    slaEvents.eventType,
                    SLA_EVENT_TYPES.PRIORITY_ESCALATED,
                  ),
                ),
              )
              .limit(1);

            // Allow multiple escalations (LOW→MED, then MED→HIGH)
            // But not the same escalation twice — check current priority matches
            await db
              .update(tickets)
              .set({
                priority: newPriority,
                updatedAt: now,
              })
              .where(eq(tickets.id, ticket.id));

            const escalationNotifiedIds: string[] = [];
            if (ticket.assigneeId) escalationNotifiedIds.push(ticket.assigneeId);

            await db.insert(slaEvents).values({
              ticketId: ticket.id,
              eventType: SLA_EVENT_TYPES.PRIORITY_ESCALATED,
              notifiedUserIds: escalationNotifiedIds,
            });

            this.logger.log(
              `Priority escalated: ticket ${ticket.id} from ${ticket.priority} to ${newPriority}`,
            );

            // M5: Notify assigned agent about priority escalation (gated)
            try {
              if (
                ticket.assigneeId &&
                (await this.supportService.shouldNotifySupport(
                  ticket.assigneeId,
                  'email',
                ))
              ) {
                const [agInfo] = await db
                  .select({ email: users.email, firstName: users.firstName })
                  .from(users)
                  .where(eq(users.id, ticket.assigneeId));
                if (agInfo?.email) {
                  await this.emailService.sendTicketEscalation(
                    agInfo.email,
                    agInfo.firstName || 'Agent',
                    ticket.referenceNumber,
                    '',
                    `Priority auto-escalated from ${ticket.priority} to ${newPriority}`,
                  );
                }
              }
            } catch { /* non-blocking */ }

            // Fan the priority-escalation email out to the supervisor
            // and all admins so they can keep visibility on aging
            // tickets without having to poll the queue.
            try {
              const supervisorId = await this.supportService.findSupervisorId();
              const adminIds = await this.supportService.findAdminUserIds();
              const extraIds = new Set<string>();
              if (supervisorId && supervisorId !== ticket.assigneeId) {
                extraIds.add(supervisorId);
              }
              for (const a of adminIds) {
                if (a !== ticket.assigneeId) extraIds.add(a);
              }
              if (extraIds.size > 0) {
                const recipientRows = await db
                  .select({ id: users.id, email: users.email, firstName: users.firstName })
                  .from(users)
                  .where(inArray(users.id, Array.from(extraIds)));
                await Promise.all(
                  recipientRows.map(async (r) => {
                    if (!r.email) return;
                    if (!(await this.supportService.shouldNotifySupport(r.id, 'email'))) return;
                    await this.emailService.sendTicketEscalation(
                      r.email,
                      r.firstName || 'Team',
                      ticket.referenceNumber,
                      '',
                      `Priority auto-escalated from ${ticket.priority} to ${newPriority}`,
                    );
                  }),
                );
              }
            } catch { /* non-blocking */ }
          }
        } catch (err) {
          this.logger.error(
            `Error checking priority escalation for ticket ${ticket.id}: ${err}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(`Priority escalation check failed: ${err}`);
    }
    }),
    );
  }

  /**
   * Auto-close resolved tickets after 48h with no student reply (RS-08)
   * Runs every 30 minutes
   */
  /**
   * Legacy every-30-min cron — RETAINED for parallel-run with Cloud
   * Tasks. Delegates to autoCloseResolvedOne per row. Retire in Phase 5.2.
   */
  @Cron('*/30 * * * *')
  async autoCloseResolvedTickets() {
    if (isCronExternalized('support.auto-close-resolved')) return;
    await this.trackCronRun(CRON_NAMES.AUTO_CLOSE_RESOLVED, async () => {
    try {
      const cutoff = new Date(Date.now() - AUTO_CLOSE_DELAY_MS);
      const resolvedTickets = await db
        .select({ id: tickets.id })
        .from(tickets)
        .where(
          and(
            eq(tickets.status, TICKET_STATUS.RESOLVED),
            sql`${tickets.resolvedAt} IS NOT NULL AND ${tickets.resolvedAt} < ${cutoff}`,
          ),
        );

      let closed = 0;
      for (const t of resolvedTickets) {
        if (await this.autoCloseResolvedOne(t.id)) closed++;
      }
      if (closed > 0) {
        this.logger.log(`Auto-closed ${closed} resolved ticket(s)`);
      }
    } catch (err) {
      this.logger.error(`Auto-close check failed: ${err}`);
    }
    });
  }

  // ─── Per-row event handler: auto-close resolved ─────────

  /**
   * Flip RESOLVED → CLOSED for a ticket that hit its 48h grace.
   * CAS-guarded so parallel-run and multi-instance can't double-write.
   */
  async autoCloseResolvedOne(ticketId: string): Promise<boolean> {
    const [ticket] = await db
      .select({
        id: tickets.id,
        status: tickets.status,
        resolvedAt: tickets.resolvedAt,
      })
      .from(tickets)
      .where(eq(tickets.id, ticketId));
    if (!ticket) return false;
    if (ticket.status !== TICKET_STATUS.RESOLVED) return false;
    if (!ticket.resolvedAt) return false;
    if (ticket.resolvedAt.getTime() + AUTO_CLOSE_DELAY_MS > Date.now()) return false;

    const claim = await db
      .update(tickets)
      .set({
        status: TICKET_STATUS.CLOSED,
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tickets.id, ticketId),
          eq(tickets.status, TICKET_STATUS.RESOLVED),
        ),
      )
      .returning({ id: tickets.id });
    if (claim.length === 0) return false;

    this.logger.log(`Auto-closed resolved ticket ${ticketId} (no reply for 48h)`);
    return true;
  }

  // ─── Cloud Tasks enqueue helpers: auto-close resolved ────

  async enqueueAutoCloseResolvedTask(input: {
    ticketId: string;
    resolvedAt: Date;
  }): Promise<void> {
    if (!this.tasks.isEnabled()) return;
    try {
      const fireAt = new Date(input.resolvedAt.getTime() + AUTO_CLOSE_DELAY_MS);
      await this.tasks.enqueue<TicketTaskPayload>({
        queue: TICKETS_QUEUE,
        handler: TICKET_HANDLERS.AUTO_CLOSE_RESOLVED,
        name: {
          entity: 'ticket',
          id: input.ticketId,
          event: 'auto-close-resolved',
          version: input.resolvedAt,
        },
        payload: { ticketId: input.ticketId },
        scheduleAt: fireAt.getTime() < Date.now() ? undefined : fireAt,
      });
    } catch (e) {
      this.logger.error(
        `Failed to enqueue auto-close-resolved task for ticket ${input.ticketId}: ${
          e instanceof Error ? e.message : 'unknown'
        }`,
      );
    }
  }

  async cancelAutoCloseResolvedTask(ticketId: string): Promise<void> {
    if (!this.tasks.isEnabled()) return;
    try {
      await this.tasks.cancelByEvent({
        queue: TICKETS_QUEUE,
        entity: 'ticket',
        id: ticketId,
        event: 'auto-close-resolved',
      });
    } catch (e) {
      this.logger.warn(
        `Failed to cancel auto-close-resolved task for ticket ${ticketId}: ${
          e instanceof Error ? e.message : 'unknown'
        }`,
      );
    }
  }

  async findStaleForAutoCloseResolved(lagMs: number): Promise<{ id: string }[]> {
    const cutoff = new Date(Date.now() - AUTO_CLOSE_DELAY_MS - lagMs);
    return db
      .select({ id: tickets.id })
      .from(tickets)
      .where(
        and(
          eq(tickets.status, TICKET_STATUS.RESOLVED),
          sql`${tickets.resolvedAt} IS NOT NULL AND ${tickets.resolvedAt} < ${cutoff}`,
        ),
      );
  }

  @Cron('0 3 * * *')
  async autoCloseResolvedSafetyNetSweep(): Promise<void> {
    if (isCronExternalized('support.auto-close-resolved.safety-net')) return;
    await this.csatSafetyNet.run<{ id: string }, TicketTaskPayload>({
      slug: 'support.auto-close-resolved',
      queue: TICKETS_QUEUE,
      handler: TICKET_HANDLERS.AUTO_CLOSE_RESOLVED,
      alertThreshold: 5,
      findStale: () => this.findStaleForAutoCloseResolved(2 * 60 * 60_000), // 2h lag
      taskParams: (row) => ({
        name: {
          entity: 'ticket',
          id: row.id,
          event: 'auto-close-resolved',
          version: Date.now(),
        },
        payload: { ticketId: row.id },
      }),
    });
  }

  /**
   * Auto-close on-hold "waiting for student response" tickets after 48h (OH-09)
   * Runs every hour
   */
  /**
   * Legacy hourly cron — RETAINED for parallel-run with Cloud Tasks.
   * Delegates to autoCloseWaitingOne per row. Retire in Phase 5.2.
   */
  @Cron('30 * * * *')
  async autoCloseWaitingForStudent() {
    if (isCronExternalized('support.auto-close-waiting')) return;
    await this.trackCronRun(CRON_NAMES.AUTO_CLOSE_WAITING_STUDENT, async () => {
    try {
      const cutoff = new Date(Date.now() - AUTO_CLOSE_DELAY_MS);
      const waitingTickets = await db
        .select({ id: tickets.id })
        .from(tickets)
        .where(
          and(
            eq(tickets.status, TICKET_STATUS.ON_HOLD),
            eq(
              tickets.onHoldReason,
              ON_HOLD_REASONS.WAITING_FOR_STUDENT_RESPONSE,
            ),
            sql`${tickets.onHoldAt} IS NOT NULL AND ${tickets.onHoldAt} < ${cutoff}`,
          ),
        );

      let closed = 0;
      for (const t of waitingTickets) {
        if (await this.autoCloseWaitingOne(t.id)) closed++;
      }
      if (closed > 0) {
        this.logger.log(`Auto-closed ${closed} waiting-for-student ticket(s)`);
      }
    } catch (err) {
      this.logger.error(`Waiting-for-student check failed: ${err}`);
    }
    });
  }

  // ─── Per-row event handler: auto-close waiting ─────────

  async autoCloseWaitingOne(ticketId: string): Promise<boolean> {
    const [ticket] = await db
      .select({
        id: tickets.id,
        status: tickets.status,
        onHoldAt: tickets.onHoldAt,
        onHoldReason: tickets.onHoldReason,
      })
      .from(tickets)
      .where(eq(tickets.id, ticketId));
    if (!ticket) return false;
    if (ticket.status !== TICKET_STATUS.ON_HOLD) return false;
    if (ticket.onHoldReason !== ON_HOLD_REASONS.WAITING_FOR_STUDENT_RESPONSE) {
      return false;
    }
    if (!ticket.onHoldAt) return false;
    if (ticket.onHoldAt.getTime() + AUTO_CLOSE_DELAY_MS > Date.now()) return false;

    const claim = await db
      .update(tickets)
      .set({
        status: TICKET_STATUS.CLOSED,
        closedAt: new Date(),
        onHoldAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tickets.id, ticketId),
          eq(tickets.status, TICKET_STATUS.ON_HOLD),
          eq(
            tickets.onHoldReason,
            ON_HOLD_REASONS.WAITING_FOR_STUDENT_RESPONSE,
          ),
        ),
      )
      .returning({ id: tickets.id });
    if (claim.length === 0) return false;

    this.logger.log(
      `Auto-closed on-hold ticket ${ticketId} (waiting for student > 48h)`,
    );
    return true;
  }

  // ─── Cloud Tasks enqueue helpers: auto-close waiting ────

  async enqueueAutoCloseWaitingTask(input: {
    ticketId: string;
    onHoldAt: Date;
  }): Promise<void> {
    if (!this.tasks.isEnabled()) return;
    try {
      const fireAt = new Date(input.onHoldAt.getTime() + AUTO_CLOSE_DELAY_MS);
      await this.tasks.enqueue<TicketTaskPayload>({
        queue: TICKETS_QUEUE,
        handler: TICKET_HANDLERS.AUTO_CLOSE_WAITING,
        name: {
          entity: 'ticket',
          id: input.ticketId,
          event: 'auto-close-waiting',
          version: input.onHoldAt,
        },
        payload: { ticketId: input.ticketId },
        scheduleAt: fireAt.getTime() < Date.now() ? undefined : fireAt,
      });
    } catch (e) {
      this.logger.error(
        `Failed to enqueue auto-close-waiting task for ticket ${input.ticketId}: ${
          e instanceof Error ? e.message : 'unknown'
        }`,
      );
    }
  }

  async cancelAutoCloseWaitingTask(ticketId: string): Promise<void> {
    if (!this.tasks.isEnabled()) return;
    try {
      await this.tasks.cancelByEvent({
        queue: TICKETS_QUEUE,
        entity: 'ticket',
        id: ticketId,
        event: 'auto-close-waiting',
      });
    } catch (e) {
      this.logger.warn(
        `Failed to cancel auto-close-waiting task for ticket ${ticketId}: ${
          e instanceof Error ? e.message : 'unknown'
        }`,
      );
    }
  }

  async findStaleForAutoCloseWaiting(lagMs: number): Promise<{ id: string }[]> {
    const cutoff = new Date(Date.now() - AUTO_CLOSE_DELAY_MS - lagMs);
    return db
      .select({ id: tickets.id })
      .from(tickets)
      .where(
        and(
          eq(tickets.status, TICKET_STATUS.ON_HOLD),
          eq(
            tickets.onHoldReason,
            ON_HOLD_REASONS.WAITING_FOR_STUDENT_RESPONSE,
          ),
          sql`${tickets.onHoldAt} IS NOT NULL AND ${tickets.onHoldAt} < ${cutoff}`,
        ),
      );
  }

  @Cron('0 4 * * *')
  async autoCloseWaitingSafetyNetSweep(): Promise<void> {
    if (isCronExternalized('support.auto-close-waiting.safety-net')) return;
    await this.csatSafetyNet.run<{ id: string }, TicketTaskPayload>({
      slug: 'support.auto-close-waiting',
      queue: TICKETS_QUEUE,
      handler: TICKET_HANDLERS.AUTO_CLOSE_WAITING,
      alertThreshold: 5,
      findStale: () => this.findStaleForAutoCloseWaiting(2 * 60 * 60_000),
      taskParams: (row) => ({
        name: {
          entity: 'ticket',
          id: row.id,
          event: 'auto-close-waiting',
          version: Date.now(),
        },
        payload: { ticketId: row.id },
      }),
    });
  }

  /**
   * CSAT Email Send — 15 min after ticket resolution
   * Runs every 5 minutes, finds unsent CSAT surveys
   */
  /**
   * Legacy every-5-minute cron — RETAINED for parallel-run with Cloud
   * Tasks. Delegates to sendCsatEmailOne per row so both this and the
   * event-driven path share CAS-safe code.
   *
   * Retire in Phase 5.2 after Cloud Tasks stability window.
   */
  @Cron('*/5 * * * *')
  async sendCsatEmails() {
    if (isCronExternalized('support.csat-emails')) return;
    await this.trackCronRun(CRON_NAMES.CSAT_EMAIL_SEND, async () => {
    try {
      const cutoff = new Date(Date.now() - CSAT_EMAIL_DELAY_MS);

      // leftJoin users so guest tickets (userId = GUEST_USER_ID sentinel)
      // don't get excluded. Also pull guestEmail/guestName from the ticket
      // row so we can route to the real guest address when the survey
      // userId points at the sentinel user. This mirrors the guest handling
      // in submitCsatScore() for the detractor follow-up path.
      const pendingSurveys = await db
        .select({ id: csatSurveys.id })
        .from(csatSurveys)
        .innerJoin(tickets, eq(csatSurveys.ticketId, tickets.id))
        .where(
          and(
            sql`${csatSurveys.score} IS NULL`,
            sql`${csatSurveys.submittedAt} IS NULL`,
            inArray(tickets.status, [
              TICKET_STATUS.RESOLVED,
              TICKET_STATUS.CLOSED,
            ]),
            sql`${tickets.resolvedAt} IS NOT NULL AND ${tickets.resolvedAt} < ${cutoff}`,
            sql`ABS(EXTRACT(EPOCH FROM (${csatSurveys.sentAt} - ${tickets.resolvedAt}))) < 120`,
          ),
        );

      let sent = 0;
      for (const s of pendingSurveys) {
        if (await this.sendCsatEmailOne(s.id)) sent++;
      }
      if (sent > 0) this.logger.log(`Sent ${sent} CSAT emails`);
    } catch (err) {
      this.logger.error(`CSAT email send failed: ${err}`);
    }
    });
  }

  // ─── Per-row event handler (Cloud Tasks entry point) ─────

  /**
   * Send one CSAT email. CAS on sentAt-near-resolvedAt marker.
   * Idempotent: retry sees the flipped sentAt and skips.
   */
  async sendCsatEmailOne(surveyId: string): Promise<boolean> {
    const [survey] = await db
      .select({
        surveyId: csatSurveys.id,
        ticketId: csatSurveys.ticketId,
        ticketReferenceNumber: tickets.referenceNumber,
        sentAt: csatSurveys.sentAt,
        userId: csatSurveys.userId,
        score: csatSurveys.score,
        submittedAt: csatSurveys.submittedAt,
        ticketStatus: tickets.status,
        ticketResolvedAt: tickets.resolvedAt,
        userEmail: users.email,
        userFirstName: users.firstName,
        guestEmail: tickets.guestEmail,
        guestName: tickets.guestName,
      })
      .from(csatSurveys)
      .innerJoin(tickets, eq(csatSurveys.ticketId, tickets.id))
      .leftJoin(users, eq(csatSurveys.userId, users.id))
      .where(eq(csatSurveys.id, surveyId));

    if (!survey) return false;
    if (survey.score !== null) return false;
    if (survey.submittedAt) return false;
    if (
      survey.ticketStatus !== TICKET_STATUS.RESOLVED &&
      survey.ticketStatus !== TICKET_STATUS.CLOSED
    ) {
      return false;
    }
    if (!survey.ticketResolvedAt) return false;

    // "Email not yet sent" marker: sentAt is within 2 sec of
    // ticketResolvedAt (they were inserted in the same transaction, so
    // the delta is DB clock jitter).
    const deltaMs = Math.abs(
      survey.sentAt.getTime() - survey.ticketResolvedAt.getTime(),
    );
    if (deltaMs >= 2000) return false;

    const recipientEmail = survey.guestEmail || survey.userEmail;
    const recipientName =
      survey.guestName || survey.userFirstName || 'Student';
    if (!recipientEmail) {
      this.logger.warn(
        `CSAT survey ${surveyId} skipped: no recipient email (ticket ${survey.ticketId})`,
      );
      return false;
    }

    // CAS-claim by advancing sentAt off the marker window. Loser sees
    // rowCount=0 and no-ops — at-most-once send under parallel-run.
    const claim = await db
      .update(csatSurveys)
      .set({ sentAt: new Date() })
      .where(
        and(
          eq(csatSurveys.id, surveyId),
          eq(csatSurveys.sentAt, survey.sentAt),
        ),
      )
      .returning({ id: csatSurveys.id });
    if (claim.length === 0) return false;

    try {
      await this.emailService.sendCsatSurvey(
        recipientEmail,
        recipientName,
        survey.ticketReferenceNumber,
        survey.surveyId,
      );
      this.logger.log(
        `CSAT email sent for ticket ${survey.ticketId} → ${recipientEmail}`,
      );
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to send CSAT email for survey ${surveyId}: ${err}`,
      );
      // Claim committed — don't rollback (would double-send on retry).
      return false;
    }
  }

  // ─── Cloud Tasks enqueue/cancel helpers ───────────────────

  async enqueueCsatEmailTask(input: {
    surveyId: string;
    resolvedAt: Date;
  }): Promise<void> {
    if (!this.tasks.isEnabled()) return;
    try {
      const fireAt = new Date(input.resolvedAt.getTime() + CSAT_EMAIL_DELAY_MS);
      await this.tasks.enqueue<CsatTaskPayload>({
        queue: TICKETS_QUEUE,
        handler: TICKET_HANDLERS.CSAT_SEND,
        name: {
          entity: 'csat',
          id: input.surveyId,
          event: 'send',
          version: input.resolvedAt,
        },
        payload: { surveyId: input.surveyId },
        scheduleAt: fireAt.getTime() < Date.now() ? undefined : fireAt,
      });
    } catch (e) {
      this.logger.error(
        `Failed to enqueue CSAT task for survey ${input.surveyId}: ${
          e instanceof Error ? e.message : 'unknown'
        }`,
      );
    }
  }

  async cancelCsatEmailTask(surveyId: string): Promise<void> {
    if (!this.tasks.isEnabled()) return;
    try {
      await this.tasks.cancelByEvent({
        queue: TICKETS_QUEUE,
        entity: 'csat',
        id: surveyId,
        event: 'send',
      });
    } catch (e) {
      this.logger.warn(
        `Failed to cancel CSAT task for survey ${surveyId}: ${
          e instanceof Error ? e.message : 'unknown'
        }`,
      );
    }
  }

  async findStaleForCsatEmail(lagMs: number): Promise<{ id: string }[]> {
    const cutoff = new Date(Date.now() - CSAT_EMAIL_DELAY_MS - lagMs);
    return db
      .select({ id: csatSurveys.id })
      .from(csatSurveys)
      .innerJoin(tickets, eq(csatSurveys.ticketId, tickets.id))
      .where(
        and(
          sql`${csatSurveys.score} IS NULL`,
          sql`${csatSurveys.submittedAt} IS NULL`,
          inArray(tickets.status, [
            TICKET_STATUS.RESOLVED,
            TICKET_STATUS.CLOSED,
          ]),
          sql`${tickets.resolvedAt} IS NOT NULL AND ${tickets.resolvedAt} < ${cutoff}`,
          sql`ABS(EXTRACT(EPOCH FROM (${csatSurveys.sentAt} - ${tickets.resolvedAt}))) < 120`,
        ),
      );
  }

  @Cron('0 * * * *')
  async csatEmailSafetyNetSweep(): Promise<void> {
    if (isCronExternalized('support.csat-emails.safety-net')) return;
    await this.csatSafetyNet.run<{ id: string }, CsatTaskPayload>({
      slug: 'support.csat-emails',
      queue: TICKETS_QUEUE,
      handler: TICKET_HANDLERS.CSAT_SEND,
      alertThreshold: 5,
      findStale: () => this.findStaleForCsatEmail(20 * 60_000),
      taskParams: (row) => ({
        name: {
          entity: 'csat',
          id: row.id,
          event: 'send',
          version: Date.now(),
        },
        payload: { surveyId: row.id },
      }),
    });
  }

  /**
   * Business-hours resume sweep — runs every minute.
   *
   * Tickets created during off-hours (and any other ticket that's
   * unassigned for whatever reason) get auto-routed to an agent as soon
   * as the support team is back online. We fire three notifications per
   * resumed ticket:
   *   - Learner: "We're back online — your ticket is now with {agent}"
   *   - Agent:   "New ticket assigned"
   *   - Supervisor: "Auto-assigned T-000X to {agent} on business resume"
   *
   * Multi-instance safety: the UPDATE ... WHERE assignee_id IS NULL
   * RETURNING pattern means only ONE Cloud Run instance wins each
   * ticket — concurrent ticks on other instances see the row already
   * has an assignee and skip. So notifications fire exactly once even
   * though the cron runs on every instance.
   */
  /**
   * Business-hours resume sweep.
   *
   * Previously ran every minute as a Cloud Run Job — 43,200 executions/mo
   * for a job that no-ops ~73% of the time (outside business hours) and
   * has trivial actual work when it does fire (assign N unassigned
   * tickets to available agents). Cost was ~$51/mo just for this cron.
   *
   * Post-migration:
   *   - Cadence dropped to every 5 min — SLA the client cares about is
   *     `support.sla-breach` on a separate schedule; assignment latency
   *     of up to 5 min at business-hours boundary is invisible to users.
   *   - Runs IN-PROCESS on api-web (warm container, ~zero marginal cost)
   *     via the @Cron decorator. Cloud Run Job path is retired in
   *     Phase 5.2 once we've observed stability.
   *   - Distributed lock guarantees only one api-web instance sweeps per
   *     tick — the old code relied on the Cloud Run Job being single-
   *     instance for that dedup, so moving in-process needs the lock.
   *
   * Note: `isCronExternalized` guard preserved during parallel-run — flip
   * the env var to swap paths without a redeploy.
   */
  @Cron('*/5 * * * *')
  async sweepBusinessResumeAssignments() {
    if (isCronExternalized('support.business-resume-sweep')) return;
    // 60s lock TTL comfortably exceeds observed max sweep runtime (~2s
    // with a dozen unassigned tickets). Another instance skipping is
    // the correct dedup behaviour — the winner does the work.
    await this.lock.withLock('lock:cron:business-resume-sweep', 60_000, () =>
      this.trackCronRun(CRON_NAMES.BUSINESS_RESUME_SWEEP, async () => {
    try {
      await refreshBusinessHoursConfigIfStale(() =>
        this.supportService.getBusinessHours(),
      );

      // Outside business hours? Nothing to do — queued tickets keep waiting.
      if (!isWithinBusinessHours(new Date())) return;

      // Candidate set: still-open, still-unassigned. Includes any ticket
      // that was created during the most recent offline window (the
      // common case) plus any that were unassigned for other reasons.
      const unassigned = await db
        .select({
          id: tickets.id,
          referenceNumber: tickets.referenceNumber,
          subject: tickets.subject,
          priority: tickets.priority,
          studentId: tickets.studentId,
          guestEmail: tickets.guestEmail,
          guestName: tickets.guestName,
        })
        .from(tickets)
        .where(
          and(
            inArray(tickets.status, [
              TICKET_STATUS.NEW,
              TICKET_STATUS.IN_PROGRESS,
            ]),
            sql`${tickets.assigneeId} IS NULL`,
          ),
        );

      if (!unassigned.length) return;

      const supervisorId = await this.supportService.findSupervisorId();

      for (const ticket of unassigned) {
        try {
          const assigneeId = await this.supportService.findNextAgent();
          if (!assigneeId) {
            // No agent available — leave unassigned, try again next tick.
            continue;
          }

          // Atomic claim: only update if still unassigned. If another
          // instance won the race, this UPDATE affects zero rows and we
          // skip notifications.
          const claimed = await db
            .update(tickets)
            .set({ assigneeId, updatedAt: new Date() })
            .where(
              and(
                eq(tickets.id, ticket.id),
                sql`${tickets.assigneeId} IS NULL`,
              ),
            )
            .returning({ id: tickets.id });

          if (claimed.length === 0) continue;

          const [agent] = await db
            .select({
              email: users.email,
              firstName: users.firstName,
              lastName: users.lastName,
            })
            .from(users)
            .where(eq(users.id, assigneeId));
          const agentName =
            [agent?.firstName, agent?.lastName].filter(Boolean).join(' ') ||
            'an agent';

          // Notify learner (skip guests for in-app, but email them)
          try {
            if (ticket.studentId) {
              await this.notificationsService.create({
                recipientId: ticket.studentId,
                type: 'ticket_assigned',
                title: 'Support team is back online',
                message: `We're back online — your ticket ${ticket.referenceNumber} is now with ${agentName}.`,
                link: `/dashboard/student/support`,
                entityType: 'ticket',
                entityId: ticket.id,
              });
            }
          } catch {
            /* non-blocking */
          }

          // Notify agent
          try {
            if (
              await this.supportService.shouldNotifySupport(
                assigneeId,
                'inApp',
              )
            ) {
              await this.notificationsService.create({
                recipientId: assigneeId,
                type: 'ticket_assigned',
                title: 'New Ticket Assigned',
                message: `${ticket.referenceNumber} — ${ticket.subject} (${(ticket.priority || '').toUpperCase()} priority)`,
                link: `/dashboard/support/agent/tickets/${ticket.id}`,
                entityType: 'ticket',
                entityId: ticket.id,
              });
            }
          } catch {
            /* non-blocking */
          }

          // Notify supervisor
          try {
            if (supervisorId && supervisorId !== assigneeId) {
              await this.notificationsService.create({
                recipientId: supervisorId,
                type: 'ticket_assigned',
                title: 'Ticket auto-assigned on business resume',
                message: `${ticket.referenceNumber} routed to ${agentName} after business hours resumed.`,
                link: `/dashboard/support/agent/tickets/${ticket.id}`,
                entityType: 'ticket',
                entityId: ticket.id,
              });
            }
          } catch {
            /* non-blocking */
          }

          // Mirror the in-app notifications to email (gated by prefs).
          try {
            if (
              await this.supportService.shouldNotifySupport(
                assigneeId,
                'email',
              )
            ) {
              if (agent?.email) {
                await this.emailService.sendTicketAssignedAgent(
                  agent.email,
                  agent.firstName || 'Agent',
                  ticket.referenceNumber,
                  ticket.subject,
                  ticket.priority,
                  'resumed business hours',
                );
              }
            }
          } catch {
            /* non-blocking */
          }

          this.logger.log(
            `Business resume: auto-assigned ${ticket.referenceNumber} → ${agentName}`,
          );
        } catch (err) {
          this.logger.error(
            `Business-resume sweep failed for ticket ${ticket.id}: ${err}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(`Business-resume sweep failed: ${err}`);
    }
    }),
    );
  }
}
