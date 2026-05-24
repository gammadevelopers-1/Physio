import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { db } from '../../database';
import { notificationTemplates } from '../../database/schema';
import { findTemplateMeta, TEMPLATE_REGISTRY, type TemplateMeta } from './template-registry';
import { TemplateResolverService } from './template-resolver.service';

export interface TemplateListItem extends TemplateMeta {
  /** Has an admin-edited row in DB for either locale? */
  edited: boolean;
  /** Most-recent updatedAt across all locales for this event. */
  lastUpdatedAt: string | null;
  enabled: boolean;
}

/**
 * Per-locale template payload. `body` holds the HTML for emails, or
 * the plain-text WhatsApp message body. `designJson` is the Unlayer
 * design tree (email only); null for WhatsApp and for legacy rows.
 */
export interface TemplateDetail {
  meta: TemplateMeta;
  locale: 'en' | 'ar';
  subject: string | null;
  preheader: string | null;
  body: string;
  designJson: unknown | null;
  enabled: boolean;
  hasOverride: boolean;
  updatedAt: string | null;
}

@Injectable()
export class TemplatesService {
  constructor(private readonly resolver: TemplateResolverService) {}

  /** List every registered template with a per-event "edited?" flag. */
  async list(): Promise<TemplateListItem[]> {
    const allRows = await db.select().from(notificationTemplates);
    return TEMPLATE_REGISTRY.map((meta) => {
      const rows = allRows.filter((r) => r.eventKey === meta.eventKey);
      if (!rows.length) {
        return { ...meta, edited: false, lastUpdatedAt: null, enabled: true };
      }
      const lastUpdated = rows.reduce<Date>(
        (acc, r) => (r.updatedAt > acc ? r.updatedAt : acc),
        rows[0].updatedAt,
      );
      const enabled = rows.every((r) => r.enabled);
      return {
        ...meta,
        edited: true,
        lastUpdatedAt: lastUpdated.toISOString(),
        enabled,
      };
    });
  }

  /** Get one template for one locale (empty defaults if no DB row). */
  async get(eventKey: string, locale: 'en' | 'ar'): Promise<TemplateDetail> {
    const meta = findTemplateMeta(eventKey);
    if (!meta) throw new NotFoundException(`Unknown template: ${eventKey}`);

    const [row] = await db
      .select()
      .from(notificationTemplates)
      .where(
        and(
          eq(notificationTemplates.eventKey, eventKey),
          eq(notificationTemplates.channel, meta.channel),
          eq(notificationTemplates.locale, locale),
        ),
      )
      .limit(1);

    if (row) {
      return {
        meta,
        locale,
        subject: row.subject ?? null,
        preheader: row.preheader ?? null,
        body: row.body,
        designJson: row.designJson ?? null,
        enabled: row.enabled,
        hasOverride: true,
        updatedAt: row.updatedAt.toISOString(),
      };
    }

    return {
      meta,
      locale,
      subject:
        (locale === 'ar' ? meta.defaultSubjectAr : meta.defaultSubjectEn) ?? null,
      preheader: null,
      body: '',
      designJson: null,
      enabled: true,
      hasOverride: false,
      updatedAt: null,
    };
  }

  /** Upsert the per-locale template row. */
  async upsert(
    eventKey: string,
    locale: 'en' | 'ar',
    data: {
      subject?: string | null;
      preheader?: string | null;
      body: string;
      designJson?: unknown | null;
      enabled?: boolean;
    },
    actorId: string,
  ): Promise<TemplateDetail> {
    const meta = findTemplateMeta(eventKey);
    if (!meta) throw new NotFoundException(`Unknown template: ${eventKey}`);

    const [existing] = await db
      .select()
      .from(notificationTemplates)
      .where(
        and(
          eq(notificationTemplates.eventKey, eventKey),
          eq(notificationTemplates.channel, meta.channel),
          eq(notificationTemplates.locale, locale),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(notificationTemplates)
        .set({
          subject: data.subject ?? null,
          preheader: data.preheader ?? null,
          body: data.body,
          designJson: (data.designJson ?? null) as object | null,
          enabled: data.enabled ?? existing.enabled,
          updatedAt: new Date(),
        })
        .where(eq(notificationTemplates.id, existing.id));
    } else {
      await db.insert(notificationTemplates).values({
        eventKey,
        channel: meta.channel,
        locale,
        subject: data.subject ?? null,
        preheader: data.preheader ?? null,
        body: data.body,
        designJson: (data.designJson ?? null) as object | null,
        enabled: data.enabled ?? true,
        createdBy: actorId,
      });
    }

    // Invalidate the resolver cache so the next send picks up the change
    // immediately instead of waiting up to 30 seconds.
    this.resolver.invalidate(eventKey, locale);
    return this.get(eventKey, locale);
  }

  /** Delete the override; the dispatcher will fall back to the hardcoded default. */
  async reset(eventKey: string, locale: 'en' | 'ar'): Promise<void> {
    const meta = findTemplateMeta(eventKey);
    if (!meta) throw new NotFoundException(`Unknown template: ${eventKey}`);
    await db
      .delete(notificationTemplates)
      .where(
        and(
          eq(notificationTemplates.eventKey, eventKey),
          eq(notificationTemplates.channel, meta.channel),
          eq(notificationTemplates.locale, locale),
        ),
      );
    this.resolver.invalidate(eventKey, locale);
  }
}
