"use client";

import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import { Clock, ArrowRight, ArrowLeft, Search, BookOpen, GraduationCap } from "lucide-react";
import type { StrapiBlogPost } from "@/lib/strapi/types";
import type { PublicCourse } from "@/types/instructor-dashboard";
import { getStrapiMediaUrl } from "@/lib/strapi/client";
import HighlightText from "./HighlightText";
import CourseCard from "@/components/courses/CourseCard";

interface SearchResultsProps {
  courses: PublicCourse[];
  blogs: StrapiBlogPost[];
  query: string;
  isLoading?: boolean;
  isRTL?: boolean;
  noResultsTitle?: string;
}

const SearchResults = ({
  courses,
  blogs,
  query,
  isLoading = false,
  isRTL: isRTLProp,
  noResultsTitle,
}: SearchResultsProps) => {
  const t = useTranslations("searchPage");
  const locale = useLocale();
  const isRTL = isRTLProp ?? locale === "ar";
  const noResultsLabel = noResultsTitle?.trim() || t("results.noResults");

  const totalResults = courses.length + blogs.length;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-[var(--color-text-secondary)]">
          {t("searching")}
        </p>
      </div>
    );
  }

  if (!query) {
    return null;
  }

  if (totalResults === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-[var(--color-surface-card)] to-[var(--color-border-subtle)] rounded-full flex items-center justify-center mb-6">
          <Search className="w-10 h-10 text-[var(--color-icon)]" />
        </div>
        <h3 className="text-xl font-semibold text-[var(--color-text-primary)]">
          {noResultsLabel}
        </h3>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Results Summary */}
      <div>
        <p className="text-[var(--color-text-secondary)]">
          {t("results.showing")}{" "}
          <span className="font-semibold text-[var(--color-text-primary)]">
            {totalResults}
          </span>{" "}
          {t("results.resultsFor")}{" "}
          <span className="font-semibold text-[var(--color-text-primary)]">
            &quot;{query}&quot;
          </span>
        </p>
      </div>

      {/* Courses Results */}
      {courses.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-[var(--color-primary)]" />
            {t("results.courses")} ({courses.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} isRTL={isRTL} />
            ))}
          </div>
        </div>
      )}

      {/* Blogs Results */}
      {blogs.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[var(--color-primary)]" />
            {t("results.blogs")} ({blogs.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {blogs.map((blog) => (
              <BlogResultCard key={blog.documentId} blog={blog} isRTL={isRTL} searchQuery={query} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Blog Result Card Component
interface BlogResultCardProps {
  blog: StrapiBlogPost;
  isRTL: boolean;
  searchQuery: string;
}

const BlogResultCard = ({ blog, isRTL, searchQuery }: BlogResultCardProps) => {
  const t = useTranslations("searchPage");
  const locale = useLocale();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  const title = blog.title || "";
  const excerpt = blog.excerpt || "";
  const readTime = blog.readTimeMinutes
    ? (locale === "ar" ? `${blog.readTimeMinutes} دقائق قراءة` : `${blog.readTimeMinutes} min read`)
    : "";

  const imageUrl = blog.mainImage?.url
    ? getStrapiMediaUrl(blog.mainImage.formats?.small?.url || blog.mainImage.url)
    : "/blogs/blog-1.png";

  return (
    <Link href={`/${locale}/blogs/${blog.slug}`} className="group block">
      <div className="flex flex-col gap-4 p-4 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl hover:shadow-lg hover:border-[var(--color-primary)]/30 transition-all duration-300">
        {/* Image */}
        <div className="relative h-[140px] overflow-hidden rounded-xl">
          <span className={`absolute top-3 ${isRTL ? "right-3" : "left-3"} z-10 bg-[var(--color-primary)] text-white text-xs px-2.5 py-1 rounded-full font-medium`}>
            {t("results.blog")}
          </span>
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover object-top group-hover:scale-105 transition-transform duration-300"
          />
        </div>

        {/* Title */}
        <HighlightText
          text={title}
          highlight={searchQuery}
          className="font-semibold text-[var(--color-text-primary)] line-clamp-2"
        />

        {/* Excerpt */}
        <HighlightText
          text={excerpt}
          highlight={searchQuery}
          className="text-[var(--color-text-secondary)] text-sm line-clamp-2"
        />

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-1 text-[var(--color-text-secondary)]">
            <Clock className="w-4 h-4" />
            <span className="text-sm">{readTime}</span>
          </div>
          <span className="flex items-center gap-1 text-[var(--color-primary)] text-sm font-medium group-hover:gap-2 transition-all">
            {t("readMore")}
            <ArrowIcon className="w-4 h-4" strokeWidth={2} />
          </span>
        </div>
      </div>
    </Link>
  );
};

export default SearchResults;
