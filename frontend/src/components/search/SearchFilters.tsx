"use client";

import { useTranslations, useLocale } from "next-intl";

export type SearchFilterType = "all" | "courses" | "blogs";

interface SearchFiltersProps {
  activeFilter: SearchFilterType;
  onFilterChange: (filter: SearchFilterType) => void;
  coursesCount: number;
  blogsCount: number;
}

const SearchFilters = ({
  activeFilter,
  onFilterChange,
  coursesCount,
  blogsCount,
}: SearchFiltersProps) => {
  const t = useTranslations("searchPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const filters: { key: SearchFilterType; label: string; count?: number }[] = [
    { key: "all", label: t("filters.all"), count: coursesCount + blogsCount },
    { key: "courses", label: t("filters.courses"), count: coursesCount },
    { key: "blogs", label: t("filters.blogs"), count: blogsCount },
  ];

  return (
    <div
      className={`flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide ${
        isRTL ? "flex-row-reverse" : ""
      }`}
    >
      {filters.map((filter) => (
        <button
          key={filter.key}
          onClick={() => onFilterChange(filter.key)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 ${
            activeFilter === filter.key
              ? "bg-[var(--color-primary)] text-[var(--color-button-text)]"
              : "bg-[var(--color-surface-card)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
          } ${isRTL ? "flex-row-reverse" : ""}`}
        >
          <span>{filter.label}</span>
          {filter.count !== undefined && (
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${
                activeFilter === filter.key
                  ? "bg-white/20 text-[var(--color-button-text)]"
                  : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
              }`}
            >
              {filter.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

export default SearchFilters;
