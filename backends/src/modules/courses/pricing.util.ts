/**
 * Single source of truth for course pricing with an optional course-level sale.
 *
 * `price` is the canonical original price and is never mutated. The effective
 * (charged/displayed) price is derived here so the backend charge and every UI
 * surface agree. Used by checkout, the coupon-preview endpoint, the free-enroll
 * guard, and all catalog/detail projections.
 *
 * A course sale can be EITHER a percentage (`salePercent` 1..100) OR a fixed
 * SAR amount (`saleAmount` > 0, ≤ original price). At most one is set — a DB
 * CHECK constraint enforces this. When both fields are somehow present the
 * fixed amount wins (safer floor: capped at price so the resulting effective
 * price can never go negative).
 */
export interface SaleInfo {
  /** Canonical original price, rounded to 2dp. */
  originalPrice: number;
  /** Price actually charged/displayed (sale price when a sale is active). */
  effectivePrice: number;
  /** True when an active sale applies (within window, valid discount, price > 0). */
  onSale: boolean;
  /** The active sale percent (1..100), or null when not on sale or when the
   * sale is a fixed-amount discount. */
  salePercent: number | null;
  /** The active fixed-amount discount in SAR, or null when not on sale or when
   * the sale is a percentage discount. */
  saleAmount: number | null;
  /** Per-course finance toggle: may a coupon stack on top of this active sale? */
  saleAllowsCoupon: boolean;
}

export interface SalePriceable {
  price: string | number | null;
  salePercent?: number | null;
  saleAmount?: string | number | null;
  saleStartsAt?: Date | string | null;
  saleEndsAt?: Date | string | null;
  saleAllowsCoupon?: boolean | null;
}

/**
 * Compute the effective price for a course at a given time. A sale is active
 * only when the original price is > 0, `now` is within [saleStartsAt,
 * saleEndsAt) (null bounds = open), and either percent 1..100 is set OR a
 * positive fixed amount ≤ price is set. A 100% sale (or amount = price)
 * yields an effective price of 0 (free).
 */
export function getEffectivePrice(
  course: SalePriceable,
  now: Date = new Date(),
): SaleInfo {
  const originalPrice = Math.round(Number(course.price || 0) * 100) / 100;
  const rawAmount =
    course.saleAmount != null ? Number(course.saleAmount) : null;
  const saleAmount =
    rawAmount != null && Number.isFinite(rawAmount) && rawAmount > 0
      ? Math.round(rawAmount * 100) / 100
      : null;
  const pct =
    course.salePercent != null && course.salePercent >= 1 && course.salePercent <= 100
      ? course.salePercent
      : null;

  const inWindow =
    originalPrice > 0 &&
    (saleAmount != null || pct != null) &&
    (!course.saleStartsAt || now >= new Date(course.saleStartsAt)) &&
    (!course.saleEndsAt || now < new Date(course.saleEndsAt));

  if (!inWindow) {
    return {
      originalPrice,
      effectivePrice: originalPrice,
      onSale: false,
      salePercent: null,
      saleAmount: null,
      saleAllowsCoupon: false,
    };
  }

  // Fixed amount wins if both are somehow set (shouldn't happen — DB CHECK).
  // Cap at originalPrice to guarantee effectivePrice ≥ 0 even if a stale row
  // slips through past validation.
  let effectivePrice: number;
  let outPct: number | null = null;
  let outAmount: number | null = null;
  if (saleAmount != null) {
    const cappedAmount = Math.min(saleAmount, originalPrice);
    effectivePrice = Math.round((originalPrice - cappedAmount) * 100) / 100;
    outAmount = cappedAmount;
  } else {
    // Round the sale price to 2dp ONCE here so the identical value flows into
    // the VAT base, the coupon base, payment metadata, the invoice, and
    // amountSaved.
    effectivePrice = Math.round((originalPrice * (100 - pct!)) / 100 * 100) / 100;
    outPct = pct;
  }

  return {
    originalPrice,
    effectivePrice,
    onSale: true,
    salePercent: outPct,
    saleAmount: outAmount,
    saleAllowsCoupon: !!course.saleAllowsCoupon,
  };
}
