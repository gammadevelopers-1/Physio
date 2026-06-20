"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { financeApi } from "@/lib/api";
import Money from "./shared/Money";
import { GATEWAY_COLORS, gatewayColor } from "./shared/financeColors";
import { ChartSkeleton } from "./shared/Skeleton";

interface GatewayBreakdown {
  name: string;
  gatewayKey: string;
  percentage: number;
  amount: number;
}

interface TopCourse {
  name: string;
  revenue: number;
}

interface RevenueSummaryWidgetProps {
  gateways: GatewayBreakdown[];
  topCourses: TopCourse[];
  summary: { grossRevenue: number; averageOrderValue: number };
  loading?: boolean;
}

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
  loading,
}: RevenueSummaryWidgetProps) => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const [timeFilter, setTimeFilter] = useState("month");
  const [trendData, setTrendData] = useState<
    { period: string; revenue: number; count: number; label: string }[]
  >([]);
  const [trendLoading, setTrendLoading] = useState(false);

  const fetchTrend = useCallback(async () => {
    setTrendLoading(true);
    try {
      const params = getChartParams(timeFilter);
      const result = await financeApi.getRevenueTrend(params);
      const safe = (result || []).map((d: { period: string; revenue: number; count: number }) => ({
        ...d,
        label: formatLabel(d.period, params.period, locale),
      }));
      setTrendData(safe);
    } catch {
      setTrendData([]);
    } finally {
      setTrendLoading(false);
    }
  }, [timeFilter, locale]);

  useEffect(() => {
    fetchTrend();
  }, [fetchTrend]);

  const trendPct = useMemo(() => {
    if (trendData.length < 2) return null;
    const half = Math.floor(trendData.length / 2);
    const firstHalf = trendData.slice(0, half).reduce((s, d) => s + d.revenue, 0);
    const secondHalf = trendData.slice(half).reduce((s, d) => s + d.revenue, 0);
    if (firstHalf === 0) return null;
    return ((secondHalf - firstHalf) / firstHalf) * 100;
  }, [trendData]);

  const bnplGateways = new Set(["tamara", "tabby"]);
  const bnplPct = Math.min(
    100,
    gateways.filter((g) => bnplGateways.has(g.gatewayKey)).reduce((s, g) => s + g.percentage, 0),
  );
  const directPct = Math.max(0, 100 - bnplPct);

  const timeFilters = [
    { key: "week", label: t("revenueSummary.timeFilters.week") },
    { key: "month", label: t("revenueSummary.timeFilters.month") },
    { key: "quarter", label: t("revenueSummary.timeFilters.quarter") },
    { key: "year", label: t("revenueSummary.timeFilters.year") },
  ];

  const hasData = trendData.length >= 2;

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--color-border-subtle)]">
        <div className={`flex items-center justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
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
          <div className="flex bg-[var(--color-surface-page)] rounded-lg p-0.5">
            {timeFilters.map((filter) => (
              <button
                key={filter.key}
                onClick={() => setTimeFilter(filter.key)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  timeFilter === filter.key
                    ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary row */}
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
          {trendPct !== null && (
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
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {/* Chart */}
        <div className="mb-6">
          {loading || trendLoading ? (
            <ChartSkeleton height={260} />
          ) : !hasData ? (
            <div className="h-[260px] bg-[var(--color-surface-page)] rounded-xl flex flex-col items-center justify-center text-[var(--color-text-secondary)]">
              <Loader2 className="w-6 h-6 mb-2 opacity-50" />
              <p className="text-sm">{t("revenueSummary.noData")}</p>
            </div>
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
        </div>

        {/* BNPL vs Direct + Breakdown grid */}
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

          {/* Gateway breakdown */}
          <div className="bg-[var(--color-surface-page)] rounded-xl p-4">
            <h4 className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
              {t("revenueSummary.byGateway")}
            </h4>
            {gateways.length === 0 ? (
              <p className="text-[13px] text-[var(--color-text-secondary)] text-center py-2">{t("revenueSummary.noData")}</p>
            ) : (
              <div className="space-y-3">
                {gateways.map((g) => (
                  <div key={g.gatewayKey}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)]">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: gatewayColor(g.gatewayKey) }}
                        />
                        {g.name}
                      </span>
                      <span className="text-[12px] font-semibold text-[var(--color-text-primary)]">{g.percentage}%</span>
                    </div>
                    <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${g.percentage}%`,
                          backgroundColor: GATEWAY_COLORS[g.gatewayKey] || "#94A3B8",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top courses */}
          <div className="bg-[var(--color-surface-page)] rounded-xl p-4">
            <h4 className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
              {t("revenueSummary.topCourses")}
            </h4>
            {topCourses.length === 0 ? (
              <p className="text-[13px] text-[var(--color-text-secondary)] text-center py-2">{t("revenueSummary.noData")}</p>
            ) : (
              <ol className="space-y-2.5">
                {topCourses.slice(0, 5).map((course, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)] truncate flex-1 min-w-0">
                      <span className="w-4 h-4 rounded bg-[var(--color-border)] text-[10px] font-semibold text-[var(--color-text-secondary)] flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <span className="truncate">{course.name}</span>
                    </span>
                    <span className="text-[12px] font-semibold text-[var(--color-text-primary)] flex-shrink-0">
                      <Money amount={course.revenue} decimals={0} iconSize={10} showIcon={false} />
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RevenueSummaryWidget;
