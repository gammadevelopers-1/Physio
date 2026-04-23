//bottom nav
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import { X, ChevronRight, ChevronLeft } from "lucide-react";

const BottomNav = () => {
  const pathname = usePathname();
  const t = useTranslations("bottomNav");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const navItems = [
    { href: `/${locale}`, label: t("home"), icon: "/home-01.svg" },
    { href: `/${locale}/search`, label: t("search"), icon: "/search-lg.svg" },
    { href: `/${locale}/checkout`, label: t("cart"), icon: "/file-02.svg" },
  ];

  const platformLinks = [
    { label: t("myLearning"), href: `/${locale}/learning` },
    { label: t("becomeTrainer"), href: `/${locale}/become-trainer` },
    { label: t("courses"), href: `/${locale}/courses` },
    { label: t("archived"), href: `/${locale}/archived` },
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
                    ? "text-[var(--surface-container-primary-2)]"
                    : "text-[var(--on-surface-variant)]"
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

        {/* More Button */}
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
                ? "text-[var(--surface-container-primary-2)]"
                : "text-[var(--on-surface-variant)]"
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
      </nav>

      {/* Drawer Overlay */}
      {isDrawerOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-[60]"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`lg:hidden fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-2xl transform transition-transform duration-300 ease-out ${
          isDrawerOpen ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ maxHeight: "85vh" }}
      >
        {/* Drawer Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-[#D4D4D8] rounded-full" />
        </div>

        {/* Drawer Header */}
        <div
          className={`flex items-center justify-between px-4 pb-4 border-b border-[var(--color-border)] ${isRTL ? "flex-row-reverse" : ""}`}
        >
          <h2 className="text-lg font-semibold text-[#06080b]">{t("menu")}</h2>
          <button
            onClick={() => setIsDrawerOpen(false)}
            className="p-2 rounded-full hover:bg-[#F4F4F5] transition-colors"
          >
            <X className="w-5 h-5 text-[#71717A]" />
          </button>
        </div>

        {/* Drawer Content */}
        <div
          className="overflow-y-auto px-4 pb-8"
          style={{ maxHeight: "calc(85vh - 80px)" }}
        >
          {/* Platform Section */}
          <div className="py-4 border-b border-[var(--color-border)]">
            <h3
              className={`text-sm font-semibold text-[#71717A] mb-3 ${isRTL ? "text-right" : "text-left"}`}
            >
              {t("platform")}
            </h3>
            <div className="space-y-1">
              {platformLinks.map((link, index) => (
                <Link
                  key={index}
                  href={link.href}
                  onClick={handleLinkClick}
                  className={`flex items-center justify-between py-3 text-[#06080b] hover:bg-[#F4F4F5] rounded-lg px-2 -mx-2 transition-colors ${isRTL ? "flex-row-reverse" : ""}`}
                >
                  <span className="text-base">{link.label}</span>
                  <ChevronIcon className="w-5 h-5 text-[#A1A1AA]" />
                </Link>
              ))}
            </div>
          </div>

          {/* Organization Section */}
          <div className="py-4 border-b border-[var(--color-border)]">
            <h3
              className={`text-sm font-semibold text-[#71717A] mb-3 ${isRTL ? "text-right" : "text-left"}`}
            >
              {t("organization")}
            </h3>
            <div className="space-y-1">
              {organizationLinks.map((link, index) => (
                <Link
                  key={index}
                  href={link.href}
                  onClick={handleLinkClick}
                  className={`flex items-center justify-between py-3 text-[#06080b] hover:bg-[#F4F4F5] rounded-lg px-2 -mx-2 transition-colors ${isRTL ? "flex-row-reverse" : ""}`}
                >
                  <span className="text-base">{link.label}</span>
                  <ChevronIcon className="w-5 h-5 text-[#A1A1AA]" />
                </Link>
              ))}
            </div>
          </div>

          {/* Support Section */}
          <div className="py-4">
            <h3
              className={`text-sm font-semibold text-[#71717A] mb-3 ${isRTL ? "text-right" : "text-left"}`}
            >
              {t("support")}
            </h3>
            <div className="space-y-1">
              {supportLinks.map((link, index) => (
                <Link
                  key={index}
                  href={link.href}
                  onClick={handleLinkClick}
                  className={`flex items-center justify-between py-3 text-[#06080b] hover:bg-[#F4F4F5] rounded-lg px-2 -mx-2 transition-colors ${isRTL ? "flex-row-reverse" : ""}`}
                >
                  <span className="text-base">{link.label}</span>
                  <ChevronIcon className="w-5 h-5 text-[#A1A1AA]" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default BottomNav;
