"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock } from "lucide-react";
import { useLocale } from "next-intl";
import { getStrapiMediaUrl } from "@/lib/strapi/client";
import type { StrapiBlogPost } from "@/lib/strapi/types";

interface MobileBlogCardProps {
  post: StrapiBlogPost;
  isRTL?: boolean;
}

const MobileBlogCard = ({ post, isRTL: isRTLProp }: MobileBlogCardProps) => {
  const locale = useLocale();
  const isRTL = isRTLProp ?? locale === "ar";

  const title = post.title || "";
  const excerpt = post.excerpt || "";
  const readTime = post.readTimeMinutes
    ? (locale === "ar" ? `${post.readTimeMinutes} دقائق قراءة` : `${post.readTimeMinutes} min read`)
    : "";
  const slug = post.slug;
  const imageUrl = post.mainImage?.url
    ? getStrapiMediaUrl(post.mainImage.formats?.small?.url || post.mainImage.url)
    : "/blogs/blog-1.png";

  return (
    <Link href={`/${locale}/blogs/${slug}`} className="group block">
      <div className="overflow-hidden">
        <div className="relative w-full h-[180px] rounded-xl overflow-hidden">
          <Image
            src={imageUrl}
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
            {excerpt}
          </p>
          <div className={`flex items-center gap-1 text-xs text-[var(--on-surface-variant)] ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
            <Clock className="w-3 h-3" />
            <span>{readTime}</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default MobileBlogCard;
