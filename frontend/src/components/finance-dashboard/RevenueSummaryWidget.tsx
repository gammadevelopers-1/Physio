"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { TrendingUp, CreditCard, Landmark, BarChart3 } from "lucide-react";

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
}

const RevenueSummaryWidget = ({ data }: RevenueSummaryWidgetProps) => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const [timeFilter, setTimeFilter] = useState("month");

  // Revenue trend data (SAR in thousands)
  const revenueData = [120, 145, 135, 170, 190, 210, 245];
  const chartLabels = [t("months.sep"), t("months.oct"), t("months.nov"), t("months.dec"), t("months.jan"), t("months.feb"), t("months.mar")];

  // Generate SVG path for line chart
  const generateLinePath = (chartData: number[]) => {
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
      const y = padding + chartHeight - ((value - minValue) / range) * chartHeight;
      return { x, y };
    });

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      path += ` Q ${prev.x + (cpx - prev.x) * 0.5} ${prev.y}, ${cpx} ${(prev.y + curr.y) / 2}`;
      path += ` Q ${cpx + (curr.x - cpx) * 0.5} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    const areaPath = path + ` L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    return { linePath: path, areaPath, points };
  };

  const { linePath, areaPath, points } = generateLinePath(revenueData);

  const timeFilters = [
    { key: "week", label: t("revenueSummary.timeFilters.week") },
    { key: "month", label: t("revenueSummary.timeFilters.month") },
    { key: "quarter", label: t("revenueSummary.timeFilters.quarter") },
    { key: "year", label: t("revenueSummary.timeFilters.year") },
  ];

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#F3F4F6]">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[var(--color-primary)]" />
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
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
                    ? "bg-white text-[var(--color-text-primary)] shadow-sm"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <button className="text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] hover:underline">
            {t("revenueSummary.viewDetails")}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {/* Revenue Line Chart */}
        <div className="mb-5">
          <div className="h-[200px] bg-gradient-to-b from-[#EFF6FF] to-transparent rounded-xl p-4 relative">
            <svg
              viewBox="0 0 100 100"
              className="w-full h-full"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="revenueAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.05" />
                </linearGradient>
              </defs>

              {[0, 25, 50, 75, 100].map((y) => (
                <line
                  key={y}
                  x1="5"
                  y1={5 + (90 * (100 - y)) / 100}
                  x2="95"
                  y2={5 + (90 * (100 - y)) / 100}
                  stroke="var(--color-border)"
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
                    <title>{`${chartLabels[index]}: ${t("kpi.sar")} ${revenueData[index]}K`}</title>
                  </circle>
                </g>
              ))}
            </svg>
          </div>
          <div className="flex justify-between mt-2 text-xs text-[var(--color-text-secondary)] px-1">
            {chartLabels.map((label, index) => (
              <span key={index} className="text-center">{label}</span>
            ))}
          </div>
        </div>

        {/* Breakdown Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Gateway Breakdown */}
          <div className="bg-[var(--color-surface-page)] rounded-xl p-4">
            <h4 className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
              {t("revenueSummary.byGateway")}
            </h4>
            {data.gateways.map((gateway, index) => (
              <div key={index} className="mb-3 last:mb-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)]">
                    {index === 0 ? (
                      <CreditCard className="w-3.5 h-3.5 text-[#3B82F6]" />
                    ) : (
                      <Landmark className="w-3.5 h-3.5 text-[#22C55E]" />
                    )}
                    {gateway.name}
                  </span>
                  <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                    {gateway.percentage}%
                  </span>
                </div>
                <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${gateway.color}`}
                    style={{ width: `${gateway.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Top Courses */}
          <div className="bg-[var(--color-surface-page)] rounded-xl p-4">
            <h4 className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
              {t("revenueSummary.topCourses")}
            </h4>
            <div className="space-y-2.5">
              {data.topCourses.map((course, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-1"
                >
                  <span className="text-[13px] text-[var(--color-text-secondary)] truncate max-w-[60%]">
                    {course.name}
                  </span>
                  <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                    {course.revenue}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RevenueSummaryWidget;
