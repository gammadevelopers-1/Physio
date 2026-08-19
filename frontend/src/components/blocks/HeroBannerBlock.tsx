"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";
import { getStrapiMediaUrl } from "@/lib/strapi/client";
import { resolveHref } from "@/lib/href-utils";
import type { SideLoadedData } from "@/lib/strapi/types";

interface ButtonLink {
  id: number;
  label: string;
  url: string;
  variant?: string;
}

interface HeroBannerBlockData {
  __component: "blocks.hero-banner";
  id: number;
  title: string;
  titleLine2?: string | null;
  titleMobile?: string | null;
  description?: string | null;
  backgroundVideo?: { url: string; mime: string } | null;
  backgroundImage?: { url: string } | null;
  buttons?: ButtonLink[];
  partnerLogos?: { url: string; alternativeText?: string }[] | null;
  visibility?: string;
  position?: string;
}

interface HeroBannerBlockProps {
  data: HeroBannerBlockData;
  sideLoadedData: SideLoadedData;
}

export function HeroBannerBlock({ data }: HeroBannerBlockProps) {
  const locale = useLocale();
  const isRTL = locale === "ar";

  if (
    !data.title?.trim() &&
    !data.description?.trim() &&
    !data.backgroundImage &&
    (!data.buttons || data.buttons.length === 0)
  ) {
    return null;
  }
  const hasButtons = data.buttons && data.buttons.length > 0;

  return (
    <section className="relative bg-[var(--color-surface-page)] overflow-hidden">
      {/* Background image */}
      {data.backgroundImage && (
        <div className="absolute inset-0 z-0">
          <Image
            src={getStrapiMediaUrl(data.backgroundImage.url)}
            alt=""
            fill
            className="object-cover"
            unoptimized
          />
          <div className="absolute inset-0 bg-white/70" />
        </div>
      )}

      <div
        className={
          data.backgroundImage
            ? // With background image: single-column stacked layout (title above description),
              // aligned to the reading start (left in EN, right in AR).
              // `items-start` in a flex-col respects direction — start = left in LTR, right in RTL.
              // Use physical text-alignment classes (text-left/text-right) so the text within each
              // child block also aligns properly, since text-start isn't in older Tailwind builds.
              `relative z-10 flex flex-col gap-6 max-w-[1440px] mx-auto px-4 lg:px-16 py-12 lg:py-24 min-h-[420px] lg:min-h-[560px] lg:py-32 justify-center items-start ${
                isRTL ? "text-right" : "text-left"
              }`
            : // No background image: original two-column layout (used by homepage hero etc.)
              `relative z-10 flex flex-col lg:flex-row gap-8 lg:gap-20 items-start max-w-[1440px] mx-auto px-4 lg:px-16 py-12 lg:py-24 ${
                isRTL ? "lg:flex-row-reverse" : ""
              }`
        }
      >
        {/* Title Column */}
        <div className={data.backgroundImage ? "w-full max-w-3xl min-w-0" : "flex-1 min-w-0"}>
          {/* Mobile title */}
          <h1 className="lg:hidden text-[var(--on-surface-default)] font-semibold tracking-[-0.72px] leading-[1.1] text-[36px]">
            {data.titleMobile || data.title}
          </h1>
          {/* Desktop title */}
          <h1 className="hidden lg:block text-[var(--on-surface-default)] font-semibold tracking-[-1.2px] leading-[1.1] text-[60px]">
            {data.title}
            {data.titleLine2 && (
              <>
                <br />
                <span className="text-[48px] text-[var(--on-surface-variant)] font-normal">{data.titleLine2}</span>
              </>
            )}
          </h1>
        </div>

        {/* Description + Buttons Column */}
        <div className={
          data.backgroundImage
            ? "w-full max-w-3xl min-w-0 flex flex-col gap-6"
            : "flex-1 min-w-0 flex flex-col gap-8"
        }>
          {data.description && (
            <p className="text-[var(--on-surface-default)] leading-7 text-[18px] lg:text-[20px]">
              {data.description}
            </p>
          )}

          {hasButtons && (
            <div className={`flex gap-4 ${isRTL ? "flex-row-reverse" : ""}`}>
              {data.buttons!.map((btn, i) => (
                <Link
                  key={btn.id}
                  href={resolveHref(btn.url, locale) || `/${locale}`}
                  className={i === 0
                    ? "h-12 px-5 py-2 btn-gold text-[var(--color-button-text)] rounded-xl text-sm font-medium whitespace-nowrap inline-flex items-center justify-center"
                    : "h-12 px-5 py-2 border border-[var(--outline-default)] rounded-xl text-sm font-medium bg-transparent whitespace-nowrap inline-flex items-center justify-center text-[var(--color-primary)]"
                  }
                >
                  {btn.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
