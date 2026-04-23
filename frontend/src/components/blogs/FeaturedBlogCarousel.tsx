"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import FeaturedBlog from "./FeaturedBlog";
import type { StrapiBlogPost } from "@/lib/strapi/types";

interface FeaturedBlogCarouselProps {
  posts: StrapiBlogPost[];
  isRTL: boolean;
}

const AUTO_ADVANCE_MS = 6000;

const FeaturedBlogCarousel = ({ posts, isRTL }: FeaturedBlogCarouselProps) => {
  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const count = posts.length;
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;

  // Auto-advance (pauses on hover, single post, or when tab is hidden)
  useEffect(() => {
    if (count <= 1 || hovering) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, AUTO_ADVANCE_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [count, hovering]);

  if (count === 0) return null;

  const go = (next: number) => {
    setIndex(((next % count) + count) % count);
  };

  const goPrev = () => go(index - 1);
  const goNext = () => go(index + 1);

  // Single post → render without carousel chrome
  if (count === 1) {
    return <FeaturedBlog post={posts[0]} isRTL={isRTL} />;
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      role="region"
      aria-roledescription="carousel"
      aria-label={isRTL ? "المدونات المميزة" : "Featured blogs"}
    >
      {/* Slides: CSS transform translates between them */}
      <div className="overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{
            transform: `translateX(${isRTL ? index * 100 : -index * 100}%)`,
          }}
        >
          {posts.map((post) => (
            <div
              key={post.documentId}
              className="shrink-0 w-full"
              aria-hidden={posts[index].documentId !== post.documentId}
            >
              <FeaturedBlog post={post} isRTL={isRTL} />
            </div>
          ))}
        </div>
      </div>

      {/* Arrows (desktop/tablet) */}
      <div className="hidden md:flex items-center justify-between pointer-events-none absolute inset-y-0 inset-x-0 lg:-inset-x-4">
        <button
          type="button"
          onClick={goPrev}
          aria-label={isRTL ? "التالي" : "Previous"}
          className="pointer-events-auto flex items-center justify-center w-11 h-11 rounded-full bg-white shadow-md hover:bg-[var(--color-surface-page)] border border-[var(--color-border)] text-[var(--on-surface-default)] transition-colors"
        >
          <PrevIcon className="w-5 h-5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={goNext}
          aria-label={isRTL ? "السابق" : "Next"}
          className="pointer-events-auto flex items-center justify-center w-11 h-11 rounded-full bg-white shadow-md hover:bg-[var(--color-surface-page)] border border-[var(--color-border)] text-[var(--on-surface-default)] transition-colors"
        >
          <NextIcon className="w-5 h-5" strokeWidth={1.75} />
        </button>
      </div>

      {/* Dots */}
      <div className="flex items-center justify-center gap-2 mt-6">
        {posts.map((post, i) => (
          <button
            key={post.documentId}
            type="button"
            onClick={() => go(i)}
            aria-label={
              isRTL
                ? `الانتقال إلى الشريحة ${i + 1}`
                : `Go to slide ${i + 1}`
            }
            aria-current={index === i ? "true" : undefined}
            className={`h-2 rounded-full transition-all ${
              index === i
                ? "w-8 bg-[var(--gold-gold-500)]"
                : "w-2 bg-[var(--color-border)] hover:bg-[var(--color-text-secondary)]"
            }`}
          />
        ))}
      </div>

      {/* Mobile arrows (below dots, for small screens where side arrows overlap content) */}
      <div className="flex md:hidden items-center justify-center gap-3 mt-4">
        <button
          type="button"
          onClick={goPrev}
          aria-label={isRTL ? "التالي" : "Previous"}
          className="flex items-center justify-center w-10 h-10 rounded-full border border-[var(--color-border)] bg-white text-[var(--on-surface-default)]"
        >
          <PrevIcon className="w-4 h-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={goNext}
          aria-label={isRTL ? "السابق" : "Next"}
          className="flex items-center justify-center w-10 h-10 rounded-full border border-[var(--color-border)] bg-white text-[var(--on-surface-default)]"
        >
          <NextIcon className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
};

export default FeaturedBlogCarousel;
