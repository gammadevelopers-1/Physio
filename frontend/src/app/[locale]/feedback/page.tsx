import Navbar from "@/components/Navbar";
import FeedbackForm from "@/components/FeedbackForm";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import { setRequestLocale } from "next-intl/server";
import { getFeedbackPageData } from "@/lib/strapi";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { getBlocksAtPosition } from "@/lib/strapi/block-utils";
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

  const blocks = feedbackPage?.blocks;

  const sideLoadedData: SideLoadedData = { partners: [], featuredCourses: [], instructors: [], testimonials: [] };

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)] pb-16 lg:pb-0">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} footerLinks={footerLinks} />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'top')} sideLoadedData={sideLoadedData} />
      <FeedbackForm strapiData={feedbackPage} />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'after-section-1')} sideLoadedData={sideLoadedData} />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'bottom')} sideLoadedData={sideLoadedData} />
      <div className="hidden lg:block">
        <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
      </div>
      <WhatsAppButton phoneNumber={siteSettings?.whatsappNumber} />
    </main>
  );
}
