"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import AdminSidebar from "./AdminSidebar";
import AdminMobileSidebar from "./AdminMobileSidebar";
import AdminNavbar from "./AdminNavbar";
import AdminKPICards from "./AdminKPICards";
import PlatformAnalyticsWidget from "./PlatformAnalyticsWidget";
import UserManagementWidget from "./UserManagementWidget";
import NELCComplianceOverviewWidget from "./NELCComplianceOverviewWidget";
import FinanceSummaryWidget from "./FinanceSummaryWidget";
import RecentPointsWidget from "./RecentPointsWidget";
import SecuritySnapshotWidget from "./SecuritySnapshotWidget";
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
    pendingApplications: 0,
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
  recentPoints: [],
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
      } else {
        const err = dashboardResult.reason;
        const msg =
          err && typeof err === "object" && "message" in err
            ? String((err as { message: unknown }).message)
            : "Failed to load dashboard data";
        toast.error(msg);
        // eslint-disable-next-line no-console
        console.error("admin dashboard fetch failed", err);
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

  // Build the NELC sub-label out of the real summary numbers so the
  // KPI card shows "{passed} passed / {total} checks" rather than a
  // hard-coded clause count.
  const nelcTotal =
    data.compliance.passed + data.compliance.review + data.compliance.failed;
  const nelcClauses =
    nelcTotal > 0
      ? `${data.compliance.passed} ${t("compliance.passed")} / ${nelcTotal} ${t("compliance.checks")}`
      : t("compliance.noData");

  const kpiData = {
    activeUsers: data.kpi.activeUsers,
    activeUsersTrend: data.kpi.activeUsersTrend,
    revenueMTD: data.kpi.revenueMTD,
    revenueTrend: data.kpi.revenueTrend,
    pendingApplications: data.kpi.pendingApplications,
    nelcCompliance: data.compliance.percentage,
    nelcClauses,
    newUsers7d: data.kpi.totalUsersNew,
    certificatesIssued: data.kpi.certificatesIssued,
    twoFaAdoption: data.security.twoFaAdoption,
    activeSessions: data.security.activeSessions,
  };

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

              {/* KPI strip — 8 cards in 4 columns × 2 rows. Slot 3 is
                  Pending Applications and links to the role-requests
                  page so the admin can act on it in one click. */}
              <AdminKPICards data={kpiData} />

              {/* Funnel — full width */}
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

              {/* Finance — full width on its own row */}
              <div className="mb-6">
                <FinanceSummaryWidget data={data.finance} />
              </div>

              {/* NELC Compliance — full width on its own row */}
              <div className="mb-6">
                <NELCComplianceOverviewWidget data={data.compliance} />
              </div>

              {/* Recent Points — full width on its own row. The
                  Recent Users mini-widget moves to the right rail so
                  the activity feed gets the main column's breathing
                  room (richer history per row). */}
              <RecentPointsWidget rows={data.recentPoints} />
            </div>

            {/* Right rail: alerts + activity + a compact security
                snapshot + recent users. Quick Actions and the
                duplicate Finance widget were removed — sidebar nav
                already covers the first and Finance has a dedicated
                row above. */}
            <AlertsActivitySidebar
              alerts={liveAlerts}
              activities={activities}
              extras={
                <>
                  <SecuritySnapshotWidget data={data.security} />
                  <UserManagementWidget users={data.recentUsers} />
                </>
              }
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminDashboardContent;
