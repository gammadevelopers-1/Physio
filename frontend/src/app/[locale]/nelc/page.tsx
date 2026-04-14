import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import NELCContent from "@/components/NELCContent";
import { setRequestLocale } from "next-intl/server";
import { getNELCPageData } from "@/lib/strapi";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { getBlocksAtPosition } from "@/lib/strapi/block-utils";
import type { SideLoadedData } from "@/lib/strapi/types";

export default async function NELCPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const {
    nelcPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  } = await getNELCPageData(locale);

  const blocks = nelcPage?.blocks;

  const sideLoadedData: SideLoadedData = { partners: [], featuredCourses: [], instructors: [], testimonials: [] };

  return (
    <main id="main-content" className="min-h-screen bg-white pb-20 lg:pb-0">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'top')} sideLoadedData={sideLoadedData} />
      <NELCContent strapiData={nelcPage} />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'after-section-1')} sideLoadedData={sideLoadedData} />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'bottom')} sideLoadedData={sideLoadedData} />
      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
    </main>
  );
}
