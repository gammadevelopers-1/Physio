"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { BlogPost } from "./BlogCard";

interface FeaturedBlogProps {
  post: BlogPost;
  isRTL?: boolean;
}

const FeaturedBlog = ({ post, isRTL: isRTLProp }: FeaturedBlogProps) => {
  const t = useTranslations("blogsPage");
  const locale = useLocale();
  const isRTL = isRTLProp ?? locale === "ar";

  // Helper functions to get translated content
  const getTranslatedTitle = () => {
    if (isRTL) {
      try {
        return t(`posts.${post.slug}.title`);
      } catch {
        return post.title;
      }
    }
    return post.title;
  };

  const getTranslatedExcerpt = () => {
    if (isRTL) {
      try {
        return t(`posts.${post.slug}.excerpt`);
      } catch {
        return post.excerpt;
      }
    }
    return post.excerpt;
  };

  const getTranslatedReadTime = () => {
    if (isRTL) {
      try {
        return t(`posts.${post.slug}.readTime`);
      } catch {
        return post.readTime;
      }
    }
    return post.readTime;
  };

  const getTranslatedPublishDate = () => {
    if (isRTL) {
      try {
        return t(`posts.${post.slug}.publishDate`);
      } catch {
        return post.publishDate;
      }
    }
    return post.publishDate;
  };

  return (
    <>
      {/* Desktop Featured Blog */}
      <div className="hidden lg:block">
        <Link href={`/blogs/${post.slug}`} className="group block">
          <div className={`flex gap-12 ${isRTL ? "flex-row-reverse" : ""}`}>
            <div className="relative w-1/2 h-[380px] rounded-2xl overflow-hidden">
              <Image
                src="/blogs/blog-hero.png"
                alt={getTranslatedTitle()}
                fill
                className="object-cover"
              />
            </div>
            <div className={`w-1/2 flex flex-col justify-center ${isRTL ? "items-end text-right" : ""}`}>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[var(--on-surface-default)] bg-[#F4F4F5] rounded-md mb-4 w-fit ${isRTL ? "flex-row-reverse" : ""}`}>
                <Clock className="w-4 h-4" />
                {getTranslatedReadTime()}
              </span>
              <h2 className="font-semibold text-[var(--on-surface-default)] mb-4" style={{ fontSize: "30px", lineHeight: "1.2" }}>
                {getTranslatedTitle()}
              </h2>
              <p className="text-[var(--on-surface-variant)] mb-6" style={{ fontSize: "16px" }}>
                {getTranslatedExcerpt()}
              </p>
              <p className="text-sm text-[var(--on-surface-variant)]">
                {getTranslatedPublishDate()}
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* Mobile Featured Blog */}
      <div className="lg:hidden">
        <Link href={`/blogs/${post.slug}`} className="block">
          <div className="rounded-2xl overflow-hidden">
            <div className="relative h-[180px] rounded-xl overflow-hidden">
              <Image
                src="/blogs/blog-hero.png"
                alt={getTranslatedTitle()}
                fill
                className="object-cover"
              />
            </div>
            <div className={`pt-3 ${isRTL ? "text-right" : ""}`}>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[var(--on-surface-default)] bg-[#F4F4F5] rounded mb-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                <Clock className="w-3 h-3" />
                {getTranslatedReadTime()}
              </span>
              <h2 className="font-semibold text-[var(--on-surface-default)] mb-2" style={{ fontSize: "18px" }}>
                {getTranslatedTitle()}
              </h2>
              <p className="text-[var(--on-surface-variant)] text-sm mb-2 line-clamp-2">
                {getTranslatedExcerpt()}
              </p>
              <p className="text-xs text-[var(--on-surface-variant)]">
                {getTranslatedPublishDate()}
              </p>
            </div>
          </div>
        </Link>
      </div>
    </>
  );
};

export default FeaturedBlog;
