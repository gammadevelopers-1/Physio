"use client";

import type {
  StatsNumbersBlockData,
  SideLoadedData,
} from "@/lib/strapi/types";

interface StatsNumbersBlockProps {
  data: StatsNumbersBlockData;
  sideLoadedData: SideLoadedData;
}

export function StatsNumbersBlock({ data }: StatsNumbersBlockProps) {
  return (
    <section className="px-4 lg:px-16 py-12 lg:py-20 bg-[var(--color-surface-page)]">
      <div className="max-w-[1280px] mx-auto flex flex-col gap-8 items-center">
        {/* Optional title and description */}
        {(data.title || data.description) && (
          <div className="flex flex-col gap-4 items-center text-center max-w-[768px]">
            {data.title && (
              <h2
                className="font-semibold text-[var(--on-surface-default)] leading-none tracking-[-0.24px]"
                style={{
                  fontSize: "var(--typeface-font-styles-heading-h1)",
                }}
              >
                {data.title}
              </h2>
            )}
            {data.description && (
              <p
                className="text-[var(--on-surface-default)] leading-7"
                style={{
                  fontSize: "var(--typeface-font-styles-heading-subheading)",
                }}
              >
                {data.description}
              </p>
            )}
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 w-full">
          {data.items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col items-center text-center gap-2 p-6 bg-[var(--color-surface-card)] rounded-2xl shadow-sm"
            >
              <span
                className="font-bold text-[var(--on-surface-default)]"
                style={{ fontSize: "40px" }}
              >
                {item.value}
                {item.suffix && (
                  <span className="text-[var(--on-surface-variant)]">
                    {item.suffix}
                  </span>
                )}
              </span>
              <span
                className="text-[var(--on-surface-variant)] leading-6"
                style={{
                  fontSize: "var(--typeface-font-styles-paragraph-text)",
                }}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
