"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import {
  CheckCircle2,
  XCircle,
  Shield,
  Calendar,
  Clock,
  User,
  BookOpen,
  Loader2,
  Award,
  BadgeCheck,
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
      <div className="min-h-screen bg-[#F8F9FC] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#002D87] mx-auto mb-3" />
          <p className="text-sm text-[#6B7280]">{t("verify.verifying")}</p>
        </div>
      </div>
    );
  }

  if (notFound || !result) {
    return (
      <div className="min-h-screen bg-[#F8F9FC] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-lg p-10">
            <div className="w-20 h-20 bg-[#FEF2F2] rounded-full flex items-center justify-center mx-auto mb-5">
              <XCircle className="w-10 h-10 text-[#EF4444]" />
            </div>
            <h1 className="text-2xl font-bold text-[#1F2937] mb-2">
              {t("verify.notFoundTitle")}
            </h1>
            <p className="text-sm text-[#6B7280] mb-8">
              {t("verify.notFoundDescription")}
            </p>
            <Link
              href={`/${locale}`}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-[#002D87] rounded-lg hover:bg-[#001E5C] transition-colors"
            >
              {t("verify.backToHome")}
            </Link>
          </div>
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
    <div className="min-h-screen bg-[#F8F9FC] flex items-center justify-center p-4">
      <div className="max-w-xl w-full">
        {/* Logo */}
        <div className="text-center mb-6">
          <Image
            src="/images/logo.png"
            alt="PhysioGuidance"
            width={60}
            height={60}
            className="mx-auto"
          />
        </div>

        {/* Certificate Card */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-lg overflow-hidden">
          {/* Status Banner */}
          {result.verified ? (
            <div className="bg-gradient-to-r from-[#002D87] to-[#0046D4] px-8 py-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/15 rounded-full flex items-center justify-center flex-shrink-0">
                  <BadgeCheck className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-wide">
                    {t("verify.verifiedTitle")}
                  </h1>
                  <p className="text-sm text-blue-200 mt-0.5">
                    {t("verify.verifiedDescription")}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-[#D97706] to-[#F59E0B] px-8 py-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/15 rounded-full flex items-center justify-center flex-shrink-0">
                  <Shield className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white tracking-wide">
                    {t("verify.pendingTitle")}
                  </h1>
                  <p className="text-sm text-yellow-100 mt-0.5">
                    {t("verify.pendingDescription")}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Certificate Content */}
          <div className="px-8 py-7">
            {/* Certificate ID */}
            <div className="text-center mb-6">
              <span className="inline-block px-5 py-2 bg-[#F0F4FF] text-[#002D87] font-mono text-sm font-bold rounded-full border border-[#D6E0F5]">
                {result.certificateId}
              </span>
            </div>

            {/* Decorative divider */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-[#E5E7EB]" />
              <Award className="w-5 h-5 text-[#D4A520]" />
              <div className="flex-1 h-px bg-[#E5E7EB]" />
            </div>

            {/* Certificate Title */}
            <div className="text-center mb-6">
              <p className="text-xs text-[#9CA3AF] uppercase tracking-widest mb-1">Certificate of Attendance</p>
              <p className="text-lg font-bold text-[#1F2937]">{result.studentName}</p>
              <p className="text-sm text-[#6B7280] mt-1">for completing</p>
              <p className="text-base font-semibold text-[#002D87] mt-1">{courseName}</p>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-[#F9FAFB] rounded-xl p-4 text-center">
                <Calendar className="w-5 h-5 text-[#002D87] mx-auto mb-2" />
                <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider mb-1">Date Issued</p>
                <p className="text-sm font-semibold text-[#1F2937]">{formattedDate}</p>
              </div>

              {result.totalHours && result.totalHours > 0 ? (
                <div className="bg-[#F9FAFB] rounded-xl p-4 text-center">
                  <Clock className="w-5 h-5 text-[#D4A520] mx-auto mb-2" />
                  <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider mb-1">CME Hours</p>
                  <p className="text-sm font-semibold text-[#1F2937]">{result.totalHours} Hours</p>
                </div>
              ) : (
                <div className="bg-[#F9FAFB] rounded-xl p-4 text-center">
                  <Shield className="w-5 h-5 text-[#22C55E] mx-auto mb-2" />
                  <p className="text-[10px] text-[#9CA3AF] uppercase tracking-wider mb-1">Status</p>
                  <p className="text-sm font-semibold text-[#22C55E]">Verified</p>
                </div>
              )}
            </div>

            {/* SCFHS Accreditation */}
            <div className="mt-6 text-center">
              <p className="text-[11px] text-[#9CA3AF]">
                Accredited by the Saudi Commission for Health Specialties (SCFHS)
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-[#E5E7EB] bg-[#FAFBFC] px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image src="/images/logo.png" alt="" width={20} height={20} />
              <span className="text-xs text-[#9CA3AF]">Issued by PhysioGuidance</span>
            </div>
            <Link
              href={`/${locale}`}
              className="text-xs text-[#002D87] font-medium hover:underline transition-colors"
            >
              {t("verify.backToHome")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
