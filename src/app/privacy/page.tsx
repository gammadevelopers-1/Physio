"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const PrivacyPolicy = () => {
  const [activeSection, setActiveSection] = useState("introduction");

  const sections = [
    { id: "introduction", label: "1. Introduction" },
    { id: "data-collect", label: "2. Data We Collect" },
    { id: "purpose", label: "3. Purpose of Collection" },
    { id: "scfhs", label: "4. Sharing with SCFHS (Mumaris)" },
    { id: "storage", label: "5. Data Storage & Security" },
    { id: "rights", label: "6. Your Rights" },
    { id: "cookies", label: "7. Cookies & Tracking" },
    { id: "third-party", label: "8. Third-Party Links" },
    { id: "contact", label: "9. Contact Us" },
  ];

  useEffect(() => {
    const handleScroll = () => {
      const sectionElements = sections.map((section) =>
        document.getElementById(section.id)
      );

      for (let i = sectionElements.length - 1; i >= 0; i--) {
        const element = sectionElements[i];
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 200) {
            setActiveSection(sections[i].id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const navbarHeight = 88;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - navbarHeight - 20;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  return (
    <main className="min-h-screen bg-[var(--surface-default)] pb-20 lg:pb-0">
      <Navbar />

      {/* Main Content Section */}
      <section className="bg-[#EEF3F7] px-4 md:px-16 py-12 md:py-24">
        {/* Header */}
        <div className="flex flex-col gap-1 mb-8 text-[var(--on-surface-default)]">
          <h1
            className="font-semibold tracking-[-0.24px]"
            style={{ fontSize: "var(--typeface-font-styles-heading-h1)" }}
          >
            Privacy policy
          </h1>
          <p
            className="leading-7"
            style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
          >
            Last Updated: January 2026
          </p>
        </div>

        {/* Content Container */}
        <div className="flex flex-col lg:flex-row gap-8 w-full">
          {/* Sidebar Navigation - Hidden on mobile */}
          <div className="hidden lg:block lg:w-[320px] xl:w-[395px] shrink-0">
            <div
              className="bg-white rounded-2xl p-8 sticky top-24 shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]"
            >
              <nav className="flex flex-col gap-6">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`text-left leading-7 transition-colors cursor-pointer ${
                      activeSection === section.id
                        ? "text-[var(--on-surface-default)] font-medium"
                        : "text-[var(--on-surface-default)] hover:text-[var(--on-surface-primary)]"
                    }`}
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    {section.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div
              className="bg-white rounded-2xl p-6 md:p-8 shadow-[0px_0px_1px_0px_rgba(0,0,0,0.06),0px_1px_1px_0px_rgba(0,0,0,0.05),-1px_3px_2px_0px_rgba(0,0,0,0.03),-1px_5px_2px_0px_rgba(0,0,0,0.01),-2px_8px_2px_0px_rgba(0,0,0,0)]"
            >
              <div className="flex flex-col gap-12">
                {/* Section 1: Introduction */}
                <section id="introduction" className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    1. Introduction
                  </h2>
                  <p
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    PhysioGuidance respects your privacy and is committed to protecting your personal
                    data. This Privacy Policy outlines how we collect, use, and safeguard your information
                    in compliance with the Personal Data Protection Law (PDPL) of Saudi Arabia and the
                    regulations set forth by the Saudi Data & AI Authority (SDAIA).
                  </p>
                </section>

                {/* Section 2: Data We Collect */}
                <section id="data-collect" className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    2. Data We Collect
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-4">
                      To provide accredited medical education, we are required to collect specific personal
                      information:
                    </p>
                    <ul className="list-disc">
                      <li className="ml-8 mb-2">
                        <span className="leading-7">
                          <strong>Identity Data:</strong> Full Name (as it appears on your ID), National ID/Iqama Number, and
                          Date of Birth.
                        </span>
                      </li>
                      <li className="ml-8 mb-2">
                        <span className="leading-7">
                          <strong>Professional Data:</strong> SCFHS Classification Number (Professional License ID), Specialty,
                          and Job Title.
                        </span>
                      </li>
                      <li className="ml-8 mb-2">
                        <span className="leading-7">
                          <strong>Contact Data:</strong> Email address and Mobile number.
                        </span>
                      </li>
                      <li className="ml-8 mb-2">
                        <span className="leading-7">
                          <strong>Financial Data:</strong> Payment card details (processed securely via our payment gateway
                          providers; we do not store raw credit card numbers).
                        </span>
                      </li>
                      <li className="ml-8">
                        <span className="leading-7">
                          <strong>Technical Data:</strong> IP address, browser type, and device information used to access our
                          platform.
                        </span>
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 3: Purpose of Collection */}
                <section id="purpose" className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    3. Purpose of Collection
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-4">We process your data for the following lawful purposes:</p>
                    <ul className="list-disc">
                      <li className="ml-8 mb-2">
                        <span className="leading-7">
                          <strong>Service Delivery:</strong> To enroll you in courses and grant access to learning materials.
                        </span>
                      </li>
                      <li className="ml-8 mb-2">
                        <span className="leading-7">
                          <strong>Accreditation Reporting:</strong> To verify your identity and attendance as required by the
                          National eLearning Center (NELC).
                        </span>
                      </li>
                      <li className="ml-8 mb-2">
                        <span className="leading-7">
                          <strong>Certification:</strong> To generate verifiable certificates with your correct legal name and
                          license number.
                        </span>
                      </li>
                      <li className="ml-8">
                        <span className="leading-7">
                          <strong>Communication:</strong> To send course updates, exam results, and renewal reminders.
                        </span>
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 4: Sharing with SCFHS (Mumaris) */}
                <section id="scfhs" className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    4. Sharing with SCFHS (Mumaris)
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-4">
                      By using our platform, you explicitly consent to the sharing of your academic data with
                      the Saudi Commission for Health Specialties (SCFHS).
                    </p>
                    <ul className="list-disc">
                      <li className="ml-8 mb-2">
                        <span className="leading-7">
                          <strong>What we share:</strong> Your License Number and the CME hours you have earned.
                        </span>
                      </li>
                      <li className="ml-8">
                        <span className="leading-7">
                          <strong>Why we share it:</strong> This is strictly for the purpose of updating your CME record in the
                          Mumaris Plus system to facilitate your professional registration renewal.
                        </span>
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 5: Data Storage & Security */}
                <section id="storage" className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    5. Data Storage & Security
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-4">
                      <strong>Data Localization:</strong> In compliance with Saudi regulations, your primary data is hosted on
                      secure servers located within the Kingdom of Saudi Arabia.
                    </p>
                    <p>
                      <strong>Security Measures:</strong> We employ SSL encryption, access controls, and regular security
                      audits to protect your data against unauthorized access or loss.
                    </p>
                  </div>
                </section>

                {/* Section 6: Your Rights */}
                <section id="rights" className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    6. Your Rights
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <ul className="list-disc">
                      <li className="ml-8 mb-2">
                        <span className="leading-7">
                          <strong>Access:</strong> Request a copy of the personal data we hold about you.
                        </span>
                      </li>
                      <li className="ml-8 mb-2">
                        <span className="leading-7">
                          <strong>Correction:</strong> Request correction of any incomplete or inaccurate data (e.g., updating
                          your License Number).
                        </span>
                      </li>
                      <li className="ml-8">
                        <span className="leading-7">
                          <strong>Destruction:</strong> Request the deletion of your data, provided there is no legal obligation
                          (such as tax records or SCFHS audit trails) requiring us to retain it.
                        </span>
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 7: Cookies & Tracking */}
                <section id="cookies" className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    7. Cookies & Tracking
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-4">We use cookies to improve your user experience:</p>
                    <ul className="list-disc">
                      <li className="ml-8 mb-2">
                        <span className="leading-7">
                          <strong>Essential Cookies:</strong> Required for the website to function (e.g., keeping you logged in
                          during a quiz).
                        </span>
                      </li>
                      <li className="ml-8">
                        <span className="leading-7">
                          <strong>Analytics Cookies:</strong> Help us understand which courses are most popular. You can
                          manage your cookie preferences in your browser settings.
                        </span>
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 8: Third-Party Links */}
                <section id="third-party" className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    8. Third-Party Links
                  </h2>
                  <p
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    Our website may contain links to external sites (e.g., SCFHS, FutureX). We are not
                    responsible for the privacy practices or content of these third-party websites.
                  </p>
                </section>

                {/* Section 9: Contact Us */}
                <section id="contact" className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    9. Contact Us
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-4">
                      If you have any questions regarding this Privacy Policy or wish to exercise your data
                      rights, please contact our Data Protection Officer:
                    </p>
                    <ul className="list-disc">
                      <li className="ml-8 mb-2">
                        <span className="leading-7">
                          <strong>Email:</strong> privacy@physioguidance.sa
                        </span>
                      </li>
                      <li className="ml-8">
                        <span className="leading-7">
                          <strong>Address:</strong> [Your Office Address], Riyadh, Saudi Arabia.
                        </span>
                      </li>
                    </ul>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default PrivacyPolicy;
