import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { ClientProviders } from "@/components/providers/ClientProviders";
import { HtmlAttributesSetter } from "@/components/HtmlAttributesSetter";
import NavigationProgress from "@/components/NavigationProgress";
import LocaleSwitchOverlay from "@/components/LocaleSwitchOverlay";
import WhatsAppChatWidget from "@/components/WhatsAppChatWidget";
import { getSiteSettings } from "@/lib/strapi";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const settings = await getSiteSettings(locale).catch(() => null);

  const isRTL = locale === "ar";

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <HtmlAttributesSetter lang={locale} dir={isRTL ? "rtl" : "ltr"} />
      <ClientProviders>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-[#002D87] focus:text-white focus:rounded-lg focus:text-sm focus:font-medium focus:outline-none focus:ring-2 focus:ring-[#D4A520]"
        >
          {isRTL ? "انتقل إلى المحتوى الرئيسي" : "Skip to main content"}
        </a>
        <NavigationProgress />
        <LocaleSwitchOverlay />
        <div className={isRTL ? "font-arabic" : ""}>
          {children}
        </div>
        <WhatsAppChatWidget
          enabled={settings?.showWhatsappButton}
          phoneNumber={settings?.whatsappNumber}
          companyName={settings?.whatsappCompanyName}
          greeting={settings?.whatsappGreeting}
          replyTime={settings?.whatsappReplyTime}
          locale={locale}
        />
      </ClientProviders>
    </NextIntlClientProvider>
  );
}
