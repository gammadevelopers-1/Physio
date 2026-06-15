"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import FinanceSidebar from "./FinanceSidebar";
import FinanceMobileSidebar from "./FinanceMobileSidebar";
import FinanceNavbar from "./FinanceNavbar";
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  Filter,
  BookOpen,
  Users,
  Monitor,
  Clock,
  AlertTriangle,
  Loader2,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { financeApi } from "@/lib/api";
import { useFinanceProfile } from "@/hooks/useFinanceProfile";
import { toast } from "sonner";

type ReportType =
  | "profitByCourse"
  | "profitByInstructor"
  | "profitByDelivery"
  | "invoiceAging"
  | "chargeback";

type PeriodKey =
  | "thisMonth"
  | "lastMonth"
  | "thisQuarter"
  | "thisYear"
  | "custom";

interface CourseProfitRow {
  courseId: string;
  title: string;
  titleAr: string | null;
  revenue: number;
  refundAmount: number;
  netRevenue: number;
  marginPercent: number;
  enrollmentCount: number;
}

interface InstructorProfitRow {
  instructorId: string | null;
  instructorName: string;
  courseCount: number;
  revenue: number;
  refundAmount: number;
  netRevenue: number;
  platformFee: number;
  netPayout: number;
  enrollmentCount: number;
}

interface DeliveryTypeRow {
  deliveryType: string;
  revenue: number;
  refundAmount: number;
  netRevenue: number;
  enrollmentCount: number;
  courseCount: number;
}

interface AgingBucket {
  count: number;
  amount: number;
}

interface InvoiceAgingData {
  current: AgingBucket;
  thirtyDay: AgingBucket;
  sixtyDay: AgingBucket;
  ninetyPlus: AgingBucket;
  paid: AgingBucket;
}

interface ChargebackData {
  chargebackCount: number;
  chargebackAmount: number;
  totalTransactions: number;
  chargebackRate: string;
  breakdown: Array<{
    courseId: string;
    courseTitle: string;
    gateway: string;
    chargebackCount: number;
    chargebackAmount: number;
  }>;
}

function getDateRange(period: PeriodKey, customStart?: string, customEnd?: string) {
  const now = new Date();
  let startDate: string | undefined;
  let endDate: string | undefined;

  switch (period) {
    case "thisMonth": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate = start.toISOString().slice(0, 10);
      endDate = now.toISOString().slice(0, 10);
      break;
    }
    case "lastMonth": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      startDate = start.toISOString().slice(0, 10);
      endDate = end.toISOString().slice(0, 10);
      break;
    }
    case "thisQuarter": {
      const qStart = Math.floor(now.getMonth() / 3) * 3;
      const start = new Date(now.getFullYear(), qStart, 1);
      startDate = start.toISOString().slice(0, 10);
      endDate = now.toISOString().slice(0, 10);
      break;
    }
    case "thisYear": {
      const start = new Date(now.getFullYear(), 0, 1);
      startDate = start.toISOString().slice(0, 10);
      endDate = now.toISOString().slice(0, 10);
      break;
    }
    case "custom": {
      startDate = customStart;
      endDate = customEnd;
      break;
    }
  }
  return { startDate, endDate };
}

function formatSAR(amount: number) {
  return `SAR ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const FinanceReportsContent = () => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const profile = useFinanceProfile();

  const [selectedReport, setSelectedReport] = useState<ReportType>("profitByCourse");
  const [period, setPeriod] = useState<PeriodKey>("thisMonth");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  // Report data states
  const [courseData, setCourseData] = useState<CourseProfitRow[]>([]);
  const [instructorData, setInstructorData] = useState<InstructorProfitRow[]>([]);
  const [deliveryData, setDeliveryData] = useState<DeliveryTypeRow[]>([]);
  const [agingData, setAgingData] = useState<InvoiceAgingData | null>(null);
  const [chargebackData, setChargebackData] = useState<ChargebackData | null>(null);

  const reportTypes: {
    key: ReportType;
    titleKey: string;
    descKey: string;
    icon: typeof BookOpen;
    iconBg: string;
    iconColor: string;
  }[] = [
    {
      key: "profitByCourse",
      titleKey: "reportsPage.reportTypes.profitByCourse",
      descKey: "reportsPage.reportTypes.profitByCourseDesc",
      icon: BookOpen,
      iconBg: "bg-[#DCFCE7]",
      iconColor: "text-[#16A34A]",
    },
    {
      key: "profitByInstructor",
      titleKey: "reportsPage.reportTypes.profitByInstructor",
      descKey: "reportsPage.reportTypes.profitByInstructorDesc",
      icon: Users,
      iconBg: "bg-[#EFF6FF]",
      iconColor: "text-[#3B82F6]",
    },
    {
      key: "profitByDelivery",
      titleKey: "reportsPage.reportTypes.profitByDelivery",
      descKey: "reportsPage.reportTypes.profitByDeliveryDesc",
      icon: Monitor,
      iconBg: "bg-[#EDE9FE]",
      iconColor: "text-[#8B5CF6]",
    },
    {
      key: "invoiceAging",
      titleKey: "reportsPage.reportTypes.invoiceAging",
      descKey: "reportsPage.reportTypes.invoiceAgingDesc",
      icon: Clock,
      iconBg: "bg-[#FFEDD5]",
      iconColor: "text-[#EA580C]",
    },
    {
      key: "chargeback",
      titleKey: "reportsPage.reportTypes.chargeback",
      descKey: "reportsPage.reportTypes.chargebackDesc",
      icon: AlertTriangle,
      iconBg: "bg-[#FEE2E2]",
      iconColor: "text-[#DC2626]",
    },
  ];

  const generateReport = useCallback(async () => {
    setLoading(true);
    setGenerated(false);
    const { startDate, endDate } = getDateRange(period, customStart, customEnd);
    const params = { startDate, endDate };

    try {
      switch (selectedReport) {
        case "profitByCourse": {
          const data = await financeApi.getRevenueByCourse(params);
          setCourseData(data || []);
          break;
        }
        case "profitByInstructor": {
          const data = await financeApi.getRevenueByInstructor(params);
          setInstructorData(data || []);
          break;
        }
        case "profitByDelivery": {
          const data = await financeApi.getRevenueByDeliveryType(params);
          setDeliveryData(data || []);
          break;
        }
        case "invoiceAging": {
          const data = await financeApi.getInvoiceAging(params);
          setAgingData(data || null);
          break;
        }
        case "chargeback": {
          const data = await financeApi.getChargebackRate(params);
          setChargebackData(data || null);
          break;
        }
      }
      setGenerated(true);
    } catch {
      toast.error(t("reportsPage.exportError"));
    } finally {
      setLoading(false);
    }
  }, [selectedReport, period, customStart, customEnd, t]);

  // Auto-generate on mount
  useEffect(() => {
    generateReport();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const reportTypeMap: Record<ReportType, string> = {
    profitByCourse: "profitByCourse",
    profitByInstructor: "profitByInstructor",
    profitByDelivery: "profitByDelivery",
    invoiceAging: "invoiceAging",
    chargeback: "chargeback",
  };

  const handleExportExcel = async () => {
    try {
      const { startDate, endDate } = getDateRange(period, customStart, customEnd);
      await financeApi.exportExcel({ startDate, endDate, reportType: reportTypeMap[selectedReport], locale });
      toast.success(t("reportsPage.exportSuccess"));
    } catch {
      toast.error(t("reportsPage.exportError"));
    }
  };

  const handleExportPdf = async () => {
    try {
      const { startDate, endDate } = getDateRange(period, customStart, customEnd);
      await financeApi.exportPdf({ startDate, endDate, reportType: reportTypeMap[selectedReport], locale });
      toast.success(t("reportsPage.exportSuccess"));
    } catch {
      toast.error(t("reportsPage.exportError"));
    }
  };

  const deliveryLabel = (type: string) => {
    const map: Record<string, string> = {
      zoom: t("reportsPage.delivery.zoom"),
      onsite: t("reportsPage.delivery.onsite"),
      blended: t("reportsPage.delivery.blended"),
    };
    return map[type] || t("reportsPage.delivery.unknown");
  };

  // Summary stats for course/instructor/delivery reports
  const getSummaryStats = () => {
    if (selectedReport === "profitByCourse" && courseData.length > 0) {
      const totalRev = courseData.reduce((s, r) => s + r.revenue, 0);
      const totalRef = courseData.reduce((s, r) => s + r.refundAmount, 0);
      const netRev = totalRev - totalRef;
      const avgMargin = courseData.length > 0
        ? courseData.reduce((s, r) => s + r.marginPercent, 0) / courseData.length
        : 0;
      return { totalRev, totalRef, netRev, avgMargin };
    }
    if (selectedReport === "profitByInstructor" && instructorData.length > 0) {
      const totalRev = instructorData.reduce((s, r) => s + r.revenue, 0);
      const totalRef = instructorData.reduce((s, r) => s + r.refundAmount, 0);
      const netRev = totalRev - totalRef;
      const avgMargin = totalRev > 0 ? ((netRev / totalRev) * 100) : 0;
      return { totalRev, totalRef, netRev, avgMargin };
    }
    if (selectedReport === "profitByDelivery" && deliveryData.length > 0) {
      const totalRev = deliveryData.reduce((s, r) => s + r.revenue, 0);
      const totalRef = deliveryData.reduce((s, r) => s + r.refundAmount, 0);
      const netRev = totalRev - totalRef;
      const avgMargin = totalRev > 0 ? ((netRev / totalRev) * 100) : 0;
      return { totalRev, totalRef, netRev, avgMargin };
    }
    return null;
  };

  const summaryStats = getSummaryStats();

  const renderReportContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-[#a37f49] animate-spin mb-3" />
          <p className="text-sm text-[#6B7280]">{t("reportsPage.loading")}</p>
        </div>
      );
    }

    if (!generated) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-5">
          <BarChart3 className="w-12 h-12 text-[#D1D5DB] mb-4" />
          <p className="text-sm text-[#6B7280] text-center">{t("reportsPage.noData")}</p>
          <p className="text-xs text-[#9CA3AF] text-center mt-1">{t("reportsPage.exportHint")}</p>
        </div>
      );
    }

    switch (selectedReport) {
      case "profitByCourse":
        return renderCourseReport();
      case "profitByInstructor":
        return renderInstructorReport();
      case "profitByDelivery":
        return renderDeliveryReport();
      case "invoiceAging":
        return renderAgingReport();
      case "chargeback":
        return renderChargebackReport();
    }
  };

  const renderCourseReport = () => {
    if (courseData.length === 0) {
      return <EmptyState />;
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Course profit report">
          <thead>
            <tr className="border-b border-[#F3F4F6]">
              <th scope="col" className={`px-4 py-3 text-${isRTL ? "right" : "left"} font-semibold text-[#374151]`}>
                {t("reportsPage.columns.course")}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold text-[#374151]">
                {t("reportsPage.columns.revenue")}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold text-[#374151]">
                {t("reportsPage.columns.refunds")}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold text-[#374151]">
                {t("reportsPage.columns.netProfit")}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold text-[#374151]">
                {t("reportsPage.columns.margin")}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold text-[#374151]">
                {t("reportsPage.columns.enrollments")}
              </th>
            </tr>
          </thead>
          <tbody>
            {courseData.map((row) => (
              <tr key={row.courseId} className="border-b border-[#F9FAFB] hover:bg-[#F9FAFB] transition-colors">
                <td className={`px-4 py-3 text-${isRTL ? "right" : "left"} font-medium text-[#111827]`}>
                  {isRTL && row.titleAr ? row.titleAr : row.title}
                </td>
                <td className="px-4 py-3 text-right text-[#111827]">{formatSAR(row.revenue)}</td>
                <td className="px-4 py-3 text-right text-[#DC2626]">
                  {row.refundAmount > 0 ? `-${formatSAR(row.refundAmount)}` : formatSAR(0)}
                </td>
                <td className="px-4 py-3 text-right font-medium text-[#111827]">{formatSAR(row.netRevenue)}</td>
                <td className="px-4 py-3 text-right">
                  <MarginBadge value={row.marginPercent} />
                </td>
                <td className="px-4 py-3 text-right text-[#6B7280]">{row.enrollmentCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderInstructorReport = () => {
    if (instructorData.length === 0) {
      return <EmptyState />;
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label="Instructor profit report">
          <thead>
            <tr className="border-b border-[#F3F4F6]">
              <th scope="col" className={`px-4 py-3 text-${isRTL ? "right" : "left"} font-semibold text-[#374151]`}>
                {t("reportsPage.columns.instructor")}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold text-[#374151]">
                {t("reportsPage.columns.courses")}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold text-[#374151]">
                {t("reportsPage.columns.revenue")}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold text-[#374151]">
                {t("reportsPage.columns.refunds")}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold text-[#374151]">
                {t("reportsPage.columns.netProfit")}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold text-[#374151]">
                {t("reportsPage.columns.platformFee")}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold text-[#374151]">
                {t("reportsPage.columns.netPayout")}
              </th>
              <th scope="col" className="px-4 py-3 text-right font-semibold text-[#374151]">
                {t("reportsPage.columns.enrollments")}
              </th>
            </tr>
          </thead>
          <tbody>
            {instructorData.map((row, idx) => {
              const margin = row.revenue > 0 ? ((row.netRevenue / row.revenue) * 100) : 0;
              return (
                <tr key={row.instructorId || idx} className="border-b border-[#F9FAFB] hover:bg-[#F9FAFB] transition-colors">
                  <td className={`px-4 py-3 text-${isRTL ? "right" : "left"} font-medium text-[#111827]`}>
                    {row.instructorName || "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-[#6B7280]">{row.courseCount}</td>
                  <td className="px-4 py-3 text-right text-[#111827]">{formatSAR(row.revenue)}</td>
                  <td className="px-4 py-3 text-right text-[#DC2626]">
                    {row.refundAmount > 0 ? `-${formatSAR(row.refundAmount)}` : formatSAR(0)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-[#111827]">{formatSAR(row.netRevenue)}</td>
                  <td className="px-4 py-3 text-right text-[#EA580C]">{formatSAR(row.platformFee)}</td>
                  <td className="px-4 py-3 text-right font-medium text-[#16A34A]">{formatSAR(row.netPayout)}</td>
                  <td className="px-4 py-3 text-right text-[#6B7280]">{row.enrollmentCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderDeliveryReport = () => {
    if (deliveryData.length === 0) {
      return <EmptyState />;
    }

    const totalRevenue = deliveryData.reduce((s, r) => s + r.revenue, 0);

    return (
      <div className="space-y-6">
        {/* Visual bars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-5 pt-2">
          {deliveryData.map((row) => {
            const pct = totalRevenue > 0 ? (row.revenue / totalRevenue) * 100 : 0;
            const margin = row.revenue > 0 ? ((row.netRevenue / row.revenue) * 100) : 0;
            return (
              <div key={row.deliveryType} className="bg-[#F9FAFB] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-[#111827]">{deliveryLabel(row.deliveryType)}</span>
                  <span className="text-xs text-[#6B7280]">{pct.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-[#E5E7EB] rounded-full h-2 mb-3">
                  <div
                    className="bg-[#a37f49] h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <div className="space-y-1 text-xs text-[#6B7280]">
                  <div className="flex justify-between">
                    <span>{t("reportsPage.columns.revenue")}</span>
                    <span className="font-medium text-[#111827]">{formatSAR(row.revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("reportsPage.columns.netProfit")}</span>
                    <span className="font-medium text-[#111827]">{formatSAR(row.netRevenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("reportsPage.columns.margin")}</span>
                    <MarginBadge value={margin} />
                  </div>
                  <div className="flex justify-between">
                    <span>{t("reportsPage.columns.courses")}</span>
                    <span>{row.courseCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("reportsPage.columns.enrollments")}</span>
                    <span>{row.enrollmentCount}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Delivery type report">
            <thead>
              <tr className="border-b border-[#F3F4F6]">
                <th scope="col" className={`px-4 py-3 text-${isRTL ? "right" : "left"} font-semibold text-[#374151]`}>
                  {t("reportsPage.columns.deliveryType")}
                </th>
                <th scope="col" className="px-4 py-3 text-right font-semibold text-[#374151]">{t("reportsPage.columns.revenue")}</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold text-[#374151]">{t("reportsPage.columns.refunds")}</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold text-[#374151]">{t("reportsPage.columns.netProfit")}</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold text-[#374151]">{t("reportsPage.columns.courses")}</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold text-[#374151]">{t("reportsPage.columns.enrollments")}</th>
              </tr>
            </thead>
            <tbody>
              {deliveryData.map((row) => (
                <tr key={row.deliveryType} className="border-b border-[#F9FAFB] hover:bg-[#F9FAFB] transition-colors">
                  <td className={`px-4 py-3 text-${isRTL ? "right" : "left"} font-medium text-[#111827]`}>
                    {deliveryLabel(row.deliveryType)}
                  </td>
                  <td className="px-4 py-3 text-right text-[#111827]">{formatSAR(row.revenue)}</td>
                  <td className="px-4 py-3 text-right text-[#DC2626]">
                    {row.refundAmount > 0 ? `-${formatSAR(row.refundAmount)}` : formatSAR(0)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-[#111827]">{formatSAR(row.netRevenue)}</td>
                  <td className="px-4 py-3 text-right text-[#6B7280]">{row.courseCount}</td>
                  <td className="px-4 py-3 text-right text-[#6B7280]">{row.enrollmentCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderAgingReport = () => {
    if (!agingData) {
      return <EmptyState />;
    }

    const totalOutstandingCount = agingData.current.count + agingData.thirtyDay.count + agingData.sixtyDay.count + agingData.ninetyPlus.count;
    const totalOutstandingAmount = agingData.current.amount + agingData.thirtyDay.amount + agingData.sixtyDay.amount + agingData.ninetyPlus.amount;

    const buckets = [
      { key: "current", label: t("reportsPage.aging.current"), count: agingData.current.count, amount: agingData.current.amount, color: "#16A34A", bg: "#DCFCE7" },
      { key: "thirtyDay", label: t("reportsPage.aging.thirtyDay"), count: agingData.thirtyDay.count, amount: agingData.thirtyDay.amount, color: "#CA8A04", bg: "#FEF9C3" },
      { key: "sixtyDay", label: t("reportsPage.aging.sixtyDay"), count: agingData.sixtyDay.count, amount: agingData.sixtyDay.amount, color: "#EA580C", bg: "#FFEDD5" },
      { key: "ninetyPlus", label: t("reportsPage.aging.ninetyPlus"), count: agingData.ninetyPlus.count, amount: agingData.ninetyPlus.amount, color: "#DC2626", bg: "#FEE2E2" },
    ];

    return (
      <div className="space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 px-5 pt-2">
          {buckets.map((b) => {
            const pct = totalOutstandingCount > 0 ? ((b.count / totalOutstandingCount) * 100).toFixed(1) : "0.0";
            return (
              <div key={b.key} className="rounded-xl p-4" style={{ backgroundColor: b.bg }}>
                <p className="text-xs font-medium" style={{ color: b.color }}>{b.label}</p>
                <p className="text-2xl font-bold mt-1" style={{ color: b.color }}>{b.count}</p>
                <p className="text-xs mt-0.5" style={{ color: b.color }}>{formatSAR(b.amount)}</p>
                <p className="text-[10px] mt-0.5" style={{ color: b.color }}>{pct}% {t("reportsPage.aging.invoices")}</p>
              </div>
            );
          })}
          <div className="rounded-xl p-4 bg-[#EFF6FF]">
            <p className="text-xs font-medium text-[#3B82F6]">{t("reportsPage.aging.paid")}</p>
            <p className="text-2xl font-bold mt-1 text-[#3B82F6]">{agingData.paid.count}</p>
            <p className="text-xs mt-0.5 text-[#3B82F6]">{formatSAR(agingData.paid.amount)}</p>
            <p className="text-[10px] mt-0.5 text-[#3B82F6]">{t("reportsPage.aging.invoices")}</p>
          </div>
        </div>

        {/* Visual bar */}
        {totalOutstandingCount > 0 && (
          <div className="px-5">
            <p className="text-xs text-[#6B7280] mb-2">
              {t("reportsPage.aging.total")}: {totalOutstandingCount} {t("reportsPage.aging.invoices")} — {formatSAR(totalOutstandingAmount)}
            </p>
            <div className="flex h-4 rounded-full overflow-hidden">
              {buckets.map((b) => {
                const pct = totalOutstandingCount > 0 ? (b.count / totalOutstandingCount) * 100 : 0;
                return pct > 0 ? (
                  <div
                    key={b.key}
                    className="transition-all"
                    style={{ width: `${pct}%`, backgroundColor: b.color }}
                    title={`${b.label}: ${b.count} (${formatSAR(b.amount)})`}
                  />
                ) : null;
              })}
            </div>
            <div className="flex gap-4 mt-2">
              {buckets.map((b) => (
                <div key={b.key} className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                  {b.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderChargebackReport = () => {
    if (!chargebackData) {
      return <EmptyState />;
    }

    return (
      <div className="space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-5 pt-2">
          <StatCard
            label={t("reportsPage.chargeback.totalTransactions")}
            value={chargebackData.totalTransactions.toLocaleString()}
            color="#374151"
          />
          <StatCard
            label={t("reportsPage.chargeback.chargebackCount")}
            value={chargebackData.chargebackCount.toLocaleString()}
            color="#DC2626"
          />
          <StatCard
            label={t("reportsPage.chargeback.chargebackAmount")}
            value={formatSAR(chargebackData.chargebackAmount)}
            color="#DC2626"
          />
          <StatCard
            label={t("reportsPage.chargeback.chargebackRate")}
            value={`${chargebackData.chargebackRate}%`}
            color={Number(chargebackData.chargebackRate) > 1 ? "#DC2626" : "#16A34A"}
          />
        </div>

        {/* Breakdown table */}
        <div className="px-5">
          <h4 className="text-sm font-semibold text-[#111827] mb-3">
            {t("reportsPage.chargeback.breakdown")}
          </h4>
        </div>
        {chargebackData.breakdown.length === 0 ? (
          <p className="px-5 pb-4 text-sm text-[#6B7280]">{t("reportsPage.chargeback.noCases")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Chargeback report">
              <thead>
                <tr className="border-b border-[#F3F4F6]">
                  <th scope="col" className={`px-4 py-3 text-${isRTL ? "right" : "left"} font-semibold text-[#374151]`}>
                    {t("reportsPage.columns.course")}
                  </th>
                  <th scope="col" className={`px-4 py-3 text-${isRTL ? "right" : "left"} font-semibold text-[#374151]`}>
                    {t("reportsPage.columns.gateway")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold text-[#374151]">
                    {t("reportsPage.columns.count")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold text-[#374151]">
                    {t("reportsPage.columns.amount")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {chargebackData.breakdown.map((row, idx) => (
                  <tr key={idx} className="border-b border-[#F9FAFB] hover:bg-[#F9FAFB] transition-colors">
                    <td className={`px-4 py-3 text-${isRTL ? "right" : "left"} font-medium text-[#111827]`}>
                      {row.courseTitle}
                    </td>
                    <td className={`px-4 py-3 text-${isRTL ? "right" : "left"} text-[#6B7280] capitalize`}>
                      {row.gateway}
                    </td>
                    <td className="px-4 py-3 text-right text-[#DC2626] font-medium">{row.chargebackCount}</td>
                    <td className="px-4 py-3 text-right text-[#DC2626]">{formatSAR(row.chargebackAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <FinanceNavbar profile={profile} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <FinanceSidebar profile={profile} />
            </div>

            <FinanceMobileSidebar profile={profile} />

            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                    {t("reportsPage.title")}
                  </h1>
                  <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                    {t("reportsPage.subtitle")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleExportExcel}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    {t("reportsPage.exportExcel")}
                  </button>
                  <button
                    onClick={handleExportPdf}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    {t("reportsPage.exportPdf")}
                  </button>
                </div>
              </div>

              {/* Report Type Selection — 5 cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
                {reportTypes.map((report) => {
                  const Icon = report.icon;
                  const isSelected = selectedReport === report.key;
                  return (
                    <button
                      key={report.key}
                      onClick={() => {
                        setSelectedReport(report.key);
                        setGenerated(false);
                      }}
                      className={`p-4 rounded-xl border text-${isRTL ? "right" : "left"} transition-all ${
                        isSelected
                          ? "bg-[#FDF6EC] border-[#a37f49] ring-1 ring-[#a37f49]"
                          : "bg-white border-[#E5E7EB] hover:border-[#D1D5DB]"
                      }`}
                    >
                      <div className={`w-9 h-9 ${report.iconBg} rounded-lg flex items-center justify-center mb-2.5`}>
                        <Icon className={`w-4.5 h-4.5 ${report.iconColor}`} />
                      </div>
                      <p className={`text-[13px] font-semibold leading-tight ${isSelected ? "text-[#a37f49]" : "text-[#111827]"}`}>
                        {t(report.titleKey)}
                      </p>
                      <p className="text-[11px] text-[#6B7280] mt-0.5 leading-tight">{t(report.descKey)}</p>
                    </button>
                  );
                })}
              </div>

              {/* Filters */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Filter className="w-4 h-4 text-[#6B7280]" />
                  <h3 className="text-sm font-semibold text-[#111827]">{t("reportsPage.filters.period")}</h3>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
                  <div>
                    <label className="block text-[12px] text-[#6B7280] mb-1">{t("reportsPage.filters.period")}</label>
                    <select
                      value={period}
                      onChange={(e) => setPeriod(e.target.value as PeriodKey)}
                      className="px-3 py-2 border border-[#E5E7EB] rounded-lg text-[13px] text-[#374151] bg-white focus:outline-none focus:border-[#a37f49]"
                    >
                      <option value="thisMonth">{t("reportsPage.filters.thisMonth")}</option>
                      <option value="lastMonth">{t("reportsPage.filters.lastMonth")}</option>
                      <option value="thisQuarter">{t("reportsPage.filters.thisQuarter")}</option>
                      <option value="thisYear">{t("reportsPage.filters.thisYear")}</option>
                      <option value="custom">{t("reportsPage.filters.custom")}</option>
                    </select>
                  </div>
                  {period === "custom" && (
                    <>
                      <div>
                        <label className="block text-[12px] text-[#6B7280] mb-1">{t("reportsPage.filters.startDate")}</label>
                        <input
                          type="date"
                          value={customStart}
                          onChange={(e) => setCustomStart(e.target.value)}
                          className="px-3 py-2 border border-[#E5E7EB] rounded-lg text-[13px] text-[#374151] bg-white focus:outline-none focus:border-[#a37f49]"
                        />
                      </div>
                      <div>
                        <label className="block text-[12px] text-[#6B7280] mb-1">{t("reportsPage.filters.endDate")}</label>
                        <input
                          type="date"
                          value={customEnd}
                          onChange={(e) => setCustomEnd(e.target.value)}
                          className="px-3 py-2 border border-[#E5E7EB] rounded-lg text-[13px] text-[#374151] bg-white focus:outline-none focus:border-[#a37f49]"
                        />
                      </div>
                    </>
                  )}
                  <div className="sm:ml-auto flex items-end">
                    <button
                      onClick={generateReport}
                      disabled={loading}
                      className="flex items-center gap-1.5 px-4 py-2 btn-gold text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <BarChart3 className="w-4 h-4" />
                      )}
                      {t("reportsPage.generateReport")}
                    </button>
                  </div>
                </div>
              </div>

              {/* Summary Stats (for profitability reports) */}
              {generated && summaryStats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                    <p className="text-xs text-[#6B7280]">{t("reportsPage.summary.totalRevenue")}</p>
                    <p className="text-lg font-bold text-[#111827] mt-1">{formatSAR(summaryStats.totalRev)}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                    <p className="text-xs text-[#6B7280]">{t("reportsPage.summary.totalRefunds")}</p>
                    <p className="text-lg font-bold text-[#DC2626] mt-1">{formatSAR(summaryStats.totalRef)}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                    <p className="text-xs text-[#6B7280]">{t("reportsPage.summary.netRevenue")}</p>
                    <p className="text-lg font-bold text-[#16A34A] mt-1">{formatSAR(summaryStats.netRev)}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                    <p className="text-xs text-[#6B7280]">{t("reportsPage.summary.avgMargin")}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-lg font-bold text-[#111827]">{summaryStats.avgMargin.toFixed(1)}%</p>
                      {summaryStats.avgMargin >= 70 ? (
                        <TrendingUp className="w-4 h-4 text-[#16A34A]" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-[#DC2626]" />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Report Results */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#F3F4F6]">
                  <h3 className="text-base font-semibold text-[#111827]">
                    {t(reportTypes.find((r) => r.key === selectedReport)?.titleKey || "")}
                  </h3>
                </div>
                {renderReportContent()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

function MarginBadge({ value }: { value: number }) {
  const color = value >= 80 ? "#16A34A" : value >= 50 ? "#CA8A04" : "#DC2626";
  const bg = value >= 80 ? "#DCFCE7" : value >= 50 ? "#FEF9C3" : "#FEE2E2";
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ color, backgroundColor: bg }}
    >
      {value >= 50 ? (
        <ArrowUpRight className="w-3 h-3" />
      ) : (
        <ArrowDownRight className="w-3 h-3" />
      )}
      {value.toFixed(1)}%
    </span>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-[#F9FAFB] rounded-xl p-4">
      <p className="text-xs text-[#6B7280]">{label}</p>
      <p className="text-xl font-bold mt-1" style={{ color }}>{value}</p>
    </div>
  );
}

function EmptyState() {
  const t = useTranslations("financeDashboard");
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <BarChart3 className="w-10 h-10 text-[#D1D5DB] mb-3" />
      <p className="text-sm text-[#6B7280]">{t("reportsPage.noResults")}</p>
    </div>
  );
}

export default FinanceReportsContent;
