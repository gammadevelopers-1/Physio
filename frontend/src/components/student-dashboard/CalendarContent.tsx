"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import StudentDashboardError from "./StudentDashboardError";
import OfflineBanner from "./OfflineBanner";
import CalendarGrid from "./CalendarGrid";
import EventDetailPanel from "./EventDetailPanel";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { useStudentCalendar } from "@/hooks/useStudentCalendar";

function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const CalendarContent = () => {
  const t = useTranslations("studentDashboard");
  const userData = useStudentProfile();

  // Month navigation state
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    () => new Date()
  );

  // Compute from/to spanning the visible 6-week grid
  const calendarParams = useMemo(() => {
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
  }, [currentMonth]);

  const { data: events, loading, error, refetch } = useStudentCalendar(calendarParams);

  // Filter events for selected date
  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = toLocalDateKey(selectedDate);
    return events.filter((e) => {
      const eventLocal = new Date(e.date);
      return toLocalDateKey(eventLocal) === dateStr;
    });
  }, [events, selectedDate]);

  const handlePrevMonth = () => {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
    setSelectedDate(null);
  };

  const handleNextMonth = () => {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
    setSelectedDate(null);
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(now);
  };

  return (
    <>
      <DashboardNavbar user={userData} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <DashboardSidebar user={userData} />
            </div>

            <MobileSidebar user={userData} />

            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937] mb-4 sm:mb-6">
                {t("calendarPage.title")}
              </h1>

              <OfflineBanner />

              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 sm:p-6">
                {loading ? (
                  <div className="space-y-4 py-4">
                    <div className="flex justify-between items-center">
                      <div className="bg-[#E5E7EB] rounded animate-pulse h-6 w-32" />
                      <div className="bg-[#E5E7EB] rounded animate-pulse h-8 w-20" />
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                      {Array.from({ length: 35 }).map((_, i) => (
                        <div key={i} className="bg-[#E5E7EB] rounded animate-pulse h-12" />
                      ))}
                    </div>
                  </div>
                ) : error ? (
                  <StudentDashboardError message={error} onRetry={refetch} />
                ) : (
                  <>
                    <CalendarGrid
                      currentMonth={currentMonth}
                      events={events}
                      selectedDate={selectedDate}
                      onSelectDate={setSelectedDate}
                      onPrevMonth={handlePrevMonth}
                      onNextMonth={handleNextMonth}
                      onToday={handleToday}
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

export default CalendarContent;
