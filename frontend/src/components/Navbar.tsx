"use client";

import { useEffect, useState } from "react";
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
import { useAuth, useCart } from "@/contexts";
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
  const { itemCount: cartCount } = useCart();
  const { allowedLanguages } = usePlatformLocale();
  const platformGeneral = usePlatformGeneral();
  const showLocaleToggle = allowedLanguages.length > 1;

  // Hide the cart count badge until after first client paint — the count
  // lives in localStorage, so server render is always 0 and showing the
  // badge before hydration flashes "0" before the real number.
  const [cartReady, setCartReady] = useState(false);
  useEffect(() => {
    setCartReady(true);
  }, []);

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
      {/* Main container - dir="rtl" on html handles the RTL layout
          automatically. Capped at 1440px + centered so logo/menu/actions
          don't spread edge-to-edge on ultra-wide displays. Outer <nav>
          keeps the sticky bg full-bleed. */}
      <div className="flex items-center justify-between w-full max-w-[1440px] mx-auto">
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
            href={`/${locale}/cart`}
            aria-label={t("cart") + (cartReady && cartCount > 0 ? ` (${cartCount})` : "")}
            className="relative hidden lg:flex items-center justify-center text-[var(--color-icon)] hover:text-[var(--color-primary)] transition-colors"
          >
            <ShoppingCart className="w-5 h-5" strokeWidth={1.67} />
            {cartReady && cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-[#DC2626] text-white text-[11px] font-semibold rounded-full flex items-center justify-center leading-none">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>

          {/* User Menu (avatar dropdown) or Get Started button.
              Always visible — on mobile users had to open the hamburger
              to reach either, which buried the two most important actions
              on the site (log in, sign up) two taps deep. Compact
              styling below `lg:` keeps them fitting alongside the
              hamburger + language toggle on narrow screens. */}
          {!isLoading && (
            isAuthenticated ? (
              <UserMenu />
            ) : (
              <Link
                href={`/${locale}/signup`}
                className="flex items-center justify-center h-9 lg:h-10 px-3 lg:px-5 py-2 btn-gold text-[var(--on-surface-inverse)] rounded-xl text-xs lg:text-sm font-medium whitespace-nowrap"
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
                href={`/${locale}/cart`}
                aria-label={t("cart") + (cartReady && cartCount > 0 ? ` (${cartCount})` : "")}
                onClick={() => setIsMobileMenuOpen(false)}
                className="relative flex items-center justify-center text-[var(--color-icon)] hover:text-[var(--color-primary)] transition-colors"
              >
                <ShoppingCart className="w-5 h-5" strokeWidth={1.67} />
                {cartReady && cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-[#DC2626] text-white text-[11px] font-semibold rounded-full flex items-center justify-center leading-none">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </Link>
            </div>

            {/* Avatar / Get Started are now always visible in the main
                navbar — no need to duplicate them inside the hamburger
                overlay. Users tapping the hamburger want Strapi nav
                links + Search/Cart shortcuts, not another login button. */}
          </div>
        </div>
      )}
      <BottomNav siteSettings={siteSettings} footerLinks={footerLinks} />
    </nav>
  );
};

export default Navbar;
