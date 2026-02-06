"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
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
  const t = useTranslations("footer");
  const locale = useLocale();
  const isRTL = locale === "ar";

  // Fallback links from translations
  const fallbackPlatformLinks = [
    { label: t("myLearning"), href: `/${locale}/learning` },
    { label: t("becomeTrainer"), href: `/${locale}/become-trainer` },
    { label: t("courses"), href: `/${locale}/courses` },
    { label: t("archived"), href: `/${locale}/archive` },
    { label: t("certifications"), href: `/${locale}/certifications` },
    { label: t("learningPolicies"), href: `/${locale}/policies` },
  ];

  const fallbackOrganizationLinks = [
    { label: t("aboutUs"), href: `/${locale}/about` },
    { label: t("nelcAlignment"), href: `/${locale}/nelc` },
    { label: t("academicPartners"), href: `/${locale}/partners` },
    { label: t("instructors"), href: `/${locale}/instructors` },
    { label: t("termsConditions"), href: `/${locale}/terms` },
    { label: t("privacyPolicy"), href: `/${locale}/privacy` },
  ];

  const fallbackSupportLinks = [
    { label: t("contactUs"), href: `/${locale}/contact` },
    { label: t("liveSupport"), href: `/${locale}/support` },
    { label: t("feedback"), href: `/${locale}/feedback` },
    { label: t("faq"), href: `/${locale}/faq` },
  ];

  // Map Strapi links or use fallbacks
  const platformLinks = footerLinks?.platform?.length
    ? footerLinks.platform.map((link) => ({ label: link.label, href: link.url }))
    : fallbackPlatformLinks;

  const organizationLinks = footerLinks?.organization?.length
    ? footerLinks.organization.map((link) => ({ label: link.label, href: link.url }))
    : fallbackOrganizationLinks;

  const supportLinks = footerLinks?.support?.length
    ? footerLinks.support.map((link) => ({ label: link.label, href: link.url }))
    : fallbackSupportLinks;

  // Get logo URL
  const logoUrl = siteSettings?.logo?.url
    ? getStrapiMediaUrl(siteSettings.logo.url)
    : "/images/logo.png";

  // Fallback payment methods
  const defaultPaymentMethods = [
    { name: "Visa", icon: "/payment icons/Visa.svg", padding: "6px" },
    { name: "Mastercard", icon: "/payment icons/Mastercard.svg", padding: "5px" },
    { name: "Google Pay", icon: "/payment icons/GooglePay.svg", padding: "5px" },
    { name: "Mada", icon: "/payment icons/image 474.svg", padding: "5px" },
    { name: "Apple Pay", icon: "/payment icons/ApplePay.svg", padding: "0px", noBorder: true },
  ];

  return (
    <footer
      className="hidden lg:block bg-[var(--surface-intense)] pt-20 pb-12"
      style={{ padding: "80px 64px 48px 64px" }}
    >
      <div className="flex flex-col gap-12">
        {/* Main Footer Content */}
        <div className="flex items-start justify-between w-full">
          {/* Logo and Description */}
          <div
            className={`flex flex-col gap-8 w-[250px] ${isRTL ? "items-start text-right" : "items-start"}`}
          >
            <div className="relative w-20 h-20">
              <Image
                src={logoUrl}
                alt={siteSettings?.siteName || "PhysioGuidance Logo"}
                fill
                unoptimized={logoUrl.startsWith('http')}
                className="object-contain"
              />
            </div>
            <p
              className="text-[var(--on-surface-default)] leading-6"
              style={{
                fontSize: "var(--typeface-font-styles-paragraph-text)",
              }}
            >
              {siteSettings?.footerDescription || t("companyDescription")}
            </p>

            {/* Social Icons */}
            <div className="flex gap-4 items-center" dir={isRTL ? "rtl" : "ltr"}>
              {siteSettings?.instagramUrl && (
                <Link href={siteSettings.instagramUrl} target="_blank" rel="noopener noreferrer">
                  <div className="p-2 bg-[#EEF3F7] rounded-full shadow-[0px_20px_80px_0px_rgba(0,0,0,0.12)]">
                    <Instagram
                      className="w-6 h-6 text-[var(--on-surface-variant)]"
                      strokeWidth={1.5}
                    />
                  </div>
                </Link>
              )}
              {!siteSettings?.instagramUrl && (
                <div className="p-2 bg-[#EEF3F7] rounded-full shadow-[0px_20px_80px_0px_rgba(0,0,0,0.12)]">
                  <Instagram
                    className="w-6 h-6 text-[var(--on-surface-variant)]"
                    strokeWidth={1.5}
                  />
                </div>
              )}
              {siteSettings?.twitterUrl && (
                <Link href={siteSettings.twitterUrl} target="_blank" rel="noopener noreferrer">
                  <div className="p-2 bg-[#EEF3F7] rounded-full shadow-[0px_20px_80px_0px_rgba(0,0,0,0.12)]">
                    <Twitter
                      className="w-6 h-6 text-[var(--on-surface-variant)]"
                      strokeWidth={1.5}
                    />
                  </div>
                </Link>
              )}
              {!siteSettings?.twitterUrl && (
                <div className="p-2 bg-[#EEF3F7] rounded-full shadow-[0px_20px_80px_0px_rgba(0,0,0,0.12)]">
                  <Twitter
                    className="w-6 h-6 text-[var(--on-surface-variant)]"
                    strokeWidth={1.5}
                  />
                </div>
              )}
              {siteSettings?.linkedinUrl && (
                <Link href={siteSettings.linkedinUrl} target="_blank" rel="noopener noreferrer">
                  <div className="p-2 bg-[#EEF3F7] rounded-full shadow-[0px_20px_80px_0px_rgba(0,0,0,0.12)]">
                    <Linkedin
                      className="w-6 h-6 text-[var(--on-surface-variant)]"
                      strokeWidth={1.5}
                    />
                  </div>
                </Link>
              )}
              {!siteSettings?.linkedinUrl && (
                <div className="p-2 bg-[#EEF3F7] rounded-full shadow-[0px_20px_80px_0px_rgba(0,0,0,0.12)]">
                  <Linkedin
                    className="w-6 h-6 text-[var(--on-surface-variant)]"
                    strokeWidth={1.5}
                  />
                </div>
              )}
              {siteSettings?.facebookUrl && (
                <Link href={siteSettings.facebookUrl} target="_blank" rel="noopener noreferrer">
                  <div className="p-2 bg-[#EEF3F7] rounded-full shadow-[0px_20px_80px_0px_rgba(0,0,0,0.12)]">
                    <Facebook
                      className="w-6 h-6 text-[var(--on-surface-variant)]"
                      strokeWidth={1.5}
                    />
                  </div>
                </Link>
              )}
              {!siteSettings?.facebookUrl && (
                <div className="p-2 bg-[#EEF3F7] rounded-full shadow-[0px_20px_80px_0px_rgba(0,0,0,0.12)]">
                  <Facebook
                    className="w-6 h-6 text-[var(--on-surface-variant)]"
                    strokeWidth={1.5}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Platform Links */}
          <div
            className={`flex flex-col gap-4 w-[250px] ${isRTL ? "items-start text-right" : "items-start"}`}
          >
            <h3
              className="text-[var(--on-surface-variant)] font-semibold"
              style={{
                fontSize: "var(--typeface-font-styles-heading-h4)",
              }}
            >
              {siteSettings?.footerPlatformTitle || t("platform")}
            </h3>
            {platformLinks.map((link, index) => (
              <Link
                key={index}
                href={link.href}
                className="text-[var(--on-surface-default)] leading-6 hover:text-[var(--on-surface-primary)] transition-colors"
                style={{
                  fontSize: "var(--typeface-font-styles-paragraph-text)",
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Organization Links */}
          <div
            className={`flex flex-col gap-4 w-[250px] ${isRTL ? "items-start text-right" : "items-start"}`}
          >
            <h3
              className="text-[var(--on-surface-variant)] font-semibold"
              style={{
                fontSize: "var(--typeface-font-styles-heading-h4)",
              }}
            >
              {siteSettings?.footerOrganizationTitle || t("organization")}
            </h3>
            {organizationLinks.map((link, index) => (
              <Link
                key={index}
                href={link.href}
                className="text-[var(--on-surface-default)] leading-6 hover:text-[var(--on-surface-primary)] transition-colors"
                style={{
                  fontSize: "var(--typeface-font-styles-paragraph-text)",
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Support Links */}
          <div
            className={`flex flex-col gap-4 w-[250px] ${isRTL ? "items-start text-right" : "items-start"}`}
          >
            <h3
              className="text-[var(--on-surface-variant)] font-semibold"
              style={{
                fontSize: "var(--typeface-font-styles-heading-h4)",
              }}
            >
              {siteSettings?.footerSupportTitle || t("support")}
            </h3>
            {supportLinks.map((link, index) => (
              <Link
                key={index}
                href={link.href}
                className="text-[var(--on-surface-default)] leading-6 hover:text-[var(--on-surface-primary)] transition-colors"
                style={{
                  fontSize: "var(--typeface-font-styles-paragraph-text)",
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="w-full mb-[-6px] h-px bg-[var(--outline-default)]" />

        {/* Bottom Row */}
        <div className="flex items-center justify-between w-full">
          {/* Copyright */}
          <div className="flex gap-1 items-center">
            <Copyright className="w-5 h-5 text-[#4a4c4f]" strokeWidth={1.5} />
            <span
              className="text-[var(--on-surface-variant)] text-center"
              style={{
                fontSize: "var(--typeface-font-styles-paragraph-text)",
              }}
            >
              {siteSettings?.copyrightText || t("copyright")}
            </span>
          </div>

          {/* Payment Methods */}
          <div className="flex gap-4 items-center" dir={isRTL ? "rtl" : "ltr"}>
            {defaultPaymentMethods.map((method, index) => (
              <div
                key={index}
                className={`relative w-[35px] h-[24px] ${
                  !method.noBorder ? "bg-white border border-[#d9d9d9] rounded overflow-hidden" : ""
                }`}
              >
                <Image
                  src={method.icon}
                  alt={method.name}
                  fill
                  className={`object-contain ${method.padding !== "0px" ? `p-[${method.padding}]` : ""}`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
