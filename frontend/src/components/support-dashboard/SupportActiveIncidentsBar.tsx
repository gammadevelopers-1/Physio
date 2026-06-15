"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
} from "lucide-react";
import {
  serviceStatusApi,
  type ActiveIncidentForLink,
  type LinkedTicketSummary,
} from "@/lib/api";

/**
 * Top-of-dashboard strip listing every active service-status
 * incident so Support staff can see "what's going on platform-wide"
 * at a glance — without opening a ticket first. Each row expands to
 * show the linked tickets so the agent can jump straight in.
 *
 * Polled every 90 s. Hides itself when nothing is active so it
 * doesn't take up vertical space on a calm day.
 *
 * Mounted on both AgentDashboardContent and SupervisorDashboardContent.
 */

const POLL_MS = 90_000;

function sevTheme(sev: "minor" | "major" | "critical") {
  if (sev === "critical")
    return {
      bg: "bg-[#FEE2E2]",
      border: "border-[#FCA5A5]",
      icon: "text-[#DC2626]",
      title: "text-[#991B1B]",
      meta: "text-[#B91C1C]",
    };
  if (sev === "major")
    return {
      bg: "bg-[#FFFBEB]",
      border: "border-[#FCD34D]",
      icon: "text-[#D97706]",
      title: "text-[#92400E]",
      meta: "text-[#B45309]",
    };
  return {
    bg: "bg-[#EFF6FF]",
    border: "border-[#BFDBFE]",
    icon: "text-[#2563EB]",
    title: "text-[#1E3A8A]",
    meta: "text-[#1D4ED8]",
  };
}

export default function SupportActiveIncidentsBar() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const [incidents, setIncidents] = useState<ActiveIncidentForLink[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ticketsByIncident, setTicketsByIncident] = useState<
    Record<string, LinkedTicketSummary[] | "loading" | "error">
  >({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await serviceStatusApi.listActiveForLink();
        if (!cancelled) setIncidents(data);
      } catch {
        // Silent — banner is informational, never blocks the page.
      }
    };
    load();
    const tick = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, []);

  if (incidents.length === 0) return null;

  const toggle = async (incidentId: string) => {
    if (expandedId === incidentId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(incidentId);
    if (!ticketsByIncident[incidentId]) {
      setTicketsByIncident((prev) => ({ ...prev, [incidentId]: "loading" }));
      try {
        // Support-scoped endpoint so supervisors + agents can read this
        // without needing admin role.
        const linkedTickets =
          await serviceStatusApi.listTicketsForIncidentSupport(incidentId);
        setTicketsByIncident((prev) => ({
          ...prev,
          [incidentId]: linkedTickets,
        }));
      } catch {
        setTicketsByIncident((prev) => ({ ...prev, [incidentId]: "error" }));
      }
    }
  };

  return (
    <div className="mb-4 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-[#D97706]" />
        <span className="text-[11px] uppercase tracking-wide font-semibold text-[var(--color-text-secondary)]">
          {isAr
            ? `${incidents.length} حادث نشط`
            : `${incidents.length} active incident${incidents.length === 1 ? "" : "s"}`}
        </span>
      </div>
      <div className="space-y-2">
        {incidents.map((inc) => {
          const theme = sevTheme(inc.severity);
          const isOpen = expandedId === inc.id;
          const linked = ticketsByIncident[inc.id];
          return (
            <div
              key={inc.id}
              className={`${theme.bg} ${theme.border} border rounded-xl overflow-hidden`}
            >
              <button
                type="button"
                onClick={() => toggle(inc.id)}
                className="w-full px-3 py-2.5 flex items-start gap-3 text-start"
              >
                <AlertTriangle
                  className={`w-4 h-4 mt-0.5 flex-shrink-0 ${theme.icon}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${theme.title}`}>
                      {isAr && inc.titleAr ? inc.titleAr : inc.titleEn}
                    </span>
                    <span
                      className={`text-[9px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded ${theme.icon} bg-white`}
                    >
                      {inc.severity}
                    </span>
                    <span className={`text-[10px] uppercase ${theme.meta}`}>
                      · {inc.currentStatus.replace("_", " ")}
                    </span>
                    {inc.audience === "end_users" && (
                      <span
                        className={`text-[9px] uppercase tracking-wide font-semibold ${theme.meta}`}
                      >
                        · end-user
                      </span>
                    )}
                    {typeof inc.linkedTicketsCount === "number" &&
                      inc.linkedTicketsCount > 0 && (
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white border ${theme.border} ${theme.meta}`}
                        >
                          {inc.linkedTicketsCount} ticket
                          {inc.linkedTicketsCount === 1 ? "" : "s"}
                        </span>
                      )}
                  </div>
                </div>
                {isOpen ? (
                  <ChevronUp className={`w-4 h-4 ${theme.meta}`} />
                ) : (
                  <ChevronDown className={`w-4 h-4 ${theme.meta}`} />
                )}
              </button>

              {isOpen && (
                <div
                  className={`border-t ${theme.border} px-3 py-2 bg-white/60`}
                >
                  {linked === "loading" && (
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] py-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {isAr ? "جارٍ التحميل…" : "Loading tickets…"}
                    </div>
                  )}
                  {linked === "error" && (
                    <div className="text-xs text-[#DC2626] py-2">
                      {isAr ? "تعذر التحميل" : "Couldn't load"}
                    </div>
                  )}
                  {Array.isArray(linked) && linked.length === 0 && (
                    <p className="text-xs text-[var(--color-text-secondary)] py-2">
                      {isAr
                        ? "لا توجد تذاكر مرتبطة بهذا الحادث بعد."
                        : "No tickets linked to this incident yet."}
                    </p>
                  )}
                  {Array.isArray(linked) && linked.length > 0 && (
                    <ul className="divide-y divide-[var(--color-border-subtle)]">
                      {linked.map((t) => {
                        const name =
                          [t.studentFirstName, t.studentLastName]
                            .filter(Boolean)
                            .join(" ") || "—";
                        return (
                          <li key={t.ticketId}>
                            <a
                              href={`/${locale}/dashboard/support/supervisor/tickets/${t.ticketId}`}
                              className="flex items-center gap-2 py-1.5 text-xs hover:bg-[var(--color-border-subtle)] rounded px-1"
                            >
                              <span className="font-mono text-[10px] text-[var(--color-text-secondary)]">
                                {t.referenceNumber}
                              </span>
                              <span className="flex-1 truncate text-[var(--color-text-primary)]">
                                {t.subject}
                              </span>
                              <span className="text-[10px] text-[var(--color-text-secondary)]">
                                {name}
                              </span>
                              <span className="text-[10px] uppercase font-semibold text-[var(--color-primary)]">
                                {t.status}
                              </span>
                              <ExternalLink className="w-3 h-3 text-[var(--color-text-secondary)]" />
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
