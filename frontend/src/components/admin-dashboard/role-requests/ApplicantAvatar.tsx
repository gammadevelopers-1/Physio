"use client";

/**
 * Avatar for an instructor application — initials drawn on a teal-ish
 * gradient so it visually reads "candidate" (distinct from the admin
 * Users page palette which uses blue for students and green for
 * existing instructors).
 *
 * Avatar image fallback: profileData.avatar / profilePhoto when the
 * applicant uploaded one in the wizard, else gradient + initials.
 */

import type { RoleRequest } from "@/lib/api";
import { getProfile, getApplicantInitials } from "./helpers";

const SIZE_MAP = {
  sm: "w-9 h-9 text-xs",
  md: "w-12 h-12 text-sm",
  lg: "w-16 h-16 text-base",
  xl: "w-24 h-24 text-2xl",
} as const;

const STATUS_RING: Record<string, string> = {
  PENDING: "ring-[#F59E0B]",
  APPROVED: "ring-[#16A34A]",
  REJECTED: "ring-[#DC2626]",
  MORE_INFO: "ring-[#EA580C]",
};

interface Props {
  request: RoleRequest;
  size?: keyof typeof SIZE_MAP;
  /** Color a 2-px ring around the avatar to mirror the status badge. */
  showStatusRing?: boolean;
  className?: string;
}

export default function ApplicantAvatar({
  request,
  size = "md",
  showStatusRing = false,
  className = "",
}: Props) {
  const profile = getProfile(request);
  const initials = getApplicantInitials(request);
  const sizeClass = SIZE_MAP[size];
  // BecomeTrainerForm uploads the profile photo as a `{type: "photo"}`
  // entry inside `resumeFiles`, not as a direct field on profileData.
  // Check both locations so older and newer submissions both render.
  const photoFromResumeFiles = request.resumeFiles?.find(
    (f) => f.type === "photo" && f.url,
  )?.url;
  const avatarUrl =
    profile.avatar ||
    profile.profilePhoto ||
    profile.photo ||
    photoFromResumeFiles ||
    null;
  const ringClass = showStatusRing
    ? `ring-2 ring-offset-2 ring-offset-[var(--color-surface-card)] ${
        STATUS_RING[request.status] ?? "ring-[var(--color-border)]"
      }`
    : "";

  return (
    <div className={`relative inline-block flex-shrink-0 ${className}`}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={initials}
          className={`${sizeClass} rounded-full object-cover border border-[var(--color-border)] ${ringClass}`}
        />
      ) : (
        <div
          className={`${sizeClass} rounded-full bg-gradient-to-br from-[#0EA5E9] to-[#0369A1] flex items-center justify-center font-semibold text-white select-none ${ringClass}`}
        >
          {initials}
        </div>
      )}
    </div>
  );
}
