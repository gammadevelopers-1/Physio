"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import TANavbar from "./TANavbar";
import TASidebar from "./TASidebar";
import { taApi } from "@/lib/api";
import type { CourseDetailResponse, CourseEnrollment, CourseSession } from "@/types/instructor-dashboard";
import {
  ArrowLeft,
  Users,
  Calendar,
  Clock,
  BarChart3,
  Video,
  MapPin,
  BookOpen,
  Loader2,
  AlertTriangle,
} from "lucide-react";

interface TACourseDetailContentProps {
  courseId: string;
}

// ─── Helpers ──────────────────────────────────────────────────

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(start: string | null, end: string | null) {
  if (!start || !end) return "—";
  const days = Math.ceil(
    (new Date(end).getTime() - new Date(start).getTime()) / 86400000
  );
  if (days <= 0) return "1 day";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function formatSessionDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sessionDay = new Date(d);
  sessionDay.setHours(0, 0, 0, 0);
  if (sessionDay.getTime() === today.getTime()) return "Today";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatSessionTime(dateStr: string, durationMinutes: number) {
  const start = new Date(dateStr);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${fmt(start)} – ${fmt(end)}`;
}

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    scheduled: "bg-[#EFF6FF] text-[#3B82F6]",
    live: "bg-[#FEF3C7] text-[#D97706]",
    completed: "bg-[#DCFCE7] text-[#22C55E]",
    cancelled: "bg-[#FEE2E2] text-[#EF4444]",
    ended: "bg-[#F3F4F6] text-[#6B7280]",
  };
  return map[status] || "bg-[#F3F4F6] text-[#6B7280]";
};

const sessionTypeIcon = (type: string) => {
  if (type === "zoom") return <Video className="w-4 h-4 text-[#3B82F6]" />;
  if (type === "onsite") return <MapPin className="w-4 h-4 text-[#22C55E]" />;
  return <BookOpen className="w-4 h-4 text-[#9333EA]" />;
};

// ─── Component ──────────────────────────────────────────────────

export default function TACourseDetailContent({ courseId }: TACourseDetailContentProps) {
  const locale = useLocale();
  const t = useTranslations("instructorDashboard");

  const [course, setCourse] = useState<CourseDetailResponse | null>(null);
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([]);
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "students" | "sessions">("overview");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [courseResult, enrollmentResult, sessionsResult] = await Promise.all([
        taApi.getCourseDetail(courseId),
        taApi.getCourseEnrollments(courseId).catch(() => [] as CourseEnrollment[]),
        taApi.getCourseSessions(courseId).catch(() => ({ data: [] as CourseSession[] })),
      ]);
      setCourse(courseResult);
      setEnrollments(enrollmentResult);
      setSessions(sessionsResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load course");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const courseTitle = locale === "ar" && course?.titleAr ? course.titleAr : course?.title || "";
  const courseDescription = locale === "ar" && course?.descriptionAr ? course.descriptionAr : course?.description || "";

  const deliveryIcon =
    course?.deliveryType === "zoom" ? (
      <Video className="w-3.5 h-3.5" />
    ) : course?.deliveryType === "onsite" ? (
      <MapPin className="w-3.5 h-3.5" />
    ) : (
      <BookOpen className="w-3.5 h-3.5" />
    );

  const tabs = [
    { id: "overview" as const, label: t("courseDetail.tabs.overview") },
    { id: "students" as const, label: t("courseDetail.tabs.students") },
    { id: "sessions" as const, label: t("courseDetail.tabs.sessions") },
  ];

  return (
    <main id="main-content" className="min-h-screen bg-[#F9FAFB]">
      <TANavbar />
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="hidden lg:block">
            <TASidebar />
          </div>

          {loading && (
            <div className="flex-1 min-w-0 flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6]" />
            </div>
          )}

          {!loading && error && (
            <div className="flex-1 min-w-0">
              <Link
                href={`/${locale}/dashboard/teaching-assistant/courses`}
                className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#1F2937] mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("courseDetail.backToCourses")}
              </Link>
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center">
                <AlertTriangle className="w-10 h-10 text-[#F59E0B] mx-auto mb-3" />
                <p className="text-[#6B7280] mb-4">{error}</p>
                <button
                  onClick={fetchData}
                  className="px-4 py-2 bg-[#3B82F6] text-white text-sm rounded-lg hover:bg-[#2563EB]"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {!loading && !error && course && (
            <div className="flex-1 min-w-0">
              <Link
                href={`/${locale}/dashboard/teaching-assistant/courses`}
                className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#1F2937] mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("courseDetail.backToCourses")}
              </Link>

              {/* Course Header — same as instructor */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden mb-6">
                <div className="relative h-48 sm:h-56">
                  {course.thumbnail ? (
                    <Image
                      src={course.thumbnail}
                      alt={courseTitle}
                      fill
                      className="object-cover"
                      unoptimized={course.thumbnail.startsWith("http")}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                          course.status === "active"
                            ? "bg-[#DCFCE7] text-[#22C55E]"
                            : course.status === "draft"
                            ? "bg-[#FEF3C7] text-[#D4A520]"
                            : course.status === "completed"
                            ? "bg-[#EFF6FF] text-[#3B82F6]"
                            : "bg-[#F3F4F6] text-[#6B7280]"
                        }`}
                      >
                        {t(`courses.status.${course.status}`)}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/90 rounded-md text-xs font-medium text-[#374151]">
                        {deliveryIcon}
                        {t(`courses.delivery.${course.deliveryType}`)}
                      </span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white">{courseTitle}</h1>
                  </div>
                </div>

                {/* Stats Bar */}
                <div className="p-4 border-t border-[#E5E7EB]">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#EFF6FF] rounded-lg flex items-center justify-center">
                        <Users className="w-5 h-5 text-[#3B82F6]" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-[#1F2937]">{enrollments.length}</p>
                        <p className="text-xs text-[#6B7280]">{t("courseDetail.students")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#FEF3C7] rounded-lg flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-[#D4A520]" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-[#1F2937]">
                          {sessions.filter((s) => s.status === "completed").length}/{sessions.length}
                        </p>
                        <p className="text-xs text-[#6B7280]">{t("courseDetail.sessions")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#DCFCE7] rounded-lg flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-[#22C55E]" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-[#1F2937]">
                          {enrollments.length > 0
                            ? Math.round(enrollments.reduce((sum, e) => sum + e.progress, 0) / enrollments.length)
                            : 0}%
                        </p>
                        <p className="text-xs text-[#6B7280]">{t("courseDetail.completion")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#F3E8FF] rounded-lg flex items-center justify-center">
                        <Clock className="w-5 h-5 text-[#9333EA]" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-[#1F2937]">
                          {formatDuration(course.startDate, course.endDate)}
                        </p>
                        <p className="text-xs text-[#6B7280]">{t("courseDetail.duration")}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                <div className="flex border-b border-[#E5E7EB] overflow-x-auto" role="tablist">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap relative transition-colors ${
                        activeTab === tab.id ? "text-[#3B82F6]" : "text-[#6B7280] hover:text-[#374151]"
                      }`}
                    >
                      {tab.label}
                      {activeTab === tab.id && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3B82F6]" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="p-5">
                  {/* ═══ OVERVIEW ═══ */}
                  {activeTab === "overview" && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-base font-semibold text-[#1F2937] mb-2">{t("courseDetail.description")}</h3>
                        <p className="text-sm text-[#6B7280] leading-relaxed whitespace-pre-wrap">
                          {courseDescription || t("courseDetail.noDescription")}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-[#1F2937] mb-3">{t("courseDetail.courseInfo")}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div className="p-4 bg-[#F9FAFB] rounded-lg">
                            <p className="text-xs text-[#6B7280] mb-1">{t("courseDetail.deliveryTypeLabel")}</p>
                            <p className="text-sm font-medium text-[#1F2937] capitalize">{t(`courses.delivery.${course.deliveryType}`)}</p>
                          </div>
                          <div className="p-4 bg-[#F9FAFB] rounded-lg">
                            <p className="text-xs text-[#6B7280] mb-1">{t("courseDetail.statusLabel")}</p>
                            <p className="text-sm font-medium text-[#1F2937] capitalize">{t(`courses.status.${course.status}`)}</p>
                          </div>
                          <div className="p-4 bg-[#F9FAFB] rounded-lg">
                            <p className="text-xs text-[#6B7280] mb-1">{t("courseDetail.maxEnrollmentLabel")}</p>
                            <p className="text-sm font-medium text-[#1F2937]">{course.maxEnrollment || "—"}</p>
                          </div>
                          <div className="p-4 bg-[#F9FAFB] rounded-lg">
                            <p className="text-xs text-[#6B7280] mb-1">{t("courseDetail.startDate")}</p>
                            <p className="text-sm font-medium text-[#1F2937]">{formatDate(course.startDate)}</p>
                          </div>
                          <div className="p-4 bg-[#F9FAFB] rounded-lg">
                            <p className="text-xs text-[#6B7280] mb-1">{t("courseDetail.endDate")}</p>
                            <p className="text-sm font-medium text-[#1F2937]">{formatDate(course.endDate)}</p>
                          </div>
                          <div className="p-4 bg-[#F9FAFB] rounded-lg">
                            <p className="text-xs text-[#6B7280] mb-1">{t("courseDetail.enrollmentCount")}</p>
                            <p className="text-sm font-medium text-[#1F2937]">
                              {enrollments.length}{course.maxEnrollment ? ` / ${course.maxEnrollment}` : ""}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Modules list (read-only) */}
                      {course.modules && course.modules.length > 0 && (
                        <div>
                          <h3 className="text-base font-semibold text-[#1F2937] mb-3">{t("courseDetail.tabs.modules")}</h3>
                          <div className="space-y-2">
                            {course.modules.map((mod, idx) => (
                              <div
                                key={mod.id}
                                className="flex items-center gap-3 p-3 bg-[#F9FAFB] rounded-lg"
                              >
                                <span className="w-7 h-7 flex items-center justify-center bg-[#EFF6FF] rounded-full text-xs font-medium text-[#3B82F6]">
                                  {idx + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-[#1F2937] truncate">
                                    {locale === "ar" && mod.titleAr ? mod.titleAr : mod.title}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ═══ STUDENTS ═══ */}
                  {activeTab === "students" && (
                    <div>
                      {enrollments.length === 0 ? (
                        <div className="text-center py-10">
                          <Users className="w-10 h-10 text-[#D1D5DB] mx-auto mb-3" />
                          <p className="text-sm text-[#6B7280]">{t("courseDetail.noStudents")}</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-[#E5E7EB]">
                                <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">
                                  {t("courseDetail.regNumber")}
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">
                                  {t("courseDetail.name")}
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">
                                  {t("courseDetail.email")}
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">
                                  {t("courseDetail.progress")}
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-[#6B7280] uppercase">
                                  {t("courseDetail.status")}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {enrollments.map((e) => (
                                <tr key={e.id} className="border-b border-[#F3F4F6]">
                                  <td className="px-4 py-3 text-xs text-[#9CA3AF] font-mono">{(e as any).studentScfhsNumber || "—"}</td>
                                  <td className="px-4 py-3 text-sm text-[#1F2937]">
                                    {[e.studentFirstName, e.studentLastName].filter(Boolean).join(" ") || "—"}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-[#6B7280]">{e.studentEmail}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-20 h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-[#3B82F6] rounded-full"
                                          style={{ width: `${e.progress}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-[#6B7280]">{e.progress}%</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span
                                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                                        e.status === "active"
                                          ? "bg-[#DCFCE7] text-[#22C55E]"
                                          : e.status === "completed"
                                          ? "bg-[#EFF6FF] text-[#3B82F6]"
                                          : "bg-[#F3F4F6] text-[#6B7280]"
                                      }`}
                                    >
                                      {e.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ═══ SESSIONS ═══ */}
                  {activeTab === "sessions" && (
                    <div>
                      {sessions.length === 0 ? (
                        <div className="text-center py-10">
                          <Calendar className="w-10 h-10 text-[#D1D5DB] mx-auto mb-3" />
                          <p className="text-sm text-[#6B7280]">{t("courseDetail.noSessions")}</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {sessions
                            .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                            .map((session) => (
                              <div
                                key={session.id}
                                className="flex items-center justify-between p-4 bg-[#F9FAFB] rounded-lg"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-10 h-10 bg-white rounded-lg border border-[#E5E7EB] flex items-center justify-center">
                                    {sessionTypeIcon(session.type)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-[#1F2937] truncate">{session.title}</p>
                                    <p className="text-xs text-[#6B7280]">
                                      {formatSessionDate(session.scheduledAt)} &bull;{" "}
                                      {formatSessionTime(session.scheduledAt, session.durationMinutes)} &bull;{" "}
                                      {session.durationMinutes} min
                                    </p>
                                  </div>
                                </div>
                                <span
                                  className={`px-2.5 py-1 rounded-md text-xs font-medium flex-shrink-0 ${statusBadge(session.status)}`}
                                >
                                  {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                                </span>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
