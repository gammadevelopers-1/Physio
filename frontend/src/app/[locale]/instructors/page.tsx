"use client";

import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useTranslations, useLocale } from "next-intl";

// Instructor keys for mapping
const expertKeys = ["instructor1", "instructor2", "instructor3"] as const;
const mindsKeys = ["instructor1", "instructor2", "instructor3", "instructor4"] as const;

// Image paths for experts
const expertImages = [
  "/images/instructor-1.png",
  "/images/instructor-2.png",
  "/images/instructor-3.png",
];

// Image paths for minds
const mindsImages = [
  "/images/instructor-4.png",
  "/images/instructor-5.png",
  "/images/instructor-6.png",
  "/images/instructor-7.png",
];

const InstructorCard = ({
  name,
  title,
  image,
}: {
  name: string;
  title: string;
  image: string;
}) => {
  return (
    <div className="flex flex-col gap-5 items-center w-full md:w-[230px]">
      {/* Avatar with ring */}
      <div className="p-[5px] bg-[#EEF3F7] rounded-full">
        <div className="p-[2.5px] bg-[#E5EDF4] rounded-full overflow-hidden">
          <div className="relative w-[93px] h-[93px] rounded-full overflow-hidden">
            <Image
              src={image}
              alt={name}
              fill
              className="object-cover"
            />
          </div>
        </div>
      </div>
      {/* Name and Title */}
      <div className="flex flex-col gap-1 items-center text-center w-full">
        <h3
          className="font-semibold text-[#06080B] w-full"
          style={{ fontSize: "var(--typeface-font-styles-heading-h5)" }}
        >
          {name}
        </h3>
        <p
          className="text-[#06080B] leading-6 w-full"
          style={{ fontSize: "var(--typeface-font-styles-paragraph-text)" }}
        >
          {title}
        </p>
      </div>
    </div>
  );
};

const MobileInstructorCard = ({
  name,
  title,
  image,
}: {
  name: string;
  title: string;
  image: string;
}) => {
  return (
    <div className="flex flex-col gap-4 items-center w-full">
      {/* Avatar with ring */}
      <div className="p-[3.31px] bg-[#EEF3F7] rounded-full">
        <div className="p-[1.65px] bg-[#E5EDF4] rounded-full overflow-hidden">
          <div className="relative w-[70px] h-[70px] rounded-full overflow-hidden">
            <Image
              src={image}
              alt={name}
              fill
              className="object-cover"
            />
          </div>
        </div>
      </div>
      {/* Name and Title */}
      <div className="flex flex-col gap-1 items-center text-center w-full px-4">
        <h3 className="font-semibold text-[#06080B] text-[16px]">
          {name}
        </h3>
        <p className="text-[#06080B] text-[14px] leading-5">
          {title}
        </p>
      </div>
    </div>
  );
};

const InstructorsPage = () => {
  const t = useTranslations("instructorsPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  return (
    <main className="min-h-screen bg-white pb-20 lg:pb-0">
      <Navbar />

      {/* Meet the Experts Section */}
      <section className="bg-white px-4 md:px-16 py-16 md:py-24" dir={isRTL ? "rtl" : "ltr"}>
        <div className="max-w-[1312px] mx-auto flex flex-col gap-12 items-center">
          {/* Title */}
          <h1
            className="font-semibold text-[#06080B] text-center tracking-[-0.24px] leading-none text-[32px] md:text-[48px]"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {t("meetExperts.title")}
          </h1>

          {/* Desktop - 3 instructors in a row */}
          <div className="hidden md:flex gap-8 items-start justify-center w-full">
            {expertKeys.map((key, index) => (
              <InstructorCard
                key={key}
                name={t(`meetExperts.instructors.${key}.name`)}
                title={t(`meetExperts.instructors.${key}.title`)}
                image={expertImages[index]}
              />
            ))}
          </div>

          {/* Mobile - Single column */}
          <div className="flex md:hidden flex-col gap-8 items-center w-full">
            {expertKeys.map((key, index) => (
              <MobileInstructorCard
                key={key}
                name={t(`meetExperts.instructors.${key}.name`)}
                title={t(`meetExperts.instructors.${key}.title`)}
                image={expertImages[index]}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Minds Behind Physioguidance Section */}
      <section className="bg-white px-4 md:px-16 py-16 md:py-24" dir={isRTL ? "rtl" : "ltr"}>
        <div className="max-w-[1312px] mx-auto flex flex-col gap-12 items-center">
          {/* Title */}
          <h1
            className="font-semibold text-[#06080B] text-center tracking-[-0.24px] leading-none text-[32px] md:text-[48px]"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {t("mindsBehind.title")}
          </h1>

          {/* Desktop - 4 instructors in a row */}
          <div className="hidden md:flex gap-8 items-start justify-center w-full">
            {mindsKeys.map((key, index) => (
              <InstructorCard
                key={key}
                name={t(`mindsBehind.instructors.${key}.name`)}
                title={t(`mindsBehind.instructors.${key}.title`)}
                image={mindsImages[index]}
              />
            ))}
          </div>

          {/* Mobile - Single column */}
          <div className="flex md:hidden flex-col gap-8 items-center w-full">
            {mindsKeys.map((key, index) => (
              <MobileInstructorCard
                key={key}
                name={t(`mindsBehind.instructors.${key}.name`)}
                title={t(`mindsBehind.instructors.${key}.title`)}
                image={mindsImages[index]}
              />
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default InstructorsPage;
