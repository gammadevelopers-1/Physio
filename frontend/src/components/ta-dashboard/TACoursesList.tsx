"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { BookOpen, AlertTriangle, Clock, Search, ArrowUpDown, Users, Calendar, ChevronRight, ChevronLeft } from "lucide-react";
import { taApi, type TAAssignedCourse } from "@/lib/api";

type StatusFilter = "all" | "approved" | "suggested";
type SortOption = "newest" | "oldest" | "alphabetical";

const TACoursesList = () => {
  const t = useTranslations("taDashboard");
  const locale = useLocale();
  const [courses, setCourses] = useState<TAAssignedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

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

  const filteredAndSortedCourses = useMemo(() => {
    let result = filter === "all" ? courses : courses.filter((c) => c.status === filter);

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.courseTitle.toLowerCase().includes(q) ||
          (c.instructorFirstName && c.instructorFirstName.toLowerCase().includes(q)) ||
          (c.instructorLastName && c.instructorLastName.toLowerCase().includes(q)),
      );
    }

    // Sort
    switch (sortBy) {
      case "newest":
        return [...result].sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime());
      case "oldest":
        return [...result].sort((a, b) => new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime());
      case "alphabetical":
        return [...result].sort((a, b) => a.courseTitle.localeCompare(b.courseTitle));
      default:
        return result;
    }
  }, [courses, filter, searchQuery, sortBy]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-50 text-green-700 border border-green-200";
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
      case "suggested":
        return t("courses.pendingApproval");
      default:
        return status;
    }
  };

  const filters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: t("courses.all") },
    { key: "approved", label: t("courses.active") },
    { key: "suggested", label: t("courses.pendingApproval") },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1F2937]">
          {t("courses.title")}
        </h1>
        <p className="text-sm text-[#6B7280] mt-1">
          {t("courses.subtitle") || "View your assigned courses"}
        </p>
      </div>

      {/* Filters Card */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder={t("courses.searchPlaceholder") || "Search courses..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#d4a520]/20 focus:border-transparent"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-[#6B7280]" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#d4a520]/20"
            >
              <option value="newest">{t("courses.sortNewest") || "Newest First"}</option>
              <option value="oldest">{t("courses.sortOldest") || "Oldest First"}</option>
              <option value="alphabetical">{t("courses.sortAlphabetical") || "Alphabetical"}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key
                ? "btn-gold text-white"
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
          <div className="w-8 h-8 border-2 border-[#a37f49] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredAndSortedCourses.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center">
          <BookOpen className="w-12 h-12 text-[#9CA3AF] mx-auto mb-3" />
          <p className="text-[#6B7280]">{t("courses.noCourses")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAndSortedCourses.map((course) => {
            const thumbnailSrc = course.courseThumbnail || "/student_dashboard/courses/image 473.svg";

            return (
              <div
                key={course.id}
                className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden hover:shadow-md transition-shadow flex flex-col"
              >
                {/* Thumbnail */}
                <div className="relative h-40">
                  <Image
                    src={thumbnailSrc}
                    alt={course.courseTitle}
                    fill
                    className="object-cover"
                    unoptimized={thumbnailSrc.startsWith("http")}
                  />
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${getStatusBadge(course.status)}`}>
                      {getStatusLabel(course.status)}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="text-base font-semibold text-[#1F2937] mb-2 line-clamp-1">
                    {course.courseTitle}
                  </h3>

                  {(course.instructorFirstName || course.instructorLastName) && (
                    <div className="flex items-center gap-1.5 text-sm text-[#6B7280] mb-2">
                      <Users className="w-3.5 h-3.5" />
                      {t("courses.instructor")}: {course.instructorFirstName} {course.instructorLastName}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-xs text-[#9CA3AF] mb-3">
                    <Calendar className="w-3.5 h-3.5" />
                    {t("courses.assignedOn")}{" "}
                    {new Date(course.assignedAt).toLocaleDateString(
                      locale === "ar" ? "ar-SA" : "en-US",
                      { year: "numeric", month: "short", day: "numeric" },
                    )}
                  </div>

                  {/* View Details button — only for approved TAs */}
                  {course.status === "approved" && (
                    <div className="mt-auto">
                      <Link
                        href={`/${locale}/dashboard/teaching-assistant/courses/${course.courseId}`}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 btn-gold text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        {t("courses.viewDetails") || "View Details"}
                        {locale === "ar" ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TACoursesList;
