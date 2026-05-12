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
  Star,
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
  const [reviews, setReviews] = useState<{
    data: Array<{
      id: string;
      courseId: string;
      courseTitle: string;
      courseTitleAr: string | null;
      rating: number;
      reviewText: string | null;
      createdAt: string;
      studentName: string;
    }>;
    avgRating: number;
    totalRatings: number;
  } | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(true);

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

  // Load instructor reviews — published + approved across every course taught
  useEffect(() => {
    setReviewsLoading(true);
    courseManagerApi
      .getReviewsForInstructor(instructorId, 20)
      .then(setReviews)
      .catch(() => setReviews(null))
      .finally(() => setReviewsLoading(false));
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
        className={`fixed inset-y-0 ${isRTL ? "left-0" : "right-0"} z-50 w-full max-w-[440px] bg-[var(--color-surface-card)] shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
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
          <button onClick={handleClose} className="p-2 hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors">
            <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
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
                    <TrendingUp className="w-5 h-5 text-[var(--color-primary)] mx-auto mb-1.5" />
                    <p className={`text-2xl font-bold ${getRateColor(data.completionRate)}`}>
                      {data.completionRate}%
                    </p>
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">{t("instructorDetail.completionRate")}</p>
                  </div>
                  <div className={`rounded-xl p-4 text-center border ${getRateBg(data.attendanceRate)} border-transparent`}>
                    <BarChart3 className="w-5 h-5 text-[var(--color-primary)] mx-auto mb-1.5" />
                    <p className={`text-2xl font-bold ${getRateColor(data.attendanceRate)}`}>
                      {data.attendanceRate}%
                    </p>
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">{t("instructorDetail.attendanceRate")}</p>
                  </div>
                </div>

                {/* Quick Stats Row */}
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="bg-[var(--color-surface-page)] rounded-xl p-3 text-center border border-[var(--color-border)]">
                    <BookOpen className="w-4 h-4 text-[var(--color-primary-dark)] mx-auto mb-1" />
                    <p className="text-xl font-bold text-[var(--color-text-secondary)]">{data.coursesCount}</p>
                    <p className="text-[10px] text-[var(--color-text-secondary)]">{t("instructorDetail.courses")}</p>
                  </div>
                  <div className="bg-[var(--color-surface-page)] rounded-xl p-3 text-center border border-[var(--color-border)]">
                    <Users className="w-4 h-4 text-[var(--color-primary-dark)] mx-auto mb-1" />
                    <p className="text-xl font-bold text-[var(--color-text-secondary)]">{data.totalStudents}</p>
                    <p className="text-[10px] text-[var(--color-text-secondary)]">{t("instructorDetail.students")}</p>
                  </div>
                  <div className="bg-[var(--color-surface-page)] rounded-xl p-3 text-center border border-[var(--color-border)]">
                    <Calendar className="w-4 h-4 text-[var(--color-primary-dark)] mx-auto mb-1" />
                    <p className="text-xl font-bold text-[var(--color-text-secondary)]">{data.sessions.total}</p>
                    <p className="text-[10px] text-[var(--color-text-secondary)]">{t("instructorDetail.lectures")}</p>
                  </div>
                </div>

                {/* Lectures Progress */}
                <div className="mt-5 bg-[var(--color-surface-page)] rounded-xl p-4 border border-[var(--color-border)]">
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
                <div className="mt-4 bg-[var(--color-surface-page)] rounded-xl p-4 border border-[var(--color-border)]">
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
                    <span className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-border-subtle)] px-2 py-0.5 rounded-full">
                      {data.courses.length}
                    </span>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto space-y-2 rounded-xl border border-[var(--color-border)] p-2 bg-[#FAFAFA]">
                    {data.courses.map((course) => (
                      <div key={course.id} className="flex items-center justify-between p-3 bg-[var(--color-surface-card)] rounded-lg border border-[#F3F4F6] hover:border-[var(--color-border)] transition-colors">
                        <span className="text-sm text-[var(--color-text-primary)] truncate flex-1 me-3">{course.title}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${
                          course.status === "active"
                            ? "bg-[#D1FAE5] text-[#065F46]"
                            : course.status === "draft"
                            ? "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
                            : course.status === "completed"
                            ? "bg-[var(--color-border-subtle)] text-[var(--color-primary)]"
                            : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
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

                {/* Reviews — approved + published instructor reviews across courses */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {isRTL ? "مراجعات الطلاب" : "Student Reviews"}
                    </h4>
                    {reviews && reviews.totalRatings > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5 text-[var(--color-star)] fill-[var(--color-star)]" />
                        <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                          {reviews.avgRating.toFixed(1)}
                        </span>
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          ({reviews.totalRatings})
                        </span>
                      </div>
                    )}
                  </div>
                  {reviewsLoading ? (
                    <div className="py-6 flex justify-center">
                      <Loader2 className="w-4 h-4 animate-spin text-[var(--color-text-secondary)]" />
                    </div>
                  ) : !reviews || reviews.data.length === 0 ? (
                    <div className="py-6 text-center rounded-xl border border-[var(--color-border)] bg-[#FAFAFA]">
                      <Star className="w-6 h-6 text-[var(--color-star-border)] mx-auto mb-2" />
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {isRTL ? "لا توجد مراجعات بعد" : "No reviews yet"}
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-[280px] overflow-y-auto space-y-2 rounded-xl border border-[var(--color-border)] p-2 bg-[#FAFAFA]">
                      {reviews.data.map((r) => {
                        const courseTitle =
                          isRTL && r.courseTitleAr ? r.courseTitleAr : r.courseTitle;
                        return (
                          <div
                            key={r.id}
                            className="p-3 bg-[var(--color-surface-card)] rounded-lg border border-[#F3F4F6]"
                          >
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                                  {r.studentName}
                                </p>
                                <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] truncate max-w-[180px]">
                                  {courseTitle}
                                </span>
                              </div>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star
                                    key={s}
                                    className={`w-3 h-3 ${
                                      s <= r.rating
                                        ? "text-[var(--color-star)] fill-[var(--color-star)]"
                                        : "text-[var(--color-star-border)]"
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                            {r.reviewText && (
                              <p
                                dir="auto"
                                className="text-xs text-[var(--color-text-secondary)] whitespace-pre-line line-clamp-3"
                              >
                                {r.reviewText}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
