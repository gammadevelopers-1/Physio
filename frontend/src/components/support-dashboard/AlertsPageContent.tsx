"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertTriangle,
  XCircle,
  UserPlus,
  CheckCircle,
  Loader2,
  ArrowLeft,
  RotateCcw,
  RefreshCw,
} from "lucide-react";
import { supportApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSupportProfile } from "@/hooks/useSupportProfile";
import SupportNavbar from "./SupportNavbar";
import SupportSidebar from "./SupportSidebar";

const DISMISSED_ALERTS_KEY = "support.dismissedAlerts.v1";

type AlertCategory = "breached" | "unassigned" | "highPriority";

interface KpiAlerts {
  breached: { id: string; referenceNumber?: string | null; subject: string; priority: string }[];
  unassigned: { id: string; referenceNumber?: string | null; subject: string; priority: string }[];
  highPriority: { id: string; referenceNumber?: string | null; subject: string; priority: string }[];
}

interface AlertRow {
  key: string;
  category: AlertCategory;
  ticketId: string;
  referenceNumber: string | null;
  subject: string;
  priority: string;
}

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISSED_ALERTS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      DISMISSED_ALERTS_KEY,
      JSON.stringify(Array.from(set)),
    );
  } catch {
    // ignore
  }
}

function categoryStyle(c: AlertCategory): {
  icon: typeof AlertTriangle;
  color: string;
  bg: string;
  border: string;
} {
  switch (c) {
    case "breached":
      return {
        icon: XCircle,
        color: "text-[#DC2626]",
        bg: "bg-[#FEE2E2]",
        border: "#DC2626",
      };
    case "highPriority":
      return {
        icon: AlertTriangle,
        color: "text-[#EA580C]",
        bg: "bg-[#FFEDD5]",
        border: "#EA580C",
      };
    case "unassigned":
    default:
      return {
        icon: UserPlus,
        color: "text-[#C2410C]",
        bg: "bg-[#FFEDD5]",
        border: "#C2410C",
      };
  }
}

const TABS: { key: "all" | AlertCategory; labelKey: string }[] = [
  { key: "all", labelKey: "alertsPage.tabs.all" },
  { key: "breached", labelKey: "alerts.category.breached" },
  { key: "highPriority", labelKey: "alerts.category.highPriority" },
  { key: "unassigned", labelKey: "alerts.category.unassigned" },
];

const AlertsPageContent = () => {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { user } = useAuth();
  const profile = useSupportProfile();
  const isSupervisor = user?.supportSubRole === "supervisor";
  const basePath = isSupervisor
    ? `/${locale}/dashboard/support/supervisor`
    : `/${locale}/dashboard/support/agent`;

  const [kpiAlerts, setKpiAlerts] = useState<KpiAlerts | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | AlertCategory>("all");
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());
  const [showDismissed, setShowDismissed] = useState(false);

  async function fetchData(silent = false) {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const kpis = await supportApi.getKPIs();
      setKpiAlerts(
        (kpis?.alerts as KpiAlerts | undefined) ?? {
          breached: [],
          unassigned: [],
          highPriority: [],
        },
      );
    } catch (err) {
      console.error("Failed to fetch alerts:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchData();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") fetchData(true);
    }, 60000);
    return () => clearInterval(id);
  }, []);

  const allAlerts: AlertRow[] = useMemo(() => {
    if (!kpiAlerts) return [];
    const seen = new Set<string>();
    const rows: AlertRow[] = [];
    const push = (category: AlertCategory, list: KpiAlerts[AlertCategory]) => {
      for (const x of list) {
        if (seen.has(x.id)) continue;
        seen.add(x.id);
        rows.push({
          key: `${category}:${x.id}`,
          category,
          ticketId: x.id,
          referenceNumber: x.referenceNumber ?? null,
          subject: x.subject,
          priority: x.priority,
        });
      }
    };
    push("breached", kpiAlerts.breached);
    push("highPriority", kpiAlerts.highPriority);
    push("unassigned", kpiAlerts.unassigned);
    return rows;
  }, [kpiAlerts]);

  const filteredAlerts = useMemo(() => {
    const base =
      activeTab === "all"
        ? allAlerts
        : allAlerts.filter((a) => a.category === activeTab);
    return showDismissed ? base : base.filter((a) => !dismissed.has(a.key));
  }, [allAlerts, activeTab, dismissed, showDismissed]);

  function dismissOne(key: string) {
    const next = new Set(dismissed);
    next.add(key);
    setDismissed(next);
    saveDismissed(next);
  }

  function restoreOne(key: string) {
    const next = new Set(dismissed);
    next.delete(key);
    setDismissed(next);
    saveDismissed(next);
  }

  function dismissAll() {
    const next = new Set(dismissed);
    for (const a of filteredAlerts) next.add(a.key);
    setDismissed(next);
    saveDismissed(next);
  }

  function resetAll() {
    const next = new Set<string>();
    setDismissed(next);
    saveDismissed(next);
  }

  const tabCounts: Record<"all" | AlertCategory, number> = useMemo(() => {
    const visible = showDismissed
      ? allAlerts
      : allAlerts.filter((a) => !dismissed.has(a.key));
    return {
      all: visible.length,
      breached: visible.filter((a) => a.category === "breached").length,
      highPriority: visible.filter((a) => a.category === "highPriority").length,
      unassigned: visible.filter((a) => a.category === "unassigned").length,
    };
  }, [allAlerts, dismissed, showDismissed]);

  return (
    <>
      <SupportNavbar profile={profile} />
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <SupportSidebar profile={profile} supportSubRole={user?.supportSubRole} />
            </div>

            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <Link
                    href={basePath}
                    className={`inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-2 ${isRTL ? "flex-row-reverse" : ""}`}
                  >
                    <ArrowLeft className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
                    {t("alertsPage.backToDashboard")}
                  </Link>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                    {t("alertsPage.title")}
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    {t("alertsPage.subtitle")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fetchData(true)}
                    disabled={refreshing}
                    className="flex items-center gap-1.5 h-9 px-3 text-[13px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                    {t("myTicketsPage.refresh")}
                  </button>
                  {filteredAlerts.length > 0 && !showDismissed && (
                    <button
                      type="button"
                      onClick={dismissAll}
                      className="flex items-center gap-1.5 h-9 px-3 text-[13px] text-[var(--color-text-primary)] bg-[var(--color-border-subtle)] hover:bg-[var(--color-border)] rounded-lg font-medium"
                    >
                      {t("alerts.markAllRead")}
                    </button>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
                <div className="flex items-center gap-1 px-3 py-3 border-b border-[var(--color-border-subtle)] overflow-x-auto">
                  {TABS.map((tab) => {
                    const active = activeTab === tab.key;
                    const count = tabCounts[tab.key];
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors flex items-center gap-2 whitespace-nowrap ${
                          active
                            ? "bg-[var(--color-border-subtle)] text-[var(--color-text-primary)]"
                            : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                        }`}
                      >
                        {t(tab.labelKey)}
                        {count > 0 && (
                          <span
                            className={`min-w-[20px] h-5 inline-flex items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
                              active
                                ? "bg-[var(--color-primary)] text-white"
                                : "bg-[var(--color-border)] text-[var(--color-text-secondary)]"
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  <div className="ms-auto flex items-center gap-3 pe-2">
                    {dismissed.size > 0 && (
                      <>
                        <label className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)] cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={showDismissed}
                            onChange={(e) => setShowDismissed(e.target.checked)}
                            className="w-3.5 h-3.5"
                          />
                          {t("alertsPage.showDismissed", { count: dismissed.size })}
                        </label>
                        <button
                          type="button"
                          onClick={resetAll}
                          className="inline-flex items-center gap-1 text-[11px] text-[var(--color-primary)] hover:underline"
                          title={t("alerts.restoreDismissedTitle")}
                        >
                          <RotateCcw className="w-3 h-3" />
                          {t("alertsPage.restoreAll")}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* List */}
                <div className="p-3">
                  {loading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
                    </div>
                  ) : filteredAlerts.length === 0 ? (
                    <div className="py-16 text-center">
                      <CheckCircle className="w-10 h-10 mx-auto text-[#22C55E] mb-2" />
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {t("alertsPage.allClear.title")}
                      </p>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                        {t("alertsPage.allClear.body")}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredAlerts.map((alert) => {
                        const style = categoryStyle(alert.category);
                        const Icon = style.icon;
                        const isDismissed = dismissed.has(alert.key);
                        return (
                          <div
                            key={alert.key}
                            className={`flex items-start gap-3 p-3 rounded-lg ${
                              isDismissed
                                ? "bg-[var(--color-border-subtle)] opacity-70"
                                : style.bg
                            }`}
                            style={
                              isDismissed
                                ? undefined
                                : {
                                    borderLeftWidth: "3px",
                                    borderLeftColor: style.border,
                                  }
                            }
                          >
                            <Icon className={`w-5 h-5 ${style.color} flex-shrink-0 mt-0.5`} />
                            <Link
                              href={`${basePath}/tickets/${alert.ticketId}`}
                              className="flex-1 min-w-0 hover:opacity-80"
                            >
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-primary)]">
                                  {t(`alerts.category.${alert.category}`)}
                                </span>
                                <span className="font-mono text-[11px] text-[var(--color-text-secondary)]">
                                  {alert.referenceNumber || `#${alert.ticketId.substring(0, 8)}`}
                                </span>
                                <span
                                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                    alert.priority === "high"
                                      ? "bg-[#FEE2E2] text-[#DC2626]"
                                      : alert.priority === "medium"
                                        ? "bg-[#FFEDD5] text-[#C2410C]"
                                        : "bg-[#DCFCE7] text-[#15803D]"
                                  }`}
                                >
                                  {alert.priority
                                    ? t(`ticketsBoard.priorities.${alert.priority}`)
                                    : ""}
                                </span>
                              </div>
                              <p className="text-sm font-medium text-[var(--color-text-primary)] line-clamp-2">
                                {alert.subject}
                              </p>
                            </Link>
                            {isDismissed ? (
                              <button
                                type="button"
                                onClick={() => restoreOne(alert.key)}
                                className="inline-flex items-center gap-1 text-[11px] text-[var(--color-primary)] hover:underline flex-shrink-0"
                                title={t("alertsPage.restoreOne")}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                {t("alertsPage.restoreOne")}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => dismissOne(alert.key)}
                                className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] flex-shrink-0"
                                aria-label={t("alerts.dismiss")}
                                title={t("alerts.dismiss")}
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AlertsPageContent;
