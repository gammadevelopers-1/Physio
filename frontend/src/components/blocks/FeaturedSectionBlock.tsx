"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { FeaturedSectionBlockData } from "@/lib/strapi/types";
import { getStrapiMediaUrl } from "@/lib/strapi/client";
import { resolveHref } from "@/lib/href-utils";

const AUTO_ADVANCE_MS = 5000;

interface FeaturedSectionBlockProps {
  data: FeaturedSectionBlockData;
}

export function FeaturedSectionBlock({ data }: FeaturedSectionBlockProps) {
  const locale = useLocale();
  const isRTL = locale === "ar";

  const images = (data.images || []).filter((img) => !!img?.url);
  const count = images.length;

  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!data.autoPlay || count <= 1 || hovering) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, AUTO_ADVANCE_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [count, hovering, data.autoPlay]);

  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;
  const goPrev = () => setIndex((i) => (i - 1 + count) % count);
  const goNext = () => setIndex((i) => (i + 1) % count);

  const title = data.title || "";
  const description = data.description || "";
  const cta = data.ctaButton;
  const ctaHref = cta?.url ? resolveHref(cta.url, locale) : null;

  const hasText = !!(title || description || cta?.label);
  const hasImages = count > 0;
  if (!hasText && !hasImages) return null;

  const imageOnRight = data.imagePosition !== "left";
  // RTL flips visual order: imagePosition=right in Arabic means visually on the left.
  const flexDirection = imageOnRight ? "lg:flex-row" : "lg:flex-row-reverse";

  return (
    <section
      className="bg-[var(--color-surface-page)] px-4 lg:px-16 py-12 lg:py-20"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className={`flex flex-col gap-8 lg:gap-16 ${flexDirection} items-center max-w-[1400px] mx-auto`}>
        {/* Text column */}
        {hasText && (
          <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
            {title && (
              <h2 className="text-[var(--color-text-primary)] font-semibold tracking-[-1px] leading-[1.1] text-3xl lg:text-5xl">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-[var(--color-text-secondary)] leading-7 text-base lg:text-lg whitespace-pre-line">
                {description}
              </p>
            )}
            {cta?.label && ctaHref && (
              <div className="pt-2">
                <Link
                  href={ctaHref}
                  target={cta.openInNewTab ? "_blank" : undefined}
                  rel={cta.openInNewTab ? "noopener noreferrer" : undefined}
                  className="inline-flex items-center justify-center h-12 px-6 btn-gold text-[var(--color-button-text)] rounded-xl text-sm font-medium"
                >
                  {cta.label}
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Carousel column */}
        {hasImages && (
          <div
            className="flex-1 min-w-0 w-full"
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
          >
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-[var(--color-surface-card)]">
              {images.map((img, i) => {
                const url = getStrapiMediaUrl(img.url);
                return (
                  <div
                    key={img.id || i}
                    className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                      i === index ? "opacity-100" : "opacity-0"
                    }`}
                    aria-hidden={i !== index}
                  >
                    <Image
                      src={url}
                      alt={img.alternativeText || `Slide ${i + 1}`}
                      fill
                      unoptimized
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="object-cover"
                      priority={i === 0}
                    />
                  </div>
                );
              })}

              {data.showArrows && count > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goPrev}
                    aria-label="Previous slide"
                    className={`absolute top-4 ${isRTL ? "right-auto left-16" : "right-16"} h-10 w-10 rounded-full bg-white/80 backdrop-blur hover:bg-white shadow flex items-center justify-center text-[var(--color-text-primary)]`}
                  >
                    <PrevIcon className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    aria-label="Next slide"
                    className={`absolute top-4 ${isRTL ? "left-4" : "right-4"} h-10 w-10 rounded-full bg-white/80 backdrop-blur hover:bg-white shadow flex items-center justify-center text-[var(--color-text-primary)]`}
                  >
                    <NextIcon className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {data.showDots && count > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={`Go to slide ${i + 1}`}
                    className={`h-2 rounded-full transition-all ${
                      i === index
                        ? "w-6 bg-[var(--color-primary)]"
                        : "w-2 bg-[var(--color-border)]"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
