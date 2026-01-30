"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Globe,
  Clock,
  Star,
  Users,
  Calendar,
  MapPin,
  Check,
  Share2,
  Heart,
  ShoppingCart,
  Video,
} from "lucide-react";
import { CourseCard, MobileCourseCard } from "@/components/courses";
import { courseDetails, courses } from "@/data/courses";
import { useTranslations, useLocale } from "next-intl";

const CourseDetailContent = () => {
  const t = useTranslations("courseDetailPage");
  const tCourses = useTranslations("coursesPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const params = useParams();
  const slug = params.slug as string;

  const course = courseDetails.find((c) => c.slug === slug) || courseDetails[0];
  const [selectedCity, setSelectedCity] = useState(course.schedules[0]?.city || "");
  const [selectedMonth, setSelectedMonth] = useState(isRTL ? "فبراير" : "February");
  const [selectedDate, setSelectedDate] = useState(
    course.schedules[0]?.dates[0]?.date || ""
  );
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);

  // Get related courses (excluding current)
  const relatedCourses = courses.filter((c) => c.slug !== slug).slice(0, 4);

  // Get dates for selected city
  const citySchedule = course.schedules.find((s) => s.city === selectedCity);
  const availableDates = citySchedule?.dates || [];

  const months = isRTL
    ? ["يناير", "فبراير", "مارس", "أبريل"]
    : ["January", "February", "March", "April"];

  // Get translated course data
  const getCourseTitle = () => {
    if (isRTL) {
      try {
        return tCourses(`courses.${course.slug}.title`);
      } catch {
        return course.title;
      }
    }
    return course.title;
  };

  const getCourseDescription = () => {
    if (isRTL) {
      try {
        return tCourses(`courses.${course.slug}.description`);
      } catch {
        return course.fullDescription;
      }
    }
    return course.fullDescription;
  };

  // Get translated city name
  const getTranslatedCity = (city: string) => {
    if (isRTL) {
      const cityMap: { [key: string]: string } = {
        "Jeddah": "جدة",
        "Riyadh": "الرياض",
        "Dammam": "الدمام",
        "Al Madinah Al Munawwarah": "المدينة المنورة"
      };
      return cityMap[city] || city;
    }
    return city;
  };

  // Get translated whatYouWillLearn items
  const getWhatYouWillLearn = (): string[] => {
    if (isRTL) {
      try {
        const items = tCourses.raw(`courses.${course.slug}.whatYouWillLearn`);
        if (Array.isArray(items)) {
          return items;
        }
      } catch {
        // Fall back to English if translation not found
      }
    }
    return course.whatYouWillLearn;
  };

  // Get translated full description
  const getFullDescription = () => {
    if (isRTL) {
      try {
        return tCourses(`courses.${course.slug}.fullDescription`);
      } catch {
        return course.fullDescription;
      }
    }
    return course.fullDescription;
  };

  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <>
      {/* Desktop Layout */}
      <div className="hidden lg:block bg-[#EEF3F7]" dir={isRTL ? "rtl" : "ltr"}>
        {/* Main Content Area */}
        <div className="px-16 pt-6">
          <div className="max-w-[1200px] mx-auto">
            <div className="flex gap-8">
              {/* Course Info - flex-1 */}
              <div className="flex-1">
                {/* Breadcrumb */}
                <div className={`flex items-center gap-2 text-sm text-[#71717A] mb-6 ${isRTL ? "flex-row" : ""}`}>
                  <Link href="/" className="hover:text-[#06080b]">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 6L8 1.33333L14 6V13.3333C14 13.687 13.8595 14.0261 13.6095 14.2761C13.3594 14.5262 13.0203 14.6667 12.6667 14.6667H3.33333C2.97971 14.6667 2.64057 14.5262 2.39052 14.2761C2.14048 14.0261 2 13.687 2 13.3333V6Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Link>
                  <ChevronIcon className="w-4 h-4" />
                  <Link href="/courses" className="hover:text-[#06080b]">
                    {t("breadcrumb.courses")}
                  </Link>
                  <ChevronIcon className="w-4 h-4" />
                  <span className="text-[#06080b]">{getCourseTitle()}</span>
                </div>

                {/* Title */}
                <h1
                  className={`font-bold text-[#06080b] mb-4 ${isRTL ? "text-right" : "text-left"}`}
                  style={{ fontSize: "40px", lineHeight: "1.2" }}
                >
                  {getCourseTitle()}
                </h1>
                <p className={`text-[#4a4c4f] text-lg mb-6 ${isRTL ? "text-right" : "text-left"}`}>{course.subtitle}</p>

                {/* Language Tags */}
                <div className={`flex items-center gap-3 mb-8 ${isRTL ? "justify-start" : ""}`}>
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[#71717A]" />
                    <span className="text-sm text-[#06080b]">{t("languages.english")}</span>
                  </div>
                  <div className="w-px h-4 bg-[#D4D4D8]" />
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[#71717A]" />
                    <span className="text-sm text-[#06080b]">{t("languages.arabic")}</span>
                  </div>
                </div>

                {/* Stats Bar with gradient left border */}
                <div className="relative bg-white shadow-sm rounded-xl overflow-hidden mb-8">
                  <div className={`flex items-center p-5 ${isRTL ? "pr-6" : "pl-6"}`}>
                    <div className={`${isRTL ? "pl-8" : "pr-8"} w-[65%] border-[#E5E7EB]`}>
                      <p className="text-sm text-[#4a4c4f]">
                        {t("statsBar.accessCourses")}{" "}
                        <Link href="/pricing" className="text-[#06080b] underline font-medium">
                          {t("statsBar.seePlans")}
                        </Link>
                      </p>
                    </div>
                    <div className={`flex-1 px-8 ${isRTL ? "border-l-2" : "border-r-2"} border-[#E5E7EB] text-center`}>
                      <p className="font-bold text-[#06080b] text-xl mb-1">{course.rating}</p>
                      <div className={`flex items-center justify-center gap-0.5 mb-1 ${isRTL ? "flex-row-reverse" : ""}`}>
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${i < Math.floor(course.rating) ? "text-[#B8860B] fill-[#B8860B]" : "text-[#E5E7EB] fill-[#E5E7EB]"}`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-[#71717A]">{course.reviews} {t("statsBar.reviews")}</p>
                    </div>
                    <div className={`flex-1 ${isRTL ? "pr-8" : "pl-8"} text-center`}>
                      <Users className="w-5 h-5 text-[#71717A] mx-auto mb-1" />
                      <p className="font-bold text-[#06080b] text-xl">{course.students}+</p>
                      <p className="text-xs text-[#71717A]">{t("statsBar.learners")}</p>
                    </div>
                  </div>
                </div>

                {/* Select City and Month */}
                <div className="relative bg-white shadow-sm rounded-xl overflow-hidden mb-6">
                  <div className={`p-6 ${isRTL ? "pr-7" : "pl-7"}`}>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-semibold text-[#06080b] text-lg">
                        {t("selectCityMonth.title")}
                      </h3>
                      <div className="flex gap-3">
                        {/* City Dropdown */}
                        <div className="relative">
                          <button
                            onClick={() => setCityDropdownOpen(!cityDropdownOpen)}
                            className="flex items-center justify-between gap-4 px-4 py-2.5 border border-[#C8D5E1] rounded-lg min-w-[150px] text-sm bg-white"
                          >
                            <span>{getTranslatedCity(selectedCity)}</span>
                            <ChevronDown className="w-4 h-4 text-[#71717A]" />
                          </button>
                          {cityDropdownOpen && (
                            <div className={`absolute top-full ${isRTL ? "right-0" : "left-0"} mt-1 w-full bg-white border border-[#C8D5E1] rounded-lg shadow-lg z-10`}>
                              {course.schedules.map((schedule) => (
                                <button
                                  key={schedule.city}
                                  onClick={() => {
                                    setSelectedCity(schedule.city);
                                    setCityDropdownOpen(false);
                                  }}
                                  className={`w-full px-4 py-2 ${isRTL ? "text-right" : "text-left"} text-sm hover:bg-[#F4F4F5]`}
                                >
                                  {getTranslatedCity(schedule.city)}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Month Dropdown */}
                        <div className="relative">
                          <button
                            onClick={() => setMonthDropdownOpen(!monthDropdownOpen)}
                            className="flex items-center justify-between gap-4 px-4 py-2.5 border border-[#C8D5E1] rounded-lg min-w-[150px] text-sm bg-white"
                          >
                            <span>{selectedMonth}</span>
                            <ChevronDown className="w-4 h-4 text-[#71717A]" />
                          </button>
                          {monthDropdownOpen && (
                            <div className={`absolute top-full ${isRTL ? "right-0" : "left-0"} mt-1 w-full bg-white border border-[#C8D5E1] rounded-lg shadow-lg z-10`}>
                              {months.map((month) => (
                                <button
                                  key={month}
                                  onClick={() => {
                                    setSelectedMonth(month);
                                    setMonthDropdownOpen(false);
                                  }}
                                  className={`w-full px-4 py-2 ${isRTL ? "text-right" : "text-left"} text-sm hover:bg-[#F4F4F5]`}
                                >
                                  {month}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Date Cards */}
                    <div className="grid grid-cols-3 gap-4">
                      {availableDates.map((dateItem, index) => (
                        <button
                          key={dateItem.date}
                          onClick={() => setSelectedDate(dateItem.date)}
                          className={`relative flex items-center justify-between p-4 ${isRTL ? "pr-5" : "pl-5"} rounded-xl overflow-hidden transition-colors ${
                            selectedDate === dateItem.date
                              ? "bg-[#FFFBEB]"
                              : "bg-[#F4F4F5]"
                          }`}
                        >
                          <div
                            className={`absolute ${isRTL ? "right-0" : "left-0"} top-0 bottom-0 w-1`}
                            style={{ background: selectedDate === dateItem.date ? "linear-gradient(180deg, #8E690A 0%, #6B4F08 100%)" : "#C8D5E1" }}
                          />
                          <div className={isRTL ? "text-right" : "text-left"}>
                            <p className="font-semibold text-[#06080b] text-base">{getTranslatedCity(selectedCity)}</p>
                            <p className="text-sm text-[#71717A]">{dateItem.date}</p>
                          </div>
                          <div className="flex items-center gap-1 text-[#71717A]">
                            <Users className="w-4 h-4" />
                            <span className="text-sm">{index}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Registration Note */}
                <div className={`bg-[#FBE9E9] rounded-lg p-4 text-sm text-[#DC2626] leading-relaxed ${isRTL ? "text-right" : "text-left"}`}>
                  {t("registrationNote")}
                </div>
              </div>

              {/* Pricing Card */}
              <div className="w-[360px] flex-shrink-0">
                <div className="bg-white shadow-sm border border-[#E5E7EB] rounded-2xl sticky top-24">
                  {/* Course Image */}
                  <div className="p-4 pb-0">
                    <div className="relative h-[200px] rounded-xl overflow-hidden">
                      <Image
                        src="/blogs/blog-hero.png"
                        alt={getCourseTitle()}
                        fill
                        className="object-cover"
                      />
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex items-center gap-2 px-4 py-4">
                    <div className="flex items-center gap-1.5 border border-[#E5E7EB] rounded-lg px-3 py-1.5">
                      <Video className="w-3.5 h-3.5 text-[#4a4c4f]" />
                      <span className="text-[#4a4c4f] text-xs">{isRTL ? tCourses("card.liveOnline") : course.type}</span>
                    </div>
                    <div className="flex items-center gap-1.5 border border-[#E5E7EB] rounded-lg px-3 py-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#4a4c4f]" />
                      <span className="text-[#4a4c4f] text-xs">{course.hours}</span>
                    </div>
                    <div className="border border-[#E5E7EB] rounded-lg px-3 py-1.5">
                      <span className="text-[#4a4c4f] text-xs">{course.certification}</span>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="px-4 pb-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                        <Image src="/icons/rayal-icon.svg" alt="SAR" width={22} height={24} />
                        <span className="text-3xl font-bold text-[#06080b]">{course.price}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="p-2.5 rounded-full bg-[#F4F4F5] hover:bg-[#E5E7EB] transition-colors">
                          <Share2 className="w-4 h-4 text-[#4a4c4f]" />
                        </button>
                        <button className="p-2.5 rounded-full bg-[#F4F4F5] hover:bg-[#E5E7EB] transition-colors">
                          <Heart className="w-4 h-4 text-[#4a4c4f]" />
                        </button>
                      </div>
                    </div>

                    {/* Tabby Payment */}
                    <div className="border border-[#C8D5E1] rounded-xl p-4 mb-4">
                      <div className="flex items-start justify-between">
                        <div className={isRTL ? "text-right" : "text-left"}>
                          <p className="text-sm text-[#06080b]">
                            {t("pricingCard.asLowAs")}{" "}
                            <span className="font-semibold">
                              <Image src="/icons/rayal-icon.svg" alt="SAR" width={12} height={13} className="inline -mt-0.5" />
                              {" "}{(course.price / 4).toFixed(2)}{t("pricingCard.perMonth")}
                            </span>
                          </p>
                          <p className="text-sm text-[#06080b]">{t("pricingCard.interestFree")}</p>
                          <p className="text-sm text-[#06080b]">
                            {t("pricingCard.shariahCompliant")}{" "}
                            <Link href="#" className="font-semibold underline">{t("pricingCard.learnMore")}</Link>
                          </p>
                        </div>
                        <Image src="/images/tabby.svg" alt="Tabby" width={70} height={28} className="mt-1" />
                      </div>
                    </div>

                    {/* Buttons */}
                    <button className="w-full h-12 btn-gold rounded-xl text-white font-medium mb-3">
                      {t("pricingCard.buyNow")}
                    </button>
                    <button className="w-full h-12 bg-[#0b0f17] rounded-xl text-white font-medium flex items-center justify-center gap-2 mb-5">
                      {t("pricingCard.addToCart")}
                      <ShoppingCart className="w-4 h-4" />
                    </button>

                    {/* Payment Methods */}
                    <div className="flex items-center justify-center gap-3 flex-wrap">
                      <span className="text-sm text-[#4a4c4f]">{t("pricingCard.securePayment")}</span>
                      <div className="flex items-center gap-2">
                        <div className="relative w-[35px] h-[24px] bg-white border border-[#d9d9d9] rounded overflow-hidden">
                          <Image src="/payment icons/Mastercard.svg" alt="Mastercard" fill className="object-contain p-[5px]" />
                        </div>
                        <div className="relative w-[35px] h-[24px] bg-white border border-[#d9d9d9] rounded overflow-hidden">
                          <Image src="/payment icons/Visa.svg" alt="Visa" fill className="object-contain p-[6px]" />
                        </div>
                        <div className="relative w-[35px] h-[24px] bg-white border border-[#d9d9d9] rounded overflow-hidden">
                          <Image src="/payment icons/image 474.svg" alt="Mada" fill className="object-contain p-[5px]" />
                        </div>
                        <div className="relative w-[35px] h-[24px]">
                          <Image src="/payment icons/ApplePay.svg" alt="Apple Pay" fill className="object-contain" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Course Details Section */}
        <section className="px-16 py-12">
          <div className="max-w-[1200px] mx-auto">
            <div className="bg-white rounded-2xl p-8 mb-8">
              <h2 className={`font-bold text-[#06080b] text-xl mb-6 ${isRTL ? "text-right" : "text-left"}`}>{t("courseDetails.title")}</h2>

              <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-[#71717A] mt-0.5" />
                  <div className={isRTL ? "text-right" : "text-left"}>
                    <p className="text-sm font-semibold text-[#06080b]">{t("courseDetails.registrationDeadline")}</p>
                    <p className="text-sm text-[#71717A]">24 Jan 2026 (2:47 PM)</p>
                  </div>
                </div>
                <div className={`relative bg-[#F4F4F5] rounded-lg p-3 ${isRTL ? "pr-5" : "pl-5"} overflow-hidden`}>
                  <div className={`absolute ${isRTL ? "right-0" : "left-0"} top-0 bottom-0 w-1 bg-[#C8D5E1]`} />
                  <p className={`text-sm font-semibold text-[#06080b] ${isRTL ? "text-right" : "text-left"}`}>{t("courseDetails.city")}</p>
                  <p className={`text-sm text-[#71717A] ${isRTL ? "text-right" : "text-left"}`}>{getTranslatedCity(selectedCity) || (isRTL ? "المدينة المنورة" : "Al Madinah Al Munawwarah")}</p>
                </div>
                <div className="flex items-start gap-3">
                  <Globe className="w-5 h-5 text-[#71717A] mt-0.5" />
                  <div className={isRTL ? "text-right" : "text-left"}>
                    <p className="text-sm font-semibold text-[#06080b]">{t("courseDetails.language")}</p>
                    <p className="text-sm text-[#71717A]">{course.language}</p>
                  </div>
                </div>
                <div className={`relative bg-[#F4F4F5] rounded-lg p-3 ${isRTL ? "pr-5" : "pl-5"} overflow-hidden`}>
                  <div className={`absolute ${isRTL ? "right-0" : "left-0"} top-0 bottom-0 w-1 bg-[#C8D5E1]`} />
                  <p className={`text-sm font-semibold text-[#06080b] ${isRTL ? "text-right" : "text-left"}`}>{t("courseDetails.startTime")}</p>
                  <p className={`text-sm text-[#71717A] ${isRTL ? "text-right" : "text-left"}`}>25 Jan 2026 (10:59 AM)</p>
                </div>
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-[#71717A] mt-0.5" />
                  <div className={isRTL ? "text-right" : "text-left"}>
                    <p className="text-sm font-semibold text-[#06080b]">{t("courseDetails.duration")}</p>
                    <p className="text-sm text-[#71717A]">{course.duration}</p>
                  </div>
                </div>
                <div className={`relative bg-[#F4F4F5] rounded-lg p-3 ${isRTL ? "pr-5" : "pl-5"} overflow-hidden`}>
                  <div className={`absolute ${isRTL ? "right-0" : "left-0"} top-0 bottom-0 w-1 bg-[#C8D5E1]`} />
                  <p className={`text-sm font-semibold text-[#06080b] ${isRTL ? "text-right" : "text-left"}`}>{t("courseDetails.endTime")}</p>
                  <p className={`text-sm text-[#71717A] ${isRTL ? "text-right" : "text-left"}`}>26 Jan 2026 (4:00 PM)</p>
                </div>
                <div></div>
                <div className={`relative bg-[#F4F4F5] rounded-lg p-3 ${isRTL ? "pr-5" : "pl-5"} overflow-hidden`}>
                  <div className={`absolute ${isRTL ? "right-0" : "left-0"} top-0 bottom-0 w-1 bg-[#C8D5E1]`} />
                  <p className={`text-sm font-semibold text-[#06080b] ${isRTL ? "text-right" : "text-left"}`}>{t("courseDetails.venue")}</p>
                  <p className={`text-sm text-[#71717A] ${isRTL ? "text-right" : "text-left"}`}>Physio Guidance</p>
                </div>
              </div>
            </div>

            {/* What You'll Learn */}
            <div className="bg-white rounded-2xl p-8 mb-8">
              <h2 className={`font-bold text-[#06080b] text-xl mb-6 ${isRTL ? "text-right" : "text-left"}`}>
                {t("whatYouWillLearn.title")}
              </h2>
              <div className="space-y-4">
                {getWhatYouWillLearn().map((item, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-[#06080b] flex-shrink-0 mt-0.5" />
                    <p className={`text-[#06080b] text-base ${isRTL ? "text-right" : "text-left"}`}>{item}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="bg-white rounded-2xl p-8">
              <h2 className={`font-bold text-[#06080b] text-xl mb-4 ${isRTL ? "text-right" : "text-left"}`}>{t("description.title")}</h2>
              <p className={`text-[#4a4c4f] text-base leading-relaxed mb-4 ${isRTL ? "text-right" : "text-left"}`}>
                {showFullDescription
                  ? getFullDescription()
                  : getFullDescription().slice(0, 300) + "..."}
              </p>
              <button
                onClick={() => setShowFullDescription(!showFullDescription)}
                className={`flex items-center gap-1 text-[#06080b] text-sm font-medium ${isRTL ? "flex-row-reverse" : ""}`}
              >
                {showFullDescription ? t("description.viewLess") : t("description.viewMore")}
                <ChevronDown className={`w-4 h-4 transition-transform ${showFullDescription ? "rotate-180" : ""}`} />
              </button>
            </div>
          </div>
        </section>

        {/* Related Courses */}
        <section className="px-16 py-16 bg-white">
          <div className="max-w-[1200px] mx-auto">
            <h2 className="font-bold text-[#06080b] text-center mb-10" style={{ fontSize: "36px" }}>
              {t("relatedCourses.title")}
            </h2>

            <div className="grid grid-cols-4 gap-6">
              {relatedCourses.map((relatedCourse) => (
                <CourseCard key={relatedCourse.id} course={relatedCourse} isRTL={isRTL} />
              ))}
            </div>

            <div className="text-center mt-10">
              <Link
                href="/courses"
                className="inline-flex items-center justify-center h-10 px-6 btn-gold rounded-xl text-sm font-medium text-white"
              >
                {t("relatedCourses.viewAllButton")}
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden pb-24 bg-[#EEF3F7]" dir={isRTL ? "rtl" : "ltr"}>
        {/* Breadcrumb */}
        <div className="px-4 pt-4">
          <div className="flex items-center gap-1 text-xs text-[#71717A] overflow-x-auto">
            <Link href="/" className="flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 6L8 1.33333L14 6V13.3333C14 13.687 13.8595 14.0261 13.6095 14.2761C13.3594 14.5262 13.0203 14.6667 12.6667 14.6667H3.33333C2.97971 14.6667 2.64057 14.5262 2.39052 14.2761C2.14048 14.0261 2 13.687 2 13.3333V6Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
            <ChevronIcon className="w-3 h-3 flex-shrink-0" />
            <Link href="/courses" className="flex-shrink-0">{t("breadcrumb.courses")}</Link>
            <ChevronIcon className="w-3 h-3 flex-shrink-0" />
            <span className="text-[#06080b] truncate">{getCourseTitle()}</span>
          </div>
        </div>

        {/* Hero Section */}
        <section className="px-4 py-6">
          <h1
            className={`font-bold text-[#06080b] mb-2 ${isRTL ? "text-right" : "text-left"}`}
            style={{ fontSize: "24px", lineHeight: "1.3" }}
          >
            {getCourseTitle()}
          </h1>
          <p className={`text-[#4a4c4f] text-sm mb-4 ${isRTL ? "text-right" : "text-left"}`}>{course.subtitle}</p>

          {/* Language Tags */}
          <div className={`flex items-center gap-3 mb-6 ${isRTL ? "justify-start" : ""}`}>
            <div className="flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-[#71717A]" />
              <span className="text-xs text-[#06080b]">{t("languages.english")}</span>
            </div>
            <div className="w-px h-3 bg-[#D4D4D8]" />
            <div className="flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-[#71717A]" />
              <span className="text-xs text-[#06080b]">{t("languages.arabic")}</span>
            </div>
          </div>

          {/* Stats */}
          <div className="relative bg-white rounded-xl overflow-hidden mb-6">
            <div
              className={`absolute ${isRTL ? "right-0" : "left-0"} top-0 bottom-0 w-1`}
              style={{ background: "linear-gradient(180deg, #AB842F 0%, #8E690A 100%)" }}
            />
            <div className={`flex items-center p-3 ${isRTL ? "pr-4" : "pl-4"}`}>
              <div className={`flex-1 text-center ${isRTL ? "border-l" : "border-r"} border-[#E5E7EB]`}>
                <p className="font-bold text-[#06080b]">{course.rating}</p>
                <div className={`flex items-center justify-center gap-0.5 mb-0.5 ${isRTL ? "flex-row-reverse" : ""}`}>
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3 h-3 ${i < Math.floor(course.rating) ? "text-[#B8860B] fill-[#B8860B]" : "text-[#E5E7EB] fill-[#E5E7EB]"}`}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-[#71717A]">{course.reviews} {t("statsBar.reviews")}</p>
              </div>
              <div className="flex-1 text-center">
                <Users className="w-4 h-4 text-[#71717A] mx-auto mb-0.5" />
                <p className="font-bold text-[#06080b]">{course.students}+</p>
                <p className="text-[10px] text-[#71717A]">{t("statsBar.learners")}</p>
              </div>
            </div>
          </div>

          {/* Price Card */}
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className={`flex items-center gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                <Image src="/icons/rayal-icon.svg" alt="SAR" width={18} height={20} />
                <span className="text-2xl font-bold text-[#06080b]">{course.price}</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-full bg-[#F4F4F5]">
                  <Share2 className="w-4 h-4 text-[#4a4c4f]" />
                </button>
                <button className="p-2 rounded-full bg-[#F4F4F5]">
                  <Heart className="w-4 h-4 text-[#4a4c4f]" />
                </button>
              </div>
            </div>

            {/* Tabby Payment */}
            <div className="border border-[#C8D5E1] rounded-xl p-3 mb-4">
              <div className="flex items-start justify-between">
                <div className={isRTL ? "text-right" : "text-left"}>
                  <p className="text-sm text-[#06080b]">
                    {t("pricingCard.asLowAs")} <span className="font-semibold">{(course.price / 4).toFixed(2)}{t("pricingCard.perMonth")}</span>
                  </p>
                  <p className="text-xs text-[#06080b]">{t("pricingCard.interestFree")}</p>
                  <p className="text-xs text-[#06080b]">
                    {t("pricingCard.shariahCompliant")} <Link href="#" className="font-semibold underline">{t("pricingCard.learnMore")}</Link>
                  </p>
                </div>
                <Image src="/images/tabby.svg" alt="Tabby" width={50} height={20} />
              </div>
            </div>

            <button className="w-full h-10 btn-gold rounded-xl text-white text-sm font-medium mb-2">
              {t("pricingCard.buyNow")}
            </button>
            <button className="w-full h-10 bg-[#0b0f17] rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2">
              {t("pricingCard.addToCart")}
              <ShoppingCart className="w-4 h-4" />
            </button>
          </div>

          {/* City Selection */}
          <div className="relative bg-white rounded-xl overflow-hidden mb-4">
            <div
              className={`absolute ${isRTL ? "right-0" : "left-0"} top-0 bottom-0 w-1`}
              style={{ background: "linear-gradient(180deg, #AB842F 0%, #8E690A 100%)" }}
            />
            <div className={`p-4 ${isRTL ? "pr-5" : "pl-5"}`}>
              <h3 className={`font-semibold text-[#06080b] text-base mb-3 ${isRTL ? "text-right" : "text-left"}`}>
                {t("selectCityMonth.title")}
              </h3>
              <div className="flex gap-2 mb-4">
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className={`flex-1 px-3 py-2 border border-[#C8D5E1] rounded-lg text-sm ${isRTL ? "text-right" : "text-left"}`}
                  dir={isRTL ? "rtl" : "ltr"}
                >
                  {course.schedules.map((schedule) => (
                    <option key={schedule.city} value={schedule.city}>
                      {getTranslatedCity(schedule.city)}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className={`flex-1 px-3 py-2 border border-[#C8D5E1] rounded-lg text-sm ${isRTL ? "text-right" : "text-left"}`}
                  dir={isRTL ? "rtl" : "ltr"}
                >
                  {months.map((month) => (
                    <option key={month} value={month}>
                      {month}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Cards */}
              <div className="grid grid-cols-2 gap-2">
                {availableDates.slice(0, 4).map((dateItem, index) => (
                  <button
                    key={dateItem.date}
                    onClick={() => setSelectedDate(dateItem.date)}
                    className={`relative flex items-center justify-between p-3 ${isRTL ? "pr-4" : "pl-4"} rounded-lg overflow-hidden ${
                      selectedDate === dateItem.date
                        ? "bg-[#FFFBEB]"
                        : "bg-[#F4F4F5]"
                    }`}
                  >
                    <div
                      className={`absolute ${isRTL ? "right-0" : "left-0"} top-0 bottom-0 w-1`}
                      style={{ background: selectedDate === dateItem.date ? "linear-gradient(180deg, #8E690A 0%, #6B4F08 100%)" : "#C8D5E1" }}
                    />
                    <div className={isRTL ? "text-right" : "text-left"}>
                      <p className="font-semibold text-[#06080b] text-xs">{getTranslatedCity(selectedCity)}</p>
                      <p className="text-[10px] text-[#71717A]">{dateItem.date}</p>
                    </div>
                    <div className="flex items-center gap-1 text-[#71717A]">
                      <Users className="w-3 h-3" />
                      <span className="text-xs">{index}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Registration Note */}
          <div className={`bg-[#FBE9E9] rounded-lg p-3 text-xs text-[#DC2626] leading-relaxed ${isRTL ? "text-right" : "text-left"}`}>
            {t("registrationNote")}
          </div>
        </section>

        {/* Course Details */}
        <section className="px-4 py-6">
          <div className="bg-white rounded-xl p-4 mb-4">
            <h2 className={`font-bold text-[#06080b] text-lg mb-4 ${isRTL ? "text-right" : "text-left"}`}>{t("courseDetails.title")}</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-[#71717A]" />
                <div className={isRTL ? "text-right" : "text-left"}>
                  <p className="text-xs font-semibold text-[#06080b]">{t("courseDetails.registrationDeadline")}</p>
                  <p className="text-sm text-[#71717A]">24 Jan 2026</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4 text-[#71717A]" />
                <div className={isRTL ? "text-right" : "text-left"}>
                  <p className="text-xs font-semibold text-[#06080b]">{t("courseDetails.language")}</p>
                  <p className="text-sm text-[#71717A]">{course.language}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-[#71717A]" />
                <div className={isRTL ? "text-right" : "text-left"}>
                  <p className="text-xs font-semibold text-[#06080b]">{t("courseDetails.duration")}</p>
                  <p className="text-sm text-[#71717A]">{course.duration}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-[#71717A]" />
                <div className={isRTL ? "text-right" : "text-left"}>
                  <p className="text-xs font-semibold text-[#06080b]">{t("courseDetails.venue")}</p>
                  <p className="text-sm text-[#71717A]">Physio Guidance</p>
                </div>
              </div>
            </div>
          </div>

          {/* What You'll Learn */}
          <div className="bg-white rounded-xl p-4 mb-4">
            <h2 className={`font-bold text-[#06080b] text-lg mb-4 ${isRTL ? "text-right" : "text-left"}`}>{t("whatYouWillLearn.title")}</h2>
            <div className="space-y-3">
              {getWhatYouWillLearn().map((item, index) => (
                <div key={index} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-[#06080b] flex-shrink-0 mt-0.5" />
                  <p className={`text-[#06080b] text-sm ${isRTL ? "text-right" : "text-left"}`}>{item}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="bg-white rounded-xl p-4">
            <h2 className={`font-bold text-[#06080b] text-lg mb-3 ${isRTL ? "text-right" : "text-left"}`}>{t("description.title")}</h2>
            <p className={`text-[#4a4c4f] text-sm leading-relaxed mb-3 ${isRTL ? "text-right" : "text-left"}`}>
              {showFullDescription
                ? getFullDescription()
                : getFullDescription().slice(0, 200) + "..."}
            </p>
            <button
              onClick={() => setShowFullDescription(!showFullDescription)}
              className={`flex items-center gap-1 text-[#06080b] text-sm font-medium ${isRTL ? "flex-row-reverse" : ""}`}
            >
              {showFullDescription ? t("description.viewLess") : t("description.viewMore")}
              <ChevronDown className={`w-4 h-4 transition-transform ${showFullDescription ? "rotate-180" : ""}`} />
            </button>
          </div>
        </section>

        {/* Related Courses */}
        <section className="px-4 py-8 bg-white">
          <h2 className="font-bold text-[#06080b] text-center mb-1" style={{ fontSize: "24px" }}>
            {t("relatedCourses.title")}
          </h2>
          <p className="text-[#4a4c4f] text-center text-sm mb-6">
            {t("relatedCourses.subtitle")}
          </p>

          <div className="flex flex-col gap-6">
            {relatedCourses.slice(0, 3).map((relatedCourse) => (
              <MobileCourseCard key={relatedCourse.id} course={relatedCourse} isRTL={isRTL} />
            ))}
          </div>

          <div className="text-center mt-8">
            <Link
              href="/courses"
              className="inline-flex items-center justify-center h-10 px-6 btn-gold rounded-xl text-sm font-medium text-white"
            >
              {t("relatedCourses.viewAllButton")}
            </Link>
          </div>
        </section>
      </div>
    </>
  );
};

export default CourseDetailContent;
