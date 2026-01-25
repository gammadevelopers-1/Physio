"use client";

import Image from "next/image";
import Link from "next/link";
import { Video, ShoppingCart, Calendar, Clock, ArrowRight } from "lucide-react";
import { Course } from "@/data/courses";

interface CourseCardProps {
  course: Course;
}

const CourseCard = ({ course }: CourseCardProps) => {
  return (
    <Link href={`/courses/${course.slug}`} className="block">
      <div className="flex flex-col gap-4 items-start min-w-0">
        {/* Card Header */}
        <div className="relative bg-[#eef3f7] rounded-2xl p-4 h-[183px] flex flex-col justify-between overflow-hidden w-full">
          {/* Title */}
          <p className="text-[#06080b] font-semibold w-[161px] z-10 leading-normal text-lg">
            {course.title}
          </p>

          {/* Course vector decoration */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[146px] h-[217px]">
            <Image
              src={course.vectorImage}
              alt=""
              fill
              className="object-contain"
            />
          </div>

          {/* Bottom row */}
          <div className="flex items-center justify-between w-full z-10">
            {/* Type badge */}
            <div className="flex items-center gap-2 bg-[#0b0f17] rounded-full px-3 py-1">
              <Video className="w-4 h-4 text-white" strokeWidth={1.5} />
              <span className="text-white text-xs leading-4">{course.type}</span>
            </div>

            {/* Add to cart button */}
            <button
              className="flex items-center justify-center p-2 bg-[#f9fbfd] rounded-xl hover:bg-white transition-colors"
              onClick={(e) => e.preventDefault()}
            >
              <ShoppingCart className="w-4 h-4 text-[#0b0f17]" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Meta tags */}
        <div className="flex items-center gap-4">
          {/* Date tag */}
          <div className="flex items-center gap-1 bg-[#f4f4f5] rounded-lg px-2 py-1">
            <Calendar className="w-4 h-4 text-[#4a4c4f]" strokeWidth={1.5} />
            <span className="text-[#4a4c4f] text-sm leading-5">{course.date}</span>
          </div>

          {/* Hours tag */}
          <div className="flex items-center gap-1 bg-[#f4f4f5] rounded-lg px-2 py-1">
            <Clock className="w-4 h-4 text-[#4a4c4f]" strokeWidth={1.5} />
            <span className="text-[#4a4c4f] text-sm leading-5">{course.hours}</span>
          </div>
        </div>

        {/* Description */}
        <p className="text-[#06080b] text-base leading-6 w-full line-clamp-2">
          {course.description}
        </p>

        {/* Price and CTA */}
        <div className="flex items-center justify-between w-full">
          {/* Price */}
          <div className="flex items-center gap-1">
            <Image src="/icons/rayal-icon.svg" alt="SAR" width={17} height={18} />
            <span className="text-[#06080b] font-semibold text-lg leading-normal">
              {course.price}
            </span>
          </div>

          {/* View Details button */}
          <span className="flex items-center gap-2 text-[#06080b] text-sm font-medium hover:text-[#B8860B] transition-colors">
            View Details
            <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
          </span>
        </div>
      </div>
    </Link>
  );
};

export default CourseCard;
