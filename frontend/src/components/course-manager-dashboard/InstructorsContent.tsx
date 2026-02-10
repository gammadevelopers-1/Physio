"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import {
  Search,
  Plus,
  Star,
  BookOpen,
  Clock,
  MoreVertical,
  Mail,
  Phone,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  User,
} from "lucide-react";

interface Instructor {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  initials: string;
  specialization: string;
  assignedCourses: number;
  totalStudents: number;
  hoursPerWeek: number;
  loadPercentage: number;
  rating: number;
  status: "available" | "busy" | "overloaded" | "on_leave";
  certifications: string[];
}

const mockManager = {
  name: "Mohammed Al-Khalid",
  email: "m.alkhalid@physio.edu.sa",
  totalCourses: 12,
  totalInstructors: 6,
  nelcCompliance: 85,
  avatar: "/images/instructor-1.png",
};

const InstructorsContent = () => {
  const locale = useLocale();
  const t = useTranslations("courseManagerDashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const instructors: Instructor[] = [
    {
      id: "1",
      name: "Dr. Faisal Ahmed",
      email: "faisal.ahmed@physio.edu.sa",
      phone: "+966 50 123 4567",
      initials: "FA",
      specialization: "Emergency Care",
      assignedCourses: 3,
      totalStudents: 75,
      hoursPerWeek: 12,
      loadPercentage: 85,
      rating: 4.8,
      status: "busy",
      certifications: ["ACLS", "BLS", "PALS"],
    },
    {
      id: "2",
      name: "Dr. Sara Al-Rashid",
      email: "sara.rashid@physio.edu.sa",
      phone: "+966 50 234 5678",
      initials: "SA",
      specialization: "First Aid & Safety",
      assignedCourses: 2,
      totalStudents: 50,
      hoursPerWeek: 8,
      loadPercentage: 50,
      rating: 4.5,
      status: "available",
      certifications: ["First Aid", "CPR"],
    },
    {
      id: "3",
      name: "Dr. Khalid Hassan",
      email: "khalid.hassan@physio.edu.sa",
      phone: "+966 50 345 6789",
      initials: "KH",
      specialization: "CPR & Life Support",
      assignedCourses: 4,
      totalStudents: 100,
      hoursPerWeek: 16,
      loadPercentage: 95,
      rating: 4.7,
      status: "overloaded",
      certifications: ["CPR", "AED", "ACLS"],
    },
    {
      id: "4",
      name: "Dr. Fatima Noor",
      email: "fatima.noor@physio.edu.sa",
      phone: "+966 50 456 7890",
      initials: "FN",
      specialization: "Healthcare Management",
      assignedCourses: 2,
      totalStudents: 40,
      hoursPerWeek: 6,
      loadPercentage: 35,
      rating: 4.9,
      status: "available",
      certifications: ["Healthcare Admin", "Patient Safety"],
    },
    {
      id: "5",
      name: "Dr. Ahmed Youssef",
      email: "ahmed.youssef@physio.edu.sa",
      phone: "+966 50 567 8901",
      initials: "AY",
      specialization: "Infection Control",
      assignedCourses: 1,
      totalStudents: 28,
      hoursPerWeek: 4,
      loadPercentage: 25,
      rating: 4.3,
      status: "on_leave",
      certifications: ["Infection Control", "OSHA"],
    },
  ];

  const filteredInstructors = instructors.filter((instructor) => {
    const matchesSearch =
      instructor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      instructor.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || instructor.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
      available: { bg: "bg-[#DCFCE7]", text: "text-[#22C55E]", icon: <CheckCircle className="w-3.5 h-3.5" /> },
      busy: { bg: "bg-[#FEF3C7]", text: "text-[#D4A520]", icon: <Clock className="w-3.5 h-3.5" /> },
      overloaded: { bg: "bg-[#FEE2E2]", text: "text-[#EF4444]", icon: <AlertTriangle className="w-3.5 h-3.5" /> },
      on_leave: { bg: "bg-[#F3F4F6]", text: "text-[#6B7280]", icon: <User className="w-3.5 h-3.5" /> },
    };
    return styles[status] || styles.available;
  };

  const getLoadColor = (percentage: number) => {
    if (percentage >= 90) return "bg-[#EF4444]";
    if (percentage >= 70) return "bg-[#F59E0B]";
    return "bg-[#22C55E]";
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
                    {t("instructorsPage.title")}
                  </h1>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {t("instructorsPage.subtitle")}
                  </p>
                </div>
                <button className="inline-flex items-center gap-2 px-4 py-2.5 btn-gold text-white text-sm font-medium rounded-lg transition-colors">
                  <Plus className="w-4 h-4" />
                  {t("instructorsPage.addInstructor")}
                </button>
              </div>

              {/* Stats Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">{t("instructorsPage.stats.total")}</p>
                  <p className="text-2xl font-bold text-[#1F2937] mt-1">{instructors.length}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">{t("instructorsPage.stats.available")}</p>
                  <p className="text-2xl font-bold text-[#22C55E] mt-1">
                    {instructors.filter((i) => i.status === "available").length}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">{t("instructorsPage.stats.overloaded")}</p>
                  <p className="text-2xl font-bold text-[#EF4444] mt-1">
                    {instructors.filter((i) => i.status === "overloaded").length}
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">{t("instructorsPage.stats.avgRating")}</p>
                  <p className="text-2xl font-bold text-[#1F2937] mt-1 flex items-center gap-1">
                    <Star className="w-5 h-5 text-[#FBBF24] fill-[#FBBF24]" />
                    {(instructors.reduce((acc, i) => acc + i.rating, 0) / instructors.length).toFixed(1)}
                  </p>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 mb-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                    <input
                      type="text"
                      placeholder={t("instructorsPage.searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#374151] bg-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                  >
                    <option value="all">{t("instructorsPage.filters.allStatus")}</option>
                    <option value="available">{t("instructorsPage.filters.available")}</option>
                    <option value="busy">{t("instructorsPage.filters.busy")}</option>
                    <option value="overloaded">{t("instructorsPage.filters.overloaded")}</option>
                    <option value="on_leave">{t("instructorsPage.filters.onLeave")}</option>
                  </select>
                </div>
              </div>

              {/* Instructors Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredInstructors.map((instructor) => {
                  const statusStyle = getStatusBadge(instructor.status);
                  return (
                    <div
                      key={instructor.id}
                      className="bg-white rounded-xl border border-[#E5E7EB] p-5 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-[#EFF6FF] rounded-full flex items-center justify-center">
                            <span className="text-sm font-semibold text-[#3B82F6]">
                              {instructor.initials}
                            </span>
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-[#1F2937]">
                              {instructor.name}
                            </h3>
                            <p className="text-xs text-[#6B7280]">{instructor.specialization}</p>
                          </div>
                        </div>
                        <button className="p-1.5 hover:bg-[#F3F4F6] rounded-lg transition-colors">
                          <MoreVertical className="w-4 h-4 text-[#6B7280]" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mb-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                          {statusStyle.icon}
                          {t(`instructorsPage.status.${instructor.status}`)}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-[#6B7280]">
                          <Star className="w-3.5 h-3.5 text-[#FBBF24] fill-[#FBBF24]" />
                          {instructor.rating}
                        </span>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                        <div className="bg-[#F9FAFB] rounded-lg p-2">
                          <p className="text-lg font-bold text-[#1F2937]">{instructor.assignedCourses}</p>
                          <p className="text-[10px] text-[#6B7280]">{t("instructorsPage.courses")}</p>
                        </div>
                        <div className="bg-[#F9FAFB] rounded-lg p-2">
                          <p className="text-lg font-bold text-[#1F2937]">{instructor.totalStudents}</p>
                          <p className="text-[10px] text-[#6B7280]">{t("instructorsPage.students")}</p>
                        </div>
                        <div className="bg-[#F9FAFB] rounded-lg p-2">
                          <p className="text-lg font-bold text-[#1F2937]">{instructor.hoursPerWeek}h</p>
                          <p className="text-[10px] text-[#6B7280]">{t("instructorsPage.weekly")}</p>
                        </div>
                      </div>

                      {/* Workload */}
                      <div className="mb-4">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[#6B7280]">{t("instructorsPage.workload")}</span>
                          <span className="font-medium text-[#1F2937]">{instructor.loadPercentage}%</span>
                        </div>
                        <div className="h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getLoadColor(instructor.loadPercentage)} rounded-full transition-all`}
                            style={{ width: `${instructor.loadPercentage}%` }}
                          />
                        </div>
                      </div>

                      {/* Contact & Actions */}
                      <div className="flex items-center justify-between pt-3 border-t border-[#E5E7EB]">
                        <div className="flex gap-2">
                          <button className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] transition-colors">
                            <Mail className="w-4 h-4" />
                          </button>
                          <button className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] transition-colors">
                            <Phone className="w-4 h-4" />
                          </button>
                        </div>
                        <button className="inline-flex items-center gap-1 text-sm font-medium text-[#3B82F6] hover:underline">
                          {t("instructorsPage.viewProfile")}
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredInstructors.length === 0 && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
                  <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mx-auto mb-4">
                    <User className="w-8 h-8 text-[#9CA3AF]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#1F2937] mb-2">
                    {t("instructorsPage.noInstructors")}
                  </h3>
                  <p className="text-sm text-[#6B7280]">
                    {t("instructorsPage.noInstructorsDesc")}
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

export default InstructorsContent;
