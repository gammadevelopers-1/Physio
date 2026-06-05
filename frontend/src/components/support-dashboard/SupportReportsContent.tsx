"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { supportApi } from "@/lib/api";
import { useSupportProfile } from "@/hooks/useSupportProfile";
import { toast } from "sonner";
import SupportSidebar from "./SupportSidebar";
import SupportNavbar from "./SupportNavbar";
import PanelErrorState from "./PanelErrorState";
import Select from "@/components/admin-dashboard/Select";
import DatePicker from "@/components/ui/DatePicker";
import {
  BarChart3,
  ShieldCheck,
  Users,
  Smile,
  FileSpreadsheet,
  Download,
  Loader2,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle2,
  Inbox,
  Activity,
  Star,
  RefreshCw,
  MessageSquare,
  Calendar,
} from "lucide-react";

// ─── Date range helpers ───────────────────────────────────
function getDateRange(period: string): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const to = now.toISOString();
  switch (period) {
    case "thisWeek": {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay());
      d.setHours(0, 0, 0, 0);
      return { dateFrom: d.toISOString(), dateTo: to };
    }
    case "lastWeek": {
      const start = new Date(now);
      start.setDate(start.getDate() - start.getDay() - 7);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
    }
    case "thisMonth": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { dateFrom: d.toISOString(), dateTo: to };
    }
    case "lastMonth": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 1);
      return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
    }
    case "last30Days": {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      return { dateFrom: start.toISOString(), dateTo: to };
    }
    case "last90Days": {
      const start = new Date(now);
      start.setDate(start.getDate() - 90);
      return { dateFrom: start.toISOString(), dateTo: to };
    }
    default:
      return { dateFrom: "", dateTo: "" };
  }
}

function formatMinutes(m: number | null | undefined): string {
  if (m == null) return "—";
  if (m < 60) return `${Math.round(m)}m`;
  if (m < 60 * 24) return `${(m / 60).toFixed(1)}h`;
  return `${(m / (60 * 24)).toFixed(1)}d`;
}

const REPORT_KEYS = ["overview", "topIssues", "slaCompliance", "agentPerformance", "csatNps"] as const;
type ReportKey = (typeof REPORT_KEYS)[number];

const SupportReportsContent = () => {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { user } = useAuth();
  const profile = useSupportProfile();

  // ── Filters ──────────────────────────────────────────────────
  const [selectedReport, setSelectedReport] = useState<ReportKey>("overview");
  const [period, setPeriod] = useState("last30Days");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const dateParams = useMemo(
    () =>
      period === "custom"
        ? {
            dateFrom: customFrom ? new Date(customFrom).toISOString() : "",
            dateTo: customTo ? new Date(customTo).toISOString() : "",
          }
        : getDateRange(period),
    [period, customFrom, customTo],
  );

  // ── KPI strip — always-visible snapshot ──────────────────────
  const [kpis, setKpis] = useState<any>(null);

  // ── Report data state ────────────────────────────────────────
  const [trendData, setTrendData] = useState<
    { bucket: string; created: number; resolved: number }[]
  >([]);
  const [volumeData, setVolumeData] = useState<any[]>([]);
  const [issuesData, setIssuesData] = useState<any[]>([]);
  const [slaData, setSlaData] = useState<any>(null);
  const [agentData, setAgentData] = useState<any[]>([]);
  const [csatData, setCsatData] = useState<any>(null);
  const [npsData, setNpsData] = useState<any>(null);
  const [csatComments, setCsatComments] = useState<any[]>([]);

  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // ── Export ───────────────────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showExportMenu]);

  // ── KPI fetch (once + on date change for the period subset) ──
  useEffect(() => {
    supportApi
      .getKPIs()
      .then((k) => setKpis(k))
      .catch(() => setKpis(null));
  }, []);

  // ── Report fetch ─────────────────────────────────────────────
  const fetchReport = useCallback(async () => {
    setReportLoading(true);
    setReportError(null);
    const params = {
      dateFrom: dateParams.dateFrom || undefined,
      dateTo: dateParams.dateTo || undefined,
    };
    try {
      switch (selectedReport) {
        case "overview": {
          // Trend + categories side-by-side
          const [trend, volume] = await Promise.all([
            supportApi.getTicketTrend({ ...params, interval: "day" }).catch(() => []),
            supportApi.getVolumeReport(params).catch(() => []),
          ]);
          setTrendData(Array.isArray(trend) ? trend : []);
          setVolumeData(Array.isArray(volume) ? volume : []);
          break;
        }
        case "topIssues": {
          const res = await supportApi.getTopIssues(params);
          setIssuesData(Array.isArray(res) ? res : []);
          break;
        }
        case "slaCompliance": {
          const res = await supportApi.getSlaComplianceReport(params);
          setSlaData(res);
          break;
        }
        case "agentPerformance": {
          const res = await supportApi.getAgentPerformance(params);
          setAgentData(Array.isArray(res) ? res : []);
          break;
        }
        case "csatNps": {
          const [csat, nps, comments] = await Promise.all([
            supportApi.getCsatSummary().catch(() => null),
            supportApi.getNpsSummary().catch(() => null),
            supportApi.getRecentCsatComments(8).catch(() => []),
          ]);
          setCsatData(csat);
          setNpsData(nps);
          setCsatComments(Array.isArray(comments) ? comments : []);
          break;
        }
      }
    } catch (err: any) {
      setReportError(err?.message || t("reportsPage.toasts.loadFailed"));
    } finally {
      setReportLoading(false);
    }
  }, [selectedReport, dateParams, t]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // ── Derived: volume aggregation by category ──────────────────
  const volumeByCategory = useMemo(() => {
    const acc: Record<string, number> = {};
    volumeData.forEach((row) => {
      acc[row.category] = (acc[row.category] || 0) + Number(row.count);
    });
    return Object.entries(acc).sort((a, b) => b[1] - a[1]);
  }, [volumeData]);

  const totalCreatedInRange = useMemo(
    () => trendData.reduce((s, b) => s + b.created, 0),
    [trendData],
  );
  const totalResolvedInRange = useMemo(
    () => trendData.reduce((s, b) => s + b.resolved, 0),
    [trendData],
  );

  // ── Export handlers ──────────────────────────────────────────
  const exportTypeFor: Record<ReportKey, string> = {
    overview: "volume",
    topIssues: "issues",
    slaCompliance: "sla",
    agentPerformance: "agent-performance",
    csatNps: "volume",
  };

  async function handleExportCsv() {
    setShowExportMenu(false);
    setIsExporting(true);
    try {
      const res = await supportApi.exportReport(exportTypeFor[selectedReport], {
        dateFrom: dateParams.dateFrom,
        dateTo: dateParams.dateTo,
      });
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename || `report-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t("reportsPage.toasts.downloadedCsv"));
    } catch {
      toast.error(t("reportsPage.toasts.exportFailed"));
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportPdf() {
    setShowExportMenu(false);
    setIsExporting(true);
    try {
      const blob = await supportApi.downloadExportPdf(exportTypeFor[selectedReport], {
        dateFrom: dateParams.dateFrom,
        dateTo: dateParams.dateTo,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `support_report_${exportTypeFor[selectedReport]}_${new Date()
        .toISOString()
        .split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t("reportsPage.toasts.downloadedPdf"));
    } catch {
      toast.error(t("reportsPage.toasts.exportPdfFailed"));
    } finally {
      setIsExporting(false);
    }
  }

  // ── Report type tabs (icon, color, label) ────────────────────
  const reportTypes: {
    key: ReportKey;
    title: string;
    description: string;
    icon: typeof BarChart3;
    iconBg: string;
    iconColor: string;
  }[] = [
    {
      key: "overview",
      title: t("reportsPage.reportTypes.ticketVolume"),
      description: t("reportsPage.reportTypes.ticketVolumeDesc"),
      icon: BarChart3,
      iconBg: "bg-[#EFF6FF]",
      iconColor: "text-[#3B82F6]",
    },
    {
      key: "topIssues",
      title: t("reportsPage.reportTypes.topIssues"),
      description: t("reportsPage.reportTypes.topIssuesDesc"),
      icon: AlertTriangle,
      iconBg: "bg-[#FFEDD5]",
      iconColor: "text-[#F97316]",
    },
    {
      key: "slaCompliance",
      title: t("reportsPage.reportTypes.slaCompliance"),
      description: t("reportsPage.reportTypes.slaComplianceDesc"),
      icon: ShieldCheck,
      iconBg: "bg-[#DCFCE7]",
      iconColor: "text-[#16A34A]",
    },
    {
      key: "agentPerformance",
      title: t("reportsPage.reportTypes.agentPerformance"),
      description: t("reportsPage.reportTypes.agentPerformanceDesc"),
      icon: Users,
      iconBg: "bg-[#EDE9FE]",
      iconColor: "text-[#8B5CF6]",
    },
    {
      key: "csatNps",
      title: t("reportsPage.reportTypes.csatNps"),
      description: t("reportsPage.reportTypes.csatNpsDesc"),
      icon: Smile,
      iconBg: "bg-[#FEF3C7]",
      iconColor: "text-[#D97706]",
    },
  ];

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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                    {t("reportsPage.title")}
                  </h1>
                  <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                    {t("reportsPage.subtitle")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fetchReport()}
                    disabled={reportLoading}
                    className="flex items-center gap-1.5 h-10 px-3 text-[13px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${reportLoading ? "animate-spin" : ""}`} />
                    <span className="hidden sm:inline">{t("reportsPage.refresh")}</span>
                  </button>
                  <div className="relative" ref={exportMenuRef}>
                    <button
                      type="button"
                      onClick={() => setShowExportMenu((v) => !v)}
                      disabled={isExporting}
                      className="flex items-center gap-1.5 h-10 px-4 bg-[var(--color-primary)] hover:bg-[#001d5e] text-white text-sm font-medium rounded-lg disabled:opacity-50"
                    >
                      {isExporting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      {t("reportsPage.export")}
                    </button>
                    {showExportMenu && (
                      <div
                        className={`absolute top-full mt-1 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg shadow-lg z-20 min-w-[200px] py-1 ${isRTL ? "left-0" : "right-0"}`}
                      >
                        <button
                          type="button"
                          onClick={handleExportCsv}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] text-start"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-[#16A34A]" />
                          {t("reportsPage.downloadCsv")}
                        </button>
                        <button
                          type="button"
                          onClick={handleExportPdf}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] text-start"
                        >
                          <Download className="w-4 h-4 text-[#DC2626]" />
                          {t("reportsPage.downloadPdf")}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* KPI Strip — global snapshot, not date-scoped */}
              <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-6">
                <KpiTile
                  label={t("reportsPage.kpis.open")}
                  value={kpis ? String(kpis.openTickets ?? 0) : "—"}
                  icon={Inbox}
                  iconBg="bg-[#EFF6FF]"
                  iconColor="text-[#3B82F6]"
                />
                <KpiTile
                  label={t("reportsPage.kpis.highPriority")}
                  value={kpis ? String(kpis.highPriorityOpen ?? 0) : "—"}
                  icon={AlertTriangle}
                  iconBg="bg-[#FEE2E2]"
                  iconColor="text-[#DC2626]"
                />
                <KpiTile
                  label={t("reportsPage.kpis.slaCompliance")}
                  value={kpis ? `${kpis.slaCompliance ?? 0}%` : "—"}
                  icon={ShieldCheck}
                  iconBg="bg-[#DCFCE7]"
                  iconColor="text-[#16A34A]"
                />
                <KpiTile
                  label={t("reportsPage.kpis.avgFrt")}
                  value={formatMinutes(kpis?.avgFrtMinutes ?? null)}
                  icon={Clock}
                  iconBg="bg-[#FFEDD5]"
                  iconColor="text-[#EA580C]"
                />
                <KpiTile
                  label={t("reportsPage.kpis.avgTtr")}
                  value={formatMinutes(kpis?.avgTtrMinutes ?? null)}
                  icon={CheckCircle2}
                  iconBg="bg-[#F3E8FF]"
                  iconColor="text-[#8B5CF6]"
                />
                <KpiTile
                  label={t("reportsPage.kpis.csat")}
                  value={
                    kpis?.csatAvgScore != null
                      ? `${kpis.csatAvgScore}/5`
                      : "—"
                  }
                  icon={Smile}
                  iconBg="bg-[#FEF3C7]"
                  iconColor="text-[#D97706]"
                />
              </div>

              {/* Report Type Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
                {reportTypes.map((rt) => {
                  const Icon = rt.icon;
                  const active = selectedReport === rt.key;
                  return (
                    <button
                      key={rt.key}
                      type="button"
                      onClick={() => setSelectedReport(rt.key)}
                      className={`p-3 rounded-xl border text-start transition-all ${
                        active
                          ? "bg-[var(--color-surface-card)] border-[var(--color-primary)] ring-1 ring-[var(--color-primary)] shadow-sm"
                          : "bg-[var(--color-surface-card)] border-[var(--color-border)] hover:border-[var(--color-text-secondary)]"
                      }`}
                    >
                      <div className={`w-8 h-8 ${rt.iconBg} rounded-lg flex items-center justify-center mb-2`}>
                        <Icon className={`w-4 h-4 ${rt.iconColor}`} />
                      </div>
                      <p
                        className={`text-xs font-semibold ${
                          active ? "text-[var(--color-primary)]" : "text-[var(--color-text-primary)]"
                        }`}
                      >
                        {rt.title}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5 line-clamp-1">
                        {rt.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Filters card */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 mb-5">
                <div className="flex flex-col md:flex-row md:items-end gap-3">
                  <div className="flex-1">
                    <label className="block text-[11px] text-[var(--color-text-secondary)] font-medium mb-1">
                      {t("reportsPage.filters.period")}
                    </label>
                    <Select
                      value={period}
                      onChange={setPeriod}
                      className="w-full"
                      options={[
                        { value: "thisWeek", label: t("reportsPage.filters.thisWeek") },
                        { value: "lastWeek", label: t("reportsPage.filters.lastWeek") },
                        { value: "thisMonth", label: t("reportsPage.filters.thisMonth") },
                        { value: "lastMonth", label: t("reportsPage.filters.lastMonth") },
                        { value: "last30Days", label: t("reportsPage.filters.last30Days") },
                        { value: "last90Days", label: t("reportsPage.filters.last90Days") },
                        { value: "custom", label: t("reportsPage.filters.custom") },
                      ]}
                    />
                  </div>

                  {period === "custom" && (
                    <>
                      <div className="flex-1">
                        <label className="block text-[11px] text-[var(--color-text-secondary)] font-medium mb-1">
                          {t("reportsPage.filters.from")}
                        </label>
                        <DatePicker value={customFrom} onChange={setCustomFrom} />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[11px] text-[var(--color-text-secondary)] font-medium mb-1">
                          {t("reportsPage.filters.to")}
                        </label>
                        <DatePicker value={customTo} onChange={setCustomTo} />
                      </div>
                    </>
                  )}

                  {/* Inline range summary so the user knows exactly what
                      window the panels below are scoped to. */}
                  {dateParams.dateFrom && dateParams.dateTo && (
                    <div className="text-[11px] text-[var(--color-text-secondary)] flex items-center gap-1.5 px-3 py-2 bg-[var(--color-border-subtle)] rounded-lg">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {new Date(dateParams.dateFrom).toLocaleDateString()} —{" "}
                        {new Date(dateParams.dateTo).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Report Body */}
              {reportLoading ? (
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-16 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
                </div>
              ) : reportError ? (
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)]">
                  <PanelErrorState
                    onRetry={fetchReport}
                    isRetrying={reportLoading}
                    message={reportError}
                  />
                </div>
              ) : (
                <>
                  {/* Overview = trend + category breakdown */}
                  {selectedReport === "overview" && (
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                        <div className="xl:col-span-2">
                          <TrendChart
                            data={trendData}
                            createdTotal={totalCreatedInRange}
                            resolvedTotal={totalResolvedInRange}
                            t={t}
                          />
                        </div>
                        <div>
                          <CategoryBreakdown rows={volumeByCategory} t={t} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Top Issues */}
                  {selectedReport === "topIssues" && (
                    <TopIssuesPanel issues={issuesData} t={t} />
                  )}

                  {/* SLA Compliance */}
                  {selectedReport === "slaCompliance" && (
                    <SlaCompliancePanel data={slaData} t={t} />
                  )}

                  {/* Agent Performance */}
                  {selectedReport === "agentPerformance" && (
                    <AgentPerformancePanel agents={agentData} t={t} />
                  )}

                  {/* CSAT / NPS */}
                  {selectedReport === "csatNps" && (
                    <CsatNpsPanel
                      csat={csatData}
                      nps={npsData}
                      comments={csatComments}
                      t={t}
                    />
                  )}
                </>
              )}

              {/* Additional CSV-only reports (FRT/Resolution/Escalation/Overdue) */}
              <AdditionalReportsPanel
                dateFrom={dateParams.dateFrom}
                dateTo={dateParams.dateTo}
              />

              {/* KB search analytics — most-searched + zero-result rate. */}
              <KbSearchAnalyticsPanel
                dateFrom={dateParams.dateFrom}
                dateTo={dateParams.dateTo}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ──────────────────────────────────────────────────────────────────
// AdditionalReportsPanel
//
// CSV-only export rail for the four new reports Amna requested:
// FRT, Resolution, Escalation, Overdue. No dashboard view — clicking
// a button downloads the report directly. Each report respects the
// page-level date range. Overdue is always "as of now" so it ignores
// dates by design.
// ──────────────────────────────────────────────────────────────────
function AdditionalReportsPanel({
  dateFrom,
  dateTo,
}: {
  dateFrom?: string;
  dateTo?: string;
}) {
  const [exportingType, setExportingType] = useState<string | null>(null);

  const reports = [
    {
      type: "frt",
      title: "First Response Time",
      description: "Per-ticket FRT in minutes, vs SLA target. Filtered by reply date.",
    },
    {
      type: "ttr",
      title: "Resolution Time",
      description: "Per-ticket TTR in business minutes (on-hold excluded). Filtered by resolution date.",
    },
    {
      type: "escalation",
      title: "Escalations",
      description: "Every SLA breach, priority bump, and reassignment in the period.",
    },
    {
      type: "overdue",
      title: "Overdue Tickets (live)",
      description: "Currently open tickets that have passed FRT or TTR target. Ignores date filter.",
    },
  ];

  async function exportOne(type: string, format: "csv" | "pdf") {
    setExportingType(`${type}-${format}`);
    try {
      if (format === "csv") {
        const res = await supportApi.exportReport(type, {
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        });
        const blob = new Blob([res.csv], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename || `report-${type}-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const blob = await supportApi.downloadExportPdf(type, {
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `support_report_${type}_${new Date()
          .toISOString()
          .split("T")[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      toast.success("Report downloaded");
    } catch {
      toast.error("Export failed");
    } finally {
      setExportingType(null);
    }
  }

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5 mt-6">
      <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
        Additional reports
      </h3>
      <p className="text-xs text-[var(--color-text-secondary)] mb-4">
        Direct-download exports. Use the period filter above to scope the date range.
      </p>
      <div className="space-y-2">
        {reports.map((r) => (
          <div
            key={r.type}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg border border-[var(--color-border-subtle)]"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                {r.title}
              </p>
              <p className="text-[11px] text-[var(--color-text-secondary)]">
                {r.description}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => exportOne(r.type, "csv")}
                disabled={exportingType !== null}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
              >
                {exportingType === `${r.type}-csv` ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#16A34A]" />
                )}
                CSV
              </button>
              <button
                type="button"
                onClick={() => exportOne(r.type, "pdf")}
                disabled={exportingType !== null}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
              >
                {exportingType === `${r.type}-pdf` ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-[#DC2626]" />
                )}
                PDF
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// KbSearchAnalyticsPanel
//
// Shows what learners are searching for on the public help center,
// and how often the search returns nothing (the actionable signal —
// every zero-result query is a content gap). Date range comes from
// the page filter so supervisors can scope to a release window.
// ──────────────────────────────────────────────────────────────────
function KbSearchAnalyticsPanel({
  dateFrom,
  dateTo,
}: {
  dateFrom?: string;
  dateTo?: string;
}) {
  const [data, setData] = useState<{
    totalSearches: number;
    zeroResultSearches: number;
    zeroResultRate: number;
    topQueries: {
      query: string;
      locale: string;
      searches: number;
      avgResults: string;
      zeroResultCount: number;
    }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    supportApi
      .getKbSearchAnalytics({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit: 25,
      })
      .then((res) => setData(res))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5 mt-6">
      <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
        Help Center search analytics
      </h3>
      <p className="text-xs text-[var(--color-text-secondary)] mb-4">
        Most-asked questions and zero-result queries (content gaps).
      </p>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary)]" />
        </div>
      ) : !data || data.totalSearches === 0 ? (
        <div className="text-xs text-[var(--color-text-secondary)] py-3 text-center">
          No search activity in this period.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="p-3 rounded-lg bg-[var(--color-border-subtle)]">
              <p className="text-[10px] text-[var(--color-text-secondary)] uppercase">
                Total searches
              </p>
              <p className="text-lg font-bold text-[var(--color-text-primary)]">
                {data.totalSearches}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[var(--color-border-subtle)]">
              <p className="text-[10px] text-[var(--color-text-secondary)] uppercase">
                Zero-result
              </p>
              <p className="text-lg font-bold text-[var(--color-text-primary)]">
                {data.zeroResultSearches}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-[var(--color-border-subtle)]">
              <p className="text-[10px] text-[var(--color-text-secondary)] uppercase">
                Gap rate
              </p>
              <p className="text-lg font-bold text-[var(--color-text-primary)]">
                {data.zeroResultRate}%
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
                  <th className="text-left py-2 px-2 font-medium">Query</th>
                  <th className="text-left py-2 px-2 font-medium">Lang</th>
                  <th className="text-right py-2 px-2 font-medium">Searches</th>
                  <th className="text-right py-2 px-2 font-medium">Avg results</th>
                  <th className="text-right py-2 px-2 font-medium">Empty</th>
                </tr>
              </thead>
              <tbody>
                {data.topQueries.map((q, idx) => (
                  <tr
                    key={`${q.query}-${q.locale}-${idx}`}
                    className="border-b border-[var(--color-border-subtle)] last:border-b-0"
                  >
                    <td className="py-2 px-2 text-[var(--color-text-primary)]">
                      {q.query}
                    </td>
                    <td className="py-2 px-2 uppercase text-[10px] text-[var(--color-text-secondary)]">
                      {q.locale}
                    </td>
                    <td className="py-2 px-2 text-right text-[var(--color-text-primary)]">
                      {q.searches}
                    </td>
                    <td className="py-2 px-2 text-right text-[var(--color-text-secondary)]">
                      {q.avgResults}
                    </td>
                    <td
                      className={`py-2 px-2 text-right font-medium ${q.zeroResultCount > 0 ? "text-[#DC2626]" : "text-[var(--color-text-secondary)]"}`}
                    >
                      {q.zeroResultCount > 0 ? q.zeroResultCount : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// KPI tile
// ──────────────────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-3 flex items-start gap-2.5">
      <div className={`w-9 h-9 ${iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-[var(--color-text-secondary)] font-medium uppercase truncate">
          {label}
        </p>
        <p className="text-lg font-bold text-[var(--color-text-primary)] leading-tight">
          {value}
        </p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Trend chart — CSS bars (created vs resolved per day/week)
// ──────────────────────────────────────────────────────────────────

function TrendChart({
  data,
  createdTotal,
  resolvedTotal,
  t,
}: {
  data: { bucket: string; created: number; resolved: number }[];
  createdTotal: number;
  resolvedTotal: number;
  t: ReturnType<typeof useTranslations>;
}) {
  const max = useMemo(
    () => Math.max(1, ...data.map((d) => Math.max(d.created, d.resolved))),
    [data],
  );

  // Show at most ~30 buckets — beyond that bars become too thin.
  // For longer ranges, sample evenly so users still get a sense of the curve.
  const display = useMemo(() => {
    if (data.length <= 30) return data;
    const step = Math.ceil(data.length / 30);
    return data.filter((_, i) => i % step === 0);
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5 h-full flex flex-col items-center justify-center text-center">
        <Activity className="w-8 h-8 text-[var(--color-text-secondary)] mb-2" />
        <p className="text-sm text-[var(--color-text-secondary)]">
          {t("reportsPage.volume.noTickets")}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--color-primary)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("reportsPage.trend.title")}
          </h3>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1 text-[var(--color-text-secondary)]">
            <span className="w-2 h-2 rounded-sm bg-[#3B82F6]" />
            {t("reportsPage.trend.created")} ({createdTotal})
          </span>
          <span className="inline-flex items-center gap-1 text-[var(--color-text-secondary)]">
            <span className="w-2 h-2 rounded-sm bg-[#22C55E]" />
            {t("reportsPage.trend.resolved")} ({resolvedTotal})
          </span>
        </div>
      </div>

      <div className="flex items-end gap-[2px] h-44 mt-4">
        {display.map((d) => {
          const ch = max > 0 ? (d.created / max) * 100 : 0;
          const rh = max > 0 ? (d.resolved / max) * 100 : 0;
          return (
            <div
              key={d.bucket}
              className="flex-1 flex flex-col items-center justify-end gap-[1px]"
              title={`${d.bucket}: ${d.created} created · ${d.resolved} resolved`}
            >
              <div className="w-full flex items-end gap-[1px] h-full">
                <div
                  className="flex-1 bg-[#3B82F6]/80 rounded-t-sm transition-all"
                  style={{ height: `${Math.max(ch, d.created > 0 ? 4 : 0)}%` }}
                />
                <div
                  className="flex-1 bg-[#22C55E]/80 rounded-t-sm transition-all"
                  style={{ height: `${Math.max(rh, d.resolved > 0 ? 4 : 0)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* x-axis labels — show first / middle / last */}
      <div className="flex justify-between mt-2 text-[10px] text-[var(--color-text-secondary)]">
        <span>{display[0]?.bucket}</span>
        {display.length > 2 && (
          <span>{display[Math.floor(display.length / 2)]?.bucket}</span>
        )}
        <span>{display[display.length - 1]?.bucket}</span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Category breakdown — vertical list with horizontal bars
// ──────────────────────────────────────────────────────────────────

function CategoryBreakdown({
  rows,
  t,
}: {
  rows: [string, number][];
  t: ReturnType<typeof useTranslations>;
}) {
  const total = rows.reduce((s, [, c]) => s + c, 0);

  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5 h-full">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
        {t("reportsPage.volume.byCategory")}
      </h3>
      <p className="text-[11px] text-[var(--color-text-secondary)] mb-4">
        {t("reportsPage.volume.totalTickets", { count: total })}
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)] py-6 text-center">
          {t("reportsPage.volume.noTickets")}
        </p>
      ) : (
        <div className="space-y-2.5">
          {rows.map(([cat, cnt]) => {
            const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
            return (
              <div key={cat}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-[var(--color-text-primary)] capitalize">
                    {cat}
                  </span>
                  <span className="text-[11px] text-[var(--color-text-secondary)]">
                    {cnt} · {pct}%
                  </span>
                </div>
                <div className="bg-[var(--color-border-subtle)] rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 bg-[var(--color-primary)] transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Top Issues — clean ranked list with badges
// ──────────────────────────────────────────────────────────────────

function TopIssuesPanel({
  issues,
  t,
}: {
  issues: any[];
  t: ReturnType<typeof useTranslations>;
}) {
  if (issues.length === 0) {
    return (
      <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-12 text-center">
        <AlertTriangle className="w-8 h-8 text-[var(--color-text-secondary)] mx-auto mb-2" />
        <p className="text-sm text-[var(--color-text-secondary)]">
          {t("reportsPage.issues.noIssues")}
        </p>
      </div>
    );
  }
  const max = Math.max(...issues.map((i) => Number(i.count)));
  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
        {t("reportsPage.reportTypes.topIssues")}
      </h3>
      <div className="space-y-3">
        {issues.map((item, idx) => {
          const cnt = Number(item.count);
          const pct = max > 0 ? Math.round((cnt / max) * 100) : 0;
          return (
            <div
              key={item.category}
              className="flex items-center gap-3 p-3 border border-[var(--color-border)] rounded-lg"
            >
              <div className="w-8 h-8 rounded-full bg-[var(--color-border-subtle)] flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-[var(--color-primary)]">
                  {idx + 1}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text-primary)] capitalize mb-1">
                  {item.category}
                </p>
                <div className="bg-[var(--color-border-subtle)] rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-1.5 bg-[#F97316]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {cnt}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// SLA Compliance — 3 gauge-style cards
// ──────────────────────────────────────────────────────────────────

function SlaCompliancePanel({
  data,
  t,
}: {
  data: any;
  t: ReturnType<typeof useTranslations>;
}) {
  if (!data || data.totalResolved === 0) {
    return (
      <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-12 text-center">
        <ShieldCheck className="w-8 h-8 text-[var(--color-text-secondary)] mx-auto mb-2" />
        <p className="text-sm text-[var(--color-text-secondary)]">
          {t("reportsPage.slaPanel.noResolved")}
        </p>
      </div>
    );
  }

  const tiles = [
    {
      label: t("reportsPage.slaPanel.overallCompliance"),
      value: data.complianceRate,
      sub: t("reportsPage.slaPanel.metSla", {
        met: data.resolvedWithinSla,
        total: data.totalResolved,
      }),
    },
    {
      label: t("reportsPage.slaPanel.frtCompliance"),
      value: data.frtCompliance,
      sub: t("reportsPage.slaPanel.frtSubtitle"),
    },
    {
      label: t("reportsPage.slaPanel.ttrCompliance"),
      value: data.ttrCompliance,
      sub: t("reportsPage.slaPanel.ttrSubtitle"),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {tiles.map((tile) => (
        <Gauge key={tile.label} {...tile} />
      ))}
    </div>
  );
}

function Gauge({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub: string;
}) {
  const color = value >= 80 ? "#22C55E" : value >= 50 ? "#F59E0B" : "#EF4444";
  // SVG ring math — 70 radius, ~440 circumference, draw the arc to value%.
  const r = 56;
  const c = 2 * Math.PI * r;
  const dash = (value / 100) * c;

  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5 flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
          <circle
            cx="70"
            cy="70"
            r={r}
            stroke="var(--color-border-subtle)"
            strokeWidth="10"
            fill="none"
          />
          <circle
            cx="70"
            cy="70"
            r={r}
            stroke={color}
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color }}>
            {value}%
          </span>
        </div>
      </div>
      <p className="text-sm font-medium text-[var(--color-text-primary)] mt-3 text-center">
        {label}
      </p>
      <p className="text-[11px] text-[var(--color-text-secondary)] mt-1 text-center">
        {sub}
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Agent Performance — table with conditional formatting
// ──────────────────────────────────────────────────────────────────

function AgentPerformancePanel({
  agents,
  t,
}: {
  agents: any[];
  t: ReturnType<typeof useTranslations>;
}) {
  if (agents.length === 0) {
    return (
      <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-12 text-center">
        <Users className="w-8 h-8 text-[var(--color-text-secondary)] mx-auto mb-2" />
        <p className="text-sm text-[var(--color-text-secondary)]">
          {t("reportsPage.agentsPanel.noData")}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="bg-[var(--color-surface-page)] border-b border-[var(--color-border)]">
            <tr>
              <th className="py-3 px-4 text-start text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase">
                {t("reportsPage.agentsPanel.columns.agent")}
              </th>
              <th className="py-3 px-4 text-end text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase">
                {t("reportsPage.agentsPanel.columns.total")}
              </th>
              <th className="py-3 px-4 text-end text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase">
                {t("reportsPage.agentsPanel.columns.open")}
              </th>
              <th className="py-3 px-4 text-end text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase">
                {t("reportsPage.agentsPanel.columns.resolved")}
              </th>
              <th className="py-3 px-4 text-end text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase">
                {t("reportsPage.agentsPanel.columns.avgFrt")}
              </th>
              <th className="py-3 px-4 text-end text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase">
                {t("reportsPage.agentsPanel.columns.csat")}
              </th>
              <th className="py-3 px-4 text-end text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase">
                {t("reportsPage.agentsPanel.columns.frtBreaches")}
              </th>
              <th className="py-3 px-4 text-end text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase">
                {t("reportsPage.agentsPanel.columns.ttrBreaches")}
              </th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr
                key={agent.userId}
                className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-border-subtle)]"
              >
                <td className="py-3 px-4 text-[13px] font-medium text-[var(--color-text-primary)]">
                  {agent.name || t("reportsPage.agentsPanel.unknown")}
                </td>
                <td className="py-3 px-4 text-[13px] text-[var(--color-text-primary)] text-end">
                  {agent.totalTickets}
                </td>
                <td className="py-3 px-4 text-[13px] text-[var(--color-text-primary)] text-end">
                  {agent.openTickets ?? "—"}
                </td>
                <td className="py-3 px-4 text-[13px] text-[var(--color-text-primary)] text-end">
                  {agent.resolvedTickets}
                </td>
                <td className="py-3 px-4 text-[13px] text-[var(--color-text-secondary)] text-end">
                  {formatMinutes(agent.avgFrtMinutes)}
                </td>
                <td className="py-3 px-4 text-[13px] font-semibold text-end">
                  <span
                    className={
                      agent.csatAvgScore != null
                        ? agent.csatAvgScore >= 4
                          ? "text-[#16A34A]"
                          : agent.csatAvgScore >= 3
                            ? "text-[#EA580C]"
                            : "text-[#DC2626]"
                        : "text-[var(--color-text-secondary)]"
                    }
                  >
                    {agent.csatAvgScore != null ? `${agent.csatAvgScore}/5` : "—"}
                  </span>
                </td>
                <td className="py-3 px-4 text-[13px] text-end">
                  <span
                    className={
                      agent.frtBreaches > 0
                        ? "text-[#DC2626] font-semibold"
                        : "text-[#16A34A]"
                    }
                  >
                    {agent.frtBreaches}
                  </span>
                </td>
                <td className="py-3 px-4 text-[13px] text-end">
                  <span
                    className={
                      agent.ttrBreaches > 0
                        ? "text-[#DC2626] font-semibold"
                        : "text-[#16A34A]"
                    }
                  >
                    {agent.ttrBreaches}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// CSAT / NPS — distribution panels + recent comments strip
// ──────────────────────────────────────────────────────────────────

function CsatNpsPanel({
  csat,
  nps,
  comments,
  t,
}: {
  csat: any;
  nps: any;
  comments: any[];
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* CSAT */}
        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <Smile className="w-4 h-4 text-[#D97706]" />
            {t("reportsPage.csatPanel.title")}
          </h3>
          <div className="flex items-center gap-6 mb-5 flex-wrap">
            <div>
              <p className="text-3xl font-bold text-[var(--color-primary)]">
                {csat?.avgScore ?? "—"}
              </p>
              <p className="text-[11px] text-[var(--color-text-secondary)]">
                {t("reportsPage.csatPanel.avgScore")}
              </p>
            </div>
            <div>
              <p className="text-xl font-bold text-[var(--color-text-primary)]">
                {csat?.totalResponded ?? 0}
              </p>
              <p className="text-[11px] text-[var(--color-text-secondary)]">
                {t("reportsPage.csatPanel.responses")}
              </p>
            </div>
            <div>
              <p className="text-xl font-bold text-[#16A34A]">
                {csat?.responseRate ?? 0}%
              </p>
              <p className="text-[11px] text-[var(--color-text-secondary)]">
                {t("reportsPage.csatPanel.responseRate")}
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((score) => {
              const cnt = csat?.distribution?.[score] || 0;
              const total = csat?.totalResponded || 1;
              const pct = Math.round((cnt / total) * 100) || 0;
              const colors: Record<number, string> = {
                5: "bg-[#22C55E]",
                4: "bg-[#3B82F6]",
                3: "bg-[#EAB308]",
                2: "bg-[#F97316]",
                1: "bg-[#EF4444]",
              };
              return (
                <div key={score} className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5 w-14">
                    {Array.from({ length: score }).map((_, i) => (
                      <Star
                        key={i}
                        className="w-2.5 h-2.5 text-[#F59E0B] fill-[#F59E0B]"
                      />
                    ))}
                  </div>
                  <div className="flex-1 bg-[var(--color-border-subtle)] rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full ${colors[score]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-[var(--color-text-secondary)] w-10 text-end">
                    {cnt}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* NPS */}
        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#16A34A]" />
            {t("reportsPage.npsPanel.title")}
          </h3>
          <div className="flex items-center gap-6 mb-5 flex-wrap">
            <div>
              <p
                className={`text-3xl font-bold ${
                  (nps?.npsScore || 0) >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                }`}
              >
                {nps?.npsScore ?? 0}
              </p>
              <p className="text-[11px] text-[var(--color-text-secondary)]">
                {t("reportsPage.npsPanel.score")}
              </p>
            </div>
            <div>
              <p className="text-xl font-bold text-[var(--color-text-primary)]">
                {nps?.totalResponded ?? 0}
              </p>
              <p className="text-[11px] text-[var(--color-text-secondary)]">
                {t("reportsPage.npsPanel.responses")}
              </p>
            </div>
            <div>
              <p className="text-xl font-bold text-[#16A34A]">
                {nps?.responseRate ?? 0}%
              </p>
              <p className="text-[11px] text-[var(--color-text-secondary)]">
                {t("reportsPage.npsPanel.responseRate")}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            {[
              {
                label: t("reportsPage.npsPanel.promoters"),
                count: nps?.promoters || 0,
                color: "bg-[#22C55E]",
              },
              {
                label: t("reportsPage.npsPanel.passives"),
                count: nps?.passives || 0,
                color: "bg-[#EAB308]",
              },
              {
                label: t("reportsPage.npsPanel.detractors"),
                count: nps?.detractors || 0,
                color: "bg-[#EF4444]",
              },
            ].map((seg) => {
              const total = nps?.totalResponded || 1;
              const pct = Math.round((seg.count / total) * 100) || 0;
              return (
                <div key={seg.label} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-[var(--color-text-secondary)] w-20">
                    {seg.label}
                  </span>
                  <div className="flex-1 bg-[var(--color-border-subtle)] rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full ${seg.color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-[var(--color-text-secondary)] w-10 text-end">
                    {seg.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent CSAT comments */}
      <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[var(--color-primary)]" />
          {t("reportsPage.csatPanel.recentComments")}
        </h3>
        {comments.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)] py-6 text-center">
            {t("reportsPage.csatPanel.noComments")}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {comments.map((c) => (
              <div
                key={c.id}
                className="border border-[var(--color-border)] rounded-lg p-3"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3 h-3 ${
                          c.score && i < c.score
                            ? "text-[#F59E0B] fill-[#F59E0B]"
                            : "text-[var(--color-border)]"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-[var(--color-text-secondary)]">
                    {c.submittedAt
                      ? new Date(c.submittedAt).toLocaleDateString()
                      : ""}
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-primary)] line-clamp-3 mb-1.5">
                  {c.comment}
                </p>
                <div className="flex items-center justify-between text-[10px] text-[var(--color-text-secondary)]">
                  <span className="truncate">
                    {c.ticketSubject || "—"}
                  </span>
                  {(c.assigneeFirstName || c.assigneeLastName) && (
                    <span className="flex-shrink-0 ms-2">
                      {[c.assigneeFirstName, c.assigneeLastName]
                        .filter(Boolean)
                        .join(" ")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SupportReportsContent;
