"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import BecomeTrainer from "@/components/BecomeTrainer";
import Testimonials from "@/components/Testimonials";
import {
  BlogCard,
  MobileBlogCard,
  FeaturedBlog,
  BlogPagination,
  BlogFilters,
} from "@/components/blogs";
import { fetchAllBlogPosts, fetchFeaturedBlog, fetchBlogCategories } from "@/lib/sanity/actions";
import type { SanityBlogPost, SanityCategory } from "@/lib/sanity/types";
import { getLocalizedValue } from "@/lib/sanity/types";

const BlogsPageContent = () => {
  const t = useTranslations("blogsPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  // State for Sanity data
  const [sanityPosts, setSanityPosts] = useState<SanityBlogPost[]>([]);
  const [sanityCategories, setSanityCategories] = useState<SanityCategory[]>([]);
  const [featuredPost, setFeaturedPost] = useState<SanityBlogPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination state
  const [activeCategory, setActiveCategory] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageMobile, setCurrentPageMobile] = useState(1);

  const postsPerPageDesktop = 6;
  const postsPerPageMobile = 3;

  // Fetch data from Sanity using server actions
  const fetchSanityData = useCallback(async () => {
    try {
      const [posts, featured, categories] = await Promise.all([
        fetchAllBlogPosts(),
        fetchFeaturedBlog(),
        fetchBlogCategories(),
      ]);

      setSanityPosts(posts || []);
      setFeaturedPost(featured);
      setSanityCategories(categories || []);
    } catch (error) {
      console.error("Error fetching from Sanity:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch data on mount
  useEffect(() => {
    fetchSanityData();
  }, [fetchSanityData]);

  // Get category name for filtering
  const getCategoryName = (post: SanityBlogPost): string => {
    if (post.category?.title) {
      return getLocalizedValue(post.category.title, "en") || "Uncategorized";
    }
    return "Uncategorized";
  };

  // Build categories list
  const categories = ["All", ...sanityCategories.map(cat => getLocalizedValue(cat.title, "en") || "")];

  // Get translated category name
  const getTranslatedCategory = (category: string): string => {
    if (category === "All") return isRTL ? "الكل" : "All";

    const sanityCategory = sanityCategories.find(
      cat => getLocalizedValue(cat.title, "en") === category
    );
    if (sanityCategory) {
      return getLocalizedValue(sanityCategory.title, locale) || category;
    }
    return category;
  };

  // Filter posts - include ALL posts in the grid (featured + non-featured)
  // The featured section is separate, but all posts should appear in the main grid
  const allPosts = sanityPosts;

  const filteredPosts = activeCategory === "All"
    ? allPosts
    : allPosts.filter(post => getCategoryName(post) === activeCategory);

  // Featured post for the featured section (most recent featured post)
  const displayFeaturedPost = featuredPost;

  // Desktop pagination
  const totalPages = Math.ceil(filteredPosts.length / postsPerPageDesktop);
  const paginatedPosts = filteredPosts.slice(
    (currentPage - 1) * postsPerPageDesktop,
    currentPage * postsPerPageDesktop
  );

  // Mobile pagination
  const totalPagesMobile = Math.ceil(filteredPosts.length / postsPerPageMobile);
  const paginatedPostsMobile = filteredPosts.slice(
    (currentPageMobile - 1) * postsPerPageMobile,
    currentPageMobile * postsPerPageMobile
  );

  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
    setCurrentPage(1);
    setCurrentPageMobile(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 400, behavior: "smooth" });
  };

  const handlePageChangeMobile = (page: number) => {
    setCurrentPageMobile(page);
    window.scrollTo({ top: 200, behavior: "smooth" });
  };

  // Show loading state
  if (isLoading) {
    return (
      <div dir={isRTL ? "rtl" : "ltr"} className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg text-[var(--on-surface-variant)]">
          {isRTL ? "جارٍ التحميل..." : "Loading..."}
        </div>
      </div>
    );
  }

  // Empty state when no blogs exist
  const hasNoPosts = sanityPosts.length === 0;

  return (
    <div dir={isRTL ? "rtl" : "ltr"}>
      {/* Desktop Layout */}
      <div className="hidden lg:block">
        {/* Featured Blogs Section */}
        <section className="px-16 pt-8 pb-12">
          <div className="max-w-[1200px] mx-auto">
            <h1 className={`font-semibold text-[var(--on-surface-default)] mb-2 ${isRTL ? "text-right" : "text-left"}`} style={{ fontSize: "48px" }}>
              {t("featuredBlogs.title")}
            </h1>
            <p className={`text-[var(--on-surface-variant)] mb-8 ${isRTL ? "text-right" : "text-left"}`} style={{ fontSize: "20px" }}>
              {t("featuredBlogs.subtitle")}
            </p>
            {displayFeaturedPost ? (
              <FeaturedBlog post={displayFeaturedPost} isRTL={isRTL} />
            ) : (
              <div className="text-center py-12 text-[var(--on-surface-variant)] bg-[#F4F4F5] rounded-2xl">
                {isRTL ? "لا توجد مدونات مميزة حالياً" : "No featured blog available"}
              </div>
            )}
          </div>
        </section>

        {/* Blogs Section */}
        <section className="px-16 py-12 bg-white">
          <div className="max-w-[1200px] mx-auto">
            <h2 className={`font-semibold text-[var(--on-surface-default)] mb-2 ${isRTL ? "text-right" : "text-left"}`} style={{ fontSize: "48px" }}>
              {t("blogs.title")}
            </h2>
            <p className={`text-[var(--on-surface-variant)] mb-8 ${isRTL ? "text-right" : "text-left"}`} style={{ fontSize: "20px" }}>
              {t("blogs.subtitle")}
            </p>

            {!hasNoPosts && (
              <BlogFilters
                categories={categories}
                activeCategory={activeCategory}
                onCategoryChange={handleCategoryChange}
                isRTL={isRTL}
                translatedCategories={categories.map(c => getTranslatedCategory(c))}
              />
            )}

            {paginatedPosts.length === 0 ? (
              <div className="text-center py-16 text-[var(--on-surface-variant)]">
                <p className="text-xl mb-2">
                  {isRTL ? "لا توجد مدونات حالياً" : "No blogs available yet"}
                </p>
                <p className="text-sm">
                  {isRTL ? "ترقبوا المحتوى القادم قريباً" : "Check back soon for new content"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-8">
                {paginatedPosts.map((post) => (
                  <BlogCard key={post._id} post={post} isRTL={isRTL} />
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <BlogPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                isRTL={isRTL}
              />
            )}
          </div>
        </section>

        <BecomeTrainer />
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden pb-24">
        {/* Featured Blogs Section */}
        <section className="px-4 pt-6 pb-8">
          <h1 className={`font-semibold text-[var(--on-surface-default)] mb-1 ${isRTL ? "text-right" : "text-left"}`} style={{ fontSize: "24px" }}>
            {t("featuredBlogs.title")}
          </h1>
          <p className={`text-[var(--on-surface-variant)] text-sm mb-6 ${isRTL ? "text-right" : "text-left"}`}>
            {t("featuredBlogs.subtitle")}
          </p>
          {displayFeaturedPost ? (
            <FeaturedBlog post={displayFeaturedPost} isRTL={isRTL} />
          ) : (
            <div className="text-center py-8 text-[var(--on-surface-variant)] bg-[#F4F4F5] rounded-xl text-sm">
              {isRTL ? "لا توجد مدونات مميزة حالياً" : "No featured blog available"}
            </div>
          )}
        </section>

        {/* Blogs Section */}
        <section className="px-4 py-6 bg-white">
          <h2 className={`font-semibold text-[var(--on-surface-default)] mb-1 ${isRTL ? "text-right" : "text-left"}`} style={{ fontSize: "24px" }}>
            {t("blogs.title")}
          </h2>
          <p className={`text-[var(--on-surface-variant)] text-sm mb-4 ${isRTL ? "text-right" : "text-left"}`}>
            {t("blogs.subtitle")}
          </p>

          {!hasNoPosts && (
            <BlogFilters
              categories={categories}
              activeCategory={activeCategory}
              onCategoryChange={handleCategoryChange}
              variant="mobile"
              isRTL={isRTL}
              translatedCategories={categories.map(c => getTranslatedCategory(c))}
            />
          )}

          {paginatedPostsMobile.length === 0 ? (
            <div className="text-center py-12 text-[var(--on-surface-variant)]">
              <p className="mb-1">
                {isRTL ? "لا توجد مدونات حالياً" : "No blogs available yet"}
              </p>
              <p className="text-xs">
                {isRTL ? "ترقبوا المحتوى القادم قريباً" : "Check back soon for new content"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {paginatedPostsMobile.map((post) => (
                <MobileBlogCard key={post._id} post={post} isRTL={isRTL} />
              ))}
            </div>
          )}

          {totalPagesMobile > 1 && (
            <BlogPagination
              currentPage={currentPageMobile}
              totalPages={totalPagesMobile}
              onPageChange={handlePageChangeMobile}
              variant="mobile"
              isRTL={isRTL}
            />
          )}
        </section>

        <BecomeTrainer />
        <Testimonials />
      </div>
    </div>
  );
};

export default BlogsPageContent;
