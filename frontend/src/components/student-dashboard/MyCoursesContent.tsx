"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ClipboardList } from "lucide-react";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";

interface Course {
  id: string;
  title: string;
  thumbnail: string;
  progress: number;
  status: "in_progress" | "completed" | "not_started";
}

// Static mock user data
const mockUser = {
  name: "Ibrahim",
  email: "ibrahim@gmail.com",
  points: 0,
  profileCompletion: 90,
  avatar: "/images/instructor-1.png",
};

type TabFilter = "all" | "in_progress" | "completed";

const MyCoursesContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";
  const [activeTab, setActiveTab] = useState<TabFilter>("all");

  // Mock courses data with translations
  const allCourses: Course[] = [
    {
      id: "acls-1",
      title: t("mockData.courseTitleACLS"),
      thumbnail: "/student_dashboard/courses/image 473.svg",
      progress: 24,
      status: "in_progress",
    },
    {
      id: "acls-2",
      title: t("mockData.courseTitleACLS"),
      thumbnail: "/student_dashboard/courses/image 491.svg",
      progress: 24,
      status: "in_progress",
    },
    {
      id: "acls-3",
      title: t("mockData.courseTitleACLS"),
      thumbnail: "/student_dashboard/courses/image 473.svg",
      progress: 24,
      status: "in_progress",
    },
  ];

  // Filter courses based on active tab
  const filteredCourses = allCourses.filter((course) => {
    if (activeTab === "all") return true;
    return course.status === activeTab;
  });

  const getStatusLabel = (status: Course["status"]) => {
    switch (status) {
      case "in_progress":
        return t("myCourses.inProgress");
      case "completed":
        return t("myCourses.completed");
      default:
        return t("myCourses.notStarted");
    }
  };

  const getStatusColor = (status: Course["status"]) => {
    switch (status) {
      case "in_progress":
        return "text-[#D4A520]";
      case "completed":
        return "text-[#16A34A]";
      default:
        return "text-[#6B7280]";
    }
  };

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "all", label: t("myCourses.tabs.all") },
    { key: "in_progress", label: t("myCourses.tabs.inProgress") },
    { key: "completed", label: t("myCourses.tabs.completed") },
  ];

  return (
    <>
      {/* Dashboard Navbar */}
      <DashboardNavbar user={mockUser} />

      {/* Main Container */}
      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar - Hidden on mobile */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <DashboardSidebar user={mockUser} />
            </div>

            {/* Mobile Sidebar */}
            <MobileSidebar user={mockUser} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Title */}
              <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937] mb-4 sm:mb-6">
                {t("myCourses.title")}
              </h1>

              {/* Courses Section */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 sm:p-6">
                {/* Section Title */}
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

                {/* Courses Grid or Empty State */}
                {filteredCourses.length === 0 ? (
                  // Empty State
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
                  // Courses Grid
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {filteredCourses.map((course) => (
                      <div
                        key={course.id}
                        className="border border-[#E5E7EB] rounded-xl overflow-hidden"
                      >
                        {/* Course Thumbnail */}
                        <div className="w-full h-[120px] sm:h-[140px] bg-gray-100">
                          <Image
                            src={course.thumbnail}
                            alt={course.title}
                            width={400}
                            height={140}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Course Info */}
                        <div className="p-3 sm:p-4">
                          <h3 className="text-xs sm:text-sm font-semibold text-[#1F2937] mb-2 line-clamp-2">
                            {course.title}
                          </h3>

                          {/* Status and Progress */}
                          <div className={`flex items-center justify-between mb-2 sm:mb-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                            <span className={`text-[10px] sm:text-xs ${getStatusColor(course.status)}`}>
                              {getStatusLabel(course.status)}
                            </span>
                            <span className="text-[10px] sm:text-xs text-[#6B7280]">
                              {course.progress}%
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="h-1.5 sm:h-2 bg-[#E5E7EB] rounded-full overflow-hidden mb-3 sm:mb-4">
                            <div
                              className={`h-full bg-[#16A34A] rounded-full transition-all duration-300 ${isRTL ? "ms-auto" : ""}`}
                              style={{ width: `${course.progress}%` }}
                            />
                          </div>

                          {/* View Course Button */}
                          <Link
                            href={`/${locale}/student-dashboard/courses/${course.id}`}
                            className="block w-full py-1.5 sm:py-2 border border-[#E5E7EB] rounded-lg text-xs sm:text-sm font-medium text-[#1F2937] text-center hover:bg-[#F9FAFB] transition-colors"
                          >
                            {t("myCourses.viewCourse")}
                          </Link>
                        </div>
                      </div>
                    ))}
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
