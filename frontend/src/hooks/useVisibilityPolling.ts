"use client";

import { useEffect, useRef } from "react";

/**
 * Runs `poll()` every `intervalMs` while the tab is visible, and
 * fires an immediate poll whenever the tab regains visibility so a
 * user returning to the tab sees fresh data before the next tick.
 *
 * Skips ticks when a previous poll is still in flight, so a slow
 * network won't queue up overlapping fetches.
 *
 * Used by the support ticket detail views to keep the message thread
 * live without a WebSocket — see the "how can we do it?" polling
 * plan for /tickets/:id.
 */
export function useVisibilityPolling(
  poll: () => Promise<unknown> | unknown,
  intervalMs: number,
  enabled: boolean = true,
) {
  const inFlightRef = useRef(false);
  const pollRef = useRef(poll);
  pollRef.current = poll;

  useEffect(() => {
    if (!enabled) return;
    if (typeof document === "undefined") return;

    let cancelled = false;

    const runOnce = async () => {
      if (cancelled || inFlightRef.current) return;
      if (document.visibilityState !== "visible") return;
      inFlightRef.current = true;
      try {
        await pollRef.current();
      } finally {
        inFlightRef.current = false;
      }
    };

    const id = setInterval(runOnce, intervalMs);
    const onVis = () => {
      if (document.visibilityState === "visible") void runOnce();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [intervalMs, enabled]);
}
