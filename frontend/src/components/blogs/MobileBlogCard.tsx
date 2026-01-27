"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { BlogPost } from "./BlogCard";

interface MobileBlogCardProps {
  post: BlogPost;
}

const MobileBlogCard = ({ post }: MobileBlogCardProps) => (
  <Link href={`/blogs/${post.slug}`} className="group block">
    <div className="overflow-hidden">
      <div className="relative w-full h-[180px] rounded-xl overflow-hidden">
        <Image
          src={post.image}
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
        <h3 className="font-semibold text-[var(--on-surface-default)] mb-2" style={{ fontSize: "16px" }}>
          {post.title}
        </h3>
        <p className="text-[var(--on-surface-variant)] text-sm mb-3 line-clamp-2">
          {post.excerpt}
        </p>
        <span className="text-[var(--on-surface-default)] font-medium text-sm flex items-center gap-2">
          Read More <ArrowRight className="w-4 h-4" />
        </span>
      </div>
    </div>
  </Link>
);

export default MobileBlogCard;
