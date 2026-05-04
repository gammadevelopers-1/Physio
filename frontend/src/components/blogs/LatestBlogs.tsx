"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";

interface LatestBlog {
  id: string;
  slug: string;
  title: string;
  image: string;
  category: string;
}

interface LatestBlogsProps {
  blogs: LatestBlog[];
}

const LatestBlogs = ({ blogs }: LatestBlogsProps) => {
  const locale = useLocale();

  return (
    <>
      {/* Desktop */}
      <section className="hidden lg:block bg-[#1a1a2e] py-12 lg:py-20 px-16">
        <div className="max-w-[1200px] mx-auto">
          <h2 className="font-semibold text-white mb-2" style={{ fontSize: "48px" }}>
            Latest Blogs
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-10" style={{ fontSize: "20px" }}>
            Insights, Updates, and Best Practices in Healthcare Education
          </p>

          <div className="grid grid-cols-3 gap-6">
            {blogs.map((blog) => (
              <Link key={blog.id} href={`/${locale}/blogs/${blog.slug}`} className="group block">
                <div className="bg-[#2a2a42] rounded-2xl overflow-hidden">
                  <div className="relative h-[180px]">
                    <Image
                      src={blog.image}
                      alt={blog.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-5">
                    <span className="inline-block px-3 py-1 text-xs font-medium text-[#002D87] bg-[var(--color-surface-page)] rounded-full mb-3">
                      {blog.category}
                    </span>
                    <h3 className="font-medium text-white line-clamp-2" style={{ fontSize: "16px" }}>
                      {blog.title}
                    </h3>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Mobile */}
      <section className="lg:hidden bg-[#1a1a2e] py-10 px-4">
        <h2 className="font-semibold text-white mb-1" style={{ fontSize: "24px" }}>
          Latest Blogs
        </h2>
        <p className="text-[var(--color-text-secondary)] text-sm mb-6">
          Insights, Updates, and Best Practices in Healthcare Education
        </p>

        <div className="flex flex-col gap-4">
          {blogs.map((blog) => (
            <Link key={blog.id} href={`/${locale}/blogs/${blog.slug}`} className="group block">
              <div className="bg-[#2a2a42] rounded-xl overflow-hidden flex gap-3 p-3">
                <div className="relative w-[80px] h-[70px] rounded-lg overflow-hidden shrink-0">
                  <Image
                    src={blog.image}
                    alt={blog.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="inline-block px-2 py-0.5 text-[10px] font-medium text-[#002D87] bg-[var(--color-surface-page)] rounded-full mb-1">
                    {blog.category}
                  </span>
                  <h3 className="font-medium text-white text-sm line-clamp-2">
                    {blog.title}
                  </h3>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
};

export default LatestBlogs;
