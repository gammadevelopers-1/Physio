"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  CourseCard,
  MobileCourseCard,
  CourseFilters,
  CoursePagination,
  CourseCTA,
} from "@/components/courses";
import ActiveCampaignBanner from "@/components/courses/ActiveCampaignBanner";
import TamaraSplitBanner from "@/components/marketing/TamaraSplitBanner";
import type { CourseFiltersLabels } from "@/components/courses/CourseFilters";
import { PublicCourse } from "@/types/instructor-dashboard";
import { useLocale } from "next-intl";
import { Archive, ArrowRight, ArrowLeft, Loader2 } from "lucide-react";

const DELIVERY_TYPES = ["zoom", "onsite", "blended", "self-paced", "webinar"];

interface CoursesPageContentProps extends CourseFiltersLabels {
  heroTitle?: string;
  heroSubtitle?: string;
  emptyStateTitle?: string;
  emptyStateMessage?: string;
  ctaTitle?: string;
  ctaDescription?: string;
  ctaButtonLabel?: string;
  ctaButtonHref?: string;
}

const CoursesPageContent = ({
  heroTitle,
  heroSubtitle,
  emptyStateTitle,
  emptyStateMessage,
  ctaTitle,
  ctaDescription,
  ctaButtonLabel,
  ctaButtonHref,
  ...filterLabels
}: CoursesPageContentProps = {}) => {
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [courses, setCourses] = useState<PublicCourse[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedPricing, setSelectedPricing] = useState("");
  const [availability, setAvailability] = useState("");
  const [language, setLanguage] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageMobile, setCurrentPageMobile] = useState(1);

  const postsPerPageDesktop = 6;
  const postsPerPageMobile = 3;

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (selectedPricing) params.set("pricing", selectedPricing);
      if (availability) params.set("availability", availability);
      if (language) params.set("language", language);
      if (sortBy) params.set("sort", sortBy);
      // Explicit — main listing only shows currently-enrollable courses.
      // Archived bucket lives on /archived (set scope=archived there).
      params.set("scope", "open");
      params.set("limit", "100");
      const qs = params.toString();
      const res = await fetch(`/api/public-courses${qs ? `?${qs}` : ""}`);
      const json = await res.json();
      setCourses(Array.isArray(json.data) ? json.data : []);
    } catch (err) {
      console.error("Failed to fetch courses:", err);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedPricing, availability, language, sortBy]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // Client-side filtering for delivery type (not a backend param)
  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const matchesType =
        selectedTypes.length === 0 ||
        selectedTypes.includes(course.deliveryType);
      return matchesType;
    });
  }, [courses, selectedTypes]);

  const totalPages = Math.ceil(filteredCourses.length / postsPerPageDesktop);
  const paginatedCourses = filteredCourses.slice(
    (currentPage - 1) * postsPerPageDesktop,
    currentPage * postsPerPageDesktop,
  );

  const totalPagesMobile = Math.ceil(
    filteredCourses.length / postsPerPageMobile,
  );
  const paginatedCoursesMobile = filteredCourses.slice(
    (currentPageMobile - 1) * postsPerPageMobile,
    currentPageMobile * postsPerPageMobile,
  );

  const resetPages = () => {
    setCurrentPage(1);
    setCurrentPageMobile(1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    resetPages();
  };

  const handleTypeChange = (types: string[]) => {
    setSelectedTypes(types);
    resetPages();
  };

  const handlePricingChange = (pricing: string) => {
    setSelectedPricing(pricing);
    resetPages();
  };

  const handleAvailabilityChange = (value: string) => {
    setAvailability(value);
    resetPages();
  };

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    resetPages();
  };

  const handleSortByChange = (value: string) => {
    setSortBy(value);
    resetPages();
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePageChangeMobile = (page: number) => {
    setCurrentPageMobile(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const filterProps = {
    searchQuery,
    onSearchChange: handleSearchChange,
    selectedTypes,
    onTypeChange: handleTypeChange,
    selectedPricing,
    onPricingChange: handlePricingChange,
    availability,
    onAvailabilityChange: handleAvailabilityChange,
    language,
    onLanguageChange: handleLanguageChange,
    sortBy,
    onSortByChange: handleSortByChange,
    courseTypes: DELIVERY_TYPES,
    isRTL,
    ...filterLabels,
  };

  const hasHeader = !!heroTitle || !!heroSubtitle;

  return (
    <>
      <ActiveCampaignBanner />
      <TamaraSplitBanner compact />
      {/* Desktop Layout */}
      <div className="hidden lg:block" dir={isRTL ? "rtl" : "ltr"}>
        <section className="px-16 py-12">
          <div className="max-w-[1200px] mx-auto">
            <div className="flex items-start justify-between gap-4 mb-8">
              {hasHeader ? (
                <div className={`${isRTL ? "text-right" : "text-left"}`}>
                  {heroTitle && (
                    <h1
                      className="font-semibold text-[var(--color-text-primary)] mb-2"
                      style={{ fontSize: "48px" }}
                    >
                      {heroTitle}
                    </h1>
                  )}
                  {heroSubtitle && (
                    <p className="text-[var(--color-text-secondary)]" style={{ fontSize: "20px" }}>
                      {heroSubtitle}
                    </p>
                  )}
                </div>
              ) : (
                <div />
              )}
              <Link
                href={`/${locale}/archived`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] transition-colors flex-shrink-0 mt-2"
              >
                <Archive className="w-4 h-4" />
                {isRTL ? "عرض الدورات المؤرشفة" : "View archived courses"}
                {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </Link>
            </div>

            <div className="flex gap-8">
              <CourseFilters {...filterProps} />

              <div className="flex-1">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
                  </div>
                ) : paginatedCourses.length > 0 ? (
                  <>
                    <div className="grid grid-cols-3 gap-8">
                      {paginatedCourses.map((course) => (
                        <CourseCard key={course.id} course={course} isRTL={isRTL} />
                      ))}
                    </div>

                    <CoursePagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={handlePageChange}
                      isRTL={isRTL}
                    />
                  </>
                ) : (
                  (emptyStateTitle || emptyStateMessage) && (
                    <div className="text-center py-16">
                      {emptyStateTitle && (
                        <p className="text-[var(--color-text-secondary)] text-xl font-semibold mb-2">
                          {emptyStateTitle}
                        </p>
                      )}
                      {emptyStateMessage && (
                        <p className="text-[var(--color-text-secondary)] text-lg">{emptyStateMessage}</p>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </section>

        <CourseCTA
          isRTL={isRTL}
          title={ctaTitle}
          description={ctaDescription}
          buttonLabel={ctaButtonLabel}
          buttonHref={ctaButtonHref}
        />
      </div>

      {/* Mobile Layout */}
      <div
        className="lg:hidden pb-24 overflow-x-hidden"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <section className="px-4 py-6 max-w-full">
          {hasHeader && (
            <div className={`mb-4 ${isRTL ? "text-right" : "text-left"}`}>
              {heroTitle && (
                <h1
                  className="font-semibold text-[var(--color-text-primary)] mb-1"
                  style={{ fontSize: "24px" }}
                >
                  {heroTitle}
                </h1>
              )}
              {heroSubtitle && (
                <p className="text-[var(--color-text-secondary)] text-sm">{heroSubtitle}</p>
              )}
            </div>
          )}
          <Link
            href={`/${locale}/archived`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] mb-4"
          >
            <Archive className="w-3.5 h-3.5" />
            {isRTL ? "عرض الدورات المؤرشفة" : "View archived courses"}
            {isRTL ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
          </Link>

          <CourseFilters {...filterProps} variant="mobile" />

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
            </div>
          ) : paginatedCoursesMobile.length > 0 ? (
            <>
              <div className="flex flex-col gap-6">
                {paginatedCoursesMobile.map((course) => (
                  <MobileCourseCard key={course.id} course={course} isRTL={isRTL} />
                ))}
              </div>

              <CoursePagination
                currentPage={currentPageMobile}
                totalPages={totalPagesMobile}
                onPageChange={handlePageChangeMobile}
                variant="mobile"
                isRTL={isRTL}
              />
            </>
          ) : (
            (emptyStateTitle || emptyStateMessage) && (
              <div className="text-center py-12">
                {emptyStateTitle && (
                  <p className="text-[var(--color-text-secondary)] text-lg font-semibold mb-2">
                    {emptyStateTitle}
                  </p>
                )}
                {emptyStateMessage && (
                  <p className="text-[var(--color-text-secondary)] text-base">{emptyStateMessage}</p>
                )}
              </div>
            )
          )}
        </section>

        <CourseCTA
          isRTL={isRTL}
          title={ctaTitle}
          description={ctaDescription}
          buttonLabel={ctaButtonLabel}
          buttonHref={ctaButtonHref}
        />
      </div>
    </>
  );
};

export default CoursesPageContent;
