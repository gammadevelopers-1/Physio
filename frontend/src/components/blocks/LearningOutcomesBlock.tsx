"use client";

import type { SideLoadedData } from "@/lib/strapi/types";

interface LearningOutcomeItem {
  id: number;
  text: string;
  icon?: string;
}

interface LearningOutcomesBlockData {
  __component: "blocks.learning-outcomes-block";
  id: number;
  title?: string;
  description?: string;
  outcomes?: LearningOutcomeItem[];
  columns?: "1" | "2";
  icon?: "checkmark" | "star" | "arrow" | "bullet";
  visibility?: string;
  position?: string;
}

interface LearningOutcomesBlockProps {
  data: LearningOutcomesBlockData;
  sideLoadedData: SideLoadedData;
}

const iconMap: Record<string, string> = {
  checkmark: "\u2713",
  star: "\u2605",
  arrow: "\u2192",
  bullet: "\u2022",
};

export function LearningOutcomesBlock({ data }: LearningOutcomesBlockProps) {
  if (
    (!data.outcomes || data.outcomes.length === 0) &&
    !data.title?.trim() &&
    !data.description?.trim()
  ) {
    return null;
  }

  const cols = data.columns || "2";
  const iconChar = iconMap[data.icon || "checkmark"] || "\u2713";

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

        <ul
          className={`grid ${cols === "2" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"} gap-4 w-full max-w-[900px]`}
        >
          {data.outcomes?.map((outcome) => (
            <li
              key={outcome.id}
              className="flex items-start gap-3 p-3"
            >
              <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-green-100 text-green-600 text-sm font-bold">
                {iconChar}
              </span>
              <span className="text-sm text-[var(--on-surface-default)] leading-6">
                {outcome.text}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
