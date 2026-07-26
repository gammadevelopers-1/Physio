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
  Clock,
  ClipboardCheck,
  Loader2,
  Play,
  UserCheck,
  Users,
  Video,
  CheckCircle2,
  Circle,
  XCircle,
  AlertTriangle,
  Star,
  Radio,
  Sparkles,
  Trophy,
  ChevronRight,
  Receipt,
} from "lucide-react";
import ReviewModal, { type ReviewKind } from "./ReviewModal";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import StudentCourseDetailSkeleton from "./StudentCourseDetailSkeleton";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { useStudentCourseDetail } from "@/hooks/useStudentCourseDetail";
import { studentApi, studentFinanceApi, ApiError } from "@/lib/api";
import { usePlatformLocale } from "@/contexts/PlatformLocaleContext";
import { formatPlatformDateReadable } from "@/lib/platform-locale";
import { isJoinable, formatTimeUntil, canDropCourseNow } from "@/lib/calendar-utils";
import Accordion, { type AccordionItem } from "@/components/ui/Accordion";
import Image from "next/image";

const StudentCourseDetailContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";
  const params = useParams();
  const courseId = params.id as string;
  const router = useRouter();
  const userData = useStudentProfile();

  const { data, loading, error, refetch } = useStudentCourseDetail(courseId);
  const platformLocale = usePlatformLocale();

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

  // Resolve enrollment → paid payment so we can show a "View receipt" link
  // that deep-opens the billing drawer. Free enrollments and never-paid
  // courses 404 from the endpoint; we hide the link silently in that case.
  const enrollmentId = data?.enrollment?.id ?? null;
  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);
  useEffect(() => {
    if (!enrollmentId) {
      setReceiptPaymentId(null);
      return;
    }
    let cancelled = false;
    studentFinanceApi
      .getPaymentByEnrollment(enrollmentId)
      .then((res) => {
        if (!cancelled) setReceiptPaymentId(res.paymentId);
      })
      .catch(() => {
        // 404 (free / never paid) is the common path — fail silent.
        if (!cancelled) setReceiptPaymentId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [enrollmentId]);

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

  // Upcoming sessions still drive the right-rail "Live Lecture / Start Now"
  // card and the joinable-now CTA — the full Upcoming / Past / Cancelled lists
  // now live inside the /learn workspace.
  const upcomingSessions = useMemo(() => {
    const now = Date.now();
    return (
      data?.sessions.filter((s) => {
        // Terminal statuses are never "upcoming" — an instructor can end a
        // session before its scheduledAt (or miss it). Otherwise the home
        // card stays stuck on "Ready to join" / "HAPPENING NOW" forever.
        if (
          s.status === "cancelled" ||
          s.status === "ended" ||
          s.status === "completed" ||
          s.status === "missed"
        ) return false;
        return new Date(s.scheduledAt).getTime() >= now;
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

  // Details ↔ FAQs tab. FAQs are now editable on every delivery type; the
  // tab surfaces whenever the course has at least one non-empty FAQ.
  const courseFaqs = useMemo(() => {
    const list = data?.course.faqs;
    if (!Array.isArray(list)) return [];
    return list.filter(
      (f) => (f?.question || f?.questionAr) && (f?.answer || f?.answerAr),
    );
  }, [data?.course.faqs]);
  const hasFaqs = courseFaqs.length > 0;
  const [activeTab, setActiveTab] = useState<"details" | "faqs">("details");

  // Helpers for the new main-column blocks ("What's Next" + Up-Next previews).
  // All derived from the existing payload — no extra fetch.
  const nextInProgressModule = useMemo(() => {
    if (!data?.modules?.length) return null;
    const sorted = [...data.modules].sort((a, b) => a.orderIndex - b.orderIndex);
    return sorted.find((m) => !m.isCompleted) ?? null;
  }, [data?.modules]);
  const nearestUpcoming = upcomingSessions[0] ?? null;
  const upcomingPreview = upcomingSessions.slice(0, 2);
  const inProgressModulesPreview = useMemo(() => {
    if (!data?.modules?.length) return [];
    return [...data.modules]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .filter((m) => !m.isCompleted)
      .slice(0, 2);
  }, [data?.modules]);
  const hasLectures =
    data?.course.deliveryType !== "self-paced" && (data?.sessions?.length ?? 0) > 0;
  const hasModules = (data?.modules?.length ?? 0) > 0;

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

  const formatDate = (dateStr: string | null) =>
    formatPlatformDateReadable(dateStr, platformLocale, locale === "ar" ? "ar" : "en");

  // Deep-link helpers for the clickable stat tiles below.
  const learnUrl = (tab: "modules" | "lectures") =>
    `/${locale}/dashboard/student/courses/${courseId}/learn?tab=${tab}`;
  const scrollToAssessments = () => {
    if (typeof window === "undefined") return;
    document.getElementById("assessments-section")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
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
                    {/* Backend NotFoundException raises a raw English message
                        ("You are not enrolled in this course"). Detect it and
                        swap in the localized copy so Arabic mode doesn't leak
                        untranslated backend strings into the UI. */}
                    {error && /not enrolled/i.test(error)
                      ? t("myCourses.notEnrolled")
                      : error || t("courseDetail.notFound")}
                  </p>
                </div>
              ) : (
                <>
                  {/* Cancelled course banner (Phase C). Shown at the top
                      of the detail page when the parent course has been
                      cancelled by admin. Enrollment may be `dropped`
                      (Phase C drops all enrollments on cancel) or, in
                      the edge case of a manual retention, still `active`. */}
                  {data.course.status === "cancelled" && (
                    <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-xl p-4 sm:p-5 mb-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#FECACA] flex items-center justify-center flex-shrink-0">
                          <span className="text-[#7F1D1D] text-lg font-bold">!</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h2 className="text-sm sm:text-base font-semibold text-[#991B1B]">
                            {data.course.cancelledAt
                              ? t("myCourses.studentCancelledBanner.titleWithDate", {
                                  date: new Date(data.course.cancelledAt).toLocaleDateString(
                                    locale === "ar" ? "ar-SA" : "en-US",
                                    { year: "numeric", month: "long", day: "numeric" },
                                  ),
                                })
                              : t("myCourses.studentCancelledBanner.title")}
                          </h2>
                          {data.course.cancelReason && (
                            <p className="text-xs sm:text-sm text-[#7F1D1D] mt-1 leading-relaxed">
                              <span className="font-medium">
                                {t("myCourses.studentCancelledBanner.reasonLabel")}
                              </span>{" "}
                              {data.course.cancelReason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

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

                    {/* Primary CTA row.
                        - active:    Start/Continue Learning → /learn (writable)
                        - completed: Review Course Material → /learn (read-only;
                                     inside-of-learn guards block joining live
                                     lectures, taking assessments and marking
                                     modules complete). When the cert is
                                     approved, also show View Certificate
                                     side-by-side. */}
                    {data.enrollment.status === "active" && (
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Link
                          href={`/${locale}/dashboard/student/courses/${courseId}/learn`}
                          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg hover:opacity-90 transition-opacity btn-gold text-[var(--color-button-text)]"
                        >
                          <Play className="w-4 h-4" />
                          {data.enrollment.progress > 0
                            ? t("courseDetail.continueLearning")
                            : t("courseDetail.startLearning")}
                        </Link>
                        {receiptPaymentId && (
                          <Link
                            href={`/${locale}/dashboard/student/billing?payment=${receiptPaymentId}`}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-card)] text-[var(--color-text-primary)] hover:border-[var(--color-primary)] hover:shadow-sm transition-all"
                          >
                            <Receipt className="w-4 h-4" />
                            {t("courseDetail.viewReceipt")}
                          </Link>
                        )}
                      </div>
                    )}
                    {data.enrollment.status === "completed" && (
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Link
                          href={`/${locale}/dashboard/student/courses/${courseId}/learn`}
                          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-card)] text-[var(--color-text-primary)] hover:border-[var(--color-primary)] hover:shadow-sm transition-all"
                        >
                          <BookOpen className="w-4 h-4" />
                          {t("courseDetail.reviewCourseMaterial")}
                        </Link>
                        {data.certificateRequest?.status === "approved" && (
                          <Link
                            href={`/${locale}/verify/${data.certificateRequest.id}`}
                            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 btn-gold text-[var(--color-button-text)] text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                          >
                            <Award className="w-4 h-4" />
                            {locale === "ar" ? "عرض الشهادة" : "View Certificate"}
                          </Link>
                        )}
                        {receiptPaymentId && (
                          <Link
                            href={`/${locale}/dashboard/student/billing?payment=${receiptPaymentId}`}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-card)] text-[var(--color-text-primary)] hover:border-[var(--color-primary)] hover:shadow-sm transition-all"
                          >
                            <Receipt className="w-4 h-4" />
                            {t("courseDetail.viewReceipt")}
                          </Link>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Course Description + (optional) FAQs tab — FAQs tab
                      surfaces for any course that has at least one FAQ. */}
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

                  {/* Stat tiles — each is a deep-link into the /learn
                      workspace (or scrolls to the assessments section) so
                      students can jump straight to what they care about. */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    {/* Modules → /learn?tab=modules */}
                    {data.modules.length > 0 ? (
                      <Link
                        href={learnUrl("modules")}
                        className="group bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 hover:border-[var(--color-primary)] hover:shadow-sm transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[var(--color-border-subtle)] rounded-lg flex items-center justify-center group-hover:bg-[#EEF4FE] transition-colors">
                            <BookOpen className="w-5 h-5 text-[var(--color-primary)]" />
                          </div>
                          <div>
                            <p className="text-xs text-[var(--color-text-secondary)]">
                              {t("courseDetail.modules")}
                            </p>
                            <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                              {data.modules.filter((m) => m.isCompleted).length}/
                              {data.modules.length}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ) : (
                      <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[var(--color-border-subtle)] rounded-lg flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-[var(--color-primary)]" />
                          </div>
                          <div>
                            <p className="text-xs text-[var(--color-text-secondary)]">
                              {t("courseDetail.modules")}
                            </p>
                            <p className="text-lg font-semibold text-[var(--color-text-secondary)]">0/0</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Attendance → /learn?tab=lectures (hidden for self-paced) */}
                    {data.course.deliveryType !== "self-paced" && (
                      <Link
                        href={learnUrl("lectures")}
                        className="group bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 hover:border-[var(--color-primary)] hover:shadow-sm transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                              data.attendanceSummary && data.attendanceSummary.percentage >= 70
                                ? "bg-[#F0FDF4]"
                                : "bg-[#FEF2F2]"
                            }`}
                          >
                            <UserCheck
                              className={`w-5 h-5 ${
                                data.attendanceSummary && data.attendanceSummary.percentage >= 70
                                  ? "text-[#16A34A]"
                                  : "text-[#DC2626]"
                              }`}
                            />
                          </div>
                          <div>
                            <p className="text-xs text-[var(--color-text-secondary)]">
                              {t("courseDetail.attendance")}
                            </p>
                            <p className="text-lg font-semibold text-[var(--color-text-primary)]">
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
                      </Link>
                    )}

                    {/* Assessments → scroll-to-section */}
                    <button
                      type="button"
                      onClick={scrollToAssessments}
                      disabled={data.assessments.length === 0}
                      className="group text-start bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 hover:border-[var(--color-primary)] hover:shadow-sm transition-all cursor-pointer disabled:cursor-default disabled:hover:border-[var(--color-border)] disabled:hover:shadow-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#FFFBEB] rounded-lg flex items-center justify-center">
                          <ClipboardCheck className="w-5 h-5 text-[#D4A520]" />
                        </div>
                        <div>
                          <p className="text-xs text-[var(--color-text-secondary)]">
                            {t("courseDetail.assessments")}
                          </p>
                          <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                            {data.assessmentSummary
                              ? `${data.assessmentSummary.completed}/${data.assessmentSummary.total}`
                              : `${data.assessments.length}`}
                          </p>
                          {data.assessmentSummary &&
                            data.assessmentSummary.completed > 0 && (
                              <p className="text-xs text-[var(--color-text-secondary)]">
                                {t("courseDetail.averageScore", {
                                  score: Math.round(data.assessmentSummary.averageScore),
                                })}
                              </p>
                            )}
                        </div>
                      </div>
                    </button>

                    {/* Status — display only */}
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

                  {/* ── Two-column layout: main content + side panel ──
                       Modules + Upcoming + Past + Cancelled lists now live
                       inside the /learn workspace. Only Assessments remains
                       here — it's the off-ramp the stat tile scrolls to. */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 space-y-4">

                  {/* ── "What's Next" smart hero card ──────────────────────
                       Adapts to course state so the main column always opens
                       with a clear next-action — not a guttered empty space.
                       Lightly duplicates the right-rail Live Lecture for
                       zoom-active courses (different layout, same intent). */}
                  {data.enrollment.status === "completed" ? (
                    <div className="rounded-xl border border-[#FDE68A] bg-gradient-to-br from-[#FFFBEB] to-white p-5 sm:p-6">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] flex items-center justify-center flex-shrink-0">
                          <Trophy className="w-5 h-5 text-[#D97706]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#92400E] mb-1">
                            {locale === "ar" ? "اكتملت الدورة" : "Course Completed"}
                          </p>
                          <h2 className="text-base sm:text-lg font-bold text-[var(--color-text-primary)] mb-1">
                            {locale === "ar"
                              ? `تهانينا على إكمال ${isRTL && data.course.titleAr ? data.course.titleAr : data.course.title}`
                              : `Congrats on completing ${data.course.title}`}
                          </h2>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-secondary)]">
                            {data.enrollment.completedAt && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(data.enrollment.completedAt)}
                              </span>
                            )}
                            {data.course.isCmeAccredited && (
                              <span className="flex items-center gap-1 text-[#D4A520] font-medium">
                                <Award className="w-3 h-3" />
                                {t("courseDetail.cmeHours", { hours: data.course.cmeHours ?? 0 })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : nearestUpcoming ? (
                    <Link
                      href={`/${locale}/dashboard/student/courses/${courseId}/learn?tab=lectures&session=${nearestUpcoming.id}`}
                      className={`block rounded-xl border p-5 sm:p-6 transition-all hover:shadow-md ${
                        nearestUpcoming.isWebinar
                          ? "border-[#E9D5FF] bg-gradient-to-br from-[#FAF5FF] to-white hover:border-[#A855F7]"
                          : "border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface-card)] to-[var(--color-surface-page)] hover:border-[var(--color-primary)]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          nearestUpcoming.isWebinar ? "bg-[#F3E8FF]" : "bg-[#EEF4FE]"
                        }`}>
                          {nearestUpcoming.isWebinar ? (
                            <Radio className="w-5 h-5 text-[#A855F7]" />
                          ) : (
                            <Sparkles className="w-5 h-5 text-[var(--color-primary)]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">
                            {isJoinable(nearestUpcoming.scheduledAt) || nearestUpcoming.status === "live"
                              ? (locale === "ar" ? "ابدأ الآن" : "Happening now")
                              : (locale === "ar" ? "التالي في جدولك" : "Up Next")}
                          </p>
                          <h2 className="text-base sm:text-lg font-bold text-[var(--color-text-primary)] mb-1 truncate">
                            {nearestUpcoming.title}
                          </h2>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-secondary)]">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(nearestUpcoming.scheduledAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {isJoinable(nearestUpcoming.scheduledAt) || nearestUpcoming.status === "live"
                                ? (locale === "ar" ? "جاهز للانضمام" : "Ready to join")
                                : (locale === "ar"
                                  ? `يبدأ خلال ${formatTimeUntil(nearestUpcoming.scheduledAt)}`
                                  : `Starts in ${formatTimeUntil(nearestUpcoming.scheduledAt)}`)}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className={`w-5 h-5 text-[var(--color-text-secondary)] flex-shrink-0 mt-1 ${isRTL ? "rotate-180" : ""}`} />
                      </div>
                    </Link>
                  ) : nextInProgressModule ? (
                    <Link
                      href={`/${locale}/dashboard/student/courses/${courseId}/learn?tab=modules&module=${nextInProgressModule.id}`}
                      className="block rounded-xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface-card)] to-[var(--color-surface-page)] p-5 sm:p-6 hover:border-[var(--color-primary)] hover:shadow-md transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#EEF4FE] flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-5 h-5 text-[var(--color-primary)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">
                            {data.enrollment.progress > 0
                              ? (locale === "ar" ? "تابع من حيث توقفت" : "Pick up where you left off")
                              : (locale === "ar" ? "ابدأ الآن" : "Get started")}
                          </p>
                          <h2 className="text-base sm:text-lg font-bold text-[var(--color-text-primary)] mb-1 truncate">
                            {isRTL && nextInProgressModule.titleAr
                              ? nextInProgressModule.titleAr
                              : nextInProgressModule.title}
                          </h2>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-secondary)]">
                            <span className="capitalize">{nextInProgressModule.type}</span>
                            {nextInProgressModule.durationMinutes && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {nextInProgressModule.durationMinutes} {t("calendar.mins")}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className={`w-5 h-5 text-[var(--color-text-secondary)] flex-shrink-0 mt-1 ${isRTL ? "rotate-180" : ""}`} />
                      </div>
                    </Link>
                  ) : (
                    <Link
                      href={`/${locale}/dashboard/student/courses/${courseId}/learn`}
                      className="block rounded-xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface-card)] to-[var(--color-surface-page)] p-5 sm:p-6 hover:border-[var(--color-primary)] hover:shadow-md transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#EEF4FE] flex items-center justify-center flex-shrink-0">
                          <Sparkles className="w-5 h-5 text-[var(--color-primary)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] mb-1">
                            {locale === "ar" ? "مرحباً بك في الدورة" : "Welcome to your course"}
                          </p>
                          <h2 className="text-base sm:text-lg font-bold text-[var(--color-text-primary)] mb-1">
                            {locale === "ar" ? "افتح مساحة التعلم لاستكشاف المحتوى" : "Open the workspace to explore content"}
                          </h2>
                        </div>
                        <ChevronRight className={`w-5 h-5 text-[var(--color-text-secondary)] flex-shrink-0 mt-1 ${isRTL ? "rotate-180" : ""}`} />
                      </div>
                    </Link>
                  )}

                  {/* ── Up Next previews — adaptive 1 or 2 column grid ─────
                       Two compact cards: next lectures + next modules.
                       Each hidden when not applicable (zoom courses with no
                       modules hide the Modules card; self-paced hides the
                       Lectures card; both hidden = entire row skipped). */}
                  {(hasLectures && upcomingPreview.length > 0) || (hasModules && inProgressModulesPreview.length > 0) ? (
                    <div className={`grid grid-cols-1 ${
                      (hasLectures && upcomingPreview.length > 0) && (hasModules && inProgressModulesPreview.length > 0)
                        ? "md:grid-cols-2"
                        : ""
                    } gap-4`}>
                      {hasLectures && upcomingPreview.length > 0 && (
                        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                              {locale === "ar" ? "المحاضرات القادمة" : "Upcoming Lectures"}
                            </h3>
                            <Link
                              href={`/${locale}/dashboard/student/courses/${courseId}/learn?tab=lectures`}
                              className="text-[11px] font-medium text-[var(--color-primary)] hover:underline inline-flex items-center gap-0.5"
                            >
                              {locale === "ar" ? "عرض الكل" : "View all"}
                              <ChevronRight className={`w-3 h-3 ${isRTL ? "rotate-180" : ""}`} />
                            </Link>
                          </div>
                          <div className="space-y-2">
                            {upcomingPreview.map((s) => (
                              <Link
                                key={s.id}
                                href={`/${locale}/dashboard/student/courses/${courseId}/learn?tab=lectures&session=${s.id}`}
                                className="flex items-center gap-2.5 p-2 -mx-2 rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
                              >
                                <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                                  s.isWebinar ? "bg-[#FAF5FF]" : "bg-[#FFFBEB]"
                                }`}>
                                  {s.isWebinar ? (
                                    <Radio className="w-3.5 h-3.5 text-[#A855F7]" />
                                  ) : (
                                    <Video className="w-3.5 h-3.5 text-[#D4A520]" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">{s.title}</p>
                                  <p className="text-[10px] text-[var(--color-text-secondary)]">
                                    {formatDate(s.scheduledAt)} · {formatTimeUntil(s.scheduledAt)}
                                  </p>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {hasModules && inProgressModulesPreview.length > 0 && (
                        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                              {locale === "ar" ? "وحدات قيد التقدم" : "Continue Modules"}
                            </h3>
                            <Link
                              href={`/${locale}/dashboard/student/courses/${courseId}/learn?tab=modules`}
                              className="text-[11px] font-medium text-[var(--color-primary)] hover:underline inline-flex items-center gap-0.5"
                            >
                              {locale === "ar" ? "عرض الكل" : "View all"}
                              <ChevronRight className={`w-3 h-3 ${isRTL ? "rotate-180" : ""}`} />
                            </Link>
                          </div>
                          <div className="space-y-2">
                            {inProgressModulesPreview.map((m) => (
                              <Link
                                key={m.id}
                                href={`/${locale}/dashboard/student/courses/${courseId}/learn?tab=modules&module=${m.id}`}
                                className="flex items-center gap-2.5 p-2 -mx-2 rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
                              >
                                <div className="w-7 h-7 rounded-md bg-[#EEF4FE] flex items-center justify-center flex-shrink-0">
                                  <BookOpen className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                                    {isRTL && m.titleAr ? m.titleAr : m.title}
                                  </p>
                                  <p className="text-[10px] text-[var(--color-text-secondary)] capitalize">
                                    {m.type}
                                    {m.durationMinutes ? ` · ${m.durationMinutes}m` : ""}
                                  </p>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {/* ── Inline Reviews block — completed + reviews pending.
                       Compact: one card covering BOTH course + (optional)
                       instructor review with the existing combined modal. */}
                  {data.enrollment.status === "completed" &&
                    reviewStatus &&
                    !reviewStatus.allRequiredSubmitted && (
                      <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4 sm:p-5">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-9 h-9 rounded-lg bg-[#FEF3C7] flex items-center justify-center flex-shrink-0">
                            <Star className="w-4 h-4 text-[#D97706]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-0.5">
                              {locale === "ar" ? "شاركنا تجربتك" : "Share your experience"}
                            </h3>
                            <p className="text-xs text-[var(--color-text-secondary)]">
                              {locale === "ar"
                                ? "أكمل مراجعتك لطلب الشهادة"
                                : "Complete your review to unlock your certificate"}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3 text-xs">
                          <span className="flex items-center gap-1.5">
                            {reviewStatus.courseReviewSubmitted ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                            ) : (
                              <Circle className="w-3.5 h-3.5 text-[#D97706]" />
                            )}
                            <span className={reviewStatus.courseReviewSubmitted ? "text-[var(--color-text-secondary)]" : "font-medium text-[var(--color-text-primary)]"}>
                              {locale === "ar" ? "مراجعة الدورة" : "Course review"}
                            </span>
                          </span>
                          {reviewStatus.instructorRequired && (
                            <span className="flex items-center gap-1.5">
                              {reviewStatus.instructorReviewSubmitted ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                              ) : (
                                <Circle className="w-3.5 h-3.5 text-[#D97706]" />
                              )}
                              <span className={reviewStatus.instructorReviewSubmitted ? "text-[var(--color-text-secondary)]" : "font-medium text-[var(--color-text-primary)]"}>
                                {locale === "ar" ? "مراجعة المدرب" : "Instructor review"}
                              </span>
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setReviewModalOpen(true)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#B45309] text-white hover:bg-[#92400E] transition-colors cursor-pointer"
                        >
                          <Star className="w-3.5 h-3.5" />
                          {locale === "ar" ? "إرسال المراجعة" : "Submit Review"}
                        </button>
                      </div>
                    )}

                  {/* Assessments — the "Assessments" stat tile scrolls to
                      this anchor. The tile is disabled when there are none,
                      so we don't need an empty-state here. */}
                  {data.assessments.length > 0 && (
                    <div id="assessments-section" className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6 scroll-mt-24">
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
                        {nextUpcomingSession.isWebinar && nextUpcomingSession.studentWebinarJoinUrl && (nextUpcomingSession.status === "scheduled" || nextUpcomingSession.status === "live") ? (
                          /* Already registered. Show Join button if joinable
                             (within 15 min or live); otherwise countdown. */
                          isJoinable(nextUpcomingSession.scheduledAt) || nextUpcomingSession.status === "live" ? (
                            <a
                              href={nextUpcomingSession.studentWebinarJoinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#16A34A] hover:bg-[#15803D] text-white text-sm font-semibold rounded-lg transition-colors"
                            >
                              <Radio className="w-4 h-4" />
                              {locale === "ar" ? "انضم للندوة" : "Join Webinar"}
                            </a>
                          ) : (
                            <div className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#FAF5FF] text-[#7C3AED] border border-[#E9D5FF] text-sm font-semibold rounded-lg">
                              <Clock className="w-4 h-4" />
                              {locale === "ar"
                                ? `تبدأ خلال ${formatTimeUntil(nextUpcomingSession.scheduledAt)}`
                                : `Starts in ${formatTimeUntil(nextUpcomingSession.scheduledAt)}`}
                            </div>
                          )
                        ) : nextUpcomingSession.isWebinar && nextUpcomingSession.status === "scheduled" ? (
                          /* Not registered, still scheduled — show Register button. */
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
                          /* Webinar in progress / ended — registration closed. */
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
