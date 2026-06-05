"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { supportApi } from "@/lib/api";
import {
  X,
  Plus,
  Loader2,
  Tags,
  Pencil,
  Trash2,
  Save,
  BookOpen,
  CreditCard,
  KeyRound,
  Award,
  Wrench,
  HelpCircle,
  FileText,
  type LucideIcon,
} from "lucide-react";

// Icon registry mirrors what the public support page already uses so
// admins can pick from a curated list. Anything outside this set
// falls back to BookOpen at render time.
const ICON_REGISTRY: Record<string, LucideIcon> = {
  BookOpen,
  CreditCard,
  KeyRound,
  Award,
  Wrench,
  HelpCircle,
  FileText,
};
const ICON_OPTIONS = Object.keys(ICON_REGISTRY);

type Category = NonNullable<Awaited<ReturnType<typeof supportApi.listKbCategories>>>[number];

interface Props {
  onClose: () => void;
  onChanged: () => void;
}

export default function HelpCenterCategoryManager({ onClose, onChanged }: Props) {
  const t = useTranslations("supportDashboard");
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({
    nameEn: "",
    nameAr: "",
    icon: "BookOpen",
    sortOrder: 999,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await supportApi.listKbCategories();
      setCategories(data || []);
    } catch {
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  function startCreate() {
    setEditing(null);
    setForm({ nameEn: "", nameAr: "", icon: "BookOpen", sortOrder: 999 });
    setShowAdd(true);
  }

  function startEdit(cat: Category) {
    setEditing(cat);
    setForm({
      nameEn: cat.nameEn,
      nameAr: cat.nameAr || "",
      icon: cat.icon || "BookOpen",
      sortOrder: cat.sortOrder,
    });
    setShowAdd(true);
  }

  async function handleSave() {
    if (!form.nameEn.trim()) {
      toast.error(t("kbPage.categoryManager.nameEnRequired"));
      return;
    }
    setIsSaving(true);
    try {
      if (editing) {
        await supportApi.updateKbCategory(editing.id, {
          nameEn: form.nameEn.trim(),
          nameAr: form.nameAr.trim() || undefined,
          icon: form.icon,
          sortOrder: form.sortOrder,
        });
        toast.success(t("kbPage.categoryManager.updated"));
      } else {
        await supportApi.createKbCategory({
          nameEn: form.nameEn.trim(),
          nameAr: form.nameAr.trim() || undefined,
          icon: form.icon,
          sortOrder: form.sortOrder,
        });
        toast.success(t("kbPage.categoryManager.created"));
      }
      setShowAdd(false);
      setEditing(null);
      fetchCategories();
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || t("kbPage.categoryManager.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(cat: Category) {
    if (cat.articleCount > 0) {
      toast.error(
        t("kbPage.categoryManager.cannotDeleteWithArticles", {
          count: cat.articleCount,
        }),
      );
      return;
    }
    if (!confirm(t("kbPage.categoryManager.confirmDelete", { name: cat.nameEn }))) {
      return;
    }
    try {
      await supportApi.deleteKbCategory(cat.id);
      toast.success(t("kbPage.categoryManager.deleted"));
      fetchCategories();
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || t("kbPage.categoryManager.deleteFailed"));
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl w-full max-w-xl pointer-events-auto max-h-[90vh] flex flex-col">
          <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <Tags className="w-5 h-5 text-[var(--color-primary)]" />
              {t("kbPage.categoryManager.title")}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-[var(--color-border-subtle)] rounded-lg"
            >
              <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {!showAdd && (
              <button
                type="button"
                onClick={startCreate}
                className="w-full flex items-center justify-center gap-2 h-10 border border-dashed border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
              >
                <Plus className="w-4 h-4" />
                {t("kbPage.categoryManager.addCategory")}
              </button>
            )}

            {showAdd && (
              <div className="bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                  {editing
                    ? t("kbPage.categoryManager.editTitle")
                    : t("kbPage.categoryManager.newTitle")}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                      {t("kbPage.categoryManager.nameEn")}
                    </label>
                    <input
                      type="text"
                      value={form.nameEn}
                      onChange={(e) => setForm((p) => ({ ...p, nameEn: e.target.value }))}
                      className="w-full h-9 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                      {t("kbPage.categoryManager.nameAr")}
                    </label>
                    <input
                      type="text"
                      value={form.nameAr}
                      onChange={(e) => setForm((p) => ({ ...p, nameAr: e.target.value }))}
                      dir="rtl"
                      className="w-full h-9 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    {t("kbPage.categoryManager.icon")}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {ICON_OPTIONS.map((name) => {
                      const Icon = ICON_REGISTRY[name];
                      const selected = form.icon === name;
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setForm((p) => ({ ...p, icon: name }))}
                          className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-colors ${
                            selected
                              ? "border-[var(--color-primary)] bg-[var(--color-border-subtle)] text-[var(--color-primary)]"
                              : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-secondary)]"
                          }`}
                          title={name}
                        >
                          <Icon className="w-4 h-4" />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                    {t("kbPage.categoryManager.sortOrder")}
                  </label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        sortOrder: parseInt(e.target.value || "0", 10) || 0,
                      }))
                    }
                    className="w-full h-9 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                  />
                  <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">
                    {t("kbPage.categoryManager.sortHint")}
                  </p>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdd(false);
                      setEditing(null);
                    }}
                    className="flex-1 h-9 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)]"
                  >
                    {t("kbPage.form.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 h-9 bg-[var(--color-primary)] hover:bg-[#001d5e] text-white rounded-lg text-sm flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    {editing ? t("kbPage.form.update") : t("kbPage.form.create")}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {isLoading ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-secondary)]" />
                </div>
              ) : categories.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)] text-center py-6">
                  {t("kbPage.categoryManager.empty")}
                </p>
              ) : (
                categories.map((cat) => {
                  const Icon = ICON_REGISTRY[cat.icon] || BookOpen;
                  return (
                    <div
                      key={cat.id}
                      className="flex items-center gap-3 border border-[var(--color-border)] rounded-lg p-3"
                    >
                      <div className="w-9 h-9 rounded-lg bg-[var(--color-border-subtle)] flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-[var(--color-primary)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                          {cat.nameEn}
                          {cat.nameAr && (
                            <span className="text-[var(--color-text-secondary)] font-normal mx-1">
                              / {cat.nameAr}
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-secondary)]">
                          <code className="font-mono">{cat.slug}</code>
                          {" · "}
                          {cat.articleCount}{" "}
                          {t("kbPage.categoryManager.articles")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => startEdit(cat)}
                        className="p-1.5 hover:bg-[var(--color-border-subtle)] rounded-md text-[var(--color-text-secondary)]"
                        aria-label={t("kbPage.actions.edit")}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cat)}
                        disabled={cat.articleCount > 0}
                        className="p-1.5 hover:bg-[#FEE2E2] rounded-md text-[#DC2626] disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label={t("kbPage.actions.delete")}
                        title={
                          cat.articleCount > 0
                            ? t("kbPage.categoryManager.cannotDeleteWithArticles", {
                                count: cat.articleCount,
                              })
                            : ""
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="px-5 py-3 border-t border-[var(--color-border)] flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
            >
              {t("kbPage.categoryManager.done")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
