"use client";

import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { getStrapiMediaUrl } from "@/lib/strapi/client";
import type { Partner, PartnersPage } from "@/lib/strapi/types";

// Fallback partner logos (used when Strapi partners are empty)
const fallbackPartnerRows = [
  [
    { name: "National eLearning Center", src: "/Academic_partners_icons/national-elearning-center.svg", width: 144, height: 54 },
    { name: "Ministry of Health", src: "/Academic_partners_icons/ministry-of-health.svg", width: 82, height: 75 },
    { name: "Saudi Commission for Health Specialties", src: "/Academic_partners_icons/scfhs.svg", width: 159, height: 66 },
  ],
  [
    { name: "Alfaisal University", src: "/Academic_partners_icons/alfaisal-university.svg", width: 144, height: 60 },
    { name: "Saudi Healthcare Partner", src: "/Academic_partners_icons/saudi-healthcare-partner.svg", width: 77, height: 79 },
    { name: "King Saud University", src: "/Academic_partners_icons/king-saud-university.svg", width: 113, height: 53 },
  ],
  [
    { name: "American Heart Association", src: "/Academic_partners_icons/american-heart-association.svg", width: 148, height: 88 },
    { name: "King Faisal Specialist Hospital", src: "/Academic_partners_icons/king-faisal-hospital.svg", width: 196, height: 64 },
    { name: "King Faisal Medical City", src: "/Academic_partners_icons/king-faisal-medical-city.svg", width: 80, height: 80 },
  ],
];

const fallbackMobilePartners = fallbackPartnerRows.flat();

interface PartnersContentProps {
  partners: Partner[];
  strapiData?: PartnersPage | null;
}

export default function PartnersContent({ partners, strapiData }: PartnersContentProps) {
  const t = useTranslations("partnersPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  // Only use Strapi partners if at least one has a logo uploaded
  const partnersWithLogos = partners.filter((p) => p.logo?.url);
  const useStrapiPartners = partnersWithLogos.length > 0;

  // Build rows of 3 from Strapi partners that have logos
  const strapiRows: Partner[][] = [];
  if (useStrapiPartners) {
    for (let i = 0; i < partnersWithLogos.length; i += 3) {
      strapiRows.push(partnersWithLogos.slice(i, i + 3));
    }
  }

  return (
    <section className="bg-white px-4 md:px-16 py-16 md:py-24" dir={isRTL ? "rtl" : "ltr"}>
      <div className="max-w-[1312px] mx-auto flex flex-col items-center">
        <h1
          className="font-semibold tracking-[-0.24px] text-[#06080B] text-center mb-12 md:mb-16 text-[32px] md:text-[48px] leading-none"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          {strapiData?.title || t("title")}
        </h1>

        {useStrapiPartners ? (
          <>
            {/* Desktop - rows of 3 from Strapi */}
            <div className="hidden md:flex flex-col gap-16 items-center w-full max-w-[880px]">
              {strapiRows.map((row, rowIndex) => (
                <div key={rowIndex} className="flex items-center justify-between w-full">
                  {row.map((partner) => {
                    const logoUrl = getStrapiMediaUrl(partner.logo.url);
                    return (
                      <div
                        key={partner.id}
                        className="flex items-center justify-center"
                        style={{ width: "200px", height: "100px" }}
                      >
                        <Image
                          src={logoUrl}
                          alt={partner.name}
                          width={150}
                          height={80}
                          style={{ maxWidth: "150px", maxHeight: "80px", objectFit: "contain" }}
                          unoptimized={logoUrl.startsWith("http")}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Mobile - single column from Strapi */}
            <div className="md:hidden flex flex-col gap-8 w-full items-center">
              {partnersWithLogos.map((partner) => {
                const logoUrl = getStrapiMediaUrl(partner.logo.url);
                return (
                  <div key={partner.id} className="flex items-center justify-center w-full py-4">
                    <Image
                      src={logoUrl}
                      alt={partner.name}
                      width={150}
                      height={80}
                      style={{ maxWidth: "150px", maxHeight: "80px", objectFit: "contain" }}
                      unoptimized={logoUrl.startsWith("http")}
                    />
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {/* Desktop fallback */}
            <div className="hidden md:flex flex-col gap-16 items-center w-full max-w-[880px]">
              {fallbackPartnerRows.map((row, rowIndex) => (
                <div key={rowIndex} className="flex items-center justify-between w-full">
                  {row.map((partner, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-center"
                      style={{ width: "200px", height: "100px" }}
                    >
                      <Image
                        src={partner.src}
                        alt={partner.name}
                        width={partner.width}
                        height={partner.height}
                        style={{ width: partner.width, height: partner.height, objectFit: "contain" }}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Mobile fallback */}
            <div className="md:hidden flex flex-col gap-8 w-full items-center">
              {fallbackMobilePartners.map((partner, index) => (
                <div key={index} className="flex items-center justify-center w-full py-4">
                  <Image
                    src={partner.src}
                    alt={partner.name}
                    width={partner.width}
                    height={partner.height}
                    style={{ width: partner.width, height: partner.height, objectFit: "contain" }}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
