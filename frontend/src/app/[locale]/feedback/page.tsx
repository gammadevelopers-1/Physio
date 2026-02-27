import Navbar from "@/components/Navbar";
import FeedbackForm from "@/components/FeedbackForm";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import { setRequestLocale } from "next-intl/server";
import { getFeedbackPageData } from "@/lib/strapi";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { hasDynamicZoneBlocks } from "@/lib/strapi/block-utils";
import type { SideLoadedData } from "@/lib/strapi/types";

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const {
    feedbackPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  } = await getFeedbackPageData(locale);

  const useDynamicZone = hasDynamicZoneBlocks(feedbackPage?.blocks);

  const sideLoadedData: SideLoadedData = { partners: [], featuredCourses: [], instructors: [], testimonials: [] };

  return (
    <main className="min-h-screen bg-[var(--surface)] pb-16 lg:pb-0">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} />
      {useDynamicZone ? (
        <BlockRenderer blocks={feedbackPage!.blocks!} sideLoadedData={sideLoadedData} />
      ) : (
        <FeedbackForm strapiData={feedbackPage} />
      )}
      <div className="hidden lg:block">
        <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
      </div>
      <WhatsAppButton />
    </main>
  );
}
