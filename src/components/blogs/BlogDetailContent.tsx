"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { BlogCard, MobileBlogCard } from "@/components/blogs";
import { blogDetails, latestBlogs } from "@/data/blogDetails";
import { blogPosts } from "@/data/blogPosts";

const BlogDetailContent = () => {
  const params = useParams();
  const slug = params.slug as string;

  const post = blogDetails.find((p) => p.slug === slug) || blogDetails[0];

  // Get latest blogs as BlogPost format for cards
  const latestBlogPosts = blogPosts.filter(p => !p.featured).slice(0, 3);

  return (
    <>
      {/* Desktop Layout */}
      <div className="hidden lg:block">
        {/* Hero Section */}
        <section className="px-16 py-12">
          <div className="max-w-[1200px] mx-auto">
            <div className="flex gap-12">
              {/* Left - Text Content */}
              <div className="w-1/2 flex flex-col justify-between">
                <div>
                  {/* Back Link */}
                  <Link
                    href="/blogs"
                    className="inline-flex items-center  gap-2 text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] mb-8 transition-colors w-fit"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-sm">All Post</span>
                  </Link>

                  {/* Read Time Pill */}
                  <div className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[var(--on-surface-default)] bg-[#F4F4F5] rounded-md mb-4 w-fit">
                    <Clock className="w-4 h-4" />
                    {post.readTime}
                  </div>

                  {/* Title */}
                  <h1
                    className="font-semibold text-[var(--on-surface-default)]"
                    style={{ fontSize: "32px", lineHeight: "1.2" }}
                  >
                    {post.title}
                  </h1>
                </div>

                {/* Publish Date - at bottom */}
                <p className="text-[var(--on-surface-variant)]" style={{ fontSize: "14px" }}>
                  Published on {post.date}
                </p>
              </div>

              {/* Right - Image */}
              <div className="w-1/2">
                <div className="relative h-[320px] rounded-2xl overflow-hidden">
                  <Image src={post.image} alt={post.title} fill className="object-cover" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Divider - Full Width */}
        <div className="mx-16 h-px bg-[#E5E7EB]" />

        {/* Content Section */}
        <article className="max-w-[800px] mx-auto px-8 py-12">

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
                      {block.text}
                    </p>
                  );
                case "heading":
                  return (
                    <h2
                      key={index}
                      className="font-semibold text-[var(--on-surface-default)] mt-10 mb-4"
                      style={{ fontSize: "24px" }}
                    >
                      {block.text}
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
                      className="border-l-4 border-[#002D87] pl-6 py-4 my-8 bg-[#F8FAFC] rounded-r-xl"
                    >
                      <p
                        className="text-[var(--on-surface-default)] italic"
                        style={{ fontSize: "16px", lineHeight: "1.8" }}
                      >
                        &ldquo;{block.text}&rdquo;
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
                        Conclusion
                      </h3>
                      <p
                        className="text-[var(--on-surface-default)]"
                        style={{ fontSize: "16px", lineHeight: "1.8" }}
                      >
                        {block.text}
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
              Published by <span className="font-medium text-[var(--on-surface-default)]">{post.author.name}</span>
            </p>
          </div>
        </article>

        {/* Latest Blogs Section */}
        <section className="px-16 py-16 bg-white">
          <div className="max-w-[1200px] mx-auto">
            <h2 className="font-semibold text-[var(--on-surface-default)] mb-2" style={{ fontSize: "48px" }}>
              Latest Blogs
            </h2>
            <p className="text-[var(--on-surface-variant)] mb-10" style={{ fontSize: "20px" }}>
              Insights, Updates, and Best Practices in Healthcare Education
            </p>

            <div className="grid grid-cols-3 gap-8">
              {latestBlogPosts.map((blog) => (
                <BlogCard key={blog.id} post={blog} />
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden pb-24">
        {/* Hero Section */}
        <section className="px-4 py-6">
          {/* Back Link */}
          <Link href="/blogs" className="inline-flex items-center gap-2 text-[var(--on-surface-variant)] mb-6">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">All Post</span>
          </Link>

          {/* Read Time Pill */}
          <div className="flex w-fit items-center gap-1 px-2.5 py-1 text-xs font-medium text-[var(--on-surface-default)] bg-[#F4F4F5] rounded mb-3">
            <Clock className="w-3 h-3" />
            {post.readTime}
          </div>

          {/* Title */}
          <h1
            className="font-semibold text-[var(--on-surface-default)] mb-4"
            style={{ fontSize: "22px", lineHeight: "1.3" }}
          >
            {post.title}
          </h1>

          {/* Image */}
          <div className="relative w-full h-[200px] rounded-xl overflow-hidden mb-4">
            <Image src={post.image} alt={post.title} fill className="object-cover" />
          </div>

          {/* Publish Date */}
          <p className="text-[var(--on-surface-variant)] text-xs mb-6">
            Published on {post.date}
          </p>

          {/* Divider */}
          <div className="w-full h-px bg-[#E5E7EB]" />
        </section>

        {/* Content Section */}
        <article className="px-4 py-6">

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
                      {block.text}
                    </p>
                  );
                case "heading":
                  return (
                    <h2
                      key={index}
                      className="font-semibold text-[var(--on-surface-default)] mt-8 mb-3"
                      style={{ fontSize: "20px" }}
                    >
                      {block.text}
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
                      className="border-l-4 border-[#002D87] pl-4 py-3 my-6 bg-[#F8FAFC] rounded-r-lg"
                    >
                      <p
                        className="text-[var(--on-surface-default)] italic text-sm"
                        style={{ lineHeight: "1.8" }}
                      >
                        &ldquo;{block.text}&rdquo;
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
                        Conclusion
                      </h3>
                      <p
                        className="text-[var(--on-surface-default)] text-sm"
                        style={{ lineHeight: "1.8" }}
                      >
                        {block.text}
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
              Published by <span className="font-medium text-[var(--on-surface-default)]">{post.author.name}</span>
            </p>
          </div>
        </article>

        {/* Latest Blogs Section */}
        <section className="px-4 py-8 bg-white">
          <h2 className="font-semibold text-[var(--on-surface-default)] mb-1" style={{ fontSize: "24px" }}>
            Latest Blogs
          </h2>
          <p className="text-[var(--on-surface-variant)] text-sm mb-6">
            Insights, Updates, and Best Practices in Healthcare Education
          </p>

          <div className="flex flex-col gap-6">
            {latestBlogPosts.map((blog) => (
              <MobileBlogCard key={blog.id} post={blog} />
            ))}
          </div>
        </section>
      </div>
    </>
  );
};

export default BlogDetailContent;
