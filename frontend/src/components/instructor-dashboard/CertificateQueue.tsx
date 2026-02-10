"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Star,
  Check,
  X,
  ChevronRight,
  GraduationCap,
  Eye,
  CheckCircle,
  PauseCircle,
} from "lucide-react";

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
}

const CertificateQueue = ({
  certificates,
}: CertificateQueueProps) => {
  const t = useTranslations("instructorDashboard");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const totalCount = certificates.length;
  const allSelected = selectedIds.size === certificates.length && certificates.length > 0;
  const someSelected = selectedIds.size > 0 && selectedIds.size < certificates.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(certificates.map((c) => c.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleApprove = (id: string) => {
    console.log("Approving certificate:", id);
  };

  const handleHold = (id: string) => {
    console.log("Holding certificate:", id);
  };

  const handlePreview = (id: string) => {
    console.log("Previewing certificate:", id);
  };

  const handleBatchApprove = () => {
    console.log("Batch approving:", Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleBatchHold = () => {
    console.log("Batch holding:", Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  // Check if certificate is eligible (all checks passed)
  const isEligible = (checks: PendingCertificate["checks"]) => {
    return checks.attendance && checks.assessment && checks.completion;
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
          {/* Badge Count */}
          <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 bg-[#FEF3C7] text-[#D4A520] text-xs font-semibold rounded-full">
            {totalCount}
          </span>
        </div>

        {/* Select All Row */}
        <div className="py-2 px-2 mb-2 bg-[#F3F4F6] rounded-lg">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={toggleSelectAll}
                className="w-4 h-4 text-[#3B82F6] border-[#D1D5DB] rounded focus:ring-[#3B82F6] cursor-pointer"
              />
              <span className="text-xs font-medium text-[#4B5563]">
                {t("certificates.selectAll")}
              </span>
            </label>
            {selectedIds.size > 0 && (
              <span className="text-xs text-[#6B7280]">
                {selectedIds.size} {t("certificates.selected")}
              </span>
            )}
          </div>

          {/* Batch Actions - Show when items selected */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#E5E7EB]">
              <button
                onClick={handleBatchApprove}
                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-[#22C55E] bg-[#DCFCE7] rounded hover:bg-[#BBF7D0] transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                {t("certificates.approve")}
              </button>
              <button
                onClick={handleBatchHold}
                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-[#F97316] bg-[#FFEDD5] rounded hover:bg-[#FED7AA] transition-colors"
              >
                <PauseCircle className="w-3.5 h-3.5" />
                {t("certificates.hold")}
              </button>
            </div>
          )}
        </div>

        {/* Certificate List */}
        <div className="space-y-2">
          {certificates.map((cert) => (
            <div
              key={cert.id}
              className={`p-3 rounded-lg border transition-colors ${
                selectedIds.has(cert.id)
                  ? "bg-[#EFF6FF] border-[#3B82F6]"
                  : "bg-[#F9FAFB] border-transparent hover:border-[#E5E7EB]"
              }`}
            >
              {/* Top Row: Checkbox, Star, Name */}
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={selectedIds.has(cert.id)}
                  onChange={() => toggleSelect(cert.id)}
                  className="w-4 h-4 text-[#3B82F6] border-[#D1D5DB] rounded focus:ring-[#3B82F6] cursor-pointer flex-shrink-0"
                />
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

              {/* Bottom Row: Checklist + Actions */}
              <div className="flex items-center justify-between ps-6">
                {/* Eligibility Checklist */}
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
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
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePreview(cert.id)}
                    className="p-1.5 text-[#6B7280] hover:text-[#3B82F6] hover:bg-[#EFF6FF] rounded transition-colors"
                    title={t("certificates.preview")}
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleApprove(cert.id)}
                    disabled={!isEligible(cert.checks)}
                    className={`p-1.5 rounded transition-colors ${
                      isEligible(cert.checks)
                        ? "text-[#22C55E] hover:bg-[#DCFCE7]"
                        : "text-[#D1D5DB] cursor-not-allowed"
                    }`}
                    title={t("certificates.approve")}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleHold(cert.id)}
                    className="p-1.5 text-[#F97316] hover:bg-[#FFEDD5] rounded transition-colors"
                    title={t("certificates.hold")}
                  >
                    <PauseCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
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
