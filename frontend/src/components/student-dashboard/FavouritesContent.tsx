"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Heart } from "lucide-react";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import { useFavourites } from "@/contexts/FavouritesContext";
import { useStudentProfile } from "@/hooks/useStudentProfile";

const FavouritesContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";
  const { favourites, removeFavourite } = useFavourites();
  const userData = useStudentProfile();

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "in_progress":
        return t("favourites.inProgress");
      case "completed":
        return t("favourites.completed");
      default:
        return t("favourites.notStarted");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "in_progress":
        return "text-[#D4A520]";
      case "completed":
        return "text-[#16A34A]";
      default:
        return "text-[var(--color-text-secondary)]";
    }
  };

  return (
    <>
      {/* Dashboard Navbar */}
      <DashboardNavbar user={userData} />

      {/* Main Container */}
      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar - Hidden on mobile */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <DashboardSidebar user={userData} />
            </div>

            {/* Mobile Sidebar */}
            <MobileSidebar user={userData} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Title */}
              <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] mb-4 sm:mb-6">
                {t("favourites.title")}
              </h1>

              {/* Favourites Section */}
              <div className="bg-white rounded-xl border border-[var(--color-border)] p-4 sm:p-6">
                {/* Courses Grid or Empty State */}
                {favourites.length === 0 ? (
                  // Empty State
                  <div className="flex flex-col items-center justify-center py-10 sm:py-16">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-3 sm:mb-4">
                      <Heart className="w-6 h-6 sm:w-8 sm:h-8 text-[var(--color-text-secondary)]" />
                    </div>
                    <h3 className="text-sm sm:text-base font-medium text-[var(--color-text-primary)] mb-1">
                      {t("favourites.noFavouritesTitle")}
                    </h3>
                    <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mb-4 sm:mb-6 text-center px-4">
                      {t("favourites.noFavouritesDescription")}
                    </p>
                    <Link
                      href={`/${locale}/courses`}
                      className="px-5 py-2 sm:px-6 sm:py-2.5 btn-gold text-white text-xs sm:text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                    >
                      {t("favourites.viewCourses")}
                    </Link>
                  </div>
                ) : (
                  // Favourites Grid
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {favourites.map((course) => (
                      <div
                        key={course.id}
                        className="border border-[var(--color-border)] rounded-xl overflow-hidden relative"
                      >
                        {/* Remove from Favourites Button */}
                        <button
                          onClick={() => removeFavourite(course.id)}
                          className={`absolute top-2 ${isRTL ? "left-2" : "right-2"} z-10 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-red-50 transition-colors`}
                          aria-label={t("favourites.removeFromFavourites")}
                        >
                          <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                        </button>

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
                          <h3 className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)] mb-2 line-clamp-2">
                            {course.title}
                          </h3>

                          {/* Status and Progress */}
                          <div
                            className={`flex items-center justify-between mb-2 sm:mb-3 ${isRTL ? "flex-row-reverse" : ""}`}
                          >
                            <span
                              className={`text-[10px] sm:text-xs ${getStatusColor(course.status)}`}
                            >
                              {getStatusLabel(course.status)}
                            </span>
                            <span className="text-[10px] sm:text-xs text-[var(--color-text-secondary)]">
                              {course.progress}%
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="h-1.5 sm:h-2 bg-[var(--color-border)] rounded-full overflow-hidden mb-3 sm:mb-4">
                            <div
                              className={`h-full bg-[#16A34A] rounded-full transition-all duration-300 ${isRTL ? "ms-auto" : ""}`}
                              style={{ width: `${course.progress}%` }}
                            />
                          </div>

                          {/* View Course Button */}
                          <Link
                            href={`/${locale}/dashboard/student/courses/${course.id}`}
                            className="block w-full py-1.5 sm:py-2 border border-[var(--color-border)] rounded-lg text-xs sm:text-sm font-medium text-[var(--color-text-primary)] text-center hover:bg-[#F9FAFB] transition-colors"
                          >
                            {t("favourites.viewCourse")}
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

export default FavouritesContent;
