"use client";

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

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB]">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 sm:p-5">
        <div className="w-8 h-8 bg-[#FEF3C7] rounded-lg flex items-center justify-center">
          <Users className="w-4 h-4 text-[#D4A520]" />
        </div>
        <h3 className="text-[15px] font-semibold text-[#1F2937]">
          {t("instructors.title")}
        </h3>
      </div>

      {/* Instructors List */}
      <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-3">
        {instructors.map((instructor) => {
          const config = statusConfig[instructor.status];

          return (
            <div
              key={instructor.id}
              className="flex items-center gap-3 p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB]"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                {instructor.initials}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#1F2937]">
                  {instructor.name}
                </p>
                <p className="text-[11px] text-[#6B7280]">
                  {instructor.assignedCourses} {t("instructors.courses")} • {instructor.hoursPerWeek} {t("instructors.hrsWeek")}
                </p>
                {/* Load Bar */}
                <div className="mt-1.5">
                  <div className="w-full h-1 bg-[#E5E7EB] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${config.barColor} rounded-full transition-all`}
                      style={{ width: `${instructor.loadPercentage}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Stats & Status */}
              <div className="text-right flex-shrink-0">
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
        <div className="text-center pt-3 border-t border-[#E5E7EB] mt-3">
          <Link
            href={`/${locale}/dashboard/manager/instructors`}
            className="text-[13px] font-medium text-[#3B82F6] hover:underline inline-flex items-center gap-1"
          >
            {t("instructors.manageAll")}
            <ChevronRight className={`w-3.5 h-3.5 ${isRTL ? "rotate-180" : ""}`} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default InstructorsManagementWidget;
