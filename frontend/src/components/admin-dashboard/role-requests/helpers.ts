/**
 * Shared helpers for the admin Instructor Applications (role-requests)
 * surface. Centralizes profile-data reads + formatters that both the
 * list and detail pages share.
 */

import type { RoleRequest } from "@/lib/api";
import {
  formatPlatformDateReadable,
  toArabicIndic,
  type PlatformLocaleSettings,
} from "@/lib/platform-locale";

export type Profile = Record<string, string | undefined>;

export function getProfile(req: RoleRequest): Profile {
  return (req.profileData || {}) as Profile;
}

/** Best-effort applicant name from profileData → email fallback. */
export function getApplicantName(req: RoleRequest): string {
  const p = getProfile(req);
  return (
    p.fullNameEnglish ||
    p.fullNameArabic ||
    p.fullName ||
    req.user?.email ||
    "—"
  );
}

export function getApplicantNameAr(req: RoleRequest): string | null {
  const p = getProfile(req);
  return p.fullNameArabic || null;
}

export function getApplicantInitials(req: RoleRequest): string {
  const p = getProfile(req);
  const source = p.fullNameEnglish || p.fullName || req.user?.email || "?";
  const parts = source.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return source[0]?.toUpperCase() ?? "?";
}

/** Subtitle for cards / hero: "Profession · Specialty" when both exist. */
export function getApplicantSubtitle(req: RoleRequest): string {
  const p = getProfile(req);
  const bits = [p.profession, p.specialty].filter(Boolean);
  return bits.join(" · ");
}

/** Days between two ISO timestamps (or now). Always returns a non-negative integer. */
export function daysBetween(from: string, to?: string): number {
  const start = new Date(from).getTime();
  const end = to ? new Date(to).getTime() : Date.now();
  const diff = Math.max(0, end - start);
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

/** "Just now" / "2h ago" / "3d ago" / "Aug 12, 2025" — same shape as Users page. */
export function formatRelativeTime(
  dateStr: string | null | undefined,
  locale: "en" | "ar" = "en",
  settings?: PlatformLocaleSettings,
): string {
  if (!dateStr) return locale === "ar" ? "أبداً" : "Never";
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);
  const applyDigits = (s: string) =>
    settings?.numberSystem === "arabic_indic" ? toArabicIndic(s) : s;
  if (diffMin < 1) return locale === "ar" ? "الآن" : "Just now";
  if (diffMin < 60) return applyDigits(locale === "ar" ? `قبل ${diffMin}د` : `${diffMin}m ago`);
  if (diffHours < 24) return applyDigits(locale === "ar" ? `قبل ${diffHours}س` : `${diffHours}h ago`);
  if (diffDays < 7) return applyDigits(locale === "ar" ? `قبل ${diffDays}ي` : `${diffDays}d ago`);
  if (settings) {
    return formatPlatformDateReadable(date, settings, locale);
  }
  return date.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatFullDate(
  dateStr: string,
  locale: "en" | "ar" = "en",
  settings?: PlatformLocaleSettings,
): string {
  if (settings) {
    return formatPlatformDateReadable(dateStr, settings, locale, { includeTime: true });
  }
  return new Date(dateStr).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const STATUS_CONFIG = {
  PENDING: {
    badgeBg: "bg-[#FEF3C7]",
    badgeText: "text-[#92400E]",
    dot: "#F59E0B",
  },
  APPROVED: {
    badgeBg: "bg-[#DCFCE7]",
    badgeText: "text-[#15803D]",
    dot: "#16A34A",
  },
  REJECTED: {
    badgeBg: "bg-[#FEE2E2]",
    badgeText: "text-[#991B1B]",
    dot: "#DC2626",
  },
  MORE_INFO: {
    badgeBg: "bg-[#FFEDD5]",
    badgeText: "text-[#9A3412]",
    dot: "#EA580C",
  },
} as const;

export type StatusKey = keyof typeof STATUS_CONFIG;
