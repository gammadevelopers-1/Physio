"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import InstructorNavbar from "./InstructorNavbar";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import DashboardError from "./DashboardError";
import { useInstructorProfile } from "@/hooks/useInstructorProfile";
import { useInstructorCourses } from "@/hooks/useInstructorCourses";
import { instructorApi } from "@/lib/api";
import {
  Search,
  Users,
  Calendar,
  Clock,
  Video,
  MapPin,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  BarChart3,
  Settings,
  LayoutGrid,
  List,
  Star,
  Send,
  AlertCircle,
} from "lucide-react";

const COURSE_STATUSES = ["active", "draft", "pending_review", "changes_requested", "completed", "archived"] as const;

const CourseCardSkeleton = () => (
  <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
    <div className="h-40 bg-[#E5E7EB] animate-pulse" />
    <div className="p-4 space-y-3">
      <div className="h-5 w-3/4 bg-[#E5E7EB] rounded animate-pulse" />
      <div className="flex gap-4">
        <div className="h-4 w-24 bg-[#E5E7EB] rounded animate-pulse" />
        <div className="h-4 w-20 bg-[#E5E7EB] rounded animate-pulse" />
      </div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <div className="h-3 w-16 bg-[#E5E7EB] rounded animate-pulse" />
          <div className="h-3 w-8 bg-[#E5E7EB] rounded animate-pulse" />
        </div>
        <div className="h-2 w-full bg-[#E5E7EB] rounded-full animate-pulse" />
      </div>
      <div className="h-9 w-full bg-[#E5E7EB] rounded-lg animate-pulse" />
    </div>
  </div>
);

function formatNextSession(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sessionDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  const diffDays = Math.floor(
    (sessionDay.getTime() - today.getTime()) / 86400000
  );

  const timeStr = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (diffDays === 0) return `Today, ${timeStr}`;
  if (diffDays === 1) return `Tomorrow, ${timeStr}`;
  return `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${timeStr}`;
}

const MyCoursesContent = () => {
  const instructor = useInstructorProfile();
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("instructorDashboard");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef<NodeJS.Timeout>(undefined);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deliveryFilter, setDeliveryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  const { courses, total, totalPages, loading, error, refetch } = useInstructorCourses({
    status: statusFilter,
    delivery: deliveryFilter,
    search: searchQuery,
    sort: sortBy,
    page: currentPage,
    limit: ITEMS_PER_PAGE,
  });

  // ─── Course rating stats ────────────────────────────────
  const [ratingsMap, setRatingsMap] = useState<Record<string, { avgRating: number; totalRatings: number }>>({});
  const courseIdsKey = useMemo(() => courses.map((c) => c.id).join(","), [courses]);

  useEffect(() => {
    if (!courseIdsKey) return;
    const ids = courseIdsKey.split(",").filter(Boolean);
    let cancelled = false;

    Promise.all(
      ids.map((id) =>
        instructorApi.getCourseRatingStats(id).then(
          (stats) => ({ id, stats }),
          () => ({ id, stats: { avgRating: 0, totalRatings: 0 } })
        )
      )
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, { avgRating: number; totalRatings: number }> = {};
      for (const { id, stats } of results) {
        map[id] = stats;
      }
      setRatingsMap(map);
    });

    return () => { cancelled = true; };
  }, [courseIdsKey]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-[#DCFCE7] text-[#22C55E]",
      draft: "bg-[#F3F4F6] text-[#6B7280]",
      pending_review: "bg-[#EEF2FF] text-[#6366F1]",
      changes_requested: "bg-[#FEF3C7] text-[#D97706]",
      completed: "bg-[#EFF6FF] text-[#3B82F6]",
      archived: "bg-[#374151] text-[#F9FAFB]",
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
            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-[#1F2937]">
                    {t("courses.title")}
                  </h1>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {t("courses.subtitle")}
                  </p>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 mb-6">
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Search */}
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                    <input
                      type="text"
                      placeholder={t("courses.searchPlaceholder")}
                      value={searchInput}
                      onChange={(e) => {
                        setSearchInput(e.target.value);
                        clearTimeout(debounceRef.current);
                        debounceRef.current = setTimeout(() => setSearchQuery(e.target.value), 300);
                      }}
                      className="w-full pl-10 pr-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                    />
                  </div>

                  {/* Filters */}
                  <div className="flex flex-wrap gap-3">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      <option value="all">
                        {t("courses.filters.allStatus")}
                      </option>
                      <option value="active">
                        {t("courses.filters.active")}
                      </option>
                      <option value="draft">
                        {t("courses.filters.draft")}
                      </option>
                      <option value="pending_review">
                        {t("courses.filters.pendingReview")}
                      </option>
                      <option value="changes_requested">
                        {t("courses.filters.changesRequested")}
                      </option>
                      <option value="completed">
                        {t("courses.filters.completed")}
                      </option>
                      <option value="archived">
                        {t("courses.filters.archived")}
                      </option>
                    </select>

                    <select
                      value={deliveryFilter}
                      onChange={(e) => setDeliveryFilter(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      <option value="all">
                        {t("courses.filters.allDelivery")}
                      </option>
                      <option value="zoom">
                        {t("courses.filters.zoom")}
                      </option>
                      <option value="onsite">
                        {t("courses.filters.onsite")}
                      </option>
                      <option value="blended">
                        {t("courses.filters.blended")}
                      </option>
                    </select>

                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      <option value="newest">
                        {t("courses.sort.newest")}
                      </option>
                      <option value="oldest">
                        {t("courses.sort.oldest")}
                      </option>
                      <option value="students">
                        {t("courses.sort.mostStudents")}
                      </option>
                      <option value="alphabetical">
                        {t("courses.sort.alphabetical")}
                      </option>
                    </select>

                    {/* View Toggle */}
                    <div className="flex items-center bg-white border border-[#E5E7EB] rounded-lg p-0.5">
                      <button
                        onClick={() => setViewMode("grid")}
                        className={`p-2 rounded-md transition-colors ${viewMode === "grid" ? "bg-[#3B82F6] text-white" : "text-[#6B7280] hover:text-[#1F2937]"}`}
                        title={t("courses.gridView")}
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode("list")}
                        className={`p-2 rounded-md transition-colors ${viewMode === "list" ? "bg-[#3B82F6] text-white" : "text-[#6B7280] hover:text-[#1F2937]"}`}
                        title={t("courses.listView")}
                      >
                        <List className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Course Cards — Loading / Error / Empty / Data */}
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <CourseCardSkeleton key={i} />
                  ))}
                </div>
              ) : error ? (
                <DashboardError message={error} onRetry={refetch} />
              ) : courses.length === 0 ? (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
                  <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-8 h-8 text-[#9CA3AF]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#1F2937] mb-2">
                    {t("courses.noCoursesTitle")}
                  </h3>
                  <p className="text-sm text-[#6B7280]">
                    {t("courses.noCoursesAssigned")}
                  </p>
                </div>
              ) : (
                <>
                  {/* Grid View */}
                  {viewMode === "grid" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {courses.map((course) => {
                        const courseTitle =
                          locale === "ar" && course.titleAr
                            ? course.titleAr
                            : course.title;
                        const nextSession = formatNextSession(course.nextSessionAt);
                        const thumbnailSrc =
                          course.thumbnail || "/student_dashboard/courses/image 473.svg";

                        return (
                          <div
                            key={course.id}
                            className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden hover:shadow-md transition-shadow flex flex-col"
                          >
                            <div className="relative h-40">
                              <Image
                                src={thumbnailSrc}
                                alt={courseTitle}
                                fill
                                className="object-cover"
                                unoptimized={thumbnailSrc.startsWith("http")}
                              />
                              <div className="absolute top-3 left-3 flex gap-2">
                                <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${getStatusBadge(course.status)}`}>
                                  {t(`courses.status.${course.status}`)}
                                </span>
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/90 rounded-md text-xs font-medium text-[#374151]">
                                  {getDeliveryIcon(course.deliveryType)}
                                  {t(`courses.delivery.${course.deliveryType}`)}
                                </span>
                              </div>
                            </div>
                            <div className="p-4 flex flex-col flex-1">
                              <h3 className="text-base font-semibold text-[#1F2937] mb-2 line-clamp-1">{courseTitle}</h3>
                              {(course.startDate || course.endDate) && (
                                <div className="flex items-center gap-1.5 text-xs text-[#6B7280] mb-2">
                                  <Calendar className="w-3.5 h-3.5" />
                                  {course.startDate
                                    ? new Date(course.startDate).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric", year: "numeric" })
                                    : "—"}
                                  {" – "}
                                  {course.endDate
                                    ? new Date(course.endDate).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric", year: "numeric" })
                                    : t("courses.ongoing")}
                                </div>
                              )}
                              <div className="flex items-center gap-4 text-sm text-[#6B7280] mb-3">
                                <span className="flex items-center gap-1">
                                  <Users className="w-4 h-4" />
                                  {course.enrolledCount} {course.enrolledCount === 1 ? t("courses.student") : t("courses.students")}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  {course.completedSessions}/{course.totalSessions} {t("courses.sessions")}
                                </span>
                                <span className="flex items-center gap-1 text-[#9CA3AF]">
                                  <Star className={`w-3.5 h-3.5 ${ratingsMap[course.id]?.totalRatings ? "text-[#F59E0B] fill-[#F59E0B]" : ""}`} />
                                  {ratingsMap[course.id]?.totalRatings
                                    ? `${ratingsMap[course.id].avgRating} (${ratingsMap[course.id].totalRatings})`
                                    : t("courses.noRatingsYet")}
                                </span>
                              </div>
                              {course.completionRate > 0 && (
                                <div className="mb-3">
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className="text-[#6B7280]">{t("courses.completion")}</span>
                                    <span className="font-medium text-[#1F2937]">{course.completionRate}%</span>
                                  </div>
                                  <div className="h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-[#22C55E] rounded-full transition-all"
                                      style={{ width: `${course.completionRate}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                              {nextSession && (
                                <div className="flex items-center gap-1.5 text-xs text-[#6B7280] mb-3">
                                  <Clock className="w-3.5 h-3.5" />
                                  {t("courses.nextSession")}: {nextSession}
                                </div>
                              )}
                              <div className="flex gap-2 mt-auto">
                                <Link
                                  href={`/${locale}/dashboard/instructor/courses/${course.id}`}
                                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 btn-gold text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                  {t("courses.viewDetails")}
                                  {locale === "ar" ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                </Link>
                                <button
                                  onClick={() => router.push(`/${locale}/dashboard/instructor/courses/${course.id}?tab=analytics`)}
                                  className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
                                  title={t("courses.viewAnalytics")}
                                >
                                  <BarChart3 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => router.push(`/${locale}/dashboard/instructor/courses/${course.id}?tab=settings`)}
                                  className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
                                  title={t("courses.courseSettings")}
                                >
                                  <Settings className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* List View */}
                  {viewMode === "list" && (
                    <div className="bg-white rounded-xl border border-[#E5E7EB] divide-y divide-[#E5E7EB]">
                      {courses.map((course) => {
                        const courseTitle =
                          locale === "ar" && course.titleAr ? course.titleAr : course.title;
                        return (
                          <Link
                            key={course.id}
                            href={`/${locale}/dashboard/instructor/courses/${course.id}`}
                            className="flex items-center gap-4 p-4 hover:bg-[#F9FAFB] transition-colors"
                          >
                            <div className="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 relative">
                              <Image
                                src={course.thumbnail || "/student_dashboard/courses/image 473.svg"}
                                alt={courseTitle}
                                fill
                                className="object-cover"
                                unoptimized={(course.thumbnail || "").startsWith("http")}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-[#1F2937] truncate">{courseTitle}</h3>
                              <div className="flex items-center gap-3 mt-1 text-xs text-[#6B7280]">
                                <span className="flex items-center gap-1">
                                  <Users className="w-3 h-3" /> {course.enrolledCount}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" /> {course.completedSessions}/{course.totalSessions}
                                </span>
                                {course.startDate && (
                                  <span className="flex items-center gap-1">
                                    {new Date(course.startDate).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric" })}
                                    {" – "}
                                    {course.endDate
                                      ? new Date(course.endDate).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric" })
                                      : t("courses.ongoing")}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${getStatusBadge(course.status)}`}>
                              {t(`courses.status.${course.status}`)}
                            </span>
                            <div className="w-20">
                              <div className="flex justify-between text-xs mb-0.5">
                                <span className="text-[#6B7280]">{course.completionRate}%</span>
                              </div>
                              <div className="h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#22C55E] rounded-full"
                                  style={{ width: `${course.completionRate}%` }}
                                />
                              </div>
                            </div>
                            {locale === "ar" ? <ChevronLeft className="w-4 h-4 text-[#9CA3AF]" /> : <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />}
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-[#6B7280]">
                        {t("courses.showing")} {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, total)} {t("courses.of")} {total}
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let page: number;
                          if (totalPages <= 5) {
                            page = i + 1;
                          } else if (currentPage <= 3) {
                            page = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            page = totalPages - 4 + i;
                          } else {
                            page = currentPage - 2 + i;
                          }
                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`w-9 h-9 rounded-lg text-sm font-medium ${
                                page === currentPage
                                  ? "bg-[#3B82F6] text-white"
                                  : "text-[#6B7280] hover:bg-[#F9FAFB]"
                              }`}
                            >
                              {page}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MyCoursesContent;
