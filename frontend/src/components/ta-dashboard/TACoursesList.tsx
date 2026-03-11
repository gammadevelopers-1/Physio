"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { BookOpen, AlertTriangle, Clock } from "lucide-react";
import { taApi, type TAAssignedCourse } from "@/lib/api";

type StatusFilter = "all" | "approved" | "pre_assigned" | "suggested";

const TACoursesList = () => {
  const t = useTranslations("taDashboard");
  const locale = useLocale();
  const [courses, setCourses] = useState<TAAssignedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");

  const fetchCourses = useCallback(async () => {
    try {
      setLoading(true);
      const data = await taApi.getMyAssignedCourses();
      setCourses(data.filter((c) => c.status !== "rejected"));
    } catch {
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const filteredCourses =
    filter === "all" ? courses : courses.filter((c) => c.status === filter);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-50 text-green-700 border border-green-200";
      case "pre_assigned":
        return "bg-amber-50 text-amber-700 border border-amber-200";
      case "suggested":
        return "bg-orange-50 text-orange-700 border border-orange-200";
      default:
        return "bg-gray-50 text-gray-700 border border-gray-200";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "approved":
        return t("courses.active");
      case "pre_assigned":
        return t("courses.preAssigned");
      case "suggested":
        return t("courses.pendingApproval");
      default:
        return status;
    }
  };

  const filters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: t("courses.all") },
    { key: "approved", label: t("courses.active") },
    { key: "pre_assigned", label: t("courses.preAssigned") },
    { key: "suggested", label: t("courses.pendingApproval") },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#1F2937]">
        {t("courses.title")}
      </h1>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key
                ? "bg-[#002D87] text-white"
                : "bg-white text-[#4B5563] border border-[#E5E7EB] hover:bg-[#F9FAFB]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Courses list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#002D87] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center">
          <BookOpen className="w-12 h-12 text-[#9CA3AF] mx-auto mb-3" />
          <p className="text-[#6B7280]">{t("courses.noCourses")}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredCourses.map((course) => (
            <div
              key={course.id}
              className="bg-white rounded-xl border border-[#E5E7EB] p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-base font-semibold text-[#1F2937] flex-1 min-w-0 truncate">
                  {course.courseTitle}
                </h3>
                <span
                  className={`ml-2 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${getStatusBadge(course.status)}`}
                >
                  {getStatusLabel(course.status)}
                </span>
              </div>

              {(course.instructorFirstName || course.instructorLastName) && (
                <p className="text-sm text-[#6B7280] mb-2">
                  <span className="font-medium">
                    {t("courses.instructor")}:
                  </span>{" "}
                  {course.instructorFirstName} {course.instructorLastName}
                </p>
              )}

              <p className="text-xs text-[#9CA3AF] flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {t("courses.assignedOn")}{" "}
                {new Date(course.assignedAt).toLocaleDateString(
                  locale === "ar" ? "ar-SA" : "en-US",
                  { year: "numeric", month: "short", day: "numeric" }
                )}
              </p>

              {course.status === "pre_assigned" && (
                <p className="text-xs text-amber-600 mt-2">
                  {t("courses.activatesAtThreshold")}
                </p>
              )}

              {course.deactivationScheduledAt && (
                <p className="text-xs text-amber-600 flex items-center gap-1 mt-2">
                  <AlertTriangle className="w-3 h-3" />
                  {t("courses.deactivationPending")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TACoursesList;
