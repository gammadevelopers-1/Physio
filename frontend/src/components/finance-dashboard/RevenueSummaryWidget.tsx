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

  const timeFilters = [
    { key: "week", label: t("revenueSummary.timeFilters.week") },
    { key: "month", label: t("revenueSummary.timeFilters.month") },
    { key: "quarter", label: t("revenueSummary.timeFilters.quarter") },
    { key: "year", label: t("revenueSummary.timeFilters.year") },
  ];

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#F3F4F6]">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#059669]" />
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

      {/* Body */}
      <div className="p-5">
        {/* Chart Placeholder */}
        <div className="h-[200px] bg-[#F9FAFB] rounded-xl border border-dashed border-[#E5E7EB] flex flex-col items-center justify-center text-[#9CA3AF] mb-5">
          <BarChart3 className="w-8 h-8 mb-2" />
          <span className="text-sm">{t("revenueSummary.chartPlaceholder")}</span>
        </div>

        {/* Breakdown Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Gateway Breakdown */}
          <div className="bg-[#F9FAFB] rounded-xl p-4">
            <h4 className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-3">
              {t("revenueSummary.byGateway")}
            </h4>
            {data.gateways.map((gateway, index) => (
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
            ))}
          </div>

          {/* Top Courses */}
          <div className="bg-[#F9FAFB] rounded-xl p-4">
            <h4 className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-3">
              {t("revenueSummary.topCourses")}
            </h4>
            <div className="space-y-2.5">
              {data.topCourses.map((course, index) => (
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
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RevenueSummaryWidget;
