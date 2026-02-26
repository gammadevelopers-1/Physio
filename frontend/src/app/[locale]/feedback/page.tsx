import Navbar from "@/components/Navbar";
import FeedbackForm from "@/components/FeedbackForm";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import { setRequestLocale } from "next-intl/server";
import { getFeedbackPageData } from "@/lib/strapi";

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const {
    feedbackPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  } = await getFeedbackPageData(locale);

  return (
    <main id="main-content" className="min-h-screen bg-[var(--surface)] pb-16 lg:pb-0">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} />
      <FeedbackForm strapiData={feedbackPage} />
      <div className="hidden lg:block">
        <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
      </div>
      <WhatsAppButton />
    </main>
  );
}
