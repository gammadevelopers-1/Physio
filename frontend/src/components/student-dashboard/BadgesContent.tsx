"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Award } from "lucide-react";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";

// Static mock user data
const mockUser = {
  name: "Ibrahim",
  email: "ibrahim@gmail.com",
  points: 0,
  profileCompletion: 90,
  avatar: "/images/instructor-1.png",
};

// Mock badges data - empty for now to show empty state
const mockBadgesData: never[] = [];

const BadgesContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";

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
              <h1
                className={`text-xl sm:text-2xl font-bold text-[#1F2937] mb-4 sm:mb-6 ${isRTL ? "text-right" : ""}`}
              >
                {t("badges.title")}
              </h1>

              {/* Badges Section */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 sm:p-6">
                {/* Badges Grid or Empty State */}
                {mockBadgesData.length === 0 ? (
                  // Empty State
                  <div className="flex flex-col items-center justify-center py-10 sm:py-16">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-3 sm:mb-4">
                      <Award className="w-6 h-6 sm:w-8 sm:h-8 text-[#9CA3AF]" />
                    </div>
                    <h3 className="text-sm sm:text-base font-medium text-[#1F2937] mb-1">
                      {t("badges.noBadgesTitle")}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#6B7280] mb-4 sm:mb-6 text-center px-4">
                      {t("badges.noBadgesDescription")}
                    </p>
                    <Link
                      href={`/${locale}/courses`}
                      className="px-5 py-2 sm:px-6 sm:py-2.5 border border-[#E5E7EB] text-[#1F2937] text-xs sm:text-sm font-medium rounded-lg hover:bg-[#F9FAFB] transition-colors"
                    >
                      {t("badges.viewCourses")}
                    </Link>
                  </div>
                ) : (
                  // Badges Grid - for future implementation
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {/* Badges will be rendered here */}
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

export default BadgesContent;
