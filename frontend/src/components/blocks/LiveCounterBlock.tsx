"use client";

import { useState, useEffect, useRef } from "react";
import type { SideLoadedData } from "@/lib/strapi/types";

interface CounterItem {
  id: number;
  value: number;
  label: string;
  suffix?: string;
  prefix?: string;
  icon?: string;
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

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const start = performance.now();
          const animate = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            setCount(Math.floor(progress * value));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, duration]);

  return <span ref={ref}>{count.toLocaleString()}</span>;
}

export function LiveCounterBlock({ data }: LiveCounterBlockProps) {
  const duration = data.animationDuration || 2000;

  return (
    <section
      className="px-4 lg:px-16 py-12 lg:py-20"
      style={{ backgroundColor: data.backgroundColor || "#ffffff" }}
    >
      <div className="max-w-[1200px] mx-auto flex flex-col gap-10 items-center">
        {(data.title || data.description) && (
          <div className="flex flex-col gap-4 items-center text-center max-w-[768px]">
            {data.title && (
              <h2 className="font-semibold text-[var(--on-surface-default)] leading-none tracking-[-0.24px] text-[30px] lg:text-[48px]">
                {data.title}
              </h2>
            )}
            {data.description && (
              <p className="text-[var(--on-surface-variant)] leading-7 text-[18px] lg:text-[20px]">
                {data.description}
              </p>
            )}
          </div>
        )}

        <div className={`grid gap-6 lg:gap-10 w-full ${
          (data.counters?.length || 0) === 1 ? 'grid-cols-1 max-w-md mx-auto' :
          (data.counters?.length || 0) === 2 ? 'grid-cols-2 max-w-2xl mx-auto' :
          (data.counters?.length || 0) === 3 ? 'grid-cols-1 sm:grid-cols-3 max-w-4xl mx-auto' :
          'grid-cols-2 lg:grid-cols-4'
        }`}>
          {data.counters?.map((counter) => (
            <div
              key={counter.id}
              className="flex flex-col items-center text-center gap-2 p-6"
            >
              <span className="text-[36px] lg:text-[48px] font-bold text-[var(--on-surface-default)] leading-none">
                {counter.prefix}
                <AnimatedCounter value={counter.value} duration={duration} />
                {counter.suffix}
              </span>
              <span className="text-[var(--on-surface-variant)] text-[16px] lg:text-[18px] leading-6">
                {counter.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
