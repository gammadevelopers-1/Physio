"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock } from "lucide-react";
import { useLocale } from "next-intl";
import { urlFor } from "@/lib/sanity";
import type { SanityBlogPost } from "@/lib/sanity/types";
import { getLocalizedValue, formatReadTime } from "@/lib/sanity/types";

interface BlogCardProps {
  post: SanityBlogPost;
  isRTL?: boolean;
}

const BlogCard = ({ post, isRTL: isRTLProp }: BlogCardProps) => {
  const locale = useLocale();
  const isRTL = isRTLProp ?? locale === "ar";

  const getTitle = (): string => {
    return getLocalizedValue(post.title, locale) || "";
  };

  const getExcerpt = (): string => {
    return getLocalizedValue(post.excerpt, locale) || "";
  };

  const getReadTime = (): string => {
    return formatReadTime(post.readTimeMinutes, locale);
  };

  const getSlug = (): string => {
    return post.slug.current;
  };

  const getImageUrl = (): string => {
    if (post.mainImage) {
      return urlFor(post.mainImage).width(440).height(440).url();
    }
    return "/blogs/blog-1.png"; // Fallback placeholder
  };

  const title = getTitle();

  return (
    <Link href={`/${locale}/blogs/${getSlug()}`} className="group block">
      <div className="overflow-hidden">
        <div className="relative h-[220px] overflow-hidden rounded-xl">
          <Image
            src={getImageUrl()}
            alt={title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
        <div className={`mt-4 ${isRTL ? "text-right" : ""}`}>
          <h3 className="font-semibold text-[var(--on-surface-default)] line-clamp-2 mb-2" style={{ fontSize: "18px" }}>
            {title}
          </h3>
          <p className="text-[var(--on-surface-variant)] line-clamp-2 mb-3" style={{ fontSize: "14px" }}>
            {getExcerpt()}
          </p>
          <div className={`flex items-center gap-1.5 text-sm text-[var(--on-surface-variant)] ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
            <Clock className="w-4 h-4" />
            <span>{getReadTime()}</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default BlogCard;
