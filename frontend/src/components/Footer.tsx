"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Copyright, Facebook, Linkedin, Twitter, Instagram } from "lucide-react";
import NelcVerificationBadge from "./NelcVerificationBadge";
import type { SiteSettings, NavigationLink } from "@/lib/strapi/types";
import { getStrapiMediaUrl } from "@/lib/strapi/client";
import { usePlatformGeneral } from "@/contexts/PlatformGeneralContext";
import { useNavbarChrome } from "@/hooks/useNavbarChrome";

interface FooterProps {
  siteSettings?: SiteSettings | null;
  footerLinks?: {
    platform: NavigationLink[];
    organization: NavigationLink[];
    support: NavigationLink[];
  };
}

const Footer = ({ siteSettings: passedSettings, footerLinks: passedLinks }: FooterProps) => {
  const locale = useLocale();
  const isRTL = locale === "ar";
  const platformGeneral = usePlatformGeneral();

  // Auth / payment / verify-invoice pages are `"use client"` and can't fetch
  // Strapi server-side, so they render `<Footer />` with no props — which
  // previously left the footer half-rendered (only the platform name from
  // PlatformGeneralContext was visible). Fall back to a client-side fetch so
  // those pages get the same full footer as the marketing pages. Marketing
  // pages already pass props, so the hook result is overridden and unused.
  const chrome = useNavbarChrome();
  const siteSettings = passedSettings ?? chrome.siteSettings;
  const footerLinks = passedLinks ?? chrome.footerLinks;

  // Logo comes strictly from Strapi
  const logoUrl = siteSettings?.logo?.url ? getStrapiMediaUrl(siteSettings.logo.url) : null;
  // Site name prefers admin's Settings → General → Platform Name (per locale);
  // falls back to Strapi siteName.
  const adminName =
    locale === "ar" ? platformGeneral.platformNameAr : platformGeneral.platformName;
  const siteName = adminName || siteSettings?.siteName || "";

  // Link columns — Strapi only (no translation-based fallback arrays)
  const platformLinks = (footerLinks?.platform || []).map((l) => ({ label: l.label, href: l.url }));
  const organizationLinks = (footerLinks?.organization || []).map((l) => ({ label: l.label, href: l.url }));
  const supportLinks = (footerLinks?.support || []).map((l) => ({ label: l.label, href: l.url }));

  // Social URLs — each icon renders only if Strapi has a URL for it
  const socialLinks = [
    { url: siteSettings?.instagramUrl, Icon: Instagram },
    { url: siteSettings?.twitterUrl, Icon: Twitter },
    { url: siteSettings?.linkedinUrl, Icon: Linkedin },
    { url: siteSettings?.facebookUrl, Icon: Facebook },
  ].filter((s): s is { url: string; Icon: typeof Instagram } => Boolean(s.url));

  // Payment methods come from a Strapi repeatable component
  const paymentMethods = (siteSettings?.paymentMethods || []).filter((p) => p.icon);

  // Footer business + NELC info — all sourced from Strapi siteSettings.
  // Each line renders only when both label and value are present.
  const crLabel = siteSettings?.commercialRegistrationLabel || null;
  const crNumber = siteSettings?.commercialRegistrationNumber || null;
  const hasCR = !!(crLabel && crNumber);
  const vatLabel = siteSettings?.vatLabel || null;
  const vatNumber = siteSettings?.vatNumber || null;
  const hasVAT = !!(vatLabel && vatNumber);
  const hasBusinessInfo = hasCR || hasVAT;

  const nelcText = siteSettings?.nelcLicenseText || null;
  const nelcLicenseLabel = siteSettings?.nelcLicenseLabel || null;
  const nelcLicenseNumber = siteSettings?.nelcLicenseNumber || null;
  const nelcLogoUrl = siteSettings?.nelcLogo?.url ? getStrapiMediaUrl(siteSettings.nelcLogo.url) : null;
  const hasNelcLicense = !!(nelcLicenseLabel && nelcLicenseNumber);
  const hasNelcInfo = !!nelcText || hasNelcLicense;

  // Presence flags
  const hasDescription = !!siteSettings?.footerDescription;
  const hasPlatform = !!(siteSettings?.footerPlatformTitle || platformLinks.length > 0);
  const hasOrganization = !!(siteSettings?.footerOrganizationTitle || organizationLinks.length > 0);
  const hasSupport = !!(siteSettings?.footerSupportTitle || supportLinks.length > 0);
  const hasCopyright = !!siteSettings?.copyrightText;
  const hasBottomRow = hasCopyright;
  const hasMainRow = !!logoUrl || !!siteName || hasDescription || socialLinks.length > 0 || hasPlatform || hasOrganization || hasSupport || paymentMethods.length > 0 || hasBusinessInfo || hasNelcInfo;

  // Entire footer hides if nothing is configured
  if (!hasMainRow && !hasBottomRow) return null;

  return (
    <footer
      className="hidden lg:block bg-[var(--color-footer-bg)] pt-20 pb-12"
      style={{ padding: "80px 64px 48px 64px" }}
    >
      {/* Cap footer content at 1440px and center — matches the marketing
          sections above so nothing stretches to the edges on ultra-wide
          displays. Outer <footer> stays full-bleed for the bg color. */}
      <div className="flex flex-col gap-12 max-w-[1440px] mx-auto">
        {/* Main Footer Content */}
        {hasMainRow && (
          <div className="flex items-start justify-between w-full gap-8 flex-wrap">
            {/* Logo + Description + Socials + Payments + Business/NELC info column */}
            {(logoUrl || siteName || hasDescription || socialLinks.length > 0 || paymentMethods.length > 0 || hasBusinessInfo || hasNelcInfo) && (
              <div className={`flex flex-col gap-8 w-[280px] ${isRTL ? "items-start text-right" : "items-start"}`}>
                {logoUrl ? (
                  <div className="relative w-20 h-20">
                    <Image
                      src={logoUrl}
                      alt={siteName || "Logo"}
                      fill
                      unoptimized={logoUrl.startsWith('http')}
                      className="object-contain"
                    />
                  </div>
                ) : siteName ? (
                  <h2 className="text-[var(--color-footer-text)] text-2xl font-semibold">
                    {siteName}
                  </h2>
                ) : null}

                {hasDescription && (
                  <p
                    className="text-[var(--color-text-secondary)] leading-6"
                    style={{
                      fontSize: "var(--typeface-font-styles-paragraph-text)",
                    }}
                  >
                    {siteSettings!.footerDescription}
                  </p>
                )}

                {/* Social Icons — only URLs that exist */}
                {socialLinks.length > 0 && (
                  <div className="flex gap-4 items-center" dir={isRTL ? "rtl" : "ltr"}>
                    {socialLinks.map(({ url, Icon }, idx) => (
                      <Link key={idx} href={url} target="_blank" rel="noopener noreferrer">
                        <div className="p-2 bg-[var(--color-surface-page)] rounded-full shadow-[0px_20px_80px_0px_rgba(0,0,0,0.12)]">
                          <Icon
                            className="w-6 h-6 text-[var(--color-icon)]"
                            strokeWidth={1.5}
                          />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Payment Methods — Strapi component, no hardcoded icons */}
                {paymentMethods.length > 0 && (
                  <div className="flex gap-3 items-center flex-wrap" dir={isRTL ? "rtl" : "ltr"}>
                    {paymentMethods.map((method) => {
                      const src = method.icon ? getStrapiMediaUrl(method.icon.url) : null;
                      if (!src) return null;
                      return (
                        <div
                          key={method.id}
                          className="relative w-[42px] h-[28px] bg-white border border-[var(--color-border)] rounded overflow-hidden"
                        >
                          <Image
                            src={src}
                            alt={method.name}
                            fill
                            className="object-contain p-[3px]"
                            unoptimized={src.startsWith('http')}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Business Information (Commercial Registration + VAT) */}
                {hasBusinessInfo && (
                  <div
                    className="flex flex-col gap-1.5 text-[var(--color-text-secondary)]"
                    dir={isRTL ? "rtl" : "ltr"}
                    style={{ fontSize: "var(--typeface-font-styles-paragraph-text)" }}
                  >
                    {hasCR && (
                      <span>
                        <span className="font-medium text-[var(--color-footer-text)]">{crLabel}:</span>{" "}
                        <span dir="ltr">{crNumber}</span>
                      </span>
                    )}
                    {hasVAT && (
                      <span>
                        <span className="font-medium text-[var(--color-footer-text)]">{vatLabel}:</span>{" "}
                        <span dir="ltr">{vatNumber}</span>
                      </span>
                    )}
                  </div>
                )}

                {/* NELC License Information */}
                {hasNelcInfo && (
                  <div
                    className="flex items-start gap-3"
                    dir={isRTL ? "rtl" : "ltr"}
                    style={{ fontSize: "var(--typeface-font-styles-paragraph-text)" }}
                  >
                    {nelcLogoUrl && (
                      <Image
                        src={nelcLogoUrl}
                        alt={nelcText || "NELC"}
                        width={56}
                        height={56}
                        className="flex-shrink-0 object-contain h-12 w-auto"
                        unoptimized={nelcLogoUrl.startsWith("http")}
                      />
                    )}
                    <div className="flex flex-col gap-1.5 text-[var(--color-text-secondary)] min-w-0">
                      {nelcText && (
                        <span className="font-medium text-[var(--color-footer-text)]">
                          {nelcText}
                        </span>
                      )}
                      {hasNelcLicense && (
                        <span>
                          <span className="font-medium text-[var(--color-footer-text)]">{nelcLicenseLabel}:</span>{" "}
                          <span dir="ltr">{nelcLicenseNumber}</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Platform Links */}
            {hasPlatform && (
              <div className={`flex flex-col gap-4 w-[250px] ${isRTL ? "items-start text-right" : "items-start"}`}>
                {siteSettings?.footerPlatformTitle && (
                  <h3
                    className="text-[var(--color-footer-heading)] font-semibold"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h4)" }}
                  >
                    {siteSettings.footerPlatformTitle}
                  </h3>
                )}
                {platformLinks.map((link, index) => (
                  <Link
                    key={index}
                    href={link.href}
                    className="text-[var(--color-footer-text)] leading-6 hover:text-[var(--on-surface-primary)] transition-colors"
                    style={{ fontSize: "var(--typeface-font-styles-paragraph-text)" }}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}

            {/* Organization Links */}
            {hasOrganization && (
              <div className={`flex flex-col gap-4 w-[250px] ${isRTL ? "items-start text-right" : "items-start"}`}>
                {siteSettings?.footerOrganizationTitle && (
                  <h3
                    className="text-[var(--color-footer-heading)] font-semibold"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h4)" }}
                  >
                    {siteSettings.footerOrganizationTitle}
                  </h3>
                )}
                {organizationLinks.map((link, index) => (
                  <Link
                    key={index}
                    href={link.href}
                    className="text-[var(--color-footer-text)] leading-6 hover:text-[var(--on-surface-primary)] transition-colors"
                    style={{ fontSize: "var(--typeface-font-styles-paragraph-text)" }}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}

            {/* Support Links */}
            {hasSupport && (
              <div className={`flex flex-col gap-4 w-[250px] ${isRTL ? "items-start text-right" : "items-start"}`}>
                {siteSettings?.footerSupportTitle && (
                  <h3
                    className="text-[var(--color-footer-heading)] font-semibold"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h4)" }}
                  >
                    {siteSettings.footerSupportTitle}
                  </h3>
                )}
                {supportLinks.map((link, index) => (
                  <Link
                    key={index}
                    href={link.href}
                    className="text-[var(--color-footer-text)] leading-6 hover:text-[var(--on-surface-primary)] transition-colors"
                    style={{ fontSize: "var(--typeface-font-styles-paragraph-text)" }}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        {hasMainRow && hasBottomRow && (
          <div className="w-full mb-[-6px] h-px bg-[var(--outline-default)]" />
        )}

        {/* Bottom Row */}
        {hasBottomRow && (
          <div className="flex items-center justify-between w-full gap-4 flex-wrap">
            {/* Copyright */}
            {hasCopyright && (
              <div className="flex gap-1 items-center">
                <Copyright className="w-5 h-5 text-[var(--color-icon)]" strokeWidth={1.5} />
                <span
                  className="text-[var(--on-surface-variant)] text-center"
                  style={{ fontSize: "var(--typeface-font-styles-paragraph-text)" }}
                >
                  {siteSettings!.copyrightText}
                </span>
              </div>
            )}

            {/* Official NELC (SDAIA e-learning regulator) trust mark.
                Rendered inline at the far end of the copyright row so
                it lives with the other footer trust marks instead of
                floating on top of the page content. */}
            <NelcVerificationBadge />
          </div>
        )}
      </div>
    </footer>
  );
};

export default Footer;
