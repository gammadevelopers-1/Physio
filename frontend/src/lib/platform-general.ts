/**
 * Shared shape for the admin-configured general settings that the
 * marketing site, navbars, and shared widgets read. Admin values take
 * priority — if a field is null/empty, callers should fall back to
 * Strapi (their existing source).
 */

export interface PlatformGeneralSettings {
  platformName: string | null;
  platformNameAr: string | null;
  contactEmail: string | null;
  supportPhone: string | null;
  timezone: string | null;
  whatsappNumber: string | null;
  whatsappCompanyName: string | null;
  whatsappGreeting: string | null;
  whatsappReplyTime: string | null;
}

export const EMPTY_PLATFORM_GENERAL: PlatformGeneralSettings = {
  platformName: null,
  platformNameAr: null,
  contactEmail: null,
  supportPhone: null,
  timezone: null,
  whatsappNumber: null,
  whatsappCompanyName: null,
  whatsappGreeting: null,
  whatsappReplyTime: null,
};

/** Returns the admin value when non-empty, otherwise the fallback. */
export function preferAdmin<T>(adminValue: T | null | undefined, fallback: T | null | undefined): T | null {
  if (adminValue === null || adminValue === undefined) return (fallback ?? null) as T | null;
  if (typeof adminValue === 'string' && adminValue.trim().length === 0) {
    return (fallback ?? null) as T | null;
  }
  return adminValue;
}
