"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft, Clock, Search, Save, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { toast } from "sonner";

type AttendanceStatus = "present" | "absent" | "late" | "excused";

interface AttendanceRecord {
  id: string;
  studentId: string;
  status: string;
  joinedAt: string | null;
  leftAt: string | null;
  minutesPresent: number;
  firstName: string | null;
  lastName: string | null;
  email: string;
  note?: string | null;
}

interface TAAttendanceViewProps {
  sessionId: string;
  onBack: () => void;
}

const statusOptions: AttendanceStatus[] = ["present", "absent", "late", "excused"];

const getStatusColor = (status: AttendanceStatus) => {
  switch (status) {
    case "present": return "bg-[#DCFCE7] text-[#16A34A]";
    case "absent": return "bg-[#FEE2E2] text-[#EF4444]";
    case "late": return "bg-[#FEF3C7] text-[#D97706]";
    case "excused": return "bg-[#EFF6FF] text-[#3B82F6]";
    default: return "bg-[#F3F4F6] text-[#6B7280]";
  }
};

const TAAttendanceView = ({ sessionId, onBack }: TAAttendanceViewProps) => {
  const t = useTranslations("taDashboard");
  const locale = useLocale();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [localStatuses, setLocalStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const fetchAttendance = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<AttendanceRecord[]>(
        `/sessions/${sessionId}/attendance`
      );
      setRecords(data);
      const statuses: Record<string, AttendanceStatus> = {};
      const notes: Record<string, string> = {};
      for (const rec of data) {
        statuses[rec.studentId] = (rec.status as AttendanceStatus) || "absent";
        if (rec.note) notes[rec.studentId] = rec.note;
      }
      setLocalStatuses(statuses);
      setLocalNotes(notes);
      setHasChanges(false);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setLocalStatuses((prev) => ({ ...prev, [studentId]: status }));
    setHasChanges(true);
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
    for (const rec of records) {
      all[rec.studentId] = status;
    }
    setLocalStatuses(all);
    setHasChanges(true);
    if (status !== "late" && status !== "excused") {
      setLocalNotes({});
    }
  };

  const handleSave = async () => {
    const missingNotes = Object.entries(localStatuses).filter(
      ([studentId, status]) =>
        (status === "late" || status === "excused") &&
        !localNotes[studentId]?.trim()
    );
    if (missingNotes.length > 0) {
      toast.error(t("attendance.noteRequired"));
      return;
    }

    setSaving(true);
    try {
      const bulkRecords = Object.entries(localStatuses).map(([studentId, status]) => ({
        studentId,
        status,
        ...(localNotes[studentId]?.trim() ? { note: localNotes[studentId].trim() } : {}),
      }));
      if (bulkRecords.length === 0) {
        toast.error(t("attendance.noChanges"));
        setSaving(false);
        return;
      }
      await api.post(`/sessions/${sessionId}/attendance/bulk`, { records: bulkRecords });
      toast.success(t("attendance.saved"));
      setHasChanges(false);
      await fetchAttendance();
    } catch {
      toast.error(t("attendance.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleTimeString(locale === "ar" ? "ar-SA" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredRecords = searchQuery
    ? records.filter((r) => {
        const q = searchQuery.toLowerCase();
        const name = `${r.firstName || ""} ${r.lastName || ""}`.toLowerCase();
        return name.includes(q) || r.email.toLowerCase().includes(q);
      })
    : records;

  const presentCount = Object.values(localStatuses).filter((s) => s === "present").length;
  const absentCount = Object.values(localStatuses).filter((s) => s === "absent").length;
  const lateCount = Object.values(localStatuses).filter((s) => s === "late").length;
  const excusedCount = Object.values(localStatuses).filter((s) => s === "excused").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-[#F3F4F6] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[#4B5563]" />
          </button>
          <h1 className="text-2xl font-bold text-[#1F2937]">
            {t("attendance.title")}
          </h1>
        </div>
        {records.length > 0 && hasChanges && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {t("attendance.save")}
          </button>
        )}
      </div>

      {/* Summary bar */}
      {records.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg flex-wrap">
          <span className="text-xs font-medium text-[#6B7280]">
            {t("attendance.summary")}:
          </span>
          <span className="text-xs text-[#16A34A]">{presentCount} {t("attendance.present")}</span>
          <span className="text-xs text-[#EF4444]">{absentCount} {t("attendance.absent")}</span>
          <span className="text-xs text-[#D97706]">{lateCount} {t("attendance.late")}</span>
          <span className="text-xs text-[#3B82F6]">{excusedCount} {t("attendance.excused")}</span>
        </div>
      )}

      {/* Bulk actions */}
      {records.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#6B7280]">{t("attendance.markAll")}:</span>
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
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("attendance.searchPlaceholder")}
            className="w-full pl-10 pr-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] bg-white focus:outline-none focus:ring-2 focus:ring-[#d4a520]/20"
          />
        </div>
      )}

      {/* Student list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#a37f49] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center">
          <p className="text-[#6B7280]">{t("attendance.noRecords")}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden divide-y divide-[#E5E7EB]">
          {filteredRecords.map((record) => {
            const currentStatus = localStatuses[record.studentId] || "absent";
            const needsNote = currentStatus === "late" || currentStatus === "excused";
            return (
              <div key={record.id} className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1F2937]">
                      {record.firstName} {record.lastName}
                    </p>
                    <p className="text-xs text-[#6B7280]">{record.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {statusOptions.map((status) => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(record.studentId, status)}
                        className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
                          currentStatus === status
                            ? `${getStatusColor(status)} ring-2 ring-offset-1 ring-current`
                            : "bg-[#F3F4F6] text-[#9CA3AF] hover:bg-[#E5E7EB]"
                        }`}
                      >
                        {t(`attendance.${status}`)}
                      </button>
                    ))}
                  </div>
                </div>
                {needsNote && (
                  <input
                    type="text"
                    value={localNotes[record.studentId] || ""}
                    onChange={(e) => {
                      setLocalNotes((prev) => ({ ...prev, [record.studentId]: e.target.value }));
                      setHasChanges(true);
                    }}
                    placeholder={t("attendance.notePlaceholder")}
                    className="w-full px-3 py-1.5 text-xs border border-[#E5E7EB] rounded-lg bg-[#F9FAFB] focus:outline-none focus:ring-1 focus:ring-[#d4a520]/20"
                  />
                )}
                {(record.joinedAt || record.leftAt) && (
                  <div className="flex items-center gap-3 text-[11px] text-[#9CA3AF]">
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
                    {record.minutesPresent > 0 && (
                      <span>({record.minutesPresent} min)</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom save button */}
      {records.length > 0 && hasChanges && (
        <div className="sticky bottom-0 bg-white border-t border-[#E5E7EB] p-4 -mx-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {t("attendance.save")}
          </button>
        </div>
      )}
    </div>
  );
};

export default TAAttendanceView;
