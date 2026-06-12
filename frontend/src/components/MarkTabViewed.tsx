"use client";

import { useEffect } from "react";
import { useMarkTabViewed } from "@/contexts/SidebarBadgesContext";
import type { SidebarTabKey } from "@/lib/api";

// One-shot side effect that bumps the user's "last viewed" timestamp
// for a sidebar tab. Drop this into any page that owns a badge — the
// badge clears on the next poll. Renders nothing; only the mount
// effect matters.
export default function MarkTabViewed({ tabKey }: { tabKey: SidebarTabKey }) {
  const markViewed = useMarkTabViewed();
  useEffect(() => {
    markViewed(tabKey);
    // markViewed is stable from the context (useCallback), so it's
    // safe to depend on directly without re-running on every render.
  }, [markViewed, tabKey]);
  return null;
}
