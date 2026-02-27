"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { BarChart3, ChevronRight, TrendingUp } from "lucide-react";

interface AssessmentScore {
  id: string;
  name: string;
  preScore: number;
  postScore: number;
}

interface QuestionItem {
  id: string;
  question: string;
  difficulty: "easy" | "medium" | "hard";
  correctRate: number;
}

interface AssessmentAnalysisWidgetProps {
  assessments: AssessmentScore[];
  questions: QuestionItem[];
}

const AssessmentAnalysisWidget = ({
  assessments,
  questions,
}: AssessmentAnalysisWidgetProps) => {
  const t = useTranslations("instructorDashboard");
  const router = useRouter();
  const locale = useLocale();

  const getDifficultyStyle = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "bg-[#DCFCE7] text-[#22C55E]";
      case "medium":
        return "bg-[#FEF9C3] text-[#EAB308]";
      case "hard":
        return "bg-[#FEE2E2] text-[#EF4444]";
      default:
        return "bg-[#F3F4F6] text-[#6B7280]";
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return t("assessmentAnalysis.easy");
      case "medium":
        return t("assessmentAnalysis.medium");
      case "hard":
        return t("assessmentAnalysis.hard");
      default:
        return difficulty;
    }
  };

  // Find max score for scaling the bars
  const maxScore = Math.max(
    ...assessments.flatMap((a) => [a.preScore, a.postScore]),
    100
  );

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] mb-6">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-[#3B82F6]" />
          <h2 className="text-base sm:text-lg font-semibold text-[#1F2937]">
            {t("assessmentAnalysis.title")}
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#93C5FD]" />
            {t("assessmentAnalysis.preTest")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#3B82F6]" />
            {t("assessmentAnalysis.postTest")}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pre/Post Score Comparison Bar Chart */}
          <div>
            <h4 className="text-sm text-[#4B5563] mb-4">
              {t("assessmentAnalysis.scoreComparison")}
            </h4>
            <div className="space-y-4">
              {assessments.map((assessment) => {
                const improvement = assessment.postScore - assessment.preScore;
                const improvementPercent = assessment.preScore > 0
                  ? Math.round((improvement / assessment.preScore) * 100)
                  : 0;

                return (
                  <div key={assessment.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#374151] font-medium truncate max-w-[60%]">
                        {assessment.name}
                      </span>
                      {improvement > 0 && (
                        <span className="flex items-center gap-1 text-[#22C55E] text-xs font-medium">
                          <TrendingUp className="w-3.5 h-3.5" />
                          +{improvementPercent}%
                        </span>
                      )}
                    </div>
                    {/* Grouped Bar Chart */}
                    <div className="space-y-1.5">
                      {/* Pre-test bar */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-5 bg-[#F3F4F6] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#93C5FD] rounded-full transition-all duration-500 flex items-center justify-end pe-2"
                            style={{ width: `${(assessment.preScore / maxScore) * 100}%` }}
                          >
                            <span className="text-[10px] font-semibold text-[#1E40AF]">
                              {assessment.preScore}%
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Post-test bar */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-5 bg-[#F3F4F6] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#3B82F6] rounded-full transition-all duration-500 flex items-center justify-end pe-2"
                            style={{ width: `${(assessment.postScore / maxScore) * 100}%` }}
                          >
                            <span className="text-[10px] font-semibold text-white">
                              {assessment.postScore}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Question Difficulty Analysis */}
          <div>
            <h4 className="text-sm text-[#4B5563] mb-4">
              {t("assessmentAnalysis.questionDifficulty")}
            </h4>
            <div className="space-y-3">
              {questions.map((question) => (
                <div
                  key={question.id}
                  className="flex items-center gap-3 p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]"
                >
                  {/* Question number */}
                  <div className="w-8 h-8 rounded-full bg-[#E5E7EB] flex items-center justify-center text-xs font-semibold text-[#4B5563] flex-shrink-0">
                    Q{question.id}
                  </div>

                  {/* Question text and stats */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#374151] truncate">
                      {question.question}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-[#6B7280]">
                        {t("assessmentAnalysis.correctRate")}: {question.correctRate}%
                      </span>
                    </div>
                  </div>

                  {/* Difficulty pill */}
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${getDifficultyStyle(question.difficulty)}`}
                  >
                    {getDifficultyLabel(question.difficulty)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* View Item Analysis Link */}
        <div className="mt-6 pt-4 border-t border-[#E5E7EB]">
          <button
            onClick={() => router.push(`/${locale}/dashboard/instructor/assessments`)}
            className="w-full flex items-center justify-center gap-1 py-2.5 text-sm font-medium text-[#3B82F6] hover:underline"
          >
            {t("assessmentAnalysis.viewItemAnalysis")}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssessmentAnalysisWidget;
