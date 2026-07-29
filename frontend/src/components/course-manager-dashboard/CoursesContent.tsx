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
import Select from "@/components/admin-dashboard/Select";
import {
  Search,
  Plus,
  Users,
  Calendar,
  MoreVertical,
  Video,
  MapPin,
  BookOpen,
  ChevronLeft,
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
  Copy,
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
  ended: <AlertCircle className="w-3.5 h-3.5" />,
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
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Reset to page 1 whenever filters or search change so the user always
  // lands on the first page of new results, not an out-of-range page.
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, deliveryFilter, sortBy, searchQuery]);
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

  const { courses, total, totalPages, loading, error, refetch } = useCourseManagerCourses({
    status: statusFilter,
    delivery: deliveryFilter,
    search: searchQuery,
    sort: sortBy,
    page: currentPage,
    limit: ITEMS_PER_PAGE,
  });

  const [requestChangesId, setRequestChangesId] = useState<string | null>(null);
  const [requestChangesNote, setRequestChangesNote] = useState("");
  const [requestingChanges, setRequestingChanges] = useState(false);

  // Delete-confirm modal. Two variants of copy based on the source status —
  // ended deletes refund every paid buyer and revoke stray certs (see
  // backend remove() branch); archived deletes preserve student certs +
  // CME rows for NELC compliance.
  const [deleteConfirm, setDeleteConfirm] = useState<
    { id: string; status: string; title: string } | null
  >(null);
  const [deleting, setDeleting] = useState(false);

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

  const handleDuplicate = useCallback(
    async (courseId: string) => {
      setOpenDropdown(null);
      setStatusLoading(courseId);
      try {
        const created = await courseManagerApi.duplicateCourse(courseId);
        toast.success(t("coursesPage.actions.duplicateSuccess"));
        // Land straight on the new draft so the manager can set the new
        // dates immediately — this is the whole point of Duplicate.
        router.push(`/${locale}/dashboard/manager/courses/${created.id}`);
      } catch (err) {
        if (err instanceof ApiError) {
          toast.error(err.message);
        } else {
          toast.error(t("coursesPage.actions.duplicateFailed"));
        }
        setStatusLoading(null);
      }
    },
    [locale, router, t]
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
      ended: "bg-[#EDE9FE] text-[#6D28D9]",
      completed: "bg-[var(--color-border-subtle)] text-[var(--color-primary)]",
      archived: "bg-[#FEF3C7] text-[#D4A520]",
      cancelled: "bg-[#FEE2E2] text-[#B91C1C]",
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
                      className={`w-full ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)] focus:border-transparent`}
                    />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Select
                      value={statusFilter}
                      onChange={setStatusFilter}
                      className="w-40"
                      options={[
                        { value: "all", label: t("coursesPage.filters.allStatus") },
                        { value: "active", label: t("coursesPage.filters.active") },
                        { value: "draft", label: t("coursesPage.filters.draft") },
                        { value: "pending_review", label: t("coursesPage.filters.pendingReview") },
                        { value: "changes_requested", label: t("coursesPage.filters.changesRequested") },
                        { value: "ended", label: t("coursesPage.filters.ended") },
                        { value: "completed", label: t("coursesPage.filters.completed") },
                        { value: "cancelled", label: t("coursesPage.filters.cancelled") },
                        { value: "archived", label: t("coursesPage.filters.archived") },
                      ]}
                    />

                    <Select
                      value={deliveryFilter}
                      onChange={setDeliveryFilter}
                      className="w-40"
                      options={[
                        { value: "all", label: t("coursesPage.filters.allDelivery") },
                        { value: "zoom", label: t("coursesPage.delivery.zoom") },
                        { value: "onsite", label: t("coursesPage.delivery.onsite") },
                        { value: "blended", label: t("coursesPage.delivery.blended") },
                        { value: "webinar", label: t("coursesPage.delivery.webinar") },
                      ]}
                    />

                    <Select
                      value={sortBy}
                      onChange={setSortBy}
                      className="w-40"
                      options={[
                        { value: "newest", label: t("coursesPage.sort.newest") },
                        { value: "oldest", label: t("coursesPage.sort.oldest") },
                        { value: "students", label: t("coursesPage.sort.mostStudents") },
                        { value: "alphabetical", label: t("coursesPage.sort.alphabetical") },
                      ]}
                    />
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
                        className="group relative bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
                      >
                        {/* `overflow-hidden` lives only on the thumbnail so it
                            doesn't clip the action dropdown menu, which extends
                            below this box. The outer card is `relative` so the
                            dropdown stays anchored to the card. */}
                        <div className="relative w-full aspect-[16/9] bg-[var(--color-surface-page)] overflow-hidden rounded-t-2xl">
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
                        </div>

                        {/* Context-aware action dropdown — lifted OUT of the
                            thumbnail box (which has overflow-hidden) so the
                            menu can extend below the thumbnail without being
                            clipped by the next card. Anchored to the outer
                            card via `relative` set on its root. */}
                        {/* Dropdown always renders — Duplicate is available
                            on every status, and each status branch below
                            adds its own lifecycle actions on top of it. */}
                        {(
                          <div className={`absolute top-3 ${isRTL ? "left-3" : "right-3"} z-30`} ref={openDropdown === course.id ? dropdownRef : undefined}>
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
                              <div className="absolute end-0 top-full mt-1 w-48 bg-[var(--color-surface-card)] rounded-lg border border-[var(--color-border)] shadow-lg z-30" role="menu">
                                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                                  {t("coursesPage.actions.title")}
                                </p>

                                {/* Duplicate — available for every status.
                                    Clones the course into a fresh draft and
                                    navigates straight to its edit page. */}
                                <button
                                  onClick={() => handleDuplicate(course.id)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] transition-colors"
                                  role="menuitem"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  {t("coursesPage.actions.duplicate")}
                                </button>

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

                                {/* Ended: Mark Completed (fires cert / CME
                                    fanout) + Delete (goes through the
                                    ended-delete branch on the backend —
                                    refunds every paid buyer, revokes any
                                    stray certs, notifies students). */}
                                {course.status === "ended" && (
                                  <>
                                    <button
                                      onClick={() => handleAction(course.id, "complete")}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-primary)] hover:bg-[var(--color-border-subtle)] transition-colors"
                                      role="menuitem"
                                    >
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      {t("coursesPage.actions.markCompleted")}
                                    </button>
                                    <button
                                      onClick={() => {
                                        setOpenDropdown(null);
                                        setDeleteConfirm({
                                          id: course.id,
                                          status: course.status,
                                          title: courseTitle,
                                        });
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#EF4444] hover:bg-[#FEF2F2] transition-colors"
                                      role="menuitem"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      {t("coursesPage.actions.delete")}
                                    </button>
                                  </>
                                )}

                                {/* Archived: permanent delete. Backend soft-
                                    deletes with hideFromAdminOnly=true so
                                    student certificates + CME records keep
                                    working for NELC compliance. */}
                                {course.status === "archived" && (
                                  <button
                                    onClick={() => {
                                      setOpenDropdown(null);
                                      setDeleteConfirm({
                                        id: course.id,
                                        status: course.status,
                                        title: courseTitle,
                                      });
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#EF4444] hover:bg-[#FEF2F2] transition-colors"
                                    role="menuitem"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    {t("coursesPage.actions.deletePermanently")}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

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
                              className="p-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors"
                              aria-label={tA("viewAnalytics")}
                            >
                              <BarChart3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => router.push(`/${locale}/dashboard/manager/courses/${course.id}`)}
                              className="p-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors"
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

              {/* Pagination */}
              {!loading && !error && totalPages > 1 && (
                <div className={`flex items-center justify-between mt-6 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
                    {Math.min(currentPage * ITEMS_PER_PAGE, total)} / {total}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      aria-label={tA("previousPage") || "Previous page"}
                    >
                      {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) pageNum = i + 1;
                      else if (currentPage <= 3) pageNum = i + 1;
                      else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                      else pageNum = currentPage - 2 + i;
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-9 h-9 rounded-lg text-sm font-medium cursor-pointer ${
                            pageNum === currentPage
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
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      aria-label={tA("nextPage") || "Next page"}
                    >
                      {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Delete-confirmation modal. Two copy variants:
                    - ended → warns about refunds + student notification cascade
                    - archived → warns records-preserved, admin-only hide
                  Copy pulled from translations so both en + ar render right. */}
              {deleteConfirm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-[var(--color-surface-card)] rounded-xl shadow-xl w-full max-w-md p-6">
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                      {deleteConfirm.status === "ended"
                        ? t("coursesPage.deleteConfirm.endedTitle")
                        : deleteConfirm.status === "archived"
                          ? t("coursesPage.deleteConfirm.archivedTitle")
                          : t("coursesPage.actions.delete")}
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {deleteConfirm.title}
                      </span>
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                      {deleteConfirm.status === "ended"
                        ? t("coursesPage.deleteConfirm.endedBody")
                        : deleteConfirm.status === "archived"
                          ? t("coursesPage.deleteConfirm.archivedBody")
                          : ""}
                    </p>
                    <div className="flex justify-end gap-3 mt-4">
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        disabled={deleting}
                        className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors disabled:opacity-50"
                      >
                        {t("coursesPage.actions.cancel")}
                      </button>
                      <button
                        onClick={async () => {
                          if (!deleteConfirm) return;
                          setDeleting(true);
                          try {
                            await courseManagerApi.deleteCourse(deleteConfirm.id);
                            toast.success(t("coursesPage.statusChanged"));
                            setDeleteConfirm(null);
                            refetch();
                          } catch (err) {
                            const msg =
                              err instanceof ApiError
                                ? err.message
                                : t("coursesPage.statusFailed");
                            toast.error(msg);
                          } finally {
                            setDeleting(false);
                          }
                        }}
                        disabled={deleting}
                        className="px-4 py-2 text-sm text-white bg-[#EF4444] hover:bg-[#DC2626] rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {deleteConfirm.status === "ended"
                          ? t("coursesPage.deleteConfirm.confirmEnded")
                          : deleteConfirm.status === "archived"
                            ? t("coursesPage.deleteConfirm.confirmArchived")
                            : t("coursesPage.actions.delete")}
                      </button>
                    </div>
                  </div>
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
                      className="w-full border border-[var(--color-input-border)] rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)] min-h-[100px] resize-none"
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
