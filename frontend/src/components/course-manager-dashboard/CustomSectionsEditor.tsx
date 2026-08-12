"use client";

import { useTranslations } from "next-intl";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Trash2 } from "lucide-react";

export type CustomSectionDraft = {
  id: string;
  titleEn: string;
  titleAr: string;
  contentEn: string;
  contentAr: string;
};

interface Props {
  value: CustomSectionDraft[];
  onChange: (next: CustomSectionDraft[]) => void;
  /** Emits when a section is added: parent should also append `custom:<id>`
   *  to `sectionsOrder` so it appears in the reorder UI immediately. */
  onAdd?: (id: string) => void;
  /** Emits when a section is removed: parent should also drop `custom:<id>`
   *  from `sectionsOrder`. */
  onRemove?: (id: string) => void;
}

/** Generate a stable id that survives the browser (nanoid-free — this only
 *  needs to be unique per-course, not globally). Prefixed so it's easy to
 *  spot in the DB and in the section-order string list. */
function makeCustomSectionId(): string {
  return `custom_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function CustomSectionsEditor({ value, onChange, onAdd, onRemove }: Props) {
  const t = useTranslations("courseManagerDashboard.createCourse");

  const updateAt = (idx: number, patch: Partial<CustomSectionDraft>) => {
    const next = value.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange(next);
  };

  const remove = (idx: number) => {
    const removed = value[idx];
    const next = value.filter((_, i) => i !== idx);
    onChange(next);
    if (removed && onRemove) onRemove(removed.id);
  };

  const add = () => {
    const id = makeCustomSectionId();
    const next: CustomSectionDraft = {
      id,
      titleEn: "",
      titleAr: "",
      contentEn: "",
      contentAr: "",
    };
    onChange([...value, next]);
    if (onAdd) onAdd(id);
  };

  return (
    <div className="pt-3 border-t border-[var(--color-border)]">
      <div className="mb-2">
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {t("customSectionsTitle")}
        </h4>
        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
          {t("customSectionsHint")}
        </p>
      </div>

      {value.map((section, i) => (
        <div
          key={section.id}
          className="mb-4 rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-surface-page)]"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">
              {t("customSectionItemLabel")} {i + 1}
            </span>
            <button
              type="button"
              onClick={() => remove(i)}
              className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t("removeCustomSection")}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                {t("customSectionTitleEn")}
              </label>
              <input
                type="text"
                value={section.titleEn}
                onChange={(e) => updateAt(i, { titleEn: e.target.value })}
                placeholder={t("customSectionTitleEnPlaceholder")}
                className="w-full text-sm px-2.5 py-1.5 rounded-md border border-[var(--color-input-border)] bg-[var(--color-surface-card)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                {t("customSectionTitleAr")}
              </label>
              <input
                type="text"
                value={section.titleAr}
                onChange={(e) => updateAt(i, { titleAr: e.target.value })}
                placeholder={t("customSectionTitleArPlaceholder")}
                dir="rtl"
                className="w-full text-sm px-2.5 py-1.5 rounded-md border border-[var(--color-input-border)] bg-[var(--color-surface-card)]"
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              {t("customSectionContentEn")}
            </label>
            <RichTextEditor
              value={section.contentEn}
              onChange={(v) => updateAt(i, { contentEn: v })}
              placeholder={t("customSectionContentEnPlaceholder")}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              {t("customSectionContentAr")}
            </label>
            <RichTextEditor
              value={section.contentAr}
              onChange={(v) => updateAt(i, { contentAr: v })}
              placeholder={t("customSectionContentArPlaceholder")}
              dir="rtl"
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="text-sm text-[var(--color-primary)] hover:underline"
      >
        {t("addCustomSection")}
      </button>
    </div>
  );
}
