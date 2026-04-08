"use client";

import { useState, useMemo } from "react";
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
  Download,
  Film,
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
} from "lucide-react";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { useStudentCourseDetail } from "@/hooks/useStudentCourseDetail";
import { zoomAttendanceApi, studentApi } from "@/lib/api";

const StudentCourseDetailContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";
  const params = useParams();
  const courseId = params.id as string;
  const router = useRouter();
  const userData = useStudentProfile();

  const { data, loading, error } = useStudentCourseDetail(courseId);

  const [showDropConfirm, setShowDropConfirm] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);
  const [showAttendanceHistory, setShowAttendanceHistory] = useState(false);
  const [recordingsModalSession, setRecordingsModalSession] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<
    Array<{
      id: string;
      recordingType: string;
      downloadUrl: string | null;
      playUrl: string | null;
      fileSize: number | null;
      recordingStart: string | null;
      recordingEnd: string | null;
    }>
  >([]);
  const [recordingsLoading, setRecordingsLoading] = useState(false);

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const [pastPage, setPastPage] = useState(5);

  // Split sessions into upcoming/live, completed, and inactive
  const upcomingSessions = useMemo(
    () => data?.sessions.filter((s) => s.status === "scheduled" || s.status === "live") ?? [],
    [data?.sessions]
  );
  const completedSessions = useMemo(
    () => data?.sessions.filter((s) => s.status === "completed" || s.status === "ended") ?? [],
    [data?.sessions]
  );
  const inactiveSessions = useMemo(
    () => data?.sessions.filter((s) => s.status === "cancelled" || s.status === "missed" || s.status === "rescheduled") ?? [],
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

  const handleViewRecordings = async (sessionId: string) => {
    setRecordingsModalSession(sessionId);
    setRecordingsLoading(true);
    try {
      const data = await zoomAttendanceApi.getRecordings(sessionId);
      setRecordings(data.filter((r) => r.recordingType !== 'timeline'));
    } catch {
      setRecordings([]);
    } finally {
      setRecordingsLoading(false);
    }
  };

  const handleDropCourse = async () => {
    setDropping(true);
    try {
      await studentApi.dropCourse(courseId);
      toast.success(t("courseDetail.dropSuccess"));
      router.push(`/${locale}/dashboard/student/courses`);
    } catch {
      toast.error(t("courseDetail.dropError"));
    } finally {
      setDropping(false);
      setShowDropConfirm(false);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatRecordingDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return "—";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const mins = Math.round(ms / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const getAttendanceStatusBadge = (status: string) => {
    switch (status) {
      case "present": return { bg: "bg-[#DCFCE7]", text: "text-[#16A34A]", label: t("courseDetail.statusPresent") };
      case "absent": return { bg: "bg-[#FEE2E2]", text: "text-[#EF4444]", label: t("courseDetail.statusAbsent") };
      case "late": return { bg: "bg-[#FEF3C7]", text: "text-[#D97706]", label: t("courseDetail.statusLate") };
      case "excused": return { bg: "bg-[#EFF6FF]", text: "text-[#3B82F6]", label: t("courseDetail.statusExcused") };
      default: return { bg: "bg-[#F3F4F6]", text: "text-[#6B7280]", label: status };
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString(
      locale === "ar" ? "ar-SA" : "en-US",
      { year: "numeric", month: "long", day: "numeric" }
    );
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString(
      locale === "ar" ? "ar-SA" : "en-US",
      { hour: "2-digit", minute: "2-digit" }
    );
  };

  return (
    <>
      <DashboardNavbar user={userData} />

      <div className="bg-[#F9FAFB] min-h-screen">
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
                className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#1F2937] mb-4 transition-colors"
              >
                <BackIcon className="w-4 h-4" />
                {t("courseDetail.backToCourses")}
              </Link>

              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 text-[#9CA3AF] animate-spin" />
                </div>
              ) : error || !data ? (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center">
                  <p className="text-[#6B7280]">
                    {error || t("courseDetail.notFound")}
                  </p>
                </div>
              ) : (
                <>
                  {/* Course Header */}
                  <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 sm:p-6 mb-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Thumbnail */}
                      <div className="w-full sm:w-[200px] h-[120px] sm:h-[130px] bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        {data.course.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={data.course.thumbnail}
                            alt={data.course.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <BookOpen className="w-10 h-10 text-[#9CA3AF]" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h1 className="text-lg sm:text-xl font-bold text-[#1F2937] mb-2">
                          {isRTL && data.course.titleAr
                            ? data.course.titleAr
                            : data.course.title}
                        </h1>

                        <p className="text-sm text-[#6B7280] mb-3">
                          {data.course.instructorName}
                        </p>

                        {/* Quick Info */}
                        <div className="flex flex-wrap gap-3 text-xs text-[#6B7280]">
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
                            <span className="text-[#6B7280]">
                              {t("courseDetail.progress")}
                            </span>
                            <span className="font-medium text-[#1F2937]">
                              {data.enrollment.progress}%
                            </span>
                          </div>
                          <div className="h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
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

                    {/* Start Learning Button + Drop */}
                    <div className="mt-4 flex flex-col sm:flex-row gap-3">
                      <Link
                        href={`/${locale}/dashboard/student/courses/${courseId}/learn`}
                        className="inline-flex items-center justify-center gap-2 px-6 py-2.5 btn-gold text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                      >
                        <Play className="w-4 h-4" />
                        {data.enrollment.progress > 0
                          ? t("courseDetail.continueLearning")
                          : t("courseDetail.startLearning")}
                      </Link>
                      {data.enrollment.status === "active" && (
                        <button
                          onClick={() => setShowDropConfirm(true)}
                          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" />
                          {t("courseDetail.dropCourse")}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Course Description / Learning Objectives */}
                  {(data.course.description || data.course.descriptionAr) && (
                    <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 sm:p-6 mb-4">
                      <h3 className="text-sm font-semibold text-[#1F2937] mb-3">
                        {t("courseDetail.aboutCourse")}
                      </h3>
                      <p className="text-sm text-[#4B5563] whitespace-pre-wrap leading-relaxed">
                        {isRTL && data.course.descriptionAr
                          ? data.course.descriptionAr
                          : data.course.description}
                      </p>
                    </div>
                  )}

                  {/* Course Info Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    {/* Modules */}
                    <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#F0F7FF] rounded-lg flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-[#002D87]" />
                        </div>
                        <div>
                          <p className="text-xs text-[#6B7280]">
                            {t("courseDetail.modules")}
                          </p>
                          <p className="text-lg font-semibold text-[#1F2937]">
                            {data.modules.filter((m) => m.isCompleted).length}/
                            {data.modules.length}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Attendance — hidden for self-paced */}
                    {data.course.deliveryType !== "self-paced" && (
                      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
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
                            <p className="text-xs text-[#6B7280]">
                              {t("courseDetail.attendance")}
                            </p>
                            <p className="text-lg font-semibold text-[#1F2937]">
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
                    <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#FFFBEB] rounded-lg flex items-center justify-center">
                          <ClipboardCheck className="w-5 h-5 text-[#D4A520]" />
                        </div>
                        <div>
                          <p className="text-xs text-[#6B7280]">
                            {t("courseDetail.assessments")}
                          </p>
                          <p className="text-lg font-semibold text-[#1F2937]">
                            {data.assessmentSummary
                              ? `${data.assessmentSummary.completed}/${data.assessmentSummary.total}`
                              : `${data.assessments.length}`}
                          </p>
                          {data.assessmentSummary &&
                            data.assessmentSummary.completed > 0 && (
                              <p className="text-xs text-[#6B7280]">
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
                    <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#F0FDF4] rounded-lg flex items-center justify-center">
                          <Users className="w-5 h-5 text-[#16A34A]" />
                        </div>
                        <div>
                          <p className="text-xs text-[#6B7280]">
                            {t("courseDetail.status")}
                          </p>
                          <p className="text-lg font-semibold text-[#1F2937] capitalize">
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

                  {/* Course requirements not met banner */}
                  {data.enrollment.status === "completed" && (() => {
                    const dt = data.course.deliveryType;
                    const isSP = dt === "self-paced";
                    const isBlend = dt === "blended";
                    if (isSP || isBlend) return data.enrollment.progress < 100;
                    // Zoom/onsite: check attendance >= 70%
                    const attPct = data.attendanceSummary?.percentage ?? 0;
                    return attPct < 70;
                  })() && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                          <XCircle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-red-800">
                            {t("courseDetail.requirementsNotMet") || "Course requirements not met"}
                          </p>
                          <p className="text-xs text-red-600">
                            {t("courseDetail.cmeHoursEarned", { hours: 0 }) || "CME hours: 0"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Certificate Request — show for all completed courses */}
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
                      <div className={`${isEligible ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"} border rounded-xl p-4 mb-4`}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 ${isEligible ? "bg-green-100" : "bg-amber-100"} rounded-lg flex items-center justify-center`}>
                              <CheckCircle2 className={`w-5 h-5 ${isEligible ? "text-green-600" : "text-amber-600"}`} />
                            </div>
                            <div>
                              {isEligible ? (
                                <>
                                  <p className="text-sm font-semibold text-green-800">
                                    {locale === "ar"
                                      ? `تهانينا! لقد اكتسبت ${cmeHours} ساعة تطوير مهني مستمر`
                                      : `Congratulations! You have earned ${cmeHours} CME hours`}
                                  </p>
                                  <p className="text-xs text-green-600">
                                    {locale === "ar" ? "اطلب شهادتك أدناه" : "Request your certificate below"}
                                  </p>
                                </>
                              ) : (
                                <>
                                  <p className="text-sm font-semibold text-amber-800">
                                    {locale === "ar"
                                      ? `لم تستوفِ بعض المتطلبات — ${cmeHours > 0 ? "0" : "لا توجد"} ساعات CME`
                                      : `Some requirements not met — ${cmeHours > 0 ? "0" : "No"} CME hours earned`}
                                  </p>
                                  <div className="mt-1 space-y-0.5">
                                    {reasons.map((r, i) => (
                                      <p key={i} className="text-xs text-amber-600">• {r}</p>
                                    ))}
                                  </div>
                                  <p className="text-xs text-amber-500 mt-1">
                                    {locale === "ar" ? "يمكنك طلب الشهادة وسيراجعها المدير" : "You can still request — the manager will review"}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                await studentApi.requestCertificate(data.course.id);
                                toast.success(locale === "ar" ? "تم طلب الشهادة! في انتظار موافقة المدير." : "Certificate requested! Pending manager approval.");
                              } catch (err: unknown) {
                                const msg = err instanceof Error ? err.message : (locale === "ar" ? "فشل في طلب الشهادة" : "Failed to request certificate");
                                toast.error(msg);
                              }
                            }}
                            className={`px-4 py-2 ${isEligible ? "bg-green-600 hover:bg-green-700" : "bg-amber-600 hover:bg-amber-700"} text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex-shrink-0`}
                          >
                            {locale === "ar" ? "طلب شهادة" : "Request Certificate"}
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Modules List */}
                  <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 sm:p-6 mb-4">
                    <h2 className="text-base sm:text-lg font-semibold text-[#1F2937] mb-4">
                      {t("courseDetail.courseModules")}
                    </h2>

                    {data.modules.length === 0 ? (
                      <p className="text-sm text-[#6B7280] py-4 text-center">
                        {t("courseDetail.noModules")}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {data.modules
                          .sort((a, b) => a.orderIndex - b.orderIndex)
                          .map((module, index) => {
                            const moduleAssessments = data.assessments.filter((a) => a.moduleId === module.id);
                            return (
                              <div key={module.id} className="rounded-lg border border-[#E5E7EB]">
                                <Link
                                  href={`/${locale}/dashboard/student/courses/${courseId}/learn`}
                                  className="flex items-center gap-3 p-3 hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                                >
                                  {module.isCompleted ? (
                                    <div className="w-8 h-8 rounded-full bg-[#F0FDF4] flex items-center justify-center flex-shrink-0">
                                      <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
                                    </div>
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center flex-shrink-0">
                                      <span className="text-xs font-medium text-[#4B5563]">
                                        {index + 1}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-[#1F2937] truncate">
                                      {isRTL && module.titleAr
                                        ? module.titleAr
                                        : module.title}
                                    </p>
                                    <div className="flex items-center gap-3 text-xs text-[#6B7280]">
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
                                  <div className="border-t border-[#E5E7EB] px-3 py-2 space-y-1.5">
                                    {moduleAssessments.map((ma) => (
                                      <Link
                                        key={ma.id}
                                        href={`/${locale}/dashboard/student/courses/${courseId}/assessment/${ma.id}`}
                                        className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#F9FAFB] transition-colors"
                                      >
                                        <ClipboardCheck className="w-3.5 h-3.5 text-[#6B7280] flex-shrink-0" />
                                        <span className="text-xs text-[#374151] flex-1 truncate">{ma.title}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                          ma.type === "assignment" ? "bg-amber-50 text-amber-700" : ma.type === "exam" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"
                                        }`}>
                                          {ma.type}
                                        </span>
                                        {ma.submission?.status === "graded" ? (
                                          <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] flex-shrink-0" />
                                        ) : ma.submission?.status === "submitted" ? (
                                          <Clock className="w-3.5 h-3.5 text-[#D4A520] flex-shrink-0" />
                                        ) : (
                                          <Circle className="w-3.5 h-3.5 text-[#D1D5DB] flex-shrink-0" />
                                        )}
                                      </Link>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>

                  {/* Attendance History — hidden for self-paced */}
                  {data.course.deliveryType !== "self-paced" && data.attendanceRecords && data.attendanceRecords.length > 0 && (
                    <div className="bg-white rounded-xl border border-[#E5E7EB] mb-4">
                      <button
                        onClick={() => setShowAttendanceHistory(!showAttendanceHistory)}
                        className="w-full flex items-center justify-between p-4 sm:p-6 hover:bg-[#F9FAFB] transition-colors rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <h2 className="text-base sm:text-lg font-semibold text-[#1F2937]">
                            {t("courseDetail.attendanceHistory")}
                          </h2>
                          <span className="text-xs text-[#6B7280]">
                            {data.attendanceSummary
                              ? `${data.attendanceSummary.attended}/${data.attendanceSummary.total} (${data.attendanceSummary.percentage}%)`
                              : ""}
                          </span>
                        </div>
                        {showAttendanceHistory ? (
                          <ChevronUp className="w-5 h-5 text-[#6B7280]" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-[#6B7280]" />
                        )}
                      </button>

                      {showAttendanceHistory && (
                        <div className="border-t border-[#E5E7EB]">
                          {/* Marked by info — shown once */}
                          {(() => {
                            const marker = data.attendanceRecords.find((r: any) => (r as any).markedByName);
                            if (!marker) return null;
                            return (
                              <div className="flex items-center gap-3 px-4 sm:px-6 py-2 bg-[#FAFAFA] text-[10px] text-[#9CA3AF] border-b border-[#E5E7EB]">
                                <span>Marked by: <span className="font-medium text-[#6B7280]">{(marker as any).markedByName}</span> ({(marker as any).markedByRole === "TEACHING_ASSISTANT" ? "TA" : (marker as any).markedByRole === "INSTRUCTOR" ? "Instructor" : (marker as any).markedByRole || "System"})</span>
                              </div>
                            );
                          })()}
                          <div className="divide-y divide-[#E5E7EB]">
                          {data.attendanceRecords.map((record) => {
                            const badge = getAttendanceStatusBadge(record.status);
                            return (
                              <div key={record.sessionId} className="px-4 sm:px-6 py-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-[#1F2937] truncate">
                                      {record.sessionTitle}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#6B7280] mt-1">
                                      <span className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        {formatDate(record.scheduledAt)}
                                      </span>
                                      {record.joinedAt && (
                                        <span>
                                          {t("courseDetail.joinedAt")}: {formatTime(record.joinedAt)}
                                        </span>
                                      )}
                                      {record.leftAt && (
                                        <span>
                                          {t("courseDetail.leftAt")}: {formatTime(record.leftAt)}
                                        </span>
                                      )}
                                      {record.durationMinutes != null && (
                                        <span>
                                          {record.durationMinutes} {t("calendar.mins")}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {record.presencePercent != null && (
                                      <span className={`text-[10px] font-semibold ${record.presencePercent >= 70 ? "text-[#16A34A]" : "text-[#EF4444]"}`}>
                                        {record.presencePercent}%
                                      </span>
                                    )}
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${badge.bg} ${badge.text}`}>
                                      {badge.label}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Upcoming Sessions (hidden for self-paced) */}
                  {data.course.deliveryType !== "self-paced" && upcomingSessions.length > 0 && (
                    <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 sm:p-6 mb-4">
                      <h2 className="text-base sm:text-lg font-semibold text-[#1F2937] mb-4">
                        {t("courseDetail.upcomingSessions")}
                      </h2>

                      <div className="space-y-3">
                        {upcomingSessions.map((session) => (
                          <div
                            key={session.id}
                            className="flex items-start gap-3 p-3 rounded-lg border border-[#E5E7EB]"
                          >
                            <div className="w-10 h-10 bg-[#FFFBEB] rounded-lg flex items-center justify-center flex-shrink-0">
                              {session.type === "zoom" || session.type === "online" ? (
                                <Video className="w-5 h-5 text-[#D4A520]" />
                              ) : (
                                <MapPin className="w-5 h-5 text-[#D4A520]" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#1F2937]">
                                {session.title}
                              </p>
                              <div className="flex flex-wrap gap-3 text-xs text-[#6B7280] mt-1">
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
                              {session.zoomLink && (
                                <button
                                  type="button"
                                  onClick={() => handleJoinZoom(session.id)}
                                  disabled={joiningSessionId === session.id}
                                  className="inline-flex items-center gap-1 mt-2 text-xs text-[#002D87] hover:underline disabled:opacity-60"
                                >
                                  {joiningSessionId === session.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Video className="w-3 h-3" />
                                  )}
                                  {t("courseDetail.joinSession")}
                                </button>
                              )}
                              {session.venueAddress && (
                                <p className="mt-1 text-xs text-[#6B7280]">
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

                  {/* Past Sessions — hidden for self-paced */}
                  {data.course.deliveryType !== "self-paced" && completedSessions.length > 0 && (
                    <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 sm:p-6 mb-4">
                      <h2 className="text-base sm:text-lg font-semibold text-[#1F2937] mb-4">
                        {t("courseDetail.pastSessions")} ({completedSessions.length})
                      </h2>

                      <div className="space-y-3">
                        {completedSessions.slice(0, pastPage).map((session) => {
                          const attRecord = data.attendanceRecords?.find((r) => r.sessionId === session.id);
                          const wasAbsent = attRecord?.status === "absent";
                          const wasPresent = attRecord?.status === "present" || attRecord?.status === "late";
                          return (
                          <div
                            key={session.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border ${wasAbsent ? "border-[#FCA5A5] bg-[#FEF2F2]" : "border-[#E5E7EB]"}`}
                          >
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${wasAbsent ? "bg-[#FEE2E2]" : "bg-[#F3F4F6]"}`}>
                              {wasAbsent ? (
                                <XCircle className="w-5 h-5 text-[#EF4444]" />
                              ) : (
                                <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#6B7280]">
                                {session.title}
                              </p>
                              <div className="flex flex-wrap gap-3 text-xs text-[#9CA3AF] mt-1">
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
                            </div>
                            <button
                              onClick={() => handleViewRecordings(session.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#002D87] border border-[#E5E7EB] rounded-lg hover:bg-[#F0F7FF] transition-colors flex-shrink-0"
                            >
                              <Film className="w-3 h-3" />
                              {t("courseDetail.viewRecording")}
                            </button>
                          </div>
                        )})}
                      </div>
                      {completedSessions.length > pastPage && (
                        <button
                          onClick={() => setPastPage(p => p + 10)}
                          className="w-full mt-3 py-2 text-xs font-medium text-[#3B82F6] hover:bg-[#F0F7FF] rounded-lg transition-colors"
                        >
                          Show more ({completedSessions.length - pastPage} remaining)
                        </button>
                      )}
                    </div>
                  )}

                  {/* Missed/Rescheduled Lectures — hidden for self-paced */}
                  {data.course.deliveryType !== "self-paced" && inactiveSessions.length > 0 && (
                    <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 sm:p-6 mb-4">
                      <h2 className="text-base sm:text-lg font-semibold text-[#6B7280] mb-4">
                        Cancelled / Rescheduled Lectures
                      </h2>
                      <div className="space-y-3">
                        {inactiveSessions.map((session) => (
                          <div key={session.id} className="flex items-start gap-3 p-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB]">
                            <div className="w-10 h-10 bg-[#F3F4F6] rounded-lg flex items-center justify-center flex-shrink-0">
                              <XCircle className="w-5 h-5 text-[#9CA3AF]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#6B7280]">{session.title}</p>
                              <div className="flex flex-wrap gap-3 text-xs text-[#9CA3AF] mt-1">
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
                    <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 sm:p-6">
                      <h2 className="text-base sm:text-lg font-semibold text-[#1F2937] mb-4">
                        {t("courseDetail.assessments")}
                      </h2>

                      <div className="space-y-3">
                        {data.assessments.map((assessment) => {
                          const isGraded = assessment.submission?.status === "graded";
                          const isPending = assessment.submission?.status === "submitted";
                          const isFailed = isGraded && assessment.submission?.score != null && assessment.submission.totalMarks != null &&
                            (assessment.submission.score / (assessment.submission.totalMarks || 1)) * 100 < ((assessment.passingMarks / assessment.totalMarks) * 100);
                          const isPassed = isGraded && !isFailed;
                          const isExpiredAssignment = !assessment.submission && assessment.type === "assignment" && assessment.dueDate && new Date() > new Date(assessment.dueDate);

                          return (
                          <div
                            key={assessment.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border ${
                              isFailed ? "border-red-200 bg-red-50/50" : isExpiredAssignment ? "border-orange-200 bg-orange-50/30" : "border-[#E5E7EB]"
                            }`}
                          >
                            {isPassed ? (
                              <CheckCircle2 className="w-5 h-5 text-[#16A34A] flex-shrink-0" />
                            ) : isFailed ? (
                              <XCircle className="w-5 h-5 text-[#DC2626] flex-shrink-0" />
                            ) : isPending ? (
                              <Clock className="w-5 h-5 text-[#D4A520] flex-shrink-0" />
                            ) : isExpiredAssignment ? (
                              <AlertTriangle className="w-5 h-5 text-[#EA580C] flex-shrink-0" />
                            ) : (
                              <Circle className="w-5 h-5 text-[#9CA3AF] flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${isFailed ? "text-[#DC2626]" : "text-[#1F2937]"}`}>
                                {assessment.title}
                              </p>
                              <div className="flex items-center gap-3 text-xs text-[#6B7280] mt-0.5">
                                <span className="capitalize">
                                  {assessment.type}
                                </span>
                                <span>
                                  {assessment.totalMarks}{" "}
                                  {t("courseDetail.marks")}
                                </span>
                                {assessment.durationMinutes && (
                                  <span>
                                    {assessment.durationMinutes}{" "}
                                    {t("calendar.mins")}
                                  </span>
                                )}
                                {assessment.dueDate && (
                                  <span className={isExpiredAssignment ? "text-[#DC2626]" : ""}>
                                    {new Date(assessment.dueDate).toLocaleDateString("en-SA", { timeZone: "Asia/Riyadh" })}
                                  </span>
                                )}
                              </div>
                            </div>
                            {assessment.submission ? (
                              <div className="flex items-center gap-3 flex-shrink-0">
                                <div className="text-right">
                                  <p className={`text-sm font-semibold ${isFailed ? "text-[#DC2626]" : "text-[#1F2937]"}`}>
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
                                {isGraded && (
                                  <Link
                                    href={`/${locale}/dashboard/student/courses/${courseId}/assessment/${assessment.id}`}
                                    className="text-xs text-[#002D87] hover:underline"
                                  >
                                    {t("courseDetail.review")}
                                  </Link>
                                )}
                              </div>
                            ) : isExpiredAssignment ? (
                              <span className="text-xs font-medium text-[#EA580C] px-2 py-1 bg-orange-100 rounded flex-shrink-0">
                                {t("courseDetail.missed")}
                              </span>
                            ) : (
                              <Link
                                href={`/${locale}/dashboard/student/courses/${courseId}/assessment/${assessment.id}`}
                                className="text-xs text-[#002D87] hover:underline flex-shrink-0"
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recordings Modal */}
      {recordingsModalSession && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0"
            onClick={() => setRecordingsModalSession(null)}
            aria-hidden="true"
          />
          <div className="relative bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
              <h2 className="text-lg font-semibold text-[#1F2937]">
                {t("courseDetail.viewRecording")}
              </h2>
              <button
                onClick={() => setRecordingsModalSession(null)}
                className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[#6B7280]" />
              </button>
            </div>

            {recordingsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-[#6B7280]" />
              </div>
            ) : recordings.length === 0 ? (
              <div className="py-12 text-center">
                <Film className="w-10 h-10 text-[#D1D5DB] mx-auto mb-3" />
                <p className="text-sm text-[#6B7280]">
                  {t("courseDetail.noRecordings")}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#E5E7EB]">
                {recordings.map((rec) => (
                  <div key={rec.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 bg-[#EFF6FF] text-[#3B82F6] text-[10px] font-medium rounded">
                        {rec.recordingType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                      <div className="flex items-center gap-2">
                        {rec.playUrl && (
                          <a
                            href={rec.playUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#3B82F6] border border-[#3B82F6] rounded-lg hover:bg-[#3B82F6] hover:text-white transition-colors"
                          >
                            <Play className="w-3 h-3" />
                            {t("courseDetail.viewRecording")}
                          </a>
                        )}
                        {rec.downloadUrl && (
                          <a
                            href={rec.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#6B7280] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors"
                          >
                            <Download className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[#6B7280]">
                      <span>
                        {t("courseDetail.duration")}:{" "}
                        {formatRecordingDuration(rec.recordingStart, rec.recordingEnd)}
                      </span>
                      <span>
                        {formatFileSize(rec.fileSize)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end p-4 border-t border-[#E5E7EB]">
              <button
                onClick={() => setRecordingsModalSession(null)}
                className="px-4 py-2 text-sm font-medium text-[#6B7280] hover:text-[#1F2937] transition-colors"
              >
                {t("courseDetail.backToCourses").includes("Back") ? "Close" : "إغلاق"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drop Course Confirmation Modal */}
      {showDropConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-[#1F2937]">
                  {t("courseDetail.dropConfirmTitle")}
                </h3>
              </div>
              <p className="text-sm text-[#6B7280] mb-6">
                {t("courseDetail.dropConfirmMessage")}
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDropConfirm(false)}
                  disabled={dropping}
                  className="px-4 py-2 text-sm font-medium text-[#6B7280] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors cursor-pointer"
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
    </>
  );
};

export default StudentCourseDetailContent;
