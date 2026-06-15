"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { AlertTriangle, ExternalLink, X } from "lucide-react";
import { useIsAuthenticated } from "@/contexts/AuthContext";
import {
  serviceStatusApi,
  type IncidentBannerEntry,
} from "@/lib/api";

/**
 * Cross-dashboard banner for active end-user incidents targeted at
 * the current user's role(s). One row per incident; severity drives
 * the color (red = critical, amber = major, blue = minor). Dismissal
 * is persisted per-incident in localStorage along with the latest
 * update id — if the admin posts a new update the banner reappears
 * so users see the fresh message.
 *
 * Polls every 60 s so a newly-created incident shows up without
 * needing a hard refresh. The endpoint is cheap (one indexed query +
 * the latest-update grouping).
 *
 * Mounted in `(dashboards)/layout.tsx` so it appears on every
 * student/instructor/manager/TA/finance dashboard page; admin +
 * support don't see end-user banners (they're managing the incident).
 */
const POLL_MS = 60_000;
const DISMISS_STORAGE_KEY = "pg.incident.banner.dismissed.v1";

type DismissedMap = Record<string, string>; // incidentId → latestUpdateId

function readDismissed(): DismissedMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(DISMISS_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeDismissed(map: DismissedMap) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(map));
}

export default function IncidentBanner() {
  const isAuthed = useIsAuthenticated();
  const locale = useLocale();
  const isAr = locale === "ar";
  const [incidents, setIncidents] = useState<IncidentBannerEntry[]>([]);
  const [dismissed, setDismissed] = useState<DismissedMap>({});

  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    let cancelled = false;
    const load = async () => {
      try {
        const data = await serviceStatusApi.listBannerIncidents();
        if (!cancelled) setIncidents(data);
      } catch {
        // Silent — banner is a soft feature, never block a render.
      }
    };
    load();
    const tick = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, [isAuthed]);

  if (!isAuthed) return null;

  const visible = incidents.filter((inc) => {
    const dismissedFor = dismissed[inc.id];
    // Re-show when a NEW update is posted after dismissal.
    const latestUpdateId = inc.latestUpdate?.id ?? "none";
    return dismissedFor !== latestUpdateId;
  });

  if (visible.length === 0) return null;

  const handleDismiss = (inc: IncidentBannerEntry) => {
    const next = { ...dismissed, [inc.id]: inc.latestUpdate?.id ?? "none" };
    setDismissed(next);
    writeDismissed(next);
  };

  return (
    <div className="space-y-2 px-4 lg:px-6 pt-3">
      {visible.map((inc) => (
        <BannerRow
          key={inc.id}
          incident={inc}
          isAr={isAr}
          onDismiss={() => handleDismiss(inc)}
        />
      ))}
    </div>
  );
}

function BannerRow({
  incident,
  isAr,
  onDismiss,
}: {
  incident: IncidentBannerEntry;
  isAr: boolean;
  onDismiss: () => void;
}) {
  const sev = incident.severity;
  const palette =
    sev === "critical"
      ? {
          bg: "bg-[#FEE2E2]",
          border: "border-[#FCA5A5]",
          iconBg: "bg-[#DC2626]",
          title: "text-[#991B1B]",
          body: "text-[#B91C1C]",
        }
      : sev === "major"
        ? {
            bg: "bg-[#FFFBEB]",
            border: "border-[#FCD34D]",
            iconBg: "bg-[#D97706]",
            title: "text-[#92400E]",
            body: "text-[#B45309]",
          }
        : {
            bg: "bg-[#EFF6FF]",
            border: "border-[#BFDBFE]",
            iconBg: "bg-[#2563EB]",
            title: "text-[#1E3A8A]",
            body: "text-[#1D4ED8]",
          };

  const title = (isAr && incident.titleAr ? incident.titleAr : incident.titleEn);
  const latest = incident.latestUpdate;
  const message = latest
    ? isAr && latest.messageAr
      ? latest.messageAr
      : latest.messageEn
    : null;

  return (
    <div
      className={`${palette.bg} ${palette.border} border rounded-xl px-3 py-2.5 flex items-start gap-3`}
      role="alert"
    >
      <div
        className={`${palette.iconBg} text-white w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center`}
      >
        <AlertTriangle className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-semibold ${palette.title}`}>
            {title}
          </span>
          <span
            className={`text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded ${palette.iconBg} text-white`}
          >
            {sev}
          </span>
          <span className={`text-[10px] uppercase tracking-wide ${palette.body}`}>
            · {incident.currentStatus.replace("_", " ")}
          </span>
        </div>
        {message && (
          <p className={`text-xs mt-1 ${palette.body} leading-relaxed line-clamp-3`}>
            {message}
          </p>
        )}
        <Link
          href={`/${isAr ? "ar" : "en"}/status`}
          className={`inline-flex items-center gap-1 text-[11px] font-medium ${palette.title} hover:underline mt-1.5`}
        >
          {isAr ? "صفحة الحالة" : "View status page"}
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className={`flex-shrink-0 ${palette.body} hover:opacity-70 transition-opacity`}
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
