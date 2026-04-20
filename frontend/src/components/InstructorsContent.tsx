"use client";

import Image from "next/image";
import { useLocale } from "next-intl";
import { getStrapiMediaUrl } from "@/lib/strapi/client";
import type { Instructor, InstructorsPage } from "@/lib/strapi/types";

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
  const locale = useLocale();
  const isRTL = locale === "ar";

  // Split instructors by section — only include those with uploaded avatars
  const experts = instructors.filter((i) => i.section === "expert" && i.avatar?.url);
  const minds = instructors.filter((i) => i.section === "minds" && i.avatar?.url);

  const expertsTitle = strapiData?.meetExpertsTitle || "";
  const mindsTitle = strapiData?.mindsBehindTitle || "";

  return (
    <>
      {/* Meet the Experts Section - only rendered when Strapi has experts */}
      {experts.length > 0 && (
        <section className="bg-white px-4 md:px-16 py-16 md:py-24" dir={isRTL ? "rtl" : "ltr"}>
          <div className="max-w-[1312px] mx-auto flex flex-col gap-12 items-center">
            {expertsTitle && (
              <h1
                className="font-semibold text-[#06080B] text-center tracking-[-0.24px] leading-none text-[32px] md:text-[48px]"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {expertsTitle}
              </h1>
            )}

            {/* Desktop */}
            <div className="hidden md:flex gap-8 items-start justify-center w-full">
              {experts.map((instructor) => (
                <InstructorCard
                  key={instructor.id}
                  name={instructor.name}
                  title={instructor.title || ""}
                  image={getStrapiMediaUrl(instructor.avatar!.url)}
                />
              ))}
            </div>
            {/* Mobile */}
            <div className="flex md:hidden flex-col gap-8 items-center w-full">
              {experts.map((instructor) => (
                <MobileInstructorCard
                  key={instructor.id}
                  name={instructor.name}
                  title={instructor.title || ""}
                  image={getStrapiMediaUrl(instructor.avatar!.url)}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Minds Behind Physioguidance Section - only rendered when Strapi has minds */}
      {minds.length > 0 && (
        <section className="bg-white px-4 md:px-16 py-16 md:py-24" dir={isRTL ? "rtl" : "ltr"}>
          <div className="max-w-[1312px] mx-auto flex flex-col gap-12 items-center">
            {mindsTitle && (
              <h1
                className="font-semibold text-[#06080B] text-center tracking-[-0.24px] leading-none text-[32px] md:text-[48px]"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {mindsTitle}
              </h1>
            )}

            {/* Desktop */}
            <div className="hidden md:flex gap-8 items-start justify-center w-full">
              {minds.map((instructor) => (
                <InstructorCard
                  key={instructor.id}
                  name={instructor.name}
                  title={instructor.title || ""}
                  image={getStrapiMediaUrl(instructor.avatar!.url)}
                />
              ))}
            </div>
            {/* Mobile */}
            <div className="flex md:hidden flex-col gap-8 items-center w-full">
              {minds.map((instructor) => (
                <MobileInstructorCard
                  key={instructor.id}
                  name={instructor.name}
                  title={instructor.title || ""}
                  image={getStrapiMediaUrl(instructor.avatar!.url)}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
