"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import FinanceSidebar from "./FinanceSidebar";
import FinanceMobileSidebar from "./FinanceMobileSidebar";
import FinanceNavbar from "./FinanceNavbar";
import {
  BarChart3,
  FileText,
  Download,
  DollarSign,
  CreditCard,
  RotateCcw,
  TrendingUp,
  Calendar,
  Filter,
  FileSpreadsheet,
} from "lucide-react";

const mockProfile = {
  name: "Nora Al-Fahad",
  email: "n.alfahad@physio.edu.sa",
  revenue: "245K",
  invoices: 156,
  refundRate: 2.1,
};

const FinanceReportsContent = () => {
  const t = useTranslations("financeDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const profile = { ...mockProfile, name: t("names.noraAlFahad") };
  const [selectedReport, setSelectedReport] = useState("revenue");
  const [period, setPeriod] = useState("thisMonth");
  const [groupBy, setGroupBy] = useState("byCourse");

  const reportTypes = [
    {
      key: "revenue",
      title: t("reportsPage.reportTypes.revenue"),
      description: t("reportsPage.reportTypes.revenueDesc"),
      icon: DollarSign,
      iconBg: "bg-[#DCFCE7]",
      iconColor: "text-[#16A34A]",
    },
    {
      key: "payments",
      title: t("reportsPage.reportTypes.payments"),
      description: t("reportsPage.reportTypes.paymentsDesc"),
      icon: CreditCard,
      iconBg: "bg-[var(--color-border-subtle)]",
      iconColor: "text-[var(--color-primary)]",
    },
    {
      key: "refunds",
      title: t("reportsPage.reportTypes.refunds"),
      description: t("reportsPage.reportTypes.refundsDesc"),
      icon: RotateCcw,
      iconBg: "bg-[#FFEDD5]",
      iconColor: "text-[#EA580C]",
    },
    {
      key: "summary",
      title: t("reportsPage.reportTypes.summary"),
      description: t("reportsPage.reportTypes.summaryDesc"),
      icon: BarChart3,
      iconBg: "bg-[#EDE9FE]",
      iconColor: "text-[#8B5CF6]",
    },
  ];

  // Report chart data
  const reportChartData = [32, 45, 38, 52, 48, 65, 58, 72, 68, 85, 78, 92];
  const reportChartLabels = [t("months.jan"), t("months.feb"), t("months.mar"), t("months.apr"), t("months.may"), t("months.jun"), t("months.jul"), t("months.aug"), t("months.sep"), t("months.oct"), t("months.nov"), t("months.dec")];

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
  const mockRevenueReport = [
    { name: t("courses.aclsTraining"), revenue: `${t("kpi.sar")} 52,000`, transactions: 48, growth: "+15%" },
    { name: t("courses.firstAidCert"), revenue: `${t("kpi.sar")} 38,000`, transactions: 45, growth: "+8%" },
    { name: t("courses.cprCert"), revenue: `${t("kpi.sar")} 28,000`, transactions: 43, growth: "+12%" },
    { name: t("courses.emergencyResponse"), revenue: `${t("kpi.sar")} 24,000`, transactions: 24, growth: "+5%" },
    { name: t("courses.infectionControl"), revenue: `${t("kpi.sar")} 18,000`, transactions: 24, growth: "+3%" },
  ];

  return (
    <>
      <FinanceNavbar profile={profile} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <FinanceSidebar profile={profile} />
            </div>

            <FinanceMobileSidebar profile={profile} />

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
                  <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] transition-colors">
                    <FileSpreadsheet className="w-4 h-4" />
                    {t("reportsPage.exportExcel")}
                  </button>
                  <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] transition-colors">
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
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{t("reportsPage.filters.period")}</h3>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div>
                    <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1">{t("reportsPage.filters.period")}</label>
                    <select
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-secondary)] bg-[var(--color-surface-card)] focus:outline-none focus:border-[var(--color-primary)]"
                    >
                      <option value="thisMonth">{t("reportsPage.filters.thisMonth")}</option>
                      <option value="lastMonth">{t("reportsPage.filters.lastMonth")}</option>
                      <option value="thisQuarter">{t("reportsPage.filters.thisQuarter")}</option>
                      <option value="thisYear">{t("reportsPage.filters.thisYear")}</option>
                      <option value="custom">{t("reportsPage.filters.custom")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] text-[var(--color-text-secondary)] mb-1">{t("reportsPage.filters.groupBy")}</label>
                    <select
                      value={groupBy}
                      onChange={(e) => setGroupBy(e.target.value)}
                      className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-[13px] text-[var(--color-text-secondary)] bg-[var(--color-surface-card)] focus:outline-none focus:border-[var(--color-primary)]"
                    >
                      <option value="byCourse">{t("reportsPage.filters.byCourse")}</option>
                      <option value="byInstructor">{t("reportsPage.filters.byInstructor")}</option>
                      <option value="byGateway">{t("reportsPage.filters.byGateway")}</option>
                      <option value="byStatus">{t("reportsPage.filters.byStatus")}</option>
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
                        <linearGradient id="reportAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
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

                      <path d={reportAreaPath} fill="url(#reportAreaGradient)" />

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
                            <title>{`${reportChartLabels[index]}: ${t("kpi.sar")} ${reportChartData[index]}K`}</title>
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
                        <th className={`py-3 px-5 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>{t("paymentsTable.columns.course")}</th>
                        <th className={`py-3 px-5 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>{t("sidebar.revenue")}</th>
                        <th className={`py-3 px-5 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase hidden md:table-cell ${isRTL ? "text-right" : "text-left"}`}>{t("reportsPage.columns.transactions")}</th>
                        <th className={`py-3 px-5 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>{t("reportsPage.columns.growth")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockRevenueReport.map((item, index) => (
                        <tr key={index} className="border-b border-[#F3F4F6] hover:bg-[var(--color-surface-page)]">
                          <td className="py-3 px-5 text-[13px] font-medium text-[var(--color-text-primary)]">{item.name}</td>
                          <td className="py-3 px-5 text-[13px] font-semibold text-[var(--color-text-primary)]">{item.revenue}</td>
                          <td className="py-3 px-5 text-[13px] text-[var(--color-text-secondary)] hidden md:table-cell">{item.transactions}</td>
                          <td className="py-3 px-5">
                            <span className="flex items-center gap-1 text-[13px] font-semibold text-[#16A34A]">
                              <TrendingUp className="w-3 h-3" />
                              {item.growth}
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

export default FinanceReportsContent;
