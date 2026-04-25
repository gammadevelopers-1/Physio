import { setRequestLocale } from "next-intl/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
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
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)]">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} footerLinks={footerLinks} />

      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'top')} sideLoadedData={sideLoadedData} />

      <CourseDetailContent
        noReviewsText={courseDetailPage?.noReviewsText || undefined}
        moreContentText={courseDetailPage?.moreContentText || undefined}
        relatedCoursesTitle={courseDetailPage?.relatedCoursesTitle || undefined}
        relatedCoursesSubtitle={courseDetailPage?.relatedCoursesSubtitle || undefined}
        overviewHeading={courseDetailPage?.overviewHeading || undefined}
        objectivesHeading={courseDetailPage?.objectivesHeading || undefined}
        featuresHeading={courseDetailPage?.featuresHeading || undefined}
        contentsHeading={courseDetailPage?.contentsHeading || undefined}
        scheduleHeading={courseDetailPage?.scheduleHeading || undefined}
        requirementsHeading={courseDetailPage?.requirementsHeading || undefined}
        noticesHeading={courseDetailPage?.noticesHeading || undefined}
        reviewsHeading={courseDetailPage?.reviewsHeading || undefined}
        targetAudienceHeading={courseDetailPage?.targetAudienceHeading || undefined}
        courseDetailsHeading={courseDetailPage?.courseDetailsHeading || undefined}
      />

      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'bottom')} sideLoadedData={sideLoadedData} />

      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
    </main>
  );
}
