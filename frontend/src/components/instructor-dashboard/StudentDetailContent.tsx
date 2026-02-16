"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import InstructorNavbar from "./InstructorNavbar";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import { useInstructorProfile } from "@/hooks/useInstructorProfile";
import {
  ArrowLeft,
  ArrowRight,
  Mail,
  MessageSquare,
  Phone,
  Calendar,
  Clock,
  BookOpen,
  Award,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AlertTriangle,
  UserX,
  FileText,
  Video,
  ChevronRight,
  MoreVertical,
} from "lucide-react";

interface StudentDetailContentProps {
  studentId: string;
}

const StudentDetailContent = ({ studentId }: StudentDetailContentProps) => {
  const instructor = useInstructorProfile();
  const t = useTranslations("instructorDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [activeTab, setActiveTab] = useState<
    "overview" | "attendance" | "assessments" | "activity"
  >("overview");

  // Mock student data
  const student = {
    id: studentId,
    name: "Sarah Johnson",
    initials: "SJ",
    email: "sarah.johnson@email.com",
    phone: "+1 234 567 8900",
    status: "good" as const,
    enrolledDate: "Jan 15, 2024",
    lastActivity: "2 hours ago",
    courses: [
      {
        id: "1",
        name: "Lower Back Pain Management",
        progress: 75,
        attendance: 95,
        score: 88,
        status: "in-progress",
      },
      {
        id: "2",
        name: "Sports Rehabilitation",
        progress: 100,
        attendance: 92,
        score: 91,
        status: "completed",
      },
    ],
    stats: {
      totalCourses: 2,
      completedCourses: 1,
      averageAttendance: 94,
      averageScore: 89,
      totalHours: 45,
      certificates: 1,
    },
    attendanceHistory: [
      { date: "Feb 5, 2024", session: "Module 5: Advanced Techniques", status: "present" },
      { date: "Feb 3, 2024", session: "Module 4: Case Studies", status: "present" },
      { date: "Jan 31, 2024", session: "Module 3: Assessment Methods", status: "present" },
      { date: "Jan 28, 2024", session: "Module 2: Core Principles", status: "absent" },
      { date: "Jan 25, 2024", session: "Module 1: Introduction", status: "present" },
    ],
    assessments: [
      { id: "1", title: "Module 5 Quiz", score: 92, maxScore: 100, date: "Feb 5, 2024", status: "passed" },
      { id: "2", title: "Mid-term Assessment", score: 85, maxScore: 100, date: "Jan 30, 2024", status: "passed" },
      { id: "3", title: "Module 3 Quiz", score: 78, maxScore: 100, date: "Jan 28, 2024", status: "passed" },
      { id: "4", title: "Case Study Analysis", score: 88, maxScore: 100, date: "Jan 25, 2024", status: "passed" },
    ],
    activityLog: [
      { id: "1", action: "Completed Module 5 Quiz", timestamp: "2 hours ago", type: "assessment" },
      { id: "2", action: "Attended live session: Advanced Techniques", timestamp: "3 hours ago", type: "session" },
      { id: "3", action: "Downloaded course materials", timestamp: "1 day ago", type: "content" },
      { id: "4", action: "Completed Module 4 video", timestamp: "2 days ago", type: "video" },
      { id: "5", action: "Submitted assignment", timestamp: "3 days ago", type: "assignment" },
    ],
  };

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

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "assessment":
        return <FileText className="w-4 h-4 text-[#3B82F6]" />;
      case "session":
        return <Video className="w-4 h-4 text-[#22C55E]" />;
      case "content":
        return <BookOpen className="w-4 h-4 text-[#8B5CF6]" />;
      case "video":
        return <Video className="w-4 h-4 text-[#F97316]" />;
      default:
        return <FileText className="w-4 h-4 text-[#6B7280]" />;
    }
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
            {/* Left Sidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <InstructorSidebar instructor={instructor} />
            </div>
            <InstructorMobileSidebar instructor={instructor} />

            {/* Main Content */}
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

              {/* Student Header Card */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-full bg-[#E5E7EB] flex items-center justify-center text-xl font-bold text-[#4B5563]">
                      {student.initials}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-xl md:text-2xl font-bold text-[#1F2937]">
                          {student.name}
                        </h1>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(student.status)}`}
                        >
                          {getStatusIcon(student.status)}
                          {t(`students.status${student.status.charAt(0).toUpperCase() + student.status.slice(1)}`)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#6B7280]">
                        <span className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {student.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          {student.phone}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-[#9CA3AF]">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {t("studentDetail.enrolled")}: {student.enrolledDate}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {t("studentDetail.lastActive")}: {student.lastActivity}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex gap-2">
                    <button className="flex items-center gap-2 px-4 py-2 btn-gold text-white rounded-lg transition-colors text-sm font-medium">
                      <Mail className="w-4 h-4" />
                      {t("studentDetail.sendEmail")}
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors text-sm font-medium text-[#374151]">
                      <MessageSquare className="w-4 h-4" />
                      {t("studentDetail.sendMessage")}
                    </button>
                  </div>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 text-center">
                  <div className="w-10 h-10 mx-auto rounded-lg bg-[#DBEAFE] flex items-center justify-center mb-2">
                    <BookOpen className="w-5 h-5 text-[#3B82F6]" />
                  </div>
                  <p className="text-2xl font-bold text-[#1F2937]">
                    {student.stats.totalCourses}
                  </p>
                  <p className="text-xs text-[#6B7280]">{t("studentDetail.totalCourses")}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 text-center">
                  <div className="w-10 h-10 mx-auto rounded-lg bg-[#DCFCE7] flex items-center justify-center mb-2">
                    <CheckCircle className="w-5 h-5 text-[#22C55E]" />
                  </div>
                  <p className="text-2xl font-bold text-[#1F2937]">
                    {student.stats.completedCourses}
                  </p>
                  <p className="text-xs text-[#6B7280]">{t("studentDetail.completed")}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 text-center">
                  <div className="w-10 h-10 mx-auto rounded-lg bg-[#FEF9C3] flex items-center justify-center mb-2">
                    <TrendingUp className="w-5 h-5 text-[#EAB308]" />
                  </div>
                  <p className="text-2xl font-bold text-[#1F2937]">
                    {student.stats.averageAttendance}%
                  </p>
                  <p className="text-xs text-[#6B7280]">{t("studentDetail.avgAttendance")}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 text-center">
                  <div className="w-10 h-10 mx-auto rounded-lg bg-[#E0E7FF] flex items-center justify-center mb-2">
                    <FileText className="w-5 h-5 text-[#6366F1]" />
                  </div>
                  <p className="text-2xl font-bold text-[#1F2937]">
                    {student.stats.averageScore}%
                  </p>
                  <p className="text-xs text-[#6B7280]">{t("studentDetail.avgScore")}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 text-center">
                  <div className="w-10 h-10 mx-auto rounded-lg bg-[#FCE7F3] flex items-center justify-center mb-2">
                    <Clock className="w-5 h-5 text-[#EC4899]" />
                  </div>
                  <p className="text-2xl font-bold text-[#1F2937]">
                    {student.stats.totalHours}h
                  </p>
                  <p className="text-xs text-[#6B7280]">{t("studentDetail.totalHours")}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 text-center">
                  <div className="w-10 h-10 mx-auto rounded-lg bg-[#FEF3C7] flex items-center justify-center mb-2">
                    <Award className="w-5 h-5 text-[#D4A520]" />
                  </div>
                  <p className="text-2xl font-bold text-[#1F2937]">
                    {student.stats.certificates}
                  </p>
                  <p className="text-xs text-[#6B7280]">{t("studentDetail.certificates")}</p>
                </div>
              </div>

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
                      <div className="space-y-4">
                        {student.courses.map((course) => (
                          <div
                            key={course.id}
                            className="p-4 border border-[#E5E7EB] rounded-xl hover:bg-[#F9FAFB] transition-colors"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h4 className="text-sm font-semibold text-[#1F2937]">
                                  {course.name}
                                </h4>
                                <span
                                  className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                    course.status === "completed"
                                      ? "bg-[#DCFCE7] text-[#22C55E]"
                                      : "bg-[#DBEAFE] text-[#3B82F6]"
                                  }`}
                                >
                                  {course.status === "completed"
                                    ? t("studentDetail.courseCompleted")
                                    : t("studentDetail.courseInProgress")}
                                </span>
                              </div>
                              <Link
                                href={`/${locale}/dashboard/instructor/courses/${course.id}`}
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
                                <span>{course.progress}%</span>
                              </div>
                              <div className="h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#3B82F6] rounded-full transition-all"
                                  style={{ width: `${course.progress}%` }}
                                />
                              </div>
                            </div>

                            {/* Course Stats */}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-[#DCFCE7] flex items-center justify-center">
                                  <TrendingUp className="w-4 h-4 text-[#22C55E]" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-[#1F2937]">
                                    {course.attendance}%
                                  </p>
                                  <p className="text-xs text-[#6B7280]">
                                    {t("studentDetail.attendance")}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-[#E0E7FF] flex items-center justify-center">
                                  <FileText className="w-4 h-4 text-[#6366F1]" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-[#1F2937]">
                                    {course.score}%
                                  </p>
                                  <p className="text-xs text-[#6B7280]">
                                    {t("studentDetail.assessmentScore")}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Attendance Tab */}
                  {activeTab === "attendance" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold text-[#1F2937]">
                          {t("studentDetail.attendanceHistory")}
                        </h3>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]" />
                            {t("studentDetail.present")}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                            {t("studentDetail.absent")}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {student.attendanceHistory.map((record, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-4 bg-[#F9FAFB] rounded-xl"
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`w-3 h-3 rounded-full ${
                                  record.status === "present"
                                    ? "bg-[#22C55E]"
                                    : "bg-[#EF4444]"
                                }`}
                              />
                              <div>
                                <p className="text-sm font-medium text-[#1F2937]">
                                  {record.session}
                                </p>
                                <p className="text-xs text-[#6B7280]">{record.date}</p>
                              </div>
                            </div>
                            <span
                              className={`text-xs font-medium ${
                                record.status === "present"
                                  ? "text-[#22C55E]"
                                  : "text-[#EF4444]"
                              }`}
                            >
                              {record.status === "present"
                                ? t("studentDetail.present")
                                : t("studentDetail.absent")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assessments Tab */}
                  {activeTab === "assessments" && (
                    <div className="space-y-4">
                      <h3 className="text-base font-semibold text-[#1F2937]">
                        {t("studentDetail.assessmentResults")}
                      </h3>

                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="text-left">
                              <th className="pb-3 text-xs font-semibold text-[#6B7280] uppercase">
                                {t("studentDetail.assessmentName")}
                              </th>
                              <th className="pb-3 text-xs font-semibold text-[#6B7280] uppercase">
                                {t("studentDetail.date")}
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
                            {student.assessments.map((assessment) => (
                              <tr key={assessment.id} className="hover:bg-[#F9FAFB]">
                                <td className="py-3 text-sm text-[#1F2937]">
                                  {assessment.title}
                                </td>
                                <td className="py-3 text-sm text-[#6B7280]">
                                  {assessment.date}
                                </td>
                                <td className="py-3">
                                  <span
                                    className={`text-sm font-semibold ${
                                      assessment.score >= 80
                                        ? "text-[#22C55E]"
                                        : assessment.score >= 60
                                          ? "text-[#EAB308]"
                                          : "text-[#EF4444]"
                                    }`}
                                  >
                                    {assessment.score}/{assessment.maxScore}
                                  </span>
                                </td>
                                <td className="py-3">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                      assessment.status === "passed"
                                        ? "bg-[#DCFCE7] text-[#22C55E]"
                                        : "bg-[#FEE2E2] text-[#EF4444]"
                                    }`}
                                  >
                                    {assessment.status === "passed" ? (
                                      <CheckCircle className="w-3 h-3" />
                                    ) : (
                                      <TrendingDown className="w-3 h-3" />
                                    )}
                                    {assessment.status === "passed"
                                      ? t("studentDetail.passed")
                                      : t("studentDetail.failed")}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Activity Tab */}
                  {activeTab === "activity" && (
                    <div className="space-y-4">
                      <h3 className="text-base font-semibold text-[#1F2937]">
                        {t("studentDetail.recentActivity")}
                      </h3>

                      <div className="space-y-3">
                        {student.activityLog.map((activity) => (
                          <div
                            key={activity.id}
                            className="flex items-center gap-3 p-3 bg-[#F9FAFB] rounded-xl"
                          >
                            <div className="w-9 h-9 rounded-lg bg-white border border-[#E5E7EB] flex items-center justify-center">
                              {getActivityIcon(activity.type)}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm text-[#1F2937]">{activity.action}</p>
                              <p className="text-xs text-[#9CA3AF]">
                                {activity.timestamp}
                              </p>
                            </div>
                            <button className="p-2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default StudentDetailContent;
