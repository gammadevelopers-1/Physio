"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Award, Download, Loader2 } from "lucide-react";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";
import { useAuth } from "@/contexts/AuthContext";
import { instructorApi } from "@/lib/api";

interface StudentCertificate {
  id: string;
  courseId: string;
  status: string;
  certificateUrl: string | null;
  createdAt: string;
  reviewedAt: string | null;
  courseName: string;
  courseThumbnail: string | null;
}

const CertificationsContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";
  const { user } = useAuth();

  const [certificates, setCertificates] = useState<StudentCertificate[]>([]);
  const [loading, setLoading] = useState(true);

  const userData = {
    name: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email : "",
    email: user?.email || "",
    points: 0,
    profileCompletion: 90,
    avatar: user?.avatar || "/images/instructor-1.png",
  };

  useEffect(() => {
    const fetchCertificates = async () => {
      try {
        const data = await instructorApi.getMyCertificates();
        setCertificates(data);
      } catch {
        // Silently fail — show empty state
      } finally {
        setLoading(false);
      }
    };
    fetchCertificates();
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <>
      {/* Dashboard Navbar */}
      <DashboardNavbar user={userData} />

      {/* Main Container */}
      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar - Hidden on mobile */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <DashboardSidebar user={userData} />
            </div>

            {/* Mobile Sidebar */}
            <MobileSidebar user={userData} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Title */}
              <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937] mb-4 sm:mb-6">
                {t("certifications.title")}
              </h1>

              {/* Certifications Section */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 sm:p-6">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 text-[#9CA3AF] animate-spin" />
                  </div>
                ) : certificates.length === 0 ? (
                  // Empty State
                  <div className="flex flex-col items-center justify-center py-10 sm:py-16">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-3 sm:mb-4">
                      <Award className="w-6 h-6 sm:w-8 sm:h-8 text-[#9CA3AF]" />
                    </div>
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
                  // Certificates Grid
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
                    {certificates.map((certificate) => (
                      <div
                        key={certificate.id}
                        className="border border-[#E5E7EB] rounded-xl overflow-hidden"
                      >
                        {/* Certificate Card Content */}
                        <div className="p-3 sm:p-4">
                          {/* Course Title */}
                          <h3
                            className={`text-sm sm:text-base font-semibold text-[#1F2937] mb-1 sm:mb-2 ${isRTL ? "text-right" : ""}`}
                          >
                            {certificate.courseName}
                          </h3>

                          {/* Issued Date */}
                          <p
                            className={`text-xs sm:text-sm text-[#6B7280] mb-3 sm:mb-4 ${isRTL ? "text-right" : ""}`}
                          >
                            {t("certifications.issuedOn", { date: formatDate(certificate.reviewedAt) })}
                          </p>

                          {/* Certificate Thumbnail */}
                          <div className="w-full h-[140px] sm:h-[180px] bg-gray-50 rounded-lg overflow-hidden mb-3 sm:mb-4 flex items-center justify-center">
                            {certificate.courseThumbnail ? (
                              <Image
                                src={certificate.courseThumbnail}
                                alt={certificate.courseName}
                                width={400}
                                height={180}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Award className="w-16 h-16 text-[#D4A520] opacity-30" />
                            )}
                          </div>

                          {/* Accredited By Section */}
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

                          {/* Download Certificate Button */}
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
                        </div>
                      </div>
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
