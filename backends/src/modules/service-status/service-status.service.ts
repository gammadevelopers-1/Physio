import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  isNotNull,
  sql,
} from 'drizzle-orm';
import { db } from '../../database';
import {
  serviceStatusComponents,
  serviceStatusIncidents,
  serviceStatusIncidentUpdates,
  statusPageViewEvents,
  ticketIncidents,
  tickets,
  ticketComments,
  userNotifications,
  users,
  userRoles,
  roles,
  TICKET_STATUS,
  ON_HOLD_REASONS,
  INCIDENT_AFFECTED_ROLES,
  INCIDENT_LINKED_RESOLUTION_STRATEGY,
  type IncidentAffectedRole,
  type IncidentLinkedResolutionStrategy,
} from '../../database/schema';
import { createHash } from 'crypto';
import type {
  UpdateComponentStatusDto,
  CreateIncidentDto,
  PostIncidentUpdateDto,
  UpdateIncidentReportDto,
} from './dto';
import { EmailService } from '../email/email.service';
import { toCsvString } from '../../common/exports/csv.util';

@Injectable()
export class ServiceStatusService {
  private readonly logger = new Logger(ServiceStatusService.name);

  constructor(private readonly emailService: EmailService) {}

  // ─── Public read ──────────────────────────────────────────────
  //
  // Single payload powering the public /status page. Returns:
  //   • Every active component with its current state + message
  //   • Active incidents (resolved_at IS NULL) with their full update
  //     timelines, newest update first
  //   • Resolved incidents from the last 7 days for transparency
  //   • A derived overallStatus chip — green when all good, amber/red
  //     when any component is off-nominal
  //
  // Two queries + an in-memory grouping; fast enough that the public
  // page can hit this on every visit without a cache.
  async getPublicStatus() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [components, activeIncidents, resolvedIncidents] = await Promise.all([
      db
        .select({
          key: serviceStatusComponents.key,
          nameEn: serviceStatusComponents.nameEn,
          nameAr: serviceStatusComponents.nameAr,
          descriptionEn: serviceStatusComponents.descriptionEn,
          descriptionAr: serviceStatusComponents.descriptionAr,
          currentStatus: serviceStatusComponents.currentStatus,
          currentMessageEn: serviceStatusComponents.currentMessageEn,
          currentMessageAr: serviceStatusComponents.currentMessageAr,
          displayOrder: serviceStatusComponents.displayOrder,
          updatedAt: serviceStatusComponents.updatedAt,
          // Auto-detection metadata — surfaced publicly so users see
          // "Last checked 3 min ago" beside each component. Hides the
          // implementation but builds trust that the data is fresh.
          checkType: serviceStatusComponents.checkType,
          autoCheckedAt: serviceStatusComponents.autoCheckedAt,
          isManualOverride: serviceStatusComponents.manualOverrideStatus,
        })
        .from(serviceStatusComponents)
        .where(eq(serviceStatusComponents.isActive, true))
        .orderBy(asc(serviceStatusComponents.displayOrder)),

      db
        .select()
        .from(serviceStatusIncidents)
        .where(isNull(serviceStatusIncidents.resolvedAt))
        .orderBy(desc(serviceStatusIncidents.startedAt)),

      db
        .select()
        .from(serviceStatusIncidents)
        .where(
          and(
            isNotNull(serviceStatusIncidents.resolvedAt),
            gte(serviceStatusIncidents.resolvedAt, sevenDaysAgo),
          ),
        )
        .orderBy(desc(serviceStatusIncidents.resolvedAt)),
    ]);

    const allIncidentIds = [
      ...activeIncidents.map((i) => i.id),
      ...resolvedIncidents.map((i) => i.id),
    ];

    const updatesByIncident = new Map<string, any[]>();
    if (allIncidentIds.length > 0) {
      const updates = await db
        .select()
        .from(serviceStatusIncidentUpdates)
        .orderBy(desc(serviceStatusIncidentUpdates.postedAt));
      for (const u of updates) {
        if (!allIncidentIds.includes(u.incidentId)) continue;
        const arr = updatesByIncident.get(u.incidentId) ?? [];
        arr.push(u);
        updatesByIncident.set(u.incidentId, arr);
      }
    }

    const attachUpdates = (inc: any) => ({
      ...inc,
      updates: updatesByIncident.get(inc.id) ?? [],
    });

    // Derive overall status — escalate up the worst component state.
    // Maintenance is treated as informational, not down.
    let overallStatus: 'operational' | 'degraded' | 'down' | 'maintenance' =
      'operational';
    for (const c of components) {
      if (c.currentStatus === 'major_outage') {
        overallStatus = 'down';
        break;
      }
      if (
        c.currentStatus === 'partial_outage' ||
        c.currentStatus === 'degraded'
      ) {
        if (overallStatus === 'operational') overallStatus = 'degraded';
      }
      if (
        c.currentStatus === 'maintenance' &&
        overallStatus === 'operational'
      ) {
        overallStatus = 'maintenance';
      }
    }
    // Active incidents also nudge the overall chip — otherwise we end up
    // saying "All systems operational" while a real incident is open
    // (because component statuses are admin-flipped, not auto-set by
    // incidents). Critical → down, anything else → degraded.
    for (const inc of activeIncidents) {
      if (inc.severity === 'critical') {
        overallStatus = 'down';
        break;
      }
      if (overallStatus === 'operational') overallStatus = 'degraded';
    }

    return {
      overallStatus,
      // Shape isManualOverride into a clean bool — the public page
      // doesn't need the raw status string, just whether an admin
      // pinned it. The cron handles auto_status; admin always wins
      // when present.
      components: components.map((c) => ({
        ...c,
        isManualOverride: !!c.isManualOverride,
      })),
      activeIncidents: activeIncidents.map(attachUpdates),
      recentResolvedIncidents: resolvedIncidents.map(attachUpdates),
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Public, paginated history of resolved incidents. Powers the
   * `/status/history` archive page that lets users + auditors browse
   * past incidents beyond the 7-day window on the main `/status`
   * page. Filterable by date range, severity, and affected component.
   *
   * Returns the latest update message per incident so the table can
   * surface a one-line summary without N+1 lookups.
   */
  async getStatusHistory(opts: {
    page?: number;
    pageSize?: number;
    from?: Date;
    to?: Date;
    severity?: 'minor' | 'major' | 'critical';
    component?: string;
  }) {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 50));
    const offset = (page - 1) * pageSize;

    const conditions: any[] = [isNotNull(serviceStatusIncidents.resolvedAt)];
    if (opts.from) conditions.push(gte(serviceStatusIncidents.resolvedAt, opts.from));
    if (opts.to) conditions.push(sql`${serviceStatusIncidents.resolvedAt} <= ${opts.to}`);
    if (opts.severity)
      conditions.push(eq(serviceStatusIncidents.severity, opts.severity));
    if (opts.component)
      conditions.push(
        sql`${serviceStatusIncidents.affectedComponents} @> ARRAY[${opts.component}]::text[]`,
      );

    const whereClause = and(...conditions);

    const [rows, [{ count: totalRaw }]] = await Promise.all([
      db
        .select()
        .from(serviceStatusIncidents)
        .where(whereClause)
        .orderBy(desc(serviceStatusIncidents.resolvedAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(serviceStatusIncidents)
        .where(whereClause),
    ]);

    if (rows.length === 0) {
      return {
        incidents: [],
        page,
        pageSize,
        total: Number(totalRaw),
      };
    }

    const incidentIds = rows.map((r) => r.id);
    const updates = await db
      .select()
      .from(serviceStatusIncidentUpdates)
      .where(inArray(serviceStatusIncidentUpdates.incidentId, incidentIds))
      .orderBy(desc(serviceStatusIncidentUpdates.postedAt));

    const latestByIncident = new Map<string, (typeof updates)[number]>();
    for (const u of updates) {
      if (!latestByIncident.has(u.incidentId)) latestByIncident.set(u.incidentId, u);
    }

    return {
      incidents: rows.map((i) => {
        const durationMs =
          i.resolvedAt && i.startedAt
            ? i.resolvedAt.getTime() - i.startedAt.getTime()
            : 0;
        return {
          id: i.id,
          titleEn: i.titleEn,
          titleAr: i.titleAr,
          severity: i.severity,
          affectedComponents: i.affectedComponents,
          startedAt: i.startedAt,
          resolvedAt: i.resolvedAt,
          durationMinutes: Math.round(durationMs / 60_000),
          latestUpdate: latestByIncident.get(i.id) ?? null,
        };
      }),
      page,
      pageSize,
      total: Number(totalRaw),
    };
  }

  /**
   * Active incidents visible to a given role's dashboard. Filtered
   * down to incidents that are (a) end-user-facing and (b) explicitly
   * targeted at that role. Used by the cross-dashboard
   * `<IncidentBanner />`. Returns the latest update message so the
   * banner can show fresh copy without a second round-trip.
   */
  async listActiveBannerIncidentsForRole(roleName: string) {
    const incidents = await db
      .select()
      .from(serviceStatusIncidents)
      .where(
        and(
          isNull(serviceStatusIncidents.resolvedAt),
          eq(serviceStatusIncidents.audience, 'end_users'),
          // Postgres @> contains operator on text[] — picks rows where
          // affected_roles includes this role.
          sql`${serviceStatusIncidents.affectedRoles} @> ARRAY[${roleName}]::text[]`,
        ),
      )
      .orderBy(desc(serviceStatusIncidents.startedAt));

    if (incidents.length === 0) return [];

    const incidentIds = incidents.map((i) => i.id);
    const updates = await db
      .select()
      .from(serviceStatusIncidentUpdates)
      .where(inArray(serviceStatusIncidentUpdates.incidentId, incidentIds))
      .orderBy(desc(serviceStatusIncidentUpdates.postedAt));

    const latestByIncident = new Map<string, (typeof updates)[number]>();
    for (const u of updates) {
      if (!latestByIncident.has(u.incidentId)) {
        latestByIncident.set(u.incidentId, u);
      }
    }

    return incidents.map((i) => ({
      id: i.id,
      titleEn: i.titleEn,
      titleAr: i.titleAr,
      severity: i.severity,
      currentStatus: i.currentStatus,
      startedAt: i.startedAt,
      latestUpdate: latestByIncident.get(i.id) ?? null,
    }));
  }

  // ─── Admin: components ────────────────────────────────────────

  async listComponentsForAdmin() {
    return db
      .select()
      .from(serviceStatusComponents)
      .orderBy(asc(serviceStatusComponents.displayOrder));
  }

  /**
   * Admin flips a component status. Two semantics live here:
   *
   * 1. For components with checkType='manual' (e.g. Payment until
   *    a real gateway is wired), the admin's choice IS the truth.
   *    We write to currentStatus directly.
   *
   * 2. For components with auto-checkers, the admin's choice
   *    becomes a manual override that survives the next cron tick.
   *    Auto-check still runs in the background and writes
   *    autoStatus, but the public endpoint surfaces the override.
   *
   * Either way the public page sees the new value immediately —
   * the cron just keeps the auto column updated in parallel.
   */
  async updateComponentStatus(
    key: string,
    userId: string,
    dto: UpdateComponentStatusDto,
  ) {
    const [existing] = await db
      .select({
        key: serviceStatusComponents.key,
        checkType: serviceStatusComponents.checkType,
      })
      .from(serviceStatusComponents)
      .where(eq(serviceStatusComponents.key, key));
    if (!existing) throw new NotFoundException('Component not found');

    const now = new Date();
    const updates: Record<string, unknown> = {
      currentStatus: dto.currentStatus,
      currentMessageEn: dto.currentMessageEn ?? null,
      currentMessageAr: dto.currentMessageAr ?? null,
      updatedAt: now,
      updatedBy: userId,
    };

    if (existing.checkType !== 'manual') {
      // Pin as override so the next cron tick won't bulldoze the
      // admin's choice. Cleared via clearManualOverride().
      updates.manualOverrideStatus = dto.currentStatus;
      updates.manualOverrideSetAt = now;
      updates.manualOverrideSetBy = userId;
    }

    await db
      .update(serviceStatusComponents)
      .set(updates)
      .where(eq(serviceStatusComponents.key, key));

    return { success: true };
  }

  /**
   * Clear the admin's manual pin, returning the component to
   * auto-check control. The next cron tick (within 5 min) will
   * write the live state. Until then we drop currentStatus back
   * to whatever autoStatus already reflects so the public page
   * shows the auto state immediately, not the stale override.
   */
  async clearManualOverride(key: string, userId: string) {
    const [existing] = await db
      .select({
        key: serviceStatusComponents.key,
        autoStatus: serviceStatusComponents.autoStatus,
        manualOverrideStatus: serviceStatusComponents.manualOverrideStatus,
      })
      .from(serviceStatusComponents)
      .where(eq(serviceStatusComponents.key, key));
    if (!existing) throw new NotFoundException('Component not found');
    if (!existing.manualOverrideStatus) {
      return { success: true, alreadyAuto: true };
    }

    const now = new Date();
    await db
      .update(serviceStatusComponents)
      .set({
        manualOverrideStatus: null,
        manualOverrideSetAt: null,
        manualOverrideSetBy: null,
        // Reflect auto immediately so the public page doesn't show
        // a stale override while waiting for the next cron tick.
        currentStatus: existing.autoStatus ?? 'operational',
        currentMessageEn: null,
        currentMessageAr: null,
        updatedAt: now,
        updatedBy: userId,
      })
      .where(eq(serviceStatusComponents.key, key));

    return { success: true };
  }

  // ─── Admin: incidents ─────────────────────────────────────────

  async listIncidentsForAdmin(opts?: { status?: 'active' | 'resolved' | 'all' }) {
    const status = opts?.status ?? 'all';
    const conditions: any[] = [];
    if (status === 'active') conditions.push(isNull(serviceStatusIncidents.resolvedAt));
    if (status === 'resolved') conditions.push(isNotNull(serviceStatusIncidents.resolvedAt));

    const incidents = await db
      .select()
      .from(serviceStatusIncidents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(serviceStatusIncidents.startedAt))
      .limit(100);

    if (incidents.length === 0) return [];

    const incidentIds = incidents.map((i) => i.id);

    const [updates, linkedTicketCounts] = await Promise.all([
      db
        .select()
        .from(serviceStatusIncidentUpdates)
        .where(inArray(serviceStatusIncidentUpdates.incidentId, incidentIds))
        .orderBy(desc(serviceStatusIncidentUpdates.postedAt)),
      db
        .select({
          incidentId: ticketIncidents.incidentId,
          count: sql<number>`count(*)::int`,
        })
        .from(ticketIncidents)
        .where(inArray(ticketIncidents.incidentId, incidentIds))
        .groupBy(ticketIncidents.incidentId),
    ]);

    const updatesByIncident = new Map<string, any[]>();
    for (const u of updates) {
      const arr = updatesByIncident.get(u.incidentId) ?? [];
      arr.push(u);
      updatesByIncident.set(u.incidentId, arr);
    }
    const countByIncident = new Map<string, number>(
      linkedTicketCounts.map((c) => [c.incidentId, Number(c.count)]),
    );

    return incidents.map((i) => ({
      ...i,
      updates: updatesByIncident.get(i.id) ?? [],
      linkedTicketsCount: countByIncident.get(i.id) ?? 0,
    }));
  }

  async createIncident(userId: string, dto: CreateIncidentDto) {
    // Validate every referenced component key exists — surfaces typos
    // immediately rather than silently dropping the link.
    if (dto.affectedComponents.length > 0) {
      const rows = await db
        .select({ key: serviceStatusComponents.key })
        .from(serviceStatusComponents);
      const known = new Set(rows.map((r) => r.key));
      const bad = dto.affectedComponents.filter((k) => !known.has(k));
      if (bad.length > 0) {
        throw new BadRequestException(
          `Unknown component key(s): ${bad.join(', ')}`,
        );
      }
    }

    const audience = dto.audience ?? 'internal';
    const affectedRoles = dto.affectedRoles ?? [];
    if (audience === 'end_users' && affectedRoles.length === 0) {
      throw new BadRequestException(
        'End-user incidents must declare at least one affected role',
      );
    }
    // Validate role names against the allowed set so the @> filter on
    // listActiveBannerIncidentsForRole can match cleanly.
    const allowed = new Set<string>(INCIDENT_AFFECTED_ROLES);
    const badRoles = affectedRoles.filter((r) => !allowed.has(r));
    if (badRoles.length > 0) {
      throw new BadRequestException(
        `Unknown affected role(s): ${badRoles.join(', ')}`,
      );
    }

    const now = new Date();
    const [incident] = await db
      .insert(serviceStatusIncidents)
      .values({
        titleEn: dto.titleEn,
        titleAr: dto.titleAr ?? null,
        affectedComponents: dto.affectedComponents,
        currentStatus: dto.initialStatus,
        severity: dto.severity,
        audience,
        affectedRoles,
        startedAt: now,
        resolvedAt: dto.initialStatus === 'resolved' ? now : null,
        createdBy: userId,
      })
      .returning();

    await db.insert(serviceStatusIncidentUpdates).values({
      incidentId: incident.id,
      status: dto.initialStatus,
      messageEn: dto.initialMessageEn,
      messageAr: dto.initialMessageAr ?? null,
      postedBy: userId,
    });

    // Fire end-user notifications eagerly on creation so affected
    // users see the banner / email immediately. Banner is driven by
    // the active-incidents query so it's already live the moment we
    // insert the row; this fans out the in-app notif + email.
    if (audience === 'end_users') {
      this.notifyAudience(incident.id, {
        titleEn: dto.titleEn,
        titleAr: dto.titleAr,
        messageEn: dto.initialMessageEn,
        messageAr: dto.initialMessageAr,
        affectedRoles,
        kind: 'new',
      }).catch((e) =>
        this.logger.error(
          `Incident ${incident.id} audience notify failed`,
          e,
        ),
      );
    }

    return incident;
  }

  async postIncidentUpdate(
    incidentId: string,
    userId: string,
    dto: PostIncidentUpdateDto,
  ) {
    const [existing] = await db
      .select()
      .from(serviceStatusIncidents)
      .where(eq(serviceStatusIncidents.id, incidentId));
    if (!existing) throw new NotFoundException('Incident not found');

    const now = new Date();
    await db.insert(serviceStatusIncidentUpdates).values({
      incidentId,
      status: dto.status,
      messageEn: dto.messageEn,
      messageAr: dto.messageAr ?? null,
      postedAt: now,
      postedBy: userId,
    });

    const isResolving = dto.status === 'resolved';
    const strategy: IncidentLinkedResolutionStrategy = isResolving
      ? (dto.linkedResolutionStrategy ??
        INCIDENT_LINKED_RESOLUTION_STRATEGY.SOFT_RESOLVE)
      : (existing.linkedResolutionStrategy as IncidentLinkedResolutionStrategy | null) ??
        INCIDENT_LINKED_RESOLUTION_STRATEGY.SOFT_RESOLVE;

    // Mirror the latest status onto the incident itself so list
    // queries don't need to join the updates table just to know
    // where things stand.
    await db
      .update(serviceStatusIncidents)
      .set({
        currentStatus: dto.status,
        resolvedAt: isResolving ? now : null,
        linkedResolutionStrategy: isResolving ? strategy : null,
      })
      .where(eq(serviceStatusIncidents.id, incidentId));

    // When the admin marks the incident resolved, fan out to every
    // linked ticket per the chosen strategy.
    if (isResolving) {
      await this.applyResolutionStrategyToLinkedTickets({
        incidentId,
        incidentTitleEn: existing.titleEn,
        incidentTitleAr: existing.titleAr,
        resolveMessageEn: dto.messageEn,
        resolveMessageAr: dto.messageAr,
        strategy,
        actorId: userId,
      });
    }

    // End-user audience: fire the in-app + email fan-out on every
    // update (caller can opt out via notifyAudience=false). Banner
    // refresh happens client-side without any extra signal.
    if (
      existing.audience === 'end_users' &&
      (dto.notifyAudience ?? true) &&
      existing.affectedRoles.length > 0
    ) {
      this.notifyAudience(incidentId, {
        titleEn: existing.titleEn,
        titleAr: existing.titleAr,
        messageEn: dto.messageEn,
        messageAr: dto.messageAr,
        affectedRoles: existing.affectedRoles as IncidentAffectedRole[],
        kind: isResolving ? 'resolved' : 'update',
      }).catch((e) =>
        this.logger.error(
          `Incident ${incidentId} audience notify failed`,
          e,
        ),
      );
    }

    return { success: true };
  }

  async deleteIncident(incidentId: string) {
    const [existing] = await db
      .select({ id: serviceStatusIncidents.id })
      .from(serviceStatusIncidents)
      .where(eq(serviceStatusIncidents.id, incidentId));
    if (!existing) throw new NotFoundException('Incident not found');

    // Updates + ticket-incident links cascade via FK.
    await db
      .delete(serviceStatusIncidents)
      .where(eq(serviceStatusIncidents.id, incidentId));

    return { success: true };
  }

  // ─── Admin: post-mortem report ────────────────────────────────

  async updateIncidentReport(
    incidentId: string,
    dto: UpdateIncidentReportDto,
  ) {
    const [existing] = await db
      .select({ id: serviceStatusIncidents.id })
      .from(serviceStatusIncidents)
      .where(eq(serviceStatusIncidents.id, incidentId));
    if (!existing) throw new NotFoundException('Incident not found');

    await db
      .update(serviceStatusIncidents)
      .set({
        rootCause: dto.rootCause ?? null,
        correctiveActions: dto.correctiveActions ?? null,
      })
      .where(eq(serviceStatusIncidents.id, incidentId));

    return { success: true };
  }

  /**
   * Returns the incident with linked tickets + unique-requester count
   * for the post-mortem panel + PDF export.
   */
  async getIncidentReport(incidentId: string) {
    const [incident] = await db
      .select()
      .from(serviceStatusIncidents)
      .where(eq(serviceStatusIncidents.id, incidentId));
    if (!incident) throw new NotFoundException('Incident not found');

    const [updates, linkedTickets] = await Promise.all([
      db
        .select()
        .from(serviceStatusIncidentUpdates)
        .where(eq(serviceStatusIncidentUpdates.incidentId, incidentId))
        .orderBy(asc(serviceStatusIncidentUpdates.postedAt)),
      db
        .select({
          ticketId: tickets.id,
          referenceNumber: tickets.referenceNumber,
          subject: tickets.subject,
          status: tickets.status,
          priority: tickets.priority,
          studentId: tickets.studentId,
          linkedAt: ticketIncidents.linkedAt,
          studentFirstName: users.firstName,
          studentLastName: users.lastName,
          studentEmail: users.email,
        })
        .from(ticketIncidents)
        .innerJoin(tickets, eq(tickets.id, ticketIncidents.ticketId))
        .leftJoin(users, eq(users.id, tickets.studentId))
        .where(eq(ticketIncidents.incidentId, incidentId))
        .orderBy(desc(ticketIncidents.linkedAt)),
    ]);

    const uniqueRequesters = new Set(
      linkedTickets.map((t) => t.studentId).filter(Boolean),
    );

    return {
      incident,
      updates,
      linkedTickets,
      affectedUsersCount: uniqueRequesters.size,
    };
  }

  // ─── Admin: ticket ↔ incident link ────────────────────────────

  async linkTicket(incidentId: string, ticketId: string, userId: string) {
    const [[incident], [ticket]] = await Promise.all([
      db
        .select({ id: serviceStatusIncidents.id })
        .from(serviceStatusIncidents)
        .where(eq(serviceStatusIncidents.id, incidentId)),
      db
        .select({ id: tickets.id })
        .from(tickets)
        .where(eq(tickets.id, ticketId)),
    ]);
    if (!incident) throw new NotFoundException('Incident not found');
    if (!ticket) throw new NotFoundException('Ticket not found');

    // ON CONFLICT DO NOTHING — re-linking is idempotent so the FE
    // can call this without checking first.
    await db
      .insert(ticketIncidents)
      .values({
        incidentId,
        ticketId,
        linkedBy: userId,
      })
      .onConflictDoNothing({
        target: [ticketIncidents.ticketId, ticketIncidents.incidentId],
      });

    return { success: true };
  }

  async unlinkTicket(incidentId: string, ticketId: string) {
    await db
      .delete(ticketIncidents)
      .where(
        and(
          eq(ticketIncidents.incidentId, incidentId),
          eq(ticketIncidents.ticketId, ticketId),
        ),
      );
    return { success: true };
  }

  async listTicketsForIncident(incidentId: string) {
    return db
      .select({
        ticketId: tickets.id,
        referenceNumber: tickets.referenceNumber,
        subject: tickets.subject,
        status: tickets.status,
        priority: tickets.priority,
        studentId: tickets.studentId,
        linkedAt: ticketIncidents.linkedAt,
        studentFirstName: users.firstName,
        studentLastName: users.lastName,
      })
      .from(ticketIncidents)
      .innerJoin(tickets, eq(tickets.id, ticketIncidents.ticketId))
      .leftJoin(users, eq(users.id, tickets.studentId))
      .where(eq(ticketIncidents.incidentId, incidentId))
      .orderBy(desc(ticketIncidents.linkedAt));
  }

  async listIncidentsForTicket(ticketId: string) {
    return db
      .select({
        incidentId: serviceStatusIncidents.id,
        titleEn: serviceStatusIncidents.titleEn,
        titleAr: serviceStatusIncidents.titleAr,
        severity: serviceStatusIncidents.severity,
        currentStatus: serviceStatusIncidents.currentStatus,
        startedAt: serviceStatusIncidents.startedAt,
        resolvedAt: serviceStatusIncidents.resolvedAt,
        linkedAt: ticketIncidents.linkedAt,
      })
      .from(ticketIncidents)
      .innerJoin(
        serviceStatusIncidents,
        eq(serviceStatusIncidents.id, ticketIncidents.incidentId),
      )
      .where(eq(ticketIncidents.ticketId, ticketId))
      .orderBy(desc(ticketIncidents.linkedAt));
  }

  /**
   * Lightweight list of active incidents for the support agent's
   * "Link to incident" picker AND the Support Dashboard top bar.
   * Includes a linked-tickets count per incident so the bar can
   * read "Zoom outage — 12 linked tickets" without a second query.
   * Only active (unresolved) incidents are eligible — linking a
   * ticket to an already-resolved incident defeats the point.
   */
  async listActiveIncidentsForLinking() {
    const rows = await db
      .select({
        id: serviceStatusIncidents.id,
        titleEn: serviceStatusIncidents.titleEn,
        titleAr: serviceStatusIncidents.titleAr,
        severity: serviceStatusIncidents.severity,
        currentStatus: serviceStatusIncidents.currentStatus,
        audience: serviceStatusIncidents.audience,
        startedAt: serviceStatusIncidents.startedAt,
      })
      .from(serviceStatusIncidents)
      .where(isNull(serviceStatusIncidents.resolvedAt))
      .orderBy(desc(serviceStatusIncidents.startedAt))
      .limit(50);

    if (rows.length === 0) return [];

    const counts = await db
      .select({
        incidentId: ticketIncidents.incidentId,
        count: sql<number>`count(*)::int`,
      })
      .from(ticketIncidents)
      .where(
        inArray(
          ticketIncidents.incidentId,
          rows.map((r) => r.id),
        ),
      )
      .groupBy(ticketIncidents.incidentId);

    const countByIncident = new Map<string, number>(
      counts.map((c) => [c.incidentId, Number(c.count)]),
    );

    return rows.map((r) => ({
      ...r,
      linkedTicketsCount: countByIncident.get(r.id) ?? 0,
    }));
  }

  // ─── Internal helpers ─────────────────────────────────────────

  /**
   * Fan out the resolution to every ticket linked to this incident:
   * post a system reply so the requester sees the explanation, then
   * apply the admin-chosen status transition.
   *
   *   soft_resolve → ON_HOLD (admin keeps a checkpoint with the user)
   *   auto_close   → RESOLVED + resolvedAt now
   *   leave_open   → no transition (only the system reply lands)
   */
  private async applyResolutionStrategyToLinkedTickets(args: {
    incidentId: string;
    incidentTitleEn: string;
    incidentTitleAr: string | null;
    resolveMessageEn: string;
    resolveMessageAr: string | null | undefined;
    strategy: IncidentLinkedResolutionStrategy;
    actorId: string;
  }) {
    const linked = await db
      .select({ ticketId: ticketIncidents.ticketId })
      .from(ticketIncidents)
      .where(eq(ticketIncidents.incidentId, args.incidentId));

    if (linked.length === 0) return;
    const ticketIds = linked.map((l) => l.ticketId);
    const now = new Date();

    const messageEn = [
      `This ticket has been linked to a platform-wide incident: "${args.incidentTitleEn}".`,
      `Resolution: ${args.resolveMessageEn}`,
    ].join('\n\n');

    // Post one system reply per ticket. We do this serially in a
    // batch insert rather than per-ticket loops so the DB write is
    // a single round trip.
    await db.insert(ticketComments).values(
      ticketIds.map((ticketId) => ({
        ticketId,
        userId: args.actorId,
        message: messageEn,
        isStaffReply: true,
        isInternal: false,
        isSystem: true,
      })),
    );

    if (args.strategy === INCIDENT_LINKED_RESOLUTION_STRATEGY.AUTO_CLOSE) {
      await db
        .update(tickets)
        .set({
          status: TICKET_STATUS.RESOLVED,
          resolvedAt: now,
          updatedAt: now,
        })
        .where(inArray(tickets.id, ticketIds));
    } else if (
      args.strategy === INCIDENT_LINKED_RESOLUTION_STRATEGY.SOFT_RESOLVE
    ) {
      await db
        .update(tickets)
        .set({
          status: TICKET_STATUS.ON_HOLD,
          onHoldReason: ON_HOLD_REASONS.WAITING_FOR_STUDENT_RESPONSE,
          onHoldAt: now,
          updatedAt: now,
        })
        .where(inArray(tickets.id, ticketIds));
    }
    // leave_open: no transition, just the system reply.
  }

  // ─── Analytics ────────────────────────────────────────────────

  /**
   * Record a public status page view. Cookie-deduped against
   * recent views from the same session hash (30-min window) so a
   * refresh doesn't inflate counts.
   */
  async recordStatusView(opts: {
    incidentId?: string;
    ip?: string;
    sessionCookie?: string;
  }): Promise<void> {
    const ipHash = opts.ip
      ? createHash('sha256').update(opts.ip).digest('hex').slice(0, 64)
      : null;
    const sessionHash = opts.sessionCookie
      ? createHash('sha256')
          .update(opts.sessionCookie)
          .digest('hex')
          .slice(0, 64)
      : null;

    // Dedup: skip insert if same session hash logged a view in the
    // last 30 min for the same incident scope.
    if (sessionHash) {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60_000);
      const conditions: any[] = [
        eq(statusPageViewEvents.sessionHash, sessionHash),
        gte(statusPageViewEvents.viewedAt, thirtyMinAgo),
      ];
      if (opts.incidentId) {
        conditions.push(eq(statusPageViewEvents.incidentId, opts.incidentId));
      } else {
        conditions.push(isNull(statusPageViewEvents.incidentId));
      }
      const [recent] = await db
        .select({ id: statusPageViewEvents.id })
        .from(statusPageViewEvents)
        .where(and(...conditions))
        .limit(1);
      if (recent) return;
    }

    await db.insert(statusPageViewEvents).values({
      incidentId: opts.incidentId ?? null,
      ipHash,
      sessionHash,
    });
  }

  /**
   * Admin analytics rollup. Aggregates view counts, affected user
   * totals, resolution-time stats, and per-component breakdowns for
   * a configurable date range.
   */
  async getAnalytics(opts: { from?: Date; to?: Date }) {
    const from = opts.from ?? new Date(Date.now() - 30 * 24 * 60 * 60_000);
    const to = opts.to ?? new Date();

    const [
      viewRows,
      incidentsInRange,
    ] = await Promise.all([
      db
        .select({
          totalViews: sql<number>`count(*)::int`,
          uniqueSessions: sql<number>`count(distinct ${statusPageViewEvents.sessionHash})::int`,
        })
        .from(statusPageViewEvents)
        .where(
          and(
            gte(statusPageViewEvents.viewedAt, from),
            sql`${statusPageViewEvents.viewedAt} <= ${to}`,
          ),
        ),
      db
        .select()
        .from(serviceStatusIncidents)
        .where(
          and(
            gte(serviceStatusIncidents.startedAt, from),
            sql`${serviceStatusIncidents.startedAt} <= ${to}`,
          ),
        ),
    ]);

    // Resolved-in-range incidents — used for avg/median resolution
    // time + affected-user count (linked-ticket requesters).
    const resolved = incidentsInRange.filter((i) => i.resolvedAt !== null);
    let totalAffectedUsers = 0;
    if (resolved.length > 0) {
      const idsForAffected = resolved.map((r) => r.id);
      const affected = await db
        .selectDistinct({
          incidentId: ticketIncidents.incidentId,
          studentId: tickets.studentId,
        })
        .from(ticketIncidents)
        .innerJoin(tickets, eq(tickets.id, ticketIncidents.ticketId))
        .where(inArray(ticketIncidents.incidentId, idsForAffected));
      const uniqueStudents = new Set(
        affected.map((a) => a.studentId).filter(Boolean),
      );
      totalAffectedUsers = uniqueStudents.size;
    }

    const durationsMinutes = resolved
      .filter((i) => i.resolvedAt && i.startedAt)
      .map((i) =>
        Math.round((i.resolvedAt!.getTime() - i.startedAt.getTime()) / 60_000),
      )
      .sort((a, b) => a - b);
    const avgResolutionMinutes =
      durationsMinutes.length > 0
        ? Math.round(
            durationsMinutes.reduce((s, d) => s + d, 0) /
              durationsMinutes.length,
          )
        : 0;
    const medianResolutionMinutes =
      durationsMinutes.length > 0
        ? durationsMinutes[Math.floor(durationsMinutes.length / 2)]
        : 0;

    // Breakdown by severity.
    const bySeverity: Record<string, number> = {
      minor: 0,
      major: 0,
      critical: 0,
    };
    for (const i of incidentsInRange) {
      bySeverity[i.severity] = (bySeverity[i.severity] ?? 0) + 1;
    }

    // Breakdown by component (incidents that listed each component).
    const byComponent: Record<string, number> = {};
    for (const i of incidentsInRange) {
      for (const c of i.affectedComponents) {
        byComponent[c] = (byComponent[c] ?? 0) + 1;
      }
    }
    const topComponents = Object.entries(byComponent)
      .map(([component, count]) => ({ component, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Monthly buckets — YYYY-MM key → count by severity.
    const monthly: Record<
      string,
      { minor: number; major: number; critical: number; total: number }
    > = {};
    for (const i of incidentsInRange) {
      const d = i.startedAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthly[key])
        monthly[key] = { minor: 0, major: 0, critical: 0, total: 0 };
      const bucket = monthly[key];
      bucket[i.severity as 'minor' | 'major' | 'critical']++;
      bucket.total++;
    }
    const monthlyTrend = Object.entries(monthly)
      .map(([month, counts]) => ({ month, ...counts }))
      .sort((a, b) => (a.month < b.month ? -1 : 1));

    return {
      range: { from: from.toISOString(), to: to.toISOString() },
      views: {
        total: Number(viewRows[0]?.totalViews ?? 0),
        uniqueSessions: Number(viewRows[0]?.uniqueSessions ?? 0),
      },
      incidents: {
        total: incidentsInRange.length,
        resolved: resolved.length,
        bySeverity,
      },
      affectedUsersTotal: totalAffectedUsers,
      resolutionMinutes: {
        avg: avgResolutionMinutes,
        median: medianResolutionMinutes,
      },
      topComponents,
      monthlyTrend,
    };
  }

  /**
   * Tiny public-safe summary surfaced on the `/status` page footer
   * as a transparency stat. Last-30-days incident count + avg
   * resolution time. No view counts (those are admin-only).
   */
  async getPublicAnalyticsSummary() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60_000);
    const resolved = await db
      .select()
      .from(serviceStatusIncidents)
      .where(
        and(
          isNotNull(serviceStatusIncidents.resolvedAt),
          gte(serviceStatusIncidents.resolvedAt, thirtyDaysAgo),
        ),
      );
    const durations = resolved
      .filter((i) => i.resolvedAt && i.startedAt)
      .map((i) =>
        Math.round((i.resolvedAt!.getTime() - i.startedAt.getTime()) / 60_000),
      );
    const avg =
      durations.length > 0
        ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
        : 0;
    return {
      windowDays: 30,
      incidentCount: resolved.length,
      avgResolutionMinutes: avg,
    };
  }

  /**
   * Stream-friendly CSV export of incidents in a date range. Format
   * is plain ASCII CSV with a header row. Suitable for compliance
   * exports and offline review.
   */
  async exportIncidentsCsv(opts: { from?: Date; to?: Date }): Promise<string> {
    const from = opts.from ?? new Date(Date.now() - 90 * 24 * 60 * 60_000);
    const to = opts.to ?? new Date();

    const rows = await db
      .select()
      .from(serviceStatusIncidents)
      .where(
        and(
          gte(serviceStatusIncidents.startedAt, from),
          sql`${serviceStatusIncidents.startedAt} <= ${to}`,
        ),
      )
      .orderBy(desc(serviceStatusIncidents.startedAt));

    const linkedCounts = new Map<string, number>();
    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const counts = await db
        .select({
          incidentId: ticketIncidents.incidentId,
          count: sql<number>`count(*)::int`,
        })
        .from(ticketIncidents)
        .where(inArray(ticketIncidents.incidentId, ids))
        .groupBy(ticketIncidents.incidentId);
      counts.forEach((c) =>
        linkedCounts.set(c.incidentId, Number(c.count)),
      );
    }

    const headers = [
      'id',
      'title',
      'severity',
      'status',
      'audience',
      'started_at',
      'resolved_at',
      'duration_minutes',
      'affected_components',
      'affected_roles',
      'linked_tickets',
      'root_cause',
      'corrective_actions',
    ];

    const dataRows: (string | number | null)[][] = rows.map((r) => {
      const durationMin =
        r.resolvedAt && r.startedAt
          ? Math.round((r.resolvedAt.getTime() - r.startedAt.getTime()) / 60_000)
          : '';
      return [
        r.id,
        r.titleEn,
        r.severity,
        r.currentStatus,
        r.audience,
        r.startedAt.toISOString(),
        r.resolvedAt ? r.resolvedAt.toISOString() : '',
        durationMin,
        r.affectedComponents.join('|'),
        (r.affectedRoles || []).join('|'),
        linkedCounts.get(r.id) ?? 0,
        r.rootCause,
        r.correctiveActions,
      ];
    });

    return toCsvString(dataRows, { headers });
  }

  /**
   * Send in-app notifications + emails to every active user whose
   * primary role appears in `affectedRoles`. Best-effort — failures
   * to send any individual email are logged and swallowed so one bad
   * address doesn't stop the rest of the fan-out.
   */
  private async notifyAudience(
    incidentId: string,
    args: {
      titleEn: string;
      titleAr: string | null | undefined;
      messageEn: string;
      messageAr: string | null | undefined;
      affectedRoles: IncidentAffectedRole[];
      kind: 'new' | 'update' | 'resolved';
    },
  ) {
    if (args.affectedRoles.length === 0) return;

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
          inArray(roles.name, args.affectedRoles),
        ),
      );

    if (recipients.length === 0) {
      this.logger.log(
        `Incident ${incidentId}: no recipients for roles ${args.affectedRoles.join(',')}`,
      );
      return;
    }

    const subjectPrefix =
      args.kind === 'resolved'
        ? '[Resolved]'
        : args.kind === 'update'
          ? '[Update]'
          : '[Service notice]';
    const subject = `${subjectPrefix} ${args.titleEn}`;

    // In-app notification row per recipient — single insert.
    await db.insert(userNotifications).values(
      recipients.map((r) => ({
        recipientId: r.id,
        type: 'incident',
        title: args.titleEn,
        message: args.messageEn,
        link: '/status',
        entityType: 'service_status_incident',
        entityId: incidentId,
      })),
    );

    // Email fan-out — serial sends but caught individually so one
    // bad recipient doesn't kill the rest. EmailService already
    // handles "no API key configured" gracefully.
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
            message: args.messageEn,
          },
          'en',
        );
      } catch (e) {
        this.logger.warn(
          `Incident ${incidentId} email to ${r.email} failed: ${
            e instanceof Error ? e.message : 'unknown'
          }`,
        );
      }
    }
  }
}
