"use client";

/**
 * Reusable user avatar with three layers of fallback:
 *   1. The user's uploaded avatar image (signed URL or public URL)
 *   2. Initials drawn on a role-colored gradient circle
 *   3. A single "?" placeholder if the user has neither name nor email
 *
 * The optional online dot (`showOnlineDot`) is anchored bottom-right
 * and signals "active in the last 5 minutes" — useful for the users
 * table presence column.
 */

interface UserLike {
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
  avatar?: string | null;
  activeRole?: string;
  lastLoginAt?: string | null;
  isActive?: boolean;
}

interface Props {
  user: UserLike;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showOnlineDot?: boolean;
  className?: string;
}

const SIZE_MAP = {
  xs: "w-7 h-7 text-[10px]",
  sm: "w-9 h-9 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-lg",
  xl: "w-24 h-24 text-3xl",
} as const;

const ROLE_GRADIENTS: Record<string, string> = {
  ADMIN: "from-[#DC2626] to-[#991B1B]",
  SUPER_ADMIN: "from-[#7C3AED] to-[#5B21B6]",
  MANAGER: "from-[#0EA5E9] to-[#0369A1]",
  INSTRUCTOR: "from-[#10B981] to-[#047857]",
  TEACHING_ASSISTANT: "from-[#06B6D4] to-[#0E7490]",
  STUDENT: "from-[#3B82F6] to-[#1D4ED8]",
  FINANCE: "from-[#D4A520] to-[#92740F]",
  SUPPORT: "from-[#F59E0B] to-[#B45309]",
};

function getInitials(user: UserLike): string {
  const first = user.firstName?.[0] || "";
  const last = user.lastName?.[0] || "";
  if (first || last) return (first + last).toUpperCase();
  if (user.email) return user.email[0].toUpperCase();
  return "?";
}

function isOnline(user: UserLike): boolean {
  if (!user.isActive) return false;
  if (!user.lastLoginAt) return false;
  const lastLogin = new Date(user.lastLoginAt).getTime();
  return Date.now() - lastLogin < 5 * 60 * 1000;
}

export default function UserAvatar({
  user,
  size = "md",
  showOnlineDot = false,
  className = "",
}: Props) {
  const sizeClass = SIZE_MAP[size];
  const gradient =
    ROLE_GRADIENTS[user.activeRole ?? ""] ?? "from-[#64748B] to-[#334155]";
  const online = showOnlineDot && isOnline(user);

  return (
    <div className={`relative inline-block flex-shrink-0 ${className}`}>
      {user.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatar}
          alt={getInitials(user)}
          className={`${sizeClass} rounded-full object-cover border border-[var(--color-border)]`}
        />
      ) : (
        <div
          className={`${sizeClass} rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center font-semibold text-white select-none`}
        >
          {getInitials(user)}
        </div>
      )}
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#22C55E] rounded-full ring-2 ring-[var(--color-surface-card)]" />
      )}
    </div>
  );
}
