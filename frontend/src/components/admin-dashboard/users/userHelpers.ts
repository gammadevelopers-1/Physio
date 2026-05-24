/**
 * Shared display helpers for the admin Users surface. Pulled out of
 * UsersContent so the avatar / drawer components can reuse them
 * without circular imports.
 */

import type { User } from "@/lib/api";
import {
  formatPlatformDateReadable,
  type PlatformLocaleSettings,
} from "@/lib/platform-locale";

export function getUserName(user: User): string {
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : user.email;
}

export function getUserNameAr(user: User): string | null {
  const parts = [user.firstNameAr, user.lastNameAr].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

export function getUserStatus(user: User): "active" | "pending" | "suspended" {
  if (!user.isActive) return "suspended";
  if (!user.isVerified) return "pending";
  return "active";
}

export function formatDate(dateStr: string, settings: PlatformLocaleSettings): string {
  return formatPlatformDateReadable(dateStr, settings, "en");
}

export function formatDateTime(
  dateStr: string | null | undefined,
  settings: PlatformLocaleSettings,
): string {
  if (!dateStr) return "—";
  return formatPlatformDateReadable(dateStr, settings, "en", { includeTime: true });
}

export function formatRelativeTime(
  dateStr: string | undefined | null,
  settings: PlatformLocaleSettings,
): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr, settings);
}

export function getRoleBadgeStyle(role: string): string {
  switch (role) {
    case "ADMIN":
    case "SUPER_ADMIN":
      return "bg-[#FEE2E2] text-[#991B1B]";
    case "MANAGER":
      return "bg-[#E0F2FE] text-[#0369A1]";
    case "INSTRUCTOR":
      return "bg-[#DCFCE7] text-[#15803D]";
    case "TEACHING_ASSISTANT":
      return "bg-[#CFFAFE] text-[#0E7490]";
    case "STUDENT":
      return "bg-[var(--color-border-subtle)] text-[var(--color-primary)]";
    case "FINANCE":
      return "bg-[var(--gold-gold-100)] text-[#92740F]";
    case "SUPPORT":
      return "bg-[#FEF3C7] text-[#B45309]";
    default:
      return "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
  }
}

export function getStatusBadgeStyle(status: string): string {
  switch (status) {
    case "active":
      return "bg-[#DCFCE7] text-[#15803D]";
    case "pending":
      return "bg-[#FEF3C7] text-[#B45309]";
    case "suspended":
      return "bg-[#FEE2E2] text-[#991B1B]";
    default:
      return "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
  }
}

export const ROLE_ORDER = [
  "ADMIN",
  "MANAGER",
  "INSTRUCTOR",
  "TEACHING_ASSISTANT",
  "STUDENT",
  "FINANCE",
  "SUPPORT",
] as const;
