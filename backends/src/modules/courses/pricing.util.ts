/**
 * Single source of truth for course pricing with an optional course-level sale.
 *
 * `price` is the canonical original price and is never mutated. The effective
 * (charged/displayed) price is derived here so the backend charge and every UI
 * surface agree. Used by checkout, the coupon-preview endpoint, the free-enroll
 * guard, and all catalog/detail projections.
 */
export interface SaleInfo {
  /** Canonical original price, rounded to 2dp. */
  originalPrice: number;
  /** Price actually charged/displayed (sale price when a sale is active). */
  effectivePrice: number;
  /** True when an active sale applies (within window, percent 1..100, price > 0). */
  onSale: boolean;
  /** The active sale percent (1..100), or null when not on sale. */
  salePercent: number | null;
  /** Per-course finance toggle: may a coupon stack on top of this active sale? */
  saleAllowsCoupon: boolean;
}

export interface SalePriceable {
  price: string | number | null;
  salePercent?: number | null;
  saleStartsAt?: Date | string | null;
  saleEndsAt?: Date | string | null;
  saleAllowsCoupon?: boolean | null;
}

/**
 * Compute the effective price for a course at a given time.
 * A sale is active only when: percent is 1..100, the original price is > 0, and
 * `now` is within [saleStartsAt, saleEndsAt) (null bounds = open). A 100% sale
 * yields an effective price of 0 (free).
 */
export function getEffectivePrice(
  course: SalePriceable,
  now: Date = new Date(),
): SaleInfo {
  const originalPrice = Math.round(Number(course.price || 0) * 100) / 100;
  const pct = course.salePercent;

  const inWindow =
    pct != null &&
    pct >= 1 &&
    pct <= 100 &&
    originalPrice > 0 &&
    (!course.saleStartsAt || now >= new Date(course.saleStartsAt)) &&
    (!course.saleEndsAt || now < new Date(course.saleEndsAt));

  if (!inWindow) {
    return {
      originalPrice,
      effectivePrice: originalPrice,
      onSale: false,
      salePercent: null,
      saleAllowsCoupon: false,
    };
  }

  // Round the sale price to 2dp ONCE here so the identical value flows into the
  // VAT base, the coupon base, payment metadata, the invoice, and amountSaved.
  const effectivePrice = Math.round((originalPrice * (100 - pct)) / 100 * 100) / 100;

  return {
    originalPrice,
    effectivePrice,
    onSale: true,
    salePercent: pct,
    saleAllowsCoupon: !!course.saleAllowsCoupon,
  };
}
