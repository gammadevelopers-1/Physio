"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import Select from "@/components/admin-dashboard/Select";
import DatePicker from "@/components/ui/DatePicker";
import ExportDropdown from "./shared/ExportDropdown";
import FinancePageShell from "./shared/FinancePageShell";
import Money from "./shared/Money";
import {
  BarChart3,
  TrendingUp,
  Receipt,
  CreditCard,
  BookOpen,
  Video,
  UserCheck,
  ShieldAlert,
  Calculator,
  Loader2,
  Filter,
  RefreshCw,
} from "lucide-react";
import { financeApi } from "@/lib/api";
import { toast } from "sonner";
import {
  formatInt as fmtInt,
  formatDateTime as fmtDateTime,
  formatDate as fmtDate,
} from "./shared/financeFormat";

/**
 * Finance Reports page.
 *
 * Eight report types matching the milestone-10 spec. Each card shares the
 * same shell — header + filters + preview table — but the filter panel and
 * preview table adapt per report. The export tray always offers CSV / XLSX /
 * PDF via the unified `/finance/export` endpoint.
 *
 * The five legacy analytics reports (profit-by-course / instructor / delivery,
 * invoice-aging, chargeback) still live on the Overview page; they were
 * intentionally removed from here to focus this page on the spec's eight.
 */

type ReportKey =
  | "revenue"
  | "refunds"
  | "payments"
  | "courseSales"
  | "webinarSales"
  | "studentPurchases"
  | "financeActivity"
  | "vat";

type PeriodKey = "thisMonth" | "lastMonth" | "thisQuarter" | "thisYear" | "custom";

interface ReportConfig {
  key: ReportKey;
  icon: typeof BookOpen;
  iconBg: string;
  iconColor: string;
}

const REPORTS: ReportConfig[] = [
  { key: "revenue",          icon: TrendingUp,   iconBg: "bg-[#DCFCE7]", iconColor: "text-[#16A34A]" },
  { key: "refunds",          icon: RefreshCw,    iconBg: "bg-[#FEE2E2]", iconColor: "text-[#DC2626]" },
  { key: "payments",         icon: CreditCard,   iconBg: "bg-[#EFF6FF]", iconColor: "text-[#2563EB]" },
  { key: "courseSales",      icon: BookOpen,     iconBg: "bg-[#FEF3C7]", iconColor: "text-[#D97706]" },
  { key: "webinarSales",     icon: Video,        iconBg: "bg-[#EDE9FE]", iconColor: "text-[#7C3AED]" },
  { key: "studentPurchases", icon: UserCheck,    iconBg: "bg-[#CFFAFE]", iconColor: "text-[#0891B2]" },
  { key: "financeActivity",  icon: ShieldAlert,  iconBg: "bg-[#FFEDD5]", iconColor: "text-[#EA580C]" },
  { key: "vat",              icon: Calculator,   iconBg: "bg-[#F3E8FF]", iconColor: "text-[#9333EA]" },
];

// ─── Helpers ──────────────────────────────────────────────────────

function getDateRange(period: PeriodKey, customStart?: string, customEnd?: string) {
  const now = new Date();
  let startDate: string | undefined;
  let endDate: string | undefined;
  switch (period) {
    case "thisMonth": {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      endDate = now.toISOString().slice(0, 10);
      break;
    }
    case "lastMonth": {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
      break;
    }
    case "thisQuarter": {
      const qStart = Math.floor(now.getMonth() / 3) * 3;
      startDate = new Date(now.getFullYear(), qStart, 1).toISOString().slice(0, 10);
      endDate = now.toISOString().slice(0, 10);
      break;
    }
    case "thisYear": {
      startDate = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      endDate = now.toISOString().slice(0, 10);
      break;
    }
    case "custom": {
      startDate = customStart || undefined;
      endDate = customEnd || undefined;
      break;
    }
  }
  return { startDate, endDate };
}

// Local wrappers around the shared finance formatters live inside each
// component below so they can close over `locale` from useLocale() — this
// keeps Latin digits everywhere while letting Arabic month names render in
// AR mode. See ./shared/financeFormat.ts.

// ─── Component ────────────────────────────────────────────────────

export interface FinanceReportsContentProps {
  /** When true, render only the inner page (no FinanceNavbar/Sidebar). Used
   *  when an outer dashboard (e.g. AdminFinanceShell) already provides chrome. */
  embedded?: boolean;
}

const FinanceReportsContent = ({ embedded = false }: FinanceReportsContentProps) => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  // Locale-aware wrappers around the shared finance formatters — keep the
  // existing (value) signatures the JSX callsites use by closing over
  // `locale`. Latin digits everywhere, Arabic month names in AR mode.
  //
  // Money amounts render via the <Money> component (SAR glyph + Latin digits)
  // so we no longer render "SAR 123.45" as raw text.
  const money = (amount: number) => <Money amount={amount || 0} decimals={2} />;
  const moneyNeg = (amount: number) => (
    <span className="inline-flex items-center gap-1" dir="ltr">
      <span>-</span>
      <Money amount={amount || 0} decimals={2} />
    </span>
  );
  const formatInt = (n: number) => fmtInt(n || 0, locale);
  const formatDateTime = (iso: string | null | undefined) => fmtDateTime(iso, locale);
  const formatDate = (iso: string | null | undefined) => fmtDate(iso, locale);

  // Localise payment-method / gateway slugs. Brand names (Moyasar, Tabby,
  // Tamara) stay Latin in both locales; only the descriptive ones
  // (bank_transfer, card, bnpl…) translate. Unknown slugs fall back to the
  // slug itself (with underscores → spaces) so no operator ever sees an
  // MISSING_MESSAGE toast.
  const KNOWN_GATEWAYS = new Set(["moyasar", "tabby", "tamara", "bank_transfer", "unknown"]);
  const KNOWN_METHODS = new Set(["card", "mada", "apple_pay", "bnpl", "bank_transfer", "unknown"]);
  const gatewayLabel = (slug: string | null | undefined): string => {
    if (!slug) return "—";
    return KNOWN_GATEWAYS.has(slug)
      ? t(`reportsPage.gatewayLabels.${slug}`)
      : slug.replace(/_/g, " ");
  };
  const methodLabel = (slug: string | null | undefined): string => {
    if (!slug) return "—";
    return KNOWN_METHODS.has(slug)
      ? t(`reportsPage.methodLabels.${slug}`)
      : slug.replace(/_/g, " ");
  };

  const [selectedReport, setSelectedReport] = useState<ReportKey>("revenue");
  const [period, setPeriod] = useState<PeriodKey>("thisMonth");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Per-report filter state
  const [gateway, setGateway] = useState("all");
  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const [reason, setReason] = useState("all");
  const [deliveryType, setDeliveryType] = useState("all");
  const [entityType, setEntityType] = useState("all");
  const [search, setSearch] = useState("");

  // Data state
  type RevenueData = Awaited<ReturnType<typeof financeApi.getReportRevenue>>;
  type RefundsData = Awaited<ReturnType<typeof financeApi.getReportRefunds>>;
  type PaymentsData = Awaited<ReturnType<typeof financeApi.getReportPayments>>;
  type CourseSalesData = Awaited<ReturnType<typeof financeApi.getReportCourseSales>>;
  type WebinarSalesData = Awaited<ReturnType<typeof financeApi.getReportWebinarSales>>;
  type StudentPurchasesData = Awaited<ReturnType<typeof financeApi.getReportStudentPurchases>>;
  type FinanceActivityData = Awaited<ReturnType<typeof financeApi.getReportFinanceActivity>>;
  type VatData = Awaited<ReturnType<typeof financeApi.getReportVat>>;

  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [refundsData, setRefundsData] = useState<RefundsData | null>(null);
  const [paymentsData, setPaymentsData] = useState<PaymentsData | null>(null);
  const [courseSalesData, setCourseSalesData] = useState<CourseSalesData | null>(null);
  const [webinarSalesData, setWebinarSalesData] = useState<WebinarSalesData | null>(null);
  const [studentPurchasesData, setStudentPurchasesData] = useState<StudentPurchasesData | null>(null);
  const [financeActivityData, setFinanceActivityData] = useState<FinanceActivityData | null>(null);
  const [vatData, setVatData] = useState<VatData | null>(null);

  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<"csv" | "xlsx" | "pdf" | null>(null);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);

  // Reset per-report filters when switching reports — keeps the UI honest
  // and avoids stale filter state from one report's preview applying to
  // another's.
  useEffect(() => {
    setGateway("all"); setStatus("all"); setMethod("all"); setReason("all");
    setDeliveryType("all"); setEntityType("all"); setSearch("");
  }, [selectedReport]);

  const currentFilters = useMemo<Record<string, string>>(() => {
    const { startDate, endDate } = getDateRange(period, customStart, customEnd);
    const base: Record<string, string> = {};
    if (startDate) base.startDate = startDate;
    if (endDate) base.endDate = endDate;
    switch (selectedReport) {
      case "revenue": base.gateway = gateway; break;
      case "refunds": base.status = status; base.gateway = gateway; base.reason = reason; break;
      case "payments": base.gateway = gateway; base.status = status; base.method = method; break;
      case "courseSales": base.deliveryType = deliveryType; break;
      case "webinarSales": break;
      case "studentPurchases": if (search) base.search = search; break;
      case "financeActivity": base.entityType = entityType; break;
      case "vat": break;
    }
    return base;
  }, [selectedReport, period, customStart, customEnd, gateway, status, method, reason, deliveryType, entityType, search]);

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    const { startDate, endDate } = getDateRange(period, customStart, customEnd);
    try {
      switch (selectedReport) {
        case "revenue":
          setRevenueData(await financeApi.getReportRevenue({ startDate, endDate, gateway: gateway === "all" ? undefined : gateway }));
          break;
        case "refunds":
          setRefundsData(await financeApi.getReportRefunds({
            startDate, endDate,
            status: status === "all" ? undefined : status,
            gateway: gateway === "all" ? undefined : gateway,
            reason: reason === "all" ? undefined : reason,
          }));
          break;
        case "payments":
          setPaymentsData(await financeApi.getReportPayments({
            startDate, endDate,
            gateway: gateway === "all" ? undefined : gateway,
            status: status === "all" ? undefined : status,
            method: method === "all" ? undefined : method,
          }));
          break;
        case "courseSales":
          setCourseSalesData(await financeApi.getReportCourseSales({
            startDate, endDate,
            deliveryType: deliveryType === "all" ? undefined : deliveryType,
          }));
          break;
        case "webinarSales":
          setWebinarSalesData(await financeApi.getReportWebinarSales({ startDate, endDate }));
          break;
        case "studentPurchases":
          setStudentPurchasesData(await financeApi.getReportStudentPurchases({
            startDate, endDate, search: search || undefined, top: 100,
          }));
          break;
        case "financeActivity":
          setFinanceActivityData(await financeApi.getReportFinanceActivity({
            startDate, endDate,
            entityType: entityType === "all" ? undefined : entityType,
          }));
          break;
        case "vat":
          setVatData(await financeApi.getReportVat({ startDate, endDate }));
          break;
      }
      setLastGeneratedAt(new Date());
    } catch {
      toast.error(t("reportsPage.exportError"));
    } finally {
      setLoading(false);
    }
  }, [selectedReport, period, customStart, customEnd, gateway, status, method, reason, deliveryType, entityType, search, t]);

  // Auto-fetch on mount + on report switch — saves the operator a click and
  // matches the rest of the finance dashboard's behaviour.
  useEffect(() => {
    fetchPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReport]);

  const handleDownload = async (format: "csv" | "xlsx" | "pdf") => {
    setDownloading(format);
    try {
      await financeApi.downloadReport(selectedReport, format, currentFilters);
      toast.success(t("reportsPage.exportSuccess"));
    } catch {
      toast.error(t("reportsPage.exportError"));
    } finally {
      setDownloading(null);
    }
  };

  // ─── Filter options ────────────────────────────────────────────

  const periodOptions = [
    { value: "thisMonth", label: t("reportsPage.filters.thisMonth") },
    { value: "lastMonth", label: t("reportsPage.filters.lastMonth") },
    { value: "thisQuarter", label: t("reportsPage.filters.thisQuarter") },
    { value: "thisYear", label: t("reportsPage.filters.thisYear") },
    { value: "custom", label: t("reportsPage.filters.custom") },
  ];

  const gatewayOptions = [
    { value: "all", label: t("reportsPage.gateway.all") },
    { value: "moyasar", label: "Moyasar" },
    { value: "tabby", label: "Tabby" },
    { value: "tamara", label: "Tamara" },
    { value: "bank_transfer", label: t("reportsPage.gateway.bankTransfer") },
  ];

  const paymentStatusOptions = [
    { value: "all", label: t("reportsPage.status.all") },
    { value: "paid", label: t("reportsPage.status.paid") },
    { value: "pending", label: t("reportsPage.status.pending") },
    { value: "failed", label: t("reportsPage.status.failed") },
    { value: "refunded", label: t("reportsPage.status.refunded") },
    { value: "partially_refunded", label: t("reportsPage.status.partiallyRefunded") },
    { value: "awaiting_approval", label: t("reportsPage.status.awaitingApproval") },
    { value: "chargeback", label: t("reportsPage.status.chargeback") },
  ];

  const refundStatusOptions = [
    { value: "all", label: t("reportsPage.status.all") },
    { value: "pending", label: t("reportsPage.refundStatus.pending") },
    { value: "approved", label: t("reportsPage.refundStatus.approved") },
    { value: "processing", label: t("reportsPage.refundStatus.processing") },
    { value: "completed", label: t("reportsPage.refundStatus.completed") },
    { value: "rejected", label: t("reportsPage.refundStatus.rejected") },
    { value: "failed", label: t("reportsPage.refundStatus.failed") },
  ];

  const methodOptions = [
    { value: "all", label: t("reportsPage.method.all") },
    { value: "card", label: t("reportsPage.method.card") },
    { value: "mada", label: t("reportsPage.method.mada") },
    { value: "apple_pay", label: t("reportsPage.method.applePay") },
    { value: "bnpl", label: t("reportsPage.method.bnpl") },
    { value: "bank_transfer", label: t("reportsPage.method.bankTransfer") },
  ];

  const reasonOptions = [
    { value: "all", label: t("reportsPage.refundReason.all") },
    { value: "duplicate_payment", label: t("reportsPage.refundReason.duplicate") },
    { value: "course_quality", label: t("reportsPage.refundReason.quality") },
    { value: "technical_issue", label: t("reportsPage.refundReason.technical") },
    { value: "schedule_conflict", label: t("reportsPage.refundReason.schedule") },
    { value: "policy_request", label: t("reportsPage.refundReason.policy") },
    { value: "other", label: t("reportsPage.refundReason.other") },
  ];

  const deliveryOptions = [
    { value: "all", label: t("reportsPage.delivery.all") },
    { value: "zoom", label: t("reportsPage.delivery.zoom") },
    { value: "onsite", label: t("reportsPage.delivery.onsite") },
    { value: "blended", label: t("reportsPage.delivery.blended") },
  ];

  const entityTypeOptions = [
    { value: "all", label: t("reportsPage.entity.all") },
    { value: "payment", label: t("reportsPage.entity.payment") },
    { value: "refund", label: t("reportsPage.entity.refund") },
    { value: "invoice", label: t("reportsPage.entity.invoice") },
    { value: "bank_transfer", label: t("reportsPage.entity.bankTransfer") },
    { value: "discount", label: t("reportsPage.entity.discount") },
    { value: "coupon_campaign", label: t("reportsPage.entity.campaign") },
    { value: "reconciliation", label: t("reportsPage.entity.reconciliation") },
  ];

  // ─── Render helpers ────────────────────────────────────────────

  const renderFilters = () => (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-[var(--color-text-secondary)]" />
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {t("reportsPage.filters.title")}
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Period */}
        <div>
          <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1">
            {t("reportsPage.filters.period")}
          </label>
          <Select
            options={periodOptions}
            value={period}
            onChange={(v) => setPeriod(v as PeriodKey)}
            size="default"
          />
        </div>
        {period === "custom" && (
          <>
            <div>
              <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1">
                {t("reportsPage.filters.startDate")}
              </label>
              <DatePicker value={customStart} onChange={setCustomStart} />
            </div>
            <div>
              <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1">
                {t("reportsPage.filters.endDate")}
              </label>
              <DatePicker value={customEnd} onChange={setCustomEnd} />
            </div>
          </>
        )}

        {/* Per-report filters */}
        {(selectedReport === "revenue" || selectedReport === "refunds" || selectedReport === "payments") && (
          <div>
            <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1">
              {t("reportsPage.filters.gateway")}
            </label>
            <Select options={gatewayOptions} value={gateway} onChange={setGateway} />
          </div>
        )}
        {selectedReport === "refunds" && (
          <>
            <div>
              <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1">
                {t("reportsPage.filters.status")}
              </label>
              <Select options={refundStatusOptions} value={status} onChange={setStatus} />
            </div>
            <div>
              <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1">
                {t("reportsPage.filters.reason")}
              </label>
              <Select options={reasonOptions} value={reason} onChange={setReason} />
            </div>
          </>
        )}
        {selectedReport === "payments" && (
          <>
            <div>
              <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1">
                {t("reportsPage.filters.status")}
              </label>
              <Select options={paymentStatusOptions} value={status} onChange={setStatus} />
            </div>
            <div>
              <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1">
                {t("reportsPage.filters.method")}
              </label>
              <Select options={methodOptions} value={method} onChange={setMethod} />
            </div>
          </>
        )}
        {selectedReport === "courseSales" && (
          <div>
            <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1">
              {t("reportsPage.filters.delivery")}
            </label>
            <Select options={deliveryOptions} value={deliveryType} onChange={setDeliveryType} />
          </div>
        )}
        {selectedReport === "studentPurchases" && (
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1">
              {t("reportsPage.filters.search")}
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("reportsPage.filters.searchPlaceholder")}
              className="w-full px-3 py-2 h-10 border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-primary)] bg-[var(--color-surface-card)] focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
        )}
        {selectedReport === "financeActivity" && (
          <div>
            <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1">
              {t("reportsPage.filters.entity")}
            </label>
            <Select options={entityTypeOptions} value={entityType} onChange={setEntityType} />
          </div>
        )}

        {/* Generate button */}
        <div className="flex items-end">
          <button
            onClick={fetchPreview}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 h-10 btn-gold text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 w-full sm:w-auto justify-center"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
            {t("reportsPage.generate")}
          </button>
        </div>
      </div>
    </div>
  );

  const renderSummary = () => {
    if (loading || !lastGeneratedAt) return null;
    if (selectedReport === "revenue" && revenueData) {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <StatCard label={t("reportsPage.summary.gross")} value={money(revenueData.totals.gross)} accent="#16A34A" />
          <StatCard label={t("reportsPage.summary.refunds")} value={money(revenueData.totals.refunds)} accent="#DC2626" />
          <StatCard label={t("reportsPage.summary.net")} value={money(revenueData.totals.net)} accent="var(--color-text-primary)" />
          <StatCard label={t("reportsPage.summary.vat")} value={money(revenueData.totals.vat)} accent="#9333EA" />
          <StatCard label={t("reportsPage.summary.payments")} value={formatInt(revenueData.totals.count)} accent="#2563EB" />
        </div>
      );
    }
    if (selectedReport === "vat" && vatData) {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label={t("reportsPage.summary.invoices")} value={formatInt(vatData.totals.invoiceCount)} accent="#2563EB" />
          <StatCard label={t("reportsPage.summary.taxableBase")} value={money(vatData.totals.taxableBase)} accent="var(--color-text-primary)" />
          <StatCard label={t("reportsPage.summary.vat")} value={money(vatData.totals.vatAmount)} accent="#9333EA" />
          <StatCard label={t("reportsPage.summary.totalInvoiced")} value={money(vatData.totals.total)} accent="#16A34A" />
        </div>
      );
    }
    if (selectedReport === "refunds" && refundsData) {
      const total = refundsData.reduce((s, r) => s + r.refundAmount, 0);
      const completed = refundsData.filter((r) => r.status === "completed").length;
      const pending = refundsData.filter((r) => ["pending", "approved", "processing"].includes(r.status)).length;
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label={t("reportsPage.summary.refundsCount")} value={formatInt(refundsData.length)} accent="#DC2626" />
          <StatCard label={t("reportsPage.summary.completed")} value={formatInt(completed)} accent="#16A34A" />
          <StatCard label={t("reportsPage.summary.inProgress")} value={formatInt(pending)} accent="#EA580C" />
          <StatCard label={t("reportsPage.summary.totalAmount")} value={money(total)} accent="var(--color-text-primary)" />
        </div>
      );
    }
    if (selectedReport === "payments" && paymentsData) {
      const total = paymentsData.reduce((s, r) => s + (r.status === "paid" ? r.amount : 0), 0);
      const paid = paymentsData.filter((r) => r.status === "paid").length;
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label={t("reportsPage.summary.transactions")} value={formatInt(paymentsData.length)} accent="#2563EB" />
          <StatCard label={t("reportsPage.summary.paid")} value={formatInt(paid)} accent="#16A34A" />
          <StatCard label={t("reportsPage.summary.paidAmount")} value={money(total)} accent="var(--color-text-primary)" />
          <StatCard label={t("reportsPage.summary.failed")} value={formatInt(paymentsData.filter((r) => r.status === "failed").length)} accent="#DC2626" />
        </div>
      );
    }
    if (selectedReport === "courseSales" && courseSalesData) {
      const units = courseSalesData.reduce((s, r) => s + r.units, 0);
      const gross = courseSalesData.reduce((s, r) => s + r.gross, 0);
      const net = courseSalesData.reduce((s, r) => s + r.net, 0);
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label={t("reportsPage.summary.courses")} value={formatInt(courseSalesData.length)} accent="#2563EB" />
          <StatCard label={t("reportsPage.summary.unitsSold")} value={formatInt(units)} accent="#D97706" />
          <StatCard label={t("reportsPage.summary.grossRevenue")} value={money(gross)} accent="#16A34A" />
          <StatCard label={t("reportsPage.summary.netRevenue")} value={money(net)} accent="var(--color-text-primary)" />
        </div>
      );
    }
    if (selectedReport === "webinarSales" && webinarSalesData) {
      const paid = webinarSalesData.reduce((s, r) => s + r.paidRegistrations, 0);
      const total = webinarSalesData.reduce((s, r) => s + r.totalRegistrations, 0);
      const rev = webinarSalesData.reduce((s, r) => s + r.revenue, 0);
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label={t("reportsPage.summary.sessions")} value={formatInt(webinarSalesData.length)} accent="#7C3AED" />
          <StatCard label={t("reportsPage.summary.registrations")} value={formatInt(total)} accent="#2563EB" />
          <StatCard label={t("reportsPage.summary.paidSeats")} value={formatInt(paid)} accent="#16A34A" />
          <StatCard label={t("reportsPage.summary.revenue")} value={money(rev)} accent="var(--color-text-primary)" />
        </div>
      );
    }
    if (selectedReport === "studentPurchases" && studentPurchasesData) {
      const total = studentPurchasesData.reduce((s, r) => s + r.netSpend, 0);
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <StatCard label={t("reportsPage.summary.students")} value={formatInt(studentPurchasesData.length)} accent="#0891B2" />
          <StatCard label={t("reportsPage.summary.netSpend")} value={money(total)} accent="var(--color-text-primary)" />
          <StatCard label={t("reportsPage.summary.avgPerStudent")} value={money(studentPurchasesData.length ? total / studentPurchasesData.length : 0)} accent="#16A34A" />
        </div>
      );
    }
    if (selectedReport === "financeActivity" && financeActivityData) {
      const uniqueActors = new Set(financeActivityData.map((r) => r.actorEmail).filter(Boolean)).size;
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <StatCard label={t("reportsPage.summary.events")} value={formatInt(financeActivityData.length)} accent="#EA580C" />
          <StatCard label={t("reportsPage.summary.actors")} value={formatInt(uniqueActors)} accent="#2563EB" />
          <StatCard label={t("reportsPage.summary.entities")} value={formatInt(new Set(financeActivityData.map((r) => r.entityType)).size)} accent="var(--color-text-primary)" />
        </div>
      );
    }
    return null;
  };

  const renderTable = () => {
    if (loading) return <TableSkeleton />;

    switch (selectedReport) {
      case "revenue": {
        if (!revenueData) return <EmptyState />;
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-5">
            <BreakdownTable
              title={t("reportsPage.tables.byGateway")}
              labelHeader={t("reportsPage.columns.gateway")}
              rows={revenueData.byGateway.map((r) => ({ label: gatewayLabel(r.gateway), count: r.count, amount: r.gross }))}
            />
            <BreakdownTable
              title={t("reportsPage.tables.byMethod")}
              labelHeader={t("reportsPage.columns.method")}
              rows={revenueData.byMethod.map((r) => ({ label: methodLabel(r.method), count: r.count, amount: r.gross }))}
            />
          </div>
        );
      }
      case "refunds": {
        if (!refundsData) return <EmptyState />;
        if (refundsData.length === 0) return <EmptyState />;
        return (
          <ScrollTable>
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)]">
                <Th align={isRTL ? "right" : "left"}>{t("reportsPage.columns.requester")}</Th>
                <Th align={isRTL ? "right" : "left"}>{t("reportsPage.columns.course")}</Th>
                <Th align={isRTL ? "right" : "left"}>{t("reportsPage.columns.gateway")}</Th>
                <Th align={isRTL ? "right" : "left"}>{t("reportsPage.columns.reason")}</Th>
                <Th align="right">{t("reportsPage.columns.amount")}</Th>
                <Th align={isRTL ? "right" : "left"}>{t("reportsPage.columns.status")}</Th>
                <Th align={isRTL ? "right" : "left"}>{t("reportsPage.columns.agent")}</Th>
                <Th align={isRTL ? "right" : "left"}>{t("reportsPage.columns.created")}</Th>
              </tr>
            </thead>
            <tbody>
              {refundsData.map((r) => (
                <tr key={r.id} className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-page)]">
                  <Td>
                    <div className="font-medium">{r.requesterName || "—"}</div>
                    <div className="text-xs text-[var(--color-text-secondary)]">{r.requesterEmail || ""}</div>
                  </Td>
                  <Td>{r.courseTitle || "—"}</Td>
                  <Td>{gatewayLabel(r.gateway)}</Td>
                  <Td className="capitalize">{(r.reason || "").replace(/_/g, " ")}</Td>
                  <Td align="right" className="font-medium">{money(r.refundAmount)}</Td>
                  <Td><StatusBadge status={r.status} /></Td>
                  <Td>{r.processedByName || "—"}</Td>
                  <Td className="whitespace-nowrap text-[var(--color-text-secondary)]">{formatDate(r.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>
        );
      }
      case "payments": {
        if (!paymentsData) return <EmptyState />;
        if (paymentsData.length === 0) return <EmptyState />;
        return (
          <ScrollTable>
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)]">
                <Th align={isRTL ? "right" : "left"}>{t("reportsPage.columns.buyer")}</Th>
                <Th align={isRTL ? "right" : "left"}>{t("reportsPage.columns.course")}</Th>
                <Th align={isRTL ? "right" : "left"}>{t("reportsPage.columns.gateway")}</Th>
                <Th align={isRTL ? "right" : "left"}>{t("reportsPage.columns.method")}</Th>
                <Th align="right">{t("reportsPage.columns.amount")}</Th>
                <Th align={isRTL ? "right" : "left"}>{t("reportsPage.columns.status")}</Th>
                <Th align={isRTL ? "right" : "left"}>{t("reportsPage.columns.paid")}</Th>
              </tr>
            </thead>
            <tbody>
              {paymentsData.map((r) => (
                <tr key={r.id} className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-page)]">
                  <Td>
                    <div className="font-medium">{r.userName || "—"}</div>
                    <div className="text-xs text-[var(--color-text-secondary)]">{r.userEmail || ""}</div>
                  </Td>
                  <Td>{r.courseTitle || "—"}</Td>
                  <Td>{gatewayLabel(r.gateway)}</Td>
                  <Td>{methodLabel(r.paymentMethod)}</Td>
                  <Td align="right" className="font-medium">{money(r.amount)}</Td>
                  <Td><StatusBadge status={r.status} /></Td>
                  <Td className="whitespace-nowrap text-[var(--color-text-secondary)]">{formatDate(r.paidAt)}</Td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>
        );
      }
      case "courseSales": {
        if (!courseSalesData) return <EmptyState />;
        if (courseSalesData.length === 0) return <EmptyState />;
        return (
          <ScrollTable>
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)]">
                <Th align={isRTL ? "right" : "left"}>{t("reportsPage.columns.course")}</Th>
                <Th align={isRTL ? "right" : "left"}>{t("reportsPage.columns.delivery")}</Th>
                <Th align="right">{t("reportsPage.columns.units")}</Th>
                <Th align="right">{t("reportsPage.columns.gross")}</Th>
                <Th align="right">{t("reportsPage.columns.refunds")}</Th>
                <Th align="right">{t("reportsPage.columns.net")}</Th>
              </tr>
            </thead>
            <tbody>
              {courseSalesData.map((r) => (
                <tr key={r.courseId} className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-page)]">
                  <Td className="font-medium">{isRTL && r.courseTitleAr ? r.courseTitleAr : r.courseTitle}</Td>
                  <Td className="capitalize">{r.deliveryType}</Td>
                  <Td align="right">{formatInt(r.units)}</Td>
                  <Td align="right">{money(r.gross)}</Td>
                  <Td align="right" className="text-[#DC2626]">{r.refunds > 0 ? moneyNeg(r.refunds) : money(0)}</Td>
                  <Td align="right" className="font-medium">{money(r.net)}</Td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>
        );
      }
      case "webinarSales": {
        if (!webinarSalesData) return <EmptyState />;
        if (webinarSalesData.length === 0) return <EmptyState />;
        return (
          <ScrollTable>
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)]">
                <Th align={isRTL ? "right" : "left"}>{t("reportsPage.columns.course")}</Th>
                <Th align={isRTL ? "right" : "left"}>{t("reportsPage.columns.session")}</Th>
                <Th align={isRTL ? "right" : "left"}>{t("reportsPage.columns.scheduled")}</Th>
                <Th align="right">{t("reportsPage.columns.totalReg")}</Th>
                <Th align="right">{t("reportsPage.columns.paidReg")}</Th>
                <Th align="right">{t("reportsPage.columns.revenue")}</Th>
              </tr>
            </thead>
            <tbody>
              {webinarSalesData.map((r) => (
                <tr key={r.sessionId} className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-page)]">
                  <Td>{r.courseTitle}</Td>
                  <Td className="font-medium">{r.sessionTitle || "—"}</Td>
                  <Td className="whitespace-nowrap text-[var(--color-text-secondary)]">{formatDateTime(r.scheduledAt)}</Td>
                  <Td align="right">{formatInt(r.totalRegistrations)}</Td>
                  <Td align="right" className="text-[#16A34A]">{formatInt(r.paidRegistrations)}</Td>
                  <Td align="right" className="font-medium">{money(r.revenue)}</Td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>
        );
      }
      case "studentPurchases": {
        if (!studentPurchasesData) return <EmptyState />;
        if (studentPurchasesData.length === 0) return <EmptyState />;
        return (
          <ScrollTable>
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)]">
                <Th align={isRTL ? "right" : "left"}>{t("reportsPage.columns.student")}</Th>
                <Th align="right">{t("reportsPage.columns.payments")}</Th>
                <Th align="right">{t("reportsPage.columns.coursesCount")}</Th>
                <Th align="right">{t("reportsPage.columns.totalPaid")}</Th>
                <Th align="right">{t("reportsPage.columns.refunded")}</Th>
                <Th align="right">{t("reportsPage.columns.net")}</Th>
                <Th align={isRTL ? "right" : "left"}>{t("reportsPage.columns.lastPurchase")}</Th>
              </tr>
            </thead>
            <tbody>
              {studentPurchasesData.map((r) => (
                <tr key={r.userId} className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-page)]">
                  <Td>
                    <div className="font-medium">{r.userName}</div>
                    <div className="text-xs text-[var(--color-text-secondary)]">{r.userEmail}</div>
                  </Td>
                  <Td align="right">{formatInt(r.paymentCount)}</Td>
                  <Td align="right">{formatInt(r.courseCount)}</Td>
                  <Td align="right">{money(r.totalPaid)}</Td>
                  <Td align="right" className="text-[#DC2626]">{r.totalRefunded > 0 ? moneyNeg(r.totalRefunded) : money(0)}</Td>
                  <Td align="right" className="font-medium">{money(r.netSpend)}</Td>
                  <Td className="whitespace-nowrap text-[var(--color-text-secondary)]">{formatDate(r.lastPurchaseAt)}</Td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>
        );
      }
      case "financeActivity": {
        if (!financeActivityData) return <EmptyState />;
        if (financeActivityData.length === 0) return <EmptyState />;
        return (
          <ScrollTable>
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)]">
                <Th align={isRTL ? "right" : "left"}>{t("reportsPage.columns.when")}</Th>
                <Th align={isRTL ? "right" : "left"}>{t("reportsPage.columns.actor")}</Th>
                <Th align={isRTL ? "right" : "left"}>{t("reportsPage.columns.action")}</Th>
                <Th align={isRTL ? "right" : "left"}>{t("reportsPage.columns.entityCol")}</Th>
                <Th align={isRTL ? "right" : "left"}>{t("reportsPage.columns.ip")}</Th>
              </tr>
            </thead>
            <tbody>
              {financeActivityData.map((r) => (
                <tr key={r.id} className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-page)]">
                  <Td className="whitespace-nowrap text-[var(--color-text-secondary)]">{formatDateTime(r.createdAt)}</Td>
                  <Td>
                    <div className="font-medium">{r.actorName || "—"}</div>
                    <div className="text-xs text-[var(--color-text-secondary)]">{r.actorEmail || ""}</div>
                  </Td>
                  <Td className="text-[var(--color-text-primary)]">{r.action}</Td>
                  <Td>
                    <div className="capitalize">{r.entityType.replace(/_/g, " ")}</div>
                    <div className="text-[10px] text-[var(--color-text-secondary)] font-mono">{r.entityId.slice(0, 8)}</div>
                  </Td>
                  <Td className="text-[var(--color-text-secondary)] font-mono text-xs">{r.ipAddress || "—"}</Td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>
        );
      }
      case "vat": {
        if (!vatData) return <EmptyState />;
        if (vatData.byMonth.length === 0) return <EmptyState />;
        return (
          <ScrollTable>
            <thead>
              <tr className="border-b border-[var(--color-border-subtle)]">
                <Th align={isRTL ? "right" : "left"}>{t("reportsPage.columns.month")}</Th>
                <Th align="right">{t("reportsPage.columns.invoices")}</Th>
                <Th align="right">{t("reportsPage.columns.taxableBase")}</Th>
                <Th align="right">{t("reportsPage.columns.vat")}</Th>
                <Th align="right">{t("reportsPage.columns.totalInvoiced")}</Th>
              </tr>
            </thead>
            <tbody>
              {vatData.byMonth.map((m) => (
                <tr key={m.month} className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-page)]">
                  <Td className="font-mono font-medium">{m.month}</Td>
                  <Td align="right">{formatInt(m.invoiceCount)}</Td>
                  <Td align="right">{money(m.taxableBase)}</Td>
                  <Td align="right" className="text-[#9333EA] font-medium">{money(m.vatAmount)}</Td>
                  <Td align="right" className="font-medium">{money(m.total)}</Td>
                </tr>
              ))}
            </tbody>
          </ScrollTable>
        );
      }
    }
  };

  // ─── Layout ────────────────────────────────────────────────────

  const inner = (
    <>
      {/* Page header + export tray */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                    {t("reportsPage.title")}
                  </h1>
                  <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                    {t("reportsPage.subtitle")}
                  </p>
                  {lastGeneratedAt && (
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      {t("reportsPage.lastGenerated", { when: formatDateTime(lastGeneratedAt.toISOString()) })}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ExportDropdown onExport={handleDownload} busy={downloading} />
                </div>
              </div>

              {/* 8 report cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                {REPORTS.map((r) => {
                  const Icon = r.icon;
                  const isSel = selectedReport === r.key;
                  return (
                    <button
                      key={r.key}
                      onClick={() => setSelectedReport(r.key)}
                      className={`p-4 rounded-xl border text-${isRTL ? "right" : "left"} transition-all ${
                        isSel
                          ? "bg-[var(--color-surface-page)] border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]"
                          : "bg-[var(--color-surface-card)] border-[var(--color-border)] hover:border-[var(--color-primary)]"
                      }`}
                    >
                      <div className={`w-9 h-9 ${r.iconBg} rounded-lg flex items-center justify-center mb-2.5`}>
                        <Icon className={`w-4 h-4 ${r.iconColor}`} />
                      </div>
                      <p className={`text-[13px] font-semibold leading-tight ${isSel ? "text-[var(--color-primary)]" : "text-[var(--color-text-primary)]"}`}>
                        {t(`reportsPage.cards.${r.key}.title`)}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 leading-tight line-clamp-2">
                        {t(`reportsPage.cards.${r.key}.desc`)}
                      </p>
                    </button>
                  );
                })}
              </div>

              {renderFilters()}
              {renderSummary()}

              {/* Preview */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--color-border-subtle)] flex items-center justify-between">
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                    {t(`reportsPage.cards.${selectedReport}.title`)}
                  </h3>
                  {!loading && lastGeneratedAt && (
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {t("reportsPage.previewNote")}
                    </span>
                  )}
                </div>
                {renderTable()}
              </div>
    </>
  );

  return embedded ? inner : <FinancePageShell>{inner}</FinancePageShell>;
};

// ─── Sub-components ──────────────────────────────────────────────

const StatCard = ({ label, value, accent }: { label: string; value: React.ReactNode; accent: string }) => (
  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
    <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
    <p className="text-lg font-bold mt-1" style={{ color: accent }}>{value}</p>
  </div>
);

const StatusBadge = ({ status }: { status: string }) => {
  const colorMap: Record<string, { bg: string; fg: string }> = {
    paid: { bg: "#DCFCE7", fg: "#16A34A" },
    completed: { bg: "#DCFCE7", fg: "#16A34A" },
    pending: { bg: "#FEF3C7", fg: "#D97706" },
    approved: { bg: "#DBEAFE", fg: "#2563EB" },
    processing: { bg: "#DBEAFE", fg: "#2563EB" },
    awaiting_approval: { bg: "#FEF3C7", fg: "#D97706" },
    rejected: { bg: "#FEE2E2", fg: "#DC2626" },
    failed: { bg: "#FEE2E2", fg: "#DC2626" },
    refunded: { bg: "#FEE2E2", fg: "#DC2626" },
    partially_refunded: { bg: "#FFEDD5", fg: "#EA580C" },
    chargeback: { bg: "#FEE2E2", fg: "#991B1B" },
  };
  const c = colorMap[status] || { bg: "#E5E7EB", fg: "#374151" };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize whitespace-nowrap"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
};

const ScrollTable = ({ children }: { children: React.ReactNode }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">{children}</table>
  </div>
);

const Th = ({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) => (
  <th
    scope="col"
    className={`px-4 py-3 text-${align} font-semibold text-[var(--color-text-primary)] whitespace-nowrap`}
  >
    {children}
  </th>
);

const Td = ({
  children, align = "left", className = "",
}: { children: React.ReactNode; align?: "left" | "right"; className?: string }) => (
  <td className={`px-4 py-3 text-${align} text-[var(--color-text-primary)] ${className}`}>
    {children}
  </td>
);

const BreakdownTable = ({
  title, labelHeader, rows,
}: { title: string; labelHeader: string; rows: { label: string; count: number; amount: number }[] }) => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const formatInt = (n: number) => fmtInt(n || 0, locale);
  const totalAmount = rows.reduce((s, r) => s + r.amount, 0);
  if (rows.length === 0) {
    return (
      <div className="bg-[var(--color-surface-page)] rounded-xl p-5">
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">{title}</h4>
        <p className="text-sm text-[var(--color-text-secondary)] text-center py-6">
          {t("reportsPage.noResults")}
        </p>
      </div>
    );
  }
  return (
    <div className="bg-[var(--color-surface-page)] rounded-xl p-5">
      <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">{title}</h4>
      <div className="space-y-2">
        {rows.map((r) => {
          const pct = totalAmount > 0 ? (r.amount / totalAmount) * 100 : 0;
          return (
            <div key={r.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-[var(--color-text-primary)]">
                  {r.label || "—"}
                </span>
                <span className="text-xs text-[var(--color-text-secondary)] inline-flex items-center gap-1">
                  <Money amount={r.amount || 0} decimals={2} /> · {formatInt(r.count)} {t("reportsPage.columns.payments").toLowerCase()}
                </span>
              </div>
              <div className="w-full bg-[var(--color-border)] rounded-full h-1.5">
                <div
                  className="bg-[var(--color-primary)] h-1.5 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        <div className="pt-3 mt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-sm">
          <span className="font-semibold text-[var(--color-text-primary)]">{labelHeader}</span>
          <span className="font-semibold text-[var(--color-text-primary)]"><Money amount={totalAmount || 0} decimals={2} /></span>
        </div>
      </div>
    </div>
  );
};

const TableSkeleton = () => (
  <div className="p-5 space-y-3">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="h-9 bg-[var(--color-surface-page)] rounded-md animate-pulse" />
    ))}
  </div>
);

const EmptyState = () => {
  const t = useTranslations("financeDashboard");
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <BarChart3 className="w-10 h-10 text-[var(--color-text-secondary)] mb-3" />
      <p className="text-sm text-[var(--color-text-secondary)]">{t("reportsPage.noResults")}</p>
    </div>
  );
};

export default FinanceReportsContent;
