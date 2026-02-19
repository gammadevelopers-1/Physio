"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import { useManagerProfile } from "@/hooks/useManagerProfile";
import {
  courseManagerApi,
  reportsApi,
  type ReportType,
  type ReportFormat,
} from "@/lib/api";
import type { InstructorCourse } from "@/types/instructor-dashboard";
import { toast } from "sonner";
import {
  Users,
  Calendar,
  FileText,
  Download,
  FileSpreadsheet,
  File,
  RefreshCw,
  BookOpen,
  UserCheck,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Modal Overlay                                                      */
/* ------------------------------------------------------------------ */
function ModalOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Report type definitions                                            */
/* ------------------------------------------------------------------ */
interface ReportTypeConfig {
  id: ReportType;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  requiresCourse: boolean;
  supportsDateRange: boolean;
}

const REPORT_TYPES: ReportTypeConfig[] = [
  {
    id: "attendance",
    icon: Calendar,
    iconBg: "bg-[#DCFCE7]",
    iconColor: "text-[#22C55E]",
    requiresCourse: false,
    supportsDateRange: true,
  },
  {
    id: "gradebook",
    icon: BookOpen,
    iconBg: "bg-[#E0E7FF]",
    iconColor: "text-[#6366F1]",
    requiresCourse: true,
    supportsDateRange: false,
  },
  {
    id: "enrollment",
    icon: Users,
    iconBg: "bg-[#DBEAFE]",
    iconColor: "text-[#3B82F6]",
    requiresCourse: false,
    supportsDateRange: false,
  },
  {
    id: "completion",
    icon: UserCheck,
    iconBg: "bg-[#FCE7F3]",
    iconColor: "text-[#EC4899]",
    requiresCourse: false,
    supportsDateRange: false,
  },
];

/* ------------------------------------------------------------------ */
/*  Export Format Modal                                                 */
/* ------------------------------------------------------------------ */
function ExportModal({
  reportType,
  courses,
  onClose,
  t,
}: {
  reportType: ReportTypeConfig;
  courses: InstructorCourse[];
  onClose: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [selectedCourse, setSelectedCourse] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat>("pdf");
  const [generating, setGenerating] = useState(false);

  const canGenerate = reportType.requiresCourse ? !!selectedCourse : true;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    try {
      await reportsApi.download(reportType.id, {
        courseId: selectedCourse || undefined,
        format: selectedFormat,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      toast.success(t("reportsPage.downloadSuccess"));
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t("reportsPage.downloadError");
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  const formatOptions: { id: ReportFormat; label: string; icon: React.ElementType; desc: string }[] = [
    { id: "pdf", label: "PDF", icon: FileText, desc: t("reportsPage.pdfDesc") },
    { id: "csv", label: "CSV", icon: FileSpreadsheet, desc: t("reportsPage.csvDesc") },
    { id: "xlsx", label: "Excel", icon: File, desc: t("reportsPage.excelDesc") },
  ];

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-lg ${reportType.iconBg} flex items-center justify-center`}
              >
                <reportType.icon
                  className={`w-5 h-5 ${reportType.iconColor}`}
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#1F2937]">
                  {t("reportsPage.exportReport")}
                </h3>
                <p className="text-sm text-[#6B7280]">
                  {t(`reportsPage.${reportType.id}Report`)}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Course Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-[#374151] mb-1.5">
              {t("reportsPage.selectCourse")}
              {reportType.requiresCourse && (
                <span className="text-red-500 ml-0.5">*</span>
              )}
            </label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
            >
              {reportType.requiresCourse ? (
                <option value="">{t("reportsPage.chooseCourse")}</option>
              ) : (
                <option value="">{t("reportsPage.allCourses")}</option>
              )}
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range (only for attendance) */}
          {reportType.supportsDateRange && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  {t("reportsPage.dateFrom")}
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">
                  {t("reportsPage.dateTo")}
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                />
              </div>
            </div>
          )}

          {/* Export Format */}
          <p className="text-sm font-medium text-[#374151] mb-2">
            {t("reportsPage.selectFormat")}
          </p>
          <div className="space-y-2 mb-5">
            {formatOptions.map((fmt) => (
              <button
                key={fmt.id}
                onClick={() => setSelectedFormat(fmt.id)}
                className={`w-full flex items-center gap-4 p-3 border rounded-xl transition-colors ${
                  selectedFormat === fmt.id
                    ? "border-[#3B82F6] bg-[#EFF6FF]"
                    : "border-[#E5E7EB] hover:border-[#3B82F6] hover:bg-[#EFF6FF]"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    selectedFormat === fmt.id
                      ? "bg-white"
                      : "bg-[#F3F4F6]"
                  }`}
                >
                  <fmt.icon
                    className={`w-4 h-4 ${
                      selectedFormat === fmt.id
                        ? "text-[#3B82F6]"
                        : "text-[#6B7280]"
                    }`}
                  />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-[#1F2937]">
                    {fmt.label}
                  </p>
                  <p className="text-xs text-[#6B7280]">{fmt.desc}</p>
                </div>
                {selectedFormat === fmt.id && (
                  <div className="w-5 h-5 rounded-full bg-[#3B82F6] flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
            >
              {t("reportsPage.cancel")}
            </button>
            <button
              onClick={handleGenerate}
              disabled={!canGenerate || generating}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                canGenerate && !generating
                  ? "btn-gold text-white"
                  : "bg-[#F3F4F6] text-[#9CA3AF] cursor-not-allowed"
              }`}
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("reportsPage.generating")}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  {t("reportsPage.generate")}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
const ReportsContent = () => {
  const manager = useManagerProfile();
  const t = useTranslations("courseManagerDashboard");

  // Courses for the filter / selector
  const [courses, setCourses] = useState<InstructorCourse[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [courseError, setCourseError] = useState("");

  // Quick-generate state (for card buttons)
  const [generatingReport, setGeneratingReport] = useState<ReportType | null>(
    null
  );

  // Modal state
  const [exportModal, setExportModal] = useState<ReportTypeConfig | null>(null);

  // Global filter
  const [filterCourse, setFilterCourse] = useState("");
  const [filterFormat, setFilterFormat] = useState<ReportFormat>("pdf");

  // Fetch courses
  const fetchCourses = useCallback(async () => {
    setLoadingCourses(true);
    setCourseError("");
    try {
      const res = await courseManagerApi.getCourses({ limit: 200 });
      setCourses(res.data);
    } catch {
      setCourseError(t("reportsPage.loadError"));
    } finally {
      setLoadingCourses(false);
    }
  }, [t]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // Quick generate — uses the global filter course + selected format
  const handleQuickGenerate = async (rt: ReportTypeConfig) => {
    if (rt.requiresCourse && !filterCourse) {
      setExportModal(rt);
      return;
    }
    setGeneratingReport(rt.id);
    try {
      await reportsApi.download(rt.id, {
        courseId: filterCourse || undefined,
        format: filterFormat,
      });
      toast.success(t("reportsPage.downloadSuccess"));
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t("reportsPage.downloadError");
      toast.error(message);
    } finally {
      setGeneratingReport(null);
    }
  };

  return (
    <>
      <CourseManagerNavbar manager={manager} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <CourseManagerSidebar manager={manager} />
            </div>
            <CourseManagerMobileSidebar manager={manager} />

            {/* Main Content */}
            <div className="flex-1 min-w-0 space-y-6">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-[#1F2937]">
                    {t("reportsPage.title")}
                  </h1>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {t("reportsPage.subtitle")}
                  </p>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {REPORT_TYPES.map((rt) => (
                  <div
                    key={rt.id}
                    className="bg-white rounded-xl border border-[#E5E7EB] p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg ${rt.iconBg} flex items-center justify-center`}
                      >
                        <rt.icon className={`w-5 h-5 ${rt.iconColor}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#1F2937]">
                          {t(`reportsPage.${rt.id}Report`)}
                        </p>
                        <p className="text-xs text-[#6B7280]">
                          {rt.requiresCourse
                            ? t("reportsPage.perCourse")
                            : t("reportsPage.allOrPerCourse")}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Global Filters */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 flex flex-col md:flex-row gap-3">
                    {/* Course filter */}
                    <select
                      value={filterCourse}
                      onChange={(e) => setFilterCourse(e.target.value)}
                      disabled={loadingCourses}
                      className="flex-1 px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] disabled:opacity-50"
                    >
                      <option value="">{t("reportsPage.allCourses")}</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>

                    {/* Format filter */}
                    <select
                      value={filterFormat}
                      onChange={(e) =>
                        setFilterFormat(e.target.value as ReportFormat)
                      }
                      className="md:w-40 px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      <option value="pdf">PDF</option>
                      <option value="csv">CSV</option>
                      <option value="xlsx">Excel (XLSX)</option>
                    </select>
                  </div>

                  <button
                    onClick={fetchCourses}
                    disabled={loadingCourses}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 btn-gold text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${loadingCourses ? "animate-spin" : ""}`}
                    />
                    {t("reportsPage.refreshAll")}
                  </button>
                </div>
              </div>

              {/* Error state */}
              {courseError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{courseError}</p>
                  <button
                    onClick={fetchCourses}
                    className="ml-auto text-sm font-medium text-red-700 hover:text-red-800"
                  >
                    {t("reportsPage.retry")}
                  </button>
                </div>
              )}

              {/* Loading state */}
              {loadingCourses && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="bg-white rounded-xl border border-[#E5E7EB] p-5 animate-pulse"
                    >
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gray-200" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-2/3 bg-gray-200 rounded" />
                          <div className="h-3 w-full bg-gray-100 rounded" />
                        </div>
                      </div>
                      <div className="h-10 bg-gray-100 rounded-lg" />
                    </div>
                  ))}
                </div>
              )}

              {/* Report Cards */}
              {!loadingCourses && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {REPORT_TYPES.map((rt) => (
                    <div
                      key={rt.id}
                      className="bg-white rounded-xl border border-[#E5E7EB] p-5 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-4">
                          <div
                            className={`w-12 h-12 rounded-xl ${rt.iconBg} flex items-center justify-center flex-shrink-0`}
                          >
                            <rt.icon
                              className={`w-6 h-6 ${rt.iconColor}`}
                            />
                          </div>
                          <div>
                            <h3 className="text-base font-semibold text-[#1F2937] mb-1">
                              {t(`reportsPage.${rt.id}Report`)}
                            </h3>
                            <p className="text-sm text-[#6B7280] line-clamp-2">
                              {t(`reportsPage.${rt.id}Desc`)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Info badges */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {rt.requiresCourse && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#FEF3C7] text-[#92400E] rounded text-xs font-medium">
                            {t("reportsPage.courseRequired")}
                          </span>
                        )}
                        {rt.supportsDateRange && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#EFF6FF] text-[#1D4ED8] rounded text-xs font-medium">
                            {t("reportsPage.dateRangeSupported")}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#F3F4F6] text-[#6B7280] rounded text-xs font-medium">
                          CSV / PDF / Excel
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleQuickGenerate(rt)}
                          disabled={generatingReport === rt.id}
                          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                            generatingReport === rt.id
                              ? "bg-[#F3F4F6] text-[#9CA3AF] cursor-not-allowed"
                              : "bg-[#EFF6FF] text-[#3B82F6] hover:bg-[#DBEAFE]"
                          }`}
                        >
                          {generatingReport === rt.id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              {t("reportsPage.generating")}
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4" />
                              {t("reportsPage.quickDownload")}
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => setExportModal(rt)}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                        >
                          {t("reportsPage.customize")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Audit note */}
              <div className="bg-[#EFF6FF] rounded-xl border border-[#BFDBFE] p-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-[#3B82F6] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-[#1E40AF]">
                      {t("reportsPage.auditTitle")}
                    </p>
                    <p className="text-sm text-[#3B82F6] mt-0.5">
                      {t("reportsPage.auditDesc")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {exportModal && (
        <ExportModal
          reportType={exportModal}
          courses={courses}
          onClose={() => setExportModal(null)}
          t={t}
        />
      )}
    </>
  );
};

export default ReportsContent;
