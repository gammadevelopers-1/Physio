import Image from "next/image";
import Link from "next/link";
import { Copyright, Facebook, Linkedin, Twitter, Instagram } from "lucide-react";

const Footer = () => {
  const platformLinks = [
    { label: "My Learning", href: "/learning" },
    { label: "Become a Trainer", href: "/become-trainer" },
    { label: "Courses", href: "/courses" },
    { label: "Archived", href: "/archive" },
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

  return (
    <footer
      className="hidden lg:block bg-[var(--surface-intense)] pt-20 pb-12"
      style={{ padding: "80px 64px 48px 64px" }}
    >
      <div className="flex flex-col gap-12">
        {/* Main Footer Content */}
        <div className="flex items-start justify-between w-full">
          {/* Logo and Description */}
          <div className="flex flex-col gap-8 items-start w-[250px]">
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
              Nationally aligned healthcare eLearning & training platform
            </p>

            {/* Social Icons */}
            <div className="flex gap-4 items-center justify-center">
              <div className="p-2 bg-[var(--surface-container-low)] rounded-full shadow-[0px_20px_80px_0px_rgba(0,0,0,0.12)]">
                <Facebook className="w-6 h-6 text-[var(--on-surface-variant)]" strokeWidth={1.5} />
              </div>
              <div className="p-2 bg-[var(--surface-container-low)] rounded-full shadow-[0px_20px_80px_0px_rgba(0,0,0,0.12)]">
                <Linkedin className="w-6 h-6 text-[var(--on-surface-variant)]" strokeWidth={1.5} />
              </div>
              <div className="p-2 bg-[var(--surface-container-low)] rounded-full shadow-[0px_20px_80px_0px_rgba(0,0,0,0.12)] size-10">
                <Twitter className="w-6 h-6 text-[var(--on-surface-variant)]" strokeWidth={1.5} />
              </div>
              <div className="p-2 bg-[var(--surface-container-low)] rounded-full shadow-[0px_20px_80px_0px_rgba(0,0,0,0.12)]">
                <Instagram className="w-6 h-6 text-[var(--on-surface-variant)]" strokeWidth={1.5} />
              </div>
            </div>
          </div>

          {/* Platform Links */}
          <div className="flex flex-col gap-4 items-start w-[250px]">
            <h3
              className="text-[var(--on-surface-variant)] font-semibold"
              style={{
                fontSize: "var(--typeface-font-styles-heading-h4)",
              }}
            >
              Platform
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
          <div className="flex flex-col gap-4 items-start w-[250px]">
            <h3
              className="text-[var(--on-surface-variant)] font-semibold"
              style={{
                fontSize: "var(--typeface-font-styles-heading-h4)",
              }}
            >
              Organization
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
          <div className="flex flex-col gap-4 items-start w-[250px]">
            <h3
              className="text-[var(--on-surface-variant)] font-semibold"
              style={{
                fontSize: "var(--typeface-font-styles-heading-h4)",
              }}
            >
              Support
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
              2025, PhysioGuidance
            </span>
          </div>

          {/* Payment Methods */}
          <div className="flex gap-4 items-center">
            {/* Visa */}
            <div className="relative w-[35px] h-6 bg-white border border-[#d9d9d9] rounded">
              <Image
                src="/images/visa.svg"
                alt="Visa"
                fill
                className="object-contain p-1"
              />
            </div>
            {/* Mastercard */}
            <div className="relative w-[35px] h-6 bg-white border border-[#d9d9d9] rounded">
              <Image
                src="/images/mastercard.svg"
                alt="Mastercard"
                fill
                className="object-contain p-1"
              />
            </div>
            {/* Google Pay */}
            <div className="relative w-[35px] h-6 bg-white border border-[#d9d9d9] rounded flex items-center justify-center">
              <Image
                src="/images/google-pay-g.svg"
                alt="Google Pay"
                width={12}
                height={12}
                className="object-contain"
              />
            </div>
            {/* Mada */}
            <div className="relative w-[35px] h-6 bg-white border border-[#d9d9d9] rounded">
              <Image
                src="/images/mada.png"
                alt="Mada"
                fill
                className="object-contain p-1"
              />
            </div>
            {/* Apple Pay */}
            <div className="relative w-[35px] h-6 bg-white border border-[#d9d9d9] rounded">
              <Image
                src="/images/apple-pay.svg"
                alt="Apple Pay"
                fill
                className="object-contain p-1"
              />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
