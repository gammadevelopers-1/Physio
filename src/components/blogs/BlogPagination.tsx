"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";

interface BlogPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  variant?: "desktop" | "mobile";
}

const BlogPagination = ({ currentPage, totalPages, onPageChange, variant = "desktop" }: BlogPaginationProps) => {
  if (totalPages <= 1) return null;

  if (variant === "mobile") {
    return (
      <div className="flex items-center justify-center gap-3 mt-8">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="flex items-center gap-1.5 h-10 px-4 rounded-full border border-[#E5E7EB] text-xs font-medium disabled:opacity-50"
        >
          <ArrowLeft className="w-3 h-3" />
          Previous
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
          className="flex items-center gap-1.5 h-10 px-4 rounded-full border border-[#E5E7EB] text-xs font-medium disabled:opacity-50"
        >
          Continue
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-4 mt-12">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#E5E7EB] text-sm font-medium text-[var(--on-surface-default)] hover:bg-[#F4F4F5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ArrowLeft className="w-4 h-4" />
        Previous
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
        className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#E5E7EB] text-sm font-medium text-[var(--on-surface-default)] hover:bg-[#F4F4F5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Continue
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};

export default BlogPagination;
