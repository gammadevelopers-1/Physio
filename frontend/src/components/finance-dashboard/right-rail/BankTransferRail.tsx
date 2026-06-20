"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { Building2, ArrowRight, ArrowLeft, Clock } from "lucide-react";
import Money from "../shared/Money";
import { FINANCE_COLORS } from "../shared/financeColors";
import { ListRowSkeleton } from "../shared/Skeleton";

export interface BankTransferRailItem {
  id: string;
  customer: string;
  course: string;
  amount: number;
  uploadedAt: string;
  ageHours: number;
}

interface Props {
  items: BankTransferRailItem[];
  totalPending: number;
  loading?: boolean;
}

const BankTransferRail = ({ items, totalPending, loading }: Props) => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
      <div className={`flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-subtle)] ${isRTL ? "flex-row-reverse" : ""}`}>
        <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
          <div className={`w-7 h-7 rounded-md ${FINANCE_COLORS.info.bg} flex items-center justify-center`}>
            <Building2 className={`w-3.5 h-3.5 ${FINANCE_COLORS.info.text}`} />
          </div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("rail.bankTransfers.title")}
          </h3>
          {totalPending > 0 && (
            <span className="bg-[#3B82F6] text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
              {totalPending}
            </span>
          )}
        </div>
        <Link
          href={`/${locale}/dashboard/finance/bank-transfers`}
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
            <Building2 className="w-6 h-6 mx-auto mb-1 opacity-30" />
            {t("rail.bankTransfers.empty")}
          </div>
        ) : (
          <div className="space-y-2">
            {items.slice(0, 4).map((r) => {
              const ageStyle =
                r.ageHours >= 24
                  ? "text-[#DC2626]"
                  : r.ageHours >= 6
                    ? "text-[#D97706]"
                    : "text-[var(--color-text-secondary)]";
              return (
                <Link
                  key={r.id}
                  href={`/${locale}/dashboard/finance/bank-transfers`}
                  className="block p-2.5 bg-[var(--color-surface-page)] rounded-lg border border-[var(--color-border-subtle)] hover:border-[var(--color-primary)] transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-[var(--color-text-primary)] truncate">
                        {r.customer}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-secondary)] truncate">
                        {r.course}
                      </p>
                    </div>
                    <span className="text-[12px] font-semibold text-[var(--color-text-primary)] whitespace-nowrap flex-shrink-0">
                      <Money amount={r.amount} decimals={0} iconSize={10} />
                    </span>
                  </div>
                  <div className={`flex items-center gap-1 mt-1 text-[10px] ${ageStyle}`}>
                    <Clock className="w-2.5 h-2.5" />
                    {t("rail.bankTransfers.ageHours", { hours: Math.round(r.ageHours) })}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default BankTransferRail;
