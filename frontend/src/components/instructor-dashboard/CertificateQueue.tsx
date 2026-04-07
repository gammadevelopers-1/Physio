"use client";

import { useTranslations, useLocale } from "next-intl";
import {
  Star,
  Check,
  X,
  ChevronRight,
  GraduationCap,
  Eye,
} from "lucide-react";
import Link from "next/link";

interface PendingCertificate {
  id: string;
  studentName: string;
  courseName: string;
  completionDate?: string;
  checks: {
    attendance: boolean;
    assessment: boolean;
    completion: boolean;
  };
}

interface CertificateQueueProps {
  certificates: PendingCertificate[];
  totalCount?: number;
  onApprove?: (id: string) => Promise<void>;
  onHold?: (id: string, note: string) => Promise<void>;
  onBatchApprove?: (ids: string[]) => Promise<void>;
  onBatchHold?: (ids: string[], note: string) => Promise<void>;
  onPreview?: (id: string) => void;
  onRefresh?: () => void;
}

const MAX_DISPLAY = 4;

const CertificateQueue = ({
  certificates,
  onPreview,
}: CertificateQueueProps) => {
  const t = useTranslations("instructorDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const totalCount = certificates.length;
  const displayCerts = certificates.slice(0, MAX_DISPLAY);

  const handlePreview = (id: string) => {
    onPreview?.(id);
  };

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB]">
      <div className="p-4 sm:p-5">
        {/* Header with Badge Count */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[#1F2937] flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-[#D4A520]" />
            {t("certificates.pendingTitle")}
          </h3>
          <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 bg-[#FEF3C7] text-[#D4A520] text-xs font-semibold rounded-full">
            {totalCount}
          </span>
        </div>

        {/* Certificate List */}
        <div className="space-y-2">
          {displayCerts.map((cert) => (
            <div
              key={cert.id}
              className="p-3 rounded-lg border bg-[#F9FAFB] border-transparent hover:border-[#E5E7EB] transition-colors"
            >
              {/* Top Row: Star, Name */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-[#FEF3C7] flex items-center justify-center flex-shrink-0">
                  <Star className="w-4 h-4 text-[#D4A520] fill-[#D4A520]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1F2937]">
                    {cert.studentName}
                  </p>
                  <p className="text-xs text-[#6B7280] truncate">
                    {cert.courseName}
                  </p>
                </div>
              </div>

              {/* Bottom Row: Checklist + View */}
              <div className="flex items-center justify-between ps-10">
                {/* Eligibility Checklist */}
                <div className="flex items-center gap-1">
                  <span
                    className={`w-[18px] h-[18px] rounded flex items-center justify-center ${
                      cert.checks.attendance
                        ? "bg-[#DCFCE7] text-[#22C55E]"
                        : "bg-[#FEE2E2] text-[#EF4444]"
                    }`}
                    title={t("certificates.attendance")}
                  >
                    {cert.checks.attendance ? (
                      <Check className="w-2.5 h-2.5" />
                    ) : (
                      <X className="w-2.5 h-2.5" />
                    )}
                  </span>
                  <span
                    className={`w-[18px] h-[18px] rounded flex items-center justify-center ${
                      cert.checks.assessment
                        ? "bg-[#DCFCE7] text-[#22C55E]"
                        : "bg-[#FEE2E2] text-[#EF4444]"
                    }`}
                    title={t("certificates.assessment")}
                  >
                    {cert.checks.assessment ? (
                      <Check className="w-2.5 h-2.5" />
                    ) : (
                      <X className="w-2.5 h-2.5" />
                    )}
                  </span>
                  <span
                    className={`w-[18px] h-[18px] rounded flex items-center justify-center ${
                      cert.checks.completion
                        ? "bg-[#DCFCE7] text-[#22C55E]"
                        : "bg-[#FEE2E2] text-[#EF4444]"
                    }`}
                    title={t("certificates.completion")}
                  >
                    {cert.checks.completion ? (
                      <Check className="w-2.5 h-2.5" />
                    ) : (
                      <X className="w-2.5 h-2.5" />
                    )}
                  </span>
                </div>

                {/* View Button */}
                <button
                  onClick={() => handlePreview(cert.id)}
                  className="p-1.5 text-[#6B7280] hover:text-[#3B82F6] hover:bg-[#EFF6FF] rounded transition-colors"
                  aria-label={t("certificates.preview")}
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* View All Footer */}
        <Link
          href={`/${locale}/dashboard/manager/certificates`}
          className="w-full flex items-center justify-center gap-1 mt-4 py-2.5 text-sm font-medium text-[#3B82F6] hover:underline"
        >
          {t("certificates.reviewAll")} ({totalCount})
          <ChevronRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
        </Link>
      </div>
    </div>
  );
};

export default CertificateQueue;
