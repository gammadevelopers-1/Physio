"use client";

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
  ExternalLink,
} from "lucide-react";

interface Session {
  id: string;
  title: string;
  thumbnail: string;
  type: "zoom" | "onsite" | "hybrid";
  status: "scheduled" | "live" | "ended" | "completed" | "cancelled" | "missed" | "rescheduled";
  location?: string;
  enrolled: number;
  time: string;
  zoomLink?: string;
}

interface TAThreshold {
  requiredTAs: number;
  activeTAs: number;
  deficit: number;
}

interface SessionCardProps {
  session: Session;
  taThreshold?: TAThreshold | null;
  onStart?: () => void;
  onEnd?: () => void;
  onAttendance?: () => void;
  onShare?: () => void;
}

const SessionCard = ({
  session,
  taThreshold,
  onStart,
  onEnd,
  onAttendance,
  onShare,
}: SessionCardProps) => {
  const t = useTranslations("instructorDashboard");

  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    scheduled: { bg: "bg-[#EFF6FF]", text: "text-[#3B82F6]", label: t("sessions.statusScheduled") },
    live: { bg: "bg-[#FEE2E2]", text: "text-[#EF4444]", label: t("sessions.statusLive") },
    ended: { bg: "bg-[#FEF3C7]", text: "text-[#D97706]", label: t("sessions.statusEnded") },
    completed: { bg: "bg-[#DCFCE7]", text: "text-[#22C55E]", label: t("sessions.statusCompleted") },
    cancelled: { bg: "bg-[#F3F4F6]", text: "text-[#6B7280]", label: t("sessions.statusCancelled") || "Cancelled" },
    missed: { bg: "bg-[#FEF2F2]", text: "text-[#EF4444]", label: "Missed" },
    rescheduled: { bg: "bg-[#FEF3C7]", text: "text-[#D97706]", label: "Rescheduled" },
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
  const isMissed = session.status === "missed";
  const isRescheduled = session.status === "rescheduled";
  const isInactive = isCancelled || isMissed || isRescheduled;
  const isLive = session.status === "live";
  const isScheduled = session.status === "scheduled";

  return (
    <div className={`rounded-xl border overflow-hidden transition-all duration-200 ${
      isLive
        ? "border-[#EF4444]/30 bg-gradient-to-r from-[#FEF2F2] to-white shadow-sm"
        : isCompleted || isInactive
        ? "border-[#E5E7EB] bg-[#F9FAFB] opacity-75"
        : "border-[#E5E7EB] bg-white hover:border-[#3B82F6]/40 hover:shadow-sm"
    }`}>
      <div className="flex items-center gap-4 p-4">
        {/* Type Icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${typeBg}`}>
          {typeIcon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={`text-sm font-semibold truncate ${isCompleted || isInactive ? "text-[#6B7280]" : "text-[#1F2937]"}`}>
              {session.title}
            </h3>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${badge.bg} ${badge.text}`}>
              {isLive && <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse" />}
              {badge.label}
            </span>
            {taThreshold && taThreshold.requiredTAs > 0 && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${
                taThreshold.deficit > 0
                  ? "bg-[#FEF2F2] text-[#EF4444]"
                  : "bg-[#DCFCE7] text-[#22C55E]"
              }`}>
                <Users className="w-3 h-3" />
                {taThreshold.activeTAs}/{taThreshold.requiredTAs} TA
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-[#6B7280]">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {session.time}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {session.enrolled}
            </span>
            {session.type === "onsite" && session.location && (
              <span className="flex items-center gap-1 truncate">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{session.location}</span>
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isScheduled && (
            <button
              onClick={onStart}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#3B82F6] text-white text-xs font-medium rounded-lg hover:bg-[#2563EB] transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              {t("sessions.startSession")}
            </button>
          )}

          {isLive && (
            <>
              <button
                onClick={onEnd}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#EF4444] text-white text-xs font-medium rounded-lg hover:bg-[#DC2626] transition-colors"
              >
                <Square className="w-3.5 h-3.5" />
                {t("sessions.endSession")}
              </button>
              {session.zoomLink && (
                <a
                  href={session.zoomLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-[#3B82F6] border border-[#BFDBFE] rounded-lg hover:bg-[#EFF6FF] transition-colors"
                  title="Rejoin Zoom"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </>
          )}

          {!isInactive && (
            <button
              onClick={onAttendance}
              className="p-1.5 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
              aria-label={t("sessions.attendance")}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
            </button>
          )}

          {(isScheduled || isLive) && (
            <button
              onClick={onShare}
              className="p-1.5 border border-[#E5E7EB] rounded-lg text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
              aria-label={t("sessions.shareMaterials")}
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionCard;
