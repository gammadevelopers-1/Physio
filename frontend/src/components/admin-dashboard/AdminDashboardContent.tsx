"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import AdminSidebar from "./AdminSidebar";
import AdminMobileSidebar from "./AdminMobileSidebar";
import AdminNavbar from "./AdminNavbar";
import AdminKPICards from "./AdminKPICards";
import PlatformAnalyticsWidget from "./PlatformAnalyticsWidget";
import SecurityHealthWidget from "./SecurityHealthWidget";
import UserManagementWidget from "./UserManagementWidget";
import NELCComplianceOverviewWidget from "./NELCComplianceOverviewWidget";
import FinanceSummaryWidget from "./FinanceSummaryWidget";
import AlertsActivitySidebar from "./AlertsActivitySidebar";
import { notificationsApi, AdminNotification } from "@/lib/api";
import { useAdminProfile } from "@/hooks/useAdminProfile";

// Mock KPI Data
const mockKPIData = {
  activeUsers: 1245,
  activeUsersTrend: 8,
  totalUsers: 2458,
  totalUsersNew: 45,
  revenueMTD: 245000,
  revenueTrend: 12,
  nelcCompliance: 85,
  nelcClauses: "42/50 clauses",
  systemUptime: 99.9,
  uptimeStatus: "healthy" as const,
  certificatesIssued: 156,
  certificatesPeriod: "This month",
};

// Mock Analytics Data
const mockAnalyticsData = {
  visitorToSignup: 24,
  signupToEnroll: 68,
  enrollToPaid: 82,
  completionRate: 78,
};

// Mock Security Data
const mockSecurityData = {
  failedLogins: 23,
  ipsBlocked: 5,
  activeSessions: 342,
  twoFaAdoption: 76,
};

// Mock System Data
const mockSystemData = {
  apiLatency: 45,
  apiLatencyStatus: "healthy" as const,
  errorRate: 0.02,
  errorRateStatus: "healthy" as const,
  lastBackup: "2h ago",
  dbHealth: "good" as const,
};

// Mock Users Data - will be translated in component

// Mock Compliance Data - will be translated in component

// Mock Finance Data
const mockFinanceData = {
  grossRevenue: 245000,
  netRevenue: 228000,
  gateways: [
    { name: "Tap/Moyasar", percentage: 72 },
    { name: "BNPL (Tamara)", percentage: 28 },
  ],
  refundRate: 2.1,
  chargebackRate: 0.3,
};

// Mock Alerts Data - will be translated in component

const AdminDashboardContent = () => {
  const t = useTranslations("adminDashboard");
  const admin = useAdminProfile();
  const [liveAlerts, setLiveAlerts] = useState<
    { id: string; type: "critical" | "warning" | "info"; title: string; description: string; time: string; link?: string }[]
  >([]);

  // Fetch real notifications from backend
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const result = await notificationsApi.getAll({ limit: 10 });
        const mapped = result.data.map((n: AdminNotification) => {
          const createdAt = new Date(n.createdAt);
          const diffMs = Date.now() - createdAt.getTime();
          const diffMin = Math.floor(diffMs / 60000);
          const diffHr = Math.floor(diffMin / 60);
          const timeStr =
            diffMin < 60
              ? `${diffMin}m ago`
              : diffHr < 24
                ? `${diffHr}h ago`
                : `${Math.floor(diffHr / 24)}d ago`;
          return {
            id: n.id,
            type: n.type,
            title: n.title,
            description: n.description,
            time: timeStr,
            link: n.link || undefined,
          };
        });
        setLiveAlerts(mapped);
      } catch {
        // Not an admin or not logged in - ignore
      }
    };
    fetchNotifications();
  }, []);

  // Mock Activity Data with translations
  const mockActivities = [
    {
      id: "1",
      type: "user" as const,
      user: "سارة محمد",
      action: t("activity.actions.registered"),
      time: t("activity.time.minAgo", { count: 5 }),
    },
    {
      id: "2",
      type: "admin" as const,
      user: t("activity.users.admin"),
      action: t("activity.actions.updatedRolePermissions"),
      time: t("activity.time.minAgo", { count: 15 }),
    },
    {
      id: "3",
      type: "payment" as const,
      user: t("activity.users.payment"),
      action: `${t("activity.actions.paymentReceived")} - SAR 1,200`,
      time: t("activity.time.minAgo", { count: 32 }),
    },
    {
      id: "4",
      type: "course" as const,
      user: t("activity.users.newCourse"),
      action: `${t("activity.actions.coursePublished")} Dr. Faisal`,
      time: t("activity.time.hourAgo", { count: 1 }),
    },
    {
      id: "5",
      type: "certificate" as const,
      user: t("activity.users.certificate"),
      action: `${t("activity.actions.certificateIssued")} Ahmed K.`,
      time: t("activity.time.hoursAgo", { count: 2 }),
    },
  ];

  // Mock Alerts Data with translations
  const mockAlerts = [
    {
      id: "1",
      type: "critical" as const,
      title: t("alerts.items.highFailedLogins"),
      description: t("alerts.items.highFailedLoginsDesc"),
      time: t("alerts.time.minutesAgo", { count: 5 }),
    },
    {
      id: "2",
      type: "warning" as const,
      title: t("alerts.items.nelcReviewRequired"),
      description: t("alerts.items.nelcReviewRequiredDesc"),
      time: t("alerts.time.hourAgo", { count: 1 }),
    },
    {
      id: "3",
      type: "info" as const,
      title: t("alerts.items.newUserRegistrations"),
      description: t("alerts.items.newUserRegistrationsDesc"),
      time: t("alerts.time.hoursAgo", { count: 2 }),
    },
  ];

  // Mock Users Data with translations
  const mockUsers = [
    {
      id: "1",
      name: t("userManagement.sampleUsers.faisal"),
      initials: "FA",
      role: "instructor" as const,
      status: "active" as const,
    },
    {
      id: "2",
      name: t("userManagement.sampleUsers.sara"),
      initials: "SA",
      role: "student" as const,
      status: "active" as const,
    },
    {
      id: "3",
      name: t("userManagement.sampleUsers.mohammed"),
      initials: "MK",
      role: "manager" as const,
      status: "active" as const,
    },
    {
      id: "4",
      name: t("userManagement.sampleUsers.khalid"),
      initials: "KH",
      role: "student" as const,
      status: "pending" as const,
    },
  ];

  // Mock Compliance Data with translations
  const mockComplianceData = {
    percentage: 85,
    passed: 42,
    review: 6,
    failed: 2,
    areas: [
      { id: "1", name: t("compliance.areas.accessibility"), status: "pass" as const },
      { id: "2", name: t("compliance.areas.contentStandards"), status: "review" as const },
      { id: "3", name: t("compliance.areas.dataProtection"), status: "pass" as const },
      { id: "4", name: t("compliance.areas.governance"), status: "pass" as const },
    ],
  };

  return (
    <>
      {/* Dashboard Navbar */}
      <AdminNavbar admin={admin} />

      {/* Main Container */}
      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar - Hidden on mobile, shown via MobileSidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <AdminSidebar admin={admin} />
            </div>

            {/* Mobile Sidebar */}
            <AdminMobileSidebar admin={admin} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Title */}
              <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                  {t("title")}
                </h1>
                <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                  {t("subtitle", { name: admin.name.split(" ")[0] })}
                </p>
              </div>

              {/* KPI Cards */}
              <AdminKPICards data={mockKPIData} />

              {/* Platform Analytics */}
              <div className="mb-6">
                <PlatformAnalyticsWidget data={mockAnalyticsData} />
              </div>

              {/* Security & System Health */}
              <div className="mb-6">
                <SecurityHealthWidget
                  security={mockSecurityData}
                  system={mockSystemData}
                />
              </div>

              {/* Users & NELC Compliance - Two Column Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* User Management Widget */}
                <UserManagementWidget users={mockUsers} />

                {/* NELC Compliance Overview */}
                <NELCComplianceOverviewWidget data={mockComplianceData} />
              </div>
            </div>

            {/* Right Sidebar - Alerts, Activity & Finance */}
            <AlertsActivitySidebar
              alerts={[...liveAlerts, ...mockAlerts]}
              activities={mockActivities}
              finance={mockFinanceData}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminDashboardContent;
