"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";
import { getStrapiMediaUrl } from "@/lib/strapi/client";
import { resolveHref } from "@/lib/href-utils";
import type { ImageBannerBlockData } from "@/lib/strapi/types";

interface ImageBannerBlockProps {
  data: ImageBannerBlockData;
}

const MAX_WIDTH_CLASS: Record<ImageBannerBlockData["maxWidth"], string> = {
  small: "max-w-[480px]",
  medium: "max-w-[800px]",
  large: "max-w-[1200px]",
  full: "max-w-full",
};

const ALIGNMENT_CLASS: Record<ImageBannerBlockData["alignment"], string> = {
  left: "items-start text-start",
  center: "items-center text-center",
  right: "items-end text-end",
};

export function ImageBannerBlock({ data }: ImageBannerBlockProps) {
  const locale = useLocale();

  if (!data.image?.url) return null;

  const imageUrl = getStrapiMediaUrl(data.image.url);
  const alt = data.imageAlt || data.image.alternativeText || "";
  const widthClass = MAX_WIDTH_CLASS[data.maxWidth] ?? MAX_WIDTH_CLASS.large;
  const alignClass = ALIGNMENT_CLASS[data.alignment] ?? ALIGNMENT_CLASS.center;

  const button = data.button;
  const buttonHref = button?.url ? resolveHref(button.url, locale) : null;
  const isOutline = button?.variant === "outline" || button?.variant === "secondary";

  const imageWidth = data.image.width || 1600;
  const imageHeight = data.image.height || 900;

  return (
    <section className="w-full bg-[var(--surface-intense)] px-4 md:px-16 py-10 md:py-16">
      <div className={`mx-auto w-full ${widthClass}`}>
        <div className={`flex flex-col gap-6 ${alignClass}`}>
          <div className="w-full">
            <Image
              src={imageUrl}
              alt={alt}
              width={imageWidth}
              height={imageHeight}
              className="w-full h-auto rounded-2xl"
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 80vw, 1200px"
              priority={false}
            />
          </div>

          {button?.label && buttonHref && (
            <Link
              href={buttonHref}
              target={button.openInNewTab ? "_blank" : undefined}
              rel={button.openInNewTab ? "noopener noreferrer" : undefined}
              className={
                isOutline
                  ? "h-11 px-6 py-2 border border-[var(--outline-default)] rounded-xl text-sm font-medium bg-transparent inline-flex items-center justify-center hover:opacity-90 transition-opacity"
                  : "h-11 px-6 py-2 btn-gold text-[var(--on-surface-inverse)] rounded-xl text-sm font-medium inline-flex items-center justify-center hover:opacity-90 transition-opacity"
              }
            >
              {isOutline ? (
                <span
                  className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] bg-clip-text"
                  style={{ WebkitTextFillColor: "transparent" }}
                >
                  {button.label}
                </span>
              ) : (
                button.label
              )}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
