"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { profileApi } from "@/lib/api";
import { usePreferences } from "@/hooks/usePreferences";
import { usePlatformLocale } from "@/contexts/PlatformLocaleContext";

/**
 * Inline language + calendar block, designed to be folded into the Profile
 * tab (rather than a separate Preferences tab). Saves immediately on click —
 * no separate Save button. Switching interface language also writes to
 * users.language so the backend picks up the same locale for outbound emails.
 */
export default function PreferencesInline() {
  const tCommon = useTranslations("commonSettings");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const router = useRouter();
  const pathname = usePathname();
  const { preferences, loading, updateUi } = usePreferences();
  const { allowedLanguages } = usePlatformLocale();

  const switchLocale = (newLocale: string) => {
    if (newLocale === locale) return;
    profileApi.update({ language: newLocale }).catch(() => {});
    const segments = pathname.split("/");
    segments[1] = newLocale;
    router.push(segments.join("/"));
  };

  if (loading) {
    return (
      <div className="pt-4 border-t border-[var(--color-border)] flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-secondary)]" />
      </div>
    );
  }

  return (
    <div
      className="space-y-4 pt-4 border-t border-[var(--color-border)]"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
        {tCommon("languageSettings")}
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Interface language */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {tCommon("interfaceLanguage")}
          </label>
          <div className="inline-flex bg-[var(--color-border-subtle)] rounded-lg p-1">
            {allowedLanguages.includes("en") && (
              <button
                type="button"
                onClick={() => switchLocale("en")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  locale === "en"
                    ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                    : "text-[var(--color-text-secondary)]"
                }`}
              >
                English
              </button>
            )}
            {allowedLanguages.includes("ar") && (
              <button
                type="button"
                onClick={() => switchLocale("ar")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  locale === "ar"
                    ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                    : "text-[var(--color-text-secondary)]"
                }`}
              >
                العربية
              </button>
            )}
          </div>
        </div>

        {/* Calendar format — display default for static dates across the
            dashboard. Per-picker / per-calendar toggles override locally. */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {tCommon("calendarType")}
          </label>
          <div className="inline-flex bg-[var(--color-border-subtle)] rounded-lg p-1">
            {(["gregorian", "hijri"] as const).map((opt) => {
              // Legacy "both" rows render as Gregorian-selected so the toggle
              // doesn't appear blank for those users.
              const isSelected =
                preferences.calendarFormat === opt ||
                (opt === "gregorian" && preferences.calendarFormat === "both");
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => updateUi({ calendarFormat: opt })}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isSelected
                      ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                      : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  {tCommon(opt)}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
