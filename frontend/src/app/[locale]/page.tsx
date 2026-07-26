//page.tsx
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import Navbar from "@/components/Navbar";
import ActiveCampaignBanner from "@/components/courses/ActiveCampaignBanner";
import Hero from "@/components/Hero";
import FeaturedCourses from "@/components/FeaturedCourses";
import BecomeTrainer from "@/components/BecomeTrainer";
import ExpertInstructors from "@/components/ExpertInstructors";
import Testimonials from "@/components/Testimonials";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";
import { getHomePage, getHomePageData, getSiteSettings } from "@/lib/strapi";
import { getStrapiMediaUrl } from "@/lib/strapi/client";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { getBlocksAtPosition } from "@/lib/strapi/block-utils";
import type { SideLoadedData } from "@/lib/strapi/types";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [home, settings] = await Promise.all([
    getHomePage(locale).catch(() => null),
    getSiteSettings(locale).catch(() => null),
  ]);
  return buildMetadata({
    seo: home?.seo,
    fallbacks: {
      title: home?.heroTitle,
      description: home?.heroDescription,
      image: home?.heroPartnerLogos?.[0]?.url,
    },
    locale,
    path: "",
    siteOgImageUrl: settings?.defaultOgImage?.url
      ? getStrapiMediaUrl(settings.defaultOgImage.url)
      : null,
  });
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Fetch all home page data from Strapi
  const {
    homePage,
    siteSettings,
    partners,
    featuredCourses,
    instructors,
    testimonials,
    navbarLinks,
    footerLinks,
  } = await getHomePageData(locale);

  const blocks = homePage?.blocks;
  const sideLoadedData: SideLoadedData = {
    partners: partners || [],
    featuredCourses: featuredCourses || [],
    instructors: instructors || [],
    testimonials: testimonials || [],
  };

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)] pb-16 lg:pb-0">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} footerLinks={footerLinks} />
      <ActiveCampaignBanner />
      {/* top: before all sections */}
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'top')} sideLoadedData={sideLoadedData} />

      {/* Section 1: Hero */}
      <Hero data={homePage} />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'after-section-1')} sideLoadedData={sideLoadedData} />

      {/* Section 2: Partners — rendered via Partners Strip block (controlled from CMS) */}
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'after-section-2')} sideLoadedData={sideLoadedData} />

      {/* Section 3: Featured Courses */}
      <FeaturedCourses sectionData={homePage} />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'after-section-3')} sideLoadedData={sideLoadedData} />

      {/* Section 4: Become Trainer */}
      <BecomeTrainer data={homePage} />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'after-section-4')} sideLoadedData={sideLoadedData} />

      {/* Section 5: Expert Instructors */}
      <ExpertInstructors instructors={instructors} sectionData={homePage} />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'after-section-5')} sideLoadedData={sideLoadedData} />

      {/* Section 6: Testimonials */}
      <Testimonials testimonials={testimonials} sectionData={homePage} />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'after-section-6')} sideLoadedData={sideLoadedData} />

      {/* CTA + bottom blocks */}
      <div className="hidden lg:block">
        <CTASection data={homePage} />
      </div>
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'bottom')} sideLoadedData={sideLoadedData} />

      <div className="hidden lg:block">
        <Footer
          siteSettings={siteSettings}
          footerLinks={footerLinks}
        />
      </div>
    </main>
  );
}
