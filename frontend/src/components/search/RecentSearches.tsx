"use client";

import { useLocale } from "next-intl";
import { Clock, X, Trash2 } from "lucide-react";

interface RecentSearchesProps {
  searches: string[];
  onSearchClick: (query: string) => void;
  onRemove: (query: string) => void;
  onClearAll: () => void;
}

const RecentSearches = ({
  searches,
  onSearchClick,
  onRemove,
  onClearAll,
}: RecentSearchesProps) => {
  const locale = useLocale();
  const isRTL = locale === "ar";

  if (searches.length === 0) return null;

  return (
    <div dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[var(--on-surface-variant)]" />
          <span className="text-sm font-medium text-[var(--on-surface-variant)]">
            {isRTL ? "عمليات البحث الأخيرة" : "Recent Searches"}
          </span>
        </div>
        <button
          onClick={onClearAll}
          className="flex items-center gap-1 text-xs text-[var(--on-surface-variant)] hover:text-[var(--feedback-error-text)] transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{isRTL ? "مسح الكل" : "Clear All"}</span>
        </button>
      </div>

      {/* Recent Search Items */}
      <div className="flex flex-wrap gap-2">
        {searches.map((search) => (
          <div
            key={search}
            className="group flex items-center gap-1 px-3 py-1.5 bg-white border border-[var(--outline-subtle)] rounded-full transition-all hover:border-[var(--surface-container-primary-2)]"
          >
            <button
              onClick={() => onSearchClick(search)}
              className="text-sm text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors"
            >
              {search}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(search);
              }}
              className="p-0.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-[var(--surface-container-default)] transition-all"
            >
              <X className="w-3.5 h-3.5 text-[var(--on-surface-variant)]" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentSearches;
