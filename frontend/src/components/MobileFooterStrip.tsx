"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import { Copyright, Facebook, Instagram, Linkedin, Twitter } from "lucide-react";
import NelcVerificationBadge from "./NelcVerificationBadge";
import type { SiteSettings } from "@/lib/strapi/types";
import { getStrapiMediaUrl } from "@/lib/strapi/client";
import { usePlatformGeneral } from "@/contexts/PlatformGeneralContext";

/**
 * Mobile-only "footer" — desktop-parity compliance/branding chrome, laid
 * out for narrow screens. Renders at the end of every marketing page,
 * above the fixed BottomNav.
 *
 * Layout: logo → tagline → socials → payment logos → business info
 * (CR / VAT) → NELC license block → NELC verification badge → copyright.
 *
 * Deliberately OMITS the Platform / Organization / Support link columns
 * — those already live in the BottomNav "More" drawer, and duplicating
 * them here would double the footer height for no navigation gain.
 *
 * Data is pulled from the same Strapi `siteSettings` the desktop Footer
 * uses, so any admin edit in the CMS reflects on both surfaces without
 * extra plumbing.
 */
export default function MobileFooterStrip({
  settings,
}: {
  settings?: SiteSettings | null;
}) {
  const locale = useLocale();
  const isRTL = locale === "ar";
  const pathname = usePathname() || "";
  const platformGeneral = usePlatformGeneral();

  // Dashboard routes have their own chrome; skip both there.
  if (/\/dashboard(\/|$)/.test(pathname)) return null;

  const logoUrl = settings?.logo?.url ? getStrapiMediaUrl(settings.logo.url) : null;
  const adminName =
    locale === "ar" ? platformGeneral.platformNameAr : platformGeneral.platformName;
  const siteName = adminName || settings?.siteName || "";

  const socialLinks = [
    { url: settings?.instagramUrl, Icon: Instagram },
    { url: settings?.twitterUrl, Icon: Twitter },
    { url: settings?.linkedinUrl, Icon: Linkedin },
    { url: settings?.facebookUrl, Icon: Facebook },
  ].filter((s): s is { url: string; Icon: typeof Instagram } => Boolean(s.url));

  const paymentMethods = (settings?.paymentMethods || []).filter((p) => p.icon);

  const crLabel = settings?.commercialRegistrationLabel || null;
  const crNumber = settings?.commercialRegistrationNumber || null;
  const hasCR = !!(crLabel && crNumber);
  const vatLabel = settings?.vatLabel || null;
  const vatNumber = settings?.vatNumber || null;
  const hasVAT = !!(vatLabel && vatNumber);

  const nelcText = settings?.nelcLicenseText || null;
  const nelcLicenseLabel = settings?.nelcLicenseLabel || null;
  const nelcLicenseNumber = settings?.nelcLicenseNumber || null;
  const nelcLogoUrl = settings?.nelcLogo?.url
    ? getStrapiMediaUrl(settings.nelcLogo.url)
    : null;
  const hasNelcLicense = !!(nelcLicenseLabel && nelcLicenseNumber);
  const hasNelcInfo = !!nelcText || hasNelcLicense;

  const hasDescription = !!settings?.footerDescription;
  const hasCopyright = !!settings?.copyrightText;

  const year = new Date().getFullYear();

  return (
    <div
      className="lg:hidden bg-[var(--color-footer-bg)] border-t border-[var(--outline-subtle)] px-5 pt-8 pb-6 mb-[64px] flex flex-col gap-6"
      role="contentinfo"
      aria-label="Site footer"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Logo + name */}
      <div className={`flex flex-col gap-3 ${isRTL ? "items-start" : "items-start"}`}>
        {logoUrl ? (
          <div className="relative w-16 h-16">
            <Image
              src={logoUrl}
              alt={siteName || "Logo"}
              fill
              unoptimized={logoUrl.startsWith("http")}
              className="object-contain"
            />
          </div>
        ) : siteName ? (
          <h2 className="text-[var(--color-footer-text)] text-xl font-semibold">
            {siteName}
          </h2>
        ) : null}

        {hasDescription && (
          <p className="text-[var(--color-text-secondary)] text-sm leading-6">
            {settings!.footerDescription}
          </p>
        )}
      </div>

      {/* Social icons */}
      {socialLinks.length > 0 && (
        <div className="flex gap-3 items-center flex-wrap">
          {socialLinks.map(({ url, Icon }, idx) => (
            <Link
              key={idx}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-[var(--color-surface-page)] rounded-full shadow-[0px_10px_40px_0px_rgba(0,0,0,0.08)]"
            >
              <Icon
                className="w-5 h-5 text-[var(--color-icon)]"
                strokeWidth={1.5}
              />
            </Link>
          ))}
        </div>
      )}

      {/* Payment methods */}
      {paymentMethods.length > 0 && (
        <div className="flex gap-2 items-center flex-wrap">
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
                  unoptimized={src.startsWith("http")}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Business info (CR + VAT) */}
      {(hasCR || hasVAT) && (
        <div className="flex flex-col gap-1.5 text-sm text-[var(--color-text-secondary)]">
          {hasCR && (
            <div>
              <div className="font-medium text-[var(--color-footer-text)]">
                {crLabel}:
              </div>
              <div dir="ltr" className={isRTL ? "text-right" : ""}>
                {crNumber}
              </div>
            </div>
          )}
          {hasVAT && (
            <div>
              <div className="font-medium text-[var(--color-footer-text)]">
                {vatLabel}:
              </div>
              <div dir="ltr" className={isRTL ? "text-right" : ""}>
                {vatNumber}
              </div>
            </div>
          )}
        </div>
      )}

      {/* NELC license info */}
      {hasNelcInfo && (
        <div className="flex items-start gap-3 text-sm">
          {nelcLogoUrl && (
            <Image
              src={nelcLogoUrl}
              alt={nelcText || "NELC"}
              width={48}
              height={48}
              className="flex-shrink-0 object-contain h-12 w-auto"
              unoptimized={nelcLogoUrl.startsWith("http")}
            />
          )}
          <div className="flex flex-col gap-1 min-w-0">
            {nelcText && (
              <span className="font-medium text-[var(--color-footer-text)] leading-snug">
                {nelcText}
              </span>
            )}
            {hasNelcLicense && (
              <span className="text-[var(--color-text-secondary)]">
                <span className="font-medium text-[var(--color-footer-text)]">
                  {nelcLicenseLabel}:
                </span>{" "}
                <span dir="ltr">{nelcLicenseNumber}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="h-px bg-[var(--outline-default)]" />

      {/* NELC verification iframe badge */}
      <div className="flex justify-start">
        <NelcVerificationBadge />
      </div>

      {/* Copyright — Strapi text if set, else year + name */}
      <div className="flex items-center gap-1.5 text-xs text-[var(--on-surface-variant)]">
        <Copyright className="w-4 h-4 text-[var(--color-icon)]" strokeWidth={1.5} />
        <span>{hasCopyright ? settings!.copyrightText : `${year} PhysioGuidance`}</span>
      </div>
    </div>
  );
}
