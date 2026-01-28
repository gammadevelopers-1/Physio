"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { Copyright, Facebook, Linkedin, Twitter, Instagram } from "lucide-react";

const Footer = () => {
  const t = useTranslations("footer");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const platformLinks = [
    { label: t("myLearning"), href: `/${locale}/learning` },
    { label: t("becomeTrainer"), href: `/${locale}/become-trainer` },
    { label: t("courses"), href: `/${locale}/courses` },
    { label: t("archived"), href: `/${locale}/archive` },
    { label: t("certifications"), href: `/${locale}/certifications` },
    { label: t("learningPolicies"), href: `/${locale}/policies` },
  ];

  const organizationLinks = [
    { label: t("aboutUs"), href: `/${locale}/about` },
    { label: t("nelcAlignment"), href: `/${locale}/nelc` },
    { label: t("academicPartners"), href: `/${locale}/partners` },
    { label: t("instructors"), href: `/${locale}/instructors` },
    { label: t("termsConditions"), href: `/${locale}/terms` },
    { label: t("privacyPolicy"), href: `/${locale}/privacy` },
  ];

  const supportLinks = [
    { label: t("contactUs"), href: `/${locale}/contact` },
    { label: t("liveSupport"), href: `/${locale}/support` },
    { label: t("feedback"), href: `/${locale}/feedback` },
    { label: t("faq"), href: `/${locale}/faq` },
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
                src="/images/logo.png"
                alt="PhysioGuidance Logo"
                fill
                className="object-contain"
              />
            </div>
            <p
              className="text-[var(--on-surface-default)] leading-6"
              style={{
                fontSize: "var(--typeface-font-styles-paragraph-text)",
              }}
            >
              {t("companyDescription")}
            </p>

            {/* Social Icons */}
            <div className="flex gap-4 items-center">
              <div className="p-2 bg-[#EEF3F7] rounded-full shadow-[0px_20px_80px_0px_rgba(0,0,0,0.12)]">
                <Facebook
                  className="w-6 h-6 text-[var(--on-surface-variant)]"
                  strokeWidth={1.5}
                />
              </div>
              <div className="p-2 bg-[#EEF3F7] rounded-full shadow-[0px_20px_80px_0px_rgba(0,0,0,0.12)]">
                <Linkedin
                  className="w-6 h-6 text-[var(--on-surface-variant)]"
                  strokeWidth={1.5}
                />
              </div>
              <div className="p-2 bg-[#EEF3F7] rounded-full shadow-[0px_20px_80px_0px_rgba(0,0,0,0.12)] size-10">
                <Twitter
                  className="w-6 h-6 text-[var(--on-surface-variant)]"
                  strokeWidth={1.5}
                />
              </div>
              <div className="p-2 bg-[#EEF3F7] rounded-full shadow-[0px_20px_80px_0px_rgba(0,0,0,0.12)]">
                <Instagram
                  className="w-6 h-6 text-[var(--on-surface-variant)]"
                  strokeWidth={1.5}
                />
              </div>
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
              {t("platform")}
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
              {t("organization")}
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
              {t("support")}
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
              {t("copyright")}
            </span>
          </div>

          {/* Payment Methods */}
          <div className="flex gap-4 items-center">
            {/* Visa */}
            <div className="relative w-[35px] h-[24px] bg-white border border-[#d9d9d9] rounded overflow-hidden">
              <Image
                src="/payment icons/Visa.svg"
                alt="Visa"
                fill
                className="object-contain p-[6px]"
              />
            </div>
            {/* Mastercard */}
            <div className="relative w-[35px] h-[24px] bg-white border border-[#d9d9d9] rounded overflow-hidden">
              <Image
                src="/payment icons/Mastercard.svg"
                alt="Mastercard"
                fill
                className="object-contain p-[5px]"
              />
            </div>
            {/* Google Pay */}
            <div className="relative w-[35px] h-[24px] bg-white border border-[#d9d9d9] rounded overflow-hidden">
              <Image
                src="/payment icons/GooglePay.svg"
                alt="Google Pay"
                fill
                className="object-contain p-[5px]"
              />
            </div>
            {/* Mada */}
            <div className="relative w-[35px] h-[24px] bg-white border border-[#d9d9d9] rounded overflow-hidden">
              <Image
                src="/payment icons/image 474.svg"
                alt="Mada"
                fill
                className="object-contain p-[5px]"
              />
            </div>
            {/* Apple Pay */}
            <div className="relative w-[35px] h-[24px]">
              <Image
                src="/payment icons/ApplePay.svg"
                alt="Apple Pay"
                fill
                className="object-contain"
              />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
