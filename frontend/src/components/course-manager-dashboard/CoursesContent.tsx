"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import {
  Search,
  Plus,
  Users,
  Calendar,
  MoreVertical,
  Video,
  MapPin,
  BookOpen,
  ChevronRight,
  BarChart3,
  Settings,
  Star,
} from "lucide-react";

interface Course {
  id: string;
  title: string;
  thumbnail: string;
  category: string;
  status: "active" | "draft" | "completed" | "archived";
  delivery: "zoom" | "onsite" | "blended";
  instructor: string;
  enrolledStudents: number;
  capacity: number;
  completionRate: number | null;
  rating: number | null;
  totalSessions: number;
  completedSessions: number;
}

const mockManager = {
  name: "Mohammed Al-Khalid",
  email: "m.alkhalid@physio.edu.sa",
  totalCourses: 12,
  totalInstructors: 6,
  nelcCompliance: 85,
  avatar: "/images/instructor-1.png",
};

const CoursesContent = () => {
  const locale = useLocale();
  const t = useTranslations("courseManagerDashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const courses: Course[] = [
    {
      id: "1",
      title: "ACLS Training",
      category: "Emergency Care",
      thumbnail: "/student_dashboard/courses/image 473.svg",
      instructor: "Dr. Faisal Ahmed",
      status: "active",
      delivery: "zoom",
      enrolledStudents: 45,
      capacity: 50,
      completionRate: 85,
      rating: 4.8,
      totalSessions: 12,
      completedSessions: 8,
    },
    {
      id: "2",
      title: "First Aid Certification",
      category: "Safety",
      thumbnail: "/student_dashboard/courses/image 491.svg",
      instructor: "Dr. Sara Al-Rashid",
      status: "active",
      delivery: "onsite",
      enrolledStudents: 32,
      capacity: 40,
      completionRate: 72,
      rating: 4.5,
      totalSessions: 8,
      completedSessions: 4,
    },
    {
      id: "3",
      title: "CPR Certification",
      category: "Emergency Care",
      thumbnail: "/student_dashboard/courses/image 473.svg",
      instructor: "Dr. Khalid Hassan",
      status: "draft",
      delivery: "blended",
      enrolledStudents: 0,
      capacity: 30,
      completionRate: null,
      rating: null,
      totalSessions: 6,
      completedSessions: 0,
    },
    {
      id: "4",
      title: "Emergency Response",
      category: "Emergency Care",
      thumbnail: "/student_dashboard/courses/image 491.svg",
      instructor: "Dr. Fatima Noor",
      status: "completed",
      delivery: "zoom",
      enrolledStudents: 50,
      capacity: 50,
      completionRate: 91,
      rating: 4.9,
      totalSessions: 10,
      completedSessions: 10,
    },
    {
      id: "5",
      title: "Infection Control",
      category: "Healthcare",
      thumbnail: "/student_dashboard/courses/image 473.svg",
      instructor: "Dr. Ahmed Youssef",
      status: "active",
      delivery: "zoom",
      enrolledStudents: 28,
      capacity: 35,
      completionRate: 60,
      rating: 4.3,
      totalSessions: 8,
      completedSessions: 5,
    },
  ];

  const categories = ["Emergency Care", "Safety", "Healthcare"];

  const filteredCourses = courses.filter((course) => {
    const matchesSearch = course.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || course.status === statusFilter;
    const matchesCategory =
      categoryFilter === "all" || course.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-[#DCFCE7] text-[#22C55E]",
      draft: "bg-[#F3F4F6] text-[#6B7280]",
      completed: "bg-[#EFF6FF] text-[#3B82F6]",
      archived: "bg-[#FEF3C7] text-[#D4A520]",
    };
    return styles[status] || styles.draft;
  };

  const getDeliveryIcon = (delivery: string) => {
    switch (delivery) {
      case "zoom":
        return <Video className="w-3.5 h-3.5" />;
      case "onsite":
        return <MapPin className="w-3.5 h-3.5" />;
      case "blended":
        return <BookOpen className="w-3.5 h-3.5" />;
      default:
        return <Video className="w-3.5 h-3.5" />;
    }
  };

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
                    {t("coursesPage.title")}
                  </h1>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {t("coursesPage.subtitle")}
                  </p>
                </div>
                <button className="inline-flex items-center gap-2 px-4 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors">
                  <Plus className="w-4 h-4" />
                  {t("coursesPage.createCourse")}
                </button>
              </div>

              {/* Stats Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">{t("coursesPage.stats.total")}</p>
                  <p className="text-2xl font-bold text-[#1F2937] mt-1">{courses.length}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">{t("coursesPage.stats.active")}</p>
                  <p className="text-2xl font-bold text-[#22C55E] mt-1">
                    {courses.filter((c) => c.status === "active").length}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">{t("coursesPage.stats.totalEnrollments")}</p>
                  <p className="text-2xl font-bold text-[#1F2937] mt-1">
                    {courses.reduce((acc, c) => acc + c.enrolledStudents, 0)}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">{t("coursesPage.stats.avgRating")}</p>
                  <p className="text-2xl font-bold text-[#1F2937] mt-1 flex items-center gap-1">
                    <Star className="w-5 h-5 text-[#FBBF24] fill-[#FBBF24]" />
                    {(courses.filter((c) => c.rating).reduce((acc, c) => acc + (c.rating || 0), 0) / courses.filter((c) => c.rating).length).toFixed(1)}
                  </p>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 mb-6">
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                    <input
                      type="text"
                      placeholder={t("coursesPage.searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                    />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      <option value="all">{t("coursesPage.filters.allStatus")}</option>
                      <option value="active">{t("coursesPage.filters.active")}</option>
                      <option value="draft">{t("coursesPage.filters.draft")}</option>
                      <option value="completed">{t("coursesPage.filters.completed")}</option>
                      <option value="archived">{t("coursesPage.filters.archived")}</option>
                    </select>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      <option value="all">{t("coursesPage.filters.allCategories")}</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Course Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredCourses.map((course) => (
                  <div
                    key={course.id}
                    className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className="relative h-36">
                      <Image
                        src={course.thumbnail}
                        alt={course.title}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute top-3 left-3 flex gap-2">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${getStatusBadge(course.status)}`}>
                          {t(`coursesPage.status.${course.status}`)}
                        </span>
                      </div>
                      <button className="absolute top-3 right-3 p-1.5 bg-white/90 rounded-lg text-[#6B7280] hover:bg-white transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-base font-semibold text-[#1F2937] line-clamp-1">
                          {course.title}
                        </h3>
                        {course.rating && (
                          <span className="flex items-center gap-1 text-xs text-[#6B7280]">
                            <Star className="w-3.5 h-3.5 text-[#FBBF24] fill-[#FBBF24]" />
                            {course.rating}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-[#6B7280] mb-3">{course.instructor}</p>

                      <div className="flex items-center gap-3 text-xs text-[#6B7280] mb-3">
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {course.enrolledStudents}/{course.capacity}
                        </span>
                        <span className="flex items-center gap-1">
                          {getDeliveryIcon(course.delivery)}
                          {t(`coursesPage.delivery.${course.delivery}`)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {course.completedSessions}/{course.totalSessions}
                        </span>
                      </div>

                      {course.completionRate !== null && (
                        <div className="mb-4">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-[#6B7280]">{t("coursesPage.completion")}</span>
                            <span className="font-medium text-[#1F2937]">{course.completionRate}%</span>
                          </div>
                          <div className="h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#22C55E] rounded-full transition-all"
                              style={{ width: `${course.completionRate}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Link
                          href={`/${locale}/course-manager-dashboard/courses/${course.id}`}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 btn-gold text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          {t("coursesPage.manage")}
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                        <button className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] transition-colors">
                          <BarChart3 className="w-4 h-4" />
                        </button>
                        <button className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] transition-colors">
                          <Settings className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filteredCourses.length === 0 && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
                  <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-8 h-8 text-[#9CA3AF]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#1F2937] mb-2">
                    {t("coursesPage.noCourses")}
                  </h3>
                  <p className="text-sm text-[#6B7280] mb-4">
                    {t("coursesPage.noCoursesDesc")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CoursesContent;
