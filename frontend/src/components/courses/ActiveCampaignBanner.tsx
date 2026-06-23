"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Megaphone, X } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { discountApi } from "@/lib/api";

/**
 * Site-wide promo strip rendered at the top of the courses list / detail
 * pages when finance has marked an active campaign with `showOnSite=true`.
 * Auto-dismissible (session-only, no persistent cookie); hides itself if
 * no active banner campaign exists.
 *
 * Visual: brand-gold strip (matches the rest of the platform). A leading
 * "PROMOTION" pill makes the banner's purpose unambiguous so users don't
 * confuse it with a system / error notification.
 *
 * CTA logic: the "Browse Courses" link is suppressed when the user is
 * already on /courses (would be a no-op), and only rendered on other
 * pages where the link is genuinely useful.
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
  const pathname = usePathname();
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

  // Suppress the CTA on the courses index — the link would be a no-op
  // and clutters the strip. Detail pages, homepage etc. still get it.
  const onCoursesIndex =
    pathname === `/${locale}/courses` || pathname === "/courses";

  return (
    <div className="w-full bg-[var(--color-primary)] text-white">
      <div className="max-w-[1600px] mx-auto flex items-center gap-3 px-4 lg:px-6 py-2.5">
        <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded bg-white/20">
          <Megaphone className="w-3 h-3" />
          {t("campaignBanner.tag")}
        </span>
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
        {!onCoursesIndex && (
          <Link
            href={`/${locale}/courses`}
            className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1 text-[12px] font-semibold bg-white/20 hover:bg-white/30 rounded-md transition-colors"
          >
            {campaign.bannerCta || t("campaignBanner.cta")}
          </Link>
        )}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={t("campaignBanner.dismiss")}
          className="flex-shrink-0 p-1 rounded-md hover:bg-white/20 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default ActiveCampaignBanner;
