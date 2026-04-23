"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Loader2,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import { useAuth } from "@/contexts";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { roleRequestsApi, type RoleRequest } from "@/lib/api";

const statusConfig = {
  PENDING: {
    color: "text-[#D97706]",
    bg: "bg-[#FFFBEB]",
    border: "border-[#FDE68A]",
    badgeBg: "bg-[#FEF3C7]",
    badgeText: "text-[#92400E]",
    icon: Clock,
  },
  APPROVED: {
    color: "text-[#16A34A]",
    bg: "bg-[#F0FDF4]",
    border: "border-[#BBF7D0]",
    badgeBg: "bg-[#DCFCE7]",
    badgeText: "text-[#166534]",
    icon: CheckCircle2,
  },
  REJECTED: {
    color: "text-[#DC2626]",
    bg: "bg-[#FEF2F2]",
    border: "border-[#FECACA]",
    badgeBg: "bg-[#FEE2E2]",
    badgeText: "text-[#991B1B]",
    icon: XCircle,
  },
  MORE_INFO: {
    color: "text-[#EA580C]",
    bg: "bg-[#FFF7ED]",
    border: "border-[#FED7AA]",
    badgeBg: "bg-[#FFEDD5]",
    badgeText: "text-[#9A3412]",
    icon: AlertCircle,
  },
};

const ApplicationsContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";
  const { switchRole } = useAuth();
  const userData = useStudentProfile();
  const [applications, setApplications] = useState<RoleRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const data = await roleRequestsApi.getMine();
        setApplications(data);
      } catch (err) {
        setError("Failed to load applications");
      } finally {
        setIsLoading(false);
      }
    };
    fetchApplications();
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <>
      <DashboardNavbar user={userData} />
      <div className="flex flex-1">
        <div className="hidden lg:block">
          <DashboardSidebar user={userData} />
        </div>
        <MobileSidebar user={userData} />

        <div className="flex-1 p-4 lg:p-8" dir={isRTL ? "rtl" : "ltr"}>
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              {t("applicationsPage.title") || "My Applications"}
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              {t("applicationsPage.subtitle") || "Track the status of your role applications"}
            </p>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !error && applications.length === 0 && (
            <div className="bg-white rounded-xl border border-[var(--color-border)] p-12 text-center">
              <FileText className="w-12 h-12 text-[var(--color-border)] mx-auto mb-4" />
              <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">
                {t("applicationsPage.emptyTitle") || "No Applications Yet"}
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] mb-6">
                {t("applicationsPage.emptyDesc") || "You haven't submitted any role applications yet."}
              </p>
              <Link
                href={`/${locale}/become-trainer`}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
              >
                {t("applicationsPage.becomeTrainer") || "Become a Trainer"}
                <ArrowIcon className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* Application Cards */}
          <div className="space-y-4">
            {applications.map((app) => {
              const config = statusConfig[app.status as keyof typeof statusConfig] || statusConfig.PENDING;
              const StatusIcon = config.icon;
              const profileData = app.profileData as Record<string, string>;

              return (
                <div
                  key={app.id}
                  className={`bg-white rounded-xl border border-[var(--color-border)] overflow-hidden`}
                >
                  <div className="p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.badgeBg} ${config.badgeText}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {app.status === "PENDING" && (t("applicationsPage.statusPending") || "Pending Review")}
                            {app.status === "APPROVED" && (t("applicationsPage.statusApproved") || "Approved")}
                            {app.status === "REJECTED" && (t("applicationsPage.statusRejected") || "Rejected")}
                            {app.status === "MORE_INFO" && (t("applicationsPage.statusMoreInfo") || "More Info Needed")}
                          </span>
                        </div>

                        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                          {t("applicationsPage.instructorApplication") || "Instructor Application"}
                        </h3>
                        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                          {profileData?.fullNameEnglish || profileData?.fullNameArabic}
                          {profileData?.specialty && ` · ${profileData.specialty}`}
                        </p>
                      </div>

                      <p className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                        {formatDate(app.createdAt)}
                      </p>
                    </div>

                    {/* Status-specific content */}
                    {app.status === "PENDING" && (
                      <div className={`mt-4 p-3 rounded-lg ${config.bg} border ${config.border}`}>
                        <p className="text-sm ${config.color}">
                          {t("applicationsPage.pendingMessage") || "Your application is under review. We'll notify you once a decision is made."}
                        </p>
                      </div>
                    )}

                    {app.status === "APPROVED" && (
                      <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div className={`flex-1 p-3 rounded-lg ${config.bg} border ${config.border}`}>
                          <p className="text-sm text-[#166534]">
                            {t("applicationsPage.approvedMessage") || "Congratulations! Your application has been approved. You can now switch to the Instructor dashboard."}
                          </p>
                        </div>
                        <button
                          onClick={() => switchRole("INSTRUCTOR")}
                          className="px-4 py-2 bg-[#002D87] text-white rounded-lg text-sm font-medium hover:bg-[#001A52] transition-colors whitespace-nowrap"
                        >
                          {t("applicationsPage.switchRole") || "Switch to Instructor"}
                        </button>
                      </div>
                    )}

                    {app.status === "REJECTED" && (
                      <div className="mt-4">
                        {app.reviewNote && (
                          <div className={`p-3 rounded-lg ${config.bg} border ${config.border} mb-3`}>
                            <p className="text-xs font-semibold text-[#991B1B] mb-1">
                              {t("applicationsPage.reason") || "Reason"}:
                            </p>
                            <p className="text-sm text-[#991B1B]">{app.reviewNote}</p>
                          </div>
                        )}
                        <Link
                          href={`/${locale}/become-trainer`}
                          className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--color-primary)] text-[var(--color-primary)] rounded-lg text-sm font-medium hover:bg-[#FFFBF0] transition-colors"
                        >
                          {t("applicationsPage.reapply") || "Reapply"}
                          <ArrowIcon className="w-4 h-4" />
                        </Link>
                      </div>
                    )}

                    {app.status === "MORE_INFO" && (
                      <div className="mt-4">
                        {app.reviewNote && (
                          <div className={`p-3 rounded-lg ${config.bg} border ${config.border} mb-3`}>
                            <p className="text-xs font-semibold text-[#9A3412] mb-1">
                              {t("applicationsPage.reviewerNote") || "Reviewer's Note"}:
                            </p>
                            <p className="text-sm text-[#9A3412]">{app.reviewNote}</p>
                          </div>
                        )}
                        <Link
                          href={`/${locale}/become-trainer`}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-[#EA580C] text-white rounded-lg text-sm font-medium hover:bg-[#C2410C] transition-colors"
                        >
                          {t("applicationsPage.editResubmit") || "Edit & Resubmit"}
                          <ArrowIcon className="w-4 h-4" />
                        </Link>
                      </div>
                    )}

                    {/* Timeline */}
                    {(app.reviewedAt || app.updatedAt !== app.createdAt) && (
                      <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                        <p className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                          {t("applicationsPage.timeline") || "Timeline"}
                        </p>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-border)]" />
                            <span>{t("applicationsPage.submitted") || "Submitted"}: {formatDate(app.createdAt)}</span>
                          </div>
                          {app.reviewedAt && (
                            <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                              <div className={`w-1.5 h-1.5 rounded-full ${app.status === "APPROVED" ? "bg-[#16A34A]" : app.status === "REJECTED" ? "bg-[#DC2626]" : "bg-[#F59E0B]"}`} />
                              <span>{t("applicationsPage.reviewed") || "Reviewed"}: {formatDate(app.reviewedAt)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

export default ApplicationsContent;
