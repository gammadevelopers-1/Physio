"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";

interface TamaraProductBadgeProps {
  /** Course price in SAR — the badge is skipped for free courses and for
   *  amounts below Tamara's 50 SAR minimum. */
  price: number;
  currency?: string;
  className?: string;
}

/**
 * Small inline "Split with Tamara" badge for course cards. Uses Tamara's
 * official Product Template asset (from their merchant kit) so the
 * visual matches everything else Tamara publishes about the merchant.
 *
 * Skipped when:
 *   - price is below Tamara's 50 SAR minimum (widget wouldn't render either)
 *   - the course is free
 *   - the Tamara public key isn't configured (env-guard mirrors the
 *     BnplPromoWidgets/TamaraSplitBanner behaviour so a misconfigured
 *     deploy doesn't advertise a broken gateway)
 */
export default function TamaraProductBadge({
  price,
  currency = "SAR",
  className = "",
}: TamaraProductBadgeProps) {
  const locale = useLocale();
  const t = useTranslations("tamaraBanner");
  const hasKey = !!process.env.NEXT_PUBLIC_TAMARA_PUBLIC_KEY;

  if (!hasKey) return null;
  if (currency !== "SAR" || price < 50) return null;

  const src =
    locale === "ar" ? "/tamara/ar/product-badge.png" : "/tamara/en/product-badge.png";

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)] ${className}`}
      title={t("productBadgeTitle")}
    >
      {/* Tamara's product-template PNG is 2063×333 (~6.2:1). Setting the
          natural-ratio width+height hints prevents CLS; h-4 w-auto lets it
          scale down without distortion. */}
      <Image
        src={src}
        alt={t("productBadgeAlt")}
        width={100}
        height={16}
        className="h-4 w-auto object-contain"
      />
    </span>
  );
}
