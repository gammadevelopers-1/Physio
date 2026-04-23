"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";

interface BlogPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  variant?: "desktop" | "mobile";
  isRTL?: boolean;
}

const BlogPagination = ({ currentPage, totalPages, onPageChange, variant = "desktop", isRTL: isRTLProp }: BlogPaginationProps) => {
  const t = useTranslations("blogsPage");
  const locale = useLocale();
  const isRTL = isRTLProp ?? locale === "ar";

  if (totalPages <= 1) return null;

  // Always use ArrowLeft for Previous, ArrowRight for Continue
  // Don't swap icons - just control button positions with flex-row-reverse on container

  if (variant === "mobile") {
    return (
      <div className={`flex items-center justify-center gap-3 mt-8 ${isRTL ? "flex-row-reverse" : ""}`}>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-10 px-4 rounded-full border border-[var(--color-border)] text-xs font-medium disabled:opacity-50"
        >
          <span className="flex items-center gap-1.5" dir="ltr" style={{ display: "inline-flex", direction: "ltr" }}>
            <ArrowLeft className="w-3 h-3" />
            {t("pagination.previous")}
          </span>
        </button>

        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`w-8 h-8 rounded-lg text-xs font-medium ${
                currentPage === page
                  ? "bg-[#F4F4F5] text-[var(--on-surface-default)]"
                  : "text-[var(--on-surface-variant)]"
              }`}
            >
              {page}
            </button>
          ))}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="h-10 px-4 rounded-full border border-[var(--color-border)] text-xs font-medium disabled:opacity-50"
        >
          <span className="flex items-center gap-1.5" dir="ltr" style={{ display: "inline-flex", direction: "ltr" }}>
            {t("pagination.continue")}
            <ArrowRight className="w-3 h-3" />
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center gap-4 mt-12 ${isRTL ? "flex-row-reverse" : ""}`}>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-5 py-2.5 rounded-full border border-[var(--color-border)] text-sm font-medium text-[var(--on-surface-default)] hover:bg-[#F4F4F5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="flex items-center gap-2" dir="ltr" style={{ display: "inline-flex", direction: "ltr" }}>
          <ArrowLeft className="w-4 h-4" />
          {t("pagination.previous")}
        </span>
      </button>

      <div className="flex items-center gap-2">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
              currentPage === page
                ? "bg-[#F4F4F5] text-[var(--on-surface-default)]"
                : "text-[var(--on-surface-variant)] hover:bg-[#F4F4F5]"
            }`}
          >
            {page}
          </button>
        ))}
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-5 py-2.5 rounded-full border border-[var(--color-border)] text-sm font-medium text-[var(--on-surface-default)] hover:bg-[#F4F4F5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="flex items-center gap-2" dir="ltr" style={{ display: "inline-flex", direction: "ltr" }}>
          {t("pagination.continue")}
          <ArrowRight className="w-4 h-4" />
        </span>
      </button>
    </div>
  );
};

export default BlogPagination;
