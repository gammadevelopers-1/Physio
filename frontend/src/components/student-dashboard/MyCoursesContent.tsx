"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  ClipboardList,
  Heart,
  Loader2,
  Clock,
  AlertTriangle,
  Video,
  BookOpen,
  ClipboardCheck,
  Play,
  Award,
  UserCheck,
} from "lucide-react";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import { useFavourites } from "@/contexts/FavouritesContext";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { useStudentCourses } from "@/hooks/useStudentCourses";
import type { StudentEnrolledCourse } from "@/types/student-dashboard";

type TabFilter = "all" | "active" | "completed" | "upcoming";

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const absDiff = Math.abs(diff);
  const minutes = Math.floor(absDiff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function deadlineInfo(dateStr: string | null): {
  label: string;
  color: string;
  isOverdue: boolean;
} | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff < 0) return { label: "Overdue", color: "text-red-600 bg-red-50", isOverdue: true };
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days === 0) return { label: `Due in ${hours}h`, color: "text-amber-600 bg-amber-50", isOverdue: false };
  if (days <= 3) return { label: `Due in ${days}d`, color: "text-amber-600 bg-amber-50", isOverdue: false };
  return null;
}

const getSortForTab = (tab: TabFilter): string | undefined => {
  switch (tab) {
    case "active":
      return "recent";
    case "completed":
      return "completed_date";
    case "upcoming":
      return "start_date";
    default:
      return undefined;
  }
};

const getStatusForTab = (tab: TabFilter): string | undefined => {
  switch (tab) {
    case "active":
      return "active";
    case "completed":
      return "completed";
    case "upcoming":
      return "active";
    default:
      return undefined;
  }
};

const MyCoursesContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const { isFavourite, toggleFavourite } = useFavourites();
  const userData = useStudentProfile();

  const { data: courses, loading } = useStudentCourses({
    status: getStatusForTab(activeTab),
    sort: getSortForTab(activeTab),
    limit: 50,
  });

  // For "upcoming" tab, client-side filter: progress === 0 and future start date
  const filteredCourses = useMemo(() => {
    if (activeTab !== "upcoming") return courses;
    return courses.filter(
      (c) =>
        c.progress === 0 &&
        c.startDate &&
        new Date(c.startDate) > new Date()
    );
  }, [courses, activeTab]);

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "all", label: t("myCourses.tabs.all") },
    { key: "active", label: t("myCourses.tabs.inProgress") },
    { key: "completed", label: t("myCourses.tabs.completed") },
    { key: "upcoming", label: t("myCourses.tabs.upcoming") },
  ];

  const getActionButton = (course: StudentEnrolledCourse) => {
    if (course.enrollmentStatus === "completed") {
      return {
        label: t("myCourses.viewCertificate"),
        href: `/${locale}/dashboard/student/certificates`,
        className: "bg-[#8B5CF6] text-white hover:bg-[#7C3AED]",
        icon: Award,
      };
    }

    switch (course.nextAction) {
      case "join_zoom":
        return {
          label: t("myCourses.joinSession"),
          href: `/${locale}/dashboard/student/courses/${course.id}/learn`,
          className: "bg-[#002D87] text-white hover:bg-[#001F5C]",
          icon: Video,
        };
      case "take_quiz":
        return {
          label: t("myCourses.takeAssessment"),
          href: `/${locale}/dashboard/student/courses/${course.id}/learn`,
          className: "btn-gold text-white hover:opacity-90",
          icon: ClipboardCheck,
        };
      case "resume_lesson":
        return {
          label: t("myCourses.continueLearning"),
          href: `/${locale}/dashboard/student/courses/${course.id}/learn`,
          className: "bg-[#16A34A] text-white hover:bg-[#15803D]",
          icon: Play,
        };
      default:
        return {
          label: t("myCourses.startCourse"),
          href: `/${locale}/dashboard/student/courses/${course.id}/learn`,
          className: "bg-[#1F2937] text-white hover:bg-[#111827]",
          icon: BookOpen,
        };
    }
  };

  return (
    <>
      <DashboardNavbar user={userData} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <DashboardSidebar user={userData} />
            </div>

            <MobileSidebar user={userData} />

            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937] mb-4 sm:mb-6">
                {t("myCourses.title")}
              </h1>

              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 sm:p-6">
                <h2 className="text-base sm:text-lg font-semibold text-[#1F2937] mb-4">
                  {t("myCourses.recentCourses")}
                </h2>

                {/* Tabs */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                        activeTab === tab.key
                          ? "bg-[#1F2937] text-white"
                          : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Loading */}
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 text-[#9CA3AF] animate-spin" />
                  </div>
                ) : filteredCourses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 sm:py-16">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-3 sm:mb-4">
                      <ClipboardList className="w-6 h-6 sm:w-8 sm:h-8 text-[#9CA3AF]" />
                    </div>
                    <h3 className="text-sm sm:text-base font-medium text-[#1F2937] mb-1">
                      {t("myCourses.noCoursesTitle")}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#6B7280] mb-4 sm:mb-6 text-center px-4">
                      {t("myCourses.noCoursesDescription")}
                    </p>
                    <Link
                      href={`/${locale}/courses`}
                      className="px-5 py-2 sm:px-6 sm:py-2.5 btn-gold text-white text-xs sm:text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                    >
                      {t("myCourses.viewCourses")}
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {filteredCourses.map((course) => {
                      const action = getActionButton(course);
                      const ActionIcon = action.icon;
                      const deadline = deadlineInfo(course.nextDeadline);
                      const completedModules =
                        course.totalModules > 0
                          ? Math.round(
                              (course.progress / 100) * course.totalModules
                            )
                          : 0;

                      return (
                        <div
                          key={course.id}
                          className="border border-[#E5E7EB] rounded-xl overflow-hidden relative"
                        >
                          {/* Favourite Button */}
                          <button
                            onClick={() =>
                              toggleFavourite({
                                id: course.id,
                                title: course.title,
                                thumbnail:
                                  course.thumbnail ||
                                  "/student_dashboard/courses/image 473.svg",
                                progress: course.progress,
                                status:
                                  course.enrollmentStatus === "completed"
                                    ? "completed"
                                    : "in_progress",
                              })
                            }
                            className={`absolute top-2 ${isRTL ? "left-2" : "right-2"} z-10 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-50 transition-colors`}
                            aria-label={
                              isFavourite(course.id)
                                ? t("favourites.removeFromFavourites")
                                : t("favourites.addToFavourites")
                            }
                          >
                            <Heart
                              className={`w-4 h-4 ${isFavourite(course.id) ? "text-red-500 fill-red-500" : "text-gray-400"}`}
                            />
                          </button>

                          {/* Deadline Badge */}
                          {deadline && (
                            <div
                              className={`absolute top-2 ${isRTL ? "right-2" : "left-2"} z-10 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium ${deadline.color}`}
                            >
                              <AlertTriangle className="w-3 h-3" />
                              {deadline.label}
                            </div>
                          )}

                          {/* Thumbnail */}
                          <div className="w-full h-[120px] sm:h-[140px] bg-gray-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={
                                course.thumbnail ||
                                "/student_dashboard/courses/image 473.svg"
                              }
                              alt={course.title}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          {/* Course Info */}
                          <div className="p-3 sm:p-4">
                            {/* Title */}
                            <h3 className="text-xs sm:text-sm font-semibold text-[#1F2937] mb-2 line-clamp-2">
                              {isRTL && course.titleAr
                                ? course.titleAr
                                : course.title}
                            </h3>

                            {/* Instructor Row */}
                            <div className="flex items-center gap-2 mb-2">
                              {course.instructorAvatar ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={course.instructorAvatar}
                                  alt={course.instructorName}
                                  className="w-5 h-5 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-[#E5E7EB] flex items-center justify-center">
                                  <span className="text-[8px] font-medium text-[#6B7280]">
                                    {course.instructorName
                                      ?.split(" ")
                                      .map((n) => n[0])
                                      .join("")
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </span>
                                </div>
                              )}
                              <span className="text-[10px] sm:text-xs text-[#6B7280] truncate">
                                {course.instructorName}
                              </span>
                            </div>

                            {/* Progress Bar */}
                            <div className="mb-2">
                              <div
                                className={`flex items-center justify-between text-[10px] sm:text-xs mb-1 ${isRTL ? "flex-row-reverse" : ""}`}
                              >
                                <span className="text-[#6B7280]">
                                  {completedModules} / {course.totalModules}{" "}
                                  {t("myCourses.modulesCompleted")}
                                </span>
                                <span className="font-medium text-[#1F2937]">
                                  {course.progress}%
                                </span>
                              </div>
                              <div className="h-1.5 sm:h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                                <div
                                  className={`h-full bg-[#16A34A] rounded-full transition-all duration-300 ${isRTL ? "ms-auto" : ""}`}
                                  style={{
                                    width: `${course.progress}%`,
                                  }}
                                />
                              </div>
                            </div>

                            {/* Info Row: Attendance + Missing Tasks */}
                            <div className="flex items-center gap-3 mb-3 text-[10px] sm:text-xs">
                              {/* Attendance */}
                              {course.totalSessions > 0 && (
                                <span
                                  className={`flex items-center gap-1 ${
                                    course.attendanceRate >= 70
                                      ? "text-[#16A34A]"
                                      : "text-red-500"
                                  }`}
                                >
                                  <UserCheck className="w-3 h-3" />
                                  {course.attendanceRate}%
                                </span>
                              )}

                              {/* Missing Tasks */}
                              {course.missingTasksCount > 0 && (
                                <span className="flex items-center gap-1 text-red-500">
                                  <ClipboardCheck className="w-3 h-3" />
                                  {course.missingTasksCount}{" "}
                                  {t("myCourses.missingItems")}
                                </span>
                              )}

                              {/* Last Accessed */}
                              {course.lastAccessedAt && (
                                <span className="flex items-center gap-1 text-[#9CA3AF]">
                                  <Clock className="w-3 h-3" />
                                  {relativeTime(course.lastAccessedAt)}
                                </span>
                              )}
                            </div>

                            {/* Action Button */}
                            <Link
                              href={action.href}
                              className={`flex items-center justify-center gap-1.5 w-full py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${action.className}`}
                            >
                              <ActionIcon className="w-3.5 h-3.5" />
                              {action.label}
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MyCoursesContent;
