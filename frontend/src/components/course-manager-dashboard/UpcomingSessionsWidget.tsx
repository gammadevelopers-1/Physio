"use client";

import { useTranslations, useLocale } from "next-intl";
import { Calendar, Video, MapPin, AlertTriangle, ChevronRight } from "lucide-react";
import Link from "next/link";

interface Session {
  id: string;
  title: string;
  courseName?: string;
  time: string;
  date: string;
  type: "zoom" | "onsite";
  location?: string;
  enrolled: number;
  capacity: number;
  hasConflict?: boolean;
}

interface UpcomingSessionsWidgetProps {
  sessions: Session[];
}

const MAX_DISPLAY = 3;

const UpcomingSessionsWidget = ({ sessions }: UpcomingSessionsWidgetProps) => {
  const t = useTranslations("courseManagerDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const totalCount = sessions.length;
  const displaySessions = sessions.slice(0, MAX_DISPLAY);

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[var(--gold-gold-100)] rounded-lg flex items-center justify-center">
            <Calendar className="w-4 h-4 text-[var(--gold-gold-500)]" />
          </div>
          <h3 className="text-[15px] font-semibold text-[#1F2937]">
            {t("upcomingSessions.title")}
          </h3>
        </div>
        {totalCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 bg-[#EFF6FF] text-[#3B82F6] text-xs font-semibold rounded-full">
            {totalCount}
          </span>
        )}
      </div>

      {/* Sessions List */}
      <div className="p-4 sm:p-5">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-12 h-12 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-3">
              <Calendar className="w-6 h-6 text-[#9CA3AF]" />
            </div>
            <h4 className="text-sm font-medium text-[#1F2937] mb-1">
              {t("upcomingSessions.noSessions")}
            </h4>
            <p className="text-xs text-[#6B7280] text-center">
              {t("upcomingSessions.noSessionsDesc")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displaySessions.map((session) => (
              <div
                key={session.id}
                className={`p-3.5 rounded-xl border ${
                  session.hasConflict
                    ? "bg-[#FEF2F2] border-[var(--functional-red-400)]"
                    : "bg-[#F9FAFB] border-[#E5E7EB]"
                }`}
              >
                {/* Date and Time */}
                <p className="text-[13px] text-[#6B7280] mb-1">
                  {session.date} - {session.time}
                </p>

                {/* Session Title */}
                <h4 className="text-[14px] font-semibold text-[#1F2937] truncate" title={session.title}>
                  {session.title}
                </h4>

                {/* Course Name */}
                {session.courseName && (
                  <p className="text-xs text-[#6B7280] truncate mt-0.5" title={session.courseName}>
                    {session.courseName}
                  </p>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between mt-2">
                  {session.capacity > 0 ? (
                    <span className="text-[12px] text-[#6B7280]">
                      {session.enrolled}/{session.capacity} {t("upcomingSessions.enrolled")}
                    </span>
                  ) : (
                    <span className="text-[12px] text-[#6B7280]">
                      {session.enrolled} {t("upcomingSessions.enrolled")}
                    </span>
                  )}

                  {session.hasConflict ? (
                    <span className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--functional-red-600)]">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {t("schedules.conflict")}
                    </span>
                  ) : session.type === "zoom" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#DBEAFE] text-[var(--functional-blue-600)] text-[11px] font-medium rounded">
                      <Video className="w-3 h-3" />
                      {t("schedules.zoom")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#DCFCE7] text-[var(--functional-green-600)] text-[11px] font-medium rounded">
                      <MapPin className="w-3 h-3" />
                      {t("schedules.onsite")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* View All Link */}
        {totalCount > 0 && (
          <div className="text-center pt-4 border-t border-[#E5E7EB] mt-4">
            <Link
              href={`/${locale}/dashboard/manager/sessions`}
              className="text-[13px] font-medium text-[var(--blue-brand-blue)] hover:underline inline-flex items-center gap-1"
            >
              {t("upcomingSessions.viewAll")}
              <ChevronRight className={`w-3.5 h-3.5 ${isRTL ? "rotate-180" : ""}`} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default UpcomingSessionsWidget;
