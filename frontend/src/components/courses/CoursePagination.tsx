"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

interface CoursePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  variant?: "desktop" | "mobile";
  isRTL?: boolean;
}

const CoursePagination = ({
  currentPage,
  totalPages,
  onPageChange,
  variant = "desktop",
  isRTL = false,
}: CoursePaginationProps) => {
  const t = useTranslations("coursesPage");

  if (totalPages <= 1) return null;

  // Generate page numbers to display with ellipsis logic
  const getVisiblePages = () => {
    const pages: (number | string)[] = [];

    if (totalPages <= 5) {
      // Show all pages if 5 or less
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push("...");
      }

      // Pages around current
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }

      if (currentPage < totalPages - 2) {
        pages.push("...");
      }

      // Always show last page
      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const visiblePages = getVisiblePages();

  if (variant === "mobile") {
    return (
      <div className="flex items-center justify-center gap-2 mt-8">
        {isRTL ? (
          <>
            {/* RTL Mobile: Previous on LEFT, Continue on RIGHT */}
            {/* Due to parent RTL, flex items are reversed, so we put Continue first in DOM */}

            {/* Continue button - appears on RIGHT due to parent RTL */}
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] disabled:text-[var(--color-text-secondary)] disabled:cursor-not-allowed rounded-lg bg-[var(--color-border-subtle)]"
            >
              <span className="flex items-center gap-1" dir="ltr" style={{ display: "inline-flex", direction: "ltr" }}>
                {t("pagination.continue")}
                <ChevronRight className="w-4 h-4" />
              </span>
            </button>

            <div className="flex items-center gap-1" dir="ltr" style={{ direction: "ltr" }}>
              {visiblePages.map((page, index) => (
                page === "..." ? (
                  <span key={`ellipsis-${index}`} className="w-8 h-8 flex items-center justify-center text-[var(--color-text-secondary)] text-sm">
                    ...
                  </span>
                ) : (
                  <button
                    key={page}
                    onClick={() => onPageChange(page as number)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page
                        ? "bg-[var(--color-text-primary)] text-white"
                        : "text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)]"
                    }`}
                  >
                    {page}
                  </button>
                )
              ))}
            </div>

            {/* Previous button - appears on LEFT due to parent RTL */}
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] disabled:text-[var(--color-text-secondary)] disabled:cursor-not-allowed rounded-lg bg-[var(--color-border-subtle)]"
            >
              <span className="flex items-center gap-1" dir="ltr" style={{ display: "inline-flex", direction: "ltr" }}>
                <ChevronLeft className="w-4 h-4" />
                {t("pagination.previous")}
              </span>
            </button>
          </>
        ) : (
          <>
            {/* LTR Mobile: Previous first, pages, Continue */}
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] disabled:text-[var(--color-text-secondary)] disabled:cursor-not-allowed rounded-lg bg-[var(--color-border-subtle)]"
            >
              <ChevronLeft className="w-4 h-4" />
              {t("pagination.previous")}
            </button>

            <div className="flex items-center gap-1">
              {visiblePages.map((page, index) => (
                page === "..." ? (
                  <span key={`ellipsis-${index}`} className="w-8 h-8 flex items-center justify-center text-[var(--color-text-secondary)] text-sm">
                    ...
                  </span>
                ) : (
                  <button
                    key={page}
                    onClick={() => onPageChange(page as number)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page
                        ? "bg-[var(--color-text-primary)] text-white"
                        : "text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)]"
                    }`}
                  >
                    {page}
                  </button>
                )
              ))}
            </div>

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] disabled:text-[var(--color-text-secondary)] disabled:cursor-not-allowed rounded-lg bg-[var(--color-border-subtle)]"
            >
              {t("pagination.continue")}
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    );
  }

  // For RTL: Previous on left, Continue on right (matching Figma exactly)
  // For LTR: Previous on left, Continue on right
  return (
    <div className="flex items-center justify-center gap-4 mt-12">
      {isRTL ? (
        <>
          {/* RTL Desktop: Previous on LEFT, Continue on RIGHT */}
          {/* Due to parent RTL, flex items are reversed, so we put Continue first in DOM */}

          {/* Continue button - appears on RIGHT due to parent RTL */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] disabled:text-[var(--color-text-secondary)] disabled:cursor-not-allowed hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors"
          >
            <span className="flex items-center gap-2" dir="ltr" style={{ display: "inline-flex", direction: "ltr" }}>
              {t("pagination.continue")}
              <ChevronRight className="w-4 h-4" />
            </span>
          </button>

          <div className="flex items-center gap-2" dir="ltr" style={{ direction: "ltr" }}>
            {visiblePages.map((page, index) => (
              page === "..." ? (
                <span key={`ellipsis-${index}`} className="w-10 h-10 flex items-center justify-center text-[var(--color-text-secondary)] text-sm">
                  ...
                </span>
              ) : (
                <button
                  key={page}
                  onClick={() => onPageChange(page as number)}
                  className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === page
                      ? "bg-[var(--color-text-primary)] text-white"
                      : "text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)]"
                  }`}
                >
                  {page}
                </button>
              )
            ))}
          </div>

          {/* Previous button - appears on LEFT due to parent RTL */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] disabled:text-[var(--color-text-secondary)] disabled:cursor-not-allowed hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors"
          >
            <span className="flex items-center gap-2" dir="ltr" style={{ display: "inline-flex", direction: "ltr" }}>
              <ChevronLeft className="w-4 h-4" />
              {t("pagination.previous")}
            </span>
          </button>
        </>
      ) : (
        <>
          {/* LTR: Previous first, then pages, then Continue */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] disabled:text-[var(--color-text-secondary)] disabled:cursor-not-allowed hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            {t("pagination.previous")}
          </button>

          <div className="flex items-center gap-2">
            {visiblePages.map((page, index) => (
              page === "..." ? (
                <span key={`ellipsis-${index}`} className="w-10 h-10 flex items-center justify-center text-[var(--color-text-secondary)] text-sm">
                  ...
                </span>
              ) : (
                <button
                  key={page}
                  onClick={() => onPageChange(page as number)}
                  className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === page
                      ? "bg-[var(--color-text-primary)] text-white"
                      : "text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)]"
                  }`}
                >
                  {page}
                </button>
              )
            ))}
          </div>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] disabled:text-[var(--color-text-secondary)] disabled:cursor-not-allowed hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors"
          >
            {t("pagination.continue")}
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
};

export default CoursePagination;
