"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  GraduationCap,
  Printer,
} from "lucide-react";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import StudentTranscriptSkeleton from "./StudentTranscriptSkeleton";
import StudentDashboardError from "./StudentDashboardError";
import OfflineBanner from "./OfflineBanner";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { useStudentTranscript } from "@/hooks/useStudentTranscript";
import type { TranscriptCourse } from "@/types/student-dashboard";

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-[#1F2937]">{value}</p>
          <p className="text-xs text-[#6B7280]">{label}</p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  t,
}: {
  status: string;
  t: ReturnType<typeof useTranslations>;
}) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-50 text-green-700">
        <CheckCircle2 className="w-3 h-3" />
        {t("transcriptPage.completed")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700">
      <Clock className="w-3 h-3" />
      {t("transcriptPage.active")}
    </span>
  );
}

function CertBadge({
  certStatus,
  t,
}: {
  certStatus: string | null;
  t: ReturnType<typeof useTranslations>;
}) {
  if (!certStatus) {
    return (
      <span className="text-xs text-[#9CA3AF]">
        {t("transcriptPage.none")}
      </span>
    );
  }
  if (certStatus === "approved") {
    return (
      <span className="text-xs font-medium text-green-600">
        {t("transcriptPage.approved")}
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-yellow-600">
      {t("transcriptPage.pending")}
    </span>
  );
}

function DeliveryLabel({
  deliveryType,
  t,
}: {
  deliveryType: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const key =
    deliveryType === "online"
      ? "online"
      : deliveryType === "onsite"
        ? "onsite"
        : deliveryType === "hybrid"
          ? "hybrid"
          : "blended";
  return (
    <span className="text-xs text-[#6B7280]">
      {t(`transcriptPage.${key}`)}
    </span>
  );
}

function CourseRow({
  course,
  locale,
  isRTL,
  t,
  formatDate,
}: {
  course: TranscriptCourse;
  locale: string;
  isRTL: boolean;
  t: ReturnType<typeof useTranslations>;
  formatDate: (d: string | null) => string;
}) {
  return (
    <tr className="border-b border-[#F3F4F6] last:border-0 hover:bg-[#F9FAFB] transition-colors">
      <td className="py-3 px-3">
        <p className="text-sm font-medium text-[#1F2937]">
          {isRTL && course.courseTitleAr
            ? course.courseTitleAr
            : course.courseTitle}
        </p>
        <p className="text-xs text-[#9CA3AF] mt-0.5">{course.instructorName}</p>
      </td>
      <td className="py-3 px-3">
        <StatusBadge status={course.status} t={t} />
      </td>
      <td className="py-3 px-3">
        <DeliveryLabel deliveryType={course.deliveryType} t={t} />
      </td>
      <td className="py-3 px-3 text-xs text-[#6B7280]">
        {formatDate(course.enrolledAt)}
      </td>
      <td className="py-3 px-3 text-xs text-[#6B7280]">
        {course.completedAt
          ? formatDate(course.completedAt)
          : "—"}
      </td>
      <td className="py-3 px-3 text-xs text-[#6B7280]">
        {course.totalHours} {t("transcriptPage.hrs")}
      </td>
      <td className="py-3 px-3">
        <CertBadge certStatus={course.certificateStatus} t={t} />
      </td>
      <td className="py-3 px-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${course.progress === 100 ? "bg-green-500" : "bg-blue-500"}`}
              style={{ width: `${course.progress}%` }}
            />
          </div>
          <span className="text-xs text-[#6B7280] w-8 text-right">
            {course.progress}%
          </span>
        </div>
      </td>
    </tr>
  );
}

function CourseMobileCard({
  course,
  locale,
  isRTL,
  t,
  formatDate,
}: {
  course: TranscriptCourse;
  locale: string;
  isRTL: boolean;
  t: ReturnType<typeof useTranslations>;
  formatDate: (d: string | null) => string;
}) {
  return (
    <div className="bg-[#F9FAFB] rounded-xl border border-[var(--color-border)] p-4">
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-semibold text-[#1F2937] flex-1 min-w-0">
          {isRTL && course.courseTitleAr
            ? course.courseTitleAr
            : course.courseTitle}
        </h4>
        <StatusBadge status={course.status} t={t} />
      </div>

      <p className="text-xs text-[#9CA3AF] mb-3">{course.instructorName}</p>

      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div>
          <span className="text-[#9CA3AF]">{t("transcriptPage.deliveryType")}: </span>
          <DeliveryLabel deliveryType={course.deliveryType} t={t} />
        </div>
        <div>
          <span className="text-[#9CA3AF]">{t("transcriptPage.hours")}: </span>
          <span className="text-[#6B7280]">
            {course.totalHours} {t("transcriptPage.hrs")}
          </span>
        </div>
        <div>
          <span className="text-[#9CA3AF]">{t("transcriptPage.enrolledDate")}: </span>
          <span className="text-[#6B7280]">{formatDate(course.enrolledAt)}</span>
        </div>
        <div>
          <span className="text-[#9CA3AF]">{t("transcriptPage.completedDate")}: </span>
          <span className="text-[#6B7280]">
            {course.completedAt ? formatDate(course.completedAt) : "—"}
          </span>
        </div>
        <div>
          <span className="text-[#9CA3AF]">{t("transcriptPage.certificate")}: </span>
          <CertBadge certStatus={course.certificateStatus} t={t} />
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${course.progress === 100 ? "bg-green-500" : "bg-blue-500"}`}
            style={{ width: `${course.progress}%` }}
          />
        </div>
        <span className="text-xs text-[#6B7280]">{course.progress}%</span>
      </div>
    </div>
  );
}

const TranscriptContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";
  const userData = useStudentProfile();

  const { data: transcript, loading, error, refetch } = useStudentTranscript();

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString(
      locale === "ar" ? "ar-SA" : "en-US",
      {
        year: "numeric",
        month: "short",
        day: "numeric",
      }
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <DashboardNavbar user={userData} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0 print:hidden">
              <DashboardSidebar user={userData} />
            </div>

            <MobileSidebar user={userData} />

            <div className="flex-1 min-w-0">
              {/* Header with print button */}
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937]">
                    {t("transcriptPage.title")}
                  </h1>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {t("transcriptPage.subtitle")}
                  </p>
                </div>
                <button
                  onClick={handlePrint}
                  className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#002D87] border border-[#002D87] rounded-lg hover:bg-[#F0F7FF] transition-colors print:hidden"
                >
                  <Printer className="w-4 h-4" />
                  {t("transcriptPage.printTranscript")}
                </button>
              </div>

              <OfflineBanner />

              {loading ? (
                <StudentTranscriptSkeleton />
              ) : error ? (
                <StudentDashboardError message={error} onRetry={refetch} />
              ) : !transcript || transcript.courses.length === 0 ? (
                <div className="bg-white rounded-xl border border-[var(--color-border)] p-4 sm:p-6">
                  <div className="flex flex-col items-center justify-center py-10 sm:py-16">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-3 sm:mb-4">
                      <GraduationCap className="w-6 h-6 sm:w-8 sm:h-8 text-[#9CA3AF]" />
                    </div>
                    <h3 className="text-sm sm:text-base font-medium text-[#1F2937] mb-1">
                      {t("transcriptPage.noCoursesTitle")}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#6B7280] text-center px-4">
                      {t("transcriptPage.noCoursesDescription")}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Student Info */}
                  <div className="bg-white rounded-xl border border-[var(--color-border)] p-4 sm:p-6 mb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-[#F0F7FF] rounded-full flex items-center justify-center">
                          <GraduationCap className="w-6 h-6 text-[#002D87]" />
                        </div>
                        <div>
                          <h2 className="text-base font-semibold text-[#1F2937]">
                            {isRTL
                              ? `${transcript.student.firstNameAr || transcript.student.firstName || ""} ${transcript.student.lastNameAr || transcript.student.lastName || ""}`
                              : `${transcript.student.firstName || ""} ${transcript.student.lastName || ""}`}
                          </h2>
                          <p className="text-xs text-[#6B7280]">
                            {transcript.student.email}
                          </p>
                        </div>
                      </div>
                      <div className="sm:ml-auto text-xs text-[#9CA3AF]">
                        {t("transcriptPage.studentId")}:{" "}
                        <span className="font-mono text-[#6B7280]">
                          {transcript.student.id.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <StatCard
                      icon={CheckCircle2}
                      label={t("transcriptPage.completedCourses")}
                      value={transcript.totalCompleted}
                      color="bg-green-50 text-green-600"
                    />
                    <StatCard
                      icon={BookOpen}
                      label={t("transcriptPage.inProgressCourses")}
                      value={transcript.totalInProgress}
                      color="bg-blue-50 text-blue-600"
                    />
                    <StatCard
                      icon={Clock}
                      label={t("transcriptPage.totalHours")}
                      value={transcript.totalHours}
                      color="bg-purple-50 text-purple-600"
                    />
                  </div>

                  {/* Course Table (desktop) */}
                  <div className="bg-white rounded-xl border border-[var(--color-border)] hidden md:block overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-[#F9FAFB] border-b border-[var(--color-border)]">
                            <th className="py-3 px-3 text-left text-xs font-medium text-[#6B7280]">
                              {t("transcriptPage.courseTitle")}
                            </th>
                            <th className="py-3 px-3 text-left text-xs font-medium text-[#6B7280]">
                              {t("transcriptPage.status")}
                            </th>
                            <th className="py-3 px-3 text-left text-xs font-medium text-[#6B7280]">
                              {t("transcriptPage.deliveryType")}
                            </th>
                            <th className="py-3 px-3 text-left text-xs font-medium text-[#6B7280]">
                              {t("transcriptPage.enrolledDate")}
                            </th>
                            <th className="py-3 px-3 text-left text-xs font-medium text-[#6B7280]">
                              {t("transcriptPage.completedDate")}
                            </th>
                            <th className="py-3 px-3 text-left text-xs font-medium text-[#6B7280]">
                              {t("transcriptPage.hours")}
                            </th>
                            <th className="py-3 px-3 text-left text-xs font-medium text-[#6B7280]">
                              {t("transcriptPage.certificate")}
                            </th>
                            <th className="py-3 px-3 text-left text-xs font-medium text-[#6B7280] min-w-[120px]">
                              {t("transcriptPage.progress")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {transcript.courses.map((course) => (
                            <CourseRow
                              key={course.courseId}
                              course={course}
                              locale={locale}
                              isRTL={isRTL}
                              t={t}
                              formatDate={formatDate}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Course Cards (mobile) */}
                  <div className="md:hidden space-y-3">
                    {transcript.courses.map((course) => (
                      <CourseMobileCard
                        key={course.courseId}
                        course={course}
                        locale={locale}
                        isRTL={isRTL}
                        t={t}
                        formatDate={formatDate}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TranscriptContent;
