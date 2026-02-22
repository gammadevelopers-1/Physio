"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import { useManagerProfile } from "@/hooks/useManagerProfile";
import { courseManagerApi } from "@/lib/api";
import InstructorDetailPanel from "./InstructorDetailPanel";
import {
  Search,
  Mail,
  User,
  Loader2,
  AlertTriangle,
  RefreshCw,
  BookOpen,
  Users,
  Clock,
  X,
  Check,
  ChevronRight,
} from "lucide-react";

interface RosterInstructor {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  coursesCount: number;
  studentsCount: number;
  sessionsThisWeek: number;
  hoursThisWeek: number;
  status: "available" | "busy" | "overloaded";
}

interface CourseOption {
  id: string;
  title: string;
}

const STATUS_CONFIG = {
  available: { bg: "bg-[#D1FAE5]", text: "text-[#065F46]", bar: "bg-[#22C55E]" },
  busy: { bg: "bg-[#FEF3C7]", text: "text-[#92400E]", bar: "bg-[#F59E0B]" },
  overloaded: { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]", bar: "bg-[#EF4444]" },
};

const InstructorsContent = () => {
  const t = useTranslations("courseManagerDashboard");
  const manager = useManagerProfile();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "busy" | "overloaded">("all");
  const [instructors, setInstructors] = useState<RosterInstructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail panel state
  const [detailInstructorId, setDetailInstructorId] = useState<string | null>(null);

  // Assignment modal state
  const [assignModal, setAssignModal] = useState<{ instructorId: string; instructorName: string } | null>(null);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState(false);

  const fetchRoster = () => {
    setLoading(true);
    setError(null);
    courseManagerApi
      .getInstructorRoster()
      .then((data) => setInstructors(data))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load instructors")
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRoster();
  }, []);

  // Fetch courses when assignment modal opens
  useEffect(() => {
    if (assignModal) {
      courseManagerApi.getCourses({ limit: 100 }).then((res) => {
        setCourses(
          (res.data || []).map((c: { id: string; title: string }) => ({
            id: c.id,
            title: c.title,
          }))
        );
      }).catch(() => {});
    }
  }, [assignModal]);

  const filtered = useMemo(() => {
    let result = instructors;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((inst) => {
        const name = [inst.firstName, inst.lastName].filter(Boolean).join(" ").toLowerCase();
        return name.includes(q) || inst.email.toLowerCase().includes(q);
      });
    }
    if (statusFilter !== "all") {
      result = result.filter((inst) => inst.status === statusFilter);
    }
    return result;
  }, [instructors, searchQuery, statusFilter]);

  const stats = useMemo(() => ({
    total: instructors.length,
    available: instructors.filter((i) => i.status === "available").length,
    busy: instructors.filter((i) => i.status === "busy").length,
    overloaded: instructors.filter((i) => i.status === "overloaded").length,
  }), [instructors]);

  const getInitials = (inst: RosterInstructor) => {
    if (inst.firstName && inst.lastName) {
      return `${inst.firstName[0]}${inst.lastName[0]}`.toUpperCase();
    }
    return inst.email.substring(0, 2).toUpperCase();
  };

  const getName = (inst: RosterInstructor) => {
    return [inst.firstName, inst.lastName].filter(Boolean).join(" ") || inst.email;
  };

  const handleAssign = async () => {
    if (!assignModal || !selectedCourseId) return;
    setAssigning(true);
    try {
      await courseManagerApi.assignInstructor(selectedCourseId, assignModal.instructorId);
      setAssignSuccess(true);
      setTimeout(() => {
        setAssignModal(null);
        setSelectedCourseId("");
        setAssignSuccess(false);
        fetchRoster();
      }, 1500);
    } catch {
      setAssigning(false);
    }
  };

  // Max hours for load bar scale (cap at 20h)
  const maxHours = 20;

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
                  <h1 className="text-2xl font-bold text-[#1F2937]">{t("instructorsPage.title")}</h1>
                  <p className="text-sm text-[#6B7280] mt-1">{t("instructorsPage.subtitle")}</p>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">{t("instructorsPage.stats.total")}</p>
                  <p className="text-2xl font-bold text-[#1F2937] mt-1">{stats.total}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">{t("instructorsPage.stats.available")}</p>
                  <p className="text-2xl font-bold text-[#22C55E] mt-1">{stats.available}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">{t("instructorsPage.filters.busy")}</p>
                  <p className="text-2xl font-bold text-[#F59E0B] mt-1">{stats.busy}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-xs text-[#6B7280]">{t("instructorsPage.stats.overloaded")}</p>
                  <p className="text-2xl font-bold text-[#EF4444] mt-1">{stats.overloaded}</p>
                </div>
              </div>

              {/* Search + Filter */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                  <input
                    type="text"
                    placeholder={t("instructorsPage.searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                  className="px-4 py-2.5 bg-white border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none"
                >
                  <option value="all">{t("instructorsPage.filters.allStatus")}</option>
                  <option value="available">{t("instructorsPage.filters.available")}</option>
                  <option value="busy">{t("instructorsPage.filters.busy")}</option>
                  <option value="overloaded">{t("instructorsPage.filters.overloaded")}</option>
                </select>
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
                  <button onClick={fetchRoster} className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-white text-sm font-medium rounded-lg">
                    <RefreshCw className="w-4 h-4" />{t("dashboard.retry")}
                  </button>
                </div>
              )}

              {!loading && !error && filtered.length === 0 && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center">
                  <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mx-auto mb-4">
                    <User className="w-8 h-8 text-[#9CA3AF]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#1F2937] mb-2">{t("instructorsPage.noInstructors")}</h3>
                  <p className="text-sm text-[#6B7280]">{t("instructorsPage.noInstructorsDesc")}</p>
                </div>
              )}

              {!loading && !error && filtered.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filtered.map((instructor) => {
                    const config = STATUS_CONFIG[instructor.status];
                    const loadPercent = Math.min((instructor.hoursThisWeek / maxHours) * 100, 100);

                    return (
                      <div key={instructor.id} className="bg-white rounded-xl border border-[#E5E7EB] p-5 hover:shadow-md transition-shadow">
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 bg-[#EFF6FF] rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-semibold text-[#3B82F6]">{getInitials(instructor)}</span>
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-[#1F2937] truncate">{getName(instructor)}</h3>
                            <p className="text-xs text-[#6B7280] truncate">{instructor.email}</p>
                          </div>
                          <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold ${config.bg} ${config.text} flex-shrink-0`}>
                            {t(`instructorsPage.status.${instructor.status}`)}
                          </span>
                        </div>

                        {/* Metrics */}
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1 text-[#6B7280] mb-1">
                              <BookOpen className="w-3.5 h-3.5" />
                            </div>
                            <p className="text-lg font-bold text-[#1F2937]">{instructor.coursesCount}</p>
                            <p className="text-[10px] text-[#6B7280]">{t("instructorsPage.courses")}</p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1 text-[#6B7280] mb-1">
                              <Users className="w-3.5 h-3.5" />
                            </div>
                            <p className="text-lg font-bold text-[#1F2937]">{instructor.studentsCount}</p>
                            <p className="text-[10px] text-[#6B7280]">{t("instructorsPage.students")}</p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1 text-[#6B7280] mb-1">
                              <Clock className="w-3.5 h-3.5" />
                            </div>
                            <p className="text-lg font-bold text-[#1F2937]">{instructor.sessionsThisWeek}</p>
                            <p className="text-[10px] text-[#6B7280]">{t("instructorsPage.weekly")}</p>
                          </div>
                        </div>

                        {/* Load Bar */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-[#6B7280]">{t("instructorsPage.workload")}</span>
                            <span className={`font-medium ${config.text}`}>{instructor.hoursThisWeek}h / {maxHours}h</span>
                          </div>
                          <div className="h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${config.bar}`}
                              style={{ width: `${loadPercent}%` }}
                            />
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-3 border-t border-[#E5E7EB]">
                          <div className="flex items-center gap-2">
                            <button className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] transition-colors">
                              <Mail className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDetailInstructorId(instructor.id)}
                              className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-[#6B7280] hover:text-[#1F2937] transition-colors"
                            >
                              {t("instructorsPage.viewProfile")}
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          </div>
                          <button
                            onClick={() => {
                              setAssignModal({ instructorId: instructor.id, instructorName: getName(instructor) });
                              setSelectedCourseId("");
                              setAssignSuccess(false);
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-[#3B82F6] border border-[#3B82F6] rounded-lg hover:bg-[#EFF6FF] transition-colors"
                          >
                            Assign to Course
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Assignment Modal */}
      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#1F2937]">Assign Instructor</h3>
              <button onClick={() => setAssignModal(null)} className="p-1 hover:bg-[#F3F4F6] rounded-lg">
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>

            {assignSuccess ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-[#D1FAE5] rounded-full flex items-center justify-center mx-auto mb-3">
                  <Check className="w-6 h-6 text-[#22C55E]" />
                </div>
                <p className="text-sm font-medium text-[#1F2937]">Instructor assigned successfully!</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-[#6B7280] mb-4">
                  Assign <span className="font-medium text-[#1F2937]">{assignModal.instructorName}</span> to a course:
                </p>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-lg text-sm mb-4 focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent outline-none"
                >
                  <option value="">Select a course...</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setAssignModal(null)}
                    className="px-4 py-2 text-sm text-[#6B7280] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAssign}
                    disabled={!selectedCourseId || assigning}
                    className="px-4 py-2 text-sm font-medium text-white btn-gold rounded-lg disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {assigning && <Loader2 className="w-4 h-4 animate-spin" />}
                    Assign
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Detail Panel */}
      {detailInstructorId && (
        <InstructorDetailPanel
          instructorId={detailInstructorId}
          onClose={() => setDetailInstructorId(null)}
        />
      )}
    </>
  );
};

export default InstructorsContent;
