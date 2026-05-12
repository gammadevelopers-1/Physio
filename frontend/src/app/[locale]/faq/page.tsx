import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FAQContent from "@/components/FAQContent";
import { setRequestLocale } from "next-intl/server";
import { getFAQPage, getFAQPageData, getSiteSettings, getStrapiMediaUrl } from "@/lib/strapi";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { getBlocksAtPosition } from "@/lib/strapi/block-utils";
import type { SideLoadedData } from "@/lib/strapi/types";
import { buildPageMetadata } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import { faqPageLD } from "@/lib/structured-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [page, settings] = await Promise.all([
    getFAQPage(locale).catch(() => null),
    getSiteSettings(locale).catch(() => null),
  ]);
  return buildPageMetadata({
    locale,
    path: "/faq",
    page,
    siteOgImageUrl: settings?.defaultOgImage?.url
      ? getStrapiMediaUrl(settings.defaultOgImage.url)
      : null,
  });
}

export default async function FAQPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const {
    faqPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  } = await getFAQPageData(locale);

  const blocks = faqPage?.blocks;

  const sideLoadedData: SideLoadedData = { partners: [], featuredCourses: [], instructors: [], testimonials: [] };

  // FAQPage JSON-LD — only when there's at least one Q/A in the entity.
  const faqItems = (faqPage?.items || [])
    .filter((i) => i.question && i.answer)
    .map((i) => ({ question: i.question, answer: i.answer }));
  const faqLdJson = faqItems.length ? faqPageLD(faqItems) : null;

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)] pb-20 lg:pb-0">
      {faqLdJson && <JsonLd id="ld-faq" data={faqLdJson} />}
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} footerLinks={footerLinks} />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'top')} sideLoadedData={sideLoadedData} />
      <FAQContent strapiData={faqPage} />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'after-section-1')} sideLoadedData={sideLoadedData} />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'bottom')} sideLoadedData={sideLoadedData} />
      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
    </main>
  );
}
