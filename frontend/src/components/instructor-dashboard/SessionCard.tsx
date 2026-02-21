"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  Video,
  MapPin,
  RefreshCw,
  Users,
  Clock,
  Play,
  Square,
  ClipboardCheck,
  Upload,
  CheckCircle,
  XCircle,
  ExternalLink,
} from "lucide-react";

interface Session {
  id: string;
  title: string;
  thumbnail: string;
  type: "zoom" | "onsite" | "hybrid";
  status: "scheduled" | "live" | "completed" | "cancelled";
  location?: string;
  enrolled: number;
  time: string;
  zoomLink?: string;
}

interface SessionCardProps {
  session: Session;
  onStart?: () => void;
  onEnd?: () => void;
  onAttendance?: () => void;
  onShare?: () => void;
}

const SessionCard = ({
  session,
  onStart,
  onEnd,
  onAttendance,
  onShare,
}: SessionCardProps) => {
  const t = useTranslations("instructorDashboard");

  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    scheduled: { bg: "bg-[#EFF6FF]", text: "text-[#3B82F6]", label: t("sessions.statusScheduled") },
    live: { bg: "bg-[#FEE2E2]", text: "text-[#EF4444]", label: t("sessions.statusLive") },
    completed: { bg: "bg-[#DCFCE7]", text: "text-[#22C55E]", label: t("sessions.statusCompleted") },
    cancelled: { bg: "bg-[#F3F4F6]", text: "text-[#6B7280]", label: t("sessions.statusCancelled") },
  };

  const typeIcon = session.type === "zoom" ? <Video className="w-3 h-3" /> :
                   session.type === "hybrid" ? <RefreshCw className="w-3 h-3" /> :
                   <MapPin className="w-3 h-3" />;

  const typeLabel = session.type === "zoom" ? t("sessions.zoomSession") :
                    session.type === "hybrid" ? t("sessions.hybridSession") :
                    t("sessions.onsite");

  const typeBg = session.type === "zoom" ? "bg-[#EFF6FF] text-[#3B82F6]" :
                 session.type === "hybrid" ? "bg-[#F3E8FF] text-[#9333EA]" :
                 "bg-[#DCFCE7] text-[#22C55E]";

  const badge = statusConfig[session.status] || statusConfig.scheduled;
  const isCompleted = session.status === "completed";
  const isCancelled = session.status === "cancelled";
  const isLive = session.status === "live";
  const isScheduled = session.status === "scheduled";

  return (
    <div className={`flex flex-col sm:flex-row gap-4 p-4 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] hover:border-[#3B82F6] hover:shadow-[0_0_0_3px_#EFF6FF] transition-all duration-200 ${isCompleted || isCancelled ? "opacity-75" : ""}`}>
      {/* Course Image */}
      <div className="relative w-full sm:w-36 h-24 sm:h-24 rounded-lg overflow-hidden flex-shrink-0">
        <Image
          src={session.thumbnail}
          alt={session.title}
          fill
          className="object-cover"
          unoptimized
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="mb-1">
          <h3 className={`text-base font-semibold line-clamp-1 ${isCompleted || isCancelled ? "text-[#6B7280]" : "text-[#1F2937]"}`}>
            {session.title}
          </h3>
        </div>

        {/* Badges Row */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${typeBg}`}>
            {typeIcon}
            {typeLabel}
            {session.type === "onsite" && session.location && ` \u2022 ${session.location}`}
          </span>
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${badge.bg} ${badge.text}`}>
            {isCompleted && <CheckCircle className="w-3 h-3" />}
            {isCancelled && <XCircle className="w-3 h-3" />}
            {isLive && <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />}
            {badge.label}
          </span>
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

        {/* Action Buttons - Status aware */}
        <div className="flex items-center gap-2 mt-auto">
          {isScheduled && (
            <button
              onClick={onStart}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#3B82F6] text-white text-sm font-medium rounded-lg hover:bg-[#2563EB] transition-colors"
            >
              <Play className="w-4 h-4" />
              {t("sessions.startSession")}
            </button>
          )}

          {isLive && (
            <>
              <button
                onClick={onEnd}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#EF4444] text-white text-sm font-medium rounded-lg hover:bg-[#DC2626] transition-colors"
              >
                <Square className="w-4 h-4" />
                {t("sessions.endSession")}
              </button>
              {session.zoomLink && (
                <a
                  href={session.zoomLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs text-[#3B82F6] border border-[#BFDBFE] rounded-lg hover:bg-[#EFF6FF] transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Rejoin Zoom
                </a>
              )}
            </>
          )}

          {!isCancelled && (
            <button
              onClick={onAttendance}
              className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] hover:border-[#9CA3AF] transition-colors"
              title={t("sessions.attendance")}
            >
              <ClipboardCheck className="w-4 h-4" />
            </button>
          )}

          {isScheduled && (
            <button
              onClick={onShare}
              className="p-2 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] hover:border-[#9CA3AF] transition-colors"
              title={t("sessions.shareMaterials")}
            >
              <Upload className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionCard;
