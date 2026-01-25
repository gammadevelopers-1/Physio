"use client";

import Image from "next/image";
import Link from "next/link";
import { Clock } from "lucide-react";
import { BlogPost } from "./BlogCard";

interface FeaturedBlogProps {
  post: BlogPost;
}

const FeaturedBlog = ({ post }: FeaturedBlogProps) => (
  <>
    {/* Desktop Featured Blog */}
    <div className="hidden lg:block">
      <Link href={`/blogs/${post.slug}`} className="group block">
        <div className="flex gap-12">
          <div className="relative w-1/2 h-[380px] rounded-2xl overflow-hidden">
            <Image
              src="/blogs/blog-hero.png"
              alt={post.title}
              fill
              className="object-cover"
            />
          </div>
          <div className="w-1/2 flex flex-col justify-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[var(--on-surface-default)] bg-[#F4F4F5] rounded-md mb-4 w-fit">
              <Clock className="w-4 h-4" />
              {post.readTime}
            </span>
            <h2 className="font-semibold text-[var(--on-surface-default)] mb-4" style={{ fontSize: "30px", lineHeight: "1.2" }}>
              {post.title}
            </h2>
            <p className="text-[var(--on-surface-variant)] mb-6" style={{ fontSize: "16px" }}>
              {post.excerpt}
            </p>
            <p className="text-sm text-[var(--on-surface-variant)]">
              {post.publishDate}
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
              alt={post.title}
              fill
              className="object-cover"
            />
          </div>
          <div className="pt-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[var(--on-surface-default)] bg-[#F4F4F5] rounded mb-2">
              <Clock className="w-3 h-3" />
              {post.readTime}
            </span>
            <h2 className="font-semibold text-[var(--on-surface-default)] mb-2" style={{ fontSize: "18px" }}>
              {post.title}
            </h2>
            <p className="text-[var(--on-surface-variant)] text-sm mb-2 line-clamp-2">
              {post.excerpt}
            </p>
            <p className="text-xs text-[var(--on-surface-variant)]">
              {post.publishDate}
            </p>
          </div>
        </div>
      </Link>
    </div>
  </>
);

export default FeaturedBlog;
