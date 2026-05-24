/**
 * Server-only helper for fetching the public general settings during
 * server component render — mirrors platform-locale-server.ts.
 */

import {
  EMPTY_PLATFORM_GENERAL,
  type PlatformGeneralSettings,
} from "./platform-general";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

export async function getPlatformGeneralSettings(): Promise<PlatformGeneralSettings> {
  try {
    const res = await fetch(`${API_URL}/public/general-settings`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return EMPTY_PLATFORM_GENERAL;
    const data = await res.json();
    return {
      platformName: data.platformName ?? null,
      platformNameAr: data.platformNameAr ?? null,
      contactEmail: data.contactEmail ?? null,
      supportPhone: data.supportPhone ?? null,
      timezone: data.timezone ?? null,
      whatsappNumber: data.whatsappNumber ?? null,
      whatsappCompanyName: data.whatsappCompanyName ?? null,
      whatsappGreeting: data.whatsappGreeting ?? null,
      whatsappReplyTime: data.whatsappReplyTime ?? null,
    };
  } catch {
    return EMPTY_PLATFORM_GENERAL;
  }
}
