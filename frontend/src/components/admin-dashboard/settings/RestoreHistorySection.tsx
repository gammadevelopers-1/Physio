"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileX,
  FlaskConical,
  FolderArchive,
  HardDriveDownload,
  History,
  Loader2,
  PackageOpen,
  Play,
  RefreshCw,
  RotateCcw,
  Timer,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  backupsAdminApi,
  type BackupAuditEntry,
  type BackupAuditResponse,
} from "@/lib/api";

const PAGE_SIZE = 5;

function formatTs(value: string, locale: string): string {
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

/**
 * Maps an audit action string to (icon, color, i18n key).
 * Keeping all the per-action presentation in one place makes the table
 * cell tiny and lets us add new actions in one spot.
 */
function actionPresentation(action: string): {
  icon: React.ElementType;
  cls: string;
  key: string;
} {
  switch (action) {
    case "backup.created":
      return { icon: Camera, cls: "text-[#15803D]", key: "actBackupCreated" };
    case "backup.exported":
      return {
        icon: HardDriveDownload,
        cls: "text-[#15803D]",
        key: "actBackupExported",
      };
    case "backup.downloaded":
      return { icon: Download, cls: "text-[#0284C7]", key: "actBackupDownloaded" };
    case "backup.files_export_started":
      return { icon: Play, cls: "text-[#0284C7]", key: "actFilesStarted" };
    case "backup.files_export_completed":
      return {
        icon: FolderArchive,
        cls: "text-[#15803D]",
        key: "actFilesCompleted",
      };
    case "backup.files_export_failed":
      return { icon: XCircle, cls: "text-[#DC2626]", key: "actFilesFailed" };
    case "backup.files_downloaded":
      return {
        icon: Download,
        cls: "text-[#0284C7]",
        key: "actFilesDownloaded",
      };
    case "website.rollback_initiated":
      return { icon: Play, cls: "text-[#0284C7]", key: "actRollbackStarted" };
    case "website.rollback_completed":
      return {
        icon: CheckCircle2,
        cls: "text-[#15803D]",
        key: "actRollbackCompleted",
      };
    case "website.rollback_failed":
      return { icon: XCircle, cls: "text-[#DC2626]", key: "actRollbackFailed" };
    case "files.recovered":
      return { icon: FileX, cls: "text-[#15803D]", key: "actFileRecovered" };
    case "files.recover_failed":
      return { icon: XCircle, cls: "text-[#DC2626]", key: "actFileRecoverFailed" };
    case "material.soft_deleted":
      return { icon: Trash2, cls: "text-[#D97706]", key: "actMaterialDeleted" };
    case "material.restored":
      return { icon: PackageOpen, cls: "text-[#15803D]", key: "actMaterialRestored" };
    case "course.soft_deleted":
      return { icon: Trash2, cls: "text-[#D97706]", key: "actCourseDeleted" };
    case "course.restored":
      return { icon: BookOpen, cls: "text-[#15803D]", key: "actCourseRestored" };
    case "restore_clone.created":
      return { icon: FlaskConical, cls: "text-[#0284C7]", key: "actSandboxCreated" };
    case "restore_clone.ready":
      return { icon: CheckCircle2, cls: "text-[#15803D]", key: "actSandboxReady" };
    case "restore_clone.failed":
      return { icon: XCircle, cls: "text-[#DC2626]", key: "actSandboxFailed" };
    case "restore_clone.extended":
      return { icon: Timer, cls: "text-[#0284C7]", key: "actSandboxExtended" };
    case "restore_clone.dropped":
      return { icon: Trash2, cls: "text-[var(--color-text-secondary)]", key: "actSandboxDropped" };
    case "restore_clone.expired":
      return { icon: Clock, cls: "text-[var(--color-text-secondary)]", key: "actSandboxExpired" };
    default:
      return { icon: RotateCcw, cls: "text-[var(--color-text-secondary)]", key: "actUnknown" };
  }
}

/**
 * Extract a short, human-meaningful detail line from the metadata jsonb.
 * Different actions have different metadata shapes — we surface the most
 * useful field per action and silently fall back to nothing otherwise.
 */
function detailLine(entry: BackupAuditEntry): string | null {
  const m = entry.metadata as Record<string, unknown> | null;
  if (!m) return null;
  if (typeof m.targetRevision === "string") return String(m.targetRevision);
  if (typeof m.previousRevision === "string" && typeof m.targetRevision !== "string") {
    return String(m.previousRevision);
  }
  if (typeof m.object === "string") return String(m.object);
  if (typeof m.mode === "string") return String(m.mode);
  if (typeof m.error === "string") return String(m.error).slice(0, 80);
  return null;
}

interface Props {
  enabled: boolean;
}

export default function RestoreHistorySection({ enabled }: Props) {
  const t = useTranslations("adminDashboard.settingsPage.backups");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<BackupAuditResponse | null>(null);
  const [page, setPage] = useState(1);

  const refresh = useCallback(
    async (targetPage = page) => {
      setLoading(true);
      try {
        const result = await backupsAdminApi
          .listAudit(targetPage, PAGE_SIZE)
          .catch(
            () =>
              ({
                data: [],
                total: 0,
                page: targetPage,
                limit: PAGE_SIZE,
                totalPages: 1,
              }) as BackupAuditResponse,
          );
        setData(result);
      } finally {
        setLoading(false);
      }
    },
    [page],
  );

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    refresh(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, page]);

  if (!enabled) return null;

  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[var(--color-primary)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("restoreHistoryTitle")}
          </h3>
        </div>
        <button
          type="button"
          onClick={() => refresh(page)}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 h-8 text-xs text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          {t("refresh")}
        </button>
      </div>
      <p className="text-xs text-[var(--color-text-secondary)] mb-2">
        {t("restoreHistoryDesc")}
      </p>

      {/* Empty state */}
      {!loading && data && data.data.length === 0 && (
        <div className="bg-[var(--color-surface-page)] border border-dashed border-[var(--color-border)] rounded-xl py-8 text-center text-sm text-[var(--color-text-secondary)]">
          {t("restoreHistoryEmpty")}
        </div>
      )}

      {/* Loading state */}
      {loading && !data && (
        <div className="bg-[var(--color-surface-page)] border border-dashed border-[var(--color-border)] rounded-xl py-8 flex items-center justify-center text-sm text-[var(--color-text-secondary)]">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          {t("loadingHistory")}
        </div>
      )}

      {/* Table */}
      {data && data.data.length > 0 && (
        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--color-surface-page)] border-b border-[var(--color-border)]">
              <tr>
                <Th isRTL={isRTL} className="min-w-[160px]">{t("colWhen")}</Th>
                <Th isRTL={isRTL} className="min-w-[200px]">{t("colAction")}</Th>
                <Th isRTL={isRTL} className="min-w-[160px]">{t("colBy")}</Th>
                <Th isRTL={isRTL}>{t("colDetails")}</Th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((entry) => {
                const { icon: Icon, cls, key } = actionPresentation(entry.action);
                const who =
                  `${entry.performerFirstName || ""} ${entry.performerLastName || ""}`.trim() ||
                  entry.performerEmail ||
                  "—";
                const detail = detailLine(entry);
                return (
                  <tr
                    key={entry.id}
                    className="border-b border-[#F3F4F6] last:border-0"
                  >
                    <td className="px-5 py-4 text-xs text-[var(--color-text-secondary)] font-mono whitespace-nowrap">
                      {formatTs(entry.createdAt, locale)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 text-sm font-medium ${cls}`}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        {t(key)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-[var(--color-text-primary)] truncate max-w-[200px]">
                      {who}
                    </td>
                    <td className="px-5 py-4 text-xs text-[var(--color-text-secondary)] font-mono truncate max-w-[280px]">
                      {detail ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-page)]">
              <span className="text-xs text-[var(--color-text-secondary)]">
                {t("pagination", {
                  from: (page - 1) * PAGE_SIZE + 1,
                  to: Math.min(page * PAGE_SIZE, total),
                  total,
                })}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                  aria-label={t("paginationPrev")}
                  className="w-8 h-8 rounded-lg border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || loading}
                  aria-label={t("paginationNext")}
                  className="w-8 h-8 rounded-lg border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  isRTL,
  className = "",
}: {
  children: React.ReactNode;
  isRTL: boolean;
  className?: string;
}) {
  return (
    <th
      className={`px-5 py-3.5 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${
        isRTL ? "text-right" : "text-left"
      } ${className}`}
    >
      {children}
    </th>
  );
}
