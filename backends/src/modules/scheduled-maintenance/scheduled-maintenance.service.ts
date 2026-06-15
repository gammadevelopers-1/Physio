import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, isNull, lte, ne } from 'drizzle-orm';
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
import type { CreateScheduledMaintenanceDto } from './dto/create-scheduled-maintenance.dto';
import type { UpdateScheduledMaintenanceDto } from './dto/update-scheduled-maintenance.dto';

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

    await db
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
      .where(eq(scheduledMaintenanceWindows.id, id));

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
   * Replaces the system maintenance.enabled toggle with our
   * window's title + description so the maintenance page reads
   * naturally to users.
   */
  async tickActivations(): Promise<number> {
    const now = new Date();
    const ready = await db
      .select()
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

    if (ready.length === 0) return 0;
    for (const w of ready) {
      // If we've already passed the end_at (e.g. cron lagged) skip
      // straight to completed without flipping the toggle.
      if (w.endAt <= now) {
        await db
          .update(scheduledMaintenanceWindows)
          .set({ status: SCHEDULED_MAINTENANCE_STATUS.COMPLETED })
          .where(eq(scheduledMaintenanceWindows.id, w.id));
        continue;
      }
      // Mark the window active first so a second tick can't double-fire.
      await db
        .update(scheduledMaintenanceWindows)
        .set({ status: SCHEDULED_MAINTENANCE_STATUS.ACTIVE })
        .where(eq(scheduledMaintenanceWindows.id, w.id));

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
          // Audit hint — useful when debugging "why is maintenance on".
          activeWindowId: w.id,
        },
        w.createdBy ?? '00000000-0000-0000-0000-000000000000',
      );

      this.logger.log(
        `Activated scheduled maintenance window ${w.id} (${w.titleEn})`,
      );
    }
    return ready.length;
  }

  /**
   * Deactivate any active window whose end_at has passed.
   */
  async tickCompletions(): Promise<number> {
    const now = new Date();
    const done = await db
      .select()
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
    if (done.length === 0) return 0;

    for (const w of done) {
      await db
        .update(scheduledMaintenanceWindows)
        .set({ status: SCHEDULED_MAINTENANCE_STATUS.COMPLETED })
        .where(eq(scheduledMaintenanceWindows.id, w.id));

      // Only flip the toggle off if THIS window owns it. Otherwise
      // a manual ON or a different window could be in control.
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
    }
    return done.length;
  }

  /**
   * Fan out pre-notification heads-ups for any scheduled window
   * whose start_at is within its lead window AND hasn't been
   * notified yet. Lead 0 = skip entirely.
   */
  async tickPreNotifications(): Promise<number> {
    const now = new Date();
    const candidates = await db
      .select()
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

    let fired = 0;
    for (const w of candidates) {
      const leadMs = w.preNotificationLeadMinutes * 60_000;
      if (w.startAt.getTime() - now.getTime() > leadMs) continue;
      // Mark sent BEFORE dispatching so a retry can't double-send.
      await db
        .update(scheduledMaintenanceWindows)
        .set({ preNotificationSentAt: now })
        .where(eq(scheduledMaintenanceWindows.id, w.id));

      try {
        await this.notifyAffectedUsers(w);
        fired++;
      } catch (e) {
        this.logger.error(
          `Pre-notification for ${w.id} failed: ${
            e instanceof Error ? e.message : 'unknown'
          }`,
        );
      }
    }
    return fired;
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
