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
  DEFAULT_PLATFORM_LOCALE,
  type PlatformLocaleSettings,
} from "@/lib/platform-locale";

/**
 * Platform-wide locale settings sourced from /api/public/locale-settings.
 * Server components fetch the settings and pass them as `initial` so
 * the first render has the correct values. Client refreshes happen
 * after admin saves via refresh().
 */
interface PlatformLocaleContextValue extends PlatformLocaleSettings {
  ready: boolean;
  refresh: () => Promise<void>;
}

const PlatformLocaleContext = createContext<PlatformLocaleContextValue>({
  ...DEFAULT_PLATFORM_LOCALE,
  ready: false,
  refresh: async () => {},
});

interface ProviderProps {
  children: ReactNode;
  initial?: PlatformLocaleSettings;
}

export function PlatformLocaleProvider({ children, initial }: ProviderProps) {
  const [settings, setSettings] = useState<PlatformLocaleSettings>(
    initial ?? DEFAULT_PLATFORM_LOCALE,
  );
  const [ready, setReady] = useState(!!initial);

  const refresh = useCallback(async () => {
    try {
      const { publicSettingsApi } = await import("@/lib/api");
      const data = await publicSettingsApi.getLocaleSettings();
      setSettings({
        allowedLanguages: data.allowedLanguages?.length
          ? data.allowedLanguages
          : ["en", "ar"],
        defaultLanguage: data.defaultLanguage ?? "en",
        dateFormat: data.dateFormat ?? "DD-MM-YYYY",
        numberSystem: data.numberSystem ?? "western",
      });
    } catch {
      // Fail open — keep whatever we have. Worst case: defaults.
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    // Only fetch if no server-rendered initial was passed.
    if (!initial) {
      void refresh();
    }
  }, [initial, refresh]);

  return (
    <PlatformLocaleContext.Provider value={{ ...settings, ready, refresh }}>
      {children}
    </PlatformLocaleContext.Provider>
  );
}

export function usePlatformLocale() {
  return useContext(PlatformLocaleContext);
}
