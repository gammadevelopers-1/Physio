"use client";

import { useTranslations } from "next-intl";
import { Calendar, Video } from "lucide-react";

interface CalendarEvent {
  id: string;
  title: string;
  instructor: string;
  date: string;
  time: string;
  duration: string;
  zoomLink?: string;
}

interface CalendarPanelProps {
  events: CalendarEvent[];
}

const CalendarPanel = ({ events }: CalendarPanelProps) => {
  const t = useTranslations("studentDashboard");

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] mt-4">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
          {t("calendar.title")}
        </h2>

        {events.length === 0 ? (
          // Empty State
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-12 h-12 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-3">
              <Calendar className="w-6 h-6 text-[#9CA3AF]" />
            </div>
            <h3 className="text-sm font-medium text-[#1F2937] mb-1">
              {t("calendar.noEventsTitle")}
            </h3>
            <p className="text-xs text-[#6B7280] text-center max-w-[200px]">
              {t("calendar.noEventsDescription")}
            </p>
          </div>
        ) : (
          // Events List
          <div className="space-y-4">
            {events.map((event) => (
              <div
                key={event.id}
                className="p-4 border border-[#E5E7EB] rounded-lg"
              >
                {/* Date and Time */}
                <p className="text-xs text-[#6B7280] mb-1">
                  {event.date} - {event.time}
                </p>

                {/* Event Title */}
                <h4 className="text-sm font-semibold text-[#1F2937]">
                  {event.title}
                </h4>

                {/* Instructor */}
                <p className="text-xs text-[#6B7280] mt-1">{event.instructor}</p>

                {/* Duration and Zoom Button */}
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-[#6B7280]">{event.duration}</span>
                  {event.zoomLink && (
                    <a
                      href={event.zoomLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2D8CFF] text-white text-xs font-medium rounded-lg hover:bg-[#1A73E8] transition-colors"
                    >
                      <Video className="w-3.5 h-3.5" />
                      {t("calendar.zoom")}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarPanel;
