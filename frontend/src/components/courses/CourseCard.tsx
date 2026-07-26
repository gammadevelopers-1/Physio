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
  Sparkles,
} from "lucide-react";
import { PublicCourse } from "@/types/instructor-dashboard";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { useFavourites } from "@/contexts/FavouritesContext";
import { useAuth } from "@/contexts";
import { FmtDate } from "@/components/ui/Fmt";
import DiscountBadge from "./DiscountBadge";

interface CourseCardProps {
  course: PublicCourse;
  isRTL?: boolean;
  /**
   * Current user's point balance. Passed down from the list page (which
   * already fetches user context). When undefined, the "or X points" pill
   * still renders but muted with a sign-in tooltip. Not fetched inside the
   * card — that would fan out one balance request per course.
   */
  userPointsBalance?: number;
}

const DELIVERY_ICON: Record<string, typeof Video> = {
  zoom: Video,
  onsite: MapPin,
  blended: Monitor,
  "self-paced": Monitor,
};

const CourseCard = ({ course, isRTL = false, userPointsBalance }: CourseCardProps) => {
  const t = useTranslations("coursesPage");
  const tRedeem = useTranslations("coursesPage.card.redeemWithPoints");
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

  const formattedDate = course.startDate ? null : t("card.tbd");

  const cmeLabel =
    course.isCmeAccredited && course.cmeHours
      ? `${course.cmeHours} CME ${t("card.hoursUnit")}`
      : course.totalHours > 0
        ? `${course.totalHours} ${t("card.hoursUnit")}`
        : null;

  const price = course.price ?? 0;
  const salePercent = course.salePercent ?? null;
  const saleAmount = course.saleAmount ?? null;
  const perCourseSalePrice = course.effectivePrice ?? price;
  // Campaign auto-apply discount (percentage or fixed, standard or early
  // bird). Applies on top of any per-course sale, so its `finalPrice` is
  // the true "you pay" number the card should headline.
  const campaign = course.campaignDiscount ?? null;
  const effectivePrice = campaign?.finalPrice ?? perCourseSalePrice;
  const onSale = (course.onSale ?? false) || !!campaign;
  const isFree = effectivePrice === 0;
  const isEarlyBirdCampaign = campaign?.campaignType === "early_bird";

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
            {course.startDate ? (
              <FmtDate value={course.startDate} variant="readable" locale={locale === "ar" ? "ar" : "en"} />
            ) : (
              formattedDate
            )}
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

        {/* Footer: price block + CTA.
            Layout is robust even with long prices ("4,799.04 SAR" + "4,999 SAR"
            + 4% OFF + View Details all on one row):
              • price column shrinks (`min-w-0`) so the CTA never gets pushed off
              • CTA uses `flex-shrink-0` + `whitespace-nowrap` so it stays intact
              • each price has `whitespace-nowrap` to prevent the "SAR" wrapping
                onto its own line at narrow widths
              • items-start aligns the top of the price block with the CTA so a
                taller price block doesn't push the CTA mid-card */}
        <div className="flex items-start justify-between gap-3 pt-2">
          <div className="min-w-0 flex flex-col items-start gap-1">
            {onSale && !isFree ? (
              <>
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-[var(--color-primary)] font-bold text-[15px] whitespace-nowrap">
                    {effectivePrice} SAR
                  </span>
                  <span className="text-[var(--color-text-secondary)] text-[12px] line-through whitespace-nowrap">
                    {price} SAR
                  </span>
                </div>
                {/* Which badge fires — priority (top down):
                    1. Early Bird campaign: yellow "Early Bird" badge with savings
                    2. Any active auto-apply campaign: red "Sale" badge with savings
                    3. Per-course sale: red "Sale" badge with % or SAR off
                   Campaigns take precedence over per-course-sale visuals when
                   both apply so students see the campaign name/branding. */}
                {campaign && isEarlyBirdCampaign ? (
                  <DiscountBadge
                    variant="earlyBird"
                    amountSaved={Math.max(0, price - effectivePrice)}
                    size="sm"
                  />
                ) : campaign ? (
                  <DiscountBadge
                    variant="sale"
                    percent={campaign.discountType === "percentage" ? campaign.discountValue : null}
                    amountSaved={Math.max(0, price - effectivePrice)}
                    size="sm"
                  />
                ) : (
                  <DiscountBadge
                    variant="sale"
                    percent={salePercent}
                    amountSaved={saleAmount ?? Math.max(0, price - effectivePrice)}
                    size="sm"
                  />
                )}
              </>
            ) : (
              <span className="text-[var(--color-primary)] font-bold text-[15px] whitespace-nowrap">
                {isFree ? t("card.free") : `${effectivePrice} SAR`}
              </span>
            )}
            <RedeemWithPointsPill
              redemption={course.redemption}
              userPointsBalance={userPointsBalance}
              isAuthenticated={isAuthenticated}
              tRedeem={tRedeem}
            />
          </div>
          <span className="flex-shrink-0 inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)] transition-colors whitespace-nowrap self-center">
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

interface RedeemWithPointsPillProps {
  redemption: PublicCourse["redemption"];
  userPointsBalance?: number;
  isAuthenticated: boolean;
  tRedeem: ReturnType<typeof useTranslations>;
}

/**
 * Small pill under the SAR price on a course card. Renders only when the
 * course is opted-in for points redemption. Three visual states:
 *   • Authed + affordable → violet-tinted, enabled-looking
 *   • Authed + insufficient → muted gray, tooltip with deficit
 *   • Unauthed → muted, sign-in tooltip
 * The pill is a badge, not a link. The actual "Redeem" CTA lives on the
 * course detail page — cards are for browsing, not committing spend.
 */
function RedeemWithPointsPill({
  redemption,
  userPointsBalance,
  isAuthenticated,
  tRedeem,
}: RedeemWithPointsPillProps) {
  if (!redemption?.enabled || !redemption.pointsCost || redemption.pointsCost <= 0) {
    return null;
  }
  const cost = redemption.pointsCost;
  const hasBalance = typeof userPointsBalance === "number";
  const affordable = hasBalance && userPointsBalance! >= cost;
  const deficit = hasBalance ? Math.max(0, cost - userPointsBalance!) : cost;

  const tooltip = !isAuthenticated
    ? tRedeem("tooltipSignIn")
    : !affordable
      ? tRedeem("tooltipNotEnough", { deficit })
      : "";

  return (
    <span
      title={tooltip}
      aria-label={tooltip || undefined}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
        affordable
          ? "bg-[#EDE9FE] text-[#7C3AED]"
          : "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
      }`}
    >
      <Sparkles className="w-3 h-3" strokeWidth={2} />
      {tRedeem("pill", { points: cost })}
    </span>
  );
}

export default CourseCard;
