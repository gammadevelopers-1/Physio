"use client";

import type { SideLoadedData } from "@/lib/strapi/types";

interface ProgressMetric {
  id: number;
  label: string;
  value: number;
  maxValue?: number;
  suffix?: string;
}

interface StudentProgressBlockData {
  __component: "blocks.student-progress-block";
  id: number;
  title?: string;
  description?: string;
  metrics?: ProgressMetric[];
  variant?: "bars" | "circles" | "numbers";
  visibility?: string;
  position?: string;
}

interface StudentProgressBlockProps {
  data: StudentProgressBlockData;
  sideLoadedData: SideLoadedData;
}

export function StudentProgressBlock({ data }: StudentProgressBlockProps) {
  const variant = data.variant || "bars";

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
            variant === "numbers"
              ? "grid grid-cols-2 md:grid-cols-4 gap-6 w-full"
              : "flex flex-col gap-6 w-full max-w-[768px]"
          }
        >
          {data.metrics?.map((metric) => {
            const max = metric.maxValue || 100;
            const pct = Math.min(Math.round((metric.value / max) * 100), 100);
            const suffix = metric.suffix ?? "%";

            if (variant === "numbers") {
              return (
                <div
                  key={metric.id}
                  className="flex flex-col items-center gap-2 p-4 bg-[var(--color-surface-card)] rounded-2xl border border-[var(--outline-subtle)]"
                >
                  <span className="text-3xl font-bold text-[var(--surface-container-primary)]">
                    {metric.value}{suffix}
                  </span>
                  <span className="text-sm text-[var(--on-surface-variant)] text-center">
                    {metric.label}
                  </span>
                </div>
              );
            }

            if (variant === "circles") {
              const r = 40;
              const circ = 2 * Math.PI * r;
              const offset = circ - (pct / 100) * circ;
              return (
                <div key={metric.id} className="flex items-center gap-4">
                  <svg width="100" height="100" className="flex-shrink-0">
                    <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-border)" strokeWidth="8" />
                    <circle
                      cx="50"
                      cy="50"
                      r={r}
                      fill="none"
                      stroke="var(--surface-container-primary)"
                      strokeWidth="8"
                      strokeDasharray={circ}
                      strokeDashoffset={offset}
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                    />
                    <text x="50" y="55" textAnchor="middle" className="text-sm font-bold fill-[var(--on-surface-default)]">
                      {metric.value}{suffix}
                    </text>
                  </svg>
                  <span className="text-sm text-[var(--on-surface-default)]">{metric.label}</span>
                </div>
              );
            }

            // bars (default)
            return (
              <div key={metric.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--on-surface-default)]">
                    {metric.label}
                  </span>
                  <span className="text-sm font-bold text-[var(--surface-container-primary)]">
                    {metric.value}{suffix}
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--color-primary)]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
