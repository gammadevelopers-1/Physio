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
  X,
} from "lucide-react";
import { studentApi } from "@/lib/api";
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

type TabFilter = "all" | "active" | "completed" | "dropped";

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const absDiff = Math.abs(diff);
  const minutes = Math.floor(absDiff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function deadlineInfo(dateStr: string | null): {
  label: string;
  color: string;
  isOverdue: boolean;
} | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff < 0) return { label: "Overdue", color: "text-red-600 bg-red-50", isOverdue: true };
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days === 0) return { label: `Due in ${hours}h`, color: "text-amber-600 bg-amber-50", isOverdue: false };
  if (days <= 3) return { label: `Due in ${days}d`, color: "text-amber-600 bg-amber-50", isOverdue: false };
  return null;
}

const getSortForTab = (tab: TabFilter): string | undefined => {
  switch (tab) {
    case "active":
      return "recent";
    case "completed":
      return "completed_date";
    case "dropped":
      return "recent";
    default:
      return undefined;
  }
};

const getStatusForTab = (tab: TabFilter): string | undefined => {
  switch (tab) {
    case "active":
      return "active";
    case "completed":
      return "completed";
    case "dropped":
      return "dropped";
    default:
      return undefined;
  }
};

interface LeaveReviewModalProps {
  courseId: string;
  courseTitle: string;
  onClose: () => void;
  onSubmitted: () => void;
  t: (key: string) => string;
  isRTL: boolean;
}

function LeaveReviewModal({ courseId, courseTitle, onClose, onSubmitted, t, isRTL }: LeaveReviewModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");

  const handleSubmit = async () => {
    if (rating < 1) {
      toast.error(t("myCourses.reviewRatingRequired"));
      return;
    }
    setSubmitting(true);
    try {
      await studentApi.submitCourseRating(courseId, rating, reviewText.trim() || undefined);
      toast.success(t("myCourses.reviewSuccess"));
      onSubmitted();
    } catch (e: unknown) {
      const err = e as { status?: number };
      if (err?.status === 409) {
        // Already reviewed — just close silently; button will hide on next refresh.
        onSubmitted();
      } else {
        toast.error(t("myCourses.reviewError"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("myCourses.reviewTitle")}</h3>
            <button onClick={onClose} className="p-1 hover:bg-[#F3F4F6] rounded">
              <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
            </button>
          </div>

          <p className="text-sm text-[var(--color-text-secondary)] mb-4 truncate">{courseTitle}</p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              {t("myCourses.reviewStarsLabel")} *
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRating(s)}
                  className="p-1 hover:scale-110 transition-transform cursor-pointer"
                  aria-label={`${s} star${s > 1 ? "s" : ""}`}
                >
                  <Star
                    className={`w-8 h-8 ${s <= rating ? "fill-[#FBBF24] text-[#FBBF24]" : "text-[var(--color-border)]"}`}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              {t("myCourses.reviewTextLabel")}
            </label>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              rows={4}
              maxLength={2000}
              dir="auto"
              placeholder={t("myCourses.reviewTextPlaceholder")}
              className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] resize-none"
            />
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">{reviewText.length} / 2000</p>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] transition-colors cursor-pointer"
            >
              {t("courseDetail.cancel")}
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || rating < 1}
              className="px-4 py-2 text-sm font-medium text-white bg-[#3B82F6] rounded-lg hover:bg-[#2563EB] transition-colors cursor-pointer disabled:opacity-50"
            >
              {submitting ? t("myCourses.reviewSubmitting") : t("myCourses.reviewSubmit")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const MyCoursesContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [dropCourseId, setDropCourseId] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const [reviewCourse, setReviewCourse] = useState<{ id: string; title: string } | null>(null);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const { isFavourite, toggleFavourite } = useFavourites();
  const userData = useStudentProfile();

  const { data: courses, loading, error, refetch } = useStudentCourses({
    status: getStatusForTab(activeTab),
    sort: getSortForTab(activeTab),
    limit: 50,
  });

  // Seed the "reviewed" set from the backend's hasReviewed flag per course
  useEffect(() => {
    if (!courses) return;
    const already = new Set<string>();
    for (const c of courses) {
      if ((c as StudentEnrolledCourse).hasReviewed) already.add(c.id);
    }
    setReviewed(already);
  }, [courses]);

  const filteredCourses = courses;

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "all", label: t("myCourses.tabs.all") },
    { key: "active", label: t("myCourses.tabs.inProgress") },
    { key: "completed", label: t("myCourses.tabs.completed") },
    { key: "dropped", label: t("myCourses.tabs.dropped") },
  ];

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

  const handleDropCourse = async () => {
    if (!dropCourseId) return;
    setDropping(true);
    try {
      await studentApi.dropCourse(dropCourseId);
      toast.success(t("courseDetail.dropSuccess"));
      refetch();
    } catch {
      toast.error(t("courseDetail.dropError"));
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

            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] mb-4 sm:mb-6">
                {t("myCourses.title")}
              </h1>

              <OfflineBanner />

              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6">
                <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)] mb-4">
                  {t("myCourses.recentCourses")}
                </h2>

                {/* Tabs */}
                <div className="flex flex-wrap gap-2 mb-6" role="tablist">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      role="tab"
                      aria-selected={activeTab === tab.key}
                      className={`px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                        activeTab === tab.key
                          ? "bg-[var(--color-text-primary)] text-white"
                          : "bg-[#F3F4F6] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Loading / Error / Content */}
                {loading ? (
                  <StudentCoursesGridSkeleton />
                ) : error ? (
                  <StudentDashboardError message={error} onRetry={refetch} />
                ) : filteredCourses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 sm:py-16">
                    <EmptyStateIllustration variant="courses" className="mb-2" />
                    <h3 className="text-sm sm:text-base font-medium text-[var(--color-text-primary)] mb-1">
                      {activeTab === "completed"
                        ? t("myCourses.noCompletedTitle")
                        : activeTab === "dropped"
                          ? t("myCourses.noDroppedTitle")
                          : activeTab === "active"
                            ? t("myCourses.noInProgressTitle")
                            : t("myCourses.noCoursesTitle")}
                    </h3>
                    <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mb-4 sm:mb-6 text-center px-4">
                      {activeTab === "completed"
                        ? t("myCourses.noCompletedDescription")
                        : activeTab === "dropped"
                          ? t("myCourses.noDroppedDescription")
                          : activeTab === "active"
                            ? t("myCourses.noInProgressDescription")
                            : t("myCourses.noCoursesDescription")}
                    </p>
                    {activeTab === "all" && (
                      <Link
                        href={`/${locale}/courses`}
                        className="px-5 py-2 sm:px-6 sm:py-2.5 btn-gold text-white text-xs sm:text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                      >
                        {t("myCourses.viewCourses")}
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {filteredCourses.map((course) => {
                      const action = getActionButton(course);
                      const ActionIcon = action.icon;
                      const deadline = deadlineInfo(course.nextDeadline);
                      const completedModules =
                        course.totalModules > 0
                          ? Math.round(
                              (course.progress / 100) * course.totalModules
                            )
                          : 0;

                      return (
                        <div
                          key={course.id}
                          className="border border-[var(--color-border)] rounded-xl overflow-hidden relative flex flex-col"
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
                              })
                            }
                            className={`absolute top-2 ${isRTL ? "left-2" : "right-2"} z-10 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-50 transition-colors`}
                            aria-label={
                              isFavourite(course.id)
                                ? t("favourites.removeFromFavourites")
                                : t("favourites.addToFavourites")
                            }
                          >
                            <Heart
                              className={`w-4 h-4 ${isFavourite(course.id) ? "text-red-500 fill-red-500" : "text-gray-400"}`}
                            />
                          </button>

                          {/* Deadline Badge */}
                          {deadline && (
                            <div
                              className={`absolute top-2 ${isRTL ? "right-2" : "left-2"} z-10 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium ${deadline.color}`}
                            >
                              <AlertTriangle className="w-3 h-3" />
                              {deadline.label}
                            </div>
                          )}

                          {/* Completed Badge */}
                          {course.enrollmentStatus === "completed" && !deadline && (
                            <div
                              className={`absolute top-2 ${isRTL ? "right-2" : "left-2"} z-10 flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200`}
                            >
                              <CheckCircle className="w-3 h-3" />
                              {t("myCourses.completedBadge")}
                            </div>
                          )}

                          {/* Thumbnail */}
                          <div className="w-full h-[120px] sm:h-[140px] bg-gray-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={
                                course.thumbnail ||
                                "/student_dashboard/courses/image 473.svg"
                              }
                              alt={course.title}
                              className="w-full h-full object-cover"
                            />
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
                                  {relativeTime(course.lastAccessedAt)}
                                </span>
                              )}
                            </div>

                            {/* Alert Badge */}
                            {getAlertBadge(course) && (
                              <div className="mb-2">
                                {getAlertBadge(course)}
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
                              {course.enrollmentStatus === "active" && (
                                <button
                                  onClick={() => setDropCourseId(course.id)}
                                  className="flex items-center justify-center gap-1.5 w-full py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors border border-red-300 text-red-600 hover:bg-red-50 cursor-pointer"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  {t("courseDetail.dropCourse")}
                                </button>
                              )}
                              {course.enrollmentStatus === "completed" && !reviewed.has(course.id) && (
                                <button
                                  onClick={() => setReviewCourse({ id: course.id, title: (isRTL && course.titleAr) ? course.titleAr : course.title })}
                                  className="flex items-center justify-center gap-1.5 w-full py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors border border-[#FDE68A] text-[#B45309] bg-[#FFFBEB] hover:bg-[#FEF3C7] cursor-pointer"
                                >
                                  <Star className="w-3.5 h-3.5" />
                                  {t("myCourses.leaveReview")}
                                </button>
                              )}
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
                  className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-page)] transition-colors cursor-pointer"
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

      {/* Leave Review Modal */}
      {reviewCourse && (
        <LeaveReviewModal
          courseId={reviewCourse.id}
          courseTitle={reviewCourse.title}
          onClose={() => setReviewCourse(null)}
          onSubmitted={() => {
            setReviewed((prev) => new Set(prev).add(reviewCourse.id));
            setReviewCourse(null);
          }}
          t={t}
          isRTL={isRTL}
        />
      )}
    </>
  );
};

export default MyCoursesContent;
