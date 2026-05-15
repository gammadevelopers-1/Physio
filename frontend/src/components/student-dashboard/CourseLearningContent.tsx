"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Info,
  Layers,
  Loader2,
  Lock,
  MapPin,
  Maximize2,
  Play,
  Radio,
  Video,
  XCircle,
} from "lucide-react";
import { useStudentCourseDetail } from "@/hooks/useStudentCourseDetail";
import { useModuleMaterials } from "@/hooks/useModuleMaterials";
import { studentApi } from "@/lib/api";
import { isJoinable, formatTimeUntil } from "@/lib/calendar-utils";
import { formatDateReadable } from "@/lib/hijri";
import { useCalendarPreference } from "@/contexts/CalendarContext";
import VideoPlayer from "./VideoPlayer";
import type { CourseSession, ModuleMaterial, StudentAttendanceRecord } from "@/types/student-dashboard";

// ─── Helpers ────────────────────────────────────────────────

function getModuleIcon(type: string, isCompleted?: boolean) {
  if (isCompleted) return { Icon: CheckCircle2, color: "text-[#16A34A]" };
  switch (type) {
    case "video":   return { Icon: Video,        color: "text-[var(--color-text-secondary)]" };
    case "document":
    case "pdf":     return { Icon: FileText,     color: "text-[var(--color-text-secondary)]" };
    case "image":   return { Icon: ImageIcon,    color: "text-[var(--color-text-secondary)]" };
    case "quiz":    return { Icon: ClipboardList, color: "text-[var(--color-text-secondary)]" };
    case "mixed":   return { Icon: Layers,       color: "text-[var(--color-text-secondary)]" };
    default:        return { Icon: BookOpen,     color: "text-[var(--color-text-secondary)]" };
  }
}

type FileKind = "pdf" | "image" | "office" | "other";

function detectFileKind(material: ModuleMaterial): FileKind {
  const mime = material.mimeType || "";
  const url = material.fileUrl || "";
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() || "";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "image";
  if (
    ["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext) ||
    mime.includes("officedocument") ||
    mime.includes("ms-excel") ||
    mime.includes("ms-powerpoint") ||
    mime.includes("msword")
  ) {
    return "office";
  }
  return "other";
}

// ─── Content Viewer Components ──────────────────────────────

function PdfViewer({ material }: { material: ModuleMaterial }) {
  const t = useTranslations("studentDashboard.learning");
  const [loading, setLoading] = useState(true);

  if (!material.fileUrl) return null;

  const kind = detectFileKind(material);

  if (kind === "office") {
    const officeSrc = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(material.fileUrl)}`;
    return (
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-surface-page)] rounded-lg z-10">
            <Loader2 className="w-6 h-6 text-[var(--color-text-secondary)] animate-spin" />
          </div>
        )}
        <iframe
          src={officeSrc}
          title={material.title}
          className="w-full rounded-lg border border-[var(--color-border)]"
          style={{ height: "680px" }}
          onLoad={() => setLoading(false)}
        />
        <p className="text-[10px] text-[var(--color-text-secondary)] mt-2 text-center">
          {t("officePreviewNote")}
        </p>
        <div className="mt-2 flex justify-end gap-2">
          <a
            href={material.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            {t("openInTab")}
          </a>
          <a
            href={material.fileUrl}
            download
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-[var(--color-primary)] border border-[var(--color-primary)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
          >
            <Download className="w-4 h-4" />
            {t("download")}
          </a>
        </div>
      </div>
    );
  }

  if (kind === "other") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-14 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[var(--color-border-subtle)] flex items-center justify-center">
          <FileText className="w-8 h-8 text-[var(--color-primary)]" />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-1">
            {material.title}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {t("previewUnavailable")}
          </p>
        </div>
        <a
          href={material.fileUrl}
          download
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-primary-dark)] transition-colors"
        >
          <Download className="w-4 h-4" />
          {t("downloadToView")}
        </a>
      </div>
    );
  }

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-surface-page)] rounded-lg z-10">
          <Loader2 className="w-6 h-6 text-[var(--color-text-secondary)] animate-spin" />
        </div>
      )}
      <embed
        src={material.fileUrl}
        type="application/pdf"
        className="w-full rounded-lg border border-[var(--color-border)]"
        style={{ height: "680px" }}
        onLoad={() => setLoading(false)}
      />
      <div className="mt-3 flex justify-end gap-2">
        <a
          href={material.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          {t("openInTab")}
        </a>
        <a
          href={material.fileUrl}
          download
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-[var(--color-primary)] border border-[var(--color-primary)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
        >
          <Download className="w-4 h-4" />
          {t("download")}
        </a>
      </div>
    </div>
  );
}

function ImageViewer({ material }: { material: ModuleMaterial }) {
  const t = useTranslations("studentDashboard.learning");
  if (!material.fileUrl) return null;

  return (
    <div className="relative group">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={material.fileUrl}
        alt={material.title}
        className="w-full rounded-lg object-contain bg-[var(--color-surface-page)]"
        style={{ maxHeight: "600px" }}
      />
      <a
        href={material.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-3 end-3 inline-flex items-center gap-1 px-3 py-1.5 bg-[var(--color-surface-card)]/90 rounded-lg text-xs text-[var(--color-text-primary)] opacity-0 group-hover:opacity-100 transition-opacity shadow"
      >
        <Maximize2 className="w-3 h-3" />
        {t("fullSize")}
      </a>
    </div>
  );
}

function MaterialRenderer({
  material,
  courseId,
  moduleId,
  locale,
  onComplete,
  nextMaterialTitle,
  onNextMaterial,
}: {
  material: ModuleMaterial;
  courseId?: string;
  moduleId?: string;
  locale?: string;
  onComplete?: () => void;
  nextMaterialTitle?: string;
  onNextMaterial?: () => void;
}) {
  switch (material.type) {
    case "video":
      return (
        <VideoPlayer
          material={material}
          courseId={courseId}
          moduleId={moduleId}
          locale={locale}
          onComplete={onComplete}
          nextMaterialTitle={nextMaterialTitle}
          onNextMaterial={onNextMaterial}
        />
      );
    case "pdf":
    case "document":
      return <PdfViewer material={material} />;
    case "image":
      return <ImageViewer material={material} />;
    default:
      return null;
  }
}

function typeBadge(type: string) {
  const map: Record<string, string> = {
    video: "Video",
    pdf: "PDF",
    document: "Document",
    image: "Image",
    quiz: "Quiz",
  };
  return map[type] ?? type;
}

// ─── Lecture row in sidebar ─────────────────────────────────

function LectureRow({
  session,
  active,
  onSelect,
  attendance,
  formatDate,
  formatTime,
  t,
}: {
  session: CourseSession;
  active: boolean;
  onSelect: () => void;
  attendance?: StudentAttendanceRecord | null;
  formatDate: (s: string) => string;
  formatTime: (s: string) => string;
  t: ReturnType<typeof useTranslations>;
}) {
  const now = new Date().getTime();
  const startMs = new Date(session.scheduledAt).getTime();
  const endMs = startMs + (session.durationMinutes || 0) * 60_000;
  const isLive = session.status === "live" || (now >= startMs && now < endMs && session.status !== "cancelled" && session.status !== "missed");
  const isPast = now >= endMs && !isLive;
  const isWebinar = !!session.isWebinar;
  const canJoinNow = isJoinable(session.scheduledAt) || isLive;

  // Right-side meta: attendance for past, status chip otherwise.
  let trailing: React.ReactNode = null;
  if (isPast && attendance) {
    const badgeMap: Record<string, { bg: string; text: string; label: string }> = {
      present: { bg: "bg-[#DCFCE7]", text: "text-[#16A34A]", label: t("attendanceCard") },
      absent: { bg: "bg-[#FEE2E2]", text: "text-[#EF4444]", label: "" },
      late: { bg: "bg-[#FEF3C7]", text: "text-[#D97706]", label: "" },
      excused: { bg: "bg-[var(--color-border-subtle)]", text: "text-[var(--color-text-secondary)]", label: "" },
    };
    const b = badgeMap[attendance.status];
    if (b) {
      trailing = (
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${b.bg} ${b.text} capitalize`}>
          {attendance.status}
        </span>
      );
    }
  } else if (session.status === "cancelled") {
    trailing = <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#FEE2E2] text-[#EF4444]">{t("lectureCancelled")}</span>;
  } else if (session.status === "missed") {
    trailing = <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#FEE2E2] text-[#EF4444]">{t("lectureMissed")}</span>;
  } else if (isLive) {
    trailing = (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#DC2626] text-white uppercase tracking-wide">
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
      </span>
    );
  } else if (canJoinNow) {
    trailing = <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#DCFCE7] text-[#16A34A]">{t("joinNow")}</span>;
  } else if (isWebinar) {
    trailing = <Radio className="w-3.5 h-3.5 text-[#A855F7]" />;
  }

  const ringStripe = isLive
    ? "border-l-2 border-l-[#DC2626]"
    : canJoinNow
      ? "border-l-2 border-l-[#16A34A]"
      : "";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg text-start transition-colors ${
        active
          ? "bg-[var(--color-border-subtle)] border border-[#BFDBFE]"
          : "hover:bg-[var(--color-border-subtle)] cursor-pointer border border-transparent"
      } ${ringStripe}`}
    >
      <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${
        isWebinar ? "bg-[#FAF5FF]" : isPast ? "bg-[var(--color-border-subtle)]" : "bg-[#FFFBEB]"
      }`}>
        {isWebinar ? (
          <Radio className="w-3.5 h-3.5 text-[#A855F7]" />
        ) : session.type === "onsite" ? (
          <MapPin className="w-3.5 h-3.5 text-[#D4A520]" />
        ) : (
          <Video className="w-3.5 h-3.5 text-[#D4A520]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs leading-snug line-clamp-2 ${active ? "font-semibold text-[var(--color-primary)]" : "font-medium text-[var(--color-text-primary)]"}`}>
          {session.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[var(--color-text-secondary)]">
          <span className="flex items-center gap-0.5">
            <Calendar className="w-2.5 h-2.5" />
            {formatDate(session.scheduledAt)}
          </span>
          <span className="flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" />
            {formatTime(session.scheduledAt)}
          </span>
        </div>
      </div>
      <div className="flex-shrink-0">{trailing}</div>
    </button>
  );
}

// ─── Lecture detail canvas ──────────────────────────────────

function LectureDetailCanvas({
  session,
  attendance,
  locale,
  formatDate,
  formatTime,
  t,
  tDetail,
  onJoinMeeting,
  onJoinWebinarRegister,
  joiningSessionId,
  enrollmentCompleted,
}: {
  session: CourseSession;
  attendance?: StudentAttendanceRecord | null;
  locale: string;
  formatDate: (s: string) => string;
  formatTime: (s: string) => string;
  t: ReturnType<typeof useTranslations>;
  tDetail: ReturnType<typeof useTranslations>;
  onJoinMeeting: (sessionId: string) => void;
  onJoinWebinarRegister: (sessionId: string) => void;
  joiningSessionId: string | null;
  enrollmentCompleted: boolean;
}) {
  const now = new Date().getTime();
  const startMs = new Date(session.scheduledAt).getTime();
  const endMs = startMs + (session.durationMinutes || 0) * 60_000;
  const isLive = session.status === "live" || (now >= startMs && now < endMs && session.status !== "cancelled" && session.status !== "missed");
  const isPast = now >= endMs && !isLive;
  const isWebinar = !!session.isWebinar;
  const canJoinMeeting = !!session.zoomLink && (isJoinable(session.scheduledAt) || isLive);

  // Status pill
  const statusPill = (() => {
    if (session.status === "cancelled") {
      return { bg: "bg-[#FEE2E2]", text: "text-[#EF4444]", label: t("lectureCancelled") };
    }
    if (session.status === "missed") {
      return { bg: "bg-[#FEE2E2]", text: "text-[#EF4444]", label: t("lectureMissed") };
    }
    if (isLive) {
      return { bg: "bg-[#DC2626]", text: "text-white", label: "LIVE" };
    }
    if (isPast) {
      return { bg: "bg-[var(--color-border-subtle)]", text: "text-[var(--color-text-secondary)]", label: t("pastHeader") };
    }
    return { bg: "bg-[#FFFBEB]", text: "text-[#D97706]", label: t("lectureScheduled") };
  })();

  // Webinar primary CTA — mirror overview state machine.
  const renderWebinarCta = () => {
    if (session.studentWebinarJoinUrl && (session.status === "scheduled" || session.status === "live")) {
      // Already registered
      if (isJoinable(session.scheduledAt) || session.status === "live") {
        return (
          <a
            href={session.studentWebinarJoinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            <Radio className="w-4 h-4" />
            {t("joinWebinar")}
          </a>
        );
      }
      return (
        <div className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#FAF5FF] text-[#7C3AED] border border-[#E9D5FF] text-sm font-semibold rounded-xl">
          <Clock className="w-4 h-4" />
          {t("startsIn", { time: formatTimeUntil(session.scheduledAt) })}
        </div>
      );
    }
    if (session.status === "scheduled") {
      return (
        <button
          type="button"
          onClick={() => onJoinWebinarRegister(session.id)}
          disabled={joiningSessionId === session.id}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#A855F7] hover:bg-[#9333EA] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 shadow-sm"
        >
          {joiningSessionId === session.id ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Radio className="w-4 h-4" />
          )}
          {t("registerForWebinar")}
        </button>
      );
    }
    return (
      <div className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] text-sm font-medium rounded-xl cursor-not-allowed">
        <Radio className="w-4 h-4" />
        {session.status === "live" ? t("webinarInProgress") : t("webinarEnded")}
      </div>
    );
  };

  const renderMeetingCta = () => {
    if (session.status === "cancelled" || session.status === "missed" || isPast) return null;
    if (!session.zoomLink && session.type !== "onsite") return null;
    if (session.type === "onsite") {
      return (
        <div className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A] text-sm font-semibold rounded-xl">
          <MapPin className="w-4 h-4" />
          {session.venueAddress || (locale === "ar" ? "حضوري" : "On-site")}
        </div>
      );
    }
    if (canJoinMeeting) {
      return (
        <button
          type="button"
          onClick={() => onJoinMeeting(session.id)}
          disabled={joiningSessionId === session.id || enrollmentCompleted}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[var(--color-primary)] hover:opacity-90 text-white text-sm font-semibold rounded-xl transition-opacity disabled:opacity-60 shadow-sm"
        >
          {joiningSessionId === session.id ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Video className="w-4 h-4" />
          )}
          {t("joinNow")}
        </button>
      );
    }
    return (
      <div className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] text-sm font-medium rounded-xl">
        <Clock className="w-4 h-4" />
        {t("startsIn", { time: formatTimeUntil(session.scheduledAt) })}
      </div>
    );
  };

  // Attendance recap (past only)
  const attendanceColors: Record<string, { bg: string; text: string; ring: string }> = {
    present: { bg: "bg-[#F0FDF4]", text: "text-[#16A34A]", ring: "border-[#BBF7D0]" },
    late: { bg: "bg-[#FFFBEB]", text: "text-[#D97706]", ring: "border-[#FDE68A]" },
    absent: { bg: "bg-[#FEF2F2]", text: "text-[#EF4444]", ring: "border-[#FCA5A5]" },
    excused: { bg: "bg-[var(--color-border-subtle)]", text: "text-[var(--color-text-secondary)]", ring: "border-[var(--color-border)]" },
  };
  const attCol = attendance ? attendanceColors[attendance.status] : null;

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className={`rounded-2xl border ${isWebinar ? "border-[#E9D5FF] bg-gradient-to-br from-[#FAF5FF] to-white" : "border-[var(--color-border)] bg-[var(--color-surface-card)]"} p-5 sm:p-6`}>
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${statusPill.bg} ${statusPill.text}`}>
              {isLive && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
              {statusPill.label}
            </span>
            {isWebinar && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-[#A855F7] text-white">
                <Radio className="w-2.5 h-2.5" />
                {locale === "ar" ? "ندوة" : "Webinar"}
              </span>
            )}
          </div>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] mb-3">
          {session.title}
        </h2>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--color-text-secondary)] mb-5">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(session.scheduledAt)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {formatTime(session.scheduledAt)} · {session.durationMinutes} {tDetail("calendar.mins")}
          </span>
          {session.venueAddress && (
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {session.venueAddress}
            </span>
          )}
        </div>
        <div>
          {isWebinar ? renderWebinarCta() : renderMeetingCta()}
        </div>
      </div>

      {/* Attendance recap card (past only) */}
      {isPast && attCol && attendance && (
        <div className={`rounded-2xl border ${attCol.ring} ${attCol.bg} p-5`}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-3">
            {t("attendanceCard")}
          </h3>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-white ${attCol.text}`}>
              {attendance.status === "present" ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : attendance.status === "absent" ? (
                <XCircle className="w-6 h-6" />
              ) : (
                <Clock className="w-6 h-6" />
              )}
            </div>
            <div>
              <p className={`text-sm font-semibold capitalize ${attCol.text}`}>
                {attendance.status}
              </p>
              {attendance.presencePercent != null && (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t("presence")}: {attendance.presencePercent}%
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {attendance.joinedAt && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] mb-0.5">{t("joinedAt")}</p>
                <p className="font-medium text-[var(--color-text-primary)]">{formatTime(attendance.joinedAt)}</p>
              </div>
            )}
            {attendance.leftAt && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] mb-0.5">{t("leftAt")}</p>
                <p className="font-medium text-[var(--color-text-primary)]">{formatTime(attendance.leftAt)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Past, no attendance recorded */}
      {isPast && !attendance && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-card)] p-5 text-center text-xs text-[var(--color-text-secondary)]">
          {locale === "ar" ? "لا يوجد سجل حضور لهذه المحاضرة" : "No attendance recorded for this lecture"}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────

type Tab = "modules" | "lectures";

const CourseLearningContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const tLearning = useTranslations("studentDashboard.learning");
  const tA = useTranslations("accessibility");
  const isRTL = locale === "ar";
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const courseId = params.id as string;

  const { data, loading, error, refetch } = useStudentCourseDetail(courseId);
  const { calendarFormat } = useCalendarPreference();

  // Tabs derived from query, with smart default applied once data loads
  const queryTab = searchParams.get("tab") as Tab | null;
  const queryModule = searchParams.get("module");
  const querySession = searchParams.get("session");

  const sortedModules = useMemo(
    () =>
      data?.modules
        ? [...data.modules].sort((a, b) => a.orderIndex - b.orderIndex)
        : [],
    [data?.modules]
  );

  const hasModules = sortedModules.length > 0;
  const sessions = useMemo(() => data?.sessions ?? [], [data?.sessions]);
  const hasLectures = sessions.length > 0 && data?.course.deliveryType !== "self-paced";

  const [tab, setTab] = useState<Tab>("modules");
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeMaterialIdx, setActiveMaterialIdx] = useState(0);
  const [completingModule, setCompletingModule] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [lockedToast, setLockedToast] = useState(false);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [pastLimit, setPastLimit] = useState(10);

  // Initialize tab + selection from query / smart default once data is in.
  useEffect(() => {
    if (!data) return;
    // Default tab
    const defaultTab: Tab = queryTab
      ? queryTab
      : hasModules
        ? "modules"
        : hasLectures
          ? "lectures"
          : "modules";
    setTab(defaultTab);

    if (queryModule) setActiveModuleId(queryModule);
    if (querySession) {
      setActiveSessionId(querySession);
      // If a session is deep-linked, force lectures tab.
      setTab("lectures");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Sync URL when tab/selection changes (replace, not push, so back-button works naturally).
  useEffect(() => {
    if (!data) return;
    const sp = new URLSearchParams();
    sp.set("tab", tab);
    if (tab === "modules" && activeModuleId) sp.set("module", activeModuleId);
    if (tab === "lectures" && activeSessionId) sp.set("session", activeSessionId);
    const next = `?${sp.toString()}`;
    if (typeof window !== "undefined" && window.location.search !== next) {
      router.replace(`/${locale}/dashboard/student/courses/${courseId}/learn${next}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, activeModuleId, activeSessionId, data]);

  // Current module / session derived
  const currentModule =
    sortedModules.find((m) => m.id === activeModuleId) || sortedModules[0] || null;
  const currentIndex = currentModule
    ? sortedModules.findIndex((m) => m.id === currentModule.id)
    : -1;

  const { materials, loading: materialsLoading } = useModuleMaterials(
    courseId,
    currentModule?.id || null
  );

  // Lectures split
  const upcomingSessions = useMemo(() => {
    const now = Date.now();
    return sessions
      .filter((s) => s.status !== "cancelled" && new Date(s.scheduledAt).getTime() >= now)
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }, [sessions]);
  const pastSessions = useMemo(() => {
    const now = Date.now();
    return sessions
      .filter((s) => s.status !== "cancelled" && new Date(s.scheduledAt).getTime() < now)
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
  }, [sessions]);
  const inactiveSessions = useMemo(
    () => sessions.filter((s) => s.status === "cancelled"),
    [sessions]
  );

  const currentSession =
    sessions.find((s) => s.id === activeSessionId) ||
    upcomingSessions[0] ||
    pastSessions[0] ||
    null;

  const currentAttendance =
    currentSession && data?.attendanceRecords
      ? data.attendanceRecords.find((r) => r.sessionId === currentSession.id) ?? null
      : null;

  // Join-now banner — the soonest joinable session (meeting OR webinar)
  const joinableNow = useMemo(() => {
    const now = Date.now();
    return upcomingSessions.find((s) => {
      const startMs = new Date(s.scheduledAt).getTime();
      const endMs = startMs + (s.durationMinutes || 0) * 60_000;
      const isLive = s.status === "live" || (now >= startMs && now < endMs);
      if (s.status === "cancelled" || s.status === "missed") return false;
      if (s.isWebinar) {
        return !!s.studentWebinarJoinUrl && (isJoinable(s.scheduledAt) || isLive);
      }
      return !!s.zoomLink && (isJoinable(s.scheduledAt) || isLive);
    }) ?? null;
  }, [upcomingSessions]);

  const selectModule = useCallback((id: string) => {
    setActiveModuleId(id);
    setActiveMaterialIdx(0);
    setSidebarOpen(false);
  }, []);

  const selectSession = useCallback((id: string) => {
    setActiveSessionId(id);
    setSidebarOpen(false);
  }, []);

  const showLockedToast = useCallback(() => {
    setLockedToast(true);
    setTimeout(() => setLockedToast(false), 3000);
  }, []);

  const handleMarkComplete = async (moduleId: string) => {
    setCompletingModule(moduleId);
    try {
      await studentApi.updateProgress(courseId, { moduleId, status: "completed" });
      await refetch();
    } catch {
      // best-effort
    } finally {
      setCompletingModule(null);
    }
  };

  const goToNextModule = () => {
    if (currentIndex < sortedModules.length - 1) {
      selectModule(sortedModules[currentIndex + 1].id);
    }
  };

  const goToPrevModule = () => {
    if (currentIndex > 0) {
      selectModule(sortedModules[currentIndex - 1].id);
    }
  };

  const handleJoinMeeting = async (sessionId: string) => {
    if (joiningSessionId) return;
    if (data?.enrollment?.status === "completed") {
      toast.error(t("courseDetail.courseCompletedNoAccess") || "This course has been completed.");
      return;
    }
    setJoiningSessionId(sessionId);
    try {
      const { joinUrl } = await studentApi.getSessionJoinUrl(sessionId);
      window.open(joinUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast.error(t("courseDetail.joinSessionError") || "Unable to join this lecture.");
    } finally {
      setJoiningSessionId(null);
    }
  };

  const handleWebinarRegister = async (sessionId: string) => {
    // Same backend endpoint — returns the Zoom registration URL when not yet registered.
    if (joiningSessionId) return;
    setJoiningSessionId(sessionId);
    try {
      const { joinUrl } = await studentApi.getSessionJoinUrl(sessionId);
      window.open(joinUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast.error(t("courseDetail.joinSessionError") || "Unable to open webinar registration.");
    } finally {
      setJoiningSessionId(null);
    }
  };

  const formatDate = (dateStr: string | null) =>
    formatDateReadable(dateStr, calendarFormat, locale);

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString(
      locale === "ar" ? "ar-SA" : "en-US",
      { hour: "2-digit", minute: "2-digit" }
    );

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-surface-page)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--color-text-secondary)] animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[var(--color-surface-page)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--color-text-secondary)] mb-4">{error || t("courseDetail.notFound")}</p>
          <Link
            href={`/${locale}/dashboard/student/courses`}
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            {t("courseDetail.backToCourses")}
          </Link>
        </div>
      </div>
    );
  }

  const activeMaterial = materials[activeMaterialIdx] ?? null;
  const isSequential = data.course.isSequential !== false;
  const showModulesTab = hasModules;
  const showLecturesTab = hasLectures;
  const showTabToggle = showModulesTab && showLecturesTab;

  return (
    <div className="min-h-screen bg-[var(--color-surface-page)]" dir={isRTL ? "rtl" : "ltr"}>
      {/* Locked module toast */}
      {lockedToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 bg-[var(--color-text-primary)] text-white text-sm rounded-xl shadow-lg">
          <Lock className="w-4 h-4 text-[var(--color-text-secondary)]" />
          {locale === "ar" ? "أكمل الوحدة السابقة لفتح هذه" : "Complete the previous module to unlock this one"}
        </div>
      )}

      {/* Top Bar */}
      <div className="bg-[var(--color-surface-card)] border-b border-[var(--color-border)] px-4 py-3 sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/dashboard/student/courses/${courseId}`}
              className="p-1.5 rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
              aria-label={tA("back")}
            >
              <BackIcon className="w-5 h-5 text-[var(--color-text-secondary)]" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)] line-clamp-1">
                {isRTL && data.course.titleAr ? data.course.titleAr : data.course.title}
              </h1>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {data.enrollment.progress}% {t("courseDetail.complete")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs font-medium text-[var(--color-text-secondary)]">
              {data.enrollment.progress}%
            </span>
            <div className="hidden sm:block w-32 h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#16A34A] rounded-full transition-all"
                style={{ width: `${data.enrollment.progress}%` }}
              />
            </div>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors lg:hidden"
              aria-label={tA("toggleModules")}
            >
              <BookOpen className="w-5 h-5 text-[var(--color-text-secondary)]" />
            </button>
          </div>
        </div>
      </div>

      {/* Live-now banner — anchored above content, visible across both tabs */}
      {joinableNow && (
        <div className="bg-gradient-to-r from-[#DCFCE7] to-[#F0FDF4] border-b border-[#BBF7D0] px-4 py-2.5">
          <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-[#16A34A] text-white">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                {locale === "ar" ? "مباشر" : "Live"}
              </span>
              <p className="text-xs sm:text-sm font-medium text-[#15803D] truncate">
                {joinableNow.title}
              </p>
            </div>
            {joinableNow.isWebinar && joinableNow.studentWebinarJoinUrl ? (
              <a
                href={joinableNow.studentWebinarJoinUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  setTab("lectures");
                  selectSession(joinableNow.id);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold rounded-md transition-colors flex-shrink-0"
              >
                <Radio className="w-3.5 h-3.5" />
                {tLearning("joinWebinar")}
              </a>
            ) : (
              <button
                type="button"
                onClick={() => handleJoinMeeting(joinableNow.id)}
                disabled={joiningSessionId === joinableNow.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold rounded-md transition-colors disabled:opacity-60 flex-shrink-0"
              >
                {joiningSessionId === joinableNow.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                {tLearning("joinNow")}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? "block" : "hidden"
          } lg:block w-full lg:w-[320px] xl:w-[340px] flex-shrink-0 bg-[var(--color-surface-card)] border-e border-[var(--color-border)] overflow-y-auto`}
          style={{ maxHeight: "calc(100vh - 57px)", position: "sticky", top: 57 }}
        >
          <div className="p-4">
            {/* Tab toggle — pill style, only when both kinds exist */}
            {showTabToggle && (
              <div className="bg-[var(--color-border-subtle)] rounded-lg p-1 grid grid-cols-2 gap-1 mb-4">
                <button
                  type="button"
                  onClick={() => setTab("modules")}
                  className={`text-xs font-medium py-1.5 rounded-md transition-colors ${
                    tab === "modules"
                      ? "bg-[var(--color-surface-card)] text-[var(--color-primary)] shadow-sm"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 inline mr-1" />
                  {tLearning("modulesTab")}
                </button>
                <button
                  type="button"
                  onClick={() => setTab("lectures")}
                  className={`text-xs font-medium py-1.5 rounded-md transition-colors ${
                    tab === "lectures"
                      ? "bg-[var(--color-surface-card)] text-[var(--color-primary)] shadow-sm"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  <Video className="w-3.5 h-3.5 inline mr-1" />
                  {tLearning("lecturesTab")}
                </button>
              </div>
            )}

            {/* MODULES PANEL */}
            {tab === "modules" && showModulesTab && (
              <>
                <h2 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-3">
                  {tLearning("courseContent")}
                </h2>

                {isSequential && (
                  <div className="flex items-start gap-2 mb-3 p-2.5 bg-[#FFFBEB] rounded-lg border border-[#FDE68A]">
                    <Info className="w-3.5 h-3.5 text-[#D97706] flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-[#92400E] leading-snug">
                      {locale === "ar" ? "أكمل كل وحدة بالترتيب لفتح التالية." : "Complete each module in order to unlock the next."}
                    </p>
                  </div>
                )}

                <div className="space-y-0.5">
                  {sortedModules.map((module, index) => {
                    const isActive = module.id === currentModule?.id;
                    const isLocked =
                      index > 0 &&
                      !sortedModules[index - 1].isCompleted &&
                      !module.isCompleted &&
                      isSequential;
                    const { Icon: ModuleIcon, color: iconColor } = getModuleIcon(
                      module.type,
                      module.isCompleted
                    );

                    return (
                      <button
                        key={module.id}
                        onClick={() => {
                          if (isLocked) { showLockedToast(); return; }
                          selectModule(module.id);
                        }}
                        className={`w-full flex items-start gap-3 p-3 rounded-xl text-start transition-colors ${
                          isLocked
                            ? "opacity-50 cursor-not-allowed"
                            : isActive
                              ? "bg-[var(--color-border-subtle)] border border-[#BFDBFE]"
                              : "hover:bg-[var(--color-border-subtle)] cursor-pointer"
                        }`}
                      >
                        <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5
                          bg-[var(--color-border-subtle)] text-[10px] font-semibold text-[var(--color-text-secondary)]">
                          {module.isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                          ) : isLocked ? (
                            <Lock className="w-3 h-3 text-[var(--color-text-secondary)]" />
                          ) : (
                            <span className={isActive ? "text-[var(--color-primary)]" : ""}>{index + 1}</span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-snug ${
                            isLocked
                              ? "text-[var(--color-text-secondary)]"
                              : isActive
                                ? "font-semibold text-[var(--color-primary)]"
                                : module.isCompleted
                                  ? "text-[var(--color-text-secondary)]"
                                  : "font-medium text-[var(--color-text-primary)]"
                          } line-clamp-2`}>
                            {isRTL && module.titleAr ? module.titleAr : module.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <ModuleIcon className={`w-3 h-3 ${isActive && !module.isCompleted ? "text-[var(--color-primary)]" : iconColor}`} />
                            {module.durationMinutes && (
                              <span className="flex items-center gap-0.5 text-[11px] text-[var(--color-text-secondary)]">
                                <Clock className="w-3 h-3" />
                                {module.durationMinutes}m
                              </span>
                            )}
                            {module.isCompleted && (
                              <span className="text-[11px] text-[#16A34A] font-medium">
                                {t("courseDetail.completed")}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* LECTURES PANEL */}
            {tab === "lectures" && showLecturesTab && (
              <>
                {/* Upcoming */}
                {upcomingSessions.length > 0 && (
                  <div className="mb-4">
                    <h2 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                      {tLearning("upcomingHeader")} · {upcomingSessions.length}
                    </h2>
                    <div className="space-y-1">
                      {upcomingSessions.map((s) => (
                        <LectureRow
                          key={s.id}
                          session={s}
                          active={s.id === currentSession?.id}
                          onSelect={() => selectSession(s.id)}
                          attendance={null}
                          formatDate={formatDate}
                          formatTime={formatTime}
                          t={tLearning}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Past — collapsible */}
                {pastSessions.length > 0 && (
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={() => setShowPast((v) => !v)}
                      className="w-full flex items-center justify-between mb-2 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide hover:text-[var(--color-text-primary)] transition-colors"
                    >
                      <span>{tLearning("pastHeader")} · {pastSessions.length}</span>
                      {showPast ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    {showPast && (
                      <>
                        <div className="space-y-1">
                          {pastSessions.slice(0, pastLimit).map((s) => {
                            const att = data.attendanceRecords?.find((r) => r.sessionId === s.id) ?? null;
                            return (
                              <LectureRow
                                key={s.id}
                                session={s}
                                active={s.id === currentSession?.id}
                                onSelect={() => selectSession(s.id)}
                                attendance={att}
                                formatDate={formatDate}
                                formatTime={formatTime}
                                t={tLearning}
                              />
                            );
                          })}
                        </div>
                        {pastSessions.length > pastLimit && (
                          <button
                            onClick={() => setPastLimit((p) => p + 10)}
                            className="w-full mt-2 py-1.5 text-[11px] font-medium text-[var(--color-primary)] hover:bg-[var(--color-border-subtle)] rounded-md transition-colors"
                          >
                            {tLearning("showMore")} ({pastSessions.length - pastLimit})
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Cancelled / Rescheduled */}
                {inactiveSessions.length > 0 && (
                  <div>
                    <h2 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">
                      {tLearning("inactiveHeader")} · {inactiveSessions.length}
                    </h2>
                    <div className="space-y-1 opacity-70">
                      {inactiveSessions.map((s) => (
                        <LectureRow
                          key={s.id}
                          session={s}
                          active={s.id === currentSession?.id}
                          onSelect={() => selectSession(s.id)}
                          attendance={null}
                          formatDate={formatDate}
                          formatTime={formatTime}
                          t={tLearning}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {upcomingSessions.length === 0 && pastSessions.length === 0 && inactiveSessions.length === 0 && (
                  <p className="text-xs text-[var(--color-text-secondary)] text-center py-6">
                    {tLearning("noLectures")}
                  </p>
                )}
              </>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <main
          id="main-content"
          className={`flex-1 overflow-y-auto ${sidebarOpen ? "hidden lg:block" : "block"}`}
          style={{ minHeight: "calc(100vh - 57px)" }}
        >
          {/* MODULES MAIN */}
          {tab === "modules" && (
            currentModule ? (
              <div className="p-4 sm:p-6 lg:p-8 max-w-[860px] mx-auto">
                {/* Module Header */}
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {tLearning("module")} {currentIndex + 1} / {sortedModules.length}
                    </span>
                    {currentModule.isCompleted && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#16A34A]">
                        <CheckCircle2 className="w-3 h-3" />
                        {t("courseDetail.completed")}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                    {isRTL && currentModule.titleAr ? currentModule.titleAr : currentModule.title}
                  </h2>
                </div>

                {/* Content Card */}
                <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden mb-5">
                  {!materialsLoading && materials.length > 1 && (
                    <div className="flex items-center gap-0 border-b border-[var(--color-border)] overflow-x-auto">
                      {materials.map((mat, idx) => {
                        const { Icon } = getModuleIcon(mat.type);
                        return (
                          <button
                            key={mat.id}
                            onClick={() => setActiveMaterialIdx(idx)}
                            className={`flex items-center gap-1.5 px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors ${
                              activeMaterialIdx === idx
                                ? "border-[#002D87] text-[var(--color-primary)] font-medium"
                                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {mat.title.length > 28 ? mat.title.slice(0, 28) + "…" : mat.title}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="p-5 sm:p-6">
                    {materialsLoading ? (
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-7 h-7 text-[var(--color-text-secondary)] animate-spin" />
                      </div>
                    ) : materials.length === 0 ? (
                      currentModule.type === "quiz" ? (
                        <div className="flex flex-col items-center justify-center py-14 text-center">
                          <div className="w-16 h-16 bg-[#FFFBEB] rounded-2xl flex items-center justify-center mb-4">
                            <ClipboardList className="w-8 h-8 text-[#D4A520]" />
                          </div>
                          <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
                            {tLearning("takeAssessment")}
                          </h3>
                          <p className="text-sm text-[var(--color-text-secondary)]">
                            {locale === "ar" ? "أكمل التقييم لهذه الوحدة." : "Complete the assessment for this module."}
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-14 text-center">
                          <div className="w-16 h-16 bg-[var(--color-border-subtle)] rounded-2xl flex items-center justify-center mb-4">
                            <BookOpen className="w-8 h-8 text-[var(--color-text-secondary)]" />
                          </div>
                          <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
                            {tLearning("noMaterials")}
                          </h3>
                          <p className="text-sm text-[var(--color-text-secondary)]">
                            {locale === "ar" ? "لم يتم نشر محتوى لهذه الوحدة بعد." : "No content has been published for this module yet."}
                          </p>
                        </div>
                      )
                    ) : activeMaterial ? (
                      <>
                        {materials.length === 1 && (
                          <div className="flex items-center gap-2 mb-4">
                            {(() => { const { Icon, color } = getModuleIcon(activeMaterial.type); return <Icon className={`w-4 h-4 ${color}`} />; })()}
                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{activeMaterial.title}</h3>
                            <span className="ms-auto text-[11px] px-2 py-0.5 bg-[var(--color-border-subtle)] rounded-full text-[var(--color-text-secondary)] capitalize">
                              {typeBadge(activeMaterial.type)}
                            </span>
                          </div>
                        )}
                        <MaterialRenderer
                          material={activeMaterial}
                          courseId={courseId}
                          moduleId={currentModule?.id}
                          locale={locale}
                          onComplete={() => handleMarkComplete(currentModule!.id)}
                          nextMaterialTitle={
                            materials[activeMaterialIdx + 1]?.title ||
                            (currentIndex < sortedModules.length - 1
                              ? (isRTL && sortedModules[currentIndex + 1].titleAr
                                  ? sortedModules[currentIndex + 1].titleAr
                                  : sortedModules[currentIndex + 1].title) || undefined
                              : undefined)
                          }
                          onNextMaterial={() => {
                            if (activeMaterialIdx < materials.length - 1) {
                              setActiveMaterialIdx(activeMaterialIdx + 1);
                            } else {
                              goToNextModule();
                            }
                          }}
                        />
                      </>
                    ) : null}
                  </div>
                </div>

                {/* Mark Complete + Module Navigation */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  {!currentModule.isCompleted && data?.enrollment?.status !== "completed" ? (
                    <button
                      onClick={() => handleMarkComplete(currentModule.id)}
                      disabled={completingModule === currentModule.id}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#16A34A] text-white text-sm font-medium rounded-xl hover:bg-[#15803D] transition-colors disabled:opacity-60"
                    >
                      {completingModule === currentModule.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      {tLearning("markComplete")}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-2 px-5 py-2.5 text-[#16A34A] text-sm font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      {t("courseDetail.completed")}
                    </span>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={goToPrevModule}
                      disabled={currentIndex === 0}
                      className="flex items-center gap-1.5 px-3 py-2 border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-border-subtle)] transition-colors disabled:opacity-40 text-sm text-[var(--color-text-secondary)]"
                      aria-label={tA("previousModule")}
                    >
                      {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                      {locale === "ar" ? "السابق" : "Prev"}
                    </button>
                    <button
                      onClick={goToNextModule}
                      disabled={currentIndex === sortedModules.length - 1}
                      className="flex items-center gap-1.5 px-3 py-2 border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-border-subtle)] transition-colors disabled:opacity-40 text-sm text-[var(--color-text-secondary)]"
                      aria-label={tA("nextModule")}
                    >
                      {locale === "ar" ? "التالي" : "Next"}
                      {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full p-8">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {hasModules ? tLearning("selectModulePrompt") : tLearning("noModules")}
                </p>
              </div>
            )
          )}

          {/* LECTURES MAIN */}
          {tab === "lectures" && (
            currentSession ? (
              <div className="p-4 sm:p-6 lg:p-8 max-w-[860px] mx-auto">
                <LectureDetailCanvas
                  session={currentSession}
                  attendance={currentAttendance}
                  locale={locale}
                  formatDate={formatDate}
                  formatTime={formatTime}
                  t={tLearning}
                  tDetail={t}
                  onJoinMeeting={handleJoinMeeting}
                  onJoinWebinarRegister={handleWebinarRegister}
                  joiningSessionId={joiningSessionId}
                  enrollmentCompleted={data.enrollment.status === "completed"}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full p-8">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {hasLectures ? tLearning("selectLecturePrompt") : tLearning("noLectures")}
                </p>
              </div>
            )
          )}
        </main>
      </div>
    </div>
  );
};

export default CourseLearningContent;
