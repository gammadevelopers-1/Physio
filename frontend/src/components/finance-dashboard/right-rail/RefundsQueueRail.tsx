"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { RotateCcw, Check, X, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";
import Money from "../shared/Money";
import { FINANCE_COLORS } from "../shared/financeColors";
import { ListRowSkeleton } from "../shared/Skeleton";

export interface RefundQueueItem {
  id: string;
  customer: string;
  course: string;
  refundAmount: number;
  reason: string;
}

interface Props {
  items: RefundQueueItem[];
  totalPending: number;
  onApprove?: (id: string) => Promise<void>;
  onReject?: (id: string) => void;
  loading?: boolean;
}

const RefundsQueueRail = ({ items, totalPending, onApprove, onReject, loading }: Props) => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const [processingId, setProcessingId] = useState<string | null>(null);

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
      <div className={`flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-subtle)] ${isRTL ? "flex-row-reverse" : ""}`}>
        <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
          <div className={`w-7 h-7 rounded-md ${FINANCE_COLORS.warning.bg} flex items-center justify-center`}>
            <RotateCcw className={`w-3.5 h-3.5 ${FINANCE_COLORS.warning.text}`} />
          </div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("rail.refunds.title")}
          </h3>
          {totalPending > 0 && (
            <span className="bg-[#EF4444] text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
              {totalPending}
            </span>
          )}
        </div>
        <Link
          href={`/${locale}/dashboard/finance/refunds`}
          className={`inline-flex items-center gap-0.5 text-xs font-medium text-[var(--color-primary)] hover:underline ${isRTL ? "flex-row-reverse" : ""}`}
        >
          {t("rail.viewAll")}
          <Arrow className="w-3 h-3" />
        </Link>
      </div>

      <div className="p-3">
        {loading ? (
          <ListRowSkeleton rows={3} />
        ) : items.length === 0 ? (
          <div className="py-6 text-center text-xs text-[var(--color-text-secondary)]">
            <RotateCcw className="w-6 h-6 mx-auto mb-1 opacity-30" />
            {t("rail.refunds.empty")}
          </div>
        ) : (
          <div className="space-y-2">
            {items.slice(0, 4).map((r) => (
              <div
                key={r.id}
                className="p-2.5 bg-[var(--color-surface-page)] rounded-lg border border-[var(--color-border-subtle)]"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-[var(--color-text-primary)] truncate">
                      {r.customer}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-secondary)] truncate">
                      {r.course}
                    </p>
                  </div>
                  <span className="text-[12px] font-semibold text-[var(--color-text-primary)] whitespace-nowrap flex-shrink-0">
                    <Money amount={r.refundAmount} decimals={0} iconSize={10} />
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={async () => {
                      if (!onApprove) return;
                      setProcessingId(r.id);
                      try {
                        await onApprove(r.id);
                      } finally {
                        setProcessingId(null);
                      }
                    }}
                    disabled={processingId === r.id}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 bg-[#16A34A] text-white text-[10px] font-medium rounded-md hover:bg-[#15803D] transition-colors disabled:opacity-50"
                  >
                    {processingId === r.id ? (
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    ) : (
                      <Check className="w-2.5 h-2.5" />
                    )}
                    {t("rail.refunds.approve")}
                  </button>
                  <button
                    onClick={() => onReject?.(r.id)}
                    disabled={processingId === r.id}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 bg-white text-[#DC2626] text-[10px] font-medium rounded-md border border-[#FEE2E2] hover:bg-[#FEE2E2] transition-colors disabled:opacity-50"
                  >
                    <X className="w-2.5 h-2.5" />
                    {t("rail.refunds.reject")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RefundsQueueRail;
