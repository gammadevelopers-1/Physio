import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import NELCContent from "@/components/NELCContent";
import { setRequestLocale } from "next-intl/server";
import { getNELCPageData } from "@/lib/strapi";

export default async function NELCPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const {
    nelcPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  } = await getNELCPageData(locale);

  return (
    <main className="min-h-screen bg-white pb-20 lg:pb-0">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} />
      <NELCContent strapiData={nelcPage} />
      <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
    </main>
  );
}
