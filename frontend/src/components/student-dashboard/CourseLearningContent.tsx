"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  Loader2,
  Play,
  Video,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentCourseDetail } from "@/hooks/useStudentCourseDetail";
import { studentApi } from "@/lib/api";
import type { CourseModule } from "@/types/student-dashboard";

const CourseLearningContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";
  const params = useParams();
  const courseId = params.id as string;
  const { user } = useAuth();

  const { data, loading, error, refetch } = useStudentCourseDetail(courseId);

  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [completingModule, setCompletingModule] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  // Set first module as active if none selected
  const sortedModules = data?.modules
    ? [...data.modules].sort((a, b) => a.orderIndex - b.orderIndex)
    : [];

  const currentModule =
    sortedModules.find((m) => m.id === activeModuleId) || sortedModules[0];
  const currentIndex = sortedModules.findIndex(
    (m) => m.id === currentModule?.id
  );

  const handleMarkComplete = async (moduleId: string) => {
    setCompletingModule(moduleId);
    try {
      await studentApi.updateProgress(courseId, {
        moduleId,
        status: "completed",
      });
      await refetch();
    } catch {
      // Silently fail — module completion is best-effort
    } finally {
      setCompletingModule(null);
    }
  };

  const goToNextModule = () => {
    if (currentIndex < sortedModules.length - 1) {
      setActiveModuleId(sortedModules[currentIndex + 1].id);
    }
  };

  const goToPrevModule = () => {
    if (currentIndex > 0) {
      setActiveModuleId(sortedModules[currentIndex - 1].id);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#9CA3AF] animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#6B7280] mb-4">{error || t("courseDetail.notFound")}</p>
          <Link
            href={`/${locale}/dashboard/student/courses`}
            className="text-sm text-[#002D87] hover:underline"
          >
            {t("courseDetail.backToCourses")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]" dir={isRTL ? "rtl" : "ltr"}>
      {/* Top Bar */}
      <div className="bg-white border-b border-[#E5E7EB] px-4 py-3">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/dashboard/student/courses/${courseId}`}
              className="p-1.5 rounded-lg hover:bg-[#F3F4F6] transition-colors"
            >
              <BackIcon className="w-5 h-5 text-[#4B5563]" />
            </Link>
            <div>
              <h1 className="text-sm sm:text-base font-semibold text-[#1F2937] line-clamp-1">
                {isRTL && data.course.titleAr
                  ? data.course.titleAr
                  : data.course.title}
              </h1>
              <p className="text-xs text-[#6B7280]">
                {data.enrollment.progress}% {t("courseDetail.complete")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Progress bar in top bar */}
            <div className="hidden sm:block w-32 h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#16A34A] rounded-full transition-all"
                style={{ width: `${data.enrollment.progress}%` }}
              />
            </div>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-[#F3F4F6] transition-colors lg:hidden"
            >
              <BookOpen className="w-5 h-5 text-[#4B5563]" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Module Sidebar */}
        <aside
          className={`${
            sidebarOpen ? "block" : "hidden"
          } lg:block w-full lg:w-[320px] flex-shrink-0 bg-white border-e border-[#E5E7EB] overflow-y-auto`}
          style={{ maxHeight: "calc(100vh - 57px)" }}
        >
          <div className="p-4">
            <h2 className="text-sm font-semibold text-[#1F2937] mb-3">
              {t("learning.courseContent")}
            </h2>

            <div className="space-y-1">
              {sortedModules.map((module, index) => {
                const isActive = module.id === currentModule?.id;
                return (
                  <button
                    key={module.id}
                    onClick={() => {
                      setActiveModuleId(module.id);
                      setSidebarOpen(false); // Close sidebar on mobile after selection
                    }}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg text-start transition-colors ${
                      isActive
                        ? "bg-[#F0F7FF] border border-[#002D87]/20"
                        : "hover:bg-[#F9FAFB]"
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      <Circle
                        className={`w-4 h-4 ${
                          isActive
                            ? "text-[#002D87]"
                            : "text-[#D1D5DB]"
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm ${
                          isActive
                            ? "font-medium text-[#002D87]"
                            : "text-[#4B5563]"
                        } line-clamp-2`}
                      >
                        {index + 1}.{" "}
                        {isRTL && module.titleAr
                          ? module.titleAr
                          : module.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-[#9CA3AF] mt-1">
                        {module.type && (
                          <span className="capitalize">{module.type}</span>
                        )}
                        {module.durationMinutes && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            {module.durationMinutes}m
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main
          className={`flex-1 ${sidebarOpen ? "hidden lg:block" : "block"}`}
          style={{ minHeight: "calc(100vh - 57px)" }}
        >
          {currentModule ? (
            <div className="p-4 sm:p-6 lg:p-8 max-w-[900px] mx-auto">
              {/* Module Header */}
              <div className="mb-6">
                <p className="text-xs text-[#6B7280] mb-1">
                  {t("learning.module")} {currentIndex + 1} /{" "}
                  {sortedModules.length}
                </p>
                <h2 className="text-xl sm:text-2xl font-bold text-[#1F2937]">
                  {isRTL && currentModule.titleAr
                    ? currentModule.titleAr
                    : currentModule.title}
                </h2>
                {currentModule.type && (
                  <span className="inline-block mt-2 px-3 py-1 bg-[#F3F4F6] rounded-full text-xs text-[#4B5563] capitalize">
                    {currentModule.type}
                  </span>
                )}
              </div>

              {/* Content Placeholder */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 sm:p-8 mb-6">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-4">
                    <Play className="w-8 h-8 text-[#9CA3AF]" />
                  </div>
                  <h3 className="text-base font-medium text-[#1F2937] mb-2">
                    {t("learning.moduleContent")}
                  </h3>
                  <p className="text-sm text-[#6B7280] max-w-md">
                    {t("learning.moduleContentDescription")}
                  </p>
                </div>
              </div>

              {/* Mark Complete + Navigation */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                  onClick={() => handleMarkComplete(currentModule.id)}
                  disabled={completingModule === currentModule.id}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#16A34A] text-white text-sm font-medium rounded-lg hover:bg-[#15803D] transition-colors disabled:opacity-60"
                >
                  {completingModule === currentModule.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {t("learning.markComplete")}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={goToPrevModule}
                    disabled={currentIndex === 0}
                    className="p-2.5 border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors disabled:opacity-40"
                  >
                    {isRTL ? (
                      <ArrowRight className="w-4 h-4 text-[#4B5563]" />
                    ) : (
                      <ArrowLeft className="w-4 h-4 text-[#4B5563]" />
                    )}
                  </button>
                  <button
                    onClick={goToNextModule}
                    disabled={currentIndex === sortedModules.length - 1}
                    className="p-2.5 border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors disabled:opacity-40"
                  >
                    {isRTL ? (
                      <ArrowLeft className="w-4 h-4 text-[#4B5563]" />
                    ) : (
                      <ArrowRight className="w-4 h-4 text-[#4B5563]" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[#6B7280]">{t("learning.noModules")}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default CourseLearningContent;
