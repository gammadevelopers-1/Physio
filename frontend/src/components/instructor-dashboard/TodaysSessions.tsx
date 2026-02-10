"use client";

import { useTranslations } from "next-intl";
import SessionCard from "./SessionCard";
import { Calendar } from "lucide-react";

interface Session {
  id: string;
  title: string;
  thumbnail: string;
  type: "zoom" | "onsite";
  location?: string;
  enrolled: number;
  time: string;
  isFavorite?: boolean;
}

interface TodaysSessionsProps {
  sessions: Session[];
}

const TodaysSessions = ({ sessions }: TodaysSessionsProps) => {
  const t = useTranslations("instructorDashboard");

  const handleStartSession = (sessionId: string) => {
    console.log("Starting session:", sessionId);
  };

  const handleAttendance = (sessionId: string) => {
    console.log("Opening attendance for:", sessionId);
  };

  const handleShareMaterials = (sessionId: string) => {
    console.log("Sharing materials for:", sessionId);
  };

  const handleFavorite = (sessionId: string) => {
    console.log("Toggling favorite for:", sessionId);
  };

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] mb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 border-b border-[#E5E7EB] gap-3">
        <h2 className="text-base sm:text-lg font-semibold text-[#1F2937]">
          {t("todaysSessions.title")}
        </h2>
        <button className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-[#374151] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors">
          {t("todaysSessions.viewCalendar")}
        </button>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-3">
              <Calendar className="w-6 h-6 text-[#9CA3AF]" />
            </div>
            <h3 className="text-sm font-medium text-[#1F2937] mb-1">
              {t("todaysSessions.noSessionsTitle")}
            </h3>
            <p className="text-xs text-[#6B7280] text-center max-w-[200px]">
              {t("todaysSessions.noSessionsDescription")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onStart={() => handleStartSession(session.id)}
                onAttendance={() => handleAttendance(session.id)}
                onShare={() => handleShareMaterials(session.id)}
                onFavorite={() => handleFavorite(session.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TodaysSessions;
