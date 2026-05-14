"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import InstructorNavbar from "./InstructorNavbar";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import { useInstructorProfile } from "@/hooks/useInstructorProfile";
import { useCalendarPreference } from "@/contexts/CalendarContext";
import { formatDate as formatDateHijri } from "@/lib/hijri";
import DatePicker from "@/components/ui/DatePicker";
import { CitySelect } from "@/components/ui/CitySelect";
import { instructorApi, zoomAttendanceApi, courseAssistantsApi, courseManagerApi, type ThresholdStatus } from "@/lib/api";
import WebinarRegistrantsDrawer from "@/components/shared/WebinarRegistrantsDrawer";
import type {
  CourseSession,
  InstructorCourse,
  AttendanceRecord,
  AttendanceStatus,
  CourseEnrollment,
} from "@/types/instructor-dashboard";
import { toast } from "sonner";
import {
  Plus,
  Calendar,
  List,
  Video,
  MapPin,
  Users,
  Clock,
  Play,
  Square,
  ClipboardCheck,
  Edit,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Filter,
  Ban,
  Trash2,
  Download,
  Film,
  Lock,
  CheckCircle,
  XCircle,
  Radio,
  Copy,
  Share2,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────

function formatSessionTime(iso: string, locale: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(locale === "ar" ? "ar-SA" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDateStr(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// ─── Modal Overlay ───────────────────────────────────────────

function ModalOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative bg-[var(--color-surface-card)] rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto scrollbar-hide">
        {children}
      </div>
    </div>
  );
}

// ─── Attendance Modal ────────────────────────────────────────

function AttendanceModal({
  session,
  onClose,
  t,
  locale,
}: {
  session: CourseSession;
  onClose: () => void;
  t: ReturnType<typeof useTranslations>;
  locale: string;
}) {
  const tToasts = useTranslations("toasts");
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [localStatuses, setLocalStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [unmatchedParticipants, setUnmatchedParticipants] = useState<
    Array<{ zoomUserEmail: string; eventType: string; timestamp: string }>
  >([]);
  const [manualAssignments, setManualAssignments] = useState<Record<string, string>>({});
  const [assigningEmail, setAssigningEmail] = useState<string | null>(null);
  const [attendanceLocked, setAttendanceLocked] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    synced: number;
    skipped: number;
    details: Array<{
      name: string;
      email: string;
      joinTime: string | null;
      leaveTime: string | null;
      durationMinutes: number;
      action: 'synced' | 'updated_times' | 'skipped';
      reason?: string;
    }>;
  } | null>(null);

  const isZoomSession = session.type === "zoom" || session.type === "hybrid";

  const loadData = useCallback(async () => {
    // If session is already finalized, lock immediately
    if (session.status === "completed") {
      setAttendanceLocked(true);
    }
    try {
      const promises: Promise<unknown>[] = [
        instructorApi.getSessionAttendance(session.id),
        instructorApi.getCourseEnrollments(session.courseId),
      ];
      if (isZoomSession) {
        promises.push(zoomAttendanceApi.getAttendanceLogs(session.id));
      }
      const results = await Promise.all(promises);
      const att = results[0] as AttendanceRecord[];
      const enr = results[1] as CourseEnrollment[];
      setEnrollments(enr);
      setAttendanceRecords(att);

      // Use backend data directly (backend handles unmarked/absent status)
      const existing: Record<string, AttendanceStatus> = {};
      const existingNotes: Record<string, string> = {};
      for (const a of att) {
        existing[a.studentId] = a.status;
        if (a.note) existingNotes[a.studentId] = a.note;
      }
      setLocalStatuses(existing);
      setLocalNotes(existingNotes);

      // Extract unmatched participants from attendance logs
      if (isZoomSession && results[2]) {
        const logs = results[2] as Array<{
          studentId: string | null;
          zoomUserEmail: string | null;
          rawPayload: Record<string, unknown> | null;
          eventType: string;
          timestamp: string;
        }>;
        // Collect emails/names of participants that WERE matched (have studentId)
        // so we can exclude stale webhook entries that were later resolved by report sync
        const matchedIdentifiers = new Set<string>();
        for (const l of logs) {
          if (l.studentId) {
            if (l.zoomUserEmail) matchedIdentifiers.add(l.zoomUserEmail.toLowerCase());
            const payload = l.rawPayload as Record<string, unknown> | null;
            const participant = payload?.participant as Record<string, unknown> | undefined;
            const name = (participant?.user_name as string) || (payload?.name as string);
            if (name) matchedIdentifiers.add(name.toLowerCase());
          }
        }
        const unmatched = logs.filter((l) => {
          if (l.studentId) return false;
          if (l.eventType !== "join") return false;
          // Check if this participant was later matched
          const payload = l.rawPayload as Record<string, unknown> | null;
          const participant = payload?.participant as Record<string, unknown> | undefined;
          const email = l.zoomUserEmail?.toLowerCase();
          const name = ((participant?.user_name as string) || (payload?.name as string))?.toLowerCase();
          if (email && matchedIdentifiers.has(email)) return false;
          if (name && matchedIdentifiers.has(name)) return false;
          // Skip TA platform IDs (TA-xxxxxxxx anywhere in log data)
          const allFields = [
            l.zoomUserEmail,
            payload?.name as string,
            participant?.user_name as string,
            payload?.email as string,
            JSON.stringify(payload),
          ].filter(Boolean).join(" ");
          if (/TA-[0-9a-f]{8}/i.test(allFields)) return false;
          return true;
        });
        // Deduplicate by email or participant name
        const seen = new Set<string>();
        const unique = unmatched.filter((l) => {
          const payload = l.rawPayload as Record<string, unknown> | null;
          const participant = payload?.participant as Record<string, unknown> | undefined;
          const key = l.zoomUserEmail || (participant?.user_name as string) || (payload?.name as string) || l.timestamp;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setUnmatchedParticipants(
          unique
            .filter((l) => {
              // Final safety: exclude any TA platform IDs that slipped through
              const payload = l.rawPayload as Record<string, unknown> | null;
              const allText = [l.zoomUserEmail, payload?.name as string, JSON.stringify(payload)].filter(Boolean).join(" ");
              return !/TA-[0-9a-f]{8}/i.test(allText);
            })
            .map((l) => {
              const payload = l.rawPayload as Record<string, unknown> | null;
              const participant = payload?.participant as Record<string, unknown> | undefined;
              const displayName = l.zoomUserEmail || (participant?.user_name as string) || (payload?.name as string) || "Unknown Participant";
              return {
                zoomUserEmail: displayName,
                eventType: l.eventType,
                timestamp: l.timestamp,
              };
            })
        );
        // Auto-lock if already finalized (completed) with no unmatched participants
        // "ended" sessions should NOT auto-lock — instructor must click Lock to finalize
        if (session.status === "completed" && unique.length === 0) {
          setAttendanceLocked(true);
        }
      }
      // Non-Zoom: auto-lock only if already finalized (completed)
      if (!isZoomSession && session.status === "completed") {
        setAttendanceLocked(true);
      }
    } catch {
      toast.error(t("sessionsPage.attendance.loadError"));
    } finally {
      setLoading(false);
    }
  }, [session.id, session.courseId, isZoomSession, session.status, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSyncZoom = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await zoomAttendanceApi.syncZoomAttendance(session.id);
      setSyncResult({
        synced: result.synced,
        skipped: result.skipped,
        details: result.details || [],
      });
      toast.success(tToasts("syncedFromZoom", { count: result.synced }));
      setLoading(true);
      await loadData();
    } catch {
      toast.error(
        "Failed to sync Zoom attendance. Zoom reports may take 10-30 minutes to become available after a meeting ends. Please try again later.",
        { duration: 8000 },
      );
    } finally {
      setSyncing(false);
    }
  };

  /** Item #17: Manual assign an unmatched Zoom participant to an enrolled student */
  const handleManualAssign = async (zoomEmail: string) => {
    const studentId = manualAssignments[zoomEmail];
    if (!studentId) return;

    setAssigningEmail(zoomEmail);
    try {
      await instructorApi.markAttendance(session.id, { studentId, status: "present" });
      toast.success(tToasts("assignedToStudent", { email: zoomEmail }));
      setUnmatchedParticipants((prev) => prev.filter((p) => p.zoomUserEmail !== zoomEmail));
      setManualAssignments((prev) => { const next = { ...prev }; delete next[zoomEmail]; return next; });
      setLoading(true);
      await loadData();
    } catch {
      toast.error(tToasts("failedAssignParticipant"));
    } finally {
      setAssigningEmail(null);
    }
  };

  /** Students already marked present who shouldn't appear in the assign dropdown */
  const markedStudentIds = new Set(attendanceRecords.filter((a) => a.status !== "unmarked").map((a) => a.studentId));

  const statusOptions: AttendanceStatus[] = ["present", "absent"];
  // For ended/completed Zoom sessions: verified students are always read-only,
  // only unmatched assignment is allowed (until finalized)
  const isPostSession = session.status === "ended" || session.status === "completed";
  const hasUnmatched = unmatchedParticipants.length > 0;
  const isReadOnly = attendanceLocked || (session.status !== "live" && !isPostSession);
  // Verified students (auto-synced) are read-only on post-session — only unmatched can be assigned
  const isVerifiedReadOnly = isReadOnly || (isPostSession && isZoomSession);

  const getStatusColor = (status: AttendanceStatus) => {
    switch (status) {
      case "present": return "bg-[#DCFCE7] text-[#16A34A]";
      case "absent": return "bg-[#FEE2E2] text-[#EF4444]";
      case "late": return "bg-[#FEF3C7] text-[#D97706]";
      case "excused": return "bg-[var(--color-border-subtle)] text-[var(--color-primary)]";
      case "unmarked": return "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
      default: return "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
    }
  };

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setLocalStatuses((prev) => ({ ...prev, [studentId]: status }));
    // Clear note when switching to present/absent
    if (status !== "late" && status !== "excused") {
      setLocalNotes((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
    }
  };

  const handleBulkMark = (status: AttendanceStatus) => {
    const all: Record<string, AttendanceStatus> = {};
    for (const e of enrollments) {
      all[e.studentId] = status;
    }
    setLocalStatuses(all);
    // Clear notes when bulk-marking present/absent
    if (status !== "late" && status !== "excused") {
      setLocalNotes({});
    }
  };

  const handleSave = async () => {
    // Validate notes for late/excused students
    const missingNotes = Object.entries(localStatuses).filter(
      ([studentId, status]) =>
        (status === "late" || status === "excused") &&
        !localNotes[studentId]?.trim()
    );
    if (missingNotes.length > 0) {
      toast.error(t("sessionsPage.attendance.noteRequired"));
      return;
    }

    setSaving(true);
    try {
      const records = Object.entries(localStatuses)
        .map(([studentId, status]) => ({
          studentId,
          status: status === "unmarked" ? "absent" : status, // Unmarked → absent on save
          ...(localNotes[studentId]?.trim() ? { note: localNotes[studentId].trim() } : {}),
        }));
      if (records.length === 0) {
        toast.error(t("sessionsPage.attendance.noChanges"));
        setSaving(false);
        return;
      }
      await instructorApi.bulkMarkAttendance(session.id, records);
      // Post-session: finalize & lock attendance
      if (isPostSession) {
        if (session.status === "ended") {
          try {
            await instructorApi.finalizeSession(session.id);
          } catch {
            // Already completed or finalize not applicable — still lock UI
          }
        }
        // Update UI: convert unmarked → absent so summary and badges reflect immediately
        setLocalStatuses((prev) => {
          const updated = { ...prev };
          for (const key of Object.keys(updated)) {
            if (updated[key] === "unmarked") updated[key] = "absent";
          }
          return updated;
        });
        toast.success(locale === "ar" ? "تم حفظ وقفل الحضور نهائياً" : "Attendance saved & locked");
        setAttendanceLocked(true);
        setUnmatchedParticipants([]);
        setSaving(false);
        return;
      }
      toast.success(t("sessionsPage.attendance.saved"));
      onClose();
    } catch {
      toast.error(t("sessionsPage.attendance.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const presentCount = Object.values(localStatuses).filter((s) => s === "present").length;
  const absentCount = Object.values(localStatuses).filter((s) => s === "absent").length;
  const lateCount = Object.values(localStatuses).filter((s) => s === "late").length;
  const excusedCount = Object.values(localStatuses).filter((s) => s === "excused").length;
  const unmarkedCount = Object.values(localStatuses).filter((s) => s === "unmarked").length;

  const timeLocale = locale === "ar" ? "ar-SA" : "en-US";

  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {t("sessionsPage.attendance.title")}
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{session.title}</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors">
          <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
        </div>
      ) : (
        <>
          {/* Zoom sync bar */}
          {isZoomSession && !attendanceLocked && (session.status === "ended" || session.status === "completed") && (
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-border-subtle)]">
              <div className="flex items-center gap-2 text-xs text-[var(--color-primary)]">
                <Video className="w-3.5 h-3.5" />
                <span>Zoom Lecture</span>
              </div>
              <button
                onClick={handleSyncZoom}
                disabled={syncing || attendanceLocked}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] border border-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary)] hover:text-white transition-colors disabled:opacity-50"
              >
                {syncing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                {syncing ? "Syncing..." : "Sync from Zoom"}
              </button>
            </div>
          )}

          {/* Zoom sync result panel */}
          {syncResult && !attendanceLocked && (
            <div className="border-b border-[var(--color-border)] bg-[#F0FDF4]">
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#16A34A]" />
                  <span className="text-xs font-medium text-[#15803D]">
                    Zoom Sync Complete: {syncResult.synced} synced, {syncResult.skipped} skipped
                  </span>
                </div>
                <button
                  onClick={() => setSyncResult(null)}
                  className="p-1 hover:bg-[#DCFCE7] rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-[#16A34A]" />
                </button>
              </div>
              {syncResult.details.length > 0 && (
                <div className="px-4 pb-3 space-y-1.5">
                  {syncResult.details
                    .filter((d) => d.action !== 'skipped' || d.reason !== 'host')
                    .map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px]">
                      {d.action === 'skipped' ? (
                        <XCircle className="w-3 h-3 text-[var(--color-text-secondary)] shrink-0" />
                      ) : (
                        <CheckCircle className="w-3 h-3 text-[#16A34A] shrink-0" />
                      )}
                      <span className={d.action === 'skipped' ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-secondary)]'}>
                        {d.name || d.email}
                      </span>
                      {d.action !== 'skipped' && d.joinTime && (
                        <span className="text-[var(--color-text-secondary)]">
                          {new Date(d.joinTime).toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' })}
                          {d.leaveTime && ` – ${new Date(d.leaveTime).toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' })}`}
                          {d.durationMinutes > 0 && ` (${d.durationMinutes} min)`}
                        </span>
                      )}
                      {d.action === 'skipped' && d.reason === 'no_email' && (
                        <span className="text-[#DC2626]">not signed in to Zoom</span>
                      )}
                      {d.action === 'skipped' && d.reason === 'unmatched' && (
                        <span className="text-[#D97706]">email not found: {d.email}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-page)] flex-wrap">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">
              {t("sessionsPage.attendance.summary")}:
            </span>
            <span className="text-xs text-[#16A34A]">{presentCount} {t("sessionsPage.attendance.present")}</span>
            <span className="text-xs text-[#EF4444]">{absentCount} {t("sessionsPage.attendance.absent")}</span>
          </div>

          {/* Bulk actions / lock banner */}
          {isVerifiedReadOnly ? (
            <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-page)]">
              <Lock className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
              <span className="text-xs text-[var(--color-text-secondary)]">
                {attendanceLocked
                  ? (locale === "ar" ? "تم قفل الحضور نهائياً" : "Attendance is finalized & locked")
                  : isPostSession && isZoomSession && hasUnmatched
                    ? (locale === "ar" ? "الحضور المتحقق مقفل — يمكنك تعيين الطلاب غير المتحققين أدناه" : "Verified attendance is locked — assign unmatched participants below")
                    : t("sessionsPage.attendance.readOnly")}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border)]">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">{t("sessionsPage.attendance.markAll")}:</span>
              {statusOptions.map((status) => (
                <button
                  key={status}
                  onClick={() => handleBulkMark(status)}
                  className={`px-2.5 py-1 rounded text-xs font-medium ${getStatusColor(status)} hover:opacity-80 transition-opacity`}
                >
                  {t(`sessionsPage.attendance.${status}`)}
                </button>
              ))}
            </div>
          )}

          {/* Marked by info — shown once for the whole sheet */}
          {(() => {
            const marker = attendanceRecords.find((r) => (r as any).markedByName);
            if (!marker) return null;
            return (
              <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border)] bg-[#FAFAFA] text-[10px] text-[var(--color-text-secondary)]">
                <span>Marked by: <span className="font-medium text-[var(--color-text-secondary)]">{(marker as any).markedByName}</span> ({(marker as any).markedByRole === "TEACHING_ASSISTANT" ? "TA" : (marker as any).markedByRole === "INSTRUCTOR" ? "Instructor" : (marker as any).markedByRole || "System"})</span>
                {(marker as any).updatedAt && (
                  <span>Last updated: {new Date((marker as any).updatedAt).toLocaleTimeString(timeLocale, { hour: "2-digit", minute: "2-digit" })}</span>
                )}
              </div>
            );
          })()}

          {/* Student list */}
          <div className="max-h-[400px] overflow-y-auto">
            {enrollments.length === 0 ? (
              <div className="text-center py-8 text-sm text-[var(--color-text-secondary)]">
                {t("sessionsPage.attendance.noStudents")}
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {enrollments.map((e) => {
                  const currentStatus = localStatuses[e.studentId] || "absent";
                  const rec = attendanceRecords.find((a) => a.studentId === e.studentId);
                  const needsNote = currentStatus === "late" || currentStatus === "excused";
                  return (
                    <div key={e.studentId} className="px-4 py-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                            {e.studentFirstName} {e.studentLastName}
                          </p>
                          <p className="text-xs text-[var(--color-text-secondary)]">{e.studentEmail}</p>
                          {(e as any).studentScfhsNumber && (
                            <p className="text-[10px] text-[var(--color-text-secondary)] font-mono">{(e as any).studentScfhsNumber}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {statusOptions.map((status) => (
                            <button
                              key={status}
                              onClick={() => !isVerifiedReadOnly && handleStatusChange(e.studentId, status)}
                              disabled={isVerifiedReadOnly}
                              className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                                currentStatus === status
                                  ? `${getStatusColor(status)} ring-2 ring-offset-1 ring-current`
                                  : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                              } ${isVerifiedReadOnly ? "cursor-default opacity-70" : ""}`}
                            >
                              {t(`sessionsPage.attendance.${status}`)}
                            </button>
                          ))}
                        </div>
                      </div>
                      {/* Note input for late/excused */}
                      {needsNote && (
                        <input
                          type="text"
                          value={localNotes[e.studentId] || ""}
                          onChange={(ev) =>
                            setLocalNotes((prev) => ({ ...prev, [e.studentId]: ev.target.value }))
                          }
                          placeholder={t("sessionsPage.attendance.notePlaceholder")}
                          className="w-full px-2.5 py-1.5 border border-[var(--color-input-border)] rounded text-xs text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-secondary)] focus:ring-1 focus:ring-[var(--color-input-focus)] focus:border-[var(--color-input-focus)] outline-none"
                        />
                      )}
                      {/* Zoom sync timing data + timeline bar */}
                      {rec?.joinedAt && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-secondary)]">
                            <span>
                              {t("sessionsPage.attendance.joinedAt")}:{" "}
                              {new Date(rec.joinedAt).toLocaleTimeString(timeLocale, { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {rec.leftAt && (
                              <span>
                                {t("sessionsPage.attendance.leftAt")}:{" "}
                                {new Date(rec.leftAt).toLocaleTimeString(timeLocale, { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                            {rec.durationMinutes != null && (
                              <span>{rec.durationMinutes} {t("sessionsPage.form.minutes")}</span>
                            )}
                          </div>
                          {/* Presence bar — width reflects presence % */}
                          {(() => {
                            const sessionStart = session.actualStartedAt ? new Date(session.actualStartedAt).getTime() : new Date(session.scheduledAt).getTime();
                            const sessionEnd = session.actualEndedAt ? new Date(session.actualEndedAt).getTime() : sessionStart + session.durationMinutes * 60000;
                            const actualDurationMin = (sessionEnd - sessionStart) / 60000;
                            const presPercent = (rec as any).presencePercent ?? (actualDurationMin > 0 && rec.durationMinutes ? Math.min(Math.round((rec.durationMinutes / actualDurationMin) * 100), 100) : 0);
                            if (presPercent === 0 && !rec.joinedAt) return null;
                            return (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 relative h-2 bg-[var(--color-border-subtle)] rounded-full overflow-hidden">
                                  <div
                                    className={`absolute top-0 left-0 h-full rounded-full ${presPercent >= 70 ? "bg-[#16A34A]" : "bg-[#EF4444]"}`}
                                    style={{ width: `${Math.max(2, presPercent)}%` }}
                                  />
                                </div>
                                <span className={`text-[10px] font-semibold whitespace-nowrap ${presPercent >= 70 ? "text-[#16A34A]" : "text-[#EF4444]"}`}>{presPercent}%</span>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Unmatched Zoom participants */}
          {/* Item #17: Unmatched Zoom participants with manual assign */}
          {isZoomSession && !attendanceLocked && unmatchedParticipants.length > 0 && (
            <div className="border-t border-[var(--color-border)]">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-[#FEF3C7]">
                <AlertTriangle className="w-3.5 h-3.5 text-[#D97706]" />
                <span className="text-xs font-medium text-[#92400E]">
                  {unmatchedParticipants.length} unmatched Zoom participant{unmatchedParticipants.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="max-h-[200px] overflow-y-auto divide-y divide-[var(--color-border)]">
                {unmatchedParticipants.map((p, i) => {
                  const selectedStudent = manualAssignments[p.zoomUserEmail]
                    ? enrollments.find((e) => e.studentId === manualAssignments[p.zoomUserEmail])
                    : null;
                  return (
                  <div key={i} className="px-4 py-2 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 shrink-0 rounded-full bg-[#FEF3C7] flex items-center justify-center">
                        <Users className="w-3 h-3 text-[#D97706]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-[var(--color-text-secondary)] truncate block">
                          {p.zoomUserEmail}
                          {selectedStudent && (
                            <span className="text-[#16A34A] font-medium">
                              {" → "}{selectedStudent.studentFirstName} {selectedStudent.studentLastName}
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] text-[var(--color-text-secondary)]">
                          {new Date(p.timestamp).toLocaleTimeString(locale === "ar" ? "ar-SA" : "en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ps-8">
                      <select
                        value={manualAssignments[p.zoomUserEmail] || ""}
                        onChange={(e) =>
                          setManualAssignments((prev) => ({
                            ...prev,
                            [p.zoomUserEmail]: e.target.value,
                          }))
                        }
                        disabled={attendanceLocked}
                        className="flex-1 px-2 py-1.5 text-xs border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-card)] text-[var(--color-text-secondary)] disabled:opacity-50"
                      >
                        <option value="">{locale === "ar" ? "اختر طالب" : "Select student"}</option>
                        {enrollments
                          .filter((e) => !markedStudentIds.has(e.studentId))
                          .map((e) => (
                            <option key={e.studentId} value={e.studentId}>
                              {e.studentFirstName} {e.studentLastName}
                            </option>
                          ))}
                      </select>
                      <button
                        onClick={() => handleManualAssign(p.zoomUserEmail)}
                        disabled={!manualAssignments[p.zoomUserEmail] || assigningEmail === p.zoomUserEmail || attendanceLocked}
                        className="px-3 py-1.5 text-xs font-medium bg-[var(--color-primary)] text-white rounded-lg disabled:opacity-40 hover:bg-[var(--color-primary-dark)] transition-colors shrink-0"
                      >
                        {assigningEmail === p.zoomUserEmail ? "..." : locale === "ar" ? "تعيين" : "Assign"}
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-[var(--color-border)]">
            <div />
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                {(attendanceLocked || (isPostSession && isZoomSession && !hasUnmatched))
                  ? t("sessionsPage.attendance.close")
                  : isReadOnly
                    ? t("sessionsPage.attendance.close")
                    : t("sessionsPage.attendance.cancel")}
              </button>
              {/* Save attendance (live sessions) */}
              {!isReadOnly && !isPostSession && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t("sessionsPage.attendance.save")}
                </button>
              )}
              {/* Lock Attendance (post-session — saves + finalizes) */}
              {isPostSession && !attendanceLocked && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  {locale === "ar" ? "قفل" : "Lock"}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </ModalOverlay>
  );
}

// ─── Recordings Modal ───────────────────────────────────────

function RecordingsModal({
  session,
  onClose,
  t,
  locale,
}: {
  session: CourseSession;
  onClose: () => void;
  t: ReturnType<typeof useTranslations>;
  locale: string;
}) {
  const [recordings, setRecordings] = useState<
    Array<{
      id: string;
      recordingType: string;
      downloadUrl: string | null;
      playUrl: string | null;
      fileSize: number | null;
      fileType: string | null;
      recordingStart: string | null;
      recordingEnd: string | null;
      status: string;
      password: string | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await zoomAttendanceApi.getRecordings(session.id);
        // Filter out timeline/metadata files — not useful for viewing
        setRecordings(data.filter((r) => r.recordingType !== 'timeline'));
      } catch {
        // silently handle – empty state will show
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [session.id]);

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return "—";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const formatRecordingType = (type: string) => {
    return type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const timeLocale = locale === "ar" ? "ar-SA" : "en-US";

  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {t("sessionsPage.recordings.title")}
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{session.title}</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors">
          <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
        </div>
      ) : recordings.length === 0 ? (
        <div className="py-12 text-center">
          <Film className="w-10 h-10 text-[var(--color-border)] mx-auto mb-3" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("sessionsPage.recordings.noRecordings")}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--color-border)] max-h-[400px] overflow-y-auto">
          {recordings.map((rec) => (
            <div key={rec.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 bg-[var(--color-border-subtle)] text-[var(--color-primary)] text-[10px] font-medium rounded">
                  {formatRecordingType(rec.recordingType)}
                </span>
                <div className="flex items-center gap-2">
                  {rec.playUrl && (
                    <a
                      href={rec.playUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[var(--color-primary)] border border-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary)] hover:text-white transition-colors"
                    >
                      <Play className="w-3 h-3" />
                      {t("sessionsPage.recordings.play")}
                    </a>
                  )}
                  {rec.downloadUrl && (
                    <a
                      href={rec.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      {t("sessionsPage.recordings.download")}
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-[var(--color-text-secondary)]">
                <span>
                  {t("sessionsPage.recordings.duration")}:{" "}
                  {formatDuration(rec.recordingStart, rec.recordingEnd)}
                </span>
                <span>
                  {t("sessionsPage.recordings.size")}:{" "}
                  {formatFileSize(rec.fileSize)}
                </span>
                {rec.recordingStart && (
                  <span>
                    {new Date(rec.recordingStart).toLocaleTimeString(timeLocale, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-end p-4 border-t border-[var(--color-border)]">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          {t("sessionsPage.form.cancel")}
        </button>
      </div>
    </ModalOverlay>
  );
}

// ─── Cancel Session Modal ────────────────────────────────────

function CancelSessionModal({
  session,
  onClose,
  onConfirm,
  loading,
  t,
}: {
  session: CourseSession;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading?: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const [reason, setReason] = useState("");

  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          {t("sessionsPage.cancelSession.title")}
        </h2>
        <button onClick={onClose} className="p-2 hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors">
          <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
        </button>
      </div>
      <div className="p-4 space-y-4">
        <div className="flex items-start gap-3 p-3 bg-[#FEF3C7] rounded-lg">
          <AlertTriangle className="w-5 h-5 text-[#D97706] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[#92400E]">
            {t("sessionsPage.cancelSession.warning", { title: session.title })}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {t("sessionsPage.cancelSession.reasonLabel")}
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm resize-none"
            rows={3}
            placeholder={t("sessionsPage.cancelSession.reasonPlaceholder")}
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 p-4 border-t border-[var(--color-border)]">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          {t("sessionsPage.cancelSession.goBack")}
        </button>
        <button
          onClick={() => onConfirm(reason)}
          disabled={!reason.trim() || loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#EF4444] text-white text-sm font-medium rounded-lg hover:bg-[#DC2626] transition-colors disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {t("sessionsPage.cancelSession.confirm")}
        </button>
      </div>
    </ModalOverlay>
  );
}

// ─── Delete Session Modal ───────────────────────────────────

function DeleteSessionModal({
  session,
  onClose,
  onConfirm,
  loading,
  t,
}: {
  session: CourseSession;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          {t("sessionsPage.deleteModal.title")}
        </h2>
        <button onClick={onClose} className="p-2 hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors">
          <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
        </button>
      </div>
      <div className="p-4">
        <div className="flex items-start gap-3 p-3 bg-[#FEE2E2] rounded-lg">
          <AlertTriangle className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[#991B1B]">
            {t("sessionsPage.deleteModal.warning", { title: session.title })}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 p-4 border-t border-[var(--color-border)]">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          {t("sessionsPage.deleteModal.goBack")}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#EF4444] text-white text-sm font-medium rounded-lg hover:bg-[#DC2626] transition-colors disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {t("sessionsPage.deleteModal.confirm")}
        </button>
      </div>
    </ModalOverlay>
  );
}

// ─── End Session Modal ──────────────────────────────────────

function EndSessionModal({
  session,
  onClose,
  onConfirm,
  loading,
  t,
}: {
  session: CourseSession;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const hasZoom = session.type === "zoom" || session.type === "hybrid";
  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          {t("sessionsPage.endModal.title")}
        </h2>
        <button onClick={onClose} className="p-2 hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors">
          <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
        </button>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3 p-3 bg-[#FEF3C7] rounded-lg">
          <AlertTriangle className="w-5 h-5 text-[#D97706] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[#92400E]">
            {t("sessionsPage.endModal.warning", { title: session.title })}
          </p>
        </div>
        {hasZoom && (
          <div className="flex items-start gap-3 p-3 bg-[var(--color-border-subtle)] rounded-lg">
            <Video className="w-5 h-5 text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[#1E40AF]">
              {t("sessionsPage.endModal.zoomWarning")}
            </p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-3 p-4 border-t border-[var(--color-border)]">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          {t("sessionsPage.endModal.goBack")}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#EF4444] text-white text-sm font-medium rounded-lg hover:bg-[#DC2626] transition-colors disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {t("sessionsPage.endModal.confirm")}
        </button>
      </div>
    </ModalOverlay>
  );
}

// ─── Schedule Session Modal ──────────────────────────────────

function ScheduleSessionModal({
  courses,
  onClose,
  onScheduled,
  t,
  prefillCourseId,
  isMakeup,
  makeupStudentId,
}: {
  courses: InstructorCourse[];
  onClose: () => void;
  onScheduled: () => void;
  t: ReturnType<typeof useTranslations>;
  prefillCourseId?: string;
  isMakeup?: boolean;
  makeupStudentId?: string;
}) {
  const prefillCourse = prefillCourseId
    ? courses.find((c) => c.id === prefillCourseId)
    : undefined;
  const [courseId, setCourseId] = useState(prefillCourseId || "");
  const [title, setTitle] = useState(
    isMakeup && prefillCourse
      ? t("sessionsPage.makeupTitle", { course: prefillCourse.title })
      : ""
  );
  const [type, setType] = useState<"zoom" | "onsite" | "hybrid">("zoom");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [durationHours, setDurationHours] = useState(1);
  const [durationMins, setDurationMins] = useState(0);
  const duration = durationHours * 60 + durationMins;
  const [roomName, setRoomName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [city, setCity] = useState("");
  const [zoomLink, setZoomLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);

  // Check conflicts when date/time change
  useEffect(() => {
    if (!date || !time) {
      setConflict(null);
      return;
    }
    const checkConflict = async () => {
      try {
        const scheduled = new Date(`${date}T${time}`);
        const endTime = new Date(scheduled.getTime() + duration * 60000);
        const res = await instructorApi.getSessions({ limit: 200 });
        const sessions = res.data;
        const overlapping = sessions.find((s) => {
          if (s.status === "cancelled") return false;
          const sStart = new Date(s.scheduledAt);
          const sEnd = new Date(sStart.getTime() + (s.durationMinutes || 60) * 60000);
          return scheduled < sEnd && endTime > sStart;
        });
        setConflict(overlapping ? overlapping.title : null);
      } catch {
        // Ignore conflict check errors
      }
    };
    checkConflict();
  }, [date, time, duration]);

  const handleSubmit = async () => {
    if (!courseId || !title.trim() || !date || !time) return;
    // Validate past date+time
    const scheduledDate = new Date(`${date}T${time}`);
    if (scheduledDate <= new Date()) {
      toast.error(t("sessionsPage.form.pastTimeError"));
      return;
    }
    // Validate venue for on-site/hybrid
    if ((type === "onsite" || type === "hybrid") && !venueAddress.trim()) {
      toast.error(t("sessionsPage.form.venueRequired"));
      return;
    }
    setSaving(true);
    try {
      const scheduledAt = scheduledDate.toISOString();
      const data: Record<string, unknown> = {
        courseId,
        title: title.trim(),
        type,
        scheduledAt,
        localDate: date,
        durationMinutes: duration,
      };
      if (type === "onsite" || type === "hybrid") {
        if (roomName) data.roomName = roomName;
        if (venueAddress) data.venueAddress = venueAddress;
        if (city) data.city = city;
      }
      if ((type === "zoom" || type === "hybrid") && zoomLink.trim()) {
        data.zoomLink = zoomLink.trim();
      }
      if (isMakeup) {
        data.isMakeup = true;
      }
      await instructorApi.createSession(data);
      // Log intervention record for makeup sessions (also triggers student notification)
      if (isMakeup && makeupStudentId && courseId) {
        await instructorApi.createIntervention({
          type: "makeup_session",
          studentId: makeupStudentId,
          courseId,
        });
      }
      toast.success(
        isMakeup
          ? t("sessionsPage.makeupCreated")
          : t("sessionsPage.schedule.success")
      );
      onScheduled();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || t("sessionsPage.schedule.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          {t("sessionsPage.scheduleSessionTitle")}
        </h2>
        <button onClick={onClose} className="p-2 hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors">
          <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
        </button>
      </div>
      <div className="p-4 space-y-4">
        {/* Course */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {t("sessionsPage.form.course")} *
          </label>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm"
          >
            <option value="">{t("sessionsPage.form.selectCourse")}</option>
            {courses.filter((c) => c.status !== "completed" && c.status !== "archived" && c.deliveryType !== "self-paced").map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {t("sessionsPage.form.sessionTitle")} *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm"
            placeholder={t("sessionsPage.form.sessionTitlePlaceholder")}
          />
        </div>

        {/* Date + Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
              {t("sessionsPage.form.date")} *
            </label>
            <DatePicker
              value={date}
              onChange={setDate}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
              {t("sessionsPage.form.time")} *
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm"
            />
          </div>
        </div>

        {/* Conflict warning */}
        {conflict && (
          <div className="flex items-start gap-2 p-3 bg-[#FEF3C7] rounded-lg">
            <AlertTriangle className="w-4 h-4 text-[#D97706] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#92400E]">
              {t("sessionsPage.schedule.conflict", { session: conflict })}
            </p>
          </div>
        )}

        {/* Duration */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {t("sessionsPage.form.duration")}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={durationHours}
              onChange={(e) => setDurationHours(Math.max(0, Number(e.target.value)))}
              className="w-20 px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm text-center"
            />
            <span className="text-sm text-[var(--color-text-secondary)]">{t("sessionsPage.form.hours")}</span>
            <input
              type="number"
              min={0}
              max={59}
              value={durationMins}
              onChange={(e) => setDurationMins(Math.max(0, Math.min(59, Number(e.target.value))))}
              className="w-20 px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm text-center"
            />
            <span className="text-sm text-[var(--color-text-secondary)]">{t("sessionsPage.form.minutes")}</span>
          </div>
        </div>

        {/* Session Type */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {t("sessionsPage.form.sessionType")}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["zoom", "onsite", "hybrid"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setType(opt)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg transition-colors ${
                  type === opt
                    ? "border-2 border-[var(--color-primary)] bg-[var(--color-border-subtle)] text-[var(--color-primary)]"
                    : "border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:bg-[var(--color-border-subtle)] hover:text-[var(--color-primary)]"
                }`}
              >
                {opt === "zoom" && <Video className="w-5 h-5" />}
                {opt === "onsite" && <MapPin className="w-5 h-5" />}
                {opt === "hybrid" && <RefreshCw className="w-5 h-5" />}
                <span className="text-xs font-medium">
                  {t(`sessionsPage.type.${opt}`)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Zoom auto-create info */}
        {(type === "zoom" || type === "hybrid") && (
          <div className="flex items-start gap-2 p-3 bg-[var(--color-border-subtle)] rounded-lg">
            <Video className="w-4 h-4 text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#1E40AF]">
              {t("sessionsPage.zoomAutoCreate")}
            </p>
          </div>
        )}

        {/* Venue */}
        {(type === "onsite" || type === "hybrid") && (
          <>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                {t("sessionsPage.form.roomName")}
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm"
                placeholder={t("sessionsPage.form.roomNamePlaceholder")}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                {t("sessionsPage.form.venueAddress")}
              </label>
              <input
                type="text"
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
                className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm"
                placeholder={t("sessionsPage.form.venueAddressPlaceholder")}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                {t("sessionsPage.form.city")}
              </label>
              <CitySelect
                value={city}
                onChange={setCity}
                placeholder={t("sessionsPage.form.cityPlaceholder")}
              />
            </div>
          </>
        )}
      </div>
      <div className="flex items-center justify-end gap-3 p-4 border-t border-[var(--color-border)]">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          {t("sessionsPage.form.cancel")}
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !courseId || !title.trim() || !date || !time}
          className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {t("sessionsPage.form.schedule")}
        </button>
      </div>
    </ModalOverlay>
  );
}

// ─── Session Card ────────────────────────────────────────────

function SessionCard({
  session,
  variant,
  onStart,
  onEnd,
  onCancel,
  onFinalize,
  onAttendance,
  onRecordings,
  onEdit,
  onDelete,
  onReschedule,
  onStartAsHost,
  onRegistrants,
  onCopyRegistration,
  onShareWhatsApp,
  registrantsCount,
  actionLoading,
  taThreshold,
  t,
  locale,
}: {
  session: CourseSession;
  variant: "today" | "upcoming" | "past";
  onStart: () => void;
  onEnd: () => void;
  onCancel: () => void;
  onFinalize: () => void;
  onAttendance: () => void;
  onRecordings: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReschedule: () => void;
  onStartAsHost?: () => void;
  onRegistrants?: () => void;
  onCopyRegistration?: () => void;
  onShareWhatsApp?: () => void;
  registrantsCount?: number;
  actionLoading: boolean;
  taThreshold?: ThresholdStatus;
  t: ReturnType<typeof useTranslations>;
  locale: string;
}) {
  const { calendarFormat } = useCalendarPreference();
  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      scheduled: { bg: "bg-[var(--color-border-subtle)]", text: "text-[var(--color-primary)]", label: t("sessionsPage.statusUpcoming") },
      live: { bg: "bg-[#FEE2E2]", text: "text-[#EF4444]", label: t("sessionsPage.statusLive") },
      ended: { bg: "bg-[#FEF3C7]", text: "text-[#D97706]", label: t("sessionsPage.statusEnded") },
      completed: { bg: "bg-[#DCFCE7]", text: "text-[#22C55E]", label: t("sessionsPage.statusCompleted") },
      cancelled: { bg: "bg-[var(--color-border-subtle)]", text: "text-[var(--color-text-secondary)]", label: t("sessionsPage.statusCancelled") },
      missed: { bg: "bg-[#FEE2E2]", text: "text-[#EF4444]", label: t("sessionsPage.statusMissed") },
      rescheduled: { bg: "bg-[#FEF3C7]", text: "text-[#D97706]", label: t("sessionsPage.statusRescheduled") },
    };
    return styles[status] || styles.scheduled;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "zoom": return <Video className="w-4 h-4" />;
      case "onsite": return <MapPin className="w-4 h-4" />;
      case "hybrid": return <RefreshCw className="w-4 h-4" />;
      default: return <Video className="w-4 h-4" />;
    }
  };

  const getTypeBadgeStyle = (type: string) => {
    const styles: Record<string, string> = {
      zoom: "bg-[var(--color-border-subtle)] text-[var(--color-primary)]",
      onsite: "bg-[#DCFCE7] text-[#22C55E]",
      hybrid: "bg-[#F3E8FF] text-[#9333EA]",
    };
    return styles[type] || styles.zoom;
  };

  const badge = getStatusBadge(session.status);
  const isPast = variant === "past";

  const isLive = session.status === "live";

  const isWebinar = !!session.isWebinar;

  return (
    <div className={`px-4 py-3 transition-colors ${
      isLive ? "bg-[#FEF2F2]/50" : isWebinar ? "hover:bg-[#FAF5FF]" : "hover:bg-[var(--color-border-subtle)]"
    } ${isPast ? "opacity-70" : ""}`}>
      {/* Main row */}
      <div className="flex items-center gap-3">
        {/* Type icon */}
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isPast
            ? "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
            : isWebinar
              ? "bg-[#F3E8FF] text-[#A855F7]"
              : getTypeBadgeStyle(session.type)
        }`}>
          {isWebinar ? <Radio className="w-4 h-4" /> : getTypeIcon(session.type)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`text-sm font-semibold truncate ${isPast ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text-primary)]"}`}>
              {session.title}
            </h3>
            {isWebinar && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#A855F7] text-white text-[10px] font-bold rounded-full uppercase tracking-wide flex-shrink-0">
                <Radio className="w-2.5 h-2.5" />
                {locale === "ar" ? "ندوة" : "Webinar"}
              </span>
            )}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${badge.bg} ${badge.text}`}>
              {isLive && <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse" />}
              {badge.label}
            </span>
            {!isWebinar && taThreshold && taThreshold.requiredTAs > 0 && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${
                taThreshold.deficit > 0
                  ? "bg-[#FEF2F2] text-[#EF4444]"
                  : "bg-[#DCFCE7] text-[#22C55E]"
              }`}>
                <Users className="w-3 h-3" />
                {taThreshold.activeTAs}/{taThreshold.requiredTAs} TA
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-[var(--color-text-secondary)]">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDateHijri(session.scheduledAt, calendarFormat, { locale })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatSessionTime(session.scheduledAt, locale)}
              {session.durationMinutes ? ` (${session.durationMinutes}m)` : ""}
            </span>
            {(session.venueAddress || session.roomName) && (
              <span className="flex items-center gap-1 truncate max-w-[200px]">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{session.venueAddress || session.roomName}</span>
              </span>
            )}
            {session.nelcLimit != null && session.nelcLimit > 0 && (
              <span className={`flex items-center gap-1 font-medium ${
                (session.capacityPercent || 0) >= 95 ? "text-[#EF4444]"
                : (session.capacityPercent || 0) >= 80 ? "text-[#D97706]"
                : "text-[var(--color-text-secondary)]"
              }`}>
                <Users className="w-3 h-3" />
                {session.enrolledCount || 0}/{session.nelcLimit}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* ── Webinar: manager-controlled. Instructor only gets
                Start-as-Host (opens Zoom directly) + read-only Registrants. */}
          {isWebinar ? (
            <>
              {onRegistrants && (
                <button
                  onClick={onRegistrants}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#FAF5FF] hover:bg-[#F3E8FF] border border-[#E9D5FF] text-[#7C3AED] text-xs font-semibold rounded-lg transition-colors"
                  title={locale === "ar" ? "عرض المسجلين" : "View registrants"}
                >
                  <Users className="w-3.5 h-3.5" />
                  {registrantsCount ?? 0}
                  <span className="hidden sm:inline">{locale === "ar" ? " مسجل" : " registered"}</span>
                </button>
              )}
              {session.webinarRegistrationUrl && onCopyRegistration && (
                <button
                  type="button"
                  onClick={onCopyRegistration}
                  className="p-1.5 rounded-md text-[#7C3AED] hover:bg-[#F3E8FF] transition-colors"
                  title={locale === "ar" ? "نسخ رابط التسجيل" : "Copy registration link"}
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              )}
              {session.webinarRegistrationUrl && onShareWhatsApp && (
                <button
                  type="button"
                  onClick={onShareWhatsApp}
                  className="p-1.5 rounded-md text-[#25D366] hover:bg-[#DCFCE7] transition-colors"
                  title={locale === "ar" ? "مشاركة عبر واتساب" : "Share via WhatsApp"}
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              )}
              {(session.status === "scheduled" || isLive) && onStartAsHost && (
                <button
                  onClick={onStartAsHost}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#A855F7] hover:bg-[#9333EA] text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors"
                  title={locale === "ar" ? "ابدأ كمضيف" : "Start as Host"}
                >
                  {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Radio className="w-3.5 h-3.5" />}
                  {locale === "ar" ? "ابدأ كمضيف" : "Start as Host"}
                </button>
              )}
              {/* No edit / cancel / mark-attendance on webinars — manager only */}
            </>
          ) : (
            <>
              {session.status === "scheduled" && (
                <>
                  <button
                    onClick={onStart}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[var(--color-primary)] text-white text-xs font-medium rounded-lg hover:bg-[var(--color-primary-dark)] disabled:opacity-50 transition-colors"
                  >
                    {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    {t("sessionsPage.start")}
                  </button>
                  <button onClick={onAttendance} className="p-1.5 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors" aria-label={t("sessionsPage.attendance.title")}>
                    <ClipboardCheck className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={onEdit} className="p-1.5 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors" aria-label={t("sessionsPage.edit")}>
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={onCancel} className="p-1.5 border border-[var(--color-border)] rounded-lg text-[#EF4444] hover:bg-[#FEE2E2] transition-colors" aria-label={t("sessionsPage.cancel")}>
                    <Ban className="w-3.5 h-3.5" />
                  </button>
                </>
              )}

              {isLive && (
                <>
                  <button
                    onClick={onEnd}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#EF4444] text-white text-xs font-medium rounded-lg hover:bg-[#DC2626] disabled:opacity-50 transition-colors"
                  >
                    {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" />}
                    {t("sessionsPage.endSession")}
                  </button>
                  <button onClick={onAttendance} className="p-1.5 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors" aria-label={t("sessionsPage.attendance.title")}>
                    <ClipboardCheck className="w-3.5 h-3.5" />
                  </button>
                  {session.zoomLink && (
                    <a href={session.zoomLink} target="_blank" rel="noopener noreferrer" className="p-1.5 border border-[#BFDBFE] rounded-lg text-[var(--color-primary)] hover:bg-[var(--color-border-subtle)] transition-colors" title={t("sessionsPage.rejoinZoom")}>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </>
              )}

              {session.status === "ended" && (
                <button onClick={onAttendance} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#16A34A] border border-[#BBF7D0] bg-[#F0FDF4] rounded-lg hover:bg-[#DCFCE7] transition-colors">
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  {locale === "ar" ? "الحضور" : "Attendance"}
                </button>
              )}

              {session.status === "completed" && (
                <button onClick={onAttendance} className="p-1.5 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors" aria-label={t("sessionsPage.attendance.title")}>
                  <ClipboardCheck className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Cancelled sessions: no actions — only manager can delete */}

              {session.status === "missed" && (
                <>
                  <button onClick={onReschedule} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#D97706] bg-[#FFFBEB] border border-[#FDE68A] rounded-lg hover:bg-[#FEF3C7] transition-colors">
                    Reschedule
                  </button>
                  <button onClick={onCancel} className="p-1.5 border border-[var(--color-border)] rounded-lg text-[#EF4444] hover:bg-[#FEE2E2] transition-colors">
                    <Ban className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Edit Session Modal ──────────────────────────────────────

function EditSessionModal({
  session,
  onClose,
  onSaved,
  t,
}: {
  session: CourseSession;
  onClose: () => void;
  onSaved: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const scheduled = new Date(session.scheduledAt);
  const [title, setTitle] = useState(session.title);
  const [date, setDate] = useState(
    `${scheduled.getFullYear()}-${String(scheduled.getMonth() + 1).padStart(2, "0")}-${String(scheduled.getDate()).padStart(2, "0")}`
  );
  const [time, setTime] = useState(
    `${String(scheduled.getHours()).padStart(2, "0")}:${String(scheduled.getMinutes()).padStart(2, "0")}`
  );
  const initDur = session.durationMinutes || 60;
  const [durationHours, setDurationHours] = useState(Math.floor(initDur / 60));
  const [durationMins, setDurationMins] = useState(initDur % 60);
  const duration = durationHours * 60 + durationMins;
  const [roomName, setRoomName] = useState(session.roomName || "");
  const [venueAddress, setVenueAddress] = useState(session.venueAddress || "");
  const [city, setCity] = useState(session.city || "");
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);

  // Conflict detection
  useEffect(() => {
    if (!date || !time) {
      setConflict(null);
      return;
    }
    const checkConflict = async () => {
      try {
        const scheduledDt = new Date(`${date}T${time}`);
        const endTime = new Date(scheduledDt.getTime() + duration * 60000);
        const res = await instructorApi.getSessions({ limit: 200 });
        const sessions = res.data;
        const overlapping = sessions.find((s) => {
          if (s.id === session.id) return false; // Exclude current session
          if (s.status === "cancelled") return false;
          const sStart = new Date(s.scheduledAt);
          const sEnd = new Date(sStart.getTime() + (s.durationMinutes || 60) * 60000);
          return scheduledDt < sEnd && endTime > sStart;
        });
        setConflict(overlapping ? overlapping.title : null);
      } catch {
        // Ignore conflict check errors
      }
    };
    checkConflict();
  }, [date, time, duration, session.id]);

  const handleSave = async () => {
    if (!title.trim() || !date || !time) return;
    // Validate past date+time
    const scheduledDate = new Date(`${date}T${time}`);
    if (scheduledDate <= new Date()) {
      toast.error(t("sessionsPage.form.pastTimeError"));
      return;
    }
    // Validate venue for on-site/hybrid
    if ((session.type === "onsite" || session.type === "hybrid") && !venueAddress.trim()) {
      toast.error(t("sessionsPage.form.venueRequired"));
      return;
    }
    setSaving(true);
    try {
      const scheduledAt = scheduledDate.toISOString();
      const data: Record<string, unknown> = {
        title: title.trim(),
        scheduledAt,
        localDate: date,
        durationMinutes: duration,
      };
      if (session.type === "onsite" || session.type === "hybrid") {
        data.roomName = roomName || null;
        data.venueAddress = venueAddress || null;
        data.city = city || null;
      }
      await instructorApi.updateSession(session.id, data);
      toast.success(t("sessionsPage.editModal.success"));
      onSaved();
      onClose();
    } catch {
      toast.error(t("sessionsPage.editModal.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          {t("sessionsPage.editModal.title")}
        </h2>
        <button onClick={onClose} className="p-2 hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors">
          <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
        </button>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {t("sessionsPage.form.sessionTitle")}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
              {t("sessionsPage.form.date")}
            </label>
            <DatePicker
              value={date}
              onChange={setDate}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
              {t("sessionsPage.form.time")}
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm"
            />
          </div>
        </div>

        {/* Conflict warning */}
        {conflict && (
          <div className="flex items-start gap-2 p-3 bg-[#FEF3C7] rounded-lg">
            <AlertTriangle className="w-4 h-4 text-[#D97706] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#92400E]">
              {t("sessionsPage.schedule.conflict", { session: conflict })}
            </p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {t("sessionsPage.form.duration")}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={durationHours}
              onChange={(e) => setDurationHours(Math.max(0, Number(e.target.value)))}
              className="w-20 px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm text-center"
            />
            <span className="text-sm text-[var(--color-text-secondary)]">{t("sessionsPage.form.hours")}</span>
            <input
              type="number"
              min={0}
              max={59}
              value={durationMins}
              onChange={(e) => setDurationMins(Math.max(0, Math.min(59, Number(e.target.value))))}
              className="w-20 px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm text-center"
            />
            <span className="text-sm text-[var(--color-text-secondary)]">{t("sessionsPage.form.minutes")}</span>
          </div>
        </div>
        {(session.type === "onsite" || session.type === "hybrid") && (
          <>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                {t("sessionsPage.form.roomName")}
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                {t("sessionsPage.form.venueAddress")} *
              </label>
              <input
                type="text"
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
                className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                {t("sessionsPage.form.city")}
              </label>
              <CitySelect
                value={city}
                onChange={setCity}
                placeholder={t("sessionsPage.form.cityPlaceholder")}
              />
            </div>
          </>
        )}
      </div>
      <div className="flex items-center justify-end gap-3 p-4 border-t border-[var(--color-border)]">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          {t("sessionsPage.form.cancel")}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !title.trim() || !date || !time}
          className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {t("sessionsPage.editModal.save")}
        </button>
      </div>
    </ModalOverlay>
  );
}

// ═════════════════════════════════════════════════════════════
// Main SessionsContent Component
// ═════════════════════════════════════════════════════════════

const SessionsContent = () => {
  const instructor = useInstructorProfile();
  const locale = useLocale();
  const t = useTranslations("instructorDashboard");
  const tToasts = useTranslations("toasts");
  const searchParams = useSearchParams();

  // View mode — initialize from ?view= query param if present
  const [viewMode, setViewMode] = useState<"calendar" | "list">(() => {
    const view = searchParams.get("view");
    return view === "calendar" ? "calendar" : "list";
  });

  // Filters
  const [filterCourse, setFilterCourse] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");

  // Data
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [courses, setCourses] = useState<InstructorCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [pastLimit, setPastLimit] = useState(10);
  const [rescheduleSession, setRescheduleSession] = useState<CourseSession | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState({ reason: "", date: "", time: "", durationHours: 1, durationMins: 0 });
  const [rescheduleSaving, setRescheduleSaving] = useState(false);

  // Calendar
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Modals
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [attendanceSession, setAttendanceSession] = useState<CourseSession | null>(null);
  const [cancelSessionData, setCancelSessionData] = useState<CourseSession | null>(null);
  const [deleteSessionData, setDeleteSessionData] = useState<CourseSession | null>(null);
  const [endSessionData, setEndSessionData] = useState<CourseSession | null>(null);
  const [editSessionData, setEditSessionData] = useState<CourseSession | null>(null);
  const [recordingsSession, setRecordingsSession] = useState<CourseSession | null>(null);

  // Webinar registrants drawer (instructor sees it read-only — Copy/WhatsApp
  // hidden via the readOnly prop on the shared component).
  const [registrantsDrawer, setRegistrantsDrawer] = useState<{
    sessionId: string;
    sessionTitle: string;
    scheduledAt: string;
    registrationUrl: string | null;
  } | null>(null);
  const [webinarCounts, setWebinarCounts] = useState<Record<string, number>>({});

  // Makeup session pre-fill from query params
  const makeupCourseId = searchParams.get("courseId") || undefined;
  const isMakeupParam = searchParams.get("isMakeup") === "true";
  const makeupStudentId = searchParams.get("studentId") || undefined;

  // Auto-open schedule modal when navigating from AtRiskLearners
  useEffect(() => {
    if (searchParams.get("openSchedule") === "true") {
      setShowScheduleModal(true);
    }
  }, [searchParams]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessionsRes, coursesRes] = await Promise.all([
        instructorApi.getSessions({ limit: 200 }),
        instructorApi.getCourses({ limit: 100 }),
      ]);
      setSessions(sessionsRes.data);
      setCourses(coursesRes.data);
    } catch {
      setError(t("sessionsPage.loadError"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // TA threshold status per course
  const [taThresholds, setTaThresholds] = useState<Record<string, ThresholdStatus>>({});

  useEffect(() => {
    if (sessions.length === 0) return;
    const courseIds = [...new Set(sessions.map((s) => s.courseId))];
    Promise.all(
      courseIds.map((id) =>
        courseAssistantsApi.getThresholdStatus(id).then((status) => [id, status] as const).catch(() => null)
      )
    ).then((results) => {
      const map: Record<string, ThresholdStatus> = {};
      for (const r of results) {
        if (r) map[r[0]] = r[1];
      }
      setTaThresholds(map);
    });
  }, [sessions]);

  // Poll for status changes when there are live sessions
  // This detects when a Zoom meeting ends (via webhook) and auto-updates the UI
  const hasLiveSessions = useMemo(
    () => sessions.some((s) => s.status === "live"),
    [sessions],
  );

  useEffect(() => {
    if (!hasLiveSessions) return;

    // Item #19: Only poll live session IDs instead of all 200 sessions
    const liveSessionIds = sessions.filter((s) => s.status === "live").map((s) => s.id);
    const interval = setInterval(async () => {
      try {
        const res = await instructorApi.getSessions({ status: "live", limit: 50 });
        const freshLive = res.data;
        // Check if any previously-live session is no longer live (ended)
        const ended = liveSessionIds.filter(
          (id) => !freshLive.find((n) => n.id === id),
        );
        if (ended.length > 0) {
          // Full refresh to get updated statuses
          const fullRes = await instructorApi.getSessions({ limit: 200 });
          setSessions(fullRes.data);
          for (const id of ended) {
            const s = sessions.find((s) => s.id === id);
            if (s) toast.success(t("sessionsPage.lifecycle.sessionEnded", { title: s.title }));
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [hasLiveSessions, sessions]);

  // Lazy-load registrant counts for visible webinar rows so the chip on
  // each webinar action area shows "X registered" without per-row fetches.
  useEffect(() => {
    const ids = sessions
      .filter((s: any) => s.isWebinar && webinarCounts[s.id] === undefined)
      .map((s) => s.id);
    if (ids.length === 0) return;
    let cancelled = false;
    Promise.all(
      ids.map((id) =>
        courseManagerApi
          .getWebinarRegistrants(id)
          .then((res) => [id, res.totalRegistered] as const)
          .catch(() => null),
      ),
    ).then((results) => {
      if (cancelled) return;
      setWebinarCounts((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r) next[r[0]] = r[1];
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [sessions, webinarCounts]);

  // Date range validation
  const dateRangeInvalid = !!(filterDateFrom && filterDateTo && filterDateFrom > filterDateTo);

  // Filter sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (filterCourse !== "all" && s.courseId !== filterCourse) return false;
      if (filterStatus !== "all" && s.status !== filterStatus) return false;
      // Skip date filtering when range is invalid
      if (!dateRangeInvalid) {
        if (filterDateFrom) {
          const sessionDate = getDateStr(s.scheduledAt);
          if (sessionDate < filterDateFrom) return false;
        }
        if (filterDateTo) {
          const sessionDate = getDateStr(s.scheduledAt);
          if (sessionDate > filterDateTo) return false;
        }
      }
      return true;
    });
  }, [sessions, filterCourse, filterStatus, filterDateFrom, filterDateTo, dateRangeInvalid]);

  // Group sessions for list view
  const todayStr = getTodayStr();
  const todaySessions = useMemo(
    () => filteredSessions.filter((s) => getDateStr(s.scheduledAt) === todayStr && s.status !== "cancelled"),
    [filteredSessions, todayStr]
  );
  const upcomingSessions = useMemo(
    () => filteredSessions
      .filter((s) => {
        const d = getDateStr(s.scheduledAt);
        return d > todayStr && (s.status === "scheduled" || s.status === "live");
      })
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    [filteredSessions, todayStr]
  );
  const pastSessions = useMemo(
    () => filteredSessions
      .filter((s) => {
        const d = getDateStr(s.scheduledAt);
        return d < todayStr || s.status === "completed" || s.status === "cancelled";
      })
      .filter((s) => !todaySessions.includes(s))
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()),
    [filteredSessions, todayStr, todaySessions]
  );

  // Lifecycle actions
  const handleStart = async (session: CourseSession) => {
    if (actionLoadingId) return;
    setActionLoadingId(session.id);
    try {
      const result = await instructorApi.startSession(session.id);
      toast.success(t("sessionsPage.lifecycle.started"));
      if ((result as any).zoomStartUrl) {
        window.open((result as any).zoomStartUrl, "_blank");
      }
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || t("sessionsPage.lifecycle.startError"));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Webinar: open Zoom's host start_url directly. We don't flip the
  // session to 'live' from our side — Zoom's webinar.started webhook does.
  const handleStartAsHost = async (session: CourseSession) => {
    if (actionLoadingId) return;
    setActionLoadingId(session.id);
    try {
      const result = await courseManagerApi.getWebinarStartUrl(session.id);
      if (result.startUrl) {
        window.open(result.startUrl, "_blank", "noopener,noreferrer");
      } else {
        toast.error(locale === "ar" ? "تعذر فتح رابط الندوة" : "Could not get webinar start URL");
      }
    } catch (err: any) {
      toast.error(err?.message || (locale === "ar" ? "تعذر فتح رابط الندوة" : "Could not open webinar"));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenRegistrants = (session: CourseSession) => {
    setRegistrantsDrawer({
      sessionId: session.id,
      sessionTitle: session.title,
      scheduledAt: session.scheduledAt,
      registrationUrl: session.webinarRegistrationUrl || null,
    });
  };

  const handleCopyRegistration = (session: CourseSession) => {
    const url = session.webinarRegistrationUrl;
    if (!url) return;
    navigator.clipboard.writeText(url);
    toast.success(locale === "ar" ? "تم نسخ الرابط" : "Registration link copied");
  };

  const handleShareWebinarWhatsApp = (session: CourseSession) => {
    const url = session.webinarRegistrationUrl;
    if (!url) return;
    const when = new Date(session.scheduledAt).toLocaleString(
      locale === "ar" ? "ar-SA" : "en-US",
      { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" },
    );
    const msg = locale === "ar"
      ? `📅 ${session.title}\n🕐 ${when}\n\nسجل عبر:\n${url}`
      : `📅 ${session.title}\n🕐 ${when}\n\nRegister here:\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  };

  const handleEnd = (session: CourseSession) => {
    setEndSessionData(session);
  };

  const confirmEnd = async () => {
    if (!endSessionData || actionLoadingId) return;
    setActionLoadingId(endSessionData.id);
    try {
      const result = await instructorApi.endSession(endSessionData.id);
      toast.success(t("sessionsPage.lifecycle.ended"));
      if ((result as any).zoomEndedSuccessfully === false) {
        const errorDetail = (result as any).zoomErrorMessage;
        toast.warning(
          errorDetail
            ? t("sessionsPage.lifecycle.zoomEndFailedDetail", { error: errorDetail })
            : t("sessionsPage.lifecycle.zoomEndFailed"),
          { duration: 8000 }
        );
      }
      setEndSessionData(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || t("sessionsPage.lifecycle.endError"));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancel = async (reason: string) => {
    if (!cancelSessionData || actionLoadingId) return;
    setActionLoadingId(cancelSessionData.id);
    try {
      await instructorApi.cancelSession(cancelSessionData.id, reason);
      toast.success(t("sessionsPage.lifecycle.cancelled"));
      setCancelSessionData(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || t("sessionsPage.lifecycle.cancelError"));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleFinalize = async (session: CourseSession) => {
    if (actionLoadingId) return;
    setActionLoadingId(session.id);
    try {
      await instructorApi.finalizeSession(session.id);
      toast.success(t("sessionsPage.lifecycle.finalized"));
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || t("sessionsPage.lifecycle.finalizeError"));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = (session: CourseSession) => {
    setDeleteSessionData(session);
  };

  const confirmDelete = async () => {
    if (!deleteSessionData || actionLoadingId) return;
    setActionLoadingId(deleteSessionData.id);
    try {
      await instructorApi.deleteSession(deleteSessionData.id);
      toast.success(t("sessionsPage.lifecycle.deleted"));
      setDeleteSessionData(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || t("sessionsPage.lifecycle.deleteError"));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Calendar helpers
  const isRTL = locale === "ar";
  const { calendarFormat, setCalendarFormat } = useCalendarPreference();
  const useHijri = calendarFormat === "hijri";

  // ── Hijri calendar helpers (Umm al-Qura) ──
  const hijriFormatter = useMemo(() => new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "numeric", year: "numeric" }), []);
  const getHijriParts = (date: Date) => {
    const parts = hijriFormatter.formatToParts(date);
    return {
      day: parseInt(parts.find((p) => p.type === "day")?.value || "0"),
      month: parseInt(parts.find((p) => p.type === "month")?.value || "0"),
      year: parseInt(parts.find((p) => p.type === "year")?.value || "0"),
    };
  };
  const getHijriMonthStart = (date: Date): Date => {
    const d = new Date(date);
    while (getHijriParts(d).day > 1) d.setDate(d.getDate() - 1);
    return d;
  };
  const getHijriMonthDays = (date: Date): Date[] => {
    const start = getHijriMonthStart(date);
    const { month } = getHijriParts(start);
    const days: Date[] = [];
    const d = new Date(start);
    while (getHijriParts(d).month === month) {
      days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return days;
  };
  const hijriMonthNames = [
    "محرّم", "صفر", "ربيع الأول", "ربيع الثاني",
    "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان",
    "رمضان", "شوّال", "ذو القعدة", "ذو الحجة",
  ];

  // ── Calendar computations (Hijri when toggled, Gregorian otherwise) ──
  const calendarData = useMemo(() => {
    if (useHijri) {
      const hijriDays = getHijriMonthDays(calendarDate);
      const firstDay = hijriDays[0];
      const { month, year } = getHijriParts(firstDay);
      return {
        daysInMonth: hijriDays.length,
        firstDayOfMonth: firstDay.getDay(),
        headerLabel: `${hijriMonthNames[month - 1]} ${year}`,
        getGregorianDate: (dayIndex: number) => hijriDays[dayIndex - 1],
      };
    }
    const daysInMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1).getDay();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return {
      daysInMonth,
      firstDayOfMonth,
      headerLabel: `${monthNames[calendarDate.getMonth()]} ${calendarDate.getFullYear()}`,
      getGregorianDate: (dayIndex: number) => new Date(calendarDate.getFullYear(), calendarDate.getMonth(), dayIndex),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarDate, useHijri]);

  const dayNames = useHijri
    ? ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const goToPrevMonth = () => {
    if (useHijri) {
      const start = getHijriMonthStart(calendarDate);
      const prev = new Date(start);
      prev.setDate(prev.getDate() - 1);
      setCalendarDate(prev);
    } else {
      setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1));
    }
  };
  const goToNextMonth = () => {
    if (useHijri) {
      const days = getHijriMonthDays(calendarDate);
      const nextDay = new Date(days[days.length - 1]);
      nextDay.setDate(nextDay.getDate() + 1);
      setCalendarDate(nextDay);
    } else {
      setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1));
    }
  };

  const getSessionsForDate = (day: number) => {
    const gDate = calendarData.getGregorianDate(day);
    const dateStr = `${gDate.getFullYear()}-${String(gDate.getMonth() + 1).padStart(2, "0")}-${String(gDate.getDate()).padStart(2, "0")}`;
    return filteredSessions.filter((s) => getDateStr(s.scheduledAt) === dateStr);
  };

  const getCalendarDotColor = (status: string) => {
    switch (status) {
      case "scheduled": return "bg-[var(--color-primary)]";
      case "live": return "bg-[#EF4444]";
      case "ended": return "bg-[#D97706]";
      case "completed": return "bg-[#22C55E]";
      case "cancelled": return "bg-[var(--color-text-secondary)]";
      default: return "bg-[var(--color-primary)]";
    }
  };

  // Session group renderer
  const renderSessionGroup = (groupTitle: string, groupSessions: CourseSession[], variant: "today" | "upcoming" | "past", limit?: number) => {
    const displaySessions = limit ? groupSessions.slice(0, limit) : groupSessions;
    const hasMore = limit ? groupSessions.length > limit : false;
    return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)]">
      <div className="p-4 border-b border-[var(--color-border)]">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          {groupTitle}
          <span className="ml-2 text-xs font-normal text-[var(--color-text-secondary)]">({groupSessions.length})</span>
        </h2>
      </div>
      {groupSessions.length === 0 ? (
        <div className="p-8 text-center text-sm text-[var(--color-text-secondary)]">
          {t("sessionsPage.noSessions")}
        </div>
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {displaySessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              variant={variant}
              onStart={() => handleStart(session)}
              onEnd={() => handleEnd(session)}
              onCancel={() => setCancelSessionData(session)}
              onAttendance={() => setAttendanceSession(session)}
              onRecordings={() => setRecordingsSession(session)}
              onEdit={() => setEditSessionData(session)}
              onFinalize={() => handleFinalize(session)}
              onDelete={() => handleDelete(session)}
              onReschedule={() => {
                setRescheduleSession(session);
                setRescheduleForm({ reason: "", date: "", time: "", durationHours: Math.floor((session.durationMinutes || 60) / 60), durationMins: (session.durationMinutes || 60) % 60 });
              }}
              onStartAsHost={() => handleStartAsHost(session)}
              onRegistrants={() => handleOpenRegistrants(session)}
              onCopyRegistration={() => handleCopyRegistration(session)}
              onShareWhatsApp={() => handleShareWebinarWhatsApp(session)}
              registrantsCount={webinarCounts[session.id]}
              actionLoading={actionLoadingId === session.id}
              taThreshold={taThresholds[session.courseId]}
              t={t}
              locale={locale}
            />
          ))}
          {hasMore && (
            <button
              onClick={() => setPastLimit(l => l + 10)}
              className="w-full py-3 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-border-subtle)] transition-colors border-t border-[var(--color-border)]"
            >
              Show more ({groupSessions.length - (limit || 0)} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  );};

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

            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
                    {t("sessionsPage.title")}
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    {t("sessionsPage.subtitle")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {/* View Toggle */}
                  <div className="flex items-center bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg p-1">
                    <button
                      onClick={() => setViewMode("list")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        viewMode === "list"
                          ? "btn-gold text-[var(--color-button-text)]"
                          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                      }`}
                    >
                      <List className="w-4 h-4" />
                      {t("sessionsPage.listView")}
                    </button>
                    <button
                      onClick={() => setViewMode("calendar")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        viewMode === "calendar"
                          ? "btn-gold text-[var(--color-button-text)]"
                          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                      }`}
                    >
                      <Calendar className="w-4 h-4" />
                      {t("sessionsPage.calendarView")}
                    </button>
                  </div>
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    {t("sessionsPage.scheduleSession")}
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
                  <Filter className="w-4 h-4" />
                  {t("sessionsPage.filters")}:
                </div>
                <select
                  value={filterCourse}
                  onChange={(e) => setFilterCourse(e.target.value)}
                  className="px-3 py-1.5 border border-[var(--color-input-border)] rounded-lg text-sm bg-[var(--color-surface-card)]"
                >
                  <option value="all">{t("sessionsPage.allCourses")}</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-1.5 border border-[var(--color-input-border)] rounded-lg text-sm bg-[var(--color-surface-card)]"
                >
                  <option value="all">{t("sessionsPage.allStatuses")}</option>
                  <option value="scheduled">{t("sessionsPage.statusUpcoming")}</option>
                  <option value="live">{t("sessionsPage.statusLive")}</option>
                  <option value="completed">{t("sessionsPage.statusCompleted")}</option>
                  <option value="cancelled">{t("sessionsPage.statusCancelled")}</option>
                </select>
                <DatePicker
                  value={filterDateFrom}
                  onChange={setFilterDateFrom}
                  id="filter-date-from"
                />
                <DatePicker
                  value={filterDateTo}
                  onChange={setFilterDateTo}
                  id="filter-date-to"
                />
                {(filterDateFrom || filterDateTo) && (
                  <button
                    onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }}
                    className="px-2 py-1.5 text-xs text-[#EF4444] hover:bg-[#FEE2E2] rounded-lg"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {dateRangeInvalid && (
                <span className="flex items-center gap-1 text-xs text-[#D97706]">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {t("sessionsPage.dateRangeWarning")}
                </span>
              )}

              {/* Loading */}
              {loading && (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-[var(--color-text-secondary)]" />
                </div>
              )}

              {/* Error */}
              {error && !loading && (
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-8 text-center">
                  <p className="text-sm text-[#EF4444] mb-3">{error}</p>
                  <button
                    onClick={fetchData}
                    className="px-4 py-2 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg"
                  >
                    {t("sessionsPage.retry")}
                  </button>
                </div>
              )}

              {/* List View */}
              {!loading && !error && viewMode === "list" && (
                <div className="space-y-4">
                  {renderSessionGroup(t("sessionsPage.today"), todaySessions, "today")}
                  {renderSessionGroup(t("sessionsPage.upcoming"), upcomingSessions, "upcoming")}
                  {renderSessionGroup(t("sessionsPage.past"), pastSessions, "past", pastLimit)}
                </div>
              )}

              {/* Calendar View */}
              {!loading && !error && viewMode === "calendar" && (
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                  {/* Calendar Header */}
                  <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
                    <button
                      onClick={goToPrevMonth}
                      className="p-2 hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors"
                    >
                      {isRTL ? <ChevronRight className="w-5 h-5 text-[var(--color-text-secondary)]" /> : <ChevronLeft className="w-5 h-5 text-[var(--color-text-secondary)]" />}
                    </button>
                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                      {calendarData.headerLabel}
                    </h2>
                    <button
                      onClick={goToNextMonth}
                      className="p-2 hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors"
                    >
                      {isRTL ? <ChevronLeft className="w-5 h-5 text-[var(--color-text-secondary)]" /> : <ChevronRight className="w-5 h-5 text-[var(--color-text-secondary)]" />}
                    </button>
                  </div>

                  {/* Calendar type toggle + Legend */}
                  <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-page)]">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary)]" />
                        {t("sessionsPage.statusUpcoming")}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                        {t("sessionsPage.statusLive")}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]" />
                        {t("sessionsPage.statusCompleted")}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                        <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-text-secondary)]" />
                        {t("sessionsPage.statusCancelled")}
                      </span>
                    </div>
                    <button
                      onClick={() => setCalendarFormat(useHijri ? "gregorian" : "hijri")}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border border-[var(--color-border)] hover:bg-[var(--color-surface-card)] transition-colors text-[var(--color-text-secondary)]"
                    >
                      {useHijri ? (t("sessionsPage.gregorian") || "Gregorian") : (t("sessionsPage.hijri") || "Hijri")}
                    </button>
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7">
                    {/* Day Headers */}
                    {dayNames.map((day) => (
                      <div key={day} className="p-3 text-center text-xs font-medium text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
                        {day}
                      </div>
                    ))}

                    {/* Empty cells */}
                    {Array.from({ length: calendarData.firstDayOfMonth }).map((_, i) => (
                      <div key={`empty-${i}`} className="min-h-[100px] p-2 border-b border-r border-[var(--color-border)] bg-[var(--color-surface-page)]" />
                    ))}

                    {/* Days */}
                    {Array.from({ length: calendarData.daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const daySessions = getSessionsForDate(day);
                      const gDate = calendarData.getGregorianDate(day);
                      const now = new Date();
                      const isToday = gDate.getDate() === now.getDate() && gDate.getMonth() === now.getMonth() && gDate.getFullYear() === now.getFullYear();

                      return (
                        <div
                          key={day}
                          className={`min-h-[100px] p-2 border-b border-r border-[var(--color-border)] ${isToday ? "bg-[var(--color-border-subtle)]" : ""}`}
                        >
                          <span className={`inline-flex items-center justify-center w-7 h-7 text-sm ${
                            isToday ? "bg-[var(--color-primary)] text-white rounded-full font-semibold" : "text-[var(--color-text-primary)]"
                          }`}>
                            {day}
                          </span>
                          <div className="mt-1 space-y-1">
                            {daySessions.slice(0, 2).map((session) => (
                              <div
                                key={session.id}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] truncate cursor-pointer hover:opacity-80"
                                title={`${session.title} - ${formatSessionTime(session.scheduledAt, locale)}`}
                              >
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getCalendarDotColor(session.status)}`} />
                                <span className="truncate text-[var(--color-text-secondary)]">{session.title}</span>
                              </div>
                            ))}
                            {daySessions.length > 2 && (
                              <div className="text-[10px] text-[var(--color-text-secondary)] px-1.5">
                                +{daySessions.length - 2} {t("sessionsPage.more")}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showScheduleModal && (
        <ScheduleSessionModal
          courses={courses}
          onClose={() => setShowScheduleModal(false)}
          onScheduled={fetchData}
          t={t}
          prefillCourseId={makeupCourseId}
          isMakeup={isMakeupParam}
          makeupStudentId={makeupStudentId}
        />
      )}

      {attendanceSession && (
        <AttendanceModal
          session={attendanceSession}
          onClose={() => setAttendanceSession(null)}
          t={t}
          locale={locale}
        />
      )}

      {registrantsDrawer && (
        <WebinarRegistrantsDrawer
          sessionId={registrantsDrawer.sessionId}
          sessionTitle={registrantsDrawer.sessionTitle}
          scheduledAt={registrantsDrawer.scheduledAt}
          registrationUrl={registrantsDrawer.registrationUrl}
          onClose={() => setRegistrantsDrawer(null)}
        />
      )}

      {cancelSessionData && (
        <CancelSessionModal
          session={cancelSessionData}
          onClose={() => setCancelSessionData(null)}
          onConfirm={handleCancel}
          loading={actionLoadingId === cancelSessionData.id}
          t={t}
        />
      )}

      {rescheduleSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[var(--color-surface-card)] rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Reschedule Lecture</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Reason *</label>
                <textarea value={rescheduleForm.reason} onChange={(e) => setRescheduleForm(d => ({ ...d, reason: e.target.value }))} rows={2} placeholder="Why is this lecture being rescheduled?" className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">New Date *</label>
                  <DatePicker value={rescheduleForm.date} onChange={(v) => setRescheduleForm(d => ({ ...d, date: v }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">New Time *</label>
                  <input type="time" value={rescheduleForm.time} onChange={(e) => setRescheduleForm(d => ({ ...d, time: e.target.value }))} className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)]" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Duration</label>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} value={rescheduleForm.durationHours} onChange={(e) => setRescheduleForm(d => ({ ...d, durationHours: Math.max(0, Number(e.target.value)) }))} className="w-20 px-3 py-2 border border-[var(--color-input-border)] rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)]" />
                  <span className="text-sm text-[var(--color-text-secondary)]">hrs</span>
                  <input type="number" min={0} max={59} value={rescheduleForm.durationMins} onChange={(e) => setRescheduleForm(d => ({ ...d, durationMins: Math.max(0, Math.min(59, Number(e.target.value))) }))} className="w-20 px-3 py-2 border border-[var(--color-input-border)] rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)]" />
                  <span className="text-sm text-[var(--color-text-secondary)]">min</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setRescheduleSession(null)} className="px-4 py-2 text-sm text-[var(--color-text-secondary)]">Cancel</button>
              <button
                onClick={async () => {
                  if (!rescheduleForm.reason.trim() || !rescheduleForm.date || !rescheduleForm.time) { toast.error(tToasts("fillRequiredFields")); return; }
                  setRescheduleSaving(true);
                  try {
                    const newScheduledAt = new Date(`${rescheduleForm.date}T${rescheduleForm.time}`).toISOString();
                    await instructorApi.rescheduleSession(rescheduleSession.id, { reason: rescheduleForm.reason.trim(), newScheduledAt, newDurationMinutes: (rescheduleForm.durationHours * 60 + rescheduleForm.durationMins) || 60 });
                    toast.success(tToasts("lectureRescheduled"));
                    setRescheduleSession(null);
                    fetchData();
                  } catch (err: any) { toast.error(err?.message || "Failed"); } finally { setRescheduleSaving(false); }
                }}
                disabled={rescheduleSaving || !rescheduleForm.reason.trim() || !rescheduleForm.date || !rescheduleForm.time}
                className="px-4 py-2 bg-[#D97706] text-white text-sm font-medium rounded-lg hover:bg-[#B45309] disabled:opacity-50"
              >
                {rescheduleSaving ? "Rescheduling..." : "Reschedule"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteSessionData && (
        <DeleteSessionModal
          session={deleteSessionData}
          onClose={() => setDeleteSessionData(null)}
          onConfirm={confirmDelete}
          loading={actionLoadingId === deleteSessionData.id}
          t={t}
        />
      )}

      {endSessionData && (
        <EndSessionModal
          session={endSessionData}
          onClose={() => setEndSessionData(null)}
          onConfirm={confirmEnd}
          loading={actionLoadingId === endSessionData.id}
          t={t}
        />
      )}

      {editSessionData && (
        <EditSessionModal
          session={editSessionData}
          onClose={() => setEditSessionData(null)}
          onSaved={fetchData}
          t={t}
        />
      )}

    </>
  );
};

export default SessionsContent;
