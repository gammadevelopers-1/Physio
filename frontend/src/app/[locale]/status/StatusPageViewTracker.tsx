"use client";

import { useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

/**
 * Tiny client component that POSTs a view event to the public
 * tracking endpoint once on mount. Cookie-deduped server-side so
 * refreshes don't inflate counts.
 *
 * Mounts inside the server-rendered status page. Failure is silent
 * — analytics is a "nice to have", never block the page.
 */
export default function StatusPageViewTracker({
  incidentId,
}: {
  incidentId?: string;
}) {
  useEffect(() => {
    fetch(`${API_URL}/public/service-status/view`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(incidentId ? { incidentId } : {}),
    }).catch(() => {
      // Silent — never break the status page over a tracking failure.
    });
  }, [incidentId]);

  return null;
}
