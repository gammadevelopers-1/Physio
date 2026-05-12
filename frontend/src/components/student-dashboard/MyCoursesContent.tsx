"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Heart,
  Clock,
  AlertTriangle,
  BookOpen,
  ClipboardCheck,
  CheckCircle,
  Award,
  UserCheck,
  Upload,
  XCircle,
  Star,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { studentApi, ApiError } from "@/lib/api";
import { canDropCourseNow } from "@/lib/calendar-utils";
import ReviewModal, { type ReviewKind } from "./ReviewModal";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import StudentCoursesGridSkeleton from "./StudentCoursesGridSkeleton";
import StudentDashboardError from "./StudentDashboardError";
import OfflineBanner from "./OfflineBanner";
import { useFavourites } from "@/contexts/FavouritesContext";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { useStudentCourses } from "@/hooks/useStudentCourses";
import type { StudentEnrolledCourse } from "@/types/student-dashboard";
import EmptyStateIllustration from "./EmptyStateIllustration";

type StatusFilter = "all" | "active" | "completed" | "dropped";
type DeliveryFilter = "all" | "zoom" | "onsite" | "blended" | "self-paced";
type SortOption = "recent" | "title" | "completed_date" | "newest";

const ITEMS_PER_PAGE = 12;

type TimeT = (key: string, vars?: Record<string, string | number>) => string;

function relativeTime(dateStr: string | null, tt: TimeT): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const absDiff = Math.abs(diff);
  const minutes = Math.floor(absDiff / 60000);
  if (minutes < 1) return tt("time.justNow");
  if (minutes < 60) return tt("time.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return tt("time.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return tt("time.yesterday");
  if (days < 7) return tt("time.daysAgo", { count: days });
  return new Date(dateStr).toLocaleDateString();
}

function deadlineInfo(
  dateStr: string | null,
  tt: TimeT,
): { label: string; color: string; isOverdue: boolean } | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff < 0) return { label: tt("time.overdue"), color: "text-red-600 bg-red-50", isOverdue: true };
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days === 0) return { label: tt("time.dueInHours", { count: hours }), color: "text-amber-600 bg-amber-50", isOverdue: false };
  if (days <= 3) return { label: tt("time.dueInDays", { count: days }), color: "text-amber-600 bg-amber-50", isOverdue: false };
  return null;
}

const MyCoursesContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";

  // Filter / search / sort state
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>("all");
  const [sort, setSort] = useState<SortOption>("recent");

  // Card-level state
  const [dropCourseId, setDropCourseId] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const [reviewCourse, setReviewCourse] = useState<{
    id: string;
    title: string;
    kinds: ReviewKind[];
    instructorName?: string;
  } | null>(null);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [reviewedInstructor, setReviewedInstructor] = useState<Set<string>>(
    new Set(),
  );
  const { isFavourite, toggleFavourite } = useFavourites();
  const userData = useStudentProfile();

  // 300ms debounce on search input → backend
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const {
    data: courses,
    total,
    totalPages,
    page,
    loading,
    error,
    goToPage,
    refetch,
  } = useStudentCourses({
    status: statusFilter,
    delivery: deliveryFilter,
    search: debouncedSearch || undefined,
    sort,
    limit: ITEMS_PER_PAGE,
  });

  // Seed both review flags from the backend per course
  useEffect(() => {
    if (!courses) return;
    const courseDone = new Set<string>();
    const instrDone = new Set<string>();
    for (const c of courses) {
      const ec = c as StudentEnrolledCourse;
      if (ec.hasReviewed) courseDone.add(c.id);
      if (ec.hasReviewedInstructor) instrDone.add(c.id);
    }
    setReviewed(courseDone);
    setReviewedInstructor(instrDone);
  }, [courses]);

  const hasFilters =
    statusFilter !== "all" ||
    deliveryFilter !== "all" ||
    searchInput.trim().length > 0;

  const handleClearFilters = () => {
    setStatusFilter("all");
    setDeliveryFilter("all");
    setSearchInput("");
    setSort("recent");
  };

  const getAlertBadge = (course: StudentEnrolledCourse) => {
    switch (course.nextAction) {
      case "join_zoom":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 border border-red-200">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            {t("myCourses.liveNow")}
          </span>
        );
      case "take_quiz":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <ClipboardCheck className="w-3 h-3" />
            {t("myCourses.assessmentDue")}
          </span>
        );
      case "upload_assignment":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <Upload className="w-3 h-3" />
            {t("myCourses.assignmentDue")}
          </span>
        );
      default:
        return null;
    }
  };

  // Single highest-priority status pill: certificate action / NELC eval.
  // Priority cascade — show only the top-most pending item per card so
  // we never stack multiple chips. Click → details to action.
  const getActionRequiredPill = (course: StudentEnrolledCourse) => {
    const cert = course.certificateRequestStatus || null;

    // 1. Certificate rejected — most urgent (manager rejected, action needed).
    if (cert === "rejected") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 border border-red-200">
          <Award className="w-3 h-3" />
          {isRTL ? "تم رفض الشهادة" : "Certificate rejected"}
        </span>
      );
    }
    // 2. Certificate approved — ready to download.
    if (cert === "approved") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200">
          <Award className="w-3 h-3" />
          {isRTL ? "الشهادة جاهزة" : "Certificate ready"}
        </span>
      );
    }
    // 3. Certificate revoked — manager pulled it back.
    if (cert === "revoked") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 border border-red-200">
          <Award className="w-3 h-3" />
          {isRTL ? "تم إلغاء الشهادة" : "Certificate revoked"}
        </span>
      );
    }
    // 4. Certificate pending review.
    if (cert === "pending" || cert === "held") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <Award className="w-3 h-3" />
          {isRTL ? "بانتظار الموافقة" : "Pending review"}
        </span>
      );
    }
    // 5. NELC evaluation form available — only after course is completed.
    if (
      course.enrollmentStatus === "completed" &&
      course.nelcReviewLink &&
      course.nelcReviewLink.trim() !== ""
    ) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          <ClipboardCheck className="w-3 h-3" />
          {isRTL ? "نموذج تقييم متاح" : "Evaluation available"}
        </span>
      );
    }
    return null;
  };

  const handleDropCourse = async () => {
    if (!dropCourseId) return;
    setDropping(true);
    try {
      await studentApi.dropCourse(dropCourseId);
      toast.success(t("courseDetail.dropSuccess"));
      refetch();
    } catch (err) {
      if (err instanceof ApiError && err.code === "DROP_RESTRICTED_WITHIN_3_DAYS") {
        toast.error(t("courseDetail.dropRestrictedMessage"));
      } else {
        toast.error(t("courseDetail.dropError"));
      }
    } finally {
      setDropping(false);
      setDropCourseId(null);
    }
  };

  const getActionButton = (course: StudentEnrolledCourse) => {
    return {
      label: t("myCourses.viewDetails"),
      href: `/${locale}/dashboard/student/courses/${course.id}`,
      className: "bg-[var(--color-text-primary)] text-white hover:bg-[var(--color-text-primary)]",
      icon: BookOpen,
      showCertificate: course.enrollmentStatus === "completed" && (
        course.deliveryType === "self-paced" || course.deliveryType === "blended"
          ? course.progress >= 100
          : course.attendanceRate >= 70
      ),
    };
  };

  return (
    <>
      <DashboardNavbar user={userData} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <DashboardSidebar user={userData} />
            </div>

            <MobileSidebar user={userData} />

            <div className="flex-1 min-w-0 space-y-4">
              {/* Page header — title + subtitle (matches inst/mng) */}
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                  {t("myCourses.title")}
                </h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {t("myCourses.subtitle")}
                </p>
              </div>

              <OfflineBanner />

              {/* Controls: search + filters + sort (matches inst/mng) */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-3 sm:p-4">
                <div className={`flex flex-col lg:flex-row lg:items-center gap-3 ${isRTL ? "lg:flex-row-reverse" : ""}`}>
                  {/* Search input */}
                  <div className="relative flex-1 min-w-[200px]">
                    <Search
                      className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
                    />
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder={t("myCourses.searchPlaceholder")}
                      className={`w-full py-2 text-sm border border-[var(--color-input-border)] rounded-lg bg-[var(--color-surface-card)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)] ${isRTL ? "pr-10 pl-3" : "pl-10 pr-3"}`}
                    />
                  </div>

                  {/* Status filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    className="px-3 py-2 text-sm border border-[var(--color-input-border)] rounded-lg bg-[var(--color-surface-card)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)]"
                  >
                    <option value="all">{t("myCourses.tabs.all")}</option>
                    <option value="active">{t("myCourses.tabs.inProgress")}</option>
                    <option value="completed">{t("myCourses.tabs.completed")}</option>
                    <option value="dropped">{t("myCourses.tabs.dropped")}</option>
                  </select>

                  {/* Delivery filter */}
                  <select
                    value={deliveryFilter}
                    onChange={(e) => setDeliveryFilter(e.target.value as DeliveryFilter)}
                    className="px-3 py-2 text-sm border border-[var(--color-input-border)] rounded-lg bg-[var(--color-surface-card)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)]"
                  >
                    <option value="all">{t("myCourses.deliveryAll")}</option>
                    <option value="zoom">{t("myCourses.deliveryZoom")}</option>
                    <option value="onsite">{t("myCourses.deliveryOnsite")}</option>
                    <option value="blended">{t("myCourses.deliveryBlended")}</option>
                    <option value="self-paced">{t("myCourses.deliverySelfPaced")}</option>
                  </select>

                  {/* Sort */}
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortOption)}
                    className="px-3 py-2 text-sm border border-[var(--color-input-border)] rounded-lg bg-[var(--color-surface-card)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)]"
                  >
                    <option value="recent">{t("myCourses.sortRecent")}</option>
                    <option value="newest">{t("myCourses.sortNewest")}</option>
                    <option value="title">{t("myCourses.sortTitle")}</option>
                    <option value="completed_date">{t("myCourses.sortCompleted")}</option>
                  </select>

                  {hasFilters && (
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="px-3 py-2 text-xs font-medium text-[var(--color-primary)] hover:underline self-start lg:self-auto cursor-pointer whitespace-nowrap"
                    >
                      {t("myCourses.clearFilters")}
                    </button>
                  )}
                </div>
              </div>

              {/* Content card */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6">
                {loading ? (
                  <StudentCoursesGridSkeleton />
                ) : error ? (
                  <StudentDashboardError message={error} onRetry={refetch} />
                ) : courses.length === 0 ? (
                  (() => {
                    // Compute status-specific copy first, then let hasFilters override.
                    // (Done in this order so TS narrowing of statusFilter doesn't make
                    // the status comparisons appear unreachable.)
                    let titleKey = "myCourses.noCoursesTitle";
                    let descKey = "myCourses.noCoursesDescription";
                    if (statusFilter === "completed") {
                      titleKey = "myCourses.noCompletedTitle";
                      descKey = "myCourses.noCompletedDescription";
                    } else if (statusFilter === "dropped") {
                      titleKey = "myCourses.noDroppedTitle";
                      descKey = "myCourses.noDroppedDescription";
                    } else if (statusFilter === "active") {
                      titleKey = "myCourses.noInProgressTitle";
                      descKey = "myCourses.noInProgressDescription";
                    }
                    if (hasFilters) {
                      titleKey = "myCourses.noResultsTitle";
                      descKey = "myCourses.noResultsDescription";
                    }
                    return (
                      <div className="flex flex-col items-center justify-center py-10 sm:py-16">
                        <EmptyStateIllustration variant="courses" className="mb-2" />
                        <h3 className="text-sm sm:text-base font-medium text-[var(--color-text-primary)] mb-1">
                          {t(titleKey)}
                        </h3>
                        <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mb-4 sm:mb-6 text-center px-4">
                          {t(descKey)}
                        </p>
                        {hasFilters ? (
                          <button
                            type="button"
                            onClick={handleClearFilters}
                            className="px-5 py-2 sm:px-6 sm:py-2.5 text-xs sm:text-sm font-medium text-[var(--color-primary)] border border-[var(--color-primary)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors cursor-pointer"
                          >
                            {t("myCourses.clearFilters")}
                          </button>
                        ) : (
                          <Link
                            href={`/${locale}/courses`}
                            className="px-5 py-2 sm:px-6 sm:py-2.5 btn-gold text-[var(--color-button-text)] text-xs sm:text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                          >
                            {t("myCourses.viewCourses")}
                          </Link>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {courses.map((course) => {
                      const action = getActionButton(course);
                      const ActionIcon = action.icon;
                      const deadline = deadlineInfo(course.nextDeadline, t);
                      const completedModules =
                        course.totalModules > 0
                          ? Math.round(
                              (course.progress / 100) * course.totalModules
                            )
                          : 0;

                      const cardTitle = isRTL && course.titleAr ? course.titleAr : course.title;
                      const cardInitial = (cardTitle || "?").trim().charAt(0).toUpperCase();
                      return (
                        <div
                          key={course.id}
                          className="group bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden relative flex flex-col shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
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
                                deliveryType: course.deliveryType,
                              })
                            }
                            className={`absolute top-3 ${isRTL ? "left-3" : "right-3"} z-10 w-8 h-8 bg-[var(--color-surface-card)] rounded-full flex items-center justify-center shadow-md hover:bg-[var(--color-border-subtle)] transition-colors`}
                            aria-label={
                              isFavourite(course.id)
                                ? t("favourites.removeFromFavourites")
                                : t("favourites.addToFavourites")
                            }
                          >
                            <Heart
                              className={`w-4 h-4 ${isFavourite(course.id) ? "text-red-500 fill-red-500" : "text-[var(--color-icon)]"}`}
                            />
                          </button>

                          {/* Deadline Badge */}
                          {deadline && (
                            <div
                              className={`absolute top-3 ${isRTL ? "right-3" : "left-3"} z-10 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold shadow-sm ${deadline.color}`}
                            >
                              <AlertTriangle className="w-3 h-3" />
                              {deadline.label}
                            </div>
                          )}

                          {/* Completed Badge */}
                          {course.enrollmentStatus === "completed" && !deadline && (
                            <div
                              className={`absolute top-3 ${isRTL ? "right-3" : "left-3"} z-10 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200 shadow-sm`}
                            >
                              <CheckCircle className="w-3 h-3" />
                              {t("myCourses.completedBadge")}
                            </div>
                          )}

                          {/* Thumbnail — 16:9 */}
                          <div className="relative w-full aspect-[16/9] bg-[var(--color-surface-page)] overflow-hidden">
                            {course.thumbnail ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={course.thumbnail}
                                alt={course.title}
                                className="w-full h-full object-cover object-top"
                              />
                            ) : (
                              <div
                                className="w-full h-full flex items-center justify-center"
                                style={{
                                  background:
                                    "linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))",
                                }}
                              >
                                <span className="text-white text-6xl font-bold opacity-90 select-none">
                                  {cardInitial}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Course Info */}
                          <div className="p-3 sm:p-4 flex flex-col flex-1">
                            {/* Title */}
                            <h3 className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)] mb-2 line-clamp-2">
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
                                <div className="w-5 h-5 rounded-full bg-[var(--color-border)] flex items-center justify-center">
                                  <span className="text-[8px] font-medium text-[var(--color-text-secondary)]">
                                    {course.instructorName
                                      ?.split(" ")
                                      .map((n) => n[0])
                                      .join("")
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </span>
                                </div>
                              )}
                              <span className="text-[10px] sm:text-xs text-[var(--color-text-secondary)] truncate">
                                {course.instructorName}
                              </span>
                            </div>

                            {/* Progress Bar */}
                            <div className="mb-2">
                              <div
                                className={`flex items-center justify-between text-[10px] sm:text-xs mb-1 ${isRTL ? "flex-row-reverse" : ""}`}
                              >
                                <span className="text-[var(--color-text-secondary)]">
                                  {t("myCourses.modulesCompleted", { completed: completedModules, total: course.totalModules })}
                                </span>
                                <span className="font-medium text-[var(--color-text-primary)]">
                                  {course.progress}%
                                </span>
                              </div>
                              <div className="h-1.5 sm:h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
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
                                  {t("myCourses.missingItems", { count: course.missingTasksCount })}
                                </span>
                              )}

                              {/* Last Accessed */}
                              {course.lastAccessedAt && (
                                <span className="flex items-center gap-1 text-[var(--color-text-secondary)]">
                                  <Clock className="w-3 h-3" />
                                  {relativeTime(course.lastAccessedAt, t)}
                                </span>
                              )}
                            </div>

                            {/* Alert Badge + Action-required pill —
                                stack vertically so they never compete for
                                space inside a single line. The action pill
                                surfaces certificate / evaluation status so
                                the student doesn't need to open details
                                just to discover something needs doing. */}
                            {(getAlertBadge(course) || getActionRequiredPill(course)) && (
                              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                                {getAlertBadge(course)}
                                {getActionRequiredPill(course)}
                              </div>
                            )}

                            {/* Spacer to push buttons to bottom */}
                            <div className="flex-1" />

                            {/* Action Buttons */}
                            <div className="flex flex-col gap-2 mt-2">
                              <Link
                                href={action.href}
                                className={`flex items-center justify-center gap-1.5 w-full py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${action.className}`}
                              >
                                <ActionIcon className="w-3.5 h-3.5" />
                                {action.label}
                              </Link>
                              {action.showCertificate && (
                                <Link
                                  href={`/${locale}/dashboard/student/certifications`}
                                  className="flex items-center justify-center gap-1.5 w-full py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors bg-[#8B5CF6] text-white hover:bg-[#7C3AED]"
                                >
                                  <Award className="w-3.5 h-3.5" />
                                  {t("myCourses.viewCertificate")}
                                </Link>
                              )}
                              {course.enrollmentStatus === "active" &&
                                canDropCourseNow(course.startDate) && (
                                  <button
                                    onClick={() => setDropCourseId(course.id)}
                                    className="flex items-center justify-center gap-1.5 w-full py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors border border-red-300 text-red-600 hover:bg-red-50 cursor-pointer"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    {t("courseDetail.dropCourse")}
                                  </button>
                                )}
                              {course.enrollmentStatus === "completed" &&
                                (() => {
                                  const courseDone = reviewed.has(course.id);
                                  const instructorDone = reviewedInstructor.has(course.id);
                                  const hasInstructor = !!course.instructorName;
                                  // Determine which kinds are still required
                                  const pendingKinds: ReviewKind[] = [];
                                  if (!courseDone) pendingKinds.push("course");
                                  if (!instructorDone && hasInstructor) pendingKinds.push("instructor");
                                  if (pendingKinds.length === 0) return null;
                                  return (
                                    <button
                                      onClick={() =>
                                        setReviewCourse({
                                          id: course.id,
                                          title: isRTL && course.titleAr ? course.titleAr : course.title,
                                          kinds: pendingKinds,
                                          instructorName: course.instructorName,
                                        })
                                      }
                                      className="flex items-center justify-center gap-1.5 w-full py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors border border-[#FDE68A] text-[#B45309] bg-[#FFFBEB] hover:bg-[#FEF3C7] cursor-pointer"
                                    >
                                      <Star className="w-3.5 h-3.5" />
                                      {t("myCourses.leaveReview")}
                                    </button>
                                  );
                                })()}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Page-numbered pagination (matches inst/mng) */}
                {!loading && !error && totalPages > 1 && (
                  <div className={`flex items-center justify-between mt-6 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
                      {t("myCourses.showingRange", {
                        from: (page - 1) * ITEMS_PER_PAGE + 1,
                        to: Math.min(page * ITEMS_PER_PAGE, total),
                        total,
                      })}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => goToPage(page - 1)}
                        disabled={page === 1}
                        className="p-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        aria-label={t("myCourses.previousPage")}
                      >
                        {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                      </button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) pageNum = i + 1;
                        else if (page <= 3) pageNum = i + 1;
                        else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
                        else pageNum = page - 2 + i;
                        return (
                          <button
                            key={pageNum}
                            type="button"
                            onClick={() => goToPage(pageNum)}
                            className={`w-9 h-9 rounded-lg text-sm font-medium cursor-pointer ${
                              pageNum === page
                                ? "bg-[var(--color-primary)] text-white"
                                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => goToPage(page + 1)}
                        disabled={page === totalPages}
                        className="p-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        aria-label={t("myCourses.nextPage")}
                      >
                        {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Drop Course Confirmation Modal */}
      {dropCourseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {t("courseDetail.dropConfirmTitle")}
                </h3>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] mb-6">
                {t("courseDetail.dropConfirmMessage")}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDropCourseId(null)}
                  disabled={dropping}
                  className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors cursor-pointer"
                >
                  {t("courseDetail.cancel")}
                </button>
                <button
                  onClick={handleDropCourse}
                  disabled={dropping}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {dropping ? t("courseDetail.dropping") : t("courseDetail.confirmDrop")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Combined review modal — one dialog, both reviews */}
      {reviewCourse && (
        <ReviewModal
          kinds={reviewCourse.kinds}
          courseId={reviewCourse.id}
          courseTitle={reviewCourse.title}
          instructorName={reviewCourse.instructorName}
          onClose={() => setReviewCourse(null)}
          onSubmitted={(submitted) => {
            const courseId = reviewCourse.id;
            if (submitted.includes("course")) {
              setReviewed((prev) => new Set(prev).add(courseId));
            }
            if (submitted.includes("instructor")) {
              setReviewedInstructor((prev) => new Set(prev).add(courseId));
            }
            // Close only when ALL pending kinds in this session succeeded;
            // partial-success keeps the modal open for retry.
            if (submitted.length === reviewCourse.kinds.length) {
              setReviewCourse(null);
            }
          }}
          isRTL={isRTL}
        />
      )}
    </>
  );
};

export default MyCoursesContent;
