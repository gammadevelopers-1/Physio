import type { Metadata } from "next";
import { DM_Sans, Noto_Sans_Arabic } from "next/font/google";
import Script from "next/script";
import { headers } from "next/headers";
import "./globals.css";
import { getSiteSettings, getStrapiMediaUrl } from "@/lib/strapi";
import JsonLd from "@/components/seo/JsonLd";
import { organizationLD } from "@/lib/structured-data";

const META_PIXEL_ID = "1956469491660011";
const GA4_ID = "G-Z9DZXJQCWY";
const GTM_ID = "GTM-P8RKDMNL";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const notoSansArabic = Noto_Sans_Arabic({
  variable: "--font-noto-sans-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

const DEFAULT_TITLE = "PhysioGuidance - Health Training & eLearning Courses";
const DEFAULT_DESCRIPTION =
  "Delivering NELC-compliant training, accredited programs, and live learning experiences for the health sector.";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings().catch(() => null);
  const faviconUrl = settings?.favicon?.url ? getStrapiMediaUrl(settings.favicon.url) : null;
  const ogImageUrl = settings?.defaultOgImage?.url
    ? getStrapiMediaUrl(settings.defaultOgImage.url)
    : null;

  return {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    ...(faviconUrl && { icons: { icon: faviconUrl, shortcut: faviconUrl, apple: faviconUrl } }),
    ...(ogImageUrl && {
      openGraph: {
        title: DEFAULT_TITLE,
        description: DEFAULT_DESCRIPTION,
        images: [
          {
            url: ogImageUrl,
            width: settings?.defaultOgImage?.width || 1200,
            height: settings?.defaultOgImage?.height || 630,
            alt: settings?.defaultOgImage?.alternativeText || DEFAULT_TITLE,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: DEFAULT_TITLE,
        description: DEFAULT_DESCRIPTION,
        images: [ogImageUrl],
      },
    }),
  };
}

const THEME_DEFAULTS = {
  primary: "#a37f49",
  primaryDark: "#6b4e24",
  surfacePage: "#EEF3F7",
  surfaceCard: "#e5edf4",
  textPrimary: "#171717",
  textSecondary: "#737373",
  borderColor: "#e5e7eb",
  borderSubtle: "#C8D5E1",
  inputBorder: "#9CA3AF",
  inputFocus: "#a37f49",
  iconColor: "#737373",
  footerBackground: "#ffffff",
  buttonText: "#ffffff",
  navbarBackground: "#EEF3F7",
  navbarText: "#171717",
  footerHeading: "#171717",
  footerText: "#171717",
  starColor: "#F59E0B",
  starBorder: "#E5E7EB",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Per-request CSP nonce from middleware. Next auto-applies it to scripts it
  // controls, but we pass it explicitly to next/script so the inline tracking
  // bootstraps (GTM / GA4 / Meta Pixel) are accepted under the strict script-src.
  const h = await headers();
  const nonce = h.get("x-nonce") ?? undefined;
  // Locale from middleware (x-locale header) — drives <html lang dir> at SSR.
  // Falling back to "en" is safe because middleware always sets this header
  // for any route that reaches this layout.
  const locale = h.get("x-locale") === "ar" ? "ar" : "en";
  const dir = locale === "ar" ? "rtl" : "ltr";

  const settings = await getSiteSettings().catch(() => null);
  const theme = {
    primary: settings?.themePrimaryColor || THEME_DEFAULTS.primary,
    primaryDark: settings?.themePrimaryDark || THEME_DEFAULTS.primaryDark,
    surfacePage: settings?.themeSurfacePage || THEME_DEFAULTS.surfacePage,
    surfaceCard: settings?.themeSurfaceCard || THEME_DEFAULTS.surfaceCard,
    textPrimary: settings?.themeTextPrimary || THEME_DEFAULTS.textPrimary,
    textSecondary: settings?.themeTextSecondary || THEME_DEFAULTS.textSecondary,
    borderColor: settings?.themeBorderColor || THEME_DEFAULTS.borderColor,
    borderSubtle: settings?.themeBorderSubtle || THEME_DEFAULTS.borderSubtle,
    inputBorder:
      settings?.themeInputBorder ||
      settings?.themeBorderColor ||
      THEME_DEFAULTS.inputBorder,
    inputFocus:
      settings?.themeInputFocus ||
      settings?.themePrimaryColor ||
      THEME_DEFAULTS.inputFocus,
    iconColor: settings?.themeIconColor || THEME_DEFAULTS.iconColor,
    footerBackground: settings?.themeFooterBackground || THEME_DEFAULTS.footerBackground,
    buttonText: settings?.themeButtonText || THEME_DEFAULTS.buttonText,
    navbarBackground: settings?.themeNavbarBackground || THEME_DEFAULTS.navbarBackground,
    navbarText: settings?.themeNavbarText || THEME_DEFAULTS.navbarText,
    footerHeading: settings?.themeFooterHeading || THEME_DEFAULTS.footerHeading,
    footerText: settings?.themeFooterText || THEME_DEFAULTS.footerText,
    starColor: settings?.themeStarColor || THEME_DEFAULTS.starColor,
    starBorder: settings?.themeStarBorder || THEME_DEFAULTS.starBorder,
  };

  // Selector is `html:root` (not just `:root`) so this SSR-injected style
  // beats the fallback declarations in globals.css regardless of DOM load
  // order. Next 15 auto-hoists imported CSS `<link>` tags into <head>,
  // sometimes placing them AFTER JSX-rendered <style> children — same
  // specificity means globals.css was overriding the Strapi values for
  // any var that also has a fallback in globals.css (e.g.
  // --color-surface-page). Chaining `html:root` bumps specificity from
  // (0,0,1,0) to (0,0,1,1), which cascades over the globals fallbacks.
  // Body bg also set inline as a hard belt-and-suspenders — the body is
  // painted directly with the Strapi surfacePage regardless of any var
  // resolution issue on the client.
  const themeStyle = `html:root{--color-primary:${theme.primary};--color-primary-dark:${theme.primaryDark};--color-surface-page:${theme.surfacePage};--color-surface-card:${theme.surfaceCard};--color-text-primary:${theme.textPrimary};--color-text-secondary:${theme.textSecondary};--color-border:${theme.borderColor};--color-border-subtle:${theme.borderSubtle};--color-input-border:${theme.inputBorder};--color-input-focus:${theme.inputFocus};--color-icon:${theme.iconColor};--color-footer-bg:${theme.footerBackground};--color-button-text:${theme.buttonText};--color-navbar-bg:${theme.navbarBackground};--color-navbar-text:${theme.navbarText};--color-footer-heading:${theme.footerHeading};--color-footer-text:${theme.footerText};--color-star:${theme.starColor};--color-star-border:${theme.starBorder};}html:root body{background:${theme.surfacePage};}`;

  // Site-wide Organization LD — emitted once, at the document root, so
  // search engines associate every page back to the same publisher.
  const orgLogo = settings?.logo?.url ? getStrapiMediaUrl(settings.logo.url) : null;
  const orgSameAs = [
    settings?.facebookUrl,
    settings?.twitterUrl,
    settings?.linkedinUrl,
    settings?.instagramUrl,
  ].filter((u): u is string => !!u);
  const orgLd = organizationLD({
    name: settings?.siteName || undefined,
    logoUrl: orgLogo,
    sameAs: orgSameAs.length ? orgSameAs : undefined,
  });

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeStyle }} />
        <JsonLd id="ld-organization" data={orgLd} />
      </head>
      <body className={`${dmSans.variable} ${notoSansArabic.variable} antialiased`}>
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
            title="gtm-noscript"
          />
        </noscript>
        <Script id="gtm-base" strategy="afterInteractive" nonce={nonce}>{`
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');
        `}</Script>
        <Script
          id="ga4-loader"
          strategy="afterInteractive"
          nonce={nonce}
          src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
        />
        <Script id="ga4-init" strategy="afterInteractive" nonce={nonce}>{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA4_ID}');
        `}</Script>
        <Script id="meta-pixel" strategy="afterInteractive" nonce={nonce}>{`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${META_PIXEL_ID}');
          fbq('track', 'PageView');
        `}</Script>
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
            alt=""
          />
        </noscript>
        {children}
      </body>
    </html>
  );
}
