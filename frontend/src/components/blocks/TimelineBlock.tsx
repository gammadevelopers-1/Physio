"use client";

import type { SideLoadedData } from "@/lib/strapi/types";

interface TimelineItem {
  id: number;
  title: string;
  description?: string;
  date?: string;
  icon?: string;
}

interface TimelineBlockData {
  __component: "blocks.timeline-block";
  id: number;
  title?: string;
  description?: string;
  steps?: TimelineItem[];
  variant?: "vertical" | "horizontal";
  visibility?: string;
  position?: string;
}

interface TimelineBlockProps {
  data: TimelineBlockData;
  sideLoadedData: SideLoadedData;
}

export function TimelineBlock({ data }: TimelineBlockProps) {
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

        <div className="w-full max-w-[768px]">
          {data.steps?.map((step, index) => (
            <div key={step.id} className="flex gap-4">
              {/* Timeline line & dot */}
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {step.icon || index + 1}
                </div>
                {index < (data.steps?.length || 0) - 1 && (
                  <div className="w-0.5 flex-1 bg-[var(--outline-subtle)] my-1" />
                )}
              </div>

              {/* Content */}
              <div className="pb-8 flex-1">
                {step.date && (
                  <span className="text-xs text-[var(--on-surface-variant)] font-medium">
                    {step.date}
                  </span>
                )}
                <h3
                  className="font-semibold text-[var(--on-surface-default)] mt-1"
                  style={{ fontSize: "var(--typeface-font-styles-heading-h5)" }}
                >
                  {step.title}
                </h3>
                {step.description && (
                  <p className="text-sm text-[var(--on-surface-variant)] mt-2 leading-6">
                    {step.description}
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
