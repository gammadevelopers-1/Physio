"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import CourseManagerNavbar from "./CourseManagerNavbar";
import CourseManagerSidebar from "./CourseManagerSidebar";
import CourseManagerMobileSidebar from "./CourseManagerMobileSidebar";
import { useManagerProfile } from "@/hooks/useManagerProfile";
import { useCalendarPreference } from "@/contexts/CalendarContext";
import { useCourseManagerSessions } from "@/hooks/useCourseManagerSessions";
import { courseManagerApi, courseAssistantsApi, reportsApi, type ThresholdStatus } from "@/lib/api";
import {
  Calendar,
  List,
  Video,
  MapPin,
  Clock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CalendarDays,
  Users,
  MoreVertical,
  XCircle,
  CalendarClock,
  UserPlus,
  X,
  Check,
  ClipboardList,
  Download,
  Copy,
  Share2,
  Radio,
  ExternalLink,
} from "lucide-react";
import SkeletonCard from "@/components/shared/SkeletonCard";
import ExportButton from "@/components/shared/ExportButton";
import WebinarRegistrantsDrawer from "@/components/shared/WebinarRegistrantsDrawer";
import { openWebinarWhatsAppShare } from "@/lib/webinar-share";
import DatePicker from "@/components/ui/DatePicker";
import DateTimePicker from "@/components/ui/DateTimePicker";
import { CitySelect } from "@/components/ui/CitySelect";
import { formatDate as formatDateHijri } from "@/lib/hijri";
import { toast } from "sonner";

// 10-color palette for instructor color-coding
const INSTRUCTOR_COLORS = [
  "border-s-[#3B82F6]", "border-s-[#22C55E]", "border-s-[#F59E0B]",
  "border-s-[#EF4444]", "border-s-[#8B5CF6]", "border-s-[#EC4899]",
  "border-s-[#14B8A6]", "border-s-[#F97316]", "border-s-[#6366F1]",
  "border-s-[#84CC16]",
];

// Zoom Webinar add-on capacity. Matches the client's current plan
// (300 attendees). Bump this if/when they upgrade.
const ZOOM_WEBINAR_CAPACITY = 300;

function ScheduleSessionModal({
  courses,
  onClose,
  onScheduled,
  t,
}: {
  courses: { id: string; title: string; deliveryType?: string | null; instructorEmail?: string | null; instructorName?: string | null }[];
  onClose: () => void;
  onScheduled: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"zoom" | "onsite" | "hybrid">("zoom");
  // Sub-format under Zoom: a regular meeting or a webinar (registration page).
  const [zoomFormat, setZoomFormat] = useState<"meeting" | "webinar">("meeting");
  // Webinar Courses can only host Zoom webinars — once a Webinar Course is
  // selected, both the type and zoom-format pickers are locked.
  const isWebinarCourse = useMemo(
    () => courses.find((c) => c.id === courseId)?.deliveryType === "webinar",
    [courses, courseId],
  );
  useEffect(() => {
    if (isWebinarCourse) {
      setType("zoom");
      setZoomFormat("webinar");
    }
  }, [isWebinarCourse]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [durationHours, setDurationHours] = useState(1);
  const [durationMins, setDurationMins] = useState(0);
  const duration = durationHours * 60 + durationMins;
  const [roomName, setRoomName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [city, setCity] = useState("");
  const [zoomLink, setZoomLink] = useState("");
  const [saving, setSaving] = useState(false);

  const isWebinar = type === "zoom" && zoomFormat === "webinar";
  const selectedCourse = courses.find((c) => c.id === courseId);

  // Webinar license precheck for the course instructor — fires when both a
  // course is selected and Webinar format is picked. Non-blocking: just
  // shows a warning chip so the manager can decide whether to proceed.
  const [licenseStatus, setLicenseStatus] = useState<
    null | { hasLicense: boolean; checking: boolean; userExists: boolean }
  >(null);
  useEffect(() => {
    if (!isWebinar || !selectedCourse?.instructorEmail) {
      setLicenseStatus(null);
      return;
    }
    setLicenseStatus({ hasLicense: false, checking: true, userExists: false });
    let cancelled = false;
    const timer = setTimeout(() => {
      courseManagerApi
        .checkWebinarLicense(selectedCourse.instructorEmail!)
        .then((res) => {
          if (cancelled) return;
          setLicenseStatus({
            hasLicense: res.hasWebinarLicense,
            checking: false,
            userExists: res.userExists,
          });
        })
        .catch(() => {
          if (!cancelled) setLicenseStatus(null);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isWebinar, selectedCourse?.instructorEmail]);

  const handleSubmit = async () => {
    if (!courseId || !title.trim() || !date || !time) return;
    const scheduledDate = new Date(`${date}T${time}`);
    if (scheduledDate <= new Date()) {
      toast.error(t("sessionsPage.form.pastTimeError") || "Cannot schedule in the past");
      return;
    }
    if ((type === "onsite" || type === "hybrid") && !venueAddress.trim()) {
      toast.error(t("sessionsPage.form.venueRequired") || "Venue address is required");
      return;
    }
    setSaving(true);
    try {
      const data: Record<string, unknown> = {
        courseId,
        title: title.trim(),
        type,
        scheduledAt: scheduledDate.toISOString(),
        localDate: date,
        durationMinutes: duration,
      };
      if (type === "onsite" || type === "hybrid") {
        if (roomName) data.roomName = roomName;
        if (venueAddress) data.venueAddress = venueAddress;
        if (city) data.city = city;
      }
      if (type === "hybrid" && zoomLink.trim()) {
        data.zoomLink = zoomLink.trim();
      }
      if (type === "zoom" && isWebinar) {
        data.isWebinar = true;
      }
      await courseManagerApi.createSession(data);
      toast.success(t("sessionsPage.schedule.success") || "Lecture scheduled successfully");
      onScheduled();
    } catch (err: any) {
      toast.error(err?.message || t("sessionsPage.schedule.error") || "Failed to schedule lecture");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
      <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          {t("sessionsPage.scheduleSessionTitle")}
        </h2>
        <button onClick={onClose} className="p-2 hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors">
          <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
        </button>
      </div>
      <div className="p-4 space-y-4">
        {/* Course */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {t("sessionsPage.form.course")} *
          </label>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm bg-[var(--color-surface-card)]"
          >
            <option value="">{t("sessionsPage.form.selectCourse")}</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {t("sessionsPage.form.sessionTitle")} *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm"
            placeholder={t("sessionsPage.form.sessionTitlePlaceholder")}
          />
        </div>

        {/* Date + Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
              {t("sessionsPage.form.date")} *
            </label>
            <DatePicker
              value={date}
              onChange={setDate}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
              {t("sessionsPage.form.time")} *
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm"
            />
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
            {t("sessionsPage.form.duration") || "Duration"}
          </label>
          <div className="flex items-center gap-2">
            <input type="number" min={0} value={durationHours} onChange={(e) => setDurationHours(Math.max(0, Number(e.target.value)))} className="w-20 px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm text-center" />
            <span className="text-sm text-[var(--color-text-secondary)]">{t("sessionsPage.form.hours") || "hrs"}</span>
            <input type="number" min={0} max={59} value={durationMins} onChange={(e) => setDurationMins(Math.max(0, Math.min(59, Number(e.target.value))))} className="w-20 px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm text-center" />
            <span className="text-sm text-[var(--color-text-secondary)]">{t("sessionsPage.form.minutes") || "min"}</span>
          </div>
        </div>

        {/* Webinar Course notice — locked to Zoom Webinar, both pickers hidden */}
        {isWebinarCourse && (
          <div className="flex items-start gap-2 p-3 bg-[#FAF5FF] border border-[#E9D5FF] rounded-lg">
            <Radio className="w-4 h-4 text-[#A855F7] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#6B21A8]">
              {t("sessionsPage.form.webinarCourseLock") || "Webinar Course — this lecture will be created as a Zoom Webinar. Other lecture types are not available."}
            </p>
          </div>
        )}

        {/* Session Type — hidden for Webinar Courses (locked to Zoom Webinar) */}
        {!isWebinarCourse && (
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
              {t("sessionsPage.form.sessionType") || "Session Type"}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["zoom", "onsite", "hybrid"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setType(opt)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg transition-colors ${
                    type === opt
                      ? "border-2 border-[var(--color-primary)] bg-[var(--color-border-subtle)] text-[var(--color-primary)]"
                      : "border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]"
                  }`}
                >
                  {opt === "zoom" && <Video className="w-5 h-5" />}
                  {opt === "onsite" && <MapPin className="w-5 h-5" />}
                  {opt === "hybrid" && <RefreshCw className="w-5 h-5" />}
                  <span className="text-xs font-medium">{t(`sessionsPage.type.${opt}`)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Zoom format — Meeting vs Webinar segmented selector — hidden for Webinar Courses */}
        {type === "zoom" && !isWebinarCourse && (
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
              {t("sessionsPage.form.zoomFormat") || "Zoom Format"} *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setZoomFormat("meeting")}
                className={`flex items-start gap-2.5 p-3 rounded-lg text-start transition-colors ${
                  zoomFormat === "meeting"
                    ? "border-2 border-[var(--color-primary)] bg-[var(--color-border-subtle)]"
                    : "border border-[var(--color-border)] hover:border-[var(--color-primary)]"
                }`}
              >
                <Video className={`w-5 h-5 flex-shrink-0 mt-0.5 ${zoomFormat === "meeting" ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)]"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${zoomFormat === "meeting" ? "text-[var(--color-primary)]" : "text-[var(--color-text-primary)]"}`}>
                    {t("sessionsPage.form.zoomMeeting") || "Zoom Meeting"}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-snug">
                    {t("sessionsPage.form.zoomMeetingHint") || "Live class for enrolled students. Counts toward attendance."}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setZoomFormat("webinar")}
                className={`flex items-start gap-2.5 p-3 rounded-lg text-start transition-colors ${
                  zoomFormat === "webinar"
                    ? "border-2 border-[#A855F7] bg-[#FAF5FF]"
                    : "border border-[var(--color-border)] hover:border-[#A855F7]"
                }`}
              >
                <Radio className={`w-5 h-5 flex-shrink-0 mt-0.5 ${zoomFormat === "webinar" ? "text-[#A855F7]" : "text-[var(--color-text-secondary)]"}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${zoomFormat === "webinar" ? "text-[#7C3AED]" : "text-[var(--color-text-primary)]"}`}>
                    {t("sessionsPage.form.zoomWebinar") || "Zoom Webinar"}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 leading-snug">
                    {t("sessionsPage.form.zoomWebinarHint") || "Public registration link. Shareable. Does not count for course progress."}
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Info ribbon — context-aware */}
        {type === "zoom" && (
          <div className={`flex items-start gap-2 p-3 rounded-lg ${isWebinar ? "bg-[#FAF5FF] border border-[#E9D5FF]" : "bg-[var(--color-border-subtle)]"}`}>
            {isWebinar ? (
              <Radio className="w-4 h-4 text-[#A855F7] flex-shrink-0 mt-0.5" />
            ) : (
              <Video className="w-4 h-4 text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
            )}
            <p className={`text-xs ${isWebinar ? "text-[#6B21A8]" : "text-[#1E40AF]"}`}>
              {isWebinar
                ? (t("sessionsPage.zoomAutoCreateWebinar") || "Public registration page is created on Zoom. Share its link via WhatsApp; Zoom emails each registrant their personal join link automatically.")
                : (t("sessionsPage.zoomAutoCreate") || "Zoom meeting will be auto-created for the instructor.")}
            </p>
          </div>
        )}
        {type === "hybrid" && (
          <div className="flex items-start gap-2 p-3 bg-[var(--color-border-subtle)] rounded-lg">
            <Video className="w-4 h-4 text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[#1E40AF]">
              {t("sessionsPage.zoomAutoCreate") || "Zoom meeting will be auto-created for the instructor."}
            </p>
          </div>
        )}

        {/* License precheck warning — webinar + course selected */}
        {isWebinar && licenseStatus && !licenseStatus.checking && (
          (!licenseStatus.hasLicense || !licenseStatus.userExists) && (
            <div className="flex items-start gap-2 p-3 bg-[#FFFBEB] border border-[#FCD34D] rounded-lg">
              <AlertTriangle className="w-4 h-4 text-[#D97706] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#92400E] leading-snug">
                {!licenseStatus.userExists
                  ? (t("sessionsPage.form.instructorNotOnZoom") || "Instructor doesn't have a Zoom account on this workspace. The webinar will be hosted from the platform owner account.")
                  : (t("sessionsPage.form.instructorNoWebinarLicense") || "Instructor has no Webinar license. The webinar will be created under the platform owner account instead.")}
              </p>
            </div>
          )
        )}

        {/* Venue fields */}
        {(type === "onsite" || type === "hybrid") && (
          <>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                {t("sessionsPage.form.roomName") || "Room Name"}
              </label>
              <input type="text" value={roomName} onChange={(e) => setRoomName(e.target.value)} className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm" placeholder={t("sessionsPage.form.roomNamePlaceholder") || "e.g. Room 101"} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                {t("sessionsPage.form.venueAddress") || "Venue Address"} *
              </label>
              <input type="text" value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} className="w-full px-3 py-2.5 border border-[var(--color-input-border)] rounded-lg text-sm" placeholder={t("sessionsPage.form.venueAddressPlaceholder") || "Enter venue address"} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
                {t("sessionsPage.form.city") || "City"}
              </label>
              <CitySelect
                value={city}
                onChange={setCity}
                placeholder={t("sessionsPage.form.cityPlaceholder") || "Select city"}
              />
            </div>
          </>
        )}
      </div>
      <div className="flex items-center justify-end gap-3 p-4 border-t border-[var(--color-border)]">
        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
          {t("sessionsPage.form.cancel")}
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving || !courseId || !title.trim() || !date || !time}
          className="inline-flex items-center gap-2 px-4 py-2 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {t("sessionsPage.form.schedule")}
        </button>
      </div>
    </div>
  );
}

// Extended session type with instructor + capacity fields from backend
interface SessionWithInstructor {
  id: string;
  courseId: string;
  instructorId: string;
  title: string;
  type: "zoom" | "onsite" | "hybrid";
  scheduledAt: string;
  durationMinutes: number;
  zoomLink: string | null;
  meetingId: string | null;
  isWebinar?: boolean;
  zoomWebinarId?: string | null;
  webinarRegistrationUrl?: string | null;
  venueAddress: string | null;
  status: "scheduled" | "live" | "ended" | "completed" | "cancelled" | "missed" | "rescheduled";
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  instructorFirstName?: string;
  instructorLastName?: string;
  instructorEmail?: string;
  enrolledCount?: number;
  nelcLimit?: number;
  capacityPercent?: number;
}

interface InstructorOption {
  id: string;
  name: string;
}

interface AttendanceEntry {
  id: string;
  studentId: string;
  status: string;
  joinedAt: string | null;
  leftAt: string | null;
  durationMinutes: number | null;
  note: string | null;
  studentFirstName: string | null;
  studentLastName: string | null;
  studentEmail: string;
}

const SessionsContent = () => {
  const t = useTranslations("courseManagerDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  // Global preference still drives the list-view date formatting. The
  // calendar grid below has its own local toggle so flipping it doesn't
  // bleed into every date picker / list across the dashboard.
  const { calendarFormat } = useCalendarPreference();
  const settingDefault: "hijri" | "gregorian" =
    calendarFormat === "hijri" ? "hijri" : "gregorian";
  const [calendarView, setCalendarView] = useState<"hijri" | "gregorian">(settingDefault);
  const [calendarViewTouched, setCalendarViewTouched] = useState(false);
  useEffect(() => {
    if (!calendarViewTouched) setCalendarView(settingDefault);
  }, [settingDefault, calendarViewTouched]);
  const useHijri = calendarView === "hijri";
  const manager = useManagerProfile();
  const [viewMode, setViewMode] = useState<"calendar" | "list">("list");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [instructorFilter, setInstructorFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [conflicts, setConflicts] = useState<Array<{
    sessionA: { id: string; title: string };
    sessionB: { id: string; title: string };
    instructorName: string;
  }>>([]);

  // Advanced filters
  const [courseFilter, setCourseFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [coursesList, setCoursesList] = useState<{ id: string; title: string; deliveryType?: string | null; instructorEmail?: string | null; instructorName?: string | null }[]>([]);

  // Action modal states
  const [actionDropdown, setActionDropdown] = useState<string | null>(null);
  const [cancelModal, setCancelModal] = useState<{ id: string; title: string } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [rescheduleModal, setRescheduleModal] = useState<{ id: string; title: string; scheduledAt: string } | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [substituteModal, setSubstituteModal] = useState<{ id: string; title: string } | null>(null);
  const [substituteId, setSubstituteId] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(false);

  // Attendance modal state
  const [attendanceModal, setAttendanceModal] = useState<{ id: string; title: string; courseId: string } | null>(null);
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf" | "xlsx">("csv");
  const [attendanceData, setAttendanceData] = useState<Array<{
    studentId: string;
    status: string;
    joinedAt: string | null;
    leftAt: string | null;
    durationMinutes: number | null;
    note: string | null;
    studentFirstName?: string;
    studentLastName?: string;
    studentEmail?: string;
  }>>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Webinar registrants drawer (shared component fetches its own data) +
  // per-row registered counts so the inline chip on each webinar row shows
  // the count without opening the drawer.
  const [registrantsDrawer, setRegistrantsDrawer] = useState<{
    sessionId: string;
    sessionTitle: string;
    registrationUrl: string | null;
    scheduledAt: string;
    sessionStatus: string;
    zoomWebinarId: string | null;
    courseName: string | null;
  } | null>(null);
  const [webinarCounts, setWebinarCounts] = useState<Record<string, { registered: number; attended: number }>>({});

  // Build dateRange for backend: "YYYY-MM-DD,YYYY-MM-DD"
  const dateRange = useMemo(() => {
    if (dateFrom && dateTo) return `${dateFrom},${dateTo}`;
    if (dateFrom) return `${dateFrom},`;
    if (dateTo) return `,${dateTo}`;
    return undefined;
  }, [dateFrom, dateTo]);

  const { sessions: rawSessions, totalPages, loading, error, refetch } =
    useCourseManagerSessions({
      status: statusFilter || undefined,
      instructorId: instructorFilter || undefined,
      courseId: courseFilter || undefined,
      dateRange,
      page: currentPage,
      limit: 20,
    });

  // Cast to extended type since backend now includes instructor fields
  // Apply client-side type filter (not supported by backend)
  const sessions = useMemo(() => {
    const all = rawSessions as unknown as SessionWithInstructor[];
    if (!typeFilter) return all;
    return all.filter((s) => s.type === typeFilter);
  }, [rawSessions, typeFilter]);

  // Lazy-load registrant counts for visible webinar rows so the row chip
  // shows "X registered" without each row firing on mount.
  useEffect(() => {
    const webinarSessionIds = sessions
      .filter((s) => s.isWebinar && !webinarCounts[s.id])
      .map((s) => s.id);
    if (webinarSessionIds.length === 0) return;
    let cancelled = false;
    Promise.all(
      webinarSessionIds.map((id) =>
        courseManagerApi
          .getWebinarRegistrants(id)
          .then((res) => [id, { registered: res.totalRegistered, attended: res.totalAttended }] as const)
          .catch(() => null),
      ),
    ).then((results) => {
      if (cancelled) return;
      setWebinarCounts((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r) next[r[0]] = r[1];
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [sessions, webinarCounts]);

  // Helpers — copy + WhatsApp share for the webinar registration link
  const handleCopyRegistrationLink = (url: string | null | undefined) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    toast.success(isRTL ? "تم نسخ الرابط" : "Registration link copied");
  };
  const handleShareWhatsApp = (
    title: string,
    scheduledAt: string,
    url: string | null | undefined,
    durationMinutes?: number | null,
    zoomWebinarId?: string | null,
    courseName?: string | null,
  ) => {
    if (!url) return;
    openWebinarWhatsAppShare({
      title,
      scheduledAt,
      registrationUrl: url,
      durationMinutes: durationMinutes ?? undefined,
      zoomWebinarId: zoomWebinarId ?? null,
      courseName: courseName ?? null,
      locale,
    });
  };

  // Open registrants drawer — the shared <WebinarRegistrantsDrawer />
  // handles its own fetch; we just hand it the session metadata.
  const openRegistrantsDrawer = (session: SessionWithInstructor) => {
    setRegistrantsDrawer({
      sessionId: session.id,
      sessionTitle: session.title,
      registrationUrl: session.webinarRegistrationUrl || null,
      scheduledAt: session.scheduledAt,
      sessionStatus: session.status,
      zoomWebinarId: session.zoomWebinarId ?? null,
      courseName: coursesList.find((c) => c.id === session.courseId)?.title ?? null,
    });
  };

  // TA threshold status per course
  const [taThresholds, setTaThresholds] = useState<Record<string, ThresholdStatus>>({});

  useEffect(() => {
    if (sessions.length === 0) return;
    const courseIds = [...new Set(sessions.map((s) => s.courseId))];
    Promise.all(
      courseIds.map((id) =>
        courseAssistantsApi.getThresholdStatus(id).then((status) => [id, status] as const).catch(() => null)
      )
    ).then((results) => {
      const map: Record<string, ThresholdStatus> = {};
      for (const r of results) {
        if (r) map[r[0]] = r[1];
      }
      setTaThresholds(map);
    });
  }, [sessions]);

  // Fetch instructors and courses for filter dropdowns
  useEffect(() => {
    courseManagerApi.getInstructors().then((data) => {
      setInstructors(
        data.map((i) => ({
          id: i.id,
          name: `${i.firstName || ""} ${i.lastName || ""}`.trim() || i.email,
        }))
      );
    }).catch(() => {});
    courseManagerApi.getCourses({ limit: 200 }).then((res) => {
      setCoursesList((res.data || []).filter((c: any) => c.status === "active" && c.deliveryType !== "self-paced").map((c: any) => ({
        id: c.id,
        title: c.title,
        deliveryType: c.deliveryType || null,
        instructorEmail: c.instructorEmail || c.instructor?.email || null,
        instructorName: c.instructorName || (c.instructor ? `${c.instructor.firstName || ""} ${c.instructor.lastName || ""}`.trim() : null) || null,
      })));
    }).catch(() => {});
  }, []);

  // Fetch conflicts
  useEffect(() => {
    courseManagerApi.getSessionConflicts().then(setConflicts).catch(() => {});
  }, []);

  // Build instructor color map
  const instructorColorMap = useMemo(() => {
    const map = new Map<string, string>();
    const allInstructorIds = [...new Set(sessions.map((s) => s.instructorId).filter(Boolean))];
    allInstructorIds.forEach((id, i) => {
      map.set(id, INSTRUCTOR_COLORS[i % INSTRUCTOR_COLORS.length]);
    });
    return map;
  }, [sessions]);

  // Build conflict set for highlighting
  const conflictSessionIds = useMemo(() => {
    const ids = new Set<string>();
    conflicts.forEach((c) => {
      ids.add(c.sessionA.id);
      ids.add(c.sessionB.id);
    });
    return ids;
  }, [conflicts]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      scheduled: { bg: "bg-[var(--color-border-subtle)]", text: "text-[var(--color-primary)]", label: t("sessionsPage.statusUpcoming") },
      live: { bg: "bg-[#FEE2E2]", text: "text-[#EF4444]", label: t("sessionsPage.statusLive") },
      ended: { bg: "bg-[#FEF3C7]", text: "text-[#D97706]", label: t("sessionsPage.statusEnded") },
      completed: { bg: "bg-[#DCFCE7]", text: "text-[#22C55E]", label: t("sessionsPage.statusCompleted") },
      cancelled: { bg: "bg-[var(--color-border-subtle)]", text: "text-[var(--color-text-secondary)]", label: t("sessionsPage.statusCancelled") },
      missed: { bg: "bg-[#FEE2E2]", text: "text-[#EF4444]", label: "Missed" },
      rescheduled: { bg: "bg-[#FEF3C7]", text: "text-[#D97706]", label: "Rescheduled" },
    };
    return styles[status] || styles.scheduled;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "onsite":
        return <MapPin className="w-4 h-4" />;
      case "hybrid":
        return <RefreshCw className="w-4 h-4" />;
      default:
        return <Video className="w-4 h-4" />;
    }
  };

  const getTypeBadgeStyle = (type: string) => {
    const styles: Record<string, string> = {
      zoom: "bg-[var(--color-border-subtle)] text-[var(--color-primary)]",
      onsite: "bg-[#DCFCE7] text-[#22C55E]",
      hybrid: "bg-[#F3E8FF] text-[#9333EA]",
    };
    return styles[type] || styles.zoom;
  };

  const formatDate = (dateStr: string) => {
    return formatDateHijri(dateStr, calendarFormat, { locale });
  };

  const formatTime = (dateStr: string, durationMins: number) => {
    const start = new Date(dateStr);
    const end = new Date(start.getTime() + durationMins * 60000);
    return `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  const getInstructorName = (session: SessionWithInstructor) => {
    const first = session.instructorFirstName || "";
    const last = session.instructorLastName || "";
    return `${first} ${last}`.trim() || session.instructorEmail || "";
  };

  const handleCancelOnBehalf = async () => {
    if (!cancelModal || !cancelReason) return;
    setActionLoading(true);
    try {
      await courseManagerApi.cancelSessionOnBehalf(cancelModal.id, cancelReason);
      setActionSuccess(true);
      setTimeout(() => { setCancelModal(null); setCancelReason(""); setActionSuccess(false); refetch(); }, 1200);
    } catch { /* ignore */ }
    setActionLoading(false);
  };

  const handleReschedule = async () => {
    if (!rescheduleModal || !rescheduleDate) return;
    setActionLoading(true);
    try {
      const isoDate = new Date(rescheduleDate).toISOString();
      await courseManagerApi.rescheduleSession(rescheduleModal.id, isoDate);
      setActionSuccess(true);
      toast.success(isRTL ? "تم إعادة جدولة المحاضرة" : "Lecture rescheduled successfully");
      setTimeout(() => { setRescheduleModal(null); setRescheduleDate(""); setActionSuccess(false); refetch(); }, 1200);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : (isRTL ? "فشل في إعادة الجدولة" : "Failed to reschedule"));
    }
    setActionLoading(false);
  };

  const handleAssignSubstitute = async () => {
    if (!substituteModal || !substituteId) return;
    setActionLoading(true);
    try {
      await courseManagerApi.assignSubstitute(substituteModal.id, substituteId);
      setActionSuccess(true);
      setTimeout(() => { setSubstituteModal(null); setSubstituteId(""); setActionSuccess(false); refetch(); }, 1200);
    } catch { /* ignore */ }
    setActionLoading(false);
  };

  // Fetch attendance when modal opens
  useEffect(() => {
    if (attendanceModal) {
      setAttendanceLoading(true);
      setAttendanceData([]);
      courseManagerApi.getSessionAttendance(attendanceModal.id)
        .then((data) => setAttendanceData(data as any))
        .catch(() => {})
        .finally(() => setAttendanceLoading(false));
    }
  }, [attendanceModal]);

  const attendanceStats = useMemo(() => {
    const total = attendanceData.length;
    const present = attendanceData.filter((a) => a.status === "present").length;
    const absent = attendanceData.filter((a) => a.status === "absent").length;
    const late = attendanceData.filter((a) => a.status === "late").length;
    const excused = attendanceData.filter((a) => a.status === "excused").length;
    return { total, present, absent, late, excused };
  }, [attendanceData]);

  // ── Hijri calendar helpers (Umm al-Qura) ──
  const hijriFormatter = useMemo(() => new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { day: "numeric", month: "numeric", year: "numeric" }), []);
  const getHijriParts = (date: Date) => {
    const parts = hijriFormatter.formatToParts(date);
    return {
      day: parseInt(parts.find((p) => p.type === "day")?.value || "0"),
      month: parseInt(parts.find((p) => p.type === "month")?.value || "0"),
      year: parseInt(parts.find((p) => p.type === "year")?.value || "0"),
    };
  };

  // Find Gregorian date for the 1st of the Hijri month containing `date`
  const getHijriMonthStart = (date: Date): Date => {
    const d = new Date(date);
    while (getHijriParts(d).day > 1) d.setDate(d.getDate() - 1);
    return d;
  };

  // Build array of Gregorian dates for each day in the Hijri month containing `date`
  const getHijriMonthDays = (date: Date): Date[] => {
    const start = getHijriMonthStart(date);
    const { month } = getHijriParts(start);
    const days: Date[] = [];
    const d = new Date(start);
    while (getHijriParts(d).month === month) {
      days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return days;
  };

  const hijriMonthNames = [
    "محرّم", "صفر", "ربيع الأول", "ربيع الثاني",
    "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان",
    "رمضان", "شوّال", "ذو القعدة", "ذو الحجة",
  ];

  // ── Calendar computations (Hijri when toggled, Gregorian otherwise) ──
  const calendarData = useMemo(() => {
    if (useHijri) {
      const hijriDays = getHijriMonthDays(selectedDate);
      const firstDay = hijriDays[0];
      const { month, year } = getHijriParts(firstDay);
      return {
        daysInMonth: hijriDays.length,
        firstDayOfMonth: firstDay.getDay(),
        headerLabel: `${hijriMonthNames[month - 1]} ${year}`,
        getGregorianDate: (dayIndex: number) => hijriDays[dayIndex - 1],
      };
    }
    const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getDay();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return {
      daysInMonth,
      firstDayOfMonth,
      headerLabel: `${monthNames[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`,
      getGregorianDate: (dayIndex: number) => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), dayIndex),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, useHijri]);

  const dayNames = useHijri
    ? ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getSessionsForDate = (day: number) => {
    const gDate = calendarData.getGregorianDate(day);
    const dateStr = `${gDate.getFullYear()}-${String(gDate.getMonth() + 1).padStart(2, "0")}-${String(gDate.getDate()).padStart(2, "0")}`;
    return sessions.filter((s) => s.scheduledAt.startsWith(dateStr));
  };

  // Navigate to next/prev month (Hijri-aware)
  const goToPrevMonth = () => {
    if (useHijri) {
      const start = getHijriMonthStart(selectedDate);
      const prev = new Date(start);
      prev.setDate(prev.getDate() - 1); // last day of previous Hijri month
      setSelectedDate(prev);
    } else {
      setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1));
    }
  };
  const goToNextMonth = () => {
    if (useHijri) {
      const days = getHijriMonthDays(selectedDate);
      const nextDay = new Date(days[days.length - 1]);
      nextDay.setDate(nextDay.getDate() + 1);
      setSelectedDate(nextDay);
    } else {
      setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1));
    }
  };

  const today = new Date().toISOString().split("T")[0];
  const todaySessions = sessions.filter((s) => s.scheduledAt.startsWith(today));
  const upcomingSessions = sessions.filter(
    (s) => !s.scheduledAt.startsWith(today) && (s.status === "scheduled" || s.status === "live")
  );
  const pastSessions = sessions.filter((s) => s.status === "completed" || s.status === "cancelled" || s.status === "ended");
  const [showPast, setShowPast] = useState(false);

  const renderSessionRow = (session: SessionWithInstructor, showDate = false, dimmed = false) => {
    const colorClass = instructorColorMap.get(session.instructorId) || "";
    const isConflict = conflictSessionIds.has(session.id);
    const instructorName = getInstructorName(session);

    return (
      <div
        key={session.id}
        className={`p-4 hover:bg-[var(--color-border-subtle)] transition-colors border-s-4 ${colorClass} ${dimmed ? "opacity-75" : ""} ${isConflict ? "bg-[#FEF2F2]" : ""}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${dimmed ? "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]" : getTypeBadgeStyle(session.type)}`}>
              {getTypeIcon(session.type)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`text-sm font-semibold ${dimmed ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text-primary)]"}`}>
                  {session.title}
                </h3>
                {isConflict && (
                  <span className="px-1.5 py-0.5 bg-[#FEE2E2] text-[#EF4444] text-[10px] font-semibold rounded">
                    CONFLICT
                  </span>
                )}
                {session.isWebinar && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#A855F7] text-white text-[10px] font-bold rounded-full uppercase tracking-wide">
                    <Radio className="w-3 h-3" />
                    {isRTL ? "ندوة" : "Webinar"}
                  </span>
                )}
                {taThresholds[session.courseId] && taThresholds[session.courseId].requiredTAs > 0 && (
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    taThresholds[session.courseId].deficit > 0
                      ? "bg-[#FEF2F2] text-[#EF4444]"
                      : "bg-[#DCFCE7] text-[#22C55E]"
                  }`}>
                    <Users className="w-3 h-3" />
                    {taThresholds[session.courseId].activeTAs}/{taThresholds[session.courseId].requiredTAs} TA
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-[var(--color-text-secondary)]">
                {showDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(session.scheduledAt)}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatTime(session.scheduledAt, session.durationMinutes)}
                </span>
                {instructorName && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {instructorName}
                  </span>
                )}
                {session.venueAddress && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {session.venueAddress}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {session.isWebinar && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); openRegistrantsDrawer(session); }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#FAF5FF] hover:bg-[#F3E8FF] border border-[#E9D5FF] text-[#7C3AED] text-xs font-semibold transition-colors"
                  title={isRTL ? "عرض المسجلين" : "View registrants"}
                >
                  <Users className="w-3.5 h-3.5" />
                  {webinarCounts[session.id]?.registered ?? 0}/{ZOOM_WEBINAR_CAPACITY}
                  <span className="hidden sm:inline">
                    {isRTL ? " مسجل" : " registered"}
                  </span>
                </button>
                {session.webinarRegistrationUrl && session.status === "scheduled" && (
                  <>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleCopyRegistrationLink(session.webinarRegistrationUrl); }}
                      className="p-1.5 rounded-md text-[#7C3AED] hover:bg-[#F3E8FF] transition-colors"
                      title={isRTL ? "نسخ رابط التسجيل" : "Copy registration link"}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleShareWhatsApp(session.title, session.scheduledAt, session.webinarRegistrationUrl, session.durationMinutes, session.zoomWebinarId, coursesList.find((c) => c.id === session.courseId)?.title ?? null); }}
                      className="p-1.5 rounded-md text-[#25D366] hover:bg-[#DCFCE7] transition-colors"
                      title={isRTL ? "مشاركة عبر واتساب" : "Share via WhatsApp"}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            )}
            {!session.isWebinar && session.nelcLimit != null && session.nelcLimit > 0 && (
              <div className="flex items-center gap-2 min-w-[120px]">
                <div className="flex-1 h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (session.capacityPercent || 0) > 95
                        ? "bg-[#EF4444]"
                        : (session.capacityPercent || 0) > 80
                        ? "bg-[#F59E0B]"
                        : "bg-[#22C55E]"
                    }`}
                    style={{ width: `${Math.min(session.capacityPercent || 0, 100)}%` }}
                  />
                </div>
                <span className={`text-xs font-medium whitespace-nowrap ${
                  (session.capacityPercent || 0) > 95
                    ? "text-[#EF4444]"
                    : (session.capacityPercent || 0) > 80
                    ? "text-[#F59E0B]"
                    : "text-[var(--color-text-secondary)]"
                }`}>
                  {session.enrolledCount || 0}/{session.nelcLimit}
                </span>
              </div>
            )}
            <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${getStatusBadge(session.status).bg} ${getStatusBadge(session.status).text}`}>
              {getStatusBadge(session.status).label}
            </span>
            {/* Action dropdown */}
            {(() => {
              // Hide the kebab entirely when no menu items would render.
              // Items: View Attendance (non-webinar + ended-ish), or
              // Cancel/Reschedule (scheduled or live).
              const hasViewAttendance = !session.isWebinar && (
                session.status === "completed" ||
                session.status === "ended" ||
                session.status === "cancelled"
              );
              const hasLifecycleActions = session.status === "scheduled" || session.status === "live";
              const hasActions = hasViewAttendance || hasLifecycleActions;
              if (!hasActions) return null;
              return (
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setActionDropdown(actionDropdown === session.id ? null : session.id); }}
                className="p-1.5 hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors"
              >
                <MoreVertical className="w-4 h-4 text-[var(--color-text-secondary)]" />
              </button>
              {actionDropdown === session.id && (
                <div className={`absolute ${isRTL ? "left-0" : "right-0"} top-full mt-1 w-48 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg shadow-lg z-10 py-1`}>
                  {!session.isWebinar && (session.status === "completed" || session.status === "ended" || session.status === "cancelled") && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setActionDropdown(null); setAttendanceModal({ id: session.id, title: session.title, courseId: session.courseId }); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)]"
                    >
                      <Users className="w-4 h-4" /> {t("sessionsPage.viewAttendance")}
                    </button>
                  )}
                  {/* Webinar registrants drawer is opened from the inline
                      chip on the row — no duplicate entry in dropdown. */}
                  {(session.status === "scheduled" || session.status === "live") && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); setActionDropdown(null); setCancelModal({ id: session.id, title: session.title }); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#EF4444] hover:bg-[#FEF2F2]"
                      >
                        <XCircle className="w-4 h-4" /> {t("sessionsPage.cancelSession")}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setActionDropdown(null); setRescheduleModal({ id: session.id, title: session.title, scheduledAt: session.scheduledAt }); (() => { const d = new Date(session.scheduledAt); const local = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}T${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; setRescheduleDate(local); })(); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)]"
                      >
                        <CalendarClock className="w-4 h-4" /> {t("sessionsPage.reschedule")}
                      </button>
                      {false && <button
                        onClick={(e) => { e.stopPropagation(); setActionDropdown(null); setSubstituteModal({ id: session.id, title: session.title }); setSubstituteId(""); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)]"
                      >
                        <UserPlus className="w-4 h-4" /> {t("sessionsPage.assignSubstitute")}
                      </button>}
                    </>
                  )}
                </div>
              )}
            </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <CourseManagerNavbar manager={manager} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <CourseManagerSidebar manager={manager} />
            </div>
            <CourseManagerMobileSidebar manager={manager} />

            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{t("sessionsPage.title")}</h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">{t("sessionsPage.subtitle")}</p>
                </div>
                <button
                  onClick={() => setShowScheduleModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg"
                >
                  <CalendarDays className="w-4 h-4" />
                  {t("sessionsPage.scheduleSession")}
                </button>
              </div>

              {/* Filters row */}
              <div className="flex items-center gap-3 flex-wrap mb-6">
                <div className="flex items-center bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg p-1">
                  <button
                    onClick={() => setViewMode("list")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === "list" ? "btn-gold text-[var(--color-button-text)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}
                  >
                    <List className="w-4 h-4" />
                    {t("sessionsPage.listView")}
                  </button>
                  <button
                    onClick={() => setViewMode("calendar")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === "calendar" ? "btn-gold text-[var(--color-button-text)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}
                  >
                    <Calendar className="w-4 h-4" />
                    {t("sessionsPage.calendarView")}
                  </button>
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                  className="px-3 py-2 border border-[var(--color-input-border)] rounded-lg text-sm bg-[var(--color-surface-card)]"
                >
                  <option value="">{t("sessionsPage.allStatuses")}</option>
                  <option value="scheduled">{t("sessionsPage.statusUpcoming")}</option>
                  <option value="live">{t("sessionsPage.statusLive")}</option>
                  <option value="ended">{t("sessionsPage.statusEnded")}</option>
                  <option value="completed">{t("sessionsPage.statusCompleted")}</option>
                  <option value="cancelled">{t("sessionsPage.statusCancelled")}</option>
                </select>
                <select
                  value={instructorFilter}
                  onChange={(e) => { setInstructorFilter(e.target.value); setCurrentPage(1); }}
                  className="px-3 py-2 border border-[var(--color-input-border)] rounded-lg text-sm bg-[var(--color-surface-card)]"
                >
                  <option value="">{t("sessionsPage.allInstructors")}</option>
                  {instructors.map((inst) => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setShowMoreFilters(!showMoreFilters)}
                  className="px-3 py-2 text-sm text-[var(--color-primary)] border border-[var(--color-primary)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
                >
                  {showMoreFilters ? t("sessionsPage.lessFilters") : t("sessionsPage.moreFilters")}
                </button>
              </div>

              {/* Advanced Filters Panel */}
              {showMoreFilters && (
                <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl p-4 mb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{t("sessionsPage.filterByCourse")}</label>
                      <select
                        value={courseFilter}
                        onChange={(e) => { setCourseFilter(e.target.value); setCurrentPage(1); }}
                        className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-lg text-sm bg-[var(--color-surface-card)]"
                      >
                        <option value="">{t("sessionsPage.allCourses")}</option>
                        {coursesList.map((c) => (
                          <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{t("sessionsPage.filterByType")}</label>
                      <select
                        value={typeFilter}
                        onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
                        className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-lg text-sm bg-[var(--color-surface-card)]"
                      >
                        <option value="">{t("sessionsPage.allTypes")}</option>
                        <option value="zoom">{t("sessionsPage.typeZoom")}</option>
                        <option value="onsite">{t("sessionsPage.typeOnsite")}</option>
                        <option value="hybrid">{t("sessionsPage.typeHybrid")}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{t("sessionsPage.dateFrom")}</label>
                      <DatePicker
                        value={dateFrom}
                        onChange={(v) => { setDateFrom(v); setCurrentPage(1); }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--color-text-secondary)] mb-1">{t("sessionsPage.dateTo")}</label>
                      <DatePicker
                        value={dateTo}
                        onChange={(v) => { setDateTo(v); setCurrentPage(1); }}
                      />
                    </div>
                  </div>
                  {(courseFilter || typeFilter || dateFrom || dateTo) && (
                    <button
                      onClick={() => { setCourseFilter(""); setTypeFilter(""); setDateFrom(""); setDateTo(""); setCurrentPage(1); }}
                      className="mt-3 text-xs text-[#EF4444] hover:text-[#B91C1C] transition-colors"
                    >
                      {t("sessionsPage.clearFilters")}
                    </button>
                  )}
                </div>
              )}

              {/* Conflict Warning Banner */}
              {conflicts.length > 0 && (
                <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-4 mb-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-[#991B1B]">
                      {conflicts.length} scheduling conflict{conflicts.length > 1 ? "s" : ""} detected
                    </p>
                    <p className="text-xs text-[#B91C1C] mt-1">
                      {conflicts.slice(0, 3).map((c, i) => (
                        <span key={i}>
                          {c.instructorName}: &quot;{c.sessionA.title}&quot; overlaps with &quot;{c.sessionB.title}&quot;
                          {i < Math.min(conflicts.length, 3) - 1 ? " • " : ""}
                        </span>
                      ))}
                      {conflicts.length > 3 && ` and ${conflicts.length - 3} more...`}
                    </p>
                  </div>
                </div>
              )}

              {loading && (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              )}

              {error && (
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-12 text-center">
                  <AlertTriangle className="w-8 h-8 text-[#EF4444] mx-auto mb-3" />
                  <p className="text-sm text-[var(--color-text-secondary)] mb-4">{error}</p>
                  <button onClick={refetch} className="px-4 py-2 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg">{t("dashboard.retry")}</button>
                </div>
              )}

              {!loading && !error && sessions.length === 0 && (
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-12 text-center">
                  <CalendarDays className="w-12 h-12 text-[var(--color-text-secondary)] mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">{t("sessionsPage.noSessions")}</h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">{t("sessionsPage.noSessionsDesc")}</p>
                </div>
              )}

              {!loading && !error && sessions.length > 0 && viewMode === "list" && (
                <div className="space-y-4">
                  {todaySessions.length > 0 && (
                    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)]">
                      <div className="p-4 border-b border-[var(--color-border)]">
                        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{t("sessionsPage.today")}</h2>
                      </div>
                      <div className="divide-y divide-[var(--color-border)]">
                        {todaySessions.map((session) => renderSessionRow(session))}
                      </div>
                    </div>
                  )}

                  {upcomingSessions.length > 0 && (
                    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)]">
                      <div className="p-4 border-b border-[var(--color-border)]">
                        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{t("sessionsPage.upcoming")}</h2>
                      </div>
                      <div className="divide-y divide-[var(--color-border)]">
                        {upcomingSessions.map((session) => renderSessionRow(session, true))}
                      </div>
                    </div>
                  )}

                  {pastSessions.length > 0 && (
                    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)]">
                      <button
                        onClick={() => setShowPast(!showPast)}
                        className="w-full flex items-center justify-between p-4 hover:bg-[var(--color-border-subtle)] transition-colors rounded-xl"
                      >
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{t("sessionsPage.past")}</h2>
                          <span className="text-xs font-medium text-[var(--color-text-secondary)] bg-[var(--color-border-subtle)] px-2 py-0.5 rounded-full">{pastSessions.length}</span>
                        </div>
                        <ChevronDown className={`w-5 h-5 text-[var(--color-text-secondary)] transition-transform ${showPast ? "rotate-180" : ""}`} />
                      </button>
                      {showPast && (
                        <>
                          <div className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
                            {pastSessions.map((session) => renderSessionRow(session, true, true))}
                          </div>
                          {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 py-4 border-t border-[var(--color-border)]">
                              <button disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)} className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm disabled:opacity-50"><ChevronLeft className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} /></button>
                              <span className="text-sm text-[var(--color-text-secondary)]">{currentPage} / {totalPages}</span>
                              <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)} className="px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm disabled:opacity-50"><ChevronRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} /></button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!loading && !error && viewMode === "calendar" && (
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
                    <button onClick={goToPrevMonth} className="p-2 hover:bg-[var(--color-border-subtle)] rounded-lg">{isRTL ? <ChevronRight className="w-5 h-5 text-[var(--color-text-secondary)]" /> : <ChevronLeft className="w-5 h-5 text-[var(--color-text-secondary)]" />}</button>
                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{calendarData.headerLabel}</h2>
                    <button onClick={goToNextMonth} className="p-2 hover:bg-[var(--color-border-subtle)] rounded-lg">{isRTL ? <ChevronLeft className="w-5 h-5 text-[var(--color-text-secondary)]" /> : <ChevronRight className="w-5 h-5 text-[var(--color-text-secondary)]" />}</button>
                  </div>
                  <div className="flex items-center justify-end px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-page)]">
                    {/* Local-only calendar toggle. Does not mutate the user's
                        global preference nor any other date picker. */}
                    <div className="inline-flex bg-[var(--color-border-subtle)] rounded-md p-0.5">
                      {(["gregorian", "hijri"] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setCalendarViewTouched(true);
                            setCalendarView(opt);
                          }}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                            calendarView === opt
                              ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                              : "text-[var(--color-text-secondary)]"
                          }`}
                        >
                          {opt === "gregorian"
                            ? (t("sessionsPage.gregorian") || (isRTL ? "ميلادي" : "Gregorian"))
                            : (t("sessionsPage.hijri") || (isRTL ? "هجري" : "Hijri"))}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-7">
                    {dayNames.map((day) => (<div key={day} className="p-3 text-center text-xs font-medium text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">{day}</div>))}
                    {Array.from({ length: calendarData.firstDayOfMonth }).map((_, i) => (<div key={`empty-${i}`} className="min-h-[100px] p-2 border-b border-r border-[var(--color-border)] bg-[var(--color-surface-page)]" />))}
                    {Array.from({ length: calendarData.daysInMonth }).map((_, i) => {
                      const day = i + 1;
                      const daySessions = getSessionsForDate(day);
                      const gDate = calendarData.getGregorianDate(day);
                      const todayObj = new Date();
                      const isToday = gDate.getDate() === todayObj.getDate() && gDate.getMonth() === todayObj.getMonth() && gDate.getFullYear() === todayObj.getFullYear();
                      return (
                        <div key={day} className={`min-h-[100px] p-2 border-b border-r border-[var(--color-border)] ${isToday ? "bg-[var(--color-border-subtle)]" : ""}`}>
                          <span className={`inline-flex items-center justify-center w-7 h-7 text-sm ${isToday ? "bg-[var(--color-primary)] text-white rounded-full font-semibold" : "text-[var(--color-text-primary)]"}`}>{day}</span>
                          <div className="mt-1 space-y-1">
                            {daySessions.slice(0, 2).map((session) => (<div key={session.id} className={`px-1.5 py-0.5 rounded text-[10px] truncate ${getTypeBadgeStyle(session.type)}`} title={session.title}>{session.title}</div>))}
                            {daySessions.length > 2 && (<div className="text-[10px] text-[var(--color-text-secondary)] px-1.5">+{daySessions.length - 2} {isRTL ? "أكثر" : "more"}</div>)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Session Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={(e) => e.target === e.currentTarget && setShowScheduleModal(false)}>
          <ScheduleSessionModal
            courses={coursesList}
            onClose={() => setShowScheduleModal(false)}
            onScheduled={() => { setShowScheduleModal(false); refetch(); }}
            t={t}
          />
        </div>
      )}

      {/* Webinar Registrants Drawer */}
      {registrantsDrawer && (
        <WebinarRegistrantsDrawer
          sessionId={registrantsDrawer.sessionId}
          sessionTitle={registrantsDrawer.sessionTitle}
          scheduledAt={registrantsDrawer.scheduledAt}
          registrationUrl={registrantsDrawer.registrationUrl}
          zoomWebinarId={registrantsDrawer.zoomWebinarId}
          courseName={registrantsDrawer.courseName}
          sessionStatus={registrantsDrawer.sessionStatus}
          onClose={() => setRegistrantsDrawer(null)}
        />
      )}

      {/* Cancel Modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[var(--color-surface-card)] rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Cancel Session</h3>
              <button onClick={() => setCancelModal(null)} className="p-1 hover:bg-[var(--color-border-subtle)] rounded-lg"><X className="w-5 h-5 text-[var(--color-text-secondary)]" /></button>
            </div>
            {actionSuccess ? (
              <div className="text-center py-6">
                <Check className="w-8 h-8 text-[#22C55E] mx-auto mb-2" />
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">Session cancelled</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-[var(--color-text-secondary)] mb-3">Cancel &quot;{cancelModal.title}&quot;? Please provide a reason:</p>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Reason for cancellation..."
                  className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-lg text-sm mb-4 focus:ring-2 focus:ring-[var(--color-input-focus)] outline-none resize-none h-24"
                />
                <div className="flex justify-end gap-3">
                  <button onClick={() => setCancelModal(null)} className="px-4 py-2 text-sm text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)]">Close</button>
                  <button onClick={handleCancelOnBehalf} disabled={!cancelReason || actionLoading} className="px-4 py-2 text-sm font-medium text-white bg-[#EF4444] rounded-lg disabled:opacity-50 inline-flex items-center gap-2 hover:bg-[#DC2626]">
                    {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}Cancel Session
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[var(--color-surface-card)] rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Reschedule Session</h3>
              <button onClick={() => setRescheduleModal(null)} className="p-1 hover:bg-[var(--color-border-subtle)] rounded-lg"><X className="w-5 h-5 text-[var(--color-text-secondary)]" /></button>
            </div>
            {actionSuccess ? (
              <div className="text-center py-6">
                <Check className="w-8 h-8 text-[#22C55E] mx-auto mb-2" />
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">Session rescheduled</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-[var(--color-text-secondary)] mb-3">Reschedule &quot;{rescheduleModal.title}&quot;:</p>
                <div className="mb-4">
                  <DateTimePicker
                    value={rescheduleDate}
                    onChange={setRescheduleDate}
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setRescheduleModal(null)} className="px-4 py-2 text-sm text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)]">Close</button>
                  <button onClick={handleReschedule} disabled={!rescheduleDate || actionLoading} className="px-4 py-2 text-sm font-medium text-white btn-gold rounded-lg disabled:opacity-50 inline-flex items-center gap-2">
                    {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}Reschedule
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Assign Substitute Modal */}
      {substituteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[var(--color-surface-card)] rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Assign Substitute</h3>
              <button onClick={() => setSubstituteModal(null)} className="p-1 hover:bg-[var(--color-border-subtle)] rounded-lg"><X className="w-5 h-5 text-[var(--color-text-secondary)]" /></button>
            </div>
            {actionSuccess ? (
              <div className="text-center py-6">
                <Check className="w-8 h-8 text-[#22C55E] mx-auto mb-2" />
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">Substitute assigned</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-[var(--color-text-secondary)] mb-3">Select substitute for &quot;{substituteModal.title}&quot;:</p>
                <select
                  value={substituteId}
                  onChange={(e) => setSubstituteId(e.target.value)}
                  className="w-full px-3 py-2 border border-[var(--color-input-border)] rounded-lg text-sm mb-4 focus:ring-2 focus:ring-[var(--color-input-focus)] outline-none"
                >
                  <option value="">Select instructor...</option>
                  {instructors.map((inst) => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </select>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setSubstituteModal(null)} className="px-4 py-2 text-sm text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)]">Close</button>
                  <button onClick={handleAssignSubstitute} disabled={!substituteId || actionLoading} className="px-4 py-2 text-sm font-medium text-white btn-gold rounded-lg disabled:opacity-50 inline-flex items-center gap-2">
                    {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}Assign
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Attendance Modal */}
      {attendanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[var(--color-surface-card)] rounded-xl w-full max-w-2xl p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("sessionsPage.attendanceTitle")}</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">{attendanceModal.title}</p>
              </div>
              <button onClick={() => setAttendanceModal(null)} className="p-1 hover:bg-[var(--color-border-subtle)] rounded-lg">
                <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
              </button>
            </div>

            {attendanceLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-[var(--color-primary)] animate-spin" />
              </div>
            ) : attendanceData.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-10 h-10 text-[var(--color-text-secondary)] mx-auto mb-3" />
                <p className="text-sm text-[var(--color-text-secondary)]">{t("sessionsPage.noAttendance")}</p>
              </div>
            ) : (
              <>
                {/* Summary bar */}
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {[
                    { label: t("sessionsPage.attendTotal"), count: attendanceStats.total, color: "text-[var(--color-text-primary)]" },
                    { label: t("sessionsPage.attendPresent"), count: attendanceStats.present, color: "text-[#22C55E]" },
                    { label: t("sessionsPage.attendAbsent"), count: attendanceStats.absent, color: "text-[#EF4444]" },
                  ].map((s) => (
                    <div key={s.label} className="bg-[var(--color-surface-page)] rounded-lg p-2 text-center">
                      <p className={`text-lg font-bold ${s.color}`}>{s.count}</p>
                      <p className="text-[10px] text-[var(--color-text-secondary)]">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Marked by info */}
                {(() => {
                  const marker = attendanceData.find((r: any) => r.markedByName);
                  if (!marker) return null;
                  return (
                    <div className="flex items-center gap-3 px-3 py-2 mb-2 bg-[#FAFAFA] rounded-lg text-[10px] text-[var(--color-text-secondary)]">
                      <span>Marked by: <span className="font-medium text-[var(--color-text-secondary)]">{(marker as any).markedByName}</span> ({(marker as any).markedByRole === "TEACHING_ASSISTANT" ? "TA" : (marker as any).markedByRole === "INSTRUCTOR" ? "Instructor" : (marker as any).markedByRole || "System"})</span>
                      {(marker as any).updatedAt && (
                        <span>Last updated: {new Date((marker as any).updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      )}
                    </div>
                  );
                })()}

                {/* Attendance table */}
                <div className="overflow-x-auto border border-[var(--color-border)] rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--color-surface-page)] text-[var(--color-text-secondary)]">
                      <tr>
                        <th className="text-start px-3 py-2 font-medium">{t("sessionsPage.attendStudent")}</th>
                        <th className="text-start px-3 py-2 font-medium">{t("sessionsPage.attendStatus")}</th>
                        <th className="text-start px-3 py-2 font-medium">{t("sessionsPage.attendJoinedAt")}</th>
                        <th className="text-start px-3 py-2 font-medium">{t("sessionsPage.attendLeftAt")}</th>
                        <th className="text-start px-3 py-2 font-medium">{t("sessionsPage.attendDuration")}</th>
                        <th className="text-start px-3 py-2 font-medium">{t("sessionsPage.attendPresence")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {attendanceData.map((record, idx) => {
                        const name = [record.studentFirstName, record.studentLastName].filter(Boolean).join(" ") || record.studentEmail || record.studentId;
                        const statusColors: Record<string, string> = {
                          present: "bg-[#D1FAE5] text-[#065F46]",
                          absent: "bg-[#FEE2E2] text-[#991B1B]",
                          late: "bg-[#FEF3C7] text-[#92400E]",
                          excused: "bg-[var(--color-border-subtle)] text-[#1E40AF]",
                        };
                        const presPercent = (record as any).presencePercent;
                        return (
                          <tr key={`${record.studentId}-${idx}`} className="hover:bg-[var(--color-border-subtle)]">
                            <td className="px-3 py-2 text-[var(--color-text-primary)]">{name}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColors[record.status] || "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"}`}>
                                {record.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                              {record.joinedAt ? new Date(record.joinedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "\u2014"}
                            </td>
                            <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                              {record.leftAt ? new Date(record.leftAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "\u2014"}
                            </td>
                            <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                              {record.durationMinutes != null ? `${record.durationMinutes}min` : "\u2014"}
                            </td>
                            <td className="px-3 py-2">
                              {presPercent != null ? (
                                <span className={`text-xs font-semibold ${presPercent >= 70 ? "text-[#16A34A]" : "text-[#EF4444]"}`}>
                                  {presPercent}%
                                </span>
                              ) : "\u2014"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Export Footer */}
            {attendanceData.length > 0 && (
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[var(--color-border)]">
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as "csv" | "pdf" | "xlsx")}
                  className="px-2 py-2 text-xs border border-[var(--color-input-border)] rounded-lg text-[var(--color-text-secondary)] bg-[var(--color-surface-card)] focus:ring-1 focus:ring-[var(--color-input-focus)] outline-none"
                >
                  <option value="csv">CSV</option>
                  <option value="pdf">PDF</option>
                  <option value="xlsx">Excel</option>
                </select>
                <button
                  onClick={async () => {
                    try {
                      await reportsApi.download("attendance", {
                        courseId: attendanceModal.courseId,
                        sessionId: attendanceModal.id,
                        format: exportFormat,
                      });
                    } catch {
                      // silently fail
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default SessionsContent;
