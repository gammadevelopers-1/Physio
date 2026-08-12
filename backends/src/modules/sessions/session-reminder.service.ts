import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { isCronExternalized } from '../../common/is-cron-externalized.helper';
import { eq, and, or, isNull, gte, lte, sql, isNotNull } from 'drizzle-orm';
import { db } from '../../database';
import {
  sessions,
  courses,
  users,
  enrollments,
  SESSION_STATUS,
  SESSION_TYPE,
} from '../../database/schema';
import { EmailService } from '../email/email.service';
import { ZOOM_SERVICE, IZoomService } from '../zoom/zoom.interface';
import { NelcAuditService } from '../nelc-audit/nelc-audit.service';
import { NELC_EVENT_TYPE } from '../../database/schema';
import { AuditLogService } from '../audit-logs/audit-logs.service';
import { SessionNotificationService } from './session-notification.service';
import { AdminSettingsService } from '../admin-settings/admin-settings.service';
import { TasksService } from '../tasks/tasks.service';
import { DistributedLockService } from '../tasks/distributed-lock.service';
import { SafetyNetSweep } from '../tasks/safety-net-sweep';

// Cloud Tasks constants for this module — kept adjacent so name-scheme
// and handler wiring don't drift.
export const SESSIONS_QUEUE = 'session-events';
export const SESSION_HANDLERS = {
  REMIND: 'session.remind',
  END: 'session.end',
  WARN_90: 'session.warn-90',
  MARK_MISSED: 'session.mark-missed',
} as const;

export interface SessionTaskPayload {
  sessionId: string;
}

// Reminder fires at scheduled_at - REMINDER_LEAD_MS
export const REMINDER_LEAD_MS = 5 * 60_000;
// Mark-missed fires at scheduled_at + MARK_MISSED_GRACE_MS
export const MARK_MISSED_GRACE_MS = 15 * 60_000;

@Injectable()
export class SessionReminderService {
  private readonly logger = new Logger(SessionReminderService.name);

  private readonly safetyNet: SafetyNetSweep;

  constructor(
    private readonly emailService: EmailService,
    @Inject(ZOOM_SERVICE) private readonly zoomService: IZoomService,
    private readonly auditService: NelcAuditService,
    private readonly auditLogService: AuditLogService,
    private readonly sessionNotificationService: SessionNotificationService,
    private readonly adminSettings: AdminSettingsService,
    private readonly tasks: TasksService,
    private readonly lock: DistributedLockService,
  ) {
    this.safetyNet = new SafetyNetSweep(this.tasks, this.lock);
  }

  /**
   * Legacy per-minute cron — RETAINED for parallel-run.
   *
   * Post-migration, sessions.service.ts enqueues a Cloud Task at
   * scheduledAt-5m for each session. This cron is now a defence-in-depth
   * scan: if the task pipeline is misconfigured, the sweep still finds
   * sessions in the reminder window and dispatches. Uses remindOne()
   * per-row so the CAS on reminderSentAt guarantees at-most-once
   * delivery across both paths.
   *
   * Retire in Phase 5.2 once Cloud Tasks has been stable for 30 days.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async checkUpcomingSessionsAndNotify() {
    if (isCronExternalized('sessions.reminder-notify')) return;
    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() + 4 * 60 * 1000);
      const windowEnd = new Date(now.getTime() + 6 * 60 * 1000);

      const upcomingSessions = await db
        .select({ id: sessions.id })
        .from(sessions)
        .innerJoin(courses, eq(sessions.courseId, courses.id))
        .where(
          and(
            eq(sessions.status, SESSION_STATUS.SCHEDULED),
            isNull(sessions.reminderSentAt),
            gte(sessions.scheduledAt, windowStart),
            lte(sessions.scheduledAt, windowEnd),
            or(
              eq(sessions.type, SESSION_TYPE.ZOOM),
              eq(sessions.type, SESSION_TYPE.HYBRID),
            ),
            isNull(courses.deletedAt),
          ),
        );

      if (upcomingSessions.length === 0) return;
      this.logger.log(
        `Legacy sweep found ${upcomingSessions.length} session(s) needing reminders`,
      );
      for (const s of upcomingSessions) {
        await this.remindOne(s.id);
      }
    } catch (error) {
      this.logger.error('Session reminder cron failed', error);
    }
  }

  // ─── Per-row event handler (Cloud Tasks entry point) ─────────────
  //
  // Called by:
  //   - Cloud Task at scheduledAt - 5m (primary event-driven path)
  //   - Legacy per-minute @Cron sweep (parallel-run defence)
  //   - Hourly safety-net sweep (finds sessions the task pipeline missed)
  //
  // Returns true if this call sent reminders, false if the CAS UPDATE
  // affected zero rows (someone else already handled it, or the session
  // has moved on / been cancelled).

  async remindOne(sessionId: string): Promise<boolean> {
    const [session] = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        type: sessions.type,
        scheduledAt: sessions.scheduledAt,
        durationMinutes: sessions.durationMinutes,
        zoomLink: sessions.zoomLink,
        courseId: sessions.courseId,
        instructorId: sessions.instructorId,
        courseName: courses.title,
        courseDeletedAt: courses.deletedAt,
        status: sessions.status,
        reminderSentAt: sessions.reminderSentAt,
      })
      .from(sessions)
      .innerJoin(courses, eq(sessions.courseId, courses.id))
      .where(eq(sessions.id, sessionId));

    if (!session) return false;
    if (session.courseDeletedAt) return false;
    if (session.status !== SESSION_STATUS.SCHEDULED) return false;
    if (session.reminderSentAt) return false;
    if (
      session.type !== SESSION_TYPE.ZOOM &&
      session.type !== SESSION_TYPE.HYBRID
    ) {
      return false;
    }

    // CAS claim: only proceed with side-effects if this caller flipped
    // reminderSentAt from NULL to now. Concurrent legacy @Cron + Cloud
    // Task delivery both race here — loser sees rowCount=0 and no-ops.
    // This closes the double-send race latent in the pre-migration code
    // (which only had the null check in the SELECT, not the UPDATE).
    const claim = await db
      .update(sessions)
      .set({ reminderSentAt: new Date() })
      .where(
        and(
          eq(sessions.id, sessionId),
          isNull(sessions.reminderSentAt),
          eq(sessions.status, SESSION_STATUS.SCHEDULED),
        ),
      )
      .returning({ id: sessions.id });
    if (claim.length === 0) return false;

    try {
      await this.sendRemindersForSession({
        id: session.id,
        title: session.title,
        type: session.type,
        scheduledAt: session.scheduledAt,
        durationMinutes: session.durationMinutes,
        zoomLink: session.zoomLink,
        courseId: session.courseId,
        instructorId: session.instructorId,
        courseName: session.courseName,
      });
      return true;
    } catch (e) {
      // Claim committed — do NOT reset reminderSentAt (would double-send
      // on retry to users who already received the email).
      this.logger.error(
        `Reminder for session ${sessionId} failed after CAS claim: ${
          e instanceof Error ? e.message : 'unknown'
        }`,
      );
      return false;
    }
  }

  // ─── Cloud Tasks enqueue/cancel helpers ────────────────────

  /**
   * Called from SessionsService.create() and .update() (when scheduledAt
   * changes). Schedules a Cloud Task to fire at scheduledAt - 5m.
   * Skipped for non-Zoom/non-Hybrid sessions (only they get reminders).
   * Best-effort — errors log but do not fail the write path.
   */
  async enqueueReminderTask(
    session: { id: string; scheduledAt: Date; type: string },
    opts: { replaceExisting?: boolean } = {},
  ): Promise<void> {
    if (!this.tasks.isEnabled()) return;
    if (session.type !== SESSION_TYPE.ZOOM && session.type !== SESSION_TYPE.HYBRID) {
      return;
    }
    try {
      if (opts.replaceExisting) {
        await this.tasks.cancelByEvent({
          queue: SESSIONS_QUEUE,
          entity: 'session',
          id: session.id,
          event: 'remind',
        });
      }
      const fireAt = new Date(session.scheduledAt.getTime() - REMINDER_LEAD_MS);
      await this.tasks.enqueue<SessionTaskPayload>({
        queue: SESSIONS_QUEUE,
        handler: SESSION_HANDLERS.REMIND,
        name: {
          entity: 'session',
          id: session.id,
          event: 'remind',
          version: session.scheduledAt,
        },
        payload: { sessionId: session.id },
        scheduleAt: fireAt.getTime() < Date.now() ? undefined : fireAt,
      });
    } catch (e) {
      this.logger.error(
        `Failed to enqueue reminder task for session ${session.id}: ${
          e instanceof Error ? e.message : 'unknown'
        }`,
      );
    }
  }

  async cancelReminderTask(sessionId: string): Promise<void> {
    if (!this.tasks.isEnabled()) return;
    try {
      await this.tasks.cancelByEvent({
        queue: SESSIONS_QUEUE,
        entity: 'session',
        id: sessionId,
        event: 'remind',
      });
    } catch (e) {
      this.logger.warn(
        `Failed to cancel reminder task for session ${sessionId}: ${
          e instanceof Error ? e.message : 'unknown'
        }`,
      );
    }
  }

  // ─── Safety-net sweep ──────────────────────────────────────
  //
  // Hourly scan for reminders the event-driven pipeline missed. Alerts
  // if it finds > 5 stale rows (that's a signal something's regressed).

  async findStaleForReminder(lagMs: number): Promise<{ id: string }[]> {
    const now = Date.now();
    // "Stale" = scheduledAt is in the past (window has fully closed)
    // AND reminderSentAt is still null. lagMs cushions against normal
    // Cloud Tasks retry backoff.
    const cutoff = new Date(now - lagMs);
    return db
      .select({ id: sessions.id })
      .from(sessions)
      .innerJoin(courses, eq(sessions.courseId, courses.id))
      .where(
        and(
          eq(sessions.status, SESSION_STATUS.SCHEDULED),
          isNull(sessions.reminderSentAt),
          lte(sessions.scheduledAt, cutoff),
          gte(sessions.scheduledAt, new Date(now - 24 * 60 * 60_000)),
          or(
            eq(sessions.type, SESSION_TYPE.ZOOM),
            eq(sessions.type, SESSION_TYPE.HYBRID),
          ),
          isNull(courses.deletedAt),
        ),
      );
  }

  @Cron(CronExpression.EVERY_HOUR)
  async reminderSafetyNetSweep(): Promise<void> {
    if (isCronExternalized('sessions.reminder-notify.safety-net')) return;
    await this.safetyNet.run<{ id: string }, SessionTaskPayload>({
      slug: 'sessions.reminder-notify',
      queue: SESSIONS_QUEUE,
      handler: SESSION_HANDLERS.REMIND,
      alertThreshold: 5,
      // Fire only if reminder is >20 min overdue (queue min-backoff is
      // 30s; several retry rounds should already have completed).
      findStale: () => this.findStaleForReminder(20 * 60_000),
      taskParams: (row) => ({
        name: {
          entity: 'session',
          id: row.id,
          event: 'remind',
          version: Date.now(),
        },
        payload: { sessionId: row.id },
      }),
    });
  }

  private async sendRemindersForSession(session: {
    id: string;
    title: string;
    type: string;
    scheduledAt: Date;
    durationMinutes: number;
    zoomLink: string | null;
    courseId: string;
    instructorId: string;
    courseName: string;
  }) {
    const scheduledAt = session.scheduledAt.toISOString();
    const localeSettings = await this.adminSettings.getPublicLocaleSettings().catch(() => ({
      numberSystem: 'western' as const,
      dateFormat: 'DD-MM-YYYY' as const,
    }));

    // 1. Get instructor details
    const [instructor] = await db
      .select({
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        language: users.language,
      })
      .from(users)
      .where(eq(users.id, session.instructorId))
      .limit(1);

    if (instructor) {
      const instructorName =
        `${instructor.firstName || ''} ${instructor.lastName || ''}`.trim() ||
        instructor.email;

      const locale = (instructor.language || 'en') as 'en' | 'ar';
      await this.emailService.sendSessionReminder(instructor.email, {
        recipientName: instructorName,
        sessionTitle: session.title,
        courseName: session.courseName,
        scheduledAt,
        durationMinutes: session.durationMinutes,
        zoomLink: session.zoomLink,
        isInstructor: true,
        numberSystem: localeSettings.numberSystem,
      }, locale);
    }

    // 2. Get all actively enrolled students for this course
    const enrolledStudents = await db
      .select({
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        language: users.language,
      })
      .from(enrollments)
      .innerJoin(users, eq(enrollments.studentId, users.id))
      .where(
        and(
          eq(enrollments.courseId, session.courseId),
          eq(enrollments.status, 'active'),
        ),
      );

    this.logger.log(
      `Sending reminders for "${session.title}": 1 instructor + ${enrolledStudents.length} student(s)`,
    );

    // 3. Send to each student
    for (const student of enrolledStudents) {
      const studentName =
        `${student.firstName || ''} ${student.lastName || ''}`.trim() ||
        student.email;

      const studentLocale = (student.language || 'en') as 'en' | 'ar';
      await this.emailService.sendSessionReminder(student.email, {
        recipientName: studentName,
        sessionTitle: session.title,
        courseName: session.courseName,
        scheduledAt,
        durationMinutes: session.durationMinutes,
        zoomLink: session.zoomLink,
        isInstructor: false,
        numberSystem: localeSettings.numberSystem,
      }, studentLocale);
    }
  }

  /**
   * Legacy every-5-minute cron — RETAINED for parallel-run with Cloud
   * Tasks. Delegates to markMissedOne per row so both this and the
   * event-driven path hit the same CAS-safe transition.
   *
   * Retire in Phase 5.2 once the primary task pipeline has been stable.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async autoMarkMissedSessions() {
    if (isCronExternalized('sessions.mark-missed')) return;
    const cutoff = new Date(Date.now() - MARK_MISSED_GRACE_MS);

    const candidates = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.status, SESSION_STATUS.SCHEDULED),
          lte(sessions.scheduledAt, cutoff),
        ),
      );

    if (candidates.length === 0) return;
    let flipped = 0;
    for (const s of candidates) {
      if (await this.markMissedOne(s.id)) flipped++;
    }
    if (flipped > 0) {
      this.logger.log(`Auto-marked ${flipped} session(s) as missed`);
    }
  }

  // ─── Per-row event handler (Cloud Tasks entry point) ─────

  /**
   * Flip SCHEDULED → MISSED if the session is still scheduled and its
   * scheduledAt + 15min grace has passed. CAS-safe: only the first
   * caller (Cloud Task OR legacy @Cron) wins the update; concurrent
   * callers see rowCount=0 and no-op.
   *
   * Soft-miss semantics preserved: Zoom resource stays alive so the
   * manager can reschedule without losing registrants; UI hides the
   * host/registration entry points based on status.
   */
  async markMissedOne(sessionId: string): Promise<boolean> {
    const [session] = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        status: sessions.status,
        scheduledAt: sessions.scheduledAt,
      })
      .from(sessions)
      .where(eq(sessions.id, sessionId));
    if (!session) return false;
    if (session.status !== SESSION_STATUS.SCHEDULED) return false;

    // Guard against a task firing too early. Rare — task scheduleAt is
    // set to scheduledAt+15min — but wall-clock skew could bring it in
    // by a few seconds.
    const graceCutoff = new Date(
      session.scheduledAt.getTime() + MARK_MISSED_GRACE_MS,
    );
    if (Date.now() < graceCutoff.getTime()) return false;

    const claim = await db
      .update(sessions)
      .set({ status: 'missed' as any, updatedAt: new Date() })
      .where(
        and(
          eq(sessions.id, sessionId),
          eq(sessions.status, SESSION_STATUS.SCHEDULED),
        ),
      )
      .returning({ id: sessions.id });
    if (claim.length === 0) return false;

    this.logger.warn(
      `Session "${session.title}" (${session.id}) auto-marked as missed`,
    );
    return true;
  }

  // ─── Cloud Tasks enqueue/cancel helpers for mark-missed ────

  async enqueueMarkMissedTask(session: {
    id: string;
    scheduledAt: Date;
  }): Promise<void> {
    if (!this.tasks.isEnabled()) return;
    try {
      const fireAt = new Date(
        session.scheduledAt.getTime() + MARK_MISSED_GRACE_MS,
      );
      await this.tasks.enqueue<SessionTaskPayload>({
        queue: SESSIONS_QUEUE,
        handler: SESSION_HANDLERS.MARK_MISSED,
        name: {
          entity: 'session',
          id: session.id,
          event: 'mark-missed',
          version: session.scheduledAt,
        },
        payload: { sessionId: session.id },
        scheduleAt: fireAt.getTime() < Date.now() ? undefined : fireAt,
      });
    } catch (e) {
      this.logger.error(
        `Failed to enqueue mark-missed task for session ${session.id}: ${
          e instanceof Error ? e.message : 'unknown'
        }`,
      );
    }
  }

  async cancelMarkMissedTask(sessionId: string): Promise<void> {
    if (!this.tasks.isEnabled()) return;
    try {
      await this.tasks.cancelByEvent({
        queue: SESSIONS_QUEUE,
        entity: 'session',
        id: sessionId,
        event: 'mark-missed',
      });
    } catch (e) {
      this.logger.warn(
        `Failed to cancel mark-missed task for session ${sessionId}: ${
          e instanceof Error ? e.message : 'unknown'
        }`,
      );
    }
  }

  async findStaleForMarkMissed(lagMs: number): Promise<{ id: string }[]> {
    const cutoff = new Date(Date.now() - MARK_MISSED_GRACE_MS - lagMs);
    return db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.status, SESSION_STATUS.SCHEDULED),
          lte(sessions.scheduledAt, cutoff),
        ),
      );
  }

  @Cron(CronExpression.EVERY_HOUR)
  async markMissedSafetyNetSweep(): Promise<void> {
    if (isCronExternalized('sessions.mark-missed.safety-net')) return;
    await this.safetyNet.run<{ id: string }, SessionTaskPayload>({
      slug: 'sessions.mark-missed',
      queue: SESSIONS_QUEUE,
      handler: SESSION_HANDLERS.MARK_MISSED,
      alertThreshold: 5,
      findStale: () => this.findStaleForMarkMissed(20 * 60_000),
      taskParams: (row) => ({
        name: {
          entity: 'session',
          id: row.id,
          event: 'mark-missed',
          version: Date.now(),
        },
        payload: { sessionId: row.id },
      }),
    });
  }

  /**
   * Legacy per-minute cron — RETAINED for parallel-run.
   *
   * Now delegates to warn90One / endOne per row so both this and the
   * Cloud Task delivery paths hit the same CAS-safe code. Retire in
   * Phase 5.2 once Cloud Tasks has been stable for 30 days.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async autoEndExpiredSessions() {
    if (isCronExternalized('sessions.end-expired')) return;
    try {
      const now = new Date();

      // Candidates for 90% warning
      const warningSessions = await db
        .select({ id: sessions.id })
        .from(sessions)
        .where(
          and(
            eq(sessions.status, SESSION_STATUS.LIVE),
            isNotNull(sessions.actualStartedAt),
            isNull(sessions.autoEndWarningSentAt),
            sql`${now} >= ${sessions.actualStartedAt} + (${sessions.durationMinutes} * 0.9 || ' minutes')::interval`,
            sql`${now} < ${sessions.actualStartedAt} + (${sessions.durationMinutes} || ' minutes')::interval`,
          ),
        );
      for (const s of warningSessions) {
        await this.warn90One(s.id);
      }

      // Candidates for end
      const expiredSessions = await db
        .select({ id: sessions.id })
        .from(sessions)
        .where(
          and(
            eq(sessions.status, SESSION_STATUS.LIVE),
            isNotNull(sessions.actualStartedAt),
            sql`${sessions.actualStartedAt} + (${sessions.durationMinutes} || ' minutes')::interval <= ${now}`,
          ),
        );
      for (const s of expiredSessions) {
        await this.endOne(s.id);
      }
    } catch (error) {
      this.logger.error('Auto-end expired sessions cron failed', error);
    }
  }

  // ─── Per-row event handlers (Cloud Tasks entry points) ─────────────

  /**
   * Send the "10% remaining" warning email to the instructor. CAS on
   * autoEndWarningSentAt guarantees at-most-once delivery even under
   * parallel cron + Cloud Task fire.
   */
  async warn90One(sessionId: string): Promise<boolean> {
    const [session] = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        courseId: sessions.courseId,
        instructorId: sessions.instructorId,
        actualStartedAt: sessions.actualStartedAt,
        durationMinutes: sessions.durationMinutes,
        autoEndWarningSentAt: sessions.autoEndWarningSentAt,
        status: sessions.status,
        courseName: courses.title,
      })
      .from(sessions)
      .innerJoin(courses, eq(sessions.courseId, courses.id))
      .where(eq(sessions.id, sessionId));

    if (!session) return false;
    if (session.status !== SESSION_STATUS.LIVE) return false;
    if (!session.actualStartedAt) return false;
    if (session.autoEndWarningSentAt) return false;

    // Only fire when at least 90% of duration has elapsed AND we're
    // still inside the window. Guards against a task firing early (rare)
    // or late (equally rare — the endOne path will handle it).
    const now = Date.now();
    const startedMs = new Date(session.actualStartedAt).getTime();
    const durationMs = session.durationMinutes * 60_000;
    if (now < startedMs + durationMs * 0.9) return false;
    if (now >= startedMs + durationMs) return false;

    // CAS claim: only proceed with side-effects if we flipped
    // autoEndWarningSentAt from NULL to now.
    const claim = await db
      .update(sessions)
      .set({ autoEndWarningSentAt: new Date() })
      .where(
        and(
          eq(sessions.id, sessionId),
          isNull(sessions.autoEndWarningSentAt),
          eq(sessions.status, SESSION_STATUS.LIVE),
        ),
      )
      .returning({ id: sessions.id });
    if (claim.length === 0) return false;

    try {
      const [instructor] = await db
        .select({
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          language: users.language,
        })
        .from(users)
        .where(eq(users.id, session.instructorId))
        .limit(1);
      if (instructor) {
        const name =
          `${instructor.firstName || ''} ${instructor.lastName || ''}`.trim() ||
          instructor.email;
        const instrLocale = (instructor.language || 'en') as 'en' | 'ar';
        await this.emailService.sendGenericNotification(
          instructor.email,
          {
            recipientName: name,
            subject: `Lecture Ending Soon: ${session.title}`,
            message: `Your lecture "${session.title}" (${session.courseName}) will auto-end in approximately ${Math.ceil(session.durationMinutes * 0.1)} minute(s).\n\nIf you need more time, please create a new session after this one ends.`,
          },
          instrLocale,
        );
      }
      this.logger.log(
        `Auto-end warning sent for session "${session.title}" (${session.id})`,
      );
      return true;
    } catch (e) {
      this.logger.warn(
        `Failed to send auto-end warning email for session ${sessionId}: ${
          e instanceof Error ? e.message : 'unknown'
        }`,
      );
      // Claim committed; do NOT reset autoEndWarningSentAt to avoid
      // double-send on retry.
      return false;
    }
  }

  /**
   * Auto-end a live session past its planned duration. CAS on status
   * transition guarantees at-most-once end even under parallel cron +
   * Cloud Task fire.
   *
   * NELC audit uses the planned end time (actualStartedAt + duration),
   * NOT wall-clock now(), so a late fire doesn't inflate reported
   * session duration.
   */
  async endOne(sessionId: string): Promise<boolean> {
    const [session] = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        courseId: sessions.courseId,
        instructorId: sessions.instructorId,
        type: sessions.type,
        meetingId: sessions.meetingId,
        zoomLink: sessions.zoomLink,
        actualStartedAt: sessions.actualStartedAt,
        durationMinutes: sessions.durationMinutes,
        status: sessions.status,
      })
      .from(sessions)
      .where(eq(sessions.id, sessionId));

    if (!session) return false;
    if (session.status !== SESSION_STATUS.LIVE) return false;
    if (!session.actualStartedAt) return false;

    const startedMs = new Date(session.actualStartedAt).getTime();
    const plannedEnd = new Date(startedMs + session.durationMinutes * 60_000);
    if (plannedEnd.getTime() > Date.now()) return false;

    // End Zoom before flipping status: if Zoom fails but we've already
    // flipped, a retry would find status != LIVE and skip Zoom cleanup.
    // Doing Zoom first + swallowing errors + CAS flip after keeps this
    // safe: if Zoom errors we still end our record (Zoom's own idle
    // timeout will reap the meeting).
    try {
      if (
        session.meetingId &&
        (session.type === SESSION_TYPE.ZOOM ||
          session.type === SESSION_TYPE.HYBRID)
      ) {
        const result = await this.zoomService.endMeeting(session.meetingId);
        if (!result.ended) {
          this.logger.warn(
            `Zoom meeting ${session.meetingId} could not be ended: ${result.error}`,
          );
        }
      } else if (
        !session.meetingId &&
        session.zoomLink &&
        (session.type === SESSION_TYPE.ZOOM ||
          session.type === SESSION_TYPE.HYBRID)
      ) {
        const extracted = session.zoomLink.match(/\/j\/(\d+)/)?.[1];
        if (extracted) await this.zoomService.endMeeting(extracted);
      }
    } catch (err) {
      this.logger.warn(
        `Zoom end failed for session ${session.id}: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
    }

    const [updated] = await db
      .update(sessions)
      .set({
        status: SESSION_STATUS.ENDED,
        actualEndedAt: plannedEnd,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(sessions.id, sessionId),
          eq(sessions.status, SESSION_STATUS.LIVE),
        ),
      )
      .returning();
    if (!updated) return false;

    // Cancel any still-pending warn-90 task for this session. Normally
    // warn-90 fires at 90% of duration BEFORE end (100%), so it's
    // usually already delivered by the time we get here. But under
    // clock skew or Cloud Tasks retry backoff, end could fire first —
    // in that case, remove warn-90 from the queue so it doesn't fire
    // against an already-ended session.
    await this.cancelEndTasks(sessionId).catch(() => {});

    await this.auditService
      .log({
        eventType: NELC_EVENT_TYPE.SESSION_ENDED,
        entityType: 'session',
        entityId: updated.id,
        userId: session.instructorId,
        metadata: {
          sessionId: updated.id,
          courseId: updated.courseId,
          actualStartedAt: session.actualStartedAt,
          actualEndedAt: updated.actualEndedAt,
          autoEnded: true,
        },
      })
      .catch(() => {});

    await this.auditLogService
      .log({
        entityType: 'session',
        entityId: updated.id,
        action: 'session.auto_ended',
        performedBy: session.instructorId,
        metadata: {
          courseId: updated.courseId,
          durationMinutes: session.durationMinutes,
        },
        ipAddress: 'system',
      })
      .catch(() => {});

    this.sessionNotificationService
      .notifySessionEvent(updated, 'session_ended')
      .catch(() => {});

    this.logger.log(
      `Auto-ended session "${session.title}" (${session.id}) — exceeded ${session.durationMinutes} min duration`,
    );
    return true;
  }

  // ─── Cloud Tasks enqueue helpers for session.end lifecycle ────

  /**
   * Called when a session actually starts (actualStartedAt is set).
   * Schedules two tasks:
   *   session.warn-90 at startedAt + 0.9 × duration
   *   session.end    at startedAt + duration
   * Uses actualStartedAt.getTime() as version so if the session is
   * restarted, task names change naturally.
   */
  async enqueueEndTasks(session: {
    id: string;
    actualStartedAt: Date;
    durationMinutes: number;
  }): Promise<void> {
    if (!this.tasks.isEnabled()) return;
    const startedMs = session.actualStartedAt.getTime();
    const durationMs = session.durationMinutes * 60_000;
    const warnAt = new Date(startedMs + durationMs * 0.9);
    const endAt = new Date(startedMs + durationMs);

    try {
      await this.tasks.enqueue<SessionTaskPayload>({
        queue: SESSIONS_QUEUE,
        handler: SESSION_HANDLERS.WARN_90,
        name: {
          entity: 'session',
          id: session.id,
          event: 'warn-90',
          version: session.actualStartedAt,
        },
        payload: { sessionId: session.id },
        scheduleAt: warnAt.getTime() < Date.now() ? undefined : warnAt,
      });
      await this.tasks.enqueue<SessionTaskPayload>({
        queue: SESSIONS_QUEUE,
        handler: SESSION_HANDLERS.END,
        name: {
          entity: 'session',
          id: session.id,
          event: 'end',
          version: session.actualStartedAt,
        },
        payload: { sessionId: session.id },
        scheduleAt: endAt.getTime() < Date.now() ? undefined : endAt,
      });
    } catch (e) {
      this.logger.error(
        `Failed to enqueue end/warn tasks for session ${session.id}: ${
          e instanceof Error ? e.message : 'unknown'
        }`,
      );
    }
  }

  async cancelEndTasks(sessionId: string): Promise<void> {
    if (!this.tasks.isEnabled()) return;
    try {
      await Promise.all([
        this.tasks.cancelByEvent({
          queue: SESSIONS_QUEUE,
          entity: 'session',
          id: sessionId,
          event: 'warn-90',
        }),
        this.tasks.cancelByEvent({
          queue: SESSIONS_QUEUE,
          entity: 'session',
          id: sessionId,
          event: 'end',
        }),
      ]);
    } catch (e) {
      this.logger.warn(
        `Failed to cancel end tasks for session ${sessionId}: ${
          e instanceof Error ? e.message : 'unknown'
        }`,
      );
    }
  }

  // ─── Safety-net sweep for end-expired ─────────────────────

  async findStaleForEnd(lagMs: number): Promise<{ id: string }[]> {
    const cutoff = new Date(Date.now() - lagMs);
    return db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.status, SESSION_STATUS.LIVE),
          isNotNull(sessions.actualStartedAt),
          sql`${sessions.actualStartedAt} + (${sessions.durationMinutes} || ' minutes')::interval <= ${cutoff}`,
        ),
      );
  }

  @Cron(CronExpression.EVERY_HOUR)
  async endExpiredSafetyNetSweep(): Promise<void> {
    if (isCronExternalized('sessions.end-expired.safety-net')) return;
    await this.safetyNet.run<{ id: string }, SessionTaskPayload>({
      slug: 'sessions.end-expired',
      queue: SESSIONS_QUEUE,
      handler: SESSION_HANDLERS.END,
      alertThreshold: 5,
      findStale: () => this.findStaleForEnd(20 * 60_000),
      taskParams: (row) => ({
        name: {
          entity: 'session',
          id: row.id,
          event: 'end',
          version: Date.now(),
        },
        payload: { sessionId: row.id },
      }),
    });
  }
}
