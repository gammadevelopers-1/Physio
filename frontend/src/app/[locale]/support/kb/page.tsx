import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PublicKBContent from "@/components/support/PublicKBContent";
import { setRequestLocale } from "next-intl/server";
import { getSupportPageData } from "@/lib/strapi";

export const metadata = { title: "Knowledge Base | PhysioGuidance" };

export default async function KBPage({
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
      className="min-h-screen bg-[var(--color-surface-page)] pb-16 lg:pb-0"
    >
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} />
      <PublicKBContent />
      <div className="hidden lg:block">
        <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
      </div>
    </main>
  );
}
