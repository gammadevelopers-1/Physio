import type { Metadata } from "next";
import { DM_Sans, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { getSiteSettings } from "@/lib/strapi";

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

export const metadata: Metadata = {
  title: "PhysioGuidance - Health Training & eLearning Courses",
  description:
    "Delivering NELC-compliant training, accredited programs, and live learning experiences for the health sector.",
};

const THEME_DEFAULTS = {
  primary: "#a37f49",
  primaryDark: "#6b4e24",
  surfacePage: "#EEF3F7",
  surfaceCard: "#e5edf4",
  textPrimary: "#171717",
  textSecondary: "#737373",
  borderColor: "#e5e7eb",
  borderSubtle: "#C8D5E1",
  iconColor: "#737373",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
    iconColor: settings?.themeIconColor || THEME_DEFAULTS.iconColor,
  };

  const themeStyle = `:root{--color-primary:${theme.primary};--color-primary-dark:${theme.primaryDark};--color-surface-page:${theme.surfacePage};--color-surface-card:${theme.surfaceCard};--color-text-primary:${theme.textPrimary};--color-text-secondary:${theme.textSecondary};--color-border:${theme.borderColor};--color-border-subtle:${theme.borderSubtle};--color-icon:${theme.iconColor};}`;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeStyle }} />
      </head>
      <body className={`${dmSans.variable} ${notoSansArabic.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
