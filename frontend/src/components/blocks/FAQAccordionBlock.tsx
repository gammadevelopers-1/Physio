"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type {
  FAQAccordionBlockData,
  SideLoadedData,
} from "@/lib/strapi/types";

interface FAQAccordionBlockProps {
  data: FAQAccordionBlockData;
  sideLoadedData: SideLoadedData;
}

export function FAQAccordionBlock({ data }: FAQAccordionBlockProps) {
  const allowMultiple = (data as any).allowMultipleOpen ?? false;

  // Build initial open state from defaultOpen flags
  const initialOpen = new Set<number>();
  data.items.forEach((item, index) => {
    if ((item as any).defaultOpen) initialOpen.add(index);
  });

  const [openIndices, setOpenIndices] = useState<Set<number>>(initialOpen);

  const toggle = (index: number) => {
    setOpenIndices((prev) => {
      const next = new Set(allowMultiple ? prev : []);
      if (prev.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <section className="px-4 lg:px-16 py-12 lg:py-20">
      <div className="max-w-[800px] mx-auto flex flex-col gap-8">
        {/* Optional title and subtitle */}
        {(data.title || data.subtitle || (data as any).description) && (
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
            {(data.subtitle || (data as any).description) && (
              <p
                className="text-[var(--on-surface-variant)] leading-7"
                style={{
                  fontSize: "var(--typeface-font-styles-heading-subheading)",
                }}
              >
                {data.subtitle || (data as any).description}
              </p>
            )}
          </div>
        )}

        {/* Accordion items */}
        <div className="flex flex-col divide-y divide-[var(--outline-subtle)]">
          {data.items.map((item, index) => {
            const isOpen = openIndices.has(index);
            return (
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
                    {item.question || (item as any).title}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-[var(--on-surface-variant)] shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    strokeWidth={1.5}
                  />
                </button>
                {isOpen && (
                  <div
                    className="mt-3 text-[var(--on-surface-variant)] leading-7"
                    style={{
                      fontSize: "var(--typeface-font-styles-paragraph-text)",
                    }}
                  >
                    <ReactMarkdown>{item.answer || (item as any).content}</ReactMarkdown>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
