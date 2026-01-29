"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useTranslations, useLocale } from "next-intl";

const sectionKeys = [
  "introduction",
  "medicalDisclaimer",
  "userAccounts",
  "payments",
  "intellectualProperty",
  "limitation",
  "termination",
  "governingLaw",
  "contact",
] as const;

const TermsAndConditions = () => {
  const t = useTranslations("termsPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [activeSection, setActiveSection] = useState(sectionKeys[0]);

  useEffect(() => {
    const handleScroll = () => {
      for (let i = sectionKeys.length - 1; i >= 0; i--) {
        const sectionId = t(`sections.${sectionKeys[i]}.id`);
        const element = document.getElementById(sectionId);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 200) {
            setActiveSection(sectionKeys[i]);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [t]);

  const scrollToSection = (sectionKey: string) => {
    const sectionId = t(`sections.${sectionKey}.id`);
    const element = document.getElementById(sectionId);
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
      <section className="bg-[#EEF3F7] px-4 md:px-16 py-12 md:py-24" dir={isRTL ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="flex flex-col gap-1 mb-8 text-[var(--on-surface-default)]">
          <h1
            className="font-semibold tracking-[-0.24px]"
            style={{ fontSize: "var(--typeface-font-styles-heading-h1)" }}
          >
            {t("title")}
          </h1>
          <p
            className="leading-7"
            style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
          >
            {t("lastUpdated")}
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
                {sectionKeys.map((sectionKey) => (
                  <button
                    key={sectionKey}
                    onClick={() => scrollToSection(sectionKey)}
                    className={`text-start leading-7 transition-colors cursor-pointer ${
                      activeSection === sectionKey
                        ? "text-[var(--on-surface-default)] font-medium"
                        : "text-[var(--on-surface-default)] hover:text-[var(--on-surface-primary)]"
                    }`}
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    {t(`sections.${sectionKey}.label`)}
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
                <section id={t("sections.introduction.id")} className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    {t("sections.introduction.title")}
                  </h2>
                  <p
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    {t("sections.introduction.content")}
                  </p>
                </section>

                {/* Section 2: Medical Disclaimer */}
                <section id={t("sections.medicalDisclaimer.id")} className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    {t("sections.medicalDisclaimer.title")}
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-0">{t("sections.medicalDisclaimer.intro")}</p>
                    <ul className="list-disc mt-4">
                      <li className={`${isRTL ? "mr-8" : "ml-8"} mb-2`}>
                        <span className="leading-7">{t("sections.medicalDisclaimer.items.item1")}</span>
                      </li>
                      <li className={`${isRTL ? "mr-8" : "ml-8"}`}>
                        <span className="leading-7">{t("sections.medicalDisclaimer.items.item2")}</span>
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 3: User Accounts & Security */}
                <section id={t("sections.userAccounts.id")} className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    {t("sections.userAccounts.title")}
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-4">{t("sections.userAccounts.accountResponsibility")}</p>
                    <p className="mb-4">{t("sections.userAccounts.oneUserOneAccount")}</p>
                    <p>{t("sections.userAccounts.unauthorizedAccess")}</p>
                  </div>
                </section>

                {/* Section 4: Payments & VAT */}
                <section id={t("sections.payments.id")} className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    {t("sections.payments.title")}
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-4">{t("sections.payments.currency")}</p>
                    <p className="mb-4">{t("sections.payments.vat")}</p>
                    <p>{t("sections.payments.paymentMethods")}</p>
                  </div>
                </section>

                {/* Section 5: Intellectual Property Rights */}
                <section id={t("sections.intellectualProperty.id")} className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    {t("sections.intellectualProperty.title")}
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-0">{t("sections.intellectualProperty.intro")}</p>
                    <ul className="list-disc mt-4">
                      <li className={`${isRTL ? "mr-8" : "ml-8"}`}>
                        <span className="leading-7">{t("sections.intellectualProperty.items.item1")}</span>
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 6: Limitation of Liability */}
                <section id={t("sections.limitation.id")} className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    {t("sections.limitation.title")}
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-0">{t("sections.limitation.intro")}</p>
                    <ul className="list-disc mt-4">
                      <li className={`${isRTL ? "mr-8" : "ml-8"} mb-2`}>
                        <span className="leading-7">{t("sections.limitation.items.item1")}</span>
                      </li>
                      <li className={`${isRTL ? "mr-8" : "ml-8"} mb-2`}>
                        <span className="leading-7">{t("sections.limitation.items.item2")}</span>
                      </li>
                      <li className={`${isRTL ? "mr-8" : "ml-8"}`}>
                        <span className="leading-7">{t("sections.limitation.items.item3")}</span>
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 7: Termination of Use */}
                <section id={t("sections.termination.id")} className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    {t("sections.termination.title")}
                  </h2>
                  <p
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    {t("sections.termination.content")}
                  </p>
                </section>

                {/* Section 8: Governing Law */}
                <section id={t("sections.governingLaw.id")} className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    {t("sections.governingLaw.title")}
                  </h2>
                  <p
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    {t("sections.governingLaw.content")}
                  </p>
                </section>

                {/* Section 9: Contact Information */}
                <section id={t("sections.contact.id")} className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    {t("sections.contact.title")}
                  </h2>
                  <p
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    {t("sections.contact.content")}
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
