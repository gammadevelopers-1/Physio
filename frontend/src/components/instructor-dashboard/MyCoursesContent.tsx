"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import InstructorNavbar from "./InstructorNavbar";
import InstructorSidebar from "./InstructorSidebar";
import InstructorMobileSidebar from "./InstructorMobileSidebar";
import { useInstructorProfile } from "@/hooks/useInstructorProfile";
import {
  Search,
  Filter,
  Plus,
  Users,
  Calendar,
  Clock,
  MoreVertical,
  Video,
  MapPin,
  BookOpen,
  ChevronRight,
  BarChart3,
  Settings,
} from "lucide-react";

interface Course {
  id: string;
  title: string;
  thumbnail: string;
  status: "active" | "draft" | "completed" | "archived";
  delivery: "zoom" | "onsite" | "blended";
  enrolledStudents: number;
  completionRate: number;
  nextSession?: string;
  totalSessions: number;
  completedSessions: number;
}

const MyCoursesContent = () => {
  const instructor = useInstructorProfile();
  const locale = useLocale();
  const t = useTranslations("instructorDashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deliveryFilter, setDeliveryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");

  // Mock courses data
  const courses: Course[] = [
    {
      id: "course-1",
      title: t("mockData.aclsTraining"),
      thumbnail: "/student_dashboard/courses/image 473.svg",
      status: "active",
      delivery: "zoom",
      enrolledStudents: 25,
      completionRate: 68,
      nextSession: "Today, 2:00 PM",
      totalSessions: 12,
      completedSessions: 8,
    },
    {
      id: "course-2",
      title: t("mockData.firstAidModule"),
      thumbnail: "/student_dashboard/courses/image 491.svg",
      status: "active",
      delivery: "onsite",
      enrolledStudents: 18,
      completionRate: 45,
      nextSession: "Tomorrow, 4:00 PM",
      totalSessions: 8,
      completedSessions: 4,
    },
    {
      id: "course-3",
      title: "CPR Certification",
      thumbnail: "/student_dashboard/courses/image 473.svg",
      status: "completed",
      delivery: "blended",
      enrolledStudents: 32,
      completionRate: 100,
      totalSessions: 6,
      completedSessions: 6,
    },
    {
      id: "course-4",
      title: "Infection Control Training",
      thumbnail: "/student_dashboard/courses/image 491.svg",
      status: "draft",
      delivery: "zoom",
      enrolledStudents: 0,
      completionRate: 0,
      totalSessions: 10,
      completedSessions: 0,
    },
  ];

  const filteredCourses = courses.filter((course) => {
    const matchesSearch = course.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || course.status === statusFilter;
    const matchesDelivery =
      deliveryFilter === "all" || course.delivery === deliveryFilter;
    return matchesSearch && matchesStatus && matchesDelivery;
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
      <InstructorNavbar instructor={instructor} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <InstructorSidebar instructor={instructor} />
            </div>
            <InstructorMobileSidebar instructor={instructor} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-[#1F2937]">
                    {t("courses.title")}
                  </h1>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {t("courses.subtitle")}
                  </p>
                </div>
                <button className="inline-flex items-center gap-2 px-4 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors">
                  <Plus className="w-4 h-4" />
                  {t("courses.createCourse")}
                </button>
              </div>

              {/* Filters */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 mb-6">
                <div className="flex flex-col lg:flex-row gap-4">
                  {/* Search */}
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                    <input
                      type="text"
                      placeholder={t("courses.searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                    />
                  </div>

                  {/* Filters */}
                  <div className="flex flex-wrap gap-3">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      <option value="all">{t("courses.filters.allStatus")}</option>
                      <option value="active">{t("courses.filters.active")}</option>
                      <option value="draft">{t("courses.filters.draft")}</option>
                      <option value="completed">{t("courses.filters.completed")}</option>
                      <option value="archived">{t("courses.filters.archived")}</option>
                    </select>

                    <select
                      value={deliveryFilter}
                      onChange={(e) => setDeliveryFilter(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      <option value="all">{t("courses.filters.allDelivery")}</option>
                      <option value="zoom">{t("courses.filters.zoom")}</option>
                      <option value="onsite">{t("courses.filters.onsite")}</option>
                      <option value="blended">{t("courses.filters.blended")}</option>
                    </select>

                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    >
                      <option value="newest">{t("courses.sort.newest")}</option>
                      <option value="oldest">{t("courses.sort.oldest")}</option>
                      <option value="students">{t("courses.sort.mostStudents")}</option>
                      <option value="alphabetical">{t("courses.sort.alphabetical")}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Course Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCourses.map((course) => (
                  <div
                    key={course.id}
                    className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden hover:shadow-md transition-shadow"
                  >
                    {/* Course Image */}
                    <div className="relative h-40">
                      <Image
                        src={course.thumbnail}
                        alt={course.title}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute top-3 left-3 flex gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-md text-xs font-medium ${getStatusBadge(course.status)}`}
                        >
                          {t(`courses.status.${course.status}`)}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/90 rounded-md text-xs font-medium text-[#374151]">
                          {getDeliveryIcon(course.delivery)}
                          {t(`courses.delivery.${course.delivery}`)}
                        </span>
                      </div>
                      <button className="absolute top-3 right-3 p-1.5 bg-white/90 rounded-lg text-[#6B7280] hover:bg-white transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Course Info */}
                    <div className="p-4">
                      <h3 className="text-base font-semibold text-[#1F2937] mb-2 line-clamp-1">
                        {course.title}
                      </h3>

                      {/* Stats Row */}
                      <div className="flex items-center gap-4 text-sm text-[#6B7280] mb-3">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {course.enrolledStudents} {t("courses.students")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {course.completedSessions}/{course.totalSessions} {t("courses.sessions")}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[#6B7280]">{t("courses.completion")}</span>
                          <span className="font-medium text-[#1F2937]">{course.completionRate}%</span>
                        </div>
                        <div className="h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#22C55E] rounded-full transition-all"
                            style={{ width: `${course.completionRate}%` }}
                          />
                        </div>
                      </div>

                      {/* Next Session */}
                      {course.nextSession && (
                        <div className="flex items-center gap-1.5 text-xs text-[#6B7280] mb-4">
                          <Clock className="w-3.5 h-3.5" />
                          {t("courses.nextSession")}: {course.nextSession}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Link
                          href={`/${locale}/dashboard/instructor/courses/${course.id}`}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 btn-gold text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          {t("courses.viewDetails")}
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

              {/* Empty State */}
              {filteredCourses.length === 0 && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
                  <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-8 h-8 text-[#9CA3AF]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#1F2937] mb-2">
                    {t("courses.noCoursesTitle")}
                  </h3>
                  <p className="text-sm text-[#6B7280] mb-4">
                    {t("courses.noCoursesDescription")}
                  </p>
                  <button className="inline-flex items-center gap-2 px-4 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors">
                    <Plus className="w-4 h-4" />
                    {t("courses.createCourse")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MyCoursesContent;
