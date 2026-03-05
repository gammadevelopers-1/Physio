"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { TrendingUp, TrendingDown, CreditCard, Landmark, Loader2 } from "lucide-react";
import { financeApi } from "@/lib/api";

interface GatewayBreakdown {
  name: string;
  percentage: number;
  color: string;
}

interface TopCourse {
  name: string;
  revenue: string;
}

interface RevenueSummaryData {
  gateways: GatewayBreakdown[];
  topCourses: TopCourse[];
}

interface RevenueSummaryWidgetProps {
  data: RevenueSummaryData;
  summaryData?: { totalRevenue: number; averageOrderValue: number };
  dateRange?: { startDate?: string; endDate?: string };
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
    default: // month
      return { period: "day", startDate: daysAgo(29), endDate: todayStr };
  }
}

function formatPeriodLabel(
  periodStr: string,
  period: "day" | "week" | "month",
  locale: string
): string {
  if (!periodStr) return "";
  try {
    const date = new Date(periodStr);
    const loc = locale === "ar" ? "ar-SA" : "en-US";
    if (period === "month") {
      return date.toLocaleDateString(loc, { month: "short", year: "2-digit" });
    }
    return date.toLocaleDateString(loc, { month: "short", day: "numeric" });
  } catch {
    return periodStr.slice(0, 10);
  }
}

const RevenueSummaryWidget = ({
  data,
  summaryData,
}: RevenueSummaryWidgetProps) => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const [timeFilter, setTimeFilter] = useState("month");
  const [trendData, setTrendData] = useState<
    { period: string; revenue: number; count: number }[]
  >([]);
  const [trendLoading, setTrendLoading] = useState(false);

  const fetchTrend = useCallback(async () => {
    setTrendLoading(true);
    try {
      const params = getChartParams(timeFilter);
      const result = await financeApi.getRevenueTrend(params);
      setTrendData(result || []);
    } catch {
      setTrendData([]);
    } finally {
      setTrendLoading(false);
    }
  }, [timeFilter]);

  useEffect(() => {
    fetchTrend();
  }, [fetchTrend]);

  const chartParams = getChartParams(timeFilter);
  const revenueValues = trendData.map((d) => d.revenue);
  const chartLabels = trendData.map((d) =>
    formatPeriodLabel(d.period, chartParams.period, locale)
  );
  const hasData = revenueValues.length >= 2;

  // Trend direction: compare first half vs second half of trendData
  const trendPct = (() => {
    if (trendData.length < 2) return null;
    const half = Math.floor(trendData.length / 2);
    const firstHalf = trendData
      .slice(0, half)
      .reduce((s, d) => s + d.revenue, 0);
    const secondHalf = trendData
      .slice(half)
      .reduce((s, d) => s + d.revenue, 0);
    if (firstHalf === 0) return null;
    return ((secondHalf - firstHalf) / firstHalf) * 100;
  })();

  // BNPL vs direct split from gateway data
  const bnplGateways = new Set(["Tamara", "Tabby"]);
  const bnplPct = Math.min(
    100,
    data.gateways
      .filter((g) => bnplGateways.has(g.name))
      .reduce((s, g) => s + g.percentage, 0)
  );
  const directPct = Math.max(0, 100 - bnplPct);

  // Generate SVG path for line chart
  const generateLinePath = (chartData: number[]) => {
    if (chartData.length < 2)
      return { linePath: "", areaPath: "", points: [] as { x: number; y: number }[] };

    const width = 100;
    const height = 100;
    const padding = 5;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const maxValue = Math.max(...chartData) * 1.1;
    const minValue = Math.min(...chartData) * 0.9;
    const range = maxValue - minValue || 1;

    const points = chartData.map((value, index) => {
      const x = padding + (index / (chartData.length - 1)) * chartWidth;
      const y =
        padding + chartHeight - ((value - minValue) / range) * chartHeight;
      return { x, y };
    });

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      path += ` Q ${prev.x + (cpx - prev.x) * 0.5} ${prev.y}, ${cpx} ${
        (prev.y + curr.y) / 2
      }`;
      path += ` Q ${cpx + (curr.x - cpx) * 0.5} ${curr.y}, ${curr.x} ${
        curr.y
      }`;
    }

    const areaPath =
      path +
      ` L ${points[points.length - 1].x} ${height - padding} L ${
        points[0].x
      } ${height - padding} Z`;

    return { linePath: path, areaPath, points };
  };

  const { linePath, areaPath, points } = hasData
    ? generateLinePath(revenueValues)
    : { linePath: "", areaPath: "", points: [] };

  const timeFilters = [
    { key: "week", label: t("revenueSummary.timeFilters.week") },
    { key: "month", label: t("revenueSummary.timeFilters.month") },
    { key: "quarter", label: t("revenueSummary.timeFilters.quarter") },
    { key: "year", label: t("revenueSummary.timeFilters.year") },
  ];

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#F3F4F6]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#a37f49]" />
            <h3 className="text-base font-semibold text-[#111827]">
              {t("revenueSummary.title")}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {/* Time Filter Tabs */}
            <div className="flex bg-[#F3F4F6] rounded-lg p-0.5">
              {timeFilters.map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setTimeFilter(filter.key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    timeFilter === filter.key
                      ? "bg-white text-[#111827] shadow-sm"
                      : "text-[#6B7280] hover:text-[#374151]"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <button className="text-sm font-medium text-[#a37f49] hover:text-[#6b4e24] hover:underline">
              {t("revenueSummary.viewDetails")}
            </button>
          </div>
        </div>

        {/* AOV + Trend row */}
        {summaryData && (
          <div className={`flex items-center gap-4 mt-2 ${isRTL ? "flex-row-reverse" : ""}`}>
            <div>
              <span className="text-xs text-[#6B7280]">
                {t("revenueSummary.aov")}
              </span>
              <span className={`text-sm font-semibold text-[#111827] ${isRTL ? "mr-1" : "ml-1"}`}>
                {t("kpi.sar")}{" "}
                {Number(summaryData.averageOrderValue).toLocaleString()}
              </span>
            </div>
            {trendPct !== null && (
              <div
                className={`flex items-center gap-0.5 text-xs font-medium ${
                  trendPct >= 0 ? "text-[#16A34A]" : "text-[#DC2626]"
                }`}
              >
                {trendPct >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                {Math.abs(trendPct).toFixed(1)}%{" "}
                {t("revenueSummary.vsPrevious")}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-5">
        {/* Revenue Line Chart */}
        <div className="mb-5">
          {trendLoading ? (
            <div className="h-[200px] bg-[#F9FAFB] rounded-xl flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-[#a37f49] animate-spin" />
            </div>
          ) : !hasData ? (
            <div className="h-[200px] bg-[#F9FAFB] rounded-xl flex items-center justify-center">
              <p className="text-sm text-[#9CA3AF]">
                {t("revenueSummary.noData")}
              </p>
            </div>
          ) : (
            <>
              <div className="h-[200px] bg-gradient-to-b from-[#EFF6FF] to-transparent rounded-xl p-4 relative">
                <svg
                  viewBox="0 0 100 100"
                  className="w-full h-full"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient
                      id="revenueAreaGradient"
                      x1="0%"
                      y1="0%"
                      x2="0%"
                      y2="100%"
                    >
                      <stop
                        offset="0%"
                        stopColor="#3B82F6"
                        stopOpacity="0.3"
                      />
                      <stop
                        offset="100%"
                        stopColor="#3B82F6"
                        stopOpacity="0.05"
                      />
                    </linearGradient>
                  </defs>

                  {[0, 25, 50, 75, 100].map((y) => (
                    <line
                      key={y}
                      x1="5"
                      y1={5 + (90 * (100 - y)) / 100}
                      x2="95"
                      y2={5 + (90 * (100 - y)) / 100}
                      stroke="#E5E7EB"
                      strokeWidth="0.3"
                      strokeDasharray="2,2"
                    />
                  ))}

                  <path d={areaPath} fill="url(#revenueAreaGradient)" />

                  <path
                    d={linePath}
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />

                  {points.map((point, index) => (
                    <g key={index}>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="3"
                        fill="white"
                        stroke="#3B82F6"
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                      />
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="8"
                        fill="transparent"
                        className="cursor-pointer"
                      >
                        <title>{`${chartLabels[index]}: ${t("kpi.sar")} ${Number(revenueValues[index]).toLocaleString()}`}</title>
                      </circle>
                    </g>
                  ))}
                </svg>
              </div>
              <div className="flex justify-between mt-2 text-xs text-[#6B7280] px-1">
                {chartLabels.map((label, index) => (
                  <span key={index} className="text-center">
                    {label}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* BNPL vs Direct split */}
        {data.gateways.length > 0 && (
          <div className="mb-4 bg-[#F9FAFB] rounded-xl p-4">
            <h4 className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-3">
              {t("revenueSummary.bnplSplit")}
            </h4>
            <div className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
              <div className="flex-1">
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="text-[#8B5CF6] font-medium">
                    {t("revenueSummary.bnpl")}
                  </span>
                  <span className="text-[#111827] font-semibold">
                    {bnplPct}%
                  </span>
                </div>
                <div className="h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#8B5CF6] rounded-full"
                    style={{ width: `${bnplPct}%` }}
                  />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="text-[#3B82F6] font-medium">
                    {t("revenueSummary.direct")}
                  </span>
                  <span className="text-[#111827] font-semibold">
                    {directPct}%
                  </span>
                </div>
                <div className="h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#3B82F6] rounded-full"
                    style={{ width: `${directPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Breakdown Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Gateway Breakdown */}
          <div className="bg-[#F9FAFB] rounded-xl p-4">
            <h4 className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-3">
              {t("revenueSummary.byGateway")}
            </h4>
            {data.gateways.length === 0 ? (
              <p className="text-[13px] text-[#9CA3AF] text-center py-2">
                {t("revenueSummary.noData")}
              </p>
            ) : (
              data.gateways.map((gateway, index) => (
                <div key={index} className="mb-3 last:mb-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-2 text-[13px] text-[#4B5563]">
                      {index === 0 ? (
                        <CreditCard className="w-3.5 h-3.5 text-[#3B82F6]" />
                      ) : (
                        <Landmark className="w-3.5 h-3.5 text-[#22C55E]" />
                      )}
                      {gateway.name}
                    </span>
                    <span className="text-[13px] font-semibold text-[#111827]">
                      {gateway.percentage}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${gateway.color}`}
                      style={{ width: `${gateway.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Top Courses */}
          <div className="bg-[#F9FAFB] rounded-xl p-4">
            <h4 className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-3">
              {t("revenueSummary.topCourses")}
            </h4>
            <div className="space-y-2.5">
              {data.topCourses.length === 0 ? (
                <p className="text-[13px] text-[#9CA3AF] text-center py-2">
                  {t("revenueSummary.noData")}
                </p>
              ) : (
                data.topCourses.map((course, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-[13px] text-[#4B5563] truncate max-w-[60%]">
                      {course.name}
                    </span>
                    <span className="text-[13px] font-semibold text-[#111827]">
                      {course.revenue}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RevenueSummaryWidget;
