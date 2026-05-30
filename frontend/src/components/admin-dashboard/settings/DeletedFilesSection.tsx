"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  FileX,
  Info,
  Loader2,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import {
  backupsAdminApi,
  type DeletedFileEntry,
  type DeletedFilesResponse,
} from "@/lib/api";

const PAGE_SIZE = 10;

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

function bucketBadgeClass(label: string): string {
  switch (label) {
    case "public":
      return "bg-[#DBEAFE] text-[#1E40AF]";
    case "private":
      return "bg-[#FEF3C7] text-[#92400E]";
    case "trainers":
      return "bg-[#E0E7FF] text-[#3730A3]";
    case "cms":
      return "bg-[#FCE7F3] text-[#9D174D]";
    default:
      return "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
  }
}

interface Props {
  enabled: boolean;
}

export default function DeletedFilesSection({ enabled }: Props) {
  const t = useTranslations("adminDashboard.settingsPage.backups");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DeletedFilesResponse | null>(null);
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<DeletedFileEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const refresh = useCallback(
    async (targetPage = page) => {
      setLoading(true);
      try {
        const result = await backupsAdminApi
          .listDeletedFiles(targetPage, PAGE_SIZE)
          .catch(
            () =>
              ({
                available: false,
                items: [],
                total: 0,
                page: targetPage,
                limit: PAGE_SIZE,
                totalPages: 1,
              }) as DeletedFilesResponse,
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

  // Esc to close modal
  useEffect(() => {
    if (!target) return;
    const f = setTimeout(() => closeBtnRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) setTarget(null);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(f);
      document.removeEventListener("keydown", onKey);
    };
  }, [target, submitting]);

  const handleRestore = async () => {
    if (!target) return;
    setSubmitting(true);
    try {
      await backupsAdminApi.restoreFile(
        target.bucketLabel,
        target.name,
        target.generation,
      );
      toast.success(t("fileRestoredToast", { name: target.name }));
      setTarget(null);
      // The restored file no longer appears as soft-deleted — refresh.
      await refresh(1);
      setPage(1);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("fileRestoreFailedToast"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!enabled) return null;

  const totalPages = data?.totalPages ?? 1;
  const total = data?.total ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <FileX className="w-4 h-4 text-[var(--color-primary)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("deletedFilesTitle")}
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
        {t("deletedFilesDesc")}
      </p>

      {/* API unavailable */}
      {!loading && data && !data.available && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-3 flex items-start gap-2">
          <Info className="w-4 h-4 text-[#D97706] mt-0.5 flex-shrink-0" />
          <p className="text-xs text-[#92400E]">
            {t("deletedFilesUnavailable")}
            {data.error ? (
              <span className="block font-mono mt-1 opacity-70">
                {data.error}
              </span>
            ) : null}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && data && data.available && data.items.length === 0 && (
        <div className="bg-[var(--color-surface-page)] border border-dashed border-[var(--color-border)] rounded-xl py-8 text-center text-sm text-[var(--color-text-secondary)]">
          {t("deletedFilesEmpty")}
        </div>
      )}

      {/* Loading state */}
      {loading && !data && (
        <div className="bg-[var(--color-surface-page)] border border-dashed border-[var(--color-border)] rounded-xl py-8 flex items-center justify-center text-sm text-[var(--color-text-secondary)]">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          {t("loadingDeletedFiles")}
        </div>
      )}

      {/* Table */}
      {data && data.available && data.items.length > 0 && (
        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--color-surface-page)] border-b border-[var(--color-border)]">
              <tr>
                <Th isRTL={isRTL} className="min-w-[100px]">{t("colBucket")}</Th>
                <Th isRTL={isRTL}>{t("colFile")}</Th>
                <Th isRTL={isRTL} className="min-w-[80px]">{t("colSize")}</Th>
                <Th isRTL={isRTL} className="min-w-[160px]">{t("colDeletedAt")}</Th>
                <th className="px-5 py-3.5 w-32" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((f) => (
                <tr
                  key={`${f.bucket}/${f.name}@${f.generation}`}
                  className="border-b border-[#F3F4F6] last:border-0"
                >
                  <td className="px-5 py-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${bucketBadgeClass(f.bucketLabel)}`}
                    >
                      {f.bucketLabel}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-[var(--color-text-primary)] font-mono truncate max-w-[360px]" title={f.name}>
                    {f.name}
                  </td>
                  <td className="px-5 py-4 text-xs text-[var(--color-text-secondary)] font-mono whitespace-nowrap">
                    {formatBytes(f.size)}
                  </td>
                  <td className="px-5 py-4 text-xs text-[var(--color-text-secondary)] font-mono whitespace-nowrap">
                    {formatTs(f.deletedAt, locale)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => setTarget(f)}
                      className="inline-flex items-center gap-1.5 px-2.5 h-8 text-xs font-medium text-[var(--color-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)]"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {t("restore")}
                    </button>
                  </td>
                </tr>
              ))}
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

      {/* Restore confirm modal */}
      {target && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => !submitting && setTarget(null)}
        >
          <div
            className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl shadow-xl max-w-md w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-[#DBEAFE] flex items-center justify-center flex-shrink-0">
                <RotateCcw className="w-5 h-5 text-[#1E40AF]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                  {t("restoreFileTitle")}
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  {t("restoreFileBody")}
                </p>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={() => setTarget(null)}
                disabled={submitting}
                className="w-7 h-7 rounded-lg hover:bg-[var(--color-border-subtle)] flex items-center justify-center text-[var(--color-text-secondary)] disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-lg p-3 mb-3 space-y-1">
              <div className="flex justify-between gap-3 text-xs">
                <span className="text-[var(--color-text-secondary)]">
                  {t("colBucket")}
                </span>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${bucketBadgeClass(target.bucketLabel)}`}
                >
                  {target.bucketLabel}
                </span>
              </div>
              <div className="flex justify-between gap-3 text-xs">
                <span className="text-[var(--color-text-secondary)]">
                  {t("colFile")}
                </span>
                <span className="font-mono text-[var(--color-text-primary)] truncate max-w-[260px]" title={target.name}>
                  {target.name}
                </span>
              </div>
              <div className="flex justify-between gap-3 text-xs">
                <span className="text-[var(--color-text-secondary)]">
                  {t("colSize")}
                </span>
                <span className="font-mono text-[var(--color-text-primary)]">
                  {formatBytes(target.size)}
                </span>
              </div>
              <div className="flex justify-between gap-3 text-xs">
                <span className="text-[var(--color-text-secondary)]">
                  {t("colDeletedAt")}
                </span>
                <span className="font-mono text-[var(--color-text-primary)]">
                  {formatTs(target.deletedAt, locale)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setTarget(null)}
                disabled={submitting}
                className="px-3 h-10 text-sm text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
              >
                {t("rollbackCancel")}
              </button>
              <button
                type="button"
                onClick={handleRestore}
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 px-4 h-10 text-sm font-medium text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("restoringFile")}
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    {t("restoreFileCta")}
                  </>
                )}
              </button>
            </div>
          </div>
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
