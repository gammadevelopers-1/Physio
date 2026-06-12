"use client";

import { useBadge } from "@/contexts/SidebarBadgesContext";
import type { SidebarTabKey } from "@/lib/api";

interface Props {
  tabKey: SidebarTabKey;
  // Tone variants for different attention levels. Default "info"
  // (blue) for general activity; "alert" (red) for things that
  // genuinely require action (SLA breaches, pending escalations).
  tone?: "info" | "alert";
  // Compact mode hides the count and shows only a dot. Useful for
  // mobile sidebars where horizontal space is tight.
  compact?: boolean;
}

// Caps the display so a long-unattended dashboard doesn't render
// "247" inside a small pill.
function formatCount(n: number): string {
  if (n > 99) return "99+";
  return String(n);
}

export default function SidebarBadge({
  tabKey,
  tone = "info",
  compact = false,
}: Props) {
  const count = useBadge(tabKey);
  if (count <= 0) return null;

  const tonal =
    tone === "alert"
      ? "bg-[#DC2626] text-white"
      : "bg-[var(--color-primary)] text-white";

  if (compact) {
    return (
      <span
        className={`inline-block w-2 h-2 rounded-full ${tonal} ms-auto`}
        aria-label={`${count} unread`}
      />
    );
  }

  return (
    <span
      className={`ms-auto inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-[10px] font-bold leading-none rounded-full ${tonal}`}
      aria-label={`${count} unread`}
    >
      {formatCount(count)}
    </span>
  );
}
