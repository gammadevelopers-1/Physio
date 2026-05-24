"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { BookOpen, AlertTriangle, Clock, Search, ArrowUpDown, Users, Calendar, ChevronRight, ChevronLeft } from "lucide-react";
import { taApi, type TAAssignedCourse } from "@/lib/api";
import { FmtDate } from "@/components/ui/Fmt";

type StatusFilter = "all" | "approved" | "suggested" | "completed";
type SortOption = "newest" | "oldest" | "alphabetical";

const TACoursesList = () => {
  const t = useTranslations("taDashboard");
  const locale = useLocale();
  const [courses, setCourses] = useState<TAAssignedCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;
  const isRTL = locale === "ar";

  // Reset pagination whenever filters change so the user always lands
  // on page 1 of the new result set.
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery, sortBy]);

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
    let result = filter === "all" ? courses
      : filter === "completed" ? courses.filter((c) => (c as any).courseStatus === "completed")
      : filter === "approved" ? courses.filter((c) => c.status === "approved" && (c as any).courseStatus !== "completed")
      : courses.filter((c) => c.status === filter);

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
      case "active":
        return "bg-green-50 text-green-700 border border-green-200";
      case "completed":
        return "bg-blue-50 text-blue-700 border border-blue-200";
      case "suggested":
        return "bg-orange-50 text-orange-700 border border-orange-200";
      case "pre_assigned":
        return "bg-blue-50 text-blue-700 border border-blue-200";
      default:
        return "bg-[var(--color-surface-page)] text-[var(--color-text-primary)] border border-[var(--color-border)]";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Active";
      case "completed":
        return "Completed";
      case "suggested":
        return t("courses.pendingApproval");
      case "pre_assigned":
        return "Pre-assigned";
      default:
        return status;
    }
  };

  const filters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: t("courses.all") },
    { key: "approved", label: "Active" },
    { key: "suggested", label: t("courses.pendingApproval") },
    { key: "completed" as StatusFilter, label: "Completed" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
          {t("courses.title")}
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          {t("courses.subtitle") || "View your assigned courses"}
        </p>
      </div>

      {/* Filters Card */}
      <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
            <input
              type="text"
              placeholder={t("courses.searchPlaceholder") || "Search courses..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#d4a520]/20 focus:border-transparent"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-[var(--color-text-secondary)]" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm bg-[var(--color-surface-card)] focus:outline-none focus:ring-2 focus:ring-[#d4a520]/20"
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
                ? "btn-gold text-[var(--color-button-text)]"
                : "bg-[var(--color-surface-card)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-border-subtle)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Courses list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredAndSortedCourses.length === 0 ? (
        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-8 text-center">
          <BookOpen className="w-12 h-12 text-[var(--color-text-secondary)] mx-auto mb-3" />
          <p className="text-[var(--color-text-secondary)]">{t("courses.noCourses")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAndSortedCourses
            .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
            .map((course) => {
            const hasThumb = !!course.courseThumbnail;
            const thumbnailSrc = course.courseThumbnail || "/student_dashboard/courses/image 473.svg";
            const cardInitial = (course.courseTitle || "?").trim().charAt(0).toUpperCase();
            const isRTL = locale === "ar";

            return (
              <div
                key={course.id}
                className="group bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
              >
                {/* Thumbnail — 16:9 */}
                <div className="relative w-full aspect-[16/9] bg-[var(--color-surface-page)] overflow-hidden">
                  {hasThumb ? (
                    <Image
                      src={thumbnailSrc}
                      alt={course.courseTitle}
                      fill
                      className="object-cover object-top"
                      unoptimized={thumbnailSrc.startsWith("http")}
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{
                        background:
                          "linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))",
                      }}
                    >
                      <span className="text-white text-6xl font-bold opacity-90 select-none">
                        {cardInitial}
                      </span>
                    </div>
                  )}
                  <span
                    className={`absolute top-3 ${isRTL ? "right-3" : "left-3"} px-2.5 py-1 rounded-full text-[11px] font-semibold shadow-sm ${getStatusBadge((course as any).courseStatus || course.status)}`}
                  >
                    {getStatusLabel((course as any).courseStatus || course.status)}
                  </span>
                </div>

                {/* Content */}
                <div className="p-4 flex flex-col flex-1 gap-2">
                  <h3 className="text-[16px] font-semibold text-[var(--color-text-primary)] leading-[22px] line-clamp-2">
                    {course.courseTitle}
                  </h3>

                  {(course.instructorFirstName || course.instructorLastName) && (
                    <div className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-secondary)]">
                      <Users className="w-3.5 h-3.5" strokeWidth={1.5} />
                      {t("courses.instructor")}: {course.instructorFirstName} {course.instructorLastName}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-secondary)]">
                    <Calendar className="w-3.5 h-3.5" strokeWidth={1.5} />
                    {t("courses.assignedOn")}{" "}
                    <FmtDate
                      value={course.assignedAt}
                      variant="readable"
                      locale={locale === "ar" ? "ar" : "en"}
                    />
                  </div>

                  <div className="flex-1" />

                  {/* View Details button — only for approved TAs */}
                  {course.status === "approved" && (
                    <>
                      <div className="h-px bg-[var(--color-border-subtle)] mt-1" />
                      <Link
                        href={`/${locale}/dashboard/teaching-assistant/courses/${course.courseId}`}
                        className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 btn-gold text-[var(--color-button-text)] text-sm font-semibold rounded-lg transition-colors"
                      >
                        {t("courses.viewDetails") || "View Details"}
                        {locale === "ar" ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </Link>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!loading && filteredAndSortedCourses.length > ITEMS_PER_PAGE && (() => {
        const totalPages = Math.ceil(filteredAndSortedCourses.length / ITEMS_PER_PAGE);
        return (
          <div className={`flex items-center justify-between mt-6 ${isRTL ? "flex-row-reverse" : ""}`}>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedCourses.length)} /
              {" "}
              {filteredAndSortedCourses.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) pageNum = i + 1;
                else if (currentPage <= 3) pageNum = i + 1;
                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = currentPage - 2 + i;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium cursor-pointer ${
                      pageNum === currentPage
                        ? "bg-[var(--color-primary)] text-white"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default TACoursesList;
