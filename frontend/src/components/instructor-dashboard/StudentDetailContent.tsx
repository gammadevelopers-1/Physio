"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import InstructorNavbar from "./InstructorNavbar";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import { useInstructorProfile } from "@/hooks/useInstructorProfile";
import { instructorApi } from "@/lib/api";
import type {
  StudentDetailResponse,
  AtRiskStudent,
} from "@/types/instructor-dashboard";
import {
  ArrowLeft,
  ArrowRight,
  Mail,
  Calendar,
  Clock,
  BookOpen,
  CheckCircle,
  AlertTriangle,
  UserX,
  FileText,
  ChevronRight,
  RefreshCw,
  TrendingUp,
  Award,
} from "lucide-react";

interface StudentDetailContentProps {
  studentId: string;
}

type RiskStatus = "good" | "at-risk" | "inactive";

const StudentDetailContent = ({ studentId }: StudentDetailContentProps) => {
  const instructor = useInstructorProfile();
  const t = useTranslations("instructorDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [activeTab, setActiveTab] = useState<
    "overview" | "attendance" | "assessments" | "activity"
  >("overview");

  const [student, setStudent] = useState<StudentDetailResponse | null>(null);
  const [riskStatus, setRiskStatus] = useState<RiskStatus>("good");
  const [riskReasons, setRiskReasons] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detail, atRiskData] = await Promise.all([
        instructorApi.getStudentDetail(studentId),
        instructorApi.getAtRiskStudents(),
      ]);

      setStudent(detail as StudentDetailResponse);

      // Determine risk status
      const atRiskEntry = (atRiskData as AtRiskStudent[]).find(
        (s) => s.id === studentId
      );
      if (atRiskEntry) {
        setRiskReasons(atRiskEntry.riskReasons);
        const hasInactivity = atRiskEntry.riskReasons.some(
          (r) =>
            r.includes("No recent activity") || r.includes("Last activity on")
        );
        const hasLowAttendance = atRiskEntry.riskReasons.some((r) =>
          r.includes("Attendance rate")
        );
        if (hasInactivity && !hasLowAttendance) {
          setRiskStatus("inactive");
        } else {
          setRiskStatus("at-risk");
        }
      } else {
        setRiskStatus("good");
        setRiskReasons([]);
      }
    } catch {
      setError("Failed to load student details");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived stats
  const stats = useMemo(() => {
    if (!student) return null;
    const totalCourses = student.enrollments.length;
    const completedCourses = student.enrollments.filter(
      (e) => e.status === "completed"
    ).length;
    const avgProgress =
      totalCourses > 0
        ? Math.round(
            student.enrollments.reduce((sum, e) => sum + e.progress, 0) /
              totalCourses
          )
        : 0;
    return {
      totalCourses,
      completedCourses,
      avgAttendance: student.attendanceSummary.attendanceRate,
      avgScore:
        student.assessmentScores.length > 0
          ? Math.round(
              student.assessmentScores.reduce(
                (sum, a) =>
                  sum + (a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0),
                0
              ) / student.assessmentScores.length
            )
          : 0,
      avgProgress,
    };
  }, [student]);

  // Last active
  const lastActive = useMemo(() => {
    if (!student) return null;
    const dates = student.enrollments
      .map((e) => e.lastAccessedAt)
      .filter(Boolean) as string[];
    if (dates.length === 0) return null;
    return dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  }, [student]);

  // Earliest enrollment
  const enrolledSince = useMemo(() => {
    if (!student) return null;
    const dates = student.enrollments.map((e) => e.enrolledAt);
    if (dates.length === 0) return null;
    return dates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];
  }, [student]);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "good":
        return "bg-[#DCFCE7] text-[#22C55E]";
      case "at-risk":
        return "bg-[#FEF9C3] text-[#EAB308]";
      case "inactive":
        return "bg-[#FEE2E2] text-[#EF4444]";
      default:
        return "bg-[#F3F4F6] text-[#6B7280]";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "good":
        return <CheckCircle className="w-3 h-3" />;
      case "at-risk":
        return <AlertTriangle className="w-3 h-3" />;
      case "inactive":
        return <UserX className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "good":
        return t("students.statusGood");
      case "at-risk":
        return t("students.statusAtRisk");
      case "inactive":
        return t("students.statusInactive");
      default:
        return status;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString(
      locale === "ar" ? "ar-SA" : "en-US",
      { month: "short", day: "numeric", year: "numeric" }
    );
  };

  const formatLastActive = (dateStr: string | null) => {
    if (!dateStr) return t("students.never") || "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateStr);
  };

  const getInitials = (firstName: string | null, lastName: string | null) => {
    const f = firstName?.charAt(0)?.toUpperCase() || "";
    const l = lastName?.charAt(0)?.toUpperCase() || "";
    return f + l || "?";
  };

  const tabs = [
    { id: "overview" as const, label: t("studentDetail.tabOverview") },
    { id: "attendance" as const, label: t("studentDetail.tabAttendance") },
    { id: "assessments" as const, label: t("studentDetail.tabAssessments") },
    { id: "activity" as const, label: t("studentDetail.tabActivity") },
  ];

  return (
    <>
      <InstructorNavbar instructor={instructor} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <InstructorSidebar instructor={instructor} />
            </div>
            <InstructorMobileSidebar instructor={instructor} />

            <div className="flex-1 min-w-0 space-y-6">
              {/* Back Button */}
              <Link
                href={`/${locale}/dashboard/instructor/students`}
                className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#374151] transition-colors"
              >
                {isRTL ? (
                  <ArrowRight className="w-4 h-4" />
                ) : (
                  <ArrowLeft className="w-4 h-4" />
                )}
                {t("studentDetail.backToStudents")}
              </Link>

              {/* Loading */}
              {loading && (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="w-6 h-6 text-[#3B82F6] animate-spin" />
                  <span className="ml-3 text-sm text-[#6B7280]">
                    {t("studentDetail.loading") || "Loading student details..."}
                  </span>
                </div>
              )}

              {/* Error */}
              {error && !loading && (
                <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-xl p-6 text-center">
                  <p className="text-[#DC2626] font-medium mb-3">{error}</p>
                  <button
                    onClick={fetchData}
                    className="px-4 py-2 bg-[#DC2626] text-white rounded-lg text-sm hover:bg-[#B91C1C] transition-colors"
                  >
                    {t("studentDetail.retry") || "Retry"}
                  </button>
                </div>
              )}

              {!loading && !error && student && (
                <>
                  {/* Student Header Card */}
                  <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-full bg-[#E5E7EB] flex items-center justify-center text-xl font-bold text-[#4B5563]">
                          {getInitials(student.firstName, student.lastName)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-xl md:text-2xl font-bold text-[#1F2937]">
                              {student.firstName || ""} {student.lastName || ""}
                            </h1>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(riskStatus)}`}
                            >
                              {getStatusIcon(riskStatus)}
                              {getStatusLabel(riskStatus)}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#6B7280]">
                            <span className="flex items-center gap-1">
                              <Mail className="w-4 h-4" />
                              {student.email}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-xs text-[#9CA3AF]">
                            {enrolledSince && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {t("studentDetail.enrolled")}:{" "}
                                {formatDate(enrolledSince)}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {t("studentDetail.lastActive")}:{" "}
                              {formatLastActive(lastActive)}
                            </span>
                          </div>

                          {/* Risk reasons */}
                          {riskReasons.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {riskReasons.map((reason, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-[#FEF9C3] text-[#92400E] rounded-md text-xs"
                                >
                                  <AlertTriangle className="w-3 h-3" />
                                  {reason}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stats Cards */}
                  {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 text-center">
                        <div className="w-10 h-10 mx-auto rounded-lg bg-[#DBEAFE] flex items-center justify-center mb-2">
                          <BookOpen className="w-5 h-5 text-[#3B82F6]" />
                        </div>
                        <p className="text-2xl font-bold text-[#1F2937]">
                          {stats.totalCourses}
                        </p>
                        <p className="text-xs text-[#6B7280]">
                          {t("studentDetail.totalCourses")}
                        </p>
                      </div>
                      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 text-center">
                        <div className="w-10 h-10 mx-auto rounded-lg bg-[#DCFCE7] flex items-center justify-center mb-2">
                          <CheckCircle className="w-5 h-5 text-[#22C55E]" />
                        </div>
                        <p className="text-2xl font-bold text-[#1F2937]">
                          {stats.completedCourses}
                        </p>
                        <p className="text-xs text-[#6B7280]">
                          {t("studentDetail.completed")}
                        </p>
                      </div>
                      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 text-center">
                        <div className="w-10 h-10 mx-auto rounded-lg bg-[#FEF9C3] flex items-center justify-center mb-2">
                          <TrendingUp className="w-5 h-5 text-[#EAB308]" />
                        </div>
                        <p className="text-2xl font-bold text-[#1F2937]">
                          {stats.avgAttendance}%
                        </p>
                        <p className="text-xs text-[#6B7280]">
                          {t("studentDetail.avgAttendance")}
                        </p>
                      </div>
                      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 text-center">
                        <div className="w-10 h-10 mx-auto rounded-lg bg-[#E0E7FF] flex items-center justify-center mb-2">
                          <FileText className="w-5 h-5 text-[#6366F1]" />
                        </div>
                        <p className="text-2xl font-bold text-[#1F2937]">
                          {stats.avgScore > 0 ? `${stats.avgScore}%` : "-"}
                        </p>
                        <p className="text-xs text-[#6B7280]">
                          {t("studentDetail.avgScore")}
                        </p>
                      </div>
                      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 text-center">
                        <div className="w-10 h-10 mx-auto rounded-lg bg-[#FEF3C7] flex items-center justify-center mb-2">
                          <Award className="w-5 h-5 text-[#D4A520]" />
                        </div>
                        <p className="text-2xl font-bold text-[#1F2937]">
                          {stats.avgProgress}%
                        </p>
                        <p className="text-xs text-[#6B7280]">
                          {t("studentDetail.avgProgress") || "Avg. Progress"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Tabs */}
                  <div className="bg-white rounded-xl border border-[#E5E7EB]">
                    <div className="flex border-b border-[#E5E7EB] overflow-x-auto">
                      {tabs.map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`px-5 py-3 text-sm font-medium relative transition-colors whitespace-nowrap ${
                            activeTab === tab.id
                              ? "text-[#3B82F6]"
                              : "text-[#6B7280] hover:text-[#374151]"
                          }`}
                        >
                          {tab.label}
                          {activeTab === tab.id && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3B82F6] rounded-t" />
                          )}
                        </button>
                      ))}
                    </div>

                    <div className="p-5">
                      {/* Overview Tab */}
                      {activeTab === "overview" && (
                        <div className="space-y-6">
                          <h3 className="text-base font-semibold text-[#1F2937]">
                            {t("studentDetail.enrolledCourses")}
                          </h3>

                          {student.enrollments.length === 0 ? (
                            <div className="text-center py-8">
                              <BookOpen className="w-10 h-10 text-[#D1D5DB] mx-auto mb-3" />
                              <p className="text-sm text-[#6B7280]">
                                {t("studentDetail.noEnrollments") ||
                                  "No course enrollments found."}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {student.enrollments.map((enrollment) => (
                                <div
                                  key={enrollment.id}
                                  className="p-4 border border-[#E5E7EB] rounded-xl hover:bg-[#F9FAFB] transition-colors"
                                >
                                  <div className="flex items-start justify-between mb-3">
                                    <div>
                                      <h4 className="text-sm font-semibold text-[#1F2937]">
                                        {locale === "ar" && enrollment.courseTitleAr
                                          ? enrollment.courseTitleAr
                                          : enrollment.courseTitle}
                                      </h4>
                                      <span
                                        className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                          enrollment.status === "completed"
                                            ? "bg-[#DCFCE7] text-[#22C55E]"
                                            : enrollment.status === "active"
                                              ? "bg-[#DBEAFE] text-[#3B82F6]"
                                              : "bg-[#F3F4F6] text-[#6B7280]"
                                        }`}
                                      >
                                        {enrollment.status === "completed"
                                          ? t("studentDetail.courseCompleted")
                                          : enrollment.status === "active"
                                            ? t("studentDetail.courseInProgress")
                                            : enrollment.status}
                                      </span>
                                    </div>
                                    <Link
                                      href={`/${locale}/dashboard/instructor/courses/${enrollment.courseId}`}
                                      className="text-[#3B82F6] hover:underline text-sm font-medium flex items-center gap-1"
                                    >
                                      {t("studentDetail.viewCourse")}
                                      <ChevronRight className="w-4 h-4" />
                                    </Link>
                                  </div>

                                  {/* Progress Bar */}
                                  <div className="mb-3">
                                    <div className="flex justify-between text-xs text-[#6B7280] mb-1">
                                      <span>{t("studentDetail.progress")}</span>
                                      <span>{enrollment.progress}%</span>
                                    </div>
                                    <div className="h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all ${
                                          enrollment.progress >= 80
                                            ? "bg-[#22C55E]"
                                            : enrollment.progress >= 50
                                              ? "bg-[#3B82F6]"
                                              : "bg-[#EAB308]"
                                        }`}
                                        style={{
                                          width: `${enrollment.progress}%`,
                                        }}
                                      />
                                    </div>
                                  </div>

                                  {/* Enrollment dates */}
                                  <div className="flex flex-wrap gap-4 text-xs text-[#6B7280]">
                                    <span>
                                      {t("studentDetail.enrolled")}:{" "}
                                      {formatDate(enrollment.enrolledAt)}
                                    </span>
                                    {enrollment.completedAt && (
                                      <span>
                                        {t("studentDetail.courseCompleted")}:{" "}
                                        {formatDate(enrollment.completedAt)}
                                      </span>
                                    )}
                                    {enrollment.lastAccessedAt && (
                                      <span>
                                        {t("studentDetail.lastActive")}:{" "}
                                        {formatLastActive(
                                          enrollment.lastAccessedAt
                                        )}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Attendance Tab */}
                      {activeTab === "attendance" && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-[#1F2937]">
                              {t("studentDetail.attendanceHistory")}
                            </h3>
                          </div>

                          {/* Attendance Summary Cards */}
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <div className="bg-[#F9FAFB] rounded-lg p-3 text-center">
                              <p className="text-lg font-bold text-[#1F2937]">
                                {student.attendanceSummary.totalSessions}
                              </p>
                              <p className="text-xs text-[#6B7280]">
                                {t("studentDetail.totalSessions") ||
                                  "Total Sessions"}
                              </p>
                            </div>
                            <div className="bg-[#DCFCE7] rounded-lg p-3 text-center">
                              <p className="text-lg font-bold text-[#22C55E]">
                                {student.attendanceSummary.present}
                              </p>
                              <p className="text-xs text-[#166534]">
                                {t("studentDetail.present")}
                              </p>
                            </div>
                            <div className="bg-[#FEE2E2] rounded-lg p-3 text-center">
                              <p className="text-lg font-bold text-[#EF4444]">
                                {student.attendanceSummary.absent}
                              </p>
                              <p className="text-xs text-[#991B1B]">
                                {t("studentDetail.absent")}
                              </p>
                            </div>
                            <div className="bg-[#FEF9C3] rounded-lg p-3 text-center">
                              <p className="text-lg font-bold text-[#EAB308]">
                                {student.attendanceSummary.late}
                              </p>
                              <p className="text-xs text-[#854D0E]">
                                {t("studentDetail.late") || "Late"}
                              </p>
                            </div>
                            <div className="bg-[#F3F4F6] rounded-lg p-3 text-center">
                              <p className="text-lg font-bold text-[#6B7280]">
                                {student.attendanceSummary.excused}
                              </p>
                              <p className="text-xs text-[#4B5563]">
                                {t("studentDetail.excused") || "Excused"}
                              </p>
                            </div>
                          </div>

                          {/* Attendance Rate Bar */}
                          <div className="bg-[#F9FAFB] rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-[#374151]">
                                {t("studentDetail.attendanceRate") ||
                                  "Attendance Rate"}
                              </span>
                              <span
                                className={`text-lg font-bold ${
                                  student.attendanceSummary.attendanceRate >= 80
                                    ? "text-[#22C55E]"
                                    : student.attendanceSummary.attendanceRate >=
                                        60
                                      ? "text-[#EAB308]"
                                      : "text-[#EF4444]"
                                }`}
                              >
                                {student.attendanceSummary.attendanceRate}%
                              </span>
                            </div>
                            <div className="h-3 bg-[#E5E7EB] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  student.attendanceSummary.attendanceRate >= 80
                                    ? "bg-[#22C55E]"
                                    : student.attendanceSummary.attendanceRate >=
                                        60
                                      ? "bg-[#EAB308]"
                                      : "bg-[#EF4444]"
                                }`}
                                style={{
                                  width: `${student.attendanceSummary.attendanceRate}%`,
                                }}
                              />
                            </div>
                          </div>

                          {student.attendanceSummary.totalSessions === 0 && (
                            <div className="text-center py-8">
                              <Calendar className="w-10 h-10 text-[#D1D5DB] mx-auto mb-3" />
                              <p className="text-sm text-[#6B7280]">
                                {t("studentDetail.noAttendanceRecords") ||
                                  "No attendance records found."}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Assessments Tab */}
                      {activeTab === "assessments" && (
                        <div className="space-y-4">
                          <h3 className="text-base font-semibold text-[#1F2937]">
                            {t("studentDetail.assessmentResults")}
                          </h3>

                          {student.assessmentScores.length === 0 ? (
                            <div className="text-center py-8">
                              <FileText className="w-10 h-10 text-[#D1D5DB] mx-auto mb-3" />
                              <p className="text-sm text-[#6B7280]">
                                {t("studentDetail.noAssessments") ||
                                  "No assessment scores available yet."}
                              </p>
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead>
                                  <tr className="text-left">
                                    <th className="pb-3 text-xs font-semibold text-[#6B7280] uppercase">
                                      {t("studentDetail.assessmentName")}
                                    </th>
                                    <th className="pb-3 text-xs font-semibold text-[#6B7280] uppercase">
                                      {t("studentDetail.score")}
                                    </th>
                                    <th className="pb-3 text-xs font-semibold text-[#6B7280] uppercase">
                                      {t("studentDetail.status")}
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#E5E7EB]">
                                  {student.assessmentScores.map((assessment) => {
                                    const percentage =
                                      assessment.maxScore > 0
                                        ? Math.round(
                                            (assessment.score /
                                              assessment.maxScore) *
                                              100
                                          )
                                        : 0;
                                    const passed = percentage >= 60;
                                    return (
                                      <tr
                                        key={assessment.assessmentId}
                                        className="hover:bg-[#F9FAFB]"
                                      >
                                        <td className="py-3 text-sm text-[#1F2937]">
                                          {assessment.title}
                                        </td>
                                        <td className="py-3">
                                          <span
                                            className={`text-sm font-semibold ${
                                              percentage >= 80
                                                ? "text-[#22C55E]"
                                                : percentage >= 60
                                                  ? "text-[#EAB308]"
                                                  : "text-[#EF4444]"
                                            }`}
                                          >
                                            {assessment.score}/
                                            {assessment.maxScore}
                                          </span>
                                        </td>
                                        <td className="py-3">
                                          <span
                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                              passed
                                                ? "bg-[#DCFCE7] text-[#22C55E]"
                                                : "bg-[#FEE2E2] text-[#EF4444]"
                                            }`}
                                          >
                                            {passed ? (
                                              <CheckCircle className="w-3 h-3" />
                                            ) : (
                                              <AlertTriangle className="w-3 h-3" />
                                            )}
                                            {passed
                                              ? t("studentDetail.passed")
                                              : t("studentDetail.failed")}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Activity Tab */}
                      {activeTab === "activity" && (
                        <div className="space-y-4">
                          <h3 className="text-base font-semibold text-[#1F2937]">
                            {t("studentDetail.recentActivity")}
                          </h3>

                          {/* Activity is derived from enrollment data since there's no activity log API */}
                          {student.enrollments.length === 0 ? (
                            <div className="text-center py-8">
                              <Clock className="w-10 h-10 text-[#D1D5DB] mx-auto mb-3" />
                              <p className="text-sm text-[#6B7280]">
                                {t("studentDetail.noActivity") ||
                                  "No recent activity to display."}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {/* Generate activity timeline from enrollments */}
                              {student.enrollments
                                .filter((e) => e.lastAccessedAt || e.completedAt)
                                .sort((a, b) => {
                                  const dateA = new Date(
                                    a.lastAccessedAt || a.completedAt || a.enrolledAt
                                  ).getTime();
                                  const dateB = new Date(
                                    b.lastAccessedAt || b.completedAt || b.enrolledAt
                                  ).getTime();
                                  return dateB - dateA;
                                })
                                .map((enrollment) => (
                                  <div
                                    key={`activity-${enrollment.id}`}
                                    className="flex items-center gap-3 p-3 bg-[#F9FAFB] rounded-xl"
                                  >
                                    <div className="w-9 h-9 rounded-lg bg-white border border-[#E5E7EB] flex items-center justify-center">
                                      {enrollment.status === "completed" ? (
                                        <CheckCircle className="w-4 h-4 text-[#22C55E]" />
                                      ) : (
                                        <BookOpen className="w-4 h-4 text-[#3B82F6]" />
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-sm text-[#1F2937]">
                                        {enrollment.status === "completed"
                                          ? `${t("studentDetail.courseCompleted")}: `
                                          : `${t("studentDetail.courseInProgress")}: `}
                                        <span className="font-medium">
                                          {locale === "ar" &&
                                          enrollment.courseTitleAr
                                            ? enrollment.courseTitleAr
                                            : enrollment.courseTitle}
                                        </span>
                                        {enrollment.status !== "completed" &&
                                          ` (${enrollment.progress}%)`}
                                      </p>
                                      <p className="text-xs text-[#9CA3AF]">
                                        {formatLastActive(
                                          enrollment.lastAccessedAt ||
                                            enrollment.completedAt
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                ))}

                              {/* Enrollment events */}
                              {student.enrollments
                                .sort(
                                  (a, b) =>
                                    new Date(b.enrolledAt).getTime() -
                                    new Date(a.enrolledAt).getTime()
                                )
                                .map((enrollment) => (
                                  <div
                                    key={`enrolled-${enrollment.id}`}
                                    className="flex items-center gap-3 p-3 bg-[#F9FAFB] rounded-xl"
                                  >
                                    <div className="w-9 h-9 rounded-lg bg-white border border-[#E5E7EB] flex items-center justify-center">
                                      <Calendar className="w-4 h-4 text-[#8B5CF6]" />
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-sm text-[#1F2937]">
                                        {t("studentDetail.enrolled")}:{" "}
                                        <span className="font-medium">
                                          {locale === "ar" &&
                                          enrollment.courseTitleAr
                                            ? enrollment.courseTitleAr
                                            : enrollment.courseTitle}
                                        </span>
                                      </p>
                                      <p className="text-xs text-[#9CA3AF]">
                                        {formatDate(enrollment.enrolledAt)}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default StudentDetailContent;
