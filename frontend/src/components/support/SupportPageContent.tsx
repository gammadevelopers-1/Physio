"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
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
  Eye,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supportApi } from "@/lib/api";
import BusinessHoursIndicator from "./BusinessHoursIndicator";
import PublicTicketForm from "./PublicTicketForm";
import type {
  SupportPage,
  SupportCategoryBackendValue,
  SupportCategoryIcon,
} from "@/lib/strapi/types";

function htmlExcerpt(html: string, max = 160): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

// ─── Registry: Strapi icon names → lucide-react components ──────────────
// Adding a new option means adding it to the Strapi enum at
// `strapi/src/components/shared/support-category.json` AND extending
// SupportCategoryIcon in `types.ts` AND adding the mapping here.
const ICON_REGISTRY: Record<SupportCategoryIcon, LucideIcon> = {
  Video,
  KeyRound,
  CreditCard,
  Award,
  BookOpen,
  Wrench,
  HelpCircle,
};

// ─── Fallback categories used when Strapi has no entry yet ───────────────
// Mirrors the original hardcoded list; all label/desc strings come from
// next-intl so the fallback path is fully translated.
interface DisplayCategory {
  backendValue: SupportCategoryBackendValue;
  label: string;
  description: string;
  icon: LucideIcon;
  colorClass: string;
}

interface DisplayFAQ {
  question: string;
  answer: string;
}

interface SupportPageContentProps {
  strapiData?: SupportPage | null;
}

export default function SupportPageContent({
  strapiData,
}: SupportPageContentProps) {
  const t = useTranslations("supportPublicPage");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { isAuthenticated } = useAuth();

  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const ticketSectionRef = useRef<HTMLDivElement>(null);

  // Top published Help Center articles — surface real content on the
  // landing page so users self-serve before raising a ticket.
  const [topArticles, setTopArticles] = useState<any[]>([]);
  const [kbCategoryMap, setKbCategoryMap] = useState<Map<string, string>>(new Map());
  const [isLoadingArticles, setIsLoadingArticles] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingArticles(true);
    Promise.all([
      supportApi.getKbArticles().catch(() => []),
      supportApi.listKbCategories().catch(() => []),
    ])
      .then(([articles, cats]) => {
        if (cancelled) return;
        const sorted = (articles || [])
          .filter((a: any) => a.published)
          .sort((a: any, b: any) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
          .slice(0, 6);
        setTopArticles(sorted);
        const m = new Map<string, string>();
        (cats || []).forEach((c: any) =>
          m.set(c.slug, isRTL && c.nameAr ? c.nameAr : c.nameEn),
        );
        setKbCategoryMap(m);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingArticles(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isRTL]);

  // Strapi-driven copy with i18n fallback. The "null/empty → fall back"
  // pattern means an admin can override one field at a time without
  // having to fill every single label.
  const heroTitle = strapiData?.title || t("title");
  const heroSubtitle = strapiData?.subtitle || t("subtitle");
  const categoriesTitle =
    strapiData?.categoriesTitle || t("categoriesTitle");
  const categoriesSubtitle =
    strapiData?.categoriesSubtitle || t("categoriesSubtitle");
  const faqTitle = strapiData?.faqTitle || t("faqTitle");
  const faqViewAllLabel =
    strapiData?.faqViewAllLabel || t("faqViewAll");
  const submitTicketTitle =
    strapiData?.submitTicketTitle || t("submitTicketTitle");
  const submitTicketSubtitle =
    strapiData?.submitTicketSubtitle || t("submitTicketSubtitle");
  const signInRequiredLabel =
    strapiData?.signInRequiredLabel || t("signInRequired");
  const signInRequiredDescription =
    strapiData?.signInRequiredDescription || t("signInRequiredDesc");
  const signInLabel = strapiData?.signInLabel || t("signIn");

  // Categories: Strapi list if present and non-empty, otherwise the
  // i18n-backed fallback. We keep both shapes uniform so the render
  // branch below doesn't need to care about source.
  const fallbackCategories: DisplayCategory[] = [
    {
      backendValue: "technical",
      label: t("category_technical"),
      description: t("category_technical_desc"),
      icon: Video,
      colorClass: "bg-red-50 text-red-600",
    },
    {
      backendValue: "login",
      label: t("category_login"),
      description: t("category_login_desc"),
      icon: KeyRound,
      colorClass: "bg-amber-50 text-amber-600",
    },
    {
      backendValue: "billing",
      label: t("category_billing"),
      description: t("category_billing_desc"),
      icon: CreditCard,
      colorClass: "bg-emerald-50 text-emerald-600",
    },
    {
      backendValue: "certificate",
      label: t("category_certificate"),
      description: t("category_certificate_desc"),
      icon: Award,
      colorClass: "bg-purple-50 text-purple-600",
    },
    {
      backendValue: "content",
      label: t("category_content"),
      description: t("category_content_desc"),
      icon: BookOpen,
      colorClass: "bg-blue-50 text-blue-600",
    },
    {
      backendValue: "other",
      label: t("category_other_technical"),
      description: t("category_other_technical_desc"),
      icon: Wrench,
      colorClass: "bg-orange-50 text-orange-600",
    },
    {
      backendValue: "other",
      label: t("category_other"),
      description: t("category_other_desc"),
      icon: HelpCircle,
      colorClass: "bg-gray-100 text-gray-600",
    },
  ];

  const categories: DisplayCategory[] =
    strapiData?.categories && strapiData.categories.length > 0
      ? strapiData.categories.map((c) => ({
          backendValue: c.backendValue,
          label: c.label,
          description: c.description || "",
          icon: ICON_REGISTRY[c.iconName] || HelpCircle,
          colorClass: c.colorClass || "bg-gray-100 text-gray-600",
        }))
      : fallbackCategories;

  // FAQ: Strapi items if non-empty, otherwise the 5 keys from i18n.
  const fallbackFaqs: DisplayFAQ[] = [
    { question: t("faq1_question"), answer: t("faq1_answer") },
    { question: t("faq2_question"), answer: t("faq2_answer") },
    { question: t("faq3_question"), answer: t("faq3_answer") },
    { question: t("faq4_question"), answer: t("faq4_answer") },
    { question: t("faq5_question"), answer: t("faq5_answer") },
  ];

  const faqs: DisplayFAQ[] =
    strapiData?.items && strapiData.items.length > 0
      ? strapiData.items.map((i) => ({
          question: i.question,
          answer: i.answer,
        }))
      : fallbackFaqs;

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
          {heroTitle}
        </h1>
        <p className="text-gray-500 text-base sm:text-lg max-w-2xl mx-auto mb-6">
          {heroSubtitle}
        </p>
        <div className="flex justify-center">
          <div className="inline-flex flex-col items-center bg-white rounded-2xl px-6 py-4 shadow-sm border border-[#E8ECF0]">
            <BusinessHoursIndicator />
          </div>
        </div>
      </section>

      {/* ========== HELP ARTICLES ========== */}
      {/* Replaces the legacy "browse by category" grid — surfaces real
          Help Center content so users can self-serve before opening a
          ticket. Click anywhere on a card to open the full article. */}
      <section className="mb-12 sm:mb-16">
        <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              {categoriesTitle}
            </h2>
            <p className="text-gray-500 text-sm">{categoriesSubtitle}</p>
          </div>
          <Link
            href={`/${locale}/support/kb`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:underline"
          >
            {t("browseAllArticles")}
            <ChevronRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
          </Link>
        </div>

        {isLoadingArticles ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-[#E8ECF0] shadow-sm p-5 h-32 animate-pulse"
              />
            ))}
          </div>
        ) : topArticles.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E8ECF0] shadow-sm p-8 text-center">
            <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-1">{t("noArticlesYet")}</p>
            <p className="text-xs text-gray-400">
              {t("noArticlesYetHint")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topArticles.map((article) => {
              const title = isRTL
                ? article.titleAr || article.titleEn
                : article.titleEn || article.titleAr;
              const excerpt = htmlExcerpt(
                isRTL
                  ? article.bodyAr || article.bodyEn
                  : article.bodyEn || article.bodyAr,
              );
              const categoryLabel =
                kbCategoryMap.get(article.category) || article.category;
              return (
                <Link
                  key={article.id}
                  href={`/${locale}/support/kb/${article.id}`}
                  className="group flex flex-col gap-3 p-5 bg-white rounded-2xl border border-[#E8ECF0] shadow-sm hover:shadow-md hover:border-[var(--brand-blue)]/30 transition-all"
                  dir={isRTL ? "rtl" : "ltr"}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#EFF6FF] text-[var(--brand-blue)]">
                      <BookOpen className="w-3 h-3" />
                      {categoryLabel}
                    </span>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {(article.viewCount ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 group-hover:text-[var(--brand-blue)] transition-colors line-clamp-2">
                    {title}
                  </h3>
                  {excerpt && (
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">
                      {excerpt}
                    </p>
                  )}
                  <span className="mt-auto inline-flex items-center gap-1 text-[12px] font-medium text-[var(--brand-blue)] group-hover:underline">
                    {t("readArticle")}
                    <ChevronRight
                      className={`w-3.5 h-3.5 ${isRTL ? "rotate-180" : ""}`}
                    />
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ========== FAQ SECTION ========== */}
      <section className="mb-12 sm:mb-16">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {faqTitle}
          </h2>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {faqs.map((faq, idx) => (
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
                  {faq.question}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${
                    openFaqIndex === idx ? "rotate-180" : ""
                  }`}
                />
              </button>
              {openFaqIndex === idx && (
                <div className="px-5 pb-4" dir={isRTL ? "rtl" : "ltr"}>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {faq.answer}
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
            {faqViewAllLabel}
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
                {submitTicketTitle}
              </h2>
              <p className="text-sm text-gray-500">{submitTicketSubtitle}</p>
            </div>

            {/* Phase 2 — retired the public ticket form. All ticket
                filing is now done from inside the platform (every
                dashboard has its own Support page). Unauthenticated
                visitors get a sign-in CTA; authenticated visitors get
                a direct link to their dashboard's support inbox. */}
            <SignInToSupportCta isAuthenticated={isAuthenticated} />
          </div>
        </div>
      </section>
    </div>
  );
}

function SignInToSupportCta({ isAuthenticated }: { isAuthenticated: boolean }) {
  const t = useTranslations("supportPublicPage.guestRetired");
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white px-6 py-10 text-center">
      <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
        {isAuthenticated ? t("authedTitle") : t("guestTitle")}
      </h3>
      <p className="text-sm text-[var(--color-text-secondary)] mb-5 max-w-md mx-auto">
        {isAuthenticated ? t("authedDescription") : t("guestDescription")}
      </p>
      <a
        href={isAuthenticated ? "/dashboard" : "/auth/signin"}
        className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--color-primary)] text-white hover:opacity-90"
      >
        {isAuthenticated ? t("authedCta") : t("guestCta")}
      </a>
    </div>
  );
}
