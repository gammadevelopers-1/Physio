import Image from "next/image";
import Link from "next/link";

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
    <footer className="bg-[var(--surface-intense)] px-10 pt-20 pb-12">
      <div className="flex flex-col gap-12 items-center">
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
              <div className="p-2 bg-[var(--surface-container-high)] rounded-full shadow-[0px_20px_80px_0px_rgba(0,0,0,0.12)]">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M16 8C17.5913 8 19.1174 8.63214 20.2426 9.75736C21.3679 10.8826 22 12.4087 22 14V21H18V14C18 13.4696 17.7893 12.9609 17.4142 12.5858C17.0391 12.2107 16.5304 12 16 12C15.4696 12 14.9609 12.2107 14.5858 12.5858C14.2107 12.9609 14 13.4696 14 14V21H10V14C10 12.4087 10.6321 10.8826 11.7574 9.75736C12.8826 8.63214 14.4087 8 16 8Z"
                    stroke="#4a4c4f"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M6 9H2V21H6V9Z"
                    stroke="#4a4c4f"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M4 6C5.10457 6 6 5.10457 6 4C6 2.89543 5.10457 2 4 2C2.89543 2 2 2.89543 2 4C2 5.10457 2.89543 6 4 6Z"
                    stroke="#4a4c4f"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="p-2 bg-[var(--surface-container-high)] rounded-full shadow-[0px_20px_80px_0px_rgba(0,0,0,0.12)]">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M18 2H15C13.6739 2 12.4021 2.52678 11.4645 3.46447C10.5268 4.40215 10 5.67392 10 7V10H7V14H10V22H14V14H17L18 10H14V7C14 6.73478 14.1054 6.48043 14.2929 6.29289C14.4804 6.10536 14.7348 6 15 6H18V2Z"
                    stroke="#4a4c4f"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="p-2 bg-[var(--surface-container-high)] rounded-full shadow-[0px_20px_80px_0px_rgba(0,0,0,0.12)] size-10">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M4 4L10.5 12.5M4 20L10.5 12.5M10.5 12.5L14 17H20L14 10M20 4H14L10.5 8.5"
                    stroke="#4a4c4f"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="p-2 bg-[var(--surface-container-high)] rounded-full shadow-[0px_20px_80px_0px_rgba(0,0,0,0.12)]">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M17 2H7C4.23858 2 2 4.23858 2 7V17C2 19.7614 4.23858 22 7 22H17C19.7614 22 22 19.7614 22 17V7C22 4.23858 19.7614 2 17 2Z"
                    stroke="#4a4c4f"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M16 11.37C16.1234 12.2022 15.9813 13.0522 15.5938 13.799C15.2063 14.5458 14.5932 15.1514 13.8416 15.5297C13.0901 15.9079 12.2385 16.0396 11.4078 15.9059C10.5771 15.7723 9.80977 15.3801 9.21485 14.7852C8.61993 14.1902 8.22774 13.4229 8.09408 12.5922C7.96042 11.7615 8.09208 10.9099 8.47034 10.1584C8.8486 9.40685 9.4542 8.79374 10.201 8.40624C10.9478 8.01874 11.7978 7.87659 12.63 8C13.4789 8.12588 14.2649 8.52146 14.8717 9.12831C15.4785 9.73515 15.8741 10.5211 16 11.37Z"
                    stroke="#4a4c4f"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M17.5 6.5H17.51"
                    stroke="#4a4c4f"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
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
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10 18.3333C14.6024 18.3333 18.3334 14.6024 18.3334 10C18.3334 5.39763 14.6024 1.66667 10 1.66667C5.39765 1.66667 1.66669 5.39763 1.66669 10C1.66669 14.6024 5.39765 18.3333 10 18.3333Z"
                stroke="#4a4c4f"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12.5 8.33333C12.0278 7.67778 11.2833 7.22222 10.4167 7.22222C9.08333 7.22222 8 8.46667 8 10C8 11.5333 9.08333 12.7778 10.4167 12.7778C11.2833 12.7778 12.0278 12.3222 12.5 11.6667"
                stroke="#4a4c4f"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
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
