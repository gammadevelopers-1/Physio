"use client";

import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BecomeTrainer from "@/components/BecomeTrainer";
import { useTranslations, useLocale } from "next-intl";

// Partner logos organized by rows - matching Figma design exactly
const partnerRows = [
  // Row 1: National eLearning Center, Ministry of Health, SCFHS
  [
    {
      name: "National eLearning Center",
      src: "/Academic_partners_icons/national-elearning-center.svg",
      width: 144,
      height: 54,
    },
    {
      name: "Ministry of Health",
      src: "/Academic_partners_icons/ministry-of-health.svg",
      width: 82,
      height: 75,
    },
    {
      name: "Saudi Commission for Health Specialties",
      src: "/Academic_partners_icons/scfhs.svg",
      width: 159,
      height: 66,
    },
  ],
  // Row 2: Alfaisal University, Saudi Healthcare Partner, King Saud University
  [
    {
      name: "Alfaisal University",
      src: "/Academic_partners_icons/alfaisal-university.svg",
      width: 144,
      height: 60,
    },
    {
      name: "Saudi Healthcare Partner",
      src: "/Academic_partners_icons/saudi-healthcare-partner.svg",
      width: 77,
      height: 79,
    },
    {
      name: "King Saud University",
      src: "/Academic_partners_icons/king-saud-university.svg",
      width: 113,
      height: 53,
    },
  ],
  // Row 3: King Faisal Hospital, King Faisal Medical City, American Heart Association (matching Figma order)
  [
    {
      name: "American Heart Association",
      src: "/Academic_partners_icons/american-heart-association.svg",
      width: 148,
      height: 88,
    },
    {
      name: "King Faisal Specialist Hospital",
      src: "/Academic_partners_icons/king-faisal-hospital.svg",
      width: 196,
      height: 64,
    },
    {
      name: "King Faisal Medical City",
      src: "/Academic_partners_icons/king-faisal-medical-city.svg",
      width: 80,
      height: 80,
    },
  ],
];

// Mobile partners in correct vertical order (matching Figma)
const mobilePartners = [
  {
    name: "National eLearning Center",
    src: "/Academic_partners_icons/national-elearning-center.svg",
    width: 144,
    height: 54,
  },
  {
    name: "Ministry of Health",
    src: "/Academic_partners_icons/ministry-of-health.svg",
    width: 82,
    height: 75,
  },
  {
    name: "Saudi Commission for Health Specialties",
    src: "/Academic_partners_icons/scfhs.svg",
    width: 159,
    height: 66,
  },
  {
    name: "Alfaisal University",
    src: "/Academic_partners_icons/alfaisal-university.svg",
    width: 144,
    height: 60,
  },
  {
    name: "Saudi Healthcare Partner",
    src: "/Academic_partners_icons/saudi-healthcare-partner.svg",
    width: 77,
    height: 79,
  },
  {
    name: "King Saud University",
    src: "/Academic_partners_icons/king-saud-university.svg",
    width: 113,
    height: 53,
  },
  {
    name: "American Heart Association",
    src: "/Academic_partners_icons/american-heart-association.svg",
    width: 148,
    height: 88,
  },
  {
    name: "King Faisal Specialist Hospital",
    src: "/Academic_partners_icons/king-faisal-hospital.svg",
    width: 196,
    height: 64,
  },
  {
    name: "King Faisal Medical City",
    src: "/Academic_partners_icons/king-faisal-medical-city.svg",
    width: 80,
    height: 80,
  },
];

const AcademicPartnersPage = () => {
  const t = useTranslations("partnersPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  return (
    <main className="min-h-screen bg-[var(--surface-default)] pb-20 lg:pb-0">
      <Navbar />

      {/* Partners Section */}
      <section className="bg-white px-4 md:px-16 py-16 md:py-24" dir={isRTL ? "rtl" : "ltr"}>
        <div className="max-w-[1312px] mx-auto flex flex-col items-center">
          {/* Header - Title only, no subtitle */}
          <h1
            className="font-semibold tracking-[-0.24px] text-[#06080B] text-center mb-12 md:mb-16 text-[32px] md:text-[48px] leading-none"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {t("title")}
          </h1>

          {/* Desktop Partner Logos Grid - 3 rows x 3 columns */}
          <div className="hidden md:flex flex-col gap-16 items-center w-full max-w-[880px]">
            {partnerRows.map((row, rowIndex) => (
              <div
                key={rowIndex}
                className="flex items-center justify-between w-full"
              >
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
                      style={{
                        width: partner.width,
                        height: partner.height,
                        objectFit: "contain",
                      }}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Mobile Partner Logos - Single column layout */}
          <div className="md:hidden flex flex-col gap-8 w-full items-center">
            {mobilePartners.map((partner, index) => (
              <div
                key={index}
                className="flex items-center justify-center w-full py-4"
              >
                <Image
                  src={partner.src}
                  alt={partner.name}
                  width={partner.width}
                  height={partner.height}
                  style={{
                    width: partner.width,
                    height: partner.height,
                    objectFit: "contain",
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Become a Trainer Section */}
      <BecomeTrainer />

      <Footer />
    </main>
  );
};

export default AcademicPartnersPage;
