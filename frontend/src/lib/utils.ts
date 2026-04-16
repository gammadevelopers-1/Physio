import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format duration in minutes to a human-readable string.
 * Examples: 30 → "30 minutes", 60 → "1 hour", 100 → "1 hour 40 minutes", 120 → "2 hours"
 */
export function formatDuration(
  totalMinutes: number | null | undefined,
  locale: string = "en",
): string {
  if (!totalMinutes || totalMinutes <= 0) {
    return locale === "ar" ? "0 دقيقة" : "0 minutes";
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (locale === "ar") {
    const hourLabel = hours === 1 ? "ساعة" : hours === 2 ? "ساعتان" : "ساعات";
    const minuteLabel = minutes === 1 ? "دقيقة" : minutes === 2 ? "دقيقتان" : "دقائق";
    if (hours === 0) return `${minutes} ${minuteLabel}`;
    if (minutes === 0) return `${hours} ${hourLabel}`;
    return `${hours} ${hourLabel} ${minutes} ${minuteLabel}`;
  }

  const hourLabel = hours === 1 ? "hour" : "hours";
  const minuteLabel = minutes === 1 ? "minute" : "minutes";
  if (hours === 0) return `${minutes} ${minuteLabel}`;
  if (minutes === 0) return `${hours} ${hourLabel}`;
  return `${hours} ${hourLabel} ${minutes} ${minuteLabel}`;
}
