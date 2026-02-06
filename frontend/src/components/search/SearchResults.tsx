"use client";

import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import { Clock, Calendar, Video, ArrowRight, ArrowLeft, Search, BookOpen, GraduationCap } from "lucide-react";
import { Course } from "@/data/courses";
import type { StrapiBlogPost } from "@/lib/strapi/types";
import { getStrapiMediaUrl } from "@/lib/strapi/client";
import HighlightText from "./HighlightText";

interface SearchResultsProps {
  courses: Course[];
  blogs: StrapiBlogPost[];
  query: string;
  isLoading?: boolean;
}

const SearchResults = ({
  courses,
  blogs,
  query,
  isLoading = false,
}: SearchResultsProps) => {
  const t = useTranslations("searchPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const totalResults = courses.length + blogs.length;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-12 h-12 border-4 border-[var(--surface-container-primary-2)] border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-[var(--on-surface-variant)]">
          {isRTL ? "جاري البحث..." : "Searching..."}
        </p>
      </div>
    );
  }

  if (!query) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-[var(--surface-container-default)] to-[var(--surface-container-low)] rounded-full flex items-center justify-center mb-6">
          <Search className="w-10 h-10 text-[var(--on-surface-variant)]" />
        </div>
        <h3 className="text-xl font-semibold text-[var(--on-surface-default)] mb-2">
          {isRTL ? "ابدأ البحث" : "Start Your Search"}
        </h3>
        <p className="text-[var(--on-surface-variant)] max-w-md mb-6">
          {t("subtitle")}
        </p>
        <div className="flex items-center gap-6 text-sm text-[var(--on-surface-variant)]">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            <span>{isRTL ? "الدورات" : "Courses"}</span>
          </div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            <span>{isRTL ? "المدونات" : "Blogs"}</span>
          </div>
        </div>
      </div>
    );
  }

  if (totalResults === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-[var(--surface-container-default)] to-[var(--surface-container-low)] rounded-full flex items-center justify-center mb-6">
          <Search className="w-10 h-10 text-[var(--on-surface-variant)]" />
        </div>
        <h3 className="text-xl font-semibold text-[var(--on-surface-default)] mb-2">
          {t("results.noResults")}
        </h3>
        <p className="text-[var(--on-surface-variant)] max-w-md mb-6">
          {t("results.noResultsDescription")}
        </p>
        <div className="text-sm text-[var(--on-surface-variant)]" dir={isRTL ? "rtl" : "ltr"}>
          <p className="font-medium mb-2">{isRTL ? "نصائح:" : "Tips:"}</p>
          <ul className={`space-y-1 ${isRTL ? "me-4" : "ms-4"} list-disc`}>
            <li>{isRTL ? "تحقق من الإملاء" : "Check your spelling"}</li>
            <li>{isRTL ? "جرب كلمات مفتاحية مختلفة" : "Try different keywords"}</li>
            <li>{isRTL ? "استخدم مصطلحات أكثر عمومية" : "Use more general terms"}</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Results Summary */}
      <div>
        <p className="text-[var(--on-surface-variant)]">
          {t("results.showing")}{" "}
          <span className="font-semibold text-[var(--on-surface-default)]">
            {totalResults}
          </span>{" "}
          {t("results.resultsFor")}{" "}
          <span className="font-semibold text-[var(--on-surface-default)]">
            &quot;{query}&quot;
          </span>
        </p>
      </div>

      {/* Courses Results */}
      {courses.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-[var(--on-surface-default)] flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-[var(--surface-container-primary-2)]" />
            {t("results.courses")} ({courses.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <CourseResultCard key={course.id} course={course} isRTL={isRTL} searchQuery={query} />
            ))}
          </div>
        </div>
      )}

      {/* Blogs Results */}
      {blogs.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-[var(--on-surface-default)] flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[var(--blue-blue-600)]" />
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

// Course Result Card Component
interface CourseResultCardProps {
  course: Course;
  isRTL: boolean;
  searchQuery: string;
}

const CourseResultCard = ({ course, isRTL, searchQuery }: CourseResultCardProps) => {
  const t = useTranslations("searchPage");
  const locale = useLocale();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <Link href={`/${locale}/courses/${course.slug}`} className="group block">
      <div className="flex flex-col gap-4 p-4 bg-white border border-[var(--outline-subtle)] rounded-2xl hover:shadow-lg hover:border-[var(--surface-container-primary-2)]/30 transition-all duration-300">
        {/* Card Header */}
        <div className="relative bg-[#eef3f7] rounded-xl p-4 h-[140px] flex flex-col justify-between overflow-hidden">
          <span className={`absolute top-3 ${isRTL ? "right-3" : "left-3"} bg-[var(--surface-container-primary-2)] text-white text-xs px-2.5 py-1 rounded-full font-medium`}>
            {t("results.course")}
          </span>
          <div className={`pt-8 ${isRTL ? "pe-16" : "pe-16"}`}>
            <HighlightText
              text={course.title}
              highlight={searchQuery}
              className="text-[#06080b] font-semibold leading-snug text-base line-clamp-2"
            />
          </div>
          <div
            className={`absolute ${
              isRTL ? "left-0" : "right-0"
            } top-1/2 -translate-y-1/2 w-[100px] h-[150px] opacity-40`}
          >
            <Image
              src={course.vectorImage}
              alt=""
              fill
              className={`object-contain ${isRTL ? "-scale-x-100" : ""}`}
            />
          </div>
          <div className="flex items-center gap-2 bg-[#0b0f17] rounded-full px-3 py-1 w-fit">
            <Video className="w-3 h-3 text-white" strokeWidth={1.5} />
            <span className="text-white text-xs">{course.type}</span>
          </div>
        </div>

        {/* Meta Info */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 text-[var(--on-surface-variant)] bg-[var(--surface-container-default)] px-2 py-1 rounded-lg">
            <Calendar className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span className="text-xs">{course.date}</span>
          </div>
          <div className="flex items-center gap-1 text-[var(--on-surface-variant)] bg-[var(--surface-container-default)] px-2 py-1 rounded-lg">
            <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span className="text-xs">{course.hours}</span>
          </div>
          {course.certification !== "None" && (
            <span className="text-xs px-2 py-1 bg-[var(--blue-blue-600)]/10 text-[var(--blue-blue-600)] rounded-lg font-medium">
              {course.certification}
            </span>
          )}
        </div>

        {/* Description */}
        <HighlightText
          text={course.description}
          highlight={searchQuery}
          className="text-[var(--on-surface-variant)] text-sm line-clamp-2"
        />

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--outline-subtle)]">
          <div className="flex items-center gap-1">
            {course.price > 0 && <Image src="/icons/rayal-icon.svg" alt="SAR" width={14} height={15} />}
            <span className="text-[#06080b] font-bold text-lg">{course.price > 0 ? course.price : (isRTL ? "مجاني" : "Free")}</span>
          </div>
          <span className="flex items-center gap-1 text-[var(--surface-container-primary-2)] text-sm font-medium group-hover:gap-2 transition-all">
            {t("viewDetails")}
            <ArrowIcon className="w-4 h-4" strokeWidth={2} />
          </span>
        </div>
      </div>
    </Link>
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
      <div className="flex flex-col gap-4 p-4 bg-white border border-[var(--outline-subtle)] rounded-2xl hover:shadow-lg hover:border-[var(--blue-blue-600)]/30 transition-all duration-300">
        {/* Image */}
        <div className="relative h-[140px] overflow-hidden rounded-xl">
          <span className={`absolute top-3 ${isRTL ? "right-3" : "left-3"} z-10 bg-[var(--blue-blue-600)] text-white text-xs px-2.5 py-1 rounded-full font-medium`}>
            {t("results.blog")}
          </span>
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>

        {/* Title */}
        <HighlightText
          text={title}
          highlight={searchQuery}
          className="font-semibold text-[var(--on-surface-default)] line-clamp-2"
        />

        {/* Excerpt */}
        <HighlightText
          text={excerpt}
          highlight={searchQuery}
          className="text-[var(--on-surface-variant)] text-sm line-clamp-2"
        />

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--outline-subtle)]">
          <div className="flex items-center gap-1 text-[var(--on-surface-variant)]">
            <Clock className="w-4 h-4" />
            <span className="text-sm">{readTime}</span>
          </div>
          <span className="flex items-center gap-1 text-[var(--blue-blue-600)] text-sm font-medium group-hover:gap-2 transition-all">
            {t("readMore")}
            <ArrowIcon className="w-4 h-4" strokeWidth={2} />
          </span>
        </div>
      </div>
    </Link>
  );
};

export default SearchResults;
