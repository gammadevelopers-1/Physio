"use client";

import { useTranslations } from "next-intl";
import DashboardSidebar from "./DashboardSidebar";
import DashboardStats from "./DashboardStats";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import ContinueLearningWidget from "./widgets/ContinueLearningWidget";
import PendingAssessmentsWidget from "./widgets/PendingAssessmentsWidget";
import RecommendedCoursesWidget from "./widgets/RecommendedCoursesWidget";
import UpcomingScheduleWidget from "./widgets/UpcomingScheduleWidget";
import RecentGradesWidget from "./widgets/RecentGradesWidget";
import StatsTileWidget from "./widgets/StatsTileWidget";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { useStudentDashboard } from "@/hooks/useStudentDashboard";
import { useStudentCourses } from "@/hooks/useStudentCourses";
import { useStudentCalendar } from "@/hooks/useStudentCalendar";
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
    data: enrolledCourses,
    loading: coursesLoading,
    error: coursesError,
    refetch: refetchCourses,
  } = useStudentCourses({ status: "active", limit: 20 });
  const { data: calendarEvents } = useStudentCalendar();

  const isLoading = statsLoading || coursesLoading;
  const error = statsError || coursesError;
  const handleRetry = () => {
    refetchStats();
    refetchCourses();
  };

  return (
    <>
      <DashboardNavbar user={userData} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <DashboardSidebar user={userData} />
            </div>

            {/* Mobile Sidebar */}
            <MobileSidebar user={userData} />

            {/* Main Content (center column) */}
            <div className="flex-1 min-w-0">
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
                <div className="space-y-4">
                  {/* KPI cards */}
                  <DashboardStats stats={dashboardStats} />

                  {/* Continue learning — top 3 most-recent active courses */}
                  <ContinueLearningWidget courses={enrolledCourses} loading={coursesLoading} />

                  {/* Two-column grid: pending work + course recommendations */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <PendingAssessmentsWidget courses={enrolledCourses} loading={coursesLoading} />
                    <RecommendedCoursesWidget enrolledCourses={enrolledCourses} />
                  </div>
                </div>
              )}
            </div>

            {/* Right Sidebar */}
            <div className="w-full lg:w-[300px] lg:flex-shrink-0 space-y-4">
              <UpcomingScheduleWidget events={calendarEvents} />
              <RecentGradesWidget />
              <StatsTileWidget user={userData} stats={dashboardStats} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DashboardHomeContent;
