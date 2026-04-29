//bottom nav — mobile-only bottom tab bar + full-menu drawer
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import type { SiteSettings, NavigationLink } from "@/lib/strapi/types";
import { resolveHref } from "@/lib/href-utils";

interface BottomNavProps {
  siteSettings?: SiteSettings | null;
  footerLinks?: {
    platform: NavigationLink[];
    organization: NavigationLink[];
    support: NavigationLink[];
  };
}

const BottomNav = ({ siteSettings, footerLinks }: BottomNavProps) => {
  const pathname = usePathname();
  const t = useTranslations("bottomNav");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Bottom tab bar — 4 standard app nav items (icon + label + href)
  // Icons live in /public as SVGs; labels still use translations since
  // these are app-level navigation shortcuts, not editable content.
  const navItems = [
    { href: `/${locale}`, label: t("home"), icon: "/home-01.svg" },
    { href: `/${locale}/search`, label: t("search"), icon: "/search-lg.svg" },
    { href: `/${locale}/checkout`, label: t("cart"), icon: "/file-02.svg" },
  ];

  // Drawer content — ALL from Strapi
  const platformLinks = (footerLinks?.platform || []).map((l) => ({
    label: l.label,
    href: resolveHref(l.url, locale) || l.url,
  }));
  const organizationLinks = (footerLinks?.organization || []).map((l) => ({
    label: l.label,
    href: resolveHref(l.url, locale) || l.url,
  }));
  const supportLinks = (footerLinks?.support || []).map((l) => ({
    label: l.label,
    href: resolveHref(l.url, locale) || l.url,
  }));

  const platformTitle = siteSettings?.footerPlatformTitle || "";
  const organizationTitle = siteSettings?.footerOrganizationTitle || "";
  const supportTitle = siteSettings?.footerSupportTitle || "";
  const menuTitle = siteSettings?.footerMenuTitle || "";

  const hasPlatform = platformTitle || platformLinks.length > 0;
  const hasOrganization = organizationTitle || organizationLinks.length > 0;
  const hasSupport = supportTitle || supportLinks.length > 0;
  const hasDrawerContent = hasPlatform || hasOrganization || hasSupport;

  const handleLinkClick = () => {
    setIsDrawerOpen(false);
  };

  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <>
      <nav
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white flex justify-between items-start px-3 ${isRTL ? "flex-row-reverse" : ""}`}
        style={{
          boxShadow: "0 -1px 2px 0 rgba(10, 13, 18, 0.05)",
        }}
      >
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center flex-1 py-3"
            >
              <div className="relative w-6 h-6">
                <Image
                  src={item.icon}
                  alt={item.label}
                  width={24}
                  height={24}
                  className={isActive ? "filter-gold" : ""}
                  style={{
                    filter: isActive
                      ? "invert(52%) sepia(53%) saturate(456%) hue-rotate(358deg) brightness(92%) contrast(89%)"
                      : "none",
                  }}
                />
              </div>
              <span
                className={`mt-1 ${
                  isActive
                    ? "text-[var(--color-primary)]"
                    : "text-[var(--color-text-secondary)]"
                }`}
                style={{
                  fontSize: "12px",
                  fontWeight: 400,
                  lineHeight: "16px",
                }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* More Button — opens Strapi-driven drawer */}
        {hasDrawerContent && (
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex flex-col items-center justify-center flex-1 py-3"
          >
            <div className="relative w-6 h-6">
              <Image
                src="/menu-01.svg"
                alt={t("more")}
                width={24}
                height={24}
                style={{
                  filter: isDrawerOpen
                    ? "invert(52%) sepia(53%) saturate(456%) hue-rotate(358deg) brightness(92%) contrast(89%)"
                    : "none",
                }}
              />
            </div>
            <span
              className={`mt-1 ${
                isDrawerOpen
                  ? "text-[var(--color-primary)]"
                  : "text-[var(--color-text-secondary)]"
              }`}
              style={{
                fontSize: "12px",
                fontWeight: 400,
                lineHeight: "16px",
              }}
            >
              {t("more")}
            </span>
          </button>
        )}
      </nav>

      {/* Drawer Overlay */}
      {isDrawerOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-[60]"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Drawer — renders only if Strapi has content */}
      {hasDrawerContent && (
        <div
          className={`lg:hidden fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-2xl transform transition-transform duration-300 ease-out ${
            isDrawerOpen ? "translate-y-0" : "translate-y-full"
          }`}
          style={{ maxHeight: "85vh" }}
        >
          {/* Drawer Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-[var(--color-border)] rounded-full" />
          </div>

          {/* Drawer Header */}
          <div
            className={`flex items-center justify-between px-4 pb-4 border-b border-[var(--color-border)] ${isRTL ? "flex-row-reverse" : ""}`}
          >
            <h2 className="text-lg font-semibold text-[var(--color-footer-heading)]">
              {menuTitle}
            </h2>
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="p-2 rounded-full hover:bg-[var(--color-surface-page)] transition-colors"
            >
              <X className="w-5 h-5 text-[var(--color-icon)]" />
            </button>
          </div>

          {/* Drawer Content */}
          <div
            className="overflow-y-auto px-4 pb-8"
            style={{ maxHeight: "calc(85vh - 80px)" }}
          >
            {hasPlatform && (
              <div className="py-4 border-b border-[var(--color-border)]">
                {platformTitle && (
                  <h3
                    className={`text-sm font-semibold text-[var(--color-footer-heading)] mb-3 ${isRTL ? "text-right" : "text-left"}`}
                  >
                    {platformTitle}
                  </h3>
                )}
                <div className="space-y-1">
                  {platformLinks.map((link, index) => (
                    <Link
                      key={index}
                      href={link.href}
                      onClick={handleLinkClick}
                      className={`flex items-center justify-between py-3 text-[var(--color-footer-text)] hover:bg-[var(--color-surface-page)] rounded-lg px-2 -mx-2 transition-colors ${isRTL ? "flex-row-reverse" : ""}`}
                    >
                      <span className="text-base">{link.label}</span>
                      <ChevronIcon className="w-5 h-5 text-[var(--color-icon)]" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {hasOrganization && (
              <div className="py-4 border-b border-[var(--color-border)]">
                {organizationTitle && (
                  <h3
                    className={`text-sm font-semibold text-[var(--color-footer-heading)] mb-3 ${isRTL ? "text-right" : "text-left"}`}
                  >
                    {organizationTitle}
                  </h3>
                )}
                <div className="space-y-1">
                  {organizationLinks.map((link, index) => (
                    <Link
                      key={index}
                      href={link.href}
                      onClick={handleLinkClick}
                      className={`flex items-center justify-between py-3 text-[var(--color-footer-text)] hover:bg-[var(--color-surface-page)] rounded-lg px-2 -mx-2 transition-colors ${isRTL ? "flex-row-reverse" : ""}`}
                    >
                      <span className="text-base">{link.label}</span>
                      <ChevronIcon className="w-5 h-5 text-[var(--color-icon)]" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {hasSupport && (
              <div className="py-4">
                {supportTitle && (
                  <h3
                    className={`text-sm font-semibold text-[var(--color-footer-heading)] mb-3 ${isRTL ? "text-right" : "text-left"}`}
                  >
                    {supportTitle}
                  </h3>
                )}
                <div className="space-y-1">
                  {supportLinks.map((link, index) => (
                    <Link
                      key={index}
                      href={link.href}
                      onClick={handleLinkClick}
                      className={`flex items-center justify-between py-3 text-[var(--color-footer-text)] hover:bg-[var(--color-surface-page)] rounded-lg px-2 -mx-2 transition-colors ${isRTL ? "flex-row-reverse" : ""}`}
                    >
                      <span className="text-base">{link.label}</span>
                      <ChevronIcon className="w-5 h-5 text-[var(--color-icon)]" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default BottomNav;
