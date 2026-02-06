"use client";

import { useTranslations } from "next-intl";
import { Star, Check, X, ChevronRight, GraduationCap } from "lucide-react";

interface PendingCertificate {
  id: string;
  studentName: string;
  courseName: string;
  checks: {
    attendance: boolean;
    assessment: boolean;
    completion: boolean;
  };
}

interface CertificateQueueProps {
  certificates: PendingCertificate[];
  totalCount: number;
}

const CertificateQueue = ({
  certificates,
  totalCount,
}: CertificateQueueProps) => {
  const t = useTranslations("instructorDashboard");

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB]">
      <div className="p-5">
        <h3 className="text-base font-semibold text-[#1F2937] mb-4 flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-[#D4A520]" />
          {t("certificates.pendingTitle")}
        </h3>

        <div className="space-y-2.5">
          {certificates.map((cert) => (
            <div
              key={cert.id}
              className="flex items-center gap-2.5 p-2.5 bg-[#F9FAFB] rounded-lg"
            >
              {/* Icon */}
              <div className="w-9 h-9 rounded-full bg-[#FEF3C7] flex items-center justify-center">
                <Star className="w-4.5 h-4.5 text-[#D4A520] fill-[#D4A520]" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-[#1F2937] truncate">
                  {cert.studentName}
                </p>
                <p className="text-xs text-[#6B7280] truncate">
                  {cert.courseName}
                </p>
              </div>

              {/* Eligibility Checks */}
              <div className="flex gap-1">
                <span
                  className={`w-[18px] h-[18px] rounded flex items-center justify-center text-[10px] ${
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
                  className={`w-[18px] h-[18px] rounded flex items-center justify-center text-[10px] ${
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
                  className={`w-[18px] h-[18px] rounded flex items-center justify-center text-[10px] ${
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
            </div>
          ))}
        </div>

        {/* Review All Link */}
        <button className="w-full flex items-center justify-center gap-1 mt-4 py-2.5 text-sm font-medium text-[#3B82F6] hover:underline">
          {t("certificates.reviewAll")} ({totalCount})
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default CertificateQueue;
