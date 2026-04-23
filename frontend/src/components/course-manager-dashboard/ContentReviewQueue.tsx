"use client";

import { useTranslations, useLocale } from "next-intl";
import { Video, FileText, File, Image as ImageIcon, HelpCircle, Eye, ChevronRight, ClipboardList } from "lucide-react";
import Link from "next/link";

interface ChecklistItem {
  id: string;
  label: string;
  passed: boolean;
}

interface ContentReviewItem {
  id: string;
  type: string;
  title: string;
  courseName: string;
  submittedBy: string;
  checklist: ChecklistItem[];
}

interface ContentReviewQueueProps {
  items: ContentReviewItem[];
  totalCount?: number;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onPreview: (id: string) => void;
}

const ContentReviewQueue = ({
  items,
  totalCount,
  onApprove,
  onReject,
  onPreview,
}: ContentReviewQueueProps) => {
  const t = useTranslations("courseManagerDashboard");
  const tA = useTranslations("accessibility");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const displayCount = totalCount ?? items.length;

  const typeIcons: Record<string, { icon: typeof Video; bg: string; color: string }> = {
    video: { icon: Video, bg: "bg-[#DBEAFE]", color: "text-[#3B82F6]" },
    pdf: { icon: FileText, bg: "bg-[#FEE2E2]", color: "text-[#EF4444]" },
    document: { icon: File, bg: "bg-[#FEF3C7]", color: "text-[#F59E0B]" },
    image: { icon: ImageIcon, bg: "bg-[#D1FAE5]", color: "text-[#10B981]" },
    quiz: { icon: HelpCircle, bg: "bg-[#FFEDD5]", color: "text-[#F97316]" },
  };
  const defaultTypeIcon = { icon: File, bg: "bg-[#F3F4F6]", color: "text-[var(--color-text-secondary)]" };

  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)]">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 sm:p-5 border-b border-[var(--color-border)]">
        <div className="w-8 h-8 bg-[#FEF3C7] rounded-lg flex items-center justify-center">
          <ClipboardList className="w-4 h-4 text-[#D4A520]" />
        </div>
        <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
          {t("contentReview.title")}
        </h3>
        <span className="bg-[#EF4444] text-white text-[11px] font-semibold px-2 py-0.5 rounded-full ms-auto">
          {displayCount}
        </span>
      </div>

      {/* Items */}
      <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-4 space-y-3">
        {items.map((item) => {
          const typeConfig = typeIcons[item.type] || defaultTypeIcon;
          const failedChecks = item.checklist.filter((c) => !c.passed);

          return (
            <div
              key={item.id}
              className="bg-[var(--color-surface-page)] rounded-xl p-3.5 border border-[var(--color-border)]"
            >
              {/* Header row */}
              <div className="flex items-start gap-3 mb-2">
                <div
                  className={`w-9 h-9 ${typeConfig.bg} rounded-lg flex items-center justify-center flex-shrink-0`}
                >
                  <typeConfig.icon className={`w-4 h-4 ${typeConfig.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[var(--color-text-secondary)] truncate">
                    {item.title}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-secondary)] truncate">
                    {item.courseName} • {item.submittedBy}
                  </p>
                </div>
                {/* Status label top-right */}
                {failedChecks.length > 0 ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FEE2E2] text-[#EF4444] text-[10px] font-medium rounded-full flex-shrink-0 whitespace-nowrap">
                    {failedChecks.map((c) => c.label).join(", ")} {isRTL ? "فاشل" : "Failed"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#DCFCE7] text-[#22C55E] text-[10px] font-medium rounded-full flex-shrink-0 whitespace-nowrap">
                    {isRTL ? "ناجح" : "Passed"}
                  </span>
                )}
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
                  className="py-1.5 px-2 bg-[#F3F4F6] text-[var(--color-text-secondary)] text-[11px] font-medium rounded-md hover:bg-[var(--color-border)] transition-colors"
                  aria-label={tA("preview")}
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {/* View All Link */}
        <div className="text-center pt-3 border-t border-[var(--color-border)] mt-3">
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
