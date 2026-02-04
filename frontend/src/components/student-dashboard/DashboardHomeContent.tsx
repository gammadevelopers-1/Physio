"use client";

import { useTranslations } from "next-intl";
import DashboardSidebar from "./DashboardSidebar";
import DashboardStats from "./DashboardStats";
import RecentCourses from "./RecentCourses";
import NotificationsPanel from "./NotificationsPanel";
import CalendarPanel from "./CalendarPanel";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";

// Static mock data
const mockUser = {
  name: "Ibrahim",
  email: "ibrahim@gmail.com",
  points: 0,
  profileCompletion: 90,
  avatar: "/images/instructor-1.png",
};

const mockStats = {
  courses: 2,
  certificates: 1,
  coursesCompleted: 2,
};

const DashboardHomeContent = () => {
  const t = useTranslations("studentDashboard");

  // Mock data with translations
  const mockCourses = [
    {
      id: "acls-1",
      title: t("mockData.courseTitleACLS"),
      thumbnail: "/student_dashboard/courses/image 473.svg",
      progress: 24,
      status: "in_progress" as const,
    },
    {
      id: "acls-2",
      title: t("mockData.courseTitleACLS"),
      thumbnail: "/student_dashboard/courses/image 491.svg",
      progress: 24,
      status: "in_progress" as const,
    },
  ];

  const mockNotifications = [
    {
      id: "1",
      title: t("notifications.courseAdded"),
      message: t("notifications.courseAddedMessage"),
      date: "21/1/26",
      read: false,
    },
    {
      id: "2",
      title: t("notifications.courseAdded"),
      message: t("notifications.courseAddedMessage"),
      date: "21/1/26",
      read: false,
    },
  ];

  const mockEvents = [
    {
      id: "1",
      title: t("mockData.lecture2"),
      instructor: t("mockData.instructorFaisal"),
      date: t("calendar.today"),
      time: "3:00pm - 4:30pm",
      duration: `90 ${t("calendar.mins")}`,
      zoomLink: "https://zoom.us/j/123456789",
    },
    {
      id: "2",
      title: t("mockData.lecture3"),
      instructor: t("mockData.instructorFaisal"),
      date: t("mockData.tuesday"),
      time: "3:00pm - 4:30pm",
      duration: `90 ${t("calendar.mins")}`,
      zoomLink: "https://zoom.us/j/123456789",
    },
  ];

  const handleRefreshNotifications = () => {
    // TODO: Implement refresh logic
    console.log("Refreshing notifications...");
  };

  return (
    <>
      {/* Dashboard Navbar */}
      <DashboardNavbar user={mockUser} />

      {/* Main Container */}
      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar - Hidden on mobile, shown via MobileSidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <DashboardSidebar user={mockUser} />
            </div>

            {/* Mobile Sidebar */}
            <MobileSidebar user={mockUser} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Title */}
              <h1 className="text-2xl font-bold text-[#1F2937] mb-6">
                {t("title")}
              </h1>

              {/* Stats Cards */}
              <DashboardStats stats={mockStats} />

              {/* Recent Courses */}
              <RecentCourses courses={mockCourses} />
            </div>

            {/* Right Sidebar */}
            <div className="w-full lg:w-[280px] lg:flex-shrink-0 space-y-4">
              {/* Notifications */}
              <NotificationsPanel
                notifications={mockNotifications}
                onRefresh={handleRefreshNotifications}
              />

              {/* Calendar */}
              <CalendarPanel events={mockEvents} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DashboardHomeContent;
