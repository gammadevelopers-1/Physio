"use client";

import { useState } from "react";
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
    <>
      {/* Desktop Layout */}
      <div className="hidden lg:block">
        {/* Featured Blogs Section */}
        <section className="px-16 pt-8 pb-12">
          <div className="max-w-[1200px] mx-auto">
            <h1 className="font-semibold text-[var(--on-surface-default)] mb-2" style={{ fontSize: "48px" }}>
              Featured Blogs
            </h1>
            <p className="text-[var(--on-surface-variant)] mb-8" style={{ fontSize: "20px" }}>
              Insights, Updates, and Best Practices in Healthcare Education
            </p>
            {featuredPost && <FeaturedBlog post={featuredPost} />}
          </div>
        </section>

        {/* Blogs Section */}
        <section className="px-16 py-12 bg-white">
          <div className="max-w-[1200px] mx-auto">
            <h2 className="font-semibold text-[var(--on-surface-default)] mb-2" style={{ fontSize: "48px" }}>
              Blogs
            </h2>
            <p className="text-[var(--on-surface-variant)] mb-8" style={{ fontSize: "20px" }}>
              Insights, Updates, and Best Practices in Healthcare Education
            </p>

            <BlogFilters
              categories={blogCategories}
              activeCategory={activeCategory}
              onCategoryChange={handleCategoryChange}
            />

            <div className="grid grid-cols-3 gap-8">
              {paginatedPosts.map((post) => (
                <BlogCard key={post.id} post={post} />
              ))}
            </div>

            <BlogPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        </section>

        <BecomeTrainer />
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden pb-24">
        {/* Featured Blogs Section */}
        <section className="px-4 pt-6 pb-8">
          <h1 className="font-semibold text-[var(--on-surface-default)] mb-1" style={{ fontSize: "24px" }}>
            Featured Blogs
          </h1>
          <p className="text-[var(--on-surface-variant)] text-sm mb-6">
            Insights, Updates, and Best Practices in Healthcare Education
          </p>
          {featuredPost && <FeaturedBlog post={featuredPost} />}
        </section>

        {/* Blogs Section */}
        <section className="px-4 py-6 bg-white">
          <h2 className="font-semibold text-[var(--on-surface-default)] mb-1" style={{ fontSize: "24px" }}>
            Blogs
          </h2>
          <p className="text-[var(--on-surface-variant)] text-sm mb-4">
            Insights, Updates, and Best Practices in Healthcare Education
          </p>

          <BlogFilters
            categories={blogCategories}
            activeCategory={activeCategory}
            onCategoryChange={handleCategoryChange}
            variant="mobile"
          />

          <div className="flex flex-col gap-6">
            {paginatedPostsMobile.map((post) => (
              <MobileBlogCard key={post.id} post={post} />
            ))}
          </div>

          <BlogPagination
            currentPage={currentPageMobile}
            totalPages={totalPagesMobile}
            onPageChange={handlePageChangeMobile}
            variant="mobile"
          />
        </section>

        <BecomeTrainer />
        <Testimonials />
      </div>
    </>
  );
};

export default BlogsPageContent;
