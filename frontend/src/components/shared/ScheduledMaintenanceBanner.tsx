"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Calendar, Wrench, X } from "lucide-react";
import { useIsAuthenticated } from "@/contexts/AuthContext";
import {
  scheduledMaintenanceApi,
  type ScheduledMaintenanceWindow,
} from "@/lib/api";

/**
 * Pre-notification + active-current banner for scheduled maintenance.
 * Mounts alongside <IncidentBanner /> inside each role's navbar.
 *
 * Two visual modes:
 *
 *  - When the current is `active` → red "maintenance in progress" tone
 *  - When the current is `scheduled` and within its lead time → amber
 *    "heads-up" tone with the start time
 *
 * Dismissal is per-current (localStorage). Re-shows if the admin edits
 * the current (preNotificationSentAt cleared → server returns a new
 * current after the edit).
 */
const POLL_MS = 60_000;
const DISMISS_STORAGE_KEY = "pg.scheduled-maint.banner.dismissed.v1";

function readDismissed(): Record<string, true> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(DISMISS_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeDismissed(map: Record<string, true>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(map));
}

export default function ScheduledMaintenanceBanner() {
  const isAuthed = useIsAuthenticated();
  const locale = useLocale();
  const isAr = locale === "ar";
  const [current, setWindow] = useState<ScheduledMaintenanceWindow | null>(null);
  const [dismissed, setDismissed] = useState<Record<string, true>>({});

  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    let cancelled = false;
    const load = async () => {
      try {
        const w = await scheduledMaintenanceApi.banner();
        if (!cancelled) setWindow(w);
      } catch {
        // Silent — banner is soft.
      }
    };
    load();
    const tick = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, [isAuthed]);

  if (!isAuthed || !current) return null;
  if (dismissed[current.id]) return null;

  const handleDismiss = () => {
    const next = { ...dismissed, [current.id]: true as const };
    setDismissed(next);
    writeDismissed(next);
  };

  const title = isAr && current.titleAr ? current.titleAr : current.titleEn;
  const description = isAr && current.descriptionAr
    ? current.descriptionAr
    : current.descriptionEn;

  const isActive = current.status === "active";

  const theme = isActive
    ? {
        bg: "bg-[#FEE2E2]",
        border: "border-[#FCA5A5]",
        iconBg: "bg-[#DC2626]",
        title: "text-[#991B1B]",
        body: "text-[#B91C1C]",
      }
    : {
        bg: "bg-[#FFFBEB]",
        border: "border-[#FCD34D]",
        iconBg: "bg-[#D97706]",
        title: "text-[#92400E]",
        body: "text-[#B45309]",
      };

  const startDate = current.startAt ? new Date(current.startAt) : null;
  const endDate = current.endAt ? new Date(current.endAt) : null;
  const startValid = startDate && !Number.isNaN(startDate.getTime());
  const endValid = endDate && !Number.isNaN(endDate.getTime());
  // If the API somehow handed us bad dates, skip the banner entirely rather
  // than throw `RangeError: Invalid time value` from Intl.DateTimeFormat,
  // which would crash the entire dashboard tree.
  if (!startValid || !endValid) return null;

  const fmt = new Intl.DateTimeFormat(isAr ? "ar-SA" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const currentRange = `${fmt.format(startDate!)} – ${fmt.format(endDate!)}`;

  return (
    <div className="space-y-2 px-4 lg:px-6 pt-3">
      <div
        className={`${theme.bg} ${theme.border} border rounded-xl px-3 py-2.5 flex items-start gap-3`}
        role="alert"
      >
        <div
          className={`${theme.iconBg} text-white w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center`}
        >
          {isActive ? (
            <Wrench className="w-4 h-4" />
          ) : (
            <Calendar className="w-4 h-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[9px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded ${theme.iconBg} text-white`}
            >
              {isActive
                ? isAr
                  ? "صيانة جارية"
                  : "Maintenance in progress"
                : isAr
                  ? "صيانة مجدولة"
                  : "Scheduled maintenance"}
            </span>
            <span className={`text-sm font-semibold ${theme.title}`}>
              {title}
            </span>
          </div>
          <p className={`text-xs mt-1 ${theme.body} font-medium`}>
            {currentRange}
          </p>
          {description && (
            <p className={`text-xs mt-1 ${theme.body} line-clamp-2`}>
              {description}
            </p>
          )}
          {current.affectedComponents.length > 0 && (
            <p className={`text-[10px] mt-1 ${theme.body}`}>
              {isAr ? "الخدمات المتأثرة: " : "Affected services: "}
              {current.affectedComponents.join(", ")}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className={`flex-shrink-0 ${theme.body} hover:opacity-70 transition-opacity`}
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
