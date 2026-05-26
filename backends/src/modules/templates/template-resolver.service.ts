import { Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { db } from '../../database';
import { notificationTemplates } from '../../database/schema';
import { findTemplateMeta } from './template-registry';

interface CachedRow {
  subject: string | null;
  preheader: string | null;
  body: string;
  enabled: boolean;
  fetchedAt: number;
}

interface ResolvedOverride {
  subject: string;
  html: string;
  preheader: string | null;
}

/**
 * Looks up admin-edited templates at send time, substitutes
 * `{{variable}}` placeholders with values from the params object,
 * and returns the rendered override. Returns null when no override
 * exists (or row is disabled) so the caller falls back to the
 * hardcoded template function.
 *
 * Has a tiny in-process cache (30s TTL) so the same template
 * lookup during a burst (e.g. session-reminder fan-out to 50
 * students) hits the DB once per locale.
 */
@Injectable()
export class TemplateResolverService {
  private readonly logger = new Logger(TemplateResolverService.name);
  private readonly cache = new Map<string, CachedRow | null>();
  private readonly TTL_MS = 30_000;

  private cacheKey(eventKey: string, locale: 'en' | 'ar'): string {
    return `${eventKey}::${locale}`;
  }

  private async fetchRow(
    eventKey: string,
    locale: 'en' | 'ar',
  ): Promise<CachedRow | null> {
    const meta = findTemplateMeta(eventKey);
    if (!meta) return null;
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
    if (!row) return null;
    return {
      subject: row.subject,
      preheader: row.preheader,
      body: row.body,
      enabled: row.enabled,
      fetchedAt: Date.now(),
    };
  }

  /**
   * Substitute every `{{key}}` occurrence in `input` with the
   * stringified value of `params[key]`. Unknown variables are left
   * intact so an admin typo shows up obviously in the email instead
   * of silently disappearing.
   */
  substitute(input: string, params: Record<string, unknown>): string {
    return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (full, key: string) => {
      if (Object.prototype.hasOwnProperty.call(params, key)) {
        const v = params[key];
        return v === null || v === undefined ? '' : String(v);
      }
      return full;
    });
  }

  /**
   * Try to resolve an admin-edited template. Returns null when no
   * override exists, the row is disabled, or the body is empty —
   * in which case the caller MUST fall back to its hardcoded
   * template function.
   *
   * Subject falls back to the registry's default if the admin left
   * it blank but the row exists (so we never send an empty Subject:).
   */
  async resolveEmail(
    eventKey: string,
    locale: 'en' | 'ar',
    params: Record<string, unknown>,
    fallbackSubject: string,
  ): Promise<ResolvedOverride | null> {
    const key = this.cacheKey(eventKey, locale);
    let cached = this.cache.get(key);
    // Treat null (cached "no override exists") as still valid until TTL;
    // refetch only when truly absent (undefined) or past TTL.
    if (cached === undefined) {
      cached = await this.fetchRow(eventKey, locale).catch(() => null);
      this.cache.set(key, cached);
    } else if (cached !== null && Date.now() - cached.fetchedAt >= this.TTL_MS) {
      cached = await this.fetchRow(eventKey, locale).catch(() => null);
      this.cache.set(key, cached);
    }
    if (!cached || !cached.enabled || !cached.body || !cached.body.trim()) {
      return null;
    }
    const subject = (cached.subject ?? fallbackSubject).trim();
    return {
      subject: this.substitute(subject || fallbackSubject, params),
      html: this.substitute(cached.body, params),
      preheader: cached.preheader
        ? this.substitute(cached.preheader, params)
        : null,
    };
  }

  /**
   * WhatsApp lookup — single body string. Returns substituted text
   * or null when no override.
   */
  async resolveWhatsapp(
    eventKey: string,
    locale: 'en' | 'ar',
    params: Record<string, unknown>,
  ): Promise<string | null> {
    const key = this.cacheKey(eventKey, locale);
    let cached = this.cache.get(key);
    if (cached === undefined) {
      cached = await this.fetchRow(eventKey, locale).catch(() => null);
      this.cache.set(key, cached);
    } else if (cached !== null && Date.now() - cached.fetchedAt >= this.TTL_MS) {
      cached = await this.fetchRow(eventKey, locale).catch(() => null);
      this.cache.set(key, cached);
    }
    if (!cached || !cached.enabled || !cached.body || !cached.body.trim()) {
      return null;
    }
    return this.substitute(cached.body, params);
  }

  /** Invalidate the cache for one template — called from TemplatesService on write. */
  invalidate(eventKey: string, locale?: 'en' | 'ar'): void {
    if (locale) {
      this.cache.delete(this.cacheKey(eventKey, locale));
    } else {
      for (const k of Array.from(this.cache.keys())) {
        if (k.startsWith(`${eventKey}::`)) this.cache.delete(k);
      }
    }
  }
}
