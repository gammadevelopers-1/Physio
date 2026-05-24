"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, ShieldAlert, Info, ExternalLink } from "lucide-react";
import { TabShell } from "./TabShell";
import { useSettingsCategory } from "./useSettingsCategory";

interface MaintenanceSettings extends Record<string, unknown> {
  enabled: boolean;
  messageEn: string;
  messageAr: string;
}

const FALLBACK: MaintenanceSettings = {
  enabled: false,
  messageEn:
    "We are currently performing scheduled maintenance. The platform will be back shortly.",
  messageAr:
    "نقوم حالياً بأعمال صيانة مجدولة. ستعود المنصة قريباً.",
};

export default function MaintenanceTab() {
  const t = useTranslations("adminDashboard.settingsPage");
  const { draft, setDraft, dirty, loading, saving, save, loadError } =
    useSettingsCategory<MaintenanceSettings>("maintenance", FALLBACK, {
      saved: t("toasts.saved"),
      saveFailed: t("toasts.saveFailed"),
      loadFailed: t("toasts.loadFailed"),
    });

  return (
    <TabShell
      title={t("maintenance.title")}
      description={t("maintenance.subtitle")}
      loading={loading}
      saving={saving}
      dirty={dirty}
      loadError={loadError}
      onSave={save}
    >
      {/* Status banner when ON */}
      {draft.enabled && (
        <div className="bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-[#DC2626] flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-[#991B1B] mb-0.5">
              {t("maintenance.currentlyOnTitle")}
            </p>
            <p className="text-[#B91C1C]">{t("maintenance.currentlyOnBody")}</p>
          </div>
        </div>
      )}

      {/* Toggle */}
      <div
        className={`flex items-center justify-between p-4 rounded-lg border ${
          draft.enabled
            ? "bg-[#FEE2E2] border-[#FCA5A5]"
            : "bg-[var(--color-surface-page)] border-[var(--color-border)]"
        }`}
      >
        <div className="flex items-center gap-3">
          <AlertTriangle
            className={`w-5 h-5 ${
              draft.enabled ? "text-[#DC2626]" : "text-[var(--color-text-secondary)]"
            }`}
          />
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {t("maintenance.mode")}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {t("maintenance.modeDescDetailed")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDraft((d) => ({ ...d, enabled: !d.enabled }))}
          className={`w-12 h-6 rounded-full transition-colors flex items-center px-0.5 ${
            draft.enabled ? "bg-[#DC2626]" : "bg-[#D1D5DB]"
          }`}
        >
          <div
            className={`w-5 h-5 bg-white rounded-full shadow-md transition-all ${
              draft.enabled ? "ms-auto" : ""
            }`}
          />
        </button>
      </div>

      {/* Outage message — shown on public maintenance page + API 503 body */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
          {t("maintenance.messageTitle")}
        </h3>
        <p className="text-xs text-[var(--color-text-secondary)] mb-3">
          {t("maintenance.messageHelp")}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
              {t("maintenance.message")} (EN)
            </label>
            <textarea
              value={draft.messageEn}
              onChange={(e) =>
                setDraft((d) => ({ ...d, messageEn: e.target.value }))
              }
              rows={4}
              className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
              {t("maintenance.message")} (AR)
            </label>
            <textarea
              value={draft.messageAr}
              onChange={(e) =>
                setDraft((d) => ({ ...d, messageAr: e.target.value }))
              }
              rows={4}
              dir="rtl"
              className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
        </div>
      </div>

      {/* Preview link */}
      <div className="flex items-start gap-3 p-3 bg-[var(--color-border-subtle)] border border-[var(--color-border)] rounded-lg">
        <Info className="w-4 h-4 text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
        <div className="text-xs text-[var(--color-text-secondary)] space-y-1">
          <p>{t("maintenance.previewHint")}</p>
          <a
            href="/en/maintenance"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline font-medium"
          >
            {t("maintenance.previewLink")}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Bypass info */}
      <div className="bg-[var(--color-border-subtle)] border border-[var(--color-border)] rounded-lg p-3">
        <p className="text-xs text-[var(--color-text-secondary)]">
          <strong className="text-[var(--color-text-primary)]">
            {t("maintenance.bypassTitle")}:
          </strong>{" "}
          {t("maintenance.bypassBody")}
        </p>
      </div>
    </TabShell>
  );
}
