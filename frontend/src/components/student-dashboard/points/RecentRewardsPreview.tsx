"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  BookOpen,
  Gift,
  Loader2,
  Package,
  Radio,
  Ticket,
} from "lucide-react";
import {
  pointsApi,
  type RewardHistoryRow,
  type RewardHistoryEnvelopeType,
} from "@/lib/api";

/** Localised relative-time formatter with graceful fallback for small deltas. */
function relativeTime(iso: string, locale: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((then - now) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(diffSec), "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 2592000) return rtf.format(Math.round(diffSec / 86400), "day");
  if (abs < 31536000) return rtf.format(Math.round(diffSec / 2592000), "month");
  return rtf.format(Math.round(diffSec / 31536000), "year");
}

/**
 * Reads the projection status from a reward-history row. The envelope
 * doesn't carry a canonical status — each projection kind stores it in
 * its own shape (coupons: unused|used|expired; other: pending|fulfilled|
 * failed|reversed; courses/webinars: derived). This function normalises
 * them into a single tag so the mini-card status chip logic stays flat.
 */
function projectionStatus(row: RewardHistoryRow):
  | "unused"
  | "fulfilled"
  | "pending"
  | "expired"
  | "reversed"
  | "failed" {
  const p = row.projection;
  if (p.kind === "coupon") {
    if (p.status === "unused") return "unused";
    if (p.status === "expired") return "expired";
    return "fulfilled";
  }
  if (p.kind === "free_course") {
    return p.enrollmentId ? "fulfilled" : "pending";
  }
  if (p.kind === "free_webinar") {
    const startsAt = p.sessionStartAt ? new Date(p.sessionStartAt).getTime() : null;
    if (startsAt && startsAt < Date.now() - 2 * 60 * 60 * 1000) return "fulfilled";
    return "unused";
  }
  if (p.kind === "course_purchase") {
    // Same collapsing rule as free_course: enrollment link = fulfilled;
    // completed / dropped map to fulfilled / reversed respectively so the
    // preview chip reads sensibly. No enrollment (edge case) → pending.
    if (p.enrollmentStatus === "dropped") return "reversed";
    if (p.enrollmentStatus === "expired") return "expired";
    return p.enrollmentId ? "fulfilled" : "pending";
  }
  // other
  return p.status;
}

const iconForType = (type: RewardHistoryEnvelopeType) => {
  switch (type) {
    case "discount_coupon":
    case "fixed_discount_coupon":
      return Ticket;
    case "free_course":
    case "course_purchase":
      return BookOpen;
    case "free_webinar":
      return Radio;
    default:
      return Package;
  }
};

/** Tailwind chip classes per status. Amber for pending, greens for good,
 *  reds/greys for terminal negatives — matches the tone MyRewardsContent uses. */
const statusChipClass: Record<string, string> = {
  unused: "bg-emerald-50 text-emerald-700",
  fulfilled: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  expired: "bg-gray-100 text-gray-600",
  reversed: "bg-gray-100 text-gray-600",
  failed: "bg-red-50 text-red-700",
};

/**
 * Small preview strip of the 3 most-recent reward redemptions. Links to
 * the full My Rewards page for anything older. Serves as a soft push
 * toward the redeem section when the user has never redeemed anything.
 */
export default function RecentRewardsPreview() {
  const locale = useLocale();
  const t = useTranslations("studentDashboard.myPoints.recentRewards");
  const isRTL = locale === "ar";

  const [rows, setRows] = useState<RewardHistoryRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const page = await pointsApi.getMyRewardHistory({ limit: 3 });
        if (!cancelled) setRows(page.items);
      } catch (err) {
        console.error("Failed to load recent rewards", err);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const list = rows ?? [];
  const viewAllHref = `/${locale}/dashboard/student/my-rewards`;

  return (
    <section
      aria-labelledby="recent-rewards-heading"
      className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-4 sm:p-6"
    >
      <header className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
            <Gift className="w-5 h-5 text-violet-600" strokeWidth={2} />
          </div>
          <h2
            id="recent-rewards-heading"
            className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]"
          >
            {t("title")}
          </h2>
        </div>
        {list.length > 0 && (
          <Link
            href={viewAllHref}
            className="text-xs font-medium text-violet-600 hover:underline inline-flex items-center gap-1 shrink-0"
          >
            {t("viewAllLink")}
            <span aria-hidden>{isRTL ? "←" : "→"}</span>
          </Link>
        )}
      </header>
      <p className="text-sm text-[var(--color-text-secondary)] mb-4 ms-11">
        {t("subtitle")}
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-secondary)]" />
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Gift className="w-8 h-8 text-[var(--color-text-secondary)] opacity-60 mb-2" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("emptyState")}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 md:flex-row md:gap-4">
          {list.map((row) => {
            const Icon = iconForType(row.rewardType);
            const status = projectionStatus(row);
            const name = isRTL && row.rewardNameAr ? row.rewardNameAr : row.rewardName;
            return (
              <article
                key={row.redemptionId}
                className="flex-1 flex items-start gap-3 bg-white rounded-2xl border border-[var(--color-border)] p-4 shadow-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-50 to-indigo-50 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-violet-600" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {name}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusChipClass[status] ?? statusChipClass.pending}`}
                    >
                      {t(`statusLabel.${status}`)}
                    </span>
                    <span className="text-[11px] text-[var(--color-text-secondary)]">
                      {relativeTime(row.redeemedAt, locale)}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
