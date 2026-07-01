"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

interface TamaraSplitBannerProps {
  /** Optional href override — defaults to /{locale}/courses. */
  href?: string;
  /** Compact variant tightens the vertical padding (used on the courses
   *  hero where a giant banner would push the results grid too far down). */
  compact?: boolean;
  className?: string;
}

/**
 * Full-width "Split your payments with Tamara" promo strip using Tamara's
 * official brand assets (delivered in their merchant kit). Two locale
 * variants ship under /public/tamara/{en,ar}/website-banner.png; the right
 * one is picked from useLocale() so RTL renders the Arabic banner and LTR
 * renders the English one.
 *
 * Rendered as a link to /courses because the marketing goal is: buyer sees
 * the banner → clicks → lands on a page where they can actually check out
 * with Tamara. Only rendered when NEXT_PUBLIC_TAMARA_PUBLIC_KEY is set so a
 * misconfigured deploy doesn't advertise a gateway that would fail on
 * checkout — same env-guard pattern as BnplPromoWidgets.
 */
export default function TamaraSplitBanner({
  href,
  compact = false,
  className = "",
}: TamaraSplitBannerProps) {
  const locale = useLocale();
  const t = useTranslations("tamaraBanner");
  const hasKey = !!process.env.NEXT_PUBLIC_TAMARA_PUBLIC_KEY;

  if (!hasKey) return null;

  const src =
    locale === "ar" ? "/tamara/ar/website-banner.png" : "/tamara/en/website-banner.png";
  const linkHref = href ?? `/${locale}/courses`;

  return (
    <section
      className={`w-full ${compact ? "py-4" : "py-8"} ${className}`}
      aria-label={t("ariaLabel")}
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          href={linkHref}
          className="block rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
        >
          {/* Tamara's Branding & Marketing PDF specifies the website banner
              as 1600×500 (aspect 16:5 = 3.2:1). Their brand kit forbids
              "stretching the banner" — we hold the exact spec ratio so the
              image renders edge-to-edge without cropping or letterboxing.
              sizes tells next/image which srcset breakpoint to serve so we
              don't ship the full-res PNG on mobile. */}
          <div className="relative w-full aspect-[16/5] bg-[var(--color-surface-card)]">
            <Image
              src={src}
              alt={t("imageAlt")}
              fill
              sizes="(max-width: 1200px) 100vw, 1200px"
              className="object-cover"
              priority={false}
            />
          </div>
        </Link>
      </div>
    </section>
  );
}
