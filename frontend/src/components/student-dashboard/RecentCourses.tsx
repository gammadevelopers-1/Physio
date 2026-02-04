"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ClipboardList } from "lucide-react";

interface Course {
  id: string;
  title: string;
  thumbnail: string;
  progress: number;
  status: "in_progress" | "completed" | "not_started";
}

interface RecentCoursesProps {
  courses: Course[];
}

const RecentCourses = ({ courses }: RecentCoursesProps) => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";

  const getStatusLabel = (status: Course["status"]) => {
    switch (status) {
      case "in_progress":
        return t("recentCourses.inProgress");
      case "completed":
        return t("recentCourses.completed");
      default:
        return t("recentCourses.notStarted");
    }
  };

  const getStatusColor = (status: Course["status"]) => {
    switch (status) {
      case "in_progress":
        return "text-[#D4A520]";
      case "completed":
        return "text-[#16A34A]";
      default:
        return "text-[#6B7280]";
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 mt-6">
      <h2 className="text-lg font-semibold text-[#1F2937] mb-6">
        {t("recentCourses.title")}
      </h2>

      {courses.length === 0 ? (
        // Empty State
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
        // Courses List
        <div className="space-y-4">
          {courses.map((course) => (
            <div
              key={course.id}
              className={`flex flex-col sm:flex-row gap-4 p-4 border border-[#E5E7EB] rounded-xl ${isRTL ? "sm:flex-row-reverse" : ""}`}
            >
              {/* Course Thumbnail */}
              <div className="w-full sm:w-[180px] h-[120px] flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                <Image
                  src={course.thumbnail}
                  alt={course.title}
                  width={180}
                  height={120}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Course Info */}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-semibold text-[#1F2937] mb-2 line-clamp-2">
                    {course.title}
                  </h3>
                  <span className={`text-sm ${getStatusColor(course.status)}`}>
                    {getStatusLabel(course.status)}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mt-3">
                  <div className={`flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <span className="text-sm text-[#6B7280] min-w-[40px]">
                      {course.progress}%
                    </span>
                    <div className="flex-1 h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-[#16A34A] rounded-full transition-all duration-300 ${isRTL ? "ms-auto" : ""}`}
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* View Course Button */}
                <Link
                  href={`/${locale}/student-dashboard/courses/${course.id}`}
                  className="mt-3 w-full sm:w-auto px-4 py-2 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#1F2937] text-center hover:bg-[#F9FAFB] transition-colors"
                >
                  {t("recentCourses.viewCourse")}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecentCourses;
