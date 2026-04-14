"use client";

import type { SideLoadedData } from "@/lib/strapi/types";
import { getStrapiMediaUrl } from "@/lib/strapi/client";

interface StrapiMedia {
  url: string;
  alternativeText?: string;
}

interface BeforeAfterBlockData {
  __component: "blocks.before-after-block";
  id: number;
  title?: string;
  description?: string;
  beforeImage?: StrapiMedia;
  afterImage?: StrapiMedia;
  beforeLabel?: string;
  afterLabel?: string;
  visibility?: string;
  position?: string;
}

interface BeforeAfterBlockProps {
  data: BeforeAfterBlockData;
  sideLoadedData: SideLoadedData;
}

export function BeforeAfterBlock({ data }: BeforeAfterBlockProps) {
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          {data.beforeImage && (
            <div className="flex flex-col gap-2 items-center">
              <img
                src={getStrapiMediaUrl(data.beforeImage.url)}
                alt={data.beforeImage.alternativeText || data.beforeLabel || "Before"}
                className="w-full h-auto rounded-xl object-cover"
              />
              <span className="text-sm font-semibold text-[var(--on-surface-variant)]">
                {data.beforeLabel || "Before"}
              </span>
            </div>
          )}
          {data.afterImage && (
            <div className="flex flex-col gap-2 items-center">
              <img
                src={getStrapiMediaUrl(data.afterImage.url)}
                alt={data.afterImage.alternativeText || data.afterLabel || "After"}
                className="w-full h-auto rounded-xl object-cover"
              />
              <span className="text-sm font-semibold text-[var(--on-surface-variant)]">
                {data.afterLabel || "After"}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
