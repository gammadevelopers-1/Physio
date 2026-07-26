"use client";

/**
 * Admin — Points → Course Redemptions tab.
 *
 * Itemized detail view for every point-based course unlock (rows in
 * `point_redemptions` with status='applied'). Companion to the finance
 * reports "Point redemptions" summary line — this tab is where the admin
 * drills into who spent points on which course.
 *
 * Data source: GET /admin/points/course-redemptions (paginated + filtered).
 * Summary tiles read from the response's `summary` block which is scoped
 * to the whole filtered set (not just the current page).
 */

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowDownToLine,
  BookOpen,
  Coins,
  Loader2,
  Sparkles,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import {
  pointsAdminApi,
  type AdminCourseRedemptionFilters,
  type AdminCourseRedemptionRow,
  type AdminCourseRedemptionsPage,
  type AdminCourseRedemption,
} from "@/lib/api";
import DatePicker from "@/components/ui/DatePicker";
import Select from "@/components/ui/Select";

const PAGE_SIZE = 20;

type StatusFilter = "all" | "active" | "completed" | "dropped" | "suspended";

export default function CourseRedemptionsTab() {
  const t = useTranslations("adminDashboard.points.courseRedemptions");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [page, setPage] = useState(1);
  const [pageData, setPageData] = useState<AdminCourseRedemptionsPage | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters — kept as separate primitives so we can memoise the composite
  // filter object below without re-fetching on unrelated state changes.
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [courseId, setCourseId] = useState<string>("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Debounce the search input so typing doesn't fire per-keystroke fetches.
  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(h);
  }, [search]);

  // Reset to page 1 whenever any filter changes — otherwise pagination can
  // land the user on a page number outside the new filtered result set.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, courseId, status, startDate, endDate]);

  const filters: AdminCourseRedemptionFilters = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      courseId: courseId || undefined,
      status: status !== "all" ? status : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    [page, debouncedSearch, courseId, status, startDate, endDate],
  );

  // Eligible-course options for the course filter dropdown. Same endpoint
  // the Eligible Courses tab uses — every course with a redemption row.
  const [courses, setCourses] = useState<AdminCourseRedemption[] | null>(null);
  useEffect(() => {
    pointsAdminApi
      .listCourses()
      .then((rows) => setCourses(rows.filter((c) => c.configured)))
      .catch(() => setCourses([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    pointsAdminApi
      .listCourseRedemptions(filters)
      .then((page) => {
        if (!cancelled) setPageData(page);
      })
      .catch(() => {
        if (!cancelled) toast.error(t("errors.loadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters, t]);

  const handleExport = async () => {
    setExporting(true);
    try {
      // Export shares the same filter object as the on-screen list; the
      // backend derives the same WHERE clause so the CSV can't ever
      // disagree with what the admin sees in the table.
      await pointsAdminApi.exportCourseRedemptionsCsv({
        ...filters,
        page: undefined,
        limit: undefined,
      });
      toast.success(t("exportSuccess"));
    } catch {
      toast.error(t("errors.exportFailed"));
    } finally {
      setExporting(false);
    }
  };

  const items = pageData?.items ?? [];
  const total = pageData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const summary = pageData?.summary;

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-4">
      {/* ── Summary strip ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryTile
          icon={Sparkles}
          label={t("summary.count")}
          value={summary ? summary.count.toLocaleString(locale) : "—"}
        />
        <SummaryTile
          icon={Coins}
          label={t("summary.points")}
          value={
            summary ? summary.totalPointsSpent.toLocaleString(locale) : "—"
          }
        />
        <SummaryTile
          icon={BookOpen}
          label={t("summary.sar")}
          value={
            summary
              ? `${summary.equivalentValueSar.toLocaleString(locale, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} SAR`
              : "—"
          }
        />
      </div>

      {/* ── Filter bar ────────────────────────────────────────── */}
      <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-3 sm:p-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 flex-1">
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-secondary)] mb-1">
                {t("filters.search")}
              </label>
              <div className="relative">
                <Search
                  className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "end-3" : "start-3"}`}
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("filters.searchPlaceholder")}
                  className={`w-full h-10 py-2 text-sm border border-[var(--color-input-border)] rounded-lg bg-[var(--color-surface-page)] ${isRTL ? "pe-10 ps-3" : "ps-10 pe-3"}`}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-secondary)] mb-1">
                {t("filters.course")}
              </label>
              <Select
                value={courseId}
                onChange={setCourseId}
                className="w-full"
                options={[
                  { value: "", label: t("filters.allCourses") },
                  ...(courses ?? []).map((c) => ({
                    value: c.id,
                    label: isRTL && c.titleAr ? c.titleAr : c.title,
                  })),
                ]}
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-secondary)] mb-1">
                {t("filters.status")}
              </label>
              <Select
                value={status}
                onChange={(v) => setStatus(v as StatusFilter)}
                className="w-full"
                options={[
                  { value: "all", label: t("statuses.all") },
                  { value: "active", label: t("statuses.active") },
                  { value: "completed", label: t("statuses.completed") },
                  { value: "dropped", label: t("statuses.dropped") },
                  { value: "suspended", label: t("statuses.suspended") },
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-secondary)] mb-1">
                  {t("filters.startDate")}
                </label>
                <DatePicker
                  value={startDate}
                  onChange={setStartDate}
                  placeholder={t("filters.startDate")}
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-secondary)] mb-1">
                  {t("filters.endDate")}
                </label>
                <DatePicker
                  value={endDate}
                  onChange={setEndDate}
                  min={startDate || undefined}
                  placeholder={t("filters.endDate")}
                />
              </div>
            </div>
          </div>

          <div className="flex md:justify-end">
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || total === 0}
              className="inline-flex items-center gap-2 h-10 px-3 text-sm font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary)]/20 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowDownToLine className="w-4 h-4" />
              )}
              {t("exportCsv")}
            </button>
          </div>
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────── */}
      <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)]">
        {loading && !pageData ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState t={t} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
                <tr>
                  <th className="text-start px-4 py-3 font-medium whitespace-nowrap">
                    {t("columns.date")}
                  </th>
                  <th className="text-start px-4 py-3 font-medium">
                    {t("columns.student")}
                  </th>
                  <th className="text-start px-4 py-3 font-medium">
                    {t("columns.course")}
                  </th>
                  <th className="text-end px-4 py-3 font-medium whitespace-nowrap">
                    {t("columns.points")}
                  </th>
                  <th className="text-end px-4 py-3 font-medium whitespace-nowrap">
                    {t("columns.sar")}
                  </th>
                  <th className="text-start px-4 py-3 font-medium whitespace-nowrap">
                    {t("columns.status")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {items.map((row) => (
                  <RedemptionRow
                    key={row.redemptionId}
                    row={row}
                    isRTL={isRTL}
                    dateFmt={dateFmt}
                    locale={locale}
                    t={t}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ────────────────────────────────────── */}
        {total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
            <p className="text-xs text-[var(--color-text-secondary)]">
              {t("pagination.showing", {
                shown: items.length,
                total,
              })}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("pagination.prev")}
              </button>
              <span className="text-xs text-[var(--color-text-secondary)]">
                {t("pagination.pageOf", { page, total: totalPages })}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("pagination.next")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-[var(--color-primary)]" />
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] font-semibold">
          {label}
        </p>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
        {value}
      </p>
    </div>
  );
}

function EmptyState({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] flex items-center justify-center mx-auto mb-3">
        <Sparkles className="w-7 h-7 text-[#B45309]" />
      </div>
      <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
        {t("empty.title")}
      </h3>
      <p className="text-sm text-[var(--color-text-secondary)] max-w-sm mx-auto">
        {t("empty.body")}
      </p>
    </div>
  );
}

function RedemptionRow({
  row,
  isRTL,
  dateFmt,
  locale,
  t,
}: {
  row: AdminCourseRedemptionRow;
  isRTL: boolean;
  dateFmt: Intl.DateTimeFormat;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const studentName =
    [row.user.firstName, row.user.lastName].filter(Boolean).join(" ") ||
    row.user.email;
  const courseTitle =
    (isRTL && row.course.titleAr) || row.course.title || "—";
  const status = row.enrollment?.status ?? null;

  return (
    <tr className="hover:bg-[var(--color-surface-page)]/50">
      <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
        {dateFmt.format(new Date(row.redeemedAt))}
      </td>
      <td className="px-4 py-3">
        <p className="text-[var(--color-text-primary)] font-medium truncate max-w-[220px]">
          {studentName}
        </p>
        <p className="text-[11px] text-[var(--color-text-secondary)] truncate max-w-[220px]">
          {row.user.email}
        </p>
      </td>
      <td className="px-4 py-3">
        <p className="text-[var(--color-text-primary)] truncate max-w-[240px]">
          {courseTitle}
        </p>
        <p className="text-[11px] text-[var(--color-text-secondary)]">
          {row.course.priceSar.toLocaleString(locale)} SAR
        </p>
      </td>
      <td
        className="px-4 py-3 text-end font-semibold text-[var(--color-primary)] whitespace-nowrap"
        dir="ltr"
      >
        −{row.pointsSpent.toLocaleString(locale)}
      </td>
      <td
        className="px-4 py-3 text-end text-[var(--color-text-primary)] whitespace-nowrap"
        dir="ltr"
      >
        {row.equivalentSar.toLocaleString(locale, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <StatusChip status={status} t={t} />
      </td>
    </tr>
  );
}

function StatusChip({
  status,
  t,
}: {
  status: string | null;
  t: ReturnType<typeof useTranslations>;
}) {
  if (!status) {
    return (
      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
        {t("statuses.unknown")}
      </span>
    );
  }
  const map: Record<string, { bg: string; fg: string; labelKey: string }> = {
    active: {
      bg: "bg-[#DCFCE7]",
      fg: "text-[#15803D]",
      labelKey: "statuses.active",
    },
    completed: {
      bg: "bg-[#DBEAFE]",
      fg: "text-[#1D4ED8]",
      labelKey: "statuses.completed",
    },
    dropped: {
      bg: "bg-[#FEE2E2]",
      fg: "text-[#B91C1C]",
      labelKey: "statuses.dropped",
    },
    suspended: {
      bg: "bg-[#FEF3C7]",
      fg: "text-[#92400E]",
      labelKey: "statuses.suspended",
    },
    pending_payment: {
      bg: "bg-[#FEF3C7]",
      fg: "text-[#92400E]",
      labelKey: "statuses.pendingPayment",
    },
  };
  const style = map[status] ?? {
    bg: "bg-[var(--color-border-subtle)]",
    fg: "text-[var(--color-text-secondary)]",
    labelKey: "statuses.unknown",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${style.bg} ${style.fg}`}
    >
      {t(
        style.labelKey as
          | "statuses.active"
          | "statuses.completed"
          | "statuses.dropped"
          | "statuses.suspended"
          | "statuses.pendingPayment"
          | "statuses.unknown",
      )}
    </span>
  );
}
