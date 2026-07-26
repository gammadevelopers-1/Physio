import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CsatRatingPage from "@/components/support/CsatRatingPage";
import { getSupportPageData } from "@/lib/strapi";

// One-use tokenized survey links should never be indexed.
// If they leak via referrer / share, search engines must not crawl them.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function CsatSurveyPage({
  params,
}: {
  params: Promise<{ locale: string; surveyId: string }>;
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
      <CsatRatingPage />
      <div className="hidden lg:block">
        <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
      </div>
    </main>
  );
}
