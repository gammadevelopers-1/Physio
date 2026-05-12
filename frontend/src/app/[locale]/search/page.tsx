import type { Metadata } from "next";
import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { SearchPageContent } from "@/components/search";
import { setRequestLocale } from "next-intl/server";
import { getSiteSettings, getNavbarLinks, getFooterLinks, getSearchPage, getStrapiMediaUrl } from "@/lib/strapi";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [page, settings] = await Promise.all([
    getSearchPage(locale).catch(() => null),
    getSiteSettings(locale).catch(() => null),
  ]);
  return buildPageMetadata({
    locale,
    path: "/search",
    page: page as Parameters<typeof buildPageMetadata>[0]["page"],
    siteOgImageUrl: settings?.defaultOgImage?.url
      ? getStrapiMediaUrl(settings.defaultOgImage.url)
      : null,
  });
}

function SearchPageFallback() {
  return (
    <div className="min-h-screen bg-[var(--color-surface-page)] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default async function SearchPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [siteSettings, navbarLinks, footerLinks, searchPage] = await Promise.all([
    getSiteSettings(locale),
    getNavbarLinks(locale),
    getFooterLinks(locale),
    getSearchPage(locale),
  ]);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)] overflow-x-hidden">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} footerLinks={footerLinks} />
      <Suspense fallback={<SearchPageFallback />}>
        <SearchPageContent strapiData={searchPage} />
      </Suspense>
      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
    </main>
  );
}
