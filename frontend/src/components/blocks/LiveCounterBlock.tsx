"use client";

import { useState, useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import type { SideLoadedData } from "@/lib/strapi/types";

type LiveSource = "totalStudents" | "totalCourses" | "totalInstructors";

interface CounterItem {
  id: number;
  value: number;
  label: string;
  suffix?: string;
  prefix?: string;
  icon?: string;
  liveSource?: LiveSource | null;
}

interface LiveCounterBlockData {
  __component: "blocks.live-counter-block";
  id: number;
  title?: string | null;
  description?: string | null;
  counters: CounterItem[];
  animationDuration?: number;
  backgroundColor?: string;
  visibility?: string;
  position?: string;
}

interface LiveCounterBlockProps {
  data: LiveCounterBlockData;
  sideLoadedData: SideLoadedData;
}

interface PublicStats {
  totalStudents: number;
  totalCourses: number;
  totalInstructors: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

function AnimatedCounter({
  value,
  duration,
}: {
  value: number;
  duration: number;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);
  const lastValue = useRef(0);

  useEffect(() => {
    // If value changes (e.g., live stats arrive after first render), re-animate
    if (hasAnimated.current && value !== lastValue.current) {
      const start = performance.now();
      const from = lastValue.current;
      const animate = (now: number) => {
        const progress = Math.min((now - start) / duration, 1);
        setCount(Math.floor(from + (value - from) * progress));
        if (progress < 1) requestAnimationFrame(animate);
        else lastValue.current = value;
      };
      requestAnimationFrame(animate);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const start = performance.now();
          const animate = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const current = Math.floor(progress * value);
            setCount(current);
            if (progress < 1) requestAnimationFrame(animate);
            else lastValue.current = value;
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, duration]);

  return <span ref={ref}>{count.toLocaleString()}</span>;
}

export function LiveCounterBlock({ data }: LiveCounterBlockProps) {
  const locale = useLocale();
  const isRTL = locale === "ar";
  const duration = data.animationDuration || 2000;

  const [liveStats, setLiveStats] = useState<PublicStats | null>(null);

  // Only fetch if at least one counter has a liveSource binding
  const hasLiveCounter = (data.counters || []).some((c) => c.liveSource);

  useEffect(() => {
    if (!hasLiveCounter) return;
    let cancelled = false;
    fetch(`${API_URL}/public-stats`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json) setLiveStats(json as PublicStats);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hasLiveCounter]);

  // Resolve each counter to its display value
  const resolveValue = (counter: CounterItem): number => {
    if (counter.liveSource && liveStats) {
      const v = liveStats[counter.liveSource];
      if (typeof v === "number") return v;
    }
    return counter.value;
  };

  const counters = data.counters || [];

  return (
    <section
      className="px-4 lg:px-16 py-12 lg:py-16"
      style={{ backgroundColor: data.backgroundColor || "transparent" }}
    >
      <div className="max-w-[1280px] mx-auto">
        <div
          className="bg-[var(--color-surface-card)] rounded-3xl shadow-sm px-6 py-8 lg:px-12 lg:py-10"
          dir={isRTL ? "rtl" : "ltr"}
        >
          <div className="flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-10">
            {/* Counters row */}
            <div
              className={`flex-1 grid gap-6 lg:gap-10 ${
                counters.length === 1
                  ? "grid-cols-1"
                  : counters.length === 2
                  ? "grid-cols-2"
                  : counters.length === 3
                  ? "grid-cols-1 sm:grid-cols-3"
                  : "grid-cols-2 lg:grid-cols-4"
              }`}
            >
              {counters.map((counter) => {
                const displayValue = resolveValue(counter);
                return (
                  <div
                    key={counter.id}
                    className="flex flex-col items-center text-center gap-2"
                  >
                    <span
                      className="font-bold leading-none text-[40px] lg:text-[52px] text-[var(--color-primary)]"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {counter.prefix}
                      <AnimatedCounter value={displayValue} duration={duration} />
                      {counter.suffix}
                    </span>
                    <span className="text-[var(--color-text-secondary)] text-[15px] lg:text-[17px] leading-tight font-medium">
                      {counter.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Title block — anchored to the visual start of the row
                (LTR → left, RTL → right). Counters fill the remaining space. */}
            {(data.title || data.description) && (
              <div
                className={`flex-shrink-0 lg:w-[260px] xl:w-[300px] lg:order-first ${
                  isRTL ? "text-right" : "text-left"
                }`}
              >
                {data.title && (
                  <h2 className="font-bold text-[var(--color-text-primary)] leading-tight tracking-tight text-[28px] lg:text-[36px] xl:text-[40px]">
                    {data.title}
                  </h2>
                )}
                {data.description && (
                  <p className="text-[var(--color-text-secondary)] mt-2 text-[14px] lg:text-[16px] leading-6">
                    {data.description}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
