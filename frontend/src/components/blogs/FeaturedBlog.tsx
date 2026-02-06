"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock } from "lucide-react";
import { useLocale } from "next-intl";
import { getStrapiMediaUrl } from "@/lib/strapi/client";
import type { StrapiBlogPost } from "@/lib/strapi/types";

interface FeaturedBlogProps {
  post: StrapiBlogPost;
  isRTL?: boolean;
}

const FeaturedBlog = ({ post, isRTL: isRTLProp }: FeaturedBlogProps) => {
  const locale = useLocale();
  const isRTL = isRTLProp ?? locale === "ar";

  const title = post.title || "";
  const excerpt = post.excerpt || "";
  const readTime = post.readTimeMinutes
    ? (locale === "ar" ? `${post.readTimeMinutes} دقائق قراءة` : `${post.readTimeMinutes} min read`)
    : "";
  const slug = post.slug;
  const imageUrl = post.mainImage?.url
    ? getStrapiMediaUrl(post.mainImage.formats?.large?.url || post.mainImage.url)
    : "/blogs/blog-1.png";

  return (
    <>
      {/* Desktop Featured Blog */}
      <div className="hidden lg:block">
        <Link href={`/${locale}/blogs/${slug}`} className="group block">
          <div className={`flex gap-12 ${isRTL ? "flex-row-reverse" : ""}`}>
            <div className="relative w-1/2 h-[380px] rounded-2xl overflow-hidden">
              <Image
                src={imageUrl}
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
                {excerpt}
              </p>
              <div className={`flex items-center gap-2 text-sm text-[var(--on-surface-variant)] ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
                <Clock className="w-4 h-4" />
                <span>{readTime}</span>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Mobile Featured Blog */}
      <div className="lg:hidden">
        <Link href={`/${locale}/blogs/${slug}`} className="block">
          <div className="rounded-2xl overflow-hidden">
            <div className="relative h-[180px] rounded-xl overflow-hidden">
              <Image
                src={imageUrl}
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
                {excerpt}
              </p>
              <div className={`flex items-center gap-1.5 text-xs text-[var(--on-surface-variant)] ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
                <Clock className="w-3 h-3" />
                <span>{readTime}</span>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </>
  );
};

export default FeaturedBlog;
