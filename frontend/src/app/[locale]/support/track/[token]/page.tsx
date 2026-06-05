import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GuestTicketTracker from "@/components/support/GuestTicketTracker";
import { setRequestLocale } from "next-intl/server";
import { getSupportPageData } from "@/lib/strapi";

// Tokenized guest tracking URLs must not be indexed.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function TrackTicketPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const { siteSettings, navbarLinks, footerLinks } =
    await getSupportPageData(locale);

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[var(--surface)] pb-16 lg:pb-0"
    >
      <Navbar siteSettings={siteSettings} navLinks={navbarLinks} />
      <GuestTicketTracker token={token} />
      <div className="hidden lg:block">
        <Footer siteSettings={siteSettings} footerLinks={footerLinks} />
      </div>
    </main>
  );
}
