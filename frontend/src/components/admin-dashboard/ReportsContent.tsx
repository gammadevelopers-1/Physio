"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import AdminSidebar from "./AdminSidebar";
import AdminMobileSidebar from "./AdminMobileSidebar";
import AdminNavbar from "./AdminNavbar";
import {
  BarChart3,
  Users,
  BookOpen,
  Award,
  DollarSign,
  FileText,
  Download,
  Calendar,
  Play,
  Clock,
  Mail,
} from "lucide-react";
import { useAdminProfile } from "@/hooks/useAdminProfile";

const ReportsContent = () => {
  const t = useTranslations("adminDashboard");
  const admin = useAdminProfile();
  const locale = useLocale();
  const isRTL = locale === "ar";

  // Report types with translations
  const reportTypes = [
    {
      id: "users",
      title: t("reportsPage.reportTypes.users.title"),
      description: t("reportsPage.reportTypes.users.description"),
      icon: Users,
      color: "#3B82F6",
      bgColor: "#DBEAFE",
    },
    {
      id: "enrollment",
      title: t("reportsPage.reportTypes.enrollment.title"),
      description: t("reportsPage.reportTypes.enrollment.description"),
      icon: BookOpen,
      color: "#8B5CF6",
      bgColor: "#EDE9FE",
    },
    {
      id: "completion",
      title: t("reportsPage.reportTypes.completion.title"),
      description: t("reportsPage.reportTypes.completion.description"),
      icon: Award,
      color: "#16A34A",
      bgColor: "#DCFCE7",
    },
    {
      id: "financial",
      title: t("reportsPage.reportTypes.financial.title"),
      description: t("reportsPage.reportTypes.financial.description"),
      icon: DollarSign,
      color: "#D4A520",
      bgColor: "var(--gold-gold-100)",
    },
    {
      id: "instructor",
      title: t("reportsPage.reportTypes.instructor.title"),
      description: t("reportsPage.reportTypes.instructor.description"),
      icon: Users,
      color: "#EC4899",
      bgColor: "#FCE7F3",
    },
    {
      id: "compliance",
      title: t("reportsPage.reportTypes.compliance.title"),
      description: t("reportsPage.reportTypes.compliance.description"),
      icon: FileText,
      color: "#002D87",
      bgColor: "#F0F7FF",
    },
    {
      id: "certificate",
      title: t("reportsPage.reportTypes.certificate.title"),
      description: t("reportsPage.reportTypes.certificate.description"),
      icon: Award,
      color: "#F59E0B",
      bgColor: "#FEF3C7",
    },
  ];

  // Scheduled reports with translations
  const scheduledReports = [
    { id: "1", name: t("reportsPage.scheduledReportNames.weeklyUserActivity"), frequency: t("reportsPage.frequencies.weekly"), nextRun: "Feb 10, 2026", recipients: 2 },
    { id: "2", name: t("reportsPage.scheduledReportNames.monthlyRevenue"), frequency: t("reportsPage.frequencies.monthly"), nextRun: "Mar 1, 2026", recipients: 3 },
    { id: "3", name: t("reportsPage.scheduledReportNames.dailySecurity"), frequency: t("reportsPage.frequencies.daily"), nextRun: "Feb 10, 2026", recipients: 1 },
  ];

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  return (
    <>
      <AdminNavbar admin={admin} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <AdminSidebar admin={admin} />
            </div>

            <AdminMobileSidebar admin={admin} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937]">
                  {t("reportsPage.title")}
                </h1>
                <p className="text-sm text-[#6B7280] mt-1">
                  {t("reportsPage.subtitle")}
                </p>
              </div>

              {/* Date Range Filter */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 mb-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[#6B7280]" />
                    <span className="text-sm text-[#4B5563]">{t("reportsPage.dateRange")}:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="h-10 px-3 border border-[#E5E7EB] rounded-lg text-sm"
                    />
                    <span className="text-[#6B7280]">-</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="h-10 px-3 border border-[#E5E7EB] rounded-lg text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2 sm:ml-auto">
                    <button className="px-4 py-2 text-sm text-[#4B5563] hover:bg-[#F3F4F6] rounded-lg">
                      {t("reportsPage.presets.today")}
                    </button>
                    <button className="px-4 py-2 text-sm text-[#4B5563] hover:bg-[#F3F4F6] rounded-lg">
                      {t("reportsPage.presets.week")}
                    </button>
                    <button className="px-4 py-2 text-sm text-[#4B5563] hover:bg-[#F3F4F6] rounded-lg">
                      {t("reportsPage.presets.month")}
                    </button>
                    <button className="px-4 py-2 text-sm text-[#4B5563] hover:bg-[#F3F4F6] rounded-lg">
                      {t("reportsPage.presets.year")}
                    </button>
                  </div>
                </div>
              </div>

              {/* Report Types Grid */}
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
                  {t("reportsPage.generateReport")}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {reportTypes.map((report) => {
                    const Icon = report.icon;
                    return (
                      <div
                        key={report.id}
                        onClick={() => setSelectedReport(report.id)}
                        className={`bg-white rounded-xl border-2 p-5 cursor-pointer transition-all ${
                          selectedReport === report.id
                            ? "border-[#002D87] shadow-md"
                            : "border-[#E5E7EB] hover:border-[#002D87]/50"
                        }`}
                      >
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                          style={{ backgroundColor: report.bgColor }}
                        >
                          <Icon className="w-6 h-6" style={{ color: report.color }} />
                        </div>
                        <h3 className="font-semibold text-[#1F2937] mb-1">{report.title}</h3>
                        <p className="text-sm text-[#6B7280]">{report.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Generate Button */}
              {selectedReport && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 mb-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-[#1F2937]">
                        {reportTypes.find((r) => r.id === selectedReport)?.title}
                      </h3>
                      <p className="text-sm text-[#6B7280]">
                        {t("reportsPage.readyToGenerate")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <select className="h-10 px-4 border border-[#E5E7EB] rounded-lg text-sm text-[#4B5563]">
                        <option value="pdf">PDF</option>
                        <option value="excel">Excel</option>
                        <option value="csv">CSV</option>
                      </select>
                      <button className="flex items-center gap-2 px-4 py-2.5 btn-gold text-white rounded-lg transition-colors">
                        <Play className="w-4 h-4" />
                        <span className="text-sm font-medium">{t("reportsPage.generate")}</span>
                      </button>
                      <button className="flex items-center gap-2 px-4 py-2.5 border border-[var(--color-primary)] text-[var(--color-primary)] rounded-lg hover:bg-[#FFF9F0] transition-colors">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm font-medium">{t("reportsPage.schedule")}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Scheduled Reports */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                <div className="p-5 border-b border-[#E5E7EB]">
                  <h3 className="text-lg font-semibold text-[#1F2937]">
                    {t("reportsPage.scheduledReports")}
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#F9FAFB]">
                      <tr>
                        <th className={`px-4 py-3 text-xs font-medium text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("reportsPage.table.reportName")}
                        </th>
                        <th className={`px-4 py-3 text-xs font-medium text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("reportsPage.table.frequency")}
                        </th>
                        <th className={`px-4 py-3 text-xs font-medium text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("reportsPage.table.nextRun")}
                        </th>
                        <th className={`px-4 py-3 text-xs font-medium text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("reportsPage.table.recipients")}
                        </th>
                        <th className={`px-4 py-3 text-xs font-medium text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("reportsPage.table.actions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {scheduledReports.map((report) => (
                        <tr key={report.id} className="border-b border-[#F3F4F6]">
                          <td className="px-4 py-4 text-sm font-medium text-[#1F2937]">
                            {report.name}
                          </td>
                          <td className="px-4 py-4">
                            <span className="px-2.5 py-1 text-xs font-medium rounded bg-[#F3F4F6] text-[#4B5563]">
                              {report.frequency}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-[#6B7280]">{report.nextRun}</td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1">
                              <Mail className="w-4 h-4 text-[#6B7280]" />
                              <span className="text-sm text-[#6B7280]">{report.recipients}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <button className="text-sm text-[#0066FF] hover:underline">
                                {t("reportsPage.actions.edit")}
                              </button>
                              <button className="text-sm text-[#DC2626] hover:underline">
                                {t("reportsPage.actions.delete")}
                              </button>
                            </div>
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

export default ReportsContent;
