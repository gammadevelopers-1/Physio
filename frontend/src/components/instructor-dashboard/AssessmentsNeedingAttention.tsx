"use client";

import { useTranslations } from "next-intl";
import { ClipboardList, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { DashboardPendingSubmission } from "@/types/instructor-dashboard";
import Link from "next/link";
import { useLocale } from "next-intl";

interface Props {
  submissions: DashboardPendingSubmission[];
  visibleCount?: number;
}

const AssessmentsNeedingAttention = ({
  submissions,
  visibleCount = 5,
}: Props) => {
  const t = useTranslations("instructorDashboard");
  const locale = useLocale();

  const displayed = submissions.slice(0, visibleCount);
  const totalCount = submissions.length;

  const getOverdueLabel = (days: number) => {
    if (days === 0) return t("needsGrading.today");
    if (days === 1) return t("needsGrading.dayAgo");
    return t("needsGrading.daysAgo", { days });
  };

  const getOverdueColor = (days: number) => {
    if (days >= 7) return "text-[#EF4444] bg-[#FEE2E2]";
    if (days >= 3) return "text-[#F59E0B] bg-[#FEF3C7]";
    return "text-[#6B7280] bg-[#F3F4F6]";
  };

  if (totalCount === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#E5E7EB]">
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-[#1F2937] flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-[#F59E0B]" />
              {t("needsGrading.title")}
            </h3>
            <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 bg-[#F3F4F6] text-[#6B7280] text-xs font-semibold rounded-full">
              0
            </span>
          </div>
          <p className="text-sm text-[#9CA3AF] text-center py-6">
            {t("needsGrading.empty")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB]">
      <div className="p-4 sm:p-5">
        {/* Header with Badge Count */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[#1F2937] flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[#F59E0B]" />
            {t("needsGrading.title")}
          </h3>
          <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 bg-[#FEF3C7] text-[#F59E0B] text-xs font-semibold rounded-full">
            {totalCount}
          </span>
        </div>

        <div className="space-y-3">
          {displayed.map((sub) => (
            <div
              key={sub.id}
              className="flex items-center gap-3 p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] hover:border-[#D1D5DB] transition-colors"
            >
              {/* Clock icon */}
              <div className="w-10 h-10 rounded-full bg-[#FEF3C7] flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-[#F59E0B]" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1F2937] truncate">
                  {sub.studentName}
                </p>
                <p className="text-[11px] text-[#6B7280] truncate mb-0.5">
                  {sub.assessmentTitle} · {sub.courseName}
                </p>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${getOverdueColor(sub.daysOverdue)}`}
                >
                  {getOverdueLabel(sub.daysOverdue)}
                </span>
              </div>

              {/* Grade button */}
              <Link
                href={`/${locale}/dashboard/instructor/assessments`}
                className="flex-shrink-0 px-3 py-1.5 bg-[#3B82F6] text-white text-xs font-medium rounded-lg hover:bg-[#2563EB] transition-colors"
              >
                {t("needsGrading.grade")}
              </Link>
            </div>
          ))}
        </div>

        {/* View All Link */}
        <Link
          href={`/${locale}/dashboard/instructor/assessments`}
          className="w-full flex items-center justify-center gap-1 mt-4 py-2.5 text-sm font-medium text-[#3B82F6] hover:underline"
        >
          {t("needsGrading.viewAll")} ({totalCount})
          {locale === "ar" ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </Link>
      </div>
    </div>
  );
};

export default AssessmentsNeedingAttention;
