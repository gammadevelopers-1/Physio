"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  EMPTY_PLATFORM_GENERAL,
  type PlatformGeneralSettings,
} from "@/lib/platform-general";

/**
 * Admin-configured general settings sourced from
 * /api/public/general-settings. Marketing site, navbars, and shared
 * widgets read these values and fall back to Strapi when null.
 */
interface PlatformGeneralContextValue extends PlatformGeneralSettings {
  ready: boolean;
  refresh: () => Promise<void>;
}

const PlatformGeneralContext = createContext<PlatformGeneralContextValue>({
  ...EMPTY_PLATFORM_GENERAL,
  ready: false,
  refresh: async () => {},
});

interface ProviderProps {
  children: ReactNode;
  initial?: PlatformGeneralSettings;
}

export function PlatformGeneralProvider({ children, initial }: ProviderProps) {
  const [settings, setSettings] = useState<PlatformGeneralSettings>(
    initial ?? EMPTY_PLATFORM_GENERAL,
  );
  const [ready, setReady] = useState(!!initial);

  const refresh = useCallback(async () => {
    try {
      const { publicSettingsApi } = await import("@/lib/api");
      const data = await publicSettingsApi.getGeneralSettings();
      setSettings({
        platformName: data.platformName ?? null,
        platformNameAr: data.platformNameAr ?? null,
        contactEmail: data.contactEmail ?? null,
        supportPhone: data.supportPhone ?? null,
        timezone: data.timezone ?? null,
        whatsappNumber: data.whatsappNumber ?? null,
        whatsappCompanyName: data.whatsappCompanyName ?? null,
        whatsappGreeting: data.whatsappGreeting ?? null,
        whatsappReplyTime: data.whatsappReplyTime ?? null,
      });
    } catch {
      // Keep last-known values on failure; consumers fall through to Strapi.
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!initial) {
      void refresh();
    }
  }, [initial, refresh]);

  return (
    <PlatformGeneralContext.Provider value={{ ...settings, ready, refresh }}>
      {children}
    </PlatformGeneralContext.Provider>
  );
}

export function usePlatformGeneral() {
  return useContext(PlatformGeneralContext);
}
