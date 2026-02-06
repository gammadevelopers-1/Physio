"use client";

import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { getStrapiMediaUrl } from "@/lib/strapi/client";
import type { NELCPage } from "@/lib/strapi/types";

const NELCContent = ({ strapiData }: { strapiData?: NELCPage | null }) => {
  const t = useTranslations("nelcPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  // Helper: use Strapi data if available, otherwise fall back to translations
  const s = (field: keyof NELCPage, translationKey: string) => {
    const val = strapiData?.[field];
    return (typeof val === 'string' && val) ? val : t(translationKey);
  };

  return (
    <>
      {/* Hero Section */}
      <section className="bg-white px-4 md:px-16 py-16 md:py-24" dir={isRTL ? "rtl" : "ltr"}>
        <div className="max-w-[1312px] mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-16">
            {/* Content - Always on the left visually */}
            <div className="flex flex-col gap-12 w-full md:max-w-[663px]">
              {/* Title and Description */}
              <div className="flex flex-col gap-6">
                <h1
                  className="font-semibold text-[#06080B] tracking-[-0.15px] md:tracking-[-0.24px] leading-none text-[30px] md:text-[48px]"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  {s("heroTitle", "hero.title")}
                </h1>
                <p className="text-[#06080B] leading-7 text-[18px] md:text-[20px]">
                  {s("heroDescription", "hero.description")}
                </p>
              </div>

              {/* License Info Cards - Stack vertically on mobile */}
              <div className="flex flex-col md:flex-row gap-4 w-full">
                {/* License Number */}
                <div className="bg-[#F9FBFD] rounded-[10px] px-3 py-2 flex items-start gap-3 w-full md:flex-1">
                  <div className="w-1 self-stretch bg-[#C8D5E1] rounded" />
                  <div className="flex flex-col">
                    <span className="font-medium text-[#06080B] text-[14px] leading-5">
                      {s("licenseNumberLabel", "hero.licenseNumber.label")}
                    </span>
                    <span className="text-[#4A4C4F] text-[12px] leading-4">
                      {s("licenseNumberValue", "hero.licenseNumber.value")}
                    </span>
                  </div>
                </div>

                {/* License Type */}
                <div className="bg-[#F9FBFD] rounded-[10px] px-3 py-2 flex items-start gap-3 w-full md:flex-1">
                  <div className="w-1 self-stretch bg-[#C8D5E1] rounded" />
                  <div className="flex flex-col">
                    <span className="font-medium text-[#06080B] text-[14px] leading-5">
                      {s("licenseTypeLabel", "hero.licenseType.label")}
                    </span>
                    <span className="text-[#4A4C4F] text-[12px] leading-4">
                      {s("licenseTypeValue", "hero.licenseType.value")}
                    </span>
                  </div>
                </div>

                {/* Status */}
                <div className="bg-[#F9FBFD] rounded-[10px] px-3 py-2 flex items-start gap-3 w-full md:flex-1">
                  <div className="w-1 self-stretch bg-[#C8D5E1] rounded" />
                  <div className="flex flex-col">
                    <span className="font-medium text-[#06080B] text-[14px] leading-5">
                      {s("statusLabel", "hero.status.label")}
                    </span>
                    <span className="text-[#4A4C4F] text-[12px] leading-4">
                      {s("statusValue", "hero.status.value")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* NELC Logo - Always on the right visually */}
            <div className="flex-shrink-0 flex justify-center w-full md:w-auto">
              <Image
                src={strapiData?.nelcLogo?.url ? getStrapiMediaUrl(strapiData.nelcLogo.url) : "/NELC_agreement/image 492 (1).svg"}
                alt="National eLearning Center"
                width={437}
                height={172}
                className="object-contain w-[277px] md:w-[437px] h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Our Compliance Section */}
      <section className="bg-white px-4 md:px-16 py-16 md:py-24" dir={isRTL ? "rtl" : "ltr"}>
        <div className="max-w-[1312px] mx-auto">
          {/* Title and Subtitle */}
          <div className="flex flex-col items-center gap-4 mb-10 max-w-[768px] mx-auto">
            <h2
              className="font-semibold text-[#06080B] text-center tracking-[-0.15px] md:tracking-[-0.24px] leading-none text-[30px] md:text-[48px]"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {s("complianceTitle", "compliance.title")}
            </h2>
            <p className="text-[#06080B] text-center leading-7 text-[18px] md:text-[20px]">
              {s("complianceDescription", "compliance.description")}
            </p>
          </div>

          {/* Compliance Cards - Stack vertically on mobile */}
          <div className="flex flex-col md:flex-row gap-8 md:gap-8 justify-center items-center">
            {/* Governance Card */}
            <div className="flex flex-col items-center relative w-full md:w-auto pb-6">
              <div className="h-[286px] w-full md:w-[368px] relative z-0 rounded-[16px] overflow-hidden shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
                <Image
                  src={strapiData?.governanceImage?.url ? getStrapiMediaUrl(strapiData.governanceImage.url) : "/NELC_agreement/image 18.svg"}
                  alt={s("governanceTitle", "compliance.cards.governance.title")}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="bg-[#EEF3F7] rounded-[16px] p-4 min-h-[140px] md:h-[140px] w-[285px] md:w-[317px] -mt-24 relative z-10 flex flex-col gap-[10px] items-center text-center shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
                <h3 className="font-semibold text-[#06080B] text-[18px] md:text-[20px]">
                  {s("governanceTitle", "compliance.cards.governance.title")}
                </h3>
                <p className="text-[#06080B] text-[16px] leading-6">
                  {s("governanceDescription", "compliance.cards.governance.description")}
                </p>
              </div>
            </div>

            {/* Technology Card */}
            <div className="flex flex-col items-center relative w-full md:w-auto pb-6">
              <div className="h-[286px] w-full md:w-[368px] relative z-0 rounded-[16px] overflow-hidden shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
                <Image
                  src={strapiData?.technologyImage?.url ? getStrapiMediaUrl(strapiData.technologyImage.url) : "/NELC_agreement/image 19.svg"}
                  alt={s("technologyTitle", "compliance.cards.technology.title")}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="bg-[#EEF3F7] rounded-[16px] p-4 min-h-[140px] md:h-[140px] w-[285px] md:w-[317px] -mt-24 relative z-10 flex flex-col gap-[10px] items-center text-center shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
                <h3 className="font-semibold text-[#06080B] text-[18px] md:text-[20px]">
                  {s("technologyTitle", "compliance.cards.technology.title")}
                </h3>
                <p className="text-[#06080B] text-[16px] leading-6">
                  {s("technologyDescription", "compliance.cards.technology.description")}
                </p>
              </div>
            </div>

            {/* Instruction Card */}
            <div className="flex flex-col items-center relative w-full md:w-auto pb-6">
              <div className="h-[286px] w-full md:w-[368px] relative z-0 rounded-[16px] overflow-hidden shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
                <Image
                  src={strapiData?.instructionImage?.url ? getStrapiMediaUrl(strapiData.instructionImage.url) : "/NELC_agreement/image 20.svg"}
                  alt={s("instructionTitle", "compliance.cards.instruction.title")}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="bg-[#EEF3F7] rounded-[16px] p-4 min-h-[140px] md:h-[140px] w-[285px] md:w-[317px] -mt-24 relative z-10 flex flex-col gap-[10px] items-center text-center shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]">
                <h3 className="font-semibold text-[#06080B] text-[18px] md:text-[20px]">
                  {s("instructionTitle", "compliance.cards.instruction.title")}
                </h3>
                <p className="text-[#06080B] text-[16px] leading-6">
                  {s("instructionDescription", "compliance.cards.instruction.description")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default NELCContent;
