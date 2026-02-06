import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BecomeTrainer from "@/components/BecomeTrainer";
import PartnersContent from "@/components/PartnersContent";
import { setRequestLocale } from "next-intl/server";
import { getPartnersPageData } from "@/lib/strapi";

export default async function AcademicPartnersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const {
    partnersPage,
    partners,
    siteSettings,
    navbarLinks,
    footerLinks,
  } = await getPartnersPageData(locale);

  return (
    <main className="min-h-screen bg-[var(--surface-default)] pb-20 lg:pb-0">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} />

      <PartnersContent partners={partners} strapiData={partnersPage} />

      <BecomeTrainer />

      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
    </main>
  );
}
