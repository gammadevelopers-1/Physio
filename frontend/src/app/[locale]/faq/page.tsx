"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ChevronDown } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";

const faqKeys = ["item1", "item2", "item3", "item4"] as const;

const FAQPage = () => {
  const t = useTranslations("faqPage");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [openItems, setOpenItems] = useState<number[]>([0, 1, 2, 3]);

  const toggleItem = (index: number) => {
    setOpenItems((prev) =>
      prev.includes(index) ? prev.filter((item) => item !== index) : [...prev, index]
    );
  };

  return (
    <main className="min-h-screen bg-[var(--surface-intense)] pb-20 lg:pb-0">
      <Navbar />

      {/* FAQ Section */}
      <section className="bg-white px-4 md:px-16 py-12 md:py-24" dir={isRTL ? "rtl" : "ltr"}>
        <div className="max-w-[1312px] mx-auto">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-20">
            {/* Title and CTA Section */}
            <div className="lg:w-[500px] shrink-0">
              <div className="flex flex-col gap-6 lg:gap-8">
                <div className="flex flex-col gap-6">
                  <h1
                    className="font-semibold tracking-[-0.24px] text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h1)" }}
                  >
                    {t("title")}
                  </h1>
                  <p
                    className="text-[var(--on-surface-default)] leading-relaxed"
                    style={{ fontSize: "18px" }}
                  >
                    {t("subtitle")}
                  </p>
                </div>
                <Link
                  href={`/${locale}/contact`}
                  className="inline-flex items-center justify-center h-10 px-5 py-2 btn-gold text-[var(--on-surface-inverse)] rounded-xl text-sm font-medium w-fit"
                >
                  {t("getInTouch")}
                </Link>
              </div>
            </div>

            {/* FAQ List Section */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col gap-6">
                {faqKeys.map((key, index) => (
                  <div key={key}>
                    {/* FAQ Item */}
                    <div className="flex flex-col gap-4">
                      {/* Question Row */}
                      <button
                        onClick={() => toggleItem(index)}
                        className="flex items-center justify-between gap-4 w-full text-start cursor-pointer group"
                      >
                        <span
                          className="flex-1 text-[var(--on-surface-default)] leading-7"
                          style={{
                            fontSize: "var(--typeface-font-styles-heading-subheading)",
                          }}
                        >
                          {t(`items.${key}.question`)}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 text-[var(--on-surface-variant)] shrink-0 transition-transform duration-200 ${
                            openItems.includes(index) ? "rotate-180" : ""
                          }`}
                          strokeWidth={2}
                        />
                      </button>

                      {/* Answer */}
                      {openItems.includes(index) && (
                        <p
                          className="text-[var(--on-surface-variant)] leading-6"
                          style={{
                            fontSize: "var(--typeface-font-styles-paragraph-text)",
                          }}
                        >
                          {t(`items.${key}.answer`)}
                        </p>
                      )}
                    </div>

                    {/* Divider - Don't show after last item */}
                    {index < faqKeys.length - 1 && (
                      <div className="h-px bg-[#C8D5E1] mt-6" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
};

export default FAQPage;
