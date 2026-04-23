"use client";

import { useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Star, ChevronRight, Users } from "lucide-react";
import Link from "next/link";

interface Instructor {
  id: string;
  name: string;
  initials: string;
  assignedCourses: number;
  hoursPerWeek: number;
  loadPercentage: number;
  rating: number;
  status: "available" | "busy" | "overloaded";
}

interface InstructorsManagementWidgetProps {
  instructors: Instructor[];
}

const MAX_DISPLAY = 4;

const InstructorsManagementWidget = ({
  instructors,
}: InstructorsManagementWidgetProps) => {
  const t = useTranslations("courseManagerDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const statusConfig = {
    available: {
      bg: "bg-[#DCFCE7]",
      text: "text-[#22C55E]",
      barColor: "bg-[#22C55E]",
    },
    busy: {
      bg: "bg-[#FEF9C3]",
      text: "text-[#EAB308]",
      barColor: "bg-[#F97316]",
    },
    overloaded: {
      bg: "bg-[#FEE2E2]",
      text: "text-[#EF4444]",
      barColor: "bg-[#EF4444]",
    },
  };

  const totalCount = instructors.length;
  const displayInstructors = instructors.slice(0, MAX_DISPLAY);

  const statusCounts = useMemo(() => ({
    available: instructors.filter((i) => i.status === "available").length,
    busy: instructors.filter((i) => i.status === "busy").length,
    overloaded: instructors.filter((i) => i.status === "overloaded").length,
  }), [instructors]);

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#FEF3C7] rounded-lg flex items-center justify-center">
            <Users className="w-4 h-4 text-[#D4A520]" />
          </div>
          <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
            {t("instructors.title")}
          </h3>
        </div>
        {totalCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 bg-[#FEF3C7] text-[#D4A520] text-xs font-semibold rounded-full">
            {totalCount}
          </span>
        )}
      </div>

      {/* Status Summary */}
      <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
          <span className="text-xs text-[var(--color-text-secondary)]">{t("instructors.available")}</span>
          <span className="text-xs font-semibold text-[var(--color-text-primary)]">{statusCounts.available}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#F97316]" />
          <span className="text-xs text-[var(--color-text-secondary)]">{t("instructors.busy")}</span>
          <span className="text-xs font-semibold text-[var(--color-text-primary)]">{statusCounts.busy}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
          <span className="text-xs text-[var(--color-text-secondary)]">{t("instructors.overloaded")}</span>
          <span className="text-xs font-semibold text-[var(--color-text-primary)]">{statusCounts.overloaded}</span>
        </div>
      </div>

      {/* Instructors List */}
      <div className="px-4 sm:px-5 py-4 sm:py-5 space-y-3">
        {displayInstructors.map((instructor) => {
          const config = statusConfig[instructor.status];

          return (
            <div
              key={instructor.id}
              className="flex items-center gap-3 p-3 bg-[#F9FAFB] rounded-xl border border-[var(--color-border)]"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                {instructor.initials}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[var(--color-text-secondary)] truncate">
                  {instructor.name}
                </p>
                <p className="text-[11px] text-[var(--color-text-secondary)]">
                  {instructor.assignedCourses} {t("instructors.courses")} • {instructor.hoursPerWeek} {t("instructors.hrsWeek")}
                </p>
                {/* Load Bar */}
                <div className="mt-1.5">
                  <div className="w-full h-1 bg-[var(--color-border)] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${config.barColor} rounded-full transition-all`}
                      style={{ width: `${instructor.loadPercentage}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Stats & Status */}
              <div className="text-end flex-shrink-0">
                <div className="flex items-center gap-0.5 justify-end mb-1">
                  <Star className="w-3 h-3 text-[#D4A520] fill-[#D4A520]" />
                  <span className="text-xs text-[#D4A520] font-medium">
                    {instructor.rating.toFixed(1)}
                  </span>
                </div>
                <span
                  className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full ${config.bg} ${config.text}`}
                >
                  {t(`instructors.${instructor.status}`)}
                </span>
              </div>
            </div>
          );
        })}

        {/* View All Link */}
        {totalCount > 0 && (
          <div className="text-center pt-3 border-t border-[var(--color-border)] mt-3">
            <Link
              href={`/${locale}/dashboard/manager/instructors`}
              className="text-[13px] font-medium text-[#3B82F6] hover:underline inline-flex items-center gap-1"
            >
              {t("instructors.manageAll")}
              <ChevronRight className={`w-3.5 h-3.5 ${isRTL ? "rotate-180" : ""}`} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default InstructorsManagementWidget;
