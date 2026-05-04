"use client";

import type { SideLoadedData } from "@/lib/strapi/types";
import { getStrapiMediaUrl } from "@/lib/strapi/client";

interface StrapiMedia {
  url: string;
  alternativeText?: string;
}

interface TreatmentTechniqueItem {
  id: number;
  name: string;
  description?: string;
  category?: string;
  image?: StrapiMedia;
}

interface TreatmentGalleryBlockData {
  __component: "blocks.treatment-gallery-block";
  id: number;
  title?: string;
  description?: string;
  techniques?: TreatmentTechniqueItem[];
  filterByCategory?: boolean;
  columns?: "2" | "3" | "4";
  visibility?: string;
  position?: string;
}

interface TreatmentGalleryBlockProps {
  data: TreatmentGalleryBlockData;
  sideLoadedData: SideLoadedData;
}

const columnClasses: Record<string, string> = {
  "2": "grid-cols-1 md:grid-cols-2",
  "3": "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  "4": "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
};

export function TreatmentGalleryBlock({ data }: TreatmentGalleryBlockProps) {
  if (
    (!data.techniques || data.techniques.length === 0) &&
    !data.title?.trim() &&
    !data.description?.trim()
  ) {
    return null;
  }

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

        <div className={`grid ${columnClasses[cols]} gap-6 w-full`}>
          {data.techniques?.map((tech) => (
            <div
              key={tech.id}
              className="flex flex-col bg-[var(--color-surface-card)] rounded-2xl border border-[var(--outline-subtle)] shadow-sm overflow-hidden"
            >
              {tech.image && (
                <div className="w-full h-48 overflow-hidden">
                  <img
                    src={getStrapiMediaUrl(tech.image.url)}
                    alt={tech.image.alternativeText || tech.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-5 flex flex-col gap-2">
                {tech.category && (
                  <span className="text-xs font-medium text-[var(--surface-container-primary)] uppercase">
                    {tech.category}
                  </span>
                )}
                <h3
                  className="font-semibold text-[var(--on-surface-default)]"
                  style={{ fontSize: "var(--typeface-font-styles-heading-h5)" }}
                >
                  {tech.name}
                </h3>
                {tech.description && (
                  <p className="text-sm text-[var(--on-surface-variant)] leading-6">
                    {tech.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
