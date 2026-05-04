"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";
import type { HomePage } from "@/lib/strapi/types";
import { getStrapiMediaUrl } from "@/lib/strapi/client";
import { resolveHref } from "@/lib/href-utils";

interface CTASectionProps {
  data?: HomePage | null;
}

const CTASection = ({ data }: CTASectionProps) => {
  const locale = useLocale();
  const isRTL = locale === "ar";

  const ctaBackgroundImage = data?.ctaBackgroundImage?.url ? getStrapiMediaUrl(data.ctaBackgroundImage.url) : null;
  const title = data?.ctaTitle || "";
  const description = data?.ctaDescription || "";
  const buttonLabel = data?.ctaButtonLabel || "";
  const buttonHref = resolveHref(data?.ctaButtonLink, locale);

  // Section hides when Strapi has nothing
  if (!title && !description && !buttonLabel && !ctaBackgroundImage) return null;

  return (
    <section className="relative bg-[var(--color-surface-card)] px-4 lg:px-10 py-12 lg:py-20 overflow-hidden">
      {ctaBackgroundImage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`absolute w-[1440px] h-[1440px] ${isRTL ? "-scale-x-100" : ""}`}>
            <Image
              src={ctaBackgroundImage}
              alt=""
              fill
              unoptimized={ctaBackgroundImage.startsWith('http')}
              className="object-cover opacity-10"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col gap-8 items-center justify-center w-full">
        {title && (
          <h2
            className="text-[var(--on-surface-default)] font-semibold text-center leading-none tracking-[-0.24px] w-full lg:w-[600px]"
            style={{ fontSize: "var(--typeface-font-styles-heading-h1)" }}
          >
            {title}
          </h2>
        )}

        {description && (
          <p
            className="text-[var(--on-surface-default)] text-center leading-7 w-full lg:w-[590px]"
            style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
          >
            {description}
          </p>
        )}

        {buttonLabel && (
          <Link
            href={buttonHref || "#"}
            className="h-10 px-5 py-2 btn-gold text-[var(--on-surface-inverse)] rounded-xl text-sm font-medium min-w-[80px] inline-flex items-center justify-center"
          >
            {buttonLabel}
          </Link>
        )}
      </div>
    </section>
  );
};

export default CTASection;
