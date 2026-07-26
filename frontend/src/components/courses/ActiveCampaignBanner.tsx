"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Megaphone, X } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { discountApi } from "@/lib/api";

/**
 * Site-wide promo strip. Fetches every active `showOnSite=true` campaign
 * and rotates through them every 2s.
 *
 *   • Auto-advances every ROTATE_MS (paused while the pointer is over
 *     the strip so users can actually read it).
 *   • ChevronLeft / ChevronRight arrows step through manually and also
 *     freeze the auto-rotate — once you take control, we don't yank you
 *     back to the next slide half a second later.
 *   • Pager dots (1/N) at the end for quick visual position.
 *   • Auto-dismissible for the session; hides if no active banners.
 *
 * The CTA link is suppressed on /courses (would be a no-op there).
 */

type Campaign = {
  id: string;
  name: string;
  nameAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  startsAt: string | null;
  endsAt: string | null;
  bannerCta: string | null;
  bannerCtaAr: string | null;
  scope: 'code_only' | 'all_paid' | 'by_delivery_type' | 'specific_courses';
  scopeCourseIds: string[];
};

const ROTATE_MS = 2000;

function formatRemaining(
  endsAt: string,
  t: (k: string, v?: Record<string, string | number>) => string,
): string {
  const diffMs = new Date(endsAt).getTime() - Date.now();
  if (diffMs <= 0) return "";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return t("campaignBanner.timeLeftMinutes", { minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return t("campaignBanner.timeLeftHours", { hours, minutes: minutes % 60 });
  }
  const days = Math.floor(hours / 24);
  return t("campaignBanner.timeLeftDays", { days, hours: hours % 24 });
}

const ActiveCampaignBanner = () => {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Once the user clicks an arrow, we freeze auto-rotate to respect
  // intent. Refocus/reload clears it (fresh component instance).
  const [userTook, setUserTook] = useState(false);

  // Refetch on mount + on window focus so a finance manager
  // hiding/deleting a campaign in another tab is reflected without a
  // full reload.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await discountApi.getActiveBannerCampaigns();
        if (cancelled) return;
        const list = (res?.campaigns ?? []).filter((c) => !!c?.id);
        setCampaigns(list);
        // Keep the current slide valid if the list shrinks.
        setIndex((i) => (list.length > 0 ? Math.min(i, list.length - 1) : 0));
      } catch {
        if (!cancelled) setCampaigns([]);
      }
    };
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // Auto-rotate. Ticks only when: >1 campaign, not paused, user hasn't
  // taken manual control, and not dismissed.
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (dismissed || campaigns.length < 2 || paused || userTook) return;
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % campaigns.length);
    }, ROTATE_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [dismissed, campaigns.length, paused, userTook]);

  const current = campaigns[index];

  // Locale-aware fields. Arabic display falls back to the English text
  // when the translation is missing so nothing renders as an empty gap.
  const isRTL = locale === "ar";
  const displayName = isRTL ? (current?.nameAr || current?.name) : current?.name;
  const displayDescription = isRTL
    ? (current?.descriptionAr || current?.description)
    : current?.description;

  const remaining = useMemo(
    () => (current?.endsAt ? formatRemaining(current.endsAt, t) : ""),
    [current?.endsAt, t],
  );

  if (dismissed || !current) return null;

  // Hide the CTA button on any /courses page (index or detail) — the user
  // is already inside the courses UX there, so a "Browse courses" button
  // is noise and a "View course" button to the current course is a no-op.
  const onCoursesArea =
    pathname === `/${locale}/courses` ||
    pathname === "/courses" ||
    pathname.startsWith(`/${locale}/courses/`) ||
    pathname.startsWith("/courses/");

  // When the banner is scoped to exactly one course, route the CTA to
  // that course's detail page instead of the /courses catalog. Any other
  // scope (all_paid, by_delivery_type, specific_courses with >1 course,
  // code_only) keeps the catalog fallback.
  const singleCourseTarget =
    current?.scope === "specific_courses" && current.scopeCourseIds.length === 1
      ? current.scopeCourseIds[0]
      : null;
  const ctaHref = singleCourseTarget
    ? `/${locale}/courses/${singleCourseTarget}`
    : `/${locale}/courses`;
  const ctaLabel =
    (isRTL ? current?.bannerCtaAr : current?.bannerCta) ||
    current?.bannerCta ||
    t(singleCourseTarget ? "campaignBanner.ctaSingleCourse" : "campaignBanner.cta");

  const multi = campaigns.length > 1;

  // In RTL, the "previous" arrow should point right and "next" left
  // (reading direction reversed). We swap the icons instead of relying
  // on transforms so the visual arrow direction always matches the
  // action.
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;

  const go = (delta: number) => {
    setUserTook(true);
    setIndex((i) => {
      const next = (i + delta + campaigns.length) % campaigns.length;
      return next;
    });
  };

  return (
    <div
      className="w-full bg-[var(--color-primary)] text-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      // Keyboard-focus users also get pause so screen-reader / keyboard
      // navigation doesn't get yanked out from under them.
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="max-w-[1600px] mx-auto flex items-center gap-2 px-2 sm:px-4 lg:px-6 py-2.5">
        <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded bg-white/20">
          <Megaphone className="w-3 h-3" />
          {t("campaignBanner.tag")}
        </span>

        {multi && (
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label={t("campaignBanner.prev")}
            className="flex-shrink-0 p-1 rounded-md hover:bg-white/20 transition-colors"
          >
            <PrevIcon className="w-4 h-4" />
          </button>
        )}

        {/* Slide content — key by id so the transition resets cleanly
            when we swap campaigns. */}
        <div
          key={current.id}
          className="flex-1 min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 animate-[fadeIn_200ms_ease-out]"
        >
          <span className="font-semibold text-sm truncate">{displayName}</span>
          {displayDescription && (
            <span className="text-[12px] opacity-90 truncate">
              {displayDescription}
            </span>
          )}
          {remaining && (
            <span className="text-[11px] opacity-90 whitespace-nowrap">
              · {t("campaignBanner.endsIn", { when: remaining })}
            </span>
          )}
        </div>

        {multi && (
          <button
            type="button"
            onClick={() => go(1)}
            aria-label={t("campaignBanner.next")}
            className="flex-shrink-0 p-1 rounded-md hover:bg-white/20 transition-colors"
          >
            <NextIcon className="w-4 h-4" />
          </button>
        )}

        {multi && (
          <span className="flex-shrink-0 text-[10px] tabular-nums opacity-80 px-1">
            {index + 1}/{campaigns.length}
          </span>
        )}

        {!onCoursesArea && (
          <Link
            href={ctaHref}
            className="hidden sm:inline-flex flex-shrink-0 items-center gap-1 px-3 py-1 text-[12px] font-semibold bg-white/20 hover:bg-white/30 rounded-md transition-colors"
          >
            {ctaLabel}
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
      {/* Local keyframe for the slide fade-in. Kept inline so the
          animation ships with the component and doesn't need a global
          entry in tailwind config. */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-2px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default ActiveCampaignBanner;
