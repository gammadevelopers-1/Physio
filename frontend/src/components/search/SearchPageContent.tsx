"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import GlobalSearchBar from "./GlobalSearchBar";
import SearchResults from "./SearchResults";
import AdvancedFilters, { FilterState } from "./AdvancedFilters";
import MobileFilterDrawer from "./MobileFilterDrawer";
import RecentSearches from "./RecentSearches";
import { useRecentSearches } from "./useRecentSearches";
import { courses } from "@/data/courses";
import { searchBlogs } from "@/lib/strapi/api";
import type { StrapiBlogPost } from "@/lib/strapi/types";
import type { Course } from "@/data/courses";

const DEFAULT_FILTERS: FilterState = {
  contentType: "all",
  courseTypes: [],
  certifications: [],
  priceRange: "all",
  sortBy: "relevance",
};

const SearchPageContent = () => {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const t = useTranslations("searchPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  // State
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [isLoading, setIsLoading] = useState(false);
  const [blogResults, setBlogResults] = useState<StrapiBlogPost[]>([]);
  const [hasSearched, setHasSearched] = useState(!!initialQuery);

  // Recent searches hook
  const { recentSearches, addSearch, removeSearch, clearAll: clearRecentSearches } = useRecentSearches();

  // Calculate active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.contentType !== "all") count++;
    count += filters.courseTypes.length;
    count += filters.certifications.length;
    if (filters.priceRange !== "all") count++;
    return count;
  }, [filters]);

  // Filter courses based on search query and advanced filters (client-side)
  const filteredCourses = useMemo(() => {
    if (!query.trim()) return [];

    const searchLower = query.toLowerCase();

    // First filter by search query
    let results = courses.filter((course) => {
      return (
        course.title.toLowerCase().includes(searchLower) ||
        course.description.toLowerCase().includes(searchLower) ||
        course.category.toLowerCase().includes(searchLower) ||
        course.type.toLowerCase().includes(searchLower)
      );
    });

    // Apply course type filter
    if (filters.courseTypes.length > 0) {
      results = results.filter(course => filters.courseTypes.includes(course.type));
    }

    // Apply certification filter
    if (filters.certifications.length > 0) {
      results = results.filter(course =>
        filters.certifications.includes(course.certification)
      );
    }

    // Apply price filter
    if (filters.priceRange === "free") {
      results = results.filter(course => !course.isPaid || course.price === 0);
    } else if (filters.priceRange === "paid") {
      results = results.filter(course => course.isPaid && course.price > 0);
    }

    // Apply sorting
    switch (filters.sortBy) {
      case "newest":
        results = [...results].sort((a, b) => {
          const dateA = new Date(a.date || "").getTime();
          const dateB = new Date(b.date || "").getTime();
          return dateB - dateA;
        });
        break;
      case "price-low":
        results = [...results].sort((a, b) => a.price - b.price);
        break;
      case "price-high":
        results = [...results].sort((a, b) => b.price - a.price);
        break;
      default:
        // relevance - keep original order
        break;
    }

    return results;
  }, [query, filters.courseTypes, filters.certifications, filters.priceRange, filters.sortBy]);

  // Search for blogs from Strapi
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setBlogResults([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const blogs = await searchBlogs(searchQuery, locale);
      setBlogResults(blogs);
    } catch (error) {
      console.error("Search error:", error);
      setBlogResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [locale]);

  // Perform search on initial load if query exists
  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery, performSearch]);

  // Handle search submission
  const handleSearch = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);
      performSearch(newQuery);

      // Add to recent searches
      if (newQuery.trim()) {
        addSearch(newQuery);
      }

      // Update URL without full page reload
      const url = new URL(window.location.href);
      if (newQuery.trim()) {
        url.searchParams.set("q", newQuery);
      } else {
        url.searchParams.delete("q");
      }
      window.history.pushState({}, "", url);
    },
    [performSearch, addSearch]
  );

  // Handle instant search (for debounced onChange)
  const handleInstantSearch = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);
      performSearch(newQuery);

      // Update URL without full page reload
      const url = new URL(window.location.href);
      if (newQuery.trim()) {
        url.searchParams.set("q", newQuery);
      } else {
        url.searchParams.delete("q");
      }
      window.history.replaceState({}, "", url);
    },
    [performSearch]
  );

  // Handle recent search click
  const handleRecentSearchClick = useCallback(
    (searchQuery: string) => {
      handleSearch(searchQuery);
    },
    [handleSearch]
  );

  // Handle filter change
  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
  }, []);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  // Filter results based on content type filter
  const displayedCourses: Course[] = useMemo(() => {
    if (filters.contentType === "blogs") return [];
    return filteredCourses;
  }, [filters.contentType, filteredCourses]);

  const displayedBlogs: StrapiBlogPost[] = useMemo(() => {
    if (filters.contentType === "courses") return [];
    return blogResults;
  }, [filters.contentType, blogResults]);

  // Popular search suggestions
  const popularSearches = [
    isRTL ? "مكافحة العدوى" : "Infection Control",
    isRTL ? "دعم الحياة" : "Life Support",
    isRTL ? "سلامة المرضى" : "Patient Safety",
    isRTL ? "الصحة العامة" : "Public Health",
  ];

  return (
    <div className="min-h-screen bg-white" dir={isRTL ? "rtl" : "ltr"}>
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-[var(--surface-container-default)] to-white pt-8 pb-12 px-4 lg:px-16">
        <div className="max-w-4xl mx-auto">
          {/* Title */}
          <div className="mb-8">
            <h1 className="text-3xl lg:text-4xl font-bold text-[var(--on-surface-default)] mb-2">
              {t("title")}
            </h1>
            <p className="text-[var(--on-surface-variant)] text-lg">
              {t("subtitle")}
            </p>
          </div>

          {/* Search Bar with instant search */}
          <GlobalSearchBar
            initialQuery={query}
            onSearch={handleSearch}
            onChange={handleInstantSearch}
            autoFocus={!initialQuery}
            variant="hero"
            isLoading={isLoading}
            showInstantSearch={true}
            debounceMs={400}
          />

          {/* Recent Searches (show when no query) */}
          {!query && recentSearches.length > 0 && (
            <div className="mt-6">
              <RecentSearches
                searches={recentSearches}
                onSearchClick={handleRecentSearchClick}
                onRemove={removeSearch}
                onClearAll={clearRecentSearches}
              />
            </div>
          )}

          {/* Popular Searches (show when no query and no recent searches) */}
          {!query && recentSearches.length === 0 && (
            <div className="mt-6">
              <p className="text-sm text-[var(--on-surface-variant)] mb-3">
                {t("popularSearches")}
              </p>
              <div className="flex flex-wrap gap-2">
                {popularSearches.map((term) => (
                  <button
                    key={term}
                    onClick={() => handleSearch(term)}
                    className="px-4 py-2 bg-white border border-[var(--outline-subtle)] rounded-full text-sm text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-default)] hover:border-[var(--surface-container-primary-2)] transition-all duration-200"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results Section with Sidebar */}
      <div className="px-4 lg:px-16 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Mobile Filter Button */}
          {hasSearched && (
            <div className="mb-6 lg:hidden">
              <MobileFilterDrawer
                filters={filters}
                onFilterChange={handleFilterChange}
                coursesCount={filteredCourses.length}
                blogsCount={blogResults.length}
                onClearAll={clearAllFilters}
                activeFiltersCount={activeFiltersCount}
              />
            </div>
          )}

          <div className="flex gap-8">
            {/* Desktop Sidebar Filters */}
            {hasSearched && (
              <aside className="hidden lg:block w-72 flex-shrink-0">
                <div className="sticky top-24">
                  <h2 className="text-lg font-semibold text-[var(--on-surface-default)] mb-4">
                    {isRTL ? "تصفية النتائج" : "Filter Results"}
                  </h2>
                  <AdvancedFilters
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    coursesCount={filteredCourses.length}
                    blogsCount={blogResults.length}
                    onClearAll={clearAllFilters}
                  />
                </div>
              </aside>
            )}

            {/* Results */}
            <main className="flex-1 min-w-0">
              <SearchResults
                courses={displayedCourses}
                blogs={displayedBlogs}
                query={hasSearched ? query : ""}
                isLoading={isLoading}
              />
            </main>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchPageContent;
