"use client";

import { useTranslations, useLocale } from "next-intl";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

export interface FilterState {
  contentType: "all" | "courses" | "blogs";
  courseTypes: string[];
  certifications: string[];
  priceRange: "all" | "free" | "paid";
  sortBy: "relevance" | "newest" | "price-low" | "price-high";
}

interface AdvancedFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  coursesCount: number;
  blogsCount: number;
  onClearAll: () => void;
}

const COURSE_TYPES = ["Live Online", "On-site courses", "Online courses", "Hybrid"];
const COURSE_TYPES_AR: Record<string, string> = {
  "Live Online": "بث مباشر",
  "On-site courses": "دورات حضورية",
  "Online courses": "دورات إلكترونية",
  "Hybrid": "هجين",
};
const CERTIFICATIONS = ["BHA", "NHA", "SCFHS"];

const AdvancedFilters = ({
  filters,
  onFilterChange,
  coursesCount,
  blogsCount,
  onClearAll,
}: AdvancedFiltersProps) => {
  const t = useTranslations("searchPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    contentType: true,
    courseType: false,
    certification: false,
    price: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const toggleArrayFilter = (key: "courseTypes" | "certifications", value: string) => {
    const currentArray = filters[key];
    const newArray = currentArray.includes(value)
      ? currentArray.filter(v => v !== value)
      : [...currentArray, value];
    updateFilter(key, newArray);
  };

  const hasActiveFilters =
    filters.contentType !== "all" ||
    filters.courseTypes.length > 0 ||
    filters.certifications.length > 0 ||
    filters.priceRange !== "all";

  const contentTypeOptions = [
    { key: "all" as const, label: t("filters.all"), count: coursesCount + blogsCount },
    { key: "courses" as const, label: t("filters.courses"), count: coursesCount },
    { key: "blogs" as const, label: t("filters.blogs"), count: blogsCount },
  ];

  const sortOptions = [
    { key: "relevance" as const, label: isRTL ? "الأكثر صلة" : "Most Relevant" },
    { key: "newest" as const, label: isRTL ? "الأحدث" : "Newest First" },
    { key: "price-low" as const, label: isRTL ? "السعر: من الأقل للأعلى" : "Price: Low to High" },
    { key: "price-high" as const, label: isRTL ? "السعر: من الأعلى للأقل" : "Price: High to Low" },
  ];

  const priceOptions = [
    { key: "all" as const, label: isRTL ? "الكل" : "All Prices" },
    { key: "free" as const, label: isRTL ? "مجاني" : "Free" },
    { key: "paid" as const, label: isRTL ? "مدفوع" : "Paid" },
  ];

  return (
    <div className="w-full" dir={isRTL ? "rtl" : "ltr"}>
      {/* Sort & Clear Row */}
      <div className="flex items-center justify-between mb-4">
        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--on-surface-variant)]">
            {isRTL ? "ترتيب حسب:" : "Sort by:"}
          </span>
          <select
            value={filters.sortBy}
            onChange={(e) => updateFilter("sortBy", e.target.value as FilterState["sortBy"])}
            className="px-3 py-2 bg-white border border-[var(--outline-subtle)] rounded-lg text-sm text-[var(--on-surface-default)] focus:outline-none focus:border-[var(--surface-container-primary-2)] cursor-pointer"
          >
            {sortOptions.map(option => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
        </div>

        {/* Clear All Button */}
        {hasActiveFilters && (
          <button
            onClick={onClearAll}
            className="flex items-center gap-1 text-sm text-[var(--feedback-error-text)] hover:underline"
          >
            <X className="w-4 h-4" />
            <span>{t("clearAll")}</span>
          </button>
        )}
      </div>

      {/* Content Type Pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {contentTypeOptions.map(option => (
          <button
            key={option.key}
            onClick={() => updateFilter("contentType", option.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              filters.contentType === option.key
                ? "bg-[var(--surface-container-primary-2)] text-white"
                : "bg-[var(--surface-container-default)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-low)]"
            }`}
          >
            <span>{option.label}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              filters.contentType === option.key
                ? "bg-white/20"
                : "bg-[var(--surface-container-low)]"
            }`}>
              {option.count}
            </span>
          </button>
        ))}
      </div>

      {/* Advanced Filter Sections - Only show for courses */}
      {filters.contentType !== "blogs" && (
        <div className="space-y-3 border-t border-[var(--outline-subtle)] pt-4">
          {/* Course Type Filter */}
          <div className="border border-[var(--outline-subtle)] rounded-xl overflow-hidden">
            <button
              onClick={() => toggleSection("courseType")}
              className="w-full flex items-center justify-between px-4 py-3 bg-[var(--surface-container-default)] hover:bg-[var(--surface-container-low)] transition-colors"
            >
              <span className="font-medium text-[var(--on-surface-default)]">
                {isRTL ? "نوع الدورة" : "Course Type"}
                {filters.courseTypes.length > 0 && (
                  <span className={`${isRTL ? "me-2" : "ms-2"} px-2 py-0.5 bg-[var(--surface-container-primary-2)] text-white text-xs rounded-full`}>
                    {filters.courseTypes.length}
                  </span>
                )}
              </span>
              {expandedSections.courseType ? (
                <ChevronUp className="w-5 h-5 text-[var(--on-surface-variant)]" />
              ) : (
                <ChevronDown className="w-5 h-5 text-[var(--on-surface-variant)]" />
              )}
            </button>
            {expandedSections.courseType && (
              <div className="p-4 bg-white space-y-2">
                {COURSE_TYPES.map(type => (
                  <label
                    key={type}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--surface-container-default)] cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={filters.courseTypes.includes(type)}
                      onChange={() => toggleArrayFilter("courseTypes", type)}
                      className="w-5 h-5 rounded border-[var(--outline-subtle)] text-[var(--surface-container-primary-2)] focus:ring-[var(--surface-container-primary-2)]"
                    />
                    <span className="text-sm text-[var(--on-surface-default)]">
                      {isRTL ? COURSE_TYPES_AR[type] : type}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Certification Filter */}
          <div className="border border-[var(--outline-subtle)] rounded-xl overflow-hidden">
            <button
              onClick={() => toggleSection("certification")}
              className="w-full flex items-center justify-between px-4 py-3 bg-[var(--surface-container-default)] hover:bg-[var(--surface-container-low)] transition-colors"
            >
              <span className="font-medium text-[var(--on-surface-default)]">
                {isRTL ? "الشهادة" : "Certification"}
                {filters.certifications.length > 0 && (
                  <span className={`${isRTL ? "me-2" : "ms-2"} px-2 py-0.5 bg-[var(--surface-container-primary-2)] text-white text-xs rounded-full`}>
                    {filters.certifications.length}
                  </span>
                )}
              </span>
              {expandedSections.certification ? (
                <ChevronUp className="w-5 h-5 text-[var(--on-surface-variant)]" />
              ) : (
                <ChevronDown className="w-5 h-5 text-[var(--on-surface-variant)]" />
              )}
            </button>
            {expandedSections.certification && (
              <div className="p-4 bg-white space-y-2">
                {CERTIFICATIONS.map(cert => (
                  <label
                    key={cert}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--surface-container-default)] cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={filters.certifications.includes(cert)}
                      onChange={() => toggleArrayFilter("certifications", cert)}
                      className="w-5 h-5 rounded border-[var(--outline-subtle)] text-[var(--surface-container-primary-2)] focus:ring-[var(--surface-container-primary-2)]"
                    />
                    <span className="text-sm text-[var(--on-surface-default)]">{cert}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Price Filter */}
          <div className="border border-[var(--outline-subtle)] rounded-xl overflow-hidden">
            <button
              onClick={() => toggleSection("price")}
              className="w-full flex items-center justify-between px-4 py-3 bg-[var(--surface-container-default)] hover:bg-[var(--surface-container-low)] transition-colors"
            >
              <span className="font-medium text-[var(--on-surface-default)]">
                {isRTL ? "السعر" : "Price"}
                {filters.priceRange !== "all" && (
                  <span className={`${isRTL ? "me-2" : "ms-2"} px-2 py-0.5 bg-[var(--surface-container-primary-2)] text-white text-xs rounded-full`}>
                    1
                  </span>
                )}
              </span>
              {expandedSections.price ? (
                <ChevronUp className="w-5 h-5 text-[var(--on-surface-variant)]" />
              ) : (
                <ChevronDown className="w-5 h-5 text-[var(--on-surface-variant)]" />
              )}
            </button>
            {expandedSections.price && (
              <div className="p-4 bg-white space-y-2">
                {priceOptions.map(option => (
                  <label
                    key={option.key}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--surface-container-default)] cursor-pointer transition-colors"
                  >
                    <input
                      type="radio"
                      name="price"
                      checked={filters.priceRange === option.key}
                      onChange={() => updateFilter("priceRange", option.key)}
                      className="w-5 h-5 border-[var(--outline-subtle)] text-[var(--surface-container-primary-2)] focus:ring-[var(--surface-container-primary-2)]"
                    />
                    <span className="text-sm text-[var(--on-surface-default)]">{option.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedFilters;
