import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SupportPageContent from "@/components/support/SupportPageContent";
import {
  getSupportPageData,
  getSupportPage,
  getSiteSettings,
  getStrapiMediaUrl,
} from "@/lib/strapi";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { getBlocksAtPosition } from "@/lib/strapi/block-utils";
import type { SideLoadedData } from "@/lib/strapi/types";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [page, settings] = await Promise.all([
    getSupportPage(locale).catch(() => null),
    getSiteSettings(locale).catch(() => null),
  ]);
  return buildPageMetadata({
    locale,
    path: "/support",
    page,
    siteOgImageUrl: settings?.defaultOgImage?.url
      ? getStrapiMediaUrl(settings.defaultOgImage.url)
      : null,
  });
}

export default async function SupportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { supportPage, siteSettings, navbarLinks, footerLinks } =
    await getSupportPageData(locale);

  const blocks = supportPage?.blocks;
  const sideLoadedData: SideLoadedData = {
    partners: [],
    featuredCourses: [],
    instructors: [],
    testimonials: [],
  };

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[var(--color-surface-page)] pb-16 lg:pb-0"
    >
      <Navbar
        siteSettings={siteSettings}
        navLinks={navbarLinks}
        footerLinks={footerLinks}
      />
      <BlockRenderer
        blocks={getBlocksAtPosition(blocks, "top")}
        sideLoadedData={sideLoadedData}
      />
      <SupportPageContent strapiData={supportPage} />
      <BlockRenderer
        blocks={getBlocksAtPosition(blocks, "after-section-1")}
        sideLoadedData={sideLoadedData}
      />
      <BlockRenderer
        blocks={getBlocksAtPosition(blocks, "bottom")}
        sideLoadedData={sideLoadedData}
      />
      <div className="hidden lg:block">
        <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
      </div>
    </main>
  );
}
