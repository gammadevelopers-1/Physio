"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
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
  MapPin,
  CheckCircle2,
  Circle,
} from "lucide-react";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { useStudentCourseDetail } from "@/hooks/useStudentCourseDetail";

const StudentCourseDetailContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";
  const params = useParams();
  const courseId = params.id as string;
  const userData = useStudentProfile();

  const { data, loading, error } = useStudentCourseDetail(courseId);

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

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

                    {/* Start Learning Button */}
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
                    </div>
                  </div>

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

                    {/* Attendance */}
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
                          .map((module, index) => (
                            <div
                              key={module.id}
                              className="flex items-center gap-3 p-3 rounded-lg border border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors"
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
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Upcoming Sessions */}
                  {data.sessions.length > 0 && (
                    <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 sm:p-6 mb-4">
                      <h2 className="text-base sm:text-lg font-semibold text-[#1F2937] mb-4">
                        {t("courseDetail.upcomingSessions")}
                      </h2>

                      <div className="space-y-3">
                        {data.sessions.map((session) => (
                          <div
                            key={session.id}
                            className="flex items-start gap-3 p-3 rounded-lg border border-[#E5E7EB]"
                          >
                            <div className="w-10 h-10 bg-[#FFFBEB] rounded-lg flex items-center justify-center flex-shrink-0">
                              {session.type === "online" ? (
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
                                <a
                                  href={session.zoomLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 mt-2 text-xs text-[#002D87] hover:underline"
                                >
                                  <Video className="w-3 h-3" />
                                  {t("courseDetail.joinSession")}
                                </a>
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

                  {/* Assessments */}
                  {data.assessments.length > 0 && (
                    <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 sm:p-6">
                      <h2 className="text-base sm:text-lg font-semibold text-[#1F2937] mb-4">
                        {t("courseDetail.assessments")}
                      </h2>

                      <div className="space-y-3">
                        {data.assessments.map((assessment) => (
                          <div
                            key={assessment.id}
                            className="flex items-center gap-3 p-3 rounded-lg border border-[#E5E7EB]"
                          >
                            {assessment.submission?.status === "graded" ? (
                              <CheckCircle2 className="w-5 h-5 text-[#16A34A] flex-shrink-0" />
                            ) : (
                              <Circle className="w-5 h-5 text-[#9CA3AF] flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#1F2937]">
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
                              </div>
                            </div>
                            {assessment.submission ? (
                              <div className="text-right flex-shrink-0">
                                <p className="text-sm font-semibold text-[#1F2937]">
                                  {assessment.submission.score}/
                                  {assessment.submission.totalMarks}
                                </p>
                                <p
                                  className={`text-xs ${
                                    assessment.submission.status === "graded"
                                      ? "text-[#16A34A]"
                                      : "text-[#D4A520]"
                                  }`}
                                >
                                  {assessment.submission.status}
                                </p>
                              </div>
                            ) : (
                              <Link
                                href={`/${locale}/dashboard/student/courses/${courseId}/learn`}
                                className="text-xs text-[#002D87] hover:underline flex-shrink-0"
                              >
                                {t("courseDetail.takeAssessment")}
                              </Link>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default StudentCourseDetailContent;
