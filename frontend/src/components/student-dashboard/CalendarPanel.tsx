"use client";

import { useLocale, useTranslations } from "next-intl";
import { Calendar, Video, MapPin, Download } from "lucide-react";
import type { CalendarEvent } from "@/types/student-dashboard";
import {
  getDeliveryIcon,
  isJoinable,
  downloadIcs,
} from "@/lib/calendar-utils";

interface CalendarPanelProps {
  events: CalendarEvent[];
}

const CalendarPanel = ({ events }: CalendarPanelProps) => {
  const t = useTranslations("studentDashboard");
  const locale = useLocale();

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const timeFormatter = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] mt-4">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
          {t("calendar.title")}
        </h2>

        {events.length === 0 ? (
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
          <div className="space-y-3">
            {events.map((event) => {
              const eventDate = new Date(event.date);
              const { Icon: DeliveryIcon, color: iconColor } =
                getDeliveryIcon(event.sessionType);
              const joinable = isJoinable(event.date);
              const isZoom =
                event.sessionType === "zoom" ||
                event.sessionType === "blended" ||
                event.sessionType === "hybrid";

              return (
                <div
                  key={event.id}
                  className="p-3 border border-[#E5E7EB] rounded-lg"
                >
                  {/* Date/Time + Delivery Icon */}
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <DeliveryIcon className={`w-3.5 h-3.5 ${iconColor}`} />
                    <span className="text-xs text-[#6B7280]">
                      {dateFormatter.format(eventDate)} &middot;{" "}
                      {timeFormatter.format(eventDate)}
                    </span>
                  </div>

                  {/* Title */}
                  <h4 className="text-sm font-semibold text-[#1F2937] line-clamp-1">
                    {event.title}
                  </h4>

                  {/* Course + Instructor */}
                  <p className="text-xs text-[#6B7280] mt-0.5 line-clamp-1">
                    {event.courseTitle}
                    {event.instructorName &&
                      ` · ${event.instructorName}`}
                  </p>

                  {/* Duration */}
                  <p className="text-[10px] text-[#9CA3AF] mt-1">
                    {event.durationMinutes} {t("calendar.mins")}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-2">
                    {/* Join Button — time-gated */}
                    {isZoom && event.zoomLink && (
                      <a
                        href={joinable ? event.zoomLink : "#"}
                        target={joinable ? "_blank" : undefined}
                        rel="noopener noreferrer"
                        onClick={
                          joinable ? undefined : (e) => e.preventDefault()
                        }
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          joinable
                            ? "bg-[#2D8CFF] text-white hover:bg-[#1A73E8]"
                            : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        }`}
                      >
                        <Video className="w-3 h-3" />
                        {joinable ? t("calendar.joinNow") : t("calendar.zoom")}
                      </a>
                    )}

                    {/* Venue indicator for onsite */}
                    {event.sessionType === "onsite" && event.venueAddress && (
                      <span className="text-[10px] text-[#6B7280] flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {event.roomName || event.venueAddress}
                      </span>
                    )}

                    {/* Add to Calendar (.ics) */}
                    <button
                      onClick={() => downloadIcs(event)}
                      className="flex items-center gap-1 px-2 py-1.5 text-xs text-[#6B7280] hover:text-[#1F2937] hover:bg-[#F3F4F6] rounded-lg transition-colors ml-auto"
                      title={t("calendar.addToCalendar")}
                    >
                      <Download className="w-3 h-3" />
                      <span className="hidden sm:inline">
                        {t("calendar.addToCalendar")}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarPanel;
