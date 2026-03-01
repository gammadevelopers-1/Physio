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
    instructors,
    testimonials,
    navbarLinks,
    footerLinks,
  } = await getHomePageData(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--surface)] pb-16 lg:pb-0">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} />
      <Hero data={homePage} />
      <Partners partners={partners} sectionTitle={homePage?.partnersSectionTitle} />
      <FeaturedCourses sectionData={homePage} />
      <BecomeTrainer data={homePage} />
      <ExpertInstructors instructors={instructors} sectionData={homePage} />
      <Testimonials testimonials={testimonials} sectionData={homePage} />
      {/* CTASection and Footer only shown on desktop (1024px+) */}
      <div className="hidden lg:block">
        <CTASection data={homePage} />
        <Footer
          siteSettings={siteSettings}
          footerLinks={footerLinks}
        />
      </div>
      <WhatsAppButton />
    </main>
  );
}
