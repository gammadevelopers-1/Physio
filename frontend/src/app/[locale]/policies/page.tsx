"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useTranslations, useLocale } from "next-intl";

const sectionKeys = [
  "general",
  "attendance",
  "assessment",
  "integrity",
  "intellectual",
  "cancellation",
  "technical",
  "privacy",
] as const;

const LearningPolicies = () => {
  const t = useTranslations("learningPoliciesPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [activeSection, setActiveSection] = useState<typeof sectionKeys[number]>(sectionKeys[0]);

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
                {/* Section 1: General Provisions */}
                <section id={t("sections.general.id")} className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    {t("sections.general.title")}
                  </h2>
                  <p
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    {t("sections.general.content")}
                  </p>
                </section>

                {/* Section 2: Attendance Policy */}
                <section id={t("sections.attendance.id")} className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    {t("sections.attendance.title")}
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-4">{t("sections.attendance.intro")}</p>
                    <ul className="list-disc">
                      <li className={`${isRTL ? "mr-8" : "ml-8"} mb-2`}>
                        <span className="leading-7">{t("sections.attendance.items.item1")}</span>
                      </li>
                      <li className={`${isRTL ? "mr-8" : "ml-8"} mb-2`}>
                        <span className="leading-7">{t("sections.attendance.items.item2")}</span>
                      </li>
                      <li className={`${isRTL ? "mr-8" : "ml-8"}`}>
                        <span className="leading-7">{t("sections.attendance.items.item3")}</span>
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 3: Assessment & Grading */}
                <section id={t("sections.assessment.id")} className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    {t("sections.assessment.title")}
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-4">{t("sections.assessment.passingScore")}</p>
                    <p className="mb-4">{t("sections.assessment.retakePolicy")}</p>
                    <p>{t("sections.assessment.feedback")}</p>
                  </div>
                </section>

                {/* Section 4: Academic Integrity */}
                <section id={t("sections.integrity.id")} className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    {t("sections.integrity.title")}
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-4">{t("sections.integrity.intro")}</p>
                    <ul className="list-disc">
                      <li className={`${isRTL ? "mr-8" : "ml-8"} mb-2`}>
                        <span className="leading-7">{t("sections.integrity.items.item1")}</span>
                      </li>
                      <li className={`${isRTL ? "mr-8" : "ml-8"}`}>
                        <span className="leading-7">{t("sections.integrity.items.item2")}</span>
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 5: Intellectual Property Rights */}
                <section id={t("sections.intellectual.id")} className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    {t("sections.intellectual.title")}
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-4">{t("sections.intellectual.intro")}</p>
                    <ul className="list-disc">
                      <li className={`${isRTL ? "mr-8" : "ml-8"} mb-2`}>
                        <span className="leading-7">{t("sections.intellectual.items.item1")}</span>
                      </li>
                      <li className={`${isRTL ? "mr-8" : "ml-8"}`}>
                        <span className="leading-7">{t("sections.intellectual.items.item2")}</span>
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 6: Cancellation & Refund Policy */}
                <section id={t("sections.cancellation.id")} className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    {t("sections.cancellation.title")}
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-4">{t("sections.cancellation.courseCancel")}</p>
                    <p className="mb-2">{t("sections.cancellation.learnerWithdrawal")}</p>
                    <ul className="list-disc">
                      <li className={`${isRTL ? "mr-8" : "ml-8"} mb-2`}>
                        <span className="leading-7">{t("sections.cancellation.items.item1")}</span>
                      </li>
                      <li className={`${isRTL ? "mr-8" : "ml-8"}`}>
                        <span className="leading-7">{t("sections.cancellation.items.item2")}</span>
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 7: Technical Requirements */}
                <section id={t("sections.technical.id")} className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    {t("sections.technical.title")}
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-4">{t("sections.technical.intro")}</p>
                    <ul className="list-disc">
                      <li className={`${isRTL ? "mr-8" : "ml-8"} mb-2`}>
                        <span className="leading-7">{t("sections.technical.items.item1")}</span>
                      </li>
                      <li className={`${isRTL ? "mr-8" : "ml-8"} mb-2`}>
                        <span className="leading-7">{t("sections.technical.items.item2")}</span>
                      </li>
                      <li className={`${isRTL ? "mr-8" : "ml-8"}`}>
                        <span className="leading-7">{t("sections.technical.items.item3")}</span>
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 8: Privacy & Data Protection */}
                <section id={t("sections.privacy.id")} className="flex flex-col gap-6">
                  <h2
                    className="font-semibold leading-8 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h3)" }}
                  >
                    {t("sections.privacy.title")}
                  </h2>
                  <div
                    className="leading-7 text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-subheading)" }}
                  >
                    <p className="mb-4">{t("sections.privacy.intro")}</p>
                    <ul className="list-disc">
                      <li className={`${isRTL ? "mr-8" : "ml-8"} mb-2`}>
                        <span className="leading-7">{t("sections.privacy.items.item1")}</span>
                      </li>
                      <li className={`${isRTL ? "mr-8" : "ml-8"}`}>
                        <span className="leading-7">{t("sections.privacy.items.item2")}</span>
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

export default LearningPolicies;
