"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface CoursePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  variant?: "desktop" | "mobile";
}

const CoursePagination = ({
  currentPage,
  totalPages,
  onPageChange,
  variant = "desktop",
}: CoursePaginationProps) => {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  if (variant === "mobile") {
    return (
      <div className="flex items-center justify-between mt-8">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-[#06080b] disabled:text-[#A1A1AA] disabled:cursor-not-allowed rounded-full bg-[#F4F4F5]"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        <div className="flex items-center gap-2">
          {pages.map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                currentPage === page
                  ? "bg-[#06080b] text-white"
                  : "text-[#06080b] hover:bg-[#F4F4F5]"
              }`}
            >
              {page}
            </button>
          ))}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-[#06080b] disabled:text-[#A1A1AA] disabled:cursor-not-allowed rounded-full bg-[#F4F4F5]"
        >
          Continue
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between mt-12">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#06080b] disabled:text-[#A1A1AA] disabled:cursor-not-allowed hover:bg-[#F4F4F5] rounded-lg transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Previous
      </button>

      <div className="flex items-center gap-2">
        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
              currentPage === page
                ? "bg-[#06080b] text-white"
                : "text-[#06080b] hover:bg-[#F4F4F5]"
            }`}
          >
            {page}
          </button>
        ))}
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#06080b] disabled:text-[#A1A1AA] disabled:cursor-not-allowed hover:bg-[#F4F4F5] rounded-lg transition-colors"
      >
        Continue
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

export default CoursePagination;
