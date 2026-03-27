import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import SupportPageContent from "@/components/support/SupportPageContent";
import { setRequestLocale } from "next-intl/server";
import { getSupportPageData } from "@/lib/strapi";

export default async function SupportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { siteSettings, navbarLinks, footerLinks } =
    await getSupportPageData(locale);

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[var(--surface)] pb-16 lg:pb-0"
    >
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} />
      <SupportPageContent />
      <div className="hidden lg:block">
        <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
      </div>
      <WhatsAppButton />
    </main>
  );
}
