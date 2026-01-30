"use client";

import Image from "next/image";
import Link from "next/link";
import { Video, ShoppingCart, Calendar, Clock, ArrowRight, ArrowLeft } from "lucide-react";
import { Course } from "@/data/courses";
import { useTranslations } from "next-intl";

interface MobileCourseCardProps {
  course: Course;
  isRTL?: boolean;
}

const MobileCourseCard = ({ course, isRTL = false }: MobileCourseCardProps) => {
  const t = useTranslations("coursesPage");

  // Get translated course data if available
  const getCourseTitle = () => {
    if (isRTL) {
      try {
        return t(`courses.${course.slug}.title`);
      } catch {
        return course.title;
      }
    }
    return course.title;
  };

  const getCourseDescription = () => {
    if (isRTL) {
      try {
        return t(`courses.${course.slug}.description`);
      } catch {
        return course.description;
      }
    }
    return course.description;
  };

  const getCourseHours = () => {
    if (isRTL) {
      try {
        return t(`courses.${course.slug}.hours`);
      } catch {
        return course.hours;
      }
    }
    return course.hours;
  };

  const getCourseDate = () => {
    if (isRTL) {
      try {
        return t(`courses.${course.slug}.date`);
      } catch {
        return course.date;
      }
    }
    return course.date;
  };

  return (
    <Link href={`/courses/${course.slug}`} className="block w-full">
      <div className={`flex flex-col gap-4 w-full ${isRTL ? "text-right" : "text-left"}`}>
        {/* Card Header */}
        <div className="relative bg-[#eef3f7] rounded-2xl p-4 h-[183px] flex flex-col justify-between overflow-hidden w-full">
          {/* Title - Right for RTL, Left for LTR */}
          <p className={`text-[#06080b] font-semibold w-[161px] z-10 leading-normal text-lg absolute top-4 ${isRTL ? "right-4" : "left-4"}`}>
            {getCourseTitle()}
          </p>

          {/* Course vector decoration - Left for RTL, Right for LTR */}
          <div className={`absolute ${isRTL ? "left-0" : "right-0"} top-1/2 -translate-y-1/2 w-[146px] h-[217px]`}>
            <Image
              src={course.vectorImage}
              alt=""
              fill
              className={`object-contain ${isRTL ? "-scale-x-100" : ""}`}
            />
          </div>

          {/* Bottom row - using absolute positioning for precise control */}
          {isRTL ? (
            <>
              {/* RTL: Cart on bottom-left (over image) */}
              <button
                className="absolute bottom-4 left-4 flex items-center justify-center p-2 bg-[#f9fbfd] rounded-xl z-10"
                onClick={(e) => e.preventDefault()}
              >
                <ShoppingCart className="w-4 h-4 text-[#0b0f17]" strokeWidth={1.5} />
              </button>
              {/* RTL: Badge on bottom-right (in white space area) */}
              <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-[#0b0f17] rounded-full px-3 py-1 flex-row-reverse z-10">
                <Video className="w-4 h-4 text-white" strokeWidth={1.5} />
                <span className="text-white text-xs leading-4">{t("card.liveOnline")}</span>
              </div>
            </>
          ) : (
            <>
              {/* LTR: Badge on bottom-left, Cart on bottom-right */}
              <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-[#0b0f17] rounded-full px-3 py-1 z-10">
                <Video className="w-4 h-4 text-white" strokeWidth={1.5} />
                <span className="text-white text-xs leading-4">{course.type}</span>
              </div>
              <button
                className="absolute bottom-4 right-4 flex items-center justify-center p-2 bg-[#f9fbfd] rounded-xl z-10"
                onClick={(e) => e.preventDefault()}
              >
                <ShoppingCart className="w-4 h-4 text-[#0b0f17]" strokeWidth={1.5} />
              </button>
            </>
          )}
        </div>

        {/* Meta tags - For RTL: stacked vertically, aligned right (items-start in RTL = right). For LTR: horizontal row */}
        {isRTL ? (
          <div className="flex flex-col gap-2 items-start w-full">
            {/* Date tag - on top, icon on right (first in JSX = right in RTL) */}
            <div className="flex items-center gap-1 bg-[#f4f4f5] rounded-lg px-2 py-1">
              <Calendar className="w-4 h-4 text-[#4a4c4f]" strokeWidth={1.5} />
              <span className="text-[#4a4c4f] text-sm leading-5">{getCourseDate()}</span>
            </div>
            {/* Hours tag - below, icon on right (first in JSX = right in RTL) */}
            <div className="flex items-center gap-1 bg-[#f4f4f5] rounded-lg px-2 py-1">
              <Clock className="w-4 h-4 text-[#4a4c4f]" strokeWidth={1.5} />
              <span className="text-[#4a4c4f] text-sm leading-5">{getCourseHours()}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            {/* Date tag */}
            <div className="flex items-center gap-1 bg-[#f4f4f5] rounded-lg px-2 py-1">
              <Calendar className="w-4 h-4 text-[#4a4c4f]" strokeWidth={1.5} />
              <span className="text-[#4a4c4f] text-sm leading-5">{getCourseDate()}</span>
            </div>
            {/* Hours tag */}
            <div className="flex items-center gap-1 bg-[#f4f4f5] rounded-lg px-2 py-1">
              <Clock className="w-4 h-4 text-[#4a4c4f]" strokeWidth={1.5} />
              <span className="text-[#4a4c4f] text-sm leading-5">{getCourseHours()}</span>
            </div>
          </div>
        )}

        {/* Description */}
        <p className="text-[#06080b] text-base leading-6 w-full line-clamp-2">
          {getCourseDescription()}
        </p>

        {/* Price and CTA - For RTL: Price on right (first in JSX), View Details on left (second in JSX) */}
        <div className="flex items-center justify-between w-full">
          {isRTL ? (
            <>
              {/* RTL: Price first (appears on right), View Details second (appears on left) */}
              <div className="flex items-center gap-1">
                <span className="text-[#06080b] font-semibold text-lg leading-normal">
                  {course.price}
                </span>
                <Image src="/icons/rayal-icon.svg" alt="SAR" width={16} height={18} />
              </div>
              <span className="flex items-center gap-2 text-[#06080b] text-sm font-medium">
                {t("card.viewDetails")}
                <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
              </span>
            </>
          ) : (
            <>
              {/* LTR: Price on left, View Details on right */}
              <div className="flex items-center gap-1">
                <Image src="/icons/rayal-icon.svg" alt="SAR" width={16} height={18} />
                <span className="text-[#06080b] font-semibold text-lg leading-normal">
                  {course.price}
                </span>
              </div>
              <span className="flex items-center gap-2 text-[#06080b] text-sm font-medium">
                {t("card.viewDetails")}
                <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
};

export default MobileCourseCard;
