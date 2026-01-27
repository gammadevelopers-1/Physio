"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ChevronDown } from "lucide-react";

interface FAQItem {
  id: number;
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    id: 1,
    question: "Is PhysioGuidance accredited by SCFHS?",
    answer:
      "Yes, we are a fully accredited provider. All our CME courses are recognized by the Saudi Commission for Health Specialties.",
  },
  {
    id: 2,
    question: "How do I upload my CME hours to Mumaris Plus?",
    answer:
      "We handle this for you! Once you pass the course, our system automatically reports your hours to Mumaris Plus within 48 hours. Please ensure your SCFHS license number is correct in your profile.",
  },
  {
    id: 3,
    question: "My name is spelled wrong on my certificate. How do I fix it?",
    answer:
      "Your certificate uses the name exactly as it appears in your profile. You can edit your profile settings before generating the certificate. If it's already generated, please contact support.",
  },
  {
    id: 4,
    question: "Is PhysioGuidance accredited by SCFHS?",
    answer:
      "Yes, we are a fully accredited provider. All our CME courses are recognized by the Saudi Commission for Health Specialties.",
  },
];

const FAQPage = () => {
  const [openItems, setOpenItems] = useState<number[]>([1, 2, 3, 4]);

  const toggleItem = (id: number) => {
    setOpenItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <main className="min-h-screen bg-[var(--surface-intense)] pb-20 lg:pb-0">
      <Navbar />

      {/* FAQ Section */}
      <section className="bg-white px-4 md:px-16 py-12 md:py-24">
        <div className="max-w-[1312px] mx-auto">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-20">
            {/* Left Section - Title and CTA */}
            <div className="lg:w-[500px] shrink-0">
              <div className="flex flex-col gap-6 lg:gap-8">
                <div className="flex flex-col gap-6">
                  <h1
                    className="font-semibold tracking-[-0.24px] text-[var(--on-surface-default)]"
                    style={{ fontSize: "var(--typeface-font-styles-heading-h1)" }}
                  >
                    FAQs
                  </h1>
                  <p
                    className="text-[var(--on-surface-default)] leading-relaxed"
                    style={{ fontSize: "18px" }}
                  >
                    Still have any questions?
                  </p>
                </div>
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center h-10 px-5 py-2 btn-gold text-[var(--on-surface-inverse)] rounded-xl text-sm font-medium w-fit"
                >
                  Get in touch
                </Link>
              </div>
            </div>

            {/* Right Section - FAQ List */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col gap-6">
                {faqData.map((faq, index) => (
                  <div key={faq.id}>
                    {/* FAQ Item */}
                    <div className="flex flex-col gap-4">
                      {/* Question Row */}
                      <button
                        onClick={() => toggleItem(faq.id)}
                        className="flex items-center justify-between gap-4 w-full text-left cursor-pointer group"
                      >
                        <span
                          className="flex-1 text-[var(--on-surface-default)] leading-7"
                          style={{
                            fontSize: "var(--typeface-font-styles-heading-subheading)",
                          }}
                        >
                          {faq.question}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 text-[var(--on-surface-variant)] shrink-0 transition-transform duration-200 ${
                            openItems.includes(faq.id) ? "rotate-180" : ""
                          }`}
                          strokeWidth={2}
                        />
                      </button>

                      {/* Answer */}
                      {openItems.includes(faq.id) && (
                        <p
                          className="text-[var(--on-surface-variant)] leading-6"
                          style={{
                            fontSize: "var(--typeface-font-styles-paragraph-text)",
                          }}
                        >
                          {faq.answer}
                        </p>
                      )}
                    </div>

                    {/* Divider - Don't show after last item */}
                    {index < faqData.length - 1 && (
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
