import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import InstructorsContent from "@/components/InstructorsContent";
import { setRequestLocale } from "next-intl/server";
import { getInstructorsPageData } from "@/lib/strapi";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { hasDynamicZoneBlocks } from "@/lib/strapi/block-utils";
import type { SideLoadedData } from "@/lib/strapi/types";

export default async function InstructorsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const {
    instructorsPage,
    instructors,
    siteSettings,
    navbarLinks,
    footerLinks,
  } = await getInstructorsPageData(locale);

  const useDynamicZone = hasDynamicZoneBlocks(instructorsPage?.blocks);

  const sideLoadedData: SideLoadedData = { partners: [], featuredCourses: [], instructors: instructors || [], testimonials: [] };

  return (
    <main className="min-h-screen bg-white pb-20 lg:pb-0">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} />
      {useDynamicZone ? (
        <BlockRenderer blocks={instructorsPage!.blocks!} sideLoadedData={sideLoadedData} />
      ) : (
        <InstructorsContent instructors={instructors} strapiData={instructorsPage} />
      )}
      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
    </main>
  );
}
