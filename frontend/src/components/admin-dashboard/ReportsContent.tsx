"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import AdminSidebar from "./AdminSidebar";
import AdminMobileSidebar from "./AdminMobileSidebar";
import AdminNavbar from "./AdminNavbar";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import Select from "./Select";
import {
  courseManagerApi,
  reportsApi,
  type ReportType,
  type ReportFormat,
} from "@/lib/api";
import type { InstructorCourse } from "@/types/instructor-dashboard";
import { toast } from "sonner";
import {
  Calendar,
  FileText,
  Download,
  FileSpreadsheet,
  File,
  RefreshCw,
  BookOpen,
  Loader2,
  AlertCircle,
  X,
  Award,
  Radio,
  Users,
  UserCheck,
  DollarSign,
  ShieldCheck,
  TrendingUp,
  ClipboardList,
  Star,
  ChevronDown,
} from "lucide-react";
import DatePicker from "@/components/ui/DatePicker";

// ─── Categories & Report Definitions ────────────────────────────
//
// The 5 client-requested categories are the user-facing grouping.
// Each category contains 1–N actual report endpoints (the same
// endpoints managers see, but admins get them platform-wide).
//
// `requiresCourse` controls modal validation; `supportsDateRange`
// shows the date pickers. Most platform-wide admin reports work
// without a courseId (the modal lets you optionally narrow by course).

type CategoryId =
  | "attendance"
  | "cme"
  | "students"
  | "registration"
  | "financial";

interface ReportTypeConfig {
  id: ReportType;
  category: CategoryId;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  requiresCourse: boolean;
  supportsDateRange: boolean;
}

interface CategoryConfig {
  id: CategoryId;
  icon: React.ElementType;
  accentColor: string;
}

const CATEGORIES: CategoryConfig[] = [
  { id: "attendance", icon: Calendar, accentColor: "#22C55E" },
  { id: "cme", icon: Award, accentColor: "#D97706" },
  { id: "students", icon: Users, accentColor: "#3B82F6" },
  { id: "registration", icon: ClipboardList, accentColor: "#A855F7" },
  { id: "financial", icon: DollarSign, accentColor: "#D4A520" },
];

const REPORT_TYPES: ReportTypeConfig[] = [
  // Attendance
  {
    id: "attendance",
    category: "attendance",
    icon: Calendar,
    iconBg: "bg-[#DCFCE7]",
    iconColor: "text-[#22C55E]",
    requiresCourse: false,
    supportsDateRange: true,
  },
  // CME / CPD
  {
    id: "cme-eligibility",
    category: "cme",
    icon: Award,
    iconBg: "bg-[#FEF3C7]",
    iconColor: "text-[#D97706]",
    requiresCourse: false,
    supportsDateRange: false,
  },
  // Students
  {
    id: "enrollment",
    category: "students",
    icon: Users,
    iconBg: "bg-[var(--color-border-subtle)]",
    iconColor: "text-[var(--color-primary)]",
    requiresCourse: false,
    supportsDateRange: false,
  },
  {
    id: "completion",
    category: "students",
    icon: UserCheck,
    iconBg: "bg-[#FCE7F3]",
    iconColor: "text-[#EC4899]",
    requiresCourse: false,
    supportsDateRange: false,
  },
  {
    id: "satisfaction",
    category: "students",
    icon: Star,
    iconBg: "bg-[#FEF3C7]",
    iconColor: "text-[#D97706]",
    requiresCourse: false,
    supportsDateRange: false,
  },
  {
    id: "gradebook",
    category: "students",
    icon: BookOpen,
    iconBg: "bg-[var(--color-border-subtle)]",
    iconColor: "text-[#6366F1]",
    requiresCourse: true,
    supportsDateRange: false,
  },
  // Registration
  {
    id: "webinar-registrants",
    category: "registration",
    icon: Radio,
    iconBg: "bg-[#FAF5FF]",
    iconColor: "text-[#A855F7]",
    requiresCourse: false,
    supportsDateRange: false,
  },
  {
    id: "course-catalog",
    category: "registration",
    icon: ClipboardList,
    iconBg: "bg-[#FAF5FF]",
    iconColor: "text-[#A855F7]",
    requiresCourse: false,
    supportsDateRange: false,
  },
  {
    id: "instructor-performance",
    category: "registration",
    icon: TrendingUp,
    iconBg: "bg-[#FCE7F3]",
    iconColor: "text-[#EC4899]",
    requiresCourse: false,
    supportsDateRange: false,
  },
  {
    id: "nelc-compliance",
    category: "registration",
    icon: ShieldCheck,
    iconBg: "bg-[#E0F2FE]",
    iconColor: "text-[#0284C7]",
    requiresCourse: false,
    supportsDateRange: false,
  },
  // Financial
  {
    id: "revenue",
    category: "financial",
    icon: DollarSign,
    iconBg: "bg-[var(--gold-gold-100)]",
    iconColor: "text-[#D4A520]",
    requiresCourse: false,
    supportsDateRange: true,
  },
];

// ─── Export Modal ────────────────────────────────────────────────

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

  const formatOptions: {
    id: ReportFormat;
    label: string;
    icon: React.ElementType;
    desc: string;
  }[] = [
    { id: "pdf", label: "PDF", icon: FileText, desc: t("reportsPage.pdfDesc") },
    {
      id: "xlsx",
      label: "Excel",
      icon: File,
      desc: t("reportsPage.excelDesc"),
    },
    {
      id: "csv",
      label: "CSV",
      icon: FileSpreadsheet,
      desc: t("reportsPage.csvDesc"),
    },
  ];

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
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
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {t("reportsPage.exportReport")}
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {t(`reportsPage.types.${reportType.id}.title`)}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors"
              aria-label={t("reportsPage.close")}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Course Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
              {t("reportsPage.selectCourse")}
              {reportType.requiresCourse && (
                <span className="text-red-500 ms-0.5">*</span>
              )}
            </label>
            <Select
              value={selectedCourse}
              onChange={setSelectedCourse}
              options={[
                {
                  value: "",
                  label: reportType.requiresCourse
                    ? t("reportsPage.chooseCourse")
                    : t("reportsPage.allCourses"),
                },
                ...courses.map((c) => ({ value: c.id, label: c.title })),
              ]}
            />
          </div>

          {/* Date Range */}
          {reportType.supportsDateRange && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                  {t("reportsPage.dateFrom")}
                </label>
                <DatePicker value={dateFrom} onChange={setDateFrom} />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                  {t("reportsPage.dateTo")}
                </label>
                <DatePicker value={dateTo} onChange={setDateTo} />
              </div>
            </div>
          )}

          {/* Format */}
          <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            {t("reportsPage.selectFormat")}
          </p>
          <div className="space-y-2 mb-5">
            {formatOptions.map((fmt) => (
              <button
                key={fmt.id}
                type="button"
                onClick={() => setSelectedFormat(fmt.id)}
                className={`w-full flex items-center gap-4 p-3 border rounded-xl transition-colors ${
                  selectedFormat === fmt.id
                    ? "border-[var(--color-primary)] bg-[var(--color-border-subtle)]"
                    : "border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-border-subtle)]"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    selectedFormat === fmt.id
                      ? "bg-[var(--color-surface-card)]"
                      : "bg-[var(--color-border-subtle)]"
                  }`}
                >
                  <fmt.icon
                    className={`w-4 h-4 ${
                      selectedFormat === fmt.id
                        ? "text-[var(--color-primary)]"
                        : "text-[var(--color-text-secondary)]"
                    }`}
                  />
                </div>
                <div className="flex-1 text-start">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">
                    {fmt.label}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {fmt.desc}
                  </p>
                </div>
                {selectedFormat === fmt.id && (
                  <div className="w-5 h-5 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
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

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors"
            >
              {t("reportsPage.cancel")}
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate || generating}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                canGenerate && !generating
                  ? "btn-gold text-[var(--color-button-text)]"
                  : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] cursor-not-allowed"
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

// ─── Main Component ──────────────────────────────────────────────

const ReportsContent = () => {
  const admin = useAdminProfile();
  const t = useTranslations("adminDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [courses, setCourses] = useState<InstructorCourse[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [courseError, setCourseError] = useState("");

  const [exportModal, setExportModal] = useState<ReportTypeConfig | null>(null);
  const [collapsed, setCollapsed] = useState<Record<CategoryId, boolean>>({
    attendance: false,
    cme: false,
    students: false,
    registration: false,
    financial: false,
  });

  const fetchCourses = useCallback(async () => {
    setLoadingCourses(true);
    setCourseError("");
    try {
      // Admin role has no ownership scope on the backend — this
      // returns all courses across the platform.
      const res = await courseManagerApi.getCourses({ limit: 500 });
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

  const reportsByCategory = useMemo(() => {
    const map: Record<CategoryId, ReportTypeConfig[]> = {
      attendance: [],
      cme: [],
      students: [],
      registration: [],
      financial: [],
    };
    for (const r of REPORT_TYPES) map[r.category].push(r);
    return map;
  }, []);

  const toggleCategory = (id: CategoryId) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

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

            <div className="flex-1 min-w-0 space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                    {t("reportsPage.title")}
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    {t("reportsPage.subtitle")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchCourses}
                  disabled={loadingCourses}
                  className="inline-flex items-center gap-2 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${loadingCourses ? "animate-spin" : ""}`}
                  />
                  {t("reportsPage.refresh")}
                </button>
              </div>

              {/* Helper banner */}
              <div className="bg-[var(--color-border-subtle)] border border-[var(--color-border)] rounded-xl p-4 flex items-start gap-3">
                <FileText className="w-5 h-5 text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
                <div className="text-sm text-[var(--color-text-secondary)] flex-1">
                  <p className="font-medium text-[var(--color-text-primary)] mb-0.5">
                    {t("reportsPage.helperTitle")}
                  </p>
                  <p>{t("reportsPage.helperBody")}</p>
                </div>
              </div>

              {/* Course error */}
              {courseError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700 flex-1">{courseError}</p>
                  <button
                    type="button"
                    onClick={fetchCourses}
                    className="text-sm font-medium text-red-700 hover:text-red-800"
                  >
                    {t("reportsPage.retry")}
                  </button>
                </div>
              )}

              {/* Loading skeletons */}
              {loadingCourses && (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5 animate-pulse"
                    >
                      <div className="h-5 w-40 bg-[var(--color-border)] rounded mb-4" />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[1, 2].map((j) => (
                          <div
                            key={j}
                            className="h-24 bg-[var(--color-border-subtle)] rounded-lg"
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Categories */}
              {!loadingCourses &&
                CATEGORIES.map((cat) => {
                  const reports = reportsByCategory[cat.id];
                  const CatIcon = cat.icon;
                  const isCollapsed = collapsed[cat.id];
                  return (
                    <section
                      key={cat.id}
                      className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => toggleCategory(cat.id)}
                        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-[var(--color-border-subtle)] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                              backgroundColor: `${cat.accentColor}20`,
                            }}
                          >
                            <CatIcon
                              className="w-5 h-5"
                              style={{ color: cat.accentColor }}
                            />
                          </div>
                          <div className="text-start">
                            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                              {t(`reportsPage.categories.${cat.id}.title`)}
                            </h2>
                            <p className="text-xs text-[var(--color-text-secondary)]">
                              {t(`reportsPage.categories.${cat.id}.description`)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-[var(--color-text-secondary)] hidden sm:inline">
                            {reports.length} {t("reportsPage.reportsCount")}
                          </span>
                          <ChevronDown
                            className={`w-5 h-5 text-[var(--color-text-secondary)] transition-transform ${
                              isCollapsed ? "" : "rotate-180"
                            }`}
                          />
                        </div>
                      </button>

                      {!isCollapsed && (
                        <div className="border-t border-[var(--color-border)] p-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {reports.map((rt) => (
                              <div
                                key={rt.id}
                                className="border border-[var(--color-border)] rounded-xl p-4 hover:shadow-sm transition-shadow"
                              >
                                <div className="flex items-start gap-3 mb-3">
                                  <div
                                    className={`w-10 h-10 rounded-lg ${rt.iconBg} flex items-center justify-center flex-shrink-0`}
                                  >
                                    <rt.icon
                                      className={`w-5 h-5 ${rt.iconColor}`}
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-0.5">
                                      {t(`reportsPage.types.${rt.id}.title`)}
                                    </h3>
                                    <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">
                                      {t(`reportsPage.types.${rt.id}.desc`)}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-1.5 mb-3">
                                  {rt.requiresCourse && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FEF3C7] text-[#92400E] rounded text-[10px] font-medium">
                                      {t("reportsPage.courseRequired")}
                                    </span>
                                  )}
                                  {rt.supportsDateRange && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#E0F2FE] text-[#1D4ED8] rounded text-[10px] font-medium">
                                      {t("reportsPage.dateRangeSupported")}
                                    </span>
                                  )}
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] rounded text-[10px] font-medium">
                                    PDF · Excel · CSV
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setExportModal(rt)}
                                  className="w-full flex items-center justify-center gap-2 px-3 py-2 btn-gold text-[var(--color-button-text)] rounded-lg text-sm font-medium transition-colors"
                                >
                                  <Download className="w-4 h-4" />
                                  {t("reportsPage.exportReport")}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </section>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

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
