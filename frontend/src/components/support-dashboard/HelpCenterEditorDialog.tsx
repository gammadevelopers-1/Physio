"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { supportApi } from "@/lib/api";
import Select from "@/components/admin-dashboard/Select";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { X, Loader2, Save, Globe } from "lucide-react";

export interface ArticleFormState {
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
  category: string;
  published: boolean;
}

interface Category {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string | null;
}

interface Props {
  /** Existing article being edited, or null for create. */
  article: any | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

const emptyForm: ArticleFormState = {
  titleEn: "",
  titleAr: "",
  bodyEn: "",
  bodyAr: "",
  category: "",
  published: false,
};

export default function HelpCenterEditorDialog({
  article,
  categories,
  onClose,
  onSaved,
}: Props) {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const [form, setForm] = useState<ArticleFormState>(emptyForm);
  const [activeLang, setActiveLang] = useState<"en" | "ar">(
    locale === "ar" ? "ar" : "en",
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (article) {
      setForm({
        titleEn: article.titleEn || "",
        titleAr: article.titleAr || "",
        bodyEn: article.bodyEn || "",
        bodyAr: article.bodyAr || "",
        category: article.category || categories[0]?.slug || "",
        published: !!article.published,
      });
    } else {
      setForm({ ...emptyForm, category: categories[0]?.slug || "" });
    }
  }, [article, categories]);

  // Image uploads insert HTML <img> into the editor body. We reuse the
  // generic /storage/upload endpoint (configured for image MIME types).
  const handleImageUpload = useCallback(async (file: File): Promise<string> => {
    try {
      const result = await supportApi.uploadKbImage(file);
      return result.url;
    } catch {
      toast.error(t("kbPage.toasts.imageUploadFailed"));
      throw new Error("upload failed");
    }
  }, [t]);

  async function handleSave() {
    if (!form.category) {
      toast.error(t("kbPage.toasts.categoryRequired"));
      return;
    }
    if (!form.titleEn.trim() && !form.titleAr.trim()) {
      toast.error(t("kbPage.toasts.titleRequired"));
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        titleEn: form.titleEn.trim() || undefined,
        titleAr: form.titleAr.trim() || undefined,
        bodyEn: form.bodyEn || undefined,
        bodyAr: form.bodyAr || undefined,
        category: form.category,
        published: form.published,
      };
      if (article?.id) {
        await supportApi.updateKbArticle(article.id, payload);
        toast.success(t("kbPage.toasts.updated"));
      } else {
        await supportApi.createKbArticle(payload as Parameters<typeof supportApi.createKbArticle>[0]);
        toast.success(t("kbPage.toasts.created"));
      }
      onSaved();
    } catch (err: any) {
      toast.error(err?.message || t("kbPage.toasts.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  // Close on Escape — only when nothing's being saved.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isSaving, onClose]);

  const isAr = activeLang === "ar";

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl w-full max-w-3xl pointer-events-auto max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                {article
                  ? t("kbPage.form.editTitle")
                  : t("kbPage.form.createTitle")}
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {t("kbPage.form.bilingualHint")}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-[var(--color-border-subtle)] rounded-lg"
              aria-label={t("kbPage.form.cancel")}
            >
              <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
            </button>
          </div>

          {/* Body — scrollable */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Top row: language toggle + category + published */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-1 bg-[var(--color-border-subtle)] rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setActiveLang("en")}
                  className={`flex items-center gap-1 px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
                    activeLang === "en"
                      ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                      : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  {t("kbPage.form.langEnglish")}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLang("ar")}
                  className={`flex items-center gap-1 px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors ${
                    activeLang === "ar"
                      ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                      : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  {t("kbPage.form.langArabic")}
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <Select
                  value={form.category}
                  onChange={(v) => setForm((p) => ({ ...p, category: v }))}
                  placeholder={t("kbPage.form.selectCategory")}
                  className="w-full"
                  options={categories.map((c) => ({
                    value: c.slug,
                    label: c.nameEn + (c.nameAr ? ` / ${c.nameAr}` : ""),
                  }))}
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <button
                  type="button"
                  onClick={() =>
                    setForm((p) => ({ ...p, published: !p.published }))
                  }
                  className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 ${
                    form.published ? "bg-[#22C55E]" : "bg-[var(--color-border)]"
                  }`}
                  aria-pressed={form.published}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full shadow transition-all ${
                      form.published ? "ms-auto" : ""
                    }`}
                  />
                </button>
                <span className="text-[13px] text-[var(--color-text-secondary)]">
                  {form.published
                    ? t("kbPage.form.publishedToggle")
                    : t("kbPage.form.draftToggle")}
                </span>
              </label>
            </div>

            {/* Title + body — switch by activeLang so the user can focus
                on one language at a time without juggling four fields. */}
            {activeLang === "en" ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    {t("kbPage.form.titleEn")}
                  </label>
                  <input
                    type="text"
                    value={form.titleEn}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, titleEn: e.target.value }))
                    }
                    placeholder={t("kbPage.form.titleEnPlaceholder")}
                    className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    {t("kbPage.form.bodyEn")}
                  </label>
                  <RichTextEditor
                    value={form.bodyEn}
                    onChange={(v) => setForm((p) => ({ ...p, bodyEn: v }))}
                    placeholder={t("kbPage.form.bodyEnPlaceholder")}
                    dir="ltr"
                    minHeight={280}
                    onImageUpload={handleImageUpload}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    {t("kbPage.form.titleAr")}
                  </label>
                  <input
                    type="text"
                    value={form.titleAr}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, titleAr: e.target.value }))
                    }
                    placeholder={t("kbPage.form.titleArPlaceholder")}
                    dir="rtl"
                    className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    {t("kbPage.form.bodyAr")}
                  </label>
                  <RichTextEditor
                    value={form.bodyAr}
                    onChange={(v) => setForm((p) => ({ ...p, bodyAr: v }))}
                    placeholder={t("kbPage.form.bodyArPlaceholder")}
                    dir="rtl"
                    minHeight={280}
                    onImageUpload={handleImageUpload}
                  />
                </div>
              </>
            )}

            {/* Quick preview of the inactive language so the supervisor
                knows whether the other locale needs filling in. */}
            <div className="text-[11px] text-[var(--color-text-secondary)] bg-[var(--color-surface-page)] rounded-lg p-2.5 flex items-center gap-3">
              <div className="flex-1">
                <span className="font-medium">EN:</span>{" "}
                {form.titleEn ? (
                  <span className="text-[var(--color-text-primary)]">{form.titleEn}</span>
                ) : (
                  <span className="italic">{t("kbPage.form.notSet")}</span>
                )}
              </div>
              <div className="flex-1" dir="rtl">
                <span className="font-medium">AR:</span>{" "}
                {form.titleAr ? (
                  <span className="text-[var(--color-text-primary)]">{form.titleAr}</span>
                ) : (
                  <span className="italic">{t("kbPage.form.notSet")}</span>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-[var(--color-border)] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="h-10 px-4 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
            >
              {t("kbPage.form.cancel")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="h-10 px-4 bg-[var(--color-primary)] hover:bg-[#001d5e] text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {article ? t("kbPage.form.update") : t("kbPage.form.create")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
