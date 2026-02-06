import Navbar from "@/components/Navbar";
import ContactForm from "@/components/ContactForm";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import { setRequestLocale } from "next-intl/server";
import { getContactPageData } from "@/lib/strapi";

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const {
    contactPage,
    siteSettings,
    navbarLinks,
    footerLinks,
  } = await getContactPageData(locale);

  return (
    <main className="min-h-screen bg-[var(--surface)] pb-16 lg:pb-0">
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} />
      <ContactForm strapiData={contactPage} />
      <div className="hidden lg:block">
        <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
      </div>
      <WhatsAppButton />
    </main>
  );
}
