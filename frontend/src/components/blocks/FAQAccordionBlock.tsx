"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type {
  FAQAccordionBlockData,
  SideLoadedData,
} from "@/lib/strapi/types";

interface FAQAccordionBlockProps {
  data: FAQAccordionBlockData;
  sideLoadedData: SideLoadedData;
}

export function FAQAccordionBlock({ data }: FAQAccordionBlockProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <section className="px-4 lg:px-16 py-12 lg:py-20">
      <div className="max-w-[800px] mx-auto flex flex-col gap-8">
        {/* Optional title and subtitle */}
        {(data.title || data.subtitle) && (
          <div className="flex flex-col gap-4 items-center text-center">
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
            {data.subtitle && (
              <p
                className="text-[var(--on-surface-variant)] leading-7"
                style={{
                  fontSize: "var(--typeface-font-styles-heading-subheading)",
                }}
              >
                {data.subtitle}
              </p>
            )}
          </div>
        )}

        {/* Accordion items */}
        <div className="flex flex-col divide-y divide-[var(--outline-subtle)]">
          {data.items.map((item, index) => (
            <div key={item.id} className="py-4">
              <button
                onClick={() => toggle(index)}
                className="flex items-center justify-between w-full text-left gap-4"
              >
                <span
                  className="font-medium text-[var(--on-surface-default)]"
                  style={{
                    fontSize: "var(--typeface-font-styles-heading-h5)",
                  }}
                >
                  {item.question}
                </span>
                <ChevronDown
                  className={`w-5 h-5 text-[var(--on-surface-variant)] shrink-0 transition-transform duration-200 ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                  strokeWidth={1.5}
                />
              </button>
              {openIndex === index && (
                <div
                  className="mt-3 text-[var(--on-surface-variant)] leading-7"
                  style={{
                    fontSize: "var(--typeface-font-styles-paragraph-text)",
                  }}
                >
                  {item.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
