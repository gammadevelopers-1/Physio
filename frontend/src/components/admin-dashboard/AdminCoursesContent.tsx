"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import AdminSidebar from "./AdminSidebar";
import AdminMobileSidebar from "./AdminMobileSidebar";
import AdminNavbar from "./AdminNavbar";
import SearchableSelect, { SearchableOption } from "./SearchableSelect";
import Select from "./Select";
import {
  BookOpen,
  Search,
  Grid,
  List,
  Users,
  MoreVertical,
  Eye,
  Edit,
  Archive,
  ArchiveRestore,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Star,
  Globe,
  EyeOff,
  PlayCircle,
  X,
  Calendar,
  Video,
  MapPin,
  Award,
  GraduationCap,
  UserCog,
} from "lucide-react";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { useAdminCourses } from "@/hooks/useAdminCourses";
import { adminApi, courseManagerApi, FilterPerson } from "@/lib/api";
import type { InstructorCourse, CourseEnrollment } from "@/types/instructor-dashboard";

const ITEMS_PER_PAGE = 12;

type ConfirmKind = "archive" | "delete" | null;

const AdminCoursesContent = () => {
  const t = useTranslations("adminDashboard");
  const tA = useTranslations("accessibility");
  const admin = useAdminProfile();
  const locale = useLocale();
  const isRTL = locale === "ar";
  const router = useRouter();

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deliveryFilter, setDeliveryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [instructorId, setInstructorId] = useState<string | null>(null);
  const [managerId, setManagerId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Filter dropdown sources
  const [instructorsList, setInstructorsList] = useState<FilterPerson[]>([]);
  const [managersList, setManagersList] = useState<FilterPerson[]>([]);
  const [listsLoading, setListsLoading] = useState(true);

  // Modal state
  const [confirmKind, setConfirmKind] = useState<ConfirmKind>(null);
  const [confirmCourse, setConfirmCourse] = useState<InstructorCourse | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [requestChangesCourse, setRequestChangesCourse] = useState<InstructorCourse | null>(null);
  const [requestChangesNote, setRequestChangesNote] = useState("");
  const [requestChangesBusy, setRequestChangesBusy] = useState(false);

  // Per-card action busy state — keyed by course ID + action so the
  // button shows a spinner without locking the whole grid.
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Enrolled students inline modal — admin clicks the student count
  // on a card to peek the roster without leaving the listing.
  const [studentsCourse, setStudentsCourse] = useState<InstructorCourse | null>(null);
  const [studentsList, setStudentsList] = useState<CourseEnrollment[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsSearch, setStudentsSearch] = useState("");

  // Debounce the search input
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, deliveryFilter, sortBy, instructorId, managerId]);

  // Load filter option lists once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [instructors, managers] = await Promise.all([
          adminApi.getInstructorsList(),
          adminApi.getManagersList(),
        ]);
        if (!cancelled) {
          setInstructorsList(instructors);
          setManagersList(managers);
        }
      } catch {
        // Non-fatal — filters just won't be populated.
      } finally {
        if (!cancelled) setListsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { courses, total, totalPages, loading, error, refetch } = useAdminCourses({
    status: statusFilter,
    delivery: deliveryFilter,
    search: searchQuery,
    sort: sortBy,
    page: currentPage,
    limit: ITEMS_PER_PAGE,
    instructorId: instructorId ?? undefined,
    managerId: managerId ?? undefined,
  });

  // Close action dropdown on outside click
  useEffect(() => {
    if (!openDropdownId) return;
    const close = () => setOpenDropdownId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openDropdownId]);

  const formatPerson = (p: FilterPerson): SearchableOption => {
    const name = [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email;
    return { value: p.id, label: name, hint: p.email };
  };
  const instructorOptions = useMemo(
    () => instructorsList.map(formatPerson),
    [instructorsList],
  );
  const managerOptions = useMemo(
    () => managersList.map(formatPerson),
    [managersList],
  );

  // Stats — page-scoped totals are misleading for the admin view; show
  // backend total and derive page-local stats clearly.
  const activeCount = courses.filter((c) => c.status === "active").length;
  const pendingCount = courses.filter((c) => c.status === "pending_review").length;
  const enrollmentsCount = courses.reduce((acc, c) => acc + (c.enrolledCount || 0), 0);

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "active":
        return "bg-[#DCFCE7] text-[#16A34A]";
      case "draft":
        return "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
      case "completed":
        return "bg-[var(--color-border-subtle)] text-[#1D4ED8]";
      case "archived":
        return "bg-[#FEF3C7] text-[#D97706]";
      case "pending_review":
        return "bg-[#FEF3C7] text-[#D97706]";
      case "changes_requested":
        return "bg-[#FEE2E2] text-[#DC2626]";
      default:
        return "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
    }
  };

  const statusKey = (status: string) =>
    status === "pending_review"
      ? "pendingReview"
      : status === "changes_requested"
        ? "changesRequested"
        : status;

  // ─── Display helpers ─────────────────────────────────────────────
  // Price: "Free" when 0/null, "SAR {x}" otherwise. Bare "0" reads as
  // a missing value rather than an intentional free course.
  const formatPrice = (price: number | null | undefined): string => {
    const n = price ?? 0;
    if (n <= 0) return t("coursesPage.card.free");
    return `SAR ${n.toLocaleString()}`;
  };

  // Capacity: show only the count when there's no max (rendering "∞"
  // is noise). Otherwise show "enrolled/max".
  const formatCapacity = (
    enrolled: number,
    max: number | null | undefined,
  ): string => {
    if (max == null) return `${enrolled}`;
    return `${enrolled}/${max}`;
  };

  const getDeliveryIcon = (delivery: string) => {
    switch (delivery) {
      case "zoom":
        return <Video className="w-3.5 h-3.5" />;
      case "onsite":
        return <MapPin className="w-3.5 h-3.5" />;
      case "blended":
        return <BookOpen className="w-3.5 h-3.5" />;
      case "webinar":
        return <Video className="w-3.5 h-3.5" />;
      default:
        return <BookOpen className="w-3.5 h-3.5" />;
    }
  };

  const buildPageNumbers = (current: number, totalP: number): number[] => {
    if (totalP <= 5) return Array.from({ length: totalP }, (_, i) => i + 1);
    if (current <= 3) return [1, 2, 3, 4, 5];
    if (current >= totalP - 2)
      return [totalP - 4, totalP - 3, totalP - 2, totalP - 1, totalP];
    return [current - 2, current - 1, current, current + 1, current + 2];
  };

  // --- Action handlers ---

  const runAction = async (
    courseId: string,
    action: string,
    fn: () => Promise<unknown>,
    successKey: string,
    failKey: string,
  ) => {
    const key = `${courseId}:${action}`;
    if (busyKey) return;
    setBusyKey(key);
    setOpenDropdownId(null);
    try {
      await fn();
      toast.success(t(successKey));
      refetch();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t(failKey),
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleActivate = (c: InstructorCourse) =>
    runAction(
      c.id,
      "activate",
      () => adminApi.activateCourse(c.id),
      "coursesPage.toasts.activated",
      "coursesPage.toasts.activateFailed",
    );

  const handleApprove = (c: InstructorCourse) =>
    runAction(
      c.id,
      "approve",
      () => adminApi.activateCourse(c.id),
      "coursesPage.toasts.approved",
      "coursesPage.toasts.approveFailed",
    );

  const handleComplete = (c: InstructorCourse) =>
    runAction(
      c.id,
      "complete",
      () => adminApi.completeCourse(c.id),
      "coursesPage.toasts.completed",
      "coursesPage.toasts.completeFailed",
    );

  const handleToggleFeatured = (c: InstructorCourse) =>
    runAction(
      c.id,
      "feature",
      () => adminApi.toggleCourseFeatured(c.id),
      c.isFeatured
        ? "coursesPage.toasts.unfeatured"
        : "coursesPage.toasts.featured",
      "coursesPage.toasts.featureFailed",
    );

  const handleTogglePublic = (c: InstructorCourse) =>
    runAction(
      c.id,
      "visibility",
      () =>
        adminApi.updateCourse(c.id, {
          visibleOnPublicSite: !c.visibleOnPublicSite,
        }),
      c.visibleOnPublicSite
        ? "coursesPage.toasts.madePrivate"
        : "coursesPage.toasts.madePublic",
      "coursesPage.toasts.visibilityFailed",
    );

  // --- Confirmation modal flow (Archive + Delete) ---

  const openConfirm = (kind: "archive" | "delete", c: InstructorCourse) => {
    setOpenDropdownId(null);
    setConfirmCourse(c);
    setConfirmKind(kind);
  };
  const closeConfirm = () => {
    if (confirmBusy) return;
    setConfirmKind(null);
    setConfirmCourse(null);
  };
  const handleConfirm = async () => {
    if (!confirmCourse || !confirmKind) return;
    setConfirmBusy(true);
    try {
      if (confirmKind === "archive") {
        await adminApi.deactivateCourse(confirmCourse.id);
        toast.success(t("coursesPage.toasts.archived"));
      } else {
        await adminApi.deleteCourse(confirmCourse.id);
        toast.success(t("coursesPage.toasts.deleted"));
      }
      setConfirmKind(null);
      setConfirmCourse(null);
      refetch();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t(
              confirmKind === "archive"
                ? "coursesPage.toasts.archiveFailed"
                : "coursesPage.toasts.deleteFailed",
            ),
      );
    } finally {
      setConfirmBusy(false);
    }
  };

  // --- Enrolled students modal flow ---

  const openStudentsModal = async (course: InstructorCourse) => {
    setStudentsCourse(course);
    setStudentsList([]);
    setStudentsSearch("");
    setStudentsLoading(true);
    try {
      const list = await courseManagerApi.getEnrollments({ courseId: course.id });
      setStudentsList(list);
    } catch {
      toast.error(t("coursesPage.toasts.studentsLoadFailed"));
      setStudentsCourse(null);
    } finally {
      setStudentsLoading(false);
    }
  };
  const closeStudentsModal = () => {
    setStudentsCourse(null);
    setStudentsList([]);
    setStudentsSearch("");
  };
  const filteredStudents = useMemo(() => {
    if (!studentsSearch.trim()) return studentsList;
    const q = studentsSearch.trim().toLowerCase();
    return studentsList.filter((s) => {
      const name = `${s.studentFirstName} ${s.studentLastName}`.toLowerCase();
      return (
        name.includes(q) ||
        s.studentEmail.toLowerCase().includes(q) ||
        (s.studentScfhsNumber || "").toLowerCase().includes(q)
      );
    });
  }, [studentsList, studentsSearch]);

  // --- Request Changes modal flow ---

  const openRequestChanges = (c: InstructorCourse) => {
    setOpenDropdownId(null);
    setRequestChangesCourse(c);
    setRequestChangesNote("");
  };
  const closeRequestChanges = () => {
    if (requestChangesBusy) return;
    setRequestChangesCourse(null);
    setRequestChangesNote("");
  };
  const handleRequestChangesSubmit = async () => {
    if (!requestChangesCourse) return;
    const note = requestChangesNote.trim();
    if (!note) {
      toast.error(t("coursesPage.requestChangesModal.noteRequired"));
      return;
    }
    setRequestChangesBusy(true);
    try {
      await adminApi.requestCourseChanges(requestChangesCourse.id, note);
      toast.success(t("coursesPage.toasts.requestChangesSent"));
      setRequestChangesCourse(null);
      setRequestChangesNote("");
      refetch();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t("coursesPage.toasts.requestChangesFailed"),
      );
    } finally {
      setRequestChangesBusy(false);
    }
  };

  // --- Per-status action menu items ---

  const renderActionsMenu = (course: InstructorCourse) => {
    const itemCls =
      "flex items-center gap-2 w-full px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] text-start transition-colors";
    const dangerCls =
      "flex items-center gap-2 w-full px-4 py-2 text-sm text-[#DC2626] hover:bg-[#FEE2E2] text-start transition-colors";

    const viewLink = `/${locale}/dashboard/admin/courses/${course.id}`;
    const editLink = `/${locale}/dashboard/admin/courses/${course.id}/edit`;

    return (
      <>
        <Link href={viewLink} className={itemCls}>
          <Eye className="w-4 h-4" />
          {t("coursesPage.actions.view")}
        </Link>
        <Link href={editLink} className={itemCls}>
          <Edit className="w-4 h-4" />
          {t("coursesPage.actions.edit")}
        </Link>

        {course.status === "draft" && (
          <>
            <button
              onClick={() => handleActivate(course)}
              className={itemCls}
              disabled={!!busyKey}
            >
              <PlayCircle className="w-4 h-4" />
              {t("coursesPage.actions.activate")}
            </button>
            <button onClick={() => openConfirm("delete", course)} className={dangerCls}>
              <Trash2 className="w-4 h-4" />
              {t("coursesPage.actions.delete")}
            </button>
          </>
        )}

        {course.status === "pending_review" && (
          <>
            <button
              onClick={() => handleApprove(course)}
              className={itemCls}
              disabled={!!busyKey}
            >
              <CheckCircle2 className="w-4 h-4" />
              {t("coursesPage.actions.approve")}
            </button>
            <button onClick={() => openRequestChanges(course)} className={itemCls}>
              <XCircle className="w-4 h-4" />
              {t("coursesPage.actions.requestChanges")}
            </button>
          </>
        )}

        {course.status === "active" && (
          <>
            <button
              onClick={() => handleTogglePublic(course)}
              className={itemCls}
              disabled={!!busyKey}
            >
              {course.visibleOnPublicSite ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Globe className="w-4 h-4" />
              )}
              {course.visibleOnPublicSite
                ? t("coursesPage.actions.makePrivate")
                : t("coursesPage.actions.makePublic")}
            </button>
            <button
              onClick={() => handleToggleFeatured(course)}
              className={itemCls}
              disabled={!!busyKey}
            >
              <Star className="w-4 h-4" />
              {course.isFeatured
                ? t("coursesPage.actions.unfeature")
                : t("coursesPage.actions.feature")}
            </button>
            <button
              onClick={() => handleComplete(course)}
              className={itemCls}
              disabled={!!busyKey}
            >
              <CheckCircle2 className="w-4 h-4" />
              {t("coursesPage.actions.complete")}
            </button>
            <button onClick={() => openConfirm("archive", course)} className={dangerCls}>
              <Archive className="w-4 h-4" />
              {t("coursesPage.actions.archive")}
            </button>
          </>
        )}

        {course.status === "completed" && (
          <>
            <button
              onClick={() => handleTogglePublic(course)}
              className={itemCls}
              disabled={!!busyKey}
            >
              {course.visibleOnPublicSite ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Globe className="w-4 h-4" />
              )}
              {course.visibleOnPublicSite
                ? t("coursesPage.actions.makePrivate")
                : t("coursesPage.actions.makePublic")}
            </button>
            <button onClick={() => openConfirm("archive", course)} className={dangerCls}>
              <Archive className="w-4 h-4" />
              {t("coursesPage.actions.archive")}
            </button>
          </>
        )}

        {course.status === "archived" && (
          <button
            onClick={() => handleActivate(course)}
            className={itemCls}
            disabled={!!busyKey}
          >
            <ArchiveRestore className="w-4 h-4" />
            {t("coursesPage.actions.unarchive")}
          </button>
        )}
      </>
    );
  };

  return (
    <>
      <AdminNavbar admin={admin} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <AdminSidebar admin={admin} />
            </div>

            <AdminMobileSidebar admin={admin} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                    {t("coursesPage.title")}
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    {t("coursesPage.subtitle")}
                  </p>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                  <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{total}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{t("coursesPage.stats.total")}</p>
                </div>
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                  <p className="text-2xl font-bold text-[#16A34A]">{activeCount}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{t("coursesPage.stats.active")}</p>
                </div>
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                  <p className="text-2xl font-bold text-[var(--color-primary)]">{enrollmentsCount}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{t("coursesPage.stats.enrollments")}</p>
                </div>
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                  <p className="text-2xl font-bold text-[#D97706]">{pendingCount}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{t("coursesPage.stats.pendingReview")}</p>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 mb-6 space-y-3">
                {/* Top row: search + view toggle */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Search
                      className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
                    />
                    <input
                      type="text"
                      placeholder={t("coursesPage.searchPlaceholder")}
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className={`w-full h-10 border border-[var(--color-input-border)] rounded-lg text-sm ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} focus:outline-none focus:border-[#002D87]`}
                    />
                  </div>
                  <div className="flex items-center gap-1 border border-[var(--color-border)] rounded-lg p-1 self-stretch sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setViewMode("grid")}
                      aria-label={t("coursesPage.viewGrid")}
                      className={`p-2 rounded ${viewMode === "grid" ? "btn-gold text-[var(--color-button-text)]" : "text-[var(--color-text-secondary)]"}`}
                    >
                      <Grid className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("list")}
                      aria-label={t("coursesPage.viewList")}
                      className={`p-2 rounded ${viewMode === "list" ? "btn-gold text-[var(--color-button-text)]" : "text-[var(--color-text-secondary)]"}`}
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Filter row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <Select
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      { value: "all", label: t("coursesPage.filters.allStatus") },
                      { value: "draft", label: t("coursesPage.filters.draft") },
                      { value: "pending_review", label: t("coursesPage.filters.pendingReview") },
                      { value: "changes_requested", label: t("coursesPage.filters.changesRequested") },
                      { value: "active", label: t("coursesPage.filters.active") },
                      { value: "completed", label: t("coursesPage.filters.completed") },
                      { value: "archived", label: t("coursesPage.filters.archived") },
                    ]}
                  />

                  <Select
                    value={deliveryFilter}
                    onChange={setDeliveryFilter}
                    options={[
                      { value: "all", label: t("coursesPage.filters.allDelivery") },
                      { value: "zoom", label: t("coursesPage.filters.zoom") },
                      { value: "onsite", label: t("coursesPage.filters.onsite") },
                      { value: "blended", label: t("coursesPage.filters.blended") },
                      { value: "self-paced", label: t("coursesPage.filters.selfPaced") },
                      { value: "webinar", label: t("coursesPage.filters.webinar") },
                    ]}
                  />

                  <SearchableSelect
                    options={instructorOptions}
                    value={instructorId}
                    onChange={setInstructorId}
                    placeholder={t("coursesPage.filters.allInstructors")}
                    searchPlaceholder={t("coursesPage.filters.searchInstructor")}
                    emptyLabel={t("coursesPage.filters.noMatches")}
                    clearLabel={t("coursesPage.filters.clear")}
                    disabled={listsLoading}
                  />

                  <SearchableSelect
                    options={managerOptions}
                    value={managerId}
                    onChange={setManagerId}
                    placeholder={t("coursesPage.filters.allManagers")}
                    searchPlaceholder={t("coursesPage.filters.searchManager")}
                    emptyLabel={t("coursesPage.filters.noMatches")}
                    clearLabel={t("coursesPage.filters.clear")}
                    disabled={listsLoading}
                  />

                  <Select
                    value={sortBy}
                    onChange={setSortBy}
                    options={[
                      { value: "newest", label: t("coursesPage.sort.newest") },
                      { value: "oldest", label: t("coursesPage.sort.oldest") },
                      { value: "alphabetical", label: t("coursesPage.sort.alphabetical") },
                      { value: "students", label: t("coursesPage.sort.students") },
                    ]}
                  />
                </div>
              </div>

              {/* Loading State */}
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
                </div>
              )}

              {/* Error State */}
              {error && !loading && (
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-red-200 py-12 text-center">
                  <p className="text-red-600 mb-4">{t("coursesPage.error")}</p>
                  <button
                    onClick={refetch}
                    className="px-4 py-2 btn-gold text-[var(--color-button-text)] rounded-lg"
                  >
                    {t("coursesPage.retry")}
                  </button>
                </div>
              )}

              {/* Courses Grid/List */}
              {!loading && !error && courses.length > 0 && (
                <>
                  {viewMode === "grid" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {courses.map((course) => {
                        const courseTitle =
                          locale === "ar" && course.titleAr ? course.titleAr : course.title;
                        const hasThumb = !!course.thumbnail;
                        const cardInitial = (courseTitle || "?").trim().charAt(0).toUpperCase();
                        const isBusy = !!(busyKey && busyKey.startsWith(`${course.id}:`));
                        return (
                          <div
                            key={course.id}
                            className="group relative bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
                          >
                            {/* Thumbnail — overflow-hidden only here so the
                                top-right dropdown can extend below. */}
                            <div className="relative w-full aspect-[16/9] bg-[var(--color-surface-page)] overflow-hidden rounded-t-2xl">
                              {hasThumb ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={course.thumbnail || ""}
                                  alt={courseTitle}
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
                              <span
                                className={`absolute top-3 ${isRTL ? "right-3" : "left-3"} px-2.5 py-1 rounded-full text-[11px] font-semibold shadow-sm ${getStatusBadgeStyle(course.status)}`}
                              >
                                {t(`coursesPage.filters.${statusKey(course.status)}`)}
                              </span>
                              <div
                                className={`absolute bottom-3 ${isRTL ? "right-3" : "left-3"} inline-flex items-center gap-1.5 bg-[var(--color-primary)] rounded-full px-2.5 py-1 shadow-sm`}
                              >
                                <span className="text-white">{getDeliveryIcon(course.deliveryType)}</span>
                                <span className="text-white text-[11px] font-semibold">
                                  {t(`coursesPage.filters.${course.deliveryType === "self-paced" ? "selfPaced" : course.deliveryType}`)}
                                </span>
                              </div>
                            </div>

                            {/* Action dropdown — pulled OUT of the thumbnail
                                so it doesn't get clipped, anchored to the
                                outer card via its `relative` root. */}
                            <div className={`absolute top-3 ${isRTL ? "left-3" : "right-3"} z-30`}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenDropdownId(
                                    openDropdownId === course.id ? null : course.id,
                                  );
                                }}
                                disabled={isBusy}
                                className="p-1.5 bg-[var(--color-surface-card)]/95 rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-card)] shadow-sm transition-colors disabled:opacity-50"
                                aria-label={tA("openActions")}
                                aria-haspopup="true"
                                aria-expanded={openDropdownId === course.id}
                              >
                                {isBusy ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <MoreVertical className="w-4 h-4" />
                                )}
                              </button>
                              {openDropdownId === course.id && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className={`absolute top-full mt-1 bg-[var(--color-surface-card)] rounded-lg shadow-lg border border-[var(--color-border)] py-1 min-w-[200px] z-30 ${isRTL ? "left-0" : "right-0"}`}
                                  role="menu"
                                >
                                  {renderActionsMenu(course)}
                                </div>
                              )}
                            </div>

                            {/* Card body */}
                            <div className="p-4 flex flex-col flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-base font-semibold text-[var(--color-text-primary)] line-clamp-1 flex-1 min-w-0">
                                  {courseTitle}
                                </h3>
                                {course.isFeatured && (
                                  <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[var(--gold-gold-100)] text-[var(--color-star)] rounded text-[10px] font-semibold flex-shrink-0"
                                    title={t("coursesPage.featured")}
                                  >
                                    <Star className="w-2.5 h-2.5 fill-current" />
                                    {t("coursesPage.featured")}
                                  </span>
                                )}
                              </div>

                              {/* Instructor + Manager association — both
                                  shown so admin can see WHO owns this course
                                  without opening the detail page. */}
                              <div className="space-y-1 mb-3">
                                <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                                  <GraduationCap className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span className="font-medium text-[var(--color-text-primary)]">
                                    {t("coursesPage.card.instructor")}:
                                  </span>
                                  <span className="truncate">
                                    {course.instructorName || t("coursesPage.card.unassigned")}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                                  <UserCog className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span className="font-medium text-[var(--color-text-primary)]">
                                    {t("coursesPage.card.manager")}:
                                  </span>
                                  <span className="truncate">
                                    {course.managerName || t("coursesPage.card.unassigned")}
                                  </span>
                                </div>
                              </div>

                              {/* Stats row */}
                              <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-secondary)] mb-3">
                                <button
                                  type="button"
                                  onClick={() => openStudentsModal(course)}
                                  disabled={course.enrolledCount === 0}
                                  className="flex items-center gap-1 hover:text-[var(--color-primary)] transition-colors disabled:cursor-default disabled:hover:text-[var(--color-text-secondary)]"
                                  title={
                                    course.enrolledCount > 0
                                      ? t("coursesPage.card.viewStudents")
                                      : undefined
                                  }
                                >
                                  <Users className="w-3.5 h-3.5" />
                                  <span className={course.enrolledCount > 0 ? "underline-offset-2 hover:underline" : ""}>
                                    {formatCapacity(course.enrolledCount, course.maxEnrollment)}{" "}
                                    {t("coursesPage.card.students")}
                                  </span>
                                </button>
                                {course.deliveryType === "self-paced" ? (
                                  <span className="flex items-center gap-1">
                                    <BookOpen className="w-3.5 h-3.5" />
                                    {course.totalModules ?? 0}{" "}
                                    {t("coursesPage.card.modules")}
                                  </span>
                                ) : (
                                  course.totalSessions > 0 && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3.5 h-3.5" />
                                      {course.completedSessions}/{course.totalSessions}{" "}
                                      {t("coursesPage.card.sessions")}
                                    </span>
                                  )
                                )}
                                {course.cmeHours != null && course.cmeHours > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Award className="w-3.5 h-3.5 text-[#D4A520]" />
                                    {course.cmeHours} CME
                                  </span>
                                )}
                              </div>

                              {/* Completion progress */}
                              {course.completionRate > 0 && (
                                <div className="mb-4">
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className="text-[var(--color-text-secondary)]">
                                      {t("coursesPage.card.completion")}
                                    </span>
                                    <span className="font-medium text-[var(--color-text-primary)]">
                                      {course.completionRate}%
                                    </span>
                                  </div>
                                  <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-[#22C55E] rounded-full transition-all"
                                      style={{ width: `${course.completionRate}%` }}
                                    />
                                  </div>
                                </div>
                              )}

                              <div className="flex-1" />

                              {/* Footer: price + primary Manage */}
                              <div className="h-px bg-[var(--color-border-subtle)] mt-1 mb-3" />
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-[var(--color-text-primary)] flex-shrink-0">
                                  {formatPrice(course.price)}
                                </span>
                                <div className="flex-1" />
                                <Link
                                  href={`/${locale}/dashboard/admin/courses/${course.id}`}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 btn-gold text-[var(--color-button-text)] text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
                                >
                                  {t("coursesPage.actions.manage")}
                                  <ChevronRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
                                </Link>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-[var(--color-surface-page)] border-b border-[var(--color-border)]">
                            <tr>
                              <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                                {t("coursesPage.table.course")}
                              </th>
                              <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                                {t("coursesPage.table.instructor")}
                              </th>
                              <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                                {t("coursesPage.table.manager")}
                              </th>
                              <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                                {t("coursesPage.table.status")}
                              </th>
                              <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                                {t("coursesPage.table.enrolled")}
                              </th>
                              <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                                {t("coursesPage.table.completion")}
                              </th>
                              <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                                {t("coursesPage.table.price")}
                              </th>
                              <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                                {t("coursesPage.table.actions")}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {courses.map((course) => (
                              <tr
                                key={course.id}
                                className="border-b border-[#F3F4F6] hover:bg-[var(--color-border-subtle)]"
                              >
                                <td className="px-4 py-4">
                                  <Link
                                    href={`/${locale}/dashboard/admin/courses/${course.id}`}
                                    className="text-sm font-medium text-[var(--color-text-primary)] hover:underline"
                                  >
                                    {locale === "ar" && course.titleAr ? course.titleAr : course.title}
                                  </Link>
                                </td>
                                <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)]">
                                  {course.instructorName || t("coursesPage.card.unassigned")}
                                </td>
                                <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)]">
                                  {course.managerName || t("coursesPage.card.unassigned")}
                                </td>
                                <td className="px-4 py-4">
                                  <span
                                    className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusBadgeStyle(course.status)}`}
                                  >
                                    {t(`coursesPage.filters.${statusKey(course.status)}`)}
                                  </span>
                                </td>
                                <td className="px-4 py-4 text-sm">
                                  <button
                                    type="button"
                                    onClick={() => openStudentsModal(course)}
                                    disabled={course.enrolledCount === 0}
                                    className="text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:underline disabled:cursor-default disabled:no-underline disabled:hover:text-[var(--color-text-secondary)]"
                                  >
                                    {formatCapacity(course.enrolledCount, course.maxEnrollment)}
                                  </button>
                                </td>
                                <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)]">
                                  {course.completionRate}%
                                </td>
                                <td className="px-4 py-4 text-sm font-medium text-[var(--color-text-primary)]">
                                  {formatPrice(course.price)}
                                </td>
                                <td className="px-4 py-4">
                                  <div className="relative inline-block">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenDropdownId(
                                          openDropdownId === course.id ? null : course.id,
                                        );
                                      }}
                                      className="p-2 hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors"
                                    >
                                      {busyKey && busyKey.startsWith(`${course.id}:`) ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-[var(--color-text-secondary)]" />
                                      ) : (
                                        <MoreVertical className="w-4 h-4 text-[var(--color-text-secondary)]" />
                                      )}
                                    </button>
                                    {openDropdownId === course.id && (
                                      <div
                                        onClick={(e) => e.stopPropagation()}
                                        className={`absolute top-full mt-1 bg-[var(--color-surface-card)] rounded-lg shadow-lg border border-[var(--color-border)] py-1 min-w-[180px] z-10 ${isRTL ? "left-0" : "right-0"}`}
                                      >
                                        {renderActionsMenu(course)}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-6">
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {t("coursesPage.showing", {
                          from: (currentPage - 1) * ITEMS_PER_PAGE + 1,
                          to: Math.min(currentPage * ITEMS_PER_PAGE, total),
                          total,
                        })}
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          aria-label={tA("previousPage")}
                          className="p-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                        </button>
                        {buildPageNumbers(currentPage, totalPages).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setCurrentPage(p)}
                            className={`w-9 h-9 rounded-lg text-sm font-medium ${
                              p === currentPage
                                ? "bg-[var(--color-primary)] text-white"
                                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setCurrentPage((p) => Math.min(totalPages, p + 1))
                          }
                          disabled={currentPage === totalPages}
                          aria-label={tA("nextPage")}
                          className="p-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Empty State */}
              {!loading && !error && courses.length === 0 && (
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] py-12 text-center">
                  <BookOpen className="w-12 h-12 text-[var(--color-text-secondary)] mx-auto mb-4" />
                  <p className="text-[var(--color-text-secondary)]">
                    {t("coursesPage.noCourses")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal — Archive / Delete */}
      {confirmKind && confirmCourse && (
        <ModalBackdrop onClose={closeConfirm}>
          <div className="bg-[var(--color-surface-card)] rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
              {confirmKind === "archive"
                ? t("coursesPage.confirmArchive.title")
                : t("coursesPage.confirmDelete.title")}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-5">
              {confirmKind === "archive"
                ? t("coursesPage.confirmArchive.body", {
                    title:
                      locale === "ar" && confirmCourse.titleAr
                        ? confirmCourse.titleAr
                        : confirmCourse.title,
                  })
                : t("coursesPage.confirmDelete.body", {
                    title:
                      locale === "ar" && confirmCourse.titleAr
                        ? confirmCourse.titleAr
                        : confirmCourse.title,
                  })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeConfirm}
                disabled={confirmBusy}
                className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors disabled:opacity-50"
              >
                {t("coursesPage.confirmArchive.cancel")}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={confirmBusy}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#DC2626] rounded-lg hover:bg-[#B91C1C] transition-colors disabled:opacity-50"
              >
                {confirmBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                {confirmKind === "archive"
                  ? t("coursesPage.confirmArchive.confirm")
                  : t("coursesPage.confirmDelete.confirm")}
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {/* Enrolled Students Modal */}
      {studentsCourse && (
        <ModalBackdrop onClose={closeStudentsModal}>
          <div className="bg-[var(--color-surface-card)] rounded-xl shadow-xl max-w-2xl w-full p-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {t("coursesPage.studentsModal.title")}
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)] mt-0.5 line-clamp-1">
                  {locale === "ar" && studentsCourse.titleAr
                    ? studentsCourse.titleAr
                    : studentsCourse.title}
                </p>
              </div>
              <span className="text-xs text-[var(--color-text-secondary)] flex-shrink-0">
                {studentsList.length}{" "}
                {t("coursesPage.card.students")}
              </span>
            </div>

            <div className="relative mb-3">
              <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`} />
              <input
                type="text"
                value={studentsSearch}
                onChange={(e) => setStudentsSearch(e.target.value)}
                placeholder={t("coursesPage.studentsModal.searchPlaceholder")}
                className={`w-full h-10 border border-[var(--color-input-border)] rounded-lg text-sm ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} focus:outline-none focus:border-[var(--color-primary)]`}
              />
            </div>

            {studentsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-10 text-sm text-[var(--color-text-secondary)]">
                {studentsList.length === 0
                  ? t("coursesPage.studentsModal.empty")
                  : t("coursesPage.studentsModal.noMatches")}
              </div>
            ) : (
              <div className="max-h-[420px] overflow-y-auto -mx-2">
                <div className="space-y-1 px-2">
                  {filteredStudents.map((s) => {
                    const fullName = `${s.studentFirstName} ${s.studentLastName}`.trim() || s.studentEmail;
                    const initials = fullName
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          closeStudentsModal();
                          router.push(
                            `/${locale}/dashboard/admin/users?q=${encodeURIComponent(s.studentEmail)}`,
                          );
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors text-start"
                      >
                        <div className="w-9 h-9 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                            {fullName}
                          </p>
                          <p className="text-xs text-[var(--color-text-secondary)] truncate">
                            {s.studentEmail}
                            {s.studentScfhsNumber && (
                              <>
                                {" • "}
                                {t("coursesPage.studentsModal.scfhs")}: {s.studentScfhsNumber}
                              </>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-[var(--color-text-secondary)] hidden sm:inline">
                            {s.progress}%
                          </span>
                          <ChevronRight className={`w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "rotate-180" : ""}`} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={closeStudentsModal}
                className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
              >
                {t("coursesPage.studentsModal.close")}
              </button>
              <Link
                href={`/${locale}/dashboard/admin/courses/${studentsCourse.id}`}
                onClick={closeStudentsModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium btn-gold text-[var(--color-button-text)] rounded-lg transition-colors"
              >
                {t("coursesPage.studentsModal.openCourse")}
                <ChevronRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
              </Link>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {/* Request Changes Modal */}
      {requestChangesCourse && (
        <ModalBackdrop onClose={closeRequestChanges}>
          <div className="bg-[var(--color-surface-card)] rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
              {t("coursesPage.requestChangesModal.title")}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4">
              {t("coursesPage.requestChangesModal.body", {
                title:
                  locale === "ar" && requestChangesCourse.titleAr
                    ? requestChangesCourse.titleAr
                    : requestChangesCourse.title,
              })}
            </p>
            <textarea
              value={requestChangesNote}
              onChange={(e) => setRequestChangesNote(e.target.value)}
              placeholder={t("coursesPage.requestChangesModal.placeholder")}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-[var(--color-input-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)] resize-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={closeRequestChanges}
                disabled={requestChangesBusy}
                className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors disabled:opacity-50"
              >
                {t("coursesPage.requestChangesModal.cancel")}
              </button>
              <button
                type="button"
                onClick={handleRequestChangesSubmit}
                disabled={requestChangesBusy || !requestChangesNote.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50"
              >
                {requestChangesBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("coursesPage.requestChangesModal.submit")}
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}
    </>
  );
};

// ─── Modal shell ──────────────────────────────────────────────

function ModalBackdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handle);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handle);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-3 -right-3 w-8 h-8 bg-[var(--color-surface-card)] rounded-full shadow flex items-center justify-center hover:bg-[var(--color-border-subtle)] transition-colors z-10"
        >
          <X className="w-4 h-4 text-[var(--color-text-secondary)]" />
        </button>
        {children}
      </div>
    </div>
  );
}

export default AdminCoursesContent;
