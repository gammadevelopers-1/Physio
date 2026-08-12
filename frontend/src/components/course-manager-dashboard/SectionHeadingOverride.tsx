"use client";

import { useTranslations } from "next-intl";
import type { SectionHeadingKey, SectionHeadingsMap } from "@/lib/api";

interface Props {
  sectionKey: SectionHeadingKey;
  value: SectionHeadingsMap;
  onChange: (next: SectionHeadingsMap) => void;
  defaultEn?: string;
  defaultAr?: string;
}

/**
 * Inline heading-override row rendered above each content section in the
 * course create/edit forms. EN + AR inputs; placeholders show the Strapi
 * default so managers see exactly what they are overriding. Any blank
 * locale on save falls back to the Strapi default at render time.
 */
export function SectionHeadingOverride({
  sectionKey,
  value,
  onChange,
  defaultEn,
  defaultAr,
}: Props) {
  const t = useTranslations("courseManagerDashboard.createCourse");
  const current = value[sectionKey] || {};

  const setEn = (en: string) => {
    const nextEntry = { ...current, en };
    const next: SectionHeadingsMap = { ...value, [sectionKey]: nextEntry };
    if (!nextEntry.en?.trim() && !nextEntry.ar?.trim()) delete next[sectionKey];
    onChange(next);
  };

  const setAr = (ar: string) => {
    const nextEntry = { ...current, ar };
    const next: SectionHeadingsMap = { ...value, [sectionKey]: nextEntry };
    if (!nextEntry.en?.trim() && !nextEntry.ar?.trim()) delete next[sectionKey];
    onChange(next);
  };

  return (
    <div className="mb-3 rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface-page)] p-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-text-secondary)] mb-1.5">
        {t("sectionHeadingOverride")}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          type="text"
          value={current.en ?? ""}
          onChange={(e) => setEn(e.target.value)}
          placeholder={defaultEn || t("sectionHeadingEnPlaceholder")}
          className="w-full text-sm px-2.5 py-1.5 rounded-md border border-[var(--color-input-border)] bg-[var(--color-surface-card)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
        />
        <input
          type="text"
          value={current.ar ?? ""}
          onChange={(e) => setAr(e.target.value)}
          placeholder={defaultAr || t("sectionHeadingArPlaceholder")}
          dir="rtl"
          className="w-full text-sm px-2.5 py-1.5 rounded-md border border-[var(--color-input-border)] bg-[var(--color-surface-card)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
        />
      </div>
    </div>
  );
}
