"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  Award,
  BookOpen,
  Loader2,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { pointsApi, type ActiveRule } from "@/lib/api";

/**
 * Map from a rule-key / event to a lucide icon + tailwind color pair.
 * Used to give each earn card a distinct visual signal without the admin
 * having to pick an icon in the CMS. Falls back to a Sparkles glyph for
 * anything unknown so a newly-added rule still renders sensibly.
 */
const eventVisuals: Record<
  string,
  { Icon: typeof Sparkles; bg: string; fg: string; labelKey: string }
> = {
  invite_friend: {
    Icon: Users,
    bg: "bg-blue-50",
    fg: "text-blue-600",
    labelKey: "invite_friend",
  },
  enroll: {
    Icon: BookOpen,
    bg: "bg-emerald-50",
    fg: "text-emerald-600",
    labelKey: "enroll",
  },
  course_completed: {
    Icon: Award,
    bg: "bg-amber-50",
    fg: "text-amber-600",
    labelKey: "complete_course",
  },
  complete_course: {
    Icon: Award,
    bg: "bg-amber-50",
    fg: "text-amber-600",
    labelKey: "complete_course",
  },
  review_approved: {
    Icon: Star,
    bg: "bg-yellow-50",
    fg: "text-yellow-600",
    labelKey: "review",
  },
  review: {
    Icon: Star,
    bg: "bg-yellow-50",
    fg: "text-yellow-600",
    labelKey: "review",
  },
  signup: {
    Icon: Sparkles,
    bg: "bg-violet-50",
    fg: "text-violet-600",
    labelKey: "other",
  },
  daily_login: {
    Icon: TrendingUp,
    bg: "bg-sky-50",
    fg: "text-sky-600",
    labelKey: "daily_login",
  },
};

interface WaysToEarnGridProps {
  invitePageHref: string;
}

/**
 * Displays currently-active earn rules as a responsive card grid. Icons
 * are picked from a static map keyed by `rule.ruleKey`. Rule name +
 * point value come straight from the /points/me/rules endpoint so admin
 * edits reflect on the next mount without extra plumbing.
 */
export default function WaysToEarnGrid({ invitePageHref }: WaysToEarnGridProps) {
  const locale = useLocale();
  const t = useTranslations("studentDashboard.myPoints.waysToEarn");
  const isRTL = locale === "ar";

  const [rules, setRules] = useState<ActiveRule[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await pointsApi.getEarnRules();
        if (!cancelled) setRules(rows);
      } catch (err) {
        console.error("Failed to load earn rules", err);
        if (!cancelled) setRules([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const active = useMemo(
    () => (rules ?? []).filter((r) => r.pointsAmount > 0),
    [rules],
  );

  return (
    <section
      id="ways-to-earn"
      aria-labelledby="ways-to-earn-heading"
      className="scroll-mt-24 bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-4 sm:p-6"
    >
      <header className="flex items-center gap-2 mb-1">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-violet-600" strokeWidth={2} />
        </div>
        <h2
          id="ways-to-earn-heading"
          className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]"
        >
          {t("title")}
        </h2>
      </header>
      <p className="text-sm text-[var(--color-text-secondary)] mb-4 ms-11">
        {t("subtitle")}
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-secondary)]" />
        </div>
      ) : active.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <TrendingUp className="w-8 h-8 text-[var(--color-text-secondary)] opacity-60 mb-2" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("emptyState")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {active.map((rule) => (
            <EarnRuleCard
              key={rule.ruleKey}
              rule={rule}
              isRTL={isRTL}
              invitePageHref={invitePageHref}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface EarnRuleCardProps {
  rule: ActiveRule;
  isRTL: boolean;
  invitePageHref: string;
}

function EarnRuleCard({ rule, isRTL, invitePageHref }: EarnRuleCardProps) {
  const t = useTranslations("studentDashboard.myPoints.waysToEarn");
  const visuals =
    eventVisuals[rule.ruleKey] ?? {
      Icon: Sparkles,
      bg: "bg-violet-50",
      fg: "text-violet-600",
      labelKey: "other",
    };
  const { Icon, bg, fg } = visuals;
  const description = (isRTL ? rule.descriptionAr : rule.description) ?? "";
  // If the admin hasn't set a description, fall back to the generic
  // event label from i18n so the card still communicates purpose.
  const title = description || t(`eventLabel.${visuals.labelKey}`);
  const isInvite = rule.ruleKey === "invite_friend";

  return (
    <article className="flex flex-col bg-white rounded-2xl p-5 border border-[var(--color-border)] shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center ${bg}`}
        >
          <Icon className={`w-5 h-5 ${fg}`} strokeWidth={2} />
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700">
          {t("pointsPill", { count: rule.pointsAmount })}
        </span>
      </div>

      <h3 className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">
        {title}
      </h3>
      {description && description !== title && (
        <p className="mt-1 text-xs text-[var(--color-text-secondary)] line-clamp-3">
          {description}
        </p>
      )}

      {isInvite && (
        <Link
          href={invitePageHref}
          className="mt-4 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium transition-colors"
        >
          {t("inviteFriendCta")}
        </Link>
      )}
    </article>
  );
}
