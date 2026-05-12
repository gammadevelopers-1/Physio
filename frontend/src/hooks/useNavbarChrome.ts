"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import type { SiteSettings, NavigationLink } from "@/lib/strapi/types";

export interface NavbarChrome {
  siteSettings: SiteSettings | null;
  navLinks: NavigationLink[];
  footerLinks: {
    platform: NavigationLink[];
    organization: NavigationLink[];
    support: NavigationLink[];
  };
}

const EMPTY_CHROME: NavbarChrome = {
  siteSettings: null,
  navLinks: [],
  footerLinks: { platform: [], organization: [], support: [] },
};

/**
 * Client-side fetcher for the marketing navbar + footer chrome. Used by
 * pages that can't reach Strapi server-side (e.g. the `"use client"` auth
 * pages) but still need the same Strapi-driven nav links + site settings
 * as the marketing layout. Single network round-trip per locale.
 */
export function useNavbarChrome(): NavbarChrome {
  const locale = useLocale();
  const [chrome, setChrome] = useState<NavbarChrome>(EMPTY_CHROME);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/navbar-chrome?locale=${encodeURIComponent(locale)}`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: NavbarChrome | null) => {
        if (cancelled || !json) return;
        setChrome({
          siteSettings: json.siteSettings || null,
          navLinks: json.navLinks || [],
          footerLinks: {
            platform: json.footerLinks?.platform || [],
            organization: json.footerLinks?.organization || [],
            support: json.footerLinks?.support || [],
          },
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [locale]);

  return chrome;
}
