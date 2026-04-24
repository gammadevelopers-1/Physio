"use client";

import { useState, useEffect } from "react";
import type { SideLoadedData } from "@/lib/strapi/types";

interface ButtonLink {
  id: number;
  label: string;
  url: string;
  variant?: "primary" | "secondary" | "outline";
  openInNewTab?: boolean;
}

interface CountdownTimerBlockData {
  __component: "blocks.countdown-timer-block";
  id: number;
  title?: string;
  description?: string;
  targetDate: string;
  expiredMessage?: string;
  daysLabel?: string;
  hoursLabel?: string;
  minutesLabel?: string;
  secondsLabel?: string;
  buttons?: ButtonLink[];
  visibility?: string;
  position?: string;
}

interface CountdownTimerBlockProps {
  data: CountdownTimerBlockData;
  sideLoadedData: SideLoadedData;
}

function getTimeLeft(target: string) {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export function CountdownTimerBlock({ data }: CountdownTimerBlockProps) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(data.targetDate));

  useEffect(() => {
    const id = setInterval(() => {
      setTimeLeft(getTimeLeft(data.targetDate));
    }, 1000);
    return () => clearInterval(id);
  }, [data.targetDate]);

  return (
    <section className="px-4 lg:px-16 py-12 lg:py-20">
      <div className="max-w-[1280px] mx-auto flex flex-col gap-8 items-center text-center">
        {data.title && (
          <h2
            className="font-semibold text-[var(--on-surface-default)] leading-none tracking-[-0.24px]"
            style={{ fontSize: "var(--typeface-font-styles-heading-h1)" }}
          >
            {data.title}
          </h2>
        )}
        {data.description && (
          <p
            className="text-[var(--on-surface-default)] leading-7 max-w-[768px]"
            style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
          >
            {data.description}
          </p>
        )}

        {timeLeft ? (
          <div className="flex items-center gap-4 md:gap-8">
            {([
              ["days", data.daysLabel || "Days"],
              ["hours", data.hoursLabel || "Hours"],
              ["minutes", data.minutesLabel || "Minutes"],
              ["seconds", data.secondsLabel || "Seconds"],
            ] as const).map(([key, label]) => (
              <div key={key} className="flex flex-col items-center">
                <span className="text-4xl md:text-5xl font-bold text-[var(--surface-container-primary)]">
                  {String(timeLeft[key as keyof typeof timeLeft]).padStart(2, "0")}
                </span>
                <span className="text-xs md:text-sm text-[var(--on-surface-variant)] mt-1">
                  {label}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-lg font-medium text-[var(--on-surface-variant)]">
            {data.expiredMessage || "This event has passed."}
          </p>
        )}

        {data.buttons && data.buttons.length > 0 && (
          <div className="flex flex-wrap gap-4 justify-center">
            {data.buttons.map((btn) => (
              <a
                key={btn.id}
                href={btn.url}
                className={`px-6 py-3 rounded-full text-sm font-medium ${
                  btn.variant === "outline"
                    ? "border border-[var(--outline-subtle)] text-[var(--on-surface-default)] hover:bg-gray-50"
                    : btn.variant === "secondary"
                      ? "bg-gray-100 text-[var(--on-surface-default)] hover:bg-gray-200"
                      : "bg-[var(--color-primary)] text-white"
                }`}
                {...(btn.openInNewTab
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {btn.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
