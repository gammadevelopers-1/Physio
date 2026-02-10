"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ChevronLeft, ChevronRight, Plus, Video, MapPin, AlertTriangle, Calendar } from "lucide-react";

interface Session {
  id: string;
  title: string;
  time: string;
  date: string;
  type: "zoom" | "onsite";
  location?: string;
  enrolled: number;
  capacity: number;
  hasConflict?: boolean;
}

interface CalendarDay {
  day: number;
  hasSession?: boolean;
  hasConflict?: boolean;
  isToday?: boolean;
}

interface SchedulesSessionsWidgetProps {
  sessions: Session[];
  calendarDays: CalendarDay[];
  currentMonth: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

const SchedulesSessionsWidget = ({
  sessions,
  calendarDays,
  currentMonth,
  onPrevMonth,
  onNextMonth,
}: SchedulesSessionsWidgetProps) => {
  const t = useTranslations("courseManagerDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const weekDays = [
    t("calendar.sun"),
    t("calendar.mon"),
    t("calendar.tue"),
    t("calendar.wed"),
    t("calendar.thu"),
    t("calendar.fri"),
    t("calendar.sat"),
  ];

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#FEF3C7] rounded-lg flex items-center justify-center">
            <Calendar className="w-4 h-4 text-[#D4A520]" />
          </div>
          <h3 className="text-base font-semibold text-[#1F2937]">
            {t("schedules.title")}
          </h3>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3B82F6] text-white text-sm font-medium rounded-lg hover:bg-[#2563EB] transition-colors">
          <Plus className="w-4 h-4" />
          {t("schedules.schedule")}
        </button>
      </div>

      <div className="p-6">
        {/* Mini Calendar */}
        <div className="mb-6">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-[15px] font-semibold text-[#1F2937]">{currentMonth}</span>
            <div className="flex gap-1">
              <button
                onClick={onPrevMonth}
                className="w-7 h-7 flex items-center justify-center border border-[#E5E7EB] rounded-md hover:bg-[#F3F4F6] transition-colors"
              >
                <ChevronLeft className={`w-4 h-4 text-[#4B5563] ${isRTL ? "rotate-180" : ""}`} />
              </button>
              <button
                onClick={onNextMonth}
                className="w-7 h-7 flex items-center justify-center border border-[#E5E7EB] rounded-md hover:bg-[#F3F4F6] transition-colors"
              >
                <ChevronRight className={`w-4 h-4 text-[#4B5563] ${isRTL ? "rotate-180" : ""}`} />
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {/* Week Day Names */}
            {weekDays.map((day) => (
              <div key={day} className="py-2 text-[11px] font-medium text-[#6B7280]">
                {day}
              </div>
            ))}
            {/* Days */}
            {calendarDays.map((day, index) => (
              <div
                key={index}
                className={`relative py-2 text-[13px] rounded-md cursor-pointer transition-colors ${
                  day.isToday
                    ? "bg-[#3B82F6] text-white font-semibold"
                    : "text-[#374151] hover:bg-[#F3F4F6]"
                }`}
              >
                {day.day > 0 ? day.day : ""}
                {day.hasSession && day.day > 0 && (
                  <span
                    className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${
                      day.hasConflict
                        ? "bg-[#EF4444]"
                        : day.isToday
                          ? "bg-white"
                          : "bg-[#3B82F6]"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Sessions */}
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`flex items-center gap-3 p-3 rounded-xl ${
                session.hasConflict
                  ? "bg-[#FEE2E2] border-l-3 border-[#EF4444]"
                  : session.type === "onsite"
                    ? "bg-[#F9FAFB] border-l-3 border-[#22C55E]"
                    : "bg-[#F9FAFB] border-l-3 border-[#3B82F6]"
              }`}
              style={{ borderLeftWidth: "3px" }}
            >
              <div className="min-w-[55px]">
                <p className="text-xs font-semibold text-[#374151]">{session.time}</p>
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-medium text-[#1F2937]">{session.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  {session.hasConflict ? (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-[#EF4444]">
                      <AlertTriangle className="w-3 h-3" />
                      {t("schedules.conflict")}
                    </span>
                  ) : (
                    <>
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded ${
                          session.type === "zoom"
                            ? "bg-[#DBEAFE] text-[#3B82F6]"
                            : "bg-[#DCFCE7] text-[#22C55E]"
                        }`}
                      >
                        {session.type === "zoom" ? (
                          <Video className="w-3 h-3" />
                        ) : (
                          <MapPin className="w-3 h-3" />
                        )}
                        {session.type === "zoom" ? t("schedules.zoom") : t("schedules.onsite")}
                      </span>
                      <span className="text-[11px] text-[#6B7280]">
                        {session.location || `${session.enrolled}/${session.capacity}`}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SchedulesSessionsWidget;
