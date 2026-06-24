"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocale } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Class applied to the inner scroll container (always gets `overflow-x-auto scrollbar-hide`). */
  className?: string;
}

/**
 * Wraps a horizontally-scrolling tab strip with small left/right chevron
 * buttons that only appear when there's more content in that direction.
 * Clicks scroll by ~60 % of the visible width, smoothly.
 *
 * RTL-aware: in Arabic the visual-left edge is the END of content, so the
 * left chevron stays visible until you've scrolled all the way to the visual-
 * left (which is `scrollLeft = -(scrollWidth-clientWidth)` per W3C). Chevron
 * icons always match their visual edge (left edge → ChevronLeft) regardless
 * of locale — the click handler does the right thing for both.
 */
export default function ScrollableTabBar({ children, className = "" }: Props) {
  const locale = useLocale();
  const isRTL = locale === "ar";
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const absScroll = Math.abs(scrollLeft);
    const maxScroll = scrollWidth - clientWidth;
    const T = 4; // pixel slop so a 1px sub-pixel doesn't show a useless arrow

    if (isRTL) {
      // W3C: scrollLeft = 0 at start (visually right), goes negative toward end (visually left).
      setCanLeft(maxScroll - absScroll > T);  // can scroll toward visual-left = toward end
      setCanRight(absScroll > T);             // can scroll toward visual-right = toward start
    } else {
      setCanLeft(scrollLeft > T);                       // can scroll toward visual-left = toward start
      setCanRight(maxScroll - scrollLeft > T);          // can scroll toward visual-right = toward end
    }
  }, [isRTL]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    // Re-evaluate when tab content reflows (e.g. badges added/removed) or
    // when the container resizes (sidebar collapsed, viewport rotated).
    const obs = new ResizeObserver(update);
    obs.observe(el);
    for (let i = 0; i < el.children.length; i++) {
      obs.observe(el.children[i] as Element);
    }

    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      obs.disconnect();
    };
  }, [update]);

  // scrollBy({ left: -delta }) is "scroll toward visual-left" in BOTH LTR
  // and RTL (W3C normalized scrollLeft): in LTR it decreases positive
  // scrollLeft; in RTL it decreases from 0 toward negative — same direction.
  const scrollDir = (dir: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const delta = Math.max(200, el.clientWidth * 0.6);
    el.scrollBy({ left: dir === "left" ? -delta : delta, behavior: "smooth" });
  };

  return (
    <div className="relative">
      {canLeft && (
        <button
          type="button"
          onClick={() => scrollDir("left")}
          aria-label="Scroll tabs left"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-[var(--color-surface-card)] border border-[var(--color-border)] shadow-sm hover:bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      )}
      <div
        ref={scrollerRef}
        className={`overflow-x-auto scrollbar-hide ${className}`}
      >
        {children}
      </div>
      {canRight && (
        <button
          type="button"
          onClick={() => scrollDir("right")}
          aria-label="Scroll tabs right"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-[var(--color-surface-card)] border border-[var(--color-border)] shadow-sm hover:bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
