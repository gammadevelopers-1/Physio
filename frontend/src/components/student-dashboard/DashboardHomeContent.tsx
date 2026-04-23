"use client";

import { useTranslations } from "next-intl";
import DashboardSidebar from "./DashboardSidebar";
import DashboardStats from "./DashboardStats";
import RecentCourses from "./RecentCourses";
import NotificationsPanel from "./NotificationsPanel";
import CalendarPanel from "./CalendarPanel";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { useStudentDashboard } from "@/hooks/useStudentDashboard";
import { useStudentCourses } from "@/hooks/useStudentCourses";
import { useStudentCalendar } from "@/hooks/useStudentCalendar";
import { useStudentRecentActivity } from "@/hooks/useStudentRecentActivity";
import StudentDashboardHomeSkeleton from "./StudentDashboardHomeSkeleton";
import StudentDashboardError from "./StudentDashboardError";
import OfflineBanner from "./OfflineBanner";
import Link from "next/link";
import { useLocale } from "next-intl";
import { AlertTriangle } from "lucide-react";

const DashboardHomeContent = () => {
  const t = useTranslations("studentDashboard");
  const locale = useLocale();
  const userData = useStudentProfile();

  const {
    data: dashboardStats,
    loading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useStudentDashboard();
  const {
    data: recentCourses,
    loading: coursesLoading,
    error: coursesError,
    refetch: refetchCourses,
  } = useStudentCourses({
    status: "active",
    limit: 6,
  });
  const { data: calendarEvents } = useStudentCalendar();
  const { data: recentActivity, loading: activityLoading } =
    useStudentRecentActivity({ limit: 10 });

  // Map enrolled courses to the format expected by RecentCourses
  const mappedCourses = recentCourses.map((course) => ({
    id: course.id,
    title: course.title,
    thumbnail: course.thumbnail || "/student_dashboard/courses/image 473.svg",
    progress: course.progress,
    status: (course.enrollmentStatus === "completed"
      ? "completed"
      : course.progress > 0
        ? "in_progress"
        : "not_started") as "in_progress" | "completed" | "not_started",
    instructorName: course.instructorName,
    instructorAvatar: course.instructorAvatar,
    nextAction: course.nextAction,
    nextDeadline: course.nextDeadline,
    missingTasksCount: course.missingTasksCount,
  }));

  const isLoading = statsLoading || coursesLoading;
  const error = statsError || coursesError;
  const handleRetry = () => {
    refetchStats();
    refetchCourses();
  };

  return (
    <>
      {/* Dashboard Navbar */}
      <DashboardNavbar user={userData} />

      {/* Main Container */}
      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar - Hidden on mobile, shown via MobileSidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <DashboardSidebar user={userData} />
            </div>

            {/* Mobile Sidebar */}
            <MobileSidebar user={userData} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Title */}
              <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">
                {t("title")}
              </h1>

              <OfflineBanner />

              {!userData.scfhsNumber && (
                <div className="mb-4 flex items-start gap-3 p-4 bg-[#FEF3C7] border border-[#F59E0B]/30 rounded-xl">
                  <AlertTriangle className="w-5 h-5 text-[#D97706] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#92400E]">{t("scfhsBanner.title")}</p>
                    <p className="text-xs text-[#A16207] mt-0.5">{t("scfhsBanner.description")}</p>
                  </div>
                  <Link
                    href={`/${locale}/dashboard/student/settings`}
                    className="flex-shrink-0 px-3 py-1.5 bg-[#D97706] text-white text-xs font-medium rounded-lg hover:bg-[#B45309] transition-colors"
                  >
                    {t("scfhsBanner.addNow")}
                  </Link>
                </div>
              )}

              {isLoading ? (
                <StudentDashboardHomeSkeleton />
              ) : error ? (
                <StudentDashboardError message={error} onRetry={handleRetry} />
              ) : (
                <>
                  {/* Stats Cards */}
                  <DashboardStats stats={dashboardStats} />

                  {/* Recent Courses */}
                  <RecentCourses courses={mappedCourses} />
                </>
              )}
            </div>

            {/* Right Sidebar */}
            <div className="w-full lg:w-[280px] lg:flex-shrink-0 space-y-4">
              {/* Activity Timeline */}
              <NotificationsPanel
                activities={recentActivity}
                loading={activityLoading}
              />

              {/* Calendar */}
              <CalendarPanel events={calendarEvents} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DashboardHomeContent;
