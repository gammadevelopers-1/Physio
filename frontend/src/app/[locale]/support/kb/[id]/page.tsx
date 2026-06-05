import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import KbArticleDetail from "@/components/support/KbArticleDetail";
import { setRequestLocale } from "next-intl/server";
import { getSupportPageData } from "@/lib/strapi";

export const metadata = { title: "Help Article | PhysioGuidance" };

export default async function KbArticlePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const { siteSettings, navbarLinks, footerLinks } =
    await getSupportPageData(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--color-surface-page)] pb-16 lg:pb-0">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} />
      <KbArticleDetail articleId={id} />
      <div className="hidden lg:block">
        <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
      </div>
    </main>
  );
}
