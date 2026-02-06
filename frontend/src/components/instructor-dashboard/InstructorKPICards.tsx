"use client";

import { useTranslations } from "next-intl";
import {
  BookOpen,
  Calendar,
  AlertTriangle,
  Award,
  Star,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface KPIData {
  activeCourses: number;
  coursesChange: string;
  todaysSessions: number;
  nextSessionTime: string;
  atRiskLearners: number;
  atRiskChange: number;
  pendingCertificates: number;
  certificatesStatus: string;
  avgRating: number;
  totalReviews: number;
}

interface InstructorKPICardsProps {
  data: KPIData;
}

const InstructorKPICards = ({ data }: InstructorKPICardsProps) => {
  const t = useTranslations("instructorDashboard");

  // Render star rating - compact version
  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Star
            key={i}
            className="w-3 h-3 text-[#D4A520] fill-[#D4A520] flex-shrink-0"
          />
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <div key={i} className="relative flex-shrink-0">
            <Star className="w-3 h-3 text-[#E5E7EB]" />
            <div className="absolute top-0 left-0 w-1/2 overflow-hidden">
              <Star className="w-3 h-3 text-[#D4A520] fill-[#D4A520]" />
            </div>
          </div>
        );
      } else {
        stars.push(
          <Star key={i} className="w-3 h-3 text-[#E5E7EB] flex-shrink-0" />
        );
      }
    }
    return stars;
  };

  const kpiCards = [
    {
      id: "activeCourses",
      label: t("kpi.activeCourses"),
      value: data.activeCourses,
      icon: BookOpen,
      iconBg: "bg-[#FEF3C7]",
      iconColor: "text-[#D4A520]",
      trend: data.coursesChange,
      trendUp: true,
      showBadge: false,
      isRating: false,
    },
    {
      id: "todaysSessions",
      label: t("kpi.todaysSessions"),
      value: data.todaysSessions,
      icon: Calendar,
      iconBg: "bg-[#FEF3C7]",
      iconColor: "text-[#D4A520]",
      trend: `${t("kpi.next")}: ${data.nextSessionTime}`,
      trendUp: null,
      showBadge: false,
      isRating: false,
    },
    {
      id: "atRiskLearners",
      label: t("kpi.atRiskLearners"),
      value: data.atRiskLearners,
      icon: AlertTriangle,
      iconBg: "bg-[#FEE2E2]",
      iconColor: "text-[#EF4444]",
      trend: `+${data.atRiskChange} ${t("kpi.needAttention")}`,
      trendUp: false,
      showBadge: true,
      badgeValue: data.atRiskChange,
      isRating: false,
    },
    {
      id: "pendingCertificates",
      label: t("kpi.pendingCertificates"),
      value: data.pendingCertificates,
      icon: Award,
      iconBg: "bg-[#FEF3C7]",
      iconColor: "text-[#D4A520]",
      trend: data.certificatesStatus,
      trendUp: null,
      showBadge: false,
      isRating: false,
    },
    {
      id: "avgRating",
      label: t("kpi.avgRating"),
      value: data.avgRating,
      icon: Star,
      iconBg: "bg-[#FEF3C7]",
      iconColor: "text-[#D4A520]",
      trend: `${data.totalReviews} reviews`,
      trendUp: null,
      showBadge: false,
      isRating: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
      {kpiCards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className="bg-white rounded-xl border border-[#E5E7EB] p-3 sm:p-4 lg:p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
          >
            {/* Icon and Badge Row */}
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div
                className={`w-10 h-10 sm:w-12 sm:h-12 ${card.iconBg} rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0`}
              >
                <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${card.iconColor}`} />
              </div>
              {/* Alert badge for At-Risk Learners */}
              {card.showBadge && card.badgeValue && card.badgeValue > 0 && (
                <span className="bg-[#EF4444] text-white text-[10px] sm:text-xs font-semibold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full min-w-[24px] sm:min-w-[28px] text-center flex-shrink-0">
                  +{card.badgeValue}
                </span>
              )}
            </div>

            {/* Label */}
            <p className="text-xs sm:text-sm text-[#6B7280] mb-0.5 sm:mb-1 line-clamp-2 min-h-[32px] sm:min-h-[40px]">
              {card.label}
            </p>

            {/* Value - Rating with stars or regular value */}
            {card.isRating ? (
              <div className="mb-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-2xl sm:text-3xl font-bold text-[#1F2937]">
                    {card.value}
                  </p>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {renderStars(card.value as number)}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-2xl sm:text-3xl font-bold text-[#1F2937] mb-1">
                {card.value}
              </p>
            )}

            {/* Trend Indicator */}
            <div
              className={`flex items-center gap-1 text-xs sm:text-sm ${
                card.trendUp === true
                  ? "text-[#22C55E]"
                  : card.trendUp === false
                    ? "text-[#EF4444]"
                    : "text-[#6B7280]"
              }`}
            >
              {card.trendUp === true && (
                <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
              )}
              {card.trendUp === false && (
                <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
              )}
              <span className="truncate">{card.trend}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default InstructorKPICards;
