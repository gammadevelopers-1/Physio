"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock } from "lucide-react";
import { useLocale } from "next-intl";
import { urlFor } from "@/lib/sanity";
import type { SanityBlogPost } from "@/lib/sanity/types";
import { getLocalizedValue, formatReadTime } from "@/lib/sanity/types";

interface MobileBlogCardProps {
  post: SanityBlogPost;
  isRTL?: boolean;
}

const MobileBlogCard = ({ post, isRTL: isRTLProp }: MobileBlogCardProps) => {
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
      return urlFor(post.mainImage).width(180).height(180).url();
    }
    return "/blogs/blog-1.png"; // Fallback placeholder
  };

  const title = getTitle();

  return (
    <Link href={`/${locale}/blogs/${getSlug()}`} className="group block">
      <div className="overflow-hidden">
        <div className="relative w-full h-[180px] rounded-xl overflow-hidden">
          <Image
            src={getImageUrl()}
            alt={title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
        <div className={`mt-3 ${isRTL ? "text-right" : ""}`}>
          <h3 className="font-semibold text-[var(--on-surface-default)] line-clamp-2 mb-1.5" style={{ fontSize: "16px" }}>
            {title}
          </h3>
          <p className="text-[var(--on-surface-variant)] line-clamp-2 mb-2 text-sm">
            {getExcerpt()}
          </p>
          <div className={`flex items-center gap-1 text-xs text-[var(--on-surface-variant)] ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
            <Clock className="w-3 h-3" />
            <span>{getReadTime()}</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default MobileBlogCard;
