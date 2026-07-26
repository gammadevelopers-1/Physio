"use client";

import { useLocale, useTranslations } from "next-intl";
import { Gift } from "lucide-react";
import RewardsSection from "../RewardsSection";

interface RedeemPointsSectionProps {
  balance: number;
  onBalanceChanged: (newBalance: number) => void;
}

/**
 * Thin wrapper around the existing `<RewardsSection>` — Phase 4 keeps
 * the rewards catalog component unchanged and just adds a section
 * header + anchor id so the hero-CTA smooth-scroll target has
 * something to land on.
 */
export default function RedeemPointsSection({
  balance,
  onBalanceChanged,
}: RedeemPointsSectionProps) {
  const locale = useLocale();
  const t = useTranslations("studentDashboard.myPoints.redeemRewards");
  const isRTL = locale === "ar";

  return (
    <section
      id="redeem-rewards"
      aria-labelledby="redeem-rewards-heading"
      className="scroll-mt-24 space-y-3"
    >
      <header>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
            <Gift className="w-5 h-5 text-violet-600" strokeWidth={2} />
          </div>
          <h2
            id="redeem-rewards-heading"
            className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]"
          >
            {t("title")}
          </h2>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1 ms-11">
          {t("subtitle")}
        </p>
      </header>

      <RewardsSection
        balance={balance}
        isRTL={isRTL}
        onBalanceChanged={onBalanceChanged}
      />
    </section>
  );
}
