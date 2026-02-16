"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import InstructorNavbar from "./InstructorNavbar";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import { useInstructorProfile } from "@/hooks/useInstructorProfile";
import {
  Search,
  Filter,
  ChevronDown,
  MoreVertical,
  Mail,
  MessageSquare,
  Eye,
  Users,
  AlertTriangle,
  UserX,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface Student {
  id: string;
  name: string;
  avatar?: string;
  initials: string;
  email: string;
  course: string;
  attendance: number;
  assessmentScore: number;
  status: "good" | "at-risk" | "inactive";
  lastActivity: string;
}

const StudentsContent = () => {
  const instructor = useInstructorProfile();
  const t = useTranslations("instructorDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedAttendance, setSelectedAttendance] = useState("all");
  const [selectedScore, setSelectedScore] = useState("all");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Mock data
  const courses = [
    { id: "all", name: t("students.allCourses") },
    { id: "course1", name: "Lower Back Pain Management" },
    { id: "course2", name: "Sports Rehabilitation" },
    { id: "course3", name: "Pediatric Physiotherapy" },
  ];

  const statusOptions = [
    { id: "all", name: t("students.allStatuses") },
    { id: "good", name: t("students.statusGood") },
    { id: "at-risk", name: t("students.statusAtRisk") },
    { id: "inactive", name: t("students.statusInactive") },
  ];

  const attendanceOptions = [
    { id: "all", name: t("students.allAttendance") },
    { id: "above90", name: "> 90%" },
    { id: "70-90", name: "70% - 90%" },
    { id: "below70", name: "< 70%" },
  ];

  const scoreOptions = [
    { id: "all", name: t("students.allScores") },
    { id: "above80", name: "> 80%" },
    { id: "60-80", name: "60% - 80%" },
    { id: "below60", name: "< 60%" },
  ];

  const students: Student[] = [
    {
      id: "1",
      name: "Sarah Johnson",
      initials: "SJ",
      email: "sarah.j@email.com",
      course: "Lower Back Pain Management",
      attendance: 95,
      assessmentScore: 88,
      status: "good",
      lastActivity: "2 hours ago",
    },
    {
      id: "2",
      name: "Ahmed Al-Hassan",
      initials: "AH",
      email: "ahmed.h@email.com",
      course: "Sports Rehabilitation",
      attendance: 72,
      assessmentScore: 65,
      status: "at-risk",
      lastActivity: "1 day ago",
    },
    {
      id: "3",
      name: "Maria Garcia",
      initials: "MG",
      email: "maria.g@email.com",
      course: "Lower Back Pain Management",
      attendance: 45,
      assessmentScore: 52,
      status: "inactive",
      lastActivity: "2 weeks ago",
    },
    {
      id: "4",
      name: "James Wilson",
      initials: "JW",
      email: "james.w@email.com",
      course: "Pediatric Physiotherapy",
      attendance: 98,
      assessmentScore: 92,
      status: "good",
      lastActivity: "30 minutes ago",
    },
    {
      id: "5",
      name: "Fatima Al-Rashid",
      initials: "FR",
      email: "fatima.r@email.com",
      course: "Sports Rehabilitation",
      attendance: 68,
      assessmentScore: 71,
      status: "at-risk",
      lastActivity: "3 days ago",
    },
    {
      id: "6",
      name: "Michael Chen",
      initials: "MC",
      email: "michael.c@email.com",
      course: "Lower Back Pain Management",
      attendance: 88,
      assessmentScore: 85,
      status: "good",
      lastActivity: "5 hours ago",
    },
  ];

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

  const getAttendanceStyle = (attendance: number) => {
    if (attendance >= 90) return "text-[#22C55E]";
    if (attendance >= 70) return "text-[#EAB308]";
    return "text-[#EF4444]";
  };

  const getScoreStyle = (score: number) => {
    if (score >= 80) return "text-[#22C55E]";
    if (score >= 60) return "text-[#EAB308]";
    return "text-[#EF4444]";
  };

  const toggleSelectAll = () => {
    if (selectedStudents.length === students.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(students.map((s) => s.id));
    }
  };

  const toggleSelectStudent = (studentId: string) => {
    if (selectedStudents.includes(studentId)) {
      setSelectedStudents(selectedStudents.filter((id) => id !== studentId));
    } else {
      setSelectedStudents([...selectedStudents, studentId]);
    }
  };

  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCourse =
      selectedCourse === "all" ||
      student.course
        .toLowerCase()
        .includes(
          courses.find((c) => c.id === selectedCourse)?.name.toLowerCase() || ""
        );
    const matchesStatus =
      selectedStatus === "all" || student.status === selectedStatus;

    return matchesSearch && matchesCourse && matchesStatus;
  });

  // Stats
  const totalStudents = students.length;
  const goodStudents = students.filter((s) => s.status === "good").length;
  const atRiskStudents = students.filter((s) => s.status === "at-risk").length;
  const inactiveStudents = students.filter(
    (s) => s.status === "inactive"
  ).length;

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
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-[#1F2937]">
                    {t("students.title")}
                  </h1>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {t("students.subtitle")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="flex items-center gap-2 px-4 py-2 btn-gold text-white rounded-lg transition-colors text-sm font-medium">
                    <Mail className="w-4 h-4" />
                    {t("students.bulkEmail")}
                  </button>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#DBEAFE] flex items-center justify-center">
                      <Users className="w-5 h-5 text-[#3B82F6]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[#1F2937]">
                        {totalStudents}
                      </p>
                      <p className="text-xs text-[#6B7280]">
                        {t("students.totalStudents")}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#DCFCE7] flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-[#22C55E]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[#1F2937]">{goodStudents}</p>
                      <p className="text-xs text-[#6B7280]">
                        {t("students.goodStatus")}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#FEF9C3] flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-[#EAB308]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[#1F2937]">
                        {atRiskStudents}
                      </p>
                      <p className="text-xs text-[#6B7280]">
                        {t("students.atRiskStatus")}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#FEE2E2] flex items-center justify-center">
                      <UserX className="w-5 h-5 text-[#EF4444]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[#1F2937]">
                        {inactiveStudents}
                      </p>
                      <p className="text-xs text-[#6B7280]">
                        {t("students.inactiveStatus")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Search and Filters */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  {/* Search */}
                  <div className="relative flex-1">
                    <Search
                      className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] ${isRTL ? "right-3" : "left-3"}`}
                    />
                    <input
                      type="text"
                      placeholder={t("students.searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"}`}
                    />
                  </div>

                  {/* Filter Toggle (Mobile) */}
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="md:hidden flex items-center justify-center gap-2 px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] hover:bg-[#F9FAFB]"
                  >
                    <Filter className="w-4 h-4" />
                    {t("students.filters")}
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
                    />
                  </button>

                  {/* Desktop Filters */}
                  <div className="hidden md:flex gap-3">
                    <select
                      value={selectedCourse}
                      onChange={(e) => setSelectedCourse(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      {statusOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedAttendance}
                      onChange={(e) => setSelectedAttendance(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      {attendanceOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedScore}
                      onChange={(e) => setSelectedScore(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      {scoreOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Mobile Filters */}
                {showFilters && (
                  <div className="md:hidden mt-4 pt-4 border-t border-[#E5E7EB] grid grid-cols-2 gap-3">
                    <select
                      value={selectedCourse}
                      onChange={(e) => setSelectedCourse(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      {statusOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedAttendance}
                      onChange={(e) => setSelectedAttendance(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      {attendanceOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedScore}
                      onChange={(e) => setSelectedScore(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      {scoreOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Bulk Actions */}
              {selectedStudents.length > 0 && (
                <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <p className="text-sm text-[#1D4ED8]">
                    {selectedStudents.length} {t("students.selected")}
                  </p>
                  <div className="flex gap-2">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#BFDBFE] rounded-lg text-sm text-[#1D4ED8] hover:bg-[#DBEAFE] transition-colors">
                      <Mail className="w-4 h-4" />
                      {t("students.sendEmail")}
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#BFDBFE] rounded-lg text-sm text-[#1D4ED8] hover:bg-[#DBEAFE] transition-colors">
                      <MessageSquare className="w-4 h-4" />
                      {t("students.sendMessage")}
                    </button>
                  </div>
                </div>
              )}

              {/* Students Table */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                        <th className="px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={selectedStudents.length === students.length}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded border-[#D1D5DB] text-[#3B82F6] focus:ring-[#3B82F6]"
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                          {t("students.tableStudent")}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                          {t("students.tableCourse")}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                          {t("students.tableAttendance")}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                          {t("students.tableScore")}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                          {t("students.tableStatus")}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                          {t("students.tableLastActivity")}
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                          {t("students.tableActions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {filteredStudents.map((student) => (
                        <tr
                          key={student.id}
                          className="hover:bg-[#F9FAFB] transition-colors"
                        >
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              checked={selectedStudents.includes(student.id)}
                              onChange={() => toggleSelectStudent(student.id)}
                              className="w-4 h-4 rounded border-[#D1D5DB] text-[#3B82F6] focus:ring-[#3B82F6]"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-[#E5E7EB] flex items-center justify-center text-sm font-semibold text-[#4B5563]">
                                {student.initials}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-[#1F2937]">
                                  {student.name}
                                </p>
                                <p className="text-xs text-[#6B7280]">{student.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-sm text-[#374151] max-w-[180px] truncate">
                              {student.course}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`text-sm font-semibold ${getAttendanceStyle(student.attendance)}`}
                            >
                              {student.attendance}%
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`text-sm font-semibold ${getScoreStyle(student.assessmentScore)}`}
                            >
                              {student.assessmentScore}%
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusStyle(student.status)}`}
                            >
                              {getStatusIcon(student.status)}
                              {t(`students.status${student.status.charAt(0).toUpperCase() + student.status.slice(1).replace("-", "")}`)}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-sm text-[#6B7280]">
                              {student.lastActivity}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1">
                              <Link
                                href={`/${locale}/dashboard/instructor/students/${student.id}`}
                                className="p-2 text-[#6B7280] hover:text-[#3B82F6] hover:bg-[#EFF6FF] rounded-lg transition-colors"
                                title={t("students.viewProfile")}
                              >
                                <Eye className="w-4 h-4" />
                              </Link>
                              <button
                                className="p-2 text-[#6B7280] hover:text-[#3B82F6] hover:bg-[#EFF6FF] rounded-lg transition-colors"
                                title={t("students.sendEmail")}
                              >
                                <Mail className="w-4 h-4" />
                              </button>
                              <button className="p-2 text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E7EB]">
                  <p className="text-sm text-[#6B7280]">
                    {t("students.showing")} {filteredStudents.length}{" "}
                    {t("students.of")} {students.length} {t("students.students")}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="p-2 text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isRTL ? (
                        <ChevronRight className="w-4 h-4" />
                      ) : (
                        <ChevronLeft className="w-4 h-4" />
                      )}
                    </button>
                    <span className="px-3 py-1 text-sm text-[#374151]">
                      {currentPage}
                    </span>
                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      className="p-2 text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6] rounded-lg transition-colors"
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
                {filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className="bg-white rounded-xl border border-[#E5E7EB] p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(student.id)}
                          onChange={() => toggleSelectStudent(student.id)}
                          className="w-4 h-4 rounded border-[#D1D5DB] text-[#3B82F6] focus:ring-[#3B82F6]"
                        />
                        <div className="w-10 h-10 rounded-full bg-[#E5E7EB] flex items-center justify-center text-sm font-semibold text-[#4B5563]">
                          {student.initials}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#1F2937]">
                            {student.name}
                          </p>
                          <p className="text-xs text-[#6B7280]">{student.email}</p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusStyle(student.status)}`}
                      >
                        {getStatusIcon(student.status)}
                        {t(`students.status${student.status.charAt(0).toUpperCase() + student.status.slice(1).replace("-", "")}`)}
                      </span>
                    </div>

                    <p className="text-xs text-[#6B7280] mb-3 truncate">
                      {student.course}
                    </p>

                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="text-center p-2 bg-[#F9FAFB] rounded-lg">
                        <p
                          className={`text-sm font-semibold ${getAttendanceStyle(student.attendance)}`}
                        >
                          {student.attendance}%
                        </p>
                        <p className="text-[10px] text-[#6B7280]">
                          {t("students.tableAttendance")}
                        </p>
                      </div>
                      <div className="text-center p-2 bg-[#F9FAFB] rounded-lg">
                        <p
                          className={`text-sm font-semibold ${getScoreStyle(student.assessmentScore)}`}
                        >
                          {student.assessmentScore}%
                        </p>
                        <p className="text-[10px] text-[#6B7280]">
                          {t("students.tableScore")}
                        </p>
                      </div>
                      <div className="text-center p-2 bg-[#F9FAFB] rounded-lg">
                        <p className="text-sm font-medium text-[#374151]">
                          {student.lastActivity.split(" ")[0]}
                        </p>
                        <p className="text-[10px] text-[#6B7280]">
                          {t("students.tableLastActivity")}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Link
                        href={`/${locale}/dashboard/instructor/students/${student.id}`}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#3B82F6] text-white rounded-lg text-sm font-medium hover:bg-[#2563EB] transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        {t("students.viewProfile")}
                      </Link>
                      <button className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] transition-colors">
                        <Mail className="w-4 h-4" />
                      </button>
                      <button className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default StudentsContent;
