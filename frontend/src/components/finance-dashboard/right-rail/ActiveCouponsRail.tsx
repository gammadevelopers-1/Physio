"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { Tag, ArrowRight, ArrowLeft } from "lucide-react";
import { FINANCE_COLORS } from "../shared/financeColors";
import { ListRowSkeleton } from "../shared/Skeleton";

export interface CouponRailItem {
  id: string;
  code: string;
  discountLabel: string;
  used: number;
  limit: number;
  expiresIn: number | null;
}

interface Props {
  items: CouponRailItem[];
  loading?: boolean;
}

const ActiveCouponsRail = ({ items, loading }: Props) => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
      <div className={`flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-subtle)] ${isRTL ? "flex-row-reverse" : ""}`}>
        <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
          <div className={`w-7 h-7 rounded-md ${FINANCE_COLORS.success.bg} flex items-center justify-center`}>
            <Tag className={`w-3.5 h-3.5 ${FINANCE_COLORS.success.text}`} />
          </div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("rail.coupons.title")}
          </h3>
        </div>
        <Link
          href={`/${locale}/dashboard/finance/discounts`}
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
            <Tag className="w-6 h-6 mx-auto mb-1 opacity-30" />
            {t("rail.coupons.empty")}
          </div>
        ) : (
          <div className="space-y-2">
            {items.slice(0, 4).map((c) => {
              const pct = c.limit > 0 ? Math.min(100, Math.round((c.used / c.limit) * 100)) : 0;
              return (
                <Link
                  key={c.id}
                  href={`/${locale}/dashboard/finance/discounts`}
                  className="block p-2.5 bg-[var(--color-surface-page)] rounded-lg border border-[var(--color-border-subtle)] hover:border-[var(--color-primary)] transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[12px] font-mono font-semibold text-[var(--color-text-primary)] truncate">
                      {c.code}
                    </span>
                    <span className={`text-[10px] font-medium ${FINANCE_COLORS.success.text} whitespace-nowrap`}>
                      {c.discountLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-secondary)]">
                    <div className="flex-1 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--color-primary)] rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="whitespace-nowrap">
                      {c.used}/{c.limit || "∞"}
                    </span>
                  </div>
                  {c.expiresIn !== null && c.expiresIn >= 0 && (
                    <div className="text-[10px] text-[var(--color-text-secondary)] mt-1">
                      {t("rail.coupons.expiresIn", { days: c.expiresIn })}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveCouponsRail;
