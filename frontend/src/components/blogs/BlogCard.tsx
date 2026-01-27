"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";

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
}

const BlogCard = ({ post }: BlogCardProps) => (
  <Link href={`/blogs/${post.slug}`} className="group block">
    <div className="overflow-hidden">
      <div className="relative h-[220px] overflow-hidden rounded-xl">
        <Image
          src={post.image}
          alt={post.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      <div className="pt-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-[var(--on-surface-default)] bg-[#F4F4F5] rounded-md mb-3">
          <Clock className="w-3.5 h-3.5" />
          {post.readTime}
        </span>
        <h3 className="font-semibold text-[var(--on-surface-default)] mb-2 line-clamp-2" style={{ fontSize: "18px" }}>
          {post.title}
        </h3>
        <p className="text-[var(--on-surface-variant)] text-sm mb-4 line-clamp-2">
          {post.excerpt}
        </p>
        <span className="text-[var(--on-surface-default)] font-medium text-sm flex items-center gap-2 group-hover:gap-3 transition-all">
          Read More <ArrowRight className="w-4 h-4" />
        </span>
      </div>
    </div>
  </Link>
);

export default BlogCard;
