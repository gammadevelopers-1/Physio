import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CheckoutContent from "@/components/CheckoutContent";
import { setRequestLocale } from "next-intl/server";
import { getSiteSettings, getNavbarLinks, getFooterLinks } from "@/lib/strapi";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [siteSettings, navbarLinks, footerLinks] = await Promise.all([
    getSiteSettings(locale),
    getNavbarLinks(locale),
    getFooterLinks(locale),
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-surface-page)]">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} footerLinks={footerLinks} />
      <CheckoutContent />
      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
    </div>
  );
}
