import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { db } from '../../database';
import { notificationTemplates } from '../../database/schema';
import { findTemplateMeta, TEMPLATE_REGISTRY, type TemplateMeta } from './template-registry';
import { TemplateResolverService } from './template-resolver.service';
import { renderDefaultEmailBody } from './template-defaults';
import { EmailService } from '../email/email.service';

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
  constructor(
    private readonly resolver: TemplateResolverService,
    private readonly emailService: EmailService,
  ) {}

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

    // No admin override yet — render the default email body with
    // `{{variable}}` placeholders so the admin opens the editor and
    // sees the actual branded markup the platform would send, not a
    // blank canvas. WhatsApp templates (no email renderer) stay
    // empty here; the WhatsApp editor handles its own defaults.
    const defaultBody =
      meta.channel === 'email' ? renderDefaultEmailBody(meta.eventKey, locale) : '';

    return {
      meta,
      locale,
      subject:
        (locale === 'ar' ? meta.defaultSubjectAr : meta.defaultSubjectEn) ?? null,
      preheader: null,
      body: defaultBody,
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

  /**
   * Send a test rendering of one template to `toEmail` using the
   * variable examples from the registry as substitution values.
   *
   * The rendered output ALWAYS goes through the same resolver +
   * dispatcher path as production email, so what the admin sees in
   * their inbox is byte-identical to what a real recipient would
   * receive (aside from a `[TEST]` subject prefix). This closes the
   * "am I actually editing the real template?" trust gap.
   *
   * WhatsApp templates are not testable this way (would need a real
   * phone integration); the endpoint throws BadRequest for them.
   */
  async sendTest(
    eventKey: string,
    locale: 'en' | 'ar',
    toEmail: string,
  ): Promise<{ ok: true; to: string; usedOverride: boolean }> {
    const meta = findTemplateMeta(eventKey);
    if (!meta) throw new NotFoundException(`Unknown template: ${eventKey}`);
    if (meta.channel !== 'email') {
      throw new BadRequestException(
        'Test send is only supported for email templates',
      );
    }
    if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
      throw new BadRequestException('Invalid recipient email');
    }

    // Substitution params come from the registry's declared example
    // values — one per variable. Admin sees a realistic-looking
    // rendering instead of raw `{{studentName}}` tokens.
    const params: Record<string, string> = {};
    for (const v of meta.variables) params[v.key] = v.example;

    const fallbackSubject =
      (locale === 'ar' ? meta.defaultSubjectAr : meta.defaultSubjectEn) ||
      meta.nameEn;

    const resolved = await this.resolver.resolveEmail(
      eventKey,
      locale,
      params,
      fallbackSubject,
    );

    // No admin override yet — render the built-in default body so the
    // test still reflects the CURRENT production output for this event.
    // renderDefaultEmailBody returns "" for events that don't yet have
    // a shared default renderer registered; in that case we surface a
    // clear message rather than an empty inbox so admin isn't confused.
    let html = resolved?.html || renderDefaultEmailBody(eventKey, locale);
    if (!html) {
      html = `<!doctype html><html ${locale === 'ar' ? 'lang="ar" dir="rtl"' : 'lang="en" dir="ltr"'}><body style="font-family:Arial,sans-serif;padding:24px;color:#111;"><h2>${meta.nameEn}</h2><p><em>No shared default renderer is registered for this event. Save an override in the editor first, then click Send test again to preview it.</em></p></body></html>`;
    }
    const subject = resolved?.subject || fallbackSubject;
    const preheader = resolved?.preheader ?? '';

    await this.emailService.sendTestRendering({
      to: toEmail,
      subject: `[TEST] ${subject}`,
      html,
      text: `${preheader ? preheader + '\n\n' : ''}This is a TEST rendering of the "${meta.nameEn}" template. Real recipients receive the fully-styled HTML version.`,
    });

    return { ok: true, to: toEmail, usedOverride: !!resolved };
  }
}
