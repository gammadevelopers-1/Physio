"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
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
} from "lucide-react";

const mockProfile = {
  name: "Hana Al-Saud",
  email: "h.alsaud@physio.edu.sa",
  resolved: 156,
  csat: 94,
  avgFRT: "1.2h",
};

const SupportReportsContent = () => {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const profile = { ...mockProfile, name: t("names.hanaAlSaud") };
  const [selectedReport, setSelectedReport] = useState("ticketVolume");
  const [period, setPeriod] = useState("thisWeek");
  const [groupBy, setGroupBy] = useState("byCategory");

  const reportTypes = [
    {
      key: "ticketVolume",
      title: t("reportsPage.reportTypes.ticketVolume"),
      description: t("reportsPage.reportTypes.ticketVolumeDesc"),
      icon: BarChart3,
      iconBg: "bg-[var(--color-border-subtle)]",
      iconColor: "text-[var(--color-primary)]",
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

  // Report chart data
  const reportChartData = [15, 22, 18, 25, 20, 28, 24];
  const reportChartLabels = [
    t("days.mon"),
    t("days.tue"),
    t("days.wed"),
    t("days.thu"),
    t("days.fri"),
    t("days.sat"),
    t("days.sun"),
  ];

  const generateLinePath = (chartData: number[]) => {
    const width = 100;
    const height = 100;
    const padding = 5;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const maxValue = Math.max(...chartData) * 1.1;
    const minValue = Math.min(...chartData) * 0.9;
    const range = maxValue - minValue || 1;

    const pts = chartData.map((value, index) => {
      const x = padding + (index / (chartData.length - 1)) * chartWidth;
      const y = padding + chartHeight - ((value - minValue) / range) * chartHeight;
      return { x, y };
    });

    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cpx = (prev.x + curr.x) / 2;
      path += ` Q ${prev.x + (cpx - prev.x) * 0.5} ${prev.y}, ${cpx} ${(prev.y + curr.y) / 2}`;
      path += ` Q ${cpx + (curr.x - cpx) * 0.5} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    const areaPath = path + ` L ${pts[pts.length - 1].x} ${height - padding} L ${pts[0].x} ${height - padding} Z`;

    return { linePath: path, areaPath, points: pts };
  };

  const { linePath: reportLinePath, areaPath: reportAreaPath, points: reportPoints } = generateLinePath(reportChartData);

  // Mock report data
  const mockReportData = [
    { name: t("ticketsBoard.categories.billing"), tickets: 45, avgResponse: "1.5h", avgResolution: "5.2h", satisfaction: "92%" },
    { name: t("ticketsBoard.categories.login"), tickets: 38, avgResponse: "0.8h", avgResolution: "3.1h", satisfaction: "96%" },
    { name: t("ticketsBoard.categories.certificate"), tickets: 28, avgResponse: "1.2h", avgResolution: "4.8h", satisfaction: "94%" },
    { name: t("ticketsBoard.categories.content"), tickets: 22, avgResponse: "2.0h", avgResolution: "6.5h", satisfaction: "88%" },
    { name: t("ticketsBoard.categories.technical"), tickets: 18, avgResponse: "1.8h", avgResolution: "7.2h", satisfaction: "85%" },
  ];

  return (
    <>
      <SupportNavbar profile={profile} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <SupportSidebar profile={profile} />
            </div>

            <SupportMobileSidebar profile={profile} />

            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                    {t("reportsPage.title")}
                  </h1>
                  <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                    {t("reportsPage.subtitle")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors">
                    <FileSpreadsheet className="w-4 h-4" />
                    {t("reportsPage.exportExcel")}
                  </button>
                  <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors">
                    <Download className="w-4 h-4" />
                    {t("reportsPage.exportPdf")}
                  </button>
                </div>
              </div>

              {/* Report Type Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {reportTypes.map((report) => {
                  const Icon = report.icon;
                  const isSelected = selectedReport === report.key;
                  return (
                    <button
                      key={report.key}
                      onClick={() => setSelectedReport(report.key)}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "bg-[#FDF6EC] border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]"
                          : "bg-[var(--color-surface-card)] border-[var(--color-border)] hover:border-[var(--color-border)]"
                      }`}
                    >
                      <div className={`w-10 h-10 ${report.iconBg} rounded-lg flex items-center justify-center mb-3`}>
                        <Icon className={`w-5 h-5 ${report.iconColor}`} />
                      </div>
                      <p className={`text-sm font-semibold ${isSelected ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)]"}`}>
                        {report.title}
                      </p>
                      <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5">{report.description}</p>
                    </button>
                  );
                })}
              </div>

              {/* Filters */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Filter className="w-4 h-4 text-[var(--color-text-secondary)]" />
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{t("reportsPage.filters.title")}</h3>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div>
                    <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1">{t("reportsPage.filters.period")}</label>
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
                  <div>
                    <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1">{t("reportsPage.filters.groupBy")}</label>
                    <select
                      value={groupBy}
                      onChange={(e) => setGroupBy(e.target.value)}
                      className="px-3 py-2 border border-[var(--color-input-border)] rounded-lg text-[13px] text-[var(--color-text-secondary)] bg-[var(--color-surface-card)] focus:outline-none focus:border-[var(--color-input-focus)]"
                    >
                      <option value="byCategory">{t("reportsPage.filters.byCategory")}</option>
                      <option value="byAgent">{t("reportsPage.filters.byAgent")}</option>
                      <option value="byPriority">{t("reportsPage.filters.byPriority")}</option>
                      <option value="byChannel">{t("reportsPage.filters.byChannel")}</option>
                    </select>
                  </div>
                  <div className="sm:ml-auto flex items-end">
                    <button className="flex items-center gap-1.5 px-4 py-2 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg transition-colors">
                      <BarChart3 className="w-4 h-4" />
                      {t("reportsPage.generateReport")}
                    </button>
                  </div>
                </div>
              </div>

              {/* Report Results */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#F3F4F6]">
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                    {reportTypes.find((r) => r.key === selectedReport)?.title}
                  </h3>
                </div>

                {/* Report Line Chart */}
                <div className="px-5 py-4">
                  <div className="h-[200px] bg-gradient-to-b from-[#EFF6FF] to-transparent rounded-xl p-4 relative">
                    <svg
                      viewBox="0 0 100 100"
                      className="w-full h-full"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient id="supportReportAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.05" />
                        </linearGradient>
                      </defs>

                      {[0, 25, 50, 75, 100].map((y) => (
                        <line
                          key={y}
                          x1="5"
                          y1={5 + (90 * (100 - y)) / 100}
                          x2="95"
                          y2={5 + (90 * (100 - y)) / 100}
                          stroke="var(--color-border)"
                          strokeWidth="0.3"
                          strokeDasharray="2,2"
                        />
                      ))}

                      <path d={reportAreaPath} fill="url(#supportReportAreaGradient)" />

                      <path
                        d={reportLinePath}
                        fill="none"
                        stroke="#3B82F6"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />

                      {reportPoints.map((point, index) => (
                        <g key={index}>
                          <circle
                            cx={point.x}
                            cy={point.y}
                            r="3"
                            fill="white"
                            stroke="#3B82F6"
                            strokeWidth="2"
                            vectorEffect="non-scaling-stroke"
                          />
                          <circle
                            cx={point.x}
                            cy={point.y}
                            r="8"
                            fill="transparent"
                            className="cursor-pointer"
                          >
                            <title>{`${reportChartLabels[index]}: ${reportChartData[index]}`}</title>
                          </circle>
                        </g>
                      ))}
                    </svg>
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-[var(--color-text-secondary)] px-1">
                    {reportChartLabels.map((label, index) => (
                      <span key={index} className="text-center">{label}</span>
                    ))}
                  </div>
                </div>

                {/* Data Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-page)]">
                        <th className={`py-3 px-5 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>{t("reportsPage.columns.category")}</th>
                        <th className={`py-3 px-5 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>{t("reportsPage.columns.tickets")}</th>
                        <th className={`py-3 px-5 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase hidden md:table-cell ${isRTL ? "text-right" : "text-left"}`}>{t("reportsPage.columns.avgResponse")}</th>
                        <th className={`py-3 px-5 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase hidden md:table-cell ${isRTL ? "text-right" : "text-left"}`}>{t("reportsPage.columns.avgResolution")}</th>
                        <th className={`py-3 px-5 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>{t("reportsPage.columns.satisfaction")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockReportData.map((item, index) => (
                        <tr key={index} className="border-b border-[#F3F4F6] hover:bg-[var(--color-border-subtle)]">
                          <td className="py-3 px-5 text-[13px] font-medium text-[var(--color-text-primary)]">{item.name}</td>
                          <td className="py-3 px-5 text-[13px] font-semibold text-[var(--color-text-primary)]">{item.tickets}</td>
                          <td className="py-3 px-5 text-[13px] text-[var(--color-text-secondary)] hidden md:table-cell">{item.avgResponse}</td>
                          <td className="py-3 px-5 text-[13px] text-[var(--color-text-secondary)] hidden md:table-cell">{item.avgResolution}</td>
                          <td className="py-3 px-5">
                            <span className="text-[13px] font-semibold text-[#16A34A]">
                              {item.satisfaction}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SupportReportsContent;
