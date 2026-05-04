"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import {
  BlogCard,
  MobileBlogCard,
  FeaturedBlogCarousel,
  BlogPagination,
  BlogFilters,
} from "@/components/blogs";
import type { StrapiBlogPost, StrapiBlogCategory, BlogsPage } from "@/lib/strapi/types";

interface BlogsPageContentProps {
  blogPosts: StrapiBlogPost[];
  featuredBlogs: StrapiBlogPost[];
  blogCategories: StrapiBlogCategory[];
  blogsPage?: BlogsPage | null;
}

const BlogsPageContent = ({ blogPosts, featuredBlogs, blogCategories, blogsPage }: BlogsPageContentProps) => {
  const locale = useLocale();
  const isRTL = locale === "ar";

  // All section labels come from Strapi only — no translation fallback
  const featuredTitle = blogsPage?.featuredBlogsTitle || "";
  const featuredSubtitle = blogsPage?.featuredBlogsSubtitle || "";
  const blogsTitle = blogsPage?.blogsTitle || "";
  const blogsSubtitle = blogsPage?.blogsSubtitle || "";

  // Pagination state
  const [activeCategory, setActiveCategory] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageMobile, setCurrentPageMobile] = useState(1);

  const postsPerPageDesktop = 6;
  const postsPerPageMobile = 3;

  // Filter posts by category slug
  const filteredPosts = activeCategory === "All"
    ? blogPosts
    : blogPosts.filter(post => post.category?.slug === activeCategory);

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

  const hasNoPosts = blogPosts.length === 0;

  return (
    <div dir={isRTL ? "rtl" : "ltr"}>
      {/* Desktop Layout */}
      <div className="hidden lg:block">
        {/* Featured Blogs Section */}
        <section className="px-16 pt-8 pb-12">
          <div className="max-w-[1200px] mx-auto">
            {featuredTitle && (
              <h1 className={`font-semibold text-[var(--on-surface-default)] mb-2 ${isRTL ? "text-right" : "text-left"}`} style={{ fontSize: "48px" }}>
                {featuredTitle}
              </h1>
            )}
            {featuredSubtitle && (
              <p className={`text-[var(--on-surface-variant)] mb-8 ${isRTL ? "text-right" : "text-left"}`} style={{ fontSize: "20px" }}>
                {featuredSubtitle}
              </p>
            )}
            {featuredBlogs.length > 0 ? (
              <FeaturedBlogCarousel posts={featuredBlogs} isRTL={isRTL} />
            ) : (
              <div className="text-center py-12 text-[var(--on-surface-variant)] bg-[#F4F4F5] rounded-2xl">
                {isRTL ? "لا توجد مدونات مميزة حالياً" : "No featured blog available"}
              </div>
            )}
          </div>
        </section>

        {/* Blogs Section */}
        <section className="px-4 md:px-16 py-12 lg:py-20 bg-[var(--color-surface-page)]">
          <div className="max-w-[1200px] mx-auto">
            {blogsTitle && (
              <h2 className={`font-semibold text-[var(--on-surface-default)] mb-2 ${isRTL ? "text-right" : "text-left"}`} style={{ fontSize: "48px" }}>
                {blogsTitle}
              </h2>
            )}
            {blogsSubtitle && (
              <p className={`text-[var(--on-surface-variant)] mb-8 ${isRTL ? "text-right" : "text-left"}`} style={{ fontSize: "20px" }}>
                {blogsSubtitle}
              </p>
            )}

            {!hasNoPosts && (
              <BlogFilters
                categories={blogCategories}
                activeCategory={activeCategory}
                onCategoryChange={handleCategoryChange}
                isRTL={isRTL}
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
                  <BlogCard key={post.documentId} post={post} isRTL={isRTL} />
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
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden pb-24">
        {/* Featured Blogs Section */}
        <section className="px-4 pt-6 pb-8">
          {featuredTitle && (
            <h1 className={`font-semibold text-[var(--on-surface-default)] mb-1 ${isRTL ? "text-right" : "text-left"}`} style={{ fontSize: "24px" }}>
              {featuredTitle}
            </h1>
          )}
          {featuredSubtitle && (
            <p className={`text-[var(--on-surface-variant)] text-sm mb-6 ${isRTL ? "text-right" : "text-left"}`}>
              {featuredSubtitle}
            </p>
          )}
          {featuredBlogs.length > 0 ? (
            <FeaturedBlogCarousel posts={featuredBlogs} isRTL={isRTL} />
          ) : (
            <div className="text-center py-8 text-[var(--on-surface-variant)] bg-[#F4F4F5] rounded-xl text-sm">
              {isRTL ? "لا توجد مدونات مميزة حالياً" : "No featured blog available"}
            </div>
          )}
        </section>

        {/* Blogs Section */}
        <section className="px-4 py-6 bg-[var(--color-surface-page)]">
          {blogsTitle && (
            <h2 className={`font-semibold text-[var(--on-surface-default)] mb-1 ${isRTL ? "text-right" : "text-left"}`} style={{ fontSize: "24px" }}>
              {blogsTitle}
            </h2>
          )}
          {blogsSubtitle && (
            <p className={`text-[var(--on-surface-variant)] text-sm mb-4 ${isRTL ? "text-right" : "text-left"}`}>
              {blogsSubtitle}
            </p>
          )}

          {!hasNoPosts && (
            <BlogFilters
              categories={blogCategories}
              activeCategory={activeCategory}
              onCategoryChange={handleCategoryChange}
              variant="mobile"
              isRTL={isRTL}
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
                <MobileBlogCard key={post.documentId} post={post} isRTL={isRTL} />
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
      </div>
    </div>
  );
};

export default BlogsPageContent;
