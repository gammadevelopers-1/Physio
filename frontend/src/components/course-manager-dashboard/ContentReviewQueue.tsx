"use client";

import { useTranslations, useLocale } from "next-intl";
import { Video, FileText, HelpCircle, Eye, ChevronRight, ClipboardList } from "lucide-react";
import Link from "next/link";

interface ChecklistItem {
  id: string;
  label: string;
  passed: boolean;
}

interface ContentReviewItem {
  id: string;
  type: "video" | "pdf" | "quiz";
  title: string;
  courseName: string;
  submittedBy: string;
  checklist: ChecklistItem[];
}

interface ContentReviewQueueProps {
  items: ContentReviewItem[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onPreview: (id: string) => void;
}

const ContentReviewQueue = ({
  items,
  onApprove,
  onReject,
  onPreview,
}: ContentReviewQueueProps) => {
  const t = useTranslations("courseManagerDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const typeIcons = {
    video: { icon: Video, bg: "bg-[#DBEAFE]", color: "text-[#3B82F6]" },
    pdf: { icon: FileText, bg: "bg-[#FEE2E2]", color: "text-[#EF4444]" },
    quiz: { icon: HelpCircle, bg: "bg-[#FFEDD5]", color: "text-[#F97316]" },
  };

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB]">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 sm:p-5">
        <div className="w-8 h-8 bg-[#FEF3C7] rounded-lg flex items-center justify-center">
          <ClipboardList className="w-4 h-4 text-[#D4A520]" />
        </div>
        <h3 className="text-[15px] font-semibold text-[#1F2937]">
          {t("contentReview.title")}
        </h3>
        <span className="bg-[#EF4444] text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>

      {/* Items */}
      <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-3">
        {items.map((item) => {
          const typeConfig = typeIcons[item.type];
          const allPassed = item.checklist.every((c) => c.passed);

          return (
            <div
              key={item.id}
              className="bg-[#F9FAFB] rounded-xl p-3.5 border border-[#E5E7EB]"
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-9 h-9 ${typeConfig.bg} rounded-lg flex items-center justify-center`}
                >
                  <typeConfig.icon className={`w-4 h-4 ${typeConfig.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#1F2937] truncate">
                    {item.title}
                  </p>
                  <p className="text-[11px] text-[#6B7280]">
                    {item.courseName} • {item.submittedBy}
                  </p>
                </div>
              </div>

              {/* Checklist */}
              <div className="flex gap-1 mb-3">
                {item.checklist.map((check) => (
                  <div
                    key={check.id}
                    className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-semibold ${
                      check.passed
                        ? "bg-[#DCFCE7] text-[#22C55E]"
                        : "bg-[#FEE2E2] text-[#EF4444]"
                    }`}
                    title={check.label}
                  >
                    {check.passed ? "✓" : "✗"}
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => onApprove(item.id)}
                  className="flex-1 py-1.5 px-2 bg-[#22C55E] text-white text-[11px] font-medium rounded-md hover:bg-[#16A34A] transition-colors"
                >
                  {t("contentReview.approve")}
                </button>
                <button
                  onClick={() => onReject(item.id)}
                  className="flex-1 py-1.5 px-2 bg-white text-[#EF4444] text-[11px] font-medium rounded-md border border-[#FEE2E2] hover:bg-[#FEF2F2] transition-colors"
                >
                  {t("contentReview.reject")}
                </button>
                <button
                  onClick={() => onPreview(item.id)}
                  className="py-1.5 px-2 bg-[#F3F4F6] text-[#4B5563] text-[11px] font-medium rounded-md hover:bg-[#E5E7EB] transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {/* View All Link */}
        <div className="text-center pt-3 border-t border-[#E5E7EB] mt-3">
          <Link
            href={`/${locale}/dashboard/manager/content-review`}
            className="text-[13px] font-medium text-[#3B82F6] hover:underline inline-flex items-center gap-1"
          >
            {t("contentReview.viewAll")}
            <ChevronRight className={`w-3.5 h-3.5 ${isRTL ? "rotate-180" : ""}`} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ContentReviewQueue;
