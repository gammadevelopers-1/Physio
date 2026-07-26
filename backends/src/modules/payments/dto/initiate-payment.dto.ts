import {
  IsUUID,
  IsIn,
  IsOptional,
  IsString,
  IsArray,
  IsBoolean,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

export class InitiatePaymentDto {
  // Multi-course cart: one payment, many line items. Sent as an array even
  // for a single-course express purchase so the backend has a single shape
  // to validate.
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  courseIds: string[];

  @IsIn(['moyasar', 'tamara', 'tabby', 'bank_transfer', 'mock'])
  gateway: string;

  @IsIn(['card', 'mada', 'apple_pay', 'bnpl', 'bank_transfer'])
  paymentMethod: string;

  /**
   * REAL coupon code the buyer typed (or an auto-applied code-based
   * early-bird whose backing `discount_codes` row exists). NEVER a
   * synthetic `CAMPAIGN:xxx` sentinel — direct-campaign discounts flow
   * through `applyActiveCampaign` below, not through this field.
   */
  @IsOptional()
  @IsString()
  discountCode?: string;

  /**
   * When true, the backend re-runs `getBestAutoApplyDiscount` server-side
   * and — if the winning discount is a direct campaign (no coupon row) —
   * subtracts its amount from the cart. Combined additively with any
   * coupon in `discountCode` when the campaign's `allowsCoupon` is true.
   * Silently no-ops if the campaign is no longer eligible (buyer sees a
   * fresh checkout on refresh).
   */
  @IsOptional()
  @IsBoolean()
  applyActiveCampaign?: boolean;

  @IsOptional()
  @IsIn(['ar', 'en'])
  locale?: string;
}
