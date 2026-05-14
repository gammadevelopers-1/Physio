"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  ClipboardCheck,
  Loader2,
  Play,
  UserCheck,
  Users,
  Video,
  MapPin,
  CheckCircle2,
  Circle,
  X,
  XCircle,
  AlertTriangle,
  Star,
  Radio,
} from "lucide-react";
import ReviewModal, { type ReviewKind } from "./ReviewModal";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import StudentCourseDetailSkeleton from "./StudentCourseDetailSkeleton";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { useStudentCourseDetail } from "@/hooks/useStudentCourseDetail";
import { studentApi, ApiError } from "@/lib/api";
import { useCalendarPreference } from "@/contexts/CalendarContext";
import { formatDateReadable } from "@/lib/hijri";
import { isJoinable, formatTimeUntil, canDropCourseNow } from "@/lib/calendar-utils";
import Accordion, { type AccordionItem } from "@/components/ui/Accordion";
import Image from "next/image";
import { HelpCircle } from "lucide-react";

const StudentCourseDetailContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";
  const params = useParams();
  const courseId = params.id as string;
  const router = useRouter();
  const userData = useStudentProfile();

  const { data, loading, error, refetch } = useStudentCourseDetail(courseId);
  const { calendarFormat } = useCalendarPreference();

  const [showDropConfirm, setShowDropConfirm] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);

  // Dual-review gate state for the Request Certificate button
  const [reviewStatus, setReviewStatus] = useState<{
    courseReviewSubmitted: boolean;
    instructorReviewSubmitted: boolean;
    instructorRequired: boolean;
    allRequiredSubmitted: boolean;
  } | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  // Fetch review-submission status once the enrollment is known to be completed.
  // Used to gate the cert button and prompt for missing reviews.
  useEffect(() => {
    if (data?.enrollment?.status !== "completed") {
      setReviewStatus(null);
      return;
    }
    let cancelled = false;
    studentApi
      .getReviewStatus(courseId)
      .then((res) => {
        if (!cancelled) setReviewStatus(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [data?.enrollment?.status, courseId]);

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  // Collapse past lectures by default (matches Attendance History pattern); user expands.
  const [showPastLectures, setShowPastLectures] = useState(false);
  const [pastPage, setPastPage] = useState(5);

  // Split sessions into upcoming/past/inactive — strictly date-driven for
  // upcoming/past, with only `cancelled` excluded explicitly. Statuses like
  // `missed`/`rescheduled` on a FUTURE-dated row (left over from rescheduling)
  // would otherwise wrongly disappear from upcoming.
  const upcomingSessions = useMemo(() => {
    const now = Date.now();
    return (
      data?.sessions.filter((s) => {
        if (s.status === "cancelled") return false;
        return new Date(s.scheduledAt).getTime() >= now;
      }) ?? []
    );
  }, [data?.sessions]);
  const completedSessions = useMemo(() => {
    const now = Date.now();
    return (
      data?.sessions.filter((s) => {
        if (s.status === "cancelled") return false;
        return new Date(s.scheduledAt).getTime() < now;
      }) ?? []
    );
  }, [data?.sessions]);

  // For zoom courses: the soonest session that can be joined RIGHT NOW
  // (within the 15-min pre-start window). Drives the right-rail "Start Now"
  // CTA. Otherwise, the next session that's still in the future drives a
  // disabled "Starts in 2h 15m" countdown state.
  const isZoom = data?.course.deliveryType === "zoom";
  // A session is "joinable from our app" when it has either a meeting link
  // OR is a webinar (auto-registration produces the join URL on demand).
  const canDispatchJoin = (s: { zoomLink: string | null; isWebinar?: boolean | null }) =>
    !!s.zoomLink || !!s.isWebinar;
  const nextJoinableSession = useMemo(() => {
    if (!isZoom) return null;
    return (
      upcomingSessions.find(
        (s) => canDispatchJoin(s) && isJoinable(s.scheduledAt),
      ) ?? null
    );
  }, [isZoom, upcomingSessions]);
  const nextUpcomingSession = useMemo(() => {
    if (!isZoom) return null;
    return upcomingSessions.find(canDispatchJoin) ?? null;
  }, [isZoom, upcomingSessions]);

  // Details ↔ FAQs tab (zoom + faqs present only)
  const courseFaqs = useMemo(() => {
    const list = data?.course.faqs;
    if (!Array.isArray(list)) return [];
    return list.filter(
      (f) => (f?.question || f?.questionAr) && (f?.answer || f?.answerAr),
    );
  }, [data?.course.faqs]);
  const hasFaqs = isZoom && courseFaqs.length > 0;
  const [activeTab, setActiveTab] = useState<"details" | "faqs">("details");
  const inactiveSessions = useMemo(
    () => data?.sessions.filter((s) => s.status === "cancelled") ?? [],
    [data?.sessions]
  );

  const handleJoinZoom = async (sessionId: string) => {
    if (joiningSessionId) return;
    if (data?.enrollment?.status === "completed") {
      toast.error(t("courseDetail.courseCompletedNoAccess") || "This course has been completed. You can no longer join lectures.");
      return;
    }
    setJoiningSessionId(sessionId);
    try {
      const { joinUrl } = await studentApi.getSessionJoinUrl(sessionId);
      window.open(joinUrl, "_blank", "noopener,noreferrer");
    } catch {
      toast.error(t("courseDetail.joinSessionError") || "Unable to join this lecture. The course may have ended.");
    } finally {
      setJoiningSessionId(null);
    }
  };

  const handleDropCourse = async () => {
    setDropping(true);
    try {
      await studentApi.dropCourse(courseId);
      toast.success(t("courseDetail.dropSuccess"));
      router.push(`/${locale}/dashboard/student/courses`);
    } catch (err) {
      // Backend returns DROP_RESTRICTED_WITHIN_3_DAYS when within the
      // 3-day pre-start window — surface the localized message rather
      // than the generic "drop failed" toast.
      if (err instanceof ApiError && err.code === "DROP_RESTRICTED_WITHIN_3_DAYS") {
        toast.error(t("courseDetail.dropRestrictedMessage"));
      } else {
        toast.error(t("courseDetail.dropError"));
      }
    } finally {
      setDropping(false);
      setShowDropConfirm(false);
    }
  };

  const getAttendanceStatusBadge = (status: string) => {
    switch (status) {
      case "present": return { bg: "bg-[#DCFCE7]", text: "text-[#16A34A]", label: t("courseDetail.statusPresent") };
      case "absent": return { bg: "bg-[#FEE2E2]", text: "text-[#EF4444]", label: t("courseDetail.statusAbsent") };
      case "late": return { bg: "bg-[#FEF3C7]", text: "text-[#D97706]", label: t("courseDetail.statusLate") };
      case "excused": return { bg: "bg-[var(--color-border-subtle)]", text: "text-[var(--color-primary)]", label: t("courseDetail.statusExcused") };
      default: return { bg: "bg-[var(--color-border-subtle)]", text: "text-[var(--color-text-secondary)]", label: status };
    }
  };

  const formatDate = (dateStr: string | null) =>
    formatDateReadable(dateStr, calendarFormat, locale);

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString(
      locale === "ar" ? "ar-SA" : "en-US",
      { hour: "2-digit", minute: "2-digit" }
    );
  };

  return (
    <>
      <DashboardNavbar user={userData} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <DashboardSidebar user={userData} />
            </div>

            <MobileSidebar user={userData} />

            <div className="flex-1 min-w-0">
              {/* Back Link */}
              <Link
                href={`/${locale}/dashboard/student/courses`}
                className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4 transition-colors"
              >
                <BackIcon className="w-4 h-4" />
                {t("courseDetail.backToCourses")}
              </Link>

              {loading ? (
                <StudentCourseDetailSkeleton />
              ) : error || !data ? (
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-8 text-center">
                  <p className="text-[var(--color-text-secondary)]">
                    {error || t("courseDetail.notFound")}
                  </p>
                </div>
              ) : (
                <>
                  {/* Course Header */}
                  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6 mb-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Thumbnail */}
                      <div className="w-full sm:w-[200px] h-[120px] sm:h-[130px] bg-[var(--color-border-subtle)] rounded-lg overflow-hidden flex-shrink-0">
                        {data.course.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={data.course.thumbnail}
                            alt={data.course.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <BookOpen className="w-10 h-10 text-[var(--color-text-secondary)]" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h1 className="text-lg sm:text-xl font-bold text-[var(--color-text-primary)] mb-2">
                          {isRTL && data.course.titleAr
                            ? data.course.titleAr
                            : data.course.title}
                        </h1>

                        <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                          {data.course.instructorName}
                        </p>

                        {/* Quick Info */}
                        <div className="flex flex-wrap gap-3 text-xs text-[var(--color-text-secondary)]">
                          {data.course.deliveryType && (
                            <span className="flex items-center gap-1">
                              <Video className="w-3.5 h-3.5" />
                              {data.course.deliveryType}
                            </span>
                          )}
                          {data.course.startDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDate(data.course.startDate)}
                            </span>
                          )}
                          {data.course.isCmeAccredited && (
                            <span className="flex items-center gap-1 text-[#D4A520]">
                              <Award className="w-3.5 h-3.5" />
                              {t("courseDetail.cmeHours", {
                                hours: data.course.cmeHours ?? 0,
                              })}
                            </span>
                          )}
                        </div>

                        {/* Progress */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-[var(--color-text-secondary)]">
                              {t("courseDetail.progress")}
                            </span>
                            <span className="font-medium text-[var(--color-text-primary)]">
                              {data.enrollment.progress}%
                            </span>
                          </div>
                          <div className="h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-[#16A34A] rounded-full transition-all duration-300 ${isRTL ? "ms-auto" : ""}`}
                              style={{
                                width: `${data.enrollment.progress}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* State-aware primary CTA — Continue/Start when active,
                        View Certificate when completed, hidden when dropped.
                        For zoom courses with no modules, Start Learning is
                        meaningless — the right-rail "Start Now" CTA drives
                        lecture entry instead. */}
                    {data.enrollment.status === "active" && !(isZoom && data.modules.length === 0) && (
                      <div className="mt-4">
                        <Link
                          href={`/${locale}/dashboard/student/courses/${courseId}/learn`}
                          className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg hover:opacity-90 transition-opacity ${
                            isZoom
                              ? "border border-[var(--color-border)] text-[var(--color-text-primary)] bg-[var(--color-surface-card)]"
                              : "btn-gold text-[var(--color-button-text)]"
                          }`}
                        >
                          <Play className="w-4 h-4" />
                          {data.enrollment.progress > 0
                            ? t("courseDetail.continueLearning")
                            : t("courseDetail.startLearning")}
                        </Link>
                      </div>
                    )}
                    {/* View Certificate — only when the manager has
                        approved the request. Links to the PUBLIC
                        verification page so the same URL works whether
                        the student is signed in or shares it externally. */}
                    {data.enrollment.status === "completed" &&
                      data.certificateRequest?.status === "approved" && (
                        <div className="mt-4">
                          <Link
                            href={`/${locale}/verify/${data.certificateRequest.id}`}
                            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                          >
                            <Award className="w-4 h-4" />
                            {locale === "ar" ? "عرض الشهادة" : "View Certificate"}
                          </Link>
                        </div>
                      )}
                  </div>

                  {/* Course Description + (optional) FAQs tab — FAQs tab only
                      surfaces for zoom courses that have at least one FAQ. */}
                  {(data.course.description || data.course.descriptionAr || hasFaqs) && (
                    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6 mb-4">
                      {hasFaqs ? (
                        <div
                          className={`flex items-center gap-6 border-b border-[var(--color-border)] mb-4 -mt-1 ${
                            isRTL ? "flex-row-reverse" : ""
                          }`}
                        >
                          {(["details", "faqs"] as const).map((tab) => (
                            <button
                              key={tab}
                              type="button"
                              onClick={() => setActiveTab(tab)}
                              className={`pb-2 -mb-px text-sm font-semibold transition-colors border-b-2 ${
                                activeTab === tab
                                  ? "text-[var(--color-primary)] border-[var(--color-primary)]"
                                  : "text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)]"
                              }`}
                            >
                              {tab === "details"
                                ? (isRTL ? "التفاصيل" : "Details")
                                : (isRTL ? "الأسئلة الشائعة" : "FAQs")}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                          {t("courseDetail.aboutCourse")}
                        </h3>
                      )}
                      {activeTab === "details" ? (
                        (data.course.description || data.course.descriptionAr) ? (
                          <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed">
                            {isRTL && data.course.descriptionAr
                              ? data.course.descriptionAr
                              : data.course.description}
                          </p>
                        ) : null
                      ) : (
                        <Accordion
                          items={courseFaqs.map((f, i): AccordionItem => {
                            const q = isRTL
                              ? (f.questionAr || f.question || "")
                              : (f.question || f.questionAr || "");
                            const a = isRTL
                              ? (f.answerAr || f.answer || "")
                              : (f.answer || f.answerAr || "");
                            return {
                              id: `faq-${i}`,
                              title: q,
                              content: (
                                <p className="whitespace-pre-wrap">{a}</p>
                              ),
                            };
                          })}
                        />
                      )}
                    </div>
                  )}

                  {/* Course Info Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    {/* Modules */}
                    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[var(--color-border-subtle)] rounded-lg flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-[var(--color-primary)]" />
                        </div>
                        <div>
                          <p className="text-xs text-[var(--color-text-secondary)]">
                            {t("courseDetail.modules")}
                          </p>
                          <p className="text-lg font-semibold text-[var(--color-text-secondary)]">
                            {data.modules.filter((m) => m.isCompleted).length}/
                            {data.modules.length}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Attendance — hidden for self-paced */}
                    {data.course.deliveryType !== "self-paced" && (
                      <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              data.attendanceSummary &&
                              data.attendanceSummary.percentage >= 70
                                ? "bg-[#F0FDF4]"
                                : "bg-[#FEF2F2]"
                            }`}
                          >
                            <UserCheck
                              className={`w-5 h-5 ${
                                data.attendanceSummary &&
                                data.attendanceSummary.percentage >= 70
                                  ? "text-[#16A34A]"
                                  : "text-[#DC2626]"
                              }`}
                            />
                          </div>
                          <div>
                            <p className="text-xs text-[var(--color-text-secondary)]">
                              {t("courseDetail.attendance")}
                            </p>
                            <p className="text-lg font-semibold text-[var(--color-text-secondary)]">
                              {data.attendanceSummary
                                ? `${data.attendanceSummary.attended}/${data.attendanceSummary.total}`
                                : "0/0"}
                            </p>
                            {data.attendanceSummary &&
                              data.attendanceSummary.total > 0 && (
                                <p
                                  className={`text-xs ${
                                    data.attendanceSummary.percentage >= 70
                                      ? "text-[#16A34A]"
                                      : "text-[#DC2626]"
                                  }`}
                                >
                                  {data.attendanceSummary.percentage}%
                                </p>
                              )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Assessments */}
                    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#FFFBEB] rounded-lg flex items-center justify-center">
                          <ClipboardCheck className="w-5 h-5 text-[#D4A520]" />
                        </div>
                        <div>
                          <p className="text-xs text-[var(--color-text-secondary)]">
                            {t("courseDetail.assessments")}
                          </p>
                          <p className="text-lg font-semibold text-[var(--color-text-secondary)]">
                            {data.assessmentSummary
                              ? `${data.assessmentSummary.completed}/${data.assessmentSummary.total}`
                              : `${data.assessments.length}`}
                          </p>
                          {data.assessmentSummary &&
                            data.assessmentSummary.completed > 0 && (
                              <p className="text-xs text-[var(--color-text-secondary)]">
                                {t("courseDetail.averageScore", {
                                  score: Math.round(
                                    data.assessmentSummary.averageScore
                                  ),
                                })}
                              </p>
                            )}
                        </div>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#F0FDF4] rounded-lg flex items-center justify-center">
                          <Users className="w-5 h-5 text-[#16A34A]" />
                        </div>
                        <div>
                          <p className="text-xs text-[var(--color-text-secondary)]">
                            {t("courseDetail.status")}
                          </p>
                          <p className="text-lg font-semibold text-[var(--color-text-secondary)] capitalize">
                            {data.enrollment.status === "active"
                              ? t("myCourses.inProgress")
                              : data.enrollment.status === "completed"
                                ? t("myCourses.completed")
                                : t("myCourses.notStarted")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Two-column layout: main content + side panel ── */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 space-y-4">
                  {/* Modules List — hidden for zoom courses with no modules
                      (lectures are the primary surface there). */}
                  {!(isZoom && data.modules.length === 0) && (
                  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6 mb-4">
                    <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)] mb-4">
                      {t("courseDetail.courseModules")}
                    </h2>

                    {data.modules.length === 0 ? (
                      <p className="text-sm text-[var(--color-text-secondary)] py-4 text-center">
                        {t("courseDetail.noModules")}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {data.modules
                          .sort((a, b) => a.orderIndex - b.orderIndex)
                          .map((module, index) => {
                            const moduleAssessments = data.assessments.filter((a) => a.moduleId === module.id);
                            return (
                              <div key={module.id} className="rounded-lg border border-[var(--color-border)]">
                                <Link
                                  href={`/${locale}/dashboard/student/courses/${courseId}/learn`}
                                  className="flex items-center gap-3 p-3 hover:bg-[var(--color-border-subtle)] transition-colors cursor-pointer"
                                >
                                  {module.isCompleted ? (
                                    <div className="w-8 h-8 rounded-full bg-[#F0FDF4] flex items-center justify-center flex-shrink-0">
                                      <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
                                    </div>
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-[var(--color-border-subtle)] flex items-center justify-center flex-shrink-0">
                                      <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                                        {index + 1}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate">
                                      {isRTL && module.titleAr
                                        ? module.titleAr
                                        : module.title}
                                    </p>
                                    <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
                                      {module.type && (
                                        <span className="capitalize">
                                          {module.type}
                                        </span>
                                      )}
                                      {module.durationMinutes && (
                                        <span className="flex items-center gap-1">
                                          <Clock className="w-3 h-3" />
                                          {module.durationMinutes}{" "}
                                          {t("calendar.mins")}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </Link>
                                {moduleAssessments.length > 0 && (
                                  <div className="border-t border-[var(--color-border)] px-3 py-2 space-y-1.5">
                                    {moduleAssessments.map((ma) => {
                                      // Mirror the standalone Assessments section: when there's
                                      // no submission and the deadline has passed (or the course
                                      // itself has wrapped) the row is missed — read-only and red.
                                      const now = new Date();
                                      const courseClosed =
                                        data.enrollment.status === "completed" ||
                                        (data.course.endDate != null && now > new Date(data.course.endDate));
                                      const deadlinePassed =
                                        ma.dueDate != null && now > new Date(ma.dueDate);
                                      const maMissed = !ma.submission && (deadlinePassed || courseClosed);

                                      const innerContent = (
                                        <>
                                          <ClipboardCheck className={`w-3.5 h-3.5 flex-shrink-0 ${maMissed ? "text-[#DC2626]" : "text-[var(--color-text-secondary)]"}`} />
                                          <span className={`text-xs flex-1 truncate ${maMissed ? "text-[#DC2626] font-medium" : "text-[var(--color-text-secondary)]"}`}>{ma.title}</span>
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                            ma.type === "assignment" ? "bg-amber-50 text-amber-700" : ma.type === "exam" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"
                                          }`}>
                                            {ma.type}
                                          </span>
                                          {ma.submission?.status === "graded" ? (
                                            <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] flex-shrink-0" />
                                          ) : ma.submission?.status === "submitted" ? (
                                            <Clock className="w-3.5 h-3.5 text-[#D4A520] flex-shrink-0" />
                                          ) : maMissed ? (
                                            <span className="text-[10px] font-semibold text-[#DC2626] bg-red-100 px-1.5 py-0.5 rounded flex-shrink-0">
                                              {t("courseDetail.missed")}
                                            </span>
                                          ) : (
                                            <Circle className="w-3.5 h-3.5 text-[var(--color-border)] flex-shrink-0" />
                                          )}
                                        </>
                                      );

                                      // Allow Review for any submitted attempt, but lock the row
                                      // entirely when it's been missed (no clickable link).
                                      if (maMissed) {
                                        return (
                                          <div
                                            key={ma.id}
                                            className="flex items-center gap-2 px-2 py-1.5 rounded bg-red-50/40 border border-red-100 cursor-not-allowed"
                                          >
                                            {innerContent}
                                          </div>
                                        );
                                      }

                                      const href = ma.submission
                                        ? `/${locale}/dashboard/student/courses/${courseId}/assessment/${ma.id}?review=true`
                                        : `/${locale}/dashboard/student/courses/${courseId}/assessment/${ma.id}`;

                                      return (
                                        <Link
                                          key={ma.id}
                                          href={href}
                                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--color-border-subtle)] transition-colors"
                                        >
                                          {innerContent}
                                        </Link>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Upcoming Sessions (hidden for self-paced) */}
                  {data.course.deliveryType !== "self-paced" && upcomingSessions.length > 0 && (
                    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6 mb-4">
                      <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)] mb-4">
                        {t("courseDetail.upcomingSessions")}
                      </h2>

                      <div className="space-y-3">
                        {upcomingSessions.map((session) => (
                          <div
                            key={session.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border ${session.isWebinar ? "border-[#E9D5FF] bg-[#FAF5FF]" : "border-[var(--color-border)]"}`}
                          >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${session.isWebinar ? "bg-[#F3E8FF]" : "bg-[#FFFBEB]"}`}>
                              {session.isWebinar ? (
                                <Radio className="w-5 h-5 text-[#A855F7]" />
                              ) : session.type === "zoom" || session.type === "online" ? (
                                <Video className="w-5 h-5 text-[#D4A520]" />
                              ) : (
                                <MapPin className="w-5 h-5 text-[#D4A520]" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                                  {session.title}
                                </p>
                                {session.isWebinar && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#A855F7] text-white text-[10px] font-bold rounded uppercase tracking-wide">
                                    <Radio className="w-2.5 h-2.5" />
                                    {t("courseDetail.webinar") || "Webinar"}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-3 text-xs text-[var(--color-text-secondary)] mt-1">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(session.scheduledAt)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatTime(session.scheduledAt)}
                                </span>
                                <span>
                                  {session.durationMinutes}{" "}
                                  {t("calendar.mins")}
                                </span>
                              </div>
                              {/* Webinar register: only while session is still
                                  scheduled (registration closes the moment the
                                  host starts the webinar via Zoom webhook).
                                  Meeting join: only inside the 15-min pre-start window. */}
                              {session.isWebinar && session.status === "scheduled" ? (
                                <button
                                  type="button"
                                  onClick={() => handleJoinZoom(session.id)}
                                  disabled={joiningSessionId === session.id}
                                  className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-md bg-[#A855F7] hover:bg-[#9333EA] text-white text-xs font-medium disabled:opacity-60 transition-colors"
                                >
                                  {joiningSessionId === session.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Radio className="w-3.5 h-3.5" />
                                  )}
                                  {t("courseDetail.registerForWebinar") || "Register for Webinar"}
                                </button>
                              ) : session.isWebinar ? (
                                <p className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)] opacity-70">
                                  <Radio className="w-3 h-3" />
                                  {session.status === "live"
                                    ? (locale === "ar" ? "الندوة جارية" : "Webinar in progress")
                                    : (locale === "ar" ? "انتهت الندوة" : "Webinar ended")}
                                </p>
                              ) : session.zoomLink ? (
                                isJoinable(session.scheduledAt) ? (
                                  <button
                                    type="button"
                                    onClick={() => handleJoinZoom(session.id)}
                                    disabled={joiningSessionId === session.id}
                                    className="inline-flex items-center gap-1 mt-2 text-xs hover:underline disabled:opacity-60 text-[var(--color-primary)]"
                                  >
                                    {joiningSessionId === session.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Video className="w-3 h-3" />
                                    )}
                                    {t("courseDetail.joinSession")}
                                  </button>
                                ) : (
                                  <p className="inline-flex items-center gap-1 mt-2 text-xs text-[var(--color-text-secondary)] opacity-70">
                                    <Clock className="w-3 h-3" />
                                    {t("courseDetail.joinAvailableIn", { time: formatTimeUntil(session.scheduledAt) })}
                                  </p>
                                )
                              ) : null}
                              {session.venueAddress && (
                                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                  <MapPin className="w-3 h-3 inline mr-1" />
                                  {session.venueAddress}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Past Lectures — merged Attendance History + Past Sessions.
                      Each row shows the lecture metadata, the student's attendance
                      badge / presence %, and a Recording button. Collapsed by
                      default, paginated 10 at a time via "Show more". */}
                  {data.course.deliveryType !== "self-paced" && completedSessions.length > 0 && (
                    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6 mb-4">
                      <button
                        type="button"
                        onClick={() => setShowPastLectures((v) => !v)}
                        className={`w-full flex items-center justify-between gap-2 ${showPastLectures ? "mb-4" : ""}`}
                        aria-expanded={showPastLectures}
                      >
                        <div className="flex items-center gap-3">
                          <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]">
                            {t("courseDetail.pastSessions")} ({completedSessions.length})
                          </h2>
                          {data.attendanceSummary && (
                            <span className="text-xs text-[var(--color-text-secondary)]">
                              {data.attendanceSummary.attended}/{data.attendanceSummary.total} ({data.attendanceSummary.percentage}%)
                            </span>
                          )}
                        </div>
                        {showPastLectures ? (
                          <ChevronUp className="w-5 h-5 text-[var(--color-text-secondary)]" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-[var(--color-text-secondary)]" />
                        )}
                      </button>

                      {showPastLectures && (
                        <>
                          {/* Marked by info — shown once if any record carries it */}
                          {(() => {
                            const marker = data.attendanceRecords?.find((r) => (r as any).markedByName);
                            if (!marker) return null;
                            const role = (marker as any).markedByRole;
                            const roleLabel =
                              role === "TEACHING_ASSISTANT"
                                ? "TA"
                                : role === "INSTRUCTOR"
                                  ? "Instructor"
                                  : role || "System";
                            return (
                              <div className="mb-3 px-3 py-2 bg-[var(--color-border-subtle)] rounded-lg text-[10px] text-[var(--color-text-secondary)]">
                                Marked by:{" "}
                                <span className="font-medium">{(marker as any).markedByName}</span>{" "}
                                ({roleLabel})
                              </div>
                            );
                          })()}

                          <div className="space-y-3">
                            {completedSessions.slice(0, pastPage).map((session) => {
                              const attRecord = data.attendanceRecords?.find((r) => r.sessionId === session.id);
                              const badge = attRecord ? getAttendanceStatusBadge(attRecord.status) : null;
                              const wasAbsent = attRecord?.status === "absent";
                              const isPresentish =
                                attRecord?.status === "present" || attRecord?.status === "late";

                              return (
                                <div
                                  key={session.id}
                                  className={`flex items-start gap-3 p-3 rounded-lg border ${wasAbsent ? "border-[#FCA5A5] bg-[#FEF2F2]" : "border-[var(--color-border)]"}`}
                                >
                                  <div
                                    className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${wasAbsent ? "bg-[#FEE2E2]" : isPresentish ? "bg-[#F0FDF4]" : "bg-[var(--color-border-subtle)]"}`}
                                  >
                                    {wasAbsent ? (
                                      <XCircle className="w-5 h-5 text-[#EF4444]" />
                                    ) : isPresentish ? (
                                      <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
                                    ) : (
                                      <Clock className="w-5 h-5 text-[var(--color-text-secondary)]" />
                                    )}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate">
                                      {session.title}
                                    </p>
                                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--color-text-secondary)] mt-1">
                                      <span className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {formatDate(session.scheduledAt)}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {formatTime(session.scheduledAt)}
                                      </span>
                                      <span>
                                        {session.durationMinutes} {t("calendar.mins")}
                                      </span>
                                      {attRecord?.joinedAt && (
                                        <span>
                                          {t("courseDetail.joinedAt")}: {formatTime(attRecord.joinedAt)}
                                        </span>
                                      )}
                                      {attRecord?.leftAt && (
                                        <span>
                                          {t("courseDetail.leftAt")}: {formatTime(attRecord.leftAt)}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                    <div className="flex items-center gap-2">
                                      {attRecord?.presencePercent != null && (
                                        <span
                                          className={`text-[10px] font-semibold ${attRecord.presencePercent >= 70 ? "text-[#16A34A]" : "text-[#EF4444]"}`}
                                        >
                                          {attRecord.presencePercent}%
                                        </span>
                                      )}
                                      {badge && (
                                        <span
                                          className={`px-2 py-1 rounded text-[10px] font-medium ${badge.bg} ${badge.text}`}
                                        >
                                          {badge.label}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {completedSessions.length > pastPage && (
                            <button
                              onClick={() => setPastPage((p) => p + 10)}
                              className="w-full mt-3 py-2 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors"
                            >
                              Show more ({completedSessions.length - pastPage} remaining)
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Missed/Rescheduled Lectures — hidden for self-paced */}
                  {data.course.deliveryType !== "self-paced" && inactiveSessions.length > 0 && (
                    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6 mb-4">
                      <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-secondary)] mb-4">
                        Cancelled / Rescheduled Lectures
                      </h2>
                      <div className="space-y-3">
                        {inactiveSessions.map((session) => (
                          <div key={session.id} className="flex items-start gap-3 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-page)]">
                            <div className="w-10 h-10 bg-[var(--color-border-subtle)] rounded-lg flex items-center justify-center flex-shrink-0">
                              <XCircle className="w-5 h-5 text-[var(--color-text-secondary)]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[var(--color-text-secondary)]">{session.title}</p>
                              <div className="flex flex-wrap gap-3 text-xs text-[var(--color-text-secondary)] mt-1">
                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(session.scheduledAt)}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  session.status === "cancelled" ? "bg-[#FEE2E2] text-[#EF4444]"
                                  : session.status === "missed" ? "bg-[#FEE2E2] text-[#EF4444]"
                                  : "bg-[#FEF3C7] text-[#D97706]"
                                }`}>{session.status === "cancelled" ? "Cancelled" : session.status === "missed" ? "Missed" : "Rescheduled"}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assessments */}
                  {data.assessments.length > 0 && (
                    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6">
                      <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)] mb-4">
                        {t("courseDetail.assessments")}
                      </h2>

                      <div className="space-y-3">
                        {data.assessments.map((assessment) => {
                          const isGraded = assessment.submission?.status === "graded";
                          const isPending = assessment.submission?.status === "submitted";
                          const isFailed = isGraded && assessment.submission?.score != null && assessment.submission.totalMarks != null &&
                            (assessment.submission.score / (assessment.submission.totalMarks || 1)) * 100 < ((assessment.passingMarks / assessment.totalMarks) * 100);
                          const isPassed = isGraded && !isFailed;
                          // Missed = no submission AND the assessment is no longer
                          // takeable. Two ways to get there:
                          //   1. The deadline has passed.
                          //   2. The course itself has wrapped (enrollment marked
                          //      completed, or the course end date is in the past).
                          // In both cases the row is rendered red and the "Take
                          // Assessment" link is replaced with a "Missing" badge.
                          const now = new Date();
                          const courseClosed =
                            data.enrollment.status === "completed" ||
                            (data.course.endDate != null && now > new Date(data.course.endDate));
                          const deadlinePassed =
                            assessment.dueDate != null && now > new Date(assessment.dueDate);
                          const isMissed =
                            !assessment.submission && (deadlinePassed || courseClosed);

                          return (
                          <div
                            key={assessment.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border ${
                              isFailed
                                ? "border-red-200 bg-red-50/50"
                                : isMissed
                                  ? "border-red-200 bg-red-50/40"
                                  : "border-[var(--color-border)]"
                            }`}
                          >
                            {isPassed ? (
                              <CheckCircle2 className="w-5 h-5 text-[#16A34A] flex-shrink-0" />
                            ) : isFailed ? (
                              <XCircle className="w-5 h-5 text-[#DC2626] flex-shrink-0" />
                            ) : isPending ? (
                              <Clock className="w-5 h-5 text-[#D4A520] flex-shrink-0" />
                            ) : isMissed ? (
                              <XCircle className="w-5 h-5 text-[#DC2626] flex-shrink-0" />
                            ) : (
                              <Circle className="w-5 h-5 text-[var(--color-text-secondary)] flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-sm font-medium ${
                                  isFailed || isMissed ? "text-[#DC2626]" : "text-[var(--color-text-secondary)]"
                                }`}
                              >
                                {assessment.title}
                              </p>
                              <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)] mt-0.5">
                                <span className="capitalize">{assessment.type}</span>
                                <span>
                                  {assessment.totalMarks} {t("courseDetail.marks")}
                                </span>
                                {assessment.durationMinutes && (
                                  <span>
                                    {assessment.durationMinutes} {t("calendar.mins")}
                                  </span>
                                )}
                                {assessment.dueDate && (
                                  <span className={isMissed ? "text-[#DC2626] font-medium" : ""}>
                                    {formatDate(assessment.dueDate)}
                                  </span>
                                )}
                              </div>
                            </div>
                            {assessment.submission ? (
                              <div className="flex items-center gap-3 flex-shrink-0">
                                <div className="text-right">
                                  <p className={`text-sm font-semibold ${isFailed ? "text-[#DC2626]" : "text-[var(--color-text-secondary)]"}`}>
                                    {assessment.submission.score != null
                                      ? `${assessment.submission.score}/${assessment.submission.totalMarks}`
                                      : "—"}
                                  </p>
                                  <p
                                    className={`text-xs ${
                                      isPassed
                                        ? "text-[#16A34A]"
                                        : isFailed
                                          ? "text-[#DC2626]"
                                          : "text-[#D4A520]"
                                    }`}
                                  >
                                    {isPassed
                                      ? t("courseDetail.passed")
                                      : isFailed
                                        ? t("courseDetail.failed")
                                        : t("courseDetail.pendingGrading")}
                                  </p>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                  {/* Review available for any submission (graded OR pending grading) */}
                                  <Link
                                    href={`/${locale}/dashboard/student/courses/${courseId}/assessment/${assessment.id}?review=true`}
                                    className="text-xs text-[var(--color-primary)] hover:underline"
                                  >
                                    {t("courseDetail.review")}
                                  </Link>
                                  {assessment.canRetake && (
                                    <Link
                                      href={`/${locale}/dashboard/student/courses/${courseId}/assessment/${assessment.id}`}
                                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#7C3AED] bg-[#F3E8FF] px-2 py-1 rounded-md hover:bg-[#E9D5FF] transition-colors"
                                    >
                                      {t("courseDetail.startRetake")}
                                    </Link>
                                  )}
                                </div>
                              </div>
                            ) : isMissed ? (
                              <span className="text-xs font-medium text-[#DC2626] px-2 py-1 bg-red-100 rounded flex-shrink-0">
                                {t("courseDetail.missed")}
                              </span>
                            ) : (
                              <Link
                                href={`/${locale}/dashboard/student/courses/${courseId}/assessment/${assessment.id}`}
                                className="text-xs text-[var(--color-primary)] hover:underline flex-shrink-0"
                              >
                                {t("courseDetail.takeAssessment")}
                              </Link>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  </div>

                  {/* ── Side panel (sticky on desktop) ── */}
                  <aside className="lg:col-span-1 space-y-4 lg:sticky lg:top-6 lg:self-start">
                    {/* Start Now CTA — zoom courses, before completion. Joinable
                        now → primary action button. Otherwise → countdown to
                        the next upcoming lecture. Hidden when the course has
                        ended (completed enrollment uses the cert card below). */}
                    {isZoom && data.enrollment.status === "active" && nextUpcomingSession && (
                      <div className={`rounded-xl border p-5 ${nextUpcomingSession.isWebinar ? "bg-[#FAF5FF] border-[#E9D5FF]" : "bg-[var(--color-surface-card)] border-[var(--color-border)]"}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                            {nextUpcomingSession.isWebinar
                              ? (isRTL ? "ندوة قادمة" : "Upcoming Webinar")
                              : (isRTL ? "ابدأ المحاضرة" : "Live Lecture")}
                          </h3>
                          {nextUpcomingSession.isWebinar && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#A855F7] text-white text-[10px] font-bold rounded uppercase tracking-wide">
                              <Radio className="w-2.5 h-2.5" />
                              {isRTL ? "ندوة" : "Webinar"}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)] mb-3 line-clamp-1">
                          {nextUpcomingSession.title}
                        </p>
                        {nextUpcomingSession.isWebinar && nextUpcomingSession.status === "scheduled" ? (
                          /* Webinar: register button while still scheduled. */
                          <button
                            type="button"
                            onClick={() => handleJoinZoom(nextUpcomingSession.id)}
                            disabled={joiningSessionId === nextUpcomingSession.id}
                            className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#A855F7] hover:bg-[#9333EA] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
                          >
                            {joiningSessionId === nextUpcomingSession.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Radio className="w-4 h-4" />
                            )}
                            {t("courseDetail.registerForWebinar") || "Register for Webinar"}
                          </button>
                        ) : nextUpcomingSession.isWebinar ? (
                          /* Webinar in progress or ended — registration closed. */
                          <div className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] text-sm font-medium rounded-lg cursor-not-allowed">
                            <Radio className="w-4 h-4" />
                            {nextUpcomingSession.status === "live"
                              ? (locale === "ar" ? "الندوة جارية" : "Webinar in progress")
                              : (locale === "ar" ? "انتهت الندوة" : "Webinar ended")}
                          </div>
                        ) : nextJoinableSession ? (
                          <button
                            type="button"
                            onClick={() => handleJoinZoom(nextJoinableSession.id)}
                            disabled={joiningSessionId === nextJoinableSession.id}
                            className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[var(--color-primary)] text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60"
                          >
                            {joiningSessionId === nextJoinableSession.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Video className="w-4 h-4" />
                            )}
                            {isRTL ? "ابدأ الآن" : "Start Now"}
                          </button>
                        ) : (
                          <div className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] text-sm font-medium rounded-lg cursor-not-allowed">
                            <Clock className="w-4 h-4" />
                            {isRTL
                              ? `يبدأ خلال ${formatTimeUntil(nextUpcomingSession.scheduledAt)}`
                              : `Starts in ${formatTimeUntil(nextUpcomingSession.scheduledAt)}`}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Compact Instructor card — links to dedicated profile.
                        Renders whenever any instructor data is available. */}
                    {data.course.instructorId && (
                      <Link
                        href={`/${locale}/instructors/${data.course.instructorId}`}
                        className="block bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 hover:border-[var(--color-primary)] transition-colors"
                      >
                        <h3 className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)] mb-3">
                          {isRTL ? "المدرب" : "Instructor"}
                        </h3>
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full overflow-hidden bg-[var(--color-border-subtle)] flex items-center justify-center flex-shrink-0">
                            {data.course.instructorAvatar ? (
                              <Image
                                src={data.course.instructorAvatar}
                                alt={data.course.instructorName}
                                width={48}
                                height={48}
                                className="w-full h-full object-cover"
                                unoptimized={data.course.instructorAvatar.startsWith("http")}
                              />
                            ) : (
                              <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
                                {(() => {
                                  const en = `${data.course.instructorFirstName || ""} ${data.course.instructorLastName || ""}`.trim();
                                  const fallback = en || data.course.instructorName || "?";
                                  return fallback
                                    .split(/\s+/)
                                    .filter(Boolean)
                                    .slice(0, 2)
                                    .map((p) => p[0]?.toUpperCase() ?? "")
                                    .join("");
                                })()}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                              {(() => {
                                const ar = `${data.course.instructorFirstNameAr || ""} ${data.course.instructorLastNameAr || ""}`.trim();
                                const en = `${data.course.instructorFirstName || ""} ${data.course.instructorLastName || ""}`.trim();
                                if (isRTL && ar) return ar;
                                return en || ar || data.course.instructorName;
                              })()}
                            </p>
                            {data.course.instructorProfession && (
                              <p className="text-xs text-[var(--color-text-secondary)] truncate">
                                {data.course.instructorProfession}
                              </p>
                            )}
                            {(data.course.instructorTotalRatings ?? 0) > 0 && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <Star className="w-3 h-3 text-[var(--color-star)] fill-[var(--color-star)]" />
                                <span className="text-xs font-medium text-[var(--color-text-primary)]">
                                  {(data.course.instructorAvgRating ?? 0).toFixed(1)}
                                </span>
                                <span className="text-[10px] text-[var(--color-text-secondary)]">
                                  ({data.course.instructorTotalRatings})
                                </span>
                              </div>
                            )}
                          </div>
                          {isRTL ? (
                            <ArrowLeft className="w-4 h-4 text-[var(--color-text-secondary)]" />
                          ) : (
                            <ArrowRight className="w-4 h-4 text-[var(--color-text-secondary)]" />
                          )}
                        </div>
                      </Link>
                    )}

                    {/* NELC Program Evaluation Link — only after completion, only when manager has set it.
                        External link, opens new tab, no transformation. */}
                    {data.enrollment.status === "completed" && data.course.nelcReviewLink && (
                      <div className="bg-[#F5F3FF] rounded-xl border border-[#DDD6FE] p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#7C3AED]">
                            <ClipboardCheck className="w-4 h-4 text-white" />
                          </div>
                          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                            {locale === "ar"
                              ? "رابط تقييم البرنامج (NELC)"
                              : "Course Evaluation Link (NELC)"}
                          </h3>
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)] mb-3">
                          {locale === "ar"
                            ? "أكمل تقييم البرنامج عبر المركز الوطني للتعليم الإلكتروني."
                            : "Complete the program evaluation on the National eLearning Center."}
                        </p>
                        <a
                          href={data.course.nelcReviewLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs font-semibold rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-colors"
                        >
                          {locale === "ar" ? "افتح نموذج التقييم" : "Open Evaluation Form"}
                        </a>
                      </div>
                    )}

                    {/* Certificate Status (replaces the old red+yellow banners) */}
                    {data.enrollment.status === "completed" && (() => {
                      const dt = data.course.deliveryType;
                      const isSP = dt === "self-paced";
                      const isBlend = dt === "blended";
                      const progressMet = isSP || isBlend ? data.enrollment.progress >= 100 : true;
                      const attPct = data.attendanceSummary?.percentage ?? 0;
                      const attendanceMet = isSP ? true : attPct >= 70;
                      const cmeHours = data.course.cmeHours || 0;
                      const isEligible = progressMet && attendanceMet;

                      const reasons: string[] = [];
                      if (!progressMet) reasons.push(locale === "ar" ? "لم يتم إكمال جميع الوحدات" : "Course modules not 100% complete");
                      if (!attendanceMet) reasons.push(locale === "ar" ? `نسبة الحضور ${attPct}% (الحد الأدنى 70%)` : `Attendance ${attPct}% (minimum 70%)`);

                      return (
                        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isEligible ? "bg-green-100" : "bg-amber-100"}`}>
                              <Award className={`w-4 h-4 ${isEligible ? "text-[#16A34A]" : "text-[#D97706]"}`} />
                            </div>
                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                              {locale === "ar" ? "حالة الشهادة" : "Certificate Status"}
                            </h3>
                          </div>

                          {isEligible ? (
                            <p className="text-xs text-[#16A34A] mb-3">
                              {locale === "ar"
                                ? `تهانينا! ${cmeHours} ساعة CME مكتسبة`
                                : `Eligible — ${cmeHours} CME hours earned`}
                            </p>
                          ) : (
                            <>
                              <p className="text-xs text-[#D97706] font-medium mb-2">
                                {locale === "ar" ? "متطلبات غير مكتملة:" : "Requirements not met:"}
                              </p>
                              <ul className="text-xs text-[var(--color-text-secondary)] space-y-1 mb-3">
                                {reasons.map((r, i) => (
                                  <li key={i} className="flex items-start gap-1.5">
                                    <XCircle className="w-3 h-3 text-[#DC2626] mt-0.5 flex-shrink-0" />
                                    <span>{r}</span>
                                  </li>
                                ))}
                              </ul>
                              <p className="text-[10px] text-[var(--color-text-secondary)] mb-3">
                                {locale === "ar" ? "يمكنك طلب الشهادة وسيراجعها المدير" : "You can still request — the manager will review"}
                              </p>
                            </>
                          )}

                          {/* Reviews-required block — single CTA opens combined modal */}
                          {reviewStatus && !reviewStatus.allRequiredSubmitted && (
                            <div className="mb-3 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3">
                              <p className="text-xs font-medium text-[#B45309] mb-2">
                                {locale === "ar"
                                  ? "أكمل المراجعات لطلب شهادتك"
                                  : "Complete reviews to request your certificate"}
                              </p>
                              <ul className="space-y-1 text-xs text-[var(--color-text-secondary)] mb-3">
                                <li className="flex items-center gap-1.5">
                                  {reviewStatus.courseReviewSubmitted ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                                  ) : (
                                    <Circle className="w-3.5 h-3.5 text-[#D97706]" />
                                  )}
                                  {locale === "ar" ? "مراجعة الدورة" : "Course review"}
                                </li>
                                {reviewStatus.instructorRequired && (
                                  <li className="flex items-center gap-1.5">
                                    {reviewStatus.instructorReviewSubmitted ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                                    ) : (
                                      <Circle className="w-3.5 h-3.5 text-[#D97706]" />
                                    )}
                                    {locale === "ar"
                                      ? "مراجعة المدرب"
                                      : "Instructor review"}
                                  </li>
                                )}
                              </ul>
                              <button
                                type="button"
                                onClick={() => setReviewModalOpen(true)}
                                className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#B45309] text-white hover:bg-[#92400E] transition-colors cursor-pointer"
                              >
                                {locale === "ar" ? "إرسال المراجعات" : "Submit Reviews"}
                              </button>
                            </div>
                          )}

                          {(() => {
                            // Status-driven CTA. The backend returns the
                            // student's most-recent certificate request (or
                            // null) — this block renders accordingly so the
                            // user can never double-submit and always sees
                            // the manager's decision inline.
                            const cr = data.certificateRequest;

                            // Pending — locked until manager acts.
                            if (cr?.status === "pending") {
                              return (
                                <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3">
                                  <p className="text-xs font-medium text-[#B45309]">
                                    {locale === "ar"
                                      ? "في انتظار موافقة المدير"
                                      : "Waiting for approval"}
                                  </p>
                                  <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">
                                    {locale === "ar"
                                      ? "تم إرسال طلبك. سيتم إخطارك بمجرد المراجعة."
                                      : "Your request has been submitted. You'll be notified once reviewed."}
                                  </p>
                                </div>
                              );
                            }

                            // Approved — link out to download.
                            if (cr?.status === "approved") {
                              return (
                                <div className="space-y-2">
                                  <p className="text-xs text-[#16A34A] font-medium">
                                    {locale === "ar"
                                      ? "تمت الموافقة على شهادتك"
                                      : "Certificate approved"}
                                  </p>
                                  <a
                                    href={cr.certificateUrl || `/${locale}/dashboard/student/certifications`}
                                    target={cr.certificateUrl ? "_blank" : undefined}
                                    rel={cr.certificateUrl ? "noopener noreferrer" : undefined}
                                    className="block w-full text-center px-3 py-2 text-xs font-medium rounded-lg bg-[#16A34A] hover:bg-[#15803D] transition-colors text-white"
                                  >
                                    {locale === "ar" ? "تنزيل الشهادة" : "Download Certificate"}
                                  </a>
                                </div>
                              );
                            }

                            // Rejected — show reason, button locked.
                            if (cr?.status === "rejected") {
                              return (
                                <div className="rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] p-3">
                                  <p className="text-xs font-semibold text-[#B91C1C]">
                                    {locale === "ar" ? "تم رفض الشهادة" : "Certificate rejected"}
                                  </p>
                                  {cr.reviewNote && (
                                    <p className="text-[11px] text-[#991B1B] mt-1.5 whitespace-pre-line">
                                      {cr.reviewNote}
                                    </p>
                                  )}
                                  <button
                                    type="button"
                                    disabled
                                    className="w-full mt-2 px-3 py-2 text-xs font-medium rounded-lg bg-[#FCA5A5] text-white opacity-70 cursor-not-allowed"
                                  >
                                    {locale === "ar" ? "تم الرفض" : "Rejected"}
                                  </button>
                                </div>
                              );
                            }

                            // Held — manager paused review pending audit.
                            if (cr?.status === "held") {
                              return (
                                <div className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-3">
                                  <p className="text-xs font-semibold text-[#B45309]">
                                    {locale === "ar" ? "الطلب قيد الانتظار" : "Request on hold"}
                                  </p>
                                  {cr.reviewNote && (
                                    <p className="text-[11px] text-[#92400E] mt-1.5 whitespace-pre-line">
                                      {cr.reviewNote}
                                    </p>
                                  )}
                                </div>
                              );
                            }

                            // Revoked — previously approved, then revoked.
                            if (cr?.status === "revoked") {
                              return (
                                <div className="rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] p-3">
                                  <p className="text-xs font-semibold text-[#B91C1C]">
                                    {locale === "ar" ? "تم إلغاء الشهادة" : "Certificate revoked"}
                                  </p>
                                  {cr.reviewNote && (
                                    <p className="text-[11px] text-[#991B1B] mt-1.5 whitespace-pre-line">
                                      {cr.reviewNote}
                                    </p>
                                  )}
                                </div>
                              );
                            }

                            // No request yet — show the request CTA.
                            return (
                              <button
                                type="button"
                                disabled={!reviewStatus?.allRequiredSubmitted}
                                onClick={async () => {
                                  try {
                                    await studentApi.requestCertificate(data.course.id);
                                    toast.success(locale === "ar" ? "تم طلب الشهادة! في انتظار موافقة المدير." : "Certificate requested! Pending manager approval.");
                                    // Refresh so the block flips to the
                                    // "Waiting for approval" state immediately
                                    // without a manual reload.
                                    refetch();
                                  } catch (err: unknown) {
                                    const msg = err instanceof Error ? err.message : (locale === "ar" ? "فشل في طلب الشهادة" : "Failed to request certificate");
                                    toast.error(msg);
                                  }
                                }}
                                className={`w-full px-3 py-2 text-xs font-medium rounded-lg transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed ${isEligible ? "bg-[#16A34A] hover:bg-[#15803D]" : "bg-[#D97706] hover:bg-[#B45309]"}`}
                              >
                                {locale === "ar" ? "طلب شهادة" : "Request Certificate"}
                              </button>
                            );
                          })()}
                        </div>
                      );
                    })()}

                    {/* Course Info */}
                    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                        {locale === "ar" ? "معلومات الدورة" : "Course Info"}
                      </h3>
                      <dl className="space-y-2 text-xs">
                        {data.course.deliveryType && (
                          <div className="flex items-center justify-between">
                            <dt className="text-[var(--color-text-secondary)]">{locale === "ar" ? "نوع التقديم" : "Delivery"}</dt>
                            <dd className="font-medium text-[var(--color-text-primary)] capitalize">{data.course.deliveryType}</dd>
                          </div>
                        )}
                        {data.course.isCmeAccredited && (
                          <div className="flex items-center justify-between">
                            <dt className="text-[var(--color-text-secondary)]">{locale === "ar" ? "ساعات CME" : "CME hours"}</dt>
                            <dd className="font-medium text-[#D4A520]">{data.course.cmeHours ?? 0}</dd>
                          </div>
                        )}
                        {data.course.startDate && (
                          <div className="flex items-center justify-between">
                            <dt className="text-[var(--color-text-secondary)]">{locale === "ar" ? "تاريخ البدء" : "Starts"}</dt>
                            <dd className="font-medium text-[var(--color-text-primary)]">{formatDate(data.course.startDate)}</dd>
                          </div>
                        )}
                        {data.course.endDate && (
                          <div className="flex items-center justify-between">
                            <dt className="text-[var(--color-text-secondary)]">{locale === "ar" ? "تاريخ الانتهاء" : "Ends"}</dt>
                            <dd className="font-medium text-[var(--color-text-primary)]">{formatDate(data.course.endDate)}</dd>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <dt className="text-[var(--color-text-secondary)]">{locale === "ar" ? "تاريخ التسجيل" : "Enrolled"}</dt>
                          <dd className="font-medium text-[var(--color-text-primary)]">{formatDate(data.enrollment.enrolledAt)}</dd>
                        </div>
                        {data.course.accreditationNumber && (
                          <div className="flex items-center justify-between">
                            <dt className="text-[var(--color-text-secondary)]">
                              {locale === "ar" ? "رقم الاعتماد" : "Accreditation #"}
                            </dt>
                            <dd className="font-medium text-[var(--color-text-primary)] break-all text-end">
                              {data.course.accreditationNumber}
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>

                    {/* Quick Actions — drop is locked once we're inside
                        the 3-day pre-start window or after the course has
                        started. Hide the button entirely; show the rule
                        as text so the student understands why. */}
                    {data.enrollment.status === "active" && (
                      <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                          {locale === "ar" ? "إجراءات سريعة" : "Quick Actions"}
                        </h3>
                        {canDropCourseNow(data.course.startDate) ? (
                          <button
                            type="button"
                            onClick={() => setShowDropConfirm(true)}
                            className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-medium border border-red-300 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            {t("courseDetail.dropCourse")}
                          </button>
                        ) : (
                          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                            {t("courseDetail.dropRestrictedMessage")}
                          </p>
                        )}
                      </div>
                    )}
                  </aside>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Drop Course Confirmation Modal */}
      {showDropConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-[var(--color-surface-card)] rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {t("courseDetail.dropConfirmTitle")}
                </h3>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] mb-6">
                {t("courseDetail.dropConfirmMessage")}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDropConfirm(false)}
                  disabled={dropping}
                  className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors cursor-pointer"
                >
                  {t("courseDetail.cancel")}
                </button>
                <button
                  onClick={handleDropCourse}
                  disabled={dropping}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {dropping ? t("courseDetail.dropping") : t("courseDetail.confirmDrop")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Combined review modal — opens from the cert gate "Submit Reviews" CTA */}
      {reviewModalOpen && data && reviewStatus && (() => {
        const kinds: ReviewKind[] = [];
        if (!reviewStatus.courseReviewSubmitted) kinds.push("course");
        if (
          reviewStatus.instructorRequired &&
          !reviewStatus.instructorReviewSubmitted
        ) {
          kinds.push("instructor");
        }
        if (kinds.length === 0) return null;
        return (
          <ReviewModal
            kinds={kinds}
            courseId={courseId}
            courseTitle={
              isRTL && data.course.titleAr ? data.course.titleAr : data.course.title
            }
            instructorName={data.course.instructorName ?? undefined}
            onClose={() => setReviewModalOpen(false)}
            onSubmitted={(submitted) => {
              setReviewStatus((prev) => {
                if (!prev) return prev;
                const next = { ...prev };
                if (submitted.includes("course")) next.courseReviewSubmitted = true;
                if (submitted.includes("instructor"))
                  next.instructorReviewSubmitted = true;
                next.allRequiredSubmitted =
                  next.courseReviewSubmitted &&
                  (!next.instructorRequired || next.instructorReviewSubmitted);
                return next;
              });
              if (submitted.length === kinds.length) {
                setReviewModalOpen(false);
              }
            }}
            isRTL={isRTL}
          />
        );
      })()}
    </>
  );
};

export default StudentCourseDetailContent;
