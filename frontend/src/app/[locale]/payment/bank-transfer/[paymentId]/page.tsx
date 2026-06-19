import { setRequestLocale } from "next-intl/server";
import { getSiteSettings, getNavbarLinks, getFooterLinks } from "@/lib/strapi";
import BankTransferPageClient from "./BankTransferPageClient";

export default async function BankTransferPage({
  params,
}: {
  params: Promise<{ locale: string; paymentId: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [siteSettings, navbarLinks, footerLinks] = await Promise.all([
    getSiteSettings(locale).catch(() => null),
    getNavbarLinks(locale).catch(() => []),
    getFooterLinks(locale).catch(() => ({
      platform: [],
      organization: [],
      support: [],
    })),
  ]);

  return (
    <BankTransferPageClient
      siteSettings={siteSettings}
      navbarLinks={navbarLinks}
      footerLinks={footerLinks}
    />
  );
}
