"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useLocale } from "next-intl";
import { BarChart3, TrendingUp, ArrowRight } from "lucide-react";

interface AnalyticsData {
  visitorToSignup: number;
  signupToEnroll: number;
  enrollToPaid: number;
  completionRate: number;
}

interface PlatformAnalyticsWidgetProps {
  data: AnalyticsData;
}

const PlatformAnalyticsWidget = ({ data }: PlatformAnalyticsWidgetProps) => {
  const t = useTranslations("adminDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const conversionMetrics = [
    {
      id: "visitorToSignup",
      label: t("analytics.visitorToSignup"),
      value: data.visitorToSignup,
    },
    {
      id: "signupToEnroll",
      label: t("analytics.signupToEnroll"),
      value: data.signupToEnroll,
    },
    {
      id: "enrollToPaid",
      label: t("analytics.enrollToPaid"),
      value: data.enrollToPaid,
    },
    {
      id: "completionRate",
      label: t("analytics.completionRate"),
      value: data.completionRate,
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#002D87]" />
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {t("analytics.title")}
          </h3>
        </div>
        <Link
          href={`/${locale}/dashboard/admin/reports`}
          className="text-sm text-[#0066FF] hover:underline flex items-center gap-1"
        >
          {t("analytics.viewDetails")}
          <ArrowRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
        </Link>
      </div>

      {/* Chart Placeholders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Enrollment Funnel Chart */}
        <div className="bg-[var(--color-surface-page)] rounded-lg p-4 min-h-[160px] flex flex-col items-center justify-center">
          <div className="w-16 h-16 mb-3 flex items-center justify-center">
            <BarChart3 className="w-12 h-12 text-[var(--color-text-secondary)]" />
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">{t("analytics.enrollmentFunnel")}</p>
        </div>

        {/* User Growth Chart */}
        <div className="bg-[var(--color-surface-page)] rounded-lg p-4 min-h-[160px] flex flex-col items-center justify-center">
          <div className="w-16 h-16 mb-3 flex items-center justify-center">
            <TrendingUp className="w-12 h-12 text-[var(--color-text-secondary)]" />
          </div>
          <p className="text-sm text-[var(--color-text-secondary)]">{t("analytics.userGrowth")}</p>
        </div>
      </div>

      {/* Conversion Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {conversionMetrics.map((metric) => (
          <div
            key={metric.id}
            className="bg-[var(--color-surface-page)] rounded-lg p-4 text-center"
          >
            <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{metric.value}%</p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">{metric.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlatformAnalyticsWidget;
