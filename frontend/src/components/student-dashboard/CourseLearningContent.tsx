"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  ClipboardList,
  Download,
  FileText,
  Layers,
  Loader2,
  Lock,
  Maximize2,
  Play,
  Video,
} from "lucide-react";
import { useStudentCourseDetail } from "@/hooks/useStudentCourseDetail";
import { useModuleMaterials } from "@/hooks/useModuleMaterials";
import { studentApi } from "@/lib/api";
import VideoPlayer from "./VideoPlayer";
import type { ModuleMaterial } from "@/types/student-dashboard";

// ─── Module Type Icon ───────────────────────────────────────

function getModuleIcon(type: string, isCompleted?: boolean) {
  if (isCompleted) {
    return { Icon: CheckCircle2, color: "text-[#16A34A]" };
  }
  switch (type) {
    case "video":
      return { Icon: Video, color: "text-[#4B5563]" };
    case "document":
    case "pdf":
      return { Icon: FileText, color: "text-[#4B5563]" };
    case "quiz":
      return { Icon: ClipboardList, color: "text-[#4B5563]" };
    case "mixed":
      return { Icon: Layers, color: "text-[#4B5563]" };
    default:
      return { Icon: BookOpen, color: "text-[#4B5563]" };
  }
}

// ─── Content Viewer Components ──────────────────────────────

function PdfViewer({ material }: { material: ModuleMaterial }) {
  const t = useTranslations("studentDashboard");

  if (!material.fileUrl) {
    return (
      <p className="text-sm text-[#6B7280] text-center py-8">
        {t("learning.noMaterials")}
      </p>
    );
  }

  return (
    <div>
      <iframe
        src={material.fileUrl}
        className="w-full rounded-lg border border-[#E5E7EB]"
        style={{ height: "600px" }}
        title={material.title}
      />
      <div className="mt-3 flex justify-end">
        <a
          href={material.fileUrl}
          download
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-[#002D87] border border-[#002D87] rounded-lg hover:bg-[#F0F7FF] transition-colors"
        >
          <Download className="w-4 h-4" />
          {t("learning.downloadPdf")}
        </a>
      </div>
    </div>
  );
}

function ImageViewer({ material }: { material: ModuleMaterial }) {
  const t = useTranslations("studentDashboard");

  if (!material.fileUrl) return null;

  return (
    <div className="relative group">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={material.fileUrl}
        alt={material.title}
        className="w-full rounded-lg object-contain"
        style={{ maxHeight: "600px" }}
      />
      <a
        href={material.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-3 end-3 inline-flex items-center gap-1 px-3 py-1.5 bg-white/90 rounded-lg text-xs text-[#1F2937] opacity-0 group-hover:opacity-100 transition-opacity shadow"
      >
        <Maximize2 className="w-3 h-3" />
        {t("learning.viewFullSize")}
      </a>
    </div>
  );
}

function MaterialRenderer({
  material,
  courseId,
  moduleId,
  locale,
  onComplete,
  nextMaterialTitle,
  onNextMaterial,
}: {
  material: ModuleMaterial;
  courseId?: string;
  moduleId?: string;
  locale?: string;
  onComplete?: () => void;
  nextMaterialTitle?: string;
  onNextMaterial?: () => void;
}) {
  switch (material.type) {
    case "video":
      return (
        <VideoPlayer
          material={material}
          courseId={courseId}
          moduleId={moduleId}
          locale={locale}
          onComplete={onComplete}
          nextMaterialTitle={nextMaterialTitle}
          onNextMaterial={onNextMaterial}
        />
      );
    case "pdf":
    case "document":
      return <PdfViewer material={material} />;
    case "image":
      return <ImageViewer material={material} />;
    default:
      return null;
  }
}

// ─── Main Component ─────────────────────────────────────────

const CourseLearningContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";
  const params = useParams();
  const courseId = params.id as string;

  const { data, loading, error, refetch } = useStudentCourseDetail(courseId);

  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [completingModule, setCompletingModule] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const sortedModules = data?.modules
    ? [...data.modules].sort((a, b) => a.orderIndex - b.orderIndex)
    : [];

  const currentModule =
    sortedModules.find((m) => m.id === activeModuleId) || sortedModules[0];
  const currentIndex = sortedModules.findIndex(
    (m) => m.id === currentModule?.id
  );

  // Fetch materials for current module
  const { materials, loading: materialsLoading } = useModuleMaterials(
    courseId,
    currentModule?.id || null
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
          <p className="text-[#6B7280] mb-4">
            {error || t("courseDetail.notFound")}
          </p>
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
            <span className="hidden sm:inline text-xs font-medium text-[#4B5563]">
              {data.enrollment.progress}%
            </span>
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
                // Module is locked if previous module is not completed (sequential)
                const isLocked =
                  index > 0 &&
                  !sortedModules[index - 1].isCompleted &&
                  !module.isCompleted &&
                  data?.course?.isSequential !== false;
                const { Icon: ModuleIcon, color: iconColor } = getModuleIcon(
                  module.type,
                  module.isCompleted
                );

                return (
                  <button
                    key={module.id}
                    onClick={() => {
                      if (isLocked) return;
                      setActiveModuleId(module.id);
                      setSidebarOpen(false);
                    }}
                    disabled={isLocked}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg text-start transition-colors ${
                      isLocked
                        ? "opacity-50 cursor-not-allowed"
                        : isActive
                          ? "bg-[#F0F7FF] border border-[#002D87]/20 cursor-pointer"
                          : "hover:bg-[#F9FAFB] cursor-pointer"
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {isLocked ? (
                        <Lock className="w-4 h-4 text-[#9CA3AF]" />
                      ) : (
                        <ModuleIcon
                          className={`w-4 h-4 ${
                            isActive && !module.isCompleted
                              ? "text-[#002D87]"
                              : iconColor
                          }`}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm ${
                          isLocked
                            ? "text-[#9CA3AF]"
                            : isActive
                              ? "font-medium text-[#002D87]"
                              : module.isCompleted
                                ? "text-[#6B7280]"
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
                        {isLocked ? (
                          <span className="text-[10px]">
                            {t("learning.locked")}
                          </span>
                        ) : module.isCompleted ? (
                          <span className="text-[#16A34A] text-[10px]">
                            {t("courseDetail.completed")}
                          </span>
                        ) : null}
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

              {/* Content Area */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 sm:p-8 mb-6">
                {materialsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-[#9CA3AF] animate-spin" />
                  </div>
                ) : materials.length === 0 ? (
                  currentModule.type === "quiz" ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-16 h-16 bg-[#FFFBEB] rounded-full flex items-center justify-center mb-4">
                        <ClipboardList className="w-8 h-8 text-[#D4A520]" />
                      </div>
                      <h3 className="text-base font-medium text-[#1F2937] mb-2">
                        {t("learning.takeAssessment")}
                      </h3>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-4">
                        <BookOpen className="w-8 h-8 text-[#9CA3AF]" />
                      </div>
                      <h3 className="text-base font-medium text-[#1F2937] mb-2">
                        {t("learning.noMaterials")}
                      </h3>
                    </div>
                  )
                ) : (
                  <div className="space-y-6">
                    {materials.map((material, matIdx) => {
                      const nextMat = materials[matIdx + 1];
                      const nextModuleTitle =
                        !nextMat && currentIndex < sortedModules.length - 1
                          ? (isRTL && sortedModules[currentIndex + 1].titleAr
                              ? sortedModules[currentIndex + 1].titleAr
                              : sortedModules[currentIndex + 1].title) || undefined
                          : undefined;
                      return (
                        <div key={material.id}>
                          {materials.length > 1 && (
                            <h4 className="text-sm font-medium text-[#1F2937] mb-3">
                              {material.title}
                            </h4>
                          )}
                          <MaterialRenderer
                            material={material}
                            courseId={courseId}
                            moduleId={currentModule?.id}
                            locale={locale}
                            onComplete={() => handleMarkComplete(currentModule!.id)}
                            nextMaterialTitle={
                              nextMat?.title || nextModuleTitle
                            }
                            onNextMaterial={() => {
                              if (nextMat) {
                                // Scroll to next material (handled by key change)
                              } else {
                                goToNextModule();
                              }
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Mark Complete + Navigation */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                {!currentModule.isCompleted ? (
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
                ) : (
                  <span className="inline-flex items-center gap-2 px-5 py-2.5 text-[#16A34A] text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    {t("courseDetail.completed")}
                  </span>
                )}

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
