"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  Video,
  MapPin,
  Users,
  Clock,
  Play,
  ClipboardCheck,
  Upload,
} from "lucide-react";

interface Session {
  id: string;
  title: string;
  thumbnail: string;
  type: "zoom" | "onsite";
  location?: string;
  enrolled: number;
  time: string;
}

interface SessionCardProps {
  session: Session;
  onStart?: () => void;
  onAttendance?: () => void;
  onShare?: () => void;
}

const SessionCard = ({
  session,
  onStart,
  onAttendance,
  onShare,
}: SessionCardProps) => {
  const t = useTranslations("instructorDashboard");

  return (
    <div className="flex flex-col sm:flex-row gap-4 p-4 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] hover:border-[#3B82F6] hover:shadow-[0_0_0_3px_#EFF6FF] transition-all duration-200">
      {/* Course Image */}
      <div className="relative w-full sm:w-36 h-24 sm:h-24 rounded-lg overflow-hidden flex-shrink-0">
        <Image
          src={session.thumbnail}
          alt={session.title}
          fill
          className="object-cover"
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="mb-1">
          <h3 className="text-base font-semibold text-[#1F2937] line-clamp-1">
            {session.title}
          </h3>
        </div>

        {/* Session Type Badge */}
        <div className="mb-2">
          {session.type === "zoom" ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#EFF6FF] text-[#3B82F6] rounded-md text-xs font-medium">
              <Video className="w-3 h-3" />
              {t("sessions.zoomSession")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#DCFCE7] text-[#22C55E] rounded-md text-xs font-medium">
              <MapPin className="w-3 h-3" />
              {t("sessions.onsite")} {session.location && `• ${session.location}`}
            </span>
          )}
        </div>

        {/* Meta Info */}
        <div className="flex items-center gap-4 text-sm text-[#6B7280] mb-3">
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {session.enrolled} {t("sessions.enrolled")}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {session.time}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mt-auto">
          <button
            onClick={onStart}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#3B82F6] text-white text-sm font-medium rounded-lg hover:bg-[#2563EB] transition-colors"
          >
            <Play className="w-4 h-4" />
            {t("sessions.startSession")}
          </button>
          <button
            onClick={onAttendance}
            className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] hover:border-[#9CA3AF] transition-colors"
            title={t("sessions.attendance")}
          >
            <ClipboardCheck className="w-4 h-4" />
          </button>
          <button
            onClick={onShare}
            className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] hover:border-[#9CA3AF] transition-colors"
            title={t("sessions.shareMaterials")}
          >
            <Upload className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionCard;
