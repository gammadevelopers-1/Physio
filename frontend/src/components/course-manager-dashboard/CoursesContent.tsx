"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import { useManagerProfile } from "@/hooks/useManagerProfile";
import { useCourseManagerCourses } from "@/hooks/useCourseManagerCourses";
import { courseManagerApi, ApiError } from "@/lib/api";
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
  Loader2,
  CheckCircle,
  FileText,
  Archive,
  Play,
  Trash2,
  MessageSquare,
  Award,
  Eye,
  EyeOff,
  Star,
} from "lucide-react";

const CourseCardSkeleton = () => (
  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
    <div className="h-36 bg-[var(--color-border)] animate-pulse" />
    <div className="p-4 space-y-3">
      <div className="h-5 w-3/4 bg-[var(--color-border)] rounded animate-pulse" />
      <div className="h-3 w-1/2 bg-[var(--color-border)] rounded animate-pulse" />
      <div className="flex gap-3">
        <div className="h-4 w-20 bg-[var(--color-border)] rounded animate-pulse" />
        <div className="h-4 w-20 bg-[var(--color-border)] rounded animate-pulse" />
        <div className="h-4 w-20 bg-[var(--color-border)] rounded animate-pulse" />
      </div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <div className="h-3 w-16 bg-[var(--color-border)] rounded animate-pulse" />
          <div className="h-3 w-8 bg-[var(--color-border)] rounded animate-pulse" />
        </div>
        <div className="h-1.5 w-full bg-[var(--color-border)] rounded-full animate-pulse" />
      </div>
      <div className="h-9 w-full bg-[var(--color-border)] rounded-lg animate-pulse" />
    </div>
  </div>
);

const statusIcons: Record<string, React.ReactNode> = {
  active: <Play className="w-3.5 h-3.5" />,
  draft: <FileText className="w-3.5 h-3.5" />,
  pending_review: <AlertCircle className="w-3.5 h-3.5" />,
  changes_requested: <AlertCircle className="w-3.5 h-3.5" />,
  completed: <CheckCircle className="w-3.5 h-3.5" />,
  archived: <Archive className="w-3.5 h-3.5" />,
};

const CoursesContent = () => {
  const manager = useManagerProfile();
  const locale = useLocale();
  const isRTL = locale === "ar";
  const router = useRouter();
  const t = useTranslations("courseManagerDashboard");
  const tA = useTranslations("accessibility");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deliveryFilter, setDeliveryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { courses, total, loading, error, refetch } = useCourseManagerCourses({
    status: statusFilter,
    delivery: deliveryFilter,
    search: searchQuery,
    sort: sortBy,
    page: 1,
    limit: 50,
  });

  const [requestChangesId, setRequestChangesId] = useState<string | null>(null);
  const [requestChangesNote, setRequestChangesNote] = useState("");
  const [requestingChanges, setRequestingChanges] = useState(false);

  const [ratingsMap, setRatingsMap] = useState<Record<string, { avgRating: number; totalRatings: number }>>({});
  useEffect(() => {
    courseManagerApi.getAllCourseRatings().then(setRatingsMap).catch(() => {});
  }, []);

  const handleAction = useCallback(
    async (courseId: string, action: "activate" | "archive" | "delete" | "approve" | "complete" | "toggle_public" | "hide_public" | "toggle_featured", currentValue?: boolean) => {
      setOpenDropdown(null);
      setStatusLoading(courseId);
      try {
        if (action === "activate" || action === "approve") {
          await courseManagerApi.activateCourse(courseId);
        } else if (action === "archive") {
          await courseManagerApi.deactivateCourse(courseId);
        } else if (action === "complete") {
          await courseManagerApi.completeCourse(courseId);
        } else if (action === "delete") {
          await courseManagerApi.deleteCourse(courseId);
        } else if (action === "toggle_public" || action === "hide_public") {
          await courseManagerApi.updateCourse(courseId, { visibleOnPublicSite: !currentValue });
        } else if (action === "toggle_featured") {
          await courseManagerApi.toggleFeatured(courseId);
        }
        toast.success(
          action === "toggle_public" || action === "hide_public"
            ? t(currentValue ? "coursesPage.hiddenFromPublic" : "coursesPage.shownOnPublic")
            : action === "toggle_featured"
              ? t(currentValue ? "coursesPage.unfeaturedToast" : "coursesPage.featuredToast")
              : t("coursesPage.statusChanged"),
        );
        refetch();
      } catch (err) {
        if (err instanceof ApiError) {
          const parsed = (() => { try { return JSON.parse(err.message); } catch { return null; } })();
          if (parsed?.code === "PENDING_MATERIALS_BLOCK") {
            toast.error(t("coursesPage.completionBlocked", { count: parsed.pendingCount }), { duration: 8000 });
          } else if (parsed?.pendingMaterials) {
            toast.error(t("coursesPage.activationFailed"), {
              description: parsed.pendingMaterials.join(", "),
              duration: 8000,
            });
          } else if (parsed?.outOfRangeSessions) {
            toast.error(parsed.message, {
              description: parsed.outOfRangeSessions.join(", "),
              duration: 8000,
            });
          } else {
            toast.error(err.message);
          }
        } else {
          toast.error(t("coursesPage.statusFailed"));
        }
      } finally {
        setStatusLoading(null);
      }
    },
    [t, refetch]
  );

  const handleRequestChanges = useCallback(
    async (courseId: string) => {
      if (!requestChangesNote.trim()) return;
      setRequestingChanges(true);
      try {
        await courseManagerApi.requestChanges(courseId, requestChangesNote.trim());
        toast.success(t("coursesPage.statusChanged"));
        setRequestChangesId(null);
        setRequestChangesNote("");
        refetch();
      } catch (err) {
        if (err instanceof ApiError) {
          toast.error(err.message);
        } else {
          toast.error(t("coursesPage.statusFailed"));
        }
      } finally {
        setRequestingChanges(false);
      }
    },
    [requestChangesNote, t, refetch]
  );

  const activeCourses = courses.filter((c) => c.status === "active").length;
  const totalEnrolled = courses.reduce((acc, c) => acc + c.enrolledCount, 0);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-[#DCFCE7] text-[#22C55E]",
      draft: "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]",
      pending_review: "bg-[#EEF2FF] text-[#6366F1]",
      changes_requested: "bg-[#FEF3C7] text-[#D97706]",
      completed: "bg-[var(--color-border-subtle)] text-[var(--color-primary)]",
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

      <div className="bg-[var(--color-surface-page)] min-h-screen">
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
                  <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                    {t("coursesPage.title")}
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    {t("coursesPage.subtitle")}
                  </p>
                </div>
                <Link
                  href={`/${locale}/dashboard/manager/courses/create`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {t("coursesPage.createCourse")}
                </Link>
              </div>

              {/* Stats Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t("coursesPage.stats.total")}
                  </p>
                  <p className="text-2xl font-bold text-[var(--color-text-secondary)] mt-1">
                    {loading ? "—" : total}
                  </p>
                </div>
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t("coursesPage.stats.active")}
                  </p>
                  <p className="text-2xl font-bold text-[#22C55E] mt-1">
                    {loading ? "—" : activeCourses}
                  </p>
                </div>
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t("coursesPage.stats.totalEnrollments")}
                  </p>
                  <p className="text-2xl font-bold text-[var(--color-text-secondary)] mt-1">
                    {loading ? "—" : totalEnrolled}
                  </p>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 mb-6">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]`} />
                    <input
                      type="text"
                      placeholder={t("coursesPage.searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} py-2.5 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent`}
                    />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] bg-[var(--color-surface-card)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
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
                      <option value="pending_review">
                        {t("coursesPage.filters.pendingReview")}
                      </option>
                      <option value="changes_requested">
                        {t("coursesPage.filters.changesRequested")}
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
                      className="px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] bg-[var(--color-surface-card)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
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
                      className="px-3 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] bg-[var(--color-surface-card)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
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
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-12 text-center">
                  <div className="w-16 h-16 bg-[var(--color-border-subtle)] rounded-full flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-8 h-8 text-[var(--color-text-secondary)]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                    {t("coursesPage.noCourses")}
                  </h3>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                    {t("coursesPage.noCoursesDesc")}
                  </p>
                  <Link
                    href={`/${locale}/dashboard/manager/courses/create`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg transition-colors"
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

                    const cardInitial = (courseTitle || "?").trim().charAt(0).toUpperCase();
                    const hasThumb = !!course.thumbnail;
                    return (
                      <div
                        key={course.id}
                        className="group bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border-subtle)] overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
                      >
                        <div className="relative w-full aspect-[16/9] bg-[var(--color-surface-page)] overflow-hidden">
                          {hasThumb ? (
                            <Image
                              src={thumbnailSrc}
                              alt={courseTitle}
                              fill
                              className="object-cover object-top"
                              unoptimized={thumbnailSrc.startsWith("http")}
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
                          <span
                            className={`absolute top-3 ${isRTL ? "right-3" : "left-3"} px-2.5 py-1 rounded-full text-[11px] font-semibold shadow-sm ${getStatusBadge(course.status)}`}
                          >
                            {t(`coursesPage.status.${course.status}`)}
                          </span>
                          <div
                            className={`absolute bottom-3 ${isRTL ? "right-3" : "left-3"} inline-flex items-center gap-1.5 bg-[var(--color-primary)] rounded-full px-2.5 py-1 shadow-sm`}
                          >
                            <span className="text-white">{getDeliveryIcon(course.deliveryType)}</span>
                            <span className="text-white text-[11px] font-semibold">
                              {t(`coursesPage.delivery.${course.deliveryType}`)}
                            </span>
                          </div>
                          {/* Context-aware action dropdown */}
                          {(course.status === "draft" || course.status === "pending_review" || course.status === "active" || course.status === "completed") && (
                          <div className={`absolute top-3 ${isRTL ? "left-3" : "right-3"}`} ref={openDropdown === course.id ? dropdownRef : undefined}>
                            <button
                              onClick={() => setOpenDropdown(openDropdown === course.id ? null : course.id)}
                              disabled={statusLoading === course.id}
                              className="p-1.5 bg-[var(--color-surface-card)]/90 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-card)] transition-colors disabled:opacity-50"
                              aria-label={tA("openActions")}
                              aria-haspopup="true"
                              aria-expanded={openDropdown === course.id}
                            >
                              {statusLoading === course.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <MoreVertical className="w-4 h-4" />
                              )}
                            </button>

                            {openDropdown === course.id && (
                              <div className="absolute end-0 top-full mt-1 w-48 bg-[var(--color-surface-card)] rounded-lg border border-[var(--color-border)] shadow-lg z-20" role="menu">
                                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                                  {t("coursesPage.actions.title")}
                                </p>

                                {/* Draft: Activate + Delete */}
                                {course.status === "draft" && (
                                  <>
                                    <button
                                      onClick={() => handleAction(course.id, "activate")}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#22C55E] hover:bg-[#F0FDF4] transition-colors"
                                      role="menuitem"
                                    >
                                      <Play className="w-3.5 h-3.5" />
                                      {t("coursesPage.actions.activate")}
                                    </button>
                                    <button
                                      onClick={() => handleAction(course.id, "delete")}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#EF4444] hover:bg-[#FEF2F2] transition-colors"
                                      role="menuitem"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      {t("coursesPage.actions.delete")}
                                    </button>
                                  </>
                                )}

                                {/* Pending Review: Approve + Request Changes */}
                                {course.status === "pending_review" && (
                                  <>
                                    <button
                                      onClick={() => handleAction(course.id, "approve")}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#22C55E] hover:bg-[#F0FDF4] transition-colors"
                                      role="menuitem"
                                    >
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      {t("coursesPage.actions.approve")}
                                    </button>
                                    <button
                                      onClick={() => {
                                        setOpenDropdown(null);
                                        setRequestChangesId(course.id);
                                        setRequestChangesNote("");
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#D97706] hover:bg-[#FFFBEB] transition-colors"
                                      role="menuitem"
                                    >
                                      <MessageSquare className="w-3.5 h-3.5" />
                                      {t("coursesPage.actions.requestChanges")}
                                    </button>
                                  </>
                                )}

                                {/* Active: Public visibility toggle + Feature + Complete + Archive */}
                                {course.status === "active" && (
                                  <>
                                    <button
                                      onClick={() => handleAction(course.id, "toggle_public", course.visibleOnPublicSite !== false)}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] transition-colors"
                                      role="menuitem"
                                    >
                                      {course.visibleOnPublicSite !== false ? (
                                        <>
                                          <EyeOff className="w-3.5 h-3.5" />
                                          {t("coursesPage.actions.hideFromPublic")}
                                        </>
                                      ) : (
                                        <>
                                          <Eye className="w-3.5 h-3.5" />
                                          {t("coursesPage.actions.showOnPublic")}
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => handleAction(course.id, "toggle_featured", course.isFeatured === true)}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] transition-colors"
                                      role="menuitem"
                                    >
                                      <Star
                                        className={`w-3.5 h-3.5 ${course.isFeatured ? "text-[var(--color-star)] fill-[var(--color-star)]" : ""}`}
                                      />
                                      {course.isFeatured
                                        ? t("coursesPage.actions.unfeature")
                                        : t("coursesPage.actions.feature")}
                                    </button>
                                    <button
                                      onClick={() => handleAction(course.id, "complete")}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-primary)] hover:bg-[var(--color-border-subtle)] transition-colors"
                                      role="menuitem"
                                    >
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      {t("coursesPage.actions.complete")}
                                    </button>
                                    <button
                                      onClick={() => handleAction(course.id, "archive")}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#D97706] hover:bg-[#FFFBEB] transition-colors"
                                      role="menuitem"
                                    >
                                      <Archive className="w-3.5 h-3.5" />
                                      {t("coursesPage.actions.archive")}
                                    </button>
                                  </>
                                )}

                                {/* Completed: Public visibility toggle + Archive */}
                                {course.status === "completed" && (
                                  <>
                                    <button
                                      onClick={() => handleAction(course.id, "toggle_public", course.visibleOnPublicSite !== false)}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] transition-colors"
                                      role="menuitem"
                                    >
                                      {course.visibleOnPublicSite !== false ? (
                                        <>
                                          <EyeOff className="w-3.5 h-3.5" />
                                          {t("coursesPage.actions.hideFromPublic")}
                                        </>
                                      ) : (
                                        <>
                                          <Eye className="w-3.5 h-3.5" />
                                          {t("coursesPage.actions.showOnPublic")}
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => handleAction(course.id, "archive")}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#D97706] hover:bg-[#FFFBEB] transition-colors"
                                      role="menuitem"
                                    >
                                      <Archive className="w-3.5 h-3.5" />
                                      {t("coursesPage.actions.archive")}
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                          )}
                        </div>

                        <div className="p-4 flex flex-col flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-base font-semibold text-[var(--color-text-primary)] line-clamp-1 flex-1 min-w-0">
                              {courseTitle}
                            </h3>
                            {course.isFeatured && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[var(--gold-gold-100)] text-[var(--color-star)] rounded text-[10px] font-semibold flex-shrink-0"
                                title={t("coursesPage.featuredBadge")}
                              >
                                <Star className="w-2.5 h-2.5 fill-current" />
                                {t("coursesPage.featuredBadge")}
                              </span>
                            )}
                          </div>

                          {course.instructorName && (
                            <p className="text-xs text-[var(--color-text-secondary)] mb-3">
                              {course.instructorName}
                            </p>
                          )}

                          <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)] mb-3">
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              {course.enrolledCount}{" "}
                              {t("coursesPage.students")}
                            </span>
                            {course.deliveryType === "self-paced" ? (
                              <span className="flex items-center gap-1">
                                <BookOpen className="w-3.5 h-3.5" />
                                {course.totalModules ?? 0}{" "}
                                {t("coursesPage.modules")}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {course.completedSessions}/
                                {course.totalSessions}{" "}
                                {t("coursesPage.sessions")}
                              </span>
                            )}
                            {course.cmeHours != null && course.cmeHours > 0 && (
                              <span className="flex items-center gap-1">
                                <Award className="w-3.5 h-3.5 text-[#D4A520]" />
                                {course.cmeHours} CME
                              </span>
                            )}
                            {ratingsMap[course.id] && ratingsMap[course.id].totalRatings > 0 && (
                              <span className="flex items-center gap-1">
                                <Star className="w-3.5 h-3.5 text-[var(--color-star)] fill-[var(--color-star)]" />
                                <span className="font-medium text-[var(--color-text-primary)]">
                                  {ratingsMap[course.id].avgRating.toFixed(1)}
                                </span>
                                <span>({ratingsMap[course.id].totalRatings})</span>
                              </span>
                            )}
                          </div>

                          {course.completionRate > 0 && (
                            <div className="mb-4">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-[var(--color-text-secondary)]">
                                  {t("coursesPage.completion")}
                                </span>
                                <span className="font-medium text-[var(--color-text-primary)]">
                                  {course.completionRate}%
                                </span>
                              </div>
                              <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#22C55E] rounded-full transition-all"
                                  style={{
                                    width: `${course.completionRate}%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          <div className="flex-1" />
                          <div className="h-px bg-[var(--color-border-subtle)] mt-1 mb-3" />
                          <div className="flex gap-2">
                            <Link
                              href={`/${locale}/dashboard/manager/courses/${course.id}`}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 btn-gold text-[var(--color-button-text)] text-sm font-semibold rounded-lg transition-colors"
                            >
                              {t("coursesPage.manage")}
                              <ChevronRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
                            </Link>
                            <button
                              onClick={() => router.push(`/${locale}/dashboard/manager/courses/${course.id}`)}
                              className="p-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)] transition-colors"
                              aria-label={tA("viewAnalytics")}
                            >
                              <BarChart3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => router.push(`/${locale}/dashboard/manager/courses/${course.id}`)}
                              className="p-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)] transition-colors"
                              aria-label={tA("courseSettings")}
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

              {/* Request Changes Modal */}
              {requestChangesId && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-[var(--color-surface-card)] rounded-xl shadow-xl w-full max-w-md p-6">
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                      {t("coursesPage.actions.requestChanges")}
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                      {t("coursesPage.actions.requestChangesDesc")}
                    </p>
                    <textarea
                      value={requestChangesNote}
                      onChange={(e) => setRequestChangesNote(e.target.value)}
                      placeholder={t("coursesPage.actions.requestChangesPlaceholder")}
                      className="w-full border border-[var(--color-border)] rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] min-h-[100px] resize-none"
                    />
                    <div className="flex justify-end gap-3 mt-4">
                      <button
                        onClick={() => {
                          setRequestChangesId(null);
                          setRequestChangesNote("");
                        }}
                        className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors"
                      >
                        {t("coursesPage.actions.cancel")}
                      </button>
                      <button
                        onClick={() => handleRequestChanges(requestChangesId)}
                        disabled={!requestChangesNote.trim() || requestingChanges}
                        className="px-4 py-2 text-sm text-white bg-[#D97706] hover:bg-[#B45309] rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {requestingChanges && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {t("coursesPage.actions.send")}
                      </button>
                    </div>
                  </div>
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
