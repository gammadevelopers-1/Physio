"use client";

import { useState, useMemo, useEffect, useCallback, Fragment } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  ShieldCheck,
  Search,
  Loader2,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
  Video,
  Monitor,
  BookOpen,
  Eye,
  FileText,
  Shield,
  Lock,
  GraduationCap,
} from "lucide-react";
import SkeletonCard from "@/components/shared/SkeletonCard";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import { useManagerProfile } from "@/hooks/useManagerProfile";
import { useNELCCompliance } from "@/hooks/useNELCCompliance";
import { nelcComplianceApi } from "@/lib/api";
import ExportButton from "@/components/shared/ExportButton";

interface VirtualClassSession {
  sessionId: string;
  sessionTitle: string;
  courseTitle: string;
  instructorName: string;
  type: string;
  scheduledAt: string | null;
  durationMinutes: number;
  status: string;
  hasZoomLink: boolean;
  hasRecording: boolean;
  overallStatus: "passed" | "review" | "failed";
  checks: Array<{ rule: string; status: "passed" | "review" | "failed"; detail: string }>;
}

const STATUS_CONFIG = {
  passed: { labelKey: "nelc.passed" as const, bg: "bg-[#D1FAE5]", text: "text-[#065F46]", icon: CheckCircle2 },
  review: { labelKey: "nelc.review" as const, bg: "bg-[#FEF3C7]", text: "text-[#92400E]", icon: AlertCircle },
  failed: { labelKey: "nelc.failed" as const, bg: "bg-[#FEE2E2]", text: "text-[#991B1B]", icon: XCircle },
};

const CATEGORY_ICONS: Record<string, typeof BookOpen> = {
  course_structure: BookOpen,
  accessibility: Eye,
  virtual_classes: Video,
  assessment_quality: FileText,
  policies: Shield,
  data_protection: Lock,
  instructor_qualifications: GraduationCap,
};

interface ScorecardCategory {
  category: string;
  label: string;
  icon: string;
  status: "passed" | "review" | "failed";
  checks: Array<{ rule: string; status: "passed" | "review" | "failed"; detail: string }>;
}

interface CourseScorecard {
  courseId: string;
  overallStatus: "passed" | "review" | "failed";
  overallScore: number;
  categories: ScorecardCategory[];
}

const NELCComplianceCenterContent = () => {
  const t = useTranslations("courseManagerDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const manager = useManagerProfile();
  const { courses, totals, overallPercentage, loading, error, refetch } = useNELCCompliance();

  const [activeTab, setActiveTab] = useState<"courses" | "virtualClasses">("courses");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "passed" | "review" | "failed">("all");
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [scorecards, setScorecards] = useState<Record<string, CourseScorecard>>({});
  const [scorecardLoading, setScorecardLoading] = useState<Record<string, boolean>>({});
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const fetchScorecard = useCallback(async (courseId: string) => {
    if (scorecards[courseId]) return;
    setScorecardLoading((prev) => ({ ...prev, [courseId]: true }));
    try {
      const result = await nelcComplianceApi.getCourseScorecard(courseId);
      setScorecards((prev) => ({ ...prev, [courseId]: result }));
    } catch {
      // silently fail
    } finally {
      setScorecardLoading((prev) => ({ ...prev, [courseId]: false }));
    }
  }, [scorecards]);

  // Virtual Classes state
  const [virtualClasses, setVirtualClasses] = useState<VirtualClassSession[]>([]);
  const [vcLoading, setVcLoading] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === "virtualClasses" && virtualClasses.length === 0 && !vcLoading) {
      setVcLoading(true);
      nelcComplianceApi.getVirtualClassCompliance()
        .then(setVirtualClasses)
        .catch(() => {})
        .finally(() => setVcLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleDownloadEvidence = async (courseId: string) => {
    setDownloadingId(courseId);
    try {
      await nelcComplianceApi.downloadEvidence(courseId);
    } catch {
      // silently fail — user sees the button stop loading
    } finally {
      setDownloadingId(null);
    }
  };

  const filtered = useMemo(() => {
    let result = courses;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.courseTitle.toLowerCase().includes(q) ||
          c.instructorName.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      result = result.filter((c) => c.overallStatus === statusFilter);
    }
    return result;
  }, [courses, search, statusFilter]);

  const filteredVc = useMemo(() => {
    let result = virtualClasses;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.sessionTitle.toLowerCase().includes(q) ||
          s.courseTitle.toLowerCase().includes(q) ||
          s.instructorName.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      result = result.filter((s) => s.overallStatus === statusFilter);
    }
    return result;
  }, [virtualClasses, search, statusFilter]);

  if (loading) {
    return (
      <>
        <CourseManagerNavbar manager={manager} />
        <div className="bg-[#F9FAFB] min-h-screen">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="hidden lg:block lg:flex-shrink-0">
                <CourseManagerSidebar manager={manager} />
              </div>
              <CourseManagerMobileSidebar manager={manager} />
              <div className="flex-1 min-w-0">
                <div className="mb-6">
                  <div className="h-7 bg-[#E5E7EB] rounded w-56 animate-pulse mb-2" />
                  <div className="h-4 bg-[#E5E7EB] rounded w-80 animate-pulse" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <CourseManagerNavbar manager={manager} />
        <div className="bg-[#F9FAFB] min-h-screen flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="w-8 h-8 text-[#EF4444] mx-auto mb-3" />
            <p className="text-sm text-[#6B7280] mb-4">{error}</p>
            <button
              onClick={refetch}
              className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-white text-sm font-medium rounded-lg"
            >
              <RefreshCw className="w-4 h-4" />
              {t("dashboard.retry")}
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <CourseManagerNavbar manager={manager} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <CourseManagerSidebar manager={manager} />
            </div>
            <CourseManagerMobileSidebar manager={manager} />

            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-[#1F2937]">{t("nelc.title")}</h1>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {t("nelc.subtitle")}
                  </p>
                </div>
                <ExportButton tableType="nelc-courses" />
              </div>

              {/* Summary Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 text-center">
                  <p className="text-3xl font-bold text-[#3B82F6]">{overallPercentage}%</p>
                  <p className="text-xs text-[#6B7280] mt-1">{t("nelc.overallCompliance")}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 text-center">
                  <p className="text-3xl font-bold text-[#22C55E]">{totals.passed}</p>
                  <p className="text-xs text-[#6B7280] mt-1">{t("nelc.passed")}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 text-center">
                  <p className="text-3xl font-bold text-[#F59E0B]">{totals.review}</p>
                  <p className="text-xs text-[#6B7280] mt-1">{t("nelc.review")}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 text-center">
                  <p className="text-3xl font-bold text-[#EF4444]">{totals.failed}</p>
                  <p className="text-xs text-[#6B7280] mt-1">{t("nelc.failed")}</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mb-6 bg-white rounded-xl border border-[#E5E7EB] p-1">
                <button
                  onClick={() => setActiveTab("courses")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === "courses"
                      ? "bg-[#3B82F6] text-white"
                      : "text-[#6B7280] hover:bg-[#F3F4F6]"
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  {t("nelc.coursesTab")}
                </button>
                <button
                  onClick={() => setActiveTab("virtualClasses")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === "virtualClasses"
                      ? "bg-[#3B82F6] text-white"
                      : "text-[#6B7280] hover:bg-[#F3F4F6]"
                  }`}
                >
                  <Video className="w-4 h-4" />
                  {t("nelc.virtualClassesTab")}
                </button>
              </div>

              {/* Search + Filter */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                  <Search className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]`} />
                  <input
                    type="text"
                    placeholder={t("catalog.searchPlaceholder")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className={`w-full ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} py-2.5 bg-white border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none`}
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                  className="px-4 py-2.5 bg-white border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none"
                >
                  <option value="all">{t("catalog.allStatus")}</option>
                  <option value="passed">{t("nelc.passed")}</option>
                  <option value="review">{t("nelc.review")}</option>
                  <option value="failed">{t("nelc.failed")}</option>
                </select>
              </div>

              {/* Courses Tab Content */}
              {activeTab === "courses" && (
              <>
              {filtered.length === 0 ? (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
                  <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck className="w-8 h-8 text-[#9CA3AF]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#1F2937] mb-2">{t("nelc.noCourses")}</h3>
                  <p className="text-sm text-[#6B7280]">
                    {courses.length === 0
                      ? t("nelc.noCoursesDesc")
                      : t("nelc.adjustFilter")}
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                          <th className="px-4 py-3 text-start text-xs font-semibold text-[#6B7280] uppercase">
                            {t("nelc.vcCourse")}
                          </th>
                          <th className="px-4 py-3 text-start text-xs font-semibold text-[#6B7280] uppercase hidden md:table-cell">
                            {t("nelc.vcInstructor")}
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-[#6B7280] uppercase">
                            {t("nelc.vcStatus")}
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-[#6B7280] uppercase hidden sm:table-cell">
                            {t("nelc.vcSession")}
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-[#6B7280] uppercase w-10">
                            &nbsp;
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E7EB]">
                        {filtered.map((course) => {
                          const config = STATUS_CONFIG[course.overallStatus];
                          const StatusIcon = config.icon;
                          const isExpanded = expandedCourse === course.courseId;

                          return (
                            <Fragment key={course.courseId}>
                              <tr
                                className="hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                                onClick={() => {
                                  const next = isExpanded ? null : course.courseId;
                                  setExpandedCourse(next);
                                  setExpandedCategory(null);
                                  if (next) fetchScorecard(next);
                                }}
                              >
                                <td className="px-4 py-3">
                                  <p className="text-sm font-medium text-[#1F2937]">
                                    {course.courseTitle}
                                  </p>
                                </td>
                                <td className="px-4 py-3 hidden md:table-cell">
                                  <p className="text-sm text-[#4B5563]">{course.instructorName}</p>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
                                  >
                                    <StatusIcon className="w-3 h-3" />
                                    {t(config.labelKey)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center hidden sm:table-cell">
                                  <div className="flex items-center justify-center gap-2 text-xs">
                                    <span className="text-[#22C55E] font-medium">
                                      {course.summary.passed}
                                    </span>
                                    /
                                    <span className="text-[#F59E0B] font-medium">
                                      {course.summary.review}
                                    </span>
                                    /
                                    <span className="text-[#EF4444] font-medium">
                                      {course.summary.failed}
                                    </span>
                                    <span className="text-[#9CA3AF]">
                                      ({course.summary.total})
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-[#6B7280]" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-[#6B7280]" />
                                  )}
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr>
                                  <td colSpan={5} className="px-4 py-4 bg-[#F9FAFB]">
                                    {scorecardLoading[course.courseId] ? (
                                      <div className="flex items-center gap-2 py-6 justify-center">
                                        <Loader2 className="w-4 h-4 text-[#3B82F6] animate-spin" />
                                        <span className="text-sm text-[#6B7280]">{t("nelc.loadingScorecard")}</span>
                                      </div>
                                    ) : scorecards[course.courseId] ? (
                                      <>
                                        {/* Score summary */}
                                        <div className="flex items-center gap-3 mb-4">
                                          <div className="text-2xl font-bold text-[#3B82F6]">
                                            {scorecards[course.courseId].overallScore}%
                                          </div>
                                          <span className="text-sm text-[#6B7280]">{t("nelc.overallScore")}</span>
                                        </div>

                                        {/* 7 Category Cards */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-4 items-start">
                                          {scorecards[course.courseId].categories.map((cat) => {
                                            const catConfig = STATUS_CONFIG[cat.status];
                                            const CatStatusIcon = catConfig.icon;
                                            const CatIcon = CATEGORY_ICONS[cat.category] || ShieldCheck;
                                            const isCatExpanded = expandedCategory === `${course.courseId}-${cat.category}`;

                                            return (
                                              <div
                                                key={cat.category}
                                                className="bg-white rounded-lg border border-[#E5E7EB] overflow-hidden cursor-pointer hover:shadow-sm transition-shadow"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setExpandedCategory(
                                                    isCatExpanded ? null : `${course.courseId}-${cat.category}`
                                                  );
                                                }}
                                              >
                                                <div className="p-3 flex items-center gap-3">
                                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${catConfig.bg}`}>
                                                    <CatIcon className={`w-4 h-4 ${catConfig.text}`} />
                                                  </div>
                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold text-[#1F2937] truncate">
                                                      {cat.label}
                                                    </p>
                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${catConfig.text}`}>
                                                      <CatStatusIcon className="w-3 h-3" />
                                                      {t(catConfig.labelKey)}
                                                    </span>
                                                  </div>
                                                  {isCatExpanded ? (
                                                    <ChevronUp className="w-3.5 h-3.5 text-[#9CA3AF]" />
                                                  ) : (
                                                    <ChevronDown className="w-3.5 h-3.5 text-[#9CA3AF]" />
                                                  )}
                                                </div>

                                                {isCatExpanded && (
                                                  <div className="border-t border-[#E5E7EB] p-3 space-y-1.5">
                                                    {cat.checks.map((check) => {
                                                      const chkConfig = STATUS_CONFIG[check.status];
                                                      const ChkIcon = chkConfig.icon;
                                                      return (
                                                        <div key={check.rule} className="flex items-start gap-2">
                                                          <ChkIcon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${chkConfig.text}`} />
                                                          <div className="min-w-0">
                                                            <p className="text-xs font-medium text-[#1F2937] capitalize">
                                                              {check.rule.replace(/_/g, " ")}
                                                            </p>
                                                            <p className="text-[10px] text-[#6B7280]">{check.detail}</p>
                                                          </div>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </>
                                    ) : (
                                      <p className="text-sm text-[#9CA3AF] py-4 text-center">{t("nelc.scorecardUnavailable")}</p>
                                    )}

                                    {/* Export Evidence button */}
                                    <div className="flex justify-end items-center gap-3">
                                      <span className="text-xs text-[#9CA3AF]" title={t("nelc.bundleContents")}>
                                        {t("nelc.bundleContentsShort")}
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDownloadEvidence(course.courseId);
                                        }}
                                        disabled={downloadingId === course.courseId}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] disabled:bg-[#93C5FD] text-white text-sm font-medium rounded-lg transition-colors"
                                        title={t("nelc.bundleContents")}
                                      >
                                        {downloadingId === course.courseId ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <Download className="w-4 h-4" />
                                        )}
                                        {t("nelc.exportEvidence")}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              </>
              )}

              {/* Virtual Classes Tab Content */}
              {activeTab === "virtualClasses" && (
                <>
                  {vcLoading ? (
                    <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
                      <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin mx-auto mb-3" />
                      <p className="text-sm text-[#6B7280]">{t("dashboard.loading")}</p>
                    </div>
                  ) : filteredVc.length === 0 ? (
                    <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
                      <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mx-auto mb-4">
                        <Video className="w-8 h-8 text-[#9CA3AF]" />
                      </div>
                      <h3 className="text-lg font-semibold text-[#1F2937] mb-2">
                        {t("nelc.noVirtualClasses")}
                      </h3>
                      <p className="text-sm text-[#6B7280]">
                        {virtualClasses.length === 0
                          ? t("nelc.noVirtualClassesDesc")
                          : t("nelc.adjustFilter")}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]">
                              <th className="px-4 py-3 text-start text-xs font-semibold text-[#6B7280] uppercase">
                                {t("nelc.vcSession")}
                              </th>
                              <th className="px-4 py-3 text-start text-xs font-semibold text-[#6B7280] uppercase hidden md:table-cell">
                                {t("nelc.vcCourse")}
                              </th>
                              <th className="px-4 py-3 text-start text-xs font-semibold text-[#6B7280] uppercase hidden lg:table-cell">
                                {t("nelc.vcInstructor")}
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-semibold text-[#6B7280] uppercase">
                                {t("nelc.vcType")}
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-semibold text-[#6B7280] uppercase hidden sm:table-cell">
                                {t("nelc.vcZoom")}
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-semibold text-[#6B7280] uppercase">
                                {t("nelc.vcStatus")}
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-semibold text-[#6B7280] uppercase w-10">
                                &nbsp;
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E5E7EB]">
                            {filteredVc.map((vc) => {
                              const config = STATUS_CONFIG[vc.overallStatus];
                              const StatusIcon = config.icon;
                              const isExpanded = expandedSession === vc.sessionId;

                              return (
                                <Fragment key={vc.sessionId}>
                                  <tr
                                    className="hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                                    onClick={() =>
                                      setExpandedSession(isExpanded ? null : vc.sessionId)
                                    }
                                  >
                                    <td className="px-4 py-3">
                                      <p className="text-sm font-medium text-[#1F2937]">{vc.sessionTitle}</p>
                                      <p className="text-xs text-[#6B7280]">
                                        {vc.scheduledAt
                                          ? new Date(vc.scheduledAt).toLocaleDateString()
                                          : "—"}{" "}
                                        · {vc.durationMinutes}min
                                      </p>
                                    </td>
                                    <td className="px-4 py-3 hidden md:table-cell">
                                      <p className="text-sm text-[#4B5563]">{vc.courseTitle}</p>
                                    </td>
                                    <td className="px-4 py-3 hidden lg:table-cell">
                                      <p className="text-sm text-[#4B5563]">{vc.instructorName}</p>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#4B5563]">
                                        {vc.type === "zoom" ? (
                                          <Video className="w-3.5 h-3.5 text-[#2D8CFF]" />
                                        ) : (
                                          <Monitor className="w-3.5 h-3.5 text-[#8B5CF6]" />
                                        )}
                                        {vc.type === "zoom" ? "Zoom" : "Hybrid"}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                                      <div className="flex items-center justify-center gap-2">
                                        <span
                                          className={`inline-flex items-center gap-1 text-xs ${
                                            vc.hasZoomLink ? "text-[#22C55E]" : "text-[#EF4444]"
                                          }`}
                                        >
                                          {vc.hasZoomLink ? (
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                          ) : (
                                            <XCircle className="w-3.5 h-3.5" />
                                          )}
                                          {t("nelc.vcLink")}
                                        </span>
                                        <span
                                          className={`inline-flex items-center gap-1 text-xs ${
                                            vc.hasRecording ? "text-[#22C55E]" : "text-[#9CA3AF]"
                                          }`}
                                        >
                                          {vc.hasRecording ? (
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                          ) : (
                                            <AlertCircle className="w-3.5 h-3.5" />
                                          )}
                                          {t("nelc.vcRecording")}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
                                      >
                                        <StatusIcon className="w-3 h-3" />
                                        {t(config.labelKey)}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      {isExpanded ? (
                                        <ChevronUp className="w-4 h-4 text-[#6B7280]" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4 text-[#6B7280]" />
                                      )}
                                    </td>
                                  </tr>
                                  {isExpanded && (
                                    <tr>
                                      <td colSpan={7} className="px-4 py-3 bg-[#F9FAFB]">
                                        <h4 className="text-sm font-semibold text-[#1F2937] mb-3">
                                          {t("nelc.vcComplianceChecks")}
                                        </h4>
                                        <div className="space-y-2">
                                          {vc.checks.map((check, idx) => {
                                            const checkConfig = STATUS_CONFIG[check.status];
                                            const CheckIcon = checkConfig.icon;
                                            return (
                                              <div
                                                key={idx}
                                                className="flex items-start gap-3 p-2.5 bg-white rounded-lg border border-[#E5E7EB]"
                                              >
                                                <CheckIcon
                                                  className={`w-4 h-4 mt-0.5 flex-shrink-0 ${checkConfig.text}`}
                                                />
                                                <div>
                                                  <p className="text-sm font-medium text-[#1F2937] capitalize">
                                                    {check.rule.replace(/_/g, " ")}
                                                  </p>
                                                  <p className="text-xs text-[#6B7280]">{check.detail}</p>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default NELCComplianceCenterContent;
