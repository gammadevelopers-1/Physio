import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { ClientProviders } from "@/components/providers/ClientProviders";
import { HtmlAttributesSetter } from "@/components/HtmlAttributesSetter";

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

  const isRTL = locale === "ar";

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <HtmlAttributesSetter lang={locale} dir={isRTL ? "rtl" : "ltr"} />
      <ClientProviders>
        <div className={isRTL ? "font-arabic" : ""}>
          {children}
        </div>
      </ClientProviders>
    </NextIntlClientProvider>
  );
}
