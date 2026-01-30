"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { BlogCard, MobileBlogCard } from "@/components/blogs";
import { blogDetails } from "@/data/blogDetails";
import { blogPosts } from "@/data/blogPosts";

const BlogDetailContent = () => {
  const params = useParams();
  const slug = params.slug as string;
  const t = useTranslations("blogsPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const post = blogDetails.find((p) => p.slug === slug) || blogDetails[0];

  // Get latest blogs as BlogPost format for cards
  const latestBlogPosts = blogPosts.filter(p => !p.featured).slice(0, 3);

  // Helper to get back arrow icon based on RTL
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  // Helper functions to get translated blog content
  const getTranslatedTitle = () => {
    if (isRTL) {
      try {
        return t(`posts.${post.slug}.title`);
      } catch {
        return post.title;
      }
    }
    return post.title;
  };

  const getTranslatedReadTime = () => {
    if (isRTL) {
      try {
        return t(`posts.${post.slug}.readTime`);
      } catch {
        return post.readTime;
      }
    }
    return post.readTime;
  };

  const getTranslatedDate = () => {
    if (isRTL) {
      try {
        return t(`posts.${post.slug}.date`);
      } catch {
        return post.date;
      }
    }
    return post.date;
  };

  const getTranslatedAuthor = () => {
    if (isRTL) {
      try {
        return t(`posts.${post.slug}.author`);
      } catch {
        return post.author.name;
      }
    }
    return post.author.name;
  };

  // Helper to get translated content text based on content type and index
  const getTranslatedContentText = (block: { type: string; text?: string }, index: number) => {
    if (!isRTL || !block.text) return block.text;

    try {
      // Count occurrences of each type up to the current index
      let paragraphCount = 0;
      let headingCount = 0;
      let quoteCount = 0;

      for (let i = 0; i <= index; i++) {
        const currentBlock = post.content[i];
        if (currentBlock.type === "paragraph") {
          paragraphCount++;
        } else if (currentBlock.type === "heading") {
          headingCount++;
        } else if (currentBlock.type === "quote") {
          quoteCount++;
        }
      }

      switch (block.type) {
        case "paragraph":
          return t(`posts.${post.slug}.content.paragraph${paragraphCount}`);
        case "heading":
          return t(`posts.${post.slug}.content.heading${headingCount}`);
        case "quote":
          return t(`posts.${post.slug}.content.quote${quoteCount}`);
        case "conclusion":
          return t(`posts.${post.slug}.content.conclusion`);
        default:
          return block.text;
      }
    } catch {
      return block.text;
    }
  };

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
                    href="/blogs"
                    className={`inline-flex items-center gap-2 text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] mb-8 transition-colors ${isRTL ? "flex-row-reverse" : ""}`}
                  >
                    <BackIcon className="w-4 h-4" />
                    <span className="text-sm">{t("blogDetail.allPost")}</span>
                  </Link>

                  {/* Read Time Pill */}
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[var(--on-surface-default)] bg-[#F4F4F5] rounded-md mb-4 ${isRTL ? "flex-row-reverse" : ""}`}>
                    <Clock className="w-4 h-4" />
                    {getTranslatedReadTime()}
                  </div>

                  {/* Title */}
                  <h1
                    className="font-semibold text-[var(--on-surface-default)]"
                    style={{ fontSize: "32px", lineHeight: "1.2" }}
                  >
                    {getTranslatedTitle()}
                  </h1>
                </div>

                {/* Publish Date - at bottom */}
                <p className={`text-[var(--on-surface-variant)] ${isRTL ? "text-right" : ""}`} style={{ fontSize: "14px" }}>
                  {t("blogDetail.publishedOn")} {getTranslatedDate()}
                </p>
              </div>

              {/* Right - Image */}
              <div className="w-1/2">
                <div className="relative h-[320px] rounded-2xl overflow-hidden">
                  <Image src={post.image} alt={getTranslatedTitle()} fill className="object-cover" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Divider - Full Width */}
        <div className="mx-16 h-px bg-[#E5E7EB]" />

        {/* Content Section */}
        <article className={`max-w-[800px] mx-auto px-8 py-12 ${isRTL ? "text-right" : ""}`}>

          {/* Content */}
          <div className="prose max-w-none">
            {post.content.map((block, index) => {
              switch (block.type) {
                case "paragraph":
                  return (
                    <p
                      key={index}
                      className="text-[var(--on-surface-default)] mb-6"
                      style={{ fontSize: "16px", lineHeight: "1.8" }}
                    >
                      {getTranslatedContentText(block, index)}
                    </p>
                  );
                case "heading":
                  return (
                    <h2
                      key={index}
                      className="font-semibold text-[var(--on-surface-default)] mt-10 mb-4"
                      style={{ fontSize: "24px" }}
                    >
                      {getTranslatedContentText(block, index)}
                    </h2>
                  );
                case "image":
                  return (
                    <div
                      key={index}
                      className="relative w-full h-[350px] rounded-xl overflow-hidden my-8"
                    >
                      <Image
                        src={block.src || ""}
                        alt={block.alt || ""}
                        fill
                        className="object-cover"
                      />
                    </div>
                  );
                case "quote":
                  return (
                    <blockquote
                      key={index}
                      className={`border-[#002D87] py-4 my-8 bg-[#F8FAFC] ${isRTL ? "border-r-4 pr-6 rounded-l-xl" : "border-l-4 pl-6 rounded-r-xl"}`}
                    >
                      <p
                        className="text-[var(--on-surface-default)] italic"
                        style={{ fontSize: "16px", lineHeight: "1.8" }}
                      >
                        &ldquo;{getTranslatedContentText(block, index)}&rdquo;
                      </p>
                    </blockquote>
                  );
                case "conclusion":
                  return (
                    <div
                      key={index}
                      className="bg-[#F4F4F5] rounded-xl p-6 my-10"
                    >
                      <h3
                        className="font-semibold text-[var(--on-surface-default)] mb-3"
                        style={{ fontSize: "20px" }}
                      >
                        {t("blogDetail.conclusion")}
                      </h3>
                      <p
                        className="text-[var(--on-surface-default)]"
                        style={{ fontSize: "16px", lineHeight: "1.8" }}
                      >
                        {getTranslatedContentText(block, index)}
                      </p>
                    </div>
                  );
                default:
                  return null;
              }
            })}
          </div>

          {/* Published By */}
          <div className="mt-10 pt-8 border-t border-[#E5E7EB]">
            <p className="text-sm text-[var(--on-surface-variant)]">
              {t("blogDetail.publishedBy")} <span className="font-medium text-[var(--on-surface-default)]">{getTranslatedAuthor()}</span>
            </p>
          </div>
        </article>

        {/* Latest Blogs Section */}
        <section className="px-16 py-16 bg-white">
          <div className="max-w-[1200px] mx-auto">
            <h2 className={`font-semibold text-[var(--on-surface-default)] mb-2 ${isRTL ? "text-right" : ""}`} style={{ fontSize: "48px" }}>
              {t("blogDetail.latestBlogs.title")}
            </h2>
            <p className={`text-[var(--on-surface-variant)] mb-10 ${isRTL ? "text-right" : ""}`} style={{ fontSize: "20px" }}>
              {t("blogDetail.latestBlogs.subtitle")}
            </p>

            <div className="grid grid-cols-3 gap-8">
              {latestBlogPosts.map((blog) => (
                <BlogCard key={blog.id} post={blog} isRTL={isRTL} />
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden pb-24">
        {/* Hero Section */}
        <section className={`px-4 py-6 ${isRTL ? "text-right" : ""}`}>
          {/* Back Link */}
          <div className={`flex ${isRTL ? "justify-end" : "justify-start"} mb-6`}>
            <Link href="/blogs" className={`inline-flex items-center gap-2 text-[var(--on-surface-variant)] ${isRTL ? "flex-row-reverse" : ""}`}>
              <BackIcon className="w-4 h-4" />
              <span className="text-sm">{t("blogDetail.allPost")}</span>
            </Link>
          </div>

          {/* Read Time Pill */}
          <div className={`flex ${isRTL ? "justify-end" : "justify-start"} mb-3`}>
            <div className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[var(--on-surface-default)] bg-[#F4F4F5] rounded ${isRTL ? "flex-row-reverse" : ""}`}>
              <Clock className="w-3 h-3" />
              {getTranslatedReadTime()}
            </div>
          </div>

          {/* Title */}
          <h1
            className="font-semibold text-[var(--on-surface-default)] mb-4"
            style={{ fontSize: "22px", lineHeight: "1.3" }}
          >
            {getTranslatedTitle()}
          </h1>

          {/* Image */}
          <div className="relative w-full h-[200px] rounded-xl overflow-hidden mb-4">
            <Image src={post.image} alt={getTranslatedTitle()} fill className="object-cover" />
          </div>

          {/* Publish Date */}
          <p className="text-[var(--on-surface-variant)] text-xs mb-6">
            {t("blogDetail.publishedOn")} {getTranslatedDate()}
          </p>

          {/* Divider */}
          <div className="w-full h-px bg-[#E5E7EB]" />
        </section>

        {/* Content Section */}
        <article className={`px-4 py-6 ${isRTL ? "text-right" : ""}`}>

          {/* Content */}
          <div className="prose max-w-none">
            {post.content.map((block, index) => {
              switch (block.type) {
                case "paragraph":
                  return (
                    <p
                      key={index}
                      className="text-[var(--on-surface-default)] mb-5 text-sm"
                      style={{ lineHeight: "1.8" }}
                    >
                      {getTranslatedContentText(block, index)}
                    </p>
                  );
                case "heading":
                  return (
                    <h2
                      key={index}
                      className="font-semibold text-[var(--on-surface-default)] mt-8 mb-3"
                      style={{ fontSize: "20px" }}
                    >
                      {getTranslatedContentText(block, index)}
                    </h2>
                  );
                case "image":
                  return (
                    <div
                      key={index}
                      className="relative w-full h-[200px] rounded-lg overflow-hidden my-6"
                    >
                      <Image
                        src={block.src || ""}
                        alt={block.alt || ""}
                        fill
                        className="object-cover"
                      />
                    </div>
                  );
                case "quote":
                  return (
                    <blockquote
                      key={index}
                      className={`border-[#002D87] py-3 my-6 bg-[#F8FAFC] ${isRTL ? "border-r-4 pr-4 rounded-l-lg" : "border-l-4 pl-4 rounded-r-lg"}`}
                    >
                      <p
                        className="text-[var(--on-surface-default)] italic text-sm"
                        style={{ lineHeight: "1.8" }}
                      >
                        &ldquo;{getTranslatedContentText(block, index)}&rdquo;
                      </p>
                    </blockquote>
                  );
                case "conclusion":
                  return (
                    <div
                      key={index}
                      className="bg-[#F4F4F5] rounded-lg p-4 my-8"
                    >
                      <h3
                        className="font-semibold text-[var(--on-surface-default)] mb-2"
                        style={{ fontSize: "18px" }}
                      >
                        {t("blogDetail.conclusion")}
                      </h3>
                      <p
                        className="text-[var(--on-surface-default)] text-sm"
                        style={{ lineHeight: "1.8" }}
                      >
                        {getTranslatedContentText(block, index)}
                      </p>
                    </div>
                  );
                default:
                  return null;
              }
            })}
          </div>

          {/* Published By */}
          <div className="mt-8 pt-6 border-t border-[#E5E7EB]">
            <p className="text-xs text-[var(--on-surface-variant)]">
              {t("blogDetail.publishedBy")} <span className="font-medium text-[var(--on-surface-default)]">{getTranslatedAuthor()}</span>
            </p>
          </div>
        </article>

        {/* Latest Blogs Section */}
        <section className="px-4 py-8 bg-white">
          <h2 className={`font-semibold text-[var(--on-surface-default)] mb-1 ${isRTL ? "text-right" : ""}`} style={{ fontSize: "24px" }}>
            {t("blogDetail.latestBlogs.title")}
          </h2>
          <p className={`text-[var(--on-surface-variant)] text-sm mb-6 ${isRTL ? "text-right" : ""}`}>
            {t("blogDetail.latestBlogs.subtitle")}
          </p>

          <div className="flex flex-col gap-6">
            {latestBlogPosts.map((blog) => (
              <MobileBlogCard key={blog.id} post={blog} isRTL={isRTL} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default BlogDetailContent;
