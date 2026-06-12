"use client";

/**
 * SidebarBadgesProvider — fetches the per-tab unread counters once on
 * mount and polls every 60s while a dashboard is open. Exposes:
 *
 *   useBadge(key)        — current count for a tab
 *   useBadges()          — full count map
 *   useMarkTabViewed()   — clears a tab's badge (call from page on mount)
 *
 * The provider is mounted inside DashboardAuthGuard so it only runs
 * for authenticated users and shares one fetcher across every sidebar
 * + page in a dashboard. Failures are silent — a missing badge is a
 * UX nicety, never blocking.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { sidebarBadgesApi, type SidebarTabKey } from "@/lib/api";

const POLL_INTERVAL_MS = 60_000;

interface SidebarBadgesContextValue {
  counts: Record<string, number>;
  refresh: () => Promise<void>;
  markViewed: (key: SidebarTabKey) => Promise<void>;
}

const SidebarBadgesContext = createContext<SidebarBadgesContextValue>({
  counts: {},
  refresh: async () => {},
  markViewed: async () => {},
});

export function SidebarBadgesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  // Track the latest in-flight fetch so a rapid refresh sequence
  // (e.g. mark-viewed → refresh → mark-viewed → refresh) doesn't let
  // a stale response overwrite a fresh one.
  const fetchSeqRef = useRef(0);

  const refresh = useCallback(async () => {
    const seq = ++fetchSeqRef.current;
    try {
      const data = await sidebarBadgesApi.get();
      if (seq === fetchSeqRef.current) {
        setCounts(data || {});
      }
    } catch {
      // Silent — badges are decorative; never break the dashboard
    }
  }, []);

  const markViewed = useCallback(
    async (key: SidebarTabKey) => {
      // Optimistic local clear so the badge disappears immediately,
      // even if the server round-trip lags. Refresh afterwards
      // reconciles with the source of truth.
      setCounts((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        next[key] = 0;
        return next;
      });
      try {
        await sidebarBadgesApi.markViewed(key);
      } catch {
        // Swallow — next poll will resync. Optimistic 0 is fine even
        // if the write failed; user already "saw" the tab content.
      }
      // Defer refresh so we don't race with the same tick that just
      // optimistically cleared. Next poll catches any drift.
    },
    [],
  );

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <SidebarBadgesContext.Provider value={{ counts, refresh, markViewed }}>
      {children}
    </SidebarBadgesContext.Provider>
  );
}

export function useBadge(key: SidebarTabKey): number {
  const { counts } = useContext(SidebarBadgesContext);
  return counts[key] || 0;
}

export function useBadges(): Record<string, number> {
  return useContext(SidebarBadgesContext).counts;
}

export function useMarkTabViewed(): (key: SidebarTabKey) => Promise<void> {
  return useContext(SidebarBadgesContext).markViewed;
}
