"use client";

import type { SideLoadedData } from "@/lib/strapi/types";

interface BlogPostsGridBlockData {
  __component: "blocks.blog-posts-grid-block";
  id: number;
  title?: string;
  description?: string;
  maxItems?: number;
  viewAllLabel?: string;
  viewAllUrl?: string;
  filterByCategory?: string;
  columns?: "2" | "3";
  visibility?: string;
  position?: string;
}

interface BlogPostsGridBlockProps {
  data: BlogPostsGridBlockData;
  sideLoadedData: SideLoadedData;
}

const columnClasses: Record<string, string> = {
  "2": "grid-cols-1 md:grid-cols-2",
  "3": "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
};

export function BlogPostsGridBlock({ data }: BlogPostsGridBlockProps) {
  const cols = data.columns || "3";

  return (
    <section className="px-4 lg:px-16 py-12 lg:py-20">
      <div className="max-w-[1280px] mx-auto flex flex-col gap-8 items-center">
        {(data.title || data.description) && (
          <div className="flex flex-col gap-4 items-center text-center max-w-[768px]">
            {data.title && (
              <h2
                className="font-semibold text-[var(--on-surface-default)] leading-none tracking-[-0.24px]"
                style={{ fontSize: "var(--typeface-font-styles-heading-h1)" }}
              >
                {data.title}
              </h2>
            )}
            {data.description && (
              <p
                className="text-[var(--on-surface-default)] leading-7"
                style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
              >
                {data.description}
              </p>
            )}
          </div>
        )}

        <div className={`grid ${columnClasses[cols]} gap-6 w-full`}>
          {Array.from({ length: data.maxItems || 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-[var(--outline-subtle)] overflow-hidden shadow-sm animate-pulse"
            >
              <div className="w-full h-48 bg-gray-200" />
              <div className="p-5 flex flex-col gap-3">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>

        {data.viewAllUrl && (
          <a
            href={data.viewAllUrl}
            className="text-sm font-medium text-[var(--surface-container-primary)] hover:underline"
          >
            {data.viewAllLabel || "View all posts"}
          </a>
        )}
      </div>
    </section>
  );
}
