"use client";

import { useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  ChevronRight,
  Star,
  BookOpen,
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

const MAX_DISPLAY = 4;

const CatalogOverviewWidget = ({
  courses,
}: CatalogOverviewWidgetProps) => {
  const t = useTranslations("courseManagerDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  // Show only latest active courses (up to MAX_DISPLAY)
  const displayCourses = useMemo(() => {
    const active = courses.filter((c) => c.status === "active");
    return active.slice(0, MAX_DISPLAY);
  }, [courses]);

  // Chart data
  const statusCounts = {
    active: courses.filter((c) => c.status === "active").length,
    preparing: courses.filter((c) => c.status === "preparing").length,
    completed: courses.filter((c) => c.status === "completed").length,
    archived: courses.filter((c) => c.status === "archived").length,
  };

  const deliveryTypes = Array.from(new Set(courses.map((c) => c.category)));
  const categoryEnrollment = deliveryTypes.map((cat) => {
    const catCourses = courses.filter((c) => c.category === cat);
    const enrolled = catCourses.reduce((sum, c) => sum + c.enrolled, 0);
    const coursesWithCap = catCourses.filter((c) => c.capacity > 0);
    const capacity = coursesWithCap.reduce((sum, c) => sum + c.capacity, 0);
    return {
      category: cat,
      enrolled,
      capacity,
      courseCount: catCourses.length,
    };
  });

  const maxEnrollment = Math.max(...categoryEnrollment.map((c) => Math.max(c.capacity, c.enrolled)), 1);

  // Donut chart helpers
  const donutData = [
    { label: t("catalog.active"), count: statusCounts.active, color: "#22C55E" },
    { label: t("catalog.preparing"), count: statusCounts.preparing, color: "#F59E0B" },
    { label: t("catalog.completed"), count: statusCounts.completed, color: "#3B82F6" },
    { label: t("catalog.archived"), count: statusCounts.archived, color: "var(--color-text-secondary)" },
  ].filter((d) => d.count > 0);

  const total = donutData.reduce((sum, d) => sum + d.count, 0);

  const donutSegments = (() => {
    let cumulativePercent = 0;
    return donutData.map((d) => {
      const percent = total > 0 ? d.count / total : 0;
      const startAngle = cumulativePercent * 2 * Math.PI - Math.PI / 2;
      cumulativePercent += percent;
      const endAngle = cumulativePercent * 2 * Math.PI - Math.PI / 2;
      const largeArc = percent > 0.5 ? 1 : 0;
      const r = 40;
      const cx = 50;
      const cy = 50;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      return {
        ...d,
        path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
      };
    });
  })();

  const statusColors: Record<string, string> = {
    active:
      "bg-[var(--functional-green-400)]/10 text-[var(--functional-green-600)]",
    preparing:
      "bg-[var(--functional-amber-500)]/10 text-[var(--functional-amber-600)]",
    completed:
      "bg-[var(--functional-blue-400)]/10 text-[var(--functional-blue-600)]",
    archived: "bg-[var(--color-border-subtle)] text-[var(--on-surface-variant)]",
    draft: "bg-[var(--color-border-subtle)] text-[var(--on-surface-variant)]",
    pending_review:
      "bg-[var(--functional-amber-500)]/10 text-[var(--functional-amber-600)]",
  };

  return (
    <div className="bg-[var(--surface-intense)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 sm:p-5 border-b border-[var(--color-border)]">
        <div className="w-8 h-8 bg-[var(--gold-gold-100)] rounded-lg flex items-center justify-center">
          <BookOpen className="w-4 h-4 text-[var(--color-star)]" />
        </div>
        <h3 className="text-base font-semibold text-[var(--on-surface-default)]">
          {t("catalog.title")}
        </h3>
      </div>

      {/* Charts Section */}
      {courses.length > 0 && (
        <div className="px-4 sm:px-5 py-4 border-b border-[var(--color-border)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Donut Chart — Status Distribution */}
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
                {t("catalog.statusDistribution")}
              </p>
              <div className="flex items-center gap-6">
                <svg viewBox="0 0 100 100" className="w-24 h-24 flex-shrink-0">
                  {donutSegments.length === 1 ? (
                    <circle cx="50" cy="50" r="40" fill={donutSegments[0].color} />
                  ) : (
                    donutSegments.map((seg, i) => (
                      <path key={i} d={seg.path} fill={seg.color} />
                    ))
                  )}
                  <circle cx="50" cy="50" r="24" fill="white" />
                  <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="text-xs font-bold" fill="var(--color-text-primary)" fontSize="14">
                    {total}
                  </text>
                </svg>
                <div className="flex flex-col gap-1.5">
                  {donutData.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-xs text-[var(--color-text-secondary)]">{d.label}</span>
                      <span className="text-xs font-medium text-[var(--color-text-primary)]">{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bar Chart — Enrollment by Delivery Type */}
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
                {t("catalog.enrollmentByCategory")}
              </p>
              <div className="space-y-2">
                {categoryEnrollment.slice(0, 5).map((cat, i) => {
                  const deliveryLabel = (() => {
                    try { return t(`coursesPage.delivery.${cat.category}` as Parameters<typeof t>[0]); }
                    catch { return cat.category; }
                  })();
                  const barValue = Math.max(cat.enrolled, 1);
                  const fillPercent = cat.capacity > 0
                    ? Math.min((cat.enrolled / cat.capacity) * 100, 100)
                    : 100;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs text-[var(--color-text-secondary)] truncate max-w-[120px]">
                          {deliveryLabel} ({cat.courseCount})
                        </span>
                        <span className="text-xs font-medium text-[var(--color-text-primary)]">
                          {cat.capacity > 0 ? `${cat.enrolled}/${cat.capacity}` : `${cat.enrolled}`}
                        </span>
                      </div>
                      <div className="h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--color-primary)] rounded-full"
                          style={{ width: `${(barValue / maxEnrollment) * 100}%`, opacity: fillPercent < 100 ? 0.6 : 1 }}
                        />
                      </div>
                    </div>
                  );
                })}
                {categoryEnrollment.length === 0 && (
                  <p className="text-xs text-[var(--color-text-secondary)]">—</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table - Desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="text-start px-5 py-3 text-xs font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider">
                {t("catalog.course")}
              </th>
              <th className="text-start px-4 py-3 text-xs font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider">
                {t("catalog.instructor")}
              </th>
              <th className="text-start px-4 py-3 text-xs font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider">
                {t("catalog.status")}
              </th>
              <th className="text-start px-4 py-3 text-xs font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider">
                {t("catalog.enrolled")}
              </th>
              <th className="text-start px-4 py-3 text-xs font-semibold text-[var(--on-surface-variant)] uppercase tracking-wider">
                {t("catalog.rating")}
              </th>
            </tr>
          </thead>
          <tbody>
            {displayCourses.map((course) => (
              <tr
                key={course.id}
                className="border-b border-[#F3F4F6] hover:bg-[var(--color-border-subtle)] transition-colors"
              >
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--blue-blue-500)] to-[var(--blue-brand-blue)] flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                      {course.thumbnail}
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/${locale}/dashboard/manager/courses/${course.id}`}
                        className="text-sm font-medium text-[var(--on-surface-default)] truncate hover:text-[var(--blue-brand-blue)] hover:underline transition-colors"
                      >
                        {course.name}
                      </Link>
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
                    <div className="w-12 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
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
                      <Star className="w-4 h-4 text-[var(--color-star)] fill-[var(--color-star)]" />
                      <span className="text-sm text-[var(--on-surface-variant)]">
                        {course.rating.toFixed(1)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-[var(--color-text-secondary)]">--</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden p-4 space-y-3">
        {displayCourses.map((course) => (
          <div
            key={course.id}
            className="bg-[var(--color-surface-page)] rounded-xl p-4 border border-[var(--color-border)]"
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[var(--blue-blue-500)] to-[var(--blue-brand-blue)] flex items-center justify-center text-white font-semibold flex-shrink-0">
                {course.thumbnail}
              </div>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/${locale}/dashboard/manager/courses/${course.id}`}
                  className="text-sm font-semibold text-[var(--on-surface-default)] truncate hover:text-[var(--blue-brand-blue)] hover:underline transition-colors block"
                >
                  {course.name}
                </Link>
                <p className="text-xs text-[var(--on-surface-variant)]">
                  {course.instructor}
                </p>
                <p className="text-xs text-[var(--on-surface-variant)]">
                  {course.category}
                </p>
              </div>
              <span
                className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full flex-shrink-0 ${statusColors[course.status]}`}
              >
                {t(`catalog.${course.status}`)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--on-surface-variant)]">
                  {course.enrolled}/{course.capacity} {t("catalog.enrolled")}
                </span>
              </div>
              {course.rating !== null && (
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-[var(--color-star)] fill-[var(--color-star)]" />
                  <span className="text-xs text-[var(--on-surface-variant)]">
                    {course.rating.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* View All Footer */}
      <div className="border-t border-[var(--color-border)] p-4">
        <Link
          href={`/${locale}/dashboard/manager/courses`}
          className="flex items-center justify-center gap-1.5 text-sm font-medium text-[var(--blue-brand-blue)] hover:underline"
        >
          {t("catalog.viewAll")}
          <ChevronRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
        </Link>
      </div>
    </div>
  );
};

export default CatalogOverviewWidget;
