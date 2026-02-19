"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import InstructorNavbar from "./InstructorNavbar";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import { useInstructorProfile } from "@/hooks/useInstructorProfile";
import { instructorApi } from "@/lib/api";
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
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────

function formatSessionDate(iso: string, locale: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

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
      <div className="relative bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto scrollbar-hide">
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
}: {
  session: CourseSession;
  onClose: () => void;
  t: ReturnType<typeof useTranslations>;
  locale: string;
}) {
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localStatuses, setLocalStatuses] = useState<Record<string, AttendanceStatus>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const [att, enr] = await Promise.all([
          instructorApi.getSessionAttendance(session.id),
          instructorApi.getCourseEnrollments(session.courseId),
        ]);
        setEnrollments(enr);

        // Initialize local statuses from existing attendance records
        const existing: Record<string, AttendanceStatus> = {};
        for (const a of att) {
          existing[a.studentId] = a.status as AttendanceStatus;
        }
        setLocalStatuses(existing);
      } catch {
        toast.error(t("sessionsPage.attendance.loadError"));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [session.id, session.courseId, t]);

  const statusOptions: AttendanceStatus[] = ["present", "absent", "late", "excused"];

  const getStatusColor = (status: AttendanceStatus) => {
    switch (status) {
      case "present": return "bg-[#DCFCE7] text-[#16A34A]";
      case "absent": return "bg-[#FEE2E2] text-[#EF4444]";
      case "late": return "bg-[#FEF3C7] text-[#D97706]";
      case "excused": return "bg-[#EFF6FF] text-[#3B82F6]";
    }
  };

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setLocalStatuses((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleBulkMark = (status: AttendanceStatus) => {
    const all: Record<string, AttendanceStatus> = {};
    for (const e of enrollments) {
      all[e.studentId] = status;
    }
    setLocalStatuses(all);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const records = Object.entries(localStatuses).map(([studentId, status]) => ({
        studentId,
        status,
      }));
      if (records.length === 0) {
        toast.error(t("sessionsPage.attendance.noChanges"));
        setSaving(false);
        return;
      }
      await instructorApi.bulkMarkAttendance(session.id, records);
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

  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
        <div>
          <h2 className="text-lg font-semibold text-[#1F2937]">
            {t("sessionsPage.attendance.title")}
          </h2>
          <p className="text-xs text-[#6B7280] mt-0.5">{session.title}</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors">
          <X className="w-5 h-5 text-[#6B7280]" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#6B7280]" />
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-[#E5E7EB] bg-[#F9FAFB]">
            <span className="text-xs font-medium text-[#6B7280]">
              {t("sessionsPage.attendance.summary")}:
            </span>
            <span className="text-xs text-[#16A34A]">{presentCount} {t("sessionsPage.attendance.present")}</span>
            <span className="text-xs text-[#EF4444]">{absentCount} {t("sessionsPage.attendance.absent")}</span>
            <span className="text-xs text-[#D97706]">{lateCount} {t("sessionsPage.attendance.late")}</span>
          </div>

          {/* Bulk actions */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-[#E5E7EB]">
            <span className="text-xs font-medium text-[#6B7280]">{t("sessionsPage.attendance.markAll")}:</span>
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

          {/* Student list */}
          <div className="max-h-[400px] overflow-y-auto">
            {enrollments.length === 0 ? (
              <div className="text-center py-8 text-sm text-[#6B7280]">
                {t("sessionsPage.attendance.noStudents")}
              </div>
            ) : (
              <div className="divide-y divide-[#E5E7EB]">
                {enrollments.map((e) => {
                  const currentStatus = localStatuses[e.studentId] || "absent";
                  return (
                    <div key={e.studentId} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-[#1F2937]">
                          {e.studentFirstName} {e.studentLastName}
                        </p>
                        <p className="text-xs text-[#6B7280]">{e.studentEmail}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {statusOptions.map((status) => (
                          <button
                            key={status}
                            onClick={() => handleStatusChange(e.studentId, status)}
                            className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                              currentStatus === status
                                ? `${getStatusColor(status)} ring-2 ring-offset-1 ring-current`
                                : "bg-[#F3F4F6] text-[#9CA3AF] hover:bg-[#E5E7EB]"
                            }`}
                          >
                            {t(`sessionsPage.attendance.${status}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Save */}
          <div className="flex items-center justify-end gap-3 p-4 border-t border-[#E5E7EB]">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#6B7280] hover:text-[#1F2937] transition-colors"
            >
              {t("sessionsPage.attendance.cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-white text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("sessionsPage.attendance.save")}
            </button>
          </div>
        </>
      )}
    </ModalOverlay>
  );
}

// ─── Cancel Session Modal ────────────────────────────────────

function CancelSessionModal({
  session,
  onClose,
  onConfirm,
  t,
}: {
  session: CourseSession;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [reason, setReason] = useState("");

  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
        <h2 className="text-lg font-semibold text-[#1F2937]">
          {t("sessionsPage.cancelSession.title")}
        </h2>
        <button onClick={onClose} className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors">
          <X className="w-5 h-5 text-[#6B7280]" />
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
          <label className="block text-sm font-medium text-[#374151] mb-1.5">
            {t("sessionsPage.cancelSession.reasonLabel")}
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm resize-none"
            rows={3}
            placeholder={t("sessionsPage.cancelSession.reasonPlaceholder")}
          />
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 p-4 border-t border-[#E5E7EB]">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-[#6B7280] hover:text-[#1F2937] transition-colors"
        >
          {t("sessionsPage.cancelSession.goBack")}
        </button>
        <button
          onClick={() => onConfirm(reason)}
          disabled={!reason.trim()}
          className="px-4 py-2 bg-[#EF4444] text-white text-sm font-medium rounded-lg hover:bg-[#DC2626] transition-colors disabled:opacity-50"
        >
          {t("sessionsPage.cancelSession.confirm")}
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
}: {
  courses: InstructorCourse[];
  onClose: () => void;
  onScheduled: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"zoom" | "onsite" | "hybrid">("zoom");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(60);
  const [roomName, setRoomName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
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
        const res = await instructorApi.getSessions({ limit: 100 });
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
    if (!courseId || !title || !date || !time) return;
    setSaving(true);
    try {
      const scheduledAt = new Date(`${date}T${time}`).toISOString();
      const data: Record<string, unknown> = {
        courseId,
        title,
        type,
        scheduledAt,
        durationMinutes: duration,
      };
      if (type === "onsite" || type === "hybrid") {
        if (roomName) data.roomName = roomName;
        if (venueAddress) data.venueAddress = venueAddress;
      }
      await instructorApi.createSession(data);
      toast.success(t("sessionsPage.schedule.success"));
      onScheduled();
      onClose();
    } catch {
      toast.error(t("sessionsPage.schedule.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
        <h2 className="text-lg font-semibold text-[#1F2937]">
          {t("sessionsPage.scheduleSessionTitle")}
        </h2>
        <button onClick={onClose} className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors">
          <X className="w-5 h-5 text-[#6B7280]" />
        </button>
      </div>
      <div className="p-4 space-y-4">
        {/* Course */}
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">
            {t("sessionsPage.form.course")} *
          </label>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm"
          >
            <option value="">{t("sessionsPage.form.selectCourse")}</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">
            {t("sessionsPage.form.sessionTitle")} *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm"
            placeholder={t("sessionsPage.form.sessionTitlePlaceholder")}
          />
        </div>

        {/* Date + Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">
              {t("sessionsPage.form.date")} *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">
              {t("sessionsPage.form.time")} *
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm"
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
          <label className="block text-sm font-medium text-[#374151] mb-1.5">
            {t("sessionsPage.form.duration")}
          </label>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm"
          >
            <option value={30}>30 {t("sessionsPage.form.minutes")}</option>
            <option value={60}>60 {t("sessionsPage.form.minutes")}</option>
            <option value={90}>90 {t("sessionsPage.form.minutes")}</option>
            <option value={120}>2 {t("sessionsPage.form.hours")}</option>
          </select>
        </div>

        {/* Session Type */}
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">
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
                    ? "border-2 border-[#3B82F6] bg-[#EFF6FF] text-[#3B82F6]"
                    : "border border-[#E5E7EB] text-[#6B7280] hover:border-[#3B82F6] hover:bg-[#EFF6FF] hover:text-[#3B82F6]"
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

        {/* Zoom info */}
        {(type === "zoom" || type === "hybrid") && (
          <div className="flex items-start gap-2 p-3 bg-[#EFF6FF] rounded-lg">
            <Video className="w-4 h-4 text-[#3B82F6] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#1E40AF]">
              A Zoom meeting will be automatically created when you schedule this session.
            </p>
          </div>
        )}

        {/* Venue */}
        {(type === "onsite" || type === "hybrid") && (
          <>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                {t("sessionsPage.form.roomName")}
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm"
                placeholder={t("sessionsPage.form.roomNamePlaceholder")}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                {t("sessionsPage.form.venueAddress")}
              </label>
              <input
                type="text"
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
                className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm"
                placeholder={t("sessionsPage.form.venueAddressPlaceholder")}
              />
            </div>
          </>
        )}
      </div>
      <div className="flex items-center justify-end gap-3 p-4 border-t border-[#E5E7EB]">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-[#6B7280] hover:text-[#1F2937] transition-colors"
        >
          {t("sessionsPage.form.cancel")}
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !courseId || !title || !date || !time}
          className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-white text-sm font-medium rounded-lg disabled:opacity-50"
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
  onAttendance,
  onEdit,
  onDelete,
  t,
  locale,
}: {
  session: CourseSession;
  variant: "today" | "upcoming" | "past";
  onStart: () => void;
  onEnd: () => void;
  onCancel: () => void;
  onAttendance: () => void;
  onEdit: () => void;
  onDelete: () => void;
  t: ReturnType<typeof useTranslations>;
  locale: string;
}) {
  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      scheduled: { bg: "bg-[#EFF6FF]", text: "text-[#3B82F6]", label: t("sessionsPage.statusUpcoming") },
      live: { bg: "bg-[#FEE2E2]", text: "text-[#EF4444]", label: t("sessionsPage.statusLive") },
      completed: { bg: "bg-[#DCFCE7]", text: "text-[#22C55E]", label: t("sessionsPage.statusCompleted") },
      cancelled: { bg: "bg-[#F3F4F6]", text: "text-[#6B7280]", label: t("sessionsPage.statusCancelled") },
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
      zoom: "bg-[#EFF6FF] text-[#3B82F6]",
      onsite: "bg-[#DCFCE7] text-[#22C55E]",
      hybrid: "bg-[#F3E8FF] text-[#9333EA]",
    };
    return styles[type] || styles.zoom;
  };

  const badge = getStatusBadge(session.status);
  const isPast = variant === "past";

  return (
    <div className={`p-4 hover:bg-[#F9FAFB] transition-colors ${isPast ? "opacity-75" : ""}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isPast ? "bg-[#F3F4F6] text-[#9CA3AF]" : getTypeBadgeStyle(session.type)}`}>
            {getTypeIcon(session.type)}
          </div>
          <div>
            <h3 className={`text-sm font-semibold ${isPast ? "text-[#6B7280]" : "text-[#1F2937]"}`}>
              {session.title}
            </h3>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-[#6B7280]">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {formatSessionDate(session.scheduledAt, locale)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {formatSessionTime(session.scheduledAt, locale)}
              </span>
              {session.durationMinutes && (
                <span className="text-[#9CA3AF]">
                  ({session.durationMinutes} {t("sessionsPage.form.minutes")})
                </span>
              )}
              {session.venueAddress && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {session.venueAddress}
                </span>
              )}
              {session.roomName && !session.venueAddress && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {session.roomName}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:flex-shrink-0 flex-wrap">
          <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${badge.bg} ${badge.text}`}>
            {badge.label}
          </span>
          <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${getTypeBadgeStyle(session.type)}`}>
            {t(`sessionsPage.type.${session.type}`)}
          </span>

          {/* Lifecycle actions */}
          {session.status === "scheduled" && (
            <>
              <button
                onClick={onStart}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#3B82F6] text-white text-xs font-medium rounded-lg hover:bg-[#2563EB] transition-colors"
                title={t("sessionsPage.start")}
              >
                <Play className="w-3.5 h-3.5" />
                {t("sessionsPage.start")}
              </button>
              <button
                onClick={onAttendance}
                className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
                title={t("sessionsPage.attendance.title")}
              >
                <ClipboardCheck className="w-4 h-4" />
              </button>
              <button
                onClick={onEdit}
                className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
                title={t("sessionsPage.edit")}
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={onCancel}
                className="p-2 border border-[#E5E7EB] rounded-lg text-[#EF4444] hover:bg-[#FEE2E2] transition-colors"
                title={t("sessionsPage.cancel")}
              >
                <Ban className="w-4 h-4" />
              </button>
            </>
          )}

          {session.status === "live" && (
            <>
              <button
                onClick={onEnd}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#EF4444] text-white text-xs font-medium rounded-lg hover:bg-[#DC2626] transition-colors"
              >
                <Square className="w-3.5 h-3.5" />
                {t("sessionsPage.endSession")}
              </button>
              <button
                onClick={onAttendance}
                className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
                title={t("sessionsPage.attendance.title")}
              >
                <ClipboardCheck className="w-4 h-4" />
              </button>
            </>
          )}

          {session.status === "completed" && (
            <>
              <button
                onClick={onAttendance}
                className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
                title={t("sessionsPage.attendance.title")}
              >
                <ClipboardCheck className="w-4 h-4" />
              </button>
              <button
                onClick={onDelete}
                className="p-2 border border-[#E5E7EB] rounded-lg text-[#EF4444] hover:bg-[#FEE2E2] transition-colors"
                title={t("sessionsPage.deleteSession")}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}

          {session.status === "cancelled" && (
            <button
              onClick={onDelete}
              className="p-2 border border-[#E5E7EB] rounded-lg text-[#EF4444] hover:bg-[#FEE2E2] transition-colors"
              title={t("sessionsPage.deleteSession")}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Rejoin Zoom for live sessions */}
          {session.zoomLink && session.status === "live" && (
            <a
              href={session.zoomLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[#3B82F6] hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Rejoin Zoom
            </a>
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
  const [duration, setDuration] = useState(session.durationMinutes || 60);
  const [roomName, setRoomName] = useState(session.roomName || "");
  const [venueAddress, setVenueAddress] = useState(session.venueAddress || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const scheduledAt = new Date(`${date}T${time}`).toISOString();
      const data: Record<string, unknown> = {
        title,
        scheduledAt,
        durationMinutes: duration,
      };
      if (session.type === "onsite" || session.type === "hybrid") {
        data.roomName = roomName || null;
        data.venueAddress = venueAddress || null;
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
      <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
        <h2 className="text-lg font-semibold text-[#1F2937]">
          {t("sessionsPage.editModal.title")}
        </h2>
        <button onClick={onClose} className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors">
          <X className="w-5 h-5 text-[#6B7280]" />
        </button>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">
            {t("sessionsPage.form.sessionTitle")}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">
              {t("sessionsPage.form.date")}
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">
              {t("sessionsPage.form.time")}
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">
            {t("sessionsPage.form.duration")}
          </label>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm"
          >
            <option value={30}>30 {t("sessionsPage.form.minutes")}</option>
            <option value={60}>60 {t("sessionsPage.form.minutes")}</option>
            <option value={90}>90 {t("sessionsPage.form.minutes")}</option>
            <option value={120}>2 {t("sessionsPage.form.hours")}</option>
          </select>
        </div>
        {(session.type === "zoom" || session.type === "hybrid") && session.zoomLink && (
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">
              {t("sessionsPage.form.zoomLink")}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                value={session.zoomLink}
                readOnly
                className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm bg-[#F9FAFB] text-[#6B7280] cursor-not-allowed"
              />
              <a
                href={session.zoomLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 p-2.5 border border-[#E5E7EB] rounded-lg text-[#3B82F6] hover:bg-[#EFF6FF] transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            <p className="text-xs text-[#9CA3AF] mt-1">Auto-generated Zoom meeting link</p>
          </div>
        )}
        {(session.type === "onsite" || session.type === "hybrid") && (
          <>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                {t("sessionsPage.form.roomName")}
              </label>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">
                {t("sessionsPage.form.venueAddress")}
              </label>
              <input
                type="text"
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
                className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm"
              />
            </div>
          </>
        )}
      </div>
      <div className="flex items-center justify-end gap-3 p-4 border-t border-[#E5E7EB]">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-[#6B7280] hover:text-[#1F2937] transition-colors"
        >
          {t("sessionsPage.form.cancel")}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !title}
          className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-white text-sm font-medium rounded-lg disabled:opacity-50"
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
  const searchParams = useSearchParams();

  // View mode — initialize from ?view= query param if present
  const [viewMode, setViewMode] = useState<"calendar" | "list">(() => {
    const view = searchParams.get("view");
    return view === "calendar" ? "calendar" : "list";
  });

  // Filters
  const [filterCourse, setFilterCourse] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Data
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [courses, setCourses] = useState<InstructorCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calendar
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Modals
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [attendanceSession, setAttendanceSession] = useState<CourseSession | null>(null);
  const [cancelSessionData, setCancelSessionData] = useState<CourseSession | null>(null);
  const [editSessionData, setEditSessionData] = useState<CourseSession | null>(null);

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
      setError("Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll for status changes when there are live sessions
  // This detects when a Zoom meeting ends (via webhook) and auto-updates the UI
  const hasLiveSessions = useMemo(
    () => sessions.some((s) => s.status === "live"),
    [sessions],
  );

  useEffect(() => {
    if (!hasLiveSessions) return;

    const interval = setInterval(async () => {
      try {
        const res = await instructorApi.getSessions({ limit: 200 });
        const fresh = res.data;
        // Check if any previously-live session has ended
        const ended = sessions.filter(
          (old) =>
            old.status === "live" &&
            fresh.find((n) => n.id === old.id && n.status === "completed"),
        );
        if (ended.length > 0) {
          setSessions(fresh);
          for (const s of ended) {
            toast.success(`"${s.title}" has ended`);
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [hasLiveSessions, sessions]);

  // Filter sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (filterCourse !== "all" && s.courseId !== filterCourse) return false;
      if (filterStatus !== "all" && s.status !== filterStatus) return false;
      return true;
    });
  }, [sessions, filterCourse, filterStatus]);

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
    try {
      const result = await instructorApi.startSession(session.id);
      toast.success(t("sessionsPage.lifecycle.started"));
      // Open Zoom host URL if available
      if ((result as any).zoomStartUrl) {
        window.open((result as any).zoomStartUrl, "_blank");
      }
      fetchData();
    } catch {
      toast.error(t("sessionsPage.lifecycle.startError"));
    }
  };

  const handleEnd = async (session: CourseSession) => {
    try {
      await instructorApi.endSession(session.id);
      toast.success(t("sessionsPage.lifecycle.ended"));
      fetchData();
    } catch {
      toast.error(t("sessionsPage.lifecycle.endError"));
    }
  };

  const handleCancel = async (reason: string) => {
    if (!cancelSessionData) return;
    try {
      await instructorApi.cancelSession(cancelSessionData.id, reason);
      toast.success(t("sessionsPage.lifecycle.cancelled"));
      setCancelSessionData(null);
      fetchData();
    } catch {
      toast.error(t("sessionsPage.lifecycle.cancelError"));
    }
  };

  const handleDelete = async (session: CourseSession) => {
    if (!window.confirm(`Delete "${session.title}"? This action cannot be undone.`)) return;
    try {
      await instructorApi.deleteSession(session.id);
      toast.success(t("sessionsPage.lifecycle.deleted"));
      fetchData();
    } catch {
      toast.error(t("sessionsPage.lifecycle.deleteError"));
    }
  };

  // Calendar helpers
  const daysInMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1).getDay();
  const monthNames = locale === "ar"
    ? ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"]
    : ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = locale === "ar"
    ? ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getSessionsForDate = (day: number) => {
    const dateStr = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return filteredSessions.filter((s) => getDateStr(s.scheduledAt) === dateStr);
  };

  const getCalendarDotColor = (status: string) => {
    switch (status) {
      case "scheduled": return "bg-[#3B82F6]";
      case "live": return "bg-[#EF4444]";
      case "completed": return "bg-[#22C55E]";
      case "cancelled": return "bg-[#9CA3AF]";
      default: return "bg-[#3B82F6]";
    }
  };

  // Session group renderer
  const renderSessionGroup = (groupTitle: string, groupSessions: CourseSession[], variant: "today" | "upcoming" | "past") => (
    <div className="bg-white rounded-xl border border-[#E5E7EB]">
      <div className="p-4 border-b border-[#E5E7EB]">
        <h2 className="text-base font-semibold text-[#1F2937]">
          {groupTitle}
          <span className="ml-2 text-xs font-normal text-[#6B7280]">({groupSessions.length})</span>
        </h2>
      </div>
      {groupSessions.length === 0 ? (
        <div className="p-8 text-center text-sm text-[#6B7280]">
          {t("sessionsPage.noSessions")}
        </div>
      ) : (
        <div className="divide-y divide-[#E5E7EB]">
          {groupSessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              variant={variant}
              onStart={() => handleStart(session)}
              onEnd={() => handleEnd(session)}
              onCancel={() => setCancelSessionData(session)}
              onAttendance={() => setAttendanceSession(session)}
              onEdit={() => setEditSessionData(session)}
              onDelete={() => handleDelete(session)}
              t={t}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  );

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

            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-[#1F2937]">
                    {t("sessionsPage.title")}
                  </h1>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {t("sessionsPage.subtitle")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {/* View Toggle */}
                  <div className="flex items-center bg-white border border-[#E5E7EB] rounded-lg p-1">
                    <button
                      onClick={() => setViewMode("list")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        viewMode === "list"
                          ? "btn-gold text-white"
                          : "text-[#6B7280] hover:text-[#1F2937]"
                      }`}
                    >
                      <List className="w-4 h-4" />
                      {t("sessionsPage.listView")}
                    </button>
                    <button
                      onClick={() => setViewMode("calendar")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        viewMode === "calendar"
                          ? "btn-gold text-white"
                          : "text-[#6B7280] hover:text-[#1F2937]"
                      }`}
                    >
                      <Calendar className="w-4 h-4" />
                      {t("sessionsPage.calendarView")}
                    </button>
                  </div>
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    {t("sessionsPage.scheduleSession")}
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="flex items-center gap-1.5 text-sm text-[#6B7280]">
                  <Filter className="w-4 h-4" />
                  {t("sessionsPage.filters")}:
                </div>
                <select
                  value={filterCourse}
                  onChange={(e) => setFilterCourse(e.target.value)}
                  className="px-3 py-1.5 border border-[#E5E7EB] rounded-lg text-sm bg-white"
                >
                  <option value="all">{t("sessionsPage.allCourses")}</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-1.5 border border-[#E5E7EB] rounded-lg text-sm bg-white"
                >
                  <option value="all">{t("sessionsPage.allStatuses")}</option>
                  <option value="scheduled">{t("sessionsPage.statusUpcoming")}</option>
                  <option value="live">{t("sessionsPage.statusLive")}</option>
                  <option value="completed">{t("sessionsPage.statusCompleted")}</option>
                  <option value="cancelled">{t("sessionsPage.statusCancelled")}</option>
                </select>
              </div>

              {/* Loading */}
              {loading && (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-[#6B7280]" />
                </div>
              )}

              {/* Error */}
              {error && !loading && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center">
                  <p className="text-sm text-[#EF4444] mb-3">{error}</p>
                  <button
                    onClick={fetchData}
                    className="px-4 py-2 btn-gold text-white text-sm font-medium rounded-lg"
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
                  {renderSessionGroup(t("sessionsPage.past"), pastSessions, "past")}
                </div>
              )}

              {/* Calendar View */}
              {!loading && !error && viewMode === "calendar" && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                  {/* Calendar Header */}
                  <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
                    <button
                      onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
                      className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5 text-[#6B7280]" />
                    </button>
                    <h2 className="text-lg font-semibold text-[#1F2937]">
                      {monthNames[calendarDate.getMonth()]} {calendarDate.getFullYear()}
                    </h2>
                    <button
                      onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                      className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
                    >
                      <ChevronRight className="w-5 h-5 text-[#6B7280]" />
                    </button>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-4 px-4 py-2 border-b border-[#E5E7EB] bg-[#F9FAFB]">
                    <span className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />
                      {t("sessionsPage.statusUpcoming")}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                      {t("sessionsPage.statusLive")}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]" />
                      {t("sessionsPage.statusCompleted")}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-[#6B7280]">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#9CA3AF]" />
                      {t("sessionsPage.statusCancelled")}
                    </span>
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7">
                    {/* Day Headers */}
                    {dayNames.map((day) => (
                      <div key={day} className="p-3 text-center text-xs font-medium text-[#6B7280] border-b border-[#E5E7EB]">
                        {day}
                      </div>
                    ))}

                    {/* Empty cells */}
                    {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                      <div key={`empty-${i}`} className="min-h-[100px] p-2 border-b border-r border-[#E5E7EB] bg-[#F9FAFB]" />
                    ))}

                    {/* Days */}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const daySessions = getSessionsForDate(day);
                      const now = new Date();
                      const isToday = now.getDate() === day && now.getMonth() === calendarDate.getMonth() && now.getFullYear() === calendarDate.getFullYear();

                      return (
                        <div
                          key={day}
                          className={`min-h-[100px] p-2 border-b border-r border-[#E5E7EB] ${isToday ? "bg-[#EFF6FF]" : ""}`}
                        >
                          <span className={`inline-flex items-center justify-center w-7 h-7 text-sm ${
                            isToday ? "bg-[#3B82F6] text-white rounded-full font-semibold" : "text-[#1F2937]"
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
                                <span className="truncate text-[#374151]">{session.title}</span>
                              </div>
                            ))}
                            {daySessions.length > 2 && (
                              <div className="text-[10px] text-[#6B7280] px-1.5">
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

      {cancelSessionData && (
        <CancelSessionModal
          session={cancelSessionData}
          onClose={() => setCancelSessionData(null)}
          onConfirm={handleCancel}
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
