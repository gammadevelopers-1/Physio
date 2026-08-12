"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supportApi } from "@/lib/api";

// Format minutes as a compact duration: "45m", "2h 15m", "3d".
function formatDurationMinutes(minutes: number | null): string {
  if (minutes == null) return "--";
  const mins = Math.max(0, Math.round(minutes));
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(mins / (60 * 24));
  const h = Math.floor((mins % (60 * 24)) / 60);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

export interface SupportProfile {
  name: string;
  email: string;
  avatar?: string;           // Uploaded profile image URL (from user.avatar)
  resolved: number;
  csat: number | null;       // 1-5 avg or null when no responses
  avgFRT: string;            // "18m" / "2h 15m" / "--"
  totalTickets: number;
  hasAnyTickets: boolean;
  isLoading: boolean;
}

/**
 * Hook that returns the logged-in support user's profile card stats.
 * Replaces the hardcoded `{ resolved: 0, csat: 0, avgFRT: "--" }` that
 * every support dashboard page was constructing inline. Polls every 60s
 * while the tab is visible so the sidebar stays fresh without a reload.
 */
export function useSupportProfile(): SupportProfile {
  const { user } = useAuth();
  const [perf, setPerf] = useState<{
    totalTickets: number;
    resolvedCount: number;
    avgFrtMinutes: number | null;
    csatAvgScore: number | null;
    csatResponses: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPerf = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await supportApi.getMyPerformance();
      setPerf(data);
    } catch {
      // Leave previous state; the sidebar already has gentle fallbacks
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchPerf();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchPerf();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchPerf]);

  const name = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
    : "";

  return {
    name,
    email: user?.email || "",
    // Uploaded profile image so SupportNavbar renders the real avatar
    // instead of the "/images/default-avatar.png" fallback.
    avatar: user?.avatar || undefined,
    resolved: perf?.resolvedCount ?? 0,
    csat: perf?.csatAvgScore ?? null,
    avgFRT: formatDurationMinutes(perf?.avgFrtMinutes ?? null),
    totalTickets: perf?.totalTickets ?? 0,
    hasAnyTickets: (perf?.totalTickets ?? 0) > 0,
    isLoading,
  };
}
