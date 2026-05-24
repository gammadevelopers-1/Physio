"use client";

import { usePlatformLocale } from "@/contexts/PlatformLocaleContext";
import {
  formatPlatformDate,
  formatPlatformDateReadable,
  formatPlatformNumber,
  formatPlatformTime,
} from "@/lib/platform-locale";

/**
 * Drop-in components that render dates/numbers using the platform's
 * admin-configured Date Format and Number System. Use these for any
 * user-visible date/number so admin choices propagate everywhere.
 */

interface FmtDateProps {
  value: Date | string | null | undefined;
  /** "compact" = DD-MM-YYYY style. "readable" = "Apr 10, 2026". */
  variant?: "compact" | "readable";
  locale?: "en" | "ar";
  includeTime?: boolean;
  fallback?: string;
  className?: string;
}

export function FmtDate({
  value,
  variant = "compact",
  locale = "en",
  includeTime,
  fallback,
  className,
}: FmtDateProps) {
  const settings = usePlatformLocale();
  const out =
    variant === "readable"
      ? formatPlatformDateReadable(value, settings, locale, {
          fallback,
          includeTime,
        })
      : formatPlatformDate(value, settings, { fallback });
  return <span className={className}>{out}</span>;
}

interface FmtTimeProps {
  value: Date | string | null | undefined;
  locale?: "en" | "ar";
  className?: string;
}

export function FmtTime({ value, locale = "en", className }: FmtTimeProps) {
  const settings = usePlatformLocale();
  return (
    <span className={className}>
      {formatPlatformTime(value, settings, locale)}
    </span>
  );
}

interface FmtNumProps {
  value: number | null | undefined;
  options?: Intl.NumberFormatOptions;
  className?: string;
}

export function FmtNum({ value, options, className }: FmtNumProps) {
  const settings = usePlatformLocale();
  return (
    <span className={className}>{formatPlatformNumber(value, settings, options)}</span>
  );
}
