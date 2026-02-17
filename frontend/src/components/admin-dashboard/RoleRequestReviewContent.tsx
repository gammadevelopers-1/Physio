"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Download,
  User,
  Phone,
  Mail,
  Globe,
  Briefcase,
  GraduationCap,
  Award,
  Hash,
  Building2,
  CreditCard,
  Twitter,
  Linkedin,
} from "lucide-react";
import { AdminSidebar, AdminNavbar } from "@/components/admin-dashboard";
import AdminMobileSidebar from "./AdminMobileSidebar";
import { roleRequestsApi, type RoleRequest } from "@/lib/api";
import { useAdminProfile } from "@/hooks/useAdminProfile";

const statusConfig = {
  PENDING: { badgeBg: "bg-[#FEF3C7]", badgeText: "text-[#92400E]", icon: Clock, label: "Pending Review" },
  APPROVED: { badgeBg: "bg-[#DCFCE7]", badgeText: "text-[#166534]", icon: CheckCircle2, label: "Approved" },
  REJECTED: { badgeBg: "bg-[#FEE2E2]", badgeText: "text-[#991B1B]", icon: XCircle, label: "Rejected" },
  MORE_INFO: { badgeBg: "bg-[#FFEDD5]", badgeText: "text-[#9A3412]", icon: AlertCircle, label: "More Info Needed" },
};

interface RoleRequestReviewContentProps {
  applicationId: string;
}

const RoleRequestReviewContent = ({ applicationId }: RoleRequestReviewContentProps) => {
  const locale = useLocale();
  const t = useTranslations("adminDashboard");
  const admin = useAdminProfile();
  const isRTL = locale === "ar";
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const [application, setApplication] = useState<RoleRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<"approve" | "reject" | "request-info" | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const fetchApplication = async () => {
      try {
        const data = await roleRequestsApi.getById(applicationId);
        setApplication(data);
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : "Failed to load application");
      } finally {
        setIsLoading(false);
      }
    };
    fetchApplication();
  }, [applicationId]);

  const refreshApplication = async () => {
    try {
      const data = await roleRequestsApi.getById(applicationId);
      setApplication(data);
    } catch { /* ignore refresh errors */ }
  };

  const handleApprove = async () => {
    setActionLoading("approve");
    setActionError(null);
    try {
      await roleRequestsApi.approve(applicationId, reviewNote || undefined);
      await refreshApplication();
      setShowModal(null);
      setReviewNote("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!reviewNote.trim()) {
      setActionError("A reason is required when rejecting an application");
      return;
    }
    setActionLoading("reject");
    setActionError(null);
    try {
      await roleRequestsApi.reject(applicationId, reviewNote);
      await refreshApplication();
      setShowModal(null);
      setReviewNote("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestInfo = async () => {
    if (!reviewNote.trim()) {
      setActionError("A message is required when requesting more information");
      return;
    }
    setActionLoading("request-info");
    setActionError(null);
    try {
      await roleRequestsApi.requestInfo(applicationId, reviewNote);
      await refreshApplication();
      setShowModal(null);
      setReviewNote("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to request info");
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const profileData = (application?.profileData || {}) as Record<string, string>;
  const bankData = (application?.bankData || {}) as Record<string, string>;
  const resumeFiles = (application?.resumeFiles || []) as Array<{ type: string; url: string; filename: string }>;
  const config = application
    ? statusConfig[application.status as keyof typeof statusConfig] || statusConfig.PENDING
    : statusConfig.PENDING;
  const StatusIcon = config.icon;

  const canTakeAction = application && (application.status === "PENDING" || application.status === "MORE_INFO");

  return (
    <>
      <AdminNavbar admin={admin} />
      <div className="flex flex-1">
        <div className="hidden lg:block">
          <AdminSidebar admin={admin} />
        </div>
        <AdminMobileSidebar admin={admin} />

        <div className="flex-1 p-4 lg:p-8" dir={isRTL ? "rtl" : "ltr"}>
          {/* Back button */}
          <Link
            href={`/${locale}/dashboard/admin/role-requests`}
            className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#1F2937] transition-colors mb-6"
          >
            <BackIcon className="w-4 h-4" />
            {t("roleRequestReviewPage.backToList") || "Back to Role Requests"}
          </Link>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#002D87]" />
            </div>
          )}

          {/* Error */}
          {fetchError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              {fetchError}
            </div>
          )}

          {application && !isLoading && (
            <div className="space-y-6">
              {/* Header Card */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h1 className="text-xl font-bold text-[#1F2937]">
                      {t("roleRequestReviewPage.title") || "Application Review"}
                    </h1>
                    <p className="text-sm text-[#6B7280] mt-1">
                      {profileData.fullNameEnglish || profileData.fullNameArabic || application.user?.email}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${config.badgeBg} ${config.badgeText}`}>
                    <StatusIcon className="w-4 h-4" />
                    {config.label}
                  </span>
                </div>

                {/* Review note from admin */}
                {application.reviewNote && (
                  <div className="mt-4 p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
                    <p className="text-xs font-semibold text-[#6B7280] mb-1 uppercase tracking-wider">
                      {t("roleRequestReviewPage.adminNote") || "Admin Note"}
                    </p>
                    <p className="text-sm text-[#1F2937]">{application.reviewNote}</p>
                  </div>
                )}
              </div>

              {/* Profile Information */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
                  {t("roleRequestReviewPage.profileSection") || "Profile Information"}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoField icon={User} label={t("roleRequestReviewPage.fullNameAr") || "Full Name (Arabic)"} value={profileData.fullNameArabic} />
                  <InfoField icon={User} label={t("roleRequestReviewPage.fullNameEn") || "Full Name (English)"} value={profileData.fullNameEnglish} />
                  <InfoField icon={Mail} label={t("roleRequestReviewPage.email") || "Email"} value={profileData.email || application.user?.email} />
                  <InfoField icon={Phone} label={t("roleRequestReviewPage.phone") || "Phone"} value={profileData.phone} />
                  <InfoField icon={Globe} label={t("roleRequestReviewPage.nationality") || "Nationality"} value={profileData.nationality} />
                  <InfoField icon={User} label={t("roleRequestReviewPage.gender") || "Gender"} value={profileData.gender} />
                  <InfoField icon={Briefcase} label={t("roleRequestReviewPage.profession") || "Profession"} value={profileData.profession} />
                  <InfoField icon={GraduationCap} label={t("roleRequestReviewPage.specialty") || "Specialty"} value={profileData.specialty} />
                  <InfoField icon={Award} label={t("roleRequestReviewPage.qualification") || "Qualification"} value={profileData.qualification} />
                  <InfoField icon={Award} label={t("roleRequestReviewPage.rank") || "Rank"} value={profileData.rank} />
                  <InfoField icon={Hash} label={t("roleRequestReviewPage.scfhsNumber") || "SCFHS Number"} value={profileData.scfhsNumber} />
                  <InfoField icon={Hash} label={t("roleRequestReviewPage.nationalId") || "National/Iqama ID"} value={profileData.nationalId} />
                </div>

                {/* Social Links */}
                {(profileData.twitter || profileData.linkedin) && (
                  <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
                    <h3 className="text-sm font-medium text-[#6B7280] mb-3">
                      {t("roleRequestReviewPage.socialLinks") || "Social Links"}
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {profileData.twitter && (
                        <a href={profileData.twitter.startsWith("http") ? profileData.twitter : `https://twitter.com/${profileData.twitter}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F0F9FF] text-[#0369A1] rounded-lg text-sm hover:bg-[#E0F2FE] transition-colors">
                          <Twitter className="w-4 h-4" />
                          {profileData.twitter}
                        </a>
                      )}
                      {profileData.linkedin && (
                        <a href={profileData.linkedin.startsWith("http") ? profileData.linkedin : `https://linkedin.com/in/${profileData.linkedin}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F0F9FF] text-[#0369A1] rounded-lg text-sm hover:bg-[#E0F2FE] transition-colors">
                          <Linkedin className="w-4 h-4" />
                          {profileData.linkedin}
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Resume / Documents */}
              {resumeFiles.length > 0 && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                  <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
                    {t("roleRequestReviewPage.documentsSection") || "Documents & Resume"}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {resumeFiles.map((file, idx) => (
                      <a
                        key={idx}
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors"
                      >
                        <div className="w-10 h-10 bg-[#EFF6FF] rounded-lg flex items-center justify-center shrink-0">
                          <Download className="w-5 h-5 text-[#002D87]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[#1F2937] truncate">{file.filename || file.type}</p>
                          <p className="text-xs text-[#9CA3AF] capitalize">{file.type}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Bank Information */}
              {(bankData.accountHolderName || bankData.bankName || bankData.iban) && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                  <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
                    {t("roleRequestReviewPage.bankSection") || "Bank Information"}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoField icon={User} label={t("roleRequestReviewPage.accountHolder") || "Account Holder"} value={bankData.accountHolderName} />
                    <InfoField icon={Building2} label={t("roleRequestReviewPage.bankName") || "Bank Name"} value={bankData.bankName} />
                    <InfoField icon={CreditCard} label={t("roleRequestReviewPage.iban") || "IBAN"} value={bankData.iban} className="sm:col-span-2" />
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
                  {t("roleRequestReviewPage.timeline") || "Timeline"}
                </h2>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#D1D5DB]" />
                    <p className="text-sm text-[#6B7280]">
                      <span className="font-medium text-[#1F2937]">{t("roleRequestReviewPage.submitted") || "Submitted"}</span>{" "}
                      — {formatDate(application.createdAt)}
                    </p>
                  </div>
                  {application.reviewedAt && (
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        application.status === "APPROVED" ? "bg-[#16A34A]" : application.status === "REJECTED" ? "bg-[#DC2626]" : "bg-[#F59E0B]"
                      }`} />
                      <p className="text-sm text-[#6B7280]">
                        <span className="font-medium text-[#1F2937]">{t("roleRequestReviewPage.reviewed") || "Reviewed"}</span>{" "}
                        — {formatDate(application.reviewedAt)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              {canTakeAction && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
                  <h2 className="text-lg font-semibold text-[#1F2937] mb-4">
                    {t("roleRequestReviewPage.actions") || "Actions"}
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => { setShowModal("approve"); setReviewNote(""); setActionError(null); }}
                      className="px-5 py-2.5 bg-[#16A34A] text-white rounded-lg text-sm font-medium hover:bg-[#15803D] transition-colors"
                    >
                      {t("roleRequestReviewPage.approve") || "Approve"}
                    </button>
                    <button
                      onClick={() => { setShowModal("reject"); setReviewNote(""); setActionError(null); }}
                      className="px-5 py-2.5 bg-[#DC2626] text-white rounded-lg text-sm font-medium hover:bg-[#B91C1C] transition-colors"
                    >
                      {t("roleRequestReviewPage.reject") || "Reject"}
                    </button>
                    <button
                      onClick={() => { setShowModal("request-info"); setReviewNote(""); setActionError(null); }}
                      className="px-5 py-2.5 bg-[#EA580C] text-white rounded-lg text-sm font-medium hover:bg-[#C2410C] transition-colors"
                    >
                      {t("roleRequestReviewPage.requestInfo") || "Request More Info"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !actionLoading && setShowModal(null)}>
          <div
            className="bg-white rounded-xl w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-lg font-semibold text-[#1F2937] mb-1">
                {showModal === "approve" && (t("roleRequestReviewPage.modalApproveTitle") || "Approve Application")}
                {showModal === "reject" && (t("roleRequestReviewPage.modalRejectTitle") || "Reject Application")}
                {showModal === "request-info" && (t("roleRequestReviewPage.modalRequestInfoTitle") || "Request More Information")}
              </h3>
              <p className="text-sm text-[#6B7280] mb-4">
                {showModal === "approve" && (t("roleRequestReviewPage.modalApproveDesc") || "This will approve the application and assign the Instructor role.")}
                {showModal === "reject" && (t("roleRequestReviewPage.modalRejectDesc") || "Please provide a reason for rejecting this application.")}
                {showModal === "request-info" && (t("roleRequestReviewPage.modalRequestInfoDesc") || "Describe what additional information is needed from the applicant.")}
              </p>

              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder={
                  showModal === "approve"
                    ? (t("roleRequestReviewPage.noteOptional") || "Add a note (optional)...")
                    : (t("roleRequestReviewPage.noteRequired") || "Enter your message (required)...")
                }
                className="w-full h-28 p-3 border border-[#E5E7EB] rounded-lg text-sm resize-none outline-none focus:border-[#002D87]"
              />

              {actionError && (
                <p className="mt-2 text-sm text-red-600">{actionError}</p>
              )}

              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => setShowModal(null)}
                  disabled={!!actionLoading}
                  className="px-4 py-2 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#6B7280] hover:bg-[#F9FAFB] transition-colors disabled:opacity-50"
                >
                  {t("roleRequestReviewPage.cancel") || "Cancel"}
                </button>
                <button
                  onClick={() => {
                    if (showModal === "approve") handleApprove();
                    else if (showModal === "reject") handleReject();
                    else handleRequestInfo();
                  }}
                  disabled={!!actionLoading}
                  className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center gap-2 ${
                    showModal === "approve"
                      ? "bg-[#16A34A] hover:bg-[#15803D]"
                      : showModal === "reject"
                        ? "bg-[#DC2626] hover:bg-[#B91C1C]"
                        : "bg-[#EA580C] hover:bg-[#C2410C]"
                  }`}
                >
                  {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {showModal === "approve" && (t("roleRequestReviewPage.confirmApprove") || "Approve")}
                  {showModal === "reject" && (t("roleRequestReviewPage.confirmReject") || "Reject")}
                  {showModal === "request-info" && (t("roleRequestReviewPage.confirmRequestInfo") || "Send Request")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

function InfoField({ icon: Icon, label, value, className = "" }: { icon: React.ComponentType<{ className?: string }>; label: string; value?: string | null; className?: string }) {
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <div className="w-9 h-9 bg-[#F3F4F6] rounded-lg flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-[#6B7280]" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-[#9CA3AF] mb-0.5">{label}</p>
        <p className="text-sm font-medium text-[#1F2937] break-all">{value || "—"}</p>
      </div>
    </div>
  );
}

export default RoleRequestReviewContent;
