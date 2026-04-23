"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useLocale } from "next-intl";
import { FileText, ArrowRight } from "lucide-react";

interface ComplianceArea {
  id: string;
  name: string;
  status: "pass" | "review" | "fail";
}

interface ComplianceData {
  percentage: number;
  passed: number;
  review: number;
  failed: number;
  areas: ComplianceArea[];
}

interface NELCComplianceOverviewWidgetProps {
  data: ComplianceData;
}

const NELCComplianceOverviewWidget = ({
  data,
}: NELCComplianceOverviewWidgetProps) => {
  const t = useTranslations("adminDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const total = data.passed + data.review + data.failed;
  const passedPercentage = (data.passed / total) * 100;
  const reviewPercentage = (data.review / total) * 100;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pass":
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-[#DCFCE7] text-[#16A34A]">
            {t("compliance.pass")}
          </span>
        );
      case "review":
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-[#FEF3C7] text-[#D97706]">
            {t("compliance.review")}
          </span>
        );
      case "fail":
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-[#FEE2E2] text-[#DC2626]">
            {t("compliance.fail")}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#002D87]" />
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {t("compliance.title")}
          </h3>
        </div>
        <Link
          href={`/${locale}/dashboard/admin/compliance`}
          className="text-sm text-[#0066FF] hover:underline flex items-center gap-1"
        >
          {t("compliance.fullMatrix")}
          <ArrowRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
        </Link>
      </div>

      {/* Large Percentage */}
      <div className="text-center mb-4">
        <p
          className={`text-5xl font-bold ${
            data.percentage >= 80
              ? "text-[#16A34A]"
              : data.percentage >= 60
                ? "text-[#D97706]"
                : "text-[#DC2626]"
          }`}
        >
          {data.percentage}%
        </p>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          {t("compliance.overallCompliance")}
        </p>
      </div>

      {/* Progress Bar */}
      <div className="h-3 bg-[#F3F4F6] rounded-full overflow-hidden mb-4">
        <div className="h-full flex">
          <div
            className="bg-[#16A34A] transition-all"
            style={{ width: `${passedPercentage}%` }}
          />
          <div
            className="bg-[#F59E0B] transition-all"
            style={{ width: `${reviewPercentage}%` }}
          />
          <div
            className="bg-[#EF4444] transition-all"
            style={{ width: `${100 - passedPercentage - reviewPercentage}%` }}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mb-6">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#16A34A]" />
          <span className="text-sm text-[var(--color-text-secondary)]">
            {data.passed} {t("compliance.pass")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#F59E0B]" />
          <span className="text-sm text-[var(--color-text-secondary)]">
            {data.review} {t("compliance.review")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#EF4444]" />
          <span className="text-sm text-[var(--color-text-secondary)]">
            {data.failed} {t("compliance.fail")}
          </span>
        </div>
      </div>

      {/* Compliance Areas */}
      <div className="space-y-3">
        {data.areas.map((area) => (
          <div
            key={area.id}
            className="flex items-center justify-between py-2 border-b border-[#F3F4F6] last:border-b-0"
          >
            <span className="text-sm text-[var(--color-text-secondary)]">{area.name}</span>
            {getStatusBadge(area.status)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default NELCComplianceOverviewWidget;
