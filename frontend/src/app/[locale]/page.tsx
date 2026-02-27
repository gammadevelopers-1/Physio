//page.tsx
import { setRequestLocale } from "next-intl/server";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Partners from "@/components/Partners";
import FeaturedCourses from "@/components/FeaturedCourses";
import BecomeTrainer from "@/components/BecomeTrainer";
import ExpertInstructors from "@/components/ExpertInstructors";
import Testimonials from "@/components/Testimonials";
import CTASection from "@/components/CTASection";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import { getHomePageData } from "@/lib/strapi";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { hasDynamicZoneBlocks } from "@/lib/strapi/block-utils";
import type { SideLoadedData } from "@/lib/strapi/types";

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

  const useDynamicZone = hasDynamicZoneBlocks(homePage?.blocks);

  const sideLoadedData: SideLoadedData = {
    partners: partners || [],
    featuredCourses: featuredCourses || [],
    instructors: instructors || [],
    testimonials: testimonials || [],
  };

  return (
    <main className="min-h-screen bg-[var(--surface)] pb-16 lg:pb-0">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} />
      {useDynamicZone ? (
        <BlockRenderer blocks={homePage!.blocks!} sideLoadedData={sideLoadedData} />
      ) : (
        <>
          <Hero data={homePage} />
          <Partners partners={partners} sectionTitle={homePage?.partnersSectionTitle} />
          <FeaturedCourses courses={featuredCourses} sectionData={homePage} />
          <BecomeTrainer data={homePage} />
          <ExpertInstructors instructors={instructors} sectionData={homePage} />
          <Testimonials testimonials={testimonials} sectionData={homePage} />
          {/* CTASection and Footer only shown on desktop (1024px+) */}
          <div className="hidden lg:block">
            <CTASection data={homePage} />
          </div>
        </>
      )}
      <div className="hidden lg:block">
        <Footer
          siteSettings={siteSettings}
          footerLinks={footerLinks}
        />
      </div>
      <WhatsAppButton />
    </main>
  );
}
