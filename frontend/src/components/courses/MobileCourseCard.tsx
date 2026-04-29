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

  const cmeLabel =
    course.isCmeAccredited && course.cmeHours
      ? `${course.cmeHours} CME ${t("card.hoursUnit")}`
      : course.totalHours > 0
        ? `${course.totalHours} ${t("card.hoursUnit")}`
        : null;

  const price = course.price ?? 0;
  const isFree = price === 0;

  const isEnded = course.availabilityStatus === "completed";
  const isFull = course.availabilityStatus === "full";
  const isClosed = course.availabilityStatus === "deadline_passed";
  const hasOverlay = !!course.availabilityStatus && course.availabilityStatus !== "open";

  const overlayLabel = isEnded
    ? t("card.courseEnded")
    : isFull
      ? t("card.capacityFull")
      : isClosed
        ? t("card.enrollmentClosed")
        : null;

  const overlayClasses = isEnded
    ? "bg-[var(--color-text-secondary)] text-white"
    : isFull
      ? "bg-red-600 text-white"
      : "bg-[#F59E0B] text-white";

  const seatsUrgency = !isFull && (course.remainingSeats ?? 0) > 0 && (course.remainingSeats ?? 0) <= 5;

  const initial = (title || "?").trim().charAt(0).toUpperCase();

  return (
    <Link
      href={`/courses/${course.id}`}
      className="group flex flex-col w-full bg-[var(--color-surface-card)] border border-[var(--color-border-subtle)] rounded-2xl overflow-hidden shadow-sm active:scale-[0.99] transition-transform"
    >
      {/* Hero image — 16:9 */}
      <div className="relative w-full aspect-[16/9] bg-[var(--color-surface-page)] overflow-hidden">
        {course.thumbnail ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={course.thumbnail}
            alt=""
            className={`w-full h-full object-cover ${isEnded ? "grayscale opacity-70" : ""}`}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))`,
            }}
          >
            <span className="text-white text-6xl font-bold opacity-90 select-none">
              {initial}
            </span>
          </div>
        )}

        {/* Status overlay (top-end) */}
        {hasOverlay && overlayLabel && (
          <div
            className={`absolute top-3 ${isRTL ? "left-3" : "right-3"} text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm ${overlayClasses}`}
          >
            {overlayLabel}
          </div>
        )}

        {/* Delivery pill (bottom-start) */}
        <div className={`absolute bottom-3 ${isRTL ? "right-3" : "left-3"}`}>
          <div className="flex items-center gap-1.5 bg-[var(--color-primary)] rounded-full px-2.5 py-1 shadow-sm">
            <DeliveryIcon className="w-3.5 h-3.5 text-white" strokeWidth={2} />
            <span className="text-white text-[11px] font-semibold">{deliveryLabel}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col p-4 gap-2">
        {/* Meta row */}
        <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--color-text-secondary)] ${isRTL ? "justify-end" : ""}`}>
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" strokeWidth={1.5} />
            {formattedDate}
          </span>
          {cmeLabel && (
            <>
              <span className="text-[var(--color-border)]">·</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                {cmeLabel}
              </span>
            </>
          )}
        </div>

        {/* Title */}
        <h3
          className={`text-[var(--color-text-primary)] font-semibold text-[17px] leading-[23px] line-clamp-2 ${isRTL ? "text-right" : "text-left"}`}
        >
          {title}
        </h3>

        {/* Description */}
        {description && (
          <p
            className={`text-[var(--color-text-secondary)] text-[13px] leading-[19px] line-clamp-2 ${isRTL ? "text-right" : "text-left"}`}
          >
            {description}
          </p>
        )}

        {/* Instructor + rating + enrolled */}
        {(course.instructorName || course.avgRating > 0 || (course.enrolledCount ?? 0) > 0) && (
          <div className={`flex items-center gap-3 mt-1 text-[12px] text-[var(--color-text-secondary)] ${isRTL ? "flex-row-reverse" : ""}`}>
            {course.instructorName && (
              <span className="truncate max-w-[140px]">{course.instructorName}</span>
            )}
            {course.avgRating > 0 && (
              <span className="flex items-center gap-0.5">
                <Star className="w-3.5 h-3.5 text-[#F59E0B] fill-[#F59E0B]" />
                <span>{course.avgRating.toFixed(1)}</span>
              </span>
            )}
            {(course.enrolledCount ?? 0) > 0 && (
              <span className="flex items-center gap-0.5">
                <Users className="w-3 h-3" />
                <span>{course.enrolledCount}</span>
              </span>
            )}
          </div>
        )}

        {/* Seats remaining urgency */}
        {seatsUrgency && (
          <p className="text-xs font-semibold text-red-600">
            {t("card.seatsLeft", { count: course.remainingSeats })}
          </p>
        )}

        {/* Divider */}
        <div className="h-px bg-[var(--color-border-subtle)] mt-2" />

        {/* Footer: price + CTA */}
        <div className={`flex items-center justify-between pt-2 ${isRTL ? "flex-row-reverse" : ""}`}>
          <span className="text-[var(--color-primary)] font-bold text-[15px]">
            {isFree ? t("card.free") : `${price} SAR`}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] transition-colors ${isRTL ? "flex-row-reverse" : ""}`}
          >
            {t("card.viewDetails")}
            {isRTL ? (
              <ArrowLeft className="w-4 h-4" strokeWidth={2} />
            ) : (
              <ArrowRight className="w-4 h-4" strokeWidth={2} />
            )}
          </span>
        </div>
      </div>
    </Link>
  );
};

export default MobileCourseCard;
