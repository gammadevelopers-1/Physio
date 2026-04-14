import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PolicyPageLayout from "@/components/PolicyPageLayout";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getLearningPoliciesPageData } from "@/lib/strapi";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { getBlocksAtPosition } from "@/lib/strapi/block-utils";
import type { SideLoadedData } from "@/lib/strapi/types";

export default async function LearningPolicies({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "learningPoliciesPage" });
  const isRTL = locale === "ar";

  const {
    policyPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  } = await getLearningPoliciesPageData(locale);

  // Build sections from Strapi or fall back to translations
  const sections = policyPage?.sections?.length
    ? policyPage.sections.map((s) => ({
        sectionId: s.sectionId,
        sidebarLabel: s.sidebarLabel,
        title: s.title,
        content: s.content,
      }))
    : [
        {
          sectionId: t("sections.general.id"),
          sidebarLabel: t("sections.general.label"),
          title: t("sections.general.title"),
          content: t("sections.general.content"),
        },
        {
          sectionId: t("sections.attendance.id"),
          sidebarLabel: t("sections.attendance.label"),
          title: t("sections.attendance.title"),
          content: `${t("sections.attendance.intro")}\n\n- ${t("sections.attendance.items.item1")}\n- ${t("sections.attendance.items.item2")}\n- ${t("sections.attendance.items.item3")}`,
        },
        {
          sectionId: t("sections.assessment.id"),
          sidebarLabel: t("sections.assessment.label"),
          title: t("sections.assessment.title"),
          content: `${t("sections.assessment.passingScore")}\n\n${t("sections.assessment.retakePolicy")}\n\n${t("sections.assessment.feedback")}`,
        },
        {
          sectionId: t("sections.integrity.id"),
          sidebarLabel: t("sections.integrity.label"),
          title: t("sections.integrity.title"),
          content: `${t("sections.integrity.intro")}\n\n- ${t("sections.integrity.items.item1")}\n- ${t("sections.integrity.items.item2")}`,
        },
        {
          sectionId: t("sections.intellectual.id"),
          sidebarLabel: t("sections.intellectual.label"),
          title: t("sections.intellectual.title"),
          content: `${t("sections.intellectual.intro")}\n\n- ${t("sections.intellectual.items.item1")}\n- ${t("sections.intellectual.items.item2")}`,
        },
        {
          sectionId: t("sections.cancellation.id"),
          sidebarLabel: t("sections.cancellation.label"),
          title: t("sections.cancellation.title"),
          content: `${t("sections.cancellation.courseCancel")}\n\n${t("sections.cancellation.learnerWithdrawal")}\n\n- ${t("sections.cancellation.items.item1")}\n- ${t("sections.cancellation.items.item2")}`,
        },
        {
          sectionId: t("sections.technical.id"),
          sidebarLabel: t("sections.technical.label"),
          title: t("sections.technical.title"),
          content: `${t("sections.technical.intro")}\n\n- ${t("sections.technical.items.item1")}\n- ${t("sections.technical.items.item2")}\n- ${t("sections.technical.items.item3")}`,
        },
        {
          sectionId: t("sections.privacy.id"),
          sidebarLabel: t("sections.privacy.label"),
          title: t("sections.privacy.title"),
          content: `${t("sections.privacy.intro")}\n\n- ${t("sections.privacy.items.item1")}\n- ${t("sections.privacy.items.item2")}`,
        },
      ];

  const pageTitle = policyPage?.title || t("title");
  const pageLastUpdated = policyPage?.lastUpdated || t("lastUpdated");

  const blocks = policyPage?.blocks;

  const sideLoadedData: SideLoadedData = { partners: [], featuredCourses: [], instructors: [], testimonials: [] };

  return (
    <main id="main-content" className="min-h-screen bg-[var(--surface-default)] pb-20 lg:pb-0">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'top')} sideLoadedData={sideLoadedData} />
      <PolicyPageLayout
        title={pageTitle}
        lastUpdated={pageLastUpdated}
        sections={sections}
        isRTL={isRTL}
      />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'after-section-1')} sideLoadedData={sideLoadedData} />
      <BlockRenderer blocks={getBlocksAtPosition(blocks, 'bottom')} sideLoadedData={sideLoadedData} />
      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
    </main>
  );
}
