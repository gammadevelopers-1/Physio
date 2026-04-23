"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
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
  GraduationCap,
  Mail,
  Calendar,
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
  const t = useTranslations("courseManagerDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const [data, setData] = useState<InstructorPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setLoading(true);
    courseManagerApi
      .getInstructorPerformance(instructorId)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
    // Trigger slide-in after mount
    requestAnimationFrame(() => setVisible(true));
  }, [instructorId]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const getName = () => {
    if (!data) return "";
    if (isRTL && ((data.instructor as any).firstNameAr || (data.instructor as any).lastNameAr)) {
      return [(data.instructor as any).firstNameAr, (data.instructor as any).lastNameAr].filter(Boolean).join(" ");
    }
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

  const getRateBg = (rate: number) => {
    if (rate >= 80) return "bg-[#DCFCE7]";
    if (rate >= 60) return "bg-[#FEF3C7]";
    return "bg-[#FEE2E2]";
  };

  const sessionPercent = data && data.sessions.total > 0
    ? Math.round((data.sessions.completed / data.sessions.total) * 100)
    : 0;

  const contentTotal = data?.contentQuality.total || 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={handleClose}
      />

      {/* Slide Panel */}
      <div
        className={`fixed inset-y-0 ${isRTL ? "left-0" : "right-0"} z-50 w-full max-w-[440px] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          visible
            ? "translate-x-0"
            : isRTL ? "-translate-x-full" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)] bg-gradient-to-r from-[#F9FAFB] to-white">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-[var(--color-primary-dark)]" />
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("instructorDetail.title")}</h2>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors">
            <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
            </div>
          )}

          {!loading && data && (
            <>
              {/* Profile Hero */}
              <div className="px-6 py-6 bg-gradient-to-b from-[#F0F7FF] to-white">
                <div className="flex items-center gap-4">
                  {data.instructor.avatar ? (
                    <img
                      src={data.instructor.avatar}
                      alt={getName()}
                      className="w-18 h-18 rounded-full object-cover ring-4 ring-white shadow-md"
                      style={{ width: 72, height: 72 }}
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`rounded-full bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] flex items-center justify-center ring-4 ring-white shadow-md ${data.instructor.avatar ? 'hidden' : ''}`} style={{ width: 72, height: 72 }}>
                    <span className="text-xl font-bold text-white">{getInitials()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-[var(--color-text-primary)] truncate">{getName()}</h3>
                    <div className="flex items-center gap-1.5 mt-1 text-sm text-[var(--color-text-secondary)]">
                      <Mail className="w-3.5 h-3.5" />
                      <span className="truncate">{data.instructor.email}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-6">
                {/* Performance KPIs */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className={`rounded-xl p-4 text-center border ${getRateBg(data.completionRate)} border-transparent`}>
                    <TrendingUp className="w-5 h-5 text-[#3B82F6] mx-auto mb-1.5" />
                    <p className={`text-2xl font-bold ${getRateColor(data.completionRate)}`}>
                      {data.completionRate}%
                    </p>
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">{t("instructorDetail.completionRate")}</p>
                  </div>
                  <div className={`rounded-xl p-4 text-center border ${getRateBg(data.attendanceRate)} border-transparent`}>
                    <BarChart3 className="w-5 h-5 text-[#3B82F6] mx-auto mb-1.5" />
                    <p className={`text-2xl font-bold ${getRateColor(data.attendanceRate)}`}>
                      {data.attendanceRate}%
                    </p>
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">{t("instructorDetail.attendanceRate")}</p>
                  </div>
                </div>

                {/* Quick Stats Row */}
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="bg-[#F9FAFB] rounded-xl p-3 text-center border border-[var(--color-border)]">
                    <BookOpen className="w-4 h-4 text-[var(--color-primary-dark)] mx-auto mb-1" />
                    <p className="text-xl font-bold text-[var(--color-text-primary)]">{data.coursesCount}</p>
                    <p className="text-[10px] text-[var(--color-text-secondary)]">{t("instructorDetail.courses")}</p>
                  </div>
                  <div className="bg-[#F9FAFB] rounded-xl p-3 text-center border border-[var(--color-border)]">
                    <Users className="w-4 h-4 text-[var(--color-primary-dark)] mx-auto mb-1" />
                    <p className="text-xl font-bold text-[var(--color-text-primary)]">{data.totalStudents}</p>
                    <p className="text-[10px] text-[var(--color-text-secondary)]">{t("instructorDetail.students")}</p>
                  </div>
                  <div className="bg-[#F9FAFB] rounded-xl p-3 text-center border border-[var(--color-border)]">
                    <Calendar className="w-4 h-4 text-[var(--color-primary-dark)] mx-auto mb-1" />
                    <p className="text-xl font-bold text-[var(--color-text-primary)]">{data.sessions.total}</p>
                    <p className="text-[10px] text-[var(--color-text-secondary)]">{t("instructorDetail.lectures")}</p>
                  </div>
                </div>

                {/* Lectures Progress */}
                <div className="mt-5 bg-[#F9FAFB] rounded-xl p-4 border border-[var(--color-border)]">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">{t("instructorDetail.lectures")}</h4>
                    <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                      {data.sessions.completed}/{data.sessions.total} ({sessionPercent}%)
                    </span>
                  </div>
                  <div className="h-2.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#3B82F6] to-[#60A5FA] rounded-full transition-all"
                      style={{ width: `${sessionPercent}%` }}
                    />
                  </div>
                </div>

                {/* Content Quality */}
                <div className="mt-4 bg-[#F9FAFB] rounded-xl p-4 border border-[var(--color-border)]">
                  <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">{t("instructorDetail.contentQuality")}</h4>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">{data.contentQuality.approved}</span>
                      <span className="text-xs text-[var(--color-text-secondary)]">{t("instructorDetail.approved")}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <XCircle className="w-4 h-4 text-[#EF4444]" />
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">{data.contentQuality.rejected}</span>
                      <span className="text-xs text-[var(--color-text-secondary)]">{t("instructorDetail.rejected")}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-[#F59E0B]" />
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">{data.contentQuality.pending}</span>
                      <span className="text-xs text-[var(--color-text-secondary)]">{t("instructorDetail.pending")}</span>
                    </div>
                  </div>
                  {contentTotal > 0 && (
                    <div className="mt-3 h-2 bg-[var(--color-border)] rounded-full overflow-hidden flex">
                      <div className="bg-[#22C55E] h-full" style={{ width: `${(data.contentQuality.approved / contentTotal) * 100}%` }} />
                      <div className="bg-[#EF4444] h-full" style={{ width: `${(data.contentQuality.rejected / contentTotal) * 100}%` }} />
                      <div className="bg-[#F59E0B] h-full" style={{ width: `${(data.contentQuality.pending / contentTotal) * 100}%` }} />
                    </div>
                  )}
                </div>

                {/* Assigned Courses */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {t("instructorDetail.courses")}
                    </h4>
                    <span className="text-xs text-[var(--color-text-secondary)] bg-[#F3F4F6] px-2 py-0.5 rounded-full">
                      {data.courses.length}
                    </span>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto space-y-2 rounded-xl border border-[var(--color-border)] p-2 bg-[#FAFAFA]">
                    {data.courses.map((course) => (
                      <div key={course.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-[#F3F4F6] hover:border-[var(--color-border)] transition-colors">
                        <span className="text-sm text-[var(--color-text-primary)] truncate flex-1 me-3">{course.title}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${
                          course.status === "active"
                            ? "bg-[#D1FAE5] text-[#065F46]"
                            : course.status === "draft"
                            ? "bg-[#F3F4F6] text-[var(--color-text-secondary)]"
                            : course.status === "completed"
                            ? "bg-[#EFF6FF] text-[#3B82F6]"
                            : "bg-[#F3F4F6] text-[var(--color-text-secondary)]"
                        }`}>
                          {t(`coursesPage.status.${course.status}` as Parameters<typeof t>[0])}
                        </span>
                      </div>
                    ))}
                    {data.courses.length === 0 && (
                      <div className="py-6 text-center">
                        <BookOpen className="w-6 h-6 text-[var(--color-border)] mx-auto mb-2" />
                        <p className="text-sm text-[var(--color-text-secondary)]">{t("instructorDetail.noCourses")}</p>
                      </div>
                    )}
                  </div>
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
