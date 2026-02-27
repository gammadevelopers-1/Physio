import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BecomeTrainer from "@/components/BecomeTrainer";
import PartnersContent from "@/components/PartnersContent";
import { setRequestLocale } from "next-intl/server";
import { getPartnersPageData } from "@/lib/strapi";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { hasDynamicZoneBlocks } from "@/lib/strapi/block-utils";
import type { SideLoadedData } from "@/lib/strapi/types";

export default async function AcademicPartnersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const {
    partnersPage,
    partners,
    siteSettings,
    navbarLinks,
    footerLinks,
  } = await getPartnersPageData(locale);

  const useDynamicZone = hasDynamicZoneBlocks(partnersPage?.blocks);

  const sideLoadedData: SideLoadedData = { partners: partners || [], featuredCourses: [], instructors: [], testimonials: [] };

  return (
    <main className="min-h-screen bg-[var(--surface-default)] pb-20 lg:pb-0">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} />
      {useDynamicZone ? (
        <BlockRenderer blocks={partnersPage!.blocks!} sideLoadedData={sideLoadedData} />
      ) : (
        <>
          <PartnersContent partners={partners} strapiData={partnersPage} />

          <BecomeTrainer />
        </>
      )}
      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
    </main>
  );
}
