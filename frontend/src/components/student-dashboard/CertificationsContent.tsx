"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Link2,
  PauseCircle,
  ShieldOff,
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
import Select from "@/components/ui/Select";
import { usePlatformLocale } from "@/contexts/PlatformLocaleContext";
import { formatPlatformDateReadable } from "@/lib/platform-locale";
import { studentApi } from "@/lib/api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type { StudentCertificate } from "@/types/student-dashboard";
import EmptyStateIllustration from "./EmptyStateIllustration";

const statusOrder: Record<string, number> = {
  pending: 0,
  approved: 1,
  rejected: 2,
  held: 3,
  revoked: 4,
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
    case "revoked":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-red-100 text-red-900">
          <ShieldOff className="w-3.5 h-3.5" />
          {t("certifications.statusRevoked")}
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
    <div className="mt-3 p-3 bg-[var(--color-surface-page)] rounded-lg">
      <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">
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
              className={item.met ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text-secondary)]"}
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
  onDownload,
  downloading,
}: {
  certificate: StudentCertificate;
  t: ReturnType<typeof useTranslations>;
  locale: string;
  isRTL: boolean;
  formatDate: (dateStr: string | null) => string;
  onDownload: (id: string, lang: 'en' | 'ar') => void;
  downloading: boolean;
}) {
  const isApproved = certificate.status === "approved";
  const isPending = certificate.status === "pending";
  const isRejected = certificate.status === "rejected";
  const isHeld = certificate.status === "held";
  const isRevoked = certificate.status === "revoked";

  return (
    <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col">
      <div className="p-4 sm:p-5 flex flex-col flex-1">
        {/* Status badge + course title + issue date */}
        <div className={`flex items-center justify-between mb-2 ${isRTL ? "flex-row-reverse" : ""}`}>
          <StatusBadge status={certificate.status} t={t} />
          {isApproved && (
            <span className="text-[10px] font-mono text-[var(--color-text-secondary)] bg-[var(--color-border-subtle)] px-2 py-0.5 rounded">
              {formatCertId(certificate.id)}
            </span>
          )}
        </div>

        <h3 className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)] mb-1 line-clamp-2">
          {isRTL && certificate.courseTitleAr
            ? certificate.courseTitleAr
            : certificate.courseTitle}
        </h3>

        <p className="text-xs text-[var(--color-text-secondary)] mb-3">
          {isApproved
            ? t("certifications.issuedOn", { date: formatDate(certificate.reviewedAt) })
            : t("certifications.requestedOn", { date: formatDate(certificate.createdAt) })}
        </p>

        {/* Approved: real PDF preview + accreditation + actions */}
        {isApproved && (
          <>
            <div className="w-full aspect-[4/3] bg-[var(--color-surface-page)] rounded-lg overflow-hidden mb-3 border border-[var(--color-border)] relative group">
              {certificate.certificateUrl ? (
                <>
                  {/* PDF preview — toolbar hidden, fits to width */}
                  <iframe
                    src={`${certificate.certificateUrl}#toolbar=0&navpanes=0&view=FitH`}
                    title={`Certificate ${formatCertId(certificate.id)}`}
                    className="w-full h-full"
                    loading="lazy"
                  />
                  {/* Hover overlay to open in new tab */}
                  <a
                    href={certificate.certificateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                    aria-label={t("certifications.openInTab")}
                  >
                    <span className="text-xs font-medium text-white bg-black/60 px-3 py-1.5 rounded-full">
                      {t("certifications.openInTab")}
                    </span>
                  </a>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Award className="w-16 h-16 text-[#D4A520] opacity-30" />
                </div>
              )}
            </div>

            {/* Accredited By — compact chip */}
            <div className={`flex items-center gap-2 mb-3 text-xs ${isRTL ? "flex-row-reverse" : ""}`}>
              <Image
                src="/student_dashboard/certificate_page/image 495.svg"
                alt="NELC"
                width={20}
                height={20}
                className="flex-shrink-0"
              />
              <span className="text-[var(--color-text-secondary)]">
                {t("certifications.accreditedBy")}{" "}
                <span className="font-semibold text-[var(--color-text-primary)]">NELC</span>
              </span>
            </div>

            {/* Actions — certificate is a legal artifact, buyer picks
                the language (name script + course title + labels). Two
                compact buttons instead of a dropdown so the choice is
                visible without a click. */}
            <div className="flex gap-2 mt-auto">
              <button
                onClick={() => onDownload(certificate.id, 'en')}
                disabled={downloading}
                className="flex items-center justify-center gap-1.5 flex-1 py-2 sm:py-2.5 border border-[var(--color-border)] rounded-lg text-xs sm:text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] transition-colors disabled:opacity-50 cursor-pointer"
                title={t("certifications.downloadCertificateEn")}
              >
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {t("certifications.downloadEn")}
              </button>
              <button
                onClick={() => onDownload(certificate.id, 'ar')}
                disabled={downloading}
                className="flex items-center justify-center gap-1.5 flex-1 py-2 sm:py-2.5 border border-[var(--color-border)] rounded-lg text-xs sm:text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] transition-colors disabled:opacity-50 cursor-pointer"
                title={t("certifications.downloadCertificateAr")}
              >
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {t("certifications.downloadAr")}
              </button>
              <button
                onClick={() => {
                  const shareUrl = `${window.location.origin}/${locale}/verify/${certificate.id}`;
                  navigator.clipboard.writeText(shareUrl).then(() => {
                    toast.success(t("certifications.linkCopied"));
                  });
                }}
                className="flex items-center justify-center gap-2 px-3 py-2 sm:py-2.5 border border-[var(--color-border)] rounded-lg text-xs sm:text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] transition-colors cursor-pointer"
                title={t("certifications.shareCertificate")}
                aria-label={t("certifications.shareCertificate")}
              >
                <Link2 className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {/* CME Hours Info (for non-approved) */}
        {!isApproved && certificate.cmeHours != null && certificate.cmeHours > 0 && (
          <div className={`mt-2 p-3 rounded-lg border ${
            certificate.attendancePercent && parseFloat(certificate.attendancePercent) >= 70 && certificate.assessmentPassed && certificate.courseCompleted
              ? "bg-green-50 border-green-200"
              : "bg-amber-50 border-amber-200"
          }`}>
            <p className={`text-sm font-semibold ${
              certificate.attendancePercent && parseFloat(certificate.attendancePercent) >= 70 && certificate.assessmentPassed && certificate.courseCompleted
                ? "text-green-800"
                : "text-amber-800"
            }`}>
              {certificate.attendancePercent && parseFloat(certificate.attendancePercent) >= 70 && certificate.assessmentPassed && certificate.courseCompleted
                ? (isRTL ? `${certificate.cmeHours} ساعة CME مستحقة` : `${certificate.cmeHours} CME hours earned`)
                : (isRTL ? `0 ساعة CME مستحقة (من أصل ${certificate.cmeHours})` : `0 CME hours earned (out of ${certificate.cmeHours})`)}
            </p>
          </div>
        )}

        {/* Pending: eligibility checklist + message */}
        {isPending && (
          <>
            <EligibilityChecklist certificate={certificate} t={t} />
            <p className="mt-3 text-xs text-[var(--color-text-secondary)] text-center">
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
            <p className="mt-3 text-xs text-[var(--color-text-secondary)] text-center">
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
            <p className="mt-3 text-xs text-[var(--color-text-secondary)] text-center">
              {t("certifications.heldMessage")}
            </p>
          </>
        )}

        {/* Revoked: reason + warning */}
        {isRevoked && (
          <>
            <div className="mt-2 p-3 bg-red-100 rounded-lg border border-red-200">
              <div className="flex items-start gap-2">
                <ShieldOff className="w-4 h-4 text-red-900 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-red-900 mb-1">
                    {t("certifications.revokedTitle")}
                  </p>
                  {certificate.reviewNote && (
                    <p className="text-xs text-red-700">
                      {certificate.reviewNote}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-[var(--color-text-secondary)] text-center">
              {t("certifications.revokedMessage")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

type CertStatusFilter = "all" | "approved" | "pending" | "held" | "rejected" | "revoked";
const CERTS_PER_PAGE = 6;

const CertificationsContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";
  const userData = useStudentProfile();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CertStatusFilter>("all");
  const [page, setPage] = useState(1);

  const { data: certificates, loading, error, refetch } = useStudentCertificates();
  const platformLocale = usePlatformLocale();

  const handleDownload = async (certId: string, lang: 'en' | 'ar') => {
    setDownloadingId(certId);
    try {
      await studentApi.downloadCertificate(certId, lang);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("certifications.downloadFailed");
      toast.error(msg);
    } finally {
      setDownloadingId(null);
    }
  };

  // Sort: approved first, then pending, held, rejected
  const sortedCertificates = [...certificates].sort(
    (a, b) => (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4)
  );
  const filteredCertificates = sortedCertificates.filter(
    (c) => statusFilter === "all" || c.status === statusFilter,
  );
  const totalPages = Math.max(1, Math.ceil(filteredCertificates.length / CERTS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageCerts = filteredCertificates.slice(
    (safePage - 1) * CERTS_PER_PAGE,
    safePage * CERTS_PER_PAGE,
  );

  // Reset to page 1 whenever the filter changes
  const filterKey = statusFilter;
  const lastFilterRef = useRef(filterKey);
  useEffect(() => {
    if (lastFilterRef.current !== filterKey) {
      lastFilterRef.current = filterKey;
      setPage(1);
    }
  }, [filterKey]);

  const formatDate = (dateStr: string | null) =>
    formatPlatformDateReadable(dateStr, platformLocale, locale === "ar" ? "ar" : "en");

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

            <div className="flex-1 min-w-0 space-y-4">
              {/* Page header — title + count + subtitle (matches My Courses pattern) */}
              <div>
                <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                    {t("certifications.title")}
                  </h1>
                  {certificates.length > 0 && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] rounded-full">
                      {certificates.length}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {t("certifications.subtitle")}
                </p>
              </div>

              <OfflineBanner />

              {/* Status filter — only show when there's data */}
              {certificates.length > 0 && (
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-3 sm:p-4">
                  <div className={`flex flex-col sm:flex-row sm:items-center gap-3 ${isRTL ? "sm:flex-row-reverse" : ""}`}>
                    <Select
                      value={statusFilter}
                      onChange={(v) => setStatusFilter(v as CertStatusFilter)}
                      size="sm"
                      className="w-full sm:w-auto sm:min-w-[180px]"
                      options={[
                        { value: "all", label: t("certifications.filterAll") },
                        { value: "approved", label: t("certifications.filterApproved") },
                        { value: "pending", label: t("certifications.filterPending") },
                        { value: "held", label: t("certifications.filterHeld") },
                        { value: "rejected", label: t("certifications.filterRejected") },
                        { value: "revoked", label: t("certifications.filterRevoked") },
                      ]}
                    />
                    {statusFilter !== "all" && (
                      <button
                        type="button"
                        onClick={() => setStatusFilter("all")}
                        className="text-xs font-medium text-[var(--color-primary)] hover:underline self-start sm:self-auto cursor-pointer"
                      >
                        {t("certifications.clearFilter")}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6">
                {loading ? (
                  <StudentCoursesGridSkeleton count={4} />
                ) : error ? (
                  <StudentDashboardError message={error} onRetry={refetch} />
                ) : certificates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 sm:py-16">
                    <EmptyStateIllustration variant="certificates" className="mb-2" />
                    <h3 className="text-sm sm:text-base font-medium text-[var(--color-text-primary)] mb-1">
                      {t("certifications.noCertificatesTitle")}
                    </h3>
                    <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] mb-4 sm:mb-6 text-center px-4">
                      {t("certifications.noCertificatesDescription")}
                    </p>
                    <Link
                      href={`/${locale}/courses`}
                      className="px-5 py-2 sm:px-6 sm:py-2.5 border border-[var(--color-border)] text-[var(--color-text-primary)] text-xs sm:text-sm font-medium rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
                    >
                      {t("certifications.viewCourses")}
                    </Link>
                  </div>
                ) : pageCerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Award className="w-10 h-10 text-[var(--color-border)] mb-2" />
                    <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                      {t("certifications.noCertificatesForFilter")}
                    </p>
                    <button
                      type="button"
                      onClick={() => setStatusFilter("all")}
                      className="text-xs font-medium text-[var(--color-primary)] hover:underline"
                    >
                      {t("certifications.clearFilter")}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                      {pageCerts.map((certificate) => (
                        <CertificateCard
                          key={certificate.id}
                          certificate={certificate}
                          t={t}
                          locale={locale}
                          isRTL={isRTL}
                          formatDate={formatDate}
                          onDownload={handleDownload}
                          downloading={downloadingId === certificate.id}
                        />
                      ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className={`flex items-center justify-between mt-6 ${isRTL ? "flex-row-reverse" : ""}`}>
                        <p className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
                          {t("certifications.showingRange", {
                            from: (safePage - 1) * CERTS_PER_PAGE + 1,
                            to: Math.min(safePage * CERTS_PER_PAGE, filteredCertificates.length),
                            total: filteredCertificates.length,
                          })}
                        </p>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={safePage === 1}
                            className="p-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            aria-label={t("certifications.previousPage")}
                          >
                            {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                          </button>
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum: number;
                            if (totalPages <= 5) pageNum = i + 1;
                            else if (safePage <= 3) pageNum = i + 1;
                            else if (safePage >= totalPages - 2) pageNum = totalPages - 4 + i;
                            else pageNum = safePage - 2 + i;
                            return (
                              <button
                                key={pageNum}
                                type="button"
                                onClick={() => setPage(pageNum)}
                                className={`w-9 h-9 rounded-lg text-sm font-medium cursor-pointer ${
                                  pageNum === safePage
                                    ? "bg-[var(--color-primary)] text-white"
                                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={safePage === totalPages}
                            className="p-2 border border-[var(--color-border)] rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            aria-label={t("certifications.nextPage")}
                          >
                            {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
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
