"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight, ChevronLeft, Home, Play, FileCheck, CloudUpload } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { getStrapiMediaUrl } from "@/lib/strapi/client";
import type { CertificationsPage } from "@/lib/strapi/types";

const CertificationsContent = ({ strapiData }: { strapiData?: CertificationsPage | null }) => {
  const t = useTranslations("certificationsPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  // Helper: use Strapi data if available, otherwise fall back to translations
  const s = (field: keyof CertificationsPage, translationKey: string) => {
    const val = strapiData?.[field];
    return (typeof val === 'string' && val) ? val : t(translationKey);
  };

  const nelcLicenseNum = strapiData?.nelcLicenseNumber || "123456789";
  const scfhsAccredNum = strapiData?.scfhsAccreditationNumber || "123456789";

  return (
    <>
      {/* Hero Section */}
      <section className="bg-white px-4 md:px-16 py-16 md:py-24" dir={isRTL ? "rtl" : "ltr"}>
        <div className="max-w-[1312px] mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 mb-6">
            <Link href="/" className="text-[#525252]">
              <Home size={24} />
            </Link>
            {isRTL ? (
              <ChevronLeft size={14} className="text-[#525252]" />
            ) : (
              <ChevronRight size={14} className="text-[#525252]" />
            )}
            <span className="text-[#0a0a0a] text-[14px]">
              {s("breadcrumb", "breadcrumb")}
            </span>
          </div>

          {/* Title and Description */}
          <div className="max-w-[663px]">
            <h1
              className="font-semibold text-[#06080B] tracking-[-0.24px] leading-none mb-6 text-[32px] md:text-[48px]"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {s("heroTitle", "hero.title")}
            </h1>
            <p
              className="text-[#06080B] leading-7 mb-6"
              style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
            >
              {s("heroDescription", "hero.description")}
            </p>
            <button className="h-[40px] px-5 py-2 text-white rounded-xl text-sm font-medium btn-gold">
              {s("heroButtonLabel", "hero.button")}
            </button>
          </div>
        </div>
      </section>

      {/* Accreditation Cards Section */}
      <section className="bg-[#EEF3F7] px-4 md:px-16 py-16 md:py-24" dir={isRTL ? "rtl" : "ltr"}>
        <div className="max-w-[1312px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* NELC Card */}
            <div className="bg-white rounded-[20px] p-8 md:p-16 flex flex-col items-center gap-6 shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
              <div className="h-[80px] flex items-center justify-center">
                <Image
                  src={strapiData?.nelcLogo?.url ? getStrapiMediaUrl(strapiData.nelcLogo.url) : "/certifications_logos/image 492.svg"}
                  alt="NELC Logo"
                  width={203}
                  height={80}
                  className="object-contain"
                />
              </div>
              <h2
                className="font-semibold text-[#06080B] text-center"
                style={{ fontSize: "var(--typeface-font-styles-heading-h2)" }}
              >
                {s("nelcTitle", "accreditation.nelc.title")}
              </h2>
              <p
                className="text-[#06080B] text-center leading-7"
                style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
              >
                {s("nelcDescription", "accreditation.nelc.description")}
                <br />
                <br />
                {s("nelcLicenseLabel", "accreditation.nelc.licenseLabel")} [{nelcLicenseNum}]
              </p>
            </div>

            {/* SCFHS Card */}
            <div className="bg-white rounded-[20px] p-8 md:p-16 flex flex-col items-center gap-6 shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
              <div className="h-[80px] flex items-center justify-center">
                <Image
                  src={strapiData?.scfhsLogo?.url ? getStrapiMediaUrl(strapiData.scfhsLogo.url) : "/certifications_logos/image 493.svg"}
                  alt="SCFHS Logo"
                  width={194}
                  height={80}
                  className="object-contain"
                />
              </div>
              <h2
                className="font-semibold text-[#06080B] text-center"
                style={{ fontSize: "var(--typeface-font-styles-heading-h2)" }}
              >
                {s("scfhsTitle", "accreditation.scfhs.title")}
              </h2>
              <p
                className="text-[#06080B] text-center leading-7"
                style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
              >
                {s("scfhsDescription", "accreditation.scfhs.description")}
                <br />
                <br />
                {s("scfhsAccreditationLabel", "accreditation.scfhs.accreditationLabel")} [{scfhsAccredNum}]
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Certificate Verification Section */}
      <section className="bg-white px-4 md:px-16 py-16 md:py-24" dir={isRTL ? "rtl" : "ltr"}>
        <div className="max-w-[1312px] mx-auto">
          <div className="bg-[#EEF3F7] rounded-[24px] p-6 md:p-12 shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Verification Form */}
              <div className="w-full md:w-1/2 flex items-center justify-center">
                <div className="bg-white rounded-xl p-6 w-full max-w-[400px]">
                  <div className="flex flex-col gap-1 mb-5">
                    <h3 className="font-semibold text-[#171717] text-[16px]">
                      {s("verificationTitle", "verification.title")}
                    </h3>
                    <p className="text-[#737373] text-[14px]">
                      {s("verificationSubtitle", "verification.subtitle")}
                    </p>
                  </div>
                  <div className="flex flex-col gap-5">
                    <input
                      type="text"
                      placeholder={s("verificationPlaceholder", "verification.placeholder")}
                      className={`w-full h-[48px] px-4 border border-[#C8D5E1] rounded-lg text-[14px] text-[#C8D5E1] focus:outline-none focus:border-[#a37f49] ${isRTL ? "text-right" : "text-left"}`}
                      dir={isRTL ? "rtl" : "ltr"}
                    />
                    <button className="w-full h-[40px] text-white rounded-xl text-sm font-medium btn-gold">
                      {s("verificationButtonLabel", "verification.button")}
                    </button>
                  </div>
                </div>
              </div>

              {/* Certificate Image */}
              <div className="w-full md:w-1/2">
                <div className="rounded-[20px] overflow-hidden">
                  <Image
                    src={strapiData?.certificateImage?.url ? getStrapiMediaUrl(strapiData.certificateImage.url) : "/certifications_logos/image 494.svg"}
                    alt="Sample Certificate"
                    width={651}
                    height={445}
                    className="w-full h-auto object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How to Claim CME Hours Section */}
      <section className="bg-[#EEF3F7] px-4 md:px-16 py-16 md:py-24" dir={isRTL ? "rtl" : "ltr"}>
        <div className="max-w-[1312px] mx-auto">
          {/* Title */}
          <h2
            className="font-semibold text-[#06080B] text-center tracking-[-0.24px] leading-none mb-8 text-[32px] md:text-[48px]"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {s("claimCMETitle", "claimCME.title")}
          </h2>

          {/* Steps */}
          <div className="flex flex-col md:flex-row gap-6 justify-center px-0 md:px-36">
            {/* Step 1 */}
            <div className="bg-white rounded-[16px] px-8 py-6 flex flex-col items-center gap-2 shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
              <div className="relative h-[56px] w-[65px]">
                <div className={`absolute ${isRTL ? "left-0" : "right-0"} top-[7px] w-[50px] h-[49px] bg-[#EEF3F7] rounded-tl-[18px] rounded-tr-[5px] rounded-br-[10px] rounded-bl-[5px]`} />
                <div className={`absolute ${isRTL ? "right-0" : "left-0"} top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center`}>
                  <Play size={28} className="text-[#06080B]" />
                </div>
              </div>
              <h3
                className="font-semibold text-[#06080B] text-center"
                style={{ fontSize: "var(--typeface-font-styles-heading-h5)" }}
              >
                {s("step1Title", "claimCME.steps.step1.title")}
              </h3>
              <p className="text-[#4A4C4F] text-[14px] text-center leading-5 w-[251px]">
                {s("step1Description", "claimCME.steps.step1.description")}
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white rounded-[16px] px-8 py-6 flex flex-col items-center gap-2 shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
              <div className="relative h-[56px] w-[65px]">
                <div className={`absolute ${isRTL ? "left-0" : "right-0"} top-[7px] w-[50px] h-[49px] bg-[#EEF3F7] rounded-tl-[18px] rounded-tr-[5px] rounded-br-[10px] rounded-bl-[5px]`} />
                <div className={`absolute ${isRTL ? "right-0" : "left-0"} top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center`}>
                  <FileCheck size={28} className="text-[#06080B]" />
                </div>
              </div>
              <h3
                className="font-semibold text-[#06080B] text-center"
                style={{ fontSize: "var(--typeface-font-styles-heading-h5)" }}
              >
                {s("step2Title", "claimCME.steps.step2.title")}
              </h3>
              <p className="text-[#4A4C4F] text-[14px] text-center leading-5 w-[240px]">
                {s("step2Description", "claimCME.steps.step2.description")}
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white rounded-[16px] px-8 py-6 flex flex-col items-center gap-2 shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
              <div className="relative h-[56px] w-[65px]">
                <div className={`absolute ${isRTL ? "left-0" : "right-0"} top-[7px] w-[50px] h-[49px] bg-[#EEF3F7] rounded-tl-[18px] rounded-tr-[5px] rounded-br-[10px] rounded-bl-[5px]`} />
                <div className={`absolute ${isRTL ? "right-0" : "left-0"} top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center`}>
                  <CloudUpload size={28} className="text-[#06080B]" />
                </div>
              </div>
              <h3
                className="font-semibold text-[#06080B] text-center"
                style={{ fontSize: "var(--typeface-font-styles-heading-h5)" }}
              >
                {s("step3Title", "claimCME.steps.step3.title")}
              </h3>
              <p className="text-[#4A4C4F] text-[14px] text-center leading-5 w-[251px]">
                {s("step3Description", "claimCME.steps.step3.description")}
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default CertificationsContent;
