"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Clock,
  ShieldCheck,
  ShieldQuestion,
  ShieldX,
  ShieldAlert,
  CheckCircle,
  AlertOctagon,
  Hourglass,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import DateRangeFilter from "./DateRangeFilter";
import BankTransferDetailDrawer from "./BankTransferDetailDrawer";
import Money from "./shared/Money";
import { KPICardSkeleton, TableRowSkeleton } from "./shared/Skeleton";
import { FINANCE_COLORS } from "./shared/financeColors";
import FinancePageShell from "./shared/FinancePageShell";
import Select from "@/components/admin-dashboard/Select";
import {
  financeBankTransferApi,
  financeApi,
  type BankTransferQueueItem,
} from "@/lib/api";

const PAGE_SIZE = 25;

type TabKey = "pending" | "approved" | "rejected" | "all";
type ScanFilter = "all" | "clean" | "pending" | "infected" | "error";

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

const REVIEW_PILL: Record<string, { bg: string; text: string }> = {
  pending: { bg: "bg-[#FEF3C7]", text: "text-[#92400E]" },
  approved: { bg: "bg-[#DCFCE7]", text: "text-[#15803D]" },
  rejected: { bg: "bg-[#FEE2E2]", text: "text-[#B91C1C]" },
};

const SCAN_PILL: Record<string, { bg: string; text: string; Icon: typeof ShieldCheck }> = {
  clean: { bg: "bg-[#DCFCE7]", text: "text-[#15803D]", Icon: ShieldCheck },
  pending: { bg: "bg-[#FEF3C7]", text: "text-[#92400E]", Icon: ShieldQuestion },
  infected: { bg: "bg-[#FEE2E2]", text: "text-[#B91C1C]", Icon: ShieldX },
  error: { bg: "bg-[#FEE2E2]", text: "text-[#B91C1C]", Icon: ShieldAlert },
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
  if (minutes < 1) return locale === "ar" ? "الآن" : "Just now";
  if (minutes < 60) return locale === "ar" ? `قبل ${minutes} د` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return locale === "ar" ? `قبل ${hours} س` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return locale === "ar" ? `قبل ${days} يوم` : `${days}d ago`;
}

function ageColor(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "text-[var(--color-text-secondary)]";
  const hours = (Date.now() - d.getTime()) / 3_600_000;
  if (hours >= 48) return "text-[#B91C1C] font-medium";
  if (hours >= 24) return "text-[#D97706] font-medium";
  if (hours >= 6) return "text-[#1D4ED8]";
  return "text-[#15803D]";
}

export interface BankTransferQueueContentProps {
  /** When true, render only the inner page (no FinanceNavbar/Sidebar). Used
   *  when an outer dashboard (e.g. AdminFinanceShell) already provides chrome. */
  embedded?: boolean;
}

export default function BankTransferQueueContent({ embedded = false }: BankTransferQueueContentProps) {
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
  const [tab, setTab] = useState<TabKey>("pending");
  const [scanFilter, setScanFilter] = useState<ScanFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [rows, setRows] = useState<BankTransferQueueItem[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [tabCounts, setTabCounts] = useState<Record<TabKey, number>>({
    pending: 0,
    approved: 0,
    rejected: 0,
    all: 0,
  });

  const [summary, setSummary] = useState<
    Awaited<ReturnType<typeof financeBankTransferApi.getSummary>> | null
  >(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [aging, setAging] = useState<
    Awaited<ReturnType<typeof financeApi.getBankTransferReviewAging>> | null
  >(null);
  const [agingLoading, setAgingLoading] = useState(true);

  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  // Deep-link: ?receiptId= opens the drawer; ?scan= / ?status= pre-apply
  // filters (used by the Invoices page aging buckets that land here).
  useEffect(() => {
    const rid = searchParams.get("receiptId");
    if (rid && rid !== selectedReceiptId) {
      setSelectedReceiptId(rid);
    }
    const scan = searchParams.get("scan");
    if (scan === "pending" || scan === "clean" || scan === "infected" || scan === "error") {
      setScanFilter(scan as ScanFilter);
    }
    const status = searchParams.get("status");
    if (status === "pending" || status === "approved" || status === "rejected" || status === "all") {
      setTab(status as TabKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const openDrawer = (id: string | null) => {
    setSelectedReceiptId(id);
    const sp = new URLSearchParams(searchParams.toString());
    if (id) sp.set("receiptId", id);
    else sp.delete("receiptId");
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
  }, [tab, scanFilter, dateRange]);

  const fetchRows = useCallback(async () => {
    setRowsLoading(true);
    try {
      const res = await financeBankTransferApi.listQueue({
        status: tab,
        search: searchQuery || undefined,
        page,
        limit: PAGE_SIZE,
      });
      let data = res.data || [];
      // Client-side scan filter (backend doesn't expose it on listQueue;
      // dataset per page is small so this is fine).
      if (scanFilter !== "all") {
        data = data.filter((r) => r.scanStatus === scanFilter);
      }
      setRows(data);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalCount(res.pagination?.total || 0);
    } catch {
      setRows([]);
    } finally {
      setRowsLoading(false);
    }
  }, [tab, scanFilter, searchQuery, page]);

  const fetchTabCounts = useCallback(async () => {
    try {
      const [pending, approved, rejected, all] = await Promise.all([
        financeBankTransferApi.listQueue({ status: "pending", limit: 1 }),
        financeBankTransferApi.listQueue({ status: "approved", limit: 1 }),
        financeBankTransferApi.listQueue({ status: "rejected", limit: 1 }),
        financeBankTransferApi.listQueue({ status: "all", limit: 1 }),
      ]);
      setTabCounts({
        pending: pending.pagination?.total || 0,
        approved: approved.pagination?.total || 0,
        rejected: rejected.pagination?.total || 0,
        all: all.pagination?.total || 0,
      });
    } catch {
      /* silent */
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await financeBankTransferApi.getSummary({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      setSummary(res);
    } catch {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [dateRange.startDate, dateRange.endDate]);

  const fetchAging = useCallback(async () => {
    setAgingLoading(true);
    try {
      const res = await financeApi.getBankTransferReviewAging();
      setAging(res);
    } catch {
      setAging(null);
    } finally {
      setAgingLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);
  useEffect(() => {
    fetchTabCounts();
  }, [fetchTabCounts]);
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);
  useEffect(() => {
    fetchAging();
  }, [fetchAging]);

  const refreshAll = () => {
    fetchRows();
    fetchTabCounts();
    fetchSummary();
    fetchAging();
  };

  const scanOptions = [
    { value: "all", label: t("bankTransferQueue.filters.allScanStatuses") },
    { value: "clean", label: t("bankTransferQueue.scan.clean") },
    { value: "pending", label: t("bankTransferQueue.scan.pending") },
    { value: "infected", label: t("bankTransferQueue.scan.infected") },
    { value: "error", label: t("bankTransferQueue.scan.error") },
  ];

  const formatHours = (h: number) => {
    if (h <= 0) return t("bankTransferQueue.kpi.noneYet");
    if (h < 48) return `${h.toFixed(1)}${t("bankTransferQueue.kpi.hoursSuffix")}`;
    return `${(h / 24).toFixed(1)}${t("bankTransferQueue.kpi.daysSuffix")}`;
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: "pending", label: t("bankTransferQueue.tabs.pending") },
    { key: "approved", label: t("bankTransferQueue.tabs.approved") },
    { key: "rejected", label: t("bankTransferQueue.tabs.rejected") },
    { key: "all", label: t("bankTransferQueue.tabs.all") },
  ];

  const from = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, totalCount);

  const inner = (
    <>
      {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                    {t("bankTransferQueue.title")}
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    {t("bankTransferQueue.subtitle")}
                  </p>
                </div>
                <DateRangeFilter onChange={setDateRange} defaultPreset="30d" />
              </div>

              {/* KPI Cards */}
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
                      label={t("bankTransferQueue.kpi.pendingTitle")}
                      value={(summary?.live.pendingCount ?? 0).toLocaleString("en-US")}
                      sublabel={
                        <Money
                          amount={summary?.live.pendingAmount || 0}
                          decimals={0}
                          iconSize={11}
                          className="text-xs text-[var(--color-text-secondary)]"
                        />
                      }
                      icon={Hourglass}
                      iconBg={FINANCE_COLORS.warning.bg}
                      iconColor={FINANCE_COLORS.warning.text}
                    />
                    <StatCard
                      label={t("bankTransferQueue.kpi.oldestPendingTitle")}
                      value={formatHours(summary?.live.oldestPendingHours ?? 0)}
                      sublabel={t("bankTransferQueue.kpi.oldestPendingSubtitle")}
                      icon={Clock}
                      iconBg={(summary?.live.oldestPendingHours ?? 0) > 24 ? FINANCE_COLORS.error.bg : FINANCE_COLORS.info.bg}
                      iconColor={(summary?.live.oldestPendingHours ?? 0) > 24 ? FINANCE_COLORS.error.text : FINANCE_COLORS.info.text}
                    />
                    <StatCard
                      label={t("bankTransferQueue.kpi.approvedTitle")}
                      value={(summary?.window.approvedCount ?? 0).toLocaleString("en-US")}
                      sublabel={
                        <Money
                          amount={summary?.window.approvedAmount || 0}
                          decimals={0}
                          iconSize={11}
                          className="text-xs text-[var(--color-text-secondary)]"
                        />
                      }
                      icon={CheckCircle}
                      iconBg={FINANCE_COLORS.success.bg}
                      iconColor={FINANCE_COLORS.success.text}
                    />
                    <StatCard
                      label={t("bankTransferQueue.kpi.rejectedTitle")}
                      value={(summary?.window.rejectedCount ?? 0).toLocaleString("en-US")}
                      sublabel={t("bankTransferQueue.kpi.rejectedSubtitle")}
                      icon={XCircle}
                      iconBg={FINANCE_COLORS.error.bg}
                      iconColor={FINANCE_COLORS.error.text}
                    />
                    <StatCard
                      label={t("bankTransferQueue.kpi.scanPendingTitle")}
                      value={(summary?.live.scanPendingCount ?? 0).toLocaleString("en-US")}
                      sublabel={t("bankTransferQueue.kpi.scanPendingSubtitle")}
                      icon={ShieldQuestion}
                      iconBg={FINANCE_COLORS.violet.bg}
                      iconColor={FINANCE_COLORS.violet.text}
                    />
                    <StatCard
                      label={t("bankTransferQueue.kpi.avgReviewTitle")}
                      value={formatHours(summary?.window.avgReviewHours ?? 0)}
                      sublabel={t("bankTransferQueue.kpi.avgReviewSubtitle")}
                      icon={CheckCircle2}
                      iconBg={FINANCE_COLORS.info.bgSoft}
                      iconColor={FINANCE_COLORS.info.text}
                    />
                  </>
                )}
              </div>

              {/* Aging strip */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-4 mb-6">
                <div className={`flex items-center justify-between gap-2 mb-1 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <Clock className="w-4 h-4 text-[#EA580C]" />
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {t("bankTransferQueue.agingStrip.title")}
                    </h3>
                  </div>
                  {aging && (
                    <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
                      {t("bankTransferQueue.agingStrip.asOf", {
                        when: new Date(aging.asOf).toLocaleTimeString(
                          locale === "ar" ? "ar-SA-u-nu-latn" : "en-US",
                          { hour: "2-digit", minute: "2-digit", hour12: false },
                        ),
                      })}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--color-text-secondary)] mb-3">
                  {t("bankTransferQueue.agingStrip.subtitle")}
                </p>
                {agingLoading || !aging ? (
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <KPICardSkeleton key={i} />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <AgeBucket
                      label={t("bankTransferQueue.agingStrip.buckets.underSix")}
                      count={aging.underSix.count}
                      amount={aging.underSix.amount}
                      color="bg-[#16A34A]"
                      t={t}
                    />
                    <AgeBucket
                      label={t("bankTransferQueue.agingStrip.buckets.sixToDay")}
                      count={aging.sixToDay.count}
                      amount={aging.sixToDay.amount}
                      color="bg-[#3B82F6]"
                      t={t}
                    />
                    <AgeBucket
                      label={t("bankTransferQueue.agingStrip.buckets.dayToTwo")}
                      count={aging.dayToTwo.count}
                      amount={aging.dayToTwo.amount}
                      color="bg-[#D97706]"
                      t={t}
                    />
                    <AgeBucket
                      label={t("bankTransferQueue.agingStrip.buckets.beyondTwo")}
                      count={aging.beyondTwo.count}
                      amount={aging.beyondTwo.amount}
                      color="bg-[#DC2626]"
                      urgent={aging.beyondTwo.count > 0}
                      t={t}
                    />
                    <AgeBucket
                      label={t("bankTransferQueue.agingStrip.buckets.scanQueue")}
                      count={aging.scanQueue.count}
                      amount={aging.scanQueue.amount}
                      color="bg-[#7C3AED]"
                      t={t}
                    />
                  </div>
                )}
              </div>

              {/* Filter bar */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-3 mb-4">
                <div className={`flex flex-wrap items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <div className="flex gap-1 bg-[var(--color-surface-page)] rounded-lg p-0.5 w-fit">
                    {tabs.map((tb) => (
                      <button
                        key={tb.key}
                        type="button"
                        onClick={() => setTab(tb.key)}
                        className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                          tab === tb.key
                            ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                        }`}
                      >
                        {tb.label}
                        <span
                          className={`text-[10px] px-1 rounded-full ${
                            tab === tb.key
                              ? "bg-[var(--color-primary)] text-white"
                              : "bg-[var(--color-border)] text-[var(--color-text-secondary)]"
                          }`}
                        >
                          {tabCounts[tb.key]}
                        </span>
                      </button>
                    ))}
                  </div>
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
                      placeholder={t("bankTransferQueue.searchPlaceholder")}
                      className={`w-full h-9 ${
                        isRTL ? "pr-9 pl-3" : "pl-9 pr-3"
                      } text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)] bg-[var(--color-surface-page)] text-[var(--color-text-primary)]`}
                    />
                  </div>
                  <div className="w-[160px]">
                    <Select
                      value={scanFilter}
                      onChange={(v) => setScanFilter(v as ScanFilter)}
                      options={scanOptions}
                      size="sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={refreshAll}
                    className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)]"
                  >
                    <Loader2
                      className={`w-3.5 h-3.5 ${rowsLoading || summaryLoading || agingLoading ? "animate-spin" : ""}`}
                    />
                    {t("bankTransferQueue.refresh")}
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden mb-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--color-border)]">
                        <Th isRTL={isRTL}>{t("bankTransferQueue.col.student")}</Th>
                        <Th isRTL={isRTL} hideOnMobile>
                          {t("bankTransferQueue.col.course")}
                        </Th>
                        <Th isRTL={isRTL}>{t("bankTransferQueue.col.amount")}</Th>
                        <Th isRTL={isRTL}>{t("bankTransferQueue.col.uploaded")}</Th>
                        <Th isRTL={isRTL} hideOnMobile>
                          {t("bankTransferQueue.list.ageColumn")}
                        </Th>
                        <Th isRTL={isRTL}>{t("bankTransferQueue.col.scan")}</Th>
                        <Th isRTL={isRTL}>{t("bankTransferQueue.col.status")}</Th>
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
                            {t("bankTransferQueue.list.empty")}
                          </td>
                        </tr>
                      ) : (
                        rows.map((r) => (
                          <ReceiptRow
                            key={r.receiptId}
                            r={r}
                            isRTL={isRTL}
                            locale={locale}
                            t={t}
                            ArrowGlyph={ArrowGlyph}
                            onClick={() => openDrawer(r.receiptId)}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {!rowsLoading && totalCount > 0 && (
                  <div
                    className={`flex items-center justify-between px-4 py-3 border-t border-[var(--color-border-subtle)] ${
                      isRTL ? "flex-row-reverse" : ""
                    }`}
                  >
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {t("bankTransferQueue.showing", { from, to, total: totalCount })}
                    </p>
                    <div className={`flex items-center gap-1 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-[var(--color-border)] disabled:opacity-40 hover:bg-[var(--color-surface-page)]"
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
      <BankTransferDetailDrawer
        receiptId={selectedReceiptId}
        onClose={() => openDrawer(null)}
        onChanged={refreshAll}
      />
    </>
  );
}

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
        <p className="text-xs text-[var(--color-text-secondary)] font-medium">{label}</p>
        <div className="text-xl font-bold text-[var(--color-text-primary)] mt-0.5">{value}</div>
        <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">{sublabel}</div>
      </div>
    </div>
  );
}

function AgeBucket({
  label,
  count,
  amount,
  color,
  urgent,
  t,
}: {
  label: string;
  count: number;
  amount: number;
  color: string;
  urgent?: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const isEmpty = count === 0;
  return (
    <div
      className={`bg-[var(--color-surface-card)] rounded-xl border ${
        urgent ? "border-[#DC2626]" : "border-[var(--color-border)]"
      } p-3`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full ${color}`} />
        <p className="text-[11px] text-[var(--color-text-secondary)] font-medium">{label}</p>
      </div>
      <p className="text-lg font-bold text-[var(--color-text-primary)]">
        {isEmpty ? t("bankTransferQueue.agingStrip.clear") : count.toLocaleString("en-US")}
      </p>
      {!isEmpty && (
        <Money
          amount={amount}
          decimals={0}
          iconSize={10}
          className="text-[11px] text-[var(--color-text-secondary)]"
        />
      )}
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

function ReceiptRow({
  r,
  isRTL,
  locale,
  t,
  ArrowGlyph,
  onClick,
}: {
  r: BankTransferQueueItem;
  isRTL: boolean;
  locale: string;
  t: ReturnType<typeof useTranslations>;
  ArrowGlyph: typeof ArrowRight;
  onClick: () => void;
}) {
  const reviewPill = REVIEW_PILL[r.reviewStatus] || REVIEW_PILL.pending;
  const scanPill = SCAN_PILL[r.scanStatus] || SCAN_PILL.pending;
  const ScanIcon = scanPill.Icon;

  return (
    <tr
      onClick={onClick}
      className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-page)] cursor-pointer transition-colors"
    >
      <td className="py-3 px-4">
        <p className="text-[13px] font-medium text-[var(--color-text-primary)] truncate max-w-[180px]">
          {r.student.name}
        </p>
        <p className="text-[11px] text-[var(--color-text-secondary)] truncate max-w-[180px]">
          {r.student.email}
        </p>
      </td>
      <td className="py-3 px-4 hidden md:table-cell">
        <span className="text-[13px] text-[var(--color-text-secondary)] truncate inline-block max-w-[180px] align-middle">
          {r.course.title}
        </span>
      </td>
      <td className="py-3 px-4">
        <Money
          amount={Number(r.payment.amount || 0)}
          decimals={2}
          iconSize={12}
          className="font-semibold text-[var(--color-text-primary)]"
        />
      </td>
      <td className="py-3 px-4 text-[12px] text-[var(--color-text-secondary)] whitespace-nowrap">
        {formatDateTime(r.uploadedAt, locale)}
      </td>
      <td className={`py-3 px-4 text-[12px] whitespace-nowrap hidden md:table-cell ${ageColor(r.uploadedAt)}`}>
        {formatAge(r.uploadedAt, locale)}
      </td>
      <td className="py-3 px-4">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${scanPill.bg} ${scanPill.text}`}
        >
          <ScanIcon className="w-3 h-3" />
          {t(`bankTransferQueue.scan.${r.scanStatus}` as any)}
        </span>
      </td>
      <td className="py-3 px-4">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${reviewPill.bg} ${reviewPill.text}`}
        >
          {t(`bankTransferQueue.reviewStatus.${r.reviewStatus}` as any)}
        </span>
      </td>
      <td className="py-3 px-4 text-[var(--color-text-secondary)]">
        <ArrowGlyph className="w-4 h-4" />
      </td>
    </tr>
  );
}
