"use client";

import type { SideLoadedData } from "@/lib/strapi/types";

interface PricingPlan {
  id: number;
  heading: string;
  highlighted?: boolean;
  price?: string;
  features?: string;
  buttonLabel?: string;
  buttonUrl?: string;
}

interface PricingTableBlockData {
  __component: "blocks.pricing-table-block";
  id: number;
  title?: string;
  description?: string;
  plans?: PricingPlan[];
  visibility?: string;
  position?: string;
}

interface PricingTableBlockProps {
  data: PricingTableBlockData;
  sideLoadedData: SideLoadedData;
}

export function PricingTableBlock({ data }: PricingTableBlockProps) {
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
          {data.plans?.map((plan) => {
            const featureList = plan.features
              ? plan.features.split("\n").filter(Boolean)
              : [];
            return (
              <div
                key={plan.id}
                className={`flex flex-col gap-4 p-6 rounded-2xl border ${
                  plan.highlighted
                    ? "border-[var(--surface-container-primary)] ring-2 ring-[var(--surface-container-primary)]"
                    : "border-[var(--outline-subtle)]"
                } bg-white shadow-sm`}
              >
                <h3
                  className="font-semibold text-[var(--on-surface-default)]"
                  style={{ fontSize: "var(--typeface-font-styles-heading-h4)" }}
                >
                  {plan.heading}
                </h3>
                {plan.price && (
                  <span className="text-3xl font-bold text-[var(--surface-container-primary)]">
                    {plan.price}
                  </span>
                )}
                {featureList.length > 0 && (
                  <ul className="flex flex-col gap-2 flex-1">
                    {featureList.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[var(--on-surface-default)]">
                        <span className="text-green-500 mt-0.5">&#10003;</span>
                        {feat}
                      </li>
                    ))}
                  </ul>
                )}
                {plan.buttonUrl && plan.buttonLabel && (
                  <a
                    href={plan.buttonUrl}
                    className={`mt-auto text-center px-6 py-3 rounded-full text-sm font-medium ${
                      plan.highlighted
                        ? "bg-[var(--color-primary)] text-white"
                        : "border border-[var(--outline-subtle)] text-[var(--on-surface-default)] hover:bg-gray-50"
                    }`}
                  >
                    {plan.buttonLabel}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
