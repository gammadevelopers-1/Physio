"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { profileApi } from "@/lib/api";
import { usePreferences } from "@/hooks/usePreferences";

interface PreferencesSectionProps {
  /**
   * - "basic": language + calendar only (instructor / manager / TA / etc.)
   * - "full": adds accessibility + privacy controls (student or any role that wants them)
   */
  scope?: "basic" | "full";
}

export default function PreferencesSection({ scope = "basic" }: PreferencesSectionProps) {
  const t = useTranslations("commonSettings");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const router = useRouter();
  const pathname = usePathname();
  const { preferences, loading, updateUi } = usePreferences();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  const switchLocale = async (newLocale: string) => {
    if (newLocale === locale) return;
    // Persist to user profile so it sticks across devices.
    profileApi.update({ language: newLocale }).catch(() => {});
    const segments = pathname.split("/");
    segments[1] = newLocale;
    router.push(segments.join("/"));
  };

  const setCalendar = (value: string) => updateUi({ calendarFormat: value });

  return (
    <div className="space-y-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Language + Calendar */}
      <Card>
        <SectionHeading>{t("languageSettings")}</SectionHeading>

        <Row label={t("interfaceLanguage")}>
          <ButtonGroup
            options={[
              { value: "en", label: "English" },
              { value: "ar", label: "العربية" },
            ]}
            value={locale}
            onChange={switchLocale}
          />
        </Row>

        <Row label={t("calendarType")} description={t("calendarTypeDesc")}>
          <ButtonGroup
            options={[
              { value: "gregorian", label: t("gregorian") },
              { value: "hijri", label: t("hijri") },
            ]}
            value={
              preferences.calendarFormat === "both"
                ? "gregorian"
                : preferences.calendarFormat
            }
            onChange={setCalendar}
          />
        </Row>
      </Card>

      {scope === "full" && (
        <>
          {/* Accessibility */}
          <Card>
            <SectionHeading>{t("accessibilityControls")}</SectionHeading>

            <Row label={t("fontSize")}>
              <ButtonGroup
                options={[
                  { value: "small", label: t("fontSmall") },
                  { value: "medium", label: t("fontMedium") },
                  { value: "large", label: t("fontLarge") },
                  { value: "extra-large", label: t("fontExtraLarge") },
                ]}
                value={preferences.fontSize}
                onChange={(v) => updateUi({ fontSize: v })}
              />
            </Row>

            <Row label={t("highContrast")} description={t("highContrastDesc")}>
              <Toggle
                enabled={preferences.highContrast}
                onChange={(v) => updateUi({ highContrast: v })}
              />
            </Row>

            <Row label={t("captionsDefault")} description={t("captionsDefaultDesc")}>
              <Toggle
                enabled={preferences.captionsDefault}
                onChange={(v) => updateUi({ captionsDefault: v })}
              />
            </Row>

            <Row label={t("subtitlesLanguage")}>
              <ButtonGroup
                options={[
                  { value: "en", label: t("english") },
                  { value: "ar", label: t("arabic") },
                ]}
                value={preferences.subtitlesLanguage}
                onChange={(v) => updateUi({ subtitlesLanguage: v })}
              />
            </Row>

            <Row label={t("reducedMotion")} description={t("reducedMotionDesc")}>
              <Toggle
                enabled={preferences.reduceMotion}
                onChange={(v) => updateUi({ reduceMotion: v })}
              />
            </Row>
          </Card>

          {/* Privacy */}
          <Card>
            <SectionHeading>{t("privacyControls")}</SectionHeading>

            <Row label={t("profileVisibility")} description={t("profileVisibilityDesc")}>
              <ButtonGroup
                options={[
                  { value: "name_only", label: t("visibilityNameOnly") },
                  { value: "name_photo", label: t("visibilityNamePhoto") },
                  { value: "full", label: t("visibilityFull") },
                ]}
                value={preferences.profileVisibility}
                onChange={(v) => updateUi({ profileVisibility: v })}
              />
            </Row>

            <Row label={t("dataSharing")} description={t("dataSharingDesc")}>
              <Toggle
                enabled={preferences.dataSharing}
                onChange={(v) => updateUi({ dataSharing: v })}
              />
            </Row>
          </Card>
        </>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-6">
      {children}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">{children}</h3>
  );
}

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-[var(--color-border-subtle)] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">{label}</p>
        {description && (
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function ButtonGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
            value === opt.value
              ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
              : "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] border-[var(--color-border)] hover:border-[var(--color-primary)]"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#22C55E] ${
        enabled ? "bg-[#22C55E]" : "bg-[#D1D5DB]"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}
