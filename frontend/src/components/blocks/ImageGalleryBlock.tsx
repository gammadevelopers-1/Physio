"use client";

import type { SideLoadedData } from "@/lib/strapi/types";
import { getStrapiMediaUrl } from "@/lib/strapi/client";

interface StrapiMedia {
  url: string;
  alternativeText?: string;
  width?: number;
  height?: number;
}

interface ImageGalleryBlockData {
  __component: "blocks.image-gallery-block";
  id: number;
  title?: string;
  description?: string;
  images?: StrapiMedia[];
  variant?: "grid" | "carousel" | "masonry";
  columns?: "2" | "3" | "4";
  enableLightbox?: boolean;
  visibility?: string;
  position?: string;
}

interface ImageGalleryBlockProps {
  data: ImageGalleryBlockData;
  sideLoadedData: SideLoadedData;
}

const columnClasses: Record<string, string> = {
  "2": "grid-cols-1 md:grid-cols-2",
  "3": "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  "4": "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
};

export function ImageGalleryBlock({ data }: ImageGalleryBlockProps) {
  const cols = data.columns || "3";

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

        <div className={`grid ${columnClasses[cols]} gap-4 w-full`}>
          {data.images?.map((img, index) => (
            <div
              key={index}
              className="relative overflow-hidden rounded-xl bg-gray-100"
            >
              <img
                src={getStrapiMediaUrl(img.url)}
                alt={img.alternativeText || `Gallery image ${index + 1}`}
                className="w-full h-auto object-cover aspect-square"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
