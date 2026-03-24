"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft, Clock, Search, Download, Loader2 } from "lucide-react";
import api from "@/lib/api";

type AttendanceStatus = "present" | "absent" | "late" | "excused";

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
}

interface TAAttendanceViewProps {
  sessionId: string;
  sessionScheduledAt?: string;
  sessionDurationMinutes?: number;
  onBack: () => void;
}

const getStatusColor = (status: AttendanceStatus) => {
  switch (status) {
    case "present": return "bg-[#DCFCE7] text-[#16A34A]";
    case "absent": return "bg-[#FEE2E2] text-[#EF4444]";
    case "late": return "bg-[#FEF3C7] text-[#D97706]";
    case "excused": return "bg-[#EFF6FF] text-[#3B82F6]";
    default: return "bg-[#F3F4F6] text-[#6B7280]";
  }
};

const TAAttendanceView = ({ sessionId, sessionScheduledAt, sessionDurationMinutes, onBack }: TAAttendanceViewProps) => {
  const t = useTranslations("taDashboard");
  const locale = useLocale();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [notFinalized, setNotFinalized] = useState(false);
  const fetchAttendance = useCallback(async () => {
    try {
      setLoading(true);
      setNotFinalized(false);
      const data = await api.get<AttendanceRecord[]>(
        `/sessions/${sessionId}/attendance`
      );
      setRecords(data);
    } catch (err: any) {
      setRecords([]);
      if (err?.message?.includes("not been finalized")) {
        setNotFinalized(true);
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

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
        const name = `${r.studentFirstName || ""} ${r.studentLastName || ""}`.toLowerCase();
        return name.includes(q) || r.studentEmail.toLowerCase().includes(q);
      })
    : records;

  const presentCount = records.filter((r) => r.status === "present").length;
  const absentCount = records.filter((r) => r.status === "absent").length;
  const lateCount = records.filter((r) => r.status === "late").length;
  const excusedCount = records.filter((r) => r.status === "excused").length;

  const handleExport = () => {
    if (records.length === 0) return;
    const headers = ["RegistrationClassificationNumber", "Name", "Email", "Status", "Join Time", "Leave Time", "Duration (min)"];
    const rows = records.map((r) => [
      r.studentScfhsNumber || "",
      `${r.studentFirstName || ""} ${r.studentLastName || ""}`.trim(),
      r.studentEmail,
      r.status,
      r.joinedAt ? formatTime(r.joinedAt) : "",
      r.leftAt ? formatTime(r.leftAt) : "",
      r.durationMinutes && r.durationMinutes > 0 ? String(r.durationMinutes) : "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${sessionId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
      </div>

      {/* Not finalized message */}
      {notFinalized && (
        <div className="flex items-center gap-3 px-4 py-3 bg-[#FEF3C7] border border-[#FDE68A] rounded-lg">
          <Clock className="w-5 h-5 text-[#D97706] flex-shrink-0" />
          <p className="text-sm text-[#92400E]">
            Attendance has not been finalized yet. The instructor must complete attendance marking before it can be viewed.
          </p>
        </div>
      )}

      {/* Summary bar */}
      {records.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg flex-wrap">
          <span className="text-xs font-medium text-[#6B7280]">
            {t("attendance.summary")}:
          </span>
          <span className="text-xs text-[#16A34A]">{presentCount} {t("attendance.present")}</span>
          <span className="text-xs text-[#EF4444]">{absentCount} {t("attendance.absent")}</span>
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

      {/* Student list — read-only */}
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
            const status = (record.status as AttendanceStatus) || "absent";
            return (
              <div key={record.id} className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1F2937]">
                      {record.studentFirstName} {record.studentLastName}
                    </p>
                    <p className="text-xs text-[#6B7280]">{record.studentEmail}</p>
                    {record.studentScfhsNumber && (
                      <p className="text-[10px] text-[#9CA3AF] font-mono">{record.studentScfhsNumber}</p>
                    )}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}
                  >
                    {t(`attendance.${status}`)}
                  </span>
                </div>
                {record.note && (
                  <p className="text-xs text-[#6B7280] italic">Note: {record.note}</p>
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
                    {record.durationMinutes && record.durationMinutes > 0 && (
                      <span>({record.durationMinutes} min)</span>
                    )}
                  </div>
                )}
                {/* Presence bar — width reflects presence % */}
                {(() => {
                  const presPercent = (record as any).presencePercent ?? (sessionDurationMinutes && record.durationMinutes ? Math.min(Math.round((record.durationMinutes / sessionDurationMinutes) * 100), 100) : 0);
                  if (presPercent === 0 && !record.joinedAt) return null;
                  return (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
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
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TAAttendanceView;
