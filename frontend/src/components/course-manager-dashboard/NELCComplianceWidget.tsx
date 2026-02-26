"use client";

import { useTranslations, useLocale } from "next-intl";
import { ChevronRight, BarChart3, CheckCircle, Star, ClipboardCheck } from "lucide-react";
import Link from "next/link";

interface ComplianceData {
  percentage: number;
  passed: number;
  review: number;
  failed: number;
}

interface ReportCard {
  id: string;
  type: "enrollment" | "completion" | "satisfaction";
  title: string;
  description: string;
}

interface NELCComplianceWidgetProps {
  compliance: ComplianceData;
  reports: ReportCard[];
}

const NELCComplianceWidget = ({
  compliance,
  reports,
}: NELCComplianceWidgetProps) => {
  const t = useTranslations("courseManagerDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const reportIcons = {
    enrollment: { icon: BarChart3, bg: "bg-[var(--functional-blue-400)]/10", color: "text-[var(--functional-blue-600)]" },
    completion: { icon: CheckCircle, bg: "bg-[var(--functional-green-400)]/10", color: "text-[var(--functional-green-600)]" },
    satisfaction: { icon: Star, bg: "bg-[var(--gold-gold-100)]", color: "text-[var(--gold-gold-500)]" },
  };

  // Calculate percentages for the progress bar
  const total = compliance.passed + compliance.review + compliance.failed;
  const passedPercent = (compliance.passed / total) * 100;
  const reviewPercent = (compliance.review / total) * 100;
  const failedPercent = (compliance.failed / total) * 100;

  return (
    <div className="bg-[var(--surface-intense)] rounded-xl border border-[#E5E7EB] p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[var(--gold-gold-100)] rounded-lg flex items-center justify-center">
            <ClipboardCheck className="w-4 h-4 text-[var(--gold-gold-500)]" />
          </div>
          <h3 className="text-base font-semibold text-[var(--on-surface-default)]">
            {t("nelc.title")}
          </h3>
        </div>
        <Link
          href={`/${locale}/dashboard/manager/nelc-compliance`}
          className="flex items-center gap-1 text-sm font-medium text-[var(--blue-brand-blue)] hover:underline"
        >
          {t("nelc.viewMatrix")}
          <ChevronRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
        </Link>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-6 lg:gap-8 items-center">
        {/* Compliance Score */}
        <div className="text-center">
          <p
            className={`text-4xl sm:text-5xl font-bold ${
              compliance.percentage >= 80
                ? "text-[var(--functional-green-600)]"
                : compliance.percentage >= 60
                  ? "text-[var(--functional-amber-600)]"
                  : "text-[var(--functional-red-600)]"
            }`}
          >
            {compliance.percentage}%
          </p>
          <p className="text-sm text-[var(--on-surface-variant)] mt-1">{t("nelc.compliant")}</p>

          {/* Progress Bar */}
          <div className="mt-4 h-2.5 bg-[#E5E7EB] rounded-full overflow-hidden">
            <div className="flex h-full">
              <div
                className="bg-[var(--functional-green-600)]"
                style={{ width: `${passedPercent}%` }}
              />
              <div
                className="bg-[var(--functional-amber-600)]"
                style={{ width: `${reviewPercent}%` }}
              />
              <div
                className="bg-[var(--functional-red-600)]"
                style={{ width: `${failedPercent}%` }}
              />
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mt-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--functional-green-600)]" />
              <span className="text-[12px] sm:text-[13px] text-[var(--on-surface-variant)]">
                {compliance.passed} {t("nelc.passed")}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--functional-amber-600)]" />
              <span className="text-[12px] sm:text-[13px] text-[var(--on-surface-variant)]">
                {compliance.review} {t("nelc.review")}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--functional-red-600)]" />
              <span className="text-[12px] sm:text-[13px] text-[var(--on-surface-variant)]">
                {compliance.failed} {t("nelc.failed")}
              </span>
            </div>
          </div>
        </div>

        {/* Report Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {reports.map((report) => {
            const config = reportIcons[report.type];

            return (
              <div
                key={report.id}
                className="bg-[#F9FAFB] rounded-xl p-4 sm:p-5 text-center border border-[#E5E7EB] hover:border-[var(--blue-brand-blue)] hover:shadow-md transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#002D87]"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }}
              >
                <div
                  className={`w-10 h-10 sm:w-11 sm:h-11 ${config.bg} rounded-xl flex items-center justify-center mx-auto mb-3`}
                >
                  <config.icon className={`w-5 h-5 ${config.color}`} />
                </div>
                <p className="text-sm font-medium text-[var(--on-surface-default)] mb-1">
                  {report.title}
                </p>
                <p className="text-xs text-[var(--on-surface-variant)]">{report.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default NELCComplianceWidget;
