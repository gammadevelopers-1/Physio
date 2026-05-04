"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";
import CourseCard from "@/components/courses/CourseCard";
import MobileCourseCard from "@/components/courses/MobileCourseCard";
import type { PublicCourse } from "@/types/instructor-dashboard";
import type { HomePage } from "@/lib/strapi/types";

interface FeaturedCoursesProps {
  sectionData?: HomePage | null;
}

const FeaturedCourses = ({ sectionData }: FeaturedCoursesProps) => {
  const locale = useLocale();
  const isRTL = locale === "ar";

  const title = sectionData?.featuredCoursesTitle || "";
  const description = sectionData?.featuredCoursesDescription || "";
  const viewAllLabel = sectionData?.featuredCoursesViewAllLabel || "";

  const [courses, setCourses] = useState<PublicCourse[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await fetch("/api/featured-home?limit=4", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setCourses(data.slice(0, 4));
          }
        }
      } catch {
        // Silently fail — section will just not show
      } finally {
        setLoaded(true);
      }
    };
    fetchCourses();
  }, []);

  // Hide the entire section when there are no featured courses
  // (also hides during the initial fetch so we don't flash chrome).
  if (!loaded || courses.length === 0) {
    return null;
  }

  return (
    <section className="bg-[var(--color-surface-card)] px-4 xl:px-[64px] py-12 lg:py-20 overflow-hidden">
      <div className="flex flex-col gap-5 xl:gap-[40px] items-center justify-center w-full max-w-[1440px] mx-auto">
        {/* Section Title - Desktop (1280px+) */}
        {(title || description) && (
          <div className="hidden xl:flex items-end justify-between w-full">
            <div className="flex-1 flex flex-col items-center justify-center max-w-[768px] mx-auto">
              <div className="flex flex-col gap-[16px] items-center text-center text-[var(--color-text-primary)] w-full">
                {title && (
                  <h2
                    className="font-semibold leading-none tracking-[-0.24px] w-full"
                    style={{ fontSize: "48px" }}
                  >
                    {title}
                  </h2>
                )}
                {description && (
                  <p className="leading-[28px] w-full text-[20px]">
                    {description}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Section Title - Mobile/Tablet */}
        {(title || description) && (
          <div className="flex xl:hidden flex-col gap-4 items-center text-center text-[var(--color-text-primary)] w-full">
            {title && (
              <h2
                className="font-semibold leading-none tracking-[-0.15px] w-full"
                style={{ fontSize: "var(--typeface-font-styles-heading-h1)" }}
              >
                {title}
              </h2>
            )}
            {description && (
              <p
                className="leading-7 w-full"
                style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
              >
                {description}
              </p>
            )}
          </div>
        )}

        {/* Desktop Courses Grid - 4 columns (1280px+) */}
        <div className="hidden xl:flex flex-col gap-[64px] items-start w-full">
          <div
            className="grid grid-cols-4 gap-[32px] w-full"
            dir={isRTL ? "rtl" : "ltr"}
          >
            {courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                isRTL={isRTL}
              />
            ))}
          </div>
        </div>

        {/* Mobile/Tablet Course Cards - Stacked vertically */}
        <div className="flex xl:hidden flex-col gap-8 items-start w-full">
          {courses.map((course) => (
            <MobileCourseCard
              key={course.id}
              course={course}
              isRTL={isRTL}
            />
          ))}
        </div>

        {/* View All Button — only when label is set in Strapi */}
        {viewAllLabel && (
          <Link
            href={`/${locale}/courses`}
            className="h-[40px] px-[20px] py-[8px] rounded-[12px] text-[14px] font-medium text-white min-w-[80px] btn-gold inline-flex items-center justify-center"
          >
            {viewAllLabel}
          </Link>
        )}
      </div>
    </section>
  );
};

export default FeaturedCourses;
