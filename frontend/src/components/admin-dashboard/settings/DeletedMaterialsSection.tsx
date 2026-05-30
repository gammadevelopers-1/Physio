"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  FileText,
  Film,
  ImageIcon,
  Loader2,
  PackageOpen,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import {
  backupsAdminApi,
  type DeletedMaterialEntry,
  type DeletedMaterialsResponse,
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

function typeBadge(type: string) {
  switch (type) {
    case "video":
      return { Icon: Film, cls: "bg-[#FCE7F3] text-[#9D174D]" };
    case "pdf":
      return { Icon: FileText, cls: "bg-[#FEE2E2] text-[#B91C1C]" };
    case "image":
      return { Icon: ImageIcon, cls: "bg-[#DCFCE7] text-[#15803D]" };
    default:
      return { Icon: FileText, cls: "bg-[#DBEAFE] text-[#1E40AF]" };
  }
}

interface Props {
  enabled: boolean;
}

export default function DeletedMaterialsSection({ enabled }: Props) {
  const t = useTranslations("adminDashboard.settingsPage.backups");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DeletedMaterialsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<DeletedMaterialEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const refresh = useCallback(
    async (targetPage = page) => {
      setLoading(true);
      try {
        const result = await backupsAdminApi
          .listDeletedMaterials(targetPage, PAGE_SIZE)
          .catch(
            () =>
              ({
                items: [],
                total: 0,
                page: targetPage,
                limit: PAGE_SIZE,
                totalPages: 1,
              }) as DeletedMaterialsResponse,
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
      const res = await backupsAdminApi.restoreMaterial(target.id);
      if (res.failed && res.failed.length > 0) {
        toast.warning(
          t("materialRestoredPartialToast", {
            title: target.title,
            count: res.failed.length,
          }),
        );
      } else {
        toast.success(t("materialRestoredToast", { title: target.title }));
      }
      setTarget(null);
      await refresh(1);
      setPage(1);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("materialRestoreFailedToast"),
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
          <PackageOpen className="w-4 h-4 text-[var(--color-primary)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("deletedMaterialsTitle")}
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
        {t("deletedMaterialsDesc")}
      </p>

      {!loading && data && data.items.length === 0 && (
        <div className="bg-[var(--color-surface-page)] border border-dashed border-[var(--color-border)] rounded-xl py-8 text-center text-sm text-[var(--color-text-secondary)]">
          {t("deletedMaterialsEmpty")}
        </div>
      )}

      {loading && !data && (
        <div className="bg-[var(--color-surface-page)] border border-dashed border-[var(--color-border)] rounded-xl py-8 flex items-center justify-center text-sm text-[var(--color-text-secondary)]">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          {t("loadingDeletedMaterials")}
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--color-surface-page)] border-b border-[var(--color-border)]">
              <tr>
                <Th isRTL={isRTL} className="min-w-[80px]">{t("colType")}</Th>
                <Th isRTL={isRTL}>{t("colMaterial")}</Th>
                <Th isRTL={isRTL}>{t("colCourse")}</Th>
                <Th isRTL={isRTL} className="min-w-[80px]">{t("colSize")}</Th>
                <Th isRTL={isRTL} className="min-w-[160px]">{t("colDeletedAt")}</Th>
                <Th isRTL={isRTL} className="min-w-[140px]">{t("colDeletedBy")}</Th>
                <th className="px-5 py-3.5 w-32" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((m) => {
                const badge = typeBadge(m.type);
                const Icon = badge.Icon;
                return (
                  <tr
                    key={m.id}
                    className="border-b border-[#F3F4F6] last:border-0"
                  >
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${badge.cls}`}
                      >
                        <Icon className="w-3 h-3" />
                        {m.type}
                      </span>
                    </td>
                    <td
                      className="px-5 py-4 text-xs text-[var(--color-text-primary)] truncate max-w-[260px]"
                      title={m.title}
                    >
                      {m.title}
                    </td>
                    <td className="px-5 py-4 text-xs text-[var(--color-text-secondary)] truncate max-w-[220px]">
                      <div className="truncate" title={m.courseTitle || ""}>
                        {m.courseTitle || "—"}
                      </div>
                      {m.moduleTitle && (
                        <div
                          className="text-[10px] text-[var(--color-text-secondary)] opacity-70 truncate"
                          title={m.moduleTitle}
                        >
                          {m.moduleTitle}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-[var(--color-text-secondary)] font-mono whitespace-nowrap">
                      {formatBytes(m.fileSize)}
                    </td>
                    <td className="px-5 py-4 text-xs text-[var(--color-text-secondary)] font-mono whitespace-nowrap">
                      {formatTs(m.deletedAt, locale)}
                    </td>
                    <td className="px-5 py-4 text-xs text-[var(--color-text-secondary)] truncate max-w-[160px]">
                      {m.deletedBy?.name || m.deletedBy?.email || "—"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setTarget(m)}
                        className="inline-flex items-center gap-1.5 px-2.5 h-8 text-xs font-medium text-[var(--color-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)]"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {t("restore")}
                      </button>
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
                  {t("restoreMaterialTitle")}
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  {t("restoreMaterialBody")}
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
                  {t("colMaterial")}
                </span>
                <span className="text-[var(--color-text-primary)] truncate max-w-[260px]" title={target.title}>
                  {target.title}
                </span>
              </div>
              <div className="flex justify-between gap-3 text-xs">
                <span className="text-[var(--color-text-secondary)]">
                  {t("colCourse")}
                </span>
                <span className="text-[var(--color-text-primary)] truncate max-w-[260px]" title={target.courseTitle || ""}>
                  {target.courseTitle || "—"}
                </span>
              </div>
              {target.moduleTitle && (
                <div className="flex justify-between gap-3 text-xs">
                  <span className="text-[var(--color-text-secondary)]">
                    {t("colModule")}
                  </span>
                  <span className="text-[var(--color-text-primary)] truncate max-w-[260px]" title={target.moduleTitle}>
                    {target.moduleTitle}
                  </span>
                </div>
              )}
              <div className="flex justify-between gap-3 text-xs">
                <span className="text-[var(--color-text-secondary)]">
                  {t("colSize")}
                </span>
                <span className="font-mono text-[var(--color-text-primary)]">
                  {formatBytes(target.fileSize)}
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
              <div className="flex justify-between gap-3 text-xs">
                <span className="text-[var(--color-text-secondary)]">
                  {t("colDeletedBy")}
                </span>
                <span className="text-[var(--color-text-primary)] truncate max-w-[260px]">
                  {target.deletedBy?.name || target.deletedBy?.email || "—"}
                </span>
              </div>
            </div>

            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-3 mb-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-[#D97706] mt-0.5 flex-shrink-0" />
              <p className="text-xs text-[#92400E] leading-relaxed">
                {t("restoreMaterialWarning")}
              </p>
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
                    {t("restoringMaterial")}
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    {t("restoreMaterialCta")}
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
