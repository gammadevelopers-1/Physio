"use client";

/**
 * Discount & Coupon Management — finance dashboard root.
 *
 * 5 top-level tabs (matches the Payments / Invoices / Refunds rebuilds):
 *   • Overview  — KPI strip + recharts + activity feeds
 *   • Codes     — paginated, filterable, bulk-selectable codes table
 *                 + batches sub-table
 *   • Campaigns — promotional campaign cards (parent of codes)
 *   • Course Sales — finance-managed % off a course (no code needed)
 *   • Early Bird  — featured tab for early-bird codes with countdowns
 *
 * URL deep-link: `?tab=<key>&couponId=<id>&campaignId=<id>`.
 */

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Layers,
  Tag,
  Percent,
  Megaphone,
  Clock,
  BarChart3,
} from "lucide-react";
import DiscountOverviewTab from "./discounts/DiscountOverviewTab";
import DiscountCodesTab from "./discounts/DiscountCodesTab";
import CampaignsTabV2 from "./discounts/CampaignsTabV2";
import CourseSalesTab from "./discounts/CourseSalesTab";
import EarlyBirdTab from "./discounts/EarlyBirdTab";
import DiscountDetailDrawerV2 from "./discounts/DiscountDetailDrawerV2";
import CampaignDetailDrawer from "./discounts/CampaignDetailDrawer";
import FinancePageShell from "./shared/FinancePageShell";

type TabKey = "overview" | "codes" | "campaigns" | "course-sales" | "early-bird";

export interface DiscountsContentProps {
  /** When true, render only the inner page (no FinanceNavbar/Sidebar). Used
   *  when an outer dashboard (e.g. AdminFinanceShell) already provides chrome. */
  embedded?: boolean;
}

const DiscountsContent = ({ embedded = false }: DiscountsContentProps) => {
  const t = useTranslations("financeDashboard.discountsPage");
  // dir="rtl" on <html> handles RTL ordering — no isRTL needed here.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [tab, setTab] = useState<TabKey>("overview");
  const [drawerCouponId, setDrawerCouponId] = useState<string | null>(null);
  const [drawerCampaignId, setDrawerCampaignId] = useState<string | null>(null);
  // Bumped whenever the coupon detail drawer mutates (delete / toggle /
  // edit) — tabs that depend on coupon data (Codes, Early Bird) include
  // this in their fetch deps so they re-fetch automatically. Without
  // this, deleting a code via the drawer leaves the EarlyBird card stale.
  const [refreshKey, setRefreshKey] = useState(0);

  // URL deep-link sync
  useEffect(() => {
    const t = searchParams.get("tab") as TabKey | null;
    /* eslint-disable react-hooks/set-state-in-effect */
    if (t && ["overview", "codes", "campaigns", "course-sales", "early-bird"].includes(t)) {
      setTab(t);
    }
    setDrawerCouponId(searchParams.get("couponId"));
    setDrawerCampaignId(searchParams.get("campaignId"));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [searchParams]);

  const switchTab = useCallback(
    (next: TabKey) => {
      setTab(next);
      const sp = new URLSearchParams(searchParams.toString());
      if (next === "overview") sp.delete("tab");
      else sp.set("tab", next);
      sp.delete("couponId");
      sp.delete("campaignId");
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const openCouponDrawer = useCallback(
    (id: string | null) => {
      setDrawerCouponId(id);
      const sp = new URLSearchParams(searchParams.toString());
      if (id) sp.set("couponId", id);
      else sp.delete("couponId");
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const openCampaignDrawer = useCallback(
    (id: string | null) => {
      setDrawerCampaignId(id);
      const sp = new URLSearchParams(searchParams.toString());
      if (id) sp.set("campaignId", id);
      else sp.delete("campaignId");
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const tabs: Array<{ key: TabKey; label: string; icon: typeof Tag }> = [
    { key: "overview", label: t("tabs.overview"), icon: BarChart3 },
    { key: "codes", label: t("tabs.codes"), icon: Tag },
    { key: "campaigns", label: t("tabs.campaigns"), icon: Megaphone },
    { key: "course-sales", label: t("tabs.courseSales"), icon: Percent },
    { key: "early-bird", label: t("tabs.earlyBird"), icon: Clock },
  ];

  const inner = (
    <>
      {/* Page header — flex with no explicit row-reverse; dir="rtl"
                  on <html> already reverses children naturally. */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5 mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--color-primary)]/15 to-[var(--color-primary)]/5 flex items-center justify-center flex-shrink-0">
                    <Layers className="w-5 h-5 text-[var(--color-primary)]" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] leading-tight">
                      {t("title")}
                    </h1>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                      {t("subtitleV2")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tab strip — same: let dir="rtl" handle reverse */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-1 mb-5 overflow-x-auto">
                <div className="inline-flex items-center gap-0.5 min-w-full">
                  {tabs.map((tabItem) => {
                    const Icon = tabItem.icon;
                    const active = tab === tabItem.key;
                    return (
                      <button
                        key={tabItem.key}
                        type="button"
                        onClick={() => switchTab(tabItem.key)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap flex-1 justify-center ${
                          active
                            ? "bg-[var(--color-primary)] text-white shadow-sm"
                            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)]"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{tabItem.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tab body */}
              {tab === "overview" && (
                <DiscountOverviewTab
                  onOpenCoupon={openCouponDrawer}
                  onSwitchTab={(t) => switchTab(t as TabKey)}
                />
              )}
              {tab === "codes" && (
                <DiscountCodesTab onOpenCoupon={openCouponDrawer} refreshKey={refreshKey} />
              )}
              {tab === "campaigns" && (
                <CampaignsTabV2 onOpenCampaign={openCampaignDrawer} refreshKey={refreshKey} />
              )}
              {tab === "course-sales" && <CourseSalesTab />}
              {tab === "early-bird" && (
                <EarlyBirdTab onOpenCoupon={openCouponDrawer} refreshKey={refreshKey} />
              )}
    </>
  );

  return (
    <>
      {embedded ? inner : <FinancePageShell>{inner}</FinancePageShell>}
      <DiscountDetailDrawerV2
        discountId={drawerCouponId}
        onClose={() => openCouponDrawer(null)}
        onChanged={() => setRefreshKey((v) => v + 1)}
      />

      <CampaignDetailDrawer
        campaignId={drawerCampaignId}
        onClose={() => openCampaignDrawer(null)}
        onOpenCoupon={openCouponDrawer}
      />
    </>
  );
};

export default DiscountsContent;
