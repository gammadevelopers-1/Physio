import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CertificationsContent from "@/components/CertificationsContent";
import { setRequestLocale } from "next-intl/server";
import { getCertificationsPageData } from "@/lib/strapi";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { hasDynamicZoneBlocks } from "@/lib/strapi/block-utils";
import type { SideLoadedData } from "@/lib/strapi/types";

export default async function CertificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const {
    certificationsPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  } = await getCertificationsPageData(locale);

  const useDynamicZone = hasDynamicZoneBlocks(certificationsPage?.blocks);

  const sideLoadedData: SideLoadedData = { partners: [], featuredCourses: [], instructors: [], testimonials: [] };

  return (
    <main className="min-h-screen bg-white pb-20 lg:pb-0">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} />
      {useDynamicZone ? (
        <BlockRenderer blocks={certificationsPage!.blocks!} sideLoadedData={sideLoadedData} />
      ) : (
        <CertificationsContent strapiData={certificationsPage} />
      )}
      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
    </main>
  );
}
