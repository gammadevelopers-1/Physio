"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";
import type { HomePage } from "@/lib/strapi/types";
import { getStrapiMediaUrl } from "@/lib/strapi/client";
import { resolveHref } from "@/lib/href-utils";

interface HeroProps {
  data?: HomePage | null;
}

const Hero = ({ data }: HeroProps) => {
  const locale = useLocale();
  const isRTL = locale === "ar";

  // Everything here is Strapi-only. If nothing is configured the section
  // still renders an empty video area (it's the first impression on the page)
  // but every piece of copy / button / logo is gated on real content.
  const videoUrl = data?.heroVideo?.url ? getStrapiMediaUrl(data.heroVideo.url) : null;
  const heroPartnerLogos = (data?.heroPartnerLogos || []).filter((logo) => logo.url);

  const heroVideoMode = data?.heroVideoMode || "banner";
  const videoContainerClass =
    heroVideoMode === "banner"
      ? "aspect-[1920/450]"
      : heroVideoMode === "widescreen"
        ? "aspect-[16/9]"
        : "h-[370px] lg:h-[600px]";
  const videoObjectFitClass = heroVideoMode === "fullFit" ? "object-contain" : "object-cover";

  const titleMobile = data?.heroTitleMobile || "";
  const title = data?.heroTitle || "";
  const titleLine2 = data?.heroTitleLine2 || "";
  const description = data?.heroDescription || "";
  const button1Label = data?.heroButton1Label || "";
  const button2Label = data?.heroButton2Label || "";
  const button1Href = resolveHref(data?.heroButton1Link, locale);
  const button2Href = resolveHref(data?.heroButton2Link, locale);

  const hasAnyMobileContent = !!(titleMobile || description || button1Label || button2Label);
  const hasAnyDesktopContent = !!(title || titleLine2 || description || button1Label || button2Label);
  const hasButtons = !!(button1Label || button2Label);
  const hasAnyHeroContent =
    hasAnyMobileContent || hasAnyDesktopContent || !!videoUrl || heroPartnerLogos.length > 0;

  if (!hasAnyHeroContent) return null;

  const showVideoContainer = !!videoUrl || heroPartnerLogos.length > 0;

  return (
    <section className="relative w-full">
      {/* Video Section — only render when there's a video or partner logos */}
      {showVideoContainer && (
        <div className={`relative ${videoContainerClass} w-full overflow-hidden bg-[var(--color-surface-page)]`}>
          {videoUrl && (
            <video
              autoPlay
              loop
              muted
              playsInline
              className={`absolute inset-0 w-full h-full ${videoObjectFitClass}`}
            >
              <source src={videoUrl} type="video/mp4" />
            </video>
          )}

          {heroPartnerLogos.length > 0 && (
            <div
              className={`absolute bottom-5 flex items-center gap-3 lg:gap-6 ${
                isRTL ? "left-5 lg:left-16" : "right-5 lg:right-16"
              }`}
            >
              {heroPartnerLogos.map((logo, index) => (
                <div key={logo.id || index} className="flex items-center gap-3 lg:gap-6">
                  <div className="relative h-8 w-8 lg:h-16 lg:w-24">
                    <Image
                      src={getStrapiMediaUrl(logo.url)}
                      alt={logo.alternativeText || `Partner ${index + 1}`}
                      fill
                      unoptimized
                      className="object-contain"
                      style={{ mixBlendMode: "multiply" }}
                    />
                  </div>
                  {index < heroPartnerLogos.length - 1 && (
                    <div className="h-5 lg:h-12 w-px bg-white/40" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content Section - only render when at least one piece of text/button is provided */}
      {(hasAnyMobileContent || hasAnyDesktopContent) && (
        <div className="bg-[var(--color-surface-page)] px-4 lg:px-16 pt-8 pb-6 lg:py-20 overflow-hidden">
          {/* Mobile/Tablet Layout */}
          {hasAnyMobileContent && (
            <div className="flex flex-col gap-4 lg:hidden">
              {titleMobile && (
                <h1
                  className="text-[var(--color-text-primary)] font-semibold tracking-[-0.72px] leading-none"
                  style={{
                    fontSize: "var(--typeface-font-styles-display-base)",
                    fontFamily: "Poppins, var(--typeface-family), sans-serif",
                  }}
                >
                  {titleMobile}
                </h1>
              )}

              {description && (
                <p
                  className="text-[var(--color-text-primary)] leading-7"
                  style={{
                    fontSize: "var(--typeface-font-styles-heading-subheading)",
                  }}
                >
                  {description}
                </p>
              )}

              {hasButtons && (
                <div className="flex gap-4 pt-8">
                  {button1Label && (
                    <Link
                      href={button1Href || "#"}
                      className="h-12 px-5 py-2 btn-gold text-[var(--color-button-text)] rounded-xl text-sm font-medium whitespace-nowrap inline-flex items-center justify-center"
                    >
                      {button1Label}
                    </Link>
                  )}
                  {button2Label && (
                    <Link
                      href={button2Href || "#"}
                      className="h-12 px-5 py-2 border border-[var(--outline-default)] rounded-xl text-sm font-medium bg-transparent whitespace-nowrap inline-flex items-center justify-center"
                    >
                      <span
                        className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] bg-clip-text"
                        style={{ WebkitTextFillColor: "transparent" }}
                      >
                        {button2Label}
                      </span>
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Desktop Layout */}
          {hasAnyDesktopContent && (
            <div className="hidden lg:flex gap-20 items-start max-w-full">
              {(title || titleLine2) && (
                <div className="flex-1 min-w-0">
                  <h1
                    className="text-[var(--on-surface-default)] font-semibold tracking-[-1.2px] leading-[1.1]"
                    style={{ fontSize: "60px" }}
                  >
                    {title}
                    {title && titleLine2 && <br />}
                    {titleLine2}
                  </h1>
                </div>
              )}

              {(description || hasButtons) && (
                <div className="flex-1 min-w-0 flex flex-col gap-8">
                  {description && (
                    <p className="text-[var(--on-surface-default)] leading-7 text-[20px]">
                      {description}
                    </p>
                  )}

                  {hasButtons && (
                    <div className="flex gap-4">
                      {button1Label && (
                        <Link
                          href={button1Href || "#"}
                          className="h-10 px-5 py-2 btn-gold text-[var(--on-surface-inverse)] rounded-xl text-sm font-medium whitespace-nowrap inline-flex items-center justify-center"
                        >
                          {button1Label}
                        </Link>
                      )}
                      {button2Label && (
                        <Link
                          href={button2Href || "#"}
                          className="h-10 px-5 py-2 border border-[var(--outline-default)] rounded-xl text-sm font-medium bg-transparent whitespace-nowrap inline-flex items-center justify-center"
                        >
                          <span
                            className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] bg-clip-text"
                            style={{ WebkitTextFillColor: "transparent" }}
                          >
                            {button2Label}
                          </span>
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default Hero;
