"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import AdminSidebar from "./AdminSidebar";
import AdminMobileSidebar from "./AdminMobileSidebar";
import AdminNavbar from "./AdminNavbar";
import {
  BookOpen,
  Search,
  Plus,
  Grid,
  List,
  Users,
  MoreVertical,
  Eye,
  Edit,
  Archive,
  Loader2,
  ChevronLeft,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { useAdminCourses } from "@/hooks/useAdminCourses";

const ITEMS_PER_PAGE = 12;

const AdminCoursesContent = () => {
  const t = useTranslations("adminDashboard");
  const admin = useAdminProfile();
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const { courses, total, totalPages, loading, error, refetch } = useAdminCourses({
    status: statusFilter,
    search: searchQuery,
    sort: "newest",
    page: currentPage,
    limit: ITEMS_PER_PAGE,
  });

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "active":
        return "bg-[#DCFCE7] text-[#16A34A]";
      case "draft":
        return "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
      case "completed":
        return "bg-[var(--color-border-subtle)] text-[#1D4ED8]";
      case "archived":
        return "bg-[#FEF3C7] text-[#D97706]";
      case "pending_review":
        return "bg-[#FEF3C7] text-[#D97706]";
      case "changes_requested":
        return "bg-[#FEE2E2] text-[#DC2626]";
      default:
        return "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
    }
  };

  const getInitials = (title: string) =>
    title
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  // Stats from current page (note: these are approximate for the visible page only)
  const activeCount = courses.filter((c) => c.status === "active").length;
  const enrollmentsCount = courses.reduce((acc, c) => acc + (c.enrolledCount || 0), 0);
  const pendingCount = courses.filter((c) => c.status === "pending_review").length;

  return (
    <>
      <AdminNavbar admin={admin} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <AdminSidebar admin={admin} />
            </div>

            <AdminMobileSidebar admin={admin} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                    {t("coursesPage.title")}
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    {t("coursesPage.subtitle")}
                  </p>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                  <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{total}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{t("coursesPage.stats.total")}</p>
                </div>
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                  <p className="text-2xl font-bold text-[#16A34A]">{activeCount}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{t("coursesPage.stats.active")}</p>
                </div>
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                  <p className="text-2xl font-bold text-[var(--color-primary)]">{enrollmentsCount}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{t("coursesPage.stats.enrollments")}</p>
                </div>
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                  <p className="text-2xl font-bold text-[#D97706]">{pendingCount}</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{t("coursesPage.stats.pendingReview")}</p>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 mb-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Search */}
                  <div className="flex-1 relative">
                    <Search className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`} />
                    <input
                      type="text"
                      placeholder={t("coursesPage.searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      className={`w-full h-10 border border-[var(--color-border)] rounded-lg text-sm ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} focus:outline-none focus:border-[#002D87]`}
                    />
                  </div>

                  {/* Status Filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="h-10 px-4 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] focus:outline-none focus:border-[#002D87]"
                  >
                    <option value="all">{t("coursesPage.filters.allStatus")}</option>
                    <option value="active">{t("coursesPage.filters.active")}</option>
                    <option value="draft">{t("coursesPage.filters.draft")}</option>
                    <option value="pending_review">{t("coursesPage.filters.pendingReview")}</option>
                    <option value="changes_requested">{t("coursesPage.filters.changesRequested")}</option>
                    <option value="completed">{t("coursesPage.filters.completed")}</option>
                    <option value="archived">{t("coursesPage.filters.archived")}</option>
                  </select>

                  {/* View Toggle */}
                  <div className="flex items-center gap-1 border border-[var(--color-border)] rounded-lg p-1">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`p-2 rounded ${viewMode === "grid" ? "btn-gold text-[var(--color-button-text)]" : "text-[var(--color-text-secondary)]"}`}
                    >
                      <Grid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode("list")}
                      className={`p-2 rounded ${viewMode === "list" ? "btn-gold text-[var(--color-button-text)]" : "text-[var(--color-text-secondary)]"}`}
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Loading State */}
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
                </div>
              )}

              {/* Error State */}
              {error && !loading && (
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-red-200 py-12 text-center">
                  <p className="text-red-600 mb-4">{t("coursesPage.error")}</p>
                  <button
                    onClick={refetch}
                    className="px-4 py-2 btn-gold text-[var(--color-button-text)] rounded-lg"
                  >
                    {t("coursesPage.retry")}
                  </button>
                </div>
              )}

              {/* Courses Grid/List */}
              {!loading && !error && courses.length > 0 && (
                <>
                  {viewMode === "grid" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {courses.map((course) => (
                        <div
                          key={course.id}
                          className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden"
                        >
                          {/* Thumbnail */}
                          <div className="h-32 bg-gradient-to-r from-[#002D87] to-[#0066FF] flex items-center justify-center overflow-hidden">
                            {course.thumbnail ? (
                              <img
                                src={course.thumbnail}
                                alt={course.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-3xl font-bold text-white">
                                {getInitials(course.title)}
                              </span>
                            )}
                          </div>

                          {/* Content */}
                          <div className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="text-base font-semibold text-[var(--color-text-primary)] line-clamp-1">
                                {locale === "ar" && course.titleAr ? course.titleAr : course.title}
                              </h3>
                              <span
                                className={`px-2 py-0.5 text-xs font-medium rounded shrink-0 ml-2 ${getStatusBadgeStyle(course.status)}`}
                              >
                                {t(`coursesPage.filters.${course.status === "pending_review" ? "pendingReview" : course.status === "changes_requested" ? "changesRequested" : course.status}`)}
                              </span>
                            </div>

                            <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                              {course.instructorName || "—"}
                            </p>

                            <div className="flex items-center gap-4 text-sm text-[var(--color-text-secondary)] mb-3">
                              <div className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                <span>
                                  {course.enrolledCount}/{course.maxEnrollment ?? "∞"}
                                </span>
                              </div>
                              {course.completionRate > 0 && (
                                <div className="flex items-center gap-1">
                                  <BarChart3 className="w-4 h-4" />
                                  <span>{course.completionRate}%</span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)]">
                              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                                SAR {(course.price ?? 0).toLocaleString()}
                              </span>
                              <div className="relative">
                                <button
                                  onClick={() =>
                                    setOpenDropdownId(
                                      openDropdownId === course.id ? null : course.id
                                    )
                                  }
                                  className="p-2 hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors"
                                >
                                  <MoreVertical className="w-4 h-4 text-[var(--color-text-secondary)]" />
                                </button>

                                {openDropdownId === course.id && (
                                  <div
                                    className={`absolute bottom-full mb-1 bg-[var(--color-surface-card)] rounded-lg shadow-lg border border-[var(--color-border)] py-1 min-w-[140px] z-10 ${isRTL ? "left-0" : "right-0"}`}
                                  >
                                    <button className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]">
                                      <Eye className="w-4 h-4" />
                                      {t("coursesPage.actions.view")}
                                    </button>
                                    <button className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]">
                                      <Edit className="w-4 h-4" />
                                      {t("coursesPage.actions.edit")}
                                    </button>
                                    <button className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]">
                                      <Archive className="w-4 h-4" />
                                      {t("coursesPage.actions.archive")}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-[var(--color-surface-page)] border-b border-[var(--color-border)]">
                          <tr>
                            <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                              {t("coursesPage.table.course")}
                            </th>
                            <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                              {t("coursesPage.table.instructor")}
                            </th>
                            <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                              {t("coursesPage.table.status")}
                            </th>
                            <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                              {t("coursesPage.table.enrolled")}
                            </th>
                            <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                              {t("coursesPage.table.completion")}
                            </th>
                            <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                              {t("coursesPage.table.price")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {courses.map((course) => (
                            <tr
                              key={course.id}
                              className="border-b border-[#F3F4F6] hover:bg-[var(--color-border-subtle)]"
                            >
                              <td className="px-4 py-4">
                                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                                  {locale === "ar" && course.titleAr ? course.titleAr : course.title}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)]">
                                {course.instructorName || "—"}
                              </td>
                              <td className="px-4 py-4">
                                <span
                                  className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusBadgeStyle(course.status)}`}
                                >
                                  {t(`coursesPage.filters.${course.status === "pending_review" ? "pendingReview" : course.status === "changes_requested" ? "changesRequested" : course.status}`)}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)]">
                                {course.enrolledCount}/{course.maxEnrollment ?? "∞"}
                              </td>
                              <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)]">
                                {course.completionRate}%
                              </td>
                              <td className="px-4 py-4 text-sm font-medium text-[var(--color-text-primary)]">
                                SAR {(course.price ?? 0).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6">
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {t("coursesPage.showing", {
                          from: (currentPage - 1) * ITEMS_PER_PAGE + 1,
                          to: Math.min(currentPage * ITEMS_PER_PAGE, total),
                          total,
                        })}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="p-2 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm text-[var(--color-text-secondary)] px-2">
                          {currentPage} / {totalPages}
                        </span>
                        <button
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="p-2 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Empty State */}
              {!loading && !error && courses.length === 0 && (
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] py-12 text-center">
                  <BookOpen className="w-12 h-12 text-[var(--color-text-secondary)] mx-auto mb-4" />
                  <p className="text-[var(--color-text-secondary)]">{t("coursesPage.noCourses")}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminCoursesContent;
