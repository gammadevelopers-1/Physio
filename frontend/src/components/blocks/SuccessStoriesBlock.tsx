"use client";

import type { SideLoadedData } from "@/lib/strapi/types";
import { getStrapiMediaUrl } from "@/lib/strapi/client";

interface StrapiMedia {
  url: string;
  alternativeText?: string;
}

interface SuccessStoryItem {
  id: number;
  name: string;
  role?: string;
  story: string;
  metric?: string;
  metricValue?: string;
  image?: StrapiMedia;
}

interface SuccessStoriesBlockData {
  __component: "blocks.success-stories-block";
  id: number;
  title?: string;
  description?: string;
  stories?: SuccessStoryItem[];
  variant?: "grid" | "carousel";
  visibility?: string;
  position?: string;
}

interface SuccessStoriesBlockProps {
  data: SuccessStoriesBlockData;
  sideLoadedData: SideLoadedData;
}

export function SuccessStoriesBlock({ data }: SuccessStoriesBlockProps) {
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
          {data.stories?.map((story) => (
            <div
              key={story.id}
              className="flex flex-col gap-4 p-6 bg-[var(--color-surface-card)] rounded-2xl border border-[var(--outline-subtle)] shadow-sm"
            >
              <div className="flex items-center gap-4">
                {story.image && (
                  <img
                    src={getStrapiMediaUrl(story.image.url)}
                    alt={story.image.alternativeText || story.name}
                    className="w-14 h-14 rounded-full object-cover"
                  />
                )}
                <div>
                  <h3 className="font-semibold text-sm text-[var(--on-surface-default)]">
                    {story.name}
                  </h3>
                  {story.role && (
                    <p className="text-xs text-[var(--on-surface-variant)]">
                      {story.role}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-sm text-[var(--on-surface-default)] leading-6 italic">
                &ldquo;{story.story}&rdquo;
              </p>
              {story.metric && story.metricValue && (
                <div className="mt-auto pt-3 border-t border-[var(--outline-subtle)] flex items-center justify-between">
                  <span className="text-xs text-[var(--on-surface-variant)]">
                    {story.metric}
                  </span>
                  <span className="text-lg font-bold text-[var(--surface-container-primary)]">
                    {story.metricValue}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
