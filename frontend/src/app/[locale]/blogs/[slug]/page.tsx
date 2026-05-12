import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { BlogDetailContent } from "@/components/blogs";
import { getBlogDetailData, getBlogBySlug, getSiteSettings, getStrapiMediaUrl } from "@/lib/strapi";
import { buildMetadata, SITE_URL } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import { articleLD } from "@/lib/structured-data";
import Breadcrumb from "@/components/shared/Breadcrumb";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const [post, settings] = await Promise.all([
    getBlogBySlug(slug, locale).catch(() => null),
    getSiteSettings(locale).catch(() => null),
  ]);
  return buildMetadata({
    seo: post?.seo,
    fallbacks: {
      title: post?.title,
      description: post?.excerpt,
      image: post?.mainImage?.url,
      imageAlt: post?.mainImage?.alternativeText,
      imageWidth: post?.mainImage?.width,
      imageHeight: post?.mainImage?.height,
    },
    locale,
    path: `/blogs/${slug}`,
    siteOgImageUrl: settings?.defaultOgImage?.url
      ? getStrapiMediaUrl(settings.defaultOgImage.url)
      : null,
  });
}

export default async function BlogDetailPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const {
    blogPost,
    latestBlogs,
    blogsPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  } = await getBlogDetailData(slug, locale);

  const articleLdJson = blogPost
    ? articleLD({
        url: `${SITE_URL}/${locale}/blogs/${slug}`,
        title: blogPost.title,
        description: blogPost.excerpt,
        image: blogPost.mainImage?.url ? getStrapiMediaUrl(blogPost.mainImage.url) : null,
        datePublished: blogPost.publishedDate || blogPost.publishedAt,
        dateModified: blogPost.updatedAt,
        authorName: blogPost.authorName,
        siteName: siteSettings?.siteName || undefined,
        publisherLogoUrl: siteSettings?.logo?.url ? getStrapiMediaUrl(siteSettings.logo.url) : null,
      })
    : null;

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      {articleLdJson && <JsonLd id="ld-article" data={articleLdJson} />}
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} footerLinks={footerLinks} />
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-16 pt-4">
        <Breadcrumb
          locale={locale}
          crumbs={[
            { label: locale === "ar" ? "الرئيسية" : "Home", href: `/${locale}` },
            { label: locale === "ar" ? "المدونة" : "Blog", href: `/${locale}/blogs` },
            { label: blogPost?.title || (locale === "ar" ? "مقال" : "Article") },
          ]}
        />
      </div>
      <BlogDetailContent blogPost={blogPost} latestBlogs={latestBlogs} blogsPage={blogsPage} />
      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
    </main>
  );
}
