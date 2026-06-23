"use client";

import { Tag, Zap } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";

/**
 * Course-card / course-detail discount badge. Three variants:
 *   - `sale`        : course is on a finance-managed sale (red gradient pill,
 *                     percent off OR savings amount)
 *   - `earlyBird`   : there's an active auto-apply discount on this course
 *                     (yellow gradient pill — surfaced as "Early Bird")
 *   - `coupon`      : a broadcastable coupon code applies (subtle hint chip
 *                     with the code shown)
 *
 * Variants are designed to be visually distinct so users learn the
 * difference at a glance. All copy comes from the `discountBadge` i18n
 * namespace; colors are semantic (red = expiring, amber = early-bird,
 * indigo = code).
 */

export type DiscountBadgeVariant = "sale" | "earlyBird" | "coupon";

interface DiscountBadgeProps {
  variant: DiscountBadgeVariant;
  /** For sale + earlyBird — percent off if known. */
  percent?: number | null;
  /** For sale + earlyBird — absolute SAR savings (alternative to percent). */
  amountSaved?: number | null;
  /** For coupon — the code to display. */
  code?: string;
  /** For earlyBird — render a small countdown hint. */
  endsAt?: string | Date | null;
  /** Sizing — `sm` for in-card, `md` for course detail page. */
  size?: "sm" | "md";
  className?: string;
}

function formatRelativeTime(
  date: Date,
  locale: string,
  t: (k: string, v?: any) => string,
): string {
  const diffMs = date.getTime() - Date.now();
  if (diffMs <= 0) return "";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return t("campaignBanner.timeLeftMinutes", { minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("campaignBanner.timeLeftHours", { hours, minutes: minutes % 60 });
  const days = Math.floor(hours / 24);
  return t("campaignBanner.timeLeftDays", { days, hours: hours % 24 });
}

const DiscountBadge = ({
  variant,
  percent,
  amountSaved,
  code,
  endsAt,
  size = "sm",
  className = "",
}: DiscountBadgeProps) => {
  const t = useTranslations();
  const locale = useLocale();

  const sizeClass =
    size === "md"
      ? "text-xs px-2.5 py-1 gap-1.5"
      : "text-[10px] px-1.5 py-0.5 gap-1";

  const formatAmount = (n: number) =>
    n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  if (variant === "sale") {
    const label =
      percent && percent > 0
        ? t("discountBadge.salePercent", { percent })
        : amountSaved && amountSaved > 0
          ? t("discountBadge.saleAmount", { amount: formatAmount(amountSaved) })
          : t("discountBadge.limitedOffer");
    return (
      <span
        className={`inline-flex items-center font-bold text-white rounded-md ${sizeClass} bg-gradient-to-r from-rose-600 to-red-600 shadow-sm ${className}`}
      >
        <Tag className={size === "md" ? "w-3.5 h-3.5" : "w-2.5 h-2.5"} />
        {label}
      </span>
    );
  }

  if (variant === "earlyBird") {
    const label = t("discountBadge.earlyBird");
    const sub =
      amountSaved && amountSaved > 0
        ? t("discountBadge.earlyBirdSavings", {
            amount: formatAmount(amountSaved),
          })
        : null;
    const countdown =
      endsAt
        ? formatRelativeTime(
            typeof endsAt === "string" ? new Date(endsAt) : endsAt,
            locale,
            t,
          )
        : "";
    return (
      <span
        className={`inline-flex items-center font-semibold rounded-md ${sizeClass} bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm animate-pulse-soft ${className}`}
        title={countdown ? t("discountBadge.earlyBirdEndsIn", { when: countdown }) : undefined}
      >
        <Zap
          className={size === "md" ? "w-3.5 h-3.5" : "w-2.5 h-2.5"}
          fill="currentColor"
        />
        {label}
        {sub && size === "md" && (
          <span className="font-normal opacity-90 ms-1">· {sub}</span>
        )}
      </span>
    );
  }

  // coupon hint
  const label = code
    ? t("discountBadge.couponHint", { code })
    : t("discountBadge.limitedOffer");
  return (
    <span
      className={`inline-flex items-center font-medium rounded-md ${sizeClass} bg-indigo-50 text-indigo-700 border border-indigo-200 ${className}`}
    >
      <Tag className={size === "md" ? "w-3.5 h-3.5" : "w-2.5 h-2.5"} />
      {label}
    </span>
  );
};

export default DiscountBadge;
