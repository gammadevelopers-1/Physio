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

/**
 * Combined payment + refund status resolver.
 *
 * The bug this replaces: the payment card used to render its chip straight
 * from `payment.status`. But when a student submits a refund, the backend
 * writes a new `refunds` row with `status = "pending"` and deliberately
 * DOES NOT flip `payments.status` until the refund reaches `completed`
 * (see refund.service.ts:465 vs :1118). So the chip stayed on "Paid" even
 * after a request landed, and separately the UI in some places was
 * inferring "Refunded" from the mere presence of a refund row — labeling
 * a pending request as fully refunded.
 *
 * Correct behavior: if there's an attached refund, its status wins the
 * label as long as it hasn't completed. A completed refund also collapses
 * back to the payment status (which the backend will have flipped to
 * `refunded` / `partially_refunded` inside the completion transaction).
 *
 * `refunds` is expected sorted DESC by createdAt — the API returns it
 * that way — so index 0 is the latest.
 */
export type PaymentStatusChip = {
  labelKey: string;
  pillKey: string;
};

export function resolvePaymentStatusChip(
  paymentStatus: string,
  refunds?: Array<{ status: string; createdAt?: string }> | null,
): PaymentStatusChip {
  const latest = refunds && refunds.length > 0 ? refunds[0] : null;
  if (latest) {
    switch (latest.status) {
      case "pending":
        return { labelKey: "refund.status.pending", pillKey: "processing" };
      case "approved":
        return { labelKey: "refund.status.approved", pillKey: "approved" };
      case "processing":
        return { labelKey: "refund.status.processing", pillKey: "processing" };
      case "rejected":
        return { labelKey: "refund.status.rejected", pillKey: "rejected" };
      case "failed":
        return { labelKey: "refund.status.failed", pillKey: "failed" };
      // "completed" falls through: the payment status will already have
      // been flipped to refunded / partially_refunded by the completion
      // transaction, so we defer to payment status for the definitive
      // label instead of double-labelling.
    }
  }
  return { labelKey: `status.${paymentStatus}`, pillKey: paymentStatus };
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
