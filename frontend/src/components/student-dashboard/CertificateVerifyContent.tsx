"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  Award,
  Calendar,
  Clock,
  User,
  BookOpen,
  Loader2,
  ArrowLeft,
} from "lucide-react";

interface VerificationResult {
  id: string;
  verified: boolean;
  status: string;
  studentName: string;
  courseName: string;
  courseNameAr: string | null;
  totalHours: number | null;
  issuedDate: string | null;
  certificateId: string;
}

export default function CertificateVerifyContent({
  certId,
}: {
  certId: string;
}) {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";

  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function verify() {
      try {
        const res = await fetch(`/api/certificates/verify/${certId}`);
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        setResult(data);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    verify();
  }, [certId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#002D87] mx-auto mb-3" />
          <p className="text-sm text-[#6B7280]">
            {t("verify.verifying")}
          </p>
        </div>
      </div>
    );
  }

  if (notFound || !result) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-[#E5E7EB] shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-[#1F2937] mb-2">
            {t("verify.notFoundTitle")}
          </h1>
          <p className="text-sm text-[#6B7280] mb-6">
            {t("verify.notFoundDescription")}
          </p>
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-[#002D87] border border-[#002D87] rounded-lg hover:bg-[#F0F4FF] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("verify.backToHome")}
          </Link>
        </div>
      </div>
    );
  }

  const courseName =
    isRTL && result.courseNameAr ? result.courseNameAr : result.courseName;

  const formattedDate = result.issuedDate
    ? new Date(result.issuedDate).toLocaleDateString(
        isRTL ? "ar-SA" : "en-US",
        { year: "numeric", month: "long", day: "numeric" },
      )
    : "—";

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
        {/* Verification Status Banner */}
        {result.verified ? (
          <div className="bg-green-500 px-6 py-4 flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-white flex-shrink-0" />
            <div>
              <h1 className="text-lg font-bold text-white">
                {t("verify.verifiedTitle")}
              </h1>
              <p className="text-sm text-green-100">
                {t("verify.verifiedDescription")}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-500 px-6 py-4 flex items-center gap-3">
            <XCircle className="w-8 h-8 text-white flex-shrink-0" />
            <div>
              <h1 className="text-lg font-bold text-white">
                {t("verify.pendingTitle")}
              </h1>
              <p className="text-sm text-yellow-100">
                {t("verify.pendingDescription")}
              </p>
            </div>
          </div>
        )}

        {/* Certificate Details */}
        <div className="p-6 space-y-5">
          {/* Certificate ID */}
          <div className="text-center">
            <span className="inline-block px-4 py-1.5 bg-[#F0F7FF] text-[#002D87] font-mono text-sm font-semibold rounded-full border border-[#DBEAFE]">
              {result.certificateId}
            </span>
          </div>

          {/* Details Grid */}
          <div className="space-y-4">
            {/* Student Name */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-[#F3F4F6] rounded-lg flex items-center justify-center flex-shrink-0">
                <User className="w-4.5 h-4.5 text-[#6B7280]" />
              </div>
              <div>
                <p className="text-xs text-[#9CA3AF] mb-0.5">
                  {t("verify.studentName")}
                </p>
                <p className="text-sm font-medium text-[#1F2937]">
                  {result.studentName}
                </p>
              </div>
            </div>

            {/* Course Name */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-[#F3F4F6] rounded-lg flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-4.5 h-4.5 text-[#6B7280]" />
              </div>
              <div>
                <p className="text-xs text-[#9CA3AF] mb-0.5">
                  {t("verify.courseName")}
                </p>
                <p className="text-sm font-medium text-[#1F2937]">
                  {courseName}
                </p>
              </div>
            </div>

            {/* Issue Date */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-[#F3F4F6] rounded-lg flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4.5 h-4.5 text-[#6B7280]" />
              </div>
              <div>
                <p className="text-xs text-[#9CA3AF] mb-0.5">
                  {t("verify.issuedDate")}
                </p>
                <p className="text-sm font-medium text-[#1F2937]">
                  {formattedDate}
                </p>
              </div>
            </div>

            {/* Total Hours */}
            {result.totalHours && result.totalHours > 0 && (
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-[#F3F4F6] rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4.5 h-4.5 text-[#6B7280]" />
                </div>
                <div>
                  <p className="text-xs text-[#9CA3AF] mb-0.5">
                    {t("verify.totalHours")}
                  </p>
                  <p className="text-sm font-medium text-[#1F2937]">
                    {result.totalHours} {t("verify.hours")}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Issuer Info */}
          <div className="border-t border-[#E5E7EB] pt-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-[#D4A520]" />
            <p className="text-xs text-[#6B7280]">
              {t("verify.issuedBy")}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#F9FAFB] px-6 py-3 text-center">
          <Link
            href={`/${locale}`}
            className="text-xs text-[#6B7280] hover:text-[#002D87] transition-colors"
          >
            {t("verify.backToHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}
