"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import { useManagerProfile } from "@/hooks/useManagerProfile";
import { useCourseManagerCourses } from "@/hooks/useCourseManagerCourses";
import {
  Search,
  Plus,
  Users,
  Calendar,
  MoreVertical,
  Video,
  MapPin,
  BookOpen,
  ChevronRight,
  BarChart3,
  Settings,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

const CourseCardSkeleton = () => (
  <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
    <div className="h-36 bg-[#E5E7EB] animate-pulse" />
    <div className="p-4 space-y-3">
      <div className="h-5 w-3/4 bg-[#E5E7EB] rounded animate-pulse" />
      <div className="h-3 w-1/2 bg-[#E5E7EB] rounded animate-pulse" />
      <div className="flex gap-3">
        <div className="h-4 w-20 bg-[#E5E7EB] rounded animate-pulse" />
        <div className="h-4 w-20 bg-[#E5E7EB] rounded animate-pulse" />
        <div className="h-4 w-20 bg-[#E5E7EB] rounded animate-pulse" />
      </div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <div className="h-3 w-16 bg-[#E5E7EB] rounded animate-pulse" />
          <div className="h-3 w-8 bg-[#E5E7EB] rounded animate-pulse" />
        </div>
        <div className="h-1.5 w-full bg-[#E5E7EB] rounded-full animate-pulse" />
      </div>
      <div className="h-9 w-full bg-[#E5E7EB] rounded-lg animate-pulse" />
    </div>
  </div>
);

const CoursesContent = () => {
  const manager = useManagerProfile();
  const locale = useLocale();
  const t = useTranslations("courseManagerDashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deliveryFilter, setDeliveryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");

  const { courses, total, loading, error, refetch } = useCourseManagerCourses({
    status: statusFilter,
    delivery: deliveryFilter,
    search: searchQuery,
    sort: sortBy,
    page: 1,
    limit: 50,
  });

  const activeCourses = courses.filter((c) => c.status === "active").length;
  const totalEnrolled = courses.reduce((acc, c) => acc + c.enrolledCount, 0);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-[#DCFCE7] text-[#22C55E]",
      draft: "bg-[#F3F4F6] text-[#6B7280]",
      completed: "bg-[#EFF6FF] text-[#3B82F6]",
      archived: "bg-[#FEF3C7] text-[#D4A520]",
    };
    return styles[status] || styles.draft;
  };

  const getDeliveryIcon = (delivery: string) => {
    switch (delivery) {
      case "zoom":
        return <Video className="w-3.5 h-3.5" />;
      case "onsite":
        return <MapPin className="w-3.5 h-3.5" />;
      case "blended":
        return <BookOpen className="w-3.5 h-3.5" />;
      default:
        return <Video className="w-3.5 h-3.5" />;
    }
  };

  return (
    <>
      <CourseManagerNavbar manager={manager} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <CourseManagerSidebar manager={manager} />
            </div>
            <CourseManagerMobileSidebar manager={manager} />

            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-[#1F2937]">
                    {t("coursesPage.title")}
                  </h1>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {t("coursesPage.subtitle")}
                  </p>
                </div>
                <Link
                  href={`/${locale}/dashboard/manager/courses/create`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {t("coursesPage.createCourse")}
                </Link>
              </div>

              {/* Stats Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">
                    {t("coursesPage.stats.total")}
                  </p>
                  <p className="text-2xl font-bold text-[#1F2937] mt-1">
                    {loading ? "—" : total}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">
                    {t("coursesPage.stats.active")}
                  </p>
                  <p className="text-2xl font-bold text-[#22C55E] mt-1">
                    {loading ? "—" : activeCourses}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">
                    {t("coursesPage.stats.totalEnrollments")}
                  </p>
                  <p className="text-2xl font-bold text-[#1F2937] mt-1">
                    {loading ? "—" : totalEnrolled}
                  </p>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 mb-6">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                    <input
                      type="text"
                      placeholder={t("coursesPage.searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                    />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      <option value="all">
                        {t("coursesPage.filters.allStatus")}
                      </option>
                      <option value="active">
                        {t("coursesPage.filters.active")}
                      </option>
                      <option value="draft">
                        {t("coursesPage.filters.draft")}
                      </option>
                      <option value="completed">
                        {t("coursesPage.filters.completed")}
                      </option>
                      <option value="archived">
                        {t("coursesPage.filters.archived")}
                      </option>
                    </select>

                    <select
                      value={deliveryFilter}
                      onChange={(e) => setDeliveryFilter(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      <option value="all">
                        {t("coursesPage.filters.allDelivery")}
                      </option>
                      <option value="zoom">
                        {t("coursesPage.delivery.zoom")}
                      </option>
                      <option value="onsite">
                        {t("coursesPage.delivery.onsite")}
                      </option>
                      <option value="blended">
                        {t("coursesPage.delivery.blended")}
                      </option>
                    </select>

                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      <option value="newest">
                        {t("coursesPage.sort.newest")}
                      </option>
                      <option value="oldest">
                        {t("coursesPage.sort.oldest")}
                      </option>
                      <option value="students">
                        {t("coursesPage.sort.mostStudents")}
                      </option>
                      <option value="alphabetical">
                        {t("coursesPage.sort.alphabetical")}
                      </option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Course Cards — Loading / Error / Empty / Data */}
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <CourseCardSkeleton key={i} />
                  ))}
                </div>
              ) : error ? (
                <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-6 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 bg-[#FEE2E2] rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="w-6 h-6 text-[#EF4444]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#991B1B] mb-2">
                    {t("error.title")}
                  </h3>
                  <p className="text-sm text-[#DC2626] mb-4 max-w-md">
                    {error}
                  </p>
                  <button
                    onClick={refetch}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#EF4444] rounded-lg hover:bg-[#DC2626] transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t("error.retry")}
                  </button>
                </div>
              ) : courses.length === 0 ? (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
                  <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-8 h-8 text-[#9CA3AF]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#1F2937] mb-2">
                    {t("coursesPage.noCourses")}
                  </h3>
                  <p className="text-sm text-[#6B7280] mb-4">
                    {t("coursesPage.noCoursesDesc")}
                  </p>
                  <Link
                    href={`/${locale}/dashboard/manager/courses/create`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    {t("coursesPage.createCourse")}
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {courses.map((course) => {
                    const courseTitle =
                      locale === "ar" && course.titleAr
                        ? course.titleAr
                        : course.title;
                    const thumbnailSrc =
                      course.thumbnail ||
                      "/student_dashboard/courses/image 473.svg";

                    return (
                      <div
                        key={course.id}
                        className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden hover:shadow-md transition-shadow"
                      >
                        <div className="relative h-36">
                          <Image
                            src={thumbnailSrc}
                            alt={courseTitle}
                            fill
                            className="object-cover"
                            unoptimized={thumbnailSrc.startsWith("http")}
                          />
                          <div className="absolute top-3 left-3 flex gap-2">
                            <span
                              className={`px-2.5 py-1 rounded-md text-xs font-medium ${getStatusBadge(course.status)}`}
                            >
                              {t(`coursesPage.status.${course.status}`)}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/90 rounded-md text-xs font-medium text-[#374151]">
                              {getDeliveryIcon(course.deliveryType)}
                              {t(
                                `coursesPage.delivery.${course.deliveryType}`
                              )}
                            </span>
                          </div>
                          <button className="absolute top-3 right-3 p-1.5 bg-white/90 rounded-lg text-[#6B7280] hover:bg-white transition-colors">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="p-4">
                          <h3 className="text-base font-semibold text-[#1F2937] mb-1 line-clamp-1">
                            {courseTitle}
                          </h3>

                          {course.instructorName && (
                            <p className="text-xs text-[#6B7280] mb-3">
                              {course.instructorName}
                            </p>
                          )}

                          <div className="flex items-center gap-3 text-xs text-[#6B7280] mb-3">
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              {course.enrolledCount}{" "}
                              {t("coursesPage.students")}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {course.completedSessions}/
                              {course.totalSessions}{" "}
                              {t("coursesPage.sessions")}
                            </span>
                          </div>

                          {course.completionRate > 0 && (
                            <div className="mb-4">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-[#6B7280]">
                                  {t("coursesPage.completion")}
                                </span>
                                <span className="font-medium text-[#1F2937]">
                                  {course.completionRate}%
                                </span>
                              </div>
                              <div className="h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#22C55E] rounded-full transition-all"
                                  style={{
                                    width: `${course.completionRate}%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Link
                              href={`/${locale}/dashboard/manager/courses/${course.id}`}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 btn-gold text-white text-sm font-medium rounded-lg transition-colors"
                            >
                              {t("coursesPage.manage")}
                              <ChevronRight className="w-4 h-4" />
                            </Link>
                            <button className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] transition-colors">
                              <BarChart3 className="w-4 h-4" />
                            </button>
                            <button className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] transition-colors">
                              <Settings className="w-4 h-4" />
                            </button>
                          </div>
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
    </>
  );
};

export default CoursesContent;
