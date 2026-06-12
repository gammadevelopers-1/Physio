import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { and, asc, desc, eq, gte, isNull, isNotNull } from 'drizzle-orm';
import { db } from '../../database';
import {
  serviceStatusComponents,
  serviceStatusIncidents,
  serviceStatusIncidentUpdates,
} from '../../database/schema';
import type {
  UpdateComponentStatusDto,
  CreateIncidentDto,
  PostIncidentUpdateDto,
} from './dto';

@Injectable()
export class ServiceStatusService {
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

    const updates = await db
      .select()
      .from(serviceStatusIncidentUpdates)
      .orderBy(desc(serviceStatusIncidentUpdates.postedAt));

    const byIncident = new Map<string, any[]>();
    for (const u of updates) {
      const arr = byIncident.get(u.incidentId) ?? [];
      arr.push(u);
      byIncident.set(u.incidentId, arr);
    }

    return incidents.map((i) => ({ ...i, updates: byIncident.get(i.id) ?? [] }));
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

    const now = new Date();
    const [incident] = await db
      .insert(serviceStatusIncidents)
      .values({
        titleEn: dto.titleEn,
        titleAr: dto.titleAr ?? null,
        affectedComponents: dto.affectedComponents,
        currentStatus: dto.initialStatus,
        severity: dto.severity,
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

    return incident;
  }

  async postIncidentUpdate(
    incidentId: string,
    userId: string,
    dto: PostIncidentUpdateDto,
  ) {
    const [existing] = await db
      .select({ id: serviceStatusIncidents.id })
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

    // Mirror the latest status onto the incident itself so list
    // queries don't need to join the updates table just to know
    // where things stand.
    await db
      .update(serviceStatusIncidents)
      .set({
        currentStatus: dto.status,
        resolvedAt: dto.status === 'resolved' ? now : null,
      })
      .where(eq(serviceStatusIncidents.id, incidentId));

    return { success: true };
  }

  async deleteIncident(incidentId: string) {
    const [existing] = await db
      .select({ id: serviceStatusIncidents.id })
      .from(serviceStatusIncidents)
      .where(eq(serviceStatusIncidents.id, incidentId));
    if (!existing) throw new NotFoundException('Incident not found');

    // Updates cascade via FK.
    await db
      .delete(serviceStatusIncidents)
      .where(eq(serviceStatusIncidents.id, incidentId));

    return { success: true };
  }
}
