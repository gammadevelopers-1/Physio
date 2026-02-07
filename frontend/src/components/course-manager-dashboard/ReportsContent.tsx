"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import {
  Download,
  Calendar,
  Users,
  BookOpen,
  TrendingUp,
  BarChart3,
  FileText,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  ChevronDown,
} from "lucide-react";

const mockManager = {
  name: "Mohammed Al-Khalid",
  email: "m.alkhalid@physio.edu.sa",
  totalCourses: 12,
  totalInstructors: 6,
  nelcCompliance: 85,
  avatar: "/images/instructor-1.png",
};

const ReportsContent = () => {
  const locale = useLocale();
  const t = useTranslations("courseManagerDashboard");
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [selectedReport, setSelectedReport] = useState("overview");

  const reportTypes = [
    { id: "overview", label: t("reportsPage.types.overview"), icon: BarChart3 },
    { id: "enrollment", label: t("reportsPage.types.enrollment"), icon: Users },
    { id: "completion", label: t("reportsPage.types.completion"), icon: TrendingUp },
    { id: "assessment", label: t("reportsPage.types.assessment"), icon: FileText },
    { id: "instructor", label: t("reportsPage.types.instructor"), icon: BookOpen },
  ];

  const overviewStats = [
    {
      label: t("reportsPage.overview.totalEnrollments"),
      value: "1,245",
      change: 12.5,
      trend: "up",
    },
    {
      label: t("reportsPage.overview.completionRate"),
      value: "78%",
      change: 5.2,
      trend: "up",
    },
    {
      label: t("reportsPage.overview.avgScore"),
      value: "82%",
      change: -2.1,
      trend: "down",
    },
    {
      label: t("reportsPage.overview.certifications"),
      value: "856",
      change: 18.3,
      trend: "up",
    },
  ];

  const topCourses = [
    { name: "ACLS Training", enrollments: 245, completion: 85, rating: 4.8 },
    { name: "First Aid Certification", enrollments: 198, completion: 72, rating: 4.5 },
    { name: "CPR Certification", enrollments: 176, completion: 91, rating: 4.9 },
    { name: "Emergency Response", enrollments: 145, completion: 68, rating: 4.3 },
    { name: "Infection Control", enrollments: 112, completion: 78, rating: 4.6 },
  ];

  const recentReports = [
    { id: "1", name: "Monthly Enrollment Report", date: "2026-02-01", type: "PDF" },
    { id: "2", name: "Q4 Completion Analysis", date: "2026-01-15", type: "Excel" },
    { id: "3", name: "Instructor Performance Review", date: "2026-01-10", type: "PDF" },
    { id: "4", name: "NELC Compliance Report", date: "2026-01-05", type: "PDF" },
  ];

  return (
    <>
      <CourseManagerNavbar manager={mockManager} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <CourseManagerSidebar manager={mockManager} />
            </div>
            <CourseManagerMobileSidebar manager={mockManager} />

            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-[#1F2937]">
                    {t("reportsPage.title")}
                  </h1>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {t("reportsPage.subtitle")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                  >
                    <option value="week">{t("reportsPage.period.week")}</option>
                    <option value="month">{t("reportsPage.period.month")}</option>
                    <option value="quarter">{t("reportsPage.period.quarter")}</option>
                    <option value="year">{t("reportsPage.period.year")}</option>
                  </select>
                  <button className="inline-flex items-center gap-2 px-4 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors">
                    <Download className="w-4 h-4" />
                    {t("reportsPage.exportReport")}
                  </button>
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

              {/* Overview Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {overviewStats.map((stat, index) => (
                  <div key={index} className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                    <p className="text-xs text-[#6B7280] mb-1">{stat.label}</p>
                    <div className="flex items-end justify-between">
                      <p className="text-2xl font-bold text-[#1F2937]">{stat.value}</p>
                      <div className={`flex items-center gap-0.5 text-xs font-medium ${
                        stat.trend === "up" ? "text-[#22C55E]" : "text-[#EF4444]"
                      }`}>
                        {stat.trend === "up" ? (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowDownRight className="w-3.5 h-3.5" />
                        )}
                        {Math.abs(stat.change)}%
                      </div>
                    </div>
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
                  <div className="divide-y divide-[#E5E7EB]">
                    {topCourses.map((course, index) => (
                      <div key={index} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-[#EFF6FF] rounded-lg flex items-center justify-center">
                            <span className="text-xs font-semibold text-[#3B82F6]">
                              {index + 1}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#1F2937]">{course.name}</p>
                            <p className="text-xs text-[#6B7280]">
                              {course.enrollments} {t("reportsPage.enrolled")}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-[#22C55E]">{course.completion}%</p>
                          <p className="text-xs text-[#6B7280]">{t("reportsPage.completion")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Enrollment Chart Placeholder */}
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

              {/* Recent Reports */}
              <div className="bg-white rounded-xl border border-[#E5E7EB]">
                <div className="p-4 border-b border-[#E5E7EB] flex items-center justify-between">
                  <h2 className="text-base font-semibold text-[#1F2937]">
                    {t("reportsPage.recentReports")}
                  </h2>
                  <button className="text-sm text-[#3B82F6] hover:underline">
                    {t("reportsPage.viewAll")}
                  </button>
                </div>
                <div className="divide-y divide-[#E5E7EB]">
                  {recentReports.map((report) => (
                    <div key={report.id} className="p-4 flex items-center justify-between hover:bg-[#F9FAFB] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#FEE2E2] rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-[#EF4444]" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#1F2937]">{report.name}</p>
                          <p className="text-xs text-[#6B7280]">
                            {report.date} • {report.type}
                          </p>
                        </div>
                      </div>
                      <button className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors">
                        <Download className="w-4 h-4 text-[#6B7280]" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ReportsContent;
