"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  CourseCard,
  MobileCourseCard,
  CourseFilters,
  CoursePagination,
  CourseCTA,
} from "@/components/courses";
import { PublicCourse } from "@/types/instructor-dashboard";
import { useTranslations, useLocale } from "next-intl";
import { Loader2 } from "lucide-react";

const DELIVERY_TYPES = ["zoom", "onsite", "blended", "self-paced"];

const ArchivedPageContent = () => {
  const t = useTranslations("archivedPage");
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
    onAvailabilityChange: (v: string) => { setAvailability(v); resetPages(); },
    language,
    onLanguageChange: (v: string) => { setLanguage(v); resetPages(); },
    sortBy,
    onSortByChange: (v: string) => { setSortBy(v); resetPages(); },
    courseTypes: DELIVERY_TYPES,
    isRTL,
  };

  return (
    <>
      {/* Desktop Layout */}
      <div className="hidden lg:block" dir={isRTL ? "rtl" : "ltr"}>
        <section className="px-16 py-12">
          <div className="max-w-[1200px] mx-auto">
            <div className={`mb-8 ${isRTL ? "text-right" : "text-left"}`}>
              <h1
                className="font-semibold text-[var(--color-text-primary)] mb-2"
                style={{ fontSize: "48px" }}
              >
                {t("title")}
              </h1>
              <p className="text-[var(--color-text-secondary)]" style={{ fontSize: "20px" }}>
                {t("subtitle")}
              </p>
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
                        <CourseCard
                          key={course.id}
                          course={course}
                          isRTL={isRTL}
                        />
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
                  <div className="text-center py-16">
                    <p className="text-[var(--color-text-secondary)] text-lg">
                      {t("noCoursesFound")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <CourseCTA isRTL={isRTL} />
      </div>

      {/* Mobile Layout */}
      <div
        className="lg:hidden pb-24 overflow-x-hidden"
        dir={isRTL ? "rtl" : "ltr"}
      >
        <section className="px-4 py-6 max-w-full">
          <div className={`mb-6 ${isRTL ? "text-right" : "text-left"}`}>
            <h1
              className="font-semibold text-[var(--color-text-primary)] mb-1"
              style={{ fontSize: "24px" }}
            >
              {t("title")}
            </h1>
            <p className="text-[var(--color-text-secondary)] text-sm">{t("subtitle")}</p>
          </div>

          <CourseFilters {...filterProps} variant="mobile" />

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
            </div>
          ) : paginatedCoursesMobile.length > 0 ? (
            <>
              <div className="flex flex-col gap-6">
                {paginatedCoursesMobile.map((course) => (
                  <MobileCourseCard
                    key={course.id}
                    course={course}
                    isRTL={isRTL}
                  />
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
            <div className="text-center py-12">
              <p className="text-[var(--color-text-secondary)] text-base">
                {t("noCoursesFound")}
              </p>
            </div>
          )}
        </section>

        <CourseCTA isRTL={isRTL} />
      </div>
    </>
  );
};

export default ArchivedPageContent;
