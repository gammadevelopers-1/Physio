"use client";

import { useLocale, useTranslations } from "next-intl";
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
  const t = useTranslations("searchPage");
  const isRTL = locale === "ar";

  if (searches.length === 0) return null;

  return (
    <div dir={isRTL ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[var(--color-icon)]" />
          <span className="text-sm font-medium text-[var(--color-text-secondary)]">
            {t("recentSearches")}
          </span>
        </div>
        <button
          onClick={onClearAll}
          className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--feedback-error-text)] transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5 text-[var(--color-icon)]" />
          <span>{t("clearAll")}</span>
        </button>
      </div>

      {/* Recent Search Items */}
      <div className="flex flex-wrap gap-2">
        {searches.map((search) => (
          <div
            key={search}
            className="group flex items-center gap-1 px-3 py-1.5 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-full transition-all hover:border-[var(--color-primary)]"
          >
            <button
              onClick={() => onSearchClick(search)}
              className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {search}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(search);
              }}
              className="p-0.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-[var(--color-surface-card)] transition-all"
            >
              <X className="w-3.5 h-3.5 text-[var(--color-icon)]" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentSearches;
