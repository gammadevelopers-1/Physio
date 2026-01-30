"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Clock } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readTime: string;
  publishDate: string;
  image: string;
  featured?: boolean;
}

interface BlogCardProps {
  post: BlogPost;
  isRTL?: boolean;
}

const BlogCard = ({ post, isRTL: isRTLProp }: BlogCardProps) => {
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

  return (
    <Link href={`/blogs/${post.slug}`} className="group block">
      <div className="overflow-hidden">
        <div className="relative h-[220px] overflow-hidden rounded-xl">
          <Image
            src={post.image}
            alt={getTranslatedTitle()}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
        <div className={`pt-4 ${isRTL ? "text-right" : ""}`}>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-[var(--on-surface-default)] bg-[#F4F4F5] rounded-md mb-3 ${isRTL ? "flex-row-reverse" : ""}`}>
            <Clock className="w-3.5 h-3.5" />
            {getTranslatedReadTime()}
          </span>
          <h3 className="font-semibold text-[var(--on-surface-default)] mb-2 line-clamp-2" style={{ fontSize: "18px" }}>
            {getTranslatedTitle()}
          </h3>
          <p className="text-[var(--on-surface-variant)] text-sm mb-4 line-clamp-2">
            {getTranslatedExcerpt()}
          </p>
          <span className={`text-[var(--on-surface-default)] font-medium text-sm flex items-center gap-2 group-hover:gap-3 transition-all ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
            {t("card.readMore")} {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </span>
        </div>
      </div>
    </Link>
  );
};

export default BlogCard;
