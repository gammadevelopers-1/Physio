"use client";

import type { SideLoadedData } from "@/lib/strapi/types";

interface SocialPost {
  id: number;
  platform: "instagram" | "twitter" | "linkedin" | "facebook" | "youtube" | "tiktok";
  embedUrl: string;
  caption?: string;
}

interface SocialFeedBlockData {
  __component: "blocks.social-feed-block";
  id: number;
  title?: string;
  description?: string;
  posts?: SocialPost[];
  columns?: "2" | "3" | "4";
  visibility?: string;
  position?: string;
}

interface SocialFeedBlockProps {
  data: SocialFeedBlockData;
  sideLoadedData: SideLoadedData;
}

const platformColors: Record<string, string> = {
  instagram: "bg-pink-50 text-pink-600",
  twitter: "bg-sky-50 text-sky-600",
  linkedin: "bg-blue-50 text-blue-600",
  facebook: "bg-indigo-50 text-indigo-600",
  youtube: "bg-red-50 text-red-600",
  tiktok: "bg-gray-50 text-gray-800",
};

const columnClasses: Record<string, string> = {
  "2": "grid-cols-1 md:grid-cols-2",
  "3": "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  "4": "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
};

export function SocialFeedBlock({ data }: SocialFeedBlockProps) {
  if (
    (!data.posts || data.posts.length === 0) &&
    !data.title?.trim() &&
    !data.description?.trim()
  ) {
    return null;
  }

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
          {data.posts?.map((post) => (
            <a
              key={post.id}
              href={post.embedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col gap-3 p-5 bg-[var(--color-surface-card)] rounded-2xl border border-[var(--outline-subtle)] shadow-sm hover:shadow-md transition-shadow"
            >
              <span
                className={`inline-block w-fit px-3 py-1 rounded-full text-xs font-medium capitalize ${platformColors[post.platform] || "bg-gray-50 text-gray-600"}`}
              >
                {post.platform}
              </span>
              {post.caption && (
                <p className="text-sm text-[var(--on-surface-default)] line-clamp-3">
                  {post.caption}
                </p>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
