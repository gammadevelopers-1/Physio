"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { supportApi, getAccessToken } from "@/lib/api";
import { useSupportProfile } from "@/hooks/useSupportProfile";
import { toast } from "sonner";
import SupportSidebar from "./SupportSidebar";
import SupportMobileSidebar from "./SupportMobileSidebar";
import SupportNavbar from "./SupportNavbar";
import {
  BarChart3,
  ShieldCheck,
  Users,
  Smile,
  Filter,
  FileSpreadsheet,
  Download,
  Loader2,
  AlertTriangle,
} from "lucide-react";

// ─── Date range helpers ───────────────────────────────────
function getDateRange(period: string): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const to = now.toISOString();
  switch (period) {
    case "thisWeek": {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay()); // start of week (Sunday)
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
    default:
      return { dateFrom: "", dateTo: "" };
  }
}

function formatMinutes(m: number | null): string {
  if (m == null) return "--";
  if (m < 60) return `${Math.round(m)}m`;
  if (m < 60 * 24) return `${(m / 60).toFixed(1)}h`;
  return `${(m / (60 * 24)).toFixed(1)}d`;
}

// ─── Component ────────────────────────────────────────────
const SupportReportsContent = () => {
  const t = useTranslations("supportDashboard");
  const { user } = useAuth();
  const profile = useSupportProfile();

  const [selectedReport, setSelectedReport] = useState("ticketVolume");
  const [period, setPeriod] = useState("thisMonth");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Report data states
  const [volumeData, setVolumeData] = useState<any[]>([]);
  const [issuesData, setIssuesData] = useState<any[]>([]);
  const [slaData, setSlaData] = useState<any>(null);
  const [agentData, setAgentData] = useState<any[]>([]);
  const [reportLoading, setReportLoading] = useState(false);

  // CSAT/NPS (existing, works)
  const [csatData, setCsatData] = useState<any>(null);
  const [npsData, setNpsData] = useState<any>(null);
  const [surveyLoading, setSurveyLoading] = useState(false);

  // Export
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const reportTypes = [
    { key: "ticketVolume", title: t("reportsPage.reportTypes.ticketVolume"), description: t("reportsPage.reportTypes.ticketVolumeDesc"), icon: BarChart3, iconBg: "bg-[#EFF6FF]", iconColor: "text-[#3B82F6]" },
    { key: "topIssues", title: "Top Issues", description: "Recurring issue categories by frequency", icon: AlertTriangle, iconBg: "bg-[#FFEDD5]", iconColor: "text-[#F97316]" },
    { key: "slaCompliance", title: t("reportsPage.reportTypes.slaCompliance"), description: t("reportsPage.reportTypes.slaComplianceDesc"), icon: ShieldCheck, iconBg: "bg-[#DCFCE7]", iconColor: "text-[#16A34A]" },
    { key: "agentPerformance", title: t("reportsPage.reportTypes.agentPerformance"), description: t("reportsPage.reportTypes.agentPerformanceDesc"), icon: Users, iconBg: "bg-[#EDE9FE]", iconColor: "text-[#8B5CF6]" },
    { key: "csatNps", title: t("reportsPage.reportTypes.csatNps"), description: t("reportsPage.reportTypes.csatNpsDesc"), icon: Smile, iconBg: "bg-[#FEF3C7]", iconColor: "text-[#D97706]" },
  ];

  // ─── Compute date params ──────────────────────────────
  const dateParams = useMemo(
    () =>
      period === "custom"
        ? { dateFrom: customFrom, dateTo: customTo }
        : getDateRange(period),
    [period, customFrom, customTo],
  );

  // ─── Fetch report data ────────────────────────────────
  const fetchReport = useCallback(async () => {
    if (selectedReport === "csatNps") return; // handled separately
    setReportLoading(true);
    try {
      const params = {
        dateFrom: dateParams.dateFrom || undefined,
        dateTo: dateParams.dateTo || undefined,
      };
      switch (selectedReport) {
        case "ticketVolume": {
          const res = await supportApi.getVolumeReport(params);
          setVolumeData(Array.isArray(res) ? res : []);
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
      }
    } catch (err) {
      console.error("Report fetch error:", err);
      toast.error("Failed to load report data");
    } finally {
      setReportLoading(false);
    }
  }, [selectedReport, dateParams]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  useEffect(() => {
    if (selectedReport === "csatNps") {
      setSurveyLoading(true);
      Promise.all([supportApi.getCsatSummary(), supportApi.getNpsSummary()])
        .then(([csat, nps]) => { setCsatData(csat); setNpsData(nps); })
        .catch((err) => { console.error("CSAT/NPS fetch error:", err); })
        .finally(() => setSurveyLoading(false));
    }
  }, [selectedReport]);

  // ─── Export handler ───────────────────────────────────
  async function handleExport() {
    setIsExporting(true);
    try {
      const typeMap: Record<string, string> = {
        ticketVolume: "volume",
        topIssues: "issues",
        slaCompliance: "sla",
        agentPerformance: "agent-performance",
        csatNps: "volume", // fallback
      };
      const res = await supportApi.exportReport(
        typeMap[selectedReport] || "volume",
        { dateFrom: dateParams.dateFrom, dateTo: dateParams.dateTo },
      );
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename || `report-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Report downloaded");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export report");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportPdf() {
    setIsExporting(true);
    try {
      const typeMap: Record<string, string> = {
        ticketVolume: "volume",
        topIssues: "issues",
        slaCompliance: "sla",
        agentPerformance: "agent-performance",
        csatNps: "volume",
      };
      const endpoint = supportApi.getExportPdfUrl(
        typeMap[selectedReport] || "volume",
        { dateFrom: dateParams.dateFrom, dateTo: dateParams.dateTo },
      );
      // Binary fetch with auth token
      const token = getAccessToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";
      const response = await fetch(`${apiUrl}${endpoint}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!response.ok) throw new Error(`Export failed: ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `support_report_${typeMap[selectedReport]}_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded");
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Failed to export PDF");
    } finally {
      setIsExporting(false);
    }
  }

  // ─── Volume: aggregate by category ────────────────────
  const volumeByCategory = volumeData.reduce<Record<string, number>>(
    (acc, row) => {
      acc[row.category] = (acc[row.category] || 0) + Number(row.count);
      return acc;
    },
    {},
  );
  const volumeCategories = Object.entries(volumeByCategory)
    .sort((a, b) => b[1] - a[1]);
  const volumeTotal = volumeCategories.reduce((s, [, c]) => s + c, 0);

  // ─── Render ───────────────────────────────────────────
  return (
    <>
      <SupportNavbar profile={profile} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <SupportSidebar profile={profile} supportSubRole={user?.supportSubRole} />
            </div>
            <SupportMobileSidebar profile={profile} supportSubRole={user?.supportSubRole} />

            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                    {t("reportsPage.title")}
                  </h1>
                  <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                    {t("reportsPage.subtitle")}
                  </p>
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    disabled={isExporting}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] transition-colors disabled:opacity-50"
                  >
                    {isExporting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    Export
                  </button>
                  {showExportMenu && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-[var(--color-border)] rounded-lg shadow-lg z-20 min-w-[180px] py-1">
                      <button
                        type="button"
                        onClick={() => { setShowExportMenu(false); handleExport(); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)] text-left"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-[#16A34A]" />
                        Download CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowExportMenu(false); handleExportPdf(); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)] text-left"
                      >
                        <Download className="w-4 h-4 text-[#DC2626]" />
                        Download PDF
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Report Type Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                {reportTypes.map((report) => {
                  const Icon = report.icon;
                  const isSelected = selectedReport === report.key;
                  return (
                    <button
                      key={report.key}
                      onClick={() => setSelectedReport(report.key)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "bg-[#FDF6EC] border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]"
                          : "bg-[var(--color-surface-card)] border-[var(--color-border)] hover:border-[var(--color-border)]"
                      }`}
                    >
                      <div className={`w-8 h-8 ${report.iconBg} rounded-lg flex items-center justify-center mb-2`}>
                        <Icon className={`w-4 h-4 ${report.iconColor}`} />
                      </div>
                      <p className={`text-xs font-semibold ${isSelected ? "text-[#a37f49]" : "text-[var(--color-text-primary)]"}`}>
                        {report.title}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Filters */}
              <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{t("reportsPage.filters.title")}</h3>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-[11px] text-[var(--color-text-secondary)] mb-1">{t("reportsPage.filters.period")}</label>
                    <select
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      className="px-3 py-2 border border-[var(--color-input-border)] rounded-lg text-[13px] text-[var(--color-text-secondary)] bg-[var(--color-surface-card)] focus:outline-none focus:border-[var(--color-input-focus)]"
                    >
                      <option value="thisWeek">{t("reportsPage.filters.thisWeek")}</option>
                      <option value="lastWeek">{t("reportsPage.filters.lastWeek")}</option>
                      <option value="thisMonth">{t("reportsPage.filters.thisMonth")}</option>
                      <option value="lastMonth">{t("reportsPage.filters.lastMonth")}</option>
                      <option value="custom">{t("reportsPage.filters.custom")}</option>
                    </select>
                  </div>
                  {period === "custom" && (
                    <>
                      <div>
                        <label className="block text-[11px] text-[var(--color-text-secondary)] mb-1">From</label>
                        <input
                          type="date"
                          value={customFrom}
                          onChange={(e) => setCustomFrom(e.target.value)}
                          className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-secondary)] bg-white focus:outline-none focus:border-[#a37f49]"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-[var(--color-text-secondary)] mb-1">To</label>
                        <input
                          type="date"
                          value={customTo}
                          onChange={(e) => setCustomTo(e.target.value)}
                          className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-secondary)] bg-white focus:outline-none focus:border-[#a37f49]"
                        />
                      </div>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      await fetchReport();
                      toast.success("Report refreshed");
                    }}
                    disabled={reportLoading}
                    className="flex items-center gap-1.5 px-4 py-2 btn-gold text-white text-sm font-medium rounded-lg disabled:opacity-50"
                  >
                    {reportLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <BarChart3 className="w-4 h-4" />
                    )}
                    {t("reportsPage.generateReport")}
                  </button>
                </div>
              </div>

              {/* Report Content */}
              <div className="bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--color-border-subtle)]">
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                    {reportTypes.find((r) => r.key === selectedReport)?.title}
                  </h3>
                </div>

                {reportLoading && selectedReport !== "csatNps" ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-[#002D87]" />
                  </div>
                ) : (
                  <>
                    {/* ─── Ticket Volume ─────────────────────── */}
                    {selectedReport === "ticketVolume" && (
                      <div className="p-5">
                        {volumeCategories.length === 0 ? (
                          <div className="text-center py-12 text-sm text-[var(--color-text-secondary)]">
                            No tickets found in this date range.
                          </div>
                        ) : (
                          <>
                            <p className="text-xs text-[var(--color-text-secondary)] mb-4">
                              Total tickets: <span className="font-semibold text-[var(--color-text-primary)]">{volumeTotal}</span>
                            </p>
                            <div className="space-y-2">
                              {volumeCategories.map(([cat, cnt]) => {
                                const pct = volumeTotal > 0 ? Math.round((cnt / volumeTotal) * 100) : 0;
                                return (
                                  <div key={cat} className="flex items-center gap-3">
                                    <span className="text-xs font-medium text-[var(--color-text-secondary)] w-24 capitalize">{cat}</span>
                                    <div className="flex-1 bg-[var(--color-border-subtle)] rounded-full h-3">
                                      <div className="h-3 rounded-full bg-[#3B82F6] transition-all" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-xs font-semibold text-[var(--color-text-primary)] w-12 text-right">{cnt}</span>
                                    <span className="text-[10px] text-[var(--color-text-secondary)] w-10 text-right">{pct}%</span>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* ─── Top Issues ─────────────────────────── */}
                    {selectedReport === "topIssues" && (
                      <div className="p-5">
                        {issuesData.length === 0 ? (
                          <div className="text-center py-12 text-sm text-[var(--color-text-secondary)]">
                            No issues found in this date range.
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-page)]">
                                  <th className="py-3 px-4 text-left text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase">Rank</th>
                                  <th className="py-3 px-4 text-left text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase">Category</th>
                                  <th className="py-3 px-4 text-right text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase">Tickets</th>
                                </tr>
                              </thead>
                              <tbody>
                                {issuesData.map((item, i) => (
                                  <tr key={item.category} className="border-b border-[var(--color-border-subtle)]">
                                    <td className="py-3 px-4 text-[13px] text-[var(--color-text-secondary)]">#{i + 1}</td>
                                    <td className="py-3 px-4 text-[13px] font-medium text-[var(--color-text-primary)] capitalize">{item.category}</td>
                                    <td className="py-3 px-4 text-[13px] font-semibold text-[var(--color-text-primary)] text-right">{Number(item.count)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ─── SLA Compliance ─────────────────────── */}
                    {selectedReport === "slaCompliance" && (
                      <div className="p-5">
                        {!slaData || slaData.totalResolved === 0 ? (
                          <div className="text-center py-12 text-sm text-[var(--color-text-secondary)]">
                            No resolved tickets in this date range.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            <div className="text-center p-6 bg-[var(--color-surface-page)] rounded-xl">
                              <p className={`text-4xl font-bold ${slaData.complianceRate >= 80 ? "text-[#16A34A]" : slaData.complianceRate >= 50 ? "text-[#F59E0B]" : "text-[#EF4444]"}`}>
                                {slaData.complianceRate}%
                              </p>
                              <p className="text-xs text-[var(--color-text-secondary)] mt-1">Overall SLA Compliance</p>
                              <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">{slaData.resolvedWithinSla} / {slaData.totalResolved} tickets met SLA</p>
                            </div>
                            <div className="text-center p-6 bg-[var(--color-surface-page)] rounded-xl">
                              <p className={`text-4xl font-bold ${slaData.frtCompliance >= 80 ? "text-[#16A34A]" : "text-[#F59E0B]"}`}>
                                {slaData.frtCompliance}%
                              </p>
                              <p className="text-xs text-[var(--color-text-secondary)] mt-1">FRT Compliance</p>
                              <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">First Response Time met</p>
                            </div>
                            <div className="text-center p-6 bg-[var(--color-surface-page)] rounded-xl">
                              <p className={`text-4xl font-bold ${slaData.ttrCompliance >= 80 ? "text-[#16A34A]" : "text-[#F59E0B]"}`}>
                                {slaData.ttrCompliance}%
                              </p>
                              <p className="text-xs text-[var(--color-text-secondary)] mt-1">TTR Compliance</p>
                              <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">Time to Resolution met</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ─── Agent Performance ──────────────────── */}
                    {selectedReport === "agentPerformance" && (
                      <div className="p-5">
                        {agentData.length === 0 ? (
                          <div className="text-center py-12 text-sm text-[var(--color-text-secondary)]">
                            No agent data available.
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-page)]">
                                  <th className="py-3 px-4 text-left text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase">Agent</th>
                                  <th className="py-3 px-4 text-right text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase">Total</th>
                                  <th className="py-3 px-4 text-right text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase">Open</th>
                                  <th className="py-3 px-4 text-right text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase">Resolved</th>
                                  <th className="py-3 px-4 text-right text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase">Avg FRT</th>
                                  <th className="py-3 px-4 text-right text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase">CSAT</th>
                                  <th className="py-3 px-4 text-right text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase">FRT Breaches</th>
                                  <th className="py-3 px-4 text-right text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase">TTR Breaches</th>
                                </tr>
                              </thead>
                              <tbody>
                                {agentData.map((agent) => (
                                  <tr key={agent.userId} className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-page)]">
                                    <td className="py-3 px-4 text-[13px] font-medium text-[var(--color-text-primary)]">{agent.name || "Unknown"}</td>
                                    <td className="py-3 px-4 text-[13px] text-[var(--color-text-primary)] text-right">{agent.totalTickets}</td>
                                    <td className="py-3 px-4 text-[13px] text-[var(--color-text-primary)] text-right">{agent.openTickets ?? "--"}</td>
                                    <td className="py-3 px-4 text-[13px] text-[var(--color-text-primary)] text-right">{agent.resolvedTickets}</td>
                                    <td className="py-3 px-4 text-[13px] text-[var(--color-text-secondary)] text-right">{formatMinutes(agent.avgFrtMinutes)}</td>
                                    <td className="py-3 px-4 text-[13px] font-semibold text-right">
                                      <span className={agent.csatAvgScore ? "text-[#16A34A]" : "text-[var(--color-text-secondary)]"}>
                                        {agent.csatAvgScore != null ? `${agent.csatAvgScore}/5` : "--"}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-[13px] text-right">
                                      <span className={agent.frtBreaches > 0 ? "text-[#EF4444] font-semibold" : "text-[#16A34A]"}>
                                        {agent.frtBreaches}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-[13px] text-right">
                                      <span className={agent.ttrBreaches > 0 ? "text-[#EF4444] font-semibold" : "text-[#16A34A]"}>
                                        {agent.ttrBreaches}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ─── CSAT / NPS (existing, preserved) ──── */}
                    {selectedReport === "csatNps" && (
                      <div className="p-5 space-y-6">
                        {surveyLoading ? (
                          <div className="flex justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-[#002D87]" />
                          </div>
                        ) : (
                          <>
                            {/* CSAT */}
                            <div className="bg-white rounded-2xl border border-[var(--color-border)] p-6">
                              <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">CSAT Score</h3>
                              <div className="flex items-center gap-8 mb-4">
                                <div className="text-center">
                                  <p className="text-4xl font-bold text-[#002D87]">{csatData?.avgScore || "--"}</p>
                                  <p className="text-xs text-[var(--color-text-secondary)]">Avg Score (out of 5)</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-2xl font-bold text-[var(--color-text-primary)]">{csatData?.totalResponded || 0}</p>
                                  <p className="text-xs text-[var(--color-text-secondary)]">Responses</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-2xl font-bold text-[#16A34A]">{csatData?.responseRate || 0}%</p>
                                  <p className="text-xs text-[var(--color-text-secondary)]">Response Rate</p>
                                </div>
                              </div>
                              <div className="space-y-2">
                                {[5, 4, 3, 2, 1].map((score) => {
                                  const cnt = csatData?.distribution?.[score] || 0;
                                  const total = csatData?.totalResponded || 1;
                                  const pct = Math.round((cnt / total) * 100) || 0;
                                  const colors: Record<number, string> = { 5: "bg-[#22C55E]", 4: "bg-[#3B82F6]", 3: "bg-[#EAB308]", 2: "bg-[#F97316]", 1: "bg-[#EF4444]" };
                                  return (
                                    <div key={score} className="flex items-center gap-3">
                                      <span className="text-xs font-medium text-[var(--color-text-secondary)] w-12">{score} star</span>
                                      <div className="flex-1 bg-[var(--color-border-subtle)] rounded-full h-2.5">
                                        <div className={`h-2.5 rounded-full ${colors[score]}`} style={{ width: `${pct}%` }} />
                                      </div>
                                      <span className="text-xs text-[var(--color-text-secondary)] w-8">{cnt}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* NPS */}
                            <div className="bg-white rounded-2xl border border-[var(--color-border)] p-6">
                              <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">Net Promoter Score</h3>
                              <div className="flex items-center gap-8 mb-4">
                                <div className="text-center">
                                  <p className={`text-4xl font-bold ${(npsData?.npsScore || 0) >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"}`}>{npsData?.npsScore || 0}</p>
                                  <p className="text-xs text-[var(--color-text-secondary)]">NPS Score</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-2xl font-bold text-[var(--color-text-primary)]">{npsData?.totalResponded || 0}</p>
                                  <p className="text-xs text-[var(--color-text-secondary)]">Responses</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-2xl font-bold text-[#16A34A]">{npsData?.responseRate || 0}%</p>
                                  <p className="text-xs text-[var(--color-text-secondary)]">Response Rate</p>
                                </div>
                              </div>
                              <div className="space-y-2">
                                {[
                                  { label: "Promoters", count: npsData?.promoters || 0, color: "bg-[#22C55E]" },
                                  { label: "Passives", count: npsData?.passives || 0, color: "bg-[#EAB308]" },
                                  { label: "Detractors", count: npsData?.detractors || 0, color: "bg-[#EF4444]" },
                                ].map((seg) => (
                                  <div key={seg.label} className="flex items-center gap-3">
                                    <span className="text-xs font-medium text-[var(--color-text-secondary)] w-20">{seg.label}</span>
                                    <div className="flex-1 bg-[var(--color-border-subtle)] rounded-full h-2.5">
                                      <div className={`h-2.5 rounded-full ${seg.color}`} style={{ width: `${npsData?.totalResponded ? Math.round((seg.count / npsData.totalResponded) * 100) : 0}%` }} />
                                    </div>
                                    <span className="text-xs text-[var(--color-text-secondary)] w-8">{seg.count}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SupportReportsContent;
