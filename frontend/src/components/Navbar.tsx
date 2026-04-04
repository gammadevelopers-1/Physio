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

interface NavbarProps {
  siteSettings?: SiteSettings | null;
  navLinks?: NavigationLink[];
}

const Navbar = ({ siteSettings, navLinks = [] }: NavbarProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const t = useTranslations("navbar");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const isRTL = locale === "ar";
  const { isAuthenticated, isLoading } = useAuth();

  // Get logo URL from Strapi or use fallback
  const logoUrl = siteSettings?.logo?.url
    ? getStrapiMediaUrl(siteSettings.logo.url)
    : "/images/logo.png";

  const switchLocale = () => {
    const newLocale = locale === "en" ? "ar" : "en";
    const pathWithoutLocale = pathname.replace(`/${locale}`, "");
    router.push(`/${newLocale}${pathWithoutLocale}`);
    if (isAuthenticated) {
      import("@/lib/api").then(({ profileApi }) => profileApi.update({ language: newLocale }).catch(() => {}));
    }
  };

  return (
    <nav className="sticky top-0 z-50 w-full bg-[var(--surface-intense)] shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] px-4 py-3 lg:px-16 lg:py-5">
      {/* Main container - dir="rtl" on html handles the RTL layout automatically */}
      <div className="flex items-center justify-between w-full">
        {/* Logo + Nav Links (appears on right side in RTL due to dir="rtl") */}
        <div className="flex items-center gap-8">
          {/* Logo */}
          <Link href={`/${locale}`} className="relative h-10 w-10 lg:h-12 lg:w-12 shrink-0">
            <Image
              src={logoUrl}
              alt={siteSettings?.siteName || "PhysioGuidance Logo"}
              width={48}
              height={48}
              unoptimized={logoUrl.startsWith('http')}
              className="object-contain"
            />
          </Link>

          {/* Nav Links - Hidden on mobile/tablet */}
          <div className="hidden lg:flex items-center gap-8">
            <Link
              href={`/${locale}`}
              className="text-[var(--on-surface-variant)] text-base leading-6 hover:text-[var(--on-surface-default)] transition-colors whitespace-nowrap"
            >
              {t("home")}
            </Link>

            {/* Courses Link */}
            <Link
              href={`/${locale}/courses`}
              className="text-[var(--on-surface-variant)] text-base leading-6 hover:text-[var(--on-surface-default)] transition-colors whitespace-nowrap"
            >
              {t("courses")}
            </Link>

            <Link
              href={`/${locale}/become-trainer`}
              className="text-[var(--on-surface-variant)] text-base leading-6 hover:text-[var(--on-surface-default)] transition-colors whitespace-nowrap"
            >
              {t("becomeTrainer")}
            </Link>

            <Link
              href={`/${locale}/archived`}
              className="text-[var(--on-surface-variant)] text-base leading-6 hover:text-[var(--on-surface-default)] transition-colors whitespace-nowrap"
            >
              {t("archive")}
            </Link>

            <Link
              href={`/${locale}/blogs`}
              className="text-[var(--on-surface-variant)] text-base leading-6 hover:text-[var(--on-surface-default)] transition-colors whitespace-nowrap"
            >
              {t("blogs")}
            </Link>

            <Link
              href={`/${locale}/about`}
              className="text-[var(--on-surface-variant)] text-base leading-6 hover:text-[var(--on-surface-default)] transition-colors whitespace-nowrap"
            >
              {t("about")}
            </Link>
          </div>
        </div>

        {/* Actions (appears on left side in RTL due to dir="rtl") */}
        <div className="flex items-center gap-4">
          {/* Language Toggle - Always visible */}
          <button
            onClick={switchLocale}
            className="flex items-center gap-2 text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors cursor-pointer"
          >
            <Globe className="w-5 h-5" strokeWidth={1.67} />
            <span className="text-base leading-6">
              {t("languageToggle")}
            </span>
          </button>

          {/* Separator - Hidden on mobile/tablet */}
          <div className="hidden lg:block h-6 w-px bg-[var(--on-surface-variant)] opacity-30" />

          {/* Search Icon - Hidden on mobile/tablet */}
          <Link
            href={`/${locale}/search`}
            className="hidden lg:flex items-center justify-center text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors"
          >
            <Search className="w-5 h-5" strokeWidth={1.67} />
          </Link>

          {/* Cart Icon - Hidden on mobile/tablet */}
          <Link
            href={`/${locale}/checkout`}
            className="hidden lg:flex items-center justify-center text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors"
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
            className="flex lg:hidden items-center justify-center text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors"
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
        <div className="lg:hidden absolute top-full left-0 right-0 bg-[var(--surface-intense)] border-t border-[var(--outline-subtle)] shadow-lg">
          <div className="flex flex-col px-4 py-4">
            {/* Mobile Nav Links */}
            <Link
              href={`/${locale}`}
              className="py-3 text-[var(--on-surface-variant)] text-base leading-6 hover:text-[var(--on-surface-default)] transition-colors border-b border-[var(--outline-subtle)]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("home")}
            </Link>

            {/* Courses Link */}
            <Link
              href={`/${locale}/courses`}
              className="py-3 text-[var(--on-surface-variant)] text-base leading-6 hover:text-[var(--on-surface-default)] transition-colors border-b border-[var(--outline-subtle)]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("courses")}
            </Link>

            <Link
              href={`/${locale}/become-trainer`}
              className="py-3 text-[var(--on-surface-variant)] text-base leading-6 hover:text-[var(--on-surface-default)] transition-colors border-b border-[var(--outline-subtle)]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("becomeTrainer")}
            </Link>

            <Link
              href={`/${locale}/archived`}
              className="py-3 text-[var(--on-surface-variant)] text-base leading-6 hover:text-[var(--on-surface-default)] transition-colors border-b border-[var(--outline-subtle)]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("archive")}
            </Link>

            <Link
              href={`/${locale}/blogs`}
              className="py-3 text-[var(--on-surface-variant)] text-base leading-6 hover:text-[var(--on-surface-default)] transition-colors border-b border-[var(--outline-subtle)]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("blogs")}
            </Link>

            <Link
              href={`/${locale}/about`}
              className="py-3 text-[var(--on-surface-variant)] text-base leading-6 hover:text-[var(--on-surface-default)] transition-colors border-b border-[var(--outline-subtle)]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("about")}
            </Link>

            {/* Mobile Action Buttons */}
            <div className="flex items-center gap-4 pt-4">
              <Link
                href={`/${locale}/search`}
                className="flex items-center justify-center text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Search className="w-5 h-5" strokeWidth={1.67} />
              </Link>
              <Link
                href={`/${locale}/checkout`}
                className="flex items-center justify-center text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors"
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
      <BottomNav />
    </nav>
  );
};

export default Navbar;
