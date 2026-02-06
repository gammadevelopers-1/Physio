"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import InstructorNavbar from "./InstructorNavbar";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import {
  BarChart3,
  Users,
  Calendar,
  FileText,
  Award,
  TrendingUp,
  Clock,
  Download,
  FileSpreadsheet,
  File,
  ChevronDown,
  Filter,
  RefreshCw,
  Eye,
  BookOpen,
  ClipboardList,
  UserCheck,
  GraduationCap,
  Activity,
} from "lucide-react";

interface ReportType {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  lastGenerated?: string;
  dataPoints: number;
}

const mockInstructor = {
  name: "Dr. Faisal Al-Otaibi",
  email: "faisal@healthtraining.sa",
  rating: 4.8,
  courseCompletion: 92,
  avatar: "/images/instructor-1.png",
};

const ReportsContent = () => {
  const t = useTranslations("instructorDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [selectedCourse, setSelectedCourse] = useState("all");
  const [selectedDateRange, setSelectedDateRange] = useState("30days");
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);

  const courses = [
    { id: "all", name: t("reports.allCourses") },
    { id: "course1", name: "Lower Back Pain Management" },
    { id: "course2", name: "Sports Rehabilitation" },
    { id: "course3", name: "Pediatric Physiotherapy" },
  ];

  const dateRanges = [
    { id: "7days", name: t("reports.last7Days") },
    { id: "30days", name: t("reports.last30Days") },
    { id: "90days", name: t("reports.last90Days") },
    { id: "year", name: t("reports.lastYear") },
    { id: "all", name: t("reports.allTime") },
  ];

  const reportTypes: ReportType[] = [
    {
      id: "enrollment",
      title: t("reports.enrollmentReport"),
      description: t("reports.enrollmentDesc"),
      icon: Users,
      iconBg: "bg-[#DBEAFE]",
      iconColor: "text-[#3B82F6]",
      lastGenerated: "Feb 5, 2024",
      dataPoints: 156,
    },
    {
      id: "attendance",
      title: t("reports.attendanceReport"),
      description: t("reports.attendanceDesc"),
      icon: Calendar,
      iconBg: "bg-[#DCFCE7]",
      iconColor: "text-[#22C55E]",
      lastGenerated: "Feb 4, 2024",
      dataPoints: 342,
    },
    {
      id: "assessment",
      title: t("reports.assessmentReport"),
      description: t("reports.assessmentDesc"),
      icon: ClipboardList,
      iconBg: "bg-[#E0E7FF]",
      iconColor: "text-[#6366F1]",
      lastGenerated: "Feb 3, 2024",
      dataPoints: 89,
    },
    {
      id: "progress",
      title: t("reports.progressReport"),
      description: t("reports.progressDesc"),
      icon: TrendingUp,
      iconBg: "bg-[#FEF9C3]",
      iconColor: "text-[#EAB308]",
      lastGenerated: "Feb 2, 2024",
      dataPoints: 234,
    },
    {
      id: "completion",
      title: t("reports.completionReport"),
      description: t("reports.completionDesc"),
      icon: UserCheck,
      iconBg: "bg-[#FCE7F3]",
      iconColor: "text-[#EC4899]",
      lastGenerated: "Feb 1, 2024",
      dataPoints: 67,
    },
    {
      id: "certificate",
      title: t("reports.certificateReport"),
      description: t("reports.certificateDesc"),
      icon: GraduationCap,
      iconBg: "bg-[#FEF3C7]",
      iconColor: "text-[#D4A520]",
      lastGenerated: "Jan 30, 2024",
      dataPoints: 45,
    },
    {
      id: "engagement",
      title: t("reports.engagementReport"),
      description: t("reports.engagementDesc"),
      icon: Activity,
      iconBg: "bg-[#FFEDD5]",
      iconColor: "text-[#F97316]",
      lastGenerated: "Jan 28, 2024",
      dataPoints: 512,
    },
  ];

  const exportFormats = [
    {
      id: "pdf",
      name: "PDF",
      icon: FileText,
      description: t("reports.pdfDesc"),
    },
    {
      id: "csv",
      name: "CSV",
      icon: FileSpreadsheet,
      description: t("reports.csvDesc"),
    },
    {
      id: "excel",
      name: "Excel",
      icon: File,
      description: t("reports.excelDesc"),
    },
  ];

  const handleGenerateReport = (reportId: string) => {
    setGeneratingReport(reportId);
    // Simulate report generation
    setTimeout(() => {
      setGeneratingReport(null);
    }, 2000);
  };

  const handleExport = (report: ReportType) => {
    setSelectedReport(report);
    setShowExportModal(true);
  };

  const handleExportFormat = (format: string) => {
    // Handle export logic
    console.log(`Exporting ${selectedReport?.id} as ${format}`);
    setShowExportModal(false);
    setSelectedReport(null);
  };

  // Quick Stats
  const stats = {
    totalReports: reportTypes.length,
    generatedThisMonth: 24,
    dataPointsAnalyzed: "1,445",
    avgGenerationTime: "2.3s",
  };

  return (
    <>
      <InstructorNavbar instructor={mockInstructor} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <InstructorSidebar instructor={mockInstructor} />
            </div>
            <InstructorMobileSidebar instructor={mockInstructor} />

            {/* Main Content */}
            <div className="flex-1 min-w-0 space-y-6">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-[#1F2937]">
                    {t("reports.title")}
                  </h1>
                  <p className="text-sm text-[#6B7280] mt-1">{t("reports.subtitle")}</p>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#DBEAFE] flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-[#3B82F6]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[#1F2937]">
                        {stats.totalReports}
                      </p>
                      <p className="text-xs text-[#6B7280]">{t("reports.reportTypes")}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#DCFCE7] flex items-center justify-center">
                      <FileText className="w-5 h-5 text-[#22C55E]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[#1F2937]">
                        {stats.generatedThisMonth}
                      </p>
                      <p className="text-xs text-[#6B7280]">
                        {t("reports.generatedThisMonth")}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#E0E7FF] flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-[#6366F1]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[#1F2937]">
                        {stats.dataPointsAnalyzed}
                      </p>
                      <p className="text-xs text-[#6B7280]">
                        {t("reports.dataPointsAnalyzed")}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#FEF9C3] flex items-center justify-center">
                      <Clock className="w-5 h-5 text-[#EAB308]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[#1F2937]">
                        {stats.avgGenerationTime}
                      </p>
                      <p className="text-xs text-[#6B7280]">
                        {t("reports.avgGenTime")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 flex flex-col md:flex-row gap-3">
                    <select
                      value={selectedCourse}
                      onChange={(e) => setSelectedCourse(e.target.value)}
                      className="flex-1 px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedDateRange}
                      onChange={(e) => setSelectedDateRange(e.target.value)}
                      className="flex-1 md:w-auto px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      {dateRanges.map((range) => (
                        <option key={range.id} value={range.id}>
                          {range.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button className="flex items-center justify-center gap-2 px-4 py-2.5 btn-gold text-white rounded-lg text-sm font-medium transition-colors">
                    <RefreshCw className="w-4 h-4" />
                    {t("reports.refreshAll")}
                  </button>
                </div>
              </div>

              {/* Report Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reportTypes.map((report) => (
                  <div
                    key={report.id}
                    className="bg-white rounded-xl border border-[#E5E7EB] p-5 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className={`w-12 h-12 rounded-xl ${report.iconBg} flex items-center justify-center`}
                      >
                        <report.icon className={`w-6 h-6 ${report.iconColor}`} />
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleExport(report)}
                          className="p-2 text-[#6B7280] hover:text-[#3B82F6] hover:bg-[#EFF6FF] rounded-lg transition-colors"
                          title={t("reports.export")}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 text-[#6B7280] hover:text-[#3B82F6] hover:bg-[#EFF6FF] rounded-lg transition-colors"
                          title={t("reports.preview")}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-base font-semibold text-[#1F2937] mb-1">
                      {report.title}
                    </h3>
                    <p className="text-sm text-[#6B7280] mb-4 line-clamp-2">
                      {report.description}
                    </p>

                    <div className="flex items-center justify-between text-xs text-[#9CA3AF] mb-4">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {t("reports.lastGenerated")}: {report.lastGenerated}
                      </span>
                      <span>{report.dataPoints} {t("reports.dataPoints")}</span>
                    </div>

                    <button
                      onClick={() => handleGenerateReport(report.id)}
                      disabled={generatingReport === report.id}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        generatingReport === report.id
                          ? "bg-[#F3F4F6] text-[#9CA3AF] cursor-not-allowed"
                          : "bg-[#EFF6FF] text-[#3B82F6] hover:bg-[#DBEAFE]"
                      }`}
                    >
                      {generatingReport === report.id ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          {t("reports.generating")}
                        </>
                      ) : (
                        <>
                          <BarChart3 className="w-4 h-4" />
                          {t("reports.generate")}
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>

              {/* Recent Reports Section */}
              <div className="bg-white rounded-xl border border-[#E5E7EB]">
                <div className="p-5 border-b border-[#E5E7EB]">
                  <h3 className="text-base font-semibold text-[#1F2937]">
                    {t("reports.recentlyGenerated")}
                  </h3>
                </div>
                <div className="divide-y divide-[#E5E7EB]">
                  {[
                    {
                      name: "Enrollment Report - All Courses",
                      date: "Feb 5, 2024",
                      format: "PDF",
                      size: "245 KB",
                    },
                    {
                      name: "Attendance Report - Lower Back Pain",
                      date: "Feb 4, 2024",
                      format: "Excel",
                      size: "1.2 MB",
                    },
                    {
                      name: "Assessment Report - Sports Rehab",
                      date: "Feb 3, 2024",
                      format: "CSV",
                      size: "156 KB",
                    },
                    {
                      name: "Progress Report - All Courses",
                      date: "Feb 2, 2024",
                      format: "PDF",
                      size: "892 KB",
                    },
                  ].map((report, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 hover:bg-[#F9FAFB] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#F3F4F6] flex items-center justify-center">
                          {report.format === "PDF" ? (
                            <FileText className="w-5 h-5 text-[#EF4444]" />
                          ) : report.format === "Excel" ? (
                            <File className="w-5 h-5 text-[#22C55E]" />
                          ) : (
                            <FileSpreadsheet className="w-5 h-5 text-[#3B82F6]" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#1F2937]">
                            {report.name}
                          </p>
                          <p className="text-xs text-[#6B7280]">
                            {report.date} • {report.size}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-[#F3F4F6] rounded text-xs font-medium text-[#6B7280]">
                          {report.format}
                        </span>
                        <button className="p-2 text-[#6B7280] hover:text-[#3B82F6] hover:bg-[#EFF6FF] rounded-lg transition-colors">
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Export Modal */}
              {showExportModal && selectedReport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                  <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-lg ${selectedReport.iconBg} flex items-center justify-center`}
                          >
                            <selectedReport.icon
                              className={`w-5 h-5 ${selectedReport.iconColor}`}
                            />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-[#1F2937]">
                              {t("reports.exportReport")}
                            </h3>
                            <p className="text-sm text-[#6B7280]">
                              {selectedReport.title}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setShowExportModal(false);
                            setSelectedReport(null);
                          }}
                          className="p-2 text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>

                      <p className="text-sm text-[#6B7280] mb-4">
                        {t("reports.selectFormat")}
                      </p>

                      <div className="space-y-3">
                        {exportFormats.map((format) => (
                          <button
                            key={format.id}
                            onClick={() => handleExportFormat(format.id)}
                            className="w-full flex items-center gap-4 p-4 border border-[#E5E7EB] rounded-xl hover:border-[#3B82F6] hover:bg-[#EFF6FF] transition-colors group"
                          >
                            <div className="w-10 h-10 rounded-lg bg-[#F3F4F6] flex items-center justify-center group-hover:bg-white">
                              <format.icon className="w-5 h-5 text-[#6B7280] group-hover:text-[#3B82F6]" />
                            </div>
                            <div className="flex-1 text-left">
                              <p className="text-sm font-medium text-[#1F2937]">
                                {format.name}
                              </p>
                              <p className="text-xs text-[#6B7280]">
                                {format.description}
                              </p>
                            </div>
                            <Download className="w-5 h-5 text-[#9CA3AF] group-hover:text-[#3B82F6]" />
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => {
                          setShowExportModal(false);
                          setSelectedReport(null);
                        }}
                        className="w-full mt-4 px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                      >
                        {t("reports.cancel")}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ReportsContent;
