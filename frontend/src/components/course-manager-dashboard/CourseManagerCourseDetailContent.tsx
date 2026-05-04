"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { formatDuration } from "@/lib/utils";
import { formatDate as formatDateHijri } from "@/lib/hijri";
import { useCalendarPreference } from "@/contexts/CalendarContext";
import { toast } from "sonner";
import { useManagerProfile } from "@/hooks/useManagerProfile";
import { courseManagerApi } from "@/lib/api";
import type {
  CourseDetailResponse,
  CourseModule,
} from "@/types/instructor-dashboard";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import NELCScorecardPanel from "@/components/shared/NELCScorecardPanel";
import CourseAssistantsManagePanel from "./CourseAssistantsManagePanel";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  Clock,
  Edit,
  Trash2,
  Users,
  Video,
  MapPin,
  Layers,
  ChevronDown,
  ChevronRight,
  Play,
  AlertTriangle,
  Loader2,
  RefreshCw,
  CheckCircle,
  Archive,
  FileText,
  Image as ImageIcon,
  File,
  X,
  Eye,
  ClipboardCheck,
  Award,
  Star,
} from "lucide-react";

interface CourseManagerCourseDetailContentProps {
  courseId: string;
}

// ─── Skeleton ──────────────────────────────────────────────────
const CourseDetailSkeleton = () => (
  <div className="flex-1 min-w-0 animate-pulse">
    <div className="h-4 w-32 bg-[var(--color-border)] rounded mb-4" />
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden mb-6">
      <div className="h-48 sm:h-56 bg-[var(--color-border)]" />
      <div className="p-5 space-y-3">
        <div className="h-6 w-2/3 bg-[var(--color-border)] rounded" />
        <div className="h-4 w-1/2 bg-[var(--color-border)] rounded" />
      </div>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
          <div className="h-4 w-16 bg-[var(--color-border)] rounded mb-2" />
          <div className="h-6 w-12 bg-[var(--color-border)] rounded" />
        </div>
      ))}
    </div>
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5">
      <div className="h-5 w-32 bg-[var(--color-border)] rounded mb-4" />
      <div className="space-y-3">
        <div className="h-4 w-full bg-[var(--color-border)] rounded" />
        <div className="h-4 w-3/4 bg-[var(--color-border)] rounded" />
      </div>
    </div>
  </div>
);

const CourseManagerCourseDetailContent = ({
  courseId,
}: CourseManagerCourseDetailContentProps) => {
  const t = useTranslations("courseManagerDashboard");
  const locale = useLocale();
  const { calendarFormat } = useCalendarPreference();
  const isRTL = locale === "ar";
  const router = useRouter();
  const manager = useManagerProfile();

  const [course, setCourse] = useState<CourseDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showRequestChanges, setShowRequestChanges] = useState(false);
  const [requestChangesNote, setRequestChangesNote] = useState("");
  const [requestingChanges, setRequestingChanges] = useState(false);

  // Module materials
  interface MaterialItem {
    id: string;
    title: string;
    type: string;
    status: string;
    fileUrl: string | null;
    fileSize: number | null;
    wcagStatus: string | null;
    createdAt: string;
  }
  const [moduleMaterials, setModuleMaterials] = useState<Record<string, MaterialItem[]>>({});
  const [loadingMaterials, setLoadingMaterials] = useState<Set<string>>(new Set());

  // Module assessments
  const [moduleAssessments, setModuleAssessments] = useState<import("@/types/instructor-dashboard").AssessmentResponse[]>([]);
  useEffect(() => {
    if (!courseId) return;
    courseManagerApi.getCourseRatings(courseId, { limit: 5, sort: "highest" })
      .then((res) => setReviews(res?.data || []))
      .catch(() => setReviews([]))
      .finally(() => setReviewsLoading(false));
    courseManagerApi.getAssessments({ courseId, limit: 100 }).then((res) => {
      setModuleAssessments(res.data || []);
    }).catch(() => {});
  }, [courseId]);

  // Remove material modal
  const [removingMaterial, setRemovingMaterial] = useState<MaterialItem | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [removeLoading, setRemoveLoading] = useState(false);

  type ReviewItem = { id: string; rating: number; reviewText: string | null; createdAt: string; studentName: string };
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  const fetchCourse = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await courseManagerApi.getCourseDetail(courseId);
      setCourse(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("courseDetail.loadError")
      );
    } finally {
      setLoading(false);
    }
  }, [courseId, t]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  const handleDelete = async () => {
    if (!course) return;
    setDeleting(true);
    try {
      await courseManagerApi.deleteCourse(course.id);
      toast.success(t("courseDetail.deleteSuccess"));
      router.push(`/${locale}/dashboard/manager/courses`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("courseDetail.deleteError")
      );
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleActivate = async () => {
    if (!course) return;
    setUpdatingStatus(true);
    try {
      const updated = await courseManagerApi.activateCourse(course.id);
      setCourse(updated);
      toast.success(t("courseDetail.statusUpdated"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("courseDetail.statusError")
      );
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeactivate = async () => {
    if (!course) return;
    setUpdatingStatus(true);
    try {
      const updated = await courseManagerApi.deactivateCourse(course.id);
      setCourse(updated);
      toast.success(t("courseDetail.statusUpdated"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("courseDetail.statusError")
      );
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleToggleFeatured = async () => {
    if (!course) return;
    const wasFeatured = course.isFeatured === true;
    setUpdatingStatus(true);
    try {
      const { isFeatured } = await courseManagerApi.toggleFeatured(course.id);
      setCourse({ ...course, isFeatured });
      toast.success(
        wasFeatured
          ? t("coursesPage.unfeaturedToast")
          : t("coursesPage.featuredToast"),
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("courseDetail.statusError"),
      );
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!course || !requestChangesNote.trim()) return;
    setRequestingChanges(true);
    try {
      const updated = await courseManagerApi.requestChanges(course.id, requestChangesNote.trim());
      setCourse(updated);
      setShowRequestChanges(false);
      setRequestChangesNote("");
      toast.success(t("courseDetail.changesRequested"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("courseDetail.statusError")
      );
    } finally {
      setRequestingChanges(false);
    }
  };

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
        // Fetch materials for this module if not already loaded
        if (!moduleMaterials[moduleId] && course) {
          fetchModuleMaterials(moduleId);
        }
      }
      return next;
    });
  };

  const fetchModuleMaterials = async (moduleId: string) => {
    if (!course) return;
    setLoadingMaterials((prev) => new Set(prev).add(moduleId));
    try {
      const materials = await courseManagerApi.getCourseMaterials(course.id, moduleId);
      setModuleMaterials((prev) => ({ ...prev, [moduleId]: materials }));
    } catch {
      // Silently fail — module just won't show materials
    } finally {
      setLoadingMaterials((prev) => {
        const next = new Set(prev);
        next.delete(moduleId);
        return next;
      });
    }
  };

  const handleRemoveMaterial = async () => {
    if (!removingMaterial) return;
    setRemoveLoading(true);
    try {
      await courseManagerApi.removeMaterial(removingMaterial.id, removeReason || undefined);
      toast.success(t("courseDetail.materialRemoved"));
      // Remove from local state
      setModuleMaterials((prev) => {
        const updated = { ...prev };
        for (const key of Object.keys(updated)) {
          updated[key] = updated[key].filter((m) => m.id !== removingMaterial.id);
        }
        return updated;
      });
      setRemovingMaterial(null);
      setRemoveReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("courseDetail.materialRemoveError"));
    } finally {
      setRemoveLoading(false);
    }
  };

  const getMaterialIcon = (type: string) => {
    switch (type) {
      case "video": return <Video className="w-4 h-4 text-[var(--color-primary)]" />;
      case "pdf": return <FileText className="w-4 h-4 text-[#EF4444]" />;
      case "image": return <ImageIcon className="w-4 h-4 text-[#10B981]" />;
      default: return <File className="w-4 h-4 text-[#F59E0B]" />;
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-[#DCFCE7] text-[#16A34A]">
            {t("courseDetail.status.active")}
          </span>
        );
      case "draft":
        return (
          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-[#FEF3C7] text-[#D97706]">
            {t("courseDetail.status.draft")}
          </span>
        );
      case "pending_review":
        return (
          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-[#EEF2FF] text-[#6366F1]">
            {t("courseDetail.status.pending_review")}
          </span>
        );
      case "changes_requested":
        return (
          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-[#FEF3C7] text-[#D97706]">
            {t("courseDetail.status.changes_requested")}
          </span>
        );
      case "completed":
        return (
          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-[var(--color-border-subtle)] text-[#1D4ED8]">
            {t("courseDetail.status.completed")}
          </span>
        );
      case "archived":
        return (
          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
            {t("courseDetail.status.archived")}
          </span>
        );
      default:
        return null;
    }
  };

  const getRegistrationBadge = () => {
    if (!course || course.status !== "active") return null;
    const deadline = (course as any).enrollmentDeadline;
    if (!deadline) return null;
    const isOpen = new Date(deadline) > new Date();
    return isOpen ? (
      <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-[#DCFCE7] text-[#16A34A]">
        {isRTL ? "التسجيل مفتوح" : "Registration Open"}
      </span>
    ) : (
      <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-[#FEE2E2] text-[#DC2626]">
        {isRTL ? "التسجيل مغلق" : "Registration Closed"}
      </span>
    );
  };

  const getDeliveryIcon = (type: string) => {
    switch (type) {
      case "zoom":
        return <Video className="w-4 h-4 text-[var(--color-primary)]" />;
      case "onsite":
        return <MapPin className="w-4 h-4 text-[#16A34A]" />;
      case "blended":
        return <Layers className="w-4 h-4 text-[#8B5CF6]" />;
      default:
        return <BookOpen className="w-4 h-4 text-[var(--color-text-secondary)]" />;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return formatDateHijri(dateStr, calendarFormat, { locale });
  };

  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  return (
    <>
      <CourseManagerNavbar manager={manager} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <CourseManagerSidebar manager={manager} />
            </div>

            <CourseManagerMobileSidebar manager={manager} />

            {/* Main Content */}
            {loading ? (
              <CourseDetailSkeleton />
            ) : error ? (
              <div className="flex-1 min-w-0">
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-12 text-center">
                  <AlertTriangle className="w-12 h-12 text-[#D97706] mx-auto mb-4" />
                  <p className="text-[var(--color-text-secondary)] mb-4">{error}</p>
                  <button
                    onClick={fetchCourse}
                    className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-[var(--color-button-text)] rounded-lg"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t("dashboard.retry")}
                  </button>
                </div>
              </div>
            ) : course ? (
              <div className="flex-1 min-w-0">
                {/* Back Link */}
                <Link
                  href={`/${locale}/dashboard/manager/courses`}
                  className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] mb-4 transition-colors"
                >
                  <BackArrow className="w-4 h-4" />
                  {t("courseDetail.backToCourses")}
                </Link>

                {/* Course Header */}
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden mb-6">
                  {/* Thumbnail */}
                  {course.thumbnail && (
                    <div className="relative h-48 sm:h-56 bg-[var(--color-border-subtle)]">
                      <Image
                        src={course.thumbnail}
                        alt={course.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  )}

                  <div className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                            {course.title}
                          </h1>
                          {getStatusBadge(course.status)}
                          {getRegistrationBadge()}
                        </div>
                        {course.titleAr && (
                          <p className="text-sm text-[var(--color-text-secondary)] mb-1" dir="rtl">
                            {course.titleAr}
                          </p>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {course.status === "pending_review" && (
                          <>
                            <button
                              onClick={handleActivate}
                              disabled={updatingStatus}
                              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#16A34A] text-white text-sm font-medium rounded-lg hover:bg-[#15803D] transition-colors disabled:opacity-50"
                            >
                              <CheckCircle className="w-4 h-4" />
                              {t("courseDetail.approve")}
                            </button>
                            <button
                              onClick={() => setShowRequestChanges(true)}
                              disabled={updatingStatus}
                              className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#F59E0B] text-[#D97706] text-sm font-medium rounded-lg hover:bg-[#FFFBEB] transition-colors disabled:opacity-50"
                            >
                              <AlertTriangle className="w-4 h-4" />
                              {t("courseDetail.requestChanges")}
                            </button>
                          </>
                        )}
                        {course.status === "active" && (
                          <>
                            <button
                              onClick={handleToggleFeatured}
                              disabled={updatingStatus}
                              className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                                course.isFeatured
                                  ? "bg-[var(--gold-gold-100)] text-[var(--color-star)] hover:bg-[var(--gold-gold-200)]"
                                  : "border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                              }`}
                            >
                              <Star
                                className={`w-4 h-4 ${course.isFeatured ? "fill-current" : ""}`}
                              />
                              {course.isFeatured
                                ? t("coursesPage.actions.unfeature")
                                : t("coursesPage.actions.feature")}
                            </button>
                            <button
                              onClick={handleDeactivate}
                              disabled={updatingStatus}
                              className="inline-flex items-center gap-1.5 px-3 py-2 border border-[var(--color-border)] text-[var(--color-text-secondary)] text-sm font-medium rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors disabled:opacity-50"
                            >
                              <Archive className="w-4 h-4" />
                              {t("courseDetail.archive")}
                            </button>
                          </>
                        )}
                        {(course.status === "archived" || course.status === "completed") && (
                          <button
                            onClick={handleActivate}
                            disabled={updatingStatus}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#16A34A] text-white text-sm font-medium rounded-lg hover:bg-[#15803D] transition-colors disabled:opacity-50"
                          >
                            <Play className="w-4 h-4" />
                            {t("courseDetail.activate")}
                          </button>
                        )}
                        <Link
                          href={`/${locale}/dashboard/manager/courses/${course.id}/edit`}
                          className="inline-flex items-center gap-1.5 px-3 py-2 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                          {t("courseDetail.editCourse")}
                        </Link>
                        {course.status === "draft" && (
                          <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#FCA5A5] text-[#DC2626] text-sm font-medium rounded-lg hover:bg-[#FEF2F2] transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            {t("courseDetail.delete")}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Review note banner when changes_requested */}
                {course.status === "changes_requested" && (course as any).reviewNote && (
                  <div className="p-4 bg-[#FEF3C7] border border-[#F59E0B]/30 rounded-xl mb-6">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-[#D97706] mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-[#92400E]">{t("courseDetail.reviewNoteSent")}</p>
                        <p className="text-sm text-[#92400E] mt-1">{(course as any).reviewNote}</p>
                        <p className="text-xs text-[#B45309] mt-2">{t("courseDetail.waitingForInstructor")}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pending review info */}
                {course.status === "pending_review" && (
                  <div className="p-4 bg-[#EEF2FF] border border-[#6366F1]/20 rounded-xl mb-6">
                    <p className="text-sm text-[#4338CA]">{t("courseDetail.pendingReviewInfo")}</p>
                  </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                    <div className="flex items-center gap-2 mb-1">
                      {getDeliveryIcon(course.deliveryType)}
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {t("courseDetail.deliveryType")}
                      </span>
                    </div>
                    <p className="text-lg font-semibold text-[var(--color-text-secondary)] capitalize">
                      {t(`courseDetail.delivery.${course.deliveryType}`)}
                    </p>
                  </div>
                  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-[#8B5CF6]" />
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {t("courseDetail.maxEnrollment")}
                      </span>
                    </div>
                    <p className="text-lg font-semibold text-[var(--color-text-secondary)]">
                      {course.maxEnrollment ?? "—"}
                    </p>
                  </div>
                  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-[#16A34A]" />
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {t("courseDetail.startDate")}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[var(--color-text-secondary)]">
                      {formatDate(course.startDate)}
                    </p>
                  </div>
                  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-[#DC2626]" />
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {t("courseDetail.endDate")}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[var(--color-text-secondary)]">
                      {formatDate(course.endDate)}
                    </p>
                  </div>
                  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Award className="w-4 h-4 text-[#D4A520]" />
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        CME/CPD Hours
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[var(--color-text-secondary)]">
                      {course.cmeHours || "—"}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5 mb-6">
                  <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-3">
                    {t("courseDetail.description")}
                  </h2>
                  {course.description ? (
                    <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
                      {course.description}
                    </p>
                  ) : (
                    <p className="text-sm text-[var(--color-text-secondary)] italic">
                      {t("courseDetail.noDescription")}
                    </p>
                  )}
                  {course.descriptionAr && (
                    <p
                      className="text-sm text-[var(--color-text-secondary)] leading-relaxed mt-3 pt-3 border-t border-[var(--color-border)] whitespace-pre-wrap"
                      dir="rtl"
                    >
                      {course.descriptionAr}
                    </p>
                  )}
                </div>

                {/* NELC Compliance Scorecard */}
                {(course.status === "pending_review" || course.status === "active" || course.status === "changes_requested") && (
                  <div className="mb-6">
                    <NELCScorecardPanel courseId={course.id} />
                  </div>
                )}

                {/* Teaching Assistants Management — hidden for self-paced */}
                {course.deliveryType !== "self-paced" && (course.status === "active" || course.status === "pending_review") && (
                  <div className="mb-6">
                    <CourseAssistantsManagePanel courseId={course.id} />
                  </div>
                )}

                {/* Modules */}
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden mb-6">
                  <div className="p-5 border-b border-[var(--color-border)] flex items-center justify-between">
                    <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                      {t("courseDetail.modules")} ({course.modules?.length ?? 0})
                    </h2>
                  </div>

                  {course.modules && course.modules.length > 0 ? (
                    <div className="divide-y divide-[var(--color-border)]">
                      {course.modules
                        .sort((a, b) => a.orderIndex - b.orderIndex)
                        .map((mod: CourseModule, idx: number) => (
                          <div key={mod.id}>
                            <button
                              className="w-full flex items-center justify-between p-4 hover:bg-[var(--color-border-subtle)] transition-colors"
                              onClick={() => toggleModule(mod.id)}
                            >
                              <div className="flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-[var(--color-border-subtle)] flex items-center justify-center text-sm font-semibold text-[var(--color-primary)]">
                                  {idx + 1}
                                </span>
                                <div className={`text-start`}>
                                  <span className="text-sm font-medium text-[var(--color-text-primary)]">
                                    {mod.title}
                                  </span>
                                  {mod.titleAr && (
                                    <p className="text-xs text-[var(--color-text-secondary)]" dir="rtl">
                                      {mod.titleAr}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {mod.durationMinutes && (
                                  <span className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDuration(mod.durationMinutes, locale)}
                                  </span>
                                )}
                                <span className="px-2 py-0.5 text-xs rounded bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] capitalize">
                                  {mod.type}
                                </span>
                                {expandedModules.has(mod.id) ? (
                                  <ChevronDown className="w-4 h-4 text-[var(--color-text-secondary)]" />
                                ) : (
                                  <ChevronRight
                                    className={`w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "rotate-180" : ""}`}
                                  />
                                )}
                              </div>
                            </button>
                            {expandedModules.has(mod.id) && (
                              <div className="px-4 pb-4 bg-[var(--color-surface-page)]">
                                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                                  <div>
                                    <span className="text-[var(--color-text-secondary)]">{t("courseDetail.moduleType")}:</span>{" "}
                                    <span className="text-[var(--color-text-primary)] capitalize">{mod.type}</span>
                                  </div>
                                  <div>
                                    <span className="text-[var(--color-text-secondary)]">{t("courseDetail.moduleDuration")}:</span>{" "}
                                    <span className="text-[var(--color-text-primary)]">
                                      {mod.durationMinutes ? formatDuration(mod.durationMinutes, locale) : "—"}
                                    </span>
                                  </div>
                                </div>

                                {/* Materials in this module */}
                                <div className="border-t border-[var(--color-border)] pt-3">
                                  <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                                    {t("courseDetail.materials")}
                                  </p>
                                  {loadingMaterials.has(mod.id) ? (
                                    <div className="flex items-center gap-2 py-2">
                                      <Loader2 className="w-4 h-4 text-[var(--color-primary)] animate-spin" />
                                      <span className="text-xs text-[var(--color-text-secondary)]">{t("dashboard.loading")}</span>
                                    </div>
                                  ) : (moduleMaterials[mod.id] && moduleMaterials[mod.id].length > 0) ? (
                                    <div className="space-y-2">
                                      {moduleMaterials[mod.id].map((mat) => (
                                        <div
                                          key={mat.id}
                                          className="flex items-center gap-3 bg-[var(--color-surface-card)] rounded-lg border border-[var(--color-border)] px-3 py-2"
                                        >
                                          {getMaterialIcon(mat.type)}
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm text-[var(--color-text-secondary)] truncate">{mat.title}</p>
                                            <p className="text-xs text-[var(--color-text-secondary)]">
                                              {mat.type} • {formatFileSize(mat.fileSize)}
                                              {mat.wcagStatus && (
                                                <span className={`ms-2 ${mat.wcagStatus === "compliant" ? "text-[#16A34A]" : mat.wcagStatus === "warning" ? "text-[#D97706]" : mat.wcagStatus === "fail" ? "text-[#DC2626]" : "text-[var(--color-text-secondary)]"}`}>
                                                  WCAG: {mat.wcagStatus}
                                                </span>
                                              )}
                                            </p>
                                          </div>
                                          <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                                            mat.status === "live" ? "bg-[#DCFCE7] text-[#16A34A]" :
                                            mat.status === "pending_review" ? "bg-[var(--color-border-subtle)] text-[#1D4ED8]" :
                                            mat.status === "processing" ? "bg-[#FEF3C7] text-[#D97706]" :
                                            mat.status === "failed" ? "bg-[#FEE2E2] text-[#DC2626]" :
                                            "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
                                          }`}>
                                            {mat.status.replace("_", " ")}
                                          </span>
                                          {mat.fileUrl && (
                                            <a
                                              href={mat.fileUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              onClick={(e) => e.stopPropagation()}
                                              className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors"
                                              title={t("courseDetail.viewContent")}
                                            >
                                              <Eye className="w-3.5 h-3.5" />
                                            </a>
                                          )}
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setRemovingMaterial(mat); }}
                                            className="p-1 text-[var(--color-text-secondary)] hover:text-[#DC2626] transition-colors"
                                            title={t("courseDetail.removeMaterial")}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-[var(--color-text-secondary)] italic py-1">
                                      {t("courseDetail.noMaterials")}
                                    </p>
                                  )}
                                </div>

                                {/* Module assessments */}
                                {(() => {
                                  const modAssessments = moduleAssessments.filter((a) => a.moduleId === mod.id);
                                  if (modAssessments.length === 0) return null;
                                  return (
                                    <div className="border-t border-[var(--color-border)] pt-3">
                                      <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                                        {t("courseDetail.moduleAssessments")}
                                      </p>
                                      <div className="space-y-2">
                                        {modAssessments.map((ma) => (
                                          <div
                                            key={ma.id}
                                            className="flex items-center gap-3 bg-[var(--color-surface-card)] rounded-lg border border-[var(--color-border)] px-3 py-2"
                                          >
                                            <ClipboardCheck className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm text-[var(--color-text-secondary)] truncate">{ma.title}</p>
                                              <p className="text-xs text-[var(--color-text-secondary)]">
                                                {ma.totalMarks} {t("courseDetail.marks") || "marks"}
                                              </p>
                                            </div>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                              ma.type === "assignment" ? "bg-amber-50 text-amber-700" : ma.type === "exam" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"
                                            }`}>
                                              {ma.type}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <FileText className="w-10 h-10 text-[var(--color-text-secondary)] mx-auto mb-3" />
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {t("courseDetail.noModules")}
                      </p>
                    </div>
                  )}
                </div>

                {/* Course Metadata */}
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5">
                  <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-3">
                    {t("courseDetail.courseInfo")}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-[var(--color-text-secondary)]">{t("courseDetail.courseId")}:</span>{" "}
                      <span className="text-[var(--color-text-primary)] font-mono text-xs">{course.id}</span>
                    </div>
                    <div>
                      <span className="text-[var(--color-text-secondary)]">{t("courseDetail.createdAt")}:</span>{" "}
                      <span className="text-[var(--color-text-primary)]">{formatDate(course.createdAt)}</span>
                    </div>
                    <div>
                      <span className="text-[var(--color-text-secondary)]">{t("courseDetail.updatedAt")}:</span>{" "}
                      <span className="text-[var(--color-text-primary)]">{formatDate(course.updatedAt)}</span>
                    </div>
                    <div>
                      <span className="text-[var(--color-text-secondary)]">{t("courseDetail.instructorId")}:</span>{" "}
                      <span className="text-[var(--color-text-primary)] font-mono text-xs">{course.instructorId}</span>
                    </div>
                  </div>
                </div>

                {/* Student Reviews */}
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5">
                  <div className="flex items-center justify-between mb-4 gap-3">
                    <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                      {t("courseDetail.reviewsTitle")}
                    </h2>
                    {reviews.length > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => {
                            const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
                            return (
                              <Star
                                key={s}
                                className={`w-4 h-4 ${s <= Math.round(avg) ? "text-[var(--color-star)] fill-[var(--color-star)]" : "text-[var(--color-star-border)]"}`}
                              />
                            );
                          })}
                        </div>
                        <span className="font-medium text-[var(--color-text-primary)]">
                          {(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                  {reviewsLoading ? (
                    <div className="text-center py-6 text-sm text-[var(--color-text-secondary)]">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                      {t("courseDetail.reviewsLoading")}
                    </div>
                  ) : reviews.length === 0 ? (
                    <div className="text-center py-8">
                      <Star className="w-10 h-10 text-[var(--color-star-border)] mx-auto mb-3" />
                      <p className="text-sm text-[var(--color-text-secondary)]">{t("courseDetail.noReviewsYet")}</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {reviews.map((r) => (
                          <div key={r.id} className="border border-[var(--color-border)] rounded-lg p-4 bg-[#FAFAFA]">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="text-sm font-medium text-[var(--color-text-secondary)]">{r.studentName}</p>
                                <p className="text-xs text-[var(--color-text-secondary)]">{formatDate(r.createdAt)}</p>
                              </div>
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star
                                    key={s}
                                    className={`w-3.5 h-3.5 ${s <= r.rating ? "text-[var(--color-star)] fill-[var(--color-star)]" : "text-[var(--color-star-border)]"}`}
                                  />
                                ))}
                              </div>
                            </div>
                            {r.reviewText && (
                              <p dir="auto" className="text-sm text-[var(--color-text-secondary)] whitespace-pre-line">{r.reviewText}</p>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex items-center justify-center">
                        <Link
                          href={`/${locale}/dashboard/manager/courses/${courseId}/reviews`}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
                        >
                          {isRTL ? "عرض كل المراجعات" : "View all reviews"}
                          {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Remove Material Modal */}
      {removingMaterial && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--color-surface-card)] rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FEE2E2] flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-[#DC2626]" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {t("courseDetail.removeMaterialTitle")}
                </h3>
              </div>
              <button onClick={() => { setRemovingMaterial(null); setRemoveReason(""); }} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-2">
              {t("courseDetail.removeMaterialDesc")}
            </p>
            <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">
              &ldquo;{removingMaterial.title}&rdquo;
            </p>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              {t("courseDetail.removeReason")}
            </label>
            <textarea
              value={removeReason}
              onChange={(e) => setRemoveReason(e.target.value)}
              placeholder={t("courseDetail.removeReasonPlaceholder")}
              className="w-full border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)] focus:border-transparent"
              rows={3}
            />
            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                onClick={() => { setRemovingMaterial(null); setRemoveReason(""); }}
                className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)]"
              >
                {t("courseDetail.cancel")}
              </button>
              <button
                onClick={handleRemoveMaterial}
                disabled={removeLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-[#DC2626] rounded-lg hover:bg-[#B91C1C] disabled:opacity-50 inline-flex items-center gap-2"
              >
                {removeLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("courseDetail.removeMaterialBtn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--color-surface-card)] rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#FEE2E2] flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-[#DC2626]" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                {t("courseDetail.confirmDelete")}
              </h3>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
              {t("courseDetail.confirmDeleteDesc")}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)]"
              >
                {t("courseDetail.cancel")}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-[#DC2626] rounded-lg hover:bg-[#B91C1C] disabled:opacity-50 inline-flex items-center gap-2"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("courseDetail.confirmDeleteBtn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Changes Modal */}
      {showRequestChanges && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--color-surface-card)] rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#FEF3C7] flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-[#D97706]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {t("courseDetail.requestChangesTitle")}
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t("courseDetail.requestChangesDesc")}
                </p>
              </div>
            </div>
            <textarea
              value={requestChangesNote}
              onChange={(e) => setRequestChangesNote(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder={t("courseDetail.requestChangesPlaceholder")}
              className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent resize-none mb-1"
            />
            <p className="text-xs text-[var(--color-text-secondary)] mb-4 text-end">{requestChangesNote.length}/1000</p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowRequestChanges(false); setRequestChangesNote(""); }}
                className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)]"
              >
                {t("courseDetail.cancel")}
              </button>
              <button
                onClick={handleRequestChanges}
                disabled={requestingChanges || !requestChangesNote.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-[#D97706] rounded-lg hover:bg-[#B45309] disabled:opacity-50 inline-flex items-center gap-2"
              >
                {requestingChanges && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("courseDetail.requestChangesBtn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CourseManagerCourseDetailContent;
