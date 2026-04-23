import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PolicyPageLayout from "@/components/PolicyPageLayout";
import { setRequestLocale } from "next-intl/server";
import { getTermsPageData } from "@/lib/strapi";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { getBlocksAtPosition } from "@/lib/strapi/block-utils";
import type { SideLoadedData } from "@/lib/strapi/types";

export default async function TermsAndConditions({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const isRTL = locale === "ar";

  const {
    policyPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  } = await getTermsPageData(locale);

  // Strict Strapi only — no translation fallback anywhere
  const sections = policyPage?.sections?.length
    ? policyPage.sections.map((s) => ({
        sectionId: s.sectionId,
        sidebarLabel: s.sidebarLabel,
        title: s.title,
        content: s.content,
      }))
    : [];

  const pageTitle = policyPage?.title || "";
  const pageLastUpdated = policyPage?.lastUpdated || "";
  const emptyMessage = isRTL
    ? "جاري تحديث هذه السياسة — يرجى المراجعة لاحقاً"
    : "This policy is being updated — please check back soon";

  const blocks = policyPage?.blocks;

  const sideLoadedData: SideLoadedData = { partners: [], featuredCourses: [], instructors: [], testimonials: [] };

  return (
    <main id="main-content" className="min-h-screen bg-[var(--surface-default)] pb-20 lg:pb-0">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} footerLinks={footerLinks} />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'top')} sideLoadedData={sideLoadedData} />
      <PolicyPageLayout
        title={pageTitle}
        lastUpdated={pageLastUpdated}
        sections={sections}
        isRTL={isRTL}
        emptyMessage={emptyMessage}
      />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'after-section-1')} sideLoadedData={sideLoadedData} />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'bottom')} sideLoadedData={sideLoadedData} />
      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
    </main>
  );
}
