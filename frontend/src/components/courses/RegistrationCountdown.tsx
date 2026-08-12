"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

interface Props {
  /** ISO-format enrollment deadline. Null/undefined hides the timer. */
  deadline?: string | null;
  isRTL?: boolean;
  className?: string;
}

interface TimeParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function computeParts(deadlineMs: number, nowMs: number): TimeParts | null {
  const diff = deadlineMs - nowMs;
  if (diff <= 0) return null;
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

/**
 * Countdown to a course's enrollment deadline shown inside the pricing card.
 * Ticks every second on the client; renders nothing when there's no deadline
 * or when the deadline has passed. Digits stay Latin regardless of locale to
 * match the rest of the pricing card.
 */
export default function RegistrationCountdown({ deadline, isRTL, className }: Props) {
  const t = useTranslations("courseDetailPage.registrationCountdown");
  const deadlineMs = deadline ? new Date(deadline).getTime() : null;
  const [parts, setParts] = useState<TimeParts | null>(() => {
    if (!deadlineMs || Number.isNaN(deadlineMs)) return null;
    return computeParts(deadlineMs, Date.now());
  });

  useEffect(() => {
    if (!deadlineMs || Number.isNaN(deadlineMs)) {
      setParts(null);
      return;
    }
    // Initial recompute after mount to correct any SSR/CSR drift.
    setParts(computeParts(deadlineMs, Date.now()));
    const id = window.setInterval(() => {
      const next = computeParts(deadlineMs, Date.now());
      setParts(next);
      if (!next) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [deadlineMs]);

  if (!deadlineMs || Number.isNaN(deadlineMs) || !parts) return null;

  const cells: Array<{ value: number; label: string }> = [
    { value: parts.days, label: t("days") },
    { value: parts.hours, label: t("hours") },
    { value: parts.minutes, label: t("minutes") },
    { value: parts.seconds, label: t("seconds") },
  ];

  return (
    <div
      className={`rounded-xl bg-[var(--color-primary)] text-white p-3 ${className || ""}`}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <p className="text-center text-sm font-semibold mb-2">{t("title")}</p>
      <div className="grid grid-cols-4 gap-1 text-center">
        {cells.map((c, i) => (
          <div key={i} className="flex flex-col items-center">
            <span className="text-xl font-bold leading-none" style={{ fontVariantNumeric: "tabular-nums" }}>
              {String(c.value).padStart(2, "0")}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide opacity-90 mt-1">
              {c.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
