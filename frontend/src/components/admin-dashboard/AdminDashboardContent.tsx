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
import SupportSnapshotWidget from "./SupportSnapshotWidget";
import AlertsActivitySidebar from "./AlertsActivitySidebar";
import AdminDashboardSkeleton from "./AdminDashboardSkeleton";
import {
  notificationsApi,
  adminApi,
  AdminNotification,
  AdminDashboardPayload,
} from "@/lib/api";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { relativeTime, tOrFallback } from "@/lib/notification-i18n";

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

const AdminDashboardContent = () => {
  const t = useTranslations("adminDashboard");
  const tNotifications = useTranslations("notifications");
  const tRoot = useTranslations();
  const admin = useAdminProfile();
  const [data, setData] = useState<AdminDashboardPayload>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [liveAlerts, setLiveAlerts] = useState<AdminNotification[]>([]);

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
        // Keep the raw AdminNotification (key + params + ISO date). The
        // sidebar rendering pass runs on every render so the alert list
        // stays in sync with the current UI locale without needing to
        // refetch when the user switches language.
        setLiveAlerts(notificationsResult.value.data);
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

  // Localize each alert's title + description in the current UI locale.
  // Falls back to the raw pre-rendered strings for legacy rows (pre-0098).
  const localizedAlerts = liveAlerts.map((n) => ({
    id: n.id,
    type: n.type,
    title: tOrFallback(tRoot, n.titleKey, n.titleParams, n.title),
    description: tOrFallback(
      tRoot,
      n.descriptionKey,
      n.descriptionParams,
      n.description,
    ),
    time: relativeTime(tNotifications, n.createdAt),
    link: n.link || undefined,
  }));

  // Activity rows: prefer the localized actionKey (e.g. `audit.actions.session.created`);
  // fall back to the humanized `action` string that the backend still ships for
  // backwards compat.
  const activities: LiveActivity[] = data.recentActivity.map((a) => {
    const anyA = a as typeof a & {
      actionKey?: string;
      entityType?: string;
      actionSlug?: string;
    };
    const localized = anyA.actionKey
      ? tOrFallback(
          tRoot,
          anyA.actionKey,
          {
            action: anyA.actionSlug ?? a.action,
            entityType: anyA.entityType ?? "",
          },
          a.action,
        )
      : a.action;
    return {
      id: a.id,
      type: a.type,
      user: a.user,
      action: localized,
      time: relativeTime(tNotifications, a.time),
    };
  });

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

              {loading ? (
                // Full-layout skeleton during initial fetch. Replaces
                // every widget (and the right rail) so the user never
                // sees zero-filled cards or empty lists pretending to
                // be real numbers. Matches the populated layout 1:1
                // to avoid reflow when data lands.
                <AdminDashboardSkeleton />
              ) : (
                <>
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
                </>
              )}
            </div>

            {/* Right rail: alerts + activity + a compact security
                snapshot + recent users. Hidden during initial load —
                the skeleton above already covers both columns. */}
            {!loading && (
              <AlertsActivitySidebar
                alerts={localizedAlerts}
                activities={activities}
                extras={
                  <>
                    <SupportSnapshotWidget />
                    <SecuritySnapshotWidget data={data.security} />
                    <UserManagementWidget users={data.recentUsers} />
                  </>
                }
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminDashboardContent;
