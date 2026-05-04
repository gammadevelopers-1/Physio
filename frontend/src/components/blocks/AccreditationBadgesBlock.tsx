"use client";

import type { SideLoadedData } from "@/lib/strapi/types";
import { getStrapiMediaUrl } from "@/lib/strapi/client";

interface StrapiMedia {
  url: string;
  alternativeText?: string;
  width?: number;
  height?: number;
}

interface AccreditationBadgesBlockData {
  __component: "blocks.accreditation-badges-block";
  id: number;
  title?: string;
  description?: string;
  badges?: StrapiMedia[];
  badgeLinks?: string;
  variant?: "row" | "grid";
  visibility?: string;
  position?: string;
}

interface AccreditationBadgesBlockProps {
  data: AccreditationBadgesBlockData;
  sideLoadedData: SideLoadedData;
}

export function AccreditationBadgesBlock({ data }: AccreditationBadgesBlockProps) {
  if (
    (!data.badges || data.badges.length === 0) &&
    !data.title?.trim() &&
    !data.description?.trim()
  ) {
    return null;
  }

  const links = data.badgeLinks
    ? data.badgeLinks.split("\n").filter(Boolean)
    : [];

  return (
    <section className="px-4 lg:px-16 py-12 lg:py-20">
      <div className="max-w-[1280px] mx-auto flex flex-col gap-8 items-center">
        {(data.title || data.description) && (
          <div className="flex flex-col gap-4 items-center text-center max-w-[768px]">
            {data.title && (
              <h2
                className="font-semibold text-[var(--on-surface-default)] leading-none tracking-[-0.24px]"
                style={{ fontSize: "var(--typeface-font-styles-heading-h1)" }}
              >
                {data.title}
              </h2>
            )}
            {data.description && (
              <p
                className="text-[var(--on-surface-default)] leading-7"
                style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
              >
                {data.description}
              </p>
            )}
          </div>
        )}

        <div
          className={
            data.variant === "grid"
              ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full"
              : "flex flex-wrap items-center justify-center gap-8"
          }
        >
          {data.badges?.map((badge, index) => {
            const imgEl = (
              <img
                key={index}
                src={getStrapiMediaUrl(badge.url)}
                alt={badge.alternativeText || `Badge ${index + 1}`}
                className="h-16 w-auto object-contain"
              />
            );
            const link = links[index];
            return link ? (
              <a key={index} href={link} target="_blank" rel="noopener noreferrer">
                {imgEl}
              </a>
            ) : (
              imgEl
            );
          })}
        </div>
      </div>
    </section>
  );
}
