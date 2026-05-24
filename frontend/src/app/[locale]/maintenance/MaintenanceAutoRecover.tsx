"use client";

import { useEffect } from "react";
import { publicSettingsApi } from "@/lib/api";

interface MaintenanceAutoRecoverProps {
  locale: string;
}

/**
 * Polls the maintenance status every 30 seconds. Once the admin
 * flips the toggle off, navigates the visitor back to the site root
 * instead of leaving them stranded on this page. Pure client-side,
 * mounted invisibly by the server page.
 */
export default function MaintenanceAutoRecover({ locale }: MaintenanceAutoRecoverProps) {
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const status = await publicSettingsApi.getMaintenanceStatus();
        if (!status.enabled) {
          window.location.href = `/${locale}`;
        }
      } catch {
        // ignore transient failures — try again next tick
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [locale]);

  return null;
}
