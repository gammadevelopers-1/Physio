"use client";

import { useState, useEffect } from "react";
import { courseManagerApi } from "@/lib/api";
import {
  X,
  Loader2,
  BookOpen,
  Users,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
} from "lucide-react";

interface InstructorPerformance {
  instructor: { id: string; firstName: string | null; lastName: string | null; email: string; avatar: string | null };
  coursesCount: number;
  totalStudents: number;
  completionRate: number;
  attendanceRate: number;
  contentQuality: { approved: number; rejected: number; pending: number; total: number };
  sessions: { total: number; completed: number };
  courses: Array<{ id: string; title: string; status: string }>;
}

interface Props {
  instructorId: string;
  onClose: () => void;
}

const InstructorDetailPanel = ({ instructorId, onClose }: Props) => {
  const [data, setData] = useState<InstructorPerformance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    courseManagerApi
      .getInstructorPerformance(instructorId)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [instructorId]);

  const getName = () => {
    if (!data) return "";
    return [data.instructor.firstName, data.instructor.lastName].filter(Boolean).join(" ") || data.instructor.email;
  };

  const getInitials = () => {
    if (!data) return "";
    if (data.instructor.firstName && data.instructor.lastName) {
      return `${data.instructor.firstName[0]}${data.instructor.lastName[0]}`.toUpperCase();
    }
    return data.instructor.email.substring(0, 2).toUpperCase();
  };

  const getRateColor = (rate: number) => {
    if (rate >= 80) return "text-[#22C55E]";
    if (rate >= 60) return "text-[#F59E0B]";
    return "text-[#EF4444]";
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#E5E7EB]">
          <h2 className="text-lg font-semibold text-[#1F2937]">Instructor Profile</h2>
          <button onClick={onClose} className="p-1 hover:bg-[#F3F4F6] rounded-lg">
            <X className="w-5 h-5 text-[#6B7280]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
            </div>
          )}

          {!loading && data && (
            <>
              {/* Profile Header */}
              <div className="flex items-center gap-4 mb-6">
                {data.instructor.avatar ? (
                  <img
                    src={data.instructor.avatar}
                    alt={getName()}
                    className="w-16 h-16 rounded-full object-cover"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      target.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`w-16 h-16 bg-[#EFF6FF] rounded-full flex items-center justify-center ${data.instructor.avatar ? 'hidden' : ''}`}>
                  <span className="text-lg font-semibold text-[#3B82F6]">{getInitials()}</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[#1F2937]">{getName()}</h3>
                  <p className="text-sm text-[#6B7280]">{data.instructor.email}</p>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-[#F9FAFB] rounded-lg p-4 text-center">
                  <TrendingUp className="w-5 h-5 text-[#3B82F6] mx-auto mb-2" />
                  <p className={`text-2xl font-bold ${getRateColor(data.completionRate)}`}>
                    {data.completionRate}%
                  </p>
                  <p className="text-xs text-[#6B7280] mt-1">Completion Rate</p>
                </div>
                <div className="bg-[#F9FAFB] rounded-lg p-4 text-center">
                  <BarChart3 className="w-5 h-5 text-[#3B82F6] mx-auto mb-2" />
                  <p className={`text-2xl font-bold ${getRateColor(data.attendanceRate)}`}>
                    {data.attendanceRate}%
                  </p>
                  <p className="text-xs text-[#6B7280] mt-1">Attendance Rate</p>
                </div>
                <div className="bg-[#F9FAFB] rounded-lg p-4 text-center">
                  <BookOpen className="w-5 h-5 text-[#3B82F6] mx-auto mb-2" />
                  <p className="text-2xl font-bold text-[#1F2937]">{data.coursesCount}</p>
                  <p className="text-xs text-[#6B7280] mt-1">Courses</p>
                </div>
                <div className="bg-[#F9FAFB] rounded-lg p-4 text-center">
                  <Users className="w-5 h-5 text-[#3B82F6] mx-auto mb-2" />
                  <p className="text-2xl font-bold text-[#1F2937]">{data.totalStudents}</p>
                  <p className="text-xs text-[#6B7280] mt-1">Students</p>
                </div>
              </div>

              {/* Content Quality */}
              <div className="bg-[#F9FAFB] rounded-lg p-4 mb-6">
                <h4 className="text-sm font-semibold text-[#1F2937] mb-3">Content Quality</h4>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
                    <span className="text-sm font-medium text-[#1F2937]">{data.contentQuality.approved}</span>
                    <span className="text-xs text-[#6B7280]">Approved</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-[#EF4444]" />
                    <span className="text-sm font-medium text-[#1F2937]">{data.contentQuality.rejected}</span>
                    <span className="text-xs text-[#6B7280]">Rejected</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#F59E0B]" />
                    <span className="text-sm font-medium text-[#1F2937]">{data.contentQuality.pending}</span>
                    <span className="text-xs text-[#6B7280]">Pending</span>
                  </div>
                </div>
                {data.contentQuality.total > 0 && (
                  <div className="mt-3">
                    <div className="h-2 bg-[#E5E7EB] rounded-full overflow-hidden flex">
                      <div
                        className="bg-[#22C55E] h-full"
                        style={{ width: `${(data.contentQuality.approved / data.contentQuality.total) * 100}%` }}
                      />
                      <div
                        className="bg-[#EF4444] h-full"
                        style={{ width: `${(data.contentQuality.rejected / data.contentQuality.total) * 100}%` }}
                      />
                      <div
                        className="bg-[#F59E0B] h-full"
                        style={{ width: `${(data.contentQuality.pending / data.contentQuality.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Sessions */}
              <div className="bg-[#F9FAFB] rounded-lg p-4 mb-6">
                <h4 className="text-sm font-semibold text-[#1F2937] mb-2">Sessions</h4>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-[#6B7280]">
                    {data.sessions.completed} completed / {data.sessions.total} total
                  </span>
                </div>
                {data.sessions.total > 0 && (
                  <div className="mt-2 h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                    <div
                      className="bg-[#3B82F6] h-full rounded-full"
                      style={{ width: `${(data.sessions.completed / data.sessions.total) * 100}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Courses List */}
              <div>
                <h4 className="text-sm font-semibold text-[#1F2937] mb-3">Courses</h4>
                <div className="space-y-2">
                  {data.courses.map((course) => (
                    <div key={course.id} className="flex items-center justify-between p-3 bg-[#F9FAFB] rounded-lg">
                      <span className="text-sm text-[#1F2937] truncate">{course.title}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        course.status === "active"
                          ? "bg-[#D1FAE5] text-[#065F46]"
                          : course.status === "draft"
                          ? "bg-[#F3F4F6] text-[#6B7280]"
                          : "bg-[#EFF6FF] text-[#3B82F6]"
                      }`}>
                        {course.status}
                      </span>
                    </div>
                  ))}
                  {data.courses.length === 0 && (
                    <p className="text-sm text-[#6B7280] text-center py-4">No courses assigned</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default InstructorDetailPanel;
