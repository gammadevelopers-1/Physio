/**
 * Server-only helper for fetching the public locale settings during
 * server component render. Keeps the fetch off the client critical
 * path and avoids a flash of default values on first render.
 */

import {
  DEFAULT_PLATFORM_LOCALE,
  type PlatformLocaleSettings,
} from "./platform-locale";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

export async function getPlatformLocaleSettings(): Promise<PlatformLocaleSettings> {
  try {
    const res = await fetch(`${API_URL}/public/locale-settings`, {
      // Cache for 60s — admin changes still propagate within a minute,
      // and saving the LocalizationTab triggers an explicit refresh
      // through the provider.
      next: { revalidate: 60 },
    });
    if (!res.ok) return DEFAULT_PLATFORM_LOCALE;
    const data = await res.json();
    return {
      allowedLanguages: data.allowedLanguages?.length
        ? data.allowedLanguages
        : ["en", "ar"],
      defaultLanguage: data.defaultLanguage ?? "en",
      dateFormat: data.dateFormat ?? "DD-MM-YYYY",
      numberSystem: data.numberSystem ?? "western",
    };
  } catch {
    return DEFAULT_PLATFORM_LOCALE;
  }
}
