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
  Star,
  Users,
} from "lucide-react";
import { PublicCourse } from "@/types/instructor-dashboard";
import { useTranslations, useLocale } from "next-intl";

interface MobileCourseCardProps {
  course: PublicCourse;
  isRTL?: boolean;
}

const DELIVERY_ICON: Record<string, typeof Video> = {
  zoom: Video,
  onsite: MapPin,
  blended: Monitor,
  "self-paced": Monitor,
};

const MobileCourseCard = ({
  course,
  isRTL = false,
}: MobileCourseCardProps) => {
  const t = useTranslations("coursesPage");
  const locale = useLocale();

  const title = isRTL && course.titleAr ? course.titleAr : course.title;
  const description =
    isRTL && course.descriptionAr
      ? course.descriptionAr
      : course.description || "";

  const deliveryLabelMap: Record<string, string> = {
    zoom: t("filters.zoom"),
    onsite: t("filters.onsite"),
    blended: t("filters.blended"),
    "self-paced": t("filters.selfPaced"),
  };
  const deliveryLabel =
    deliveryLabelMap[course.deliveryType] || course.deliveryType;
  const DeliveryIcon = DELIVERY_ICON[course.deliveryType] || Video;

  const formattedDate = course.startDate
    ? new Date(course.startDate).toLocaleDateString(
        locale === "ar" ? "ar-SA" : "en-US",
        { day: "numeric", month: "short", year: "numeric" },
      )
    : t("card.tbd");

  const hoursLabel =
    course.totalHours > 0
      ? `${course.totalHours} ${t("card.hoursUnit")}`
      : t("card.noHours");

  const price = course.price ?? 0;
  const isFree = price === 0;

  return (
    <Link
      href={`/courses/${course.id}`}
      className={`flex flex-col gap-4 w-full group ${isRTL ? "items-end" : "items-start"}`}
    >
      {/* Card Header */}
      <div className="relative bg-[var(--color-surface-page)] rounded-2xl p-4 h-[182.84px] flex flex-col justify-between overflow-hidden w-full">
        {/* CME Badge */}
        {course.isCmeAccredited && (
          <div
            className={`absolute top-3 ${isRTL ? "left-3" : "right-3"} z-10 flex items-center gap-1 bg-[#F59E0B] text-white text-[10px] font-semibold px-2 py-0.5 rounded-full`}
          >
            <Award className="w-3 h-3" />
            {course.cmeHours} CME
          </div>
        )}

        {/* Title */}
        <p
          className={`text-[#06080b] font-semibold w-[161px] z-10 leading-normal ${isRTL ? "text-right ml-auto" : "text-left"}`}
          style={{
            fontSize: "var(--typeface-font-styles-heading-h5, 18px)",
          }}
        >
          {title}
        </p>

        {/* Course thumbnail */}
        {course.thumbnail ? (
          <div
            className={`absolute top-1/2 -translate-y-[calc(50%-0.92px)] w-[146px] h-[217px] ${isRTL ? "left-0 -scale-x-100" : "right-0"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={course.thumbnail}
              alt=""
              className="w-full h-full object-cover rounded-[8px]"
            />
          </div>
        ) : null}

        {/* Bottom row */}
        <div className="flex items-center justify-between w-full z-10">
          <div className="flex items-center gap-2 bg-[#0b0f17] rounded-full px-3 py-1">
            <DeliveryIcon
              className="w-4 h-4 text-white"
              strokeWidth={1.5}
            />
            <span className="text-white text-xs leading-4">
              {deliveryLabel}
            </span>
          </div>

          {/* Price badge */}
          <div
            className={`flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
              isFree
                ? "bg-green-100 text-green-700"
                : "bg-[#f9fbfd] text-[#0b0f17]"
            }`}
          >
            {isFree ? t("card.free") : `${price} SAR`}
          </div>
        </div>
      </div>

      {/* Meta tags */}
      <div
        className={`flex flex-wrap gap-2 w-full ${isRTL ? "justify-end" : "justify-start"}`}
      >
        <div className="flex items-center gap-1 bg-[#f4f4f5] rounded-lg px-2 py-1">
          <Calendar
            className="w-4 h-4 text-[#4a4c4f]"
            strokeWidth={1.5}
          />
          <span className="text-[#4a4c4f] text-sm leading-5">
            {formattedDate}
          </span>
        </div>
        <div className="flex items-center gap-1 bg-[#f4f4f5] rounded-lg px-2 py-1">
          <Clock className="w-4 h-4 text-[#4a4c4f]" strokeWidth={1.5} />
          <span className="text-[#4a4c4f] text-sm leading-5">
            {hoursLabel}
          </span>
        </div>
        {(course.sessionCount ?? 0) > 0 && (
          <div className="flex items-center gap-1 bg-[#f4f4f5] rounded-lg px-2 py-1">
            <Video
              className="w-4 h-4 text-[#4a4c4f]"
              strokeWidth={1.5}
            />
            <span className="text-[#4a4c4f] text-sm leading-5">
              {course.sessionCount} {t("card.sessions")}
            </span>
          </div>
        )}
      </div>

      {/* Description */}
      <p
        className={`text-[#06080b] text-base leading-6 w-full line-clamp-2 ${isRTL ? "text-right" : "text-left"}`}
      >
        {description}
      </p>

      {/* Seats remaining urgency */}
      {course.isFull ? (
        <p className="text-xs font-semibold text-red-600">
          {t("card.courseFull")}
        </p>
      ) : (course.remainingSeats ?? 0) > 0 &&
        (course.remainingSeats ?? 0) <= 5 ? (
        <p className="text-xs font-semibold text-red-600">
          {t("card.seatsLeft", { count: course.remainingSeats })}
        </p>
      ) : null}

      {/* Instructor, Rating & CTA */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <span className="text-[#4a4c4f] text-sm truncate max-w-[100px]">
            {course.instructorName}
          </span>
          {course.avgRating > 0 && (
            <div className="flex items-center gap-0.5">
              <Star className="w-3.5 h-3.5 text-[#F59E0B] fill-[#F59E0B]" />
              <span className="text-xs text-[#4a4c4f]">
                {course.avgRating.toFixed(1)}
              </span>
            </div>
          )}
          {(course.enrolledCount ?? 0) > 0 && (
            <div className="flex items-center gap-0.5">
              <Users className="w-3 h-3 text-[#9CA3AF]" />
              <span className="text-[10px] text-[#9CA3AF]">
                {course.enrolledCount}
              </span>
            </div>
          )}
        </div>

        <span className="flex items-center gap-2 h-10 px-5 py-2 bg-[#0b0f17] text-white rounded-xl text-sm font-medium group-hover:bg-[#1a1f2e] transition-colors">
          <span>{t("card.viewDetails")}</span>
          {isRTL ? (
            <ArrowLeft
              className="w-4 h-4 text-white"
              strokeWidth={1.5}
            />
          ) : (
            <ArrowRight
              className="w-4 h-4 text-white"
              strokeWidth={1.5}
            />
          )}
        </span>
      </div>
    </Link>
  );
};

export default MobileCourseCard;
