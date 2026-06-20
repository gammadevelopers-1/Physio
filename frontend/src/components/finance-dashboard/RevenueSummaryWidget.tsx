"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart as PieIcon,
  Layers,
  Trophy,
  Loader2,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { financeApi } from "@/lib/api";
import Money from "./shared/Money";
import { GATEWAY_COLORS, gatewayColor, FINANCE_COLORS, CHART_PALETTE } from "./shared/financeColors";
import { ChartSkeleton } from "./shared/Skeleton";

type ChartTab = "trend" | "status" | "topCourses" | "delivery";
type GatewayMode = "revenue" | "volume";

interface GatewayBreakdown {
  name: string;
  gatewayKey: string;
  percentage: number;
  amount: number;
  count?: number;
  totalCount?: number;
}

interface TopCourse {
  name: string;
  revenue: number;
  enrollments: number;
}

interface RevenueSummaryWidgetProps {
  gateways: GatewayBreakdown[];
  topCourses: TopCourse[];
  summary: { grossRevenue: number; averageOrderValue: number };
  dateRange: { startDate?: string; endDate?: string };
  loading?: boolean;
}

const STATUS_COLOR_MAP: Record<string, string> = {
  paid: FINANCE_COLORS.success.hex,
  pending: FINANCE_COLORS.warning.hex,
  awaiting_approval: FINANCE_COLORS.info.hex,
  failed: FINANCE_COLORS.error.hex,
  refunded: FINANCE_COLORS.violet.hex,
  partially_refunded: "#A78BFA",
  chargeback: FINANCE_COLORS.slate.hex,
  processing: "#94A3B8",
};

const MEDAL_STYLE = [
  { bg: "bg-gradient-to-br from-amber-300 to-amber-500", text: "text-amber-900", emoji: "🥇" },
  { bg: "bg-gradient-to-br from-slate-300 to-slate-400", text: "text-slate-800", emoji: "🥈" },
  { bg: "bg-gradient-to-br from-orange-300 to-orange-500", text: "text-orange-900", emoji: "🥉" },
];

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function getChartParams(filter: string): {
  period: "day" | "week" | "month";
  startDate: string;
  endDate: string;
} {
  const todayStr = new Date().toISOString().slice(0, 10);
  switch (filter) {
    case "week":
      return { period: "day", startDate: daysAgo(6), endDate: todayStr };
    case "quarter":
      return { period: "week", startDate: daysAgo(89), endDate: todayStr };
    case "year":
      return { period: "month", startDate: daysAgo(364), endDate: todayStr };
    default:
      return { period: "day", startDate: daysAgo(29), endDate: todayStr };
  }
}

function formatLabel(periodStr: string, period: "day" | "week" | "month", locale: string): string {
  if (!periodStr) return "";
  try {
    const date = new Date(periodStr);
    const loc = locale === "ar" ? "ar-SA" : "en-US";
    if (period === "month") return date.toLocaleDateString(loc, { month: "short", year: "2-digit" });
    return date.toLocaleDateString(loc, { month: "short", day: "numeric" });
  } catch {
    return periodStr.slice(0, 10);
  }
}

const RevenueSummaryWidget = ({
  gateways,
  topCourses,
  summary,
  dateRange,
  loading,
}: RevenueSummaryWidgetProps) => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const [activeTab, setActiveTab] = useState<ChartTab>("trend");
  const [timeFilter, setTimeFilter] = useState("month");
  const [gatewayMode, setGatewayMode] = useState<GatewayMode>("revenue");

  // Trend data (own time-filter)
  const [trendData, setTrendData] = useState<
    { period: string; revenue: number; count: number; label: string }[]
  >([]);
  const [trendLoading, setTrendLoading] = useState(false);

  // Status mix data (page date range)
  const [statusData, setStatusData] = useState<
    { status: string; count: number; totalAmount: number }[]
  >([]);
  const [statusLoading, setStatusLoading] = useState(false);

  // Delivery type data (page date range)
  const [deliveryData, setDeliveryData] = useState<
    { deliveryType: string; revenue: number; netRevenue: number }[]
  >([]);
  const [deliveryLoading, setDeliveryLoading] = useState(false);

  const fetchTrend = useCallback(async () => {
    setTrendLoading(true);
    try {
      const params = getChartParams(timeFilter);
      const result = await financeApi.getRevenueTrend(params);
      const safe = (result || []).map(
        (d: { period: string; revenue: number; count: number }) => ({
          ...d,
          label: formatLabel(d.period, params.period, locale),
        }),
      );
      setTrendData(safe);
    } catch {
      setTrendData([]);
    } finally {
      setTrendLoading(false);
    }
  }, [timeFilter, locale]);

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const result = await financeApi.getPaymentStatus(dateRange);
      setStatusData(result || []);
    } catch {
      setStatusData([]);
    } finally {
      setStatusLoading(false);
    }
  }, [dateRange]);

  const fetchDelivery = useCallback(async () => {
    setDeliveryLoading(true);
    try {
      const result = await financeApi.getRevenueByDeliveryType(dateRange);
      setDeliveryData(result || []);
    } catch {
      setDeliveryData([]);
    } finally {
      setDeliveryLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    if (activeTab === "trend") fetchTrend();
  }, [activeTab, fetchTrend]);

  useEffect(() => {
    if (activeTab === "status") fetchStatus();
  }, [activeTab, fetchStatus]);

  useEffect(() => {
    if (activeTab === "delivery") fetchDelivery();
  }, [activeTab, fetchDelivery]);

  const trendPct = useMemo(() => {
    if (trendData.length < 2) return null;
    const half = Math.floor(trendData.length / 2);
    const firstHalf = trendData.slice(0, half).reduce((s, d) => s + d.revenue, 0);
    const secondHalf = trendData.slice(half).reduce((s, d) => s + d.revenue, 0);
    if (firstHalf === 0) return null;
    return ((secondHalf - firstHalf) / firstHalf) * 100;
  }, [trendData]);

  // Recompute gateway percentages based on selected mode
  const gatewayDisplay = useMemo(() => {
    if (gatewayMode === "revenue") {
      const total = gateways.reduce((s, g) => s + g.amount, 0);
      return gateways
        .map((g) => ({
          ...g,
          displayPct: total > 0 ? Math.round((g.amount / total) * 100) : 0,
          displayValue: g.amount,
        }))
        .sort((a, b) => b.displayValue - a.displayValue);
    }
    const total = gateways.reduce((s, g) => s + (g.totalCount || 0), 0);
    return gateways
      .map((g) => ({
        ...g,
        displayPct: total > 0 ? Math.round(((g.totalCount || 0) / total) * 100) : 0,
        displayValue: g.totalCount || 0,
      }))
      .sort((a, b) => b.displayValue - a.displayValue);
  }, [gateways, gatewayMode]);

  const bnplGateways = new Set(["tamara", "tabby"]);
  const bnplPct = Math.min(
    100,
    gatewayDisplay
      .filter((g) => bnplGateways.has(g.gatewayKey))
      .reduce((s, g) => s + g.displayPct, 0),
  );
  const directPct = Math.max(0, 100 - bnplPct);

  const tabs: { key: ChartTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "trend", label: t("revenueSummary.tabs.trend"), icon: TrendingUp },
    { key: "status", label: t("revenueSummary.tabs.status"), icon: PieIcon },
    { key: "topCourses", label: t("revenueSummary.tabs.topCourses"), icon: BarChart3 },
    { key: "delivery", label: t("revenueSummary.tabs.delivery"), icon: Layers },
  ];

  const timeFilters = [
    { key: "week", label: t("revenueSummary.timeFilters.week") },
    { key: "month", label: t("revenueSummary.timeFilters.month") },
    { key: "quarter", label: t("revenueSummary.timeFilters.quarter") },
    { key: "year", label: t("revenueSummary.timeFilters.year") },
  ];

  const hasTrendData = trendData.length >= 1;

  // Status chart data
  const statusChartData = useMemo(
    () =>
      statusData
        .filter((s) => s.count > 0)
        .map((s) => ({
          name: t(
            `status.${
              s.status === "partially_refunded"
                ? "partiallyRefunded"
                : s.status === "awaiting_approval"
                  ? "awaitingApproval"
                  : s.status
            }`,
          ),
          value: s.totalAmount,
          count: s.count,
          color: STATUS_COLOR_MAP[s.status] || "#94A3B8",
        })),
    [statusData, t],
  );

  // Top courses data (with comparison bar widths)
  const topCoursesDisplay = useMemo(() => {
    const top = topCourses.slice(0, 4);
    const max = Math.max(...top.map((c) => c.revenue), 0);
    return top.map((c, idx) => ({
      ...c,
      rank: idx + 1,
      barPct: max > 0 ? Math.max(2, (c.revenue / max) * 100) : 0,
    }));
  }, [topCourses]);

  // Delivery chart data
  const deliveryChartData = useMemo(
    () =>
      deliveryData.map((d) => {
        const key = `analytics.delivery.${d.deliveryType || "unknown"}`;
        const translated = t(key);
        return {
          name: translated === key ? d.deliveryType || t("analytics.delivery.unknown") : translated,
          revenue: d.revenue,
          net: d.netRevenue,
        };
      }),
    [deliveryData, t],
  );

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--color-border-subtle)]">
        <div className={`flex items-start justify-between gap-3 flex-wrap ${isRTL ? "flex-row-reverse" : ""}`}>
          <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
            <div className="w-9 h-9 rounded-lg bg-[var(--color-border-subtle)] flex items-center justify-center">
              <TrendingUp className="w-4.5 h-4.5 text-[var(--color-primary)]" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                {t("revenueSummary.title")}
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {t("revenueSummary.subtitle")}
              </p>
            </div>
          </div>

          {/* Tab strip */}
          <div className="flex bg-[var(--color-surface-page)] rounded-lg p-0.5 flex-wrap">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    activeTab === tab.key
                      ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Summary row (always visible) */}
        <div className={`flex items-center gap-6 mt-3 flex-wrap ${isRTL ? "flex-row-reverse" : ""}`}>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-secondary)]">
              {t("revenueSummary.grossPeriod")}
            </p>
            <div className="text-xl font-bold text-[var(--color-text-primary)] mt-0.5">
              <Money amount={summary.grossRevenue} decimals={0} iconSize={16} />
            </div>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-secondary)]">
              {t("revenueSummary.aov")}
            </p>
            <div className="text-xl font-bold text-[var(--color-text-primary)] mt-0.5">
              <Money amount={summary.averageOrderValue} decimals={0} iconSize={16} />
            </div>
          </div>
          {activeTab === "trend" && trendPct !== null && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-secondary)]">
                {t("revenueSummary.trend")}
              </p>
              <div
                className={`flex items-center gap-1 text-xl font-bold mt-0.5 ${
                  trendPct >= 0 ? "text-[#16A34A]" : "text-[#DC2626]"
                }`}
              >
                {trendPct >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {Math.abs(trendPct).toFixed(1)}%
              </div>
            </div>
          )}
          {activeTab === "trend" && (
            <div className={`flex bg-[var(--color-surface-page)] rounded-lg p-0.5 ${isRTL ? "mr-auto" : "ml-auto"}`}>
              {timeFilters.map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setTimeFilter(filter.key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    timeFilter === filter.key
                      ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chart body */}
      <div className="p-5">
        <div className="mb-6">
          {/* TREND TAB */}
          {activeTab === "trend" && (
            <>
              {loading || trendLoading ? (
                <ChartSkeleton height={260} />
              ) : !hasTrendData ? (
                <EmptyChart label={t("revenueSummary.noData")} />
              ) : (
                <div className="h-[260px] -mx-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "#737373" }}
                        axisLine={false}
                        tickLine={false}
                        reversed={isRTL}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#737373" }}
                        axisLine={false}
                        tickLine={false}
                        width={50}
                        tickFormatter={(v) => {
                          if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                          if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
                          return v.toString();
                        }}
                        orientation={isRTL ? "right" : "left"}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-surface-card)",
                          border: "1px solid var(--color-border)",
                          borderRadius: 8,
                          fontSize: 12,
                          padding: "8px 12px",
                        }}
                        labelStyle={{ color: "var(--color-text-primary)", fontWeight: 600 }}
                        formatter={
                          ((value: number) => [
                            `${Number(value).toLocaleString()} ${t("kpi.sar")}`,
                            t("revenueSummary.revenue"),
                          ]) as never
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#3B82F6"
                        strokeWidth={2.5}
                        fill="url(#revGradient)"
                        activeDot={{ r: 5, fill: "#3B82F6", stroke: "#fff", strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}

          {/* STATUS MIX TAB */}
          {activeTab === "status" && (
            <div className="h-[300px]">
              {statusLoading ? (
                <ChartSkeleton height={300} />
              ) : statusChartData.length === 0 ? (
                <EmptyChart label={t("analytics.empty")} />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                    >
                      {statusChartData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-surface-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        fontSize: 12,
                        padding: "8px 12px",
                      }}
                      formatter={
                        ((value: number, _name: unknown, item: { payload?: { count?: number; name?: string } }) => [
                          `${Number(value).toLocaleString()} ${t("kpi.sar")} · ${item?.payload?.count ?? 0} ${t("analytics.txn")}`,
                          item?.payload?.name,
                        ]) as never
                      }
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {/* TOP COURSES TAB */}
          {activeTab === "topCourses" && (
            <div className="h-[300px]">
              {topCourses.length === 0 ? (
                <EmptyChart label={t("analytics.empty")} />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topCourses.slice(0, 8)}
                    layout="vertical"
                    margin={{ top: 5, right: 24, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: "#737373" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => {
                        if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                        if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
                        return v.toString();
                      }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#525252" }}
                      axisLine={false}
                      tickLine={false}
                      width={130}
                      tickFormatter={(v: string) => (v?.length > 16 ? `${v.slice(0, 16)}…` : v)}
                      orientation={isRTL ? "right" : "left"}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-surface-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        fontSize: 12,
                        padding: "8px 12px",
                      }}
                      formatter={
                        ((value: number) => [
                          `${Number(value).toLocaleString()} ${t("kpi.sar")}`,
                          t("revenueSummary.revenue"),
                        ]) as never
                      }
                    />
                    <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                      {topCourses.map((_, idx) => (
                        <Cell key={idx} fill={CHART_PALETTE[idx % CHART_PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {/* DELIVERY TYPE TAB */}
          {activeTab === "delivery" && (
            <div className="h-[300px]">
              {deliveryLoading ? (
                <ChartSkeleton height={300} />
              ) : deliveryChartData.length === 0 ? (
                <EmptyChart label={t("analytics.empty")} />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deliveryChartData} margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#737373" }}
                      axisLine={false}
                      tickLine={false}
                      reversed={isRTL}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#737373" }}
                      axisLine={false}
                      tickLine={false}
                      width={50}
                      tickFormatter={(v) => {
                        if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                        if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
                        return v.toString();
                      }}
                      orientation={isRTL ? "right" : "left"}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-surface-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        fontSize: 12,
                        padding: "8px 12px",
                      }}
                      formatter={
                        ((value: number, name: string) => [
                          `${Number(value).toLocaleString()} ${t("kpi.sar")}`,
                          name === "revenue" ? t("revenueSummary.revenue") : t("kpi.netRevenue"),
                        ]) as never
                      }
                    />
                    <Legend
                      verticalAlign="top"
                      height={28}
                      iconType="circle"
                      wrapperStyle={{ fontSize: 12 }}
                      formatter={(value) =>
                        value === "revenue" ? t("revenueSummary.revenue") : t("kpi.netRevenue")
                      }
                    />
                    <Bar dataKey="revenue" fill={FINANCE_COLORS.info.hex} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="net" fill={FINANCE_COLORS.success.hex} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}
        </div>

        {/* Always-visible footer grid: BNPL vs Direct, By Gateway, Top Courses */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* BNPL vs Direct */}
          <div className="bg-[var(--color-surface-page)] rounded-xl p-4">
            <h4 className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
              {t("revenueSummary.bnplSplit")}
            </h4>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="text-[#8B5CF6] font-medium">{t("revenueSummary.bnpl")}</span>
                  <span className="text-[var(--color-text-primary)] font-semibold">{bnplPct}%</span>
                </div>
                <div className="h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                  <div className="h-full bg-[#8B5CF6] rounded-full transition-all" style={{ width: `${bnplPct}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="text-[#3B82F6] font-medium">{t("revenueSummary.direct")}</span>
                  <span className="text-[var(--color-text-primary)] font-semibold">{directPct}%</span>
                </div>
                <div className="h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                  <div className="h-full bg-[#3B82F6] rounded-full transition-all" style={{ width: `${directPct}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Gateway breakdown with Revenue/Volume toggle */}
          <div className="bg-[var(--color-surface-page)] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                {t("revenueSummary.byGateway")}
              </h4>
              <div className="flex bg-[var(--color-surface-card)] rounded p-0.5">
                <button
                  onClick={() => setGatewayMode("revenue")}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                    gatewayMode === "revenue"
                      ? "bg-[var(--color-border-subtle)] text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  {t("revenueSummary.modeRevenue")}
                </button>
                <button
                  onClick={() => setGatewayMode("volume")}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                    gatewayMode === "volume"
                      ? "bg-[var(--color-border-subtle)] text-[var(--color-text-primary)]"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  {t("revenueSummary.modeVolume")}
                </button>
              </div>
            </div>
            {gatewayDisplay.length === 0 ? (
              <p className="text-[13px] text-[var(--color-text-secondary)] text-center py-2">
                {t("revenueSummary.noData")}
              </p>
            ) : (
              <div className="space-y-3">
                {gatewayDisplay.map((g) => (
                  <div key={g.gatewayKey}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)]">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: gatewayColor(g.gatewayKey) }}
                        />
                        {g.name}
                      </span>
                      <span className="text-[12px] font-semibold text-[var(--color-text-primary)]">
                        {g.displayPct}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${g.displayPct}%`,
                          backgroundColor: GATEWAY_COLORS[g.gatewayKey] || "#94A3B8",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Courses — redesigned with medals + comparison bars + enrollment count */}
          <div className="bg-[var(--color-surface-page)] rounded-xl p-4">
            <h4 className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
              {t("revenueSummary.topCourses")}
            </h4>
            {topCoursesDisplay.length === 0 ? (
              <p className="text-[13px] text-[var(--color-text-secondary)] text-center py-2">
                {t("revenueSummary.noData")}
              </p>
            ) : (
              <ol className="space-y-3">
                {topCoursesDisplay.map((course) => {
                  const medal = course.rank <= 3 ? MEDAL_STYLE[course.rank - 1] : null;
                  return (
                    <li key={course.rank}>
                      <div className={`flex items-center gap-2 mb-1 ${isRTL ? "flex-row-reverse" : ""}`}>
                        {medal ? (
                          <span
                            className={`w-5 h-5 rounded-full ${medal.bg} flex items-center justify-center text-[10px] flex-shrink-0`}
                            aria-label={`#${course.rank}`}
                          >
                            {course.rank === 1 ? (
                              <Trophy className={`w-3 h-3 ${medal.text}`} />
                            ) : (
                              <span className={`font-bold ${medal.text}`}>{course.rank}</span>
                            )}
                          </span>
                        ) : (
                          <span className="w-5 h-5 rounded-full bg-[var(--color-border)] text-[10px] font-semibold text-[var(--color-text-secondary)] flex items-center justify-center flex-shrink-0">
                            {course.rank}
                          </span>
                        )}
                        <span
                          className="text-[12px] font-medium text-[var(--color-text-primary)] truncate flex-1 min-w-0"
                          title={course.name}
                        >
                          {course.name}
                        </span>
                        <span className="text-[12px] font-semibold text-[var(--color-text-primary)] flex-shrink-0 whitespace-nowrap">
                          <Money amount={course.revenue} decimals={0} iconSize={10} />
                        </span>
                      </div>
                      <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                        <div className="flex-1 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${course.barPct}%`,
                              backgroundColor: medal
                                ? course.rank === 1
                                  ? "#F59E0B"
                                  : course.rank === 2
                                    ? "#94A3B8"
                                    : "#EA580C"
                                : "#94A3B8",
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-[var(--color-text-secondary)] whitespace-nowrap flex-shrink-0">
                          {t("revenueSummary.enrollments", { count: course.enrollments })}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const EmptyChart = ({ label }: { label: string }) => (
  <div className="h-[260px] bg-[var(--color-surface-page)] rounded-xl flex flex-col items-center justify-center text-[var(--color-text-secondary)]">
    <Loader2 className="w-6 h-6 mb-2 opacity-50" />
    <p className="text-sm">{label}</p>
  </div>
);

export default RevenueSummaryWidget;
