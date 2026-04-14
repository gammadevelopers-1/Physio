import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PolicyPageLayout from "@/components/PolicyPageLayout";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getPrivacyPolicyPageData } from "@/lib/strapi";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { getBlocksAtPosition } from "@/lib/strapi/block-utils";
import type { SideLoadedData } from "@/lib/strapi/types";

export default async function PrivacyPolicy({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "privacyPage" });
  const isRTL = locale === "ar";

  const {
    policyPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  } = await getPrivacyPolicyPageData(locale);

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
          sectionId: t("sections.generalTerms.id"),
          sidebarLabel: t("sections.generalTerms.label"),
          title: t("sections.generalTerms.title"),
          content: t("sections.generalTerms.content"),
        },
        {
          sectionId: t("sections.attendancePolicy.id"),
          sidebarLabel: t("sections.attendancePolicy.label"),
          title: t("sections.attendancePolicy.title"),
          content: `${t("sections.attendancePolicy.intro")}\n\n- ${t("sections.attendancePolicy.items.item1")}\n- ${t("sections.attendancePolicy.items.item2")}\n- ${t("sections.attendancePolicy.items.item3")}`,
        },
        {
          sectionId: t("sections.assessment.id"),
          sidebarLabel: t("sections.assessment.label"),
          title: t("sections.assessment.title"),
          content: `${t("sections.assessment.passingGrade")}\n\n${t("sections.assessment.retakePolicy")}\n\n${t("sections.assessment.feedback")}`,
        },
        {
          sectionId: t("sections.academicIntegrity.id"),
          sidebarLabel: t("sections.academicIntegrity.label"),
          title: t("sections.academicIntegrity.title"),
          content: `${t("sections.academicIntegrity.intro")}\n\n- ${t("sections.academicIntegrity.items.item1")}\n- ${t("sections.academicIntegrity.items.item2")}`,
        },
        {
          sectionId: t("sections.intellectualProperty.id"),
          sidebarLabel: t("sections.intellectualProperty.label"),
          title: t("sections.intellectualProperty.title"),
          content: `${t("sections.intellectualProperty.intro")}\n\n- ${t("sections.intellectualProperty.items.item1")}\n- ${t("sections.intellectualProperty.items.item2")}`,
        },
        {
          sectionId: t("sections.refundPolicy.id"),
          sidebarLabel: t("sections.refundPolicy.label"),
          title: t("sections.refundPolicy.title"),
          content: `${t("sections.refundPolicy.courseCancel")}\n\n${t("sections.refundPolicy.learnerWithdrawal")}\n\n- ${t("sections.refundPolicy.items.item1")}\n- ${t("sections.refundPolicy.items.item2")}`,
        },
        {
          sectionId: t("sections.technicalRequirements.id"),
          sidebarLabel: t("sections.technicalRequirements.label"),
          title: t("sections.technicalRequirements.title"),
          content: `${t("sections.technicalRequirements.intro")}\n\n- ${t("sections.technicalRequirements.items.item1")}\n- ${t("sections.technicalRequirements.items.item2")}\n- ${t("sections.technicalRequirements.items.item3")}`,
        },
        {
          sectionId: t("sections.privacyData.id"),
          sidebarLabel: t("sections.privacyData.label"),
          title: t("sections.privacyData.title"),
          content: `${t("sections.privacyData.intro")}\n\n- ${t("sections.privacyData.items.item1")}\n- ${t("sections.privacyData.items.item2")}`,
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
