import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, gte, inArray, isNull, lte, ne } from 'drizzle-orm';
import { db } from '../../database';
import {
  roles,
  scheduledMaintenanceWindows,
  SCHEDULED_MAINTENANCE_STATUS,
  userNotifications,
  userRoles,
  users,
  type ScheduledMaintenanceStatus,
} from '../../database/schema';
import { AdminSettingsService } from '../admin-settings/admin-settings.service';
import { EmailService } from '../email/email.service';
import { TasksService } from '../tasks/tasks.service';
import type { CreateScheduledMaintenanceDto } from './dto/create-scheduled-maintenance.dto';
import type { UpdateScheduledMaintenanceDto } from './dto/update-scheduled-maintenance.dto';

// Cloud Tasks queue + handler slugs for this module. Kept adjacent so
// task-name schemes and handler wiring don't drift.
export const MAINTENANCE_QUEUE = 'maintenance-events';
export const MAINTENANCE_HANDLERS = {
  ACTIVATE: 'maintenance.activate',
  COMPLETE: 'maintenance.complete',
  PRE_NOTIFY: 'maintenance.pre-notify',
} as const;

export interface MaintenanceTaskPayload {
  windowId: string;
}

// Roles that receive pre-notifications + see the banner. Admin +
// Support are excluded — they're managing the window, not affected
// users.
const NOTIFY_ROLES = [
  'STUDENT',
  'INSTRUCTOR',
  'MANAGER',
  'TEACHING_ASSISTANT',
  'FINANCE',
] as const;

@Injectable()
export class ScheduledMaintenanceService {
  private readonly logger = new Logger(ScheduledMaintenanceService.name);

  constructor(
    private readonly settings: AdminSettingsService,
    private readonly emailService: EmailService,
    private readonly tasks: TasksService,
  ) {}

  // ─── Admin CRUD ─────────────────────────────────────────────

  async list(opts?: { status?: ScheduledMaintenanceStatus }) {
    const conditions: any[] = [];
    if (opts?.status) {
      conditions.push(eq(scheduledMaintenanceWindows.status, opts.status));
    }
    return db
      .select()
      .from(scheduledMaintenanceWindows)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(scheduledMaintenanceWindows.startAt))
      .limit(100);
  }

  /**
   * Lightweight "next upcoming" lookup for the admin dashboard
   * widget. Returns the soonest scheduled window within the next 7
   * days, or null if nothing is queued.
   */
  async getNextUpcoming() {
    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60_000);
    const [row] = await db
      .select()
      .from(scheduledMaintenanceWindows)
      .where(
        and(
          eq(
            scheduledMaintenanceWindows.status,
            SCHEDULED_MAINTENANCE_STATUS.SCHEDULED,
          ),
          gte(scheduledMaintenanceWindows.startAt, now),
          lte(scheduledMaintenanceWindows.startAt, sevenDays),
        ),
      )
      .orderBy(asc(scheduledMaintenanceWindows.startAt))
      .limit(1);
    return row ?? null;
  }

  async create(actorId: string, dto: CreateScheduledMaintenanceDto) {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new BadRequestException('Invalid start/end date');
    }
    if (endAt <= startAt) {
      throw new BadRequestException('End must be after start');
    }
    // Start must be in the future. 60s grace covers the round-trip
    // between the form's "now" and the server's "now" so users don't
    // get rejected for scheduling something for "right now".
    const graceEarliestStart = new Date(Date.now() - 60_000);
    if (startAt < graceEarliestStart) {
      throw new BadRequestException(
        'Start time must be in the future — cannot schedule a window in the past',
      );
    }
    if (endAt <= new Date()) {
      throw new BadRequestException('End must be in the future');
    }

    const [row] = await db
      .insert(scheduledMaintenanceWindows)
      .values({
        titleEn: dto.titleEn,
        titleAr: dto.titleAr ?? null,
        descriptionEn: dto.descriptionEn ?? null,
        descriptionAr: dto.descriptionAr ?? null,
        affectedComponents: dto.affectedComponents ?? [],
        startAt,
        endAt,
        preNotificationLeadMinutes: dto.preNotificationLeadMinutes ?? 60,
        createdBy: actorId,
      })
      .returning();

    // Enqueue the three lifecycle tasks that replace the polling cron.
    // A best-effort — if Cloud Tasks is unavailable, the safety-net
    // sweep + legacy @Cron still catch the window. Do not fail the
    // create() on enqueue error.
    try {
      await this.enqueueLifecycleTasks(row);
    } catch (err) {
      this.logger.error(
        `Failed to enqueue lifecycle tasks for window ${row.id}: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
    }

    return row;
  }

  async update(id: string, dto: UpdateScheduledMaintenanceDto) {
    const [existing] = await db
      .select()
      .from(scheduledMaintenanceWindows)
      .where(eq(scheduledMaintenanceWindows.id, id));
    if (!existing) throw new NotFoundException('Window not found');

    // Only scheduled windows are editable. Active/completed/cancelled
    // are immutable so we don't accidentally rewrite history.
    if (existing.status !== SCHEDULED_MAINTENANCE_STATUS.SCHEDULED) {
      throw new BadRequestException(
        `Cannot edit a ${existing.status} window`,
      );
    }

    const startAt = dto.startAt ? new Date(dto.startAt) : existing.startAt;
    const endAt = dto.endAt ? new Date(dto.endAt) : existing.endAt;
    if (endAt <= startAt) {
      throw new BadRequestException('End must be after start');
    }
    // If the admin actually changed the start time, enforce the
    // "not in the past" rule. If they're only editing other fields,
    // keep the existing start unchanged (it may already be in the
    // past if the cron is about to pick it up).
    if (dto.startAt) {
      const graceEarliestStart = new Date(Date.now() - 60_000);
      if (startAt < graceEarliestStart) {
        throw new BadRequestException(
          'Start time must be in the future — cannot schedule a window in the past',
        );
      }
    }

    const [updated] = await db
      .update(scheduledMaintenanceWindows)
      .set({
        titleEn: dto.titleEn ?? existing.titleEn,
        titleAr:
          dto.titleAr !== undefined ? (dto.titleAr || null) : existing.titleAr,
        descriptionEn:
          dto.descriptionEn !== undefined
            ? (dto.descriptionEn || null)
            : existing.descriptionEn,
        descriptionAr:
          dto.descriptionAr !== undefined
            ? (dto.descriptionAr || null)
            : existing.descriptionAr,
        affectedComponents:
          dto.affectedComponents ?? existing.affectedComponents,
        startAt,
        endAt,
        preNotificationLeadMinutes:
          dto.preNotificationLeadMinutes ?? existing.preNotificationLeadMinutes,
        // Editing a scheduled window clears the "pre-notification
        // sent" flag so the next cron tick reconsiders it against
        // the new timing.
        preNotificationSentAt: null,
      })
      .where(eq(scheduledMaintenanceWindows.id, id))
      .returning();

    // Reschedule tasks — startAt/endAt may have moved. cancelByEvent
    // sweeps every prior version so nothing stale can fire against
    // the old times.
    try {
      await this.enqueueLifecycleTasks(updated, { replaceExisting: true });
    } catch (err) {
      this.logger.error(
        `Failed to reschedule lifecycle tasks for window ${id}: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
    }

    return { success: true };
  }

  async cancel(id: string) {
    const [existing] = await db
      .select()
      .from(scheduledMaintenanceWindows)
      .where(eq(scheduledMaintenanceWindows.id, id));
    if (!existing) throw new NotFoundException('Window not found');

    if (existing.status !== SCHEDULED_MAINTENANCE_STATUS.SCHEDULED) {
      throw new BadRequestException(
        `Cannot cancel a ${existing.status} window`,
      );
    }

    await db
      .update(scheduledMaintenanceWindows)
      .set({ status: SCHEDULED_MAINTENANCE_STATUS.CANCELLED })
      .where(eq(scheduledMaintenanceWindows.id, id));

    // Delete pending Cloud Tasks — an activate/complete/pre-notify
    // firing on a cancelled window would be a no-op (per-row handlers
    // CAS-check status), but freeing the queue slot is tidier.
    try {
      await this.cancelLifecycleTasks(id);
    } catch (err) {
      this.logger.warn(
        `Failed to cancel lifecycle tasks for window ${id}: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
    }

    return { success: true };
  }

  // ─── Public / authed reads ─────────────────────────────────

  /**
   * Active OR soon-to-activate maintenance window (within the
   * pre-notification lead time) for the cross-dashboard banner.
   * Returns at most one — overlapping schedules show the earliest.
   */
  async getCurrentBannerWindow() {
    const now = new Date();
    // Active right now.
    const [active] = await db
      .select()
      .from(scheduledMaintenanceWindows)
      .where(eq(scheduledMaintenanceWindows.status, 'active'))
      .orderBy(asc(scheduledMaintenanceWindows.startAt))
      .limit(1);
    if (active) return active;

    // Scheduled and inside the lead window — show heads-up.
    const candidates = await db
      .select()
      .from(scheduledMaintenanceWindows)
      .where(
        and(
          eq(
            scheduledMaintenanceWindows.status,
            SCHEDULED_MAINTENANCE_STATUS.SCHEDULED,
          ),
          gte(scheduledMaintenanceWindows.startAt, now),
        ),
      )
      .orderBy(asc(scheduledMaintenanceWindows.startAt))
      .limit(5);
    for (const w of candidates) {
      const leadMs = w.preNotificationLeadMinutes * 60_000;
      if (w.startAt.getTime() - now.getTime() <= leadMs) {
        return w;
      }
    }
    return null;
  }

  // ─── Cron-invoked transitions ──────────────────────────────

  /**
   * Activate any scheduled window whose start_at has passed.
   *
   * Bulk version used by the legacy per-minute @Cron (kept during
   * parallel-run) AND by the hourly safety-net sweep. Delegates to
   * activateOne() for the per-window work so both entry points share
   * the same CAS-safe path.
   */
  async tickActivations(): Promise<number> {
    const now = new Date();
    const ready = await db
      .select({ id: scheduledMaintenanceWindows.id })
      .from(scheduledMaintenanceWindows)
      .where(
        and(
          eq(
            scheduledMaintenanceWindows.status,
            SCHEDULED_MAINTENANCE_STATUS.SCHEDULED,
          ),
          lte(scheduledMaintenanceWindows.startAt, now),
        ),
      );
    let acted = 0;
    for (const w of ready) {
      if (await this.activateOne(w.id)) acted++;
    }
    return acted;
  }

  async tickCompletions(): Promise<number> {
    const now = new Date();
    const done = await db
      .select({ id: scheduledMaintenanceWindows.id })
      .from(scheduledMaintenanceWindows)
      .where(
        and(
          eq(
            scheduledMaintenanceWindows.status,
            SCHEDULED_MAINTENANCE_STATUS.ACTIVE,
          ),
          lte(scheduledMaintenanceWindows.endAt, now),
        ),
      );
    let acted = 0;
    for (const w of done) {
      if (await this.completeOne(w.id)) acted++;
    }
    return acted;
  }

  async tickPreNotifications(): Promise<number> {
    const now = new Date();
    const candidates = await db
      .select({
        id: scheduledMaintenanceWindows.id,
        startAt: scheduledMaintenanceWindows.startAt,
        preNotificationLeadMinutes:
          scheduledMaintenanceWindows.preNotificationLeadMinutes,
      })
      .from(scheduledMaintenanceWindows)
      .where(
        and(
          eq(
            scheduledMaintenanceWindows.status,
            SCHEDULED_MAINTENANCE_STATUS.SCHEDULED,
          ),
          isNull(scheduledMaintenanceWindows.preNotificationSentAt),
          ne(scheduledMaintenanceWindows.preNotificationLeadMinutes, 0),
        ),
      );

    let acted = 0;
    for (const w of candidates) {
      const leadMs = w.preNotificationLeadMinutes * 60_000;
      if (w.startAt.getTime() - now.getTime() > leadMs) continue;
      if (await this.preNotifyOne(w.id)) acted++;
    }
    return acted;
  }

  // ─── Per-row event handlers (Cloud Tasks entry points) ─────
  //
  // Each returns true if the window was mutated, false if the CAS
  // update touched 0 rows (someone else already handled it or the
  // window's state has moved on since the task was enqueued).
  //
  // These are the ONLY paths that should be called from a Cloud Task
  // handler. All three are idempotent — safe to call any number of
  // times for the same window.

  async activateOne(windowId: string): Promise<boolean> {
    const now = new Date();

    // Fetch the row first so we know the desired end state and the
    // "already past end" case can skip the toggle flip. Only rows
    // that are still SCHEDULED and whose startAt has arrived get
    // touched.
    const [w] = await db
      .select()
      .from(scheduledMaintenanceWindows)
      .where(eq(scheduledMaintenanceWindows.id, windowId));
    if (!w) return false;
    if (w.status !== SCHEDULED_MAINTENANCE_STATUS.SCHEDULED) return false;
    if (w.startAt > now) return false;

    // If we've already passed the end_at (cron / dispatch was late)
    // skip straight to completed without ever flipping the toggle.
    if (w.endAt <= now) {
      const claim = await db
        .update(scheduledMaintenanceWindows)
        .set({ status: SCHEDULED_MAINTENANCE_STATUS.COMPLETED })
        .where(
          and(
            eq(scheduledMaintenanceWindows.id, windowId),
            eq(
              scheduledMaintenanceWindows.status,
              SCHEDULED_MAINTENANCE_STATUS.SCHEDULED,
            ),
          ),
        )
        .returning({ id: scheduledMaintenanceWindows.id });
      return claim.length > 0;
    }

    // CAS claim: only proceed with side-effects if THIS caller flipped
    // status from SCHEDULED → ACTIVE. Concurrent legacy @Cron + Cloud
    // Task delivery race safely here — loser sees rowCount 0 and no-ops.
    const claim = await db
      .update(scheduledMaintenanceWindows)
      .set({ status: SCHEDULED_MAINTENANCE_STATUS.ACTIVE })
      .where(
        and(
          eq(scheduledMaintenanceWindows.id, windowId),
          eq(
            scheduledMaintenanceWindows.status,
            SCHEDULED_MAINTENANCE_STATUS.SCHEDULED,
          ),
        ),
      )
      .returning({ id: scheduledMaintenanceWindows.id });
    if (claim.length === 0) return false;

    const messageEn =
      w.descriptionEn?.trim() ||
      `Scheduled maintenance: ${w.titleEn}. The platform will return shortly.`;
    const messageAr =
      w.descriptionAr?.trim() ||
      w.titleAr ||
      'صيانة مجدولة. ستعود المنصة قريباً.';

    const existing = await this.settings.getCategory<{
      enabled?: boolean;
      messageEn?: string;
      messageAr?: string;
    }>('maintenance');

    await this.settings.updateCategory(
      'maintenance',
      {
        ...existing,
        enabled: true,
        messageEn,
        messageAr,
        activeWindowId: w.id,
      },
      w.createdBy ?? '00000000-0000-0000-0000-000000000000',
    );

    this.logger.log(
      `Activated scheduled maintenance window ${w.id} (${w.titleEn})`,
    );
    return true;
  }

  async completeOne(windowId: string): Promise<boolean> {
    const now = new Date();
    const [w] = await db
      .select()
      .from(scheduledMaintenanceWindows)
      .where(eq(scheduledMaintenanceWindows.id, windowId));
    if (!w) return false;
    if (w.status !== SCHEDULED_MAINTENANCE_STATUS.ACTIVE) return false;
    if (w.endAt > now) return false;

    const claim = await db
      .update(scheduledMaintenanceWindows)
      .set({ status: SCHEDULED_MAINTENANCE_STATUS.COMPLETED })
      .where(
        and(
          eq(scheduledMaintenanceWindows.id, windowId),
          eq(
            scheduledMaintenanceWindows.status,
            SCHEDULED_MAINTENANCE_STATUS.ACTIVE,
          ),
        ),
      )
      .returning({ id: scheduledMaintenanceWindows.id });
    if (claim.length === 0) return false;

    // Only flip the toggle off if THIS window owns it. Otherwise a
    // manual ON or a different overlapping window could be in control.
    const existing = await this.settings.getCategory<{
      enabled?: boolean;
      activeWindowId?: string;
    }>('maintenance');
    if (existing.activeWindowId === w.id) {
      await this.settings.updateCategory(
        'maintenance',
        {
          ...existing,
          enabled: false,
          activeWindowId: null,
        },
        w.createdBy ?? '00000000-0000-0000-0000-000000000000',
      );
    }

    this.logger.log(
      `Completed scheduled maintenance window ${w.id} (${w.titleEn})`,
    );
    return true;
  }

  async preNotifyOne(windowId: string): Promise<boolean> {
    const now = new Date();
    const [w] = await db
      .select()
      .from(scheduledMaintenanceWindows)
      .where(eq(scheduledMaintenanceWindows.id, windowId));
    if (!w) return false;
    if (w.status !== SCHEDULED_MAINTENANCE_STATUS.SCHEDULED) return false;
    if (w.preNotificationSentAt) return false;
    if (w.preNotificationLeadMinutes === 0) return false;

    // CAS claim on preNotificationSentAt = null. This closes the
    // double-send race the legacy code had — the current @Cron only
    // filtered null in the SELECT, not in the UPDATE, so two parallel
    // instances could both dispatch. Here the UPDATE only affects the
    // row when it's STILL null, giving us at-most-once semantics.
    const claim = await db
      .update(scheduledMaintenanceWindows)
      .set({ preNotificationSentAt: now })
      .where(
        and(
          eq(scheduledMaintenanceWindows.id, windowId),
          isNull(scheduledMaintenanceWindows.preNotificationSentAt),
          eq(
            scheduledMaintenanceWindows.status,
            SCHEDULED_MAINTENANCE_STATUS.SCHEDULED,
          ),
        ),
      )
      .returning({ id: scheduledMaintenanceWindows.id });
    if (claim.length === 0) return false;

    try {
      await this.notifyAffectedUsers(w);
      return true;
    } catch (e) {
      this.logger.error(
        `Pre-notification for ${w.id} failed: ${
          e instanceof Error ? e.message : 'unknown'
        }`,
      );
      // Claim already committed — do NOT reset preNotificationSentAt,
      // otherwise a retry would double-send to users who did receive
      // the email. Better to lose one notification than double-notify.
      return false;
    }
  }

  // ─── Cloud Tasks orchestration ─────────────────────────────

  /**
   * Enqueue (or re-enqueue after cancel) the three lifecycle tasks
   * for a window. Called after every write path that materially
   * changes when the window fires.
   *
   * Version: uses the trigger time itself as the task version.
   * That means startAt or endAt changing naturally produces a new
   * task name — perfect for reschedule.
   *
   * Pre-notify skipped when lead = 0. Complete always enqueued (the
   * handler no-ops if the window was never activated).
   */
  private async enqueueLifecycleTasks(
    w: typeof scheduledMaintenanceWindows.$inferSelect,
    opts: { replaceExisting?: boolean } = {},
  ): Promise<void> {
    if (!this.tasks.isEnabled()) return;

    // On update, cancel prior task versions first so old scheduleTimes
    // don't fire. Skip on create since there's nothing to cancel.
    if (opts.replaceExisting) {
      await Promise.all([
        this.tasks.cancelByEvent({
          queue: MAINTENANCE_QUEUE,
          entity: 'maint',
          id: w.id,
          event: 'activate',
        }),
        this.tasks.cancelByEvent({
          queue: MAINTENANCE_QUEUE,
          entity: 'maint',
          id: w.id,
          event: 'complete',
        }),
        this.tasks.cancelByEvent({
          queue: MAINTENANCE_QUEUE,
          entity: 'maint',
          id: w.id,
          event: 'pre-notify',
        }),
      ]);
    }

    const payload: MaintenanceTaskPayload = { windowId: w.id };

    // ACTIVATE at startAt — version = startAt.getTime()
    await this.tasks.enqueue<MaintenanceTaskPayload>({
      queue: MAINTENANCE_QUEUE,
      handler: MAINTENANCE_HANDLERS.ACTIVATE,
      name: {
        entity: 'maint',
        id: w.id,
        event: 'activate',
        version: w.startAt,
      },
      payload,
      scheduleAt: w.startAt,
    });

    // COMPLETE at endAt — version = endAt.getTime()
    await this.tasks.enqueue<MaintenanceTaskPayload>({
      queue: MAINTENANCE_QUEUE,
      handler: MAINTENANCE_HANDLERS.COMPLETE,
      name: {
        entity: 'maint',
        id: w.id,
        event: 'complete',
        version: w.endAt,
      },
      payload,
      scheduleAt: w.endAt,
    });

    // PRE-NOTIFY at startAt - leadMinutes — skip if lead=0
    if (w.preNotificationLeadMinutes > 0) {
      const notifyAt = new Date(
        w.startAt.getTime() - w.preNotificationLeadMinutes * 60_000,
      );
      // If the notify time already passed at create() time (window was
      // scheduled with lead > time-until-start), still enqueue with
      // scheduleAt = now so the notification fires immediately.
      await this.tasks.enqueue<MaintenanceTaskPayload>({
        queue: MAINTENANCE_QUEUE,
        handler: MAINTENANCE_HANDLERS.PRE_NOTIFY,
        name: {
          entity: 'maint',
          id: w.id,
          event: 'pre-notify',
          version: notifyAt,
        },
        payload,
        scheduleAt: notifyAt.getTime() < Date.now() ? undefined : notifyAt,
      });
    }
  }

  private async cancelLifecycleTasks(windowId: string): Promise<void> {
    if (!this.tasks.isEnabled()) return;
    await Promise.all([
      this.tasks.cancelByEvent({
        queue: MAINTENANCE_QUEUE,
        entity: 'maint',
        id: windowId,
        event: 'activate',
      }),
      this.tasks.cancelByEvent({
        queue: MAINTENANCE_QUEUE,
        entity: 'maint',
        id: windowId,
        event: 'complete',
      }),
      this.tasks.cancelByEvent({
        queue: MAINTENANCE_QUEUE,
        entity: 'maint',
        id: windowId,
        event: 'pre-notify',
      }),
    ]);
  }

  // ─── Safety-net sweep queries ──────────────────────────────
  //
  // Returns windows whose event-driven task appears to have been
  // missed. Feeds SafetyNetSweep in the hourly cron.

  async findStaleForActivate(
    lagMs: number,
  ): Promise<{ id: string }[]> {
    const cutoff = new Date(Date.now() - lagMs);
    return db
      .select({ id: scheduledMaintenanceWindows.id })
      .from(scheduledMaintenanceWindows)
      .where(
        and(
          eq(
            scheduledMaintenanceWindows.status,
            SCHEDULED_MAINTENANCE_STATUS.SCHEDULED,
          ),
          lte(scheduledMaintenanceWindows.startAt, cutoff),
        ),
      );
  }

  async findStaleForComplete(
    lagMs: number,
  ): Promise<{ id: string }[]> {
    const cutoff = new Date(Date.now() - lagMs);
    return db
      .select({ id: scheduledMaintenanceWindows.id })
      .from(scheduledMaintenanceWindows)
      .where(
        and(
          eq(
            scheduledMaintenanceWindows.status,
            SCHEDULED_MAINTENANCE_STATUS.ACTIVE,
          ),
          lte(scheduledMaintenanceWindows.endAt, cutoff),
        ),
      );
  }

  async findStaleForPreNotify(
    lagMs: number,
  ): Promise<{ id: string }[]> {
    const now = Date.now();
    const cutoff = new Date(now - lagMs);
    const rows = await db
      .select({
        id: scheduledMaintenanceWindows.id,
        startAt: scheduledMaintenanceWindows.startAt,
        preNotificationLeadMinutes:
          scheduledMaintenanceWindows.preNotificationLeadMinutes,
      })
      .from(scheduledMaintenanceWindows)
      .where(
        and(
          eq(
            scheduledMaintenanceWindows.status,
            SCHEDULED_MAINTENANCE_STATUS.SCHEDULED,
          ),
          isNull(scheduledMaintenanceWindows.preNotificationSentAt),
          ne(scheduledMaintenanceWindows.preNotificationLeadMinutes, 0),
        ),
      );
    // Filter to rows where notify time is >= lagMs in the past.
    return rows
      .filter((w) => {
        const notifyMs = w.startAt.getTime() - w.preNotificationLeadMinutes * 60_000;
        return notifyMs <= cutoff.getTime();
      })
      .map((w) => ({ id: w.id }));
  }

  // ─── Internal helpers ──────────────────────────────────────

  /**
   * Send in-app notification + email to every active end-user. We
   * notify the same set as end-user incidents (STUDENT, INSTRUCTOR,
   * MANAGER, TA, FINANCE) — admin + support are excluded because
   * they're handling the maintenance.
   */
  private async notifyAffectedUsers(
    w: typeof scheduledMaintenanceWindows.$inferSelect,
  ): Promise<void> {
    const recipients = await db
      .selectDistinct({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(
        and(
          eq(users.isActive, true),
          inArray(roles.name, NOTIFY_ROLES as unknown as string[]),
        ),
      );

    if (recipients.length === 0) {
      this.logger.log(
        `Scheduled maintenance ${w.id}: no recipients found`,
      );
      return;
    }

    const dateFmt = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const windowLabel = `${dateFmt.format(w.startAt)} – ${dateFmt.format(w.endAt)}`;
    const subject = `[Scheduled maintenance] ${w.titleEn} · ${windowLabel}`;
    const body =
      w.descriptionEn?.trim() ||
      `Scheduled maintenance is planned for ${windowLabel}. The platform will be temporarily unavailable during this window.`;

    await db.insert(userNotifications).values(
      recipients.map((r) => ({
        recipientId: r.id,
        type: 'scheduled_maintenance',
        title: w.titleEn,
        message: `${windowLabel}\n\n${body}`,
        link: '/status',
        entityType: 'scheduled_maintenance',
        entityId: w.id,
      })),
    );

    for (const r of recipients) {
      if (!r.email) continue;
      const recipientName =
        [r.firstName, r.lastName].filter(Boolean).join(' ') || 'there';
      try {
        await this.emailService.sendGenericNotification(
          r.email,
          {
            recipientName,
            subject,
            message: `${windowLabel}\n\n${body}`,
          },
          'en',
        );
      } catch (e) {
        this.logger.warn(
          `Scheduled maintenance email to ${r.email} failed: ${
            e instanceof Error ? e.message : 'unknown'
          }`,
        );
      }
    }
  }
}
