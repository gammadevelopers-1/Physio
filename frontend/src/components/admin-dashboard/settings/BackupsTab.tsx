"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  Database,
  Download,
  FolderArchive,
  HardDriveDownload,
  History,
  Info,
  Loader2,
  Lock,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { TabShell } from "./TabShell";
import WebsiteRecoverySection from "./WebsiteRecoverySection";
import RestoreHistorySection from "./RestoreHistorySection";
import {
  backupsAdminApi,
  type BackupOverview,
  type BackupRecord,
  type BackupRestorePoint,
} from "@/lib/api";

function formatBytes(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

function formatTs(value: string | null, locale: string): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(locale === "ar" ? "ar-SA" : "en-US", {
      timeZone: "Asia/Riyadh",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export default function BackupsTab() {
  const t = useTranslations("adminDashboard.settingsPage.backups");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [overview, setOverview] = useState<BackupOverview | null>(null);
  const [records, setRecords] = useState<BackupRecord[]>([]);
  const [restorePoints, setRestorePoints] = useState<BackupRestorePoint[]>([]);
  const [restoreAvailable, setRestoreAvailable] = useState(false);

  const [creating, setCreating] = useState<
    null | "snapshot" | "export" | "files_export"
  >(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const refreshLists = useCallback(async () => {
    const [list, rp] = await Promise.all([
      backupsAdminApi.list().catch(() => [] as BackupRecord[]),
      backupsAdminApi
        .getRestorePoints()
        .catch(() => ({ available: false, items: [] as BackupRestorePoint[] })),
    ]);
    setRecords(list);
    setRestoreAvailable(rp.available);
    setRestorePoints(rp.items);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const ov = await backupsAdminApi.getOverview();
      setOverview(ov);
      await refreshLists();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [refreshLists, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (
    kind: "snapshot" | "export" | "files_export",
  ) => {
    setCreating(kind);
    try {
      if (kind === "snapshot") await backupsAdminApi.createSnapshot();
      else if (kind === "export") await backupsAdminApi.createExport();
      else await backupsAdminApi.createFilesExport();
      toast.success(t("started"));
      await refreshLists();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("startFailed"));
    } finally {
      setCreating(null);
    }
  };

  const handleDownload = async (id: string) => {
    setDownloadingId(id);
    try {
      const { url } = await backupsAdminApi.getDownloadUrl(id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("downloadFailed"));
    } finally {
      setDownloadingId(null);
    }
  };

  const disabled = !overview?.enabled;

  return (
    <TabShell
      title={t("title")}
      description={t("subtitle")}
      loading={loading}
      saving={false}
      dirty={false}
      loadError={loadError}
      onSave={() => {}}
      noSaveBar
    >
      {/* Recovery posture — reassurance that data is protected at the infra layer */}
      <div className="bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("postureTitle")}
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PostureItem
            icon={History}
            label={t("automatedDaily")}
            desc={t("automatedDailyDesc")}
          />
          <PostureItem
            icon={Clock}
            label={t("pitr", { days: overview?.pitrDays ?? 7 })}
            desc={t("pitrDesc")}
          />
          <PostureItem
            icon={Lock}
            label={t("encrypted")}
            desc={t("encryptedDesc")}
          />
          <PostureItem
            icon={ScanLine}
            label={t("malware")}
            desc={t("malwareDesc")}
          />
        </div>
        {overview && (
          <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--color-text-secondary)] font-mono">
            <span>{t("instanceLabel")}: {overview.instance}</span>
            <span>{t("databaseLabel")}: {overview.database}</span>
            <span>{t("bucketLabel")}: {overview.bucket}</span>
          </div>
        )}
      </div>

      {/* Non-production notice */}
      {disabled && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-[#D97706] mt-0.5 flex-shrink-0" />
          <p className="text-xs text-[#92400E]">{t("productionOnlyBody")}</p>
        </div>
      )}

      {/* Actions */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
          {t("actionsTitle")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <ActionCard
            icon={Camera}
            title={t("createSnapshot")}
            desc={t("createSnapshotDesc")}
            busy={creating === "snapshot"}
            busyLabel={t("creating")}
            disabled={disabled || creating !== null}
            onClick={() => handleCreate("snapshot")}
          />
          <ActionCard
            icon={HardDriveDownload}
            title={t("createExport")}
            desc={t("createExportDesc")}
            busy={creating === "export"}
            busyLabel={t("creating")}
            disabled={disabled || creating !== null}
            onClick={() => handleCreate("export")}
          />
          <ActionCard
            icon={FolderArchive}
            title={t("createFilesBackup")}
            desc={t("createFilesBackupDesc")}
            busy={creating === "files_export"}
            busyLabel={t("creating")}
            disabled={disabled || creating !== null}
            onClick={() => handleCreate("files_export")}
          />
        </div>
        <p className="text-[11px] text-[var(--color-text-secondary)] mt-2 leading-relaxed">
          {t("filesBackupHint")}
        </p>
      </div>

      {/* History */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("historyTitle")}
          </h3>
          <button
            type="button"
            onClick={refreshLists}
            className="inline-flex items-center gap-1.5 px-2.5 h-8 text-xs text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t("refresh")}
          </button>
        </div>
        {records.length === 0 ? (
          <div className="bg-[var(--color-surface-page)] border border-dashed border-[var(--color-border)] rounded-xl py-8 text-center text-sm text-[var(--color-text-secondary)]">
            {t("emptyHistory")}
          </div>
        ) : (
          <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--color-surface-page)] border-b border-[var(--color-border)]">
                <tr>
                  <Th isRTL={isRTL}>{t("colType")}</Th>
                  <Th isRTL={isRTL}>{t("colStatus")}</Th>
                  <Th isRTL={isRTL}>{t("colCreated")}</Th>
                  <Th isRTL={isRTL}>{t("colSize")}</Th>
                  <Th isRTL={isRTL}>{t("colBy")}</Th>
                  <th className="px-4 py-3 w-28" />
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const by =
                    `${r.createdByFirstName || ""} ${r.createdByLastName || ""}`.trim() ||
                    r.createdByEmail ||
                    "—";
                  return (
                    <tr key={r.id} className="border-b border-[#F3F4F6] last:border-0">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-primary)]">
                          {r.mode === "files_export" ? (
                            <FolderArchive className="w-4 h-4 text-[var(--color-text-secondary)]" />
                          ) : r.mode === "export" ? (
                            <HardDriveDownload className="w-4 h-4 text-[var(--color-text-secondary)]" />
                          ) : (
                            <Camera className="w-4 h-4 text-[var(--color-text-secondary)]" />
                          )}
                          {r.mode === "files_export"
                            ? t("modeFilesExport")
                            : r.mode === "export"
                              ? t("modeExport")
                              : t("modeSnapshot")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} t={t} />
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] font-mono whitespace-nowrap">
                        {formatTs(r.createdAt, locale)}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] font-mono">
                        {r.mode === "export" ? formatBytes(r.fileSizeBytes) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] truncate max-w-[160px]">
                        {by}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(r.mode === "export" || r.mode === "files_export") &&
                          r.status === "completed" && (
                          <button
                            type="button"
                            onClick={() => handleDownload(r.id)}
                            disabled={downloadingId === r.id}
                            className="inline-flex items-center gap-1.5 px-2.5 h-8 text-xs font-medium text-[var(--color-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
                          >
                            {downloadingId === r.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            {t("download")}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cloud SQL restore points (the real recovery inventory) */}
      {restoreAvailable && restorePoints.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
            {t("restorePointsTitle")}
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)] mb-2">
            {t("restorePointsDesc")}
          </p>
          <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] divide-y divide-[#F3F4F6]">
            {restorePoints.slice(0, 8).map((rp) => (
              <div key={rp.id} className="flex items-center gap-3 px-4 py-2.5">
                <Database className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
                <span className="text-xs font-mono text-[var(--color-text-secondary)] flex-1">
                  {formatTs(rp.startTime, locale)}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
                  {rp.type === "ON_DEMAND" ? t("rpOnDemand") : t("rpAutomated")}
                </span>
                {rp.status === "SUCCESSFUL" ? (
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                ) : (
                  <Clock className="w-4 h-4 text-[#D97706]" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Website application — list Cloud Run revisions + rollback */}
      <WebsiteRecoverySection enabled={!disabled} />

      {/* Restore history — audit feed of backups, downloads, rollbacks */}
      <RestoreHistorySection enabled={!disabled} />

      {/* Restore policy — why there's no one-click restore */}
      <div className="bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-[#D97706] flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
            {t("restorePolicyTitle")}
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            {t("restorePolicyBody")}
          </p>
        </div>
      </div>
    </TabShell>
  );
}

function PostureItem({
  icon: Icon,
  label,
  desc,
}: {
  icon: React.ElementType;
  label: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-card)] border border-[var(--color-border)] flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-[var(--color-primary)]" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">{label}</p>
        <p className="text-xs text-[var(--color-text-secondary)]">{desc}</p>
      </div>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  title,
  desc,
  busy,
  busyLabel,
  disabled,
  onClick,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  busy: boolean;
  busyLabel: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-4 h-4 text-[var(--color-primary)]" />
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
      </div>
      <p className="text-xs text-[var(--color-text-secondary)] flex-1 mb-3">{desc}</p>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-[var(--color-button-text)] btn-gold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {busyLabel}
          </>
        ) : (
          title
        )}
      </button>
    </div>
  );
}

function StatusBadge({
  status,
  t,
}: {
  status: BackupRecord["status"];
  t: ReturnType<typeof useTranslations>;
}) {
  const map = {
    completed: {
      cls: "bg-[#DCFCE7] text-[#15803D]",
      Icon: CheckCircle2,
      label: t("statusCompleted"),
    },
    running: {
      cls: "bg-[#FEF3C7] text-[#92400E]",
      Icon: Loader2,
      label: t("statusRunning"),
      spin: true,
    },
    pending: {
      cls: "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]",
      Icon: Clock,
      label: t("statusPending"),
    },
    failed: {
      cls: "bg-[#FEE2E2] text-[#DC2626]",
      Icon: XCircle,
      label: t("statusFailed"),
    },
  } as const;
  const s = map[status] ?? map.pending;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${s.cls}`}
    >
      <s.Icon className={`w-3 h-3 ${"spin" in s && s.spin ? "animate-spin" : ""}`} />
      {s.label}
    </span>
  );
}

function Th({ children, isRTL }: { children: React.ReactNode; isRTL: boolean }) {
  return (
    <th
      className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${
        isRTL ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}
