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
  Heart,
} from "lucide-react";
import { PublicCourse } from "@/types/instructor-dashboard";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { useFavourites } from "@/contexts/FavouritesContext";
import { useAuth } from "@/contexts";

interface CourseCardProps {
  course: PublicCourse;
  isRTL?: boolean;
}

const DELIVERY_ICON: Record<string, typeof Video> = {
  zoom: Video,
  onsite: MapPin,
  blended: Monitor,
  "self-paced": Monitor,
};

const CourseCard = ({ course, isRTL = false }: CourseCardProps) => {
  const t = useTranslations("coursesPage");
  const tFav = useTranslations("studentDashboard.favourites");
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const locale = useLocale();
  const { isFavourite, toggleFavourite } = useFavourites();

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

  const initial = (title || "?").trim().charAt(0).toUpperCase();

  const favourited = isAuthenticated && isFavourite(course.id);
  const handleFavouriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Guests get redirected to signin with a `redirect` param so they
    // come back to the same listing/page after authenticating, then can
    // favourite from the dashboard like any other student.
    if (!isAuthenticated) {
      const redirect = encodeURIComponent(pathname || `/${locale}/courses`);
      router.push(`/${locale}/signin?redirect=${redirect}`);
      return;
    }
    toggleFavourite({
      id: course.id,
      title,
      thumbnail: course.thumbnail || "",
      progress: 0,
      status: "not_started",
      price: course.price ?? 0,
      cmeHours: course.cmeHours ?? 0,
      isCmeAccredited: course.isCmeAccredited ?? false,
      deliveryType: course.deliveryType,
    });
  };

  return (
    <Link
      href={`/courses/${course.id}`}
      className="group flex flex-col w-full h-full bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
    >
      {/* Hero image — 16:9 */}
      <div className="relative w-full aspect-[16/9] bg-[var(--color-surface-page)] overflow-hidden">
        {course.thumbnail ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={course.thumbnail}
            alt={course.title}
            className={`w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02] ${
              isEnded ? "grayscale opacity-70" : ""
            }`}
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

        {/* Favourite toggle (top-start) */}
        <button
          type="button"
          onClick={handleFavouriteClick}
          aria-label={favourited ? tFav("removeFromFavourites") : tFav("addToFavourites")}
          aria-pressed={favourited}
          className={`absolute top-3 ${isRTL ? "right-3" : "left-3"} w-8 h-8 bg-[var(--color-surface-card)] rounded-full flex items-center justify-center shadow-md hover:bg-[var(--color-border-subtle)] transition-colors z-10 cursor-pointer`}
        >
          <Heart
            className={`w-4 h-4 ${favourited ? "text-red-500 fill-red-500" : "text-[var(--color-icon)]"}`}
          />
        </button>

        {/* Delivery pill (bottom-start) */}
        <div className={`absolute bottom-3 ${isRTL ? "right-3" : "left-3"}`}>
          <div className="flex items-center gap-1.5 bg-[var(--color-primary)] rounded-full px-2.5 py-1 shadow-sm">
            <DeliveryIcon className="w-3.5 h-3.5 text-white" strokeWidth={2} />
            <span className="text-white text-[11px] font-semibold">{deliveryLabel}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-4 gap-2">
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
          className={`text-[var(--color-text-primary)] font-semibold text-[16px] leading-[22px] line-clamp-2 ${isRTL ? "text-right" : "text-left"}`}
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

        {/* Spacer */}
        <div className="flex-1" />

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
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" strokeWidth={2} />
            ) : (
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" strokeWidth={2} />
            )}
          </span>
        </div>
      </div>
    </Link>
  );
};

export default CourseCard;
