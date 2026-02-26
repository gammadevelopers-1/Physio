import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CertificationsContent from "@/components/CertificationsContent";
import { setRequestLocale } from "next-intl/server";
import { getCertificationsPageData } from "@/lib/strapi";

export default async function CertificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const {
    certificationsPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  } = await getCertificationsPageData(locale);

  return (
    <main id="main-content" className="min-h-screen bg-white pb-20 lg:pb-0">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} />
      <CertificationsContent strapiData={certificationsPage} />
      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
    </main>
  );
}
