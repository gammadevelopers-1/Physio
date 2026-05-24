"use client";

import { useTranslations } from "next-intl";
import { Languages, Info } from "lucide-react";
import Select from "../Select";
import { TabShell } from "./TabShell";
import { useSettingsCategory } from "./useSettingsCategory";
import { usePlatformLocale } from "@/contexts/PlatformLocaleContext";

interface LocalizationSettings extends Record<string, unknown> {
  defaultLanguage: "en" | "ar" | "auto";
  allowedLanguages: ("en" | "ar")[];
  dateFormat: "DD-MM-YYYY" | "MM-DD-YYYY" | "YYYY-MM-DD";
  numberSystem: "western" | "arabic_indic";
}

const FALLBACK: LocalizationSettings = {
  defaultLanguage: "en",
  allowedLanguages: ["en", "ar"],
  dateFormat: "DD-MM-YYYY",
  numberSystem: "western",
};

export default function LocalizationTab() {
  const t = useTranslations("adminDashboard.settingsPage");
  const platformLocale = usePlatformLocale();

  const { draft, setDraft, dirty, loading, saving, save, loadError } =
    useSettingsCategory<LocalizationSettings>("localization", FALLBACK, {
      saved: t("toasts.saved"),
      saveFailed: t("toasts.saveFailed"),
      loadFailed: t("toasts.loadFailed"),
    });

  const toggleLanguage = (lang: "en" | "ar") => {
    setDraft((d) => {
      const has = d.allowedLanguages.includes(lang);
      const next = has
        ? d.allowedLanguages.filter((l) => l !== lang)
        : [...d.allowedLanguages, lang];
      // Always keep at least one allowed language — otherwise users
      // get locked out. Default fallback is English.
      if (next.length === 0) return d;
      // If the user removes the language that's currently set as the
      // default, fall back to the first remaining one.
      const defaultLanguage =
        d.defaultLanguage !== "auto" && !next.includes(d.defaultLanguage as "en" | "ar")
          ? next[0]
          : d.defaultLanguage;
      return { ...d, allowedLanguages: next, defaultLanguage };
    });
  };

  const handleSave = async () => {
    await save();
    // Refresh the platform-wide context so navbars/middleware pick up
    // the new values without a hard reload.
    await platformLocale.refresh();
  };

  return (
    <TabShell
      title={t("localization.title")}
      description={t("localization.subtitle")}
      loading={loading}
      saving={saving}
      dirty={dirty}
      loadError={loadError}
      onSave={handleSave}
    >
      {/* Allowed languages */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)] mb-2">
          <Languages className="w-4 h-4" />
          {t("localization.allowedLanguages")}
        </label>
        <p className="text-xs text-[var(--color-text-secondary)] mb-3">
          {t("localization.allowedLanguagesHelp")}
        </p>
        <div className="flex flex-wrap gap-2">
          {([
            { code: "en" as const, label: "English" },
            { code: "ar" as const, label: "العربية" },
          ]).map((lang) => {
            const active = draft.allowedLanguages.includes(lang.code);
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => toggleLanguage(lang.code)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-colors ${
                  active
                    ? "border-[var(--color-primary)] bg-[var(--color-border-subtle)] text-[var(--color-primary)] font-medium"
                    : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-secondary)]"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    active
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)]"
                      : "border-[var(--color-border)]"
                  }`}
                >
                  {active && (
                    <svg
                      className="w-2.5 h-2.5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                {lang.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Default language */}
      <div>
        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
          {t("localization.defaultLanguage")}
        </label>
        <p className="text-xs text-[var(--color-text-secondary)] mb-3">
          {t("localization.defaultLanguageHelp")}
        </p>
        <Select
          value={draft.defaultLanguage}
          onChange={(v) =>
            setDraft((d) => ({
              ...d,
              defaultLanguage: v as LocalizationSettings["defaultLanguage"],
            }))
          }
          options={[
            ...(draft.allowedLanguages.includes("en")
              ? [{ value: "en", label: "English" }]
              : []),
            ...(draft.allowedLanguages.includes("ar")
              ? [{ value: "ar", label: "العربية" }]
              : []),
          ]}
          className="max-w-xs"
        />
      </div>

      {/* Regional formatting */}
      <div className="border border-[var(--color-border)] rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {t("localization.regionalFormatting")}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
              {t("localization.dateFormat")}
            </label>
            <Select
              value={draft.dateFormat}
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  dateFormat: v as LocalizationSettings["dateFormat"],
                }))
              }
              options={[
                { value: "DD-MM-YYYY", label: "DD-MM-YYYY (24-12-2026)" },
                { value: "MM-DD-YYYY", label: "MM-DD-YYYY (12-24-2026)" },
                { value: "YYYY-MM-DD", label: "YYYY-MM-DD (2026-12-24)" },
              ]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
              {t("localization.numberSystem")}
            </label>
            <Select
              value={draft.numberSystem}
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  numberSystem: v as LocalizationSettings["numberSystem"],
                }))
              }
              options={[
                { value: "western", label: t("localization.numWestern") + " (0123456789)" },
                { value: "arabic_indic", label: t("localization.numArabic") + " (٠١٢٣٤٥٦٧٨٩)" },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Notification templates hint */}
      <div className="flex items-start gap-3 p-3 bg-[var(--color-border-subtle)] border border-[var(--color-border)] rounded-lg">
        <Info className="w-4 h-4 text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
        <p className="text-xs text-[var(--color-text-secondary)]">
          {t("localization.templatesHint")}
        </p>
      </div>
    </TabShell>
  );
}
