"use client";

import Image from "next/image";
import { useLocale } from "next-intl";
import type { Instructor, HomePage } from "@/lib/strapi/types";
import { getStrapiMediaUrl } from "@/lib/strapi/client";

interface ExpertInstructorsProps {
  instructors?: Instructor[];
  sectionData?: HomePage | null;
}

const ExpertInstructors = ({ instructors: strapiInstructors = [], sectionData }: ExpertInstructorsProps) => {
  const locale = useLocale();
  const isRTL = locale === "ar";

  const title = sectionData?.instructorsTitle || "";
  const description = sectionData?.instructorsDescription || "";

  // Only use Strapi data if avatars are uploaded
  const instructorsWithAvatars = strapiInstructors.filter((i) => i.avatar?.url);

  // Hide the entire section when there is no content at all
  if (instructorsWithAvatars.length === 0 && !title && !description) {
    return null;
  }

  const instructorsList = instructorsWithAvatars.map((instructor, index) => ({
    id: instructor.id,
    src: getStrapiMediaUrl(instructor.avatar?.url),
    name: instructor.name,
    row: index < 3 ? 1 : 2,
  }));

  const row1 = instructorsList.filter((i) => i.row === 1);
  const row2 = instructorsList.filter((i) => i.row === 2);

  return (
    <section className="bg-[var(--surface-intense)] px-4 md:px-10 py-16 md:py-24 overflow-hidden">
      <div className="flex flex-col gap-5 md:gap-8 items-center justify-center w-full">
        {title && (
          <h2
            className="text-[var(--on-surface-default)] font-semibold text-center leading-none tracking-[-0.15px] md:tracking-[-0.24px] w-full md:w-[600px]"
            style={{ fontSize: "var(--typeface-font-styles-heading-h1)" }}
          >
            {title}
          </h2>
        )}

        {description && (
          <p
            className="text-[var(--on-surface-default)] text-center leading-7 w-full md:w-[590px]"
            style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
          >
            {description}
          </p>
        )}

        {/* Desktop Instructor Avatars */}
        <div className="hidden md:flex flex-col gap-6 items-center justify-center">
          {/* Row 1 - 3 instructors */}
          <div
            className="flex gap-6 items-center justify-center"
            dir={isRTL ? "rtl" : "ltr"}
          >
            {row1.map((instructor) => (
              <div
                key={instructor.id}
                className="p-[5px] bg-[#EEF3F7] rounded-full"
              >
                <div className="p-[2.5px] bg-[#EEF3F7] rounded-full overflow-hidden">
                  <div className="relative w-[93px] h-[93px] rounded-full overflow-hidden">
                    <Image
                      src={instructor.src}
                      alt={instructor.name}
                      fill
                      unoptimized={instructor.src.startsWith('http')}
                      className="object-cover"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Row 2 - 4 instructors */}
          <div
            className="flex gap-6 items-center"
            dir={isRTL ? "rtl" : "ltr"}
          >
            {row2.map((instructor) => (
              <div
                key={instructor.id}
                className="p-[5px] bg-[#EEF3F7] rounded-full"
              >
                <div className="p-[2.5px] bg-[#EEF3F7] rounded-full overflow-hidden">
                  <div className="relative w-[93px] h-[93px] rounded-full overflow-hidden">
                    <Image
                      src={instructor.src}
                      alt={instructor.name}
                      fill
                      unoptimized={instructor.src.startsWith('http')}
                      className="object-cover"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile Instructor Avatars - Smaller sized (~62px avatars) */}
        <div className="flex md:hidden flex-col gap-5 items-center justify-center">
          {/* Row 1 - 3 instructors */}
          <div
            className="flex gap-5 items-center justify-center"
            dir={isRTL ? "rtl" : "ltr"}
          >
            {row1.map((instructor) => (
              <div
                key={instructor.id}
                className="p-[3.31px] bg-[var(--surface-container-default)] rounded-full"
              >
                <div className="p-[1.655px] bg-[var(--surface-container-default)] rounded-full overflow-hidden">
                  <div className="relative w-[62px] h-[62px] rounded-full overflow-hidden">
                    <Image
                      src={instructor.src}
                      alt={instructor.name}
                      fill
                      unoptimized={instructor.src.startsWith('http')}
                      className="object-cover"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Row 2 - 4 instructors with flex wrap */}
          <div
            className="flex flex-wrap gap-4 items-center justify-center"
            dir={isRTL ? "rtl" : "ltr"}
          >
            {row2.map((instructor) => (
              <div
                key={instructor.id}
                className="p-[3.31px] bg-[var(--surface-container-default)] rounded-full"
              >
                <div className="p-[1.655px] bg-[var(--surface-container-high)] rounded-full overflow-hidden">
                  <div className="relative w-[62px] h-[62px] rounded-full overflow-hidden">
                    <Image
                      src={instructor.src}
                      alt={instructor.name}
                      fill
                      unoptimized={instructor.src.startsWith('http')}
                      className="object-cover"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ExpertInstructors;
