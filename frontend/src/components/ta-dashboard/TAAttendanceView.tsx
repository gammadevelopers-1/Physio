"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ArrowLeft, Info, Clock, Search } from "lucide-react";
import api from "@/lib/api";

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
}

interface TAAttendanceViewProps {
  sessionId: string;
  onBack: () => void;
}

const TAAttendanceView = ({ sessionId, onBack }: TAAttendanceViewProps) => {
  const t = useTranslations("taDashboard");
  const locale = useLocale();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchAttendance = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<AttendanceRecord[]>(
        `/sessions/${sessionId}/attendance`
      );
      setRecords(data);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      present: "bg-green-50 text-green-700",
      absent: "bg-red-50 text-red-700",
      late: "bg-yellow-50 text-yellow-700",
      excused: "bg-blue-50 text-blue-700",
    };
    return styles[status] || "bg-gray-50 text-gray-700";
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

  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Read-only notice */}
      <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
        <Info className="w-5 h-5 text-blue-600 shrink-0" />
        <p className="text-sm text-blue-700">{t("attendance.readOnly")}</p>
      </div>

      {/* Search */}
      {records.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("attendance.searchPlaceholder")}
            className="w-full pl-10 pr-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] bg-white focus:outline-none focus:ring-2 focus:ring-[#002D87]/20"
          />
        </div>
      )}

      {/* Attendance Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#002D87] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center">
          <p className="text-[#6B7280]">{t("attendance.noRecords")}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <th className="text-left px-4 py-3 text-sm font-medium text-[#4B5563]">
                    {t("attendance.studentName")}
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-[#4B5563]">
                    {t("attendance.studentEmail")}
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-[#4B5563]">
                    {t("attendance.status")}
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-[#4B5563]">
                    {t("attendance.joinTime")}
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-[#4B5563]">
                    {t("attendance.leaveTime")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="border-b border-[#E5E7EB] last:border-b-0"
                  >
                    <td className="px-4 py-3 text-sm text-[#1F2937]">
                      {record.firstName} {record.lastName}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#6B7280]">
                      {record.email}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(record.status)}`}>
                        {t(`attendance.${record.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#6B7280]">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {formatTime(record.joinedAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#6B7280]">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {formatTime(record.leftAt)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default TAAttendanceView;
