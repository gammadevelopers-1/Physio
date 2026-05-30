"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertTriangle,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  RotateCcw,
  X,
} from "lucide-react";
import {
  backupsAdminApi,
  type DeletedCourseEntry,
  type DeletedCoursesResponse,
} from "@/lib/api";

const PAGE_SIZE = 10;

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

function statusBadgeClass(status: string): string {
  switch (status) {
    case "draft":
      return "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
    case "pending_review":
    case "changes_requested":
      return "bg-[#FEF3C7] text-[#92400E]";
    case "active":
      return "bg-[#DCFCE7] text-[#15803D]";
    case "completed":
      return "bg-[#DBEAFE] text-[#1E40AF]";
    case "archived":
      return "bg-[#FEE2E2] text-[#B91C1C]";
    default:
      return "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
  }
}

interface Props {
  enabled: boolean;
}

export default function DeletedCoursesSection({ enabled }: Props) {
  const t = useTranslations("adminDashboard.settingsPage.backups");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DeletedCoursesResponse | null>(null);
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<DeletedCourseEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  const refresh = useCallback(
    async (targetPage = page) => {
      setLoading(true);
      try {
        const result = await backupsAdminApi
          .listDeletedCourses(targetPage, PAGE_SIZE)
          .catch(
            () =>
              ({
                items: [],
                total: 0,
                page: targetPage,
                limit: PAGE_SIZE,
                totalPages: 1,
              }) as DeletedCoursesResponse,
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
      await backupsAdminApi.restoreCourse(target.id);
      toast.success(t("courseRestoredToast", { title: target.title }));
      setTarget(null);
      await refresh(1);
      setPage(1);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("courseRestoreFailedToast"),
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
          <BookOpen className="w-4 h-4 text-[var(--color-primary)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("deletedCoursesTitle")}
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
        {t("deletedCoursesDesc")}
      </p>

      {!loading && data && data.items.length === 0 && (
        <div className="bg-[var(--color-surface-page)] border border-dashed border-[var(--color-border)] rounded-xl py-8 text-center text-sm text-[var(--color-text-secondary)]">
          {t("deletedCoursesEmpty")}
        </div>
      )}

      {loading && !data && (
        <div className="bg-[var(--color-surface-page)] border border-dashed border-[var(--color-border)] rounded-xl py-8 flex items-center justify-center text-sm text-[var(--color-text-secondary)]">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          {t("loadingDeletedCourses")}
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--color-surface-page)] border-b border-[var(--color-border)]">
              <tr>
                <Th isRTL={isRTL}>{t("colCourse")}</Th>
                <Th isRTL={isRTL} className="min-w-[120px]">{t("colCourseStatus")}</Th>
                <Th isRTL={isRTL} className="min-w-[140px]">{t("colInstructor")}</Th>
                <Th isRTL={isRTL} className="min-w-[160px]">{t("colDeletedAt")}</Th>
                <Th isRTL={isRTL} className="min-w-[140px]">{t("colDeletedBy")}</Th>
                <th className="px-5 py-3.5 w-32" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-[#F3F4F6] last:border-0"
                >
                  <td
                    className="px-5 py-4 text-xs text-[var(--color-text-primary)] truncate max-w-[260px]"
                    title={c.title}
                  >
                    {c.title}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${statusBadgeClass(c.status)}`}
                    >
                      {c.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-[var(--color-text-secondary)] truncate max-w-[140px]">
                    {c.instructor?.name || c.instructor?.email || "—"}
                  </td>
                  <td className="px-5 py-4 text-xs text-[var(--color-text-secondary)] font-mono whitespace-nowrap">
                    {formatTs(c.deletedAt, locale)}
                  </td>
                  <td className="px-5 py-4 text-xs text-[var(--color-text-secondary)] truncate max-w-[160px]">
                    {c.deletedBy?.name || c.deletedBy?.email || "—"}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => setTarget(c)}
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
                  {t("restoreCourseTitle")}
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  {t("restoreCourseBody")}
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
                  {t("colCourse")}
                </span>
                <span className="text-[var(--color-text-primary)] truncate max-w-[260px]" title={target.title}>
                  {target.title}
                </span>
              </div>
              <div className="flex justify-between gap-3 text-xs">
                <span className="text-[var(--color-text-secondary)]">
                  {t("colCourseStatus")}
                </span>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${statusBadgeClass(target.status)}`}
                >
                  {target.status.replace("_", " ")}
                </span>
              </div>
              <div className="flex justify-between gap-3 text-xs">
                <span className="text-[var(--color-text-secondary)]">
                  {t("colInstructor")}
                </span>
                <span className="text-[var(--color-text-primary)] truncate max-w-[260px]">
                  {target.instructor?.name || target.instructor?.email || "—"}
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

            <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-3 mb-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-[#1E40AF] mt-0.5 flex-shrink-0" />
              <p className="text-xs text-[#1E40AF] leading-relaxed">
                {t("restoreCourseNote")}
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
                    {t("restoringCourse")}
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    {t("restoreCourseCta")}
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
