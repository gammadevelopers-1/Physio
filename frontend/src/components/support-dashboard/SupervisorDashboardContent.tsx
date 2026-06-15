"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { supportApi } from "@/lib/api";
import { useSupportProfile } from "@/hooks/useSupportProfile";
import SupportNavbar from "./SupportNavbar";
import SupportSidebar from "./SupportSidebar";
import SupportActiveIncidentsBar from "./SupportActiveIncidentsBar";
import SupportKPICards from "./SupportKPICards";
import TicketsBoardWidget from "./TicketsBoardWidget";
import SLAPerformanceWidget from "./SLAPerformanceWidget";
import SupportRightSidebar from "./SupportRightSidebar";
import SupportDashboardSkeleton from "./SupportDashboardSkeleton";

// Format a minute count as a compact human-readable duration.
function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null) return "--";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

const SupervisorDashboardContent = () => {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const { user } = useAuth();

  const [kpiData, setKpiData] = useState({
    openTickets: 0,
    highPriority: 0,
    medPriority: 0,
    lowPriority: 0,
    avgResponseTime: "--",
    avgResponseTrend: "",
    avgResolution: "--",
    resolutionTarget: "6h",
    csatScore: 0,        // displayed as "X.X/5"
    csatResponses: 0,
    csatTrend: "",
    slaCompliance: 100,
    slaBreaches: 0,
    escalatedTickets: 0,
    escalatedTrend: "",
  });

  const profile = useSupportProfile();
  // Track the very first load so we can show a skeleton instead of
  // zero-filled cards. Subsequent silent refreshes don't toggle this
  // so the dashboard stays readable while the latest numbers refresh.
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const fetchKPIs = useCallback(async () => {
    try {
      const data = await supportApi.getKPIs();
      setKpiData((prev) => ({
        ...prev,
        openTickets: Number(data.openTickets) || 0,
        highPriority: Number(data.highPriorityOpen) || 0,
        slaBreaches: Number(data.slaBreaches) || 0,
        slaCompliance: Number(data.slaCompliance) || 0,
        avgResponseTime: formatMinutes(data.avgFrtMinutes),
        avgResolution: formatMinutes(data.avgTtrMinutes),
        csatScore: Number(data.csatAvgScore) || 0,
        csatResponses: Number(data.csatResponses) || 0,
      }));
    } catch {
      // Leave previous state intact on failure so the UI doesn't flicker to zeros
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKPIs();
    // Auto-refresh every 60 seconds while the tab is visible.
    // Mirrors the TicketDetailContent.tsx SLA countdown pattern.
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchKPIs();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchKPIs]);

  return (
    <>
      <SupportNavbar profile={profile} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <SupportSidebar
                profile={profile}
                supportSubRole="supervisor"
              />
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                  {t("title")}
                </h1>
                <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                  {t("subtitle", {
                    name: profile.name.split(" ")[0] || "Supervisor",
                  })}
                </p>
              </div>

              {/* Active incidents strip — same component used on the
                  agent dashboard. Hides when nothing is active. */}
              <SupportActiveIncidentsBar />

              {isInitialLoading ? (
                <SupportDashboardSkeleton />
              ) : (
                <>
                  {/* KPI Cards */}
                  <SupportKPICards data={kpiData} />

                  {/* Tickets Board */}
                  <div className="mb-6">
                    <TicketsBoardWidget />
                  </div>

                  {/* SLA & Performance */}
                  <div className="mb-6">
                    <SLAPerformanceWidget />
                  </div>
                </>
              )}
            </div>

            {/* Right Sidebar — hidden during initial load; the
                dashboard skeleton above already represents the
                whole content area. */}
            {!isInitialLoading && (
              <div className="hidden xl:block xl:flex-shrink-0">
                <SupportRightSidebar />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default SupervisorDashboardContent;
