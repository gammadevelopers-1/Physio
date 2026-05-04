"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import InstructorNavbar from "./InstructorNavbar";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import { useInstructorProfile } from "@/hooks/useInstructorProfile";
import { useCalendarPreference } from "@/contexts/CalendarContext";
import { formatDate as formatDateHijri } from "@/lib/hijri";
import { instructorApi } from "@/lib/api";
import type {
  InstructorStudent,
  InstructorCourse,
  AtRiskStudent,
} from "@/types/instructor-dashboard";
import {
  Search,
  Filter,
  ChevronDown,
  Eye,
  Users,
  AlertTriangle,
  UserX,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ArrowUpDown,
} from "lucide-react";

type RiskStatus = "good" | "at-risk" | "inactive";
type SortField = "name" | "progress" | "enrollments" | "lastActive" | "attendance" | "assessmentAverage";
type SortDirection = "asc" | "desc";

interface EnrichedStudent extends InstructorStudent {
  riskStatus: RiskStatus;
  riskReasons: string[];
}

const ITEMS_PER_PAGE = 10;

const StudentsContent = () => {
  const instructor = useInstructorProfile();
  const t = useTranslations("instructorDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { calendarFormat } = useCalendarPreference();

  // Data state
  const [students, setStudents] = useState<EnrichedStudent[]>([]);
  const [courses, setCourses] = useState<InstructorCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & search state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [studentsData, atRiskData, coursesRes] = await Promise.all([
        instructorApi.getStudents(selectedCourse !== "all" ? { courseId: selectedCourse } : undefined),
        instructorApi.getAtRiskStudents(),
        instructorApi.getCourses({ limit: 100 }),
      ]);
      setCourses(coursesRes.data);

      // Build a set of at-risk student IDs with their risk reasons (per-course, merged)
      const atRiskMap = new Map<string, string[]>();
      (atRiskData as AtRiskStudent[]).forEach((s) => {
        const existing = atRiskMap.get(s.id) || [];
        const courseLabel = (s as any).courseTitle ? `[${(s as any).courseTitle}] ` : '';
        const prefixed = s.riskReasons.map((r) => `${courseLabel}${r}`);
        atRiskMap.set(s.id, [...existing, ...prefixed]);
      });

      // Enrich students with risk status
      const enriched: EnrichedStudent[] = (studentsData as InstructorStudent[]).map((s) => {
        const riskReasons = atRiskMap.get(s.studentId) || [];
        let riskStatus: RiskStatus = "good";

        if (riskReasons.length > 0) {
          // Check if it's inactive (no activity in 7 days)
          const hasInactivity = riskReasons.some(
            (r) => r.includes("No recent activity") || r.includes("Last activity on")
          );
          const hasLowAttendance = riskReasons.some((r) =>
            r.includes("Attendance rate")
          );
          if (hasInactivity && !hasLowAttendance) {
            riskStatus = "inactive";
          } else {
            riskStatus = "at-risk";
          }
        } else if (
          s.lastAccessedAt &&
          new Date(s.lastAccessedAt) <
            new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
        ) {
          riskStatus = "inactive";
        }

        return { ...s, riskStatus, riskReasons };
      });

      setStudents(enriched);
    } catch {
      setError(t("students.errorLoading") || "Failed to load students");
    } finally {
      setLoading(false);
    }
  }, [t, selectedCourse]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter + search + sort
  const filteredStudents = useMemo(() => {
    let result = students.filter((student) => {
      const name = `${student.firstName || ""} ${student.lastName || ""}`.toLowerCase();
      const matchesSearch =
        name.includes(searchQuery.toLowerCase()) ||
        student.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        selectedStatus === "all" || student.riskStatus === selectedStatus;
      return matchesSearch && matchesStatus;
    });

    // Sort
    result.sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      switch (sortField) {
        case "name": {
          const nameA = `${a.firstName || ""} ${a.lastName || ""}`.toLowerCase();
          const nameB = `${b.firstName || ""} ${b.lastName || ""}`.toLowerCase();
          return nameA.localeCompare(nameB) * dir;
        }
        case "progress":
          return (a.averageProgress - b.averageProgress) * dir;
        case "enrollments":
          return (a.totalEnrollments - b.totalEnrollments) * dir;
        case "attendance":
          return ((a.attendanceRate ?? -1) - (b.attendanceRate ?? -1)) * dir;
        case "assessmentAverage":
          return ((a.assessmentAverage ?? -1) - (b.assessmentAverage ?? -1)) * dir;
        case "lastActive": {
          const dateA = a.lastAccessedAt ? new Date(a.lastAccessedAt).getTime() : 0;
          const dateB = b.lastAccessedAt ? new Date(b.lastAccessedAt).getTime() : 0;
          return (dateA - dateB) * dir;
        }
        default:
          return 0;
      }
    });

    return result;
  }, [students, searchQuery, selectedStatus, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / ITEMS_PER_PAGE));
  const paginatedStudents = useMemo(
    () =>
      filteredStudents.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
      ),
    [filteredStudents, currentPage]
  );

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatus, sortField, sortDirection]);

  // Stats
  const stats = useMemo(() => {
    const total = students.length;
    const good = students.filter((s) => s.riskStatus === "good").length;
    const atRisk = students.filter((s) => s.riskStatus === "at-risk").length;
    const inactive = students.filter((s) => s.riskStatus === "inactive").length;
    return { total, good, atRisk, inactive };
  }, [students]);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "good":
        return "bg-[#DCFCE7] text-[#22C55E]";
      case "at-risk":
        return "bg-[#FEF9C3] text-[#EAB308]";
      case "inactive":
        return "bg-[#FEE2E2] text-[#EF4444]";
      default:
        return "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
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

  const getProgressStyle = (progress: number) => {
    if (progress >= 80) return "text-[#22C55E]";
    if (progress >= 50) return "text-[#EAB308]";
    return "text-[#EF4444]";
  };

  const getInitials = (firstName: string | null, lastName: string | null) => {
    const f = firstName?.charAt(0)?.toUpperCase() || "";
    const l = lastName?.charAt(0)?.toUpperCase() || "";
    return f + l || "?";
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
    if (diffDays < 30) return t("common.timeWeeksAgo", { count: Math.floor(diffDays / 7) });
    return formatDateHijri(date, calendarFormat, { locale });
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const statusOptions = [
    { id: "all", name: t("students.allStatuses") },
    { id: "good", name: t("students.statusGood") },
    { id: "at-risk", name: t("students.statusAtRisk") },
    { id: "inactive", name: t("students.statusInactive") },
  ];

  return (
    <>
      <InstructorNavbar instructor={instructor} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <InstructorSidebar instructor={instructor} />
            </div>
            <InstructorMobileSidebar instructor={instructor} />

            <div className="flex-1 min-w-0 space-y-6">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-[var(--color-text-primary)]">
                    {t("students.title")}
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    {t("students.subtitle")}
                  </p>
                </div>
              </div>

              {/* Loading / Error */}
              {loading && (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="w-6 h-6 text-[var(--color-primary)] animate-spin" />
                  <span className="ml-3 text-sm text-[var(--color-text-secondary)]">
                    {t("students.loading") || "Loading students..."}
                  </span>
                </div>
              )}

              {error && !loading && (
                <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-xl p-6 text-center">
                  <p className="text-[#DC2626] font-medium mb-3">{error}</p>
                  <button
                    onClick={fetchData}
                    className="px-4 py-2 bg-[#DC2626] text-white rounded-lg text-sm hover:bg-[#B91C1C] transition-colors"
                  >
                    {t("students.retry") || "Retry"}
                  </button>
                </div>
              )}

              {!loading && !error && (
                <>
                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[var(--color-border-subtle)] flex items-center justify-center">
                          <Users className="w-5 h-5 text-[var(--color-primary)]" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-[var(--color-text-secondary)]">
                            {stats.total}
                          </p>
                          <p className="text-xs text-[var(--color-text-secondary)]">
                            {t("students.totalStudents")}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#DCFCE7] flex items-center justify-center">
                          <CheckCircle className="w-5 h-5 text-[#22C55E]" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-[var(--color-text-secondary)]">
                            {stats.good}
                          </p>
                          <p className="text-xs text-[var(--color-text-secondary)]">
                            {t("students.goodStatus")}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#FEF9C3] flex items-center justify-center">
                          <AlertTriangle className="w-5 h-5 text-[#EAB308]" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-[var(--color-text-secondary)]">
                            {stats.atRisk}
                          </p>
                          <p className="text-xs text-[var(--color-text-secondary)]">
                            {t("students.atRiskStatus")}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#FEE2E2] flex items-center justify-center">
                          <UserX className="w-5 h-5 text-[#EF4444]" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-[var(--color-text-secondary)]">
                            {stats.inactive}
                          </p>
                          <p className="text-xs text-[var(--color-text-secondary)]">
                            {t("students.inactiveStatus")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Search and Filters */}
                  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="relative flex-1">
                        <Search
                          className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
                        />
                        <input
                          type="text"
                          placeholder={t("students.searchPlaceholder")}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className={`w-full py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"}`}
                        />
                      </div>

                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="md:hidden flex items-center justify-center gap-2 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                      >
                        <Filter className="w-4 h-4" />
                        {t("students.filters")}
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
                        />
                      </button>

                      <div className="hidden md:flex gap-3">
                        <select
                          value={selectedCourse}
                          onChange={(e) => { setSelectedCourse(e.target.value); setCurrentPage(1); }}
                          className="px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        >
                          <option value="all">{t("students.allCourses")}</option>
                          {courses.map((c) => (
                            <option key={c.id} value={c.id}>{locale === "ar" && c.titleAr ? c.titleAr : c.title}</option>
                          ))}
                        </select>
                        <select
                          value={selectedStatus}
                          onChange={(e) => setSelectedStatus(e.target.value)}
                          className="px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        >
                          {statusOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {showFilters && (
                      <div className="md:hidden mt-4 pt-4 border-t border-[var(--color-border)] space-y-3">
                        <select
                          value={selectedCourse}
                          onChange={(e) => { setSelectedCourse(e.target.value); setCurrentPage(1); }}
                          className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        >
                          <option value="all">{t("students.allCourses")}</option>
                          {courses.map((c) => (
                            <option key={c.id} value={c.id}>{locale === "ar" && c.titleAr ? c.titleAr : c.title}</option>
                          ))}
                        </select>
                        <select
                          value={selectedStatus}
                          onChange={(e) => setSelectedStatus(e.target.value)}
                          className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                        >
                          {statusOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Empty state */}
                  {filteredStudents.length === 0 && (
                    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-12 text-center">
                      <Users className="w-12 h-12 text-[var(--color-border)] mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                        {t("students.noStudents") || "No students found"}
                      </h3>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {t("students.noStudentsDesc") ||
                          "No students match your current filters."}
                      </p>
                    </div>
                  )}

                  {filteredStudents.length > 0 && (
                    <>
                      {/* Desktop Table */}
                      <div className="hidden md:block bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full table-fixed">
                            <thead>
                              <tr className="bg-[var(--color-surface-page)] border-b border-[var(--color-border)]">
                                <th className="px-3 py-3 text-start text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider" style={{ width: "28%" }}>
                                  <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-[var(--color-text-secondary)]">
                                    {t("students.tableStudent")}
                                    <ArrowUpDown className="w-3 h-3" />
                                  </button>
                                </th>
                                <th className="px-3 py-3 text-center text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider" style={{ width: "8%" }}>
                                  <button onClick={() => toggleSort("enrollments")} className="flex items-center gap-1 hover:text-[var(--color-text-secondary)]">
                                    {t("students.tableCourse") || "Courses"}
                                    <ArrowUpDown className="w-3 h-3" />
                                  </button>
                                </th>
                                <th className="px-3 py-3 text-start text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider" style={{ width: "18%" }}>
                                  <button onClick={() => toggleSort("progress")} className="flex items-center gap-1 hover:text-[var(--color-text-secondary)]">
                                    {t("students.tableProgress") || "Progress"}
                                    <ArrowUpDown className="w-3 h-3" />
                                  </button>
                                </th>
                                <th className="px-3 py-3 text-center text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider" style={{ width: "12%" }}>
                                  <button onClick={() => toggleSort("attendance")} className="flex items-center gap-1 hover:text-[var(--color-text-secondary)]">
                                    {t("students.tableAttendance")}
                                    <ArrowUpDown className="w-3 h-3" />
                                  </button>
                                </th>
                                <th className="px-3 py-3 text-center text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider" style={{ width: "12%" }}>
                                  {t("students.tableStatus")}
                                </th>
                                <th className="px-3 py-3 text-start text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider" style={{ width: "14%" }}>
                                  <button onClick={() => toggleSort("lastActive")} className="flex items-center gap-1 hover:text-[var(--color-text-secondary)]">
                                    {t("students.tableLastActivity")}
                                    <ArrowUpDown className="w-3 h-3" />
                                  </button>
                                </th>
                                <th className="px-2 py-3 text-center text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider" style={{ width: "5%" }}>
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border)]">
                              {paginatedStudents.map((student) => (
                                <tr
                                  key={student.studentId}
                                  className="hover:bg-[var(--color-border-subtle)] transition-colors"
                                >
                                  <td className="px-3 py-3">
                                    <div className="max-w-[200px]">
                                      <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate">
                                        {student.firstName || ""}{" "}
                                        {student.lastName || ""}
                                      </p>
                                      <p className="text-[11px] text-[var(--color-text-secondary)] truncate">
                                        {student.email}
                                      </p>
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    <span className="text-sm text-[var(--color-text-secondary)] font-medium">
                                      {student.totalEnrollments}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full ${
                                            student.averageProgress >= 80 ? "bg-[#22C55E]"
                                            : student.averageProgress >= 50 ? "bg-[#EAB308]"
                                            : "bg-[#EF4444]"
                                          }`}
                                          style={{ width: `${student.averageProgress}%` }}
                                        />
                                      </div>
                                      <span className={`text-xs font-semibold w-8 text-right ${getProgressStyle(student.averageProgress)}`}>
                                        {student.averageProgress}%
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    <span className={`text-xs font-semibold ${
                                      student.attendanceRate == null ? "text-[var(--color-text-secondary)]"
                                      : student.attendanceRate >= 80 ? "text-[#22C55E]"
                                      : student.attendanceRate >= 60 ? "text-[#EAB308]"
                                      : "text-[#EF4444]"
                                    }`}>
                                      {student.attendanceRate != null ? `${student.attendanceRate}%` : "–"}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3 text-center">
                                    <span className={`inline-block whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] font-medium ${getStatusStyle(student.riskStatus)}`}>
                                      {getStatusLabel(student.riskStatus)}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3">
                                    <span className="text-xs text-[var(--color-text-secondary)]">
                                      {formatLastActive(student.lastAccessedAt)}
                                    </span>
                                  </td>
                                  <td className="px-2 py-3 text-center">
                                    <Link
                                      href={`/${locale}/dashboard/instructor/students/${student.studentId}`}
                                      className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors inline-flex"
                                      title={t("students.viewProfile")}
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </Link>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
                          <p className="text-sm text-[var(--color-text-secondary)]">
                            {t("students.showing")}{" "}
                            {Math.min(
                              (currentPage - 1) * ITEMS_PER_PAGE + 1,
                              filteredStudents.length
                            )}
                            -
                            {Math.min(
                              currentPage * ITEMS_PER_PAGE,
                              filteredStudents.length
                            )}{" "}
                            {t("students.of")} {filteredStudents.length}{" "}
                            {t("students.students")}
                          </p>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                setCurrentPage(Math.max(1, currentPage - 1))
                              }
                              disabled={currentPage === 1}
                              className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isRTL ? (
                                <ChevronRight className="w-4 h-4" />
                              ) : (
                                <ChevronLeft className="w-4 h-4" />
                              )}
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                              (page) => (
                                <button
                                  key={page}
                                  onClick={() => setCurrentPage(page)}
                                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                                    currentPage === page
                                      ? "bg-[var(--color-primary)] text-white"
                                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                                  }`}
                                >
                                  {page}
                                </button>
                              )
                            )}
                            <button
                              onClick={() =>
                                setCurrentPage(Math.min(totalPages, currentPage + 1))
                              }
                              disabled={currentPage === totalPages}
                              className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isRTL ? (
                                <ChevronLeft className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Mobile Cards View */}
                      <div className="md:hidden space-y-3">
                        {paginatedStudents.map((student) => (
                          <div
                            key={student.studentId}
                            className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[var(--color-border)] flex items-center justify-center text-sm font-semibold text-[var(--color-text-secondary)]">
                                  {getInitials(student.firstName, student.lastName)}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                                    {student.firstName || ""}{" "}
                                    {student.lastName || ""}
                                  </p>
                                  <p className="text-xs text-[var(--color-text-secondary)]">
                                    {student.email}
                                  </p>
                                </div>
                              </div>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusStyle(student.riskStatus)}`}
                              >
                                {getStatusIcon(student.riskStatus)}
                                {getStatusLabel(student.riskStatus)}
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 mb-2">
                              <div className="text-center p-2 bg-[var(--color-surface-page)] rounded-lg">
                                <p className="text-sm font-semibold text-[var(--color-text-secondary)]">
                                  {student.totalEnrollments}
                                </p>
                                <p className="text-[10px] text-[var(--color-text-secondary)]">
                                  {t("students.tableCourse") || "Courses"}
                                </p>
                              </div>
                              <div className="text-center p-2 bg-[var(--color-surface-page)] rounded-lg">
                                <p
                                  className={`text-sm font-semibold ${getProgressStyle(student.averageProgress)}`}
                                >
                                  {student.averageProgress}%
                                </p>
                                <p className="text-[10px] text-[var(--color-text-secondary)]">
                                  {t("students.tableProgress") || "Progress"}
                                </p>
                              </div>
                              <div className="text-center p-2 bg-[var(--color-surface-page)] rounded-lg">
                                <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                                  {formatLastActive(student.lastAccessedAt)}
                                </p>
                                <p className="text-[10px] text-[var(--color-text-secondary)]">
                                  {t("students.tableLastActivity")}
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              <div className="text-center p-2 bg-[var(--color-surface-page)] rounded-lg">
                                <p
                                  className={`text-sm font-semibold ${
                                    student.attendanceRate == null
                                      ? "text-[var(--color-text-secondary)]"
                                      : getProgressStyle(student.attendanceRate)
                                  }`}
                                >
                                  {student.attendanceRate != null
                                    ? `${student.attendanceRate}%`
                                    : "-"}
                                </p>
                                <p className="text-[10px] text-[var(--color-text-secondary)]">
                                  {t("students.tableAttendance")}
                                </p>
                              </div>
                              <div className="text-center p-2 bg-[var(--color-surface-page)] rounded-lg">
                                <p
                                  className={`text-sm font-semibold ${
                                    student.assessmentAverage == null
                                      ? "text-[var(--color-text-secondary)]"
                                      : getProgressStyle(student.assessmentAverage)
                                  }`}
                                >
                                  {student.assessmentAverage != null
                                    ? `${student.assessmentAverage}%`
                                    : "-"}
                                </p>
                                <p className="text-[10px] text-[var(--color-text-secondary)]">
                                  {t("students.tableScore")}
                                </p>
                              </div>
                            </div>

                            <Link
                              href={`/${locale}/dashboard/instructor/students/${student.studentId}`}
                              className="flex items-center justify-center gap-1.5 w-full px-3 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                              {t("students.viewProfile")}
                            </Link>
                          </div>
                        ))}

                        {/* Mobile Pagination */}
                        <div className="flex items-center justify-between py-3">
                          <p className="text-sm text-[var(--color-text-secondary)]">
                            {currentPage} / {totalPages}
                          </p>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                setCurrentPage(Math.max(1, currentPage - 1))
                              }
                              disabled={currentPage === 1}
                              className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors disabled:opacity-50"
                            >
                              {isRTL ? (
                                <ChevronRight className="w-4 h-4" />
                              ) : (
                                <ChevronLeft className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() =>
                                setCurrentPage(
                                  Math.min(totalPages, currentPage + 1)
                                )
                              }
                              disabled={currentPage === totalPages}
                              className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors disabled:opacity-50"
                            >
                              {isRTL ? (
                                <ChevronLeft className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
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

export default StudentsContent;
