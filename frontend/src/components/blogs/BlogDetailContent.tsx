"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { PortableText, PortableTextComponents } from "@portabletext/react";
import { BlogCard, MobileBlogCard } from "@/components/blogs";
import { urlFor } from "@/lib/sanity";
import { fetchBlogBySlug, fetchLatestBlogs } from "@/lib/sanity/actions";
import type { SanityBlogPostDetail, SanityBlogPost } from "@/lib/sanity/types";
import { getLocalizedValue, formatReadTime, formatPublishDate } from "@/lib/sanity/types";

const BlogDetailContent = () => {
  const params = useParams();
  const slug = params.slug as string;
  const t = useTranslations("blogsPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  // State for Sanity data
  const [sanityPost, setSanityPost] = useState<SanityBlogPostDetail | null>(null);
  const [latestPosts, setLatestPosts] = useState<SanityBlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch data from Sanity using server actions
  const fetchSanityData = useCallback(async () => {
    try {
      const [post, latest] = await Promise.all([
        fetchBlogBySlug(slug),
        fetchLatestBlogs(),
      ]);

      setSanityPost(post);
      setLatestPosts(latest || []);
    } catch (error) {
      console.error("Error fetching from Sanity:", error);
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  // Fetch data on mount
  useEffect(() => {
    fetchSanityData();
  }, [fetchSanityData]);

  // Back icon based on RTL
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  // Get values from Sanity post
  const getTitle = (): string => {
    if (sanityPost) {
      return getLocalizedValue(sanityPost.title, locale) || "";
    }
    return "";
  };

  const getReadTime = (): string => {
    if (sanityPost) {
      return formatReadTime(sanityPost.readTimeMinutes, locale);
    }
    return "";
  };

  const getDate = (): string => {
    if (sanityPost) {
      return formatPublishDate(sanityPost.publishedAt, locale);
    }
    return "";
  };

  const getAuthor = (): string => {
    if (sanityPost?.author) {
      return getLocalizedValue(sanityPost.author.name, locale) || "";
    }
    return "";
  };

  const getImageUrl = (): string => {
    if (sanityPost?.mainImage) {
      return urlFor(sanityPost.mainImage).width(1200).height(640).url();
    }
    return "/blogs/blog-hero.png";
  };

  // Portable Text components for rendering Sanity content
  const portableTextComponents: PortableTextComponents = {
    block: {
      h1: ({ children }) => (
        <h1 className="font-semibold text-[var(--on-surface-default)] mt-10 mb-4" style={{ fontSize: "28px" }}>
          {children}
        </h1>
      ),
      h2: ({ children }) => (
        <h2 className="font-semibold text-[var(--on-surface-default)] mt-10 mb-4" style={{ fontSize: "24px" }}>
          {children}
        </h2>
      ),
      h3: ({ children }) => (
        <h3 className="font-semibold text-[var(--on-surface-default)] mt-8 mb-3" style={{ fontSize: "20px" }}>
          {children}
        </h3>
      ),
      normal: ({ children }) => (
        <p className="text-[var(--on-surface-default)] mb-6" style={{ fontSize: "16px", lineHeight: "1.8" }}>
          {children}
        </p>
      ),
      blockquote: ({ children }) => (
        <blockquote className={`border-[#002D87] py-4 my-8 bg-[#F8FAFC] ${isRTL ? "border-r-4 pr-6 rounded-l-xl" : "border-l-4 pl-6 rounded-r-xl"}`}>
          <p className="text-[var(--on-surface-default)] italic" style={{ fontSize: "16px", lineHeight: "1.8" }}>
            {children}
          </p>
        </blockquote>
      ),
    },
    types: {
      image: ({ value }) => (
        <div className="relative w-full h-[350px] rounded-xl overflow-hidden my-8">
          <Image
            src={urlFor(value).width(800).height(350).url()}
            alt={value.alt || "Blog image"}
            fill
            className="object-cover"
          />
        </div>
      ),
    },
    marks: {
      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
      em: ({ children }) => <em className="italic">{children}</em>,
      link: ({ children, value }) => (
        <a href={value.href} className="text-[#002D87] underline hover:no-underline" target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      ),
    },
    list: {
      bullet: ({ children }) => <ul className="list-disc list-inside mb-6 space-y-2">{children}</ul>,
      number: ({ children }) => <ol className="list-decimal list-inside mb-6 space-y-2">{children}</ol>,
    },
    listItem: {
      bullet: ({ children }) => <li className="text-[var(--on-surface-default)]">{children}</li>,
      number: ({ children }) => <li className="text-[var(--on-surface-default)]">{children}</li>,
    },
  };

  // Render Sanity content
  const renderSanityContent = () => {
    if (!sanityPost?.content) return null;
    const content = getLocalizedValue(sanityPost.content, locale);
    if (!content) return null;
    return <PortableText value={content} components={portableTextComponents} />;
  };

  // Get latest blog posts for related section (excluding current post)
  const getLatestBlogs = () => {
    return latestPosts.filter(p => p.slug.current !== slug).slice(0, 3);
  };

  // Loading state
  if (isLoading) {
    return (
      <div dir={isRTL ? "rtl" : "ltr"} className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg text-[var(--on-surface-variant)]">
          {isRTL ? "جارٍ التحميل..." : "Loading..."}
        </div>
      </div>
    );
  }

  // Not found state
  if (!sanityPost) {
    return (
      <div dir={isRTL ? "rtl" : "ltr"} className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-lg text-[var(--on-surface-variant)]">
          {isRTL ? "المقال غير موجود" : "Blog not found"}
        </div>
        <Link
          href={`/${locale}/blogs`}
          className="text-[#002D87] underline hover:no-underline"
        >
          {isRTL ? "العودة إلى المدونات" : "Back to blogs"}
        </Link>
      </div>
    );
  }

  const title = getTitle();
  const latestBlogs = getLatestBlogs();

  return (
    <div dir={isRTL ? "rtl" : "ltr"}>
      {/* Desktop Layout */}
      <div className="hidden lg:block">
        {/* Hero Section */}
        <section className="px-16 py-12">
          <div className="max-w-[1200px] mx-auto">
            <div className={`flex gap-12 ${isRTL ? "flex-row-reverse" : ""}`}>
              {/* Left - Text Content */}
              <div className={`w-1/2 flex flex-col justify-between ${isRTL ? "text-right" : ""}`}>
                <div className={`flex flex-col ${isRTL ? "items-end" : "items-start"}`}>
                  {/* Back Link */}
                  <Link
                    href={`/${locale}/blogs`}
                    className={`inline-flex items-center gap-2 text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] mb-8 transition-colors ${isRTL ? "flex-row-reverse" : ""}`}
                  >
                    <BackIcon className="w-4 h-4" />
                    <span className="text-sm">{t("blogDetail.allPost")}</span>
                  </Link>

                  {/* Read Time Pill */}
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[var(--on-surface-default)] bg-[#F4F4F5] rounded-md mb-4 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <Clock className="w-4 h-4" />
                    {getReadTime()}
                  </div>

                  {/* Title */}
                  <h1 className="font-semibold text-[var(--on-surface-default)]" style={{ fontSize: "32px", lineHeight: "1.2" }}>
                    {title}
                  </h1>
                </div>

                {/* Publish Date - at bottom */}
                <p className={`text-[var(--on-surface-variant)] ${isRTL ? "text-right" : ""}`} style={{ fontSize: "14px" }}>
                  {getDate()}
                </p>
              </div>

              {/* Right - Image */}
              <div className="w-1/2">
                <div className="relative h-[320px] rounded-2xl overflow-hidden">
                  <Image src={getImageUrl()} alt={title} fill className="object-cover" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Divider - Full Width */}
        <div className="mx-16 h-px bg-[#E5E7EB]" />

        {/* Content Section */}
        <article className={`max-w-[800px] mx-auto px-8 py-12 ${isRTL ? "text-right" : ""}`}>
          <div className="prose max-w-none">
            {renderSanityContent()}
          </div>

          {/* Published By */}
          {getAuthor() && (
            <div className="mt-10 pt-8 border-t border-[#E5E7EB]">
              <p className="text-sm text-[var(--on-surface-variant)]">
                {t("blogDetail.publishedBy")} <span className="font-medium text-[var(--on-surface-default)]">{getAuthor()}</span>
              </p>
            </div>
          )}
        </article>

        {/* Latest Blogs Section */}
        {latestBlogs.length > 0 && (
          <section className="px-16 py-16 bg-white">
            <div className="max-w-[1200px] mx-auto">
              <h2 className={`font-semibold text-[var(--on-surface-default)] mb-2 ${isRTL ? "text-right" : ""}`} style={{ fontSize: "48px" }}>
                {t("blogDetail.latestBlogs.title")}
              </h2>
              <p className={`text-[var(--on-surface-variant)] mb-10 ${isRTL ? "text-right" : ""}`} style={{ fontSize: "20px" }}>
                {t("blogDetail.latestBlogs.subtitle")}
              </p>

              <div className="grid grid-cols-3 gap-8">
                {latestBlogs.map((blog) => (
                  <BlogCard key={blog._id} post={blog} isRTL={isRTL} />
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden pb-24">
        {/* Hero Section */}
        <section className={`px-4 py-6 ${isRTL ? "text-right" : ""}`}>
          {/* Back Link */}
          <div className={`flex ${isRTL ? "justify-end" : "justify-start"} mb-6`}>
            <Link href={`/${locale}/blogs`} className={`inline-flex items-center gap-2 text-[var(--on-surface-variant)] ${isRTL ? "flex-row-reverse" : ""}`}>
              <BackIcon className="w-4 h-4" />
              <span className="text-sm">{t("blogDetail.allPost")}</span>
            </Link>
          </div>

          {/* Read Time Pill */}
          <div className={`flex ${isRTL ? "justify-end" : "justify-start"} mb-3`}>
            <div className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[var(--on-surface-default)] bg-[#F4F4F5] rounded ${isRTL ? "flex-row-reverse" : ""}`}>
              <Clock className="w-3 h-3" />
              {getReadTime()}
            </div>
          </div>

          {/* Title */}
          <h1 className="font-semibold text-[var(--on-surface-default)] mb-4" style={{ fontSize: "22px", lineHeight: "1.3" }}>
            {title}
          </h1>

          {/* Image */}
          <div className="relative w-full h-[200px] rounded-xl overflow-hidden mb-4">
            <Image src={getImageUrl()} alt={title} fill className="object-cover" />
          </div>

          {/* Publish Date */}
          <p className="text-[var(--on-surface-variant)] text-xs mb-6">
            {getDate()}
          </p>

          {/* Divider */}
          <div className="w-full h-px bg-[#E5E7EB]" />
        </section>

        {/* Content Section */}
        <article className={`px-4 py-6 ${isRTL ? "text-right" : ""}`}>
          <div className="prose max-w-none text-sm">
            {renderSanityContent()}
          </div>

          {/* Published By */}
          {getAuthor() && (
            <div className="mt-8 pt-6 border-t border-[#E5E7EB]">
              <p className="text-xs text-[var(--on-surface-variant)]">
                {t("blogDetail.publishedBy")} <span className="font-medium text-[var(--on-surface-default)]">{getAuthor()}</span>
              </p>
            </div>
          )}
        </article>

        {/* Latest Blogs Section */}
        {latestBlogs.length > 0 && (
          <section className="px-4 py-8 bg-white">
            <h2 className={`font-semibold text-[var(--on-surface-default)] mb-1 ${isRTL ? "text-right" : ""}`} style={{ fontSize: "24px" }}>
              {t("blogDetail.latestBlogs.title")}
            </h2>
            <p className={`text-[var(--on-surface-variant)] text-sm mb-6 ${isRTL ? "text-right" : ""}`}>
              {t("blogDetail.latestBlogs.subtitle")}
            </p>

            <div className="flex flex-col gap-6">
              {latestBlogs.map((blog) => (
                <MobileBlogCard key={blog._id} post={blog} isRTL={isRTL} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default BlogDetailContent;
