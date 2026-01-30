"use client";

import { useState } from "react";
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
import { blogPosts, blogCategories } from "@/data/blogPosts";

const BlogsPageContent = () => {
  const t = useTranslations("blogsPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [activeCategory, setActiveCategory] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageMobile, setCurrentPageMobile] = useState(1);

  const postsPerPageDesktop = 6;
  const postsPerPageMobile = 3;

  const featuredPost = blogPosts.find((post) => post.featured);
  const filteredPosts = activeCategory === "All"
    ? blogPosts.filter((post) => !post.featured)
    : blogPosts.filter((post) => post.category === activeCategory && !post.featured);

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
            {featuredPost && <FeaturedBlog post={featuredPost} isRTL={isRTL} />}
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

            <BlogFilters
              categories={blogCategories}
              activeCategory={activeCategory}
              onCategoryChange={handleCategoryChange}
              isRTL={isRTL}
            />

            <div className="grid grid-cols-3 gap-8">
              {paginatedPosts.map((post) => (
                <BlogCard key={post.id} post={post} isRTL={isRTL} />
              ))}
            </div>

            <BlogPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              isRTL={isRTL}
            />
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
          {featuredPost && <FeaturedBlog post={featuredPost} isRTL={isRTL} />}
        </section>

        {/* Blogs Section */}
        <section className="px-4 py-6 bg-white">
          <h2 className={`font-semibold text-[var(--on-surface-default)] mb-1 ${isRTL ? "text-right" : "text-left"}`} style={{ fontSize: "24px" }}>
            {t("blogs.title")}
          </h2>
          <p className={`text-[var(--on-surface-variant)] text-sm mb-4 ${isRTL ? "text-right" : "text-left"}`}>
            {t("blogs.subtitle")}
          </p>

          <BlogFilters
            categories={blogCategories}
            activeCategory={activeCategory}
            onCategoryChange={handleCategoryChange}
            variant="mobile"
            isRTL={isRTL}
          />

          <div className="flex flex-col gap-6">
            {paginatedPostsMobile.map((post) => (
              <MobileBlogCard key={post.id} post={post} isRTL={isRTL} />
            ))}
          </div>

          <BlogPagination
            currentPage={currentPageMobile}
            totalPages={totalPagesMobile}
            onPageChange={handlePageChangeMobile}
            variant="mobile"
            isRTL={isRTL}
          />
        </section>

        <BecomeTrainer />
        <Testimonials />
      </div>
    </div>
  );
};

export default BlogsPageContent;
