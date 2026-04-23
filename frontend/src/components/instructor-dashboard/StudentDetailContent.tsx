"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import InstructorNavbar from "./InstructorNavbar";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import { useInstructorProfile } from "@/hooks/useInstructorProfile";
import { useCalendarPreference } from "@/contexts/CalendarContext";
import { formatDate as formatDateHijri } from "@/lib/hijri";
import DatePicker from "@/components/ui/DatePicker";
import { instructorApi } from "@/lib/api";
import { toast } from "sonner";
import type {
  StudentDetailResponse,
  AtRiskStudent,
  InterventionRecord,
  InterventionType,
  CreateInterventionPayload,
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
  Plus,
  Ticket,
  Loader2,
  MessageSquare,
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
  const { calendarFormat } = useCalendarPreference();

  const [activeTab, setActiveTab] = useState<
    "overview" | "attendance" | "assessments" | "interventions"
  >("overview");

  const [student, setStudent] = useState<StudentDetailResponse | null>(null);
  const [riskStatus, setRiskStatus] = useState<RiskStatus>("good");
  const [riskReasons, setRiskReasons] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Make-up lecture modal
  const [makeupModal, setMakeupModal] = useState<{ open: boolean; courseId: string; courseTitle: string } | null>(null);
  const [makeupData, setMakeupData] = useState({ title: "", date: "", time: "", duration: "60" });
  const [makeupSaving, setMakeupSaving] = useState(false);

  // Interventions state
  const [interventions, setInterventions] = useState<InterventionRecord[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [interventionType, setInterventionType] = useState<InterventionType>("email");
  const [interventionMessage, setInterventionMessage] = useState("");
  const [interventionCourseId, setInterventionCourseId] = useState("");
  const [submittingIntervention, setSubmittingIntervention] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detail, atRiskData, interventionData] = await Promise.all([
        instructorApi.getStudentDetail(studentId),
        instructorApi.getAtRiskStudents(),
        instructorApi.getStudentInterventions(studentId).catch(() => [] as InterventionRecord[]),
      ]);

      setStudent(detail as StudentDetailResponse);
      setInterventions(interventionData as InterventionRecord[]);

      // Determine risk status — per course
      const atRiskEntries = (atRiskData as any[]).filter(
        (s) => s.id === studentId
      );
      if (atRiskEntries.length > 0) {
        const allReasons: string[] = [];
        for (const entry of atRiskEntries) {
          const courseLabel = entry.courseTitle ? `[${entry.courseTitle}] ` : '';
          for (const reason of entry.riskReasons) {
            allReasons.push(`${courseLabel}${reason}`);
          }
        }
        setRiskReasons(allReasons);
        const hasLowAttendance = allReasons.some((r) => r.includes("Attendance rate"));
        const hasInactivityOnly = allReasons.every((r) => r.includes("activity"));
        setRiskStatus(hasInactivityOnly ? "inactive" : "at-risk");
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
        return "bg-[#F3F4F6] text-[var(--color-text-secondary)]";
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
    return formatDateHijri(dateStr, calendarFormat, { locale });
  };

  const formatLastActive = (dateStr: string | null) => {
    if (!dateStr) return t("students.never") || "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return t("common.timeMinutesAgo", { count: diffMins });
    if (diffHours < 24) return t("common.timeHoursAgo", { count: diffHours });
    if (diffDays < 7) return t("common.timeDaysAgo", { count: diffDays });
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
    { id: "interventions" as const, label: t("studentDetail.tabInterventions") },
  ];

  const handleSubmitIntervention = async () => {
    setSubmittingIntervention(true);
    try {
      const payload: CreateInterventionPayload = {
        type: interventionType,
        studentId,
        message: interventionMessage || undefined,
        courseId: interventionCourseId || undefined,
      };
      await instructorApi.createIntervention(payload);
      toast.success(t("studentDetail.interventionCreated"));
      setShowAddForm(false);
      setInterventionMessage("");
      setInterventionCourseId("");
      // Refresh interventions
      const fresh = await instructorApi.getStudentInterventions(studentId);
      setInterventions(fresh as InterventionRecord[]);
    } catch {
      toast.error(t("studentDetail.interventionFailed"));
    } finally {
      setSubmittingIntervention(false);
    }
  };

  const getInterventionIcon = (type: InterventionType) => {
    switch (type) {
      case "email": return <Mail className="w-4 h-4 text-[#3B82F6]" />;
      case "makeup_session": return <Calendar className="w-4 h-4 text-[#8B5CF6]" />;
      case "ticket": return <Ticket className="w-4 h-4 text-[#F59E0B]" />;
    }
  };

  const getInterventionLabel = (type: InterventionType) => {
    switch (type) {
      case "email": return t("studentDetail.interventionEmail");
      case "makeup_session": return t("studentDetail.interventionMakeup");
      case "ticket": return t("studentDetail.interventionTicket");
    }
  };

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
                className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] transition-colors"
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
                  <span className="ml-3 text-sm text-[var(--color-text-secondary)]">
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
                  <div className="bg-white rounded-xl border border-[var(--color-border)] p-6">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-full bg-[var(--color-border)] flex items-center justify-center text-xl font-bold text-[var(--color-text-secondary)]">
                          {getInitials(student.firstName, student.lastName)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-xl md:text-2xl font-bold text-[var(--color-text-primary)]">
                              {student.firstName || ""} {student.lastName || ""}
                            </h1>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(riskStatus)}`}
                            >
                              {getStatusIcon(riskStatus)}
                              {getStatusLabel(riskStatus)}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--color-text-secondary)]">
                            <span className="flex items-center gap-1">
                              <Mail className="w-4 h-4" />
                              {student.email}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-xs text-[var(--color-text-secondary)]">
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

                          {/* At-risk course count */}
                          {riskReasons.length > 0 && (
                            <p className="mt-2 text-xs text-[#D97706]">
                              <AlertTriangle className="w-3 h-3 inline mr-1" />
                              At risk in {new Set(riskReasons.map(r => r.match(/^\[([^\]]+)\]/)?.[1]).filter(Boolean)).size} course(s) — see details in Attendance tab
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stats Cards */}
                  {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                      <div className="bg-white rounded-xl border border-[var(--color-border)] p-4 text-center">
                        <div className="w-10 h-10 mx-auto rounded-lg bg-[#DBEAFE] flex items-center justify-center mb-2">
                          <BookOpen className="w-5 h-5 text-[#3B82F6]" />
                        </div>
                        <p className="text-2xl font-bold text-[var(--color-text-secondary)]">
                          {stats.totalCourses}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {t("studentDetail.totalCourses")}
                        </p>
                      </div>
                      <div className="bg-white rounded-xl border border-[var(--color-border)] p-4 text-center">
                        <div className="w-10 h-10 mx-auto rounded-lg bg-[#DCFCE7] flex items-center justify-center mb-2">
                          <CheckCircle className="w-5 h-5 text-[#22C55E]" />
                        </div>
                        <p className="text-2xl font-bold text-[var(--color-text-secondary)]">
                          {stats.completedCourses}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {t("studentDetail.completed")}
                        </p>
                      </div>
                      <div className="bg-white rounded-xl border border-[var(--color-border)] p-4 text-center">
                        <div className="w-10 h-10 mx-auto rounded-lg bg-[#FEF9C3] flex items-center justify-center mb-2">
                          <TrendingUp className="w-5 h-5 text-[#EAB308]" />
                        </div>
                        <p className="text-2xl font-bold text-[var(--color-text-secondary)]">
                          {stats.avgAttendance}%
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {t("studentDetail.avgAttendance")}
                        </p>
                      </div>
                      <div className="bg-white rounded-xl border border-[var(--color-border)] p-4 text-center">
                        <div className="w-10 h-10 mx-auto rounded-lg bg-[#E0E7FF] flex items-center justify-center mb-2">
                          <FileText className="w-5 h-5 text-[#6366F1]" />
                        </div>
                        <p className="text-2xl font-bold text-[var(--color-text-secondary)]">
                          {stats.avgScore > 0 ? `${stats.avgScore}%` : "-"}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {t("studentDetail.avgScore")}
                        </p>
                      </div>
                      <div className="bg-white rounded-xl border border-[var(--color-border)] p-4 text-center">
                        <div className="w-10 h-10 mx-auto rounded-lg bg-[#FEF3C7] flex items-center justify-center mb-2">
                          <Award className="w-5 h-5 text-[#D4A520]" />
                        </div>
                        <p className="text-2xl font-bold text-[var(--color-text-secondary)]">
                          {stats.avgProgress}%
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {t("studentDetail.avgProgress") || "Avg. Progress"}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Tabs */}
                  <div className="bg-white rounded-xl border border-[var(--color-border)]">
                    <div className="flex border-b border-[var(--color-border)] overflow-x-auto">
                      {tabs.map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`px-5 py-3 text-sm font-medium relative transition-colors whitespace-nowrap ${
                            activeTab === tab.id
                              ? "text-[#3B82F6]"
                              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]"
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
                          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                            {t("studentDetail.enrolledCourses")}
                          </h3>

                          {student.enrollments.length === 0 ? (
                            <div className="text-center py-8">
                              <BookOpen className="w-10 h-10 text-[var(--color-border)] mx-auto mb-3" />
                              <p className="text-sm text-[var(--color-text-secondary)]">
                                {t("studentDetail.noEnrollments") ||
                                  "No course enrollments found."}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {student.enrollments.map((enrollment) => (
                                <div
                                  key={enrollment.id}
                                  className="p-4 border border-[var(--color-border)] rounded-xl hover:bg-[#F9FAFB] transition-colors"
                                >
                                  <div className="flex items-start justify-between mb-3">
                                    <div>
                                      <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
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
                                              : "bg-[#F3F4F6] text-[var(--color-text-secondary)]"
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
                                    <div className="flex justify-between text-xs text-[var(--color-text-secondary)] mb-1">
                                      <span>{t("studentDetail.progress")}</span>
                                      <span>{enrollment.progress}%</span>
                                    </div>
                                    <div className="h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
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
                                  <div className="flex flex-wrap gap-4 text-xs text-[var(--color-text-secondary)]">
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

                      {/* Attendance Tab — Per-Course Breakdown */}
                      {activeTab === "attendance" && (
                        <div className="space-y-6">
                          {(student.coursePerformance || [])
                            .sort((a: any, b: any) => {
                              const order: Record<string, number> = { active: 0, completed: 1, dropped: 2 };
                              return (order[a.enrollmentStatus] ?? 3) - (order[b.enrollmentStatus] ?? 3);
                            })
                            .map((cp: any) => (
                            <div key={cp.courseId} className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
                              {/* Course Header */}
                              <div className="px-4 py-3 bg-[#F9FAFB] border-b border-[var(--color-border)] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <BookOpen className="w-4 h-4 text-[#D4A520]" />
                                  <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                                    {locale === "ar" && cp.courseTitleAr ? cp.courseTitleAr : cp.courseTitle}
                                  </h4>
                                </div>
                                <div className="flex items-center gap-2">
                                  {riskReasons.some(r => r.includes(`[${cp.courseTitle}]`)) && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FEF2F2] text-[#EF4444]">
                                      <AlertTriangle className="w-3 h-3" />
                                      {t("studentDetail.atRisk")}
                                    </span>
                                  )}
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                    cp.enrollmentStatus === "completed" ? "bg-[#DCFCE7] text-[#166534]"
                                    : cp.enrollmentStatus === "active" ? "bg-[#EFF6FF] text-[#3B82F6]"
                                    : "bg-[#F3F4F6] text-[var(--color-text-secondary)]"
                                  }`}>
                                    {cp.enrollmentStatus === "completed" ? t("studentDetail.enrollmentCompleted") : cp.enrollmentStatus === "active" ? t("studentDetail.enrollmentInProgress") : cp.enrollmentStatus}
                                  </span>
                                </div>
                              </div>

                              <div className="p-4 space-y-4">
                                {/* Attendance Stats */}
                                <div className="grid grid-cols-5 gap-2">
                                  <div className="bg-[#F9FAFB] rounded-lg p-2.5 text-center">
                                    <p className="text-base font-bold text-[var(--color-text-secondary)]">{cp.attendance.totalSessions}</p>
                                    <p className="text-[10px] text-[var(--color-text-secondary)]">{t("studentDetail.total")}</p>
                                  </div>
                                  <div className="bg-[#DCFCE7] rounded-lg p-2.5 text-center">
                                    <p className="text-base font-bold text-[#22C55E]">{cp.attendance.present}</p>
                                    <p className="text-[10px] text-[#166534]">{t("studentDetail.present")}</p>
                                  </div>
                                  <div className="bg-[#FEE2E2] rounded-lg p-2.5 text-center">
                                    <p className="text-base font-bold text-[#EF4444]">{cp.attendance.absent}</p>
                                    <p className="text-[10px] text-[#991B1B]">{t("studentDetail.absent")}</p>
                                  </div>
                                  <div className="bg-[#FEF9C3] rounded-lg p-2.5 text-center">
                                    <p className="text-base font-bold text-[#EAB308]">{cp.attendance.late}</p>
                                    <p className="text-[10px] text-[#854D0E]">{t("studentDetail.late")}</p>
                                  </div>
                                  <div className="bg-[#F3F4F6] rounded-lg p-2.5 text-center">
                                    <p className="text-base font-bold text-[var(--color-text-secondary)]">{cp.attendance.excused}</p>
                                    <p className="text-[10px] text-[var(--color-text-secondary)]">{t("studentDetail.excused")}</p>
                                  </div>
                                </div>

                                {/* Attendance Rate Bar */}
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-[var(--color-text-secondary)] w-24 flex-shrink-0">{t("studentDetail.attendance")}</span>
                                  <div className="flex-1 h-2.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${
                                        cp.attendance.attendanceRate >= 80 ? "bg-[#22C55E]"
                                        : cp.attendance.attendanceRate >= 60 ? "bg-[#EAB308]"
                                        : "bg-[#EF4444]"
                                      }`}
                                      style={{ width: `${cp.attendance.attendanceRate}%` }}
                                    />
                                  </div>
                                  <span className={`text-sm font-bold w-12 text-right ${
                                    cp.attendance.attendanceRate >= 80 ? "text-[#22C55E]"
                                    : cp.attendance.attendanceRate >= 60 ? "text-[#EAB308]"
                                    : "text-[#EF4444]"
                                  }`}>
                                    {cp.attendance.attendanceRate}%
                                  </span>
                                </div>

                                {/* Assessment Average (if available) */}
                                {cp.assessmentAverage !== null && (
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs text-[var(--color-text-secondary)] w-24 flex-shrink-0">{t("studentDetail.assessment")}</span>
                                    <div className="flex-1 h-2.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all ${
                                          cp.assessmentAverage >= 70 ? "bg-[#3B82F6]"
                                          : cp.assessmentAverage >= 50 ? "bg-[#EAB308]"
                                          : "bg-[#EF4444]"
                                        }`}
                                        style={{ width: `${cp.assessmentAverage}%` }}
                                      />
                                    </div>
                                    <span className={`text-sm font-bold w-12 text-right ${
                                      cp.assessmentAverage >= 70 ? "text-[#3B82F6]"
                                      : cp.assessmentAverage >= 50 ? "text-[#EAB308]"
                                      : "text-[#EF4444]"
                                    }`}>
                                      {cp.assessmentAverage}%
                                    </span>
                                  </div>
                                )}

                                {/* Lecture Breakdown */}
                                {cp.attendanceRecords && cp.attendanceRecords.length > 0 && (
                                  <details className="group">
                                    <summary className="text-xs font-medium text-[var(--color-text-secondary)] cursor-pointer hover:text-[var(--color-text-primary)] flex items-center gap-1">
                                      <ChevronRight className="w-3.5 h-3.5 group-open:rotate-90 transition-transform" />
                                      {t("studentDetail.lectureByLecture", { count: cp.attendanceRecords.length })}
                                    </summary>
                                    <div className="mt-2 overflow-x-auto">
                                      <table className="w-full">
                                        <thead>
                                          <tr className="bg-[#F9FAFB]">
                                            <th className="px-3 py-1.5 text-start text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase">{t("studentDetail.session")}</th>
                                            <th className="px-3 py-1.5 text-start text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase">{t("studentDetail.dateLabel")}</th>
                                            <th className="px-3 py-1.5 text-start text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase">{t("studentDetail.status")}</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#F3F4F6]">
                                          {cp.attendanceRecords.map((r: any) => (
                                            <tr key={r.sessionId} className="hover:bg-[#F9FAFB]">
                                              <td className="px-3 py-1.5 text-xs text-[var(--color-text-primary)]">{r.sessionTitle}</td>
                                              <td className="px-3 py-1.5 text-xs text-[var(--color-text-secondary)]">{formatDate(r.scheduledAt)}</td>
                                              <td className="px-3 py-1.5">
                                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                  r.status === "present" ? "bg-[#DCFCE7] text-[#166534]"
                                                  : r.status === "absent" ? "bg-[#FEE2E2] text-[#991B1B]"
                                                  : r.status === "late" ? "bg-[#FEF9C3] text-[#854D0E]"
                                                  : "bg-[#F3F4F6] text-[var(--color-text-secondary)]"
                                                }`}>
                                                  {t(`studentDetail.status${r.status.charAt(0).toUpperCase() + r.status.slice(1)}`)}
                                                </span>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </details>
                                )}

                                {/* Schedule Make-up Lecture — only for at-risk active courses */}
                                {cp.enrollmentStatus === "active" && riskReasons.some(r => r.includes(`[${cp.courseTitle}]`)) && (
                                  <button
                                    onClick={() => {
                                      setMakeupModal({ open: true, courseId: cp.courseId, courseTitle: cp.courseTitle });
                                      setMakeupData({ title: `Make-up: ${cp.courseTitle}`, date: "", time: "", duration: "60" });
                                    }}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 mt-2 text-xs font-medium text-[#D97706] bg-[#FFFBEB] border border-[#FDE68A] rounded-lg hover:bg-[#FEF3C7] transition-colors"
                                  >
                                    <Calendar className="w-3.5 h-3.5" />
                                    {t("studentDetail.scheduleMakeup")}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}

                          {(!student.coursePerformance || student.coursePerformance.length === 0) && (
                            <div className="text-center py-8">
                              <Calendar className="w-10 h-10 text-[var(--color-border)] mx-auto mb-3" />
                              <p className="text-sm text-[var(--color-text-secondary)]">
                                {t("studentDetail.noAttendanceRecords") || "No attendance records found."}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Assessments Tab — Per Course */}
                      {activeTab === "assessments" && (
                        <div className="space-y-6">
                          {(student.coursePerformance || [])
                            .sort((a: any, b: any) => {
                              const order: Record<string, number> = { active: 0, completed: 1, dropped: 2 };
                              return (order[a.enrollmentStatus] ?? 3) - (order[b.enrollmentStatus] ?? 3);
                            })
                            .map((cp: any) => {
                            const courseAssessments = cp.assessments || [];
                            if (courseAssessments.length === 0) return null;
                            return (
                              <div key={cp.courseId} className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
                                <div className="px-4 py-3 bg-[#F9FAFB] border-b border-[var(--color-border)] flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-[#D4A520]" />
                                    <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                                      {locale === "ar" && cp.courseTitleAr ? cp.courseTitleAr : cp.courseTitle}
                                    </h4>
                                  </div>
                                  {cp.assessmentAverage !== null && (
                                    <span className={`text-xs font-bold ${
                                      cp.assessmentAverage >= 70 ? "text-[#22C55E]"
                                      : cp.assessmentAverage >= 50 ? "text-[#EAB308]"
                                      : "text-[#EF4444]"
                                    }`}>
                                      {t("studentDetail.avg")}: {cp.assessmentAverage}%
                                    </span>
                                  )}
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full">
                                    <thead>
                                      <tr className="text-start">
                                        <th className="px-4 py-2 text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase">{t("studentDetail.assessment")}</th>
                                        <th className="px-4 py-2 text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase">{t("studentDetail.score")}</th>
                                        <th className="px-4 py-2 text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase">{t("studentDetail.classAvg")}</th>
                                        <th className="px-4 py-2 text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase">{t("studentDetail.status")}</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#F3F4F6]">
                                      {courseAssessments.map((a: any) => {
                                        const pct = a.maxScore > 0 ? Math.round((a.score / a.maxScore) * 100) : 0;
                                        const passed = pct >= 60;
                                        return (
                                          <tr key={a.assessmentId} className="hover:bg-[#F9FAFB]">
                                            <td className="px-4 py-2.5 text-sm text-[var(--color-text-primary)]">{a.title}</td>
                                            <td className="px-4 py-2.5">
                                              <span className={`text-sm font-semibold ${pct >= 80 ? "text-[#22C55E]" : pct >= 60 ? "text-[#EAB308]" : "text-[#EF4444]"}`}>
                                                {a.score}/{a.maxScore}
                                              </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-sm text-[var(--color-text-secondary)]">{a.classAverage}%</td>
                                            <td className="px-4 py-2.5">
                                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${passed ? "bg-[#DCFCE7] text-[#22C55E]" : "bg-[#FEE2E2] text-[#EF4444]"}`}>
                                                {passed ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                                {passed ? t("studentDetail.passed") : t("studentDetail.failed")}
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          })}

                          {(!student.coursePerformance || student.coursePerformance.every((cp: any) => !(cp.assessments?.length))) && (
                            <div className="text-center py-8">
                              <FileText className="w-10 h-10 text-[var(--color-border)] mx-auto mb-3" />
                              <p className="text-sm text-[var(--color-text-secondary)]">{t("studentDetail.noAssessments")}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Interventions Tab */}
                      {activeTab === "interventions" && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                              {t("studentDetail.interventionsTitle")}
                            </h3>
                            <button
                              onClick={() => setShowAddForm(!showAddForm)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#3B82F6] text-white text-sm font-medium rounded-lg hover:bg-[#2563EB] transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                              {t("studentDetail.addIntervention")}
                            </button>
                          </div>

                          {/* Add Intervention Form */}
                          {showAddForm && (
                            <div className="p-4 bg-[#F9FAFB] rounded-xl border border-[var(--color-border)] space-y-3">
                              {/* Type selector */}
                              <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                                  {t("studentDetail.interventionTypeLabel")}
                                </label>
                                <select
                                  value={interventionType}
                                  onChange={(e) => setInterventionType(e.target.value as InterventionType)}
                                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] outline-none"
                                >
                                  <option value="email">{t("studentDetail.interventionEmail")}</option>
                                  <option value="makeup_session">{t("studentDetail.interventionMakeup")}</option>
                                  <option value="ticket">{t("studentDetail.interventionTicket")}</option>
                                </select>
                              </div>

                              {/* Course selector (optional) */}
                              {student.enrollments.length > 0 && (
                                <div>
                                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                                    {t("studentDetail.interventionCourse")}
                                  </label>
                                  <select
                                    value={interventionCourseId}
                                    onChange={(e) => setInterventionCourseId(e.target.value)}
                                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] outline-none"
                                  >
                                    <option value="">{t("studentDetail.interventionAnyCourse")}</option>
                                    {student.enrollments.map((e) => (
                                      <option key={e.courseId} value={e.courseId}>
                                        {locale === "ar" && e.courseTitleAr ? e.courseTitleAr : e.courseTitle}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              {/* Message */}
                              <div>
                                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                                  {t("studentDetail.interventionNote")}
                                </label>
                                <textarea
                                  value={interventionMessage}
                                  onChange={(e) => setInterventionMessage(e.target.value)}
                                  placeholder={t("studentDetail.interventionNotePlaceholder")}
                                  maxLength={2000}
                                  rows={3}
                                  className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm bg-white focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] outline-none resize-none"
                                />
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  onClick={() => setShowAddForm(false)}
                                  className="px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] rounded-lg transition-colors"
                                >
                                  {t("studentDetail.interventionCancel")}
                                </button>
                                <button
                                  onClick={handleSubmitIntervention}
                                  disabled={submittingIntervention}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#3B82F6] text-white text-sm font-medium rounded-lg hover:bg-[#2563EB] transition-colors disabled:opacity-50"
                                >
                                  {submittingIntervention && <Loader2 className="w-4 h-4 animate-spin" />}
                                  {t("studentDetail.submitIntervention")}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Interventions Timeline */}
                          {interventions.length === 0 ? (
                            <div className="text-center py-8">
                              <MessageSquare className="w-10 h-10 text-[var(--color-border)] mx-auto mb-3" />
                              <p className="text-sm text-[var(--color-text-secondary)]">
                                {t("studentDetail.noInterventions")}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {interventions.map((iv) => (
                                <div
                                  key={iv.id}
                                  className="flex items-start gap-3 p-3 bg-[#F9FAFB] rounded-xl border border-[var(--color-border)]"
                                >
                                  <div className="w-9 h-9 rounded-lg bg-white border border-[var(--color-border)] flex items-center justify-center flex-shrink-0 mt-0.5">
                                    {getInterventionIcon(iv.type)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-sm font-medium text-[var(--color-text-primary)]">
                                        {getInterventionLabel(iv.type)}
                                      </span>
                                      {iv.courseName && (
                                        <span className="text-[11px] text-[var(--color-text-secondary)] bg-[#F3F4F6] px-1.5 py-0.5 rounded">
                                          {iv.courseName}
                                        </span>
                                      )}
                                    </div>
                                    {iv.message && (
                                      <p className="text-sm text-[var(--color-text-secondary)] mb-1">
                                        {iv.message}
                                      </p>
                                    )}
                                    <p className="text-xs text-[var(--color-text-secondary)]">
                                      {t("studentDetail.interventionBy", { name: iv.instructorName })} · {formatDate(iv.createdAt)}
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
      {/* Make-up Lecture Modal */}
      {makeupModal?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("studentDetail.makeupModalTitle")}</h3>
                <button onClick={() => setMakeupModal(null)} className="p-1 hover:bg-[#F3F4F6] rounded">
                  <UserX className="w-5 h-5 text-[var(--color-text-secondary)]" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("studentDetail.lectureTitle")} *</label>
                  <input
                    type="text"
                    value={makeupData.title}
                    onChange={(e) => setMakeupData(d => ({ ...d, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("studentDetail.dateRequired")} *</label>
                    <DatePicker
                      value={makeupData.date}
                      onChange={(v) => setMakeupData(d => ({ ...d, date: v }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("studentDetail.timeRequired")} *</label>
                    <input
                      type="time"
                      value={makeupData.time}
                      onChange={(e) => setMakeupData(d => ({ ...d, time: e.target.value }))}
                      className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("studentDetail.durationMinutes")}</label>
                  <input
                    type="number"
                    value={makeupData.duration}
                    onChange={(e) => setMakeupData(d => ({ ...d, duration: e.target.value }))}
                    min={15}
                    className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-[var(--color-text-secondary)]">{t("studentDetail.makeupNote")}</p>
              </div>
              <div className="flex justify-end gap-3 mt-5">
                <button onClick={() => setMakeupModal(null)} className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">{t("studentDetail.cancel")}</button>
                <button
                  onClick={async () => {
                    if (!makeupData.title.trim() || !makeupData.date || !makeupData.time) {
                      toast.error(t("studentDetail.fillRequired"));
                      return;
                    }
                    setMakeupSaving(true);
                    try {
                      const scheduledAt = new Date(`${makeupData.date}T${makeupData.time}`).toISOString();
                      await instructorApi.createSession({
                        courseId: makeupModal.courseId,
                        title: makeupData.title.trim(),
                        type: "zoom",
                        scheduledAt,
                        durationMinutes: Number(makeupData.duration) || 60,
                        isMakeup: true,
                        assignedStudents: [studentId],
                      });
                      toast.success(t("studentDetail.makeupScheduled"));
                      setMakeupModal(null);
                      window.location.reload();
                    } catch (err: any) {
                      toast.error(err?.message || t("studentDetail.makeupFailed"));
                    } finally {
                      setMakeupSaving(false);
                    }
                  }}
                  disabled={makeupSaving || !makeupData.title.trim() || !makeupData.date || !makeupData.time}
                  className="px-4 py-2 bg-[#D97706] text-white text-sm font-medium rounded-lg hover:bg-[#B45309] transition-colors disabled:opacity-50"
                >
                  {makeupSaving ? t("studentDetail.scheduling") : t("studentDetail.scheduleLecture")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StudentDetailContent;
