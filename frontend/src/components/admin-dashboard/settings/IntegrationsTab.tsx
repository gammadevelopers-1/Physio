"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Video,
  Mail,
  ShieldCheck,
  Lock,
  Database,
  Sparkles,
  ShieldAlert,
  HardDrive,
  AlertCircle,
  ChevronDown,
  Settings2,
} from "lucide-react";
import { adminSettingsApi } from "@/lib/api";
import { TabShell } from "./TabShell";
import ZoomIntegrationPanel from "./ZoomIntegrationPanel";

interface HealthRow {
  configured: boolean;
  required: boolean;
  description: string;
}

const ROW_META: Record<string, { icon: React.ElementType; labelKey: string }> = {
  zoom: { icon: Video, labelKey: "zoom" },
  resend: { icon: Mail, labelKey: "resend" },
  mailFrom: { icon: Mail, labelKey: "mailFrom" },
  recaptcha: { icon: ShieldCheck, labelKey: "recaptcha" },
  piiEncryption: { icon: Lock, labelKey: "piiEncryption" },
  redis: { icon: Database, labelKey: "redis" },
  openai: { icon: Sparkles, labelKey: "openai" },
  malwareScanner: { icon: ShieldAlert, labelKey: "malwareScanner" },
  cloudSqlBackup: { icon: HardDrive, labelKey: "cloudSqlBackup" },
};

export default function IntegrationsTab() {
  const t = useTranslations("adminDashboard.settingsPage");
  const [health, setHealth] = useState<Record<string, HealthRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoomExpanded, setZoomExpanded] = useState(false);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminSettingsApi.getIntegrationHealth();
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("toasts.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <TabShell
      title={t("integrations.title")}
      description={t("integrations.subtitle")}
      loading={loading}
      saving={false}
      dirty={false}
      onSave={() => {}}
      noSaveBar
      loadError={error}
    >
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={fetchHealth}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {t("integrations.refresh")}
        </button>
      </div>

      {/* Summary banner */}
      {health && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <SummaryCard
            label={t("integrations.summary.total")}
            value={Object.keys(health).length}
          />
          <SummaryCard
            label={t("integrations.summary.configured")}
            value={Object.values(health).filter((h) => h.configured).length}
            accent="green"
          />
          <SummaryCard
            label={t("integrations.summary.missing")}
            value={
              Object.values(health).filter(
                (h) => h.required && !h.configured,
              ).length
            }
            accent="red"
          />
        </div>
      )}

      {/* Rows */}
      {health && (
        <div className="border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]">
          {Object.entries(health).map(([key, row]) => {
            const meta = ROW_META[key];
            const Icon = meta?.icon ?? AlertCircle;
            const labelKey = meta?.labelKey ?? key;
            const isZoom = key === "zoom";
            return (
              <div key={key}>
                <div className="flex items-center gap-4 p-4 hover:bg-[var(--color-surface-page)] transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-[var(--color-border-subtle)] flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-[var(--color-primary)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {t(`integrations.providers.${labelKey}`)}
                      </p>
                      {row.required && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] rounded">
                          {t("integrations.required")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      {row.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {row.configured ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#DCFCE7] text-[#16A34A] rounded-full text-xs font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t("integrations.configuredBadge")}
                      </span>
                    ) : row.required ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FEE2E2] text-[#DC2626] rounded-full text-xs font-medium">
                        <XCircle className="w-3.5 h-3.5" />
                        {t("integrations.missingBadge")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] rounded-full text-xs font-medium">
                        <XCircle className="w-3.5 h-3.5" />
                        {t("integrations.notConfiguredBadge")}
                      </span>
                    )}
                    {/* Zoom is the only manageable integration: expose a
                        Manage toggle that opens the host-management panel. */}
                    {isZoom && (
                      <button
                        type="button"
                        onClick={() => setZoomExpanded((v) => !v)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
                        aria-expanded={zoomExpanded}
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                        {t("zoomHost.manage")}
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${zoomExpanded ? "rotate-180" : ""}`}
                        />
                      </button>
                    )}
                  </div>
                </div>
                {isZoom && zoomExpanded && (
                  <div className="px-4 pb-4 border-t border-[var(--color-border)] bg-[var(--color-surface-page)]">
                    <ZoomIntegrationPanel />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Help */}
      <div className="bg-[var(--color-border-subtle)] border border-[var(--color-border)] rounded-lg p-3">
        <p className="text-xs text-[var(--color-text-secondary)]">
          <strong className="text-[var(--color-text-primary)]">
            {t("integrations.howToConnect")}:
          </strong>{" "}
          {t("integrations.howToConnectBody")}
        </p>
      </div>
    </TabShell>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "green" | "red";
}) {
  const valueClass =
    accent === "green"
      ? "text-[#16A34A]"
      : accent === "red"
        ? "text-[#DC2626]"
        : "text-[var(--color-text-primary)]";
  return (
    <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg p-3 text-center">
      <p className={`text-2xl font-bold ${valueClass}`}>{value}</p>
      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{label}</p>
    </div>
  );
}

// Loader2 is reserved here for future "test connection" buttons but
// is not currently rendered — silence the unused import warning.
void Loader2;
