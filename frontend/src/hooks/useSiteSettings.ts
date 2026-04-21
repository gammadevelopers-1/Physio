"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import type { SiteSettings } from "@/lib/strapi/types";

// Module-scope cache so multiple navbars on the same page don't refetch
const cache: Record<string, SiteSettings | null> = {};
const inFlight: Record<string, Promise<SiteSettings | null> | undefined> = {};

async function fetchSiteSettings(locale: string): Promise<SiteSettings | null> {
  if (cache[locale] !== undefined) return cache[locale];
  if (inFlight[locale]) return inFlight[locale]!;

  inFlight[locale] = (async () => {
    try {
      const res = await fetch(`/api/site-settings?locale=${locale}`, {
        cache: "no-store",
      });
      if (!res.ok) return null;
      const json = await res.json();
      const data = (json?.data ?? null) as SiteSettings | null;
      cache[locale] = data;
      return data;
    } catch {
      return null;
    } finally {
      delete inFlight[locale];
    }
  })();

  return inFlight[locale]!;
}

/**
 * Client hook: fetches global site settings (logo, feature toggles, etc.)
 * from Strapi via the /api/site-settings proxy. Cached per locale in module
 * scope so every navbar on the page shares one fetch.
 */
export function useSiteSettings(): {
  settings: SiteSettings | null;
  loaded: boolean;
} {
  const locale = useLocale();
  const [settings, setSettings] = useState<SiteSettings | null>(
    cache[locale] ?? null,
  );
  const [loaded, setLoaded] = useState<boolean>(cache[locale] !== undefined);

  useEffect(() => {
    if (cache[locale] !== undefined) {
      setSettings(cache[locale]);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    fetchSiteSettings(locale).then((data) => {
      if (cancelled) return;
      setSettings(data);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  return { settings, loaded };
}
