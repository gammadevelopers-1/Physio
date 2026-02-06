"use client";

import { useTranslations } from "next-intl";
import { MoreVertical, ChevronRight, AlertTriangle } from "lucide-react";

interface AtRiskLearner {
  id: string;
  name: string;
  initials: string;
  riskType: "lowAttendance" | "lowScore" | "inactive";
  riskValue: string;
}

interface AtRiskLearnersProps {
  learners: AtRiskLearner[];
  totalCount: number;
}

const AtRiskLearners = ({ learners, totalCount }: AtRiskLearnersProps) => {
  const t = useTranslations("instructorDashboard");

  const getRiskBadgeStyle = (riskType: string) => {
    switch (riskType) {
      case "lowAttendance":
        return "bg-[#FEE2E2] text-[#EF4444]";
      case "lowScore":
        return "bg-[#FFEDD5] text-[#F97316]";
      case "inactive":
        return "bg-[#FEF9C3] text-[#EAB308]";
      default:
        return "bg-[#F3F4F6] text-[#6B7280]";
    }
  };

  const getRiskLabel = (riskType: string, value: string) => {
    switch (riskType) {
      case "lowAttendance":
        return `${t("atRisk.lowAttendance")} ${value}`;
      case "lowScore":
        return `${t("atRisk.lowScore")} ${value}`;
      case "inactive":
        return `${t("atRisk.inactive")} ${value}`;
      default:
        return value;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB]">
      <div className="p-5">
        <h3 className="text-base font-semibold text-[#1F2937] mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-[#F97316]" />
          {t("atRisk.title")}
        </h3>

        <div className="space-y-3">
          {learners.map((learner) => (
            <div
              key={learner.id}
              className="flex items-center gap-3 p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB]"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-[#E5E7EB] flex items-center justify-center text-sm font-semibold text-[#4B5563]">
                {learner.initials}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1F2937] truncate">
                  {learner.name}
                </p>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${getRiskBadgeStyle(learner.riskType)}`}
                >
                  {getRiskLabel(learner.riskType, learner.riskValue)}
                </span>
              </div>

              {/* Action */}
              <button className="text-[#9CA3AF] hover:text-[#6B7280] transition-colors">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* View All Link */}
        <button className="w-full flex items-center justify-center gap-1 mt-4 py-2.5 text-sm font-medium text-[#3B82F6] hover:underline">
          {t("atRisk.viewAll")} ({totalCount})
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default AtRiskLearners;
