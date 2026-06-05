"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { supportApi } from "@/lib/api";
import {
  Search,
  BookOpen,
  Eye,
  Loader2,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

type Category = NonNullable<Awaited<ReturnType<typeof supportApi.listKbCategories>>>[number];

// Strip HTML tags to a plain-text excerpt for the card preview.
function htmlToExcerpt(html: string, max = 180): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export default function PublicKBContent() {
  const locale = useLocale();
  const isRTL = locale === "ar";
  const t = useTranslations("surveys.kb");

  const [articles, setArticles] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [lang, setLang] = useState<"en" | "ar">(locale === "ar" ? "ar" : "en");

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      supportApi
        .getKbArticles({
          category: activeTab === "all" ? undefined : activeTab,
          search: searchQuery || undefined,
        })
        .then((data) => (data || []).filter((a: any) => a.published)),
      categories.length === 0
        ? supportApi.listKbCategories().catch(() => [])
        : Promise.resolve(categories),
    ])
      .then(([articlesRes, categoriesRes]) => {
        setArticles(articlesRes);
        if (categoriesRes && categoriesRes.length) {
          setCategories(categoriesRes);
        }
      })
      .catch(() => setArticles([]))
      .finally(() => setIsLoading(false));
    // categories.length dep skipped on purpose — we fetch once then cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, searchQuery]);

  const getTitle = (a: any) =>
    lang === "ar" ? a.titleAr || a.titleEn || "" : a.titleEn || a.titleAr || "";

  const categoryLabel = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach((c) =>
      m.set(c.slug, lang === "ar" && c.nameAr ? c.nameAr : c.nameEn),
    );
    return m;
  }, [categories, lang]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#EFF6FF] mb-4">
          <BookOpen className="w-7 h-7 text-[var(--color-primary)]" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] mb-2">
          {t("pageTitle")}
        </h1>
        <p className="text-[var(--color-text-secondary)] text-sm">
          {t("pageSubtitle")}
        </p>
      </div>

      {/* Search + Language Toggle */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search
            className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className={`w-full h-10 ${isRTL ? "pr-10 pl-3" : "pl-10 pr-3"} border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-input-focus)]`}
            dir={isRTL ? "rtl" : "ltr"}
          />
        </div>
        <div className="flex gap-1 bg-[var(--color-border-subtle)] rounded-lg p-0.5">
          <button
            onClick={() => setLang("en")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              lang === "en"
                ? "bg-[var(--color-surface-card)] text-[var(--color-primary)] shadow-sm"
                : "text-[var(--color-text-secondary)]"
            }`}
          >
            {t("languageEn")}
          </button>
          <button
            onClick={() => setLang("ar")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              lang === "ar"
                ? "bg-[var(--color-surface-card)] text-[var(--color-primary)] shadow-sm"
                : "text-[var(--color-text-secondary)]"
            }`}
          >
            {t("languageAr")}
          </button>
        </div>
      </div>

      {/* Category Tabs — from real DB categories */}
      <div className="flex gap-2 flex-wrap mb-6">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
            activeTab === "all"
              ? "bg-[var(--color-primary)] text-white"
              : "bg-[var(--color-surface-card)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-primary)]"
          }`}
        >
          {t("categories.all")}
        </button>
        {categories.map((cat) => {
          const active = activeTab === cat.slug;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.slug)}
              className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                active
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-[var(--color-surface-card)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-primary)]"
              }`}
            >
              {lang === "ar" && cat.nameAr ? cat.nameAr : cat.nameEn}
            </button>
          );
        })}
      </div>

      {/* Articles — clickable cards linking to detail pages */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="w-12 h-12 text-[var(--color-text-secondary)] opacity-50 mx-auto mb-3" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t("noArticles")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {articles.map((article) => (
            <Link
              key={article.id}
              href={`/${locale}/support/kb/${article.id}`}
              className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5 hover:border-[var(--color-primary)] hover:shadow-sm transition-all block"
              dir={lang === "ar" ? "rtl" : "ltr"}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1.5 line-clamp-2">
                    {getTitle(article)}
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 mb-2">
                    {htmlToExcerpt(
                      lang === "ar"
                        ? article.bodyAr || article.bodyEn
                        : article.bodyEn || article.bodyAr,
                    )}
                  </p>
                  <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-secondary)]">
                    <span className="px-2 py-0.5 bg-[var(--color-border-subtle)] rounded-full font-medium">
                      {categoryLabel.get(article.category) || article.category}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" /> {article.viewCount || 0}{" "}
                      {t("viewsLabel")}
                    </span>
                  </div>
                </div>
                {isRTL ? (
                  <ChevronLeft className="w-4 h-4 text-[var(--color-text-secondary)] opacity-50 flex-shrink-0 mt-1" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)] opacity-50 flex-shrink-0 mt-1" />
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
