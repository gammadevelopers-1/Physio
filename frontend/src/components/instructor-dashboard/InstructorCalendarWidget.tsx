"use client";

import { useTranslations } from "next-intl";
import { Calendar, Video, MapPin } from "lucide-react";

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: string;
  enrolled: number;
  type: "zoom" | "onsite";
  zoomLink?: string;
}

interface InstructorCalendarWidgetProps {
  events: CalendarEvent[];
}

const InstructorCalendarWidget = ({
  events,
}: InstructorCalendarWidgetProps) => {
  const t = useTranslations("instructorDashboard");

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB]">
      <div className="p-4 sm:p-5">
        <h3 className="text-base font-semibold text-[#1F2937] mb-4">
          {t("calendar.title")}
        </h3>

        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-12 h-12 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-3">
              <Calendar className="w-6 h-6 text-[#9CA3AF]" />
            </div>
            <h4 className="text-sm font-medium text-[#1F2937] mb-1">
              {t("calendar.noEventsTitle")}
            </h4>
            <p className="text-xs text-[#6B7280] text-center max-w-[200px]">
              {t("calendar.noEventsDescription")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div
                key={event.id}
                className="p-3.5 border border-[#E5E7EB] rounded-xl"
              >
                {/* Date and Time */}
                <p className="text-[13px] text-[#6B7280] mb-1">
                  {event.date} - {event.time}
                </p>

                {/* Event Title */}
                <h4 className="text-[15px] font-semibold text-[#1F2937] mb-1">
                  {event.title}
                </h4>

                {/* Enrolled Count */}
                <p className="text-[13px] text-[#6B7280] mb-2">
                  {event.enrolled} {t("calendar.studentsEnrolled")}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#6B7280]">
                    {event.duration}
                  </span>
                  {event.type === "zoom" && event.zoomLink ? (
                    <a
                      href={event.zoomLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#3B82F6] text-white text-[13px] font-medium rounded-lg hover:bg-[#2563EB] transition-colors"
                    >
                      <Video className="w-3.5 h-3.5" />
                      {t("calendar.zoom")}
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[#22C55E]">
                      <MapPin className="w-3.5 h-3.5" />
                      {t("calendar.onsite")}
                    </span>
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

export default InstructorCalendarWidget;
