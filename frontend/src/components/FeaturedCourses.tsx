"use client";

import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useEffect, useState } from "react";
import CourseCard from "@/components/courses/CourseCard";
import MobileCourseCard from "@/components/courses/MobileCourseCard";
import type { PublicCourse } from "@/types/instructor-dashboard";
import type { HomePage } from "@/lib/strapi/types";

interface FeaturedCoursesProps {
  sectionData?: HomePage | null;
}

const FeaturedCourses = ({ sectionData }: FeaturedCoursesProps) => {
  const t = useTranslations("featuredCourses");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [courses, setCourses] = useState<PublicCourse[]>([]);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await fetch("/api/public-courses?limit=4&sort=newest");
        if (res.ok) {
          const data = await res.json();
          if (data.data) {
            setCourses(data.data.slice(0, 4));
          }
        }
      } catch {
        // Silently fail — section will just not show
      }
    };
    fetchCourses();
  }, []);

  if (courses.length === 0) return null;

  return (
    <section className="bg-white px-4 xl:px-[64px] py-16 xl:py-[96px] overflow-hidden">
      <div className="flex flex-col gap-5 xl:gap-[40px] items-center justify-center w-full max-w-[1440px] mx-auto">
        {/* Section Title - Desktop (1280px+) */}
        <div className="hidden xl:flex items-end justify-between w-full">
          <div className="flex-1 flex flex-col items-center justify-center max-w-[768px] mx-auto">
            <div className="flex flex-col gap-[16px] items-center text-center text-black w-full">
              <h2
                className="font-semibold leading-none tracking-[-0.24px] w-full"
                style={{
                  fontSize: "48px",
                }}
              >
                {sectionData?.featuredCoursesTitle || t("title")}
              </h2>
              <p className="leading-[28px] w-full text-[20px]">
                {sectionData?.featuredCoursesDescription || t("description")}
              </p>
            </div>
          </div>
        </div>

        {/* Section Title - Mobile/Tablet */}
        <div className="flex xl:hidden flex-col gap-4 items-center text-center text-black w-full">
          <h2
            className="font-semibold leading-none tracking-[-0.15px] w-full"
            style={{
              fontSize: "var(--typeface-font-styles-heading-h1)",
            }}
          >
            {sectionData?.featuredCoursesTitle || t("title")}
          </h2>
          <p
            className="leading-7 w-full"
            style={{
              fontSize: "var(--typeface-font-styles-heading-subheading)",
            }}
          >
            {sectionData?.featuredCoursesDescription || t("description")}
          </p>
        </div>

        {/* Desktop Courses Grid - 4 columns (1280px+) */}
        <div className="hidden xl:flex bg-white flex-col gap-[64px] items-start w-full">
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

        {/* View All Button */}
        <Link
          href={`/${locale}/courses`}
          className="h-[40px] px-[20px] py-[8px] rounded-[12px] text-[14px] font-medium text-white min-w-[80px] btn-gold inline-flex items-center justify-center"
        >
          {sectionData?.featuredCoursesViewAllLabel || t("viewAllButton")}
        </Link>
      </div>
    </section>
  );
};

export default FeaturedCourses;
