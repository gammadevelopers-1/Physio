"use client";

import { useState, useMemo } from "react";
import {
  CourseCard,
  MobileCourseCard,
  CourseFilters,
  CoursePagination,
  CourseCTA,
} from "@/components/courses";
import { courses, courseTypes, certifications } from "@/data/courses";
import { useTranslations, useLocale } from "next-intl";

const CoursesPageContent = () => {
  const t = useTranslations("coursesPage");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedCertifications, setSelectedCertifications] = useState<string[]>([]);
  const [selectedPricing, setSelectedPricing] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageMobile, setCurrentPageMobile] = useState(1);

  const postsPerPageDesktop = 6;
  const postsPerPageMobile = 3;

  // Filter courses based on all criteria
  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      // Search filter
      const matchesSearch =
        searchQuery === "" ||
        course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.description.toLowerCase().includes(searchQuery.toLowerCase());

      // Type filter
      const matchesType =
        selectedTypes.length === 0 || selectedTypes.includes(course.type);

      // Certification filter
      const matchesCertification =
        selectedCertifications.length === 0 ||
        selectedCertifications.includes(course.certification);

      // Pricing filter
      const matchesPricing =
        selectedPricing.length === 0 ||
        (selectedPricing.includes("Paid") && course.isPaid) ||
        (selectedPricing.includes("Free") && !course.isPaid);

      return matchesSearch && matchesType && matchesCertification && matchesPricing;
    });
  }, [searchQuery, selectedTypes, selectedCertifications, selectedPricing]);

  // Desktop pagination
  const totalPages = Math.ceil(filteredCourses.length / postsPerPageDesktop);
  const paginatedCourses = filteredCourses.slice(
    (currentPage - 1) * postsPerPageDesktop,
    currentPage * postsPerPageDesktop
  );

  // Mobile pagination
  const totalPagesMobile = Math.ceil(filteredCourses.length / postsPerPageMobile);
  const paginatedCoursesMobile = filteredCourses.slice(
    (currentPageMobile - 1) * postsPerPageMobile,
    currentPageMobile * postsPerPageMobile
  );

  // Reset pagination when filters change
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
    setCurrentPageMobile(1);
  };

  const handleTypeChange = (types: string[]) => {
    setSelectedTypes(types);
    setCurrentPage(1);
    setCurrentPageMobile(1);
  };

  const handleCertificationChange = (certs: string[]) => {
    setSelectedCertifications(certs);
    setCurrentPage(1);
    setCurrentPageMobile(1);
  };

  const handlePricingChange = (pricing: string[]) => {
    setSelectedPricing(pricing);
    setCurrentPage(1);
    setCurrentPageMobile(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePageChangeMobile = (page: number) => {
    setCurrentPageMobile(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      {/* Desktop Layout */}
      <div className="hidden lg:block" dir={isRTL ? "rtl" : "ltr"}>
        <section className="px-16 py-12">
          <div className="max-w-[1200px] mx-auto">
            {/* Header */}
            <div className={`mb-8 ${isRTL ? "text-right" : "text-left"}`}>
              <h1
                className="font-semibold text-[#06080b] mb-2"
                style={{ fontSize: "48px" }}
              >
                {t("title")}
              </h1>
              <p className="text-[#4a4c4f]" style={{ fontSize: "20px" }}>
                {t("subtitle")}
              </p>
            </div>

            {/* Main Content - dir=rtl automatically puts sidebar on right */}
            <div className="flex gap-8">
              {/* Sidebar Filters */}
              <CourseFilters
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
                selectedTypes={selectedTypes}
                onTypeChange={handleTypeChange}
                selectedCertifications={selectedCertifications}
                onCertificationChange={handleCertificationChange}
                selectedPricing={selectedPricing}
                onPricingChange={handlePricingChange}
                courseTypes={courseTypes}
                certifications={certifications}
                isRTL={isRTL}
              />

              {/* Course Grid */}
              <div className="flex-1">
                {paginatedCourses.length > 0 ? (
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
                  <div className="text-center py-16">
                    <p className="text-[#4a4c4f] text-lg">
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
      <div className="lg:hidden pb-24 overflow-x-hidden" dir={isRTL ? "rtl" : "ltr"}>
        <section className="px-4 py-6 max-w-full">
          {/* Header */}
          <div className={`mb-6 ${isRTL ? "text-right" : "text-left"}`}>
            <h1
              className="font-semibold text-[#06080b] mb-1"
              style={{ fontSize: "24px" }}
            >
              {t("title")}
            </h1>
            <p className="text-[#4a4c4f] text-sm">{t("subtitle")}</p>
          </div>

          {/* Filters */}
          <CourseFilters
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            selectedTypes={selectedTypes}
            onTypeChange={handleTypeChange}
            selectedCertifications={selectedCertifications}
            onCertificationChange={handleCertificationChange}
            selectedPricing={selectedPricing}
            onPricingChange={handlePricingChange}
            courseTypes={courseTypes}
            certifications={certifications}
            variant="mobile"
            isRTL={isRTL}
          />

          {/* Course Cards */}
          {paginatedCoursesMobile.length > 0 ? (
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
            <div className="text-center py-12">
              <p className="text-[#4a4c4f] text-base">
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

export default CoursesPageContent;
