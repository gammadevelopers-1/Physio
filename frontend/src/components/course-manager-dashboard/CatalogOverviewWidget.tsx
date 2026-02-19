"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Search,
  MoreVertical,
  ChevronRight,
  Star,
  BookOpen,
  Loader2,
  Play,
  FileText,
  CheckCircle,
  Archive,
} from "lucide-react";
import Link from "next/link";

interface Course {
  id: string;
  name: string;
  category: string;
  thumbnail: string;
  instructor: string;
  status: "active" | "preparing" | "completed" | "archived";
  enrolled: number;
  capacity: number;
  completionRate: number | null;
  rating: number | null;
}

interface CatalogOverviewWidgetProps {
  courses: Course[];
  onStatusChange?: (courseId: string, newStatus: string) => Promise<void>;
}

const STATUS_OPTIONS = [
  { value: "active", icon: <Play className="w-3.5 h-3.5" /> },
  { value: "preparing", icon: <FileText className="w-3.5 h-3.5" /> },
  { value: "completed", icon: <CheckCircle className="w-3.5 h-3.5" /> },
  { value: "archived", icon: <Archive className="w-3.5 h-3.5" /> },
] as const;

const CatalogOverviewWidget = ({
  courses,
  onStatusChange,
}: CatalogOverviewWidgetProps) => {
  const t = useTranslations("courseManagerDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleStatusAction = async (courseId: string, newStatus: string) => {
    if (!onStatusChange) return;
    setOpenDropdown(null);
    setLoadingId(courseId);
    try {
      await onStatusChange(courseId, newStatus);
    } finally {
      setLoadingId(null);
    }
  };

  const filteredCourses = courses.filter((course) => {
    if (statusFilter !== "all" && course.status !== statusFilter) return false;
    if (categoryFilter !== "all" && course.category !== categoryFilter)
      return false;
    if (
      searchQuery &&
      !course.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false;
    return true;
  });

  const categories = Array.from(new Set(courses.map((c) => c.category)));

  const statusColors = {
    active:
      "bg-[var(--functional-green-400)]/10 text-[var(--functional-green-600)]",
    preparing:
      "bg-[var(--functional-amber-500)]/10 text-[var(--functional-amber-600)]",
    completed:
      "bg-[var(--functional-blue-400)]/10 text-[var(--functional-blue-600)]",
    archived: "bg-[#F3F4F6] text-[var(--on-surface-variant)]",
  };

  const renderDropdown = (course: Course) => (
    <div className="relative">
      <button
        onClick={() =>
          setOpenDropdown(openDropdown === course.id ? null : course.id)
        }
        disabled={loadingId === course.id}
        className="w-8 h-8 flex items-center justify-center border border-[#E5E7EB] rounded-md hover:bg-[#F3F4F6] transition-colors disabled:opacity-50"
      >
        {loadingId === course.id ? (
          <Loader2 className="w-4 h-4 animate-spin text-[var(--on-surface-variant)]" />
        ) : (
          <MoreVertical className="w-4 h-4 text-[var(--on-surface-variant)]" />
        )}
      </button>

      {openDropdown === course.id && (
        <>
          {/* Invisible overlay to close dropdown on outside click */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpenDropdown(null)}
          />
          <div className="absolute end-0 bottom-full mb-1 w-44 bg-white rounded-lg border border-[#E5E7EB] shadow-lg z-50">
            <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-wider">
              {t("catalog.changeStatus")}
            </p>
            {STATUS_OPTIONS.filter((s) => s.value !== course.status).map(
              (opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleStatusAction(course.id, opt.value)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                >
                  {opt.icon}
                  {t(`catalog.${opt.value}`)}
                </button>
              )
            )}
            <div className="border-t border-[#E5E7EB]">
              <Link
                href={`/${locale}/dashboard/manager/courses/${course.id}`}
                onClick={() => setOpenDropdown(null)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--blue-brand-blue)] hover:bg-[#F9FAFB] transition-colors"
              >
                {t("catalog.manageCourse")}
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="bg-[var(--surface-intense)] rounded-xl border border-[#E5E7EB] overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 border-b border-[#E5E7EB] gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[var(--gold-gold-100)] rounded-lg flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-[var(--gold-gold-500)]" />
          </div>
          <h3 className="text-base font-semibold text-[var(--on-surface-default)]">
            {t("catalog.title")}
          </h3>
        </div>
        <Link
          href={`/${locale}/dashboard/manager/courses`}
          className="flex items-center gap-1 text-sm font-medium text-[var(--blue-brand-blue)] hover:underline"
        >
          {t("catalog.viewAll")}
          <ChevronRight
            className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`}
          />
        </Link>
      </div>

      {/* Filters */}
      <div className="px-4 sm:px-5 py-4 border-b border-[#E5E7EB]">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-3 flex-1">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 sm:flex-initial px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg bg-[var(--surface-intense)] text-[var(--on-surface-variant)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-brand-blue)]/20 focus:border-[var(--blue-brand-blue)]"
            >
              <option value="all">{t("catalog.allStatus")}</option>
              <option value="active">{t("catalog.active")}</option>
              <option value="preparing">{t("catalog.preparing")}</option>
              <option value="completed">{t("catalog.completed")}</option>
              <option value="archived">{t("catalog.archived")}</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="flex-1 sm:flex-initial px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg bg-[var(--surface-intense)] text-[var(--on-surface-variant)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-brand-blue)]/20 focus:border-[var(--blue-brand-blue)]"
            >
              <option value="all">{t("catalog.allCategories")}</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div className="relative flex-1 sm:min-w-[200px] sm:max-w-[300px]">
            <Search
              className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]`}
            />
            <input
              type="text"
              placeholder={t("catalog.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--blue-brand-blue)]/20 focus:border-[var(--blue-brand-blue)]`}
            />
          </div>
        </div>
      </div>

      {/* Table - Desktop */}
      <div className="hidden md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E5E7EB]">
              <th
                className={`${isRTL ? "text-right" : "text-left"} px-5 py-3 text-xs font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider`}
              >
                {t("catalog.course")}
              </th>
              <th
                className={`${isRTL ? "text-right" : "text-left"} px-4 py-3 text-xs font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider`}
              >
                {t("catalog.instructor")}
              </th>
              <th
                className={`${isRTL ? "text-right" : "text-left"} px-4 py-3 text-xs font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider`}
              >
                {t("catalog.status")}
              </th>
              <th
                className={`${isRTL ? "text-right" : "text-left"} px-4 py-3 text-xs font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider`}
              >
                {t("catalog.enrolled")}
              </th>
              <th
                className={`${isRTL ? "text-right" : "text-left"} px-4 py-3 text-xs font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider`}
              >
                {t("catalog.rating")}
              </th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filteredCourses.map((course) => (
              <tr
                key={course.id}
                className="border-b border-[#F3F4F6] hover:bg-[#F3F4F6] transition-colors"
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--blue-blue-500)] to-[var(--blue-brand-blue)] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                      {course.thumbnail}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--on-surface-default)] truncate">
                        {course.name}
                      </p>
                      <p className="text-xs text-[var(--on-surface-variant)]">
                        {course.category}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className="text-sm text-[var(--on-surface-variant)]">
                    {course.instructor}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span
                    className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${statusColors[course.status]}`}
                  >
                    {t(`catalog.${course.status}`)}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[var(--on-surface-variant)]">
                      {course.enrolled}/{course.capacity}
                    </span>
                    <div className="w-12 h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--functional-blue-600)] rounded-full"
                        style={{
                          width: `${course.capacity > 0 ? (course.enrolled / course.capacity) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  {course.rating !== null ? (
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-[var(--gold-gold-500)] fill-[var(--gold-gold-500)]" />
                      <span className="text-sm text-[var(--on-surface-variant)]">
                        {course.rating.toFixed(1)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-[#9CA3AF]">--</span>
                  )}
                </td>
                <td className="px-4 py-4">{renderDropdown(course)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden p-4 space-y-3">
        {filteredCourses.map((course) => (
          <div
            key={course.id}
            className="bg-[#F9FAFB] rounded-xl p-4 border border-[#E5E7EB]"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[var(--blue-blue-500)] to-[var(--blue-brand-blue)] flex items-center justify-center text-white font-semibold flex-shrink-0">
                {course.thumbnail}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--on-surface-default)] truncate">
                  {course.name}
                </p>
                <p className="text-xs text-[var(--on-surface-variant)]">
                  {course.instructor}
                </p>
                <p className="text-xs text-[var(--on-surface-variant)]">
                  {course.category}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span
                  className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full ${statusColors[course.status]}`}
                >
                  {t(`catalog.${course.status}`)}
                </span>
                {renderDropdown(course)}
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-[#E5E7EB]">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--on-surface-variant)]">
                  {course.enrolled}/{course.capacity} {t("catalog.enrolled")}
                </span>
              </div>
              {course.rating !== null && (
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-[var(--gold-gold-500)] fill-[var(--gold-gold-500)]" />
                  <span className="text-xs text-[var(--on-surface-variant)]">
                    {course.rating.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CatalogOverviewWidget;
