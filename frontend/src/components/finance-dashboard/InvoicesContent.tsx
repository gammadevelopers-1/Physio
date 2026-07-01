"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import DateRangeFilter from "./DateRangeFilter";
import InvoiceDetailDrawer from "./InvoiceDetailDrawer";
import Money from "./shared/Money";
import { KPICardSkeleton, TableRowSkeleton } from "./shared/Skeleton";
import { FINANCE_COLORS, gatewayColor } from "./shared/financeColors";
import FinancePageShell from "./shared/FinancePageShell";
import { useActorRole } from "./shared/ActorRoleContext";
import { financePath } from "./shared/financeRoutes";
import Select from "@/components/admin-dashboard/Select";
import {
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  Loader2,
  Download,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { invoiceApi, financeApi, type InvoiceRow, type InvoiceSummary } from "@/lib/api";

const PAGE_SIZE = 25;

function getDefaultDateRange() {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const start = new Date(today);
  start.setDate(start.getDate() - 29);
  return { startDate: start.toISOString().slice(0, 10), endDate: todayStr, label: "30d" };
}

export interface InvoicesContentProps {
  /** When true, render only the inner page (no FinanceNavbar/Sidebar). Used
   *  when an outer dashboard (e.g. AdminFinanceShell) already provides chrome. */
  embedded?: boolean;
}

const InvoicesContent = ({ embedded = false }: InvoicesContentProps) => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const actorRole = useActorRole();
  const isRTL = locale === "ar";
  const ArrowGlyph = isRTL ? ArrowLeft : ArrowRight;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [dateRange, setDateRange] = useState<{ startDate?: string; endDate?: string; label: string }>(getDefaultDateRange);
  const [statusFilter, setStatusFilter] = useState("all");
  const [gatewayFilter, setGatewayFilter] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(true);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [reviewAging, setReviewAging] = useState<{
    asOf: string;
    underSix: { count: number; amount: number };
    sixToDay: { count: number; amount: number };
    dayToTwo: { count: number; amount: number };
    beyondTwo: { count: number; amount: number };
    scanQueue: { count: number; amount: number };
  } | null>(null);
  const [reviewAgingLoading, setReviewAgingLoading] = useState(true);

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [csvExporting, setCsvExporting] = useState(false);

  // Deep-link: ?invoiceId=... opens the drawer; URL stays in sync as user
  // opens/closes so reload + back navigation preserve drawer state.
  useEffect(() => {
    const iid = searchParams.get("invoiceId");
    if (iid && iid !== selectedInvoiceId) {
      setSelectedInvoiceId(iid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const openInvoiceDrawer = (id: string | null) => {
    setSelectedInvoiceId(id);
    const sp = new URLSearchParams(searchParams.toString());
    if (id) sp.set("invoiceId", id);
    else sp.delete("invoiceId");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Debounced search → query
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
  }, [statusFilter, gatewayFilter, dateRange]);

  const filters = {
    status: statusFilter,
    gateway: gatewayFilter,
    search: searchQuery,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  };

  const fetchRows = useCallback(async () => {
    setRowsLoading(true);
    try {
      const res = await invoiceApi.getAll(page, PAGE_SIZE, filters);
      setRows(res.data || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalCount(res.pagination?.total || 0);
    } catch {
      setRows([]);
    } finally {
      setRowsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, gatewayFilter, searchQuery, dateRange.startDate, dateRange.endDate]);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await invoiceApi.getSummary({
        status: statusFilter,
        gateway: gatewayFilter,
        search: searchQuery,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      setSummary(res);
    } catch {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [statusFilter, gatewayFilter, searchQuery, dateRange.startDate, dateRange.endDate]);

  // Real-time bank-transfer review queue aging — only meaningful "waiting
  // on us" receivable in this product. Date range filter doesn't apply here
  // (it's a live queue snapshot), so refresh independently.
  const fetchReviewAging = useCallback(async () => {
    setReviewAgingLoading(true);
    try {
      const res = await financeApi.getBankTransferReviewAging();
      setReviewAging(res);
    } catch {
      setReviewAging(null);
    } finally {
      setReviewAgingLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);
  useEffect(() => {
    fetchReviewAging();
  }, [fetchReviewAging]);

  // 'overdue' is intentionally absent — invoices in this product are
  // always created status='paid' (payment-first flow), so the overdue
  // bucket is structurally empty. Cron + endpoint still exist for the
  // day B2B / net-30 invoicing lands. See feedback note in commit msg.
  const statusOptions = [
    { value: "all", label: t("invoicesPage.filters.allStatuses") },
    { value: "paid", label: t("invoicesPage.statuses.paid") },
    { value: "issued", label: t("invoicesPage.statuses.issued") },
    { value: "partially_refunded", label: t("invoicesPage.statuses.partiallyRefunded") },
    { value: "refunded", label: t("invoicesPage.statuses.refunded") },
    { value: "cancelled", label: t("invoicesPage.statuses.cancelled") },
  ];

  const gatewayOptions = [
    { value: "all", label: t("paymentsTable.filter.allGateways") },
    { value: "moyasar", label: "Moyasar" },
    { value: "tamara", label: "Tamara" },
    { value: "tabby", label: "Tabby" },
    { value: "bank_transfer", label: t("paymentsTable.filter.bankTransfer") },
  ];

  const handleCsvExport = async () => {
    if (csvExporting) return;
    setCsvExporting(true);
    try {
      const blob = await invoiceApi.exportCsv(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // noop
    } finally {
      setCsvExporting(false);
    }
  };

  const from = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, totalCount);

  const inner = (
    <>
      {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                    {t("invoicesPage.title")}
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    {t("invoicesPage.subtitle")}
                  </p>
                </div>
                <DateRangeFilter onChange={setDateRange} defaultPreset="30d" />
              </div>

              {/* 4 real KPI stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {summaryLoading ? (
                  <>
                    <KPICardSkeleton />
                    <KPICardSkeleton />
                    <KPICardSkeleton />
                  </>
                ) : (
                  <>
                    <StatCard
                      label={t("invoicesPage.stats.totalInvoices")}
                      value={(summary?.totalCount || 0).toLocaleString("en-US")}
                      sublabel={
                        <Money
                          amount={summary?.totalAmount || 0}
                          decimals={0}
                          iconSize={11}
                          className="text-xs text-[var(--color-text-secondary)]"
                        />
                      }
                      icon={FileText}
                      iconBg={FINANCE_COLORS.info.bg}
                      iconColor={FINANCE_COLORS.info.text}
                    />
                    <StatCard
                      label={t("invoicesPage.stats.paidInvoices")}
                      value={(summary?.paidCount || 0).toLocaleString("en-US")}
                      sublabel={
                        <Money
                          amount={summary?.paidAmount || 0}
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
                      label={t("invoicesPage.stats.refundedInvoices")}
                      value={(summary?.refundedCount || 0).toLocaleString("en-US")}
                      sublabel={
                        <Money
                          amount={summary?.refundedAmount || 0}
                          decimals={0}
                          iconSize={11}
                          className="text-xs text-[var(--color-text-secondary)]"
                        />
                      }
                      icon={RotateCcw}
                      iconBg={FINANCE_COLORS.violet.bg}
                      iconColor={FINANCE_COLORS.violet.text}
                    />
                  </>
                )}
              </div>

              {/* Filter bar */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-3 mb-4">
                <div className={`flex flex-wrap items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <div className="flex-1 min-w-[200px] relative">
                    <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`} />
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder={t("invoicesPage.filters.searchPlaceholder")}
                      className={`w-full h-9 ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"} text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)] bg-[var(--color-surface-page)] text-[var(--color-text-primary)]`}
                    />
                  </div>

                  <div className="w-[160px]">
                    <Select value={statusFilter} onChange={setStatusFilter} options={statusOptions} size="sm" />
                  </div>
                  <div className="w-[160px]">
                    <Select value={gatewayFilter} onChange={setGatewayFilter} options={gatewayOptions} size="sm" />
                  </div>

                  <button
                    onClick={handleCsvExport}
                    disabled={csvExporting}
                    className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)] disabled:opacity-50"
                    title={t("invoicesPage.actions.exportTooltip")}
                  >
                    {csvExporting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    {t("invoicesPage.actions.exportCsv")}
                  </button>

                </div>
              </div>

              {/* Table */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden mb-6">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--color-border)]">
                        <Th isRTL={isRTL}>{t("invoicesPage.table.invoice")}</Th>
                        <Th isRTL={isRTL}>{t("invoicesPage.table.date")}</Th>
                        <Th isRTL={isRTL}>{t("invoicesPage.table.customer")}</Th>
                        <Th isRTL={isRTL} hideOnMobile>{t("invoicesPage.table.course")}</Th>
                        <Th isRTL={isRTL} hideOnMobile>{t("invoicesPage.table.gateway")}</Th>
                        <Th isRTL={isRTL}>{t("invoicesPage.table.amount")}</Th>
                        <Th isRTL={isRTL}>{t("invoicesPage.table.status")}</Th>
                        <th className="py-3 px-4 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rowsLoading ? (
                        Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} cols={8} />)
                      ) : rows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center text-sm text-[var(--color-text-secondary)] py-12">
                            {t("invoicesPage.empty")}
                          </td>
                        </tr>
                      ) : (
                        rows.map((inv) => (
                          <InvoiceRowView
                            key={inv.id}
                            inv={inv}
                            isRTL={isRTL}
                            locale={locale}
                            t={t}
                            ArrowGlyph={ArrowGlyph}
                            onClick={() => openInvoiceDrawer(inv.id)}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {!rowsLoading && totalCount > 0 && (
                  <div className={`flex items-center justify-between px-4 py-3 border-t border-[var(--color-border-subtle)] ${isRTL ? "flex-row-reverse" : ""}`}>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {t("paymentsTable.pagination.showing", { from, to, total: totalCount })}
                    </p>
                    <div className={`flex items-center gap-1 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-[var(--color-border)] disabled:opacity-40 hover:bg-[var(--color-surface-page)]"
                        aria-label="Previous"
                      >
                        {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
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
                        {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Bank Transfer Review Aging — replaces the invoice-aging
                  bucket set. This product creates invoices paid-up-front,
                  so the only meaningful "waiting on us" receivable is the
                  bank-transfer receipt review queue. Clicking any bucket
                  jumps to the Bank Transfers page to action it. */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
                <div className={`flex items-center justify-between gap-2 mb-1 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <Clock className="w-5 h-5 text-[#EA580C]" />
                    <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                      {t("invoicesPage.reviewQueueTitle")}
                    </h3>
                  </div>
                  {reviewAging && (
                    <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
                      {t("invoicesPage.reviewQueueAsOf", {
                        when: new Date(reviewAging.asOf).toLocaleTimeString(
                          locale === "ar" ? "ar-SA-u-nu-latn" : "en-US",
                          { hour: "2-digit", minute: "2-digit", hour12: false }
                        ),
                      })}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] mb-4">
                  {t("invoicesPage.reviewQueueSubtitle")}
                </p>
                {reviewAgingLoading || !reviewAging ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {Array.from({ length: 5 }).map((_, i) => <KPICardSkeleton key={i} />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <ReviewBucket
                      label={t("invoicesPage.reviewQueueBuckets.underSix")}
                      count={reviewAging.underSix.count}
                      amount={reviewAging.underSix.amount}
                      color="bg-[#16A34A]"
                      href={financePath(actorRole, locale, "bank-transfers", { review: "pending" })}
                      t={t}
                    />
                    <ReviewBucket
                      label={t("invoicesPage.reviewQueueBuckets.sixToDay")}
                      count={reviewAging.sixToDay.count}
                      amount={reviewAging.sixToDay.amount}
                      color="bg-[#3B82F6]"
                      href={financePath(actorRole, locale, "bank-transfers", { review: "pending" })}
                      t={t}
                    />
                    <ReviewBucket
                      label={t("invoicesPage.reviewQueueBuckets.dayToTwo")}
                      count={reviewAging.dayToTwo.count}
                      amount={reviewAging.dayToTwo.amount}
                      color="bg-[#D97706]"
                      href={financePath(actorRole, locale, "bank-transfers", { review: "pending" })}
                      t={t}
                    />
                    <ReviewBucket
                      label={t("invoicesPage.reviewQueueBuckets.beyondTwo")}
                      count={reviewAging.beyondTwo.count}
                      amount={reviewAging.beyondTwo.amount}
                      color="bg-[#DC2626]"
                      href={financePath(actorRole, locale, "bank-transfers", { review: "pending" })}
                      urgent={reviewAging.beyondTwo.count > 0}
                      t={t}
                    />
                    <ReviewBucket
                      label={t("invoicesPage.reviewQueueBuckets.scanQueue")}
                      count={reviewAging.scanQueue.count}
                      amount={reviewAging.scanQueue.amount}
                      color="bg-[#7C3AED]"
                      href={financePath(actorRole, locale, "bank-transfers", { status: "all", scan: "pending" })}
                      t={t}
                    />
                  </div>
                )}
              </div>
    </>
  );

  return (
    <>
      {embedded ? inner : <FinancePageShell>{inner}</FinancePageShell>}
      <InvoiceDetailDrawer
        invoiceId={selectedInvoiceId}
        onClose={() => openInvoiceDrawer(null)}
        onChanged={() => {
          fetchRows();
          fetchSummary();
          fetchReviewAging();
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
  value: string;
  sublabel: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 flex items-start gap-3">
      <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[var(--color-text-secondary)] font-medium">{label}</p>
        <p className="text-xl font-bold text-[var(--color-text-primary)] mt-0.5">{value}</p>
        <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">{sublabel}</div>
      </div>
    </div>
  );
}

function Th({ children, isRTL, hideOnMobile }: { children: React.ReactNode; isRTL: boolean; hideOnMobile?: boolean }) {
  return (
    <th
      scope="col"
      className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"} ${hideOnMobile ? "hidden md:table-cell" : ""}`}
    >
      {children}
    </th>
  );
}

const STATUS_PILL: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700",
  issued: "bg-blue-50 text-blue-700",
  overdue: "bg-amber-50 text-amber-700",
  refunded: "bg-violet-50 text-violet-700",
  partially_refunded: "bg-violet-50 text-violet-700",
  cancelled: "bg-slate-100 text-slate-600",
  draft: "bg-slate-100 text-slate-600",
};

function InvoiceRowView({
  inv,
  isRTL,
  locale,
  t,
  ArrowGlyph,
  onClick,
}: {
  inv: InvoiceRow;
  isRTL: boolean;
  locale: string;
  t: ReturnType<typeof useTranslations>;
  ArrowGlyph: typeof ArrowRight;
  onClick: () => void;
}) {
  const dateStr = new Date(inv.issuedAt).toLocaleDateString(
    locale === "ar" ? "ar-SA-u-nu-latn" : "en-US",
    { month: "short", day: "numeric", year: "numeric" }
  );
  const gw = inv.gateway || null;
  const courseTitle = (locale === "ar" ? inv.courseTitleAr : inv.courseTitle) || inv.courseTitle || "—";
  return (
    <tr
      onClick={onClick}
      className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-page)] cursor-pointer transition-colors"
    >
      <td className="py-3 px-4 align-top whitespace-nowrap">
        <span className="block text-[13px] font-medium text-[var(--color-primary)] font-mono">
          {inv.invoiceNumber}
        </span>
        {inv.refundStatus && (
          <span className="mt-1 inline-flex items-center text-[10px] font-medium text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded whitespace-nowrap">
            {t("invoicesPage.refundedBadge", { status: inv.refundStatus })}
          </span>
        )}
      </td>
      <td className="py-3 px-4 text-[13px] text-[var(--color-text-secondary)] whitespace-nowrap">{dateStr}</td>
      <td className="py-3 px-4 text-[13px] text-[var(--color-text-primary)]">
        <p className="font-medium truncate max-w-[180px]">{inv.userName || inv.userEmail || "—"}</p>
        {inv.userName && inv.userEmail && (
          <p className="text-[11px] text-[var(--color-text-secondary)] truncate max-w-[180px]">{inv.userEmail}</p>
        )}
      </td>
      <td className="py-3 px-4 text-[13px] text-[var(--color-text-secondary)] hidden md:table-cell">
        <span className="truncate inline-block max-w-[180px] align-middle">{courseTitle}</span>
      </td>
      <td className="py-3 px-4 hidden md:table-cell">
        {gw && (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-primary)] capitalize">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: gatewayColor(gw) }} />
            {gw.replace(/_/g, " ")}
          </span>
        )}
      </td>
      <td className="py-3 px-4 font-semibold text-[var(--color-text-primary)]">
        <Money amount={Number(inv.totalAmount)} decimals={2} iconSize={12} />
      </td>
      <td className="py-3 px-4">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${STATUS_PILL[inv.status] || STATUS_PILL.issued}`}>
          {t(`invoicesPage.statuses.${inv.status}`)}
        </span>
      </td>
      <td className="py-3 px-4">
        <ArrowGlyph className="w-4 h-4 text-[var(--color-text-secondary)]" />
      </td>
    </tr>
  );
}

function ReviewBucket({
  label,
  count,
  amount,
  color,
  href,
  urgent,
  t,
}: {
  label: string;
  count: number;
  amount: number;
  color: string;
  href: string;
  urgent?: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const isEmpty = count === 0;
  return (
    <Link
      href={href}
      className={`block text-left p-4 rounded-xl border transition-colors ${
        urgent && count > 0
          ? "bg-[#FEF2F2] border-[#FECACA] hover:border-[#DC2626]"
          : "bg-[var(--color-surface-page)] border-[var(--color-border-subtle)] hover:border-[var(--color-primary)]"
      } ${isEmpty ? "opacity-60" : ""}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <p className="text-[12px] text-[var(--color-text-secondary)] font-medium">{label}</p>
      </div>
      <p className="text-lg font-bold text-[var(--color-text-primary)]">
        {count.toLocaleString("en-US")}
      </p>
      <div className="text-[13px] text-[var(--color-text-secondary)] mt-0.5">
        {count === 0 ? (
          <span className="text-[11px]">{t("invoicesPage.reviewQueueEmpty")}</span>
        ) : (
          <Money amount={amount} decimals={0} iconSize={10} />
        )}
      </div>
    </Link>
  );
}

export default InvoicesContent;
