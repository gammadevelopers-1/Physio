import Navbar from "@/components/Navbar";
import ContactForm from "@/components/ContactForm";
import Footer from "@/components/Footer";
import { setRequestLocale } from "next-intl/server";
import { getContactPageData } from "@/lib/strapi";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { getBlocksAtPosition } from "@/lib/strapi/block-utils";
import type { SideLoadedData } from "@/lib/strapi/types";

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const {
    contactPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  } = await getContactPageData(locale);

  const blocks = contactPage?.blocks;

  const sideLoadedData: SideLoadedData = { partners: [], featuredCourses: [], instructors: [], testimonials: [] };

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)] pb-16 lg:pb-0">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} footerLinks={footerLinks} />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'top')} sideLoadedData={sideLoadedData} />
      <ContactForm strapiData={contactPage} />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'after-section-1')} sideLoadedData={sideLoadedData} />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'bottom')} sideLoadedData={sideLoadedData} />
      <div className="hidden lg:block">
        <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
      </div>
    </main>
  );
}
