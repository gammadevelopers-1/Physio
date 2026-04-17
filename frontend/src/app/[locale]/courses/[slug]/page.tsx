import { setRequestLocale } from "next-intl/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import WhatsAppButton from "@/components/WhatsAppButton";
import { CourseDetailContent } from "@/components/courses";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { getBlocksAtPosition } from "@/lib/strapi/block-utils";
import { getCourseDetailPage, getSiteSettings, getNavbarLinks, getFooterLinks } from "@/lib/strapi";
import type { SideLoadedData } from "@/lib/strapi/types";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [courseDetailPage, siteSettings, navbarLinks, footerLinks] = await Promise.all([
    getCourseDetailPage(locale),
    getSiteSettings(locale),
    getNavbarLinks(locale),
    getFooterLinks(locale),
  ]);

  const blocks = courseDetailPage?.blocks;
  const sideLoadedData: SideLoadedData = {
    partners: [],
    featuredCourses: [],
    instructors: [],
    testimonials: [],
  };

  return (
    <main id="main-content" className="min-h-screen bg-white">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} />

      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'top')} sideLoadedData={sideLoadedData} />

      <CourseDetailContent
        noReviewsText={courseDetailPage?.noReviewsText || undefined}
        moreContentText={courseDetailPage?.moreContentText || undefined}
        relatedCoursesTitle={courseDetailPage?.relatedCoursesTitle || undefined}
        relatedCoursesSubtitle={courseDetailPage?.relatedCoursesSubtitle || undefined}
      />

      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'bottom')} sideLoadedData={sideLoadedData} />

      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
      <BottomNav />
      <WhatsAppButton phoneNumber={siteSettings?.whatsappNumber} />
    </main>
  );
}
