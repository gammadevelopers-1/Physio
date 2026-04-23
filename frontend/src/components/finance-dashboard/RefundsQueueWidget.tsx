"use client";

import { useTranslations, useLocale } from "next-intl";
import { RotateCcw, Check, X, AlertCircle } from "lucide-react";

interface RefundItem {
  id: string;
  customer: string;
  course: string;
  originalAmount: string;
  refundAmount: string;
  reason: string;
  deduction?: string;
}

interface RefundsQueueWidgetProps {
  refunds: RefundItem[];
}

const RefundsQueueWidget = ({ refunds }: RefundsQueueWidgetProps) => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#F3F4F6]">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-[#EA580C]" />
          <h3 className="text-base font-semibold text-[#111827]">
            {t("refundsQueue.title")}
          </h3>
          <span className="bg-[#EF4444] text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
            {refunds.length}
          </span>
        </div>
        <button className="text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] hover:underline">
          {t("refundsQueue.viewAll")}
        </button>
      </div>

      {/* Refund Items */}
      <div className="p-5 space-y-3">
        {refunds.map((refund) => (
          <div key={refund.id}>
            <div className="flex items-center gap-3 p-3.5 bg-[#F9FAFB] rounded-xl border border-[#F3F4F6]">
              {/* Icon */}
              <div className="w-10 h-10 rounded-full bg-[#FFEDD5] flex items-center justify-center flex-shrink-0">
                <RotateCcw className="w-4 h-4 text-[#EA580C]" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#111827]">
                  {refund.customer}
                </p>
                <p className="text-[11px] text-[#6B7280] truncate">
                  {refund.course} - {refund.reason}
                </p>
              </div>

              {/* Amount */}
              <div className={`${isRTL ? "text-left" : "text-right"} flex-shrink-0`}>
                <p className="text-sm font-semibold text-[#111827]">
                  {refund.refundAmount}
                </p>
                {refund.originalAmount !== refund.refundAmount && (
                  <p className="text-[11px] text-[#9CA3AF] line-through">
                    {refund.originalAmount}
                  </p>
                )}
              </div>
            </div>

            {/* Deduction info + Actions */}
            <div className="mt-2 space-y-2">
              {refund.deduction && (
                <div className="flex items-center gap-1 text-[11px] text-[#D97706]">
                  <AlertCircle className="w-3 h-3" />
                  {refund.deduction}
                </div>
              )}
              <div className="flex gap-2 w-full">
                <button className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-[#16A34A] text-white text-[11px] font-medium rounded-md hover:bg-[#15803D] transition-colors">
                  <Check className="w-3 h-3" />
                  {t("refundsQueue.approve")}
                </button>
                <button className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-white text-[#DC2626] text-[11px] font-medium rounded-md border border-[#FEE2E2] hover:bg-[#FEE2E2] transition-colors">
                  <X className="w-3 h-3" />
                  {t("refundsQueue.reject")}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RefundsQueueWidget;
