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
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Info,
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

// ─── Helpers ────────────────────────────────────────────────

function getModuleIcon(type: string, isCompleted?: boolean) {
  if (isCompleted) return { Icon: CheckCircle2, color: "text-[#16A34A]" };
  switch (type) {
    case "video":   return { Icon: Video,        color: "text-[#4B5563]" };
    case "document":
    case "pdf":     return { Icon: FileText,     color: "text-[#4B5563]" };
    case "image":   return { Icon: ImageIcon,    color: "text-[#4B5563]" };
    case "quiz":    return { Icon: ClipboardList, color: "text-[#4B5563]" };
    case "mixed":   return { Icon: Layers,       color: "text-[#4B5563]" };
    default:        return { Icon: BookOpen,     color: "text-[#4B5563]" };
  }
}

/** Returns true for file types browsers can render natively in an iframe/embed */
function isBrowserRenderable(material: ModuleMaterial): boolean {
  const mime = material.mimeType || "";
  const url  = material.fileUrl  || "";
  const ext  = url.split(".").pop()?.toLowerCase() || "";
  return (
    mime === "application/pdf" ||
    ext  === "pdf" ||
    mime.startsWith("image/") ||
    ["jpg","jpeg","png","gif","webp","svg"].includes(ext)
  );
}

// ─── Content Viewer Components ──────────────────────────────

function PdfViewer({ material }: { material: ModuleMaterial }) {
  const [loading, setLoading] = useState(true);

  if (!material.fileUrl) return null;

  const renderable = isBrowserRenderable(material);

  if (!renderable) {
    // DOCX / PPTX / XLSX — browsers can't display natively
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-14 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#EFF6FF] flex items-center justify-center">
          <FileText className="w-8 h-8 text-[#002D87]" />
        </div>
        <div>
          <p className="text-sm font-medium text-[#1F2937] mb-1">
            {material.title}
          </p>
          <p className="text-xs text-[#6B7280]">
            This file type cannot be previewed in the browser.
          </p>
        </div>
        <a
          href={material.fileUrl}
          download
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#002D87] text-white text-sm font-medium rounded-lg hover:bg-[#001f61] transition-colors"
        >
          <Download className="w-4 h-4" />
          Download to View
        </a>
      </div>
    );
  }

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#F9FAFB] rounded-lg z-10">
          <Loader2 className="w-6 h-6 text-[#9CA3AF] animate-spin" />
        </div>
      )}
      <embed
        src={material.fileUrl}
        type="application/pdf"
        className="w-full rounded-lg border border-[#E5E7EB]"
        style={{ height: "680px" }}
        onLoad={() => setLoading(false)}
      />
      <div className="mt-3 flex justify-end gap-2">
        <a
          href={material.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-[#4B5563] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Open in tab
        </a>
        <a
          href={material.fileUrl}
          download
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-[#002D87] border border-[#002D87] rounded-lg hover:bg-[#F0F7FF] transition-colors"
        >
          <Download className="w-4 h-4" />
          Download
        </a>
      </div>
    </div>
  );
}

function ImageViewer({ material }: { material: ModuleMaterial }) {
  if (!material.fileUrl) return null;

  return (
    <div className="relative group">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={material.fileUrl}
        alt={material.title}
        className="w-full rounded-lg object-contain bg-[#F9FAFB]"
        style={{ maxHeight: "600px" }}
      />
      <a
        href={material.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-3 end-3 inline-flex items-center gap-1 px-3 py-1.5 bg-white/90 rounded-lg text-xs text-[#1F2937] opacity-0 group-hover:opacity-100 transition-opacity shadow"
      >
        <Maximize2 className="w-3 h-3" />
        Full size
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

// ─── Material type badge label ───────────────────────────────
function typeBadge(type: string) {
  const map: Record<string, string> = {
    video: "Video",
    pdf: "PDF",
    document: "Document",
    image: "Image",
    quiz: "Quiz",
  };
  return map[type] ?? type;
}

// ─── Main Component ─────────────────────────────────────────

const CourseLearningContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const tA = useTranslations("accessibility");
  const isRTL = locale === "ar";
  const params = useParams();
  const courseId = params.id as string;

  const { data, loading, error, refetch } = useStudentCourseDetail(courseId);

  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [activeMaterialIdx, setActiveMaterialIdx] = useState(0);
  const [completingModule, setCompletingModule] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [lockedToast, setLockedToast] = useState(false);

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const sortedModules = data?.modules
    ? [...data.modules].sort((a, b) => a.orderIndex - b.orderIndex)
    : [];

  const currentModule =
    sortedModules.find((m) => m.id === activeModuleId) || sortedModules[0];
  const currentIndex = sortedModules.findIndex(
    (m) => m.id === currentModule?.id
  );

  const { materials, loading: materialsLoading } = useModuleMaterials(
    courseId,
    currentModule?.id || null
  );

  // Reset material tab when switching modules
  const selectModule = useCallback((id: string) => {
    setActiveModuleId(id);
    setActiveMaterialIdx(0);
    setSidebarOpen(false);
  }, []);

  const showLockedToast = useCallback(() => {
    setLockedToast(true);
    setTimeout(() => setLockedToast(false), 3000);
  }, []);

  const handleMarkComplete = async (moduleId: string) => {
    setCompletingModule(moduleId);
    try {
      await studentApi.updateProgress(courseId, { moduleId, status: "completed" });
      await refetch();
    } catch {
      // best-effort
    } finally {
      setCompletingModule(null);
    }
  };

  const goToNextModule = () => {
    if (currentIndex < sortedModules.length - 1) {
      selectModule(sortedModules[currentIndex + 1].id);
    }
  };

  const goToPrevModule = () => {
    if (currentIndex > 0) {
      selectModule(sortedModules[currentIndex - 1].id);
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

  const activeMaterial = materials[activeMaterialIdx] ?? null;
  const isSequential = data?.course?.isSequential !== false;

  return (
    <div className="min-h-screen bg-[#F9FAFB]" dir={isRTL ? "rtl" : "ltr"}>
      {/* Locked module toast */}
      {lockedToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 bg-[#1F2937] text-white text-sm rounded-xl shadow-lg">
          <Lock className="w-4 h-4 text-[#9CA3AF]" />
          Complete the previous module to unlock this one
        </div>
      )}

      {/* Top Bar */}
      <div className="bg-white border-b border-[#E5E7EB] px-4 py-3 sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/dashboard/student/courses/${courseId}`}
              className="p-1.5 rounded-lg hover:bg-[#F3F4F6] transition-colors"
              aria-label={tA("back")}
            >
              <BackIcon className="w-5 h-5 text-[#4B5563]" />
            </Link>
            <div>
              <h1 className="text-sm sm:text-base font-semibold text-[#1F2937] line-clamp-1">
                {isRTL && data.course.titleAr ? data.course.titleAr : data.course.title}
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
              aria-label={tA("toggleModules")}
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
          } lg:block w-full lg:w-[300px] xl:w-[320px] flex-shrink-0 bg-white border-e border-[#E5E7EB] overflow-y-auto`}
          style={{ maxHeight: "calc(100vh - 57px)", position: "sticky", top: 57 }}
        >
          <div className="p-4">
            <h2 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-3">
              {t("learning.courseContent")}
            </h2>

            {isSequential && (
              <div className="flex items-start gap-2 mb-3 p-2.5 bg-[#FFFBEB] rounded-lg border border-[#FDE68A]">
                <Info className="w-3.5 h-3.5 text-[#D97706] flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-[#92400E] leading-snug">
                  Complete each module in order to unlock the next.
                </p>
              </div>
            )}

            <div className="space-y-0.5">
              {sortedModules.map((module, index) => {
                const isActive = module.id === currentModule?.id;
                const isLocked =
                  index > 0 &&
                  !sortedModules[index - 1].isCompleted &&
                  !module.isCompleted &&
                  isSequential;
                const { Icon: ModuleIcon, color: iconColor } = getModuleIcon(
                  module.type,
                  module.isCompleted
                );

                return (
                  <button
                    key={module.id}
                    onClick={() => {
                      if (isLocked) { showLockedToast(); return; }
                      selectModule(module.id);
                    }}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl text-start transition-colors ${
                      isLocked
                        ? "opacity-50 cursor-not-allowed"
                        : isActive
                          ? "bg-[#EFF6FF] border border-[#BFDBFE]"
                          : "hover:bg-[#F9FAFB] cursor-pointer"
                    }`}
                  >
                    {/* Step indicator */}
                    <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5
                      bg-[#F3F4F6] text-[10px] font-semibold text-[#6B7280]">
                      {module.isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                      ) : isLocked ? (
                        <Lock className="w-3 h-3 text-[#9CA3AF]" />
                      ) : (
                        <span className={isActive ? "text-[#002D87]" : ""}>{index + 1}</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${
                        isLocked
                          ? "text-[#9CA3AF]"
                          : isActive
                            ? "font-semibold text-[#002D87]"
                            : module.isCompleted
                              ? "text-[#6B7280]"
                              : "font-medium text-[#1F2937]"
                      } line-clamp-2`}>
                        {isRTL && module.titleAr ? module.titleAr : module.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <ModuleIcon className={`w-3 h-3 ${isActive && !module.isCompleted ? "text-[#002D87]" : iconColor}`} />
                        {module.durationMinutes && (
                          <span className="flex items-center gap-0.5 text-[11px] text-[#9CA3AF]">
                            <Clock className="w-3 h-3" />
                            {module.durationMinutes}m
                          </span>
                        )}
                        {module.isCompleted && (
                          <span className="text-[11px] text-[#16A34A] font-medium">
                            {t("courseDetail.completed")}
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
          id="main-content"
          className={`flex-1 overflow-y-auto ${sidebarOpen ? "hidden lg:block" : "block"}`}
          style={{ minHeight: "calc(100vh - 57px)" }}
        >
          {currentModule ? (
            <div className="p-4 sm:p-6 lg:p-8 max-w-[860px] mx-auto">

              {/* Module Header */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-[#6B7280]">
                    {t("learning.module")} {currentIndex + 1} / {sortedModules.length}
                  </span>
                  {currentModule.isCompleted && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#16A34A]">
                      <CheckCircle2 className="w-3 h-3" />
                      {t("courseDetail.completed")}
                    </span>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-[#1F2937]">
                  {isRTL && currentModule.titleAr ? currentModule.titleAr : currentModule.title}
                </h2>
              </div>

              {/* Content Card */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden mb-5">

                {/* Material Tabs — shown only when multiple materials */}
                {!materialsLoading && materials.length > 1 && (
                  <div className="flex items-center gap-0 border-b border-[#E5E7EB] overflow-x-auto">
                    {materials.map((mat, idx) => {
                      const { Icon } = getModuleIcon(mat.type);
                      return (
                        <button
                          key={mat.id}
                          onClick={() => setActiveMaterialIdx(idx)}
                          className={`flex items-center gap-1.5 px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors ${
                            activeMaterialIdx === idx
                              ? "border-[#002D87] text-[#002D87] font-medium"
                              : "border-transparent text-[#6B7280] hover:text-[#1F2937]"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {mat.title.length > 28 ? mat.title.slice(0, 28) + "…" : mat.title}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Material Content */}
                <div className="p-5 sm:p-6">
                  {materialsLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-7 h-7 text-[#9CA3AF] animate-spin" />
                    </div>
                  ) : materials.length === 0 ? (
                    currentModule.type === "quiz" ? (
                      <div className="flex flex-col items-center justify-center py-14 text-center">
                        <div className="w-16 h-16 bg-[#FFFBEB] rounded-2xl flex items-center justify-center mb-4">
                          <ClipboardList className="w-8 h-8 text-[#D4A520]" />
                        </div>
                        <h3 className="text-base font-semibold text-[#1F2937] mb-1">
                          {t("learning.takeAssessment")}
                        </h3>
                        <p className="text-sm text-[#6B7280]">
                          Complete the assessment for this module.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-14 text-center">
                        <div className="w-16 h-16 bg-[#F3F4F6] rounded-2xl flex items-center justify-center mb-4">
                          <BookOpen className="w-8 h-8 text-[#9CA3AF]" />
                        </div>
                        <h3 className="text-base font-semibold text-[#1F2937] mb-1">
                          {t("learning.noMaterials")}
                        </h3>
                        <p className="text-sm text-[#6B7280]">
                          No content has been published for this module yet.
                        </p>
                      </div>
                    )
                  ) : activeMaterial ? (
                    <>
                      {/* Single material title shown above content when only 1 material */}
                      {materials.length === 1 && (
                        <div className="flex items-center gap-2 mb-4">
                          {(() => { const { Icon, color } = getModuleIcon(activeMaterial.type); return <Icon className={`w-4 h-4 ${color}`} />; })()}
                          <h3 className="text-sm font-semibold text-[#1F2937]">{activeMaterial.title}</h3>
                          <span className="ms-auto text-[11px] px-2 py-0.5 bg-[#F3F4F6] rounded-full text-[#6B7280] capitalize">
                            {typeBadge(activeMaterial.type)}
                          </span>
                        </div>
                      )}
                      <MaterialRenderer
                        material={activeMaterial}
                        courseId={courseId}
                        moduleId={currentModule?.id}
                        locale={locale}
                        onComplete={() => handleMarkComplete(currentModule!.id)}
                        nextMaterialTitle={
                          materials[activeMaterialIdx + 1]?.title ||
                          (currentIndex < sortedModules.length - 1
                            ? (isRTL && sortedModules[currentIndex + 1].titleAr
                                ? sortedModules[currentIndex + 1].titleAr
                                : sortedModules[currentIndex + 1].title) || undefined
                            : undefined)
                        }
                        onNextMaterial={() => {
                          if (activeMaterialIdx < materials.length - 1) {
                            setActiveMaterialIdx(activeMaterialIdx + 1);
                          } else {
                            goToNextModule();
                          }
                        }}
                      />
                    </>
                  ) : null}
                </div>
              </div>

              {/* Mark Complete + Module Navigation */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                {!currentModule.isCompleted ? (
                  <button
                    onClick={() => handleMarkComplete(currentModule.id)}
                    disabled={completingModule === currentModule.id}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#16A34A] text-white text-sm font-medium rounded-xl hover:bg-[#15803D] transition-colors disabled:opacity-60"
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
                    className="flex items-center gap-1.5 px-3 py-2 border border-[#E5E7EB] rounded-xl hover:bg-[#F9FAFB] transition-colors disabled:opacity-40 text-sm text-[#4B5563]"
                    aria-label={tA("previousModule")}
                  >
                    {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                    Prev
                  </button>
                  <button
                    onClick={goToNextModule}
                    disabled={currentIndex === sortedModules.length - 1}
                    className="flex items-center gap-1.5 px-3 py-2 border border-[#E5E7EB] rounded-xl hover:bg-[#F9FAFB] transition-colors disabled:opacity-40 text-sm text-[#4B5563]"
                    aria-label={tA("nextModule")}
                  >
                    Next
                    {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
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
