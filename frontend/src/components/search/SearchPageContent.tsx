"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import GlobalSearchBar from "./GlobalSearchBar";
import SearchResults from "./SearchResults";
import RecentSearches from "./RecentSearches";
import { useRecentSearches } from "./useRecentSearches";
import { searchBlogs } from "@/lib/strapi/api";
import type { StrapiBlogPost, SearchPage } from "@/lib/strapi/types";
import type { PublicCourse } from "@/types/instructor-dashboard";

interface SearchPageContentProps {
  strapiData?: SearchPage | null;
}

const SearchPageContent = ({ strapiData }: SearchPageContentProps = {}) => {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const t = useTranslations("searchPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  // Strapi-controlled text with translation fallbacks
  const heroTitle = strapiData?.heroTitle?.trim() || t("title");
  const heroSubtitle = strapiData?.heroSubtitle?.trim() || t("subtitle");
  const popularLabel = strapiData?.popularSearchesLabel?.trim() || t("popularSearches");
  const placeholderText = strapiData?.searchPlaceholder?.trim() || t("placeholder");
  const placeholderMobileText = strapiData?.searchPlaceholderMobile?.trim() || t("placeholderMobile");
  const noResultsTitle = strapiData?.noResultsTitle?.trim() || undefined;

  const [query, setQuery] = useState(initialQuery);
  const [isLoading, setIsLoading] = useState(false);
  const [courseResults, setCourseResults] = useState<PublicCourse[]>([]);
  const [blogResults, setBlogResults] = useState<StrapiBlogPost[]>([]);
  const [hasSearched, setHasSearched] = useState(!!initialQuery);

  const { recentSearches, addSearch, removeSearch, clearAll: clearRecentSearches } = useRecentSearches();

  // In-flight token guard so a stale slow response can't overwrite a fresher one
  const inflightToken = useRef(0);

  const performSearch = useCallback(
    async (searchQuery: string) => {
      const token = ++inflightToken.current;
      const trimmed = searchQuery.trim();

      if (!trimmed) {
        setCourseResults([]);
        setBlogResults([]);
        setHasSearched(false);
        return;
      }

      setIsLoading(true);
      setHasSearched(true);

      try {
        const params = new URLSearchParams({ search: trimmed, limit: "100", sort: "newest" });

        const [coursesRes, blogs] = await Promise.all([
          fetch(`/api/public-courses?${params.toString()}`).then((r) => (r.ok ? r.json() : { data: [] })),
          searchBlogs(trimmed, locale).catch(() => []),
        ]);

        if (token !== inflightToken.current) return; // stale — drop

        setCourseResults(Array.isArray(coursesRes?.data) ? coursesRes.data : []);
        setBlogResults(Array.isArray(blogs) ? blogs : []);
      } catch (error) {
        console.error("Search error:", error);
        if (token === inflightToken.current) {
          setCourseResults([]);
          setBlogResults([]);
        }
      } finally {
        if (token === inflightToken.current) setIsLoading(false);
      }
    },
    [locale],
  );

  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery);
    }
  }, [initialQuery, performSearch]);

  const handleSearch = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);
      performSearch(newQuery);

      if (newQuery.trim()) {
        addSearch(newQuery);
      }

      const url = new URL(window.location.href);
      if (newQuery.trim()) {
        url.searchParams.set("q", newQuery);
      } else {
        url.searchParams.delete("q");
      }
      window.history.pushState({}, "", url);
    },
    [performSearch, addSearch],
  );

  const handleInstantSearch = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);
      performSearch(newQuery);

      const url = new URL(window.location.href);
      if (newQuery.trim()) {
        url.searchParams.set("q", newQuery);
      } else {
        url.searchParams.delete("q");
      }
      window.history.replaceState({}, "", url);
    },
    [performSearch],
  );

  const handleRecentSearchClick = useCallback(
    (searchQuery: string) => {
      handleSearch(searchQuery);
    },
    [handleSearch],
  );

  // Popular search suggestions — Strapi terms with translation fallback
  const popularSearches = (strapiData?.popularSearchTerms?.length
    ? strapiData.popularSearchTerms.map((it) => it.term).filter(Boolean)
    : [
        t("popularItem1"),
        t("popularItem2"),
        t("popularItem3"),
        t("popularItem4"),
      ]
  ).filter(Boolean);

  return (
    <div className="min-h-screen bg-[var(--color-surface-page)]" dir={isRTL ? "rtl" : "ltr"}>
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-[var(--color-surface-card)] to-[var(--color-surface-page)] pt-8 pb-12 px-4 lg:px-16">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl lg:text-4xl font-bold text-[var(--color-text-primary)] mb-2">
              {heroTitle}
            </h1>
            <p className="text-[var(--color-text-secondary)] text-lg">
              {heroSubtitle}
            </p>
          </div>

          <GlobalSearchBar
            initialQuery={query}
            onSearch={handleSearch}
            onChange={handleInstantSearch}
            autoFocus={!initialQuery}
            variant="hero"
            isLoading={isLoading}
            showInstantSearch={true}
            debounceMs={400}
            placeholder={placeholderText}
            placeholderMobile={placeholderMobileText}
          />

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

          {!query && recentSearches.length === 0 && (
            <div className="mt-6">
              <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                {popularLabel}
              </p>
              <div className="flex flex-wrap gap-2">
                {popularSearches.map((term) => (
                  <button
                    key={term}
                    onClick={() => handleSearch(term)}
                    className="px-4 py-2 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-full text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all duration-200"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results Section — full width, no sidebar */}
      {hasSearched && (
        <div className="px-4 lg:px-16 py-8">
          <div className="max-w-7xl mx-auto">
            <SearchResults
              courses={courseResults}
              blogs={blogResults}
              query={query}
              isLoading={isLoading}
              isRTL={isRTL}
              noResultsTitle={noResultsTitle}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchPageContent;
