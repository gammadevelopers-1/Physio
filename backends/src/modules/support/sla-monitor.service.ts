import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { db } from '../../database';
import {
  tickets,
  slaPolicies,
  slaEvents,
  csatSurveys,
  users,
  TICKET_STATUS,
  TICKET_PRIORITY,
  SLA_EVENT_TYPES,
  ON_HOLD_REASONS,
} from '../../database/schema';
import {
  calculateBusinessMinutesElapsed,
  refreshBusinessHoursConfigIfStale,
} from './business-hours.util';
import { SupportService } from './support.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class SlaMonitorService {
  private readonly logger = new Logger(SlaMonitorService.name);

  constructor(
    private readonly supportService: SupportService,
    private readonly emailService: EmailService,
  ) {}

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
          priority: tickets.priority,
          status: tickets.status,
          assigneeId: tickets.assigneeId,
          firstResponseAt: tickets.firstResponseAt,
          slaBreachedFrt: tickets.slaBreachedFrt,
          slaBreachedTtr: tickets.slaBreachedTtr,
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

          // Calculate effective business minutes elapsed
          const totalBizMinutes = calculateBusinessMinutesElapsed(
            ticket.createdAt,
            now,
          );
          const effectiveBizMinutes =
            totalBizMinutes - (ticket.onHoldTotalMinutes || 0);

          // ─── FRT Check (only if no first response yet) ────────
          if (!ticket.firstResponseAt) {
            // FRT Breach (SLA-03)
            if (
              effectiveBizMinutes >= policy.frtMinutes &&
              !ticket.slaBreachedFrt
            ) {
              // Dedup check (SLA-10)
              const [existingBreach] = await db
                .select({ id: slaEvents.id })
                .from(slaEvents)
                .where(
                  and(
                    eq(slaEvents.ticketId, ticket.id),
                    eq(slaEvents.eventType, SLA_EVENT_TYPES.FRT_BREACH),
                  ),
                )
                .limit(1);

              if (!existingBreach) {
                // Set breach flag
                await db
                  .update(tickets)
                  .set({
                    slaBreachedFrt: true,
                    updatedAt: now,
                  })
                  .where(eq(tickets.id, ticket.id));

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
                        ticket.id,
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
                        ticket.id,
                        '',
                        'All agents missed FRT deadline',
                      );
                    }
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
              // Dedup check
              const [existingBreach] = await db
                .select({ id: slaEvents.id })
                .from(slaEvents)
                .where(
                  and(
                    eq(slaEvents.ticketId, ticket.id),
                    eq(slaEvents.eventType, SLA_EVENT_TYPES.TTR_BREACH),
                  ),
                )
                .limit(1);

              if (!existingBreach) {
                await db
                  .update(tickets)
                  .set({
                    slaBreachedTtr: true,
                    updatedAt: now,
                  })
                  .where(eq(tickets.id, ticket.id));

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
                        ticket.id,
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
                        ticket.id,
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
                        ticket.id,
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
                          ticket.id,
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
          priority: tickets.priority,
          assigneeId: tickets.assigneeId,
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
          const totalBizMinutes = calculateBusinessMinutesElapsed(
            ticket.createdAt,
            now,
          );
          const effectiveBizMinutes =
            totalBizMinutes - (ticket.onHoldTotalMinutes || 0);

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
                    ticket.id,
                    '',
                    `Priority auto-escalated from ${ticket.priority} to ${newPriority}`,
                  );
                }
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
  }

  /**
   * Auto-close resolved tickets after 48h with no student reply (RS-08)
   * Runs every 30 minutes
   */
  @Cron('*/30 * * * *')
  async autoCloseResolvedTickets() {
    try {
      const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
      const cutoff = new Date(Date.now() - FORTY_EIGHT_HOURS_MS);

      // Find resolved tickets older than 48h
      const resolvedTickets = await db
        .select({ id: tickets.id, resolvedAt: tickets.resolvedAt })
        .from(tickets)
        .where(
          and(
            eq(tickets.status, TICKET_STATUS.RESOLVED),
            sql`${tickets.resolvedAt} IS NOT NULL AND ${tickets.resolvedAt} < ${cutoff}`,
          ),
        );

      for (const ticket of resolvedTickets) {
        try {
          await db
            .update(tickets)
            .set({
              status: TICKET_STATUS.CLOSED,
              closedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(tickets.id, ticket.id));

          this.logger.log(
            `Auto-closed resolved ticket ${ticket.id} (no reply for 48h)`,
          );
        } catch (err) {
          this.logger.error(
            `Error auto-closing ticket ${ticket.id}: ${err}`,
          );
        }
      }

      if (resolvedTickets.length > 0) {
        this.logger.log(
          `Auto-closed ${resolvedTickets.length} resolved tickets`,
        );
      }
    } catch (err) {
      this.logger.error(`Auto-close check failed: ${err}`);
    }
  }

  /**
   * Auto-close on-hold "waiting for student response" tickets after 48h (OH-09)
   * Runs every hour
   */
  @Cron('30 * * * *')
  async autoCloseWaitingForStudent() {
    try {
      const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
      const cutoff = new Date(Date.now() - FORTY_EIGHT_HOURS_MS);

      // Find on-hold tickets with "waiting for student" reason older than 48h.
      // The DTO enforces the same literal via ON_HOLD_REASONS whitelist, so
      // the exact match here is now safe from supervisor typos.
      const waitingTickets = await db
        .select({
          id: tickets.id,
          onHoldAt: tickets.onHoldAt,
          onHoldReason: tickets.onHoldReason,
        })
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

      for (const ticket of waitingTickets) {
        try {
          await db
            .update(tickets)
            .set({
              status: TICKET_STATUS.CLOSED,
              closedAt: new Date(),
              onHoldAt: null,
              updatedAt: new Date(),
            })
            .where(eq(tickets.id, ticket.id));

          this.logger.log(
            `Auto-closed on-hold ticket ${ticket.id} (waiting for student > 48h)`,
          );
        } catch (err) {
          this.logger.error(
            `Error auto-closing waiting ticket ${ticket.id}: ${err}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(`Waiting-for-student check failed: ${err}`);
    }
  }

  /**
   * CSAT Email Send — 15 min after ticket resolution
   * Runs every 5 minutes, finds unsent CSAT surveys
   */
  @Cron('*/5 * * * *')
  async sendCsatEmails() {
    try {
      // Find CSAT surveys that need email sending:
      // - No score submitted yet
      // - Associated ticket was resolved > 15 min ago
      // - Ticket is still resolved or closed (not reopened)
      // - sentAt is very close to ticket resolvedAt (means email not yet sent)
      const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
      const cutoff = new Date(Date.now() - FIFTEEN_MINUTES_MS);

      // leftJoin users so guest tickets (userId = GUEST_USER_ID sentinel)
      // don't get excluded. Also pull guestEmail/guestName from the ticket
      // row so we can route to the real guest address when the survey
      // userId points at the sentinel user. This mirrors the guest handling
      // in submitCsatScore() for the detractor follow-up path.
      const pendingSurveys = await db
        .select({
          surveyId: csatSurveys.id,
          ticketId: csatSurveys.ticketId,
          sentAt: csatSurveys.sentAt,
          userId: csatSurveys.userId,
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
        .where(
          and(
            sql`${csatSurveys.score} IS NULL`,
            sql`${csatSurveys.submittedAt} IS NULL`,
            inArray(tickets.status, [
              TICKET_STATUS.RESOLVED,
              TICKET_STATUS.CLOSED,
            ]),
            sql`${tickets.resolvedAt} IS NOT NULL AND ${tickets.resolvedAt} < ${cutoff}`,
            // sentAt within 2 min of resolvedAt means email not yet sent
            sql`ABS(EXTRACT(EPOCH FROM (${csatSurveys.sentAt} - ${tickets.resolvedAt}))) < 120`,
          ),
        );

      for (const survey of pendingSurveys) {
        try {
          // Prefer the guest email/name when the ticket is a guest ticket
          // (identified by a non-null guestEmail on the ticket row). Fall
          // back to the learner's user row otherwise.
          const recipientEmail = survey.guestEmail || survey.userEmail;
          const recipientName =
            survey.guestName || survey.userFirstName || 'Student';

          if (!recipientEmail) {
            this.logger.warn(
              `CSAT survey ${survey.surveyId} skipped: no recipient email (ticket ${survey.ticketId})`,
            );
            continue;
          }

          await this.emailService.sendCsatSurvey(
            recipientEmail,
            recipientName,
            survey.ticketId,
            survey.surveyId,
          );

          // Update sentAt to now (marks as email-sent, resets 72h timer)
          await db
            .update(csatSurveys)
            .set({ sentAt: new Date() })
            .where(eq(csatSurveys.id, survey.surveyId));

          this.logger.log(`CSAT email sent for ticket ${survey.ticketId} → ${recipientEmail}`);
        } catch (err) {
          this.logger.error(
            `Failed to send CSAT email for survey ${survey.surveyId}: ${err}`,
          );
        }
      }

      if (pendingSurveys.length > 0) {
        this.logger.log(`Sent ${pendingSurveys.length} CSAT emails`);
      }
    } catch (err) {
      this.logger.error(`CSAT email send failed: ${err}`);
    }
  }
}
