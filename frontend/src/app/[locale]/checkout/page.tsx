import { setRequestLocale } from "next-intl/server";
import { getSiteSettings, getNavbarLinks, getFooterLinks } from "@/lib/strapi";
import CheckoutPageClient from "./CheckoutPageClient";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
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
    <CheckoutPageClient
      siteSettings={siteSettings}
      navbarLinks={navbarLinks}
      footerLinks={footerLinks}
    />
  );
}
