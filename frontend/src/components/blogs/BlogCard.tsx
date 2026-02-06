"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock } from "lucide-react";
import { useLocale } from "next-intl";
import { getStrapiMediaUrl } from "@/lib/strapi/client";
import type { StrapiBlogPost } from "@/lib/strapi/types";

interface BlogCardProps {
  post: StrapiBlogPost;
  isRTL?: boolean;
}

const BlogCard = ({ post, isRTL: isRTLProp }: BlogCardProps) => {
  const locale = useLocale();
  const isRTL = isRTLProp ?? locale === "ar";

  const title = post.title || "";
  const excerpt = post.excerpt || "";
  const readTime = post.readTimeMinutes
    ? (locale === "ar" ? `${post.readTimeMinutes} دقائق قراءة` : `${post.readTimeMinutes} min read`)
    : "";
  const slug = post.slug;
  const imageUrl = post.mainImage?.url
    ? getStrapiMediaUrl(post.mainImage.formats?.medium?.url || post.mainImage.url)
    : "/blogs/blog-1.png";

  return (
    <Link href={`/${locale}/blogs/${slug}`} className="group block">
      <div className="overflow-hidden">
        <div className="relative h-[220px] overflow-hidden rounded-xl">
          <Image
            src={imageUrl}
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
            {excerpt}
          </p>
          <div className={`flex items-center gap-1.5 text-sm text-[var(--on-surface-variant)] ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
            <Clock className="w-4 h-4" />
            <span>{readTime}</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default BlogCard;
