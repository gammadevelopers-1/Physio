"use client";

import { useCallback } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "next/navigation";

/**
 * Shared locale toggle used by every navbar.
 * - Triggers the full-screen overlay + top progress bar so users don't see
 *   the RTL/LTR flip flash.
 * - Optionally persists the preference on the user's profile.
 */
export function useLocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const switchLocale = useCallback(
    async (opts: { persist?: boolean } = {}) => {
      const newLocale = locale === "en" ? "ar" : "en";
      const pathWithoutLocale = pathname.replace(`/${locale}`, "") || "/";

      const w = window as unknown as {
        __showLocaleSwitchOverlay?: () => void;
        __navProgressStart?: () => void;
      };
      w.__showLocaleSwitchOverlay?.();
      w.__navProgressStart?.();

      if (opts.persist) {
        try {
          const { profileApi } = await import("@/lib/api");
          await profileApi.update({ language: newLocale });
        } catch {
          /* non-fatal */
        }
      }

      router.push(`/${newLocale}${pathWithoutLocale}`);
    },
    [locale, pathname, router],
  );

  return { locale, switchLocale };
}
