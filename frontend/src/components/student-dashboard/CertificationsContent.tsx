"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  Award,
  CheckCircle2,
  Clock,
  Download,
  PauseCircle,
  XCircle,
} from "lucide-react";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import StudentCoursesGridSkeleton from "./StudentCoursesGridSkeleton";
import StudentDashboardError from "./StudentDashboardError";
import OfflineBanner from "./OfflineBanner";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { useStudentCertificates } from "@/hooks/useStudentCertificates";
import type { StudentCertificate } from "@/types/student-dashboard";
import EmptyStateIllustration from "./EmptyStateIllustration";

const statusOrder: Record<string, number> = {
  approved: 0,
  pending: 1,
  held: 2,
  rejected: 3,
};

function StatusBadge({
  status,
  t,
}: {
  status: string;
  t: ReturnType<typeof useTranslations>;
}) {
  switch (status) {
    case "approved":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-green-50 text-green-700">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {t("certifications.statusApproved")}
        </span>
      );
    case "pending":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-yellow-50 text-yellow-700">
          <Clock className="w-3.5 h-3.5" />
          {t("certifications.statusPending")}
        </span>
      );
    case "rejected":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-red-50 text-red-700">
          <XCircle className="w-3.5 h-3.5" />
          {t("certifications.statusRejected")}
        </span>
      );
    case "held":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-orange-50 text-orange-700">
          <PauseCircle className="w-3.5 h-3.5" />
          {t("certifications.statusHeld")}
        </span>
      );
    default:
      return null;
  }
}

function EligibilityChecklist({
  certificate,
  t,
}: {
  certificate: StudentCertificate;
  t: ReturnType<typeof useTranslations>;
}) {
  const attendance = certificate.attendancePercent
    ? parseFloat(certificate.attendancePercent)
    : 0;
  const attendanceMet = attendance >= 70;

  const items = [
    {
      label: t("certifications.attendance"),
      met: attendanceMet,
      detail: `${attendance.toFixed(0)}%`,
    },
    {
      label: t("certifications.assessmentsPassed"),
      met: certificate.assessmentPassed === true,
      detail: certificate.assessmentPassed
        ? t("certifications.yes")
        : t("certifications.no"),
    },
    {
      label: t("certifications.courseCompletion"),
      met: certificate.courseCompleted === true,
      detail: certificate.courseCompleted
        ? t("certifications.yes")
        : t("certifications.no"),
    },
  ];

  return (
    <div className="mt-3 p-3 bg-[#F9FAFB] rounded-lg">
      <p className="text-xs font-medium text-[#4B5563] mb-2">
        {t("certifications.eligibilityTitle")}
      </p>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-xs">
            {item.met ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            )}
            <span
              className={item.met ? "text-[#374151]" : "text-[#9CA3AF]"}
            >
              {item.label}
            </span>
            <span
              className={`ml-auto font-medium ${item.met ? "text-green-600" : "text-red-500"}`}
            >
              {item.detail}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatCertId(id: string): string {
  return `PG-${id.slice(0, 8).toUpperCase()}`;
}

function CertificateCard({
  certificate,
  t,
  locale,
  isRTL,
  formatDate,
}: {
  certificate: StudentCertificate;
  t: ReturnType<typeof useTranslations>;
  locale: string;
  isRTL: boolean;
  formatDate: (dateStr: string | null) => string;
}) {
  const isApproved = certificate.status === "approved";
  const isPending = certificate.status === "pending";
  const isRejected = certificate.status === "rejected";
  const isHeld = certificate.status === "held";

  return (
    <div className="border border-[#E5E7EB] rounded-xl overflow-hidden">
      <div className="p-3 sm:p-4">
        {/* Status Badge */}
        <div className="flex items-center justify-between mb-2">
          <StatusBadge status={certificate.status} t={t} />
        </div>

        {/* Course Title */}
        <h3
          className={`text-sm sm:text-base font-semibold text-[#1F2937] mb-1 sm:mb-2 ${isRTL ? "text-right" : ""}`}
        >
          {isRTL && certificate.courseTitleAr
            ? certificate.courseTitleAr
            : certificate.courseTitle}
        </h3>

        {/* Date */}
        <p
          className={`text-xs sm:text-sm text-[#6B7280] mb-3 ${isRTL ? "text-right" : ""}`}
        >
          {isApproved
            ? t("certifications.issuedOn", {
                date: formatDate(certificate.reviewedAt),
              })
            : t("certifications.requestedOn", {
                date: formatDate(certificate.createdAt),
              })}
        </p>

        {/* Certificate ID (for approved) */}
        {isApproved && (
          <p className={`text-xs font-mono text-[#002D87] bg-[#F0F7FF] px-2 py-1 rounded mb-3 inline-block ${isRTL ? "text-right" : ""}`}>
            {t("certifications.certificateId", { id: formatCertId(certificate.id) })}
          </p>
        )}

        {/* Approved: Certificate thumbnail + accreditation + download */}
        {isApproved && (
          <>
            <div className="w-full h-[140px] sm:h-[180px] bg-gray-50 rounded-lg overflow-hidden mb-3 sm:mb-4 flex items-center justify-center">
              <Award className="w-16 h-16 text-[#D4A520] opacity-30" />
            </div>

            {/* Accredited By */}
            <div
              className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-[#F9FAFB] rounded-lg mb-3 sm:mb-4"
              dir={isRTL ? "rtl" : "ltr"}
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0">
                <Image
                  src="/student_dashboard/certificate_page/image 495.svg"
                  alt="NELC"
                  width={40}
                  height={40}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs text-[#D4A520] mb-0.5">
                  {t("certifications.accreditedBy")}
                </p>
                <p className="text-xs sm:text-sm text-[#1F2937] font-medium truncate">
                  NELC
                </p>
              </div>
            </div>

            {/* Download */}
            {certificate.certificateUrl ? (
              <a
                href={certificate.certificateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2 sm:py-2.5 border border-[#E5E7EB] rounded-lg text-xs sm:text-sm font-medium text-[#1F2937] text-center hover:bg-[#F9FAFB] transition-colors"
              >
                <Download className="w-4 h-4" />
                {t("certifications.downloadCertificate")}
              </a>
            ) : (
              <span className="block w-full py-2 sm:py-2.5 border border-[#E5E7EB] rounded-lg text-xs sm:text-sm font-medium text-[#9CA3AF] text-center">
                {t("certifications.viewCertificate")}
              </span>
            )}
          </>
        )}

        {/* Pending: eligibility checklist + message */}
        {isPending && (
          <>
            <EligibilityChecklist certificate={certificate} t={t} />
            <p className="mt-3 text-xs text-[#6B7280] text-center">
              {t("certifications.pendingMessage")}
            </p>
          </>
        )}

        {/* Rejected: reason + eligibility */}
        {isRejected && (
          <>
            {certificate.reviewNote && (
              <div className="mt-2 p-3 bg-red-50 rounded-lg border border-red-100">
                <p className="text-xs font-medium text-red-700 mb-1">
                  {t("certifications.rejectionReason")}
                </p>
                <p className="text-xs text-red-600">
                  {certificate.reviewNote}
                </p>
              </div>
            )}
            <EligibilityChecklist certificate={certificate} t={t} />
            <p className="mt-3 text-xs text-[#6B7280] text-center">
              {t("certifications.rejectedMessage")}
            </p>
          </>
        )}

        {/* Held: note + eligibility */}
        {isHeld && (
          <>
            {certificate.reviewNote && (
              <div className="mt-2 p-3 bg-orange-50 rounded-lg border border-orange-100">
                <p className="text-xs font-medium text-orange-700 mb-1">
                  {t("certifications.holdNote")}
                </p>
                <p className="text-xs text-orange-600">
                  {certificate.reviewNote}
                </p>
              </div>
            )}
            <EligibilityChecklist certificate={certificate} t={t} />
            <p className="mt-3 text-xs text-[#6B7280] text-center">
              {t("certifications.heldMessage")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const CertificationsContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";
  const userData = useStudentProfile();

  const { data: certificates, loading, error, refetch } = useStudentCertificates();

  // Sort: approved first, then pending, held, rejected
  const sortedCertificates = [...certificates].sort(
    (a, b) => (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4)
  );

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString(
      locale === "ar" ? "ar-SA" : "en-US",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
      }
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
              <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937] mb-4 sm:mb-6">
                {t("certifications.title")}
              </h1>

              <OfflineBanner />

              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 sm:p-6">
                {loading ? (
                  <StudentCoursesGridSkeleton count={4} />
                ) : error ? (
                  <StudentDashboardError message={error} onRetry={refetch} />
                ) : certificates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 sm:py-16">
                    <EmptyStateIllustration variant="certificates" className="mb-2" />
                    <h3 className="text-sm sm:text-base font-medium text-[#1F2937] mb-1">
                      {t("certifications.noCertificatesTitle")}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#6B7280] mb-4 sm:mb-6 text-center px-4">
                      {t("certifications.noCertificatesDescription")}
                    </p>
                    <Link
                      href={`/${locale}/courses`}
                      className="px-5 py-2 sm:px-6 sm:py-2.5 border border-[#E5E7EB] text-[#1F2937] text-xs sm:text-sm font-medium rounded-lg hover:bg-[#F9FAFB] transition-colors"
                    >
                      {t("certifications.viewCourses")}
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
                    {sortedCertificates.map((certificate) => (
                      <CertificateCard
                        key={certificate.id}
                        certificate={certificate}
                        t={t}
                        locale={locale}
                        isRTL={isRTL}
                        formatDate={formatDate}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CertificationsContent;
