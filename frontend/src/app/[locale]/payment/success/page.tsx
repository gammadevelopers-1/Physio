import { setRequestLocale } from "next-intl/server";
import { getSiteSettings, getNavbarLinks, getFooterLinks } from "@/lib/strapi";
import PaymentSuccessPageClient from "./PaymentSuccessPageClient";

export default async function PaymentSuccessPage({
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
    <PaymentSuccessPageClient
      siteSettings={siteSettings}
      navbarLinks={navbarLinks}
      footerLinks={footerLinks}
    />
  );
}
