//bottom nav
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { X, ChevronRight } from "lucide-react";

const BottomNav = () => {
  const pathname = usePathname();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const navItems = [
    { href: "/", label: "Home", icon: "/home-01.svg" },
    { href: "/search", label: "Search", icon: "/search-lg.svg" },
    { href: "/cart", label: "Cart", icon: "/file-02.svg" },
  ];

  const platformLinks = [
    { label: "My Learning", href: "/learning" },
    { label: "Become a Trainer", href: "/become-trainer" },
    { label: "Courses", href: "/courses" },
    { label: "Archived", href: "/archived" },
    { label: "Certifications & CME", href: "/certifications" },
    { label: "Learning Policies", href: "/policies" },
  ];

  const organizationLinks = [
    { label: "About us", href: "/about" },
    { label: "NELC Alignment", href: "/nelc" },
    { label: "Academic Partners", href: "/partners" },
    { label: "Instructors & Faculty", href: "/instructors" },
    { label: "Terms & Conditions", href: "/terms" },
    { label: "Privacy Policy", href: "/privacy" },
  ];

  const supportLinks = [
    { label: "Contact Us", href: "/contact" },
    { label: "Live Support", href: "/support" },
    { label: "Feedback", href: "/feedback" },
    { label: "FAQ", href: "/faq" },
  ];

  const handleLinkClick = () => {
    setIsDrawerOpen(false);
  };

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white flex justify-between items-start px-3"
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
              alt="More"
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
            More
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
        <div className="flex items-center justify-between px-4 pb-4 border-b border-[#E5E7EB]">
          <h2 className="text-lg font-semibold text-[#06080b]">Menu</h2>
          <button
            onClick={() => setIsDrawerOpen(false)}
            className="p-2 rounded-full hover:bg-[#F4F4F5] transition-colors"
          >
            <X className="w-5 h-5 text-[#71717A]" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="overflow-y-auto px-4 pb-8" style={{ maxHeight: "calc(85vh - 80px)" }}>
          {/* Platform Section */}
          <div className="py-4 border-b border-[#E5E7EB]">
            <h3 className="text-sm font-semibold text-[#71717A] mb-3">Platform</h3>
            <div className="space-y-1">
              {platformLinks.map((link, index) => (
                <Link
                  key={index}
                  href={link.href}
                  onClick={handleLinkClick}
                  className="flex items-center justify-between py-3 text-[#06080b] hover:bg-[#F4F4F5] rounded-lg px-2 -mx-2 transition-colors"
                >
                  <span className="text-base">{link.label}</span>
                  <ChevronRight className="w-5 h-5 text-[#A1A1AA]" />
                </Link>
              ))}
            </div>
          </div>

          {/* Organization Section */}
          <div className="py-4 border-b border-[#E5E7EB]">
            <h3 className="text-sm font-semibold text-[#71717A] mb-3">Organization</h3>
            <div className="space-y-1">
              {organizationLinks.map((link, index) => (
                <Link
                  key={index}
                  href={link.href}
                  onClick={handleLinkClick}
                  className="flex items-center justify-between py-3 text-[#06080b] hover:bg-[#F4F4F5] rounded-lg px-2 -mx-2 transition-colors"
                >
                  <span className="text-base">{link.label}</span>
                  <ChevronRight className="w-5 h-5 text-[#A1A1AA]" />
                </Link>
              ))}
            </div>
          </div>

          {/* Support Section */}
          <div className="py-4">
            <h3 className="text-sm font-semibold text-[#71717A] mb-3">Support</h3>
            <div className="space-y-1">
              {supportLinks.map((link, index) => (
                <Link
                  key={index}
                  href={link.href}
                  onClick={handleLinkClick}
                  className="flex items-center justify-between py-3 text-[#06080b] hover:bg-[#F4F4F5] rounded-lg px-2 -mx-2 transition-colors"
                >
                  <span className="text-base">{link.label}</span>
                  <ChevronRight className="w-5 h-5 text-[#A1A1AA]" />
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
