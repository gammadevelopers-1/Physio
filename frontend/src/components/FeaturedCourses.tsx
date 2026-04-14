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

        {courses.length > 0 ? (
          <>
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
          </>
        ) : (
          /* Empty state when no courses available */
          <div className="flex flex-col items-center justify-center py-12 xl:py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--surface-container-low)] flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--on-surface-variant)]">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                <path d="M8 7h6" />
                <path d="M8 11h4" />
              </svg>
            </div>
            <p className="text-[var(--on-surface-variant)] text-lg leading-7">
              {locale === "ar" ? "البرامج التدريبية قادمة قريبًا" : "Training programs coming soon"}
            </p>
            <p className="text-[var(--on-surface-variant)] text-sm opacity-70">
              {locale === "ar" ? "نعمل على إعداد برامج تدريبية متميزة لكم" : "We are preparing outstanding training programs for you"}
            </p>
          </div>
        )}

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
