"use client";

import { useState, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Video,
  KeyRound,
  CreditCard,
  Award,
  BookOpen,
  Wrench,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Headphones,
  Lock,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import BusinessHoursIndicator from "./BusinessHoursIndicator";
import PublicTicketForm from "./PublicTicketForm";

const SUPPORT_CATEGORIES = [
  {
    backendValue: "technical",
    labelKey: "category_technical",
    descKey: "category_technical_desc",
    icon: Video,
    color: "bg-red-50 text-red-600",
  },
  {
    backendValue: "login",
    labelKey: "category_login",
    descKey: "category_login_desc",
    icon: KeyRound,
    color: "bg-amber-50 text-amber-600",
  },
  {
    backendValue: "billing",
    labelKey: "category_billing",
    descKey: "category_billing_desc",
    icon: CreditCard,
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    backendValue: "certificate",
    labelKey: "category_certificate",
    descKey: "category_certificate_desc",
    icon: Award,
    color: "bg-purple-50 text-purple-600",
  },
  {
    backendValue: "content",
    labelKey: "category_content",
    descKey: "category_content_desc",
    icon: BookOpen,
    color: "bg-blue-50 text-blue-600",
  },
  {
    backendValue: "other",
    labelKey: "category_other_technical",
    descKey: "category_other_technical_desc",
    icon: Wrench,
    color: "bg-orange-50 text-orange-600",
  },
  {
    backendValue: "other",
    labelKey: "category_other",
    descKey: "category_other_desc",
    icon: HelpCircle,
    color: "bg-gray-100 text-gray-600",
  },
] as const;

const FAQ_ITEMS = [
  { questionKey: "faq1_question", answerKey: "faq1_answer" },
  { questionKey: "faq2_question", answerKey: "faq2_answer" },
  { questionKey: "faq3_question", answerKey: "faq3_answer" },
  { questionKey: "faq4_question", answerKey: "faq4_answer" },
  { questionKey: "faq5_question", answerKey: "faq5_answer" },
] as const;

export default function SupportPageContent() {
  const t = useTranslations("supportPublicPage");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { isAuthenticated } = useAuth();

  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const ticketSectionRef = useRef<HTMLDivElement>(null);

  function handleCategoryClick(backendValue: string) {
    setSelectedCategory(backendValue);
    ticketSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      {/* ========== HERO SECTION ========== */}
      <section className="text-center mb-12 sm:mb-16">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--brand-blue)]/10 mb-5">
          <Headphones className="w-8 h-8 text-[var(--brand-blue)]" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
          {t("title")}
        </h1>
        <p className="text-gray-500 text-base sm:text-lg max-w-2xl mx-auto mb-6">
          {t("subtitle")}
        </p>
        <div className="flex justify-center">
          <div className="inline-flex flex-col items-center bg-white rounded-2xl px-6 py-4 shadow-sm border border-[#E8ECF0]">
            <BusinessHoursIndicator />
          </div>
        </div>
      </section>

      {/* ========== CATEGORIES GRID ========== */}
      <section className="mb-12 sm:mb-16">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t("categoriesTitle")}
          </h2>
          <p className="text-gray-500 text-sm">{t("categoriesSubtitle")}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SUPPORT_CATEGORIES.map((cat, idx) => {
            const Icon = cat.icon;
            const isLocked = !isAuthenticated && cat.backendValue !== "login";
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  if (!isAuthenticated && cat.backendValue !== "login") {
                    return;
                  }
                  handleCategoryClick(cat.backendValue);
                }}
                className={`group flex items-start gap-4 p-5 bg-white rounded-2xl border border-[#E8ECF0] shadow-sm transition-all text-left ${
                  isRTL ? "text-right" : ""
                } ${
                  isLocked
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:shadow-md hover:border-[var(--brand-blue)]/30 cursor-pointer"
                }`}
                dir={isRTL ? "rtl" : "ltr"}
              >
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${cat.color}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className={`text-sm font-semibold text-gray-900 mb-1 transition-colors ${
                    isLocked ? "" : "group-hover:text-[var(--brand-blue)]"
                  }`}>
                    {t(cat.labelKey)}
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {t(cat.descKey)}
                  </p>
                  {isLocked && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-400">
                      <Lock className="w-3 h-3" />
                      <span>Sign in required</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {!isAuthenticated && (
          <div className="text-center mt-6 p-4 bg-[#F0F4FF] rounded-xl border border-[#C7D5F0]">
            <p className="text-sm text-[#374151] mb-3">
              Sign in to submit tickets for billing, certificates, content, or technical issues.
            </p>
            <a
              href={`/${locale}/signin?redirect=/${locale}/support`}
              className="inline-flex items-center gap-2 px-5 py-2 bg-[#002D87] text-white text-sm font-medium rounded-lg hover:opacity-90"
            >
              Sign In
            </a>
          </div>
        )}
      </section>

      {/* ========== FAQ SECTION ========== */}
      <section className="mb-12 sm:mb-16">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t("faqTitle")}
          </h2>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {FAQ_ITEMS.map((faq, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-[#E8ECF0] shadow-sm overflow-hidden"
            >
              <button
                type="button"
                onClick={() =>
                  setOpenFaqIndex(openFaqIndex === idx ? null : idx)
                }
                className={`w-full flex items-center justify-between px-5 py-4 text-left ${
                  isRTL ? "text-right flex-row-reverse" : ""
                }`}
                dir={isRTL ? "rtl" : "ltr"}
              >
                <span className="text-sm font-medium text-gray-900 pr-4">
                  {t(faq.questionKey)}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${
                    openFaqIndex === idx ? "rotate-180" : ""
                  }`}
                />
              </button>
              {openFaqIndex === idx && (
                <div
                  className="px-5 pb-4"
                  dir={isRTL ? "rtl" : "ltr"}
                >
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {t(faq.answerKey)}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="text-center mt-6">
          <a
            href={`/${locale}/faq`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand-blue)] hover:underline"
          >
            {t("faqViewAll")}
            <ChevronRight
              className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`}
            />
          </a>
        </div>
      </section>

      {/* ========== TICKET SUBMISSION SECTION ========== */}
      <section ref={ticketSectionRef} className="scroll-mt-24">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl border border-[#E8ECF0] shadow-sm p-6 sm:p-8">
            <div
              className={`mb-6 ${isRTL ? "text-right" : "text-left"}`}
              dir={isRTL ? "rtl" : "ltr"}
            >
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                {t("submitTicketTitle")}
              </h2>
              <p className="text-sm text-gray-500">
                {t("submitTicketSubtitle")}
              </p>
            </div>

            {isAuthenticated ? (
              <PublicTicketForm
                preSelectedCategory={selectedCategory}
                isAuthenticated={true}
              />
            ) : (
              <PublicTicketForm
                preSelectedCategory="login"
                isAuthenticated={false}
                guestLoginMode={true}
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
