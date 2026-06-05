"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { supportApi } from "@/lib/api";
import {
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface Props {
  articleId: string;
}

export default function KbArticleDetail({ articleId }: Props) {
  const locale = useLocale();
  const isRTL = locale === "ar";
  const t = useTranslations("surveys.kb");

  const [article, setArticle] = useState<any | null>(null);
  const [related, setRelated] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lang, setLang] = useState<"en" | "ar">(locale === "ar" ? "ar" : "en");

  useEffect(() => {
    setIsLoading(true);
    setError(false);
    supportApi
      .getKbArticle(articleId)
      .then((data) => setArticle(data))
      .catch(() => setError(true))
      .finally(() => setIsLoading(false));
  }, [articleId]);

  // Pull related (same-category, published) once the article is loaded.
  useEffect(() => {
    if (!article?.category) return;
    supportApi
      .getKbArticles({ category: article.category })
      .then((data) => {
        const list = (data || [])
          .filter((a: any) => a.id !== article.id && a.published)
          .slice(0, 5);
        setRelated(list);
      })
      .catch(() => setRelated([]));
  }, [article]);

  const title = lang === "ar"
    ? article?.titleAr || article?.titleEn || ""
    : article?.titleEn || article?.titleAr || "";
  const body = lang === "ar"
    ? article?.bodyAr || article?.bodyEn || ""
    : article?.bodyEn || article?.bodyAr || "";

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <AlertCircle className="w-12 h-12 text-[#DC2626] mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
          {t("notFoundTitle")}
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          {t("notFoundBody")}
        </p>
        <Link
          href={`/${locale}/support/kb`}
          className="inline-flex items-center gap-1.5 h-10 px-4 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[#001d5e]"
        >
          {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {t("backToHelpCenter")}
        </Link>
      </div>
    );
  }

  // Unpublished articles must not be reachable by the public — refuse
  // to render the body even if the API returned the row (it does for
  // supervisor/admin previews).
  if (!article.published) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <AlertCircle className="w-12 h-12 text-[#F97316] mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
          {t("unpublishedTitle")}
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          {t("unpublishedBody")}
        </p>
        <Link
          href={`/${locale}/support/kb`}
          className="inline-flex items-center gap-1.5 h-10 px-4 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[#001d5e]"
        >
          {t("backToHelpCenter")}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Breadcrumb — full chain so users can step back to either Help
          Center or the main Support page. The chevron between crumbs
          flips for RTL automatically. */}
      <nav
        aria-label="Breadcrumb"
        className={`flex items-center gap-1.5 text-[13px] text-[var(--color-text-secondary)] mb-6 ${isRTL ? "flex-row-reverse" : ""}`}
      >
        <Link
          href={`/${locale}/support`}
          className="hover:text-[var(--color-primary)] transition-colors"
        >
          {t("backToSupport")}
        </Link>
        {isRTL ? (
          <ChevronLeft className="w-3.5 h-3.5 opacity-50" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 opacity-50" />
        )}
        <Link
          href={`/${locale}/support/kb`}
          className="hover:text-[var(--color-primary)] transition-colors"
        >
          {t("backToHelpCenter")}
        </Link>
      </nav>

      {/* Article header */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-6 sm:p-8 mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[var(--color-border-subtle)] text-[var(--color-primary)]">
            <BookOpen className="w-3.5 h-3.5" />
            {article.category}
          </span>
          {article.titleAr && article.titleEn && (
            <div className="flex gap-0.5 bg-[var(--color-border-subtle)] rounded-md p-0.5">
              <button
                onClick={() => setLang("en")}
                className={`px-2.5 py-1 text-[11px] font-medium rounded ${
                  lang === "en"
                    ? "bg-[var(--color-surface-card)] text-[var(--color-primary)] shadow-sm"
                    : "text-[var(--color-text-secondary)]"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLang("ar")}
                className={`px-2.5 py-1 text-[11px] font-medium rounded ${
                  lang === "ar"
                    ? "bg-[var(--color-surface-card)] text-[var(--color-primary)] shadow-sm"
                    : "text-[var(--color-text-secondary)]"
                }`}
              >
                AR
              </button>
            </div>
          )}
        </div>

        <h1
          className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] mb-3"
          dir={lang === "ar" ? "rtl" : "ltr"}
        >
          {title || "(untitled)"}
        </h1>

        {article.createdAt && (
          <div className="flex items-center gap-4 text-xs text-[var(--color-text-secondary)] border-b border-[var(--color-border)] pb-4 mb-6">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(article.createdAt).toLocaleDateString(
                locale === "ar" ? "ar-SA" : "en-US",
                { year: "numeric", month: "long", day: "numeric" },
              )}
            </span>
          </div>
        )}

        {/* Body — HTML rendered. Trust here is OK: only support/admin
            roles can author and the rich-text editor produces a fixed
            schema of tags. */}
        <div
          className="kb-article-body prose prose-sm sm:prose-base max-w-none text-[var(--color-text-primary)]"
          dir={lang === "ar" ? "rtl" : "ltr"}
          dangerouslySetInnerHTML={{ __html: body || `<p>${t("noContent")}</p>` }}
        />
      </div>

      {/* Related articles */}
      {related.length > 0 && (
        <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-6">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">
            {t("relatedArticles")}
          </h2>
          <div className="space-y-2">
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/${locale}/support/kb/${r.id}`}
                className="block border border-[var(--color-border)] rounded-lg p-3 hover:border-[var(--color-primary)] hover:bg-[var(--color-border-subtle)] transition-colors"
              >
                <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                  {lang === "ar" && r.titleAr ? r.titleAr : r.titleEn || r.titleAr}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Article body styles — mirror RichTextEditor's tiptap-content. */}
      <style jsx global>{`
        .kb-article-body h1 {
          font-size: 1.75rem;
          font-weight: 700;
          margin: 1em 0 0.5em;
        }
        .kb-article-body h2 {
          font-size: 1.375rem;
          font-weight: 600;
          margin: 1em 0 0.5em;
        }
        .kb-article-body h3 {
          font-size: 1.125rem;
          font-weight: 600;
          margin: 0.75em 0 0.25em;
        }
        .kb-article-body p {
          margin: 0.5em 0;
          line-height: 1.7;
        }
        .kb-article-body ul {
          list-style: disc;
          padding-left: 1.5rem;
          margin: 0.5em 0;
        }
        .kb-article-body ol {
          list-style: decimal;
          padding-left: 1.5rem;
          margin: 0.5em 0;
        }
        .kb-article-body blockquote {
          border-left: 3px solid var(--color-border);
          padding-left: 1rem;
          margin: 0.75em 0;
          color: var(--color-text-secondary);
          font-style: italic;
        }
        .kb-article-body[dir="rtl"] ul,
        .kb-article-body[dir="rtl"] ol {
          padding-left: 0;
          padding-right: 1.5rem;
        }
        .kb-article-body[dir="rtl"] blockquote {
          border-left: none;
          border-right: 3px solid var(--color-border);
          padding-left: 0;
          padding-right: 1rem;
        }
        .kb-article-body img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          margin: 1em 0;
          display: block;
        }
        .kb-article-body code {
          background: var(--color-border-subtle);
          padding: 0.1em 0.3em;
          border-radius: 0.25rem;
          font-size: 0.875em;
        }
        .kb-article-body pre {
          background: var(--color-border-subtle);
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin: 0.75em 0;
        }
        .kb-article-body a {
          color: var(--color-primary);
          text-decoration: underline;
        }
        .kb-article-body strong {
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
