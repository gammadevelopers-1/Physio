"use client";

import type { SideLoadedData } from "@/lib/strapi/types";

interface CpdTier {
  id: number;
  category: string;
  points: number;
  description?: string;
}

interface CpdCalculatorBlockData {
  __component: "blocks.cpd-calculator-block";
  id: number;
  title?: string;
  description?: string;
  tiers?: CpdTier[];
  totalLabel?: string;
  pointsLabel?: string;
  disclaimerText?: string;
  visibility?: string;
  position?: string;
}

interface CpdCalculatorBlockProps {
  data: CpdCalculatorBlockData;
  sideLoadedData: SideLoadedData;
}

export function CpdCalculatorBlock({ data }: CpdCalculatorBlockProps) {
  const total = data.tiers?.reduce((sum, t) => sum + (t.points || 0), 0) || 0;

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

        <div className="w-full max-w-[768px] flex flex-col gap-4">
          {data.tiers?.map((tier) => (
            <div
              key={tier.id}
              className="flex items-center justify-between p-4 bg-white rounded-xl border border-[var(--outline-subtle)]"
            >
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold text-sm text-[var(--on-surface-default)]">
                  {tier.category}
                </h3>
                {tier.description && (
                  <p className="text-xs text-[var(--on-surface-variant)]">
                    {tier.description}
                  </p>
                )}
              </div>
              <span className="text-lg font-bold text-[var(--surface-container-primary)]">
                {tier.points} {data.pointsLabel || "pts"}
              </span>
            </div>
          ))}

          <div className="flex items-center justify-between p-4 bg-[var(--surface-container-primary)]/5 rounded-xl border-2 border-[var(--surface-container-primary)]">
            <span className="font-semibold text-[var(--on-surface-default)]">
              {data.totalLabel || "Total"}
            </span>
            <span className="text-xl font-bold text-[var(--surface-container-primary)]">
              {total} {data.pointsLabel || "pts"}
            </span>
          </div>
        </div>

        {data.disclaimerText && (
          <p className="text-xs text-[var(--on-surface-variant)] text-center max-w-[600px]">
            {data.disclaimerText}
          </p>
        )}
      </div>
    </section>
  );
}
