import { setRequestLocale } from "next-intl/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
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
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)] overflow-x-hidden">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} footerLinks={footerLinks} />

      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'top')} sideLoadedData={sideLoadedData} />

      <CoursesPageContent
        heroTitle={coursesPage?.heroTitle || undefined}
        heroSubtitle={coursesPage?.heroSubtitle || undefined}
        emptyStateTitle={coursesPage?.emptyStateTitle || undefined}
        emptyStateMessage={coursesPage?.emptyStateMessage || undefined}
        ctaTitle={coursesPage?.ctaTitle || undefined}
        ctaDescription={coursesPage?.ctaDescription || undefined}
        ctaButtonLabel={coursesPage?.ctaButtonLabel || undefined}
        ctaButtonHref={coursesPage?.ctaButtonHref || undefined}
        showSearchBar={coursesPage?.showSearchBar ?? true}
        showDeliveryFilter={coursesPage?.showDeliveryFilter ?? true}
        showPricingFilter={coursesPage?.showPricingFilter ?? true}
        showAvailabilityFilter={coursesPage?.showAvailabilityFilter ?? true}
        showLanguageFilter={coursesPage?.showLanguageFilter ?? true}
        showSortBy={coursesPage?.showSortBy ?? true}
        searchPlaceholder={coursesPage?.searchPlaceholder || undefined}
        sidebarFilterTitle={coursesPage?.sidebarFilterTitle || undefined}
        filterAllLabel={coursesPage?.filterAllLabel || undefined}
        filterDeliveryLabel={coursesPage?.filterDeliveryLabel || undefined}
        filterZoomLabel={coursesPage?.filterZoomLabel || undefined}
        filterOnsiteLabel={coursesPage?.filterOnsiteLabel || undefined}
        filterBlendedLabel={coursesPage?.filterBlendedLabel || undefined}
        filterSelfPacedLabel={coursesPage?.filterSelfPacedLabel || undefined}
        filterPricingLabel={coursesPage?.filterPricingLabel || undefined}
        filterFreeLabel={coursesPage?.filterFreeLabel || undefined}
        filterPaidLabel={coursesPage?.filterPaidLabel || undefined}
        filterAvailabilityLabel={coursesPage?.filterAvailabilityLabel || undefined}
        filterAvailOpenLabel={coursesPage?.filterAvailOpenLabel || undefined}
        filterAvailStartingSoonLabel={coursesPage?.filterAvailStartingSoonLabel || undefined}
        filterAvailFullLabel={coursesPage?.filterAvailFullLabel || undefined}
        filterLanguageLabel={coursesPage?.filterLanguageLabel || undefined}
        filterLangEnLabel={coursesPage?.filterLangEnLabel || undefined}
        filterLangArLabel={coursesPage?.filterLangArLabel || undefined}
        filterLangBothLabel={coursesPage?.filterLangBothLabel || undefined}
        filterSortByLabel={coursesPage?.filterSortByLabel || undefined}
        filterSortNewestLabel={coursesPage?.filterSortNewestLabel || undefined}
        filterSortRatingLabel={coursesPage?.filterSortRatingLabel || undefined}
        filterSortFeaturedLabel={coursesPage?.filterSortFeaturedLabel || undefined}
      />

      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'after-section-1')} sideLoadedData={sideLoadedData} />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'bottom')} sideLoadedData={sideLoadedData} />

      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
    </main>
  );
}
