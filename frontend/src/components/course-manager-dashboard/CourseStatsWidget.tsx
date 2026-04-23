"use client";

import { useTranslations } from "next-intl";
import { TrendingUp, Star, CheckCircle, BookOpen } from "lucide-react";

interface CourseStatsData {
  activeCourses: number;
  draftCourses: number;
  completedCourses: number;
  avgCompletionRate: number;
  completionTrend: number;
  avgRating: number;
}

interface CourseStatsWidgetProps {
  data: CourseStatsData;
}

const CourseStatsWidget = ({ data }: CourseStatsWidgetProps) => {
  const t = useTranslations("courseManagerDashboard");

  return (
    <div className="bg-[var(--surface-intense)] rounded-xl border border-[var(--color-border)]">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 sm:p-5 border-b border-[var(--color-border)]">
        <div className="w-8 h-8 bg-[var(--gold-gold-100)] rounded-lg flex items-center justify-center">
          <BookOpen className="w-4 h-4 text-[var(--gold-gold-500)]" />
        </div>
        <h3 className="text-[15px] font-semibold text-[var(--on-surface-default)]">
          {t("courseStats.title")}
        </h3>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* Course Status Breakdown */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--on-surface-variant)] uppercase tracking-wider">
            {t("courseStats.breakdown")}
          </p>
          <div className="flex gap-2">
            <div className="flex-1 bg-[var(--functional-green-400)]/10 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-[var(--functional-green-600)]">{data.activeCourses}</p>
              <p className="text-[10px] text-[var(--functional-green-600)]">{t("kpi.active")}</p>
            </div>
            <div className="flex-1 bg-[var(--functional-amber-500)]/10 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-[var(--functional-amber-600)]">{data.draftCourses}</p>
              <p className="text-[10px] text-[var(--functional-amber-600)]">{t("kpi.draft")}</p>
            </div>
            <div className="flex-1 bg-[var(--functional-blue-400)]/10 rounded-lg p-2.5 text-center">
              <p className="text-lg font-bold text-[var(--functional-blue-600)]">{data.completedCourses}</p>
              <p className="text-[10px] text-[var(--functional-blue-600)]">{t("kpi.completed")}</p>
            </div>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="bg-[#F9FAFB] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[var(--functional-green-400)]/10 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-[var(--functional-green-600)]" />
              </div>
              <span className="text-sm font-medium text-[var(--on-surface-variant)]">
                {t("courseStats.avgCompletion")}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-[var(--functional-green-600)]" />
              <span className="text-xs font-semibold text-[var(--functional-green-600)]">
                +{data.completionTrend}%
              </span>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold text-[var(--on-surface-default)]">{data.avgCompletionRate}%</p>
            <div className="flex-1 h-2 bg-[var(--color-border)] rounded-full overflow-hidden mb-1">
              <div
                className="h-full bg-[var(--functional-green-600)] rounded-full transition-all"
                style={{ width: `${data.avgCompletionRate}%` }}
              />
            </div>
          </div>
        </div>

        {/* Average Rating */}
        <div className="bg-[#F9FAFB] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-[var(--gold-gold-100)] rounded-lg flex items-center justify-center">
              <Star className="w-4 h-4 text-[var(--gold-gold-500)]" />
            </div>
            <span className="text-sm font-medium text-[var(--on-surface-variant)]">
              {t("courseStats.avgRating")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-[var(--on-surface-default)]">{data.avgRating.toFixed(1)}</p>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-4 h-4 ${
                    star <= Math.floor(data.avgRating)
                      ? "text-[var(--gold-gold-500)] fill-[var(--gold-gold-500)]"
                      : star - 0.5 <= data.avgRating
                        ? "text-[var(--gold-gold-500)] fill-[var(--gold-gold-500)]/50"
                        : "text-[var(--color-border)]"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseStatsWidget;
