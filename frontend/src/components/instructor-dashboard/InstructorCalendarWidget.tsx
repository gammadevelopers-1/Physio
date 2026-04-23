"use client";

import { useTranslations } from "next-intl";
import { Calendar, Video, MapPin, CheckCircle, XCircle } from "lucide-react";

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: string;
  enrolled: number;
  type: "zoom" | "onsite";
  status: "scheduled" | "live" | "ended" | "completed" | "cancelled";
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
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)]">
      <div className="p-4 sm:p-5">
        <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">
          {t("calendar.title")}
        </h3>

        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-12 h-12 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-3">
              <Calendar className="w-6 h-6 text-[var(--color-text-secondary)]" />
            </div>
            <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
              {t("calendar.noEventsTitle")}
            </h4>
            <p className="text-xs text-[var(--color-text-secondary)] text-center max-w-[200px]">
              {t("calendar.noEventsDescription")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => {
              const cardStyle =
                event.status === "completed"
                  ? "p-3.5 border border-[#BBF7D0] bg-[#F0FDF4] rounded-xl opacity-70"
                  : event.status === "cancelled"
                    ? "p-3.5 border border-[var(--color-border)] bg-[#F3F4F6] rounded-xl opacity-50"
                    : event.status === "live"
                      ? "p-3.5 border border-[#FECACA] bg-[#FEF2F2] rounded-xl ring-1 ring-[#EF4444]"
                      : "p-3.5 border border-[var(--color-border)] rounded-xl";

              const titleStyle =
                event.status === "cancelled"
                  ? "text-[15px] font-semibold text-[var(--color-text-secondary)] line-through mb-1"
                  : event.status === "completed"
                    ? "text-[15px] font-semibold text-[var(--color-text-secondary)] mb-1"
                    : "text-[15px] font-semibold text-[var(--color-text-primary)] mb-1";

              return (
                <div key={event.id} className={cardStyle}>
                  {/* Date and Time */}
                  <p className="text-[13px] text-[var(--color-text-secondary)] mb-1">
                    {event.date} - {event.time}
                  </p>

                  {/* Event Title */}
                  <h4 className={titleStyle}>{event.title}</h4>

                  {/* Enrolled Count */}
                  <p className="text-[13px] text-[var(--color-text-secondary)] mb-2">
                    {event.enrolled} {t("calendar.studentsEnrolled")}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[var(--color-text-secondary)]">
                      {event.duration}
                    </span>
                    {event.status === "completed" ? (
                      <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[#22C55E]">
                        <CheckCircle className="w-3.5 h-3.5" />
                        {t("calendar.completed")}
                      </span>
                    ) : event.status === "cancelled" ? (
                      <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--color-text-secondary)]">
                        <XCircle className="w-3.5 h-3.5" />
                        {t("calendar.cancelled")}
                      </span>
                    ) : event.status === "live" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#FEE2E2] rounded text-[13px] font-bold text-[#EF4444]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse" />
                        {t("calendar.live")}
                      </span>
                    ) : event.type === "zoom" ? (
                      event.zoomLink ? (
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
                        <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[#3B82F6]">
                          <Video className="w-3.5 h-3.5" />
                          {t("calendar.zoom")}
                        </span>
                      )
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[#22C55E]">
                        <MapPin className="w-3.5 h-3.5" />
                        {t("calendar.onsite")}
                      </span>
                    )}
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

export default InstructorCalendarWidget;
