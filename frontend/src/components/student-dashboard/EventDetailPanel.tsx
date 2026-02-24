"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Calendar,
  Clock,
  Download,
  ExternalLink,
  MapPin,
  User,
  Video,
} from "lucide-react";
import type { CalendarEvent } from "@/types/student-dashboard";
import {
  getDeliveryIcon,
  isJoinable,
  downloadIcs,
} from "@/lib/calendar-utils";

interface EventDetailPanelProps {
  selectedDate: Date | null;
  events: CalendarEvent[];
}

const EventDetailPanel = ({ selectedDate, events }: EventDetailPanelProps) => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";

  const dateLabel = useMemo(() => {
    if (!selectedDate) return "";
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(selectedDate);
  }, [selectedDate, locale]);

  const timeWithTimezone = useMemo(() => {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "long",
    });
  }, [locale]);

  if (!selectedDate) {
    return (
      <div className="mt-6 pt-6 border-t border-[#E5E7EB]">
        <p className="text-sm text-[#6B7280] text-center py-6">
          {t("calendarPage.selectDay")}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 pt-6 border-t border-[#E5E7EB]">
      {/* Selected date header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#1F2937]">{dateLabel}</h3>
        {events.length > 0 && (
          <span className="text-xs text-[#6B7280]">
            {t("calendarPage.eventsCount", { count: events.length })}
          </span>
        )}
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8">
          <Calendar className="w-8 h-8 text-[#D1D5DB] mb-2" />
          <p className="text-sm text-[#6B7280]">
            {t("calendarPage.noEventsForDay")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => {
            const eventDate = new Date(event.date);
            const { Icon: TypeIcon, color: iconColor } = getDeliveryIcon(
              event.sessionType
            );
            const joinable = isJoinable(event.date);
            const hasZoom =
              event.sessionType === "zoom" ||
              event.sessionType === "hybrid" ||
              event.sessionType === "blended";
            const hasVenue =
              event.sessionType === "onsite" ||
              event.sessionType === "hybrid" ||
              event.sessionType === "blended";

            // Session type label
            const typeLabel =
              event.sessionType === "zoom"
                ? t("calendarPage.zoomSession")
                : event.sessionType === "onsite"
                  ? t("calendarPage.onsiteSession")
                  : t("calendarPage.hybridSession");

            return (
              <div
                key={event.id}
                className="bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] p-4"
              >
                {/* Header: Icon + Type Badge + Title */}
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      event.sessionType === "zoom"
                        ? "bg-blue-50"
                        : event.sessionType === "onsite"
                          ? "bg-green-50"
                          : "bg-purple-50"
                    }`}
                  >
                    <TypeIcon className={`w-5 h-5 ${iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          event.sessionType === "zoom"
                            ? "bg-blue-100 text-blue-700"
                            : event.sessionType === "onsite"
                              ? "bg-green-100 text-green-700"
                              : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {typeLabel}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-[#1F2937]">
                      {event.title}
                    </h4>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="space-y-2 mb-4">
                  {/* Course */}
                  <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                    <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>
                      {isRTL && event.courseTitleAr
                        ? event.courseTitleAr
                        : event.courseTitle}
                    </span>
                  </div>

                  {/* Instructor */}
                  {event.instructorName && (
                    <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                      <User className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{event.instructorName}</span>
                    </div>
                  )}

                  {/* Time with timezone */}
                  <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                    <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{timeWithTimezone.format(eventDate)}</span>
                    <span className="text-[#9CA3AF]">
                      · {event.durationMinutes} {t("calendarPage.mins")}
                    </span>
                  </div>

                  {/* Venue / Room */}
                  {hasVenue && (event.venueAddress || event.roomName) && (
                    <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>
                        {event.roomName && (
                          <span className="font-medium">
                            {event.roomName}
                            {event.venueAddress && " · "}
                          </span>
                        )}
                        {event.venueAddress}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  {/* Join Zoom */}
                  {hasZoom && event.zoomLink && (
                    <a
                      href={joinable ? event.zoomLink : "#"}
                      target={joinable ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      onClick={
                        joinable ? undefined : (e) => e.preventDefault()
                      }
                      className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                        joinable
                          ? "bg-[#2D8CFF] text-white hover:bg-[#1A73E8]"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      <Video className="w-3.5 h-3.5" />
                      {t("calendarPage.joinZoom")}
                    </a>
                  )}

                  {/* Get Directions */}
                  {hasVenue && event.venueAddress && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venueAddress)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#16A34A] bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {t("calendarPage.getDirections")}
                    </a>
                  )}

                  {/* Add to Calendar */}
                  <button
                    onClick={() => downloadIcs(event)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#6B7280] border border-[#E5E7EB] rounded-lg hover:bg-[#F3F4F6] transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {t("calendarPage.addToCalendar")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EventDetailPanel;
