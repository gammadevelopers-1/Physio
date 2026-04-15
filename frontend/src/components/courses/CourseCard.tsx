"use client";

import Link from "next/link";
import {
  Video,
  MapPin,
  Monitor,
  Calendar,
  Clock,
  ArrowRight,
  ArrowLeft,
  Award,
  ShoppingCart,
} from "lucide-react";
import { PublicCourse } from "@/types/instructor-dashboard";
import { useTranslations, useLocale } from "next-intl";

interface CourseCardProps {
  course: PublicCourse;
  isRTL?: boolean;
}

const DELIVERY_LABEL: Record<string, string> = {
  zoom: "Live Online",
  onsite: "On-site",
  blended: "Hybrid",
};

const DELIVERY_ICON: Record<string, typeof Video> = {
  zoom: Video,
  onsite: MapPin,
  blended: Monitor,
};

const CourseCard = ({ course, isRTL = false }: CourseCardProps) => {
  const t = useTranslations("coursesPage");
  const locale = useLocale();

  const title = isRTL && course.titleAr ? course.titleAr : course.title;
  const description =
    isRTL && course.descriptionAr
      ? course.descriptionAr
      : course.description || "";

  const deliveryLabel =
    DELIVERY_LABEL[course.deliveryType] || course.deliveryType;
  const DeliveryIcon = DELIVERY_ICON[course.deliveryType] || Video;

  const formattedDate = course.startDate
    ? new Date(course.startDate).toLocaleDateString(
        locale === "ar" ? "ar-SA" : "en-US",
        { day: "numeric", month: "short", year: "numeric" },
      )
    : t("card.tbd");

  const cmeLabel =
    course.isCmeAccredited && course.cmeHours
      ? `${course.cmeHours} CME ${t("card.hoursUnit")}`
      : course.totalHours > 0
        ? `${course.totalHours} ${t("card.hoursUnit")}`
        : null;

  const price = course.price ?? 0;

  return (
    <Link
      href={`/courses/${course.id}`}
      className="flex flex-col w-full group"
    >
      {/* Card Header - Blue/gray area with title, thumbnail, badges */}
      <div className="relative bg-[#eef3f7] rounded-2xl p-4 h-[200px] flex flex-col justify-between overflow-hidden">
        {/* Title */}
        <p
          className={`text-[#06080b] font-semibold text-[18px] leading-[24px] max-w-[55%] z-10 line-clamp-3 ${isRTL ? "text-right ml-auto" : "text-left"}`}
        >
          {title}
        </p>

        {/* Thumbnail - positioned to the right */}
        {course.thumbnail && (
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-[140px] h-[180px] ${isRTL ? "left-2" : "right-2"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={course.thumbnail}
              alt=""
              className="w-full h-full object-cover rounded-lg"
            />
          </div>
        )}

        {/* Bottom row - delivery badge + cart icon */}
        <div className="flex items-center justify-between w-full z-10">
          <div className="flex items-center gap-1.5 bg-[#0b0f17] rounded-full px-3 py-1.5">
            <DeliveryIcon className="w-3.5 h-3.5 text-white" strokeWidth={1.5} />
            <span className="text-white text-[12px] font-medium">{deliveryLabel}</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-white/80 flex items-center justify-center">
            <ShoppingCart className="w-4 h-4 text-[#4a4c4f]" strokeWidth={1.5} />
          </div>
        </div>
      </div>

      {/* Meta tags row */}
      <div className={`flex flex-wrap gap-2 mt-3 ${isRTL ? "justify-end" : "justify-start"}`}>
        <div className="flex items-center gap-1 bg-[#f4f4f5] rounded-lg px-2.5 py-1.5">
          <Calendar className="w-3.5 h-3.5 text-[#4a4c4f]" strokeWidth={1.5} />
          <span className="text-[#4a4c4f] text-[13px]">{formattedDate}</span>
        </div>
        {cmeLabel && (
          <div className="flex items-center gap-1 bg-[#f4f4f5] rounded-lg px-2.5 py-1.5">
            <Clock className="w-3.5 h-3.5 text-[#4a4c4f]" strokeWidth={1.5} />
            <span className="text-[#4a4c4f] text-[13px]">{cmeLabel}</span>
          </div>
        )}
      </div>

      {/* Description */}
      <p className={`text-[#06080b] text-[14px] leading-[20px] mt-3 line-clamp-2 ${isRTL ? "text-right" : "text-left"}`}>
        {description}
      </p>

      {/* Footer: Price + View Details */}
      <div className={`flex items-center justify-between mt-3 ${isRTL ? "flex-row-reverse" : ""}`}>
        <div className="flex items-center gap-1">
          <Award className="w-4 h-4 text-[#4a4c4f]" strokeWidth={1.5} />
          <span className="text-[#06080b] text-[14px] font-semibold">
            {price === 0 ? t("card.free") : `${price}`}
          </span>
        </div>
        <span className={`flex items-center gap-1 text-[#06080b] text-[14px] font-medium group-hover:text-[#a37f49] transition-colors ${isRTL ? "flex-row-reverse" : ""}`}>
          {t("card.viewDetails")}
          {isRTL ? <ArrowLeft className="w-4 h-4" strokeWidth={1.5} /> : <ArrowRight className="w-4 h-4" strokeWidth={1.5} />}
        </span>
      </div>
    </Link>
  );
};

export default CourseCard;
