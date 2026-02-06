"use client";

import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { getStrapiMediaUrl } from "@/lib/strapi/client";
import type { Instructor, InstructorsPage } from "@/lib/strapi/types";

// Fallback image paths
const fallbackExpertImages = [
  "/images/instructor-1.png",
  "/images/instructor-2.png",
  "/images/instructor-3.png",
];
const fallbackMindsImages = [
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
  const isExternal = image.startsWith("http");
  return (
    <div className="flex flex-col gap-5 items-center w-full md:w-[230px]">
      <div className="p-[5px] bg-[#EEF3F7] rounded-full">
        <div className="p-[2.5px] bg-[#E5EDF4] rounded-full overflow-hidden">
          <div className="relative w-[93px] h-[93px] rounded-full overflow-hidden">
            <Image
              src={image}
              alt={name}
              fill
              className="object-cover"
              unoptimized={isExternal}
            />
          </div>
        </div>
      </div>
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
  const isExternal = image.startsWith("http");
  return (
    <div className="flex flex-col gap-4 items-center w-full">
      <div className="p-[3.31px] bg-[#EEF3F7] rounded-full">
        <div className="p-[1.65px] bg-[#E5EDF4] rounded-full overflow-hidden">
          <div className="relative w-[70px] h-[70px] rounded-full overflow-hidden">
            <Image
              src={image}
              alt={name}
              fill
              className="object-cover"
              unoptimized={isExternal}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1 items-center text-center w-full px-4">
        <h3 className="font-semibold text-[#06080B] text-[16px]">{name}</h3>
        <p className="text-[#06080B] text-[14px] leading-5">{title}</p>
      </div>
    </div>
  );
};

interface InstructorsContentProps {
  instructors: Instructor[];
  strapiData?: InstructorsPage | null;
}

export default function InstructorsContent({ instructors, strapiData }: InstructorsContentProps) {
  const t = useTranslations("instructorsPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const useStrapiData = instructors.length > 0;

  // Split instructors by section
  const experts = instructors.filter((i) => i.section === "expert");
  const minds = instructors.filter((i) => i.section === "minds");

  // Fallback keys
  const fallbackExpertKeys = ["instructor1", "instructor2", "instructor3"] as const;
  const fallbackMindsKeys = ["instructor1", "instructor2", "instructor3", "instructor4"] as const;

  const getAvatarUrl = (instructor: Instructor, fallbackIndex: number, fallbackImages: string[]) => {
    if (instructor.avatar?.url) {
      return getStrapiMediaUrl(instructor.avatar.url);
    }
    return fallbackImages[fallbackIndex] || "/images/instructor-1.png";
  };

  return (
    <>
      {/* Meet the Experts Section */}
      <section className="bg-white px-4 md:px-16 py-16 md:py-24" dir={isRTL ? "rtl" : "ltr"}>
        <div className="max-w-[1312px] mx-auto flex flex-col gap-12 items-center">
          <h1
            className="font-semibold text-[#06080B] text-center tracking-[-0.24px] leading-none text-[32px] md:text-[48px]"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {strapiData?.meetExpertsTitle || t("meetExperts.title")}
          </h1>

          {useStrapiData && experts.length > 0 ? (
            <>
              {/* Desktop */}
              <div className="hidden md:flex gap-8 items-start justify-center w-full">
                {experts.map((instructor, index) => (
                  <InstructorCard
                    key={instructor.id}
                    name={instructor.name}
                    title={instructor.title || ""}
                    image={getAvatarUrl(instructor, index, fallbackExpertImages)}
                  />
                ))}
              </div>
              {/* Mobile */}
              <div className="flex md:hidden flex-col gap-8 items-center w-full">
                {experts.map((instructor, index) => (
                  <MobileInstructorCard
                    key={instructor.id}
                    name={instructor.name}
                    title={instructor.title || ""}
                    image={getAvatarUrl(instructor, index, fallbackExpertImages)}
                  />
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Desktop fallback */}
              <div className="hidden md:flex gap-8 items-start justify-center w-full">
                {fallbackExpertKeys.map((key, index) => (
                  <InstructorCard
                    key={key}
                    name={t(`meetExperts.instructors.${key}.name`)}
                    title={t(`meetExperts.instructors.${key}.title`)}
                    image={fallbackExpertImages[index]}
                  />
                ))}
              </div>
              {/* Mobile fallback */}
              <div className="flex md:hidden flex-col gap-8 items-center w-full">
                {fallbackExpertKeys.map((key, index) => (
                  <MobileInstructorCard
                    key={key}
                    name={t(`meetExperts.instructors.${key}.name`)}
                    title={t(`meetExperts.instructors.${key}.title`)}
                    image={fallbackExpertImages[index]}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Minds Behind Physioguidance Section */}
      <section className="bg-white px-4 md:px-16 py-16 md:py-24" dir={isRTL ? "rtl" : "ltr"}>
        <div className="max-w-[1312px] mx-auto flex flex-col gap-12 items-center">
          <h1
            className="font-semibold text-[#06080B] text-center tracking-[-0.24px] leading-none text-[32px] md:text-[48px]"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {strapiData?.mindsBehindTitle || t("mindsBehind.title")}
          </h1>

          {useStrapiData && minds.length > 0 ? (
            <>
              {/* Desktop */}
              <div className="hidden md:flex gap-8 items-start justify-center w-full">
                {minds.map((instructor, index) => (
                  <InstructorCard
                    key={instructor.id}
                    name={instructor.name}
                    title={instructor.title || ""}
                    image={getAvatarUrl(instructor, index, fallbackMindsImages)}
                  />
                ))}
              </div>
              {/* Mobile */}
              <div className="flex md:hidden flex-col gap-8 items-center w-full">
                {minds.map((instructor, index) => (
                  <MobileInstructorCard
                    key={instructor.id}
                    name={instructor.name}
                    title={instructor.title || ""}
                    image={getAvatarUrl(instructor, index, fallbackMindsImages)}
                  />
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Desktop fallback */}
              <div className="hidden md:flex gap-8 items-start justify-center w-full">
                {fallbackMindsKeys.map((key, index) => (
                  <InstructorCard
                    key={key}
                    name={t(`mindsBehind.instructors.${key}.name`)}
                    title={t(`mindsBehind.instructors.${key}.title`)}
                    image={fallbackMindsImages[index]}
                  />
                ))}
              </div>
              {/* Mobile fallback */}
              <div className="flex md:hidden flex-col gap-8 items-center w-full">
                {fallbackMindsKeys.map((key, index) => (
                  <MobileInstructorCard
                    key={key}
                    name={t(`mindsBehind.instructors.${key}.name`)}
                    title={t(`mindsBehind.instructors.${key}.title`)}
                    image={fallbackMindsImages[index]}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
