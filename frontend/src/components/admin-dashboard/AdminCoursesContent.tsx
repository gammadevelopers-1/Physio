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
  Filter,
  Grid,
  List,
  Star,
  Users,
  Clock,
  MoreVertical,
  Eye,
  Edit,
  Archive,
  Trash2,
} from "lucide-react";

// Mock Admin Profile
const mockAdmin = {
  name: "Abdullah Al-Rashid",
  email: "admin@physio.edu.sa",
  totalUsers: 1245,
  totalCourses: 12,
  uptime: 99.9,
};

// Mock Courses Data
const mockCourses = [
  {
    id: "1",
    title: "ACLS Training",
    instructor: "Dr. Faisal Ahmed",
    category: "Emergency Care",
    status: "active",
    enrolled: 45,
    capacity: 50,
    rating: 4.8,
    revenue: 45000,
    completionRate: 85,
    thumbnail: "AC",
  },
  {
    id: "2",
    title: "First Aid Certification",
    instructor: "Dr. Sara Al-Rashid",
    category: "Safety",
    status: "active",
    enrolled: 32,
    capacity: 40,
    rating: 4.5,
    revenue: 32000,
    completionRate: 72,
    thumbnail: "FA",
  },
  {
    id: "3",
    title: "CPR Certification",
    instructor: "Dr. Khalid Hassan",
    category: "Emergency Care",
    status: "draft",
    enrolled: 0,
    capacity: 30,
    rating: null,
    revenue: 0,
    completionRate: null,
    thumbnail: "CP",
  },
  {
    id: "4",
    title: "Emergency Response",
    instructor: "Dr. Fatima Noor",
    category: "Emergency Care",
    status: "completed",
    enrolled: 50,
    capacity: 50,
    rating: 4.9,
    revenue: 50000,
    completionRate: 91,
    thumbnail: "ER",
  },
  {
    id: "5",
    title: "Infection Control",
    instructor: "Dr. Mohammed Ali",
    category: "Healthcare",
    status: "active",
    enrolled: 28,
    capacity: 35,
    rating: 4.6,
    revenue: 28000,
    completionRate: 78,
    thumbnail: "IC",
  },
  {
    id: "6",
    title: "Patient Safety",
    instructor: "Dr. Aisha Khan",
    category: "Healthcare",
    status: "archived",
    enrolled: 40,
    capacity: 40,
    rating: 4.7,
    revenue: 40000,
    completionRate: 88,
    thumbnail: "PS",
  },
];

const AdminCoursesContent = () => {
  const t = useTranslations("adminDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "active":
        return "bg-[#DCFCE7] text-[#16A34A]";
      case "draft":
        return "bg-[#F3F4F6] text-[#6B7280]";
      case "completed":
        return "bg-[#DBEAFE] text-[#1D4ED8]";
      case "archived":
        return "bg-[#FEF3C7] text-[#D97706]";
      default:
        return "bg-[#F3F4F6] text-[#6B7280]";
    }
  };

  const filteredCourses = mockCourses.filter((course) => {
    const matchesSearch = course.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || course.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: mockCourses.length,
    active: mockCourses.filter((c) => c.status === "active").length,
    totalEnrollments: mockCourses.reduce((acc, c) => acc + c.enrolled, 0),
    totalRevenue: mockCourses.reduce((acc, c) => acc + c.revenue, 0),
  };

  return (
    <>
      <AdminNavbar admin={mockAdmin} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <AdminSidebar admin={mockAdmin} />
            </div>

            <AdminMobileSidebar admin={mockAdmin} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937]">
                    {t("coursesPage.title")}
                  </h1>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {t("coursesPage.subtitle")}
                  </p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2.5 btn-gold text-white rounded-lg transition-colors">
                  <Plus className="w-5 h-5" />
                  <span className="text-sm font-medium">{t("coursesPage.createCourse")}</span>
                </button>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-2xl font-bold text-[#1F2937]">{stats.total}</p>
                  <p className="text-sm text-[#6B7280]">{t("coursesPage.stats.total")}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-2xl font-bold text-[#16A34A]">{stats.active}</p>
                  <p className="text-sm text-[#6B7280]">{t("coursesPage.stats.active")}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-2xl font-bold text-[#3B82F6]">{stats.totalEnrollments}</p>
                  <p className="text-sm text-[#6B7280]">{t("coursesPage.stats.enrollments")}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-2xl font-bold text-[#D4A520]">
                    {(stats.totalRevenue / 1000).toFixed(0)}K
                  </p>
                  <p className="text-sm text-[#6B7280]">{t("coursesPage.stats.revenue")}</p>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 mb-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Search */}
                  <div className="flex-1 relative">
                    <Search className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF] ${isRTL ? "right-3" : "left-3"}`} />
                    <input
                      type="text"
                      placeholder={t("coursesPage.searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full h-10 border border-[#E5E7EB] rounded-lg text-sm ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} focus:outline-none focus:border-[#002D87]`}
                    />
                  </div>

                  {/* Status Filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-10 px-4 border border-[#E5E7EB] rounded-lg text-sm text-[#4B5563] focus:outline-none focus:border-[#002D87]"
                  >
                    <option value="all">{t("coursesPage.filters.allStatus")}</option>
                    <option value="active">{t("coursesPage.filters.active")}</option>
                    <option value="draft">{t("coursesPage.filters.draft")}</option>
                    <option value="completed">{t("coursesPage.filters.completed")}</option>
                    <option value="archived">{t("coursesPage.filters.archived")}</option>
                  </select>

                  {/* View Toggle */}
                  <div className="flex items-center gap-1 border border-[#E5E7EB] rounded-lg p-1">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`p-2 rounded ${viewMode === "grid" ? "btn-gold text-white" : "text-[#6B7280]"}`}
                    >
                      <Grid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode("list")}
                      className={`p-2 rounded ${viewMode === "list" ? "btn-gold text-white" : "text-[#6B7280]"}`}
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Courses Grid/List */}
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCourses.map((course) => (
                    <div
                      key={course.id}
                      className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden"
                    >
                      {/* Thumbnail */}
                      <div className="h-32 bg-gradient-to-r from-[#002D87] to-[#0066FF] flex items-center justify-center">
                        <span className="text-3xl font-bold text-white">
                          {course.thumbnail}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-base font-semibold text-[#1F2937] line-clamp-1">
                            {course.title}
                          </h3>
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusBadgeStyle(course.status)}`}
                          >
                            {t(`coursesPage.filters.${course.status}`)}
                          </span>
                        </div>

                        <p className="text-sm text-[#6B7280] mb-3">
                          {course.instructor}
                        </p>

                        <div className="flex items-center gap-4 text-sm text-[#6B7280] mb-3">
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>
                              {course.enrolled}/{course.capacity}
                            </span>
                          </div>
                          {course.rating && (
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 text-[#D4A520] fill-current" />
                              <span>{course.rating}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-[#E5E7EB]">
                          <span className="text-sm font-medium text-[#1F2937]">
                            SAR {course.revenue.toLocaleString()}
                          </span>
                          <div className="relative">
                            <button
                              onClick={() =>
                                setOpenDropdownId(
                                  openDropdownId === course.id ? null : course.id
                                )
                              }
                              className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
                            >
                              <MoreVertical className="w-4 h-4 text-[#6B7280]" />
                            </button>

                            {openDropdownId === course.id && (
                              <div
                                className={`absolute bottom-full mb-1 bg-white rounded-lg shadow-lg border border-[#E5E7EB] py-1 min-w-[140px] z-10 ${isRTL ? "left-0" : "right-0"}`}
                              >
                                <button className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#4B5563] hover:bg-[#F9FAFB]">
                                  <Eye className="w-4 h-4" />
                                  {t("coursesPage.actions.view")}
                                </button>
                                <button className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#4B5563] hover:bg-[#F9FAFB]">
                                  <Edit className="w-4 h-4" />
                                  {t("coursesPage.actions.edit")}
                                </button>
                                <button className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#4B5563] hover:bg-[#F9FAFB]">
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
                <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <tr>
                        <th className={`px-4 py-3 text-xs font-medium text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("coursesPage.table.course")}
                        </th>
                        <th className={`px-4 py-3 text-xs font-medium text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("coursesPage.table.instructor")}
                        </th>
                        <th className={`px-4 py-3 text-xs font-medium text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("coursesPage.table.status")}
                        </th>
                        <th className={`px-4 py-3 text-xs font-medium text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("coursesPage.table.enrolled")}
                        </th>
                        <th className={`px-4 py-3 text-xs font-medium text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("coursesPage.table.rating")}
                        </th>
                        <th className={`px-4 py-3 text-xs font-medium text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("coursesPage.table.revenue")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCourses.map((course) => (
                        <tr
                          key={course.id}
                          className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]"
                        >
                          <td className="px-4 py-4">
                            <span className="text-sm font-medium text-[#1F2937]">
                              {course.title}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-[#6B7280]">
                            {course.instructor}
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusBadgeStyle(course.status)}`}
                            >
                              {t(`coursesPage.filters.${course.status}`)}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-[#6B7280]">
                            {course.enrolled}/{course.capacity}
                          </td>
                          <td className="px-4 py-4">
                            {course.rating ? (
                              <div className="flex items-center gap-1">
                                <Star className="w-4 h-4 text-[#D4A520] fill-current" />
                                <span className="text-sm text-[#1F2937]">
                                  {course.rating}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-[#9CA3AF]">-</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-sm font-medium text-[#1F2937]">
                            SAR {course.revenue.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {filteredCourses.length === 0 && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] py-12 text-center">
                  <BookOpen className="w-12 h-12 text-[#9CA3AF] mx-auto mb-4" />
                  <p className="text-[#6B7280]">{t("coursesPage.noCourses")}</p>
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
