"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import DateRangeFilter from "./DateRangeFilter";
import RefundDetailDrawer from "./RefundDetailDrawer";
import InitiateRefundModal from "./InitiateRefundModal";
import Money from "./shared/Money";
import { KPICardSkeleton, TableRowSkeleton } from "./shared/Skeleton";
import { FINANCE_COLORS, gatewayColor } from "./shared/financeColors";
import FinancePageShell from "./shared/FinancePageShell";
import Select from "@/components/admin-dashboard/Select";
import {
  Clock,
  CheckCircle,
  RotateCcw,
  AlertCircle,
  BarChart3,
  Hourglass,
  Search,
  Download,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Plus,
} from "lucide-react";
import { refundApi } from "@/lib/api";

const PAGE_SIZE = 25;

function getDefaultDateRange() {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const start = new Date(today);
  start.setDate(start.getDate() - 29);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: todayStr,
    label: "30d",
  };
}

const STATUS_PILL: Record<string, { bg: string; text: string }> = {
  pending: { bg: "bg-[#FEF3C7]", text: "text-[#92400E]" },
  approved: { bg: "bg-[#DBEAFE]", text: "text-[#1D4ED8]" },
  processing: { bg: "bg-[#DBEAFE]", text: "text-[#1D4ED8]" },
  completed: { bg: "bg-[#DCFCE7]", text: "text-[#15803D]" },
  rejected: { bg: "bg-[#FEE2E2]", text: "text-[#B91C1C]" },
  failed: { bg: "bg-[#FEE2E2]", text: "text-[#B91C1C]" },
};

function formatDateTime(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const lng = locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB";
  return d.toLocaleString(lng, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatAge(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const minutes = Math.floor((Date.now() - d.getTime()) / 60000);
  if (minutes < 60) {
    return locale === "ar"
      ? `قبل ${minutes} د`
      : `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return locale === "ar" ? `قبل ${hours} س` : `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return locale === "ar" ? `قبل ${days} يوم` : `${days}d ago`;
}

export interface RefundsContentProps {
  /** When true, render only the inner page (no FinanceNavbar/Sidebar). Used
   *  when an outer dashboard (e.g. AdminFinanceShell) already provides chrome. */
  embedded?: boolean;
}

const RefundsContent = ({ embedded = false }: RefundsContentProps) => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const ArrowGlyph = isRTL ? ArrowLeft : ArrowRight;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [dateRange, setDateRange] = useState<{
    startDate?: string;
    endDate?: string;
    label: string;
  }>(getDefaultDateRange);
  const [statusFilter, setStatusFilter] = useState("all");
  const [gatewayFilter, setGatewayFilter] = useState("all");
  const [reasonFilter, setReasonFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [rows, setRows] = useState<any[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [summary, setSummary] = useState<
    Awaited<ReturnType<typeof refundApi.getSummary>> | null
  >(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [selectedRefundId, setSelectedRefundId] = useState<string | null>(null);
  const [initiateOpen, setInitiateOpen] = useState(false);
  const [csvExporting, setCsvExporting] = useState(false);

  // Deep-link: ?refundId=...
  useEffect(() => {
    const rid = searchParams.get("refundId");
    if (rid && rid !== selectedRefundId) {
      setSelectedRefundId(rid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const openRefundDrawer = (id: string | null) => {
    setSelectedRefundId(id);
    const sp = new URLSearchParams(searchParams.toString());
    if (id) sp.set("refundId", id);
    else sp.delete("refundId");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(searchInput);
      setPage(1);
    }, 350);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, gatewayFilter, reasonFilter, dateRange]);

  const filters = {
    status: statusFilter,
    gateway: gatewayFilter,
    reason: reasonFilter,
    search: searchQuery,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  };

  const fetchRows = useCallback(async () => {
    setRowsLoading(true);
    try {
      const res = await refundApi.getAll(page, PAGE_SIZE, filters);
      setRows(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalCount(res.pagination?.total || 0);
    } catch {
      setRows([]);
    } finally {
      setRowsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    page,
    statusFilter,
    gatewayFilter,
    reasonFilter,
    searchQuery,
    dateRange.startDate,
    dateRange.endDate,
  ]);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await refundApi.getSummary({
        status: statusFilter,
        gateway: gatewayFilter,
        reason: reasonFilter,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      setSummary(res);
    } catch {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [
    statusFilter,
    gatewayFilter,
    reasonFilter,
    dateRange.startDate,
    dateRange.endDate,
  ]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const statusOptions = [
    { value: "all", label: t("refundsPage.filters.allStatuses") },
    { value: "pending", label: t("refundsPage.statusLabels.pending") },
    { value: "approved", label: t("refundsPage.statusLabels.approved") },
    { value: "processing", label: t("refundsPage.statusLabels.processing") },
    { value: "completed", label: t("refundsPage.statusLabels.completed") },
    { value: "rejected", label: t("refundsPage.statusLabels.rejected") },
    { value: "failed", label: t("refundsPage.statusLabels.failed") },
  ];

  const gatewayOptions = [
    { value: "all", label: t("refundsPage.filters.allGateways") },
    { value: "moyasar", label: "Moyasar" },
    { value: "tamara", label: "Tamara" },
    { value: "tabby", label: "Tabby" },
    { value: "bank_transfer", label: t("paymentsTable.filter.bankTransfer") },
  ];

  const reasonOptions = [
    { value: "all", label: t("refundsPage.filters.allReasons") },
    { value: "policy", label: t("refundsPage.reasonLabels.policy") },
    { value: "cancelled", label: t("refundsPage.reasonLabels.cancelled") },
    // Phase F fix: admin-initiated course cancellation gets its own
    // audit-honest label instead of falsely reading as buyer-initiated.
    { value: "course_cancelled", label: t("refundsPage.reasonLabels.course_cancelled") },
    { value: "duplicate", label: t("refundsPage.reasonLabels.duplicate") },
    { value: "technical", label: t("refundsPage.reasonLabels.technical") },
    { value: "other", label: t("refundsPage.reasonLabels.other") },
  ];

  const handleCsvExport = async () => {
    if (csvExporting) return;
    setCsvExporting(true);
    try {
      await refundApi.export({
        status: statusFilter !== "all" ? statusFilter : undefined,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
    } catch {
      // toast handled elsewhere; silent here
    } finally {
      setCsvExporting(false);
    }
  };

  const from = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, totalCount);

  const formatHours = (h: number) => {
    if (h <= 0) return "—";
    if (h < 48) return `${h.toFixed(1)}${t("refundsPage.kpi.hoursSuffix")}`;
    return `${(h / 24).toFixed(1)}${t("refundsPage.kpi.daysSuffix")}`;
  };

  const inner = (
    <>
      {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                    {t("refundsPage.title")}
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    {t("refundsPage.subtitle")}
                  </p>
                </div>
                <div className={`flex items-center gap-2 flex-wrap ${isRTL ? "flex-row-reverse" : ""}`}>
                  <button
                    type="button"
                    onClick={() => setInitiateOpen(true)}
                    className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t("refundsPage.initiateRefund")}
                  </button>
                  <DateRangeFilter onChange={setDateRange} defaultPreset="30d" />
                </div>
              </div>

              {/* KPI Cards — 6 real metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {summaryLoading ? (
                  <>
                    <KPICardSkeleton />
                    <KPICardSkeleton />
                    <KPICardSkeleton />
                    <KPICardSkeleton />
                    <KPICardSkeleton />
                    <KPICardSkeleton />
                  </>
                ) : (
                  <>
                    <StatCard
                      label={t("refundsPage.kpi.pendingTitle")}
                      value={(summary?.pendingCount || 0).toLocaleString("en-US")}
                      sublabel={
                        <Money
                          amount={summary?.pendingAmount || 0}
                          decimals={0}
                          iconSize={11}
                          className="text-xs text-[var(--color-text-secondary)]"
                        />
                      }
                      icon={Clock}
                      iconBg={FINANCE_COLORS.warning.bg}
                      iconColor={FINANCE_COLORS.warning.text}
                    />
                    <StatCard
                      label={t("refundsPage.kpi.inFlightTitle")}
                      value={(
                        (summary?.approvedCount || 0) +
                        (summary?.processingCount || 0)
                      ).toLocaleString("en-US")}
                      sublabel={
                        <Money
                          amount={summary?.inFlightAmount || 0}
                          decimals={0}
                          iconSize={11}
                          className="text-xs text-[var(--color-text-secondary)]"
                        />
                      }
                      icon={Hourglass}
                      iconBg={FINANCE_COLORS.info.bg}
                      iconColor={FINANCE_COLORS.info.text}
                    />
                    <StatCard
                      label={t("refundsPage.kpi.netRefundedTitle")}
                      value={(summary?.completedCount || 0).toLocaleString("en-US")}
                      sublabel={
                        <Money
                          amount={summary?.netRefundedAmount || 0}
                          decimals={0}
                          iconSize={11}
                          className="text-xs text-[var(--color-text-secondary)]"
                        />
                      }
                      icon={RotateCcw}
                      iconBg={FINANCE_COLORS.success.bg}
                      iconColor={FINANCE_COLORS.success.text}
                    />
                    <StatCard
                      label={t("refundsPage.kpi.deductionTitle")}
                      value={
                        <Money
                          amount={summary?.deductionCaptured || 0}
                          decimals={0}
                          iconSize={14}
                          className="text-xl font-bold text-[var(--color-text-primary)]"
                        />
                      }
                      sublabel={t("refundsPage.kpi.deductionSubtitle")}
                      icon={AlertCircle}
                      iconBg={FINANCE_COLORS.warning.bgSoft}
                      iconColor={FINANCE_COLORS.warning.text}
                    />
                    <StatCard
                      label={t("refundsPage.kpi.refundRateTitle")}
                      value={`${(summary?.refundRateByAmount || 0).toFixed(2)}%`}
                      sublabel={t("refundsPage.kpi.refundRateSubtitle")}
                      icon={BarChart3}
                      iconBg={FINANCE_COLORS.violet.bg}
                      iconColor={FINANCE_COLORS.violet.text}
                    />
                    <StatCard
                      label={t("refundsPage.kpi.avgResolutionTitle")}
                      value={formatHours(summary?.avgResolutionHours || 0)}
                      sublabel={t("refundsPage.kpi.avgResolutionSubtitle")}
                      icon={CheckCircle}
                      iconBg={FINANCE_COLORS.info.bgSoft}
                      iconColor={FINANCE_COLORS.info.text}
                    />
                  </>
                )}
              </div>

              {/* Deduction Rules Banner */}
              <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-3 mb-4">
                <div className={`flex items-center gap-2 mb-1.5 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <AlertCircle className="w-4 h-4 text-[#D97706]" />
                  <h4 className="text-[13px] font-semibold text-[#92400E]">
                    {t("refundsPage.bulkRules.title")}
                  </h4>
                </div>
                <ul className={`space-y-0.5 text-[12px] text-[#92400E] ${isRTL ? "text-right" : ""}`}>
                  <li>· {t("refundsPage.bulkRules.moyasar")}</li>
                  <li>· {t("refundsPage.bulkRules.tamara")}</li>
                  <li>· {t("refundsPage.bulkRules.tabby")}</li>
                </ul>
              </div>

              {/* Filter Bar */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-3 mb-4">
                <div className={`flex flex-wrap items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <div className="flex-1 min-w-[200px] relative">
                    <Search
                      className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${
                        isRTL ? "right-3" : "left-3"
                      }`}
                    />
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder={
                        t("refundsPage.initiateModal.searchPlaceholder") ||
                        "Search…"
                      }
                      className={`w-full h-9 ${
                        isRTL ? "pr-9 pl-3" : "pl-9 pr-3"
                      } text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)] bg-[var(--color-surface-page)] text-[var(--color-text-primary)]`}
                    />
                  </div>
                  <div className="w-[150px]">
                    <Select
                      value={statusFilter}
                      onChange={setStatusFilter}
                      options={statusOptions}
                      size="sm"
                    />
                  </div>
                  <div className="w-[150px]">
                    <Select
                      value={gatewayFilter}
                      onChange={setGatewayFilter}
                      options={gatewayOptions}
                      size="sm"
                    />
                  </div>
                  <div className="w-[150px]">
                    <Select
                      value={reasonFilter}
                      onChange={setReasonFilter}
                      options={reasonOptions}
                      size="sm"
                    />
                  </div>
                  <button
                    onClick={handleCsvExport}
                    disabled={csvExporting}
                    className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)] disabled:opacity-50"
                  >
                    {csvExporting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    CSV
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden mb-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--color-border)]">
                        <Th isRTL={isRTL}>
                          {t("refundsPage.drawer.overview.requester")}
                        </Th>
                        <Th isRTL={isRTL}>
                          {t("invoicesPage.table.date")}
                        </Th>
                        <Th isRTL={isRTL} hideOnMobile>
                          {t("refundsPage.drawer.overview.course")}
                        </Th>
                        <Th isRTL={isRTL} hideOnMobile>
                          {t("refundsPage.drawer.overview.gateway")}
                        </Th>
                        <Th isRTL={isRTL} hideOnMobile>
                          {t("refundsPage.drawer.overview.reason")}
                        </Th>
                        <Th isRTL={isRTL}>
                          {t("refundsPage.drawer.overview.refundAmount")}
                        </Th>
                        <Th isRTL={isRTL}>
                          {t("refundsPage.drawer.overview.status")}
                        </Th>
                        <th className="py-3 px-4 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rowsLoading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                          <TableRowSkeleton key={i} cols={8} />
                        ))
                      ) : rows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="text-center text-sm text-[var(--color-text-secondary)] py-12"
                          >
                            {t("refundsPage.list.empty")}
                          </td>
                        </tr>
                      ) : (
                        rows.map((r) => (
                          <RefundRow
                            key={r.id}
                            r={r}
                            isRTL={isRTL}
                            locale={locale}
                            t={t}
                            ArrowGlyph={ArrowGlyph}
                            onClick={() => openRefundDrawer(r.id)}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {!rowsLoading && totalCount > 0 && (
                  <div
                    className={`flex items-center justify-between px-4 py-3 border-t border-[var(--color-border-subtle)] ${
                      isRTL ? "flex-row-reverse" : ""
                    }`}
                  >
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {t("paymentsTable.pagination.showing", {
                        from,
                        to,
                        total: totalCount,
                      })}
                    </p>
                    <div
                      className={`flex items-center gap-1 ${isRTL ? "flex-row-reverse" : ""}`}
                    >
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-[var(--color-border)] disabled:opacity-40 hover:bg-[var(--color-surface-page)]"
                        aria-label="Previous"
                      >
                        {isRTL ? (
                          <ChevronRight className="w-4 h-4" />
                        ) : (
                          <ChevronLeft className="w-4 h-4" />
                        )}
                      </button>
                      <span className="text-xs px-2 text-[var(--color-text-secondary)]">
                        {page} / {totalPages}
                      </span>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-[var(--color-border)] disabled:opacity-40 hover:bg-[var(--color-surface-page)]"
                        aria-label="Next"
                      >
                        {isRTL ? (
                          <ChevronLeft className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
    </>
  );

  return (
    <>
      {embedded ? inner : <FinancePageShell>{inner}</FinancePageShell>}
      <RefundDetailDrawer
        refundId={selectedRefundId}
        onClose={() => openRefundDrawer(null)}
        onChanged={() => {
          fetchRows();
          fetchSummary();
        }}
      />

      <InitiateRefundModal
        open={initiateOpen}
        onClose={() => setInitiateOpen(false)}
        onCreated={(newId) => {
          fetchRows();
          fetchSummary();
          if (newId) openRefundDrawer(newId);
        }}
      />
    </>
  );
};

function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string | React.ReactNode;
  sublabel: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 flex items-start gap-3">
      <div
        className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}
      >
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[var(--color-text-secondary)] font-medium">
          {label}
        </p>
        <div className="text-xl font-bold text-[var(--color-text-primary)] mt-0.5">
          {value}
        </div>
        <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
          {sublabel}
        </div>
      </div>
    </div>
  );
}

function Th({
  children,
  isRTL,
  hideOnMobile,
}: {
  children: React.ReactNode;
  isRTL: boolean;
  hideOnMobile?: boolean;
}) {
  return (
    <th
      scope="col"
      className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${
        isRTL ? "text-right" : "text-left"
      } ${hideOnMobile ? "hidden md:table-cell" : ""}`}
    >
      {children}
    </th>
  );
}

function RefundRow({
  r,
  isRTL,
  locale,
  t,
  ArrowGlyph,
  onClick,
}: {
  r: any;
  isRTL: boolean;
  locale: string;
  t: ReturnType<typeof useTranslations>;
  ArrowGlyph: typeof ArrowRight;
  onClick: () => void;
}) {
  const status = r.status as string;
  const pill = STATUS_PILL[status] || STATUS_PILL.pending;
  const gw = r.gateway || null;
  const courseTitle =
    (locale === "ar" ? r.courseTitleAr : r.courseTitle) ||
    r.courseTitle ||
    "—";
  const reason =
    t(`refundsPage.reasonLabels.${r.reason}` as any) || r.reason;

  return (
    <tr
      onClick={onClick}
      className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-page)] cursor-pointer transition-colors"
    >
      <td className="py-3 px-4">
        <p className="text-[13px] font-medium text-[var(--color-text-primary)] truncate max-w-[180px]">
          {r.requesterName || "—"}
        </p>
        {r.requesterEmail && (
          <p className="text-[11px] text-[var(--color-text-secondary)] truncate max-w-[180px]">
            {r.requesterEmail}
          </p>
        )}
      </td>
      <td className="py-3 px-4 text-[12px] text-[var(--color-text-secondary)] whitespace-nowrap">
        {formatDateTime(r.createdAt, locale)}
        <p className="text-[10px] text-[var(--color-text-secondary)] opacity-70 mt-0.5">
          {formatAge(r.createdAt, locale)}
        </p>
      </td>
      <td className="py-3 px-4 text-[13px] text-[var(--color-text-secondary)] hidden md:table-cell">
        <span className="truncate inline-block max-w-[160px] align-middle">
          {courseTitle}
        </span>
        {typeof r.refundedCourseCount === "number" &&
          r.refundedCourseCount > 1 && (
            <span className="ms-1 text-[10px] uppercase tracking-wide bg-[#EDE9FE] text-[#6D28D9] rounded px-1.5 py-0.5 font-medium align-middle">
              +{r.refundedCourseCount - 1}
            </span>
          )}
      </td>
      <td className="py-3 px-4 hidden md:table-cell">
        {gw && (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-primary)] capitalize">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: gatewayColor(gw) }}
            />
            {gw.replace(/_/g, " ")}
          </span>
        )}
      </td>
      <td className="py-3 px-4 text-[12px] text-[var(--color-text-secondary)] hidden md:table-cell">
        {reason}
      </td>
      <td className="py-3 px-4">
        <Money
          amount={Number(r.refundAmount || 0)}
          decimals={2}
          iconSize={12}
          className="font-semibold text-[var(--color-text-primary)]"
        />
        {Number(r.deductionAmount || 0) > 0 && (
          <p className="text-[10px] text-[var(--color-text-secondary)] line-through">
            <Money
              amount={Number(r.originalAmount || 0)}
              decimals={2}
              iconSize={10}
              className="text-[var(--color-text-secondary)]"
              showIcon={false}
            />
          </p>
        )}
      </td>
      <td className="py-3 px-4">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${pill.bg} ${pill.text}`}
        >
          {t(`refundsPage.statusLabels.${status}` as any) || status}
        </span>
      </td>
      <td className="py-3 px-4 text-[var(--color-text-secondary)]">
        <ArrowGlyph className="w-4 h-4" />
      </td>
    </tr>
  );
}

export default RefundsContent;
