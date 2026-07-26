"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  ArrowLeft, ArrowRight, Clock, Search, Loader2, Lock,
  RefreshCw, Video, CheckCircle, X, XCircle, AlertTriangle, Users,
} from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";
import Select from "@/components/admin-dashboard/Select";

type AttendanceStatus = "present" | "absent" | "late" | "excused" | "unmarked";

interface AttendanceRecord {
  id: string;
  studentId: string;
  status: string;
  joinedAt: string | null;
  leftAt: string | null;
  durationMinutes: number | null;
  studentFirstName: string | null;
  studentLastName: string | null;
  studentEmail: string;
  studentScfhsNumber?: string | null;
  note?: string | null;
  markedByName?: string | null;
  markedByRole?: string | null;
  updatedAt?: string | null;
  presencePercent?: number | null;
}

interface TAAttendanceViewProps {
  sessionId: string;
  sessionTitle?: string;
  sessionType?: string;
  sessionStatus?: string;
  sessionCourseId?: string;
  sessionScheduledAt?: string;
  sessionDurationMinutes?: number;
  sessionZoomLink?: string | null;
  sessionActualStartedAt?: string | null;
  sessionActualEndedAt?: string | null;
  onBack: () => void;
}

const statusOptions: AttendanceStatus[] = ["present", "absent"];

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

const TAAttendanceView = ({
  sessionId,
  sessionTitle,
  sessionType,
  sessionStatus,
  sessionCourseId,
  sessionScheduledAt,
  sessionDurationMinutes,
  sessionZoomLink,
  sessionActualStartedAt,
  sessionActualEndedAt,
  onBack,
}: TAAttendanceViewProps) => {
  const t = useTranslations("taDashboard");
  const tToasts = useTranslations("toasts");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const timeLocale = locale === "ar" ? "ar-SA" : "en-US";

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [localStatuses, setLocalStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [attendanceLocked, setAttendanceLocked] = useState(false);
  const [unmatchedParticipants, setUnmatchedParticipants] = useState<
    Array<{ zoomUserEmail: string; eventType: string; timestamp: string }>
  >([]);
  const [manualAssignments, setManualAssignments] = useState<Record<string, string>>({});
  const [assigningEmail, setAssigningEmail] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{
    synced: number;
    skipped: number;
    details: Array<{
      name: string;
      email: string;
      joinTime: string | null;
      leaveTime: string | null;
      durationMinutes: number;
      action: "synced" | "updated_times" | "skipped";
      reason?: string;
    }>;
  } | null>(null);
  const isZoomSession = sessionType === "zoom" || sessionType === "hybrid";
  const isPostSession = sessionStatus === "ended" || sessionStatus === "completed";
  const isReadOnly = attendanceLocked || (sessionStatus !== "live" && !isPostSession);
  const isVerifiedReadOnly = isReadOnly || (isPostSession && isZoomSession);
  const hasUnmatched = unmatchedParticipants.length > 0;

  const loadData = useCallback(async () => {
    if (sessionStatus === "completed") {
      setAttendanceLocked(true);
    }
    try {
      const promises: Promise<unknown>[] = [
        api.get<AttendanceRecord[]>(`/sessions/${sessionId}/attendance`),
      ];
      if (isZoomSession) {
        promises.push(api.get(`/sessions/${sessionId}/attendance-logs`));
      }
      const results = await Promise.all(promises);
      const att = results[0] as AttendanceRecord[];
      setRecords(att);

      const existing: Record<string, AttendanceStatus> = {};
      const existingNotes: Record<string, string> = {};
      for (const a of att) {
        existing[a.studentId] = a.status as AttendanceStatus;
        if (a.note) existingNotes[a.studentId] = a.note;
      }
      setLocalStatuses(existing);
      setLocalNotes(existingNotes);

      // Extract unmatched participants from attendance logs
      if (isZoomSession && results[1]) {
        const logs = results[1] as Array<{
          studentId: string | null;
          zoomUserEmail: string | null;
          rawPayload: Record<string, unknown> | null;
          eventType: string;
          timestamp: string;
        }>;
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
          const payload = l.rawPayload as Record<string, unknown> | null;
          const participant = payload?.participant as Record<string, unknown> | undefined;
          const email = l.zoomUserEmail?.toLowerCase();
          const name = ((participant?.user_name as string) || (payload?.name as string))?.toLowerCase();
          if (email && matchedIdentifiers.has(email)) return false;
          if (name && matchedIdentifiers.has(name)) return false;
          const allFields = [l.zoomUserEmail, payload?.name as string, participant?.user_name as string, payload?.email as string, JSON.stringify(payload)].filter(Boolean).join(" ");
          if (/TA-[0-9a-f]{8}/i.test(allFields)) return false;
          return true;
        });
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
              const payload = l.rawPayload as Record<string, unknown> | null;
              const allText = [l.zoomUserEmail, payload?.name as string, JSON.stringify(payload)].filter(Boolean).join(" ");
              return !/TA-[0-9a-f]{8}/i.test(allText);
            })
            .map((l) => {
              const payload = l.rawPayload as Record<string, unknown> | null;
              const participant = payload?.participant as Record<string, unknown> | undefined;
              const displayName = l.zoomUserEmail || (participant?.user_name as string) || (payload?.name as string) || "Unknown Participant";
              return { zoomUserEmail: displayName, eventType: l.eventType, timestamp: l.timestamp };
            })
        );
        if (sessionStatus === "completed" && unique.length === 0) {
          setAttendanceLocked(true);
        }
      }
      if (!isZoomSession && sessionStatus === "completed") {
        setAttendanceLocked(true);
      }
    } catch {
      toast.error(tToasts("failedLoadAttendance"));
    } finally {
      setLoading(false);
    }
  }, [sessionId, isZoomSession, sessionStatus, tToasts]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSyncZoom = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await api.post<{ synced: number; skipped: number; details: any[] }>(`/sessions/${sessionId}/sync-zoom`, {});
      setSyncResult({ synced: result.synced, skipped: result.skipped, details: result.details || [] });
      toast.success(tToasts("syncedFromZoom", { count: result.synced }));
      setLoading(true);
      await loadData();
    } catch {
      toast.error(tToasts("failedSyncZoom"), { duration: 8000 });
    } finally {
      setSyncing(false);
    }
  };

  const handleManualAssign = async (zoomEmail: string) => {
    const studentId = manualAssignments[zoomEmail];
    if (!studentId) return;
    setAssigningEmail(zoomEmail);
    try {
      await api.post(`/sessions/${sessionId}/attendance`, { studentId, status: "present" });
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

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setLocalStatuses((prev) => ({ ...prev, [studentId]: status }));
    if (status !== "late" && status !== "excused") {
      setLocalNotes((prev) => { const next = { ...prev }; delete next[studentId]; return next; });
    }
  };

  const handleBulkMark = (status: AttendanceStatus) => {
    const all: Record<string, AttendanceStatus> = {};
    for (const r of records) { all[r.studentId] = status; }
    setLocalStatuses(all);
    if (status !== "late" && status !== "excused") { setLocalNotes({}); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const bulkRecords = Object.entries(localStatuses).map(([studentId, status]) => ({
        studentId,
        status: status === "unmarked" ? "absent" : status,
        ...(localNotes[studentId]?.trim() ? { note: localNotes[studentId].trim() } : {}),
      }));
      if (bulkRecords.length === 0) { toast.error(tToasts("noChangesToSave")); setSaving(false); return; }
      await api.post(`/sessions/${sessionId}/attendance/bulk`, { records: bulkRecords });
      if (isPostSession) {
        if (sessionStatus === "ended") {
          try { await api.post(`/sessions/${sessionId}/finalize`, {}); } catch { /* already completed */ }
        }
        setLocalStatuses((prev) => {
          const updated = { ...prev };
          for (const key of Object.keys(updated)) {
            if (updated[key] === "unmarked") updated[key] = "absent";
          }
          return updated;
        });
        toast.success(t("attendance.savedAndLocked"));
        setAttendanceLocked(true);
        setUnmatchedParticipants([]);
        setSaving(false);
        return;
      }
      toast.success(t("attendance.saved"));
    } catch {
      toast.error(tToasts("failedSaveAttendance"));
    } finally {
      setSaving(false);
    }
  };

  const markedStudentIds = new Set(records.filter((a) => a.status !== "unmarked").map((a) => a.studentId));

  const presentCount = Object.values(localStatuses).filter((s) => s === "present").length;
  const absentCount = Object.values(localStatuses).filter((s) => s === "absent").length;

  const filteredRecords = searchQuery
    ? records.filter((r) => {
        const q = searchQuery.toLowerCase();
        const name = `${r.studentFirstName || ""} ${r.studentLastName || ""}`.toLowerCase();
        return name.includes(q) || r.studentEmail.toLowerCase().includes(q);
      })
    : records;

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleTimeString(timeLocale, { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors">
            {isRTL ? (
              <ArrowRight className="w-5 h-5 text-[var(--color-text-secondary)]" />
            ) : (
              <ArrowLeft className="w-5 h-5 text-[var(--color-text-secondary)]" />
            )}
          </button>
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{t("attendance.title")}</h1>
            {sessionTitle && <p className="text-xs text-[var(--color-text-secondary)]">{sessionTitle}</p>}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
        </div>
      ) : (
        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
          {/* Zoom sync bar */}
          {isZoomSession && !attendanceLocked && isPostSession && (
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-border-subtle)]">
              <div className="flex items-center gap-2 text-xs text-[var(--color-primary)]">
                <Video className="w-3.5 h-3.5" />
                <span>{t("attendance.zoomSession")}</span>
              </div>
              <button
                onClick={handleSyncZoom}
                disabled={syncing || attendanceLocked}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] border border-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary)] hover:text-white transition-colors disabled:opacity-50"
              >
                {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {syncing ? t("common.syncing") : t("attendance.syncFromZoom")}
              </button>
            </div>
          )}

          {/* Zoom sync result */}
          {syncResult && !attendanceLocked && (
            <div className="border-b border-[var(--color-border)] bg-[#F0FDF4]">
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-[#16A34A]" />
                  <span className="text-xs font-medium text-[#15803D]">
                    {t("attendance.syncComplete", { synced: syncResult.synced, skipped: syncResult.skipped })}
                  </span>
                </div>
                <button onClick={() => setSyncResult(null)} className="p-1 hover:bg-[#DCFCE7] rounded transition-colors">
                  <X className="w-3.5 h-3.5 text-[#16A34A]" />
                </button>
              </div>
              {syncResult.details.length > 0 && (
                <div className="px-4 pb-3 space-y-1.5">
                  {syncResult.details.filter((d) => d.action !== "skipped" || d.reason !== "host").map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px]">
                      {d.action === "skipped" ? <XCircle className="w-3 h-3 text-[var(--color-text-secondary)] shrink-0" /> : <CheckCircle className="w-3 h-3 text-[#16A34A] shrink-0" />}
                      <span className={d.action === "skipped" ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text-secondary)]"}>{d.name || d.email}</span>
                      {d.action !== "skipped" && d.joinTime && (
                        <span className="text-[var(--color-text-secondary)]">
                          {new Date(d.joinTime).toLocaleTimeString(timeLocale, { hour: "2-digit", minute: "2-digit" })}
                          {d.leaveTime && ` – ${new Date(d.leaveTime).toLocaleTimeString(timeLocale, { hour: "2-digit", minute: "2-digit" })}`}
                          {d.durationMinutes > 0 && ` (${d.durationMinutes} min)`}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          <div className="flex items-center gap-4 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-page)] flex-wrap">
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">{t("attendance.summary")}:</span>
            <span className="text-xs text-[#16A34A]">{presentCount} {t("attendance.present")}</span>
            <span className="text-xs text-[#EF4444]">{absentCount} {t("attendance.absent")}</span>
          </div>

          {/* Bulk actions / lock banner */}
          {isVerifiedReadOnly ? (
            <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-page)]">
              <Lock className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
              <span className="text-xs text-[var(--color-text-secondary)]">
                {attendanceLocked
                  ? t("attendance.lockedFinal")
                  : isPostSession && isZoomSession && hasUnmatched
                    ? t("attendance.lockedUnmatched")
                    : t("attendance.lockedInactive")}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border)]">
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">{t("attendance.markAllLabel")}:</span>
              {statusOptions.map((status) => (
                <button
                  key={status}
                  onClick={() => handleBulkMark(status)}
                  className={`px-2.5 py-1 rounded text-xs font-medium ${getStatusColor(status)} hover:opacity-80 transition-opacity`}
                >
                  {t(`attendance.${status}`)}
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          {records.length > 0 && (
            <div className="px-4 py-2 border-b border-[var(--color-border)]">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("attendance.searchPlaceholder")}
                  className="w-full ps-10 pe-4 py-2 border border-[var(--color-input-border)] rounded-lg text-sm text-[var(--color-text-primary)] bg-[var(--color-surface-card)] focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)]"
                />
              </div>
            </div>
          )}

          {/* Marked by info — shown once for the whole sheet */}
          {(() => {
            const marker = records.find((r) => r.markedByName);
            if (!marker) return null;
            const roleKey = marker.markedByRole === "TEACHING_ASSISTANT" || marker.markedByRole === "INSTRUCTOR"
              ? marker.markedByRole
              : "system";
            const roleLabel = t.has(`attendance.markedByRoles.${roleKey}`)
              ? t(`attendance.markedByRoles.${roleKey}`)
              : marker.markedByRole || "";
            return (
              <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border)] bg-[#FAFAFA] text-[10px] text-[var(--color-text-secondary)]">
                <span>{t("attendance.markedBy")}: <span className="font-medium text-[var(--color-text-secondary)]">{marker.markedByName}</span> ({roleLabel})</span>
                {marker.updatedAt && (
                  <span>{t("attendance.lastUpdated")}: {new Date(marker.updatedAt).toLocaleTimeString(timeLocale, { hour: "2-digit", minute: "2-digit" })}</span>
                )}
              </div>
            );
          })()}

          {/* Student list */}
          <div className="max-h-[400px] overflow-y-auto divide-y divide-[var(--color-border)]">
            {filteredRecords.length === 0 ? (
              <div className="text-center py-8 text-sm text-[var(--color-text-secondary)]">{t("attendance.noRecords")}</div>
            ) : (
              filteredRecords.map((record) => {
                const currentStatus = localStatuses[record.studentId] || "absent";
                return (
                  <div key={record.studentId} className="px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                          {record.studentFirstName} {record.studentLastName}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">{record.studentEmail}</p>
                        {record.studentScfhsNumber && (
                          <p className="text-[10px] text-[var(--color-text-secondary)] font-mono">{record.studentScfhsNumber}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {statusOptions.map((status) => (
                          <button
                            key={status}
                            onClick={() => !isVerifiedReadOnly && handleStatusChange(record.studentId, status)}
                            disabled={isVerifiedReadOnly}
                            className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                              currentStatus === status
                                ? `${getStatusColor(status)} ring-2 ring-offset-1 ring-current`
                                : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]"
                            } ${isVerifiedReadOnly ? "cursor-default opacity-70" : ""}`}
                          >
                            {t(`attendance.${status}`)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Notes */}
                    {record.note && attendanceLocked && (
                      <p className="text-xs text-[var(--color-text-secondary)] italic">{t("attendance.note")}: {record.note}</p>
                    )}

                    {/* Zoom timing data */}
                    {(record.joinedAt || record.leftAt) && (
                      <div className="flex items-center gap-3 text-[11px] text-[var(--color-text-secondary)]">
                        {record.joinedAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {t("attendance.joinTime")}: {formatTime(record.joinedAt)}
                          </span>
                        )}
                        {record.leftAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {t("attendance.leaveTime")}: {formatTime(record.leftAt)}
                          </span>
                        )}
                        {record.durationMinutes && record.durationMinutes > 0 && (
                          <span>({record.durationMinutes} {t("sessions.minutes")})</span>
                        )}
                      </div>
                    )}

                    {/* Presence bar */}
                    {(() => {
                      const presPercent = record.presencePercent ?? (sessionDurationMinutes && record.durationMinutes ? Math.min(Math.round((record.durationMinutes / sessionDurationMinutes) * 100), 100) : 0);
                      if (presPercent === 0 && !record.joinedAt) return null;
                      return (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 relative h-2 bg-[var(--color-border-subtle)] rounded-full overflow-hidden">
                            <div
                              className={`absolute top-0 start-0 h-full rounded-full ${presPercent >= 70 ? "bg-[#16A34A]" : "bg-[#EF4444]"}`}
                              style={{ width: `${Math.max(2, presPercent)}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-semibold whitespace-nowrap ${presPercent >= 70 ? "text-[#16A34A]" : "text-[#EF4444]"}`}>{presPercent}%</span>
                        </div>
                      );
                    })()}
                  </div>
                );
              })
            )}
          </div>

          {/* Unmatched Zoom participants */}
          {isZoomSession && !attendanceLocked && unmatchedParticipants.length > 0 && (
            <div className="border-t border-[var(--color-border)]">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-[#FEF3C7]">
                <AlertTriangle className="w-3.5 h-3.5 text-[#D97706]" />
                <span className="text-xs font-medium text-[#92400E]">
                  {t("attendance.unmatchedParticipants", { count: unmatchedParticipants.length })}
                </span>
              </div>
              <div className="max-h-[200px] overflow-y-auto divide-y divide-[var(--color-border)]">
                {unmatchedParticipants.map((p, i) => {
                  const selectedStudent = manualAssignments[p.zoomUserEmail]
                    ? records.find((r) => r.studentId === manualAssignments[p.zoomUserEmail])
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
                                {isRTL ? " ← " : " → "}{selectedStudent.studentFirstName} {selectedStudent.studentLastName}
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-[var(--color-text-secondary)]">{formatTime(p.timestamp)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ps-8">
                        <Select
                          size="sm"
                          className="flex-1"
                          value={manualAssignments[p.zoomUserEmail] || ""}
                          onChange={(v) => setManualAssignments((prev) => ({ ...prev, [p.zoomUserEmail]: v }))}
                          disabled={attendanceLocked}
                          placeholder={t("attendance.selectStudent")}
                          ariaLabel={t("attendance.selectStudent")}
                          options={records
                            .filter((r) => !markedStudentIds.has(r.studentId))
                            .map((r) => ({
                              value: r.studentId,
                              label: `${r.studentFirstName || ""} ${r.studentLastName || ""}`.trim() || r.studentEmail,
                            }))}
                        />
                        <button
                          onClick={() => handleManualAssign(p.zoomUserEmail)}
                          disabled={!manualAssignments[p.zoomUserEmail] || assigningEmail === p.zoomUserEmail || attendanceLocked}
                          className="px-3 py-1.5 text-xs font-medium bg-[var(--color-primary)] text-white rounded-lg disabled:opacity-40 hover:bg-[var(--color-primary-dark)] transition-colors shrink-0"
                        >
                          {assigningEmail === p.zoomUserEmail ? "..." : t("common.assign")}
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
              <button onClick={onBack} className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
                {attendanceLocked ? t("common.close") : t("common.back")}
              </button>
              {/* Save (live sessions) */}
              {!isReadOnly && !isPostSession && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t("common.save")}
                </button>
              )}
              {/* Lock (post-session) */}
              {isPostSession && !attendanceLocked && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  {t("common.lock")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TAAttendanceView;
