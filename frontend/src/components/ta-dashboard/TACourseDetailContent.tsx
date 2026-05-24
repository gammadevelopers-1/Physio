"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import TANavbar from "./TANavbar";
import TASidebar from "./TASidebar";
import { taApi } from "@/lib/api";
import type { CourseDetailResponse, CourseEnrollment, CourseSession } from "@/types/instructor-dashboard";
import { usePlatformLocale } from "@/contexts/PlatformLocaleContext";
import { formatPlatformDate, formatPlatformDateReadable, formatPlatformTime, type PlatformLocaleSettings } from "@/lib/platform-locale";
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

function formatDate(dateStr: string | null, settings: PlatformLocaleSettings, locale: string) {
  return formatPlatformDateReadable(dateStr, settings, locale === "ar" ? "ar" : "en");
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

function formatSessionDate(dateStr: string, settings: PlatformLocaleSettings) {
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sessionDay = new Date(d);
  sessionDay.setHours(0, 0, 0, 0);
  if (sessionDay.getTime() === today.getTime()) return "Today";
  return formatPlatformDate(dateStr, settings);
}

function formatSessionTime(dateStr: string, durationMinutes: number, settings: PlatformLocaleSettings, locale: string) {
  const start = new Date(dateStr);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const loc = locale === "ar" ? "ar" : "en";
  return `${formatPlatformTime(start, settings, loc)} – ${formatPlatformTime(end, settings, loc)}`;
}

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    scheduled: "bg-[var(--color-border-subtle)] text-[var(--color-primary)]",
    live: "bg-[#FEF3C7] text-[#D97706]",
    completed: "bg-[#DCFCE7] text-[#22C55E]",
    cancelled: "bg-[#FEE2E2] text-[#EF4444]",
    ended: "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]",
  };
  return map[status] || "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
};

const sessionTypeIcon = (type: string) => {
  if (type === "zoom") return <Video className="w-4 h-4 text-[var(--color-primary)]" />;
  if (type === "onsite") return <MapPin className="w-4 h-4 text-[#22C55E]" />;
  return <BookOpen className="w-4 h-4 text-[#9333EA]" />;
};

// ─── Component ──────────────────────────────────────────────────

export default function TACourseDetailContent({ courseId }: TACourseDetailContentProps) {
  const locale = useLocale();
  const t = useTranslations("instructorDashboard");
  const platformLocale = usePlatformLocale();

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
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <TANavbar />
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="hidden lg:block">
            <TASidebar />
          </div>

          {loading && (
            <div className="flex-1 min-w-0 flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
            </div>
          )}

          {!loading && error && (
            <div className="flex-1 min-w-0">
              <Link
                href={`/${locale}/dashboard/teaching-assistant/courses`}
                className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("courseDetail.backToCourses")}
              </Link>
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-8 text-center">
                <AlertTriangle className="w-10 h-10 text-[#F59E0B] mx-auto mb-3" />
                <p className="text-[var(--color-text-secondary)] mb-4">{error}</p>
                <button
                  onClick={fetchData}
                  className="px-4 py-2 bg-[var(--color-primary)] text-white text-sm rounded-lg hover:bg-[var(--color-primary-dark)]"
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
                className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("courseDetail.backToCourses")}
              </Link>

              {/* Course Header — same as instructor */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden mb-6">
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
                            ? "bg-[var(--color-border-subtle)] text-[var(--color-primary)]"
                            : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
                        }`}
                      >
                        {t(`courses.status.${course.status}`)}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--color-surface-card)]/90 rounded-md text-xs font-medium text-[var(--color-text-secondary)]">
                        {deliveryIcon}
                        {t(`courses.delivery.${course.deliveryType}`)}
                      </span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white">{courseTitle}</h1>
                  </div>
                </div>

                {/* Stats Bar */}
                <div className="p-4 border-t border-[var(--color-border)]">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[var(--color-border-subtle)] rounded-lg flex items-center justify-center">
                        <Users className="w-5 h-5 text-[var(--color-primary)]" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-[var(--color-text-secondary)]">{enrollments.length}</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">{t("courseDetail.students")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#FEF3C7] rounded-lg flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-[#D4A520]" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-[var(--color-text-secondary)]">
                          {sessions.filter((s) => s.status === "completed").length}/{sessions.length}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">{t("courseDetail.sessions")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#DCFCE7] rounded-lg flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-[#22C55E]" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-[var(--color-text-secondary)]">
                          {enrollments.length > 0
                            ? Math.round(enrollments.reduce((sum, e) => sum + e.progress, 0) / enrollments.length)
                            : 0}%
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">{t("courseDetail.completion")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#F3E8FF] rounded-lg flex items-center justify-center">
                        <Clock className="w-5 h-5 text-[#9333EA]" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-[var(--color-text-secondary)]">
                          {formatDuration(course.startDate, course.endDate)}
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)]">{t("courseDetail.duration")}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                <div className="flex border-b border-[var(--color-border)] overflow-x-auto" role="tablist">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      role="tab"
                      aria-selected={activeTab === tab.id}
                      className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap relative transition-colors ${
                        activeTab === tab.id ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]"
                      }`}
                    >
                      {tab.label}
                      {activeTab === tab.id && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)]" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="p-5">
                  {/* ═══ OVERVIEW ═══ */}
                  {activeTab === "overview" && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">{t("courseDetail.description")}</h3>
                        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
                          {courseDescription || t("courseDetail.noDescription")}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-3">{t("courseDetail.courseInfo")}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div className="p-4 bg-[var(--color-surface-page)] rounded-lg">
                            <p className="text-xs text-[var(--color-text-secondary)] mb-1">{t("courseDetail.deliveryTypeLabel")}</p>
                            <p className="text-sm font-medium text-[var(--color-text-secondary)] capitalize">{t(`courses.delivery.${course.deliveryType}`)}</p>
                          </div>
                          <div className="p-4 bg-[var(--color-surface-page)] rounded-lg">
                            <p className="text-xs text-[var(--color-text-secondary)] mb-1">{t("courseDetail.statusLabel")}</p>
                            <p className="text-sm font-medium text-[var(--color-text-secondary)] capitalize">{t(`courses.status.${course.status}`)}</p>
                          </div>
                          <div className="p-4 bg-[var(--color-surface-page)] rounded-lg">
                            <p className="text-xs text-[var(--color-text-secondary)] mb-1">{t("courseDetail.maxEnrollmentLabel")}</p>
                            <p className="text-sm font-medium text-[var(--color-text-secondary)]">{course.maxEnrollment || "—"}</p>
                          </div>
                          <div className="p-4 bg-[var(--color-surface-page)] rounded-lg">
                            <p className="text-xs text-[var(--color-text-secondary)] mb-1">{t("courseDetail.startDate")}</p>
                            <p className="text-sm font-medium text-[var(--color-text-secondary)]">{formatDate(course.startDate, platformLocale, locale)}</p>
                          </div>
                          <div className="p-4 bg-[var(--color-surface-page)] rounded-lg">
                            <p className="text-xs text-[var(--color-text-secondary)] mb-1">{t("courseDetail.endDate")}</p>
                            <p className="text-sm font-medium text-[var(--color-text-secondary)]">{formatDate(course.endDate, platformLocale, locale)}</p>
                          </div>
                          <div className="p-4 bg-[var(--color-surface-page)] rounded-lg">
                            <p className="text-xs text-[var(--color-text-secondary)] mb-1">{t("courseDetail.enrollmentCount")}</p>
                            <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                              {enrollments.length}{course.maxEnrollment ? ` / ${course.maxEnrollment}` : ""}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Modules list (read-only) */}
                      {course.modules && course.modules.length > 0 && (
                        <div>
                          <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-3">{t("courseDetail.tabs.modules")}</h3>
                          <div className="space-y-2">
                            {course.modules.map((mod, idx) => (
                              <div
                                key={mod.id}
                                className="flex items-center gap-3 p-3 bg-[var(--color-surface-page)] rounded-lg"
                              >
                                <span className="w-7 h-7 flex items-center justify-center bg-[var(--color-border-subtle)] rounded-full text-xs font-medium text-[var(--color-primary)]">
                                  {idx + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate">
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
                          <Users className="w-10 h-10 text-[var(--color-border)] mx-auto mb-3" />
                          <p className="text-sm text-[var(--color-text-secondary)]">{t("courseDetail.noStudents")}</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-[var(--color-border)]">
                                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase">
                                  {t("courseDetail.name")}
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase">
                                  {t("courseDetail.email")}
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase">
                                  {t("courseDetail.progress")}
                                </th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase">
                                  {t("courseDetail.status")}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {enrollments.map((e) => (
                                <tr key={e.id} className="border-b border-[#F3F4F6]">
                                  <td className="px-4 py-3 text-sm text-[var(--color-text-primary)]">
                                    {[e.studentFirstName, e.studentLastName].filter(Boolean).join(" ") || "—"}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">{e.studentEmail}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-20 h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-[var(--color-primary)] rounded-full"
                                          style={{ width: `${e.progress}%` }}
                                        />
                                      </div>
                                      <span className="text-xs text-[var(--color-text-secondary)]">{e.progress}%</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span
                                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                                        e.status === "active"
                                          ? "bg-[#DCFCE7] text-[#22C55E]"
                                          : e.status === "completed"
                                          ? "bg-[var(--color-border-subtle)] text-[var(--color-primary)]"
                                          : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
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
                          <Calendar className="w-10 h-10 text-[var(--color-border)] mx-auto mb-3" />
                          <p className="text-sm text-[var(--color-text-secondary)]">{t("courseDetail.noSessions")}</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {sessions
                            .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                            .map((session) => (
                              <div
                                key={session.id}
                                className="flex items-center justify-between p-4 bg-[var(--color-surface-page)] rounded-lg"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-10 h-10 bg-[var(--color-surface-card)] rounded-lg border border-[var(--color-border)] flex items-center justify-center">
                                    {sessionTypeIcon(session.type)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate">{session.title}</p>
                                    <p className="text-xs text-[var(--color-text-secondary)]">
                                      {formatSessionDate(session.scheduledAt, platformLocale)} &bull;{" "}
                                      {formatSessionTime(session.scheduledAt, session.durationMinutes, platformLocale, locale)} &bull;{" "}
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
