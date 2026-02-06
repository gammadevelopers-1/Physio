"use client";

import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import type { HomePage } from "@/lib/strapi/types";
import { getStrapiMediaUrl } from "@/lib/strapi/client";

interface HeroProps {
  data?: HomePage | null;
}

const Hero = ({ data }: HeroProps) => {
  const t = useTranslations("hero");
  const locale = useLocale();
  const isRTL = locale === "ar";

  // Get video URL from Strapi or fallback to local
  const videoUrl = data?.heroVideo?.url
    ? getStrapiMediaUrl(data.heroVideo.url)
    : "/videos/1767191494476407.mp4";

  // Get hero partner logos from Strapi or use defaults (filter out entries without URLs)
  const heroPartnerLogos = (data?.heroPartnerLogos || []).filter((logo) => logo.url);

  return (
    <section className="relative w-full">
      {/* Video Section - Responsive height */}
      <div className="relative h-[370px] lg:h-[600px] w-full overflow-hidden">
        {/* Video Element */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src={videoUrl} type="video/mp4" />
        </video>

        {/* Partner logos on video - Responsive positioning and sizing */}
        <div
          className={`absolute bottom-5 flex items-center gap-3 lg:gap-6 ${
            isRTL ? "left-5 lg:left-16" : "right-5 lg:right-16"
          }`}
        >
          {heroPartnerLogos.length > 0 ? (
            heroPartnerLogos.map((logo, index) => (
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
                {/* Separator line - show between logos */}
                {index < heroPartnerLogos.length - 1 && (
                  <div className="h-5 lg:h-12 w-px bg-white/40" />
                )}
              </div>
            ))
          ) : (
            <>
              <div className="relative h-8 w-8 lg:h-16 lg:w-24">
                <Image
                  src="/images/partner-1.png"
                  alt="BMC"
                  fill
                  className="object-contain"
                  style={{ mixBlendMode: "multiply" }}
                />
              </div>
              <div className="h-5 lg:h-12 w-px bg-white/40" />
              <div className="relative h-8 w-8 lg:h-16 lg:w-28">
                <Image
                  src="/images/partner-2.png"
                  alt="Prince Sultan"
                  fill
                  className="object-contain"
                  style={{ mixBlendMode: "multiply" }}
                />
              </div>
              <div className="h-5 lg:h-12 w-px bg-white/40" />
              <div className="relative h-8 w-8 lg:h-16 lg:w-20">
                <Image
                  src="/images/partner-3.png"
                  alt="Partner 3"
                  fill
                  className="object-contain"
                  style={{ mixBlendMode: "multiply" }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content Section - Responsive layout */}
      <div className="bg-[var(--surface-intense)] px-4 lg:px-16 pt-8 pb-6 lg:py-20 overflow-hidden">
        {/* Mobile/Tablet Layout - Stacked */}
        <div className="flex flex-col gap-4 lg:hidden">
          <h1
            className="text-black font-semibold tracking-[-0.72px] leading-none"
            style={{
              fontSize: "var(--typeface-font-styles-display-base)",
              fontFamily: "Poppins, var(--typeface-family), sans-serif",
            }}
          >
            {data?.heroTitleMobile || t("titleMobile")}
          </h1>

          <p
            className="text-black leading-7"
            style={{
              fontSize: "var(--typeface-font-styles-heading-subheading)",
            }}
          >
            {data?.heroDescription || t("description")}
          </p>

          {/* Mobile Action Buttons */}
          <div className="flex gap-4 pt-8">
            <button className="h-12 px-5 py-2 btn-gold text-white rounded-xl text-sm font-medium whitespace-nowrap">
              {data?.heroButton1Label || t("exploreButton")}
            </button>
            <button className="h-12 px-5 py-2 border border-[var(--outline-default)] rounded-xl text-sm font-medium bg-transparent whitespace-nowrap">
              <span
                className="bg-gradient-to-r from-[#ab842f] to-[#8e690a] bg-clip-text"
                style={{ WebkitTextFillColor: "transparent" }}
              >
                {data?.heroButton2Label || t("getStartedButton")}
              </span>
            </button>
          </div>
        </div>

        {/* Desktop Layout - Two columns side by side */}
        {/* In RTL: Title on right, Description+Buttons on left (handled by dir="rtl") */}
        <div className="hidden lg:flex gap-20 items-start max-w-full">
          {/* Title Column */}
          <div className="flex-1 min-w-0">
            <h1
              className="text-[var(--on-surface-default)] font-semibold tracking-[-1.2px] leading-[1.1]"
              style={{
                fontSize: "60px",
              }}
            >
              {data?.heroTitle || t("title")}
              <br />
              {data?.heroTitleLine2 || t("titleLine2")}
            </h1>
          </div>

          {/* Description + CTAs Column */}
          <div className="flex-1 min-w-0 flex flex-col gap-8">
            <p
              className="text-[var(--on-surface-default)] leading-7 text-[20px]"
            >
              {data?.heroDescription || t("description")}
            </p>

            {/* Desktop Action Buttons */}
            <div className="flex gap-4">
              <button className="h-10 px-5 py-2 btn-gold text-[var(--on-surface-inverse)] rounded-xl text-sm font-medium whitespace-nowrap">
                {data?.heroButton1Label || t("exploreButton")}
              </button>
              <button className="h-10 px-5 py-2 border border-[var(--outline-default)] rounded-xl text-sm font-medium bg-transparent whitespace-nowrap">
                <span
                  className="bg-gradient-to-r from-[#ab842f] to-[#8e690a] bg-clip-text"
                  style={{ WebkitTextFillColor: "transparent" }}
                >
                  {data?.heroButton2Label || t("getStartedButton")}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
