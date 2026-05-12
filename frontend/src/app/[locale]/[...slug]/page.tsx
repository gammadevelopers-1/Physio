import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getDynamicPage, getSiteSettings, getStrapiMediaUrl } from "@/lib/strapi";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import type { SideLoadedData } from "@/lib/strapi/types";
import { buildPageMetadata } from "@/lib/seo";
import Breadcrumb from "@/components/shared/Breadcrumb";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string[] }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const pageSlug = slug.join("/");
  const [{ page }, settings] = await Promise.all([
    getDynamicPage(pageSlug, locale).catch(() => ({ page: null })),
    getSiteSettings(locale).catch(() => null),
  ]);
  return buildPageMetadata({
    locale,
    path: `/${pageSlug}`,
    page: page as Parameters<typeof buildPageMetadata>[0]["page"],
    siteOgImageUrl: settings?.defaultOgImage?.url
      ? getStrapiMediaUrl(settings.defaultOgImage.url)
      : null,
  });
}

export default async function DynamicPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string[] }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const pageSlug = slug.join("/");
  const { page, siteSettings, navbarLinks, footerLinks } =
    await getDynamicPage(pageSlug, locale);

  if (!page) {
    notFound();
  }

  const sideLoadedData: SideLoadedData = {
    partners: [],
    featuredCourses: [],
    instructors: [],
    testimonials: [],
  };

  // Breadcrumb derived from path segments. Each non-final segment is a
  // crawlable link; the final one is the current page (no href). Labels
  // are humanized from the slug (Title Case) since dynamic pages don't
  // expose intermediate-segment titles.
  const segments = pageSlug.split("/").filter(Boolean);
  const humanize = (s: string) =>
    decodeURIComponent(s).replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const homeLabel = locale === "ar" ? "الرئيسية" : "Home";
  const breadcrumbs = [
    { label: homeLabel, href: `/${locale}` },
    ...segments.map((seg, idx) => {
      const isLast = idx === segments.length - 1;
      const href = `/${locale}/${segments.slice(0, idx + 1).join("/")}`;
      const isFinal = isLast;
      return {
        label: isFinal ? (page.title || humanize(seg)) : humanize(seg),
        href: isFinal ? undefined : href,
      };
    }),
  ];

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[var(--color-surface-page)] pb-16 lg:pb-0"
    >
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} />

      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-16 pt-4">
        <Breadcrumb locale={locale} crumbs={breadcrumbs} />
      </div>

      {page.blocks && page.blocks.length > 0 ? (
        <BlockRenderer blocks={page.blocks} sideLoadedData={sideLoadedData} />
      ) : (
        <div className="max-w-4xl mx-auto px-4 lg:px-16 py-12 lg:py-20 text-center">
          <h1 className="text-[36px] lg:text-[48px] font-semibold text-[var(--on-surface-default)] mb-4">
            {page.title}
          </h1>
        </div>
      )}

      <div className="hidden lg:block">
        <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
      </div>
    </main>
  );
}
