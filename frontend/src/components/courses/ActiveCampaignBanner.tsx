"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { discountApi } from "@/lib/api";

/**
 * Site-wide promo strip rendered at the top of the courses list / detail
 * pages when finance has marked an active campaign with `showOnSite=true`.
 * Auto-dismissible (session-only, no persistent cookie); hides itself if
 * no active banner campaign exists.
 *
 * Keeps DOM weight low — single fetch on mount, no polling. Banner copy
 * comes from the campaign row (name + description + CTA) so finance can
 * iterate without a code change.
 */

type Campaign = NonNullable<
  Awaited<ReturnType<typeof discountApi.getActiveBannerCampaign>>
>;

function formatRemaining(
  endsAt: string,
  t: (k: string, v?: any) => string,
): string {
  const diffMs = new Date(endsAt).getTime() - Date.now();
  if (diffMs <= 0) return "";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return t("campaignBanner.timeLeftMinutes", { minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return t("campaignBanner.timeLeftHours", {
      hours,
      minutes: minutes % 60,
    });
  }
  const days = Math.floor(hours / 24);
  return t("campaignBanner.timeLeftDays", { days, hours: hours % 24 });
}

const ActiveCampaignBanner = () => {
  const t = useTranslations();
  const locale = useLocale();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await discountApi.getActiveBannerCampaign();
        if (!cancelled) setCampaign(res || null);
      } catch {
        if (!cancelled) setCampaign(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (dismissed || !campaign) return null;

  const remaining = campaign.endsAt ? formatRemaining(campaign.endsAt, t) : "";

  return (
    <div className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white">
      <div className="max-w-[1600px] mx-auto flex items-center gap-3 px-4 lg:px-6 py-2.5">
        <Sparkles className="w-4 h-4 flex-shrink-0" />
        <div className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-semibold text-sm">{campaign.name}</span>
          {campaign.description && (
            <span className="text-[12px] opacity-90 truncate">
              {campaign.description}
            </span>
          )}
          {remaining && (
            <span className="text-[11px] opacity-90 whitespace-nowrap">
              · {t("campaignBanner.endsIn", { when: remaining })}
            </span>
          )}
        </div>
        <Link
          href={`/${locale}/courses`}
          className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1 text-[12px] font-semibold bg-white/15 hover:bg-white/25 rounded-md transition-colors"
        >
          {campaign.bannerCta || t("campaignBanner.cta")}
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={t("campaignBanner.dismiss")}
          className="flex-shrink-0 p-1 rounded-md hover:bg-white/15 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default ActiveCampaignBanner;
