"use client";

import { useState, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { List, LayoutGrid } from "lucide-react";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import StudentDashboardError from "./StudentDashboardError";
import OfflineBanner from "./OfflineBanner";
import CalendarGrid from "./CalendarGrid";
import EventDetailPanel from "./EventDetailPanel";
import Select from "@/components/ui/Select";
import LecturesListView from "./widgets/LecturesListView";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { useStudentCalendar } from "@/hooks/useStudentCalendar";
import { useStudentCourses } from "@/hooks/useStudentCourses";
import { useCalendarPreference } from "@/contexts/CalendarContext";
import type { CalendarEvent } from "@/types/student-dashboard";

type ViewMode = "list" | "calendar";
type StatusFilter = "all" | "upcoming" | "completed" | "cancelled";

function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const LecturesContent = () => {
  const t = useTranslations("studentDashboard.lecturesPage");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const userData = useStudentProfile();
  const { calendarFormat, setCalendarFormat } = useCalendarPreference();

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("upcoming");
  const [courseFilter, setCourseFilter] = useState<string>("all");

  // Month navigation (calendar view only)
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => new Date());

  // For list view: fetch a wide window (last 60 days → next 90 days) so we have past + upcoming
  // For calendar view: fetch the visible 6-week grid
  const calendarParams = useMemo(() => {
    if (viewMode === "list") {
      const now = new Date();
      const from = new Date(now);
      from.setDate(from.getDate() - 60);
      const to = new Date(now);
      to.setDate(to.getDate() + 90);
      return {
        from: from.toISOString().split("T")[0],
        to: to.toISOString().split("T")[0],
      };
    }
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const gridStart = new Date(year, month, 1 - startOffset);
    const gridEnd = new Date(gridStart.getTime() + 42 * 24 * 60 * 60 * 1000);
    return {
      from: gridStart.toISOString().split("T")[0],
      to: gridEnd.toISOString().split("T")[0],
    };
  }, [viewMode, currentMonth]);

  const { data: events, loading, error, refetch } = useStudentCalendar(calendarParams);
  const { data: enrolledCourses } = useStudentCourses({ status: "active", limit: 50 });

  // Apply filters
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      // Course filter
      if (courseFilter !== "all" && e.courseId !== courseFilter) return false;

      // Status filter
      if (statusFilter === "all") return true;
      const eventTime = new Date(e.date).getTime();
      const now = Date.now();
      if (statusFilter === "upcoming") {
        return eventTime >= now - 60 * 60 * 1000 && e.status !== "cancelled";
      }
      if (statusFilter === "completed") {
        return eventTime < now && e.status !== "cancelled";
      }
      if (statusFilter === "cancelled") return e.status === "cancelled";
      return true;
    });
  }, [events, courseFilter, statusFilter]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = toLocalDateKey(selectedDate);
    return filteredEvents.filter((e) => toLocalDateKey(new Date(e.date)) === dateStr);
  }, [filteredEvents, selectedDate]);

  return (
    <>
      <DashboardNavbar user={userData} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <DashboardSidebar user={userData} />
            </div>
            <MobileSidebar user={userData} />

            <div className="flex-1 min-w-0 space-y-4">
              {/* Header */}
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                  {t("title")}
                </h1>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {t("subtitle")}
                </p>
              </div>

              <OfflineBanner />

              {/* Controls row: view switcher + filters + Hijri toggle */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-3 sm:p-4">
                <div className={`flex flex-col lg:flex-row lg:items-center gap-3 ${isRTL ? "lg:flex-row-reverse" : ""}`}>
                  {/* View switcher */}
                  <div className="inline-flex items-center bg-[var(--color-border-subtle)] rounded-lg p-1 self-start">
                    <button
                      type="button"
                      onClick={() => setViewMode("list")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        viewMode === "list"
                          ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                      {t("viewList")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("calendar")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        viewMode === "calendar"
                          ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      {t("viewCalendar")}
                    </button>
                  </div>

                  {/* Filters */}
                  <div className="flex flex-wrap items-center gap-2 flex-1">
                    <Select
                      value={statusFilter}
                      onChange={(v) => setStatusFilter(v as StatusFilter)}
                      size="sm"
                      className="min-w-[140px]"
                      options={[
                        { value: "all", label: t("filterAll") },
                        { value: "upcoming", label: t("filterUpcoming") },
                        { value: "completed", label: t("filterCompleted") },
                        { value: "cancelled", label: t("filterCancelled") },
                      ]}
                    />

                    <Select
                      value={courseFilter}
                      onChange={setCourseFilter}
                      size="sm"
                      className="min-w-[160px]"
                      options={[
                        { value: "all", label: t("allCourses") },
                        ...enrolledCourses.map((c) => ({
                          value: c.id,
                          label: isRTL && c.titleAr ? c.titleAr : c.title,
                        })),
                      ]}
                    />
                  </div>

                  {/* Hijri / Gregorian toggle (mirror inst/mng pattern, persists to account) */}
                  <div className={`inline-flex items-center bg-[var(--color-border-subtle)] rounded-lg p-1 self-start ${isRTL ? "" : "lg:ms-auto"}`}>
                    <button
                      type="button"
                      onClick={() => setCalendarFormat("gregorian")}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        calendarFormat === "gregorian"
                          ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                      }`}
                    >
                      {t("gregorian")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalendarFormat("hijri")}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        calendarFormat === "hijri"
                          ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                      }`}
                    >
                      {t("hijri")}
                    </button>
                  </div>
                </div>
              </div>

              {/* Content area */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6">
                {loading ? (
                  <ContentSkeleton viewMode={viewMode} />
                ) : error ? (
                  <StudentDashboardError message={error} onRetry={refetch} />
                ) : viewMode === "list" ? (
                  <LecturesListView events={filteredEvents} />
                ) : (
                  <>
                    <CalendarGrid
                      currentMonth={currentMonth}
                      events={filteredEvents}
                      selectedDate={selectedDate}
                      onSelectDate={setSelectedDate}
                      onPrevMonth={() => {
                        setCurrentMonth(
                          (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
                        );
                        setSelectedDate(null);
                      }}
                      onNextMonth={() => {
                        setCurrentMonth(
                          (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
                        );
                        setSelectedDate(null);
                      }}
                      onToday={() => {
                        const now = new Date();
                        setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                        setSelectedDate(now);
                      }}
                    />

                    <EventDetailPanel
                      selectedDate={selectedDate}
                      events={selectedDayEvents}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LecturesContent;

function ContentSkeleton({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === "calendar") {
    return (
      <div className="space-y-4 py-4">
        <div className="flex justify-between items-center">
          <div className="bg-[var(--color-border)] rounded animate-pulse h-6 w-40" />
          <div className="bg-[var(--color-border)] rounded animate-pulse h-8 w-20" />
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 42 }).map((_, i) => (
            <div key={i} className="bg-[var(--color-border)] rounded animate-pulse h-20" />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-[var(--color-border)] rounded-lg animate-pulse h-16" />
      ))}
    </div>
  );
}
