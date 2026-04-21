"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useLocale } from "next-intl";
import { resolveHref } from "@/lib/href-utils";
import type { FAQPage } from "@/lib/strapi/types";

interface FAQContentProps {
  strapiData?: FAQPage | null;
}

export default function FAQContent({ strapiData }: FAQContentProps) {
  const locale = useLocale();
  const isRTL = locale === "ar";

  const title = strapiData?.title || "";
  const subtitle = strapiData?.subtitle || "";
  const getInTouchLabel = strapiData?.getInTouchLabel || "";

  const items = strapiData?.items ?? [];
  const hasItems = items.length > 0;

  const [openItems, setOpenItems] = useState<number[]>(
    Array.from({ length: items.length }, (_, i) => i)
  );

  const toggleItem = (index: number) => {
    setOpenItems((prev) =>
      prev.includes(index) ? prev.filter((item) => item !== index) : [...prev, index]
    );
  };

  return (
    <section className="bg-white px-4 md:px-16 py-12 md:py-24" dir={isRTL ? "rtl" : "ltr"}>
      <div className="max-w-[1312px] mx-auto">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-20">
          {/* Title and CTA Section — each element hides when Strapi is empty */}
          {(title || subtitle || getInTouchLabel) && (
            <div className="lg:w-[500px] shrink-0">
              <div className="flex flex-col gap-6 lg:gap-8">
                {(title || subtitle) && (
                  <div className="flex flex-col gap-6">
                    {title && (
                      <h1
                        className="font-semibold tracking-[-0.24px] text-[var(--on-surface-default)]"
                        style={{ fontSize: "var(--typeface-font-styles-heading-h1)" }}
                      >
                        {title}
                      </h1>
                    )}
                    {subtitle && (
                      <p
                        className="text-[var(--on-surface-default)] leading-relaxed"
                        style={{ fontSize: "18px" }}
                      >
                        {subtitle}
                      </p>
                    )}
                  </div>
                )}
                {getInTouchLabel && (
                  <Link
                    href={resolveHref(strapiData?.getInTouchLink, locale) || "#"}
                    className="inline-flex items-center justify-center h-10 px-5 py-2 btn-gold text-[var(--on-surface-inverse)] rounded-xl text-sm font-medium w-fit"
                  >
                    {getInTouchLabel}
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* FAQ List Section */}
          <div className="flex-1 min-w-0">
            {hasItems ? (
              <div className="flex flex-col gap-6">
                {items.map((item, index) => (
                  <div key={item.id}>
                    <div className="flex flex-col gap-4">
                      <button
                        onClick={() => toggleItem(index)}
                        className="flex items-center justify-between gap-4 w-full text-start cursor-pointer group"
                      >
                        <span
                          className="flex-1 text-[var(--on-surface-default)] leading-7"
                          style={{
                            fontSize: "var(--typeface-font-styles-heading-subheading)",
                          }}
                        >
                          {item.question}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 text-[var(--on-surface-variant)] shrink-0 transition-transform duration-200 ${
                            openItems.includes(index) ? "rotate-180" : ""
                          }`}
                          strokeWidth={2}
                        />
                      </button>

                      {openItems.includes(index) && (
                        <p
                          className="text-[var(--on-surface-variant)] leading-6"
                          style={{
                            fontSize: "var(--typeface-font-styles-paragraph-text)",
                          }}
                        >
                          {item.answer}
                        </p>
                      )}
                    </div>

                    {index < items.length - 1 && (
                      <div className="h-px bg-[#C8D5E1] mt-6" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[var(--on-surface-variant)] leading-6 text-center">
                {isRTL ? "لا توجد أسئلة بعد" : "No questions yet"}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
