import { setRequestLocale } from "next-intl/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import WhatsAppButton from "@/components/WhatsAppButton";
import { CoursesPageContent } from "@/components/courses";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { getBlocksAtPosition } from "@/lib/strapi/block-utils";
import { getCoursesPageData } from "@/lib/strapi";
import type { SideLoadedData } from "@/lib/strapi/types";

export const metadata = {
  title: "Courses | PhysioGuidance",
  description: "Explore courses and events - Accredited healthcare training programs",
};

export default async function CoursesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { coursesPage, siteSettings, navbarLinks, footerLinks } = await getCoursesPageData(locale);
  const blocks = coursesPage?.blocks;
  const sideLoadedData: SideLoadedData = {
    partners: [],
    featuredCourses: [],
    instructors: [],
    testimonials: [],
  };

  return (
    <main id="main-content" className="min-h-screen bg-white overflow-x-hidden">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} />

      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'top')} sideLoadedData={sideLoadedData} />

      <CoursesPageContent
        heroTitle={coursesPage?.heroTitle || undefined}
        heroSubtitle={coursesPage?.heroSubtitle || undefined}
        emptyStateTitle={coursesPage?.emptyStateTitle || undefined}
        emptyStateMessage={coursesPage?.emptyStateMessage || undefined}
      />

      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'after-section-1')} sideLoadedData={sideLoadedData} />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'bottom')} sideLoadedData={sideLoadedData} />

      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
      <BottomNav />
      <WhatsAppButton phoneNumber={siteSettings?.whatsappNumber} />
    </main>
  );
}
