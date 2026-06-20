"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { Bell, ArrowRight, ArrowLeft, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { FINANCE_COLORS } from "../shared/financeColors";
import { ListRowSkeleton } from "../shared/Skeleton";

export type AlertSeverity = "critical" | "warning" | "info";

export interface FinancialAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description?: string;
  createdAt: string;
}

interface Props {
  alerts: FinancialAlert[];
  loading?: boolean;
}

const DISMISS_KEY = "finance.alerts.dismissed";

function getDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function setDismissed(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // ignore
  }
}

const SEV_STYLE: Record<AlertSeverity, { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
  critical: { bg: FINANCE_COLORS.error.bg, text: FINANCE_COLORS.error.text, icon: AlertCircle },
  warning: { bg: FINANCE_COLORS.warning.bg, text: FINANCE_COLORS.warning.text, icon: AlertTriangle },
  info: { bg: FINANCE_COLORS.info.bg, text: FINANCE_COLORS.info.text, icon: Info },
};

const FinancialAlertsRail = ({ alerts, loading }: Props) => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const [dismissed, setDismissedState] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDismissedState(getDismissed());
  }, []);

  const visible = useMemo(() => alerts.filter((a) => !dismissed.has(a.id)), [alerts, dismissed]);
  const total = visible.length;

  const handleDismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissedState(next);
    setDismissed(next);
  };

  const handleClearAll = () => {
    const next = new Set(dismissed);
    alerts.forEach((a) => next.add(a.id));
    setDismissedState(next);
    setDismissed(next);
  };

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
      <div className={`flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-subtle)] ${isRTL ? "flex-row-reverse" : ""}`}>
        <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
          <div className={`w-7 h-7 rounded-md ${FINANCE_COLORS.error.bg} flex items-center justify-center`}>
            <Bell className={`w-3.5 h-3.5 ${FINANCE_COLORS.error.text}`} />
          </div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("rail.alerts.title")}
          </h3>
          {total > 0 && (
            <span className="bg-[#EF4444] text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
              {total}
            </span>
          )}
        </div>
        <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
          {total > 0 && (
            <button
              onClick={handleClearAll}
              className="text-[10px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:underline"
            >
              {t("rail.alerts.clearAll")}
            </button>
          )}
          <Link
            href={`/${locale}/dashboard/finance/audit-log?tab=alerts`}
            className={`inline-flex items-center gap-0.5 text-xs font-medium text-[var(--color-primary)] hover:underline ${isRTL ? "flex-row-reverse" : ""}`}
          >
            {t("rail.viewAll")}
            <Arrow className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <div className="p-3">
        {loading ? (
          <ListRowSkeleton rows={3} />
        ) : visible.length === 0 ? (
          <div className="py-6 text-center text-xs text-[var(--color-text-secondary)]">
            <Bell className="w-6 h-6 mx-auto mb-1 opacity-30" />
            {t("rail.alerts.empty")}
          </div>
        ) : (
          <div className="space-y-2">
            {visible.slice(0, 4).map((a) => {
              const style = SEV_STYLE[a.severity];
              const Icon = style.icon;
              return (
                <div
                  key={a.id}
                  className="p-2.5 bg-[var(--color-surface-page)] rounded-lg border border-[var(--color-border-subtle)] flex items-start gap-2"
                >
                  <div className={`w-6 h-6 rounded ${style.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-3 h-3 ${style.text}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-[var(--color-text-primary)] leading-tight">
                      {a.title}
                    </p>
                    {a.description && (
                      <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5 leading-tight">
                        {a.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDismiss(a.id)}
                    className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] flex-shrink-0"
                    aria-label={t("rail.alerts.dismiss")}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialAlertsRail;
