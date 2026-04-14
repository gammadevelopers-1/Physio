"use client";

import type { SideLoadedData } from "@/lib/strapi/types";
import { getStrapiMediaUrl } from "@/lib/strapi/client";

interface StrapiMedia {
  url: string;
  alternativeText?: string;
}

interface CoursePreviewBlockData {
  __component: "blocks.course-preview-block";
  id: number;
  title?: string;
  description?: string;
  previewVideo?: StrapiMedia;
  previewVideoUrl?: string;
  previewImage?: StrapiMedia;
  courseHighlights?: string;
  enrollLabel?: string;
  enrollUrl?: string;
  price?: string;
  duration?: string;
  visibility?: string;
  position?: string;
}

interface CoursePreviewBlockProps {
  data: CoursePreviewBlockData;
  sideLoadedData: SideLoadedData;
}

export function CoursePreviewBlock({ data }: CoursePreviewBlockProps) {
  const highlights = data.courseHighlights
    ? data.courseHighlights.split("\n").filter(Boolean)
    : [];

  return (
    <section className="px-4 lg:px-16 py-12 lg:py-20">
      <div className="max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Media */}
        <div className="w-full rounded-2xl overflow-hidden bg-gray-100">
          {data.previewVideoUrl ? (
            <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
              <iframe
                src={data.previewVideoUrl}
                className="absolute inset-0 w-full h-full"
                allowFullScreen
                title={data.title || "Course preview"}
              />
            </div>
          ) : data.previewVideo ? (
            <video
              src={getStrapiMediaUrl(data.previewVideo.url)}
              controls
              className="w-full"
            />
          ) : data.previewImage ? (
            <img
              src={getStrapiMediaUrl(data.previewImage.url)}
              alt={data.previewImage.alternativeText || data.title || "Course preview"}
              className="w-full h-auto object-cover"
            />
          ) : (
            <div className="w-full h-64 flex items-center justify-center text-[var(--on-surface-variant)]">
              No preview available
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-col gap-4">
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

          {(data.price || data.duration) && (
            <div className="flex items-center gap-6">
              {data.price && (
                <span className="text-xl font-bold text-[var(--surface-container-primary)]">
                  {data.price}
                </span>
              )}
              {data.duration && (
                <span className="text-sm text-[var(--on-surface-variant)]">
                  {data.duration}
                </span>
              )}
            </div>
          )}

          {highlights.length > 0 && (
            <ul className="flex flex-col gap-2">
              {highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[var(--on-surface-default)]">
                  <span className="text-green-500 mt-0.5">&#10003;</span>
                  {h}
                </li>
              ))}
            </ul>
          )}

          {data.enrollUrl && (
            <a
              href={data.enrollUrl}
              className="mt-2 inline-block w-fit px-8 py-3 rounded-full bg-[var(--surface-container-primary)] text-white text-sm font-medium"
            >
              {data.enrollLabel || "Enroll Now"}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
