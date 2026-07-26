"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatDate as formatDateHijri } from "@/lib/hijri";
import { useCalendarPreference } from "@/contexts/CalendarContext";
import { usePlatformLocale } from "@/contexts/PlatformLocaleContext";
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
  Star,
  Calendar,
} from "lucide-react";
import SkeletonCard from "@/components/shared/SkeletonCard";
import ExportButton from "@/components/shared/ExportButton";
import Select from "@/components/admin-dashboard/Select";

interface RosterInstructor {
  id: string;
  firstName: string | null;
  lastName: string | null;
  firstNameAr?: string | null;
  lastNameAr?: string | null;
  email: string;
  avatar: string | null;
  department: string | null;
  specialty: string | null;
  avgRating: number | null;
  completionRate: number | null;
  coursesCount: number;
  studentsCount: number;
  sessionsThisWeek: number;
  hoursThisWeek: number;
  status: "available" | "busy" | "overloaded" | "on_leave";
  isMyInstructor?: boolean;
}

interface CourseOption {
  id: string;
  title: string;
}

interface ScheduleSession {
  id: string;
  title: string;
  courseTitle: string;
  type: string;
  scheduledAt: string | null;
  durationMinutes: number;
  status: string;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; bar: string }> = {
  available: { bg: "bg-[#D1FAE5]", text: "text-[#065F46]", bar: "bg-[#22C55E]" },
  busy: { bg: "bg-[#FEF3C7]", text: "text-[#92400E]", bar: "bg-[#F59E0B]" },
  overloaded: { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]", bar: "bg-[#EF4444]" },
  on_leave: { bg: "bg-[var(--color-border-subtle)]", text: "text-[#3730A3]", bar: "bg-[#6366F1]" },
};

const InstructorsContent = () => {
  const t = useTranslations("courseManagerDashboard");
  const locale = useLocale();
  const { calendarFormat } = useCalendarPreference();
  const platformLocale = usePlatformLocale();
  const isRTL = locale === "ar";
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
  const [schedule, setSchedule] = useState<ScheduleSession[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);

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

  // Fetch courses + schedule when assignment modal opens
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

      // Fetch instructor schedule
      setScheduleLoading(true);
      setSchedule([]);
      setSuggestion(null);
      courseManagerApi.getInstructorSchedule(assignModal.instructorId).then(setSchedule).catch(() => {}).finally(() => setScheduleLoading(false));

      // If overloaded, fetch suggestion
      const inst = instructors.find((i) => i.id === assignModal.instructorId);
      if (inst && (inst.status === "busy" || inst.status === "overloaded")) {
        courseManagerApi.getInstructorSuggestions().then((suggestions) => {
          const best = suggestions.find((s) => s.recommended && s.id !== assignModal.instructorId);
          if (best) {
            setSuggestion([best.firstName, best.lastName].filter(Boolean).join(" ") || best.email);
          }
        }).catch(() => {});
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (isRTL && (inst.firstNameAr || inst.lastNameAr)) {
      return [inst.firstNameAr, inst.lastNameAr].filter(Boolean).join(" ");
    }
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

  // Find least-loaded instructor for recommended badge
  const recommendedId = useMemo(() => {
    if (instructors.length === 0) return null;
    const sorted = [...instructors].sort((a, b) => a.hoursThisWeek - b.hoursThisWeek);
    return sorted[0]?.id || null;
  }, [instructors]);

  // Build 2-week schedule grid from sessions
  const scheduleGrid = useMemo(() => {
    if (schedule.length === 0) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days: { date: Date; label: string; sessions: ScheduleSession[] }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dayLabel = formatDateHijri(d, calendarFormat, { locale, platformSettings: platformLocale });
      const daySessions = schedule.filter((s) => {
        if (!s.scheduledAt) return false;
        const sd = new Date(s.scheduledAt);
        return sd.getFullYear() === d.getFullYear() && sd.getMonth() === d.getMonth() && sd.getDate() === d.getDate();
      });
      days.push({ date: d, label: dayLabel, sessions: daySessions });
    }
    return days;
  }, [schedule]);

  return (
    <>
      <CourseManagerNavbar manager={manager} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <CourseManagerSidebar manager={manager} />
            </div>
            <CourseManagerMobileSidebar manager={manager} />

            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{t("instructorsPage.title")}</h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">{t("instructorsPage.subtitle")}</p>
                </div>
                <ExportButton tableType="instructors" />
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                  <p className="text-xs text-[var(--color-text-secondary)]">{t("instructorsPage.stats.total")}</p>
                  <p className="text-2xl font-bold text-[var(--color-text-secondary)] mt-1">{stats.total}</p>
                </div>
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                  <p className="text-xs text-[var(--color-text-secondary)]">{t("instructorsPage.stats.available")}</p>
                  <p className="text-2xl font-bold text-[#22C55E] mt-1">{stats.available}</p>
                </div>
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                  <p className="text-xs text-[var(--color-text-secondary)]">{t("instructorsPage.filters.busy")}</p>
                  <p className="text-2xl font-bold text-[#F59E0B] mt-1">{stats.busy}</p>
                </div>
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                  <p className="text-xs text-[var(--color-text-secondary)]">{t("instructorsPage.stats.overloaded")}</p>
                  <p className="text-2xl font-bold text-[#EF4444] mt-1">{stats.overloaded}</p>
                </div>
              </div>

              {/* Search + Filter */}
              <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                  <Search className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]`} />
                  <input
                    type="text"
                    placeholder={t("instructorsPage.searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} py-2.5 bg-[var(--color-surface-card)] border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)] focus:border-transparent`}
                  />
                </div>
                <Select
                  value={statusFilter}
                  onChange={(v) => setStatusFilter(v as typeof statusFilter)}
                  options={[
                    { value: "all", label: t("instructorsPage.filters.allStatus") },
                    { value: "available", label: t("instructorsPage.filters.available") },
                    { value: "busy", label: t("instructorsPage.filters.busy") },
                    { value: "overloaded", label: t("instructorsPage.filters.overloaded") },
                  ]}
                  className="w-40"
                  size="sm"
                />
              </div>

              {loading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              )}

              {error && (
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-12 text-center">
                  <AlertTriangle className="w-8 h-8 text-[#EF4444] mx-auto mb-3" />
                  <p className="text-sm text-[var(--color-text-secondary)] mb-4">{error}</p>
                  <button onClick={fetchRoster} className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg">
                    <RefreshCw className="w-4 h-4" />{t("dashboard.retry")}
                  </button>
                </div>
              )}

              {!loading && !error && filtered.length === 0 && (
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-12 text-center">
                  <div className="w-16 h-16 bg-[var(--color-border-subtle)] rounded-full flex items-center justify-center mx-auto mb-4">
                    <User className="w-8 h-8 text-[var(--color-text-secondary)]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">{t("instructorsPage.noInstructors")}</h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">{t("instructorsPage.noInstructorsDesc")}</p>
                </div>
              )}

              {!loading && !error && filtered.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filtered.map((instructor) => {
                    const config = STATUS_CONFIG[instructor.status];
                    const loadPercent = Math.min((instructor.hoursThisWeek / maxHours) * 100, 100);

                    return (
                      <div key={instructor.id} className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5 hover:shadow-md transition-shadow flex flex-col h-full">
                        {/* Badges row */}
                        <div className="h-6 mb-2 flex items-center gap-2">
                          {instructor.isMyInstructor && (
                            <span className="inline-flex items-center px-2 py-0.5 bg-[var(--color-border-subtle)] text-[var(--color-primary)] text-[10px] font-semibold rounded-full">
                              {isRTL ? "مدربي" : "My Instructor"}
                            </span>
                          )}
                          {/* Recommended badge — disabled until feedback system is implemented */}
                        </div>

                        {/* Header */}
                        <div className="flex items-center gap-3 mb-4">
                          {instructor.avatar ? (
                            <img
                              src={instructor.avatar}
                              alt={getName(instructor)}
                              className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                              onError={(e) => {
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                target.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={`w-12 h-12 bg-[var(--color-border-subtle)] rounded-full flex items-center justify-center flex-shrink-0 ${instructor.avatar ? 'hidden' : ''}`}>
                            <span className="text-sm font-semibold text-[var(--color-primary)]">{getInitials(instructor)}</span>
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{getName(instructor)}</h3>
                            <p className="text-xs text-[var(--color-text-secondary)] truncate">{instructor.email}</p>
                            {(instructor.department || instructor.specialty) && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {instructor.department && <span className="px-1.5 py-0.5 bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] text-[9px] rounded">{instructor.department}</span>}
                                {instructor.specialty && <span className="px-1.5 py-0.5 bg-[var(--color-border-subtle)] text-[var(--color-primary)] text-[9px] rounded">{instructor.specialty}</span>}
                              </div>
                            )}
                          </div>
                          <span className={`ms-auto px-2 py-0.5 rounded-full text-[10px] font-semibold ${config.bg} ${config.text} flex-shrink-0`}>
                            {t(`instructorsPage.status.${instructor.status}`)}
                          </span>
                        </div>

                        {/* Metrics */}
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1 text-[var(--color-text-secondary)] mb-1">
                              <BookOpen className="w-3.5 h-3.5" />
                            </div>
                            <p className="text-lg font-bold text-[var(--color-text-secondary)]">{instructor.coursesCount}</p>
                            <p className="text-[10px] text-[var(--color-text-secondary)]">{t("instructorsPage.courses")}</p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1 text-[var(--color-text-secondary)] mb-1">
                              <Users className="w-3.5 h-3.5" />
                            </div>
                            <p className="text-lg font-bold text-[var(--color-text-secondary)]">{instructor.studentsCount}</p>
                            <p className="text-[10px] text-[var(--color-text-secondary)]">{t("instructorsPage.students")}</p>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-1 text-[var(--color-text-secondary)] mb-1">
                              <Star className="w-3.5 h-3.5" />
                            </div>
                            <p className="text-lg font-bold text-[var(--color-text-secondary)]">{instructor.avgRating?.toFixed(1) || "—"}</p>
                            <p className="text-[10px] text-[var(--color-text-secondary)]">{t("instructorsPage.rating")}</p>
                          </div>
                        </div>

                        {/* Load Bar */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-[var(--color-text-secondary)]">{t("instructorsPage.workload")}</span>
                            <span className={`font-medium ${config.text}`}>{instructor.hoursThisWeek}h / {maxHours}h</span>
                          </div>
                          <div className="h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${config.bar}`}
                              style={{ width: `${loadPercent}%` }}
                            />
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-center pt-3 border-t border-[var(--color-border)] mt-auto">
                          <button
                            onClick={() => setDetailInstructorId(instructor.id)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors"
                          >
                            {t("instructorsPage.viewProfile")}
                            <ChevronRight className={`w-3.5 h-3.5 ${isRTL ? "rotate-180" : ""}`} />
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
