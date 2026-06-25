/**
 * Small helpers shared by the billing tabs. Pure functions, no React.
 */

export type BillingPaymentStatus =
  | "pending"
  | "processing"
  | "awaiting_approval"
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded"
  | "chargeback";

export type BillingRefundStatus =
  | "pending"
  | "approved"
  | "processing"
  | "completed"
  | "rejected"
  | "failed";

/** Tailwind class set per status — green/gold/red/grey palette matches the
 *  rest of the student dashboard. */
export function statusPillClasses(status: string): string {
  switch (status) {
    case "paid":
    case "completed":
    case "approved":
      return "bg-[#DCFCE7] text-[#16A34A]";
    case "pending":
    case "processing":
    case "awaiting_approval":
      return "bg-[#FEF3C7] text-[#B45309]";
    case "refunded":
    case "partially_refunded":
      return "bg-[#E5E7EB] text-[#374151]";
    case "failed":
    case "rejected":
    case "chargeback":
      return "bg-[#FEE2E2] text-[#DC2626]";
    default:
      return "bg-[#E5E7EB] text-[#6B7280]";
  }
}

/**
 * Format SAR amount with project convention: ALWAYS Latin digits — even in
 * Arabic locale (per project memory). We render the currency suffix
 * separately so RTL layouts can flip naturally.
 */
export function formatSar(amount: number | string | null | undefined): string {
  const n =
    typeof amount === "string"
      ? Number(amount)
      : typeof amount === "number"
        ? amount
        : 0;
  if (!Number.isFinite(n)) return "0.00";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * Human date — Latin digits, locale-aware month names. Uses `en-CA` for
 * en (yields ISO-style `2026-06-25`, easy to scan) and `en-GB` for ar
 * (yields `25/06/2026` — still Latin digits, familiar day-month order).
 */
export function formatDate(
  iso: string | null | undefined,
  locale: string,
): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(locale === "ar" ? "en-GB" : "en-CA");
  } catch {
    return "—";
  }
}

export function formatDateTime(
  iso: string | null | undefined,
  locale: string,
): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return `${d.toLocaleDateString(locale === "ar" ? "en-GB" : "en-CA")} ${d
      .toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })}`;
  } catch {
    return "—";
  }
}

/**
 * Translate a payment/refund status key safely. Falls back to `status.unknown`
 * (translated dash) when the backend returns a status we don't have a label
 * for (e.g. when the schema gains a new value before i18n catches up). Without
 * this guard, `t(`status.${unknown}`)` renders the raw key path to the user
 * (e.g. `studentDashboard.billing.status.abandoned`).
 */
const KNOWN_STATUS_KEYS = new Set([
  "pending",
  "processing",
  "awaiting_approval",
  "paid",
  "failed",
  "abandoned",
  "refunded",
  "partially_refunded",
  "chargeback",
  "approved",
  "completed",
  "rejected",
]);

export function statusLabel(
  raw: string | null | undefined,
  t: (key: string) => string,
): string {
  if (!raw) return t("status.unknown");
  return KNOWN_STATUS_KEYS.has(raw)
    ? t(`status.${raw}`)
    : t("status.unknown");
}

/** Pick the user-facing course title for the active locale, with EN fallback. */
export function pickCourseTitle(
  titleEn: string | null | undefined,
  titleAr: string | null | undefined,
  locale: string,
  emptyFallback = "—",
): string {
  if (locale === "ar" && titleAr) return titleAr;
  return titleEn || titleAr || emptyFallback;
}
