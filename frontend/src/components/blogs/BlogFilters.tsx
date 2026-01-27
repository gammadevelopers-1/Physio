"use client";

interface BlogFiltersProps {
  categories: string[];
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  variant?: "desktop" | "mobile";
}

const BlogFilters = ({ categories, activeCategory, onCategoryChange, variant = "desktop" }: BlogFiltersProps) => {
  if (variant === "mobile") {
    return (
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-4 px-4">
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
            {category}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-3 mb-10">
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
          {category}
        </button>
      ))}
    </div>
  );
};

export default BlogFilters;
