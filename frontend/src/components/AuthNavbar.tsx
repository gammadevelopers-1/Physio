"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Globe, Search, ShoppingCart, Menu, X } from "lucide-react";

const AuthNavbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const t = useTranslations("navbar");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const isRTL = locale === "ar";

  const switchLocale = () => {
    const newLocale = locale === "en" ? "ar" : "en";
    const pathWithoutLocale = pathname.replace(`/${locale}`, "");
    (window as unknown as { __showLocaleSwitchOverlay?: () => void }).__showLocaleSwitchOverlay?.();
    (window as unknown as { __navProgressStart?: () => void }).__navProgressStart?.();
    router.push(`/${newLocale}${pathWithoutLocale}`);
  };

  return (
    <nav
      className="sticky top-0 z-50 w-full bg-[var(--color-surface-page)] shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] px-4 py-3 md:px-16 md:py-5"
    >
      <div className="flex items-center justify-between w-full">
        {/* Left: Logo + Nav Links */}
        <div className="flex items-center gap-8">
          {/* Logo */}
          <Link href={`/${locale}`} className="relative h-8 w-8 md:h-12 md:w-12">
            <Image
              src="/images/logo.png"
              alt="PhysioGuidance Logo"
              width={48}
              height={48}
              className="object-contain"
            />
          </Link>

          {/* Nav Links - Hidden on mobile */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              href={`/${locale}`}
              className="text-[var(--on-surface-variant)] text-[length:var(--typeface-font-styles-paragraph-text)] leading-6 hover:text-[var(--on-surface-default)] transition-colors"
            >
              {t("home")}
            </Link>

            <Link
              href={`/${locale}/courses`}
              className="text-[var(--on-surface-variant)] text-[length:var(--typeface-font-styles-paragraph-text)] leading-6 hover:text-[var(--on-surface-default)] transition-colors whitespace-nowrap"
            >
              {t("courses")}
            </Link>

            <Link
              href={`/${locale}/become-trainer`}
              className="text-[var(--on-surface-variant)] text-[length:var(--typeface-font-styles-paragraph-text)] leading-6 hover:text-[var(--on-surface-default)] transition-colors"
            >
              {t("becomeTrainer")}
            </Link>

            <Link
              href={`/${locale}/archived`}
              className="text-[var(--on-surface-variant)] text-[length:var(--typeface-font-styles-paragraph-text)] leading-6 hover:text-[var(--on-surface-default)] transition-colors"
            >
              {t("archive")}
            </Link>

            <Link
              href={`/${locale}/blogs`}
              className="text-[var(--on-surface-variant)] text-[length:var(--typeface-font-styles-paragraph-text)] leading-6 hover:text-[var(--on-surface-default)] transition-colors"
            >
              {t("blogs")}
            </Link>

            <Link
              href={`/${locale}/about`}
              className="text-[var(--on-surface-variant)] text-[length:var(--typeface-font-styles-paragraph-text)] leading-6 hover:text-[var(--on-surface-default)] transition-colors"
            >
              {t("about")}
            </Link>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4">
          {/* Language Toggle - Always visible */}
          <button
            onClick={switchLocale}
            className="flex items-center gap-2 text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors cursor-pointer"
          >
            <span className="text-[length:var(--typeface-font-styles-paragraph-text)] leading-6">
              {t("languageToggle")}
            </span>
            <Globe className="w-5 h-5" strokeWidth={1.67} />
          </button>

          {/* Separator - Hidden on mobile */}
          <div className="hidden md:block h-6 w-px bg-[var(--on-surface-variant)] opacity-30" />

          {/* Search Icon - Hidden on mobile */}
          <Link
            href={`/${locale}/search`}
            className="hidden md:flex items-center justify-center text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors"
          >
            <Search className="w-5 h-5" strokeWidth={1.67} />
          </Link>

          {/* Cart Icon - Hidden on mobile */}
          <Link
            href={`/${locale}/checkout`}
            className="hidden md:flex items-center justify-center text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors"
          >
            <ShoppingCart className="w-5 h-5" strokeWidth={1.67} />
          </Link>

          {/* Get Started Button - Hidden on mobile */}
          <Link
            href={`/${locale}/signup`}
            className="hidden md:flex items-center justify-center h-10 px-5 py-2 btn-gold text-[var(--on-surface-inverse)] rounded-xl text-sm font-medium"
          >
            {t("getStarted")}
          </Link>

          {/* Hamburger Menu - Visible on mobile for auth pages */}
          <button
            className="flex md:hidden items-center justify-center text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors"
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
        <div className="md:hidden absolute top-full left-0 right-0 bg-[var(--surface-intense)] border-t border-[var(--outline-subtle)] shadow-lg">
          <div className="flex flex-col px-4 py-4">
            {/* Mobile Nav Links */}
            <Link
              href={`/${locale}`}
              className="py-3 text-[var(--on-surface-variant)] text-[length:var(--typeface-font-styles-paragraph-text)] leading-6 hover:text-[var(--on-surface-default)] transition-colors border-b border-[var(--outline-subtle)]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("home")}
            </Link>

            <Link
              href={`/${locale}/courses`}
              className="py-3 text-[var(--on-surface-variant)] text-[length:var(--typeface-font-styles-paragraph-text)] leading-6 hover:text-[var(--on-surface-default)] transition-colors border-b border-[var(--outline-subtle)]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("courses")}
            </Link>

            <Link
              href={`/${locale}/become-trainer`}
              className="py-3 text-[var(--on-surface-variant)] text-[length:var(--typeface-font-styles-paragraph-text)] leading-6 hover:text-[var(--on-surface-default)] transition-colors border-b border-[var(--outline-subtle)]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("becomeTrainer")}
            </Link>

            <Link
              href={`/${locale}/archived`}
              className="py-3 text-[var(--on-surface-variant)] text-[length:var(--typeface-font-styles-paragraph-text)] leading-6 hover:text-[var(--on-surface-default)] transition-colors border-b border-[var(--outline-subtle)]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("archive")}
            </Link>

            <Link
              href={`/${locale}/blogs`}
              className="py-3 text-[var(--on-surface-variant)] text-[length:var(--typeface-font-styles-paragraph-text)] leading-6 hover:text-[var(--on-surface-default)] transition-colors border-b border-[var(--outline-subtle)]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("blogs")}
            </Link>

            <Link
              href={`/${locale}/about`}
              className="py-3 text-[var(--on-surface-variant)] text-[length:var(--typeface-font-styles-paragraph-text)] leading-6 hover:text-[var(--on-surface-default)] transition-colors border-b border-[var(--outline-subtle)]"
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

            {/* Get Started Button */}
            <Link
              href={`/${locale}/signup`}
              className="mt-4 flex items-center justify-center h-11 px-5 py-2 btn-gold text-[var(--on-surface-inverse)] rounded-xl text-sm font-medium w-full"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {t("getStarted")}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default AuthNavbar;
