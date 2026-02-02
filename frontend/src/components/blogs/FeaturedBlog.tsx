"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock } from "lucide-react";
import { useLocale } from "next-intl";
import { urlFor } from "@/lib/sanity";
import type { SanityBlogPost } from "@/lib/sanity/types";
import { getLocalizedValue, formatReadTime } from "@/lib/sanity/types";

interface FeaturedBlogProps {
  post: SanityBlogPost;
  isRTL?: boolean;
}

const FeaturedBlog = ({ post, isRTL: isRTLProp }: FeaturedBlogProps) => {
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
      return urlFor(post.mainImage).width(600).height(380).url();
    }
    return "/blogs/blog-1.png"; // Fallback placeholder
  };

  const title = getTitle();

  return (
    <>
      {/* Desktop Featured Blog */}
      <div className="hidden lg:block">
        <Link href={`/${locale}/blogs/${getSlug()}`} className="group block">
          <div className={`flex gap-12 ${isRTL ? "flex-row-reverse" : ""}`}>
            <div className="relative w-1/2 h-[380px] rounded-2xl overflow-hidden">
              <Image
                src={getImageUrl()}
                alt={title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className={`w-1/2 flex flex-col justify-center ${isRTL ? "text-right" : ""}`}>
              <h3 className="font-semibold text-[var(--on-surface-default)] mb-4" style={{ fontSize: "28px" }}>
                {title}
              </h3>
              <p className="text-[var(--on-surface-variant)] mb-6" style={{ fontSize: "16px", lineHeight: "1.6" }}>
                {getExcerpt()}
              </p>
              <div className={`flex items-center gap-2 text-sm text-[var(--on-surface-variant)] ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
                <Clock className="w-4 h-4" />
                <span>{getReadTime()}</span>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Mobile Featured Blog */}
      <div className="lg:hidden">
        <Link href={`/${locale}/blogs/${getSlug()}`} className="block">
          <div className="rounded-2xl overflow-hidden">
            <div className="relative h-[180px] rounded-xl overflow-hidden">
              <Image
                src={getImageUrl()}
                alt={title}
                fill
                className="object-cover"
              />
            </div>
            <div className={`mt-4 ${isRTL ? "text-right" : ""}`}>
              <h3 className="font-semibold text-[var(--on-surface-default)] mb-2" style={{ fontSize: "18px" }}>
                {title}
              </h3>
              <p className="text-[var(--on-surface-variant)] text-sm line-clamp-3 mb-3">
                {getExcerpt()}
              </p>
              <div className={`flex items-center gap-1.5 text-xs text-[var(--on-surface-variant)] ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
                <Clock className="w-3 h-3" />
                <span>{getReadTime()}</span>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </>
  );
};

export default FeaturedBlog;
