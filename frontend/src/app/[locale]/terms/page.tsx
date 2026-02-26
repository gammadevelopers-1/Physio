import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PolicyPageLayout from "@/components/PolicyPageLayout";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getTermsPageData } from "@/lib/strapi";

export default async function TermsAndConditions({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "termsPage" });
  const isRTL = locale === "ar";

  const {
    policyPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  } = await getTermsPageData(locale);

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
          sectionId: t("sections.introduction.id"),
          sidebarLabel: t("sections.introduction.label"),
          title: t("sections.introduction.title"),
          content: t("sections.introduction.content"),
        },
        {
          sectionId: t("sections.medicalDisclaimer.id"),
          sidebarLabel: t("sections.medicalDisclaimer.label"),
          title: t("sections.medicalDisclaimer.title"),
          content: `${t("sections.medicalDisclaimer.intro")}\n\n- ${t("sections.medicalDisclaimer.items.item1")}\n- ${t("sections.medicalDisclaimer.items.item2")}`,
        },
        {
          sectionId: t("sections.userAccounts.id"),
          sidebarLabel: t("sections.userAccounts.label"),
          title: t("sections.userAccounts.title"),
          content: `${t("sections.userAccounts.accountResponsibility")}\n\n${t("sections.userAccounts.oneUserOneAccount")}\n\n${t("sections.userAccounts.unauthorizedAccess")}`,
        },
        {
          sectionId: t("sections.payments.id"),
          sidebarLabel: t("sections.payments.label"),
          title: t("sections.payments.title"),
          content: `${t("sections.payments.currency")}\n\n${t("sections.payments.vat")}\n\n${t("sections.payments.paymentMethods")}`,
        },
        {
          sectionId: t("sections.intellectualProperty.id"),
          sidebarLabel: t("sections.intellectualProperty.label"),
          title: t("sections.intellectualProperty.title"),
          content: `${t("sections.intellectualProperty.intro")}\n\n- ${t("sections.intellectualProperty.items.item1")}`,
        },
        {
          sectionId: t("sections.limitation.id"),
          sidebarLabel: t("sections.limitation.label"),
          title: t("sections.limitation.title"),
          content: `${t("sections.limitation.intro")}\n\n- ${t("sections.limitation.items.item1")}\n- ${t("sections.limitation.items.item2")}\n- ${t("sections.limitation.items.item3")}`,
        },
        {
          sectionId: t("sections.termination.id"),
          sidebarLabel: t("sections.termination.label"),
          title: t("sections.termination.title"),
          content: t("sections.termination.content"),
        },
        {
          sectionId: t("sections.governingLaw.id"),
          sidebarLabel: t("sections.governingLaw.label"),
          title: t("sections.governingLaw.title"),
          content: t("sections.governingLaw.content"),
        },
        {
          sectionId: t("sections.contact.id"),
          sidebarLabel: t("sections.contact.label"),
          title: t("sections.contact.title"),
          content: t("sections.contact.content"),
        },
      ];

  const pageTitle = policyPage?.title || t("title");
  const pageLastUpdated = policyPage?.lastUpdated || t("lastUpdated");

  return (
    <main id="main-content" className="min-h-screen bg-[var(--surface-default)] pb-20 lg:pb-0">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} />
      <PolicyPageLayout
        title={pageTitle}
        lastUpdated={pageLastUpdated}
        sections={sections}
        isRTL={isRTL}
      />
      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
    </main>
  );
}
