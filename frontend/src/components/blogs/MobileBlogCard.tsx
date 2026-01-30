"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Clock } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { BlogPost } from "./BlogCard";

interface MobileBlogCardProps {
  post: BlogPost;
  isRTL?: boolean;
}

const MobileBlogCard = ({ post, isRTL: isRTLProp }: MobileBlogCardProps) => {
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
        <div className="relative w-full h-[180px] rounded-xl overflow-hidden">
          <Image
            src={post.image}
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
          <h3 className="font-semibold text-[var(--on-surface-default)] mb-2" style={{ fontSize: "16px" }}>
            {getTranslatedTitle()}
          </h3>
          <p className="text-[var(--on-surface-variant)] text-sm mb-3 line-clamp-2">
            {getTranslatedExcerpt()}
          </p>
          <span className={`text-[var(--on-surface-default)] font-medium text-sm flex items-center gap-2 ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
            {t("card.readMore")} {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </span>
        </div>
      </div>
    </Link>
  );
};

export default MobileBlogCard;
