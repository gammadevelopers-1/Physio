"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Clock, Loader2, Minus } from "lucide-react";
import { pointsApi, type PointsTransaction } from "@/lib/api";
import { POINT_REASON_I18N_KEYS } from "@/lib/pointsReasonLabels";

/** Localised relative-time formatter shared across the points/ subtree. */
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
 * Legacy reason → local eventLabel key map. Preserved for the eventLabel
 * subtree already ship-shape'd for `studentDashboard.myPoints.recentActivity`
 * — reused as the primary source of truth. New reason codes should be added
 * to `POINT_REASON_I18N_KEYS` (see `lib/pointsReasonLabels.ts`) instead;
 * this map's `admin:deduct` and `system:expire` slots are filled from that
 * shared source below.
 */
function reasonLabelKey(reason: string): string {
  const direct: Record<string, string> = {
    "earn:signup": "earn:manual_grant",
    "earn:course_completed": "earn:complete",
    "earn:review_approved": "earn:review",
    "earn:invite": "earn:invite",
    "earn:enroll": "earn:enroll",
    "earn:complete": "earn:complete",
    "earn:review": "earn:review",
    "earn:manual_grant": "earn:manual_grant",
    "admin:grant": "earn:manual_grant",
    "admin:deduct": "admin:deduct",
    "redeem:hold": "redeem:hold",
    "redeem:committed": "redeem:committed",
    "redeem:released": "redeem:released",
    "redeem:course:committed": "redeem:course:committed",
    "reverse:refund": "redeem:released",
    "reverse:course_cancelled": "reverse:course_cancelled",
    "system:expire": "system:expire",
  };
  return direct[reason] ?? "other";
}

/**
 * Whether the eventLabel subtree already covers this reason code. If not,
 * we render the shared `POINT_REASON_I18N_KEYS` label instead — that map is
 * the canonical source of truth for admin-scoped reason names (used by the
 * admin User History tab).
 */
function hasLocalEventLabel(reason: string): boolean {
  return reasonLabelKey(reason) !== "other";
}

/**
 * Last 8 raw ledger transactions rendered as a list — one row per event
 * with a coloured direction icon, description, timestamp, and delta.
 * Prefers admin-authored rule descriptions when present so the copy
 * matches what admins configured in the CMS.
 */
export default function RecentActivityList() {
  const locale = useLocale();
  const t = useTranslations("studentDashboard.myPoints.recentActivity");
  const tReasons = useTranslations(
    "adminDashboard.points.userHistory.reasons",
  );
  const isRTL = locale === "ar";

  const [items, setItems] = useState<PointsTransaction[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await pointsApi.getTransactions({ page: 1, limit: 8 });
        if (!cancelled) setItems(res.data);
      } catch (err) {
        console.error("Failed to load recent activity", err);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = items ?? [];

  return (
    <section
      aria-labelledby="recent-activity-heading"
      className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-4 sm:p-6"
    >
      <header className="flex items-center gap-2 mb-1">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
          <Clock className="w-5 h-5 text-violet-600" strokeWidth={2} />
        </div>
        <h2
          id="recent-activity-heading"
          className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]"
        >
          {t("title")}
        </h2>
      </header>
      <p className="text-sm text-[var(--color-text-secondary)] mb-4 ms-11">
        {t("subtitle")}
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-secondary)]" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Clock className="w-8 h-8 text-[var(--color-text-secondary)] opacity-60 mb-2" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("emptyState")}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border-subtle)]/60">
          {rows.map((tx) => {
            const isPositive = tx.delta > 0;
            const isNegative = tx.delta < 0;
            // Prefer admin-authored rule description in the current locale
            // over the generic event label — it's usually more specific.
            const adminDesc =
              (isRTL && tx.ruleDescriptionAr) || tx.ruleDescription;
            // Resolution order: rule description (admin-authored) →
            // eventLabel subtree entry (localised) → shared reason-map key
            // (canonical admin copy) → raw reason string.
            let description: string;
            if (adminDesc) {
              description = adminDesc;
            } else if (hasLocalEventLabel(tx.reason)) {
              description = t(`eventLabel.${reasonLabelKey(tx.reason)}`);
            } else {
              const sharedKey = POINT_REASON_I18N_KEYS[tx.reason];
              description = sharedKey
                ? tReasons(
                    sharedKey as
                      | "adminGrant"
                      | "adminDeduct"
                      | "earnSignup",
                  )
                : tx.reason;
            }

            const DirectionIcon = isPositive
              ? ArrowUp
              : isNegative
                ? ArrowDown
                : Minus;
            const badgeClass = isPositive
              ? "bg-emerald-50 text-emerald-600"
              : isNegative
                ? "bg-red-50 text-red-600"
                : "bg-gray-100 text-gray-500";
            const deltaClass = isPositive
              ? "text-emerald-600"
              : isNegative
                ? "text-red-600"
                : "text-gray-400";

            return (
              <li
                key={tx.id}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${badgeClass}`}
                >
                  <DirectionIcon className="w-4 h-4" strokeWidth={2.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {description}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                    {relativeTime(tx.createdAt, locale)}
                  </p>
                </div>
                <div
                  className={`text-sm font-semibold tabular-nums flex-shrink-0 ${deltaClass}`}
                  dir="ltr"
                >
                  {tx.delta === 0
                    ? "—"
                    : `${isPositive ? "+" : ""}${tx.delta.toLocaleString(locale)} pts`}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
