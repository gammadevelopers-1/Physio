"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import OfflineBanner from "./OfflineBanner";
import PointsBalanceHero from "./points/PointsBalanceHero";
import WaysToEarnGrid from "./points/WaysToEarnGrid";
import RedeemPointsSection from "./points/RedeemPointsSection";
import CoursesRedemptionGrid from "./points/CoursesRedemptionGrid";
import RecentRewardsPreview from "./points/RecentRewardsPreview";
import RecentActivityList from "./points/RecentActivityList";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { pointsApi, type PointsMe } from "@/lib/api";

/**
 * Phase-4 My-Points page shell. Composes the six Phase-4 sections in a
 * fixed vertical order. Owns only the top-level `PointsMe` fetch (used
 * to feed both the hero card and the RedeemPointsSection's optimistic
 * balance updates); each child section is responsible for its own
 * secondary data fetch so page-level state stays minimal.
 *
 * The page keeps mounting on `/dashboard/student/invite-friends` for
 * bookmark compatibility — the URL name is a legacy artifact from the
 * pre-Phase-4 era when the invite/refer widget lived here.
 */
const MyPointsContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard.myPoints");
  const userData = useStudentProfile();

  const [me, setMe] = useState<PointsMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await pointsApi.getMe();
        if (!cancelled) setMe(res);
      } catch (err) {
        console.error("Failed to load points summary", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Smooth-scroll targets for the two hero CTAs. Section ids are the
  // single source of truth (also used for direct anchor links from
  // other surfaces), so the CTAs just look up the id at click-time.
  const scrollToRewards = useCallback(() => {
    document
      .getElementById("redeem-rewards")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const scrollToEarn = useCallback(() => {
    document
      .getElementById("ways-to-earn")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const invitePageHref = `/${locale}/dashboard/student/invite-friends`;

  // Called by RedeemPointsSection when a reward redemption commits — we
  // bump the balance so the hero doesn't lag behind the sub-section's
  // local state until the next full reload.
  const handleBalanceChanged = useCallback((newBalance: number) => {
    setMe((prev) =>
      prev
        ? { ...prev, balance: newBalance }
        : { balance: newBalance, earnedThisMonth: 0 },
    );
  }, []);

  // Grid layout unchanged from earlier phases — sidebar on the left,
  // main content flexing to fill remaining width.
  return (
    <>
      <DashboardNavbar user={userData} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <DashboardSidebar user={userData} />
            </div>
            <MobileSidebar user={userData} />

            <div className="flex-1 min-w-0 space-y-6">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                  {t("title")}
                </h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {t("subtitle")}
                </p>
              </div>

              <OfflineBanner />

              {loading || !me ? (
                <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-secondary)]">
                  <Loader2 className="w-6 h-6 animate-spin mb-2" />
                  <p className="text-sm">{t("loading")}</p>
                </div>
              ) : (
                <>
                  <PointsBalanceHero
                    balance={me.balance}
                    earnedThisMonth={me.earnedThisMonth}
                    onExploreRewards={scrollToRewards}
                    onSeeEarnRules={scrollToEarn}
                  />

                  <WaysToEarnGrid invitePageHref={invitePageHref} />

                  <RedeemPointsSection
                    balance={me.balance}
                    onBalanceChanged={handleBalanceChanged}
                  />

                  <CoursesRedemptionGrid balance={me.balance} />

                  <RecentRewardsPreview />

                  <RecentActivityList />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MyPointsContent;
