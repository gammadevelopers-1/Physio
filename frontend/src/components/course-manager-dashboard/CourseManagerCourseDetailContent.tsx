"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
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
} from "lucide-react";

interface CourseManagerCourseDetailContentProps {
  courseId: string;
}

// ─── Skeleton ──────────────────────────────────────────────────
const CourseDetailSkeleton = () => (
  <div className="flex-1 min-w-0 animate-pulse">
    <div className="h-4 w-32 bg-[#E5E7EB] rounded mb-4" />
    <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden mb-6">
      <div className="h-48 sm:h-56 bg-[#E5E7EB]" />
      <div className="p-5 space-y-3">
        <div className="h-6 w-2/3 bg-[#E5E7EB] rounded" />
        <div className="h-4 w-1/2 bg-[#E5E7EB] rounded" />
      </div>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white rounded-xl border border-[#E5E7EB] p-4">
          <div className="h-4 w-16 bg-[#E5E7EB] rounded mb-2" />
          <div className="h-6 w-12 bg-[#E5E7EB] rounded" />
        </div>
      ))}
    </div>
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
      <div className="h-5 w-32 bg-[#E5E7EB] rounded mb-4" />
      <div className="space-y-3">
        <div className="h-4 w-full bg-[#E5E7EB] rounded" />
        <div className="h-4 w-3/4 bg-[#E5E7EB] rounded" />
      </div>
    </div>
  </div>
);

const CourseManagerCourseDetailContent = ({
  courseId,
}: CourseManagerCourseDetailContentProps) => {
  const t = useTranslations("courseManagerDashboard");
  const locale = useLocale();
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
    courseManagerApi.getAssessments({ courseId, limit: 100 }).then((res) => {
      setModuleAssessments(res.data || []);
    }).catch(() => {});
  }, [courseId]);

  // Remove material modal
  const [removingMaterial, setRemovingMaterial] = useState<MaterialItem | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [removeLoading, setRemoveLoading] = useState(false);

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
      case "video": return <Video className="w-4 h-4 text-[#3B82F6]" />;
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
          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-[#DBEAFE] text-[#1D4ED8]">
            {t("courseDetail.status.completed")}
          </span>
        );
      case "archived":
        return (
          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-[#F3F4F6] text-[#6B7280]">
            {t("courseDetail.status.archived")}
          </span>
        );
      default:
        return null;
    }
  };

  const getDeliveryIcon = (type: string) => {
    switch (type) {
      case "zoom":
        return <Video className="w-4 h-4 text-[#3B82F6]" />;
      case "onsite":
        return <MapPin className="w-4 h-4 text-[#16A34A]" />;
      case "blended":
        return <Layers className="w-4 h-4 text-[#8B5CF6]" />;
      default:
        return <BookOpen className="w-4 h-4 text-[#6B7280]" />;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  return (
    <>
      <CourseManagerNavbar manager={manager} />

      <div className="bg-[#F9FAFB] min-h-screen">
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
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
                  <AlertTriangle className="w-12 h-12 text-[#D97706] mx-auto mb-4" />
                  <p className="text-[#6B7280] mb-4">{error}</p>
                  <button
                    onClick={fetchCourse}
                    className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-white rounded-lg"
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
                  className="inline-flex items-center gap-1.5 text-sm text-[#6B7280] hover:text-[#002D87] mb-4 transition-colors"
                >
                  <BackArrow className="w-4 h-4" />
                  {t("courseDetail.backToCourses")}
                </Link>

                {/* Course Header */}
                <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden mb-6">
                  {/* Thumbnail */}
                  {course.thumbnail && (
                    <div className="relative h-48 sm:h-56 bg-[#F3F4F6]">
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
                          <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937]">
                            {course.title}
                          </h1>
                          {getStatusBadge(course.status)}
                        </div>
                        {course.titleAr && (
                          <p className="text-sm text-[#6B7280] mb-1" dir="rtl">
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
                          <button
                            onClick={handleDeactivate}
                            disabled={updatingStatus}
                            className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#E5E7EB] text-[#6B7280] text-sm font-medium rounded-lg hover:bg-[#F9FAFB] transition-colors disabled:opacity-50"
                          >
                            <Archive className="w-4 h-4" />
                            {t("courseDetail.archive")}
                          </button>
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
                          className="inline-flex items-center gap-1.5 px-3 py-2 btn-gold text-white text-sm font-medium rounded-lg transition-colors"
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
                  <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                    <div className="flex items-center gap-2 mb-1">
                      {getDeliveryIcon(course.deliveryType)}
                      <span className="text-xs text-[#6B7280]">
                        {t("courseDetail.deliveryType")}
                      </span>
                    </div>
                    <p className="text-lg font-semibold text-[#1F2937] capitalize">
                      {t(`courseDetail.delivery.${course.deliveryType}`)}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-[#8B5CF6]" />
                      <span className="text-xs text-[#6B7280]">
                        {t("courseDetail.maxEnrollment")}
                      </span>
                    </div>
                    <p className="text-lg font-semibold text-[#1F2937]">
                      {course.maxEnrollment ?? "—"}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-[#16A34A]" />
                      <span className="text-xs text-[#6B7280]">
                        {t("courseDetail.startDate")}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[#1F2937]">
                      {formatDate(course.startDate)}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-[#DC2626]" />
                      <span className="text-xs text-[#6B7280]">
                        {t("courseDetail.endDate")}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[#1F2937]">
                      {formatDate(course.endDate)}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Award className="w-4 h-4 text-[#D4A520]" />
                      <span className="text-xs text-[#6B7280]">
                        CME/CPD Hours
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[#1F2937]">
                      {course.cmeHours || "—"}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 mb-6">
                  <h2 className="text-base font-semibold text-[#1F2937] mb-3">
                    {t("courseDetail.description")}
                  </h2>
                  {course.description ? (
                    <p className="text-sm text-[#4B5563] leading-relaxed whitespace-pre-wrap">
                      {course.description}
                    </p>
                  ) : (
                    <p className="text-sm text-[#9CA3AF] italic">
                      {t("courseDetail.noDescription")}
                    </p>
                  )}
                  {course.descriptionAr && (
                    <p
                      className="text-sm text-[#4B5563] leading-relaxed mt-3 pt-3 border-t border-[#E5E7EB] whitespace-pre-wrap"
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
                <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden mb-6">
                  <div className="p-5 border-b border-[#E5E7EB] flex items-center justify-between">
                    <h2 className="text-base font-semibold text-[#1F2937]">
                      {t("courseDetail.modules")} ({course.modules?.length ?? 0})
                    </h2>
                  </div>

                  {course.modules && course.modules.length > 0 ? (
                    <div className="divide-y divide-[#E5E7EB]">
                      {course.modules
                        .sort((a, b) => a.orderIndex - b.orderIndex)
                        .map((mod: CourseModule, idx: number) => (
                          <div key={mod.id}>
                            <button
                              className="w-full flex items-center justify-between p-4 hover:bg-[#F9FAFB] transition-colors"
                              onClick={() => toggleModule(mod.id)}
                            >
                              <div className="flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-[#F0F7FF] flex items-center justify-center text-sm font-semibold text-[#002D87]">
                                  {idx + 1}
                                </span>
                                <div className={`text-start`}>
                                  <span className="text-sm font-medium text-[#1F2937]">
                                    {mod.title}
                                  </span>
                                  {mod.titleAr && (
                                    <p className="text-xs text-[#6B7280]" dir="rtl">
                                      {mod.titleAr}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {mod.durationMinutes && (
                                  <span className="text-xs text-[#6B7280] flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {mod.durationMinutes} {t("courseDetail.minutes")}
                                  </span>
                                )}
                                <span className="px-2 py-0.5 text-xs rounded bg-[#F3F4F6] text-[#6B7280] capitalize">
                                  {mod.type}
                                </span>
                                {expandedModules.has(mod.id) ? (
                                  <ChevronDown className="w-4 h-4 text-[#6B7280]" />
                                ) : (
                                  <ChevronRight
                                    className={`w-4 h-4 text-[#6B7280] ${isRTL ? "rotate-180" : ""}`}
                                  />
                                )}
                              </div>
                            </button>
                            {expandedModules.has(mod.id) && (
                              <div className="px-4 pb-4 bg-[#F9FAFB]">
                                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                                  <div>
                                    <span className="text-[#6B7280]">{t("courseDetail.moduleType")}:</span>{" "}
                                    <span className="text-[#1F2937] capitalize">{mod.type}</span>
                                  </div>
                                  <div>
                                    <span className="text-[#6B7280]">{t("courseDetail.moduleDuration")}:</span>{" "}
                                    <span className="text-[#1F2937]">
                                      {mod.durationMinutes ? `${mod.durationMinutes} ${t("courseDetail.minutes")}` : "—"}
                                    </span>
                                  </div>
                                </div>

                                {/* Materials in this module */}
                                <div className="border-t border-[#E5E7EB] pt-3">
                                  <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-2">
                                    {t("courseDetail.materials")}
                                  </p>
                                  {loadingMaterials.has(mod.id) ? (
                                    <div className="flex items-center gap-2 py-2">
                                      <Loader2 className="w-4 h-4 text-[#3B82F6] animate-spin" />
                                      <span className="text-xs text-[#6B7280]">{t("dashboard.loading")}</span>
                                    </div>
                                  ) : (moduleMaterials[mod.id] && moduleMaterials[mod.id].length > 0) ? (
                                    <div className="space-y-2">
                                      {moduleMaterials[mod.id].map((mat) => (
                                        <div
                                          key={mat.id}
                                          className="flex items-center gap-3 bg-white rounded-lg border border-[#E5E7EB] px-3 py-2"
                                        >
                                          {getMaterialIcon(mat.type)}
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm text-[#1F2937] truncate">{mat.title}</p>
                                            <p className="text-xs text-[#6B7280]">
                                              {mat.type} • {formatFileSize(mat.fileSize)}
                                              {mat.wcagStatus && (
                                                <span className={`ms-2 ${mat.wcagStatus === "compliant" ? "text-[#16A34A]" : mat.wcagStatus === "warning" ? "text-[#D97706]" : mat.wcagStatus === "fail" ? "text-[#DC2626]" : "text-[#6B7280]"}`}>
                                                  WCAG: {mat.wcagStatus}
                                                </span>
                                              )}
                                            </p>
                                          </div>
                                          <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                                            mat.status === "live" ? "bg-[#DCFCE7] text-[#16A34A]" :
                                            mat.status === "pending_review" ? "bg-[#DBEAFE] text-[#1D4ED8]" :
                                            mat.status === "processing" ? "bg-[#FEF3C7] text-[#D97706]" :
                                            mat.status === "failed" ? "bg-[#FEE2E2] text-[#DC2626]" :
                                            "bg-[#F3F4F6] text-[#6B7280]"
                                          }`}>
                                            {mat.status.replace("_", " ")}
                                          </span>
                                          {mat.fileUrl && (
                                            <a
                                              href={mat.fileUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              onClick={(e) => e.stopPropagation()}
                                              className="p-1 text-[#9CA3AF] hover:text-[#3B82F6] transition-colors"
                                              title={t("courseDetail.viewContent")}
                                            >
                                              <Eye className="w-3.5 h-3.5" />
                                            </a>
                                          )}
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setRemovingMaterial(mat); }}
                                            className="p-1 text-[#9CA3AF] hover:text-[#DC2626] transition-colors"
                                            title={t("courseDetail.removeMaterial")}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-[#9CA3AF] italic py-1">
                                      {t("courseDetail.noMaterials")}
                                    </p>
                                  )}
                                </div>

                                {/* Module assessments */}
                                {(() => {
                                  const modAssessments = moduleAssessments.filter((a) => a.moduleId === mod.id);
                                  if (modAssessments.length === 0) return null;
                                  return (
                                    <div className="border-t border-[#E5E7EB] pt-3">
                                      <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-2">
                                        {t("courseDetail.moduleAssessments")}
                                      </p>
                                      <div className="space-y-2">
                                        {modAssessments.map((ma) => (
                                          <div
                                            key={ma.id}
                                            className="flex items-center gap-3 bg-white rounded-lg border border-[#E5E7EB] px-3 py-2"
                                          >
                                            <ClipboardCheck className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm text-[#1F2937] truncate">{ma.title}</p>
                                              <p className="text-xs text-[#6B7280]">
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
                      <FileText className="w-10 h-10 text-[#9CA3AF] mx-auto mb-3" />
                      <p className="text-sm text-[#6B7280]">
                        {t("courseDetail.noModules")}
                      </p>
                    </div>
                  )}
                </div>

                {/* Course Metadata */}
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
                  <h2 className="text-base font-semibold text-[#1F2937] mb-3">
                    {t("courseDetail.courseInfo")}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-[#6B7280]">{t("courseDetail.courseId")}:</span>{" "}
                      <span className="text-[#1F2937] font-mono text-xs">{course.id}</span>
                    </div>
                    <div>
                      <span className="text-[#6B7280]">{t("courseDetail.createdAt")}:</span>{" "}
                      <span className="text-[#1F2937]">{formatDate(course.createdAt)}</span>
                    </div>
                    <div>
                      <span className="text-[#6B7280]">{t("courseDetail.updatedAt")}:</span>{" "}
                      <span className="text-[#1F2937]">{formatDate(course.updatedAt)}</span>
                    </div>
                    <div>
                      <span className="text-[#6B7280]">{t("courseDetail.instructorId")}:</span>{" "}
                      <span className="text-[#1F2937] font-mono text-xs">{course.instructorId}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Remove Material Modal */}
      {removingMaterial && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FEE2E2] flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-[#DC2626]" />
                </div>
                <h3 className="text-lg font-semibold text-[#1F2937]">
                  {t("courseDetail.removeMaterialTitle")}
                </h3>
              </div>
              <button onClick={() => { setRemovingMaterial(null); setRemoveReason(""); }} className="text-[#6B7280] hover:text-[#1F2937]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-[#6B7280] mb-2">
              {t("courseDetail.removeMaterialDesc")}
            </p>
            <p className="text-sm font-medium text-[#1F2937] mb-4">
              &ldquo;{removingMaterial.title}&rdquo;
            </p>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              {t("courseDetail.removeReason")}
            </label>
            <textarea
              value={removeReason}
              onChange={(e) => setRemoveReason(e.target.value)}
              placeholder={t("courseDetail.removeReasonPlaceholder")}
              className="w-full border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm text-[#1F2937] resize-none focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
              rows={3}
            />
            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                onClick={() => { setRemovingMaterial(null); setRemoveReason(""); }}
                className="px-4 py-2 text-sm font-medium text-[#4B5563] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB]"
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
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#FEE2E2] flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-[#DC2626]" />
              </div>
              <h3 className="text-lg font-semibold text-[#1F2937]">
                {t("courseDetail.confirmDelete")}
              </h3>
            </div>
            <p className="text-sm text-[#6B7280] mb-6">
              {t("courseDetail.confirmDeleteDesc")}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-[#4B5563] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB]"
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
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#FEF3C7] flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-[#D97706]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#1F2937]">
                  {t("courseDetail.requestChangesTitle")}
                </h3>
                <p className="text-xs text-[#6B7280]">
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
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent resize-none mb-1"
            />
            <p className="text-xs text-[#9CA3AF] mb-4 text-end">{requestChangesNote.length}/1000</p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowRequestChanges(false); setRequestChangesNote(""); }}
                className="px-4 py-2 text-sm font-medium text-[#4B5563] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB]"
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
