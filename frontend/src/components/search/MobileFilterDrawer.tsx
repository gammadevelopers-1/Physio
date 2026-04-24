"use client";

import { useLocale } from "next-intl";
import { X, SlidersHorizontal } from "lucide-react";
import { useState, useEffect } from "react";
import AdvancedFilters, { FilterState } from "./AdvancedFilters";

interface MobileFilterDrawerProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  coursesCount: number;
  blogsCount: number;
  onClearAll: () => void;
  activeFiltersCount: number;
}

const MobileFilterDrawer = ({
  filters,
  onFilterChange,
  coursesCount,
  blogsCount,
  onClearAll,
  activeFiltersCount,
}: MobileFilterDrawerProps) => {
  const locale = useLocale();
  const isRTL = locale === "ar";
  const [isOpen, setIsOpen] = useState(false);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  return (
    <div dir={isRTL ? "rtl" : "ltr"}>
      {/* Filter Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="lg:hidden flex items-center gap-2 px-4 py-2.5 bg-white border border-[var(--outline-subtle)] rounded-xl text-sm font-medium text-[var(--on-surface-default)] hover:bg-[var(--surface-container-default)] transition-colors"
      >
        <SlidersHorizontal className="w-5 h-5" />
        <span>{isRTL ? "فلاتر" : "Filters"}</span>
        {activeFiltersCount > 0 && (
          <span className="px-2 py-0.5 bg-[var(--surface-container-primary-2)] text-white text-xs rounded-full">
            {activeFiltersCount}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-[80]"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-[90] bg-white rounded-t-3xl transform transition-transform duration-300 ease-out ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxHeight: "90vh" }}
        dir={isRTL ? "rtl" : "ltr"}
      >
        {/* Drawer Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-[var(--color-border)] rounded-full" />
        </div>

        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 pb-4 border-b border-[var(--outline-subtle)]">
          <h2 className="text-xl font-semibold text-[var(--on-surface-default)]">
            {isRTL ? "الفلاتر" : "Filters"}
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-full hover:bg-[var(--surface-container-default)] transition-colors"
          >
            <X className="w-6 h-6 text-[var(--on-surface-variant)]" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: "calc(90vh - 140px)" }}>
          <AdvancedFilters
            filters={filters}
            onFilterChange={onFilterChange}
            coursesCount={coursesCount}
            blogsCount={blogsCount}
            onClearAll={onClearAll}
          />
        </div>

        {/* Apply Button */}
        <div className="px-5 py-4 border-t border-[var(--outline-subtle)] bg-white">
          <button
            onClick={() => setIsOpen(false)}
            className="w-full py-3.5 btn-gold text-[var(--color-button-text)] font-medium rounded-xl transition-colors"
          >
            {isRTL ? "تطبيق الفلاتر" : "Apply Filters"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileFilterDrawer;
