"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  Globe,
  Search,
  ShoppingCart,
  Menu,
  X,
} from "lucide-react";
import BottomNav from "./BottomNav";
import type { SiteSettings, NavigationLink } from "@/lib/strapi/types";
import { getStrapiMediaUrl } from "@/lib/strapi/client";
import { UserMenu } from "./UserMenu";
import { useAuth } from "@/contexts";
import { usePlatformLocale } from "@/contexts/PlatformLocaleContext";
import { usePlatformGeneral } from "@/contexts/PlatformGeneralContext";
import { profileApi } from "@/lib/api";

interface NavbarProps {
  siteSettings?: SiteSettings | null;
  navLinks?: NavigationLink[];
  footerLinks?: {
    platform: NavigationLink[];
    organization: NavigationLink[];
    support: NavigationLink[];
  };
}

const Navbar = ({ siteSettings, navLinks = [], footerLinks }: NavbarProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const t = useTranslations("navbar");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const isRTL = locale === "ar";
  const { isAuthenticated, isLoading } = useAuth();
  const { allowedLanguages } = usePlatformLocale();
  const platformGeneral = usePlatformGeneral();
  const showLocaleToggle = allowedLanguages.length > 1;

  // Logo comes strictly from Strapi — if empty, the site name text is shown instead.
  // Site name prefers the admin's Settings → General → Platform Name (per locale),
  // falling back to Strapi siteName.
  const logoUrl = siteSettings?.logo?.url ? getStrapiMediaUrl(siteSettings.logo.url) : null;
  const adminName =
    locale === "ar" ? platformGeneral.platformNameAr : platformGeneral.platformName;
  const siteName = adminName || siteSettings?.siteName || "";

  const switchLocale = async () => {
    const newLocale = locale === "en" ? "ar" : "en";
    const pathWithoutLocale = pathname.replace(`/${locale}`, "");
    // Show overlay + progress bar to mask the RTL/LTR flip flash
    (window as unknown as { __showLocaleSwitchOverlay?: () => void }).__showLocaleSwitchOverlay?.();
    (window as unknown as { __navProgressStart?: () => void }).__navProgressStart?.();
    if (isAuthenticated) {
      await profileApi.update({ language: newLocale }).catch(() => {});
    }
    router.push(`/${newLocale}${pathWithoutLocale}`);
  };

  return (
    <nav className="sticky top-0 z-50 w-full bg-[var(--color-navbar-bg)] shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] px-4 py-3 lg:px-16 lg:py-5">
      {/* Main container - dir="rtl" on html handles the RTL layout automatically */}
      <div className="flex items-center justify-between w-full">
        {/* Logo + Nav Links (appears on right side in RTL due to dir="rtl") */}
        <div className="flex items-center gap-8">
          {/* Logo — Strapi image, or site name text fallback, nothing hardcoded */}
          {logoUrl ? (
            <Link href={`/${locale}`} className="relative h-10 w-10 lg:h-12 lg:w-12 shrink-0">
              <Image
                src={logoUrl}
                alt={siteName || "Logo"}
                width={48}
                height={48}
                unoptimized={logoUrl.startsWith('http')}
                className="object-contain"
              />
            </Link>
          ) : siteName ? (
            <Link href={`/${locale}`} className="font-semibold text-lg text-[var(--color-navbar-text)] shrink-0">
              {siteName}
            </Link>
          ) : null}

          {/* Nav Links — Strapi only, no hardcoded menu */}
          {navLinks.length > 0 && (
            <div className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.id}
                  href={link.url.startsWith('/') ? `/${locale}${link.url.replace(/^\/(en|ar)/, '')}` : link.url}
                  className="text-[var(--color-navbar-text)] text-base leading-6 hover:text-[var(--color-primary)] transition-colors whitespace-nowrap"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Actions (appears on left side in RTL due to dir="rtl") */}
        <div className="flex items-center gap-4">
          {/* Language Toggle — hidden when only one locale is allowed */}
          {showLocaleToggle && (
            <button
              onClick={switchLocale}
              className="flex items-center gap-2 text-[var(--color-icon)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
            >
              <Globe className="w-5 h-5" strokeWidth={1.67} />
              <span className="text-base leading-6">
                {t("languageToggle")}
              </span>
            </button>
          )}

          {/* Separator - Hidden on mobile/tablet */}
          <div className="hidden lg:block h-6 w-px bg-[var(--on-surface-variant)] opacity-30" />

          {/* Search Icon - Hidden on mobile/tablet; gated by Strapi toggle */}
          {siteSettings?.showSearchBar !== false && (
            <Link
              href={`/${locale}/search`}
              className="hidden lg:flex items-center justify-center text-[var(--color-icon)] hover:text-[var(--color-primary)] transition-colors"
            >
              <Search className="w-5 h-5" strokeWidth={1.67} />
            </Link>
          )}

          {/* Cart Icon - Hidden on mobile/tablet */}
          <Link
            href={`/${locale}/checkout`}
            className="hidden lg:flex items-center justify-center text-[var(--color-icon)] hover:text-[var(--color-primary)] transition-colors"
          >
            <ShoppingCart className="w-5 h-5" strokeWidth={1.67} />
          </Link>

          {/* User Menu or Get Started Button - Hidden on mobile/tablet */}
          {!isLoading && (
            isAuthenticated ? (
              <div className="hidden lg:block">
                <UserMenu />
              </div>
            ) : (
              <Link
                href={`/${locale}/signup`}
                className="hidden lg:flex items-center justify-center h-10 px-5 py-2 btn-gold text-[var(--on-surface-inverse)] rounded-xl text-sm font-medium min-w-[80px]"
              >
                {t("getStarted")}
              </Link>
            )
          )}

          {/* Hamburger Menu - Visible only on mobile/tablet */}
          <button
            className="flex lg:hidden items-center justify-center text-[var(--color-icon)] hover:text-[var(--color-primary)] transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" strokeWidth={1.67} />
            ) : (
              <Menu className="w-6 h-6" strokeWidth={1.67} />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-[var(--color-navbar-bg)] border-t border-[var(--outline-subtle)] shadow-lg">
          <div className="flex flex-col px-4 py-4">
            {/* Mobile Nav Links — Strapi only */}
            {navLinks.length > 0 &&
              navLinks.map((link) => (
                <Link
                  key={link.id}
                  href={link.url.startsWith('/') ? `/${locale}${link.url.replace(/^\/(en|ar)/, '')}` : link.url}
                  className="py-3 text-[var(--color-navbar-text)] text-base leading-6 hover:text-[var(--color-primary)] transition-colors border-b border-[var(--outline-subtle)]"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}

            {/* Mobile Action Buttons */}
            <div className="flex items-center gap-4 pt-4">
              {siteSettings?.showSearchBar !== false && (
                <Link
                  href={`/${locale}/search`}
                  className="flex items-center justify-center text-[var(--color-icon)] hover:text-[var(--color-primary)] transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <Search className="w-5 h-5" strokeWidth={1.67} />
                </Link>
              )}
              <Link
                href={`/${locale}/checkout`}
                className="flex items-center justify-center text-[var(--color-icon)] hover:text-[var(--color-primary)] transition-colors"
              >
                <ShoppingCart className="w-5 h-5" strokeWidth={1.67} />
              </Link>
            </div>

            {/* User Menu or Get Started Button */}
            {!isLoading && (
              isAuthenticated ? (
                <div className="mt-4 pt-4 border-t border-[var(--outline-subtle)]">
                  <UserMenu />
                </div>
              ) : (
                <Link
                  href={`/${locale}/signup`}
                  className="mt-4 flex items-center justify-center h-11 px-5 py-2 btn-gold text-[var(--on-surface-inverse)] rounded-xl text-sm font-medium w-full"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {t("getStarted")}
                </Link>
              )
            )}
          </div>
        </div>
      )}
      <BottomNav siteSettings={siteSettings} footerLinks={footerLinks} />
    </nav>
  );
};

export default Navbar;
