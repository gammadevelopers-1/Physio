"use client";

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

// Mock Admin Profile Data
const mockAdmin = {
  name: "Abdullah Al-Rashid",
  email: "admin@physio.edu.sa",
  totalUsers: 1245,
  totalCourses: 12,
  uptime: 99.9,
};

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

// Mock Users Data
const mockUsers = [
  {
    id: "1",
    name: "Faisal A.",
    initials: "FA",
    role: "instructor" as const,
    status: "active" as const,
  },
  {
    id: "2",
    name: "Sara M.",
    initials: "SA",
    role: "student" as const,
    status: "active" as const,
  },
  {
    id: "3",
    name: "Mohammed K.",
    initials: "MK",
    role: "manager" as const,
    status: "active" as const,
  },
  {
    id: "4",
    name: "Khalid H.",
    initials: "KH",
    role: "student" as const,
    status: "pending" as const,
  },
];

// Mock Compliance Data
const mockComplianceData = {
  percentage: 85,
  passed: 42,
  review: 6,
  failed: 2,
  areas: [
    { id: "1", name: "Accessibility", status: "pass" as const },
    { id: "2", name: "Content Standards", status: "review" as const },
    { id: "3", name: "Data Protection", status: "pass" as const },
    { id: "4", name: "Governance", status: "pass" as const },
  ],
};

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

// Mock Alerts Data
const mockAlerts = [
  {
    id: "1",
    type: "critical" as const,
    title: "High Failed Logins",
    description: "23 failed attempts from IP 192.168.x.x",
    time: "5 minutes ago",
  },
  {
    id: "2",
    type: "warning" as const,
    title: "NELC Review Required",
    description: "2 compliance items need attention",
    time: "1 hour ago",
  },
  {
    id: "3",
    type: "info" as const,
    title: "New User Registrations",
    description: "5 users pending approval",
    time: "2 hours ago",
  },
];

// Mock Activity Data
const mockActivities = [
  {
    id: "1",
    type: "user" as const,
    user: "Sara Mohammed",
    action: "registered",
    time: "5 min ago",
  },
  {
    id: "2",
    type: "admin" as const,
    user: "Admin",
    action: "updated role permissions",
    time: "15 min ago",
  },
  {
    id: "3",
    type: "payment" as const,
    user: "Payment",
    action: "received - SAR 1,200",
    time: "32 min ago",
  },
  {
    id: "4",
    type: "course" as const,
    user: "New Course",
    action: "published by Dr. Faisal",
    time: "1 hour ago",
  },
  {
    id: "5",
    type: "certificate" as const,
    user: "Certificate",
    action: "issued to Ahmed K.",
    time: "2 hours ago",
  },
];

const AdminDashboardContent = () => {
  const t = useTranslations("adminDashboard");

  return (
    <>
      {/* Dashboard Navbar */}
      <AdminNavbar admin={mockAdmin} />

      {/* Main Container */}
      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar - Hidden on mobile, shown via MobileSidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <AdminSidebar admin={mockAdmin} />
            </div>

            {/* Mobile Sidebar */}
            <AdminMobileSidebar admin={mockAdmin} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Title */}
              <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                  {t("title")}
                </h1>
                <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                  {t("subtitle", { name: mockAdmin.name.split(" ")[0] })}
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

              {/* Three Column Widgets */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* User Management Widget */}
                <UserManagementWidget users={mockUsers} />

                {/* NELC Compliance Overview */}
                <NELCComplianceOverviewWidget data={mockComplianceData} />

                {/* Finance Summary */}
                <FinanceSummaryWidget data={mockFinanceData} />
              </div>
            </div>

            {/* Right Sidebar - Alerts & Activity */}
            <AlertsActivitySidebar
              alerts={mockAlerts}
              activities={mockActivities}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminDashboardContent;
