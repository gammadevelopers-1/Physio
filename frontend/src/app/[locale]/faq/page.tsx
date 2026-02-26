import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FAQContent from "@/components/FAQContent";
import { setRequestLocale } from "next-intl/server";
import { getFAQPageData } from "@/lib/strapi";

export default async function FAQPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const {
    faqPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  } = await getFAQPageData(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--surface-intense)] pb-20 lg:pb-0">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} />

      <FAQContent strapiData={faqPage} />

      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
    </main>
  );
}
