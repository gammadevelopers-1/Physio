"use client";

import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import SupportNavbar from "./SupportNavbar";
import SupportSidebar from "./SupportSidebar";
import SupportMobileSidebar from "./SupportMobileSidebar";
import SupportKPICards from "./SupportKPICards";
import TicketsBoardWidget from "./TicketsBoardWidget";
import SLAPerformanceWidget from "./SLAPerformanceWidget";
import SupportRightSidebar from "./SupportRightSidebar";

// Mock Support Profile
const mockProfile = {
  name: "Hana Al-Saud",
  email: "h.alsaud@physio.edu.sa",
  resolved: 156,
  csat: 94,
  avgFRT: "1.2h",
};

// Mock KPI Data
const mockKPIData = {
  openTickets: 23,
  highPriority: 5,
  medPriority: 12,
  lowPriority: 6,
  avgResponseTime: "1.2h",
  avgResponseTrend: "-15%",
  avgResolution: "4.5h",
  resolutionTarget: "6h",
  csatScore: 94,
  csatTrend: "+3%",
  slaCompliance: 92,
  slaBreaches: 2,
  escalatedTickets: 4,
  escalatedTrend: "+2",
};

const SupportDashboardContent = () => {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();

  const profile = { ...mockProfile, name: t("names.hanaAlSaud") };

  return (
    <>
      {/* Dashboard Navbar */}
      <SupportNavbar profile={profile} />

      {/* Main Container */}
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar - Hidden on mobile */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <SupportSidebar profile={profile} />
            </div>

            {/* Mobile Sidebar */}
            <SupportMobileSidebar profile={profile} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Title */}
              <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                  {t("title")}
                </h1>
                <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                  {t("subtitle", { name: profile.name.split(" ")[0] })}
                </p>
              </div>

              {/* KPI Cards */}
              <SupportKPICards data={mockKPIData} />

              {/* Tickets Board */}
              <div className="mb-6">
                <TicketsBoardWidget />
              </div>

              {/* SLA & Performance */}
              <div className="mb-6">
                <SLAPerformanceWidget />
              </div>
            </div>

            {/* Right Sidebar - Hidden on mobile, shown on xl */}
            <div className="hidden xl:block xl:flex-shrink-0">
              <SupportRightSidebar />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SupportDashboardContent;
