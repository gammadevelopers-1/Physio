"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { supportApi } from "@/lib/api";
import SupportNavbar from "./SupportNavbar";
import SupportSidebar from "./SupportSidebar";
import SupportMobileSidebar from "./SupportMobileSidebar";
import SupportKPICards from "./SupportKPICards";
import TicketsBoardWidget from "./TicketsBoardWidget";
import SLAPerformanceWidget from "./SLAPerformanceWidget";
import SupportRightSidebar from "./SupportRightSidebar";

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
    csatScore: 0,
    csatTrend: "",
    slaCompliance: 0,
    slaBreaches: 0,
    escalatedTickets: 0,
    escalatedTrend: "",
  });

  const profile = {
    name: user
      ? [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        user.email
      : "",
    email: user?.email || "",
    resolved: 0,
    csat: 0,
    avgFRT: "--",
  };

  useEffect(() => {
    async function fetchKPIs() {
      try {
        const data = await supportApi.getKPIs();
        setKpiData((prev) => ({
          ...prev,
          openTickets: Number(data.openTickets) || 0,
          highPriority: Number(data.highPriorityOpen) || 0,
          slaBreaches: Number(data.slaBreaches) || 0,
          avgResponseTime: data.avgFrtMinutes
            ? `${Math.round(data.avgFrtMinutes)}m`
            : "--",
          avgResolution: data.avgTtrMinutes
            ? data.avgTtrMinutes > 60
              ? `${(data.avgTtrMinutes / 60).toFixed(1)}h`
              : `${Math.round(data.avgTtrMinutes)}m`
            : "--",
        }));
      } catch {
        // Show defaults
      }
    }
    fetchKPIs();
  }, []);

  return (
    <>
      <SupportNavbar profile={profile} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <SupportSidebar
                profile={profile}
                supportSubRole="supervisor"
              />
            </div>

            {/* Mobile Sidebar */}
            <SupportMobileSidebar
              profile={profile}
              supportSubRole="supervisor"
            />

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
            </div>

            {/* Right Sidebar */}
            <div className="hidden xl:block xl:flex-shrink-0">
              <SupportRightSidebar />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SupervisorDashboardContent;
