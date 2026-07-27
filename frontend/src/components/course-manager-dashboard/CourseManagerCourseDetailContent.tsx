"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { formatDuration } from "@/lib/utils";
import { formatDate as formatDateHijri } from "@/lib/hijri";
import { useCalendarPreference } from "@/contexts/CalendarContext";
import { usePlatformLocale } from "@/contexts/PlatformLocaleContext";
import { toast } from "sonner";
import { useManagerProfile } from "@/hooks/useManagerProfile";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { adminApi, courseManagerApi, type CourseDeleteImpact } from "@/lib/api";
import DatePicker from "@/components/ui/DatePicker";
import type {
  CourseDetailResponse,
  CourseModule,
  CourseEnrollment,
  CourseSession,
  CertificateRequestResponse,
} from "@/types/instructor-dashboard";
import Select from "@/components/admin-dashboard/Select";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import AdminNavbar from "@/components/admin-dashboard/AdminNavbar";
import AdminSidebar from "@/components/admin-dashboard/AdminSidebar";
import AdminMobileSidebar from "@/components/admin-dashboard/AdminMobileSidebar";
import AssessmentPreviewDrawer from "@/components/admin-dashboard/assessments/AssessmentPreviewDrawer";
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
  XCircle,
  CalendarClock,
  Ban,
  Eye,
  ClipboardCheck,
  Award,
  Star,
  Search,
  History,
  ChevronLeft,
  UserCheck,
  UserX,
  UserPlus,
  TrendingUp,
  BarChart3,
} from "lucide-react";

interface CourseManagerCourseDetailContentProps {
  courseId: string;
  /**
   * Which dashboard chrome to render around this content. Defaults to
   * "manager" — when called from admin-namespaced routes we pass "admin"
   * so the page stays inside the admin dashboard shell (sidebar/navbar/
   * mobile sidebar swap, and all internal links route to /admin/...
   * instead of /manager/...).
   */
  role?: "manager" | "admin";
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

// ─── Tabs ──────────────────────────────────────────────────────
type TabId =
  | "overview"
  | "modules"
  | "sessions"
  | "assessments"
  | "students"
  | "team"
  | "reviews"
  | "analytics"
  | "certificates"
  | "audit"
  | "settings";

const ALL_TAB_IDS: readonly TabId[] = [
  "overview",
  "modules",
  "sessions",
  "assessments",
  "students",
  "team",
  "reviews",
  "analytics",
  "certificates",
  "audit",
  "settings",
];

function isValidTab(value: string | null): value is TabId {
  return !!value && (ALL_TAB_IDS as readonly string[]).includes(value);
}

const CourseManagerCourseDetailContent = ({
  courseId,
  role = "manager",
}: CourseManagerCourseDetailContentProps) => {
  const t = useTranslations("courseManagerDashboard");
  // Admin-only modals reuse the translation keys already authored under
  // adminDashboard.coursesPage.* — the same ones AdminCoursesContent
  // uses on the list page, so wording stays in sync between the two
  // surfaces. Only referenced from admin-gated branches.
  const tAdmin = useTranslations("adminDashboard");
  const locale = useLocale();
  const { calendarFormat } = useCalendarPreference();
  const platformLocale = usePlatformLocale();
  const isRTL = locale === "ar";
  const router = useRouter();
  // Both hooks called unconditionally to satisfy hook rules — the unused
  // one is cheap (it just reads user from context).
  const managerProfile = useManagerProfile();
  const adminProfile = useAdminProfile();
  const isAdmin = role === "admin";
  const manager = managerProfile;
  const admin = adminProfile;
  const dashboardBase = `/${locale}/dashboard/${isAdmin ? "admin" : "manager"}/courses`;

  const [course, setCourse] = useState<CourseDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showRequestChanges, setShowRequestChanges] = useState(false);
  const [requestChangesNote, setRequestChangesNote] = useState("");
  const [requestingChanges, setRequestingChanges] = useState(false);

  // Unified confirm modal state for cancel / delete / reschedule —
  // ported from AdminCoursesContent so the shared detail component has
  // the same destructive-action flow as the admin list page. Available
  // to both admin and manager (backend enforces manager-scope + Phase B
  // status rules).
  type AdminConfirmKind = "delete" | "cancel" | "reschedule" | null;
  const [confirmKind, setConfirmKind] = useState<AdminConfirmKind>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [deleteImpact, setDeleteImpact] = useState<CourseDeleteImpact | null>(null);
  const [deleteImpactLoading, setDeleteImpactLoading] = useState(false);
  const [deleteImpactError, setDeleteImpactError] = useState<string | null>(null);
  const [deleteTypedTitle, setDeleteTypedTitle] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [rescheduleNewStartDate, setRescheduleNewStartDate] = useState("");
  const [rescheduleNewEndDate, setRescheduleNewEndDate] = useState("");

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
  const [previewAssessmentId, setPreviewAssessmentId] = useState<string | null>(null);
  useEffect(() => {
    if (!courseId) return;
    courseManagerApi.getAssessments({ courseId, limit: 100 }).then((res) => {
      setModuleAssessments(res.data || []);
    }).catch(() => {});
  }, [courseId]);

  // Reviews-block state — toggled between course reviews and instructor
  // reviews for the same course. Uses the manager endpoints which
  // return ALL moderation states (pending / approved / rejected), NOT
  // the public endpoints which hide unpublished rows — otherwise
  // managers can't see the reviews they need to moderate on the
  // course-detail Reviews tab.
  const [reviewKind, setReviewKind] = useState<"course" | "instructor">("course");
  useEffect(() => {
    if (!courseId) return;
    setReviewsLoading(true);
    const fetcher =
      reviewKind === "course"
        ? courseManagerApi.getManagerReviews({ courseId, limit: 20, sort: "newest" })
        : courseManagerApi.getManagerInstructorReviews({ courseId, limit: 20, sort: "newest" });
    fetcher
      .then((res) => setReviews(res?.data || []))
      .catch(() => setReviews([]))
      .finally(() => setReviewsLoading(false));
  }, [courseId, reviewKind]);

  // Remove material modal
  const [removingMaterial, setRemovingMaterial] = useState<MaterialItem | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [removeLoading, setRemoveLoading] = useState(false);

  type ReviewItem = { id: string; rating: number; reviewText: string | null; createdAt: string; studentName: string };
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  // ─── Tabs ────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window === "undefined") return "overview";
    const p = new URLSearchParams(window.location.search).get("tab");
    return isValidTab(p) ? (p as TabId) : "overview";
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", activeTab);
    window.history.replaceState({}, "", url.toString());
  }, [activeTab]);

  // ─── Students tab — enrollments (lazy-fetched, cached) ────────
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);
  const [enrollmentsError, setEnrollmentsError] = useState<string | null>(null);
  const [enrollmentsFetched, setEnrollmentsFetched] = useState(false);
  const [studentsSearch, setStudentsSearch] = useState("");
  const [studentsPage, setStudentsPage] = useState(1);
  const STUDENTS_PAGE_SIZE = 25;

  const refetchEnrollments = useCallback(() => {
    if (!courseId) return;
    setEnrollmentsLoading(true);
    setEnrollmentsError(null);
    courseManagerApi
      .getEnrollments({ courseId })
      .then((data) => {
        setEnrollments(data || []);
        setEnrollmentsFetched(true);
      })
      .catch((err) => {
        setEnrollmentsError(err instanceof Error ? err.message : t("courseDetail.loadError"));
      })
      .finally(() => setEnrollmentsLoading(false));
  }, [courseId, t]);

  useEffect(() => {
    // Enrollments feed BOTH the Students tab AND the Analytics tab.
    // Fetch as soon as the course loads so Analytics has real data even
    // if the user hasn't opened the Students tab yet.
    if (enrollmentsFetched || !courseId) return;
    refetchEnrollments();
  }, [courseId, enrollmentsFetched, refetchEnrollments]);

  // ─── Add Student modal state ──────────────────────────────────
  type StudentSearchHit = {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    scfhsNumber: string | null;
  };
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [studentPickerQuery, setStudentPickerQuery] = useState("");
  const [studentPickerResults, setStudentPickerResults] = useState<StudentSearchHit[]>([]);
  const [studentPickerLoading, setStudentPickerLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchHit | null>(null);
  const [manualEnrollReason, setManualEnrollReason] = useState("");
  const [manualEnrollSubmitting, setManualEnrollSubmitting] = useState(false);

  // Debounced student search — 300ms after last keystroke.
  useEffect(() => {
    if (!addStudentOpen) return;
    const handle = setTimeout(() => {
      setStudentPickerLoading(true);
      courseManagerApi
        .searchStudents(studentPickerQuery, 20)
        .then((data) => setStudentPickerResults(data || []))
        .catch(() => setStudentPickerResults([]))
        .finally(() => setStudentPickerLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [studentPickerQuery, addStudentOpen]);

  const openAddStudent = () => {
    setSelectedStudent(null);
    setManualEnrollReason("");
    setStudentPickerQuery("");
    setStudentPickerResults([]);
    setAddStudentOpen(true);
  };

  const submitManualEnroll = async () => {
    if (!course || !selectedStudent || manualEnrollReason.trim().length < 3) return;
    setManualEnrollSubmitting(true);
    try {
      await courseManagerApi.manualEnrollStudent(
        course.id,
        selectedStudent.id,
        manualEnrollReason.trim(),
      );
      toast.success(t("courseDetail.students.addSuccess"));
      setAddStudentOpen(false);
      refetchEnrollments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("courseDetail.students.addFailed"));
    } finally {
      setManualEnrollSubmitting(false);
    }
  };

  // ─── Remove Student modal state ───────────────────────────────
  const [removeEnrollment, setRemoveEnrollment] = useState<CourseEnrollment | null>(null);
  const [removeEnrollReason, setRemoveEnrollReason] = useState("");
  const [removeEnrollSubmitting, setRemoveEnrollSubmitting] = useState(false);

  const openRemoveEnrollment = (enrollment: CourseEnrollment) => {
    setRemoveEnrollment(enrollment);
    setRemoveEnrollReason("");
  };

  const submitRemoveEnrollment = async () => {
    if (!course || !removeEnrollment || removeEnrollReason.trim().length < 3) return;
    setRemoveEnrollSubmitting(true);
    try {
      await courseManagerApi.removeEnrolledStudent(
        course.id,
        removeEnrollment.studentId,
        removeEnrollReason.trim(),
      );
      toast.success(t("courseDetail.students.removeSuccess"));
      setRemoveEnrollment(null);
      refetchEnrollments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("courseDetail.students.removeFailed"));
    } finally {
      setRemoveEnrollSubmitting(false);
    }
  };

  // ─── Sessions tab (lazy-fetched, cached) ──────────────────────
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [sessionsFetched, setSessionsFetched] = useState(false);

  useEffect(() => {
    // Sessions feed the Sessions tab AND the Analytics tab (total /
    // completed session counts). Fetch eagerly so Analytics is
    // populated without requiring the user to visit the Sessions tab.
    if (sessionsFetched || !courseId) return;
    setSessionsLoading(true);
    setSessionsError(null);
    courseManagerApi
      .getSessions({ courseId, limit: 50 })
      .then((res) => {
        setSessions(res.data || []);
        setSessionsFetched(true);
      })
      .catch((err) => {
        setSessionsError(err instanceof Error ? err.message : t("courseDetail.loadError"));
      })
      .finally(() => setSessionsLoading(false));
  }, [courseId, sessionsFetched, t]);

  // Lazy per-session attendance counts. Fetches for any session that
  // could plausibly have records ("completed" or "ended"). We track
  // both present+late (attended) and total-with-records so the display
  // can render "3 / 5" instead of just a single number — surfaces
  // useful info even when many students were absent.
  type AttendanceSummary = { attended: number; total: number };
  const [attendanceCounts, setAttendanceCounts] = useState<Record<string, AttendanceSummary>>({});
  useEffect(() => {
    const ids = sessions
      .filter(
        (s) =>
          (s.status === "completed" || s.status === "ended") &&
          attendanceCounts[s.id] === undefined,
      )
      .map((s) => s.id);
    if (ids.length === 0) return;
    let cancelled = false;
    Promise.all(
      ids.map((id) =>
        courseManagerApi
          .getSessionAttendance(id)
          .then((records) => {
            const attended = records.filter(
              (r) => r.status === "present" || r.status === "late",
            ).length;
            return [id, { attended, total: records.length }] as const;
          })
          .catch(() => [id, { attended: 0, total: 0 }] as const),
      ),
    ).then((results) => {
      if (cancelled) return;
      setAttendanceCounts((prev) => {
        const next = { ...prev };
        for (const [id, summary] of results) {
          next[id] = summary;
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [sessions, attendanceCounts]);

  // ─── Audit tab — per-course audit log (lazy-fetched, cached) ────
  type CourseAuditRow = {
    id: string;
    action: string;
    performedBy: string | null;
    metadata: Record<string, unknown> | null;
    ipAddress: string | null;
    createdAt: string;
    performerFirstName: string | null;
    performerLastName: string | null;
    performerEmail: string | null;
  };
  const [auditLogs, setAuditLogs] = useState<CourseAuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditFetched, setAuditFetched] = useState(false);

  useEffect(() => {
    if (activeTab !== "audit" || auditFetched || !courseId) return;
    setAuditLoading(true);
    setAuditError(null);
    courseManagerApi
      .getCourseAuditLogs(courseId, 1, 100)
      .then((res) => {
        setAuditLogs(res.data || []);
        setAuditFetched(true);
      })
      .catch((err) => {
        setAuditError(err instanceof Error ? err.message : t("courseDetail.loadError"));
      })
      .finally(() => setAuditLoading(false));
  }, [activeTab, courseId, auditFetched, t]);

  // ─── Certificates tab — cert requests for this course ────────
  const [certificates, setCertificates] = useState<CertificateRequestResponse[]>([]);
  const [certificatesLoading, setCertificatesLoading] = useState(false);
  const [certificatesError, setCertificatesError] = useState<string | null>(null);
  const [certificatesFetched, setCertificatesFetched] = useState(false);
  const [certStatusFilter, setCertStatusFilter] = useState<string>("all");
  const [certActionRow, setCertActionRow] = useState<{
    row: CertificateRequestResponse;
    action: "approve" | "reject" | "hold" | "revoke";
  } | null>(null);
  const [certActionNote, setCertActionNote] = useState("");
  const [certActionSubmitting, setCertActionSubmitting] = useState(false);

  const refetchCertificates = useCallback(() => {
    if (!courseId) return;
    setCertificatesLoading(true);
    setCertificatesError(null);
    // Pass status:"all" so the backend does NOT default to pending —
    // we want every status back (pending / approved / rejected / held /
    // revoked) and filter client-side via the status dropdown.
    courseManagerApi
      .getCertificates({ courseId, status: "all", limit: 100 })
      .then((res) => {
        setCertificates(res.data || []);
        setCertificatesFetched(true);
      })
      .catch((err) => {
        setCertificatesError(err instanceof Error ? err.message : t("courseDetail.loadError"));
      })
      .finally(() => setCertificatesLoading(false));
  }, [courseId, t]);

  useEffect(() => {
    if (activeTab !== "certificates" || certificatesFetched || !courseId) return;
    refetchCertificates();
  }, [activeTab, courseId, certificatesFetched, refetchCertificates]);

  const openCertAction = (
    row: CertificateRequestResponse,
    action: "approve" | "reject" | "hold" | "revoke",
  ) => {
    setCertActionRow({ row, action });
    setCertActionNote("");
  };

  const submitCertAction = async () => {
    if (!certActionRow) return;
    const { row, action } = certActionRow;
    // approve is one-click; the other three require a note.
    if (action !== "approve" && certActionNote.trim().length < 3) return;
    setCertActionSubmitting(true);
    try {
      if (action === "approve") {
        await courseManagerApi.approveCertificate(row.id);
      } else if (action === "reject") {
        await courseManagerApi.rejectCertificate(row.id, certActionNote.trim());
      } else if (action === "hold") {
        await courseManagerApi.holdCertificate(row.id, certActionNote.trim());
      } else if (action === "revoke") {
        await courseManagerApi.revokeCertificate(row.id, certActionNote.trim());
      }
      toast.success(t(`courseDetail.certificates.action.${action}Success`));
      setCertActionRow(null);
      refetchCertificates();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t(`courseDetail.certificates.action.${action}Failed`),
      );
    } finally {
      setCertActionSubmitting(false);
    }
  };

  // ─── Analytics tab — computed client-side from already-fetched data ──
  const analytics = useMemo(() => {
    const total = enrollments.length;
    const active = enrollments.filter((e) => e.status === "active").length;
    const completed = enrollments.filter((e) => e.status === "completed").length;
    const dropped = enrollments.filter((e) => e.status === "dropped").length;
    const avgProgress =
      total > 0 ? Math.round(enrollments.reduce((sum, e) => sum + e.progress, 0) / total) : 0;
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter((s) => s.status === "completed").length;
    const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
    return { total, active, completed, dropped, avgProgress, totalSessions, completedSessions, avgRating };
  }, [enrollments, sessions, reviews]);

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

  // ─── Unified cancel / delete / reschedule flow ──────────────────
  // Ported from AdminCoursesContent so /admin/courses/[id] has the
  // same destructive-action surface as the admin list page.

  const openAdminConfirm = (kind: Exclude<AdminConfirmKind, null>) => {
    if (!course) return;
    setConfirmKind(kind);
    setDeleteImpact(null);
    setDeleteImpactError(null);
    setDeleteTypedTitle("");
    setDeleteReason("");
    setCancelReason("");
    setRescheduleReason("");
    // Reschedule pre-fills with current dates — the common case is
    // shifting the window by a few days, so starting from the current
    // pair beats an empty picker.
    setRescheduleNewStartDate(course.startDate ?? "");
    setRescheduleNewEndDate(course.endDate ?? "");
    // Delete + Cancel both benefit from the impact preview.
    if (kind === "delete" || kind === "cancel") {
      setDeleteImpactLoading(true);
      adminApi
        .getCourseDeleteImpact(course.id)
        .then((res) => setDeleteImpact(res.impact))
        .catch((err) =>
          setDeleteImpactError(
            err instanceof Error ? err.message : "Failed to load impact preview",
          ),
        )
        .finally(() => setDeleteImpactLoading(false));
    }
  };

  const closeAdminConfirm = () => {
    if (confirmBusy) return;
    setConfirmKind(null);
    setDeleteImpact(null);
    setDeleteImpactError(null);
    setDeleteTypedTitle("");
    setDeleteReason("");
    setCancelReason("");
    setRescheduleReason("");
    setRescheduleNewStartDate("");
    setRescheduleNewEndDate("");
  };

  const handleAdminConfirm = async () => {
    if (!course || !confirmKind) return;
    setConfirmBusy(true);
    try {
      if (confirmKind === "cancel") {
        const result = await adminApi.cancelCourse(course.id, cancelReason.trim());
        if (result.variant === "post_start") {
          toast.success(
            tAdmin("coursesPage.confirmCancel.successPostStart", {
              queued: result.refundsIssued,
              manual: result.refundsPendingBankTransfer,
              certs: result.certificatesRevoked,
            }),
          );
        } else {
          toast.success(
            tAdmin("coursesPage.confirmCancel.success", {
              queued: result.refundsIssued,
              manual: result.refundsPendingBankTransfer,
            }),
          );
        }
        closeAdminConfirm();
        fetchCourse();
      } else if (confirmKind === "reschedule") {
        const result = await adminApi.rescheduleCourse(course.id, {
          reason: rescheduleReason.trim(),
          newStartDate: rescheduleNewStartDate,
          newEndDate: rescheduleNewEndDate || undefined,
        });
        if (result.variant === "revive") {
          toast.success(
            tAdmin("coursesPage.confirmReschedule.successRevive", {
              dropped: result.droppedEnrollmentsPreserved,
              date: result.newStartDate,
            }),
          );
        } else {
          toast.success(
            tAdmin("coursesPage.confirmReschedule.successShift", {
              sessions: result.sessionsShifted,
              students: result.studentsNotified,
              date: result.newStartDate,
            }),
          );
        }
        closeAdminConfirm();
        fetchCourse();
      } else {
        // delete
        await adminApi.deleteCourse(course.id, deleteReason.trim() || undefined);
        toast.success(tAdmin("coursesPage.toasts.deleted"));
        // Course is now soft-deleted; navigate away from the detail page.
        router.push(dashboardBase);
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : tAdmin(
              confirmKind === "cancel"
                ? "coursesPage.confirmCancel.failure"
                : confirmKind === "reschedule"
                  ? "coursesPage.confirmReschedule.failure"
                  : "coursesPage.toasts.deleteFailed",
            ),
      );
    } finally {
      setConfirmBusy(false);
    }
  };

  // ─── Admin confirm gates ────────────────────────────────────────
  // Draft courses skip the type-to-confirm gate — they're low-risk
  // (no enrollments, no live content).
  const deleteNeedsTitleConfirm =
    confirmKind === "delete" && course !== null && course.status !== "draft";
  const deleteBlockedByPendingCerts =
    confirmKind === "delete" &&
    deleteImpact !== null &&
    deleteImpact.pendingCertificates > 0;
  const deleteBlockedByCompliance =
    confirmKind === "delete" &&
    deleteImpact !== null &&
    (deleteImpact.approvedCertificates > 0 ||
      deleteImpact.completedEnrollments > 0 ||
      deleteImpact.awardedPoints > 0);
  const deleteConfirmOk =
    confirmKind === "delete" &&
    course !== null &&
    !deleteBlockedByPendingCerts &&
    !deleteBlockedByCompliance &&
    (!deleteNeedsTitleConfirm ||
      deleteTypedTitle.trim() === (course.title || "").trim());
  const cancelConfirmOk =
    confirmKind === "cancel" && course !== null && cancelReason.trim().length >= 3;
  const cancelIsPostStart =
    confirmKind === "cancel" &&
    course?.startDate != null &&
    new Date(course.startDate).getTime() <= Date.now();
  const rescheduleReasonOk = rescheduleReason.trim().length >= 3;
  const rescheduleStartOk = (() => {
    if (!rescheduleNewStartDate) return false;
    const ts = new Date(rescheduleNewStartDate).getTime();
    if (Number.isNaN(ts)) return false;
    return ts >= Date.now();
  })();
  const rescheduleEndOk = (() => {
    if (!rescheduleNewEndDate) return true;
    const startT = new Date(rescheduleNewStartDate).getTime();
    const endT = new Date(rescheduleNewEndDate).getTime();
    if (Number.isNaN(endT)) return false;
    return endT >= startT;
  })();
  const rescheduleConfirmOk =
    confirmKind === "reschedule" &&
    course !== null &&
    rescheduleReasonOk &&
    rescheduleStartOk &&
    rescheduleEndOk;
  const rescheduleIsRevive =
    confirmKind === "reschedule" && course?.status === "cancelled";

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
      case "cancelled":
        return (
          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-[#FEE2E2] text-[#B91C1C]">
            {t("courseDetail.status.cancelled")}
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
    return formatDateHijri(dateStr, calendarFormat, { locale, platformSettings: platformLocale });
  };

  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  const isSelfPaced = course?.deliveryType === "self-paced";
  const isWebinarCourse = course?.deliveryType === "webinar";

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "overview", label: t("courseDetail.tabs.overview") },
    { id: "modules" as const, label: t("courseDetail.tabs.modules") },
    ...(!isSelfPaced && !isWebinarCourse ? [{ id: "sessions" as const, label: t("courseDetail.tabs.sessions") }] : []),
    { id: "assessments", label: t("courseDetail.tabs.assessments") },
    { id: "students", label: t("courseDetail.tabs.students") },
    { id: "team", label: t("courseDetail.tabs.team") },
    { id: "reviews", label: t("courseDetail.tabs.reviews") },
    { id: "analytics", label: t("courseDetail.tabs.analytics") },
    { id: "certificates", label: t("courseDetail.tabs.certificates") },
    { id: "audit", label: t("courseDetail.tabs.audit") },
    { id: "settings", label: t("courseDetail.tabs.settings") },
  ];

  return (
    <>
      {isAdmin ? (
        <AdminNavbar admin={admin} />
      ) : (
        <CourseManagerNavbar manager={manager} />
      )}

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              {isAdmin ? (
                <AdminSidebar admin={admin} />
              ) : (
                <CourseManagerSidebar manager={manager} />
              )}
            </div>

            {isAdmin ? (
              <AdminMobileSidebar admin={admin} />
            ) : (
              <CourseManagerMobileSidebar manager={manager} />
            )}

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
                  href={dashboardBase}
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
                        {course.status === "archived" && (
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
                          href={`${dashboardBase}/${course.id}/edit`}
                          className="inline-flex items-center gap-1.5 px-3 py-2 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                          {t("courseDetail.editCourse")}
                        </Link>
                        {/* Header Cancel button — statuses that make sense
                            to cancel. Rich Delete + Reschedule live in the
                            Danger Zone. Available to both admin and
                            manager (manager is scoped to their own
                            courses at the backend). */}
                        {(course.status === "active" ||
                          course.status === "pending_review" ||
                          course.status === "changes_requested") && (
                          <button
                            onClick={() => openAdminConfirm("cancel")}
                            className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#FCA5A5] text-[#DC2626] text-sm font-medium rounded-lg hover:bg-[#FEF2F2] transition-colors"
                          >
                            <Ban className="w-4 h-4" />
                            {tAdmin("coursesPage.cancelCourse")}
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
                  {course.accreditationNumber && (
                    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Award className="w-4 h-4 text-[#16A34A]" />
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          {isRTL ? "رقم الاعتماد" : "Accreditation #"}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-[var(--color-text-secondary)] break-all">
                        {course.accreditationNumber}
                      </p>
                    </div>
                  )}
                  {course.nelcReviewLink && (
                    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <ClipboardCheck className="w-4 h-4 text-[#7C3AED]" />
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          {isRTL ? "رابط تقييم NELC" : "NELC Review Link"}
                        </span>
                      </div>
                      <a
                        href={course.nelcReviewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-[var(--color-primary)] hover:underline break-all"
                        dir="ltr"
                      >
                        {course.nelcReviewLink}
                      </a>
                    </div>
                  )}
                </div>

                {/* Tabs */}
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                  <div className="flex border-b border-[var(--color-border)] overflow-x-auto" role="tablist">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        role="tab"
                        aria-selected={activeTab === tab.id}
                        className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap relative transition-colors ${
                          activeTab === tab.id ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                        }`}
                      >
                        {tab.label}
                        {activeTab === tab.id && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)]" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="p-5">
                    {/* ═══ OVERVIEW ═══ */}
                    {activeTab === "overview" && (
                      <div className="space-y-6">
                        {/* Description */}
                        <div>
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

                        {/* NELC Compliance Scorecard — always shown so managers can gauge readiness at any stage */}
                        <NELCScorecardPanel courseId={course.id} />

                        {/* Course Metadata */}
                        <div>
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
                      </div>
                    )}

                    {/* ═══ MODULES ═══ */}
                    {activeTab === "modules" && (
                      <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
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
                                                <button
                                                  type="button"
                                                  key={ma.id}
                                                  onClick={() => setPreviewAssessmentId(ma.id)}
                                                  className="w-full flex items-center gap-3 bg-[var(--color-surface-card)] rounded-lg border border-[var(--color-border)] px-3 py-2 hover:bg-[var(--color-border-subtle)] hover:border-[var(--color-primary)] transition-colors text-start"
                                                >
                                                  <ClipboardCheck className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
                                                  <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-[var(--color-text-primary)] truncate font-medium">{ma.title}</p>
                                                    <p className="text-xs text-[var(--color-text-secondary)]">
                                                      {ma.totalMarks} {t("courseDetail.marks") || "marks"}
                                                      {typeof ma.submissionCount === "number" && (
                                                        <>
                                                          {" · "}
                                                          {ma.submissionCount} {t("courseDetail.submissions") || "submissions"}
                                                        </>
                                                      )}
                                                    </p>
                                                  </div>
                                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                                    ma.type === "assignment" ? "bg-amber-50 text-amber-700" : ma.type === "exam" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"
                                                  }`}>
                                                    {ma.type}
                                                  </span>
                                                </button>
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
                    )}

                    {/* ═══ SESSIONS ═══ */}
                    {activeTab === "sessions" && !isSelfPaced && !isWebinarCourse && (
                      <div>
                        {sessionsLoading ? (
                          <div className="text-center py-8">
                            <Loader2 className="w-6 h-6 text-[var(--color-primary)] animate-spin mx-auto mb-2" />
                            <p className="text-sm text-[var(--color-text-secondary)]">{t("dashboard.loading")}</p>
                          </div>
                        ) : sessionsError ? (
                          <div className="text-center py-8">
                            <AlertTriangle className="w-10 h-10 text-[#D97706] mx-auto mb-3" />
                            <p className="text-sm text-[var(--color-text-secondary)]">{sessionsError}</p>
                          </div>
                        ) : sessions.length === 0 ? (
                          <div className="text-center py-8">
                            <Calendar className="w-10 h-10 text-[var(--color-text-secondary)] mx-auto mb-3" />
                            <p className="text-sm text-[var(--color-text-secondary)]">{t("courseDetail.sessionsEmpty")}</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-[var(--color-border)]">
                                  <th className="px-3 pb-3 text-start text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">{t("courseDetail.sessionDateColumn")}</th>
                                  <th className="px-3 pb-3 text-start text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">{t("courseDetail.sessionTitleColumn")}</th>
                                  <th className="px-3 pb-3 text-center text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider w-28">{t("courseDetail.columnStatusLabel")}</th>
                                  <th className="px-3 pb-3 text-center text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider w-28">{t("courseDetail.sessionAttendanceLabel")}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sessions.map((session) => (
                                  <tr key={session.id} className="border-b border-[#F3F4F6] hover:bg-[var(--color-border-subtle)]">
                                    <td className="px-3 py-3 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                                      {formatDate(session.scheduledAt)}
                                    </td>
                                    <td className="px-3 py-3 text-sm text-[var(--color-text-primary)]">{session.title}</td>
                                    <td className="px-3 py-3 text-center">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                        session.status === "completed" ? "bg-[#DCFCE7] text-[#16A34A]" :
                                        session.status === "live" ? "bg-[#FEF3C7] text-[#D97706]" :
                                        session.status === "cancelled" || session.status === "missed" ? "bg-[#FEE2E2] text-[#DC2626]" :
                                        "bg-[var(--color-border-subtle)] text-[var(--color-primary)]"
                                      }`}>
                                        {t(`courseDetail.sessionStatus.${session.status}`)}
                                      </span>
                                    </td>
                                    <td className="px-3 py-3 text-center text-sm text-[var(--color-text-secondary)]">
                                      {(session.status === "completed" || session.status === "ended")
                                        ? (attendanceCounts[session.id]
                                            ? `${attendanceCounts[session.id].attended} / ${attendanceCounts[session.id].total}`
                                            : "…")
                                        : "—"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ═══ ASSESSMENTS ═══ */}
                    {activeTab === "assessments" && (
                      <div className="space-y-2">
                        {moduleAssessments.length === 0 ? (
                          <div className="text-center py-8">
                            <ClipboardCheck className="w-10 h-10 text-[var(--color-text-secondary)] mx-auto mb-3" />
                            <p className="text-sm text-[var(--color-text-secondary)]">{t("courseDetail.assessmentsEmpty")}</p>
                          </div>
                        ) : (
                          moduleAssessments.map((ma) => {
                            const mod = course.modules?.find((m) => m.id === ma.moduleId);
                            return (
                              <button
                                type="button"
                                key={ma.id}
                                onClick={() => setPreviewAssessmentId(ma.id)}
                                className="w-full flex items-center gap-3 bg-[var(--color-surface-page)] rounded-lg border border-[var(--color-border)] px-4 py-3 hover:bg-[var(--color-border-subtle)] hover:border-[var(--color-primary)] transition-colors text-start"
                              >
                                <ClipboardCheck className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-[var(--color-text-primary)] truncate font-medium">{ma.title}</p>
                                  <p className="text-xs text-[var(--color-text-secondary)]">
                                    {t("courseDetail.assessmentModuleLabel")}: {mod?.title || t("courseDetail.assessmentNoModule")}
                                    {" · "}
                                    {ma.totalMarks} {t("courseDetail.marks")}
                                    {typeof ma.submissionCount === "number" && (
                                      <>
                                        {" · "}
                                        {ma.submissionCount} {t("courseDetail.submissions")}
                                      </>
                                    )}
                                  </p>
                                </div>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                                  ma.type === "assignment" ? "bg-amber-50 text-amber-700" : ma.type === "exam" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"
                                }`}>
                                  {ma.type}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}

                    {/* ═══ STUDENTS ═══ */}
                    {activeTab === "students" && (() => {
                      // Split enrolled vs removed rows so the removed
                      // audit is visible but doesn't clutter the active
                      // list. Backend now returns dropped rows too.
                      const activeAndCompleted = enrollments.filter(
                        (e) => e.status === "active" || e.status === "completed",
                      );
                      const removedRows = enrollments.filter((e) => e.status === "dropped");

                      const filtered = activeAndCompleted.filter((e) => {
                        if (!studentsSearch.trim()) return true;
                        const q = studentsSearch.trim().toLowerCase();
                        return (
                          `${e.studentFirstName} ${e.studentLastName}`.toLowerCase().includes(q) ||
                          e.studentEmail.toLowerCase().includes(q) ||
                          (e.studentScfhsNumber || "").toLowerCase().includes(q)
                        );
                      });
                      const totalPages = Math.max(1, Math.ceil(filtered.length / STUDENTS_PAGE_SIZE));
                      const page = Math.min(studentsPage, totalPages);
                      const paginated = filtered.slice((page - 1) * STUDENTS_PAGE_SIZE, page * STUDENTS_PAGE_SIZE);
                      return (
                        <div>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                            <div className="relative flex-1 max-w-sm">
                              <Search className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]`} />
                              <input
                                type="text"
                                value={studentsSearch}
                                onChange={(e) => { setStudentsSearch(e.target.value); setStudentsPage(1); }}
                                placeholder={t("courseDetail.studentsSearchPlaceholder")}
                                className={`w-full ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} py-2 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)] focus:border-transparent`}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={openAddStudent}
                              className="inline-flex items-center gap-1.5 px-3 py-2 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg transition-colors flex-shrink-0"
                            >
                              <UserPlus className="w-4 h-4" />
                              {t("courseDetail.students.addStudentBtn")}
                            </button>
                          </div>
                          {enrollmentsLoading ? (
                            <div className="text-center py-8">
                              <Loader2 className="w-6 h-6 text-[var(--color-primary)] animate-spin mx-auto mb-2" />
                              <p className="text-sm text-[var(--color-text-secondary)]">{t("dashboard.loading")}</p>
                            </div>
                          ) : enrollmentsError ? (
                            <div className="text-center py-8">
                              <AlertTriangle className="w-10 h-10 text-[#D97706] mx-auto mb-3" />
                              <p className="text-sm text-[var(--color-text-secondary)]">{enrollmentsError}</p>
                            </div>
                          ) : filtered.length === 0 && removedRows.length === 0 ? (
                            <div className="text-center py-8">
                              <Users className="w-10 h-10 text-[var(--color-text-secondary)] mx-auto mb-3" />
                              <p className="text-sm text-[var(--color-text-secondary)]">{t("courseDetail.enrollmentsEmpty")}</p>
                            </div>
                          ) : (
                            <>
                              {filtered.length > 0 && (
                                <div className="overflow-x-auto">
                                  <table className="w-full">
                                    <thead>
                                      <tr className="border-b border-[var(--color-border)]">
                                        <th className="px-3 pb-3 text-start text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">{t("courseDetail.columnStudent")}</th>
                                        <th className="px-3 pb-3 text-start text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">{t("courseDetail.columnScfhs")}</th>
                                        <th className="px-3 pb-3 text-start text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">{t("courseDetail.columnEnrolled")}</th>
                                        <th className="px-3 pb-3 text-start text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider w-32">{t("courseDetail.progress")}</th>
                                        <th className="px-3 pb-3 text-center text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider w-24">{t("courseDetail.columnStatusLabel")}</th>
                                        <th className="px-3 pb-3 text-end text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider w-24" />
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {paginated.map((enrollment) => (
                                        <tr key={enrollment.id} className="border-b border-[#F3F4F6] hover:bg-[var(--color-border-subtle)]">
                                          <td className="px-3 py-3">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                                                {enrollment.studentFirstName} {enrollment.studentLastName}
                                              </p>
                                              {enrollment.enrolledBy && (
                                                <span
                                                  title={enrollment.enrollmentReason || ""}
                                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
                                                >
                                                  <UserPlus className="w-2.5 h-2.5" />
                                                  {t("courseDetail.students.manuallyEnrolledChip")}
                                                </span>
                                              )}
                                            </div>
                                            <p className="text-[11px] text-[var(--color-text-secondary)]">{enrollment.studentEmail}</p>
                                          </td>
                                          <td className="px-3 py-3 text-xs text-[var(--color-text-secondary)]">{enrollment.studentScfhsNumber || "—"}</td>
                                          <td className="px-3 py-3 text-xs text-[var(--color-text-secondary)]">{formatDate(enrollment.enrolledAt)}</td>
                                          <td className="px-3 py-3">
                                            <div className="flex items-center gap-2">
                                              <div className="flex-1 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                                                <div
                                                  className={`h-full rounded-full ${
                                                    enrollment.progress >= 75 ? "bg-[#16A34A]" : enrollment.progress >= 50 ? "bg-[var(--color-primary)]" : enrollment.progress >= 25 ? "bg-[#F59E0B]" : "bg-[#DC2626]"
                                                  }`}
                                                  style={{ width: `${enrollment.progress}%` }}
                                                />
                                              </div>
                                              <span className="text-xs text-[var(--color-text-secondary)] w-8 text-end">{enrollment.progress}%</span>
                                            </div>
                                          </td>
                                          <td className="px-3 py-3 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                              enrollment.status === "active" ? "bg-[#DCFCE7] text-[#16A34A]" :
                                              enrollment.status === "completed" ? "bg-[var(--color-border-subtle)] text-[#1D4ED8]" :
                                              enrollment.status === "dropped" ? "bg-[#FEE2E2] text-[#DC2626]" :
                                              "bg-[#FEF3C7] text-[#D97706]"
                                            }`}>
                                              {t(`courseDetail.studentStatus.${enrollment.status}`)}
                                            </span>
                                          </td>
                                          <td className="px-3 py-3 text-end">
                                            <button
                                              type="button"
                                              onClick={() => openRemoveEnrollment(enrollment)}
                                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#DC2626] hover:bg-[#FEF2F2] rounded transition-colors"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                              {t("courseDetail.students.rowAction.remove")}
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  {totalPages > 1 && (
                                    <div className="flex items-center justify-between pt-4 mt-2 border-t border-[var(--color-border)]">
                                      <p className="text-xs text-[var(--color-text-secondary)]">
                                        {(page - 1) * STUDENTS_PAGE_SIZE + 1}–{Math.min(page * STUDENTS_PAGE_SIZE, filtered.length)} / {filtered.length}
                                      </p>
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() => setStudentsPage((p) => Math.max(1, p - 1))}
                                          disabled={page === 1}
                                          className="p-1.5 border border-[var(--color-border)] rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
                                        >
                                          <ChevronLeft className="w-3.5 h-3.5" />
                                        </button>
                                        <span className="text-xs text-[var(--color-text-secondary)] px-2">
                                          {page} / {totalPages}
                                        </span>
                                        <button
                                          onClick={() => setStudentsPage((p) => Math.min(totalPages, p + 1))}
                                          disabled={page === totalPages}
                                          className="p-1.5 border border-[var(--color-border)] rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
                                        >
                                          <ChevronRight className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Removed section — historical audit for
                                  finance/manager. Reason is the load-bearing
                                  detail; that's why finance decides refund. */}
                              {removedRows.length > 0 && (
                                <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
                                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                                    {t("courseDetail.students.removedSectionTitle")} ({removedRows.length})
                                  </h3>
                                  <div className="space-y-3">
                                    {removedRows.map((enrollment) => (
                                      <div
                                        key={enrollment.id}
                                        className="border border-[var(--color-border)] rounded-lg p-4 bg-[#FEF9F9]"
                                      >
                                        <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                                          <div>
                                            <p className="text-sm font-medium text-[var(--color-text-primary)]">
                                              {enrollment.studentFirstName} {enrollment.studentLastName}
                                            </p>
                                            <p className="text-[11px] text-[var(--color-text-secondary)]">
                                              {enrollment.studentEmail}
                                              {enrollment.studentScfhsNumber ? ` · ${enrollment.studentScfhsNumber}` : ""}
                                            </p>
                                          </div>
                                          {enrollment.removedAt && (
                                            <span className="text-[11px] text-[var(--color-text-secondary)]">
                                              {t("courseDetail.students.removedOnBy", { date: formatDate(enrollment.removedAt) })}
                                            </span>
                                          )}
                                        </div>
                                        {enrollment.removalReason && (
                                          <div className="mt-2">
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">
                                              {t("courseDetail.students.removalReasonLabel")}
                                            </p>
                                            <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
                                              {enrollment.removalReason}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })()}

                    {/* ═══ TEAM ═══ */}
                    {activeTab === "team" && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="border border-[var(--color-border)] rounded-lg p-4">
                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                              {t("courseDetail.instructorCardTitle")}
                            </h3>
                            <p className="text-sm font-medium text-[var(--color-text-primary)] mb-0.5">
                              {(course as { instructorName?: string | null }).instructorName || t("courseDetail.unknownUser")}
                            </p>
                            {(course as { instructorEmail?: string | null }).instructorEmail && (
                              <p className="text-xs text-[var(--color-text-secondary)] mb-4">
                                {(course as { instructorEmail?: string | null }).instructorEmail}
                              </p>
                            )}
                            <Link
                              href={`${dashboardBase}/${course.id}/edit`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
                            >
                              {t("courseDetail.reassignInstructor")}
                            </Link>
                          </div>

                          {(course as { managerName?: string | null }).managerName && (
                            <div className="border border-[var(--color-border)] rounded-lg p-4">
                              <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                                {t("courseDetail.managerCardTitle")}
                              </h3>
                              <p className="text-sm font-medium text-[var(--color-text-primary)] mb-0.5">
                                {(course as { managerName?: string | null }).managerName}
                              </p>
                              {(course as { managerEmail?: string | null }).managerEmail && (
                                <p className="text-xs text-[var(--color-text-secondary)]">
                                  {(course as { managerEmail?: string | null }).managerEmail}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {course.deliveryType !== "self-paced" && (course.status === "active" || course.status === "pending_review") && (
                          <CourseAssistantsManagePanel courseId={course.id} />
                        )}
                      </div>
                    )}

                    {/* ═══ REVIEWS ═══ */}
                    {activeTab === "reviews" && (
                      <div>
                        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                            {t("courseDetail.reviewsTitle")}
                          </h2>
                          {/* Course | Instructor switch */}
                          <div className="inline-flex p-1 bg-[var(--color-border-subtle)] rounded-lg">
                            {(
                              [
                                { key: "course" as const, label: isRTL ? "الدورة" : "Course" },
                                { key: "instructor" as const, label: isRTL ? "المدرب" : "Instructor" },
                              ]
                            ).map((seg) => (
                              <button
                                key={seg.key}
                                onClick={() => setReviewKind(seg.key)}
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                                  reviewKind === seg.key
                                    ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                                }`}
                              >
                                {seg.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center justify-end mb-4">
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
                                href={`${dashboardBase}/${courseId}/reviews`}
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)]"
                              >
                                {isRTL ? "عرض كل المراجعات" : "View all reviews"}
                                {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                              </Link>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* ═══ ANALYTICS ═══ */}
                    {activeTab === "analytics" && (
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-3">{t("courseDetail.tabs.students")}</h3>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                            <div className="p-4 bg-[var(--color-surface-page)] rounded-lg text-center">
                              <div className="w-10 h-10 mx-auto mb-2 bg-[var(--color-border-subtle)] rounded-lg flex items-center justify-center">
                                <Users className="w-5 h-5 text-[var(--color-primary)]" />
                              </div>
                              <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{analytics.total}</p>
                              <p className="text-xs text-[var(--color-text-secondary)]">{t("courseDetail.analyticsCards.totalStudents")}</p>
                            </div>
                            <div className="p-4 bg-[var(--color-surface-page)] rounded-lg text-center">
                              <div className="w-10 h-10 mx-auto mb-2 bg-[#DCFCE7] rounded-lg flex items-center justify-center">
                                <UserCheck className="w-5 h-5 text-[#16A34A]" />
                              </div>
                              <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{analytics.active}</p>
                              <p className="text-xs text-[var(--color-text-secondary)]">{t("courseDetail.analyticsCards.activeStudents")}</p>
                            </div>
                            <div className="p-4 bg-[var(--color-surface-page)] rounded-lg text-center">
                              <div className="w-10 h-10 mx-auto mb-2 bg-[var(--color-border-subtle)] rounded-lg flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-[var(--color-primary)]" />
                              </div>
                              <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{analytics.completed}</p>
                              <p className="text-xs text-[var(--color-text-secondary)]">{t("courseDetail.analyticsCards.completedStudents")}</p>
                            </div>
                            <div className="p-4 bg-[var(--color-surface-page)] rounded-lg text-center">
                              <div className="w-10 h-10 mx-auto mb-2 bg-[#FEE2E2] rounded-lg flex items-center justify-center">
                                <UserX className="w-5 h-5 text-[#DC2626]" />
                              </div>
                              <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{analytics.dropped}</p>
                              <p className="text-xs text-[var(--color-text-secondary)]">{t("courseDetail.analyticsCards.droppedStudents")}</p>
                            </div>
                            <div className="p-4 bg-[var(--color-surface-page)] rounded-lg text-center">
                              <div className="w-10 h-10 mx-auto mb-2 bg-[var(--color-border-subtle)] rounded-lg flex items-center justify-center">
                                <BarChart3 className="w-5 h-5 text-[var(--color-primary)]" />
                              </div>
                              <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{analytics.avgProgress}%</p>
                              <p className="text-xs text-[var(--color-text-secondary)]">{t("courseDetail.analyticsCards.avgProgress")}</p>
                            </div>
                          </div>
                        </div>

                        {sessionsFetched && (
                          <div>
                            <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-3">{t("courseDetail.tabs.sessions")}</h3>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="p-4 bg-[var(--color-surface-page)] rounded-lg text-center">
                                <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{analytics.totalSessions}</p>
                                <p className="text-xs text-[var(--color-text-secondary)]">{t("courseDetail.analyticsCards.totalSessions")}</p>
                              </div>
                              <div className="p-4 bg-[var(--color-surface-page)] rounded-lg text-center">
                                <p className="text-2xl font-bold text-[#16A34A]">{analytics.completedSessions}</p>
                                <p className="text-xs text-[var(--color-text-secondary)]">{t("courseDetail.analyticsCards.completedSessions")}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div>
                          <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-3">{t("courseDetail.reviewsTitle")}</h3>
                          <div className="p-4 bg-[var(--color-surface-page)] rounded-lg text-center max-w-xs">
                            <div className="flex items-center justify-center gap-1 mb-1">
                              <Star className="w-5 h-5 text-[var(--color-star)] fill-[var(--color-star)]" />
                              <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{analytics.avgRating.toFixed(1)}</p>
                            </div>
                            <p className="text-xs text-[var(--color-text-secondary)]">{t("courseDetail.analyticsCards.avgRating")}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ═══ CERTIFICATES ═══ */}
                    {activeTab === "certificates" && (() => {
                      const filtered =
                        certStatusFilter === "all"
                          ? certificates
                          : certificates.filter((c) => c.status === certStatusFilter);
                      const statusOptions = [
                        { value: "all", label: t("courseDetail.certificates.filter.all") },
                        { value: "pending", label: t("courseDetail.certificates.status.pending") },
                        { value: "approved", label: t("courseDetail.certificates.status.approved") },
                        { value: "rejected", label: t("courseDetail.certificates.status.rejected") },
                        { value: "held", label: t("courseDetail.certificates.status.held") },
                        { value: "revoked", label: t("courseDetail.certificates.status.revoked") },
                      ];
                      const badgeClass = (status: string) => {
                        switch (status) {
                          case "approved":
                            return "bg-[#DCFCE7] text-[#16A34A]";
                          case "pending":
                            return "bg-[#FEF3C7] text-[#D97706]";
                          case "rejected":
                          case "revoked":
                            return "bg-[#FEE2E2] text-[#DC2626]";
                          case "held":
                            return "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
                          default:
                            return "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
                        }
                      };
                      return (
                        <div>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                            <Select
                              value={certStatusFilter}
                              onChange={setCertStatusFilter}
                              options={statusOptions}
                              className="w-48"
                              size="sm"
                            />
                            <p className="text-xs text-[var(--color-text-secondary)]">
                              {t("courseDetail.certificates.total", { count: filtered.length })}
                            </p>
                          </div>

                          {certificatesLoading ? (
                            <div className="text-center py-8">
                              <Loader2 className="w-6 h-6 text-[var(--color-primary)] animate-spin mx-auto mb-2" />
                              <p className="text-sm text-[var(--color-text-secondary)]">{t("dashboard.loading")}</p>
                            </div>
                          ) : certificatesError ? (
                            <div className="text-center py-8">
                              <AlertTriangle className="w-10 h-10 text-[#D97706] mx-auto mb-3" />
                              <p className="text-sm text-[var(--color-text-secondary)]">{certificatesError}</p>
                            </div>
                          ) : filtered.length === 0 ? (
                            <div className="text-center py-12">
                              <Award className="w-10 h-10 text-[var(--color-text-secondary)] mx-auto mb-3" />
                              <p className="text-sm text-[var(--color-text-secondary)]">
                                {t("courseDetail.certificates.empty")}
                              </p>
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead>
                                  <tr className="border-b border-[var(--color-border)]">
                                    <th className="px-3 pb-3 text-start text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                                      {t("courseDetail.columnStudent")}
                                    </th>
                                    <th className="px-3 pb-3 text-start text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider w-32">
                                      {t("courseDetail.certificates.column.attendance")}
                                    </th>
                                    <th className="px-3 pb-3 text-start text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider w-28">
                                      {t("courseDetail.certificates.column.assessment")}
                                    </th>
                                    <th className="px-3 pb-3 text-start text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider w-32">
                                      {t("courseDetail.certificates.column.requested")}
                                    </th>
                                    <th className="px-3 pb-3 text-center text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider w-24">
                                      {t("courseDetail.columnStatusLabel")}
                                    </th>
                                    <th className="px-3 pb-3 text-end text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider" />
                                  </tr>
                                </thead>
                                <tbody>
                                  {filtered.map((cert) => (
                                    <tr
                                      key={cert.id}
                                      className="border-b border-[#F3F4F6] hover:bg-[var(--color-border-subtle)] align-top"
                                    >
                                      <td className="px-3 py-3">
                                        <p className="text-sm font-medium text-[var(--color-text-primary)]">
                                          {cert.studentFirstName} {cert.studentLastName}
                                        </p>
                                        <p className="text-[11px] text-[var(--color-text-secondary)]">{cert.studentEmail}</p>
                                        {cert.status === "rejected" && cert.rejectionReason && (
                                          <p className="text-[11px] text-[#DC2626] mt-1">
                                            <strong>{t("courseDetail.certificates.rejectedReasonLabel")}:</strong> {cert.rejectionReason}
                                          </p>
                                        )}
                                      </td>
                                      <td className="px-3 py-3 text-xs text-[var(--color-text-secondary)]">
                                        {cert.attendancePercent ? `${cert.attendancePercent}%` : "—"}
                                      </td>
                                      <td className="px-3 py-3 text-xs">
                                        {cert.assessmentPassed === true ? (
                                          <span className="text-[#16A34A]">{t("courseDetail.certificates.assessmentPassed")}</span>
                                        ) : cert.assessmentPassed === false ? (
                                          <span className="text-[#DC2626]">{t("courseDetail.certificates.assessmentFailed")}</span>
                                        ) : (
                                          <span className="text-[var(--color-text-secondary)]">—</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-3 text-xs text-[var(--color-text-secondary)]">
                                        {formatDate(cert.createdAt)}
                                      </td>
                                      <td className="px-3 py-3 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${badgeClass(cert.status)}`}>
                                          {t(`courseDetail.certificates.status.${cert.status}`)}
                                        </span>
                                      </td>
                                      <td className="px-3 py-3 text-end whitespace-nowrap">
                                        {cert.status === "pending" && (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() => openCertAction(cert, "approve")}
                                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#16A34A] hover:bg-[#F0FDF4] rounded transition-colors me-1"
                                            >
                                              <CheckCircle className="w-3 h-3" />
                                              {t("courseDetail.certificates.action.approve")}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => openCertAction(cert, "reject")}
                                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#DC2626] hover:bg-[#FEF2F2] rounded transition-colors me-1"
                                            >
                                              <UserX className="w-3 h-3" />
                                              {t("courseDetail.certificates.action.reject")}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => openCertAction(cert, "hold")}
                                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#D97706] hover:bg-[#FFFBEB] rounded transition-colors"
                                            >
                                              <AlertTriangle className="w-3 h-3" />
                                              {t("courseDetail.certificates.action.hold")}
                                            </button>
                                          </>
                                        )}
                                        {cert.status === "approved" && (
                                          <>
                                            {cert.certificateUrl && (
                                              <a
                                                href={cert.certificateUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-border-subtle)] rounded transition-colors me-1"
                                              >
                                                <Eye className="w-3 h-3" />
                                                {t("courseDetail.certificates.action.view")}
                                              </a>
                                            )}
                                            <button
                                              type="button"
                                              onClick={() => openCertAction(cert, "revoke")}
                                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#DC2626] hover:bg-[#FEF2F2] rounded transition-colors"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                              {t("courseDetail.certificates.action.revoke")}
                                            </button>
                                          </>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* ═══ AUDIT ═══ */}
                    {activeTab === "audit" && (
                      <div>
                        {auditLoading ? (
                          <div className="text-center py-8">
                            <Loader2 className="w-6 h-6 text-[var(--color-primary)] animate-spin mx-auto mb-2" />
                            <p className="text-sm text-[var(--color-text-secondary)]">{t("dashboard.loading")}</p>
                          </div>
                        ) : auditError ? (
                          <div className="text-center py-8">
                            <AlertTriangle className="w-10 h-10 text-[#D97706] mx-auto mb-3" />
                            <p className="text-sm text-[var(--color-text-secondary)]">{auditError}</p>
                          </div>
                        ) : auditLogs.length === 0 ? (
                          <div className="text-center py-12">
                            <History className="w-10 h-10 text-[var(--color-text-secondary)] mx-auto mb-3" />
                            <p className="text-sm text-[var(--color-text-secondary)]">
                              {t("courseDetail.audit.emptyState")}
                            </p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-[var(--color-border)]">
                                  <th className="px-3 pb-3 text-start text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider w-48">
                                    {t("courseDetail.audit.whenColumn")}
                                  </th>
                                  <th className="px-3 pb-3 text-start text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                                    {t("courseDetail.audit.whoColumn")}
                                  </th>
                                  <th className="px-3 pb-3 text-start text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                                    {t("courseDetail.audit.actionColumn")}
                                  </th>
                                  <th className="px-3 pb-3 text-start text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                                    {t("courseDetail.audit.detailsColumn")}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {auditLogs.map((row) => {
                                  const performerName = [row.performerFirstName, row.performerLastName]
                                    .filter(Boolean)
                                    .join(" ");
                                  // Try translated action label first; fall back to raw action key.
                                  const actionKey = `courseDetail.audit.actions.${row.action}`;
                                  const actionLabel = (() => {
                                    try {
                                      const translated = t(actionKey as Parameters<typeof t>[0]);
                                      // next-intl returns the key back when missing
                                      return translated === actionKey ? row.action : translated;
                                    } catch {
                                      return row.action;
                                    }
                                  })();
                                  // Metadata preview — render up to 3 key: value pairs inline.
                                  const metadataPreview = row.metadata
                                    ? Object.entries(row.metadata)
                                        .filter(([, v]) => v !== null && v !== undefined && v !== "")
                                        .slice(0, 4)
                                        .map(
                                          ([k, v]) =>
                                            `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`,
                                        )
                                        .join(" · ")
                                    : "";
                                  return (
                                    <tr key={row.id} className="border-b border-[#F3F4F6] hover:bg-[var(--color-border-subtle)] align-top">
                                      <td className="px-3 py-3 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                                        {formatDate(row.createdAt)}
                                      </td>
                                      <td className="px-3 py-3">
                                        <p className="text-sm text-[var(--color-text-primary)]">
                                          {performerName || row.performerEmail || row.performedBy || "—"}
                                        </p>
                                        {performerName && row.performerEmail && (
                                          <p className="text-[11px] text-[var(--color-text-secondary)]">
                                            {row.performerEmail}
                                          </p>
                                        )}
                                      </td>
                                      <td className="px-3 py-3 text-sm text-[var(--color-text-primary)]">
                                        {actionLabel}
                                      </td>
                                      <td className="px-3 py-3 text-xs text-[var(--color-text-secondary)] break-words max-w-md">
                                        {metadataPreview || "—"}
                                        {row.ipAddress && (
                                          <span className="block text-[10px] text-[var(--color-text-secondary)] mt-1 font-mono">
                                            IP: {row.ipAddress}
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ═══ SETTINGS ═══ */}
                    {activeTab === "settings" && (
                      <div className="space-y-6">
                        <div className="border border-[var(--color-border)] rounded-lg p-5">
                          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">{t("courseDetail.editCourseCta")}</h3>
                          <p className="text-sm text-[var(--color-text-secondary)] mb-4">{t("courseDetail.editCourseDesc")}</p>
                          <Link
                            href={`${dashboardBase}/${course.id}/edit`}
                            className="inline-flex items-center gap-1.5 px-4 py-2 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                            {t("courseDetail.editCourseCta")}
                          </Link>
                        </div>

                        <div className="border border-[#FCA5A5] rounded-lg p-5">
                          <h3 className="text-sm font-semibold text-[#DC2626] mb-1">{t("courseDetail.dangerZone")}</h3>
                          <p className="text-sm text-[var(--color-text-secondary)] mb-4">{t("courseDetail.dangerZoneDesc")}</p>
                          <div className="flex flex-wrap items-center gap-3">
                            {/* Danger Zone — same buttons for admin AND
                                manager. Manager parity confirmed by Amna
                                2026-07-26. Backend enforces manager-scope
                                (managers can only touch their own courses)
                                and Phase B status rules (delete requires
                                draft or cancelled; cancel requires an
                                active/pending status). Modal blockers
                                (pending certs, NELC compliance) prevent
                                any submit that would 400. */}

                            {/* Cancel — statuses that can still be cancelled */}
                            {(course.status === "active" ||
                              course.status === "pending_review" ||
                              course.status === "changes_requested") && (
                              <button
                                onClick={() => openAdminConfirm("cancel")}
                                className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#FCA5A5] text-[#DC2626] text-sm font-medium rounded-lg hover:bg-[#FEF2F2] transition-colors"
                              >
                                <Ban className="w-4 h-4" />
                                {tAdmin("coursesPage.cancelCourse")}
                              </button>
                            )}

                            {/* Reschedule — cancelled (revive) or active (shift dates) */}
                            {(course.status === "cancelled" ||
                              course.status === "active") && (
                              <button
                                onClick={() => openAdminConfirm("reschedule")}
                                className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#BFDBFE] text-[#1E40AF] text-sm font-medium rounded-lg hover:bg-[#EFF6FF] transition-colors"
                              >
                                <CalendarClock className="w-4 h-4" />
                                {tAdmin("coursesPage.actions.reschedule")}
                              </button>
                            )}

                            {/* Archive — active or completed (moves out of
                                catalog while preserving compliance rows) */}
                            {(course.status === "active" ||
                              course.status === "completed") && (
                              <button
                                onClick={handleDeactivate}
                                disabled={updatingStatus}
                                className="inline-flex items-center gap-1.5 px-3 py-2 border border-[var(--color-border)] text-[var(--color-text-secondary)] text-sm font-medium rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors disabled:opacity-50"
                              >
                                <Archive className="w-4 h-4" />
                                {t("courseDetail.archive")}
                              </button>
                            )}

                            {/* Activate — bring an archived course back */}
                            {course.status === "archived" && (
                              <button
                                onClick={handleActivate}
                                disabled={updatingStatus}
                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#16A34A] text-white text-sm font-medium rounded-lg hover:bg-[#15803D] transition-colors disabled:opacity-50"
                              >
                                <Play className="w-4 h-4" />
                                {t("courseDetail.activate")}
                              </button>
                            )}

                            {/* Delete — hidden for active (must Cancel
                                first) AND for completed (backend blocks;
                                students earned outcomes — archive only). */}
                            {course.status !== "active" &&
                              course.status !== "completed" && (
                                <button
                                  onClick={() => openAdminConfirm("delete")}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#FCA5A5] text-[#DC2626] text-sm font-medium rounded-lg hover:bg-[#FEF2F2] transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  {tAdmin("coursesPage.actions.delete")}
                                </button>
                              )}
                          </div>

                          {/* Explain to the user why Delete is missing on
                              completed — students earned CME / certificates
                              and those records must be preserved. */}
                          {course.status === "completed" && (
                            <p className="mt-3 text-xs text-[var(--color-text-secondary)] leading-relaxed">
                              {t("courseDetail.completedCannotDelete")}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
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

      {previewAssessmentId && (
        <AssessmentPreviewDrawer
          assessmentId={previewAssessmentId}
          courseId={courseId}
          open
          onClose={() => setPreviewAssessmentId(null)}
          submissionsHrefBase={`/${locale}/dashboard/${role === "admin" ? "admin" : "manager"}/courses/${courseId}/assessments`}
        />
      )}

      {/* Add Student Modal — searchable picker + mandatory reason */}
      {addStudentOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--color-surface-card)] rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--color-border-subtle)] flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-[var(--color-primary)]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    {t("courseDetail.students.addStudentTitle")}
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t("courseDetail.students.addStudentSubtitle")}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAddStudentOpen(false)}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative mb-3">
              <Search className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]`} />
              <input
                type="text"
                value={studentPickerQuery}
                onChange={(e) => setStudentPickerQuery(e.target.value)}
                placeholder={t("courseDetail.students.searchPlaceholder")}
                className={`w-full ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} py-2 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)] focus:border-transparent`}
                autoFocus
              />
            </div>

            <div className="border border-[var(--color-border)] rounded-lg max-h-56 overflow-y-auto mb-4">
              {studentPickerLoading ? (
                <div className="text-center py-6">
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--color-text-secondary)] mx-auto" />
                </div>
              ) : studentPickerResults.length === 0 ? (
                <p className="text-center py-6 text-sm text-[var(--color-text-secondary)]">
                  {t("courseDetail.students.noResults")}
                </p>
              ) : (
                <ul className="divide-y divide-[var(--color-border-subtle)]">
                  {studentPickerResults.map((s) => {
                    const isSelected = selectedStudent?.id === s.id;
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedStudent(s)}
                          className={`w-full text-start px-3 py-2 hover:bg-[var(--color-border-subtle)] transition-colors ${isSelected ? "bg-[var(--color-border-subtle)]" : ""}`}
                        >
                          <p className="text-sm font-medium text-[var(--color-text-primary)]">
                            {[s.firstName, s.lastName].filter(Boolean).join(" ") || s.email}
                          </p>
                          <p className="text-[11px] text-[var(--color-text-secondary)]">
                            {s.email}{s.scfhsNumber ? ` · ${s.scfhsNumber}` : ""}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              {t("courseDetail.students.reasonLabel")}
            </label>
            <textarea
              value={manualEnrollReason}
              onChange={(e) => setManualEnrollReason(e.target.value)}
              placeholder={t("courseDetail.students.reasonPlaceholder")}
              maxLength={500}
              rows={3}
              className="w-full border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)]"
            />
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-1 text-end">
              {manualEnrollReason.length}/500
            </p>

            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                onClick={() => setAddStudentOpen(false)}
                className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)]"
              >
                {t("courseDetail.students.cancel")}
              </button>
              <button
                onClick={submitManualEnroll}
                disabled={
                  manualEnrollSubmitting ||
                  !selectedStudent ||
                  manualEnrollReason.trim().length < 3
                }
                className="px-4 py-2 text-sm font-medium btn-gold text-[var(--color-button-text)] rounded-lg disabled:opacity-50 inline-flex items-center gap-2"
              >
                {manualEnrollSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("courseDetail.students.addBtn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Certificate Action Modal — approve is one-click; reject/hold/revoke require a note */}
      {certActionRow && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--color-surface-card)] rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    certActionRow.action === "approve"
                      ? "bg-[#DCFCE7]"
                      : certActionRow.action === "hold"
                        ? "bg-[#FEF3C7]"
                        : "bg-[#FEE2E2]"
                  }`}
                >
                  <Award
                    className={`w-5 h-5 ${
                      certActionRow.action === "approve"
                        ? "text-[#16A34A]"
                        : certActionRow.action === "hold"
                          ? "text-[#D97706]"
                          : "text-[#DC2626]"
                    }`}
                  />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    {t(`courseDetail.certificates.modal.${certActionRow.action}Title`)}
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {certActionRow.row.studentFirstName} {certActionRow.row.studentLastName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCertActionRow(null)}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {certActionRow.action !== "approve" ? (
              <>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                  {t("courseDetail.certificates.modal.reasonLabel")}
                </label>
                <textarea
                  value={certActionNote}
                  onChange={(e) => setCertActionNote(e.target.value)}
                  placeholder={t(`courseDetail.certificates.modal.${certActionRow.action}Placeholder`)}
                  maxLength={500}
                  rows={4}
                  className="w-full border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)]"
                  autoFocus
                />
                <p className="text-[11px] text-[var(--color-text-secondary)] mt-1 text-end">
                  {certActionNote.length}/500
                </p>
              </>
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]">
                {t("courseDetail.certificates.modal.approveConfirm")}
              </p>
            )}

            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                onClick={() => setCertActionRow(null)}
                className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)]"
              >
                {t("courseDetail.students.cancel")}
              </button>
              <button
                onClick={submitCertAction}
                disabled={
                  certActionSubmitting ||
                  (certActionRow.action !== "approve" && certActionNote.trim().length < 3)
                }
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 inline-flex items-center gap-2 ${
                  certActionRow.action === "approve"
                    ? "bg-[#16A34A] hover:bg-[#15803D]"
                    : certActionRow.action === "hold"
                      ? "bg-[#D97706] hover:bg-[#B45309]"
                      : "bg-[#DC2626] hover:bg-[#B91C1C]"
                }`}
              >
                {certActionSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {t(`courseDetail.certificates.modal.${certActionRow.action}Confirm`)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Enrollment Modal — mandatory reason; finance decides refund */}
      {removeEnrollment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--color-surface-card)] rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FEE2E2] flex items-center justify-center">
                  <UserX className="w-5 h-5 text-[#DC2626]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    {t("courseDetail.students.removeTitle")}
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {t("courseDetail.students.removeSubtitle", {
                      name: `${removeEnrollment.studentFirstName} ${removeEnrollment.studentLastName}`.trim(),
                    })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRemoveEnrollment(null)}
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              {t("courseDetail.students.removeReasonLabel")}
            </label>
            <textarea
              value={removeEnrollReason}
              onChange={(e) => setRemoveEnrollReason(e.target.value)}
              placeholder={t("courseDetail.students.removeReasonPlaceholder")}
              maxLength={500}
              rows={4}
              className="w-full border border-[var(--color-input-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)]"
            />
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-1 text-end">
              {removeEnrollReason.length}/500
            </p>
            <p className="mt-3 text-xs text-[var(--color-text-secondary)] p-2 bg-[var(--color-border-subtle)] rounded">
              {t("courseDetail.students.removeFinanceNote")}
            </p>

            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                onClick={() => setRemoveEnrollment(null)}
                className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)]"
              >
                {t("courseDetail.students.cancel")}
              </button>
              <button
                onClick={submitRemoveEnrollment}
                disabled={removeEnrollSubmitting || removeEnrollReason.trim().length < 3}
                className="px-4 py-2 text-sm font-medium text-white bg-[#DC2626] hover:bg-[#B91C1C] rounded-lg disabled:opacity-50 inline-flex items-center gap-2"
              >
                {removeEnrollSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {t("courseDetail.students.removeBtn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Unified destructive-action modal ═══════════════════════
          Kind ∈ {delete, cancel, reschedule}. Ported from the admin
          list-page modal — impact preview, refund + compliance blockers,
          mandatory reasons, type-to-confirm for non-draft delete, date
          pickers for reschedule. Available to both admin AND manager
          (backend enforces manager-scope + Phase B rules). */}
      {confirmKind && course && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={closeAdminConfirm}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg"
          >
            <button
              type="button"
              onClick={closeAdminConfirm}
              aria-label="Close"
              className="absolute -top-3 -right-3 w-8 h-8 bg-[var(--color-surface-card)] rounded-full shadow flex items-center justify-center hover:bg-[var(--color-border-subtle)] transition-colors z-10"
            >
              <X className="w-4 h-4 text-[var(--color-text-secondary)]" />
            </button>

            <div className="bg-[var(--color-surface-card)] rounded-xl shadow-xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                {confirmKind === "cancel"
                  ? tAdmin("coursesPage.confirmCancel.title")
                  : confirmKind === "reschedule"
                    ? tAdmin(
                        rescheduleIsRevive
                          ? "coursesPage.confirmReschedule.titleRevive"
                          : "coursesPage.confirmReschedule.titleShift",
                      )
                    : tAdmin("coursesPage.confirmDelete.title")}
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                {confirmKind === "cancel"
                  ? tAdmin(
                      cancelIsPostStart
                        ? "coursesPage.confirmCancel.bodyPostStart"
                        : "coursesPage.confirmCancel.bodyPreStart",
                      {
                        title:
                          locale === "ar" && course.titleAr
                            ? course.titleAr
                            : course.title,
                      },
                    )
                  : confirmKind === "reschedule"
                    ? tAdmin(
                        rescheduleIsRevive
                          ? "coursesPage.confirmReschedule.bodyRevive"
                          : "coursesPage.confirmReschedule.bodyShift",
                        {
                          title:
                            locale === "ar" && course.titleAr
                              ? course.titleAr
                              : course.title,
                        },
                      )
                    : tAdmin("coursesPage.confirmDelete.body", {
                        title:
                          locale === "ar" && course.titleAr
                            ? course.titleAr
                            : course.title,
                      })}
              </p>

              {confirmKind === "delete" && (
                <>
                  <div className="bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-lg p-3 mb-4">
                    <p className="text-xs font-medium text-[var(--color-text-primary)] mb-2">
                      {tAdmin("coursesPage.confirmDelete.impactTitle")}
                    </p>
                    {deleteImpactLoading && (
                      <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {tAdmin("coursesPage.confirmDelete.impactLoading")}
                      </div>
                    )}
                    {deleteImpactError && (
                      <p className="text-xs text-[#DC2626]">{deleteImpactError}</p>
                    )}
                    {deleteImpact && (
                      <ul className="grid grid-cols-2 gap-1 text-xs text-[var(--color-text-secondary)]">
                        <li>
                          <span className="font-mono text-[var(--color-text-primary)]">{deleteImpact.modules}</span>{" "}
                          {tAdmin("coursesPage.confirmDelete.impactModules")}
                        </li>
                        <li>
                          <span className="font-mono text-[var(--color-text-primary)]">{deleteImpact.materials}</span>{" "}
                          {tAdmin("coursesPage.confirmDelete.impactMaterials")}
                        </li>
                        <li>
                          <span className="font-mono text-[var(--color-text-primary)]">{deleteImpact.enrollments}</span>{" "}
                          {tAdmin("coursesPage.confirmDelete.impactEnrollments")}
                        </li>
                        <li>
                          <span className="font-mono text-[var(--color-text-primary)]">{deleteImpact.sessions}</span>{" "}
                          {tAdmin("coursesPage.confirmDelete.impactSessions")}
                        </li>
                        <li>
                          <span className="font-mono text-[var(--color-text-primary)]">{deleteImpact.upcomingSessions}</span>{" "}
                          {tAdmin("coursesPage.confirmDelete.impactUpcomingSessions")}
                        </li>
                        <li>
                          <span className="font-mono text-[var(--color-text-primary)]">{deleteImpact.assessments}</span>{" "}
                          {tAdmin("coursesPage.confirmDelete.impactAssessments")}
                        </li>
                      </ul>
                    )}
                  </div>

                  {deleteBlockedByPendingCerts && deleteImpact && (
                    <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-lg p-3 mb-4 flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-[#DC2626] mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-[#991B1B] leading-relaxed">
                        {tAdmin("coursesPage.confirmDelete.pendingCertsBlocker", {
                          count: deleteImpact.pendingCertificates,
                        })}
                      </p>
                    </div>
                  )}

                  {deleteBlockedByCompliance && deleteImpact && (
                    <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-lg p-3 mb-4">
                      <div className="flex items-start gap-2 mb-2">
                        <XCircle className="w-4 h-4 text-[#DC2626] mt-0.5 flex-shrink-0" />
                        <p className="text-xs font-semibold text-[#991B1B] leading-relaxed">
                          {tAdmin("coursesPage.confirmDelete.complianceBlockerTitle")}
                        </p>
                      </div>
                      <ul className="ms-6 space-y-0.5 text-xs text-[#991B1B] leading-relaxed">
                        {deleteImpact.approvedCertificates > 0 && (
                          <li>
                            · {tAdmin("coursesPage.confirmDelete.complianceIssuedCerts", {
                              count: deleteImpact.approvedCertificates,
                            })}
                          </li>
                        )}
                        {deleteImpact.completedEnrollments > 0 && (
                          <li>
                            · {tAdmin("coursesPage.confirmDelete.complianceCompletions", {
                              count: deleteImpact.completedEnrollments,
                            })}
                          </li>
                        )}
                        {deleteImpact.awardedPoints > 0 && (
                          <li>
                            · {tAdmin("coursesPage.confirmDelete.complianceAwardedPoints", {
                              count: deleteImpact.awardedPoints,
                            })}
                          </li>
                        )}
                      </ul>
                      <p className="mt-2 text-xs text-[#991B1B] leading-relaxed">
                        {tAdmin("coursesPage.confirmDelete.complianceBlockerCta")}
                      </p>
                    </div>
                  )}

                  {!deleteBlockedByPendingCerts && (
                    <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-3 mb-4">
                      <p className="text-xs text-[#1E40AF] leading-relaxed">
                        {tAdmin("coursesPage.confirmDelete.softDeleteNote")}
                      </p>
                    </div>
                  )}

                  {!deleteBlockedByPendingCerts &&
                    deleteImpact &&
                    deleteImpact.upcomingSessions > 0 && (
                      <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-3 mb-4 flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-[#D97706] mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-[#92400E] leading-relaxed">
                          {tAdmin("coursesPage.confirmDelete.upcomingSessionsWarning", {
                            count: deleteImpact.upcomingSessions,
                          })}
                        </p>
                      </div>
                    )}

                  <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                    {tAdmin("coursesPage.confirmDelete.reasonLabel")}
                  </label>
                  <input
                    type="text"
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    placeholder={tAdmin("coursesPage.confirmDelete.reasonPlaceholder")}
                    disabled={confirmBusy}
                    className="w-full px-3 h-10 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-card)] text-[var(--color-text-primary)] mb-4 disabled:opacity-50"
                  />

                  {deleteNeedsTitleConfirm && (
                    <>
                      <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                        {tAdmin("coursesPage.confirmDelete.typeToConfirmLabel", {
                          title: course.title,
                        })}
                      </label>
                      <input
                        type="text"
                        value={deleteTypedTitle}
                        onChange={(e) => setDeleteTypedTitle(e.target.value)}
                        placeholder={course.title}
                        disabled={confirmBusy}
                        className="w-full px-3 h-10 text-sm font-mono border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-card)] text-[var(--color-text-primary)] mb-4 disabled:opacity-50"
                      />
                    </>
                  )}
                </>
              )}

              {confirmKind === "cancel" && (
                <>
                  <div className="bg-[var(--color-surface-page)] border border-[var(--color-border)] rounded-lg p-3 mb-4">
                    <p className="text-xs font-medium text-[var(--color-text-primary)] mb-2">
                      {tAdmin("coursesPage.confirmCancel.impactTitle")}
                    </p>
                    {deleteImpactLoading && (
                      <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {tAdmin("coursesPage.confirmDelete.impactLoading")}
                      </div>
                    )}
                    {deleteImpactError && (
                      <p className="text-xs text-[#DC2626]">{deleteImpactError}</p>
                    )}
                    {deleteImpact && (
                      <ul className="space-y-1 text-xs text-[var(--color-text-secondary)]">
                        <li className="flex items-start gap-2">
                          <span className="font-mono text-[var(--color-text-primary)] shrink-0">
                            {deleteImpact.enrollments}
                          </span>
                          <span>{tAdmin("coursesPage.confirmCancel.impactEnrollments")}</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="font-mono text-[var(--color-text-primary)] shrink-0">
                            {deleteImpact.upcomingSessions}
                          </span>
                          <span>{tAdmin("coursesPage.confirmCancel.impactSessions")}</span>
                        </li>
                      </ul>
                    )}
                  </div>

                  {!cancelIsPostStart ? (
                    <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-3 mb-4">
                      <ul className="space-y-1 text-xs text-[#1E3A8A] leading-relaxed">
                        {deleteImpact && deleteImpact.paidPayments > 0 && (
                          <li>
                            · {tAdmin("coursesPage.confirmCancel.impactRefundsQueued", {
                              count: deleteImpact.paidPayments,
                            })}
                          </li>
                        )}
                        <li>· {tAdmin("coursesPage.confirmCancel.impactWaitlist")}</li>
                        <li>· {tAdmin("coursesPage.confirmCancel.impactCoupons")}</li>
                      </ul>
                    </div>
                  ) : (
                    <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-3 mb-4">
                      <ul className="space-y-1 text-xs text-[#78350F] leading-relaxed">
                        <li>· {tAdmin("coursesPage.confirmCancel.impactAttendance")}</li>
                        <li>· {tAdmin("coursesPage.confirmCancel.impactCerts")}</li>
                        <li>· {tAdmin("coursesPage.confirmCancel.impactPoints")}</li>
                        {deleteImpact && deleteImpact.paidPayments > 0 && (
                          <li>
                            · {tAdmin("coursesPage.confirmCancel.impactRefundsQueued", {
                              count: deleteImpact.paidPayments,
                            })}
                          </li>
                        )}
                        <li>· {tAdmin("coursesPage.confirmCancel.impactWaitlist")}</li>
                      </ul>
                    </div>
                  )}

                  {deleteImpact && deleteImpact.bankTransferPaidPayments > 0 && (
                    <div className="bg-[#FEF2F2] border-2 border-[#FCA5A5] rounded-lg p-3 mb-4">
                      <p className="text-xs font-bold text-[#991B1B] leading-relaxed mb-1">
                        {tAdmin("coursesPage.confirmCancel.bankTransferWarningTitle", {
                          count: deleteImpact.bankTransferPaidPayments,
                        })}
                      </p>
                      <p className="text-xs text-[#7F1D1D] leading-relaxed">
                        {tAdmin("coursesPage.confirmCancel.bankTransferWarningBody")}
                      </p>
                    </div>
                  )}

                  <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                    {tAdmin("coursesPage.confirmCancel.reasonLabel")}
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder={tAdmin("coursesPage.confirmCancel.reasonPlaceholder")}
                    disabled={confirmBusy}
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-card)] text-[var(--color-text-primary)] mb-4 disabled:opacity-50 resize-none"
                  />
                  {cancelReason.trim().length > 0 && cancelReason.trim().length < 3 && (
                    <p className="text-xs text-[#DC2626] mb-2">
                      {tAdmin("coursesPage.confirmCancel.reasonRequired")}
                    </p>
                  )}
                </>
              )}

              {confirmKind === "reschedule" && (
                <>
                  {rescheduleIsRevive && (
                    <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-3 mb-4">
                      <ul className="space-y-1 text-xs text-[#78350F] leading-relaxed">
                        <li>· {tAdmin("coursesPage.confirmReschedule.reviveImpactEnrollments")}</li>
                        <li>· {tAdmin("coursesPage.confirmReschedule.reviveImpactRefunds")}</li>
                        <li>· {tAdmin("coursesPage.confirmReschedule.reviveImpactCerts")}</li>
                        <li>· {tAdmin("coursesPage.confirmReschedule.reviveImpactNotify")}</li>
                      </ul>
                    </div>
                  )}

                  {!rescheduleIsRevive && (
                    <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-3 mb-4">
                      <ul className="space-y-1 text-xs text-[#1E3A8A] leading-relaxed">
                        <li>· {tAdmin("coursesPage.confirmReschedule.shiftImpactSessions")}</li>
                        <li>· {tAdmin("coursesPage.confirmReschedule.shiftImpactZoom")}</li>
                        <li>· {tAdmin("coursesPage.confirmReschedule.shiftImpactNotify")}</li>
                      </ul>
                    </div>
                  )}

                  {course.startDate && (
                    <p className="text-xs text-[var(--color-text-secondary)] mb-3">
                      {tAdmin("coursesPage.confirmReschedule.currentDatesLabel")}{" "}
                      <span className="font-mono text-[var(--color-text-primary)]">
                        {course.startDate}
                        {course.endDate ? ` → ${course.endDate}` : ""}
                      </span>
                    </p>
                  )}

                  <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                    {tAdmin("coursesPage.confirmReschedule.newStartDateLabel")}
                  </label>
                  <div className="mb-1">
                    <DatePicker
                      value={rescheduleNewStartDate}
                      onChange={setRescheduleNewStartDate}
                      disabled={confirmBusy}
                    />
                  </div>
                  {rescheduleNewStartDate && !rescheduleStartOk && (
                    <p className="text-xs text-[#DC2626] mb-3">
                      {tAdmin("coursesPage.confirmReschedule.startInPast")}
                    </p>
                  )}
                  {rescheduleStartOk && <div className="mb-3" />}

                  <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                    {tAdmin("coursesPage.confirmReschedule.newEndDateLabel")}
                  </label>
                  <div className="mb-1">
                    <DatePicker
                      value={rescheduleNewEndDate}
                      onChange={setRescheduleNewEndDate}
                      disabled={confirmBusy}
                      min={rescheduleNewStartDate || undefined}
                    />
                  </div>
                  {!rescheduleEndOk && (
                    <p className="text-xs text-[#DC2626] mb-3">
                      {tAdmin("coursesPage.confirmReschedule.endBeforeStart")}
                    </p>
                  )}
                  {rescheduleEndOk && <div className="mb-3" />}

                  <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                    {tAdmin("coursesPage.confirmReschedule.reasonLabel")}
                  </label>
                  <textarea
                    value={rescheduleReason}
                    onChange={(e) => setRescheduleReason(e.target.value)}
                    placeholder={tAdmin("coursesPage.confirmReschedule.reasonPlaceholder")}
                    disabled={confirmBusy}
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-card)] text-[var(--color-text-primary)] mb-4 disabled:opacity-50 resize-none"
                  />
                  {rescheduleReason.trim().length > 0 &&
                    rescheduleReason.trim().length < 3 && (
                      <p className="text-xs text-[#DC2626] mb-2">
                        {tAdmin("coursesPage.confirmReschedule.reasonRequired")}
                      </p>
                    )}
                </>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeAdminConfirm}
                  disabled={confirmBusy}
                  className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors disabled:opacity-50"
                >
                  {confirmKind === "cancel"
                    ? tAdmin("coursesPage.confirmCancel.cancel")
                    : confirmKind === "reschedule"
                      ? tAdmin("coursesPage.confirmReschedule.cancel")
                      : tAdmin("coursesPage.confirmArchive.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleAdminConfirm}
                  disabled={
                    confirmBusy ||
                    (confirmKind === "delete" && !deleteConfirmOk) ||
                    (confirmKind === "cancel" && !cancelConfirmOk) ||
                    (confirmKind === "reschedule" && !rescheduleConfirmOk)
                  }
                  className={
                    confirmKind === "reschedule"
                      ? "inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#2563EB] rounded-lg hover:bg-[#1D4ED8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      : "inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#DC2626] rounded-lg hover:bg-[#B91C1C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  }
                >
                  {confirmBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                  {confirmKind === "cancel"
                    ? tAdmin("coursesPage.confirmCancel.confirm")
                    : confirmKind === "reschedule"
                      ? tAdmin("coursesPage.confirmReschedule.confirm")
                      : tAdmin("coursesPage.confirmDelete.confirm")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CourseManagerCourseDetailContent;
