"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { useLocale } from "next-intl";
import ReactMarkdown from "react-markdown";
import { BlogCard, MobileBlogCard } from "@/components/blogs";
import { getStrapiMediaUrl } from "@/lib/strapi/client";
import type { StrapiBlogPost, BlogsPage } from "@/lib/strapi/types";

interface BlogDetailContentProps {
  blogPost: StrapiBlogPost | null;
  latestBlogs: StrapiBlogPost[];
  blogsPage?: BlogsPage | null;
}

const BlogDetailContent = ({ blogPost, latestBlogs, blogsPage }: BlogDetailContentProps) => {
  const locale = useLocale();
  const isRTL = locale === "ar";

  // Section labels come from Strapi only — no translation fallback
  const backToAllPostsLabel = blogsPage?.backToAllPostsLabel || "";
  const publishedByLabel = blogsPage?.publishedByLabel || "";
  const latestBlogsTitle = blogsPage?.latestBlogsTitle || "";
  const latestBlogsSubtitle = blogsPage?.latestBlogsSubtitle || "";

  // Back icon based on RTL
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  // Not found state
  if (!blogPost) {
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

  const title = blogPost.title || "";
  const readTime = blogPost.readTimeMinutes
    ? (locale === "ar" ? `${blogPost.readTimeMinutes} دقائق قراءة` : `${blogPost.readTimeMinutes} min read`)
    : "";
  const author = blogPost.authorName || "";

  const getDate = (): string => {
    if (!blogPost.publishedDate) return "";
    const date = new Date(blogPost.publishedDate);
    const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
    if (locale === "ar") {
      return `نُشر في ${date.toLocaleDateString("ar-SA", options)}`;
    }
    return `Published on ${date.toLocaleDateString("en-US", options)}`;
  };

  // Main image comes strictly from Strapi — no local fallback
  const imageUrl = blogPost.mainImage?.url
    ? getStrapiMediaUrl(blogPost.mainImage.formats?.large?.url || blogPost.mainImage.url)
    : null;
  const hasImage = !!imageUrl;

  // Filter out current post from latest blogs
  const relatedBlogs = latestBlogs.filter(p => p.slug !== blogPost.slug).slice(0, 3);

  return (
    <div dir={isRTL ? "rtl" : "ltr"}>
      {/* Desktop Layout */}
      <div className="hidden lg:block">
        {/* Hero Section */}
        <section className="px-16 py-12">
          <div className="max-w-[1200px] mx-auto">
            <div className={`flex gap-12 ${isRTL ? "flex-row-reverse" : ""}`}>
              {/* Left - Text Content */}
              <div className={`${hasImage ? "w-1/2" : "w-full max-w-[800px]"} flex flex-col justify-between ${isRTL ? "text-right" : ""}`}>
                <div className={`flex flex-col ${isRTL ? "items-end" : "items-start"}`}>
                  {/* Back Link */}
                  {backToAllPostsLabel && (
                    <Link
                      href={`/${locale}/blogs`}
                      className={`inline-flex items-center gap-2 text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] mb-8 transition-colors ${isRTL ? "flex-row-reverse" : ""}`}
                    >
                      <BackIcon className="w-4 h-4" />
                      <span className="text-sm">{backToAllPostsLabel}</span>
                    </Link>
                  )}

                  {/* Read Time Pill */}
                  {readTime && (
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[var(--on-surface-default)] bg-[#F4F4F5] rounded-md mb-4 ${isRTL ? "flex-row-reverse" : ""}`}>
                      <Clock className="w-4 h-4" />
                      {readTime}
                    </div>
                  )}

                  {/* Title */}
                  {title && (
                    <h1 className="font-semibold text-[var(--on-surface-default)]" style={{ fontSize: "32px", lineHeight: "1.2" }}>
                      {title}
                    </h1>
                  )}
                </div>

                {/* Publish Date - at bottom */}
                {blogPost.publishedDate && (
                  <p className={`text-[var(--on-surface-variant)] ${isRTL ? "text-right" : ""}`} style={{ fontSize: "14px" }}>
                    {getDate()}
                  </p>
                )}
              </div>

              {/* Right - Image */}
              {hasImage && (
                <div className="w-1/2">
                  <div className="relative h-[320px] rounded-2xl overflow-hidden">
                    <Image
                      src={imageUrl!}
                      alt=""
                      fill
                      className="object-cover"
                      unoptimized={imageUrl!.startsWith("http")}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Divider - Full Width */}
        <div className="mx-16 h-px bg-[var(--color-border)]" />

        {/* Content Section */}
        <article className={`max-w-[800px] mx-auto px-8 py-12 ${isRTL ? "text-right" : ""}`}>
          <div className="prose max-w-none">
            {blogPost.content && (
              <ReactMarkdown
                components={{
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
                  p: ({ children }) => (
                    <p className="text-[var(--on-surface-default)] mb-6" style={{ fontSize: "16px", lineHeight: "1.8" }}>
                      {children}
                    </p>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className={`border-[#002D87] py-4 my-8 bg-[#F8FAFC] ${isRTL ? "border-r-4 pr-6 rounded-l-xl" : "border-l-4 pl-6 rounded-r-xl"}`}>
                      {children}
                    </blockquote>
                  ),
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                  a: ({ children, href }) => (
                    <a href={href} className="text-[#002D87] underline hover:no-underline" target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ),
                  ul: ({ children }) => <ul className="list-disc list-inside mb-6 space-y-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-6 space-y-2">{children}</ol>,
                  li: ({ children }) => <li className="text-[var(--on-surface-default)]">{children}</li>,
                  img: ({ src, alt }) => (
                    <div className="relative w-full h-[350px] rounded-xl overflow-hidden my-8">
                      <Image
                        src={String(src || "")}
                        alt={alt || ""}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ),
                }}
              >
                {blogPost.content}
              </ReactMarkdown>
            )}
          </div>

          {/* Published By — shows only when both the author and the Strapi label are set */}
          {author && publishedByLabel && (
            <div className="mt-10 pt-8 border-t border-[var(--color-border)]">
              <p className="text-sm text-[var(--on-surface-variant)]">
                {publishedByLabel} <span className="font-medium text-[var(--on-surface-default)]">{author}</span>
              </p>
            </div>
          )}
        </article>

        {/* Latest Blogs Section */}
        {relatedBlogs.length > 0 && (
          <section className="px-16 py-16 bg-white">
            <div className="max-w-[1200px] mx-auto">
              {latestBlogsTitle && (
                <h2 className={`font-semibold text-[var(--on-surface-default)] mb-2 ${isRTL ? "text-right" : ""}`} style={{ fontSize: "48px" }}>
                  {latestBlogsTitle}
                </h2>
              )}
              {latestBlogsSubtitle && (
                <p className={`text-[var(--on-surface-variant)] mb-10 ${isRTL ? "text-right" : ""}`} style={{ fontSize: "20px" }}>
                  {latestBlogsSubtitle}
                </p>
              )}

              <div className="grid grid-cols-3 gap-8">
                {relatedBlogs.map((blog) => (
                  <BlogCard key={blog.documentId} post={blog} isRTL={isRTL} />
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
          {backToAllPostsLabel && (
            <div className={`flex ${isRTL ? "justify-end" : "justify-start"} mb-6`}>
              <Link href={`/${locale}/blogs`} className={`inline-flex items-center gap-2 text-[var(--on-surface-variant)] ${isRTL ? "flex-row-reverse" : ""}`}>
                <BackIcon className="w-4 h-4" />
                <span className="text-sm">{backToAllPostsLabel}</span>
              </Link>
            </div>
          )}

          {/* Read Time Pill */}
          {readTime && (
            <div className={`flex ${isRTL ? "justify-end" : "justify-start"} mb-3`}>
              <div className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[var(--on-surface-default)] bg-[#F4F4F5] rounded ${isRTL ? "flex-row-reverse" : ""}`}>
                <Clock className="w-3 h-3" />
                {readTime}
              </div>
            </div>
          )}

          {/* Title */}
          {title && (
            <h1 className="font-semibold text-[var(--on-surface-default)] mb-4" style={{ fontSize: "22px", lineHeight: "1.3" }}>
              {title}
            </h1>
          )}

          {/* Image */}
          {hasImage && (
            <div className="relative w-full h-[200px] rounded-xl overflow-hidden mb-4">
              <Image src={imageUrl!} alt="" fill className="object-cover" unoptimized={imageUrl!.startsWith("http")} />
            </div>
          )}

          {/* Publish Date */}
          {blogPost.publishedDate && (
            <p className="text-[var(--on-surface-variant)] text-xs mb-6">
              {getDate()}
            </p>
          )}

          {/* Divider */}
          <div className="w-full h-px bg-[var(--color-border)]" />
        </section>

        {/* Content Section */}
        <article className={`px-4 py-6 ${isRTL ? "text-right" : ""}`}>
          <div className="prose max-w-none text-sm">
            {blogPost.content && (
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h1 className="font-semibold text-[var(--on-surface-default)] mt-8 mb-3" style={{ fontSize: "24px" }}>
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="font-semibold text-[var(--on-surface-default)] mt-8 mb-3" style={{ fontSize: "20px" }}>
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="font-semibold text-[var(--on-surface-default)] mt-6 mb-2" style={{ fontSize: "18px" }}>
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-[var(--on-surface-default)] mb-5 text-sm" style={{ lineHeight: "1.8" }}>
                      {children}
                    </p>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className={`border-[#002D87] py-3 my-6 bg-[#F8FAFC] ${isRTL ? "border-r-4 pr-4 rounded-l-xl" : "border-l-4 pl-4 rounded-r-xl"}`}>
                      {children}
                    </blockquote>
                  ),
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                  a: ({ children, href }) => (
                    <a href={href} className="text-[#002D87] underline hover:no-underline" target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ),
                  ul: ({ children }) => <ul className="list-disc list-inside mb-5 space-y-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside mb-5 space-y-2">{children}</ol>,
                  li: ({ children }) => <li className="text-[var(--on-surface-default)]">{children}</li>,
                  img: ({ src, alt }) => (
                    <div className="relative w-full h-[200px] rounded-xl overflow-hidden my-6">
                      <Image
                        src={String(src || "")}
                        alt={alt || ""}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ),
                }}
              >
                {blogPost.content}
              </ReactMarkdown>
            )}
          </div>

          {/* Published By */}
          {author && publishedByLabel && (
            <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
              <p className="text-xs text-[var(--on-surface-variant)]">
                {publishedByLabel} <span className="font-medium text-[var(--on-surface-default)]">{author}</span>
              </p>
            </div>
          )}
        </article>

        {/* Latest Blogs Section */}
        {relatedBlogs.length > 0 && (
          <section className="px-4 py-8 bg-white">
            {latestBlogsTitle && (
              <h2 className={`font-semibold text-[var(--on-surface-default)] mb-1 ${isRTL ? "text-right" : ""}`} style={{ fontSize: "24px" }}>
                {latestBlogsTitle}
              </h2>
            )}
            {latestBlogsSubtitle && (
              <p className={`text-[var(--on-surface-variant)] text-sm mb-6 ${isRTL ? "text-right" : ""}`}>
                {latestBlogsSubtitle}
              </p>
            )}

            <div className="flex flex-col gap-6">
              {relatedBlogs.map((blog) => (
                <MobileBlogCard key={blog.documentId} post={blog} isRTL={isRTL} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default BlogDetailContent;
