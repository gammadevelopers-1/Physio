"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Loader2, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import AdminSidebar from "../AdminSidebar";
import AdminMobileSidebar from "../AdminMobileSidebar";
import AdminNavbar from "../AdminNavbar";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import {
  templatesApi,
  type TemplateDetail,
  type TemplateLocale,
} from "@/lib/api";
import EmailTemplateEditor from "./EmailTemplateEditor";
import WhatsAppTemplateEditor from "./WhatsAppTemplateEditor";

interface TemplateEditorContentProps {
  eventKey: string;
  templateLocale: TemplateLocale;
}

export default function TemplateEditorContent({
  eventKey,
  templateLocale,
}: TemplateEditorContentProps) {
  const t = useTranslations("adminDashboard.templatesPage");
  const locale = useLocale();
  const router = useRouter();
  const admin = useAdminProfile();

  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const load = async (loc: TemplateLocale) => {
    setLoading(true);
    try {
      const data = await templatesApi.get(eventKey, loc);
      setDetail(data);
    } catch {
      toast.error(t("loadFailed"));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(templateLocale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventKey, templateLocale]);

  const switchLocale = (newLoc: TemplateLocale) => {
    if (newLoc === templateLocale) return;
    router.push(`/${locale}/dashboard/admin/templates/${eventKey}/${newLoc}`);
  };

  const handleSave = async (payload: {
    subject?: string | null;
    preheader?: string | null;
    body: string;
    designJson?: unknown | null;
  }) => {
    if (!detail) return;
    setSaving(true);
    try {
      const updated = await templatesApi.upsert(eventKey, templateLocale, {
        ...payload,
        enabled: detail.enabled,
      });
      setDetail(updated);
      toast.success(t("saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  const handleReset = async () => {
    if (!detail) return;
    if (!detail.hasOverride) return;
    setConfirmResetOpen(true);
  };

  const confirmReset = async () => {
    setResetting(true);
    try {
      await templatesApi.reset(eventKey, templateLocale);
      toast.success(t("resetDone"));
      await load(templateLocale);
      setConfirmResetOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("resetFailed"));
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      <AdminNavbar admin={admin} />
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <AdminSidebar admin={admin} />
            </div>
            <AdminMobileSidebar admin={admin} />

            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/${locale}/dashboard/admin/templates`}
                    className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-2"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    {t("backToList")}
                  </Link>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] truncate">
                    {detail
                      ? locale === "ar"
                        ? detail.meta.nameAr
                        : detail.meta.nameEn
                      : t("loading")}
                  </h1>
                  {detail && (
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                      {locale === "ar"
                        ? detail.meta.descriptionAr
                        : detail.meta.descriptionEn}
                    </p>
                  )}
                </div>

                {/* Locale switcher — only relevant for email templates;
                    WhatsApp templates are bilingual in a single body. */}
                {detail && detail.meta.channel === "email" && (
                  <div className="inline-flex bg-[var(--color-border-subtle)] rounded-lg p-1 self-start sm:self-auto">
                    {(["en", "ar"] as const).map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => switchLocale(loc)}
                        className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                          templateLocale === loc
                            ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                            : "text-[var(--color-text-secondary)]"
                        }`}
                      >
                        {loc.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {loading ? (
                <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl p-16 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
                </div>
              ) : !detail ? (
                <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl p-16 text-center text-sm text-[var(--color-text-secondary)]">
                  {t("loadFailed")}
                </div>
              ) : detail.meta.channel === "email" ? (
                // key on detail.locale forces a full unmount + remount when
                // the admin flips EN↔AR, so Unlayer reloads the new locale's
                // design and subject/preheader state re-initialise from the
                // freshly fetched detail. Without this the canvas stays on
                // whichever locale was first opened.
                <EmailTemplateEditor
                  key={detail.locale}
                  detail={detail}
                  saving={saving}
                  resetting={resetting}
                  onSave={handleSave}
                  onReset={handleReset}
                />
              ) : (
                <WhatsAppTemplateEditor
                  key={detail.locale}
                  detail={detail}
                  saving={saving}
                  resetting={resetting}
                  onSave={handleSave}
                  onReset={handleReset}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmResetOpen}
        title={t("resetTitle")}
        message={t("confirmReset")}
        confirmLabel={t("resetConfirmLabel")}
        cancelLabel={t("cancel")}
        loading={resetting}
        danger
        onConfirm={confirmReset}
        onClose={() => !resetting && setConfirmResetOpen(false)}
      />
    </>
  );
}

// Re-exported small helper used by both editors so they share styling.
export function ActionBar({
  saving,
  resetting,
  hasOverride,
  onSave,
  onReset,
}: {
  saving: boolean;
  resetting: boolean;
  hasOverride: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  const t = useTranslations("adminDashboard.templatesPage");
  return (
    <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-page)]">
      {hasOverride && (
        <button
          type="button"
          onClick={onReset}
          disabled={resetting || saving}
          className="inline-flex items-center gap-1.5 px-3 py-2 border border-[var(--color-border)] rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
        >
          {resetting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RotateCcw className="w-3.5 h-3.5" />
          )}
          {t("resetToDefault")}
        </button>
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={saving || resetting}
        className="inline-flex items-center gap-1.5 px-4 py-2 btn-gold text-[var(--color-button-text)] rounded-lg text-xs font-semibold disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Save className="w-3.5 h-3.5" />
        )}
        {t("save")}
      </button>
    </div>
  );
}
