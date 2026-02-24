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
import { Loader2 } from "lucide-react";

const DashboardHomeContent = () => {
  const t = useTranslations("studentDashboard");
  const userData = useStudentProfile();

  const { data: dashboardStats, loading: statsLoading } =
    useStudentDashboard();
  const { data: recentCourses, loading: coursesLoading } = useStudentCourses({
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
              <h1 className="text-2xl font-bold text-[#1F2937] mb-6">
                {t("title")}
              </h1>

              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 text-[#9CA3AF] animate-spin" />
                </div>
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
