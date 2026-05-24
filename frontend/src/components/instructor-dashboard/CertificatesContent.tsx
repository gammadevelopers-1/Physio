"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import InstructorNavbar from "./InstructorNavbar";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import { useInstructorProfile } from "@/hooks/useInstructorProfile";
import { useCalendarPreference } from "@/contexts/CalendarContext";
import { usePlatformLocale } from "@/contexts/PlatformLocaleContext";
import { formatDate as formatDateHijri } from "@/lib/hijri";
import { instructorApi } from "@/lib/api";
import { toast } from "sonner";
import type {
  InstructorCourse,
  CertificateRequestResponse,
} from "@/types/instructor-dashboard";
import {
  Search,
  Filter,
  ChevronDown,
  Award,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Download,
  Users,
  FileCheck,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Calendar,
  BookOpen,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  PauseCircle,
  ShieldOff,
} from "lucide-react";

// ─── Modal Overlay ─────────────────────────────────────────

const ModalOverlay = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    {children}
  </div>
);

// ─── Review Modal ──────────────────────────────────────────

interface ReviewModalProps {
  cert: CertificateRequestResponse;
  courseName: string;
  onClose: () => void;
  onAction: () => void;
  t: ReturnType<typeof useTranslations>;
}

const ReviewModal = ({ cert, courseName, onClose, onAction, t }: ReviewModalProps) => {
  const locale = useLocale();
  const { calendarFormat } = useCalendarPreference();
  const platformLocale = usePlatformLocale();
  const [note, setNote] = useState(cert.reviewNote || "");
  const [processing, setProcessing] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const attendancePct = parseFloat(cert.attendancePercent || "0");
  const attendanceMet = attendancePct >= 70;
  const assessmentMet = cert.assessmentPassed === true;
  const completionMet = cert.courseCompleted === true;
  const fullyEligible = attendanceMet && assessmentMet && completionMet;

  const studentName = [cert.studentFirstName, cert.studentLastName].filter(Boolean).join(" ") || cert.studentEmail;
  const initials = [cert.studentFirstName?.[0], cert.studentLastName?.[0]].filter(Boolean).join("").toUpperCase() || cert.studentEmail[0].toUpperCase();

  const handleAction = async (action: "approve" | "reject" | "hold") => {
    if ((action === "reject" || action === "hold") && !note.trim()) {
      toast.error(t("certificates.noteRequired"));
      return;
    }
    setProcessing(true);
    setActiveAction(action);
    try {
      if (action === "approve") {
        await instructorApi.approveCertificate(cert.id);
        toast.success(t("certificates.approveSuccess"));
      } else if (action === "reject") {
        await instructorApi.rejectCertificate(cert.id, note.trim());
        toast.success(t("certificates.rejectSuccess"));
      } else {
        await instructorApi.holdCertificate(cert.id, note.trim());
        toast.success(t("certificates.holdSuccess"));
      }
      onAction();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("certificates.actionError");
      toast.error(msg);
    } finally {
      setProcessing(false);
      setActiveAction(null);
    }
  };

  const canAct = cert.status === "pending" || cert.status === "held";

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#FEF3C7] flex items-center justify-center">
                <Award className="w-6 h-6 text-[#D4A520]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("certificates.reviewRequest")}</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">{courseName}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Student Info */}
          <div className="p-4 bg-[var(--color-surface-page)] rounded-xl mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--color-border)] flex items-center justify-center text-sm font-semibold text-[var(--color-text-secondary)]">
                {initials}
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">{studentName}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{cert.studentEmail}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{t("certificates.requested")}: {formatDateHijri(cert.createdAt, calendarFormat, { locale, platformSettings: platformLocale })}</p>
              </div>
            </div>
          </div>

          {/* Eligibility Checks */}
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">{t("certificates.eligibilityChecks")}</h4>
          <div className="space-y-3 mb-6">
            {/* Attendance */}
            <div className={`flex items-center justify-between p-3 rounded-lg ${attendanceMet ? "bg-[#DCFCE7]" : "bg-[#FEE2E2]"}`}>
              <div className="flex items-center gap-3">
                <Calendar className={`w-5 h-5 ${attendanceMet ? "text-[#22C55E]" : "text-[#EF4444]"}`} />
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-secondary)]">{t("certificates.attendanceRequirement")}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{t("certificates.required")}: 70%</p>
                </div>
              </div>
              <span className={`text-sm font-semibold ${attendanceMet ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
                {attendancePct.toFixed(1)}%
              </span>
            </div>

            {/* Assessment */}
            <div className={`flex items-center justify-between p-3 rounded-lg ${assessmentMet ? "bg-[#DCFCE7]" : "bg-[#FEE2E2]"}`}>
              <div className="flex items-center gap-3">
                <ClipboardCheck className={`w-5 h-5 ${assessmentMet ? "text-[#22C55E]" : "text-[#EF4444]"}`} />
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-secondary)]">{t("certificates.assessmentRequirement")}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{t("certificates.required")}: {t("certificates.allPassed")}</p>
                </div>
              </div>
              <span className={`text-sm font-semibold ${assessmentMet ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
                {assessmentMet ? t("certificates.passed") : t("certificates.failed")}
              </span>
            </div>

            {/* Completion */}
            <div className={`flex items-center justify-between p-3 rounded-lg ${completionMet ? "bg-[#DCFCE7]" : "bg-[#FEE2E2]"}`}>
              <div className="flex items-center gap-3">
                <BookOpen className={`w-5 h-5 ${completionMet ? "text-[#22C55E]" : "text-[#EF4444]"}`} />
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-secondary)]">{t("certificates.completionRequirement")}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{t("certificates.required")}: 100%</p>
                </div>
              </div>
              <span className={`text-sm font-semibold ${completionMet ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
                {completionMet ? "100%" : t("certificates.incomplete")}
              </span>
            </div>
          </div>

          {/* Warning if not fully eligible */}
          {!fullyEligible && (
            <div className="flex items-start gap-3 p-4 bg-[#FEF9C3] rounded-xl mb-6">
              <AlertTriangle className="w-5 h-5 text-[#EAB308] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-[#92400E]">{t("certificates.notFullyEligible")}</p>
                <p className="text-xs text-[#A16207] mt-1">{t("certificates.notFullyEligibleDesc")}</p>
              </div>
            </div>
          )}

          {/* Existing review note */}
          {cert.reviewNote && cert.status !== "pending" && (
            <div className="p-3 bg-[var(--color-surface-page)] rounded-lg mb-4">
              <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">{t("certificates.reviewNote")}</p>
              <p className="text-sm text-[var(--color-text-secondary)]">{cert.reviewNote}</p>
            </div>
          )}

          {/* Note input for actions */}
          {canAct && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("certificates.noteLabel")}</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("certificates.notePlaceholder")}
                rows={3}
                className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)] resize-none"
              />
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">{t("certificates.noteHint")}</p>
            </div>
          )}

          {/* Action Buttons */}
          {canAct ? (
            <div className="flex gap-2">
              <button onClick={onClose} disabled={processing} className="flex-1 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-50">
                {t("certificates.cancel")}
              </button>
              {cert.status === "pending" && (
                <button
                  onClick={() => handleAction("hold")}
                  disabled={processing}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#F97316] text-white rounded-lg text-sm font-medium hover:bg-[#EA580C] disabled:opacity-50"
                >
                  {activeAction === "hold" ? <Loader2 className="w-4 h-4 animate-spin" /> : <PauseCircle className="w-4 h-4" />}
                  {t("certificates.hold")}
                </button>
              )}
              <button
                onClick={() => handleAction("reject")}
                disabled={processing}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#EF4444] text-white rounded-lg text-sm font-medium hover:bg-[#DC2626] disabled:opacity-50"
              >
                {activeAction === "reject" ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                {t("certificates.reject")}
              </button>
              <button
                onClick={() => handleAction("approve")}
                disabled={processing}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#22C55E] text-white rounded-lg text-sm font-medium hover:bg-[#16A34A] disabled:opacity-50"
              >
                {activeAction === "approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {t("certificates.approve")}
              </button>
            </div>
          ) : (
            <button onClick={onClose} className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]">
              {t("certificates.close")}
            </button>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
};

// ─── Batch Action Bar ──────────────────────────────────────

interface BatchBarProps {
  count: number;
  onApprove: () => void;
  onReject: () => void;
  onClear: () => void;
  processing: boolean;
  t: ReturnType<typeof useTranslations>;
}

const BatchBar = ({ count, onApprove, onReject, onClear, processing, t }: BatchBarProps) => (
  <div className="bg-[var(--color-text-primary)] rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white text-sm font-bold">
        {count}
      </div>
      <span className="text-sm text-white">{count} {t("certificates.selected")}</span>
    </div>
    <div className="flex items-center gap-2">
      <button onClick={onClear} disabled={processing} className="px-3 py-2 text-sm text-[var(--color-border)] hover:text-white transition-colors disabled:opacity-50">
        {t("certificates.clearSelection")}
      </button>
      <button
        onClick={onReject}
        disabled={processing}
        className="flex items-center gap-1.5 px-4 py-2 bg-[#EF4444] text-white rounded-lg text-sm font-medium hover:bg-[#DC2626] disabled:opacity-50"
      >
        {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
        {t("certificates.batchReject")}
      </button>
      <button
        onClick={onApprove}
        disabled={processing}
        className="flex items-center gap-1.5 px-4 py-2 bg-[#22C55E] text-white rounded-lg text-sm font-medium hover:bg-[#16A34A] disabled:opacity-50"
      >
        {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
        {t("certificates.batchApprove")}
      </button>
    </div>
  </div>
);

// ─── Main Component ────────────────────────────────────────

const CertificatesContent = () => {
  const instructor = useInstructorProfile();
  const t = useTranslations("instructorDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { calendarFormat } = useCalendarPreference();
  const platformLocale = usePlatformLocale();

  // Data
  const [courses, setCourses] = useState<InstructorCourse[]>([]);
  const [certificates, setCertificates] = useState<CertificateRequestResponse[]>([]);
  const [totalCerts, setTotalCerts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusCounts, setStatusCounts] = useState({ pending: 0, approved: 0, held: 0, revoked: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Modal
  const [reviewingCert, setReviewingCert] = useState<CertificateRequestResponse | null>(null);

  // Batch
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchNoteModal, setBatchNoteModal] = useState<"approve" | "reject" | null>(null);
  const [batchNote, setBatchNote] = useState("");

  // Revoke
  const [revokingCert, setRevokingCert] = useState<CertificateRequestResponse | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeProcessing, setRevokeProcessing] = useState(false);

  // ── Course name lookup ───────────────────────────────────
  const courseNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    courses.forEach((c) => { map[c.id] = c.title; });
    return map;
  }, [courses]);

  // ── Fetch ────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [coursesRes, certsRes, pendingRes, approvedRes, heldRes, revokedRes] = await Promise.all([
        instructorApi.getCourses({ limit: 100 }),
        instructorApi.getCertificates({
          courseId: selectedCourse !== "all" ? selectedCourse : undefined,
          status: selectedStatus !== "all" ? selectedStatus : undefined,
          page: currentPage,
          limit: ITEMS_PER_PAGE,
        }),
        instructorApi.getCertificates({ status: "pending", limit: 1 }),
        instructorApi.getCertificates({ status: "approved", limit: 1 }),
        instructorApi.getCertificates({ status: "held", limit: 1 }),
        instructorApi.getCertificates({ status: "revoked", limit: 1 }),
      ]);
      setCourses(coursesRes.data);
      setCertificates(certsRes.data);
      setTotalCerts(certsRes.total);
      setTotalPages(certsRes.totalPages);
      setStatusCounts({
        pending: pendingRes.total,
        approved: approvedRes.total,
        held: heldRes.total,
        revoked: revokedRes.total,
      });
    } catch {
      setError(t("certificates.loadError"));
    } finally {
      setLoading(false);
    }
  }, [selectedCourse, selectedStatus, currentPage, t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const refetch = useCallback(() => {
    setSelectedIds(new Set());
    fetchData();
  }, [fetchData]);

  // ── Client-side search filter ────────────────────────────
  const filteredCertificates = useMemo(() => {
    if (!searchQuery.trim()) return certificates;
    const q = searchQuery.toLowerCase();
    return certificates.filter((c) => {
      const name = [c.studentFirstName, c.studentLastName].join(" ").toLowerCase();
      const courseName = (courseNameMap[c.courseId] || "").toLowerCase();
      return name.includes(q) || c.studentEmail.toLowerCase().includes(q) || courseName.includes(q);
    });
  }, [certificates, searchQuery, courseNameMap]);

  // ── Stats (from global status counts) ────────────────────
  const stats = useMemo(() => ({
    total: statusCounts.pending + statusCounts.approved + statusCounts.held + statusCounts.revoked,
    pending: statusCounts.pending,
    approved: statusCounts.approved,
    held: statusCounts.held,
    revoked: statusCounts.revoked,
  }), [statusCounts]);

  // ── Selection helpers ────────────────────────────────────
  const actionableCerts = filteredCertificates.filter((c) => c.status === "pending" || c.status === "held");

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === actionableCerts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(actionableCerts.map((c) => c.id)));
    }
  };

  // ── Batch actions ────────────────────────────────────────
  const handleBatchApprove = async () => {
    if (selectedIds.size === 0) return;
    setBatchProcessing(true);
    try {
      const result = await instructorApi.batchCertificates(Array.from(selectedIds), "approve");
      toast.success(`${result.successful} ${t("certificates.batchApproveSuccess")}`);
      if (result.failed > 0) {
        toast.error(`${result.failed} ${t("certificates.batchFailed")}`);
      }
      setSelectedIds(new Set());
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("certificates.actionError");
      toast.error(msg);
    } finally {
      setBatchProcessing(false);
      setBatchNoteModal(null);
    }
  };

  const handleBatchReject = async () => {
    if (selectedIds.size === 0 || !batchNote.trim()) {
      toast.error(t("certificates.noteRequired"));
      return;
    }
    setBatchProcessing(true);
    try {
      const result = await instructorApi.batchCertificates(Array.from(selectedIds), "reject", batchNote.trim());
      toast.success(`${result.successful} ${t("certificates.batchRejectSuccess")}`);
      if (result.failed > 0) {
        toast.error(`${result.failed} ${t("certificates.batchFailed")}`);
      }
      setSelectedIds(new Set());
      setBatchNote("");
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("certificates.actionError");
      toast.error(msg);
    } finally {
      setBatchProcessing(false);
      setBatchNoteModal(null);
    }
  };

  // ── Quick actions (inline) ───────────────────────────────
  const quickApprove = async (cert: CertificateRequestResponse) => {
    try {
      await instructorApi.approveCertificate(cert.id);
      toast.success(t("certificates.approveSuccess"));
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("certificates.actionError");
      toast.error(msg);
    }
  };

  // ── Download handler ───────────────────────────────────
  const [downloading, setDownloading] = useState<string | null>(null);
  const [batchDownloading, setBatchDownloading] = useState(false);

  const handleDownload = async (certId: string) => {
    setDownloading(certId);
    try {
      await instructorApi.downloadCertificate(certId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("certificates.downloadFailed");
      toast.error(msg);
    } finally {
      setDownloading(null);
    }
  };

  const handleBatchDownload = async () => {
    const approvedSelected = filteredCertificates
      .filter((c) => c.status === "approved" && selectedIds.has(c.id))
      .map((c) => c.id);
    if (approvedSelected.length === 0) {
      toast.error(t("certificates.noApprovedSelected"));
      return;
    }
    setBatchDownloading(true);
    try {
      await instructorApi.batchDownloadCertificates(approvedSelected);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("certificates.batchDownloadFailed");
      toast.error(msg);
    } finally {
      setBatchDownloading(false);
    }
  };

  // ── Revoke handler ─────────────────────────────────────
  const handleRevoke = async () => {
    if (!revokingCert || !revokeReason.trim()) {
      toast.error(t("certificates.revokeReasonRequired"));
      return;
    }
    setRevokeProcessing(true);
    try {
      await instructorApi.revokeCertificate(revokingCert.id, revokeReason.trim());
      toast.success(t("certificates.revokeSuccess"));
      setRevokingCert(null);
      setRevokeReason("");
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("certificates.actionError");
      toast.error(msg);
    } finally {
      setRevokeProcessing(false);
    }
  };

  // ── Status helpers ───────────────────────────────────────
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "pending": return "bg-[#FEF9C3] text-[#EAB308]";
      case "approved": return "bg-[#DCFCE7] text-[#22C55E]";
      case "rejected": return "bg-[#FEE2E2] text-[#EF4444]";
      case "held": return "bg-[#FFEDD5] text-[#F97316]";
      case "revoked": return "bg-[#FEE2E2] text-[#991B1B]";
      default: return "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Clock className="w-3 h-3" />;
      case "approved": return <CheckCircle className="w-3 h-3" />;
      case "rejected": return <XCircle className="w-3 h-3" />;
      case "held": return <PauseCircle className="w-3 h-3" />;
      case "revoked": return <ShieldOff className="w-3 h-3" />;
      default: return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending": return t("certificates.statusPending");
      case "approved": return t("certificates.statusApproved");
      case "rejected": return t("certificates.statusRejected");
      case "held": return t("certificates.statusHeld");
      case "revoked": return t("certificates.statusRevoked");
      default: return status;
    }
  };

  // ── Eligibility helpers ──────────────────────────────────
  const getEligibility = (cert: CertificateRequestResponse) => {
    const attendancePct = parseFloat(cert.attendancePercent || "0");
    return {
      attendance: attendancePct >= 70,
      assessment: cert.assessmentPassed === true,
      completion: cert.courseCompleted === true,
    };
  };

  const isFullyEligible = (cert: CertificateRequestResponse) => {
    const e = getEligibility(cert);
    return e.attendance && e.assessment && e.completion;
  };

  const getStudentName = (cert: CertificateRequestResponse) =>
    [cert.studentFirstName, cert.studentLastName].filter(Boolean).join(" ") || cert.studentEmail;

  const getInitials = (cert: CertificateRequestResponse) =>
    [cert.studentFirstName?.[0], cert.studentLastName?.[0]].filter(Boolean).join("").toUpperCase() || cert.studentEmail[0].toUpperCase();

  // ── Filter options ───────────────────────────────────────
  const statusOptions = [
    { id: "all", name: t("certificates.allStatuses") },
    { id: "pending", name: t("certificates.statusPending") },
    { id: "approved", name: t("certificates.statusApproved") },
    { id: "rejected", name: t("certificates.statusRejected") },
    { id: "held", name: t("certificates.statusHeld") },
    { id: "revoked", name: t("certificates.statusRevoked") },
  ];

  return (
    <>
      <InstructorNavbar instructor={instructor} />
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <InstructorSidebar instructor={instructor} />
            </div>
            <InstructorMobileSidebar instructor={instructor} />

            <div className="flex-1 min-w-0 space-y-6">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-[var(--color-text-primary)]">{t("certificates.title")}</h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">{t("certificates.subtitle")}</p>
                </div>
                <button onClick={refetch} className="p-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors" title={t("certificates.refresh")}>
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--color-border-subtle)] flex items-center justify-center"><Award className="w-5 h-5 text-[var(--color-primary)]" /></div>
                    <div>
                      <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{stats.total}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{t("certificates.totalRequests")}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#FEF9C3] flex items-center justify-center"><Clock className="w-5 h-5 text-[#EAB308]" /></div>
                    <div>
                      <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{stats.pending}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{t("certificates.pending")}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#DCFCE7] flex items-center justify-center"><FileCheck className="w-5 h-5 text-[#22C55E]" /></div>
                    <div>
                      <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{stats.approved}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{t("certificates.approved")}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#FFEDD5] flex items-center justify-center"><PauseCircle className="w-5 h-5 text-[#F97316]" /></div>
                    <div>
                      <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{stats.held}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{t("certificates.held")}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Batch Bar */}
              {selectedIds.size > 0 && (
                <div className="space-y-2">
                  <BatchBar
                    count={selectedIds.size}
                    onApprove={handleBatchApprove}
                    onReject={() => setBatchNoteModal("reject")}
                    onClear={() => setSelectedIds(new Set())}
                    processing={batchProcessing}
                    t={t}
                  />
                  {filteredCertificates.some((c) => c.status === "approved" && selectedIds.has(c.id)) && (
                    <button
                      onClick={handleBatchDownload}
                      disabled={batchDownloading}
                      className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
                    >
                      {batchDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      {t("certificates.downloadSelected")}
                    </button>
                  )}
                </div>
              )}

              {/* Loading / Error */}
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
                  <span className="ml-3 text-[var(--color-text-secondary)]">{t("certificates.loading")}</span>
                </div>
              )}

              {error && !loading && (
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-8 text-center">
                  <AlertTriangle className="w-8 h-8 text-[#EF4444] mx-auto mb-3" />
                  <p className="text-[#EF4444] mb-4">{error}</p>
                  <button onClick={refetch} className="px-4 py-2 btn-gold text-[var(--color-button-text)] rounded-lg text-sm">{t("certificates.retry")}</button>
                </div>
              )}

              {!loading && !error && (
                <>
                  {/* Search and Filters */}
                  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="relative flex-1">
                        <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`} />
                        <input
                          type="text"
                          placeholder={t("certificates.searchPlaceholder")}
                          value={searchQuery}
                          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                          className={`w-full py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)] focus:border-transparent ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"}`}
                        />
                      </div>
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="md:hidden flex items-center justify-center gap-2 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                      >
                        <Filter className="w-4 h-4" />
                        {t("certificates.filters")}
                        <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`} />
                      </button>
                      <div className="hidden md:flex gap-3">
                        <select
                          value={selectedCourse}
                          onChange={(e) => { setSelectedCourse(e.target.value); setCurrentPage(1); setSelectedIds(new Set()); }}
                          className="px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)]"
                        >
                          <option value="all">{t("certificates.allCourses")}</option>
                          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                        </select>
                        <select
                          value={selectedStatus}
                          onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); setSelectedIds(new Set()); }}
                          className="px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)]"
                        >
                          {statusOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                      </div>
                    </div>
                    {showFilters && (
                      <div className="md:hidden mt-4 pt-4 border-t border-[var(--color-border)] grid grid-cols-2 gap-3">
                        <select
                          value={selectedCourse}
                          onChange={(e) => { setSelectedCourse(e.target.value); setCurrentPage(1); }}
                          className="px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)]"
                        >
                          <option value="all">{t("certificates.allCourses")}</option>
                          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                        </select>
                        <select
                          value={selectedStatus}
                          onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
                          className="px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)]"
                        >
                          {statusOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Empty state */}
                  {filteredCertificates.length === 0 && (
                    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-12 text-center">
                      <Award className="w-12 h-12 text-[var(--color-border)] mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">{t("certificates.noRequests")}</h3>
                      <p className="text-sm text-[var(--color-text-secondary)]">{t("certificates.noRequestsDesc")}</p>
                    </div>
                  )}

                  {/* Desktop Table */}
                  {filteredCertificates.length > 0 && (
                    <div className="hidden md:block bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-[var(--color-surface-page)] border-b border-[var(--color-border)]">
                              <th className="px-4 py-3 text-start">
                                <input
                                  type="checkbox"
                                  checked={actionableCerts.length > 0 && selectedIds.size === actionableCerts.length}
                                  onChange={toggleSelectAll}
                                  className="w-4 h-4 rounded border-[var(--color-input-border)] text-[var(--color-primary)] focus:ring-[var(--color-input-focus)]"
                                />
                              </th>
                              <th className={`px-4 py-3 text-start text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider`}>{t("certificates.tableStudent")}</th>
                              <th className={`px-4 py-3 text-start text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider`}>{t("certificates.tableCourse")}</th>
                              <th className={`px-4 py-3 text-start text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider`}>{t("certificates.tableEligibility")}</th>
                              <th className={`px-4 py-3 text-start text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider`}>{t("certificates.tableRequestDate")}</th>
                              <th className={`px-4 py-3 text-start text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider`}>{t("certificates.tableStatus")}</th>
                              <th className={`px-4 py-3 text-start text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider`}>{t("certificates.tableActions")}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--color-border)]">
                            {filteredCertificates.map((cert) => {
                              const elig = getEligibility(cert);
                              const canSelect = cert.status === "pending" || cert.status === "held";
                              return (
                                <tr key={cert.id} className="hover:bg-[var(--color-border-subtle)] transition-colors">
                                  <td className="px-4 py-4">
                                    {canSelect ? (
                                      <input
                                        type="checkbox"
                                        checked={selectedIds.has(cert.id)}
                                        onChange={() => toggleSelect(cert.id)}
                                        className="w-4 h-4 rounded border-[var(--color-input-border)] text-[var(--color-primary)] focus:ring-[var(--color-input-focus)]"
                                      />
                                    ) : <div className="w-4 h-4" />}
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-full bg-[var(--color-border)] flex items-center justify-center text-sm font-semibold text-[var(--color-text-secondary)] flex-shrink-0">
                                        {getInitials(cert)}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate">{getStudentName(cert)}</p>
                                        <p className="text-xs text-[var(--color-text-secondary)] truncate">{cert.studentEmail}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4">
                                    <span className="text-sm text-[var(--color-text-secondary)] max-w-[150px] truncate block">{courseNameMap[cert.courseId] || cert.courseId}</span>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="flex items-center gap-1">
                                      <span className={`w-5 h-5 rounded flex items-center justify-center ${elig.attendance ? "bg-[#DCFCE7] text-[#22C55E]" : "bg-[#FEE2E2] text-[#EF4444]"}`} title={`${t("certificates.attendance")}: ${parseFloat(cert.attendancePercent || "0").toFixed(1)}%`}>
                                        {elig.attendance ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                      </span>
                                      <span className={`w-5 h-5 rounded flex items-center justify-center ${elig.assessment ? "bg-[#DCFCE7] text-[#22C55E]" : "bg-[#FEE2E2] text-[#EF4444]"}`} title={`${t("certificates.assessment")}: ${elig.assessment ? t("certificates.passed") : t("certificates.failed")}`}>
                                        {elig.assessment ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                      </span>
                                      <span className={`w-5 h-5 rounded flex items-center justify-center ${elig.completion ? "bg-[#DCFCE7] text-[#22C55E]" : "bg-[#FEE2E2] text-[#EF4444]"}`} title={`${t("certificates.completion")}: ${elig.completion ? "100%" : t("certificates.incomplete")}`}>
                                        {elig.completion ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                      </span>
                                      {!isFullyEligible(cert) && <AlertTriangle className="w-4 h-4 text-[#EAB308] ml-1" />}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4">
                                    <span className="text-sm text-[var(--color-text-secondary)]">{formatDateHijri(cert.createdAt, calendarFormat, { locale, platformSettings: platformLocale })}</span>
                                  </td>
                                  <td className="px-4 py-4">
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${getStatusStyle(cert.status)}`}>
                                      {getStatusIcon(cert.status)}
                                      {getStatusLabel(cert.status)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="flex items-center gap-1">
                                      <button onClick={() => setReviewingCert(cert)} className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors" title={t("certificates.review")}>
                                        <Eye className="w-4 h-4" />
                                      </button>
                                      {(cert.status === "pending" || cert.status === "held") && (
                                        <>
                                          <button onClick={() => quickApprove(cert)} className="p-2 text-[var(--color-text-secondary)] hover:text-[#22C55E] hover:bg-[#DCFCE7] rounded-lg transition-colors" title={t("certificates.approve")}>
                                            <CheckCircle className="w-4 h-4" />
                                          </button>
                                          <button onClick={() => setReviewingCert(cert)} className="p-2 text-[var(--color-text-secondary)] hover:text-[#EF4444] hover:bg-[#FEE2E2] rounded-lg transition-colors" title={t("certificates.reject")}>
                                            <XCircle className="w-4 h-4" />
                                          </button>
                                        </>
                                      )}
                                      {cert.status === "approved" && (
                                        <>
                                          <button
                                            onClick={() => handleDownload(cert.id)}
                                            disabled={downloading === cert.id}
                                            className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors disabled:opacity-50"
                                            title={t("certificates.download")}
                                          >
                                            {downloading === cert.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                          </button>
                                          <button onClick={() => setRevokingCert(cert)} className="p-2 text-[var(--color-text-secondary)] hover:text-[#991B1B] hover:bg-[#FEE2E2] rounded-lg transition-colors" title={t("certificates.revoke")}>
                                            <ShieldOff className="w-4 h-4" />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
                        <p className="text-sm text-[var(--color-text-secondary)]">
                          {t("certificates.showing")} {filteredCertificates.length} {t("certificates.of")} {totalCerts} {t("certificates.requests")}
                        </p>
                        <div className="flex items-center gap-1">
                          <button onClick={() => { setCurrentPage(Math.max(1, currentPage - 1)); setSelectedIds(new Set()); }} disabled={currentPage === 1} className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
                            {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                          </button>
                          <span className="px-3 py-1 text-sm text-[var(--color-text-secondary)]">{currentPage} / {totalPages || 1}</span>
                          <button onClick={() => { setCurrentPage(Math.min(totalPages, currentPage + 1)); setSelectedIds(new Set()); }} disabled={currentPage >= totalPages} className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
                            {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mobile Cards */}
                  {filteredCertificates.length > 0 && (
                    <div className="md:hidden space-y-3">
                      {/* Select all for mobile */}
                      {actionableCerts.length > 0 && (
                        <div className="flex items-center gap-2 px-1">
                          <input
                            type="checkbox"
                            checked={selectedIds.size === actionableCerts.length}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded border-[var(--color-input-border)] text-[var(--color-primary)] focus:ring-[var(--color-input-focus)]"
                          />
                          <span className="text-xs text-[var(--color-text-secondary)]">{t("certificates.selectAll")}</span>
                        </div>
                      )}
                      {filteredCertificates.map((cert) => {
                        const elig = getEligibility(cert);
                        const canSelect = cert.status === "pending" || cert.status === "held";
                        return (
                          <div key={cert.id} className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                {canSelect && (
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.has(cert.id)}
                                    onChange={() => toggleSelect(cert.id)}
                                    className="w-4 h-4 rounded border-[var(--color-input-border)] text-[var(--color-primary)] focus:ring-[var(--color-input-focus)] mt-1"
                                  />
                                )}
                                <div className="w-10 h-10 rounded-full bg-[var(--color-border)] flex items-center justify-center text-sm font-semibold text-[var(--color-text-secondary)]">
                                  {getInitials(cert)}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-[var(--color-text-secondary)]">{getStudentName(cert)}</p>
                                  <p className="text-xs text-[var(--color-text-secondary)]">{courseNameMap[cert.courseId] || ""}</p>
                                </div>
                              </div>
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusStyle(cert.status)}`}>
                                {getStatusIcon(cert.status)}
                                {getStatusLabel(cert.status)}
                              </span>
                            </div>

                            {/* Eligibility */}
                            <div className="grid grid-cols-3 gap-2 mb-3 p-3 bg-[var(--color-surface-page)] rounded-lg">
                              <div className="text-center">
                                <div className={`w-6 h-6 mx-auto rounded flex items-center justify-center mb-1 ${elig.attendance ? "bg-[#DCFCE7] text-[#22C55E]" : "bg-[#FEE2E2] text-[#EF4444]"}`}>
                                  {elig.attendance ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                                </div>
                                <p className="text-[10px] text-[var(--color-text-secondary)]">{t("certificates.attendance")}</p>
                                <p className="text-xs font-medium text-[var(--color-text-secondary)]">{parseFloat(cert.attendancePercent || "0").toFixed(1)}%</p>
                              </div>
                              <div className="text-center">
                                <div className={`w-6 h-6 mx-auto rounded flex items-center justify-center mb-1 ${elig.assessment ? "bg-[#DCFCE7] text-[#22C55E]" : "bg-[#FEE2E2] text-[#EF4444]"}`}>
                                  {elig.assessment ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                                </div>
                                <p className="text-[10px] text-[var(--color-text-secondary)]">{t("certificates.assessment")}</p>
                                <p className="text-xs font-medium text-[var(--color-text-secondary)]">{elig.assessment ? t("certificates.passed") : t("certificates.failed")}</p>
                              </div>
                              <div className="text-center">
                                <div className={`w-6 h-6 mx-auto rounded flex items-center justify-center mb-1 ${elig.completion ? "bg-[#DCFCE7] text-[#22C55E]" : "bg-[#FEE2E2] text-[#EF4444]"}`}>
                                  {elig.completion ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                                </div>
                                <p className="text-[10px] text-[var(--color-text-secondary)]">{t("certificates.completion")}</p>
                                <p className="text-xs font-medium text-[var(--color-text-secondary)]">{elig.completion ? "100%" : t("certificates.incomplete")}</p>
                              </div>
                            </div>

                            <p className="text-xs text-[var(--color-text-secondary)] mb-3">{t("certificates.requested")}: {formatDateHijri(cert.createdAt, calendarFormat, { locale, platformSettings: platformLocale })}</p>

                            {(cert.status === "pending" || cert.status === "held") && (
                              <div className="flex gap-2">
                                <button onClick={() => setReviewingCert(cert)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]">
                                  <Eye className="w-4 h-4" />{t("certificates.review")}
                                </button>
                                <button onClick={() => quickApprove(cert)} className="flex items-center justify-center px-3 py-2 bg-[#22C55E] text-white rounded-lg hover:bg-[#16A34A]">
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                                <button onClick={() => setReviewingCert(cert)} className="flex items-center justify-center px-3 py-2 bg-[#EF4444] text-white rounded-lg hover:bg-[#DC2626]">
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                            {cert.status === "approved" && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleDownload(cert.id)}
                                  disabled={downloading === cert.id}
                                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-dark)] text-sm font-medium disabled:opacity-50"
                                >
                                  {downloading === cert.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                  {t("certificates.downloadCertificate")}
                                </button>
                                <button onClick={() => setRevokingCert(cert)} className="flex items-center justify-center px-3 py-2 bg-[#991B1B] text-white rounded-lg hover:bg-[#7F1D1D]" title={t("certificates.revoke")}>
                                  <ShieldOff className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                            {cert.status === "revoked" && cert.reviewNote && (
                              <div className="p-2 bg-[#FEE2E2] rounded-lg">
                                <p className="text-xs text-[#991B1B]"><span className="font-medium">{t("certificates.revokeReason")}:</span> {cert.reviewNote}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Review Modal */}
      {reviewingCert && (
        <ReviewModal
          cert={reviewingCert}
          courseName={courseNameMap[reviewingCert.courseId] || reviewingCert.courseId}
          onClose={() => setReviewingCert(null)}
          onAction={refetch}
          t={t}
        />
      )}

      {/* Revoke Confirmation Modal */}
      {revokingCert && (
        <ModalOverlay onClose={() => { setRevokingCert(null); setRevokeReason(""); }}>
          <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#FEE2E2] flex items-center justify-center">
                  <ShieldOff className="w-5 h-5 text-[#991B1B]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("certificates.revokeTitle")}</h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">{getStudentName(revokingCert)}</p>
                </div>
              </div>
              <div className="p-3 bg-[#FEF9C3] rounded-lg mb-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#EAB308] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-[#92400E]">{t("certificates.revokeWarning")}</p>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">{t("certificates.revokeReasonLabel")}</label>
                <textarea
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  placeholder={t("certificates.revokeReasonPlaceholder")}
                  rows={3}
                  className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#EF4444] resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setRevokingCert(null); setRevokeReason(""); }} disabled={revokeProcessing} className="flex-1 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-50">
                  {t("certificates.cancel")}
                </button>
                <button
                  onClick={handleRevoke}
                  disabled={revokeProcessing || !revokeReason.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#991B1B] text-white rounded-lg text-sm font-medium hover:bg-[#7F1D1D] disabled:opacity-50"
                >
                  {revokeProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
                  {t("certificates.confirmRevoke")}
                </button>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Batch Reject Note Modal */}
      {batchNoteModal === "reject" && (
        <ModalOverlay onClose={() => setBatchNoteModal(null)}>
          <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">{t("certificates.batchRejectTitle")}</h3>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">{t("certificates.batchRejectDesc")} ({selectedIds.size} {t("certificates.selected")})</p>
              <textarea
                value={batchNote}
                onChange={(e) => setBatchNote(e.target.value)}
                placeholder={t("certificates.notePlaceholder")}
                rows={3}
                className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)] resize-none mb-4"
              />
              <div className="flex gap-3">
                <button onClick={() => { setBatchNoteModal(null); setBatchNote(""); }} disabled={batchProcessing} className="flex-1 px-4 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-50">
                  {t("certificates.cancel")}
                </button>
                <button
                  onClick={handleBatchReject}
                  disabled={batchProcessing || !batchNote.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#EF4444] text-white rounded-lg text-sm font-medium hover:bg-[#DC2626] disabled:opacity-50"
                >
                  {batchProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                  {t("certificates.batchReject")}
                </button>
              </div>
            </div>
          </div>
        </ModalOverlay>
      )}
    </>
  );
};

export default CertificatesContent;
