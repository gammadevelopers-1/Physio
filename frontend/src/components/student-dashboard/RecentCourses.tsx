"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  ClipboardList,
  Heart,
  PlayCircle,
  Video,
  ClipboardCheck,
  Upload,
  Eye,
  User,
} from "lucide-react";
import { useFavourites } from "@/contexts/FavouritesContext";

interface Course {
  id: string;
  title: string;
  thumbnail: string;
  progress: number;
  status: "in_progress" | "completed" | "not_started";
  instructorName?: string;
  instructorAvatar?: string | null;
  nextAction?: string;
  nextDeadline?: string | null;
  missingTasksCount?: number;
}

interface RecentCoursesProps {
  courses: Course[];
}

function getActionConfig(action: string) {
  switch (action) {
    case "join_zoom":
      return {
        icon: Video,
        color: "bg-[#2D8CFF] text-white hover:bg-[#1A73E8]",
        key: "joinZoom" as const,
      };
    case "take_quiz":
      return {
        icon: ClipboardCheck,
        color: "bg-[#F59E0B] text-white hover:bg-[#D97706]",
        key: "takeQuiz" as const,
      };
    case "resume_lesson":
      return {
        icon: PlayCircle,
        color:
          "bg-white border border-[var(--color-border)] text-[#1F2937] hover:bg-[#F9FAFB]",
        key: "resumeLesson" as const,
      };
    case "upload_assignment":
      return {
        icon: Upload,
        color: "bg-[#8B5CF6] text-white hover:bg-[#7C3AED]",
        key: "uploadAssignment" as const,
      };
    case "view_results":
      return {
        icon: Eye,
        color: "bg-[#10B981] text-white hover:bg-[#059669]",
        key: "viewResults" as const,
      };
    default:
      return {
        icon: PlayCircle,
        color:
          "bg-white border border-[var(--color-border)] text-[#1F2937] hover:bg-[#F9FAFB]",
        key: "startCourse" as const,
      };
  }
}

function DeadlineBadge({
  deadline,
  t,
}: {
  deadline: string | null | undefined;
  t: ReturnType<typeof useTranslations>;
}) {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff < 0) {
    return (
      <span className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-semibold rounded-full">
        {t("recentCourses.overdue")}
      </span>
    );
  }
  if (diff < 24 * 60 * 60 * 1000) {
    return (
      <span className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] font-semibold rounded-full">
        {t("recentCourses.dueSoon")}
      </span>
    );
  }
  return null;
}

const RecentCourses = ({ courses }: RecentCoursesProps) => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";
  const { isFavourite, toggleFavourite } = useFavourites();

  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-6 mt-6">
      <h2 className="text-lg font-semibold text-[#1F2937] mb-6">
        {t("recentCourses.title")}
      </h2>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-4">
            <ClipboardList className="w-8 h-8 text-[#9CA3AF]" />
          </div>
          <h3 className="text-base font-medium text-[#1F2937] mb-1">
            {t("recentCourses.noCoursesTitle")}
          </h3>
          <p className="text-sm text-[#6B7280] mb-6 text-center">
            {t("recentCourses.noCoursesDescription")}
          </p>
          <Link
            href={`/${locale}/courses`}
            className="px-6 py-2.5 btn-gold text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            {t("recentCourses.viewCourses")}
          </Link>
        </div>
      ) : (
        <div
          className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory"
          dir={isRTL ? "rtl" : "ltr"}
        >
          {courses.map((course) => {
            const actionConfig = getActionConfig(course.nextAction || "start_course");
            const ActionIcon = actionConfig.icon;

            return (
              <div
                key={course.id}
                className="min-w-[280px] max-w-[320px] snap-start flex-shrink-0 border border-[var(--color-border)] rounded-xl overflow-hidden relative"
              >
                {/* Deadline Badge */}
                <DeadlineBadge deadline={course.nextDeadline} t={t} />

                {/* Favourite Button */}
                <button
                  onClick={() => toggleFavourite(course)}
                  className={`absolute top-2 ${isRTL ? "left-2" : "right-2"} z-10 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center shadow-sm hover:bg-white transition-colors`}
                  aria-label={
                    isFavourite(course.id)
                      ? t("favourites.removeFromFavourites")
                      : t("favourites.addToFavourites")
                  }
                >
                  <Heart
                    className={`w-3.5 h-3.5 ${isFavourite(course.id) ? "text-red-500 fill-red-500" : "text-gray-400"}`}
                  />
                </button>

                {/* Thumbnail */}
                <div className="w-full h-[130px] bg-gray-100">
                  <img
                    src={course.thumbnail}
                    alt={course.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Content */}
                <div className="p-3">
                  <h3 className="text-sm font-semibold text-[#1F2937] line-clamp-2 min-h-[40px]">
                    {course.title}
                  </h3>

                  {/* Instructor */}
                  {course.instructorName && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {course.instructorAvatar ? (
                        <img
                          src={
                            course.instructorAvatar.startsWith("http")
                              ? course.instructorAvatar
                              : `http://localhost:8080${course.instructorAvatar}`
                          }
                          alt=""
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="w-3 h-3 text-gray-400" />
                        </div>
                      )}
                      <span className="text-xs text-[#6B7280] truncate">
                        {course.instructorName}
                      </span>
                    </div>
                  )}

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[#6B7280]">
                        {course.progress}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#16A34A] rounded-full transition-all duration-300"
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Missing Tasks */}
                  {(course.missingTasksCount ?? 0) > 0 && (
                    <p className="text-[11px] text-red-600 mt-1">
                      {t("recentCourses.missingTasks", {
                        count: course.missingTasksCount ?? 0,
                      })}
                    </p>
                  )}

                  {/* Action Button */}
                  <Link
                    href={`/${locale}/dashboard/student/courses/${course.id}`}
                    className={`mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${actionConfig.color}`}
                  >
                    <ActionIcon className="w-3.5 h-3.5" />
                    {t(`recentCourses.${actionConfig.key}`)}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RecentCourses;
