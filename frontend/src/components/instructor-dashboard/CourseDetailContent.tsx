"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import InstructorNavbar from "./InstructorNavbar";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import DashboardError from "./DashboardError";
import CourseAssistantsSuggestPanel from "./CourseAssistantsSuggestPanel";
import NELCScorecardPanel from "@/components/shared/NELCScorecardPanel";
import { useInstructorProfile } from "@/hooks/useInstructorProfile";
import { useInstructorCourseDetail } from "@/hooks/useInstructorCourseDetail";
import { instructorApi, materialsApi } from "@/lib/api";
import type { CourseModule, CourseSession, CourseMaterialResponse } from "@/types/instructor-dashboard";
import {
  ArrowLeft,
  Users,
  Calendar,
  Clock,
  Video,
  MapPin,
  BookOpen,
  Settings,
  BarChart3,
  ChevronDown,
  Play,
  FileText,
  Edit,
  Plus,
  Trash2,
  X,
  AlertTriangle,
  TrendingUp,
  UserCheck,
  UserX,
  Save,
  Upload,
  ArrowUp,
  ArrowDown,
  Download,
  Unlink,
  Loader2,
  Image as ImageIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  Eye,
} from "lucide-react";

interface CourseDetailContentProps {
  courseId: string;
}

// ─── Skeleton ──────────────────────────────────────────────────
const CourseDetailSkeleton = () => (
  <div className="flex-1 min-w-0 animate-pulse">
    <div className="h-4 w-32 bg-[#E5E7EB] rounded mb-4" />
    <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden mb-6">
      <div className="h-48 sm:h-56 bg-[#E5E7EB]" />
      <div className="p-4 border-t border-[#E5E7EB]">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#E5E7EB] rounded-lg" />
              <div className="space-y-1.5">
                <div className="h-5 w-12 bg-[#E5E7EB] rounded" />
                <div className="h-3 w-16 bg-[#E5E7EB] rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
      <div className="flex gap-4 p-4 border-b border-[#E5E7EB]">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-5 w-20 bg-[#E5E7EB] rounded" />
        ))}
      </div>
      <div className="p-5 space-y-4">
        <div className="h-4 w-24 bg-[#E5E7EB] rounded" />
        <div className="h-3 w-full bg-[#E5E7EB] rounded" />
        <div className="h-3 w-3/4 bg-[#E5E7EB] rounded" />
      </div>
    </div>
  </div>
);

// ─── Helpers ───────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDuration(startDate: string | null, endDate: string | null): string {
  if (!startDate || !endDate) return "—";
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
  if (diffWeeks > 0) return `${diffWeeks} weeks`;
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  return `${diffDays} days`;
}

function formatSessionTime(iso: string, durationMinutes: number): string {
  const start = new Date(iso);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const timeOpts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  return `${start.toLocaleTimeString("en-US", timeOpts)} - ${end.toLocaleTimeString("en-US", timeOpts)}`;
}

function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getModuleIcon(type: string) {
  if (type === "video") return <Play className="w-4 h-4 text-[#3B82F6]" />;
  if (type === "quiz") return <BookOpen className="w-4 h-4 text-[#F59E0B]" />;
  if (type === "mixed") return <BarChart3 className="w-4 h-4 text-[#8B5CF6]" />;
  return <FileText className="w-4 h-4 text-[#6B7280]" />;
}

function getSessionStatusColor(status: string) {
  switch (status) {
    case "scheduled": return "bg-[#EFF6FF] text-[#3B82F6]";
    case "live": return "bg-[#FEF3C7] text-[#D97706]";
    case "completed": return "bg-[#DCFCE7] text-[#22C55E]";
    case "cancelled": return "bg-[#FEE2E2] text-[#EF4444]";
    case "missed": return "bg-[#FEE2E2] text-[#EF4444]";
    case "rescheduled": return "bg-[#FEF3C7] text-[#D97706]";
    default: return "bg-[#F3F4F6] text-[#6B7280]";
  }
}

function toDatetimeLocal(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Modal Overlay ─────────────────────────────────────────────
const ModalOverlay = ({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="absolute inset-0" onClick={onClose} />
    <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {children}
    </div>
  </div>
);

// ─── Main Component ────────────────────────────────────────────

const CourseDetailContent = ({ courseId }: CourseDetailContentProps) => {
  const instructor = useInstructorProfile();
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("instructorDashboard");
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const { course, enrollments, sessions, loading, error, refetch } =
    useInstructorCourseDetail(courseId);

  const isCourseReadOnly = course?.status === "completed" || course?.status === "archived";

  const searchParams = useSearchParams();
  const validTabs = ["overview", "modules", "students", "sessions", "analytics", "settings"] as const;
  type TabId = (typeof validTabs)[number];
  const initialTab = validTabs.includes(searchParams.get("tab") as TabId)
    ? (searchParams.get("tab") as TabId)
    : "overview";
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  // ─── Module State ──────────────────────────────────────────
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const [moduleModal, setModuleModal] = useState<{
    open: boolean;
    editing: CourseModule | null;
  }>({ open: false, editing: null });
  const [moduleForm, setModuleForm] = useState({
    title: "",
    titleAr: "",
    type: "video",
    durationMinutes: "",
  });
  const [moduleSaving, setModuleSaving] = useState(false);
  const [deletingModuleId, setDeletingModuleId] = useState<string | null>(null);

  // ─── Module Materials State ─────────────────────────────────
  const [moduleMaterials, setModuleMaterials] = useState<Record<string, CourseMaterialResponse[]>>({});
  const [loadingModuleMaterials, setLoadingModuleMaterials] = useState<Record<string, boolean>>({});
  const [addMaterialModal, setAddMaterialModal] = useState<{ open: boolean; moduleId: string | null }>({ open: false, moduleId: null });
  const [unassignedMaterials, setUnassignedMaterials] = useState<CourseMaterialResponse[]>([]);
  const [loadingUnassigned, setLoadingUnassigned] = useState(false);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [assigningMaterials, setAssigningMaterials] = useState(false);

  // ─── Module Assessments State ─────────────────────────────
  const [moduleAssessments, setModuleAssessments] = useState<import("@/types/instructor-dashboard").AssessmentResponse[]>([]);

  useEffect(() => {
    if (!courseId) return;
    instructorApi.getAssessments(courseId).then((res) => {
      setModuleAssessments(res.data || []);
    }).catch(() => {});
  }, [courseId]);

  // ─── Session State ─────────────────────────────────────────
  const [sessionModal, setSessionModal] = useState<{
    open: boolean;
    editing: CourseSession | null;
  }>({ open: false, editing: null });
  const [sessionForm, setSessionForm] = useState({
    title: "",
    type: "zoom",
    scheduledAt: "",
    durationHours: 1,
    durationMins: 0,
    zoomLink: "",
    meetingId: "",
    roomName: "",
    venueAddress: "",
  });
  const [sessionSaving, setSessionSaving] = useState(false);
  const [cancelModal, setCancelModal] = useState<{
    open: boolean;
    sessionId: string | null;
  }>({ open: false, sessionId: null });
  const [cancelReason, setCancelReason] = useState("");

  // ─── Students Pagination ──────────────────────────────────
  const [studentsPage, setStudentsPage] = useState(1);
  const STUDENTS_PER_PAGE = 10;

  // ─── Settings State ────────────────────────────────────────
  const [settingsForm, setSettingsForm] = useState({
    title: "",
    titleAr: "",
    description: "",
    descriptionAr: "",
    deliveryType: "zoom",
    maxEnrollment: "",
    startDate: "",
    endDate: "",
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const [submittingForReview, setSubmittingForReview] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<{ url: string; title: string } | null>(null);

  // Initialize settings form from course data
  useEffect(() => {
    if (course) {
      setSettingsForm({
        title: course.title,
        titleAr: course.titleAr || "",
        description: course.description || "",
        descriptionAr: course.descriptionAr || "",
        deliveryType: course.deliveryType,
        maxEnrollment: course.maxEnrollment ? String(course.maxEnrollment) : "",
        startDate: course.startDate ? course.startDate.split("T")[0] : "",
        endDate: course.endDate ? course.endDate.split("T")[0] : "",
      });
    }
  }, [course]);

  // ─── Computed Values ───────────────────────────────────────
  const courseTitle =
    course && locale === "ar" && course.titleAr ? course.titleAr : course?.title || "";
  const courseDescription =
    course && locale === "ar" && course.descriptionAr
      ? course.descriptionAr
      : course?.description || "";
  const deliveryIcon =
    course?.deliveryType === "onsite" ? (
      <MapPin className="w-3.5 h-3.5" />
    ) : (
      <Video className="w-3.5 h-3.5" />
    );

  const analytics = useMemo(() => {
    const total = enrollments.length;
    const active = enrollments.filter((e) => e.status === "active").length;
    const completed = enrollments.filter((e) => e.status === "completed").length;
    const dropped = enrollments.filter((e) => e.status === "dropped").length;
    const avgProgress =
      total > 0
        ? Math.round(enrollments.reduce((sum, e) => sum + e.progress, 0) / total)
        : 0;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const dropoffRate = total > 0 ? Math.round((dropped / total) * 100) : 0;

    const totalSessions = sessions.length;
    const completedSessions = sessions.filter((s) => s.status === "completed").length;
    const scheduledSessions = sessions.filter((s) => s.status === "scheduled").length;
    const liveSessions = sessions.filter((s) => s.status === "live").length;

    const dist = { low: 0, mid: 0, high: 0, complete: 0 };
    enrollments.forEach((e) => {
      if (e.progress <= 25) dist.low++;
      else if (e.progress <= 50) dist.mid++;
      else if (e.progress <= 75) dist.high++;
      else dist.complete++;
    });

    return {
      total, active, completed, dropped, avgProgress, completionRate, dropoffRate,
      totalSessions, completedSessions, scheduledSessions, liveSessions, dist,
    };
  }, [enrollments, sessions]);

  // ─── Module Material Helpers ──────────────────────────────

  const getMaterialIcon = (type: string) => {
    if (type === "video") return <Video className="w-4 h-4 text-[#3B82F6]" />;
    if (type === "pdf") return <FileText className="w-4 h-4 text-[#EF4444]" />;
    if (type === "image") return <ImageIcon className="w-4 h-4 text-[#22C55E]" />;
    return <FileText className="w-4 h-4 text-[#6B7280]" />;
  };

  const formatFileSize = (size: number | string): string => {
    const bytes = typeof size === "string" ? parseInt(size, 10) : size;
    if (!bytes || isNaN(bytes)) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const fetchModuleMaterials = async (moduleId: string) => {
    setLoadingModuleMaterials((prev) => ({ ...prev, [moduleId]: true }));
    try {
      const data = await materialsApi.list(courseId, { moduleId });
      setModuleMaterials((prev) => ({ ...prev, [moduleId]: data }));
    } catch {
      toast.error(t("courseDetail.materialLoadError"));
    } finally {
      setLoadingModuleMaterials((prev) => ({ ...prev, [moduleId]: false }));
    }
  };

  // Poll for processing status in expanded modules
  useEffect(() => {
    const expandedWithProcessing = expandedModules.filter((modId) => {
      const mats = moduleMaterials[modId] || [];
      return mats.some((m) => m.status === "processing");
    });
    if (expandedWithProcessing.length === 0) return;

    const interval = setInterval(async () => {
      for (const modId of expandedWithProcessing) {
        try {
          const data = await materialsApi.list(courseId, { moduleId: modId });
          setModuleMaterials((prev) => ({ ...prev, [modId]: data }));
        } catch {
          // Silently ignore polling errors
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [expandedModules, moduleMaterials, courseId]);

  const handleUnlinkMaterial = async (materialId: string, moduleId: string) => {
    if (!window.confirm(t("courseDetail.unlinkConfirm"))) return;
    try {
      await materialsApi.unlinkFromModule(materialId);
      setModuleMaterials((prev) => ({
        ...prev,
        [moduleId]: (prev[moduleId] || []).filter((m) => m.id !== materialId),
      }));
      toast.success(t("courseDetail.materialUnlinked"));
    } catch (err: any) {
      toast.error(err?.message || t("courseDetail.materialUnlinkError"));
    }
  };

  const openAddMaterialModal = async (moduleId: string) => {
    setAddMaterialModal({ open: true, moduleId });
    setSelectedMaterialIds([]);
    setLoadingUnassigned(true);
    try {
      const data = await materialsApi.listUnassigned(courseId);
      setUnassignedMaterials(data);
    } catch {
      toast.error(t("courseDetail.materialLoadError"));
    } finally {
      setLoadingUnassigned(false);
    }
  };

  const handleAssignMaterials = async () => {
    if (!addMaterialModal.moduleId || selectedMaterialIds.length === 0) return;
    setAssigningMaterials(true);
    try {
      await Promise.all(
        selectedMaterialIds.map((id) =>
          materialsApi.assignToModule(id, addMaterialModal.moduleId!)
        )
      );
      toast.success(t("courseDetail.materialAssigned"));
      setAddMaterialModal({ open: false, moduleId: null });
      // Refresh the module materials
      fetchModuleMaterials(addMaterialModal.moduleId!);
    } catch (err: any) {
      toast.error(err?.message || t("courseDetail.materialAssignError"));
    } finally {
      setAssigningMaterials(false);
    }
  };

  // ─── Module Handlers ───────────────────────────────────────

  const toggleModule = (moduleId: string) => {
    const isExpanding = !expandedModules.includes(moduleId);
    setExpandedModules((prev) =>
      prev.includes(moduleId) ? prev.filter((id) => id !== moduleId) : [...prev, moduleId]
    );
    if (isExpanding && !moduleMaterials[moduleId]) {
      fetchModuleMaterials(moduleId);
    }
  };

  const openAddModule = () => {
    setModuleForm({ title: "", titleAr: "", type: "video", durationMinutes: "" });
    setModuleModal({ open: true, editing: null });
  };

  const openEditModule = (mod: CourseModule) => {
    setModuleForm({
      title: mod.title,
      titleAr: mod.titleAr || "",
      type: mod.type,
      durationMinutes: mod.durationMinutes ? String(mod.durationMinutes) : "",
    });
    setModuleModal({ open: true, editing: mod });
  };

  const handleSaveModule = async () => {
    if (!moduleForm.title.trim()) return;
    setModuleSaving(true);
    try {
      const data: Record<string, unknown> = {
        title: moduleForm.title.trim(),
        type: moduleForm.type,
      };
      if (moduleForm.titleAr.trim()) data.titleAr = moduleForm.titleAr.trim();
      if (moduleForm.durationMinutes) data.durationMinutes = parseInt(moduleForm.durationMinutes, 10);

      if (moduleModal.editing) {
        await instructorApi.updateModule(courseId, moduleModal.editing.id, data);
        toast.success(t("courseDetail.moduleUpdateSuccess"));
      } else {
        await instructorApi.addModule(courseId, data as { title: string; type: string });
        toast.success(t("courseDetail.moduleAddSuccess"));
      }
      setModuleModal({ open: false, editing: null });
      refetch();
    } catch (err: any) {
      toast.error(
        err?.message ||
          (moduleModal.editing
            ? t("courseDetail.moduleUpdateError")
            : t("courseDetail.moduleAddError"))
      );
    } finally {
      setModuleSaving(false);
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    setDeletingModuleId(moduleId);
    try {
      await instructorApi.deleteModule(courseId, moduleId);
      toast.success(t("courseDetail.moduleDeleteSuccess"));
      refetch();
    } catch (err: any) {
      toast.error(err?.message || t("courseDetail.moduleDeleteError"));
    } finally {
      setDeletingModuleId(null);
    }
  };

  const handleReorderModule = async (moduleId: string, direction: "up" | "down") => {
    if (!course) return;
    const mods = [...course.modules].sort((a, b) => a.orderIndex - b.orderIndex);
    const idx = mods.findIndex((m) => m.id === moduleId);
    if (idx === -1) return;
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === mods.length - 1) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const reordered = mods.map((m, i) => ({
      id: m.id,
      orderIndex: i === idx ? mods[swapIdx].orderIndex : i === swapIdx ? mods[idx].orderIndex : m.orderIndex,
    }));

    try {
      await instructorApi.reorderModules(courseId, reordered);
      refetch();
    } catch (err: any) {
      toast.error(err?.message || t("courseDetail.moduleUpdateError"));
    }
  };

  // ─── Session Handlers ──────────────────────────────────────

  const openAddSession = () => {
    setSessionForm({
      title: "", type: "zoom", scheduledAt: "", durationHours: 1, durationMins: 0,
      zoomLink: "", meetingId: "", roomName: "", venueAddress: "",
    });
    setSessionModal({ open: true, editing: null });
  };

  const openEditSession = (session: CourseSession) => {
    setSessionForm({
      title: session.title,
      type: session.type,
      scheduledAt: toDatetimeLocal(session.scheduledAt),
      durationHours: Math.floor(session.durationMinutes / 60),
      durationMins: session.durationMinutes % 60,
      zoomLink: session.zoomLink || "",
      meetingId: session.meetingId || "",
      roomName: session.roomName || "",
      venueAddress: session.venueAddress || "",
    });
    setSessionModal({ open: true, editing: session });
  };

  const handleSaveSession = async () => {
    if (!sessionForm.title.trim() || !sessionForm.scheduledAt) return;
    setSessionSaving(true);
    try {
      const data: Record<string, unknown> = {
        title: sessionForm.title.trim(),
        type: sessionForm.type,
        scheduledAt: new Date(sessionForm.scheduledAt).toISOString(),
        durationMinutes: (sessionForm.durationHours * 60 + sessionForm.durationMins) || 60,
      };
      if (sessionForm.type === "zoom" || sessionForm.type === "hybrid") {
        if (sessionForm.zoomLink) data.zoomLink = sessionForm.zoomLink;
        if (sessionForm.meetingId) data.meetingId = sessionForm.meetingId;
      }
      if (sessionForm.type === "onsite" || sessionForm.type === "hybrid") {
        if (sessionForm.roomName) data.roomName = sessionForm.roomName;
        if (sessionForm.venueAddress) data.venueAddress = sessionForm.venueAddress;
      }

      if (sessionModal.editing) {
        await instructorApi.updateSession(sessionModal.editing.id, data);
        toast.success(t("courseDetail.sessionUpdateSuccess"));
      } else {
        data.courseId = courseId;
        await instructorApi.createSession(data);
        toast.success(t("courseDetail.sessionCreateSuccess"));
      }
      setSessionModal({ open: false, editing: null });
      refetch();
    } catch (err: any) {
      toast.error(
        err?.message ||
          (sessionModal.editing
            ? t("courseDetail.sessionUpdateError")
            : t("courseDetail.sessionCreateError"))
      );
    } finally {
      setSessionSaving(false);
    }
  };

  const handleStartSession = async (sessionId: string) => {
    try {
      const result = await instructorApi.startSession(sessionId);
      toast.success(t("courseDetail.sessionStartSuccess"));
      // Open Zoom start URL if available
      if ((result as any)?.zoomStartUrl) {
        window.open((result as any).zoomStartUrl, '_blank');
      } else if ((result as any)?.zoomLink) {
        window.open((result as any).zoomLink, '_blank');
      }
      refetch();
    } catch (err: any) {
      toast.error(err?.message || t("courseDetail.sessionStartError"));
    }
  };

  const [rescheduleModal, setRescheduleModal] = useState<{ open: boolean; sessionId: string | null }>({ open: false, sessionId: null });
  const [rescheduleData, setRescheduleData] = useState({ reason: "", newDate: "", newTime: "", durationHours: 1, durationMins: 0 });
  const [rescheduleSaving, setRescheduleSaving] = useState(false);

  const handleRescheduleSession = async () => {
    if (!rescheduleData.reason.trim()) { toast.error("Reason is required"); return; }
    if (!rescheduleData.newDate || !rescheduleData.newTime) { toast.error("New date and time are required"); return; }
    setRescheduleSaving(true);
    try {
      const newScheduledAt = new Date(`${rescheduleData.newDate}T${rescheduleData.newTime}`).toISOString();
      await instructorApi.rescheduleSession(rescheduleModal.sessionId!, {
        reason: rescheduleData.reason.trim(),
        newScheduledAt,
        newDurationMinutes: (rescheduleData.durationHours * 60 + rescheduleData.durationMins) || 60,
      });
      toast.success("Lecture rescheduled successfully");
      setRescheduleModal({ open: false, sessionId: null });
      setRescheduleData({ reason: "", newDate: "", newTime: "", durationHours: 1, durationMins: 0 });
      refetch();
    } catch (err: any) {
      toast.error(err?.message || "Failed to reschedule");
    } finally {
      setRescheduleSaving(false);
    }
  };

  const handleEndSession = async (sessionId: string) => {
    try {
      await instructorApi.endSession(sessionId);
      toast.success(t("courseDetail.sessionEndSuccess"));
      refetch();
    } catch (err: any) {
      toast.error(err?.message || t("courseDetail.sessionEndError"));
    }
  };

  const handleCancelSession = async () => {
    if (!cancelModal.sessionId || !cancelReason.trim()) return;
    try {
      await instructorApi.cancelSession(cancelModal.sessionId, cancelReason.trim());
      toast.success(t("courseDetail.sessionCancelSuccess"));
      setCancelModal({ open: false, sessionId: null });
      setCancelReason("");
      refetch();
    } catch (err: any) {
      toast.error(err?.message || t("courseDetail.sessionCancelError"));
    }
  };

  // ─── Settings Handlers ─────────────────────────────────────

  const handleSaveSettings = async () => {
    if (!settingsForm.title.trim()) return;
    if (settingsForm.startDate && settingsForm.endDate && settingsForm.endDate < settingsForm.startDate) {
      toast.error(t("courseDetail.endDateBeforeStart"));
      return;
    }
    setSettingsSaving(true);
    try {
      const data: Record<string, unknown> = {
        title: settingsForm.title.trim(),
        description: settingsForm.description.trim() || null,
      };
      if (settingsForm.titleAr.trim()) data.titleAr = settingsForm.titleAr.trim();
      else data.titleAr = null;
      if (settingsForm.descriptionAr.trim()) data.descriptionAr = settingsForm.descriptionAr.trim();
      else data.descriptionAr = null;

      await instructorApi.updateCourse(courseId, data);
      toast.success(t("courseDetail.updateSuccess"));
      refetch();
    } catch (err: any) {
      toast.error(err?.message || t("courseDetail.updateError"));
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbnailUploading(true);
    try {
      const { url } = await instructorApi.uploadThumbnail(file);
      await instructorApi.updateCourse(courseId, { thumbnail: url });
      toast.success(t("courseDetail.thumbnailSuccess"));
      refetch();
    } catch {
      toast.error(t("courseDetail.thumbnailError"));
    } finally {
      setThumbnailUploading(false);
      if (thumbnailInputRef.current) thumbnailInputRef.current.value = "";
    }
  };

  const handleSubmitForReview = async () => {
    setSubmittingForReview(true);
    try {
      await instructorApi.submitForReview(courseId);
      toast.success(t("courseDetail.submitForReviewSuccess"));
      refetch();
    } catch (err: any) {
      const parsed = (() => { try { return JSON.parse(err?.message || ""); } catch { return null; } })();
      if (parsed?.pendingMaterials) {
        toast.error(t("courseDetail.submitForReviewMaterialsError"), {
          description: parsed.pendingMaterials.join(", "),
          duration: 8000,
        });
      } else if (parsed?.outOfRangeSessions) {
        toast.error(parsed.message, {
          description: parsed.outOfRangeSessions.join(", "),
          duration: 8000,
        });
      } else {
        toast.error(err?.message || t("courseDetail.submitForReviewError"));
      }
    } finally {
      setSubmittingForReview(false);
    }
  };

  // ─── Tabs ─────────────────────────────────────────────────
  const tabs = [
    { id: "overview" as const, label: t("courseDetail.tabs.overview") },
    { id: "modules" as const, label: t("courseDetail.tabs.modules") },
    { id: "students" as const, label: t("courseDetail.tabs.students") },
    { id: "sessions" as const, label: t("courseDetail.tabs.sessions") },
    { id: "analytics" as const, label: t("courseDetail.tabs.analytics") },
    { id: "settings" as const, label: t("courseDetail.tabs.settings") },
  ];

  return (
    <>
      <InstructorNavbar instructor={instructor} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <InstructorSidebar instructor={instructor} />
            </div>
            <InstructorMobileSidebar instructor={instructor} />

            {loading && <CourseDetailSkeleton />}

            {!loading && error && (
              <div className="flex-1 min-w-0">
                <Link
                  href={`/${locale}/dashboard/instructor/courses`}
                  className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#1F2937] mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t("courseDetail.backToCourses")}
                </Link>
                <DashboardError message={error} onRetry={refetch} />
              </div>
            )}

            {!loading && !error && course && (
              <div className="flex-1 min-w-0">
                <Link
                  href={`/${locale}/dashboard/instructor/courses`}
                  className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#1F2937] mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t("courseDetail.backToCourses")}
                </Link>

                {/* Course Header */}
                <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden mb-6">
                  <div className="relative h-48 sm:h-56">
                    {course.thumbnail ? (
                      <Image
                        src={course.thumbnail}
                        alt={courseTitle}
                        fill
                        className="object-cover"
                        unoptimized={course.thumbnail.startsWith("http")}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8]" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                            course.status === "active"
                              ? "bg-[#DCFCE7] text-[#22C55E]"
                              : course.status === "draft"
                              ? "bg-[#FEF3C7] text-[#D4A520]"
                              : course.status === "completed"
                              ? "bg-[#EFF6FF] text-[#3B82F6]"
                              : "bg-[#F3F4F6] text-[#6B7280]"
                          }`}
                        >
                          {t(`courses.status.${course.status}`)}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/90 rounded-md text-xs font-medium text-[#374151]">
                          {deliveryIcon}
                          {t(`courses.delivery.${course.deliveryType}`)}
                        </span>
                      </div>
                      <h1 className="text-xl sm:text-2xl font-bold text-white">{courseTitle}</h1>
                    </div>
                  </div>

                  <div className="p-4 border-t border-[#E5E7EB]">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#EFF6FF] rounded-lg flex items-center justify-center">
                          <Users className="w-5 h-5 text-[#3B82F6]" />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-[#1F2937]">{enrollments.length}</p>
                          <p className="text-xs text-[#6B7280]">{t("courseDetail.students")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#FEF3C7] rounded-lg flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-[#D4A520]" />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-[#1F2937]">
                            {sessions.filter((s) => s.status === "completed").length}/{sessions.length}
                          </p>
                          <p className="text-xs text-[#6B7280]">{t("courseDetail.sessions")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#DCFCE7] rounded-lg flex items-center justify-center">
                          <BarChart3 className="w-5 h-5 text-[#22C55E]" />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-[#1F2937]">
                            {enrollments.length > 0
                              ? Math.round(enrollments.reduce((sum, e) => sum + e.progress, 0) / enrollments.length)
                              : 0}%
                          </p>
                          <p className="text-xs text-[#6B7280]">{t("courseDetail.completion")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#F3E8FF] rounded-lg flex items-center justify-center">
                          <Clock className="w-5 h-5 text-[#9333EA]" />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-[#1F2937]">
                            {formatDuration(course.startDate, course.endDate)}
                          </p>
                          <p className="text-xs text-[#6B7280]">{t("courseDetail.duration")}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                  <div className="flex border-b border-[#E5E7EB] overflow-x-auto" role="tablist">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        role="tab"
                        aria-selected={activeTab === tab.id}
                        className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap relative transition-colors ${
                          activeTab === tab.id ? "text-[#3B82F6]" : "text-[#6B7280] hover:text-[#374151]"
                        }`}
                      >
                        {tab.label}
                        {activeTab === tab.id && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3B82F6]" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="p-5">
                    {/* ═══ OVERVIEW ═══ */}
                    {activeTab === "overview" && (
                      <div className="space-y-6">
                        {/* Review note banner for changes_requested */}
                        {course.status === "changes_requested" && course.reviewNote && (
                          <div className="p-4 bg-[#FEF3C7] border border-[#F59E0B]/30 rounded-xl">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-5 h-5 text-[#D97706] mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-[#92400E]">{t("courseDetail.changesRequestedNote")}</p>
                                <p className="text-sm text-[#92400E] mt-1">{course.reviewNote}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div>
                          <h3 className="text-base font-semibold text-[#1F2937] mb-2">{t("courseDetail.description")}</h3>
                          <p className="text-sm text-[#6B7280] leading-relaxed whitespace-pre-wrap">
                            {courseDescription || t("courseDetail.noDescription")}
                          </p>
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-[#1F2937] mb-3">{t("courseDetail.courseInfo")}</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="p-4 bg-[#F9FAFB] rounded-lg">
                              <p className="text-xs text-[#6B7280] mb-1">{t("courseDetail.deliveryTypeLabel")}</p>
                              <p className="text-sm font-medium text-[#1F2937] capitalize">{t(`courses.delivery.${course.deliveryType}`)}</p>
                            </div>
                            <div className="p-4 bg-[#F9FAFB] rounded-lg">
                              <p className="text-xs text-[#6B7280] mb-1">{t("courseDetail.statusLabel")}</p>
                              <p className="text-sm font-medium text-[#1F2937] capitalize">{t(`courses.status.${course.status}`)}</p>
                            </div>
                            <div className="p-4 bg-[#F9FAFB] rounded-lg">
                              <p className="text-xs text-[#6B7280] mb-1">{t("courseDetail.maxEnrollmentLabel")}</p>
                              <p className="text-sm font-medium text-[#1F2937]">{course.maxEnrollment || "—"}</p>
                            </div>
                            <div className="p-4 bg-[#F9FAFB] rounded-lg">
                              <p className="text-xs text-[#6B7280] mb-1">{t("courseDetail.startDate")}</p>
                              <p className="text-sm font-medium text-[#1F2937]">{formatDate(course.startDate)}</p>
                            </div>
                            <div className="p-4 bg-[#F9FAFB] rounded-lg">
                              <p className="text-xs text-[#6B7280] mb-1">{t("courseDetail.endDate")}</p>
                              <p className="text-sm font-medium text-[#1F2937]">{formatDate(course.endDate)}</p>
                            </div>
                            <div className="p-4 bg-[#F9FAFB] rounded-lg">
                              <p className="text-xs text-[#6B7280] mb-1">{t("courseDetail.cmeHoursLabel") || "CME/CPD Hours"}</p>
                              <p className="text-sm font-medium text-[#1F2937]">{course.cmeHours || "—"}</p>
                            </div>
                            <div className="p-4 bg-[#F9FAFB] rounded-lg">
                              <p className="text-xs text-[#6B7280] mb-1">{t("courseDetail.enrollmentCount")}</p>
                              <p className="text-sm font-medium text-[#1F2937]">
                                {enrollments.length}{course.maxEnrollment ? ` / ${course.maxEnrollment}` : ""}
                              </p>
                            </div>
                          </div>
                        </div>
                        {!isCourseReadOnly && (
                          <button
                            onClick={() => setActiveTab("settings")}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#3B82F6] border border-[#3B82F6] rounded-lg hover:bg-[#EFF6FF] transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                            {t("courseDetail.editCourse")}
                          </button>
                        )}

                        {/* NELC Compliance Scorecard */}
                        <NELCScorecardPanel courseId={courseId} />

                        {/* Teaching Assistants */}
                        {!isCourseReadOnly && <CourseAssistantsSuggestPanel courseId={courseId} />}
                      </div>
                    )}

                    {/* ═══ MODULES ═══ */}
                    {activeTab === "modules" && (
                      <div className="space-y-3">
                        {course.modules.length === 0 && (
                          <div className="text-center py-8">
                            <BookOpen className="w-10 h-10 text-[#9CA3AF] mx-auto mb-3" />
                            <p className="text-sm text-[#6B7280]">{t("courseDetail.noModules")}</p>
                          </div>
                        )}
                        {[...course.modules]
                          .sort((a, b) => a.orderIndex - b.orderIndex)
                          .map((mod, idx) => (
                            <div key={mod.id} className="border border-[#E5E7EB] rounded-lg overflow-hidden">
                              <div className="flex items-center justify-between p-4 bg-[#F9FAFB]">
                                <button
                                  onClick={() => toggleModule(mod.id)}
                                  className="flex-1 flex items-center gap-3 text-left"
                                >
                                  <span className="w-6 h-6 rounded-full bg-[#E5E7EB] flex items-center justify-center text-xs font-medium text-[#6B7280]">
                                    {idx + 1}
                                  </span>
                                  <span className="flex items-center gap-2">
                                    {getModuleIcon(mod.type)}
                                    <span className="text-sm font-semibold text-[#1F2937]">
                                      {locale === "ar" && mod.titleAr ? mod.titleAr : mod.title}
                                    </span>
                                  </span>
                                  {mod.durationMinutes && (
                                    <span className="text-xs text-[#6B7280] ml-2">
                                      {mod.durationMinutes} {t("courseDetail.minutes")}
                                    </span>
                                  )}
                                  <ChevronDown
                                    className={`w-4 h-4 text-[#6B7280] transition-transform ml-auto ${
                                      expandedModules.includes(mod.id) ? "rotate-180" : ""
                                    }`}
                                  />
                                </button>
                                {!isCourseReadOnly && (
                                  <div className="flex items-center gap-1 ml-2">
                                    <button
                                      onClick={() => handleReorderModule(mod.id, "up")}
                                      disabled={idx === 0}
                                      className="p-1 hover:bg-[#E5E7EB] rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                      aria-label={t("courseDetail.moveUp")}
                                    >
                                      <ArrowUp className="w-3.5 h-3.5 text-[#6B7280]" />
                                    </button>
                                    <button
                                      onClick={() => handleReorderModule(mod.id, "down")}
                                      disabled={idx === course.modules.length - 1}
                                      className="p-1 hover:bg-[#E5E7EB] rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                      aria-label={t("courseDetail.moveDown")}
                                    >
                                      <ArrowDown className="w-3.5 h-3.5 text-[#6B7280]" />
                                    </button>
                                    <button
                                      onClick={() => openEditModule(mod)}
                                      className="p-1 hover:bg-[#E5E7EB] rounded"
                                      aria-label={t("courseDetail.editModule")}
                                    >
                                      <Edit className="w-3.5 h-3.5 text-[#6B7280]" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteModule(mod.id)}
                                      disabled={deletingModuleId === mod.id}
                                      className="p-1 hover:bg-[#FEE2E2] rounded disabled:opacity-50"
                                      aria-label={t("courseDetail.deleteModule")}
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-[#EF4444]" />
                                    </button>
                                  </div>
                                )}
                              </div>
                              {expandedModules.includes(mod.id) && (
                                <div className="border-t border-[#E5E7EB]">
                                  {/* Module metadata */}
                                  <div className="px-4 pt-3 pb-2 flex items-center gap-4 text-sm text-[#6B7280]">
                                    {getModuleIcon(mod.type)}
                                    <span className="capitalize">{t(`courseDetail.moduleTypes.${mod.type}`)}</span>
                                    {mod.durationMinutes && (
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        {mod.durationMinutes} {t("courseDetail.minutes")}
                                      </span>
                                    )}
                                    {mod.titleAr && (
                                      <span className="text-xs text-[#9CA3AF]" dir="rtl">{mod.titleAr}</span>
                                    )}
                                  </div>

                                  {/* Module materials */}
                                  <div className="px-4 pb-3">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">
                                        {t("courseDetail.moduleMaterials")}
                                      </span>
                                      <button
                                        onClick={() => openAddMaterialModal(mod.id)}
                                        className="flex items-center gap-1 text-xs text-[#3B82F6] hover:text-[#2563EB] font-medium"
                                      >
                                        <Plus className="w-3 h-3" />
                                        {t("courseDetail.addMaterial")}
                                      </button>
                                    </div>

                                    {loadingModuleMaterials[mod.id] ? (
                                      <div className="flex items-center justify-center py-4">
                                        <Loader2 className="w-5 h-5 text-[#3B82F6] animate-spin" />
                                      </div>
                                    ) : (moduleMaterials[mod.id] || []).length === 0 ? (
                                      <div className="text-center py-4">
                                        <FileText className="w-8 h-8 text-[#D1D5DB] mx-auto mb-2" />
                                        <p className="text-xs text-[#9CA3AF]">{t("courseDetail.noModuleMaterials")}</p>
                                      </div>
                                    ) : (
                                      <div className="space-y-1.5">
                                        {(moduleMaterials[mod.id] || []).map((mat) => (
                                          <div
                                            key={mat.id}
                                            className="flex items-center gap-3 p-2 rounded-lg bg-[#F9FAFB] border border-[#F3F4F6] hover:border-[#E5E7EB] transition-colors"
                                          >
                                            {getMaterialIcon(mat.type)}
                                            <div className="flex-1 min-w-0">
                                              <p className="text-sm font-medium text-[#1F2937] truncate">{mat.title}</p>
                                              <p className="text-xs text-[#9CA3AF]">
                                                {mat.type.toUpperCase()}
                                                {mat.fileSize ? ` · ${formatFileSize(mat.fileSize)}` : ""}
                                              </p>
                                            </div>
                                            <span
                                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                                mat.status === "live"
                                                  ? "bg-[#DCFCE7] text-[#22C55E]"
                                                  : mat.status === "processing"
                                                    ? "bg-[#FEF3C7] text-[#D97706]"
                                                    : "bg-[#FEE2E2] text-[#EF4444]"
                                              }`}
                                            >
                                              {mat.status}
                                            </span>
                                            <div className="flex items-center gap-0.5">
                                              {mat.type === "video" && mat.fileUrl && (
                                                <button
                                                  onClick={() => setPreviewVideo({ url: mat.fileUrl!, title: mat.title })}
                                                  className="p-1 hover:bg-[#DBEAFE] rounded"
                                                  aria-label={t("courseDetail.previewVideo") || "Preview video"}
                                                >
                                                  <Play className="w-3.5 h-3.5 text-[#3B82F6]" />
                                                </button>
                                              )}
                                              {mat.fileUrl && (
                                                <a
                                                  href={mat.fileUrl}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="p-1 hover:bg-[#E5E7EB] rounded"
                                                  aria-label={t("courseDetail.download")}
                                                >
                                                  <Download className="w-3.5 h-3.5 text-[#6B7280]" />
                                                </a>
                                              )}
                                              <button
                                                onClick={() => handleUnlinkMaterial(mat.id, mod.id)}
                                                className="p-1 hover:bg-[#FEE2E2] rounded"
                                                aria-label={t("courseDetail.unlinkMaterial")}
                                              >
                                                <Unlink className="w-3.5 h-3.5 text-[#EF4444]" />
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Module assessments */}
                                  {(() => {
                                    const modAssessments = moduleAssessments.filter((a) => a.moduleId === mod.id);
                                    if (modAssessments.length === 0) return null;
                                    return (
                                      <div className="px-4 pb-3">
                                        <span className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">
                                          {t("courseDetail.moduleAssessments")}
                                        </span>
                                        <div className="mt-2 space-y-1.5">
                                          {modAssessments.map((ma) => (
                                            <div
                                              key={ma.id}
                                              className="flex items-center gap-3 p-2 rounded-lg bg-[#F9FAFB] border border-[#F3F4F6] hover:border-[#E5E7EB] transition-colors"
                                            >
                                              <ClipboardCheck className="w-4 h-4 text-[#6B7280] flex-shrink-0" />
                                              <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-[#1F2937] truncate">{ma.title}</p>
                                                <p className="text-xs text-[#9CA3AF]">
                                                  {ma.totalMarks} {t("courseDetail.marks") || "marks"}
                                                </p>
                                              </div>
                                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                                ma.type === "assignment" ? "bg-amber-50 text-amber-700" : ma.type === "exam" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"
                                              }`}>
                                                {ma.type}
                                              </span>
                                              {(ma.submissionCount ?? 0) > 0 && (
                                                <Link
                                                  href={`/${locale}/dashboard/instructor/assessments`}
                                                  className="text-[10px] text-[#3B82F6] hover:text-[#2563EB] font-medium whitespace-nowrap"
                                                >
                                                  {ma.submissionCount} {t("courseDetail.viewSubmissions") || "submissions"}
                                                </Link>
                                              )}
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
                        {!isCourseReadOnly && (
                          <button
                            onClick={openAddModule}
                            className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-[#E5E7EB] rounded-lg text-sm text-[#6B7280] hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            {t("courseDetail.addModule")}
                          </button>
                        )}
                      </div>
                    )}

                    {/* ═══ STUDENTS ═══ */}
                    {activeTab === "students" && (() => {
                      const studentsTotalPages = Math.max(1, Math.ceil(enrollments.length / STUDENTS_PER_PAGE));
                      const paginatedEnrollments = enrollments.slice(
                        (studentsPage - 1) * STUDENTS_PER_PAGE,
                        studentsPage * STUDENTS_PER_PAGE
                      );
                      return (
                        <div className="overflow-x-auto">
                          {enrollments.length === 0 ? (
                            <div className="text-center py-8">
                              <Users className="w-10 h-10 text-[#9CA3AF] mx-auto mb-3" />
                              <p className="text-sm text-[#6B7280]">{t("courseDetail.noStudents")}</p>
                            </div>
                          ) : (
                            <>
                              <table className="w-full">
                                <thead>
                                  <tr className="border-b border-[#E5E7EB]">
                                    <th className="px-3 pb-3 text-left text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider">{t("courseDetail.name")}</th>
                                    <th className="px-3 pb-3 text-left text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider">{t("courseDetail.enrolledDate")}</th>
                                    <th className="px-3 pb-3 text-left text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider w-32">{t("courseDetail.progress")}</th>
                                    <th className="px-3 pb-3 text-center text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider w-20">{t("courseDetail.status")}</th>
                                    <th className="px-3 pb-3 text-left text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider">{t("courseDetail.lastActive")}</th>
                                    <th className="px-2 pb-3 text-center text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider w-12"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {paginatedEnrollments.map((enrollment) => {
                                    const progress = enrollment.progress;
                                    const statusColors: Record<string, string> = {
                                      active: "bg-[#DCFCE7] text-[#22C55E]",
                                      completed: "bg-[#EFF6FF] text-[#3B82F6]",
                                      dropped: "bg-[#FEE2E2] text-[#EF4444]",
                                      suspended: "bg-[#FEF3C7] text-[#D97706]",
                                    };
                                    return (
                                      <tr key={enrollment.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]">
                                        <td className="px-3 py-3">
                                          <p className="text-sm font-medium text-[#1F2937]">
                                            {enrollment.studentFirstName} {enrollment.studentLastName}
                                          </p>
                                          <p className="text-[11px] text-[#9CA3AF]">{enrollment.studentEmail}</p>
                                        </td>
                                        <td className="px-3 py-3 text-xs text-[#6B7280]">{formatDate(enrollment.enrolledAt)}</td>
                                        <td className="px-3 py-3">
                                          <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                                              <div
                                                className={`h-full rounded-full ${
                                                  progress >= 75 ? "bg-[#22C55E]" : progress >= 50 ? "bg-[#3B82F6]" : progress >= 25 ? "bg-[#F59E0B]" : "bg-[#EF4444]"
                                                }`}
                                                style={{ width: `${progress}%` }}
                                              />
                                            </div>
                                            <span className="text-xs text-[#6B7280] w-8 text-right">{progress}%</span>
                                          </div>
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${statusColors[enrollment.status] || "bg-[#F3F4F6] text-[#6B7280]"}`}>
                                            {t(`courseDetail.studentStatus.${enrollment.status}`)}
                                          </span>
                                        </td>
                                        <td className="px-3 py-3 text-xs text-[#9CA3AF]">
                                          {enrollment.lastAccessedAt ? formatDate(enrollment.lastAccessedAt) : "—"}
                                        </td>
                                        <td className="px-2 py-3 text-center">
                                          <Link
                                            href={`/${locale}/dashboard/instructor/students/${enrollment.studentId}`}
                                            className="p-1.5 text-[#9CA3AF] hover:text-[#3B82F6] hover:bg-[#EFF6FF] rounded-lg transition-colors inline-flex"
                                          >
                                            <Eye className="w-3.5 h-3.5" />
                                          </Link>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                              {studentsTotalPages > 1 && (
                                <div className="flex items-center justify-between pt-4 border-t border-[#E5E7EB] mt-2">
                                  <p className="text-xs text-[#6B7280]">
                                    {(studentsPage - 1) * STUDENTS_PER_PAGE + 1}–{Math.min(studentsPage * STUDENTS_PER_PAGE, enrollments.length)} of {enrollments.length}
                                  </p>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => setStudentsPage((p) => Math.max(1, p - 1))}
                                      disabled={studentsPage === 1}
                                      className="p-1.5 border border-[#E5E7EB] rounded text-[#6B7280] hover:bg-[#F9FAFB] disabled:opacity-50"
                                    >
                                      <ChevronLeft className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="text-xs text-[#6B7280] px-2">
                                      {studentsPage} / {studentsTotalPages}
                                    </span>
                                    <button
                                      onClick={() => setStudentsPage((p) => Math.min(studentsTotalPages, p + 1))}
                                      disabled={studentsPage === studentsTotalPages}
                                      className="p-1.5 border border-[#E5E7EB] rounded text-[#6B7280] hover:bg-[#F9FAFB] disabled:opacity-50"
                                    >
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })()}

                    {/* ═══ SESSIONS ═══ */}
                    {activeTab === "sessions" && (
                      <div className="space-y-3">
                        {sessions.length === 0 ? (
                          <div className="text-center py-8">
                            <Calendar className="w-10 h-10 text-[#9CA3AF] mx-auto mb-3" />
                            <p className="text-sm text-[#6B7280]">{t("courseDetail.noSessions")}</p>
                          </div>
                        ) : (
                          sessions.map((session) => (
                            <div key={session.id} className="flex items-center justify-between p-4 border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                  session.type === "zoom" ? "bg-[#EFF6FF]" : session.type === "onsite" ? "bg-[#DCFCE7]" : "bg-[#F3E8FF]"
                                }`}>
                                  {session.type === "zoom" ? (
                                    <Video className="w-5 h-5 text-[#3B82F6]" />
                                  ) : session.type === "onsite" ? (
                                    <MapPin className="w-5 h-5 text-[#22C55E]" />
                                  ) : (
                                    <Video className="w-5 h-5 text-[#9333EA]" />
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-[#1F2937]">{session.title}</p>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${getSessionStatusColor(session.status)}`}>
                                      {t(`courseDetail.sessionStatus.${session.status}`)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-[#6B7280]">
                                    {formatSessionDate(session.scheduledAt)} &bull;{" "}
                                    {formatSessionTime(session.scheduledAt, session.durationMinutes)}
                                    {" "}&bull; {session.durationMinutes} {t("courseDetail.minutes")}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {session.status === "scheduled" && (
                                  <button
                                    onClick={() => handleStartSession(session.id)}
                                    className="px-3 py-1.5 bg-[#3B82F6] text-white text-xs font-medium rounded-lg hover:bg-[#2563EB] transition-colors"
                                  >
                                    {t("courseDetail.startSession")}
                                  </button>
                                )}
                                {session.status === "live" && (
                                  <>
                                    <button
                                      onClick={() => handleEndSession(session.id)}
                                      className="px-3 py-1.5 bg-[#22C55E] text-white text-xs font-medium rounded-lg hover:bg-[#16A34A] transition-colors"
                                    >
                                      {t("courseDetail.endSession")}
                                    </button>
                                    {session.zoomLink && (
                                      <a
                                        href={session.zoomLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 border border-[#BFDBFE] rounded-lg text-[#3B82F6] hover:bg-[#EFF6FF] transition-colors"
                                        title={t("courseDetail.rejoinZoom")}
                                      >
                                        <ExternalLink className="w-4 h-4" />
                                      </a>
                                    )}
                                  </>
                                )}
                                {(session.status === "scheduled" || session.status === "live") && (
                                  <>
                                    <button
                                      onClick={() => openEditSession(session)}
                                      className="p-1.5 hover:bg-[#F3F4F6] rounded"
                                      aria-label={t("courseDetail.editSession")}
                                    >
                                      <Edit className="w-4 h-4 text-[#6B7280]" />
                                    </button>
                                    <button
                                      onClick={() => { setCancelModal({ open: true, sessionId: session.id }); setCancelReason(""); }}
                                      className="p-1.5 hover:bg-[#FEE2E2] rounded"
                                      aria-label={t("courseDetail.cancelSession")}
                                    >
                                      <X className="w-4 h-4 text-[#EF4444]" />
                                    </button>
                                  </>
                                )}
                                {session.status === "missed" && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setRescheduleModal({ open: true, sessionId: session.id });
                                        setRescheduleData({ reason: "", newDate: "", newTime: "", durationHours: Math.floor((session.durationMinutes || 60) / 60), durationMins: (session.durationMinutes || 60) % 60 });
                                      }}
                                      className="px-2.5 py-1 text-xs font-medium text-[#D97706] bg-[#FFFBEB] border border-[#FDE68A] rounded-lg hover:bg-[#FEF3C7] transition-colors"
                                    >
                                      Reschedule
                                    </button>
                                    <button
                                      onClick={() => { setCancelModal({ open: true, sessionId: session.id }); setCancelReason(""); }}
                                      className="p-1.5 hover:bg-[#FEE2E2] rounded"
                                    >
                                      <X className="w-4 h-4 text-[#EF4444]" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                        {!isCourseReadOnly && (
                          <button
                            onClick={openAddSession}
                            className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-[#E5E7EB] rounded-lg text-sm text-[#6B7280] hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                            {t("courseDetail.scheduleSession")}
                          </button>
                        )}
                      </div>
                    )}

                    {/* ═══ ANALYTICS ═══ */}
                    {activeTab === "analytics" && (
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-base font-semibold text-[#1F2937] mb-3">{t("courseDetail.enrollmentStats")}</h3>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="p-4 bg-[#F9FAFB] rounded-lg text-center">
                              <div className="w-10 h-10 mx-auto mb-2 bg-[#EFF6FF] rounded-lg flex items-center justify-center">
                                <Users className="w-5 h-5 text-[#3B82F6]" />
                              </div>
                              <p className="text-2xl font-bold text-[#1F2937]">{analytics.total}</p>
                              <p className="text-xs text-[#6B7280]">{t("courseDetail.totalEnrolled")}</p>
                            </div>
                            <div className="p-4 bg-[#F9FAFB] rounded-lg text-center">
                              <div className="w-10 h-10 mx-auto mb-2 bg-[#DCFCE7] rounded-lg flex items-center justify-center">
                                <UserCheck className="w-5 h-5 text-[#22C55E]" />
                              </div>
                              <p className="text-2xl font-bold text-[#1F2937]">{analytics.active}</p>
                              <p className="text-xs text-[#6B7280]">{t("courseDetail.activeStudents")}</p>
                            </div>
                            <div className="p-4 bg-[#F9FAFB] rounded-lg text-center">
                              <div className="w-10 h-10 mx-auto mb-2 bg-[#EFF6FF] rounded-lg flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-[#3B82F6]" />
                              </div>
                              <p className="text-2xl font-bold text-[#1F2937]">{analytics.completed}</p>
                              <p className="text-xs text-[#6B7280]">{t("courseDetail.completedStudents")}</p>
                            </div>
                            <div className="p-4 bg-[#F9FAFB] rounded-lg text-center">
                              <div className="w-10 h-10 mx-auto mb-2 bg-[#FEE2E2] rounded-lg flex items-center justify-center">
                                <UserX className="w-5 h-5 text-[#EF4444]" />
                              </div>
                              <p className="text-2xl font-bold text-[#1F2937]">{analytics.dropped}</p>
                              <p className="text-xs text-[#6B7280]">{t("courseDetail.droppedStudents")}</p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-base font-semibold text-[#1F2937] mb-3">{t("courseDetail.performanceOverview")}</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="p-4 border border-[#E5E7EB] rounded-lg">
                              <p className="text-xs text-[#6B7280] mb-1">{t("courseDetail.completionRate")}</p>
                              <p className="text-2xl font-bold text-[#22C55E]">{analytics.completionRate}%</p>
                              <div className="mt-2 w-full h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                                <div className="h-full bg-[#22C55E] rounded-full" style={{ width: `${analytics.completionRate}%` }} />
                              </div>
                            </div>
                            <div className="p-4 border border-[#E5E7EB] rounded-lg">
                              <p className="text-xs text-[#6B7280] mb-1">{t("courseDetail.dropoffRate")}</p>
                              <p className="text-2xl font-bold text-[#EF4444]">{analytics.dropoffRate}%</p>
                              <div className="mt-2 w-full h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                                <div className="h-full bg-[#EF4444] rounded-full" style={{ width: `${analytics.dropoffRate}%` }} />
                              </div>
                            </div>
                            <div className="p-4 border border-[#E5E7EB] rounded-lg">
                              <p className="text-xs text-[#6B7280] mb-1">{t("courseDetail.avgProgress")}</p>
                              <p className="text-2xl font-bold text-[#3B82F6]">{analytics.avgProgress}%</p>
                              <div className="mt-2 w-full h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                                <div className="h-full bg-[#3B82F6] rounded-full" style={{ width: `${analytics.avgProgress}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>

                        {analytics.total > 0 && (
                          <div>
                            <h3 className="text-base font-semibold text-[#1F2937] mb-3">{t("courseDetail.progressDistribution")}</h3>
                            <div className="space-y-3">
                              {[
                                { label: "0-25%", count: analytics.dist.low, color: "bg-[#EF4444]" },
                                { label: "26-50%", count: analytics.dist.mid, color: "bg-[#F59E0B]" },
                                { label: "51-75%", count: analytics.dist.high, color: "bg-[#3B82F6]" },
                                { label: "76-100%", count: analytics.dist.complete, color: "bg-[#22C55E]" },
                              ].map((bucket) => (
                                <div key={bucket.label} className="flex items-center gap-3">
                                  <span className="text-xs text-[#6B7280] w-14">{bucket.label}</span>
                                  <div className="flex-1 h-6 bg-[#F3F4F6] rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${bucket.color} rounded-full flex items-center justify-end pr-2 transition-all`}
                                      style={{ width: analytics.total > 0 ? `${Math.max((bucket.count / analytics.total) * 100, bucket.count > 0 ? 8 : 0)}%` : "0%" }}
                                    >
                                      {bucket.count > 0 && <span className="text-[10px] font-medium text-white">{bucket.count}</span>}
                                    </div>
                                  </div>
                                  <span className="text-xs text-[#6B7280] w-8 text-right">{bucket.count}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <h3 className="text-base font-semibold text-[#1F2937] mb-3">{t("courseDetail.sessionStats")}</h3>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="p-4 bg-[#F9FAFB] rounded-lg text-center">
                              <p className="text-2xl font-bold text-[#1F2937]">{analytics.totalSessions}</p>
                              <p className="text-xs text-[#6B7280]">{t("courseDetail.totalSessionsLabel")}</p>
                            </div>
                            <div className="p-4 bg-[#F9FAFB] rounded-lg text-center">
                              <p className="text-2xl font-bold text-[#22C55E]">{analytics.completedSessions}</p>
                              <p className="text-xs text-[#6B7280]">{t("courseDetail.completedSessionsLabel")}</p>
                            </div>
                            <div className="p-4 bg-[#F9FAFB] rounded-lg text-center">
                              <p className="text-2xl font-bold text-[#3B82F6]">{analytics.scheduledSessions}</p>
                              <p className="text-xs text-[#6B7280]">{t("courseDetail.scheduledSessionsLabel")}</p>
                            </div>
                            <div className="p-4 bg-[#F9FAFB] rounded-lg text-center">
                              <p className="text-2xl font-bold text-[#D97706]">{analytics.liveSessions}</p>
                              <p className="text-xs text-[#6B7280]">{t("courseDetail.liveSessionsLabel")}</p>
                            </div>
                          </div>
                        </div>

                        {analytics.total === 0 && analytics.totalSessions === 0 && (
                          <div className="text-center py-8">
                            <BarChart3 className="w-10 h-10 text-[#9CA3AF] mx-auto mb-3" />
                            <p className="text-sm text-[#6B7280]">{t("courseDetail.noAnalyticsData")}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ═══ SETTINGS ═══ */}
                    {activeTab === "settings" && (
                      <div className={`space-y-8 ${isCourseReadOnly ? "pointer-events-none opacity-60" : ""}`}>
                        <div>
                          <h3 className="text-base font-semibold text-[#1F2937] mb-4">{t("courseDetail.editCourse")}</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-[#374151] mb-1">{t("courseDetail.courseTitleEn")}</label>
                              <input
                                type="text"
                                value={settingsForm.title}
                                onChange={(e) => setSettingsForm((f) => ({ ...f, title: e.target.value }))}
                                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-[#374151] mb-1">{t("courseDetail.courseTitleAr")}</label>
                              <input
                                type="text"
                                dir="rtl"
                                value={settingsForm.titleAr}
                                onChange={(e) => setSettingsForm((f) => ({ ...f, titleAr: e.target.value }))}
                                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-sm font-medium text-[#374151] mb-1">{t("courseDetail.courseDescEn")}</label>
                              <textarea
                                value={settingsForm.description}
                                onChange={(e) => setSettingsForm((f) => ({ ...f, description: e.target.value }))}
                                rows={3}
                                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent resize-none"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-sm font-medium text-[#374151] mb-1">{t("courseDetail.courseDescAr")}</label>
                              <textarea
                                dir="rtl"
                                value={settingsForm.descriptionAr}
                                onChange={(e) => setSettingsForm((f) => ({ ...f, descriptionAr: e.target.value }))}
                                rows={3}
                                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent resize-none"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-[#374151] mb-1">{t("courseDetail.deliveryTypeLabel")}</label>
                              <select
                                value={settingsForm.deliveryType}
                                disabled
                                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm bg-[#F9FAFB] text-[#6B7280] cursor-not-allowed"
                              >
                                <option value="zoom">{t("courseDetail.deliveryOptions.zoom")}</option>
                                <option value="onsite">{t("courseDetail.deliveryOptions.onsite")}</option>
                                <option value="blended">{t("courseDetail.deliveryOptions.blended")}</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-[#374151] mb-1">{t("courseDetail.maxEnrollmentLabel")}</label>
                              <input
                                type="number"
                                min="1"
                                value={settingsForm.maxEnrollment}
                                disabled
                                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm bg-[#F9FAFB] text-[#6B7280] cursor-not-allowed"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-[#374151] mb-1">{t("courseDetail.startDate")}</label>
                              <input
                                type="date"
                                value={settingsForm.startDate}
                                disabled
                                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm bg-[#F9FAFB] text-[#6B7280] cursor-not-allowed"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-[#374151] mb-1">{t("courseDetail.endDate")}</label>
                              <input
                                type="date"
                                value={settingsForm.endDate}
                                disabled
                                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm bg-[#F9FAFB] text-[#6B7280] cursor-not-allowed"
                              />
                            </div>
                          </div>

                          <div className="mt-4">
                            <label className="block text-sm font-medium text-[#374151] mb-2">{t("courseDetail.thumbnail")}</label>
                            <div className="flex items-center gap-4">
                              {course.thumbnail ? (
                                <div className="w-20 h-14 rounded-lg overflow-hidden border border-[#E5E7EB]">
                                  <Image src={course.thumbnail} alt="Thumbnail" width={80} height={56} className="object-cover w-full h-full" unoptimized={course.thumbnail.startsWith("http")} />
                                </div>
                              ) : (
                                <p className="text-sm text-[#6B7280]">—</p>
                              )}
                              <p className="text-xs text-[#9CA3AF]">{t("courseDetail.managerOnlyField")}</p>
                            </div>
                          </div>

                          <div className="mt-6">
                            <button
                              onClick={handleSaveSettings}
                              disabled={settingsSaving || !settingsForm.title.trim()}
                              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#3B82F6] text-white text-sm font-medium rounded-lg hover:bg-[#2563EB] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Save className="w-4 h-4" />
                              {settingsSaving ? t("courseDetail.saving") : t("courseDetail.saveChanges")}
                            </button>
                          </div>
                        </div>

                        {/* Review Workflow */}
                        <div className="border-t border-[#E5E7EB] pt-6">
                          <h3 className="text-base font-semibold text-[#1F2937] mb-3">{t("courseDetail.statusManagement")}</h3>
                          <p className="text-sm text-[#6B7280] mb-4">
                            {t("courseDetail.currentStatus")}:{" "}
                            <span className="font-medium text-[#1F2937] capitalize">{t(`courses.status.${course.status}`)}</span>
                          </p>

                          {/* Review note banner when changes requested */}
                          {course.status === "changes_requested" && (course as any).reviewNote && (
                            <div className="p-4 bg-[#FEF3C7] border border-[#F59E0B]/30 rounded-lg mb-4">
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="w-5 h-5 text-[#D97706] mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-sm font-medium text-[#92400E]">{t("courseDetail.reviewNoteTitle")}</p>
                                  <p className="text-sm text-[#92400E] mt-1">{(course as any).reviewNote}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Pending review info */}
                          {course.status === "pending_review" && (
                            <div className="p-4 bg-[#EEF2FF] border border-[#6366F1]/20 rounded-lg mb-4">
                              <p className="text-sm text-[#4338CA]">{t("courseDetail.pendingReviewInfo")}</p>
                            </div>
                          )}

                          {/* Submit for review button */}
                          {(course.status === "draft" || course.status === "changes_requested") && (
                            <button
                              onClick={handleSubmitForReview}
                              disabled={submittingForReview}
                              className="px-4 py-2 bg-[#6366F1] text-white text-sm font-medium rounded-lg hover:bg-[#4F46E5] transition-colors disabled:opacity-50"
                            >
                              {submittingForReview ? t("courseDetail.submitting") : t("courseDetail.submitForReview")}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ MODULE MODAL ═══ */}
      {moduleModal.open && (
        <ModalOverlay onClose={() => setModuleModal({ open: false, editing: null })}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#1F2937]">
                {moduleModal.editing ? t("courseDetail.editModule") : t("courseDetail.addModule")}
              </h3>
              <button onClick={() => setModuleModal({ open: false, editing: null })} className="p-1 hover:bg-[#F3F4F6] rounded">
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">{t("courseDetail.moduleTitle")} *</label>
                <input
                  type="text"
                  value={moduleForm.title}
                  onChange={(e) => setModuleForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                  placeholder={t("courseDetail.moduleTitlePlaceholder")}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">{t("courseDetail.moduleTitleAr")}</label>
                <input
                  type="text"
                  dir="rtl"
                  value={moduleForm.titleAr}
                  onChange={(e) => setModuleForm((f) => ({ ...f, titleAr: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">{t("courseDetail.moduleType")} *</label>
                <select
                  value={moduleForm.type}
                  onChange={(e) => setModuleForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent bg-white"
                >
                  <option value="video">{t("courseDetail.moduleTypes.video")}</option>
                  <option value="document">{t("courseDetail.moduleTypes.document")}</option>
                  <option value="quiz">{t("courseDetail.moduleTypes.quiz")}</option>
                  <option value="mixed">{t("courseDetail.moduleTypes.mixed")}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">{t("courseDetail.moduleDuration")}</label>
                <input
                  type="number"
                  min="0"
                  value={moduleForm.durationMinutes}
                  onChange={(e) => setModuleForm((f) => ({ ...f, durationMinutes: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                  placeholder="60"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setModuleModal({ open: false, editing: null })} className="px-4 py-2 text-sm text-[#6B7280] hover:text-[#1F2937] transition-colors">
                {t("courseDetail.cancel")}
              </button>
              <button
                onClick={handleSaveModule}
                disabled={moduleSaving || !moduleForm.title.trim()}
                className="px-4 py-2 bg-[#3B82F6] text-white text-sm font-medium rounded-lg hover:bg-[#2563EB] transition-colors disabled:opacity-50"
              >
                {moduleSaving ? t("courseDetail.saving") : t("courseDetail.saveModule")}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ═══ ADD MATERIAL TO MODULE MODAL ═══ */}
      {addMaterialModal.open && (
        <ModalOverlay onClose={() => setAddMaterialModal({ open: false, moduleId: null })}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#1F2937]">
                {t("courseDetail.addExisting")}
              </h3>
              <button
                onClick={() => setAddMaterialModal({ open: false, moduleId: null })}
                className="p-1 hover:bg-[#F3F4F6] rounded"
              >
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>
            <p className="text-sm text-[#6B7280] mb-4">
              {t("courseDetail.addExistingDescription")}
            </p>

            {loadingUnassigned ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-[#3B82F6] animate-spin" />
              </div>
            ) : unassignedMaterials.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-10 h-10 text-[#D1D5DB] mx-auto mb-2" />
                <p className="text-sm text-[#9CA3AF]">{t("courseDetail.noUnassignedMaterials")}</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {unassignedMaterials.map((mat) => {
                  const isSelected = selectedMaterialIds.includes(mat.id);
                  return (
                    <button
                      key={mat.id}
                      onClick={() =>
                        setSelectedMaterialIds((prev) =>
                          isSelected ? prev.filter((id) => id !== mat.id) : [...prev, mat.id]
                        )
                      }
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                        isSelected
                          ? "border-[#3B82F6] bg-[#EFF6FF]"
                          : "border-[#E5E7EB] hover:border-[#D1D5DB]"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected ? "border-[#3B82F6] bg-[#3B82F6]" : "border-[#D1D5DB]"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      {getMaterialIcon(mat.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1F2937] truncate">{mat.title}</p>
                        <p className="text-xs text-[#9CA3AF]">
                          {mat.type.toUpperCase()}
                          {mat.fileSize ? ` · ${formatFileSize(mat.fileSize)}` : ""}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setAddMaterialModal({ open: false, moduleId: null })}
                className="px-4 py-2 text-sm text-[#6B7280] hover:text-[#1F2937] transition-colors"
              >
                {t("courseDetail.cancel")}
              </button>
              <button
                onClick={handleAssignMaterials}
                disabled={assigningMaterials || selectedMaterialIds.length === 0}
                className="px-4 py-2 bg-[#3B82F6] text-white text-sm font-medium rounded-lg hover:bg-[#2563EB] transition-colors disabled:opacity-50"
              >
                {assigningMaterials
                  ? t("courseDetail.saving")
                  : `${t("courseDetail.assignToModule")} (${selectedMaterialIds.length})`}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ═══ SESSION MODAL ═══ */}
      {sessionModal.open && (
        <ModalOverlay onClose={() => setSessionModal({ open: false, editing: null })}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#1F2937]">
                {sessionModal.editing ? t("courseDetail.editSession") : t("courseDetail.scheduleSession")}
              </h3>
              <button onClick={() => setSessionModal({ open: false, editing: null })} className="p-1 hover:bg-[#F3F4F6] rounded">
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">{t("courseDetail.sessionTitle")} *</label>
                <input
                  type="text"
                  value={sessionForm.title}
                  onChange={(e) => setSessionForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">{t("courseDetail.sessionType")} *</label>
                <select
                  value={sessionForm.type}
                  onChange={(e) => setSessionForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent bg-white"
                >
                  <option value="zoom">{t("courseDetail.sessionTypes.zoom")}</option>
                  <option value="onsite">{t("courseDetail.sessionTypes.onsite")}</option>
                  <option value="hybrid">{t("courseDetail.sessionTypes.hybrid")}</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">{t("courseDetail.scheduledDate")} *</label>
                  <input
                    type="datetime-local"
                    value={sessionForm.scheduledAt}
                    onChange={(e) => setSessionForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">{t("courseDetail.sessionDuration")}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={sessionForm.durationHours}
                      onChange={(e) => setSessionForm((f) => ({ ...f, durationHours: Math.max(0, Number(e.target.value)) }))}
                      className="w-20 px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                    />
                    <span className="text-sm text-[#6B7280]">{t("courseDetail.hours") || "hrs"}</span>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={sessionForm.durationMins}
                      onChange={(e) => setSessionForm((f) => ({ ...f, durationMins: Math.max(0, Math.min(59, Number(e.target.value))) }))}
                      className="w-20 px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                    />
                    <span className="text-sm text-[#6B7280]">{t("courseDetail.minutes")}</span>
                  </div>
                </div>
              </div>
              {(sessionForm.type === "zoom" || sessionForm.type === "hybrid") && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1">{t("courseDetail.zoomLink")}</label>
                    <input type="url" value={sessionForm.zoomLink} onChange={(e) => setSessionForm((f) => ({ ...f, zoomLink: e.target.value }))} className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1">{t("courseDetail.meetingId")}</label>
                    <input type="text" value={sessionForm.meetingId} onChange={(e) => setSessionForm((f) => ({ ...f, meetingId: e.target.value }))} className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent" />
                  </div>
                </div>
              )}
              {(sessionForm.type === "onsite" || sessionForm.type === "hybrid") && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1">{t("courseDetail.roomName")}</label>
                    <input type="text" value={sessionForm.roomName} onChange={(e) => setSessionForm((f) => ({ ...f, roomName: e.target.value }))} className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1">{t("courseDetail.venueAddress")}</label>
                    <input type="text" value={sessionForm.venueAddress} onChange={(e) => setSessionForm((f) => ({ ...f, venueAddress: e.target.value }))} className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent" />
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setSessionModal({ open: false, editing: null })} className="px-4 py-2 text-sm text-[#6B7280] hover:text-[#1F2937] transition-colors">
                {t("courseDetail.cancel")}
              </button>
              <button
                onClick={handleSaveSession}
                disabled={sessionSaving || !sessionForm.title.trim() || !sessionForm.scheduledAt}
                className="px-4 py-2 bg-[#3B82F6] text-white text-sm font-medium rounded-lg hover:bg-[#2563EB] transition-colors disabled:opacity-50"
              >
                {sessionSaving ? t("courseDetail.saving") : t("courseDetail.saveSession")}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ═══ CANCEL SESSION MODAL ═══ */}
      {cancelModal.open && (
        <ModalOverlay onClose={() => setCancelModal({ open: false, sessionId: null })}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#1F2937]">{t("courseDetail.cancelSession")}</h3>
              <button onClick={() => setCancelModal({ open: false, sessionId: null })} className="p-1 hover:bg-[#F3F4F6] rounded">
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>
            <p className="text-sm text-[#6B7280] mb-4">{t("courseDetail.cancelSessionConfirm")}</p>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">{t("courseDetail.cancelReason")} *</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setCancelModal({ open: false, sessionId: null })} className="px-4 py-2 text-sm text-[#6B7280] hover:text-[#1F2937] transition-colors">
                {t("courseDetail.cancel")}
              </button>
              <button
                onClick={handleCancelSession}
                disabled={!cancelReason.trim()}
                className="px-4 py-2 bg-[#EF4444] text-white text-sm font-medium rounded-lg hover:bg-[#DC2626] transition-colors disabled:opacity-50"
              >
                {t("courseDetail.confirmCancel")}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ═══ RESCHEDULE MODAL ═══ */}
      {rescheduleModal.open && (
        <ModalOverlay onClose={() => setRescheduleModal({ open: false, sessionId: null })}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#1F2937]">Reschedule Lecture</h3>
              <button onClick={() => setRescheduleModal({ open: false, sessionId: null })} className="p-1 hover:bg-[#F3F4F6] rounded">
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">Reason *</label>
                <textarea
                  value={rescheduleData.reason}
                  onChange={(e) => setRescheduleData(d => ({ ...d, reason: e.target.value }))}
                  rows={2}
                  placeholder="Why is this lecture being rescheduled?"
                  className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">New Date *</label>
                  <input
                    type="date"
                    value={rescheduleData.newDate}
                    onChange={(e) => setRescheduleData(d => ({ ...d, newDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1">New Time *</label>
                  <input
                    type="time"
                    value={rescheduleData.newTime}
                    onChange={(e) => setRescheduleData(d => ({ ...d, newTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">Duration</label>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} value={rescheduleData.durationHours} onChange={(e) => setRescheduleData(d => ({ ...d, durationHours: Math.max(0, Number(e.target.value)) }))} className="w-20 px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent" />
                  <span className="text-sm text-[#6B7280]">hrs</span>
                  <input type="number" min={0} max={59} value={rescheduleData.durationMins} onChange={(e) => setRescheduleData(d => ({ ...d, durationMins: Math.max(0, Math.min(59, Number(e.target.value))) }))} className="w-20 px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent" />
                  <span className="text-sm text-[#6B7280]">min</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setRescheduleModal({ open: false, sessionId: null })} className="px-4 py-2 text-sm text-[#6B7280] hover:text-[#1F2937] transition-colors">
                Cancel
              </button>
              <button
                onClick={handleRescheduleSession}
                disabled={rescheduleSaving || !rescheduleData.reason.trim() || !rescheduleData.newDate || !rescheduleData.newTime}
                className="px-4 py-2 bg-[#D97706] text-white text-sm font-medium rounded-lg hover:bg-[#B45309] transition-colors disabled:opacity-50"
              >
                {rescheduleSaving ? "Rescheduling..." : "Reschedule Lecture"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ═══ VIDEO PREVIEW MODAL ═══ */}
      {previewVideo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setPreviewVideo(null)}
        >
          <div
            className="relative w-full max-w-3xl mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewVideo(null)}
              className="absolute -top-10 right-0 p-1 text-white hover:text-[#D1D5DB] transition-colors"
              title="Close"
            >
              <X className="w-6 h-6" />
            </button>
            <p className="text-white text-sm font-medium mb-2 truncate">
              {previewVideo.title}
            </p>
            <video
              controls
              autoPlay
              className="w-full rounded-lg bg-black"
              src={previewVideo.url}
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      )}
    </>
  );
};

export default CourseDetailContent;
