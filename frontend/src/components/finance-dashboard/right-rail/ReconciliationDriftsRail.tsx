"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { Scale, ArrowRight, ArrowLeft, AlertTriangle } from "lucide-react";
import { FINANCE_COLORS } from "../shared/financeColors";
import { ListRowSkeleton } from "../shared/Skeleton";

export interface DriftRailItem {
  id: string;
  driftType: string;
  gateway: string;
  detectedAt: string;
  escalated?: boolean;
}

interface Props {
  items: DriftRailItem[];
  totalUnresolved: number;
  loading?: boolean;
}

const ReconciliationDriftsRail = ({ items, totalUnresolved, loading }: Props) => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const Arrow = isRTL ? ArrowLeft : ArrowRight;

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
      <div className={`flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-subtle)] ${isRTL ? "flex-row-reverse" : ""}`}>
        <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
          <div className={`w-7 h-7 rounded-md ${FINANCE_COLORS.violet.bg} flex items-center justify-center`}>
            <Scale className={`w-3.5 h-3.5 ${FINANCE_COLORS.violet.text}`} />
          </div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("rail.reconciliation.title")}
          </h3>
          {totalUnresolved > 0 && (
            <span className="bg-[#8B5CF6] text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
              {totalUnresolved}
            </span>
          )}
        </div>
        <Link
          href={`/${locale}/dashboard/finance/reconciliation`}
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
            <Scale className="w-6 h-6 mx-auto mb-1 opacity-30" />
            {t("rail.reconciliation.empty")}
          </div>
        ) : (
          <div className="space-y-2">
            {items.slice(0, 4).map((d) => (
              <Link
                key={d.id}
                href={`/${locale}/dashboard/finance/reconciliation`}
                className="block p-2.5 bg-[var(--color-surface-page)] rounded-lg border border-[var(--color-border-subtle)] hover:border-[var(--color-primary)] transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-[12px] font-medium text-[var(--color-text-primary)] capitalize">
                    {t(`reconciliationPage.driftTypes.${d.driftType}`)}
                  </p>
                  {d.escalated && (
                    <span className={`inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded ${FINANCE_COLORS.warning.bg} ${FINANCE_COLORS.warning.textDark}`}>
                      <AlertTriangle className="w-2 h-2" />
                      {t("rail.reconciliation.escalated")}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-[10px] text-[var(--color-text-secondary)]">
                  <span className="capitalize">{d.gateway?.replace(/_/g, " ")}</span>
                  <span>{d.detectedAt}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReconciliationDriftsRail;
