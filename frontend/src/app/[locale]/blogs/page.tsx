import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { BlogsPageContent } from "@/components/blogs";
import { getBlogsPage, getBlogsPageData, getSiteSettings, getStrapiMediaUrl } from "@/lib/strapi";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [page, settings] = await Promise.all([
    getBlogsPage(locale).catch(() => null),
    getSiteSettings(locale).catch(() => null),
  ]);
  return buildPageMetadata({
    locale,
    path: "/blogs",
    page,
    siteOgImageUrl: settings?.defaultOgImage?.url
      ? getStrapiMediaUrl(settings.defaultOgImage.url)
      : null,
  });
}

export default async function BlogsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const {
    blogPosts,
    featuredBlogs,
    blogCategories,
    blogsPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  } = await getBlogsPageData(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} footerLinks={footerLinks} />
      <BlogsPageContent
        blogPosts={blogPosts}
        featuredBlogs={featuredBlogs}
        blogCategories={blogCategories}
        blogsPage={blogsPage}
      />
      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
    </main>
  );
}
