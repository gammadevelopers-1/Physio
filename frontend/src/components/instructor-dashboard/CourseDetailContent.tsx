"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import InstructorNavbar from "./InstructorNavbar";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import DashboardError from "./DashboardError";
import { useInstructorProfile } from "@/hooks/useInstructorProfile";
import { useInstructorCourseDetail } from "@/hooks/useInstructorCourseDetail";
import {
  ArrowLeft,
  Users,
  Calendar,
  Clock,
  Video,
  MapPin,
  BookOpen,
  Settings,
  BarChart3,
  ChevronDown,
  Play,
  FileText,
  Edit,
  Plus,
} from "lucide-react";

interface CourseDetailContentProps {
  courseId: string;
}

// ─── Skeleton ──────────────────────────────────────────────────
const CourseDetailSkeleton = () => (
  <div className="flex-1 min-w-0 animate-pulse">
    <div className="h-4 w-32 bg-[#E5E7EB] rounded mb-4" />
    <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden mb-6">
      <div className="h-48 sm:h-56 bg-[#E5E7EB]" />
      <div className="p-4 border-t border-[#E5E7EB]">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#E5E7EB] rounded-lg" />
              <div className="space-y-1.5">
                <div className="h-5 w-12 bg-[#E5E7EB] rounded" />
                <div className="h-3 w-16 bg-[#E5E7EB] rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
      <div className="flex gap-4 p-4 border-b border-[#E5E7EB]">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-5 w-20 bg-[#E5E7EB] rounded" />
        ))}
      </div>
      <div className="p-5 space-y-4">
        <div className="h-4 w-24 bg-[#E5E7EB] rounded" />
        <div className="h-3 w-full bg-[#E5E7EB] rounded" />
        <div className="h-3 w-3/4 bg-[#E5E7EB] rounded" />
      </div>
    </div>
  </div>
);

// ─── Helpers ───────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDuration(startDate: string | null, endDate: string | null): string {
  if (!startDate || !endDate) return "—";
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
  if (diffWeeks > 0) return `${diffWeeks} weeks`;
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  return `${diffDays} days`;
}

function formatSessionTime(iso: string, durationMinutes: number): string {
  const start = new Date(iso);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const timeOpts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  return `${start.toLocaleTimeString("en-US", timeOpts)} - ${end.toLocaleTimeString("en-US", timeOpts)}`;
}

function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getModuleIcon(type: string) {
  if (type === "video" || type === "lecture") return <Play className="w-4 h-4 text-[#6B7280]" />;
  if (type === "quiz" || type === "assessment") return <BookOpen className="w-4 h-4 text-[#6B7280]" />;
  return <FileText className="w-4 h-4 text-[#6B7280]" />;
}

// ─── Component ─────────────────────────────────────────────────

const CourseDetailContent = ({ courseId }: CourseDetailContentProps) => {
  const instructor = useInstructorProfile();
  const locale = useLocale();
  const t = useTranslations("instructorDashboard");
  const { course, enrollments, sessions, loading, error, refetch } =
    useInstructorCourseDetail(courseId);
  const [activeTab, setActiveTab] = useState<
    "overview" | "modules" | "students" | "sessions" | "analytics" | "settings"
  >("overview");
  const [expandedModules, setExpandedModules] = useState<string[]>([]);

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) =>
      prev.includes(moduleId)
        ? prev.filter((id) => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  const tabs = [
    { id: "overview" as const, label: t("courseDetail.tabs.overview") },
    { id: "modules" as const, label: t("courseDetail.tabs.modules") },
    { id: "students" as const, label: t("courseDetail.tabs.students") },
    { id: "sessions" as const, label: t("courseDetail.tabs.sessions") },
    { id: "analytics" as const, label: t("courseDetail.tabs.analytics") },
    { id: "settings" as const, label: t("courseDetail.tabs.settings") },
  ];

  const courseTitle =
    course && locale === "ar" && course.titleAr ? course.titleAr : course?.title || "";
  const courseDescription =
    course && locale === "ar" && course.descriptionAr
      ? course.descriptionAr
      : course?.description || "";
  const deliveryIcon =
    course?.deliveryType === "onsite" ? (
      <MapPin className="w-3.5 h-3.5" />
    ) : (
      <Video className="w-3.5 h-3.5" />
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

            {/* Loading */}
            {loading && <CourseDetailSkeleton />}

            {/* Error */}
            {!loading && error && (
              <div className="flex-1 min-w-0">
                <Link
                  href={`/${locale}/dashboard/instructor/courses`}
                  className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#1F2937] mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t("courseDetail.backToCourses")}
                </Link>
                <DashboardError message={error} onRetry={refetch} />
              </div>
            )}

            {/* Data loaded */}
            {!loading && !error && course && (
              <div className="flex-1 min-w-0">
                {/* Back Button */}
                <Link
                  href={`/${locale}/dashboard/instructor/courses`}
                  className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#1F2937] mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t("courseDetail.backToCourses")}
                </Link>

                {/* Course Header */}
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
                      <h1 className="text-xl sm:text-2xl font-bold text-white">
                        {courseTitle}
                      </h1>
                    </div>
                  </div>

                  {/* Course Stats */}
                  <div className="p-4 border-t border-[#E5E7EB]">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#EFF6FF] rounded-lg flex items-center justify-center">
                          <Users className="w-5 h-5 text-[#3B82F6]" />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-[#1F2937]">
                            {enrollments.length}
                          </p>
                          <p className="text-xs text-[#6B7280]">
                            {t("courseDetail.students")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#FEF3C7] rounded-lg flex items-center justify-center">
                          <Calendar className="w-5 h-5 text-[#D4A520]" />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-[#1F2937]">
                            {sessions.filter((s) => s.status === "completed").length}/
                            {sessions.length}
                          </p>
                          <p className="text-xs text-[#6B7280]">
                            {t("courseDetail.sessions")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#DCFCE7] rounded-lg flex items-center justify-center">
                          <BarChart3 className="w-5 h-5 text-[#22C55E]" />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-[#1F2937]">
                            {enrollments.length > 0
                              ? Math.round(
                                  enrollments.reduce((sum, e) => sum + e.progress, 0) /
                                    enrollments.length
                                )
                              : 0}
                            %
                          </p>
                          <p className="text-xs text-[#6B7280]">
                            {t("courseDetail.completion")}
                          </p>
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
                          <p className="text-xs text-[#6B7280]">
                            {t("courseDetail.duration")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                  <div className="flex border-b border-[#E5E7EB] overflow-x-auto">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap relative transition-colors ${
                          activeTab === tab.id
                            ? "text-[#3B82F6]"
                            : "text-[#6B7280] hover:text-[#374151]"
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
                    {/* Overview Tab */}
                    {activeTab === "overview" && (
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-base font-semibold text-[#1F2937] mb-2">
                            {t("courseDetail.description")}
                          </h3>
                          <p className="text-sm text-[#6B7280] leading-relaxed">
                            {courseDescription || t("courseDetail.noDescription")}
                          </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="p-4 bg-[#F9FAFB] rounded-lg">
                            <p className="text-xs text-[#6B7280] mb-1">
                              {t("courseDetail.startDate")}
                            </p>
                            <p className="text-sm font-medium text-[#1F2937]">
                              {formatDate(course.startDate)}
                            </p>
                          </div>
                          <div className="p-4 bg-[#F9FAFB] rounded-lg">
                            <p className="text-xs text-[#6B7280] mb-1">
                              {t("courseDetail.endDate")}
                            </p>
                            <p className="text-sm font-medium text-[#1F2937]">
                              {formatDate(course.endDate)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Modules Tab */}
                    {activeTab === "modules" && (
                      <div className="space-y-3">
                        {course.modules.length === 0 && (
                          <div className="text-center py-8">
                            <BookOpen className="w-10 h-10 text-[#9CA3AF] mx-auto mb-3" />
                            <p className="text-sm text-[#6B7280]">
                              {t("courseDetail.noModules")}
                            </p>
                          </div>
                        )}
                        {course.modules.map((mod) => (
                          <div
                            key={mod.id}
                            className="border border-[#E5E7EB] rounded-lg overflow-hidden"
                          >
                            <button
                              onClick={() => toggleModule(mod.id)}
                              className="w-full flex items-center justify-between p-4 bg-[#F9FAFB] hover:bg-[#F3F4F6] transition-colors"
                            >
                              <span className="text-sm font-semibold text-[#1F2937]">
                                {locale === "ar" && mod.titleAr ? mod.titleAr : mod.title}
                              </span>
                              <ChevronDown
                                className={`w-5 h-5 text-[#6B7280] transition-transform ${
                                  expandedModules.includes(mod.id) ? "rotate-180" : ""
                                }`}
                              />
                            </button>
                            {expandedModules.includes(mod.id) && (
                              <div className="p-4 border-t border-[#E5E7EB]">
                                <div className="flex items-center gap-4 text-sm text-[#6B7280]">
                                  {getModuleIcon(mod.type)}
                                  <span className="capitalize">{mod.type}</span>
                                  {mod.durationMinutes && (
                                    <span>
                                      {mod.durationMinutes} {t("courseDetail.minutes")}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        <button className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-[#E5E7EB] rounded-lg text-sm text-[#6B7280] hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors">
                          <Plus className="w-4 h-4" />
                          {t("courseDetail.addModule")}
                        </button>
                      </div>
                    )}

                    {/* Students Tab */}
                    {activeTab === "students" && (
                      <div className="overflow-x-auto">
                        {enrollments.length === 0 ? (
                          <div className="text-center py-8">
                            <Users className="w-10 h-10 text-[#9CA3AF] mx-auto mb-3" />
                            <p className="text-sm text-[#6B7280]">
                              {t("courseDetail.noStudents")}
                            </p>
                          </div>
                        ) : (
                          <table className="w-full">
                            <thead>
                              <tr className="text-left border-b border-[#E5E7EB]">
                                <th className="pb-3 text-xs font-medium text-[#6B7280]">
                                  {t("courseDetail.name")}
                                </th>
                                <th className="pb-3 text-xs font-medium text-[#6B7280]">
                                  {t("courseDetail.email")}
                                </th>
                                <th className="pb-3 text-xs font-medium text-[#6B7280]">
                                  {t("courseDetail.progress")}
                                </th>
                                <th className="pb-3 text-xs font-medium text-[#6B7280]">
                                  {t("courseDetail.status")}
                                </th>
                                <th className="pb-3 text-xs font-medium text-[#6B7280]">
                                  {t("courseDetail.actions")}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {enrollments.map((enrollment) => {
                                const progress = enrollment.progress;
                                const isAtRisk = progress < 50;
                                return (
                                  <tr
                                    key={enrollment.id}
                                    className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]"
                                  >
                                    <td className="py-3 text-sm font-medium text-[#1F2937]">
                                      {enrollment.studentFirstName} {enrollment.studentLastName}
                                    </td>
                                    <td className="py-3 text-sm text-[#6B7280]">
                                      {enrollment.studentEmail}
                                    </td>
                                    <td className="py-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-20 h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                                          <div
                                            className={`h-full rounded-full ${
                                              isAtRisk ? "bg-[#F97316]" : "bg-[#22C55E]"
                                            }`}
                                            style={{ width: `${progress}%` }}
                                          />
                                        </div>
                                        <span className="text-xs text-[#6B7280]">
                                          {progress}%
                                        </span>
                                      </div>
                                    </td>
                                    <td className="py-3">
                                      <span
                                        className={`px-2 py-1 rounded text-xs font-medium ${
                                          isAtRisk
                                            ? "bg-[#FFEDD5] text-[#F97316]"
                                            : "bg-[#DCFCE7] text-[#22C55E]"
                                        }`}
                                      >
                                        {isAtRisk
                                          ? t("courseDetail.atRisk")
                                          : t("courseDetail.onTrack")}
                                      </span>
                                    </td>
                                    <td className="py-3">
                                      <Link
                                        href={`/${locale}/dashboard/instructor/students/${enrollment.studentId}`}
                                        className="text-xs text-[#3B82F6] hover:underline"
                                      >
                                        {t("courseDetail.viewProfile")}
                                      </Link>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}

                    {/* Sessions Tab */}
                    {activeTab === "sessions" && (
                      <div className="space-y-3">
                        {sessions.length === 0 ? (
                          <div className="text-center py-8">
                            <Calendar className="w-10 h-10 text-[#9CA3AF] mx-auto mb-3" />
                            <p className="text-sm text-[#6B7280]">
                              {t("courseDetail.noSessions")}
                            </p>
                          </div>
                        ) : (
                          sessions.map((session) => (
                            <div
                              key={session.id}
                              className="flex items-center justify-between p-4 border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                    session.type === "zoom"
                                      ? "bg-[#EFF6FF]"
                                      : session.type === "onsite"
                                      ? "bg-[#DCFCE7]"
                                      : "bg-[#F3E8FF]"
                                  }`}
                                >
                                  {session.type === "zoom" ? (
                                    <Video className="w-5 h-5 text-[#3B82F6]" />
                                  ) : session.type === "onsite" ? (
                                    <MapPin className="w-5 h-5 text-[#22C55E]" />
                                  ) : (
                                    <Video className="w-5 h-5 text-[#9333EA]" />
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-[#1F2937]">
                                    {session.title}
                                  </p>
                                  <p className="text-xs text-[#6B7280]">
                                    {formatSessionDate(session.scheduledAt)} &bull;{" "}
                                    {formatSessionTime(
                                      session.scheduledAt,
                                      session.durationMinutes
                                    )}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {new Date(session.scheduledAt) >= new Date() &&
                                  session.status === "scheduled" && (
                                    <button className="px-3 py-1.5 bg-[#3B82F6] text-white text-xs font-medium rounded-lg hover:bg-[#2563EB] transition-colors">
                                      {t("courseDetail.startSession")}
                                    </button>
                                  )}
                                <button className="p-1.5 hover:bg-[#F3F4F6] rounded">
                                  <Edit className="w-4 h-4 text-[#6B7280]" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                        <button className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-[#E5E7EB] rounded-lg text-sm text-[#6B7280] hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors">
                          <Plus className="w-4 h-4" />
                          {t("courseDetail.scheduleSession")}
                        </button>
                      </div>
                    )}

                    {/* Analytics Tab */}
                    {activeTab === "analytics" && (
                      <div className="text-center py-12">
                        <BarChart3 className="w-12 h-12 text-[#9CA3AF] mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-[#1F2937] mb-2">
                          {t("courseDetail.analyticsTitle")}
                        </h3>
                        <p className="text-sm text-[#6B7280]">
                          {t("courseDetail.analyticsDescription")}
                        </p>
                      </div>
                    )}

                    {/* Settings Tab */}
                    {activeTab === "settings" && (
                      <div className="text-center py-12">
                        <Settings className="w-12 h-12 text-[#9CA3AF] mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-[#1F2937] mb-2">
                          {t("courseDetail.settingsTitle")}
                        </h3>
                        <p className="text-sm text-[#6B7280]">
                          {t("courseDetail.settingsDescription")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default CourseDetailContent;
