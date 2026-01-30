"use client";

import { useTranslations, useLocale } from "next-intl";

interface BlogFiltersProps {
  categories: string[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  variant?: "desktop" | "mobile";
  isRTL?: boolean;
}

const BlogFilters = ({ categories, activeCategory, onCategoryChange, variant = "desktop", isRTL: isRTLProp }: BlogFiltersProps) => {
  const t = useTranslations("blogsPage");
  const locale = useLocale();
  const isRTL = isRTLProp ?? locale === "ar";

  // Map category names to translation keys
  const getCategoryTranslation = (category: string): string => {
    const categoryMap: { [key: string]: string } = {
      "All": t("categories.all"),
      "Digital Health": t("categories.digitalHealth"),
      "Training": t("categories.training"),
      "Medical": t("categories.medical"),
      "Research": t("categories.research"),
    };
    return categoryMap[category] || category;
  };

  if (variant === "mobile") {
    return (
      <div className={`flex gap-2 mb-6 overflow-x-auto pb-2 -mx-4 px-4 ${isRTL ? "flex-row-reverse" : ""}`}>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              activeCategory === category
                ? "bg-[#F4F4F5] text-[var(--on-surface-default)]"
                : "text-[var(--on-surface-default)]"
            }`}
          >
            {getCategoryTranslation(category)}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex gap-3 mb-10 ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => onCategoryChange(category)}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-colors ${
            activeCategory === category
              ? "bg-[#F4F4F5] text-[var(--on-surface-default)]"
              : "text-[var(--on-surface-default)] hover:bg-[#F4F4F5]"
          }`}
        >
          {getCategoryTranslation(category)}
        </button>
      ))}
    </div>
  );
};

export default BlogFilters;
