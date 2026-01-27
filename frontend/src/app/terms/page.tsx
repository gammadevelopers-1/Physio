"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const TermsAndConditions = () => {
  const [activeSection, setActiveSection] = useState("introduction");

  const sections = [
    { id: "introduction", label: "1. Introduction" },
    { id: "medical-disclaimer", label: "2. Medical Disclaimer" },
    { id: "user-accounts", label: "3. User Accounts & Security" },
    { id: "payments", label: "4. Payments & VAT" },
    { id: "intellectual-property", label: "5. Intellectual Property" },
    { id: "limitation", label: "6. Limitation of Liability" },
    { id: "termination", label: "7. Termination of Use" },
    { id: "governing-law", label: "8. Governing Law" },
    { id: "contact", label: "9. Contact Information" },
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
            Terms & Conditions
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
                    Welcome to PhysioGuidance. By accessing our website, enrolling in courses, or using our
                    services, you agree to be bound by these Terms & Conditions. If you do not agree with any
                    part of these terms, you must discontinue use of our platform immediately. These terms
                    constitute a legally binding agreement between you and PhysioGuidance, headquartered in
                    Saudi Arabia.
                  </p>
                </section>

                {/* Section 2: Medical Disclaimer */}
                <section id="medical-disclaimer" className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    2. Medical Disclaimer
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-0">
                      PhysioGuidance provides educational content for professional development and exam
                      preparation only.
                    </p>
                    <ul className="list-disc mt-4">
                      <li className="ml-8 mb-2">
                        <span className="leading-7">
                          <strong>Not Medical Advice:</strong> The information provided in our courses is not intended to be a
                          substitute for professional medical advice, diagnosis, or treatment.
                        </span>
                      </li>
                      <li className="ml-8">
                        <span className="leading-7">
                          <strong>Professional Judgment:</strong> Healthcare practitioners are responsible for exercising their own
                          clinical judgment when applying learned concepts to patient care. PhysioGuidance is
                          not liable for any medical errors or adverse patient outcomes resulting from the
                          application of our training.
                        </span>
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 3: User Accounts & Security */}
                <section id="user-accounts" className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    3. User Accounts & Security
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-4">
                      <strong>Account Responsibility:</strong> You are responsible for maintaining the confidentiality of your
                      login credentials. You are strictly prohibited from sharing your account with others.
                    </p>
                    <p className="mb-4">
                      <strong>One User, One Account:</strong> Accounts are non-transferable. Buying a course gives you the
                      license to view it; you cannot &quot;share&quot; the license with colleagues.
                    </p>
                    <p>
                      <strong>Unauthorized Access:</strong> You must notify us immediately of any unauthorized use of your
                      account.
                    </p>
                  </div>
                </section>

                {/* Section 4: Payments & VAT */}
                <section id="payments" className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    4. Payments & VAT
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-4">
                      <strong>Currency:</strong> All transactions are processed in Saudi Riyals (SAR).
                    </p>
                    <p className="mb-4">
                      <strong>VAT:</strong> In accordance with the regulations of the Zakat, Tax and Customs Authority
                      (ZATCA), a Value Added Tax (VAT) of 15% is applicable to all purchases unless otherwise
                      stated.
                    </p>
                    <p>
                      <strong>Payment Methods:</strong> We accept payments via Mada, Visa, MasterCard, Apple Pay, and STC
                      Pay. Access to course material is granted only after successful payment confirmation.
                    </p>
                  </div>
                </section>

                {/* Section 5: Intellectual Property Rights */}
                <section id="intellectual-property" className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    5. Intellectual Property Rights
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-0">
                      The PhysioGuidance platform, including its logo, source code, text, graphics, and course
                      videos, is the property of PhysioGuidance and is protected by Saudi Intellectual Property
                      Authority (SIPA) laws.
                    </p>
                    <ul className="list-disc mt-4">
                      <li className="ml-8">
                        <span className="leading-7">
                          <strong>Restrictions:</strong> You may not modify, publish, transmit, participate in the transfer or sale
                          of, reproduce, create derivative works from, or in any way exploit any of the content,
                          in whole or in part.
                        </span>
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 6: Limitation of Liability */}
                <section id="limitation" className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    6. Limitation of Liability
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-0">To the fullest extent permitted by Saudi law:</p>
                    <ul className="list-disc mt-4">
                      <li className="ml-8 mb-2">
                        <span className="leading-7">
                          PhysioGuidance shall not be liable for any indirect, incidental, special, or
                          consequential damages arising out of the use or inability to use our services.
                        </span>
                      </li>
                      <li className="ml-8 mb-2">
                        <span className="leading-7">
                          We do not guarantee that the platform will be error-free or uninterrupted. We reserve
                          the right to perform scheduled maintenance.
                        </span>
                      </li>
                      <li className="ml-8">
                        <span className="leading-7">
                          We are not responsible for the acceptance or rejection of CME hours by international
                          bodies outside of the SCFHS, though we strive to maintain full accreditation.
                        </span>
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 7: Termination of Use */}
                <section id="termination" className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    7. Termination of Use
                  </h2>
                  <p
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    PhysioGuidance reserves the right to suspend or terminate your account at our sole
                    discretion, without notice, for conduct that we believe violates these Terms & Conditions
                    or is harmful to other users, us, or third parties, or for any other reason.
                  </p>
                </section>

                {/* Section 8: Governing Law */}
                <section id="governing-law" className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    8. Governing Law
                  </h2>
                  <p
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    These Terms shall be governed by and construed in accordance with the laws of the
                    Kingdom of Saudi Arabia. Any disputes arising under or in connection with these Terms
                    shall be subject to the exclusive jurisdiction of the courts located in Riyadh, Saudi
                    Arabia.
                  </p>
                </section>

                {/* Section 9: Contact Information */}
                <section id="contact" className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    9. Contact Information
                  </h2>
                  <p
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    We reserve the right to modify these terms at any time. Changes will be effective
                    immediately upon posting to the website. Your continued use of the Service following
                    the posting of changes constitutes your acceptance of those changes.
                  </p>
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

export default TermsAndConditions;
