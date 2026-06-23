"use client";

/**
 * Early Bird tab — featured view of codes with the `earlyBird` flag set.
 *
 * Shows two sections: Active right now / Scheduled / Expired.
 * Each card has a live countdown to expiry, a uses progress bar, and
 * an auto-apply badge.
 *
 * Empty state encourages creating one via the wizard with the flag
 * pre-checked.
 */

import { useEffect, useState, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Clock, Sparkles, Plus } from "lucide-react";
import { discountApi } from "@/lib/api";
import Money from "../shared/Money";
import CreateCouponWizard from "./CreateCouponWizard";

interface Row {
  id: string;
  code: string;
  type: string;
  value: number;
  currentUses: number;
  maxUses: number | null;
  autoApply: boolean;
  applicableCourses: string[];
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
  campaign: string | null;
  campaignId: string | null;
  totalSaved: number;
  phase: "scheduled" | "live" | "expired";
}

function timeLeft(iso: string | null, locale: string): string {
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return locale === "ar" ? "انتهى" : "Ended";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (days > 0) return locale === "ar" ? `${days}ي ${hours}س` : `${days}d ${hours}h`;
  if (hours > 0) return locale === "ar" ? `${hours}س ${mins}د` : `${hours}h ${mins}m`;
  return locale === "ar" ? `${mins}د` : `${mins}m`;
}

interface Props {
  onOpenCoupon: (id: string | null) => void;
  /** Bump from parent (DiscountsContent) when the coupon drawer
   * mutates state — forces this tab to refetch so deleted early-bird
   * codes stop ghosting the page. */
  refreshKey?: number;
}

const EarlyBirdTab = ({ onOpenCoupon, refreshKey = 0 }: Props) => {
  const t = useTranslations("financeDashboard.discountsPage.earlyBirdTab");
  const locale = useLocale();
  // const isRTL = locale === "ar"; // not needed — dir="rtl" on <html> handles flex order

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [tick, setTick] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await discountApi.listEarlyBird();
      setRows(res as Row[]);
    } catch {
      // empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // refreshKey is in the dep list so parent-triggered changes
    // (e.g. a delete via the detail drawer) refetch automatically.
  }, [fetchData, refreshKey]);

  // Re-render every 60s so countdowns stay fresh
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const live = rows.filter((r) => r.phase === "live");
  const scheduled = rows.filter((r) => r.phase === "scheduled");
  const expired = rows.filter((r) => r.phase === "expired");

  const renderCard = (r: Row) => {
    const pct =
      r.maxUses && r.maxUses > 0
        ? Math.min(100, Math.round((r.currentUses / r.maxUses) * 100))
        : null;
    const isLive = r.phase === "live";
    return (
      <button
        key={r.id}
        type="button"
        onClick={() => onOpenCoupon(r.id)}
        className={`group p-5 rounded-2xl border text-start transition-all hover:shadow-md ${
          isLive
            ? "bg-gradient-to-br from-[#FFFBEB] to-white border-[#FCD34D]"
            : "bg-[var(--color-surface-card)] border-[var(--color-border)]"
        }`}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E]">
                <Clock className="w-2.5 h-2.5" /> {t("badge")}
              </span>
              {r.autoApply && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#FFEDD5] text-[#9A3412]">
                  <Sparkles className="w-2.5 h-2.5" /> Auto
                </span>
              )}
            </div>
            <p className="font-mono text-base font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] truncate">
              {r.code}
            </p>
          </div>
          <div className="text-end">
            <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] font-semibold">
              {t("value")}
            </p>
            <p className="text-2xl font-bold text-[#D97706]">
              {r.type === "percentage" ? `${r.value}%` : <Money amount={r.value} decimals={0} />}
            </p>
          </div>
        </div>

        {isLive && r.validUntil && (
          <div className="mb-3 p-2 rounded-lg bg-[#FEF3C7]/60 flex items-center justify-between">
            <span className="text-[11px] text-[#92400E] font-semibold uppercase tracking-wide">
              {t("endsIn")}
            </span>
            <span key={tick} className="text-sm font-bold text-[#92400E] font-mono">
              {timeLeft(r.validUntil, locale)}
            </span>
          </div>
        )}
        {r.phase === "scheduled" && r.validFrom && (
          <div className="mb-3 p-2 rounded-lg bg-[#DBEAFE] flex items-center justify-between">
            <span className="text-[11px] text-[#1D4ED8] font-semibold uppercase tracking-wide">
              {t("startsIn")}
            </span>
            <span key={tick} className="text-sm font-bold text-[#1D4ED8] font-mono">
              {timeLeft(r.validFrom, locale)}
            </span>
          </div>
        )}

        {pct !== null && (
          <div className="mb-2">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-[var(--color-text-secondary)]">{t("uses")}</span>
              <span className="text-[var(--color-text-primary)] font-medium">
                {r.currentUses}/{r.maxUses}
              </span>
            </div>
            <div className="h-1.5 bg-[var(--color-surface-page)] rounded-full overflow-hidden">
              <div className="h-full bg-[#D97706] rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] mt-3 pt-3 border-t border-[var(--color-border-subtle)]">
          <span className="text-[var(--color-text-secondary)]">
            {r.applicableCourses.length === 0
              ? t("globalScope")
              : t("nCourses", { n: r.applicableCourses.length })}
          </span>
          {r.totalSaved > 0 && (
            <span className="text-[#15803D] font-semibold">
              <Money amount={r.totalSaved} decimals={0} /> {t("saved")}
            </span>
          )}
        </div>
      </button>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-[var(--color-border-subtle)] h-20 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-card)] p-5 animate-pulse space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="h-3 w-20 bg-[var(--color-border-subtle)] rounded" />
                <div className="h-5 w-16 bg-[var(--color-border-subtle)] rounded" />
              </div>
              <div className="h-7 w-32 bg-[var(--color-border-subtle)] rounded" />
              <div className="h-10 w-full bg-[var(--color-border-subtle)] rounded-lg" />
              <div className="h-2 w-full bg-[var(--color-border-subtle)] rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero / create CTA */}
      <div className="bg-gradient-to-r from-[#FEF3C7] via-[#FFFBEB] to-white border border-[#FCD34D]/50 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className={`flex items-center gap-3`}>
          <div className="w-12 h-12 rounded-xl bg-[#D97706] flex items-center justify-center flex-shrink-0">
            <Clock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#92400E]">{t("hero.title")}</h3>
            <p className="text-xs text-[#92400E]/80 mt-0.5">{t("hero.subtitle")}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-[#D97706] text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 hover:opacity-95"
        >
          <Plus className="w-4 h-4" />
          {t("hero.create")}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-12 text-center">
          <Clock className="w-12 h-12 mx-auto text-[var(--color-text-secondary)]/40 mb-3" />
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{t("empty")}</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">{t("emptyHint")}</p>
        </div>
      ) : (
        <>
          {live.length > 0 && (
            <Section title={t("sections.live")} count={live.length}>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {live.map(renderCard)}
              </div>
            </Section>
          )}
          {scheduled.length > 0 && (
            <Section title={t("sections.scheduled")} count={scheduled.length}>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {scheduled.map(renderCard)}
              </div>
            </Section>
          )}
          {expired.length > 0 && (
            <Section title={t("sections.expired")} count={expired.length}>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 opacity-70">
                {expired.map(renderCard)}
              </div>
            </Section>
          )}
        </>
      )}

      <CreateCouponWizard
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={() => fetchData()}
      />
    </div>
  );
};

const Section = ({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) => (
  <div>
    <div className="flex items-center gap-2 mb-3">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--color-surface-page)] text-[var(--color-text-secondary)] font-medium">
        {count}
      </span>
    </div>
    {children}
  </div>
);

export default EarlyBirdTab;
