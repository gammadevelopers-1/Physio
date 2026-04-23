"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Copyright, Facebook, Linkedin, Twitter, Instagram } from "lucide-react";
import type { SiteSettings, NavigationLink } from "@/lib/strapi/types";
import { getStrapiMediaUrl } from "@/lib/strapi/client";

interface FooterProps {
  siteSettings?: SiteSettings | null;
  footerLinks?: {
    platform: NavigationLink[];
    organization: NavigationLink[];
    support: NavigationLink[];
  };
}

const Footer = ({ siteSettings, footerLinks }: FooterProps) => {
  const locale = useLocale();
  const isRTL = locale === "ar";

  // Logo comes strictly from Strapi
  const logoUrl = siteSettings?.logo?.url ? getStrapiMediaUrl(siteSettings.logo.url) : null;
  const siteName = siteSettings?.siteName || "";

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

  // Presence flags
  const hasDescription = !!siteSettings?.footerDescription;
  const hasPlatform = !!(siteSettings?.footerPlatformTitle || platformLinks.length > 0);
  const hasOrganization = !!(siteSettings?.footerOrganizationTitle || organizationLinks.length > 0);
  const hasSupport = !!(siteSettings?.footerSupportTitle || supportLinks.length > 0);
  const hasCopyright = !!siteSettings?.copyrightText;
  const hasBottomRow = hasCopyright || paymentMethods.length > 0;
  const hasMainRow = !!logoUrl || !!siteName || hasDescription || socialLinks.length > 0 || hasPlatform || hasOrganization || hasSupport;

  // Entire footer hides if nothing is configured
  if (!hasMainRow && !hasBottomRow) return null;

  return (
    <footer
      className="hidden lg:block bg-[var(--surface-intense)] pt-20 pb-12"
      style={{ padding: "80px 64px 48px 64px" }}
    >
      <div className="flex flex-col gap-12">
        {/* Main Footer Content */}
        {hasMainRow && (
          <div className="flex items-start justify-between w-full gap-8 flex-wrap">
            {/* Logo + Description + Socials column */}
            {(logoUrl || siteName || hasDescription || socialLinks.length > 0) && (
              <div className={`flex flex-col gap-8 w-[250px] ${isRTL ? "items-start text-right" : "items-start"}`}>
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
                  <h2 className="text-[var(--on-surface-default)] text-2xl font-semibold">
                    {siteName}
                  </h2>
                ) : null}

                {hasDescription && (
                  <p
                    className="text-[var(--on-surface-default)] leading-6"
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
                            className="w-6 h-6 text-[var(--on-surface-variant)]"
                            strokeWidth={1.5}
                          />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Platform Links */}
            {hasPlatform && (
              <div className={`flex flex-col gap-4 w-[250px] ${isRTL ? "items-start text-right" : "items-start"}`}>
                {siteSettings?.footerPlatformTitle && (
                  <h3
                    className="text-[var(--on-surface-variant)] font-semibold"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h4)" }}
                  >
                    {siteSettings.footerPlatformTitle}
                  </h3>
                )}
                {platformLinks.map((link, index) => (
                  <Link
                    key={index}
                    href={link.href}
                    className="text-[var(--on-surface-default)] leading-6 hover:text-[var(--on-surface-primary)] transition-colors"
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
                    className="text-[var(--on-surface-variant)] font-semibold"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h4)" }}
                  >
                    {siteSettings.footerOrganizationTitle}
                  </h3>
                )}
                {organizationLinks.map((link, index) => (
                  <Link
                    key={index}
                    href={link.href}
                    className="text-[var(--on-surface-default)] leading-6 hover:text-[var(--on-surface-primary)] transition-colors"
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
                    className="text-[var(--on-surface-variant)] font-semibold"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h4)" }}
                  >
                    {siteSettings.footerSupportTitle}
                  </h3>
                )}
                {supportLinks.map((link, index) => (
                  <Link
                    key={index}
                    href={link.href}
                    className="text-[var(--on-surface-default)] leading-6 hover:text-[var(--on-surface-primary)] transition-colors"
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
                <Copyright className="w-5 h-5 text-[#4a4c4f]" strokeWidth={1.5} />
                <span
                  className="text-[var(--on-surface-variant)] text-center"
                  style={{ fontSize: "var(--typeface-font-styles-paragraph-text)" }}
                >
                  {siteSettings!.copyrightText}
                </span>
              </div>
            )}

            {/* Payment Methods — Strapi component, no hardcoded icons */}
            {paymentMethods.length > 0 && (
              <div className="flex gap-4 items-center" dir={isRTL ? "rtl" : "ltr"}>
                {paymentMethods.map((method) => {
                  const src = method.icon ? getStrapiMediaUrl(method.icon.url) : null;
                  if (!src) return null;
                  return (
                    <div
                      key={method.id}
                      className="relative w-[35px] h-[24px] bg-white border border-[#d9d9d9] rounded overflow-hidden"
                    >
                      <Image
                        src={src}
                        alt={method.name}
                        fill
                        className="object-contain p-[5px]"
                        unoptimized={src.startsWith('http')}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </footer>
  );
};

export default Footer;
