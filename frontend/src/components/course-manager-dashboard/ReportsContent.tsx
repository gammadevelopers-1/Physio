"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import { useManagerProfile } from "@/hooks/useManagerProfile";
import { courseManagerApi } from "@/lib/api";
import type { InstructorCourse } from "@/types/instructor-dashboard";
import {
  Users,
  BookOpen,
  TrendingUp,
  BarChart3,
  FileText,
  PieChart,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

const ReportsContent = () => {
  const t = useTranslations("courseManagerDashboard");
  const manager = useManagerProfile();
  const [selectedReport, setSelectedReport] = useState("overview");
  const [courses, setCourses] = useState<InstructorCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    courseManagerApi
      .getCourses({ limit: 100 })
      .then((res) => setCourses(res.data))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load data")
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const reportTypes = [
    { id: "overview", label: t("reportsPage.types.overview"), icon: BarChart3 },
    { id: "enrollment", label: t("reportsPage.types.enrollment"), icon: Users },
    { id: "completion", label: t("reportsPage.types.completion"), icon: TrendingUp },
    { id: "assessment", label: t("reportsPage.types.assessment"), icon: FileText },
    { id: "instructor", label: t("reportsPage.types.instructor"), icon: BookOpen },
  ];

  // Derive stats from real course data
  const totalEnrollments = courses.reduce((sum, c) => sum + c.enrolledCount, 0);
  const activeCourses = courses.filter((c) => c.status === "active");
  const avgCompletionRate =
    activeCourses.length > 0
      ? Math.round(
          activeCourses.reduce((sum, c) => sum + c.completionRate, 0) / activeCourses.length
        )
      : 0;

  const overviewStats = [
    {
      label: t("reportsPage.overview.totalEnrollments"),
      value: String(totalEnrollments),
    },
    {
      label: t("reportsPage.overview.completionRate"),
      value: `${avgCompletionRate}%`,
    },
    {
      label: t("reportsPage.overview.totalCourses"),
      value: String(courses.length),
    },
    {
      label: t("reportsPage.overview.activeCourses"),
      value: String(activeCourses.length),
    },
  ];

  // Top courses by enrollment
  const topCourses = [...courses]
    .sort((a, b) => b.enrolledCount - a.enrolledCount)
    .slice(0, 5);

  return (
    <>
      <CourseManagerNavbar manager={manager} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <CourseManagerSidebar manager={manager} />
            </div>
            <CourseManagerMobileSidebar manager={manager} />

            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-[#1F2937]">
                    {t("reportsPage.title")}
                  </h1>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {t("reportsPage.subtitle")}
                  </p>
                </div>
              </div>

              {/* Report Type Tabs */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-2 mb-6">
                <div className="flex flex-wrap gap-2">
                  {reportTypes.map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.id}
                        onClick={() => setSelectedReport(type.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedReport === type.id
                            ? "btn-gold text-white"
                            : "text-[#6B7280] hover:bg-[#F3F4F6]"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {type.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {loading && (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
                </div>
              )}

              {error && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
                  <AlertTriangle className="w-8 h-8 text-[#EF4444] mx-auto mb-3" />
                  <p className="text-sm text-[#6B7280] mb-4">{error}</p>
                  <button
                    onClick={fetchData}
                    className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-white text-sm font-medium rounded-lg"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t("dashboard.retry")}
                  </button>
                </div>
              )}

              {!loading && !error && (
                <>
                  {/* Overview Stats */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {overviewStats.map((stat, index) => (
                      <div key={index} className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                        <p className="text-xs text-[#6B7280] mb-1">{stat.label}</p>
                        <p className="text-2xl font-bold text-[#1F2937]">{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Top Courses */}
                    <div className="bg-white rounded-xl border border-[#E5E7EB]">
                      <div className="p-4 border-b border-[#E5E7EB]">
                        <h2 className="text-base font-semibold text-[#1F2937]">
                          {t("reportsPage.topCourses")}
                        </h2>
                      </div>
                      {topCourses.length === 0 ? (
                        <div className="p-8 text-center">
                          <p className="text-sm text-[#6B7280]">{t("reportsPage.noCourses")}</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-[#E5E7EB]">
                          {topCourses.map((course, index) => (
                            <div key={course.id} className="p-4 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-[#EFF6FF] rounded-lg flex items-center justify-center">
                                  <span className="text-xs font-semibold text-[#3B82F6]">
                                    {index + 1}
                                  </span>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-[#1F2937]">{course.title}</p>
                                  <p className="text-xs text-[#6B7280]">
                                    {course.enrolledCount} {t("reportsPage.enrolled")}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-[#22C55E]">{course.completionRate}%</p>
                                <p className="text-xs text-[#6B7280]">{t("reportsPage.completion")}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Chart Placeholder */}
                    <div className="bg-white rounded-xl border border-[#E5E7EB]">
                      <div className="p-4 border-b border-[#E5E7EB]">
                        <h2 className="text-base font-semibold text-[#1F2937]">
                          {t("reportsPage.enrollmentTrend")}
                        </h2>
                      </div>
                      <div className="p-8 flex items-center justify-center">
                        <div className="text-center">
                          <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mx-auto mb-4">
                            <PieChart className="w-8 h-8 text-[#9CA3AF]" />
                          </div>
                          <p className="text-sm text-[#6B7280]">{t("reportsPage.chartPlaceholder")}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ReportsContent;
