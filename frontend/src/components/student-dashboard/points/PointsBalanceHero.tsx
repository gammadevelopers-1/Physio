"use client";

import { useLocale, useTranslations } from "next-intl";
import { Sparkles, TrendingUp } from "lucide-react";

interface PointsBalanceHeroProps {
  balance: number;
  earnedThisMonth: number;
  onExploreRewards: () => void;
  onSeeEarnRules: () => void;
}

/**
 * Phase-4 hero for the My Points page. Renders the current balance as a
 * showcase-scale number on a violet→indigo gradient, with a MTD earn
 * counter underneath and two glass-morphism CTAs that smooth-scroll the
 * viewer to the Redeem / Ways-to-earn sections below.
 *
 * Deliberately non-gamified: no tiers, badges, streaks, or level copy.
 */
export default function PointsBalanceHero({
  balance,
  earnedThisMonth,
  onExploreRewards,
  onSeeEarnRules,
}: PointsBalanceHeroProps) {
  const locale = useLocale();
  const t = useTranslations("studentDashboard.myPoints.hero");
  const isRTL = locale === "ar";
  // Arrow character flips with reading direction — CTA points "downward"
  // regardless of language so the intent (scroll below) reads correctly.
  const downArrow = "↓";

  return (
    <section
      aria-labelledby="points-balance-hero-heading"
      className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white shadow-lg bg-gradient-to-r from-[#a37f49] via-[#8a6939] to-[#6b4e24]"
    >
      {/* Background sparkles motif — semi-transparent, corner-anchored,
          purely decorative so aria-hidden. */}
      <Sparkles
        aria-hidden
        className={`absolute top-4 ${isRTL ? "left-4" : "right-4"} w-20 h-20 sm:w-24 sm:h-24 text-white/10`}
        strokeWidth={1.5}
      />
      <Sparkles
        aria-hidden
        className={`absolute bottom-6 ${isRTL ? "right-8" : "left-8"} w-14 h-14 text-white/10`}
        strokeWidth={1.5}
      />
      <Sparkles
        aria-hidden
        className={`absolute top-1/2 ${isRTL ? "left-1/3" : "right-1/3"} w-8 h-8 text-white/10`}
        strokeWidth={1.5}
      />

      <div className="relative">
        <p
          id="points-balance-hero-heading"
          className="text-sm font-medium uppercase tracking-wider opacity-90"
        >
          {t("balanceLabel")}
        </p>

        <div className="mt-2 flex items-center gap-3">
          <span
            className="text-5xl sm:text-6xl font-bold tabular-nums"
            aria-label={t("balanceLabel")}
          >
            {balance.toLocaleString(locale)}
          </span>
          <Sparkles
            aria-hidden
            className="w-8 h-8 sm:w-10 sm:h-10 opacity-90"
            strokeWidth={2}
          />
        </div>

        <div className="mt-3 inline-flex items-center gap-2 text-base opacity-90">
          <TrendingUp aria-hidden className="w-4 h-4 text-emerald-200" />
          <span>
            {t("earnedThisMonth", {
              count: earnedThisMonth.toLocaleString(locale),
            })}
          </span>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onExploreRewards}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-sm ring-1 ring-white/25 text-sm font-medium transition-colors"
          >
            <span>{t("exploreRewardsCta")}</span>
            <span aria-hidden>{downArrow}</span>
          </button>
          <button
            type="button"
            onClick={onSeeEarnRules}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-sm ring-1 ring-white/25 text-sm font-medium transition-colors"
          >
            <span>{t("seeEarnRulesCta")}</span>
            <span aria-hidden>{downArrow}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
