import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { db } from '../../database';
import {
  systemSettings,
  notificationTemplates,
  type SystemSetting,
} from '../../database/schema';

/**
 * Single source of truth for platform-wide settings + admin-editable
 * notification templates.
 *
 * Reads / writes the `system_settings` table (one row per category)
 * and the `notification_templates` table. JSONB shape per category is
 * loose by design — UI submits whatever it cares about, we replace
 * the row's `value` column wholesale.
 *
 * A small in-process cache keeps hot reads cheap; it invalidates on
 * every write. Cache TTL is short (30s) so a write from another
 * instance still propagates within a normal request lifetime.
 */
@Injectable()
export class AdminSettingsService {
  private cache: Map<string, { value: unknown; expiresAt: number }> = new Map();
  private readonly CACHE_TTL_MS = 30_000;

  /** Read one category's JSONB value. Returns {} if the row doesn't exist. */
  async getCategory<T = Record<string, unknown>>(category: string): Promise<T> {
    const cached = this.cache.get(category);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }

    const rows = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.category, category))
      .limit(1);

    const value = (rows[0]?.value ?? {}) as T;
    this.cache.set(category, {
      value,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });
    return value;
  }

  /** Replace a category's JSONB value wholesale. */
  async updateCategory(
    category: string,
    value: Record<string, unknown>,
    actorId: string,
  ): Promise<SystemSetting> {
    const [row] = await db
      .insert(systemSettings)
      .values({
        category,
        value,
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemSettings.category,
        set: {
          value,
          updatedBy: actorId,
          updatedAt: new Date(),
        },
      })
      .returning();

    this.cache.delete(category);
    return row;
  }

  /** Read every category (for the admin Settings page bootstrap). */
  async getAll(): Promise<Record<string, unknown>> {
    const rows = await db.select().from(systemSettings);
    const out: Record<string, unknown> = {};
    for (const row of rows) {
      out[row.category] = row.value;
    }
    return out;
  }

  // ─── Notification templates ──────────────────────────────────────

  async listTemplates() {
    return db.select().from(notificationTemplates).orderBy(notificationTemplates.eventKey);
  }

  async getTemplate(id: string) {
    const [row] = await db
      .select()
      .from(notificationTemplates)
      .where(eq(notificationTemplates.id, id))
      .limit(1);
    if (!row) throw new NotFoundException('Template not found');
    return row;
  }

  async createTemplate(
    data: {
      eventKey: string;
      channel: string;
      locale: string;
      subject?: string;
      body: string;
      enabled?: boolean;
    },
    actorId: string,
  ) {
    const [row] = await db
      .insert(notificationTemplates)
      .values({
        eventKey: data.eventKey,
        channel: data.channel,
        locale: data.locale,
        subject: data.subject ?? null,
        body: data.body,
        enabled: data.enabled ?? true,
        createdBy: actorId,
      })
      .returning();
    return row;
  }

  async updateTemplate(
    id: string,
    data: {
      subject?: string | null;
      body?: string;
      enabled?: boolean;
    },
  ) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.subject !== undefined) updates.subject = data.subject;
    if (data.body !== undefined) updates.body = data.body;
    if (data.enabled !== undefined) updates.enabled = data.enabled;

    const [row] = await db
      .update(notificationTemplates)
      .set(updates)
      .where(eq(notificationTemplates.id, id))
      .returning();
    if (!row) throw new NotFoundException('Template not found');
    return row;
  }

  async deleteTemplate(id: string) {
    await db
      .delete(notificationTemplates)
      .where(eq(notificationTemplates.id, id));
  }

  /**
   * Public general-settings projection — fields the marketing site
   * and shared widgets read so admin choices win over Strapi when
   * set. Strict allowlist; never leaks anything else from the
   * general row.
   */
  async getPublicGeneralSettings(): Promise<{
    platformName: string | null;
    platformNameAr: string | null;
    contactEmail: string | null;
    supportPhone: string | null;
    timezone: string | null;
    whatsappNumber: string | null;
    whatsappCompanyName: string | null;
    whatsappGreeting: string | null;
    whatsappReplyTime: string | null;
  }> {
    const raw = await this.getCategory<{
      platformName?: string;
      platformNameAr?: string;
      contactEmail?: string;
      supportPhone?: string;
      timezone?: string;
      whatsappNumber?: string;
      whatsappCompanyName?: string;
      whatsappGreeting?: string;
      whatsappReplyTime?: string;
    }>('general');
    // Treat empty strings as "not set" so marketing falls through to
    // Strapi defaults instead of showing a blank field.
    const clean = (v: string | undefined) =>
      v && v.trim().length > 0 ? v.trim() : null;
    return {
      platformName: clean(raw.platformName),
      platformNameAr: clean(raw.platformNameAr),
      contactEmail: clean(raw.contactEmail),
      supportPhone: clean(raw.supportPhone),
      timezone: clean(raw.timezone),
      whatsappNumber: clean(raw.whatsappNumber),
      whatsappCompanyName: clean(raw.whatsappCompanyName),
      whatsappGreeting: clean(raw.whatsappGreeting),
      whatsappReplyTime: clean(raw.whatsappReplyTime),
    };
  }

  /**
   * Public channel-status projection — flags the frontend share
   * helpers use to know whether WhatsApp share is enabled. Email
   * gate runs server-side inside EmailService so it isn't exposed
   * here.
   */
  async getPublicNotificationChannels(): Promise<{
    email: boolean;
    whatsapp: boolean;
  }> {
    const raw = await this.getCategory<{
      channels?: { email?: boolean; whatsapp?: boolean };
    }>('notifications');
    return {
      email: raw.channels?.email !== false,
      whatsapp: raw.channels?.whatsapp !== false,
    };
  }

  /**
   * Public locale-settings projection — what unauthenticated callers
   * (marketing pages, middleware) need to honor admin choices.
   * Strictly the four fields actually wired across the platform; no
   * leakage of anything else from the localization row.
   */
  async getPublicLocaleSettings(): Promise<{
    allowedLanguages: ('en' | 'ar')[];
    defaultLanguage: 'en' | 'ar' | 'auto';
    dateFormat: 'DD-MM-YYYY' | 'MM-DD-YYYY' | 'YYYY-MM-DD';
    numberSystem: 'western' | 'arabic_indic';
  }> {
    const raw = await this.getCategory<{
      allowedLanguages?: ('en' | 'ar')[];
      defaultLanguage?: 'en' | 'ar' | 'auto';
      dateFormat?: 'DD-MM-YYYY' | 'MM-DD-YYYY' | 'YYYY-MM-DD';
      numberSystem?: 'western' | 'arabic_indic';
    }>('localization');
    const allowed = (raw.allowedLanguages ?? ['en', 'ar']).filter(
      (l) => l === 'en' || l === 'ar',
    );
    return {
      allowedLanguages: allowed.length ? allowed : ['en', 'ar'],
      defaultLanguage: raw.defaultLanguage ?? 'en',
      dateFormat: raw.dateFormat ?? 'DD-MM-YYYY',
      numberSystem: raw.numberSystem ?? 'western',
    };
  }

  /**
   * Authentication settings — JWT lifetimes, password policy, lockout
   * config. Consumed by AuthService at login / signup / token sign
   * time. Defaults match the previous hardcoded values so existing
   * behavior is preserved when nothing has been saved yet.
   */
  async getAuthSettings(): Promise<{
    sessionTimeoutMinutes: number;
    refreshTokenDays: number;
    passwordMinLength: number;
    passwordRequireUppercase: boolean;
    passwordRequireNumber: boolean;
    passwordRequireSpecial: boolean;
    lockoutAttempts: number;
    lockoutMinutes: number;
  }> {
    const raw = await this.getCategory<{
      sessionTimeoutMinutes?: number;
      refreshTokenDays?: number;
      passwordMinLength?: number;
      passwordRequireUppercase?: boolean;
      passwordRequireNumber?: boolean;
      passwordRequireSpecial?: boolean;
      lockoutAttempts?: number;
      lockoutMinutes?: number;
    }>('auth');
    return {
      sessionTimeoutMinutes:
        typeof raw.sessionTimeoutMinutes === 'number' && raw.sessionTimeoutMinutes > 0
          ? raw.sessionTimeoutMinutes
          : 15,
      refreshTokenDays:
        typeof raw.refreshTokenDays === 'number' && raw.refreshTokenDays > 0
          ? raw.refreshTokenDays
          : 7,
      passwordMinLength:
        typeof raw.passwordMinLength === 'number' && raw.passwordMinLength >= 6
          ? raw.passwordMinLength
          : 8,
      passwordRequireUppercase: !!raw.passwordRequireUppercase,
      passwordRequireNumber: !!raw.passwordRequireNumber,
      passwordRequireSpecial: !!raw.passwordRequireSpecial,
      lockoutAttempts:
        typeof raw.lockoutAttempts === 'number' && raw.lockoutAttempts > 0
          ? raw.lockoutAttempts
          : 5,
      lockoutMinutes:
        typeof raw.lockoutMinutes === 'number' && raw.lockoutMinutes > 0
          ? raw.lockoutMinutes
          : 15,
    };
  }

  /**
   * Public password policy — what signup / change-password forms read
   * so they can show requirements + pre-validate before submit.
   * Strict whitelist; never exposes lockout or token-lifetime config.
   */
  async getPublicPasswordPolicy(): Promise<{
    minLength: number;
    requireUppercase: boolean;
    requireNumber: boolean;
    requireSpecial: boolean;
  }> {
    const s = await this.getAuthSettings();
    return {
      minLength: s.passwordMinLength,
      requireUppercase: s.passwordRequireUppercase,
      requireNumber: s.passwordRequireNumber,
      requireSpecial: s.passwordRequireSpecial,
    };
  }

  /**
   * Cheap accessor used by the maintenance middleware. We don't go
   * through the cache here — the middleware runs on every request
   * and the cache itself enforces TTL.
   */
  async getMaintenanceStatus(): Promise<{
    enabled: boolean;
    messageEn: string;
    messageAr: string;
  }> {
    const value = await this.getCategory<{
      enabled?: boolean;
      messageEn?: string;
      messageAr?: string;
    }>('maintenance');
    return {
      enabled: !!value.enabled,
      messageEn: value.messageEn ?? 'Platform is under maintenance.',
      messageAr: value.messageAr ?? 'المنصة قيد الصيانة.',
    };
  }
}
