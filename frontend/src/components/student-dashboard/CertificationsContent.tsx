"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Award } from "lucide-react";
import DashboardSidebar from "./DashboardSidebar";
import MobileSidebar from "./MobileSidebar";
import DashboardNavbar from "./DashboardNavbar";

interface Certificate {
  id: string;
  courseTitleKey: string;
  courseDescriptionKey: string;
  certificateImage: string;
  accreditedBy: {
    logo: string;
    nameKey: string;
  };
}

// Static mock user data
const mockUser = {
  name: "Ibrahim",
  email: "ibrahim@gmail.com",
  points: 0,
  profileCompletion: 90,
  avatar: "/images/instructor-1.png",
};

// Mock certificates data with translation keys
const mockCertificatesData: Certificate[] = [
  {
    id: "cert-1",
    courseTitleKey: "certifications.mockData.courseTitle",
    courseDescriptionKey: "certifications.mockData.courseDescription",
    certificateImage: "/student_dashboard/certificate_page/image 491 (1).svg",
    accreditedBy: {
      logo: "/student_dashboard/certificate_page/image 495.svg",
      nameKey: "certifications.mockData.accreditedByName",
    },
  },
];

const CertificationsContent = () => {
  const locale = useLocale();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";

  // Get certificates with translated content
  const certificates = mockCertificatesData.map((cert) => ({
    ...cert,
    courseTitle: t(cert.courseTitleKey),
    courseDescription: t(cert.courseDescriptionKey),
    accreditedByName: t(cert.accreditedBy.nameKey),
  }));

  return (
    <>
      {/* Dashboard Navbar */}
      <DashboardNavbar user={mockUser} />

      {/* Main Container */}
      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar - Hidden on mobile */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <DashboardSidebar user={mockUser} />
            </div>

            {/* Mobile Sidebar */}
            <MobileSidebar user={mockUser} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Title */}
              <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937] mb-4 sm:mb-6">
                {t("certifications.title")}
              </h1>

              {/* Certifications Section */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 sm:p-6">
                {/* Certificates Grid or Empty State */}
                {certificates.length === 0 ? (
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
                            {certificate.courseTitle}
                          </h3>

                          {/* Course Description */}
                          <p
                            className={`text-xs sm:text-sm text-[#6B7280] mb-3 sm:mb-4 line-clamp-2 ${isRTL ? "text-right" : ""}`}
                          >
                            {certificate.courseDescription}
                          </p>

                          {/* Certificate Image */}
                          <div className="w-full h-[140px] sm:h-[180px] bg-gray-50 rounded-lg overflow-hidden mb-3 sm:mb-4">
                            <Image
                              src={certificate.certificateImage}
                              alt={certificate.courseTitle}
                              width={400}
                              height={180}
                              className="w-full h-full object-contain"
                            />
                          </div>

                          {/* Accredited By Section */}
                          <div
                            className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-[#F9FAFB] rounded-lg mb-3 sm:mb-4"
                            dir={isRTL ? "rtl" : "ltr"}
                          >
                            <div className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0">
                              <Image
                                src={certificate.accreditedBy.logo}
                                alt={certificate.accreditedByName}
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
                                {certificate.accreditedByName}
                              </p>
                            </div>
                          </div>

                          {/* View Certificate Button */}
                          <Link
                            href={`/${locale}/dashboard/student/certifications/${certificate.id}`}
                            className="block w-full py-2 sm:py-2.5 border border-[#E5E7EB] rounded-lg text-xs sm:text-sm font-medium text-[#1F2937] text-center hover:bg-[#F9FAFB] transition-colors"
                          >
                            {t("certifications.viewCertificate")}
                          </Link>
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
