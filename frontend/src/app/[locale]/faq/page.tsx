import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FAQContent from "@/components/FAQContent";
import { setRequestLocale } from "next-intl/server";
import { getFAQPageData } from "@/lib/strapi";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { hasDynamicZoneBlocks } from "@/lib/strapi/block-utils";
import type { SideLoadedData } from "@/lib/strapi/types";

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

  const useDynamicZone = hasDynamicZoneBlocks(faqPage?.blocks);

  const sideLoadedData: SideLoadedData = { partners: [], featuredCourses: [], instructors: [], testimonials: [] };

  return (
    <main id="main-content" className="min-h-screen bg-[var(--surface-intense)] pb-20 lg:pb-0">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} />
      {useDynamicZone ? (
        <BlockRenderer blocks={faqPage!.blocks!} sideLoadedData={sideLoadedData} />
      ) : (
        <FAQContent strapiData={faqPage} />
      )}
      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
    </main>
  );
}
