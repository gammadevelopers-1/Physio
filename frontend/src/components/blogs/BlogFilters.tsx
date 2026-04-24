"use client";

import { useTranslations, useLocale } from "next-intl";
import type { StrapiBlogCategory } from "@/lib/strapi/types";

interface BlogFiltersProps {
  categories: StrapiBlogCategory[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  variant?: "desktop" | "mobile";
  isRTL?: boolean;
}

const BlogFilters = ({
  categories,
  activeCategory,
  onCategoryChange,
  variant = "desktop",
  isRTL: isRTLProp,
}: BlogFiltersProps) => {
  const t = useTranslations("blogsPage");
  const locale = useLocale();
  const isRTL = isRTLProp ?? locale === "ar";

  const allLabel = t("categories.all");

  if (variant === "mobile") {
    return (
      <div className={`flex gap-2 mb-6 overflow-x-auto pb-2 -mx-4 px-4 ${isRTL ? "flex-row-reverse" : ""}`}>
        <button
          onClick={() => onCategoryChange("All")}
          className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${activeCategory === "All"
            ? "bg-[var(--color-primary)] text-white"
            : "text-[var(--on-surface-default)]"
            }`}
        >
          {allLabel}
        </button>
        {categories.map((cat) => (
          <button
            key={cat.slug}
            onClick={() => onCategoryChange(cat.slug)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${activeCategory === cat.slug
              ? "bg-[var(--color-primary)] text-white"
              : "text-[var(--on-surface-default)]"
              }`}
          >
            {cat.title}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex gap-3 mb-10 ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
      <button
        onClick={() => onCategoryChange("All")}
        className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${activeCategory === "All"
          ? "bg-[var(--color-primary)] text-white"
          : "text-[var(--on-surface-default)] hover:bg-[var(--color-border-subtle)]"
          }`}
      >
        {allLabel}
      </button>
      {categories.map((cat) => (
        <button
          key={cat.slug}
          onClick={() => onCategoryChange(cat.slug)}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${activeCategory === cat.slug
            ? "bg-[var(--color-primary)] text-white"
            : "text-[var(--on-surface-default)] hover:bg-[var(--color-border-subtle)]"
            }`}
        >
          {cat.title}
        </button>
      ))}
    </div>
  );
};

export default BlogFilters;
