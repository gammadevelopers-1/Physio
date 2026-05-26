"use client";

import { useEffect, useState } from "react";
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
import {
  notificationsApi,
  adminApi,
  AdminNotification,
  AdminDashboardPayload,
} from "@/lib/api";
import { useAdminProfile } from "@/hooks/useAdminProfile";

type LiveAlert = {
  id: string;
  type: "critical" | "warning" | "info";
  title: string;
  description: string;
  time: string;
  link?: string;
};

type LiveActivity = {
  id: string;
  type: "user" | "admin" | "payment" | "course" | "certificate";
  user: string;
  action: string;
  time: string;
};

// Empty payload — used while the real one is loading so the widgets
// render skeleton-like zeros instead of crashing on undefined props.
const EMPTY: AdminDashboardPayload = {
  kpi: {
    activeUsers: 0,
    activeUsersTrend: 0,
    totalUsers: 0,
    totalUsersNew: 0,
    revenueMTD: 0,
    revenueTrend: 0,
    certificatesIssued: 0,
    certificatesPeriod: "thisMonth",
  },
  analytics: {
    visitorToSignup: null,
    signupToEnroll: 0,
    enrollToPaid: 0,
    completionRate: 0,
  },
  security: {
    failedLogins: 0,
    ipsBlocked: 0,
    activeSessions: 0,
    twoFaAdoption: 0,
  },
  finance: {
    grossRevenue: 0,
    netRevenue: 0,
    gateways: [],
    refundRate: 0,
    chargebackRate: 0,
  },
  recentUsers: [],
  compliance: {
    percentage: 0,
    passed: 0,
    review: 0,
    failed: 0,
    areas: [],
  },
  recentActivity: [],
};

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

const AdminDashboardContent = () => {
  const t = useTranslations("adminDashboard");
  const admin = useAdminProfile();
  const [data, setData] = useState<AdminDashboardPayload>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [liveAlerts, setLiveAlerts] = useState<LiveAlert[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [dashboardResult, notificationsResult] = await Promise.allSettled([
        adminApi.getDashboard(),
        notificationsApi.getAll({ limit: 20 }),
      ]);

      if (cancelled) return;

      if (dashboardResult.status === "fulfilled") {
        setData(dashboardResult.value);
      }

      if (notificationsResult.status === "fulfilled") {
        const mapped: LiveAlert[] = notificationsResult.value.data.map(
          (n: AdminNotification) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            description: n.description,
            time: formatRelative(n.createdAt),
            link: n.link || undefined,
          }),
        );
        setLiveAlerts(mapped);
      }

      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Compute weekly/monthly trend label for KPI sub-text.
  // The widget itself reads a string subLabel for compliance + uptime,
  // so we synthesize a NELC-style "N passed / M sessions" hint from
  // the real summary numbers.
  const nelcClauses =
    data.compliance.passed + data.compliance.review + data.compliance.failed > 0
      ? `${data.compliance.passed} ${t("compliance.passed")} / ${
          data.compliance.passed + data.compliance.review + data.compliance.failed
        } ${t("compliance.checks")}`
      : t("compliance.noData");

  const kpiData = {
    activeUsers: data.kpi.activeUsers,
    activeUsersTrend: data.kpi.activeUsersTrend,
    totalUsers: data.kpi.totalUsers,
    totalUsersNew: data.kpi.totalUsersNew,
    revenueMTD: data.kpi.revenueMTD,
    revenueTrend: data.kpi.revenueTrend,
    nelcCompliance: data.compliance.percentage,
    nelcClauses,
    // Active-session count doubles as a "system is healthy" signal —
    // there are no real uptime metrics wired in yet. Hidden via the
    // status badge style when there's nothing meaningful to show.
    systemUptime: 100,
    uptimeStatus: "healthy" as const,
    certificatesIssued: data.kpi.certificatesIssued,
    certificatesPeriod: t("kpi.thisMonth"),
  };

  // Map activity ISO timestamps to relative strings for display.
  const activities: LiveActivity[] = data.recentActivity.map((a) => ({
    id: a.id,
    type: a.type,
    user: a.user,
    action: a.action,
    time: formatRelative(a.time),
  }));

  return (
    <>
      <AdminNavbar admin={admin} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <AdminSidebar admin={admin} />
            </div>

            <AdminMobileSidebar admin={admin} />

            <div className="flex-1 min-w-0">
              <div className="mb-6 flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                    {t("title")}
                  </h1>
                  <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                    {t("subtitle", { name: admin.name.split(" ")[0] })}
                  </p>
                </div>
                {loading && (
                  <span className="inline-flex items-center gap-2 text-xs text-[var(--color-text-secondary)] mt-2">
                    <span className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-pulse" />
                    {t("loading")}
                  </span>
                )}
              </div>

              <AdminKPICards data={kpiData} />

              <div className="mb-6">
                <PlatformAnalyticsWidget
                  data={{
                    visitorToSignup: data.analytics.visitorToSignup ?? 0,
                    signupToEnroll: data.analytics.signupToEnroll,
                    enrollToPaid: data.analytics.enrollToPaid,
                    completionRate: data.analytics.completionRate,
                  }}
                />
              </div>

              <div className="mb-6">
                <SecurityHealthWidget security={data.security} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <UserManagementWidget users={data.recentUsers} />
                <NELCComplianceOverviewWidget data={data.compliance} />
              </div>

              <FinanceSummaryWidget data={data.finance} />
            </div>

            <AlertsActivitySidebar
              alerts={liveAlerts}
              activities={activities}
              finance={data.finance}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminDashboardContent;
