"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { supportApi } from "@/lib/api";
import { toast } from "sonner";
import Select from "@/components/admin-dashboard/Select";
import HelpCenterEditorDialog from "./HelpCenterEditorDialog";
import HelpCenterCategoryManager from "./HelpCenterCategoryManager";
import {
  BookOpen,
  CheckCircle,
  FileText,
  Eye,
  Search,
  Plus,
  Calendar,
  Pencil,
  Trash2,
  Loader2,
  Tags,
  ExternalLink,
  X,
  User as UserIcon,
} from "lucide-react";
import ConfirmDialog from "@/components/support-shared/ConfirmDialog";

type Category = NonNullable<Awaited<ReturnType<typeof supportApi.listKbCategories>>>[number];

/**
 * Shell-less Help Center management view. Used by:
 *   - Supervisor KB page (KnowledgeBaseContent — wraps this with the
 *     SupportNavbar/SupportSidebar). Supervisors get full CRUD.
 *   - Admin Support page tab (no chrome — the admin layout already
 *     renders AdminNavbar / AdminSidebar). Admins get full CRUD.
 *   - Agent KB page — `canEdit={false}` hides the create/edit/delete
 *     UI so agents can still browse + preview articles to help
 *     customers but can't change content.
 */
export default function HelpCenterManager({
  canEdit = true,
}: {
  canEdit?: boolean;
} = {}) {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  // ── Data ─────────────────────────────────────────────────────────
  const [articles, setArticles] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Filters ─────────────────────────────────────────────────────
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "views">("newest");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(searchInput), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  // ── Modals ──────────────────────────────────────────────────────
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<any | null>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [previewArticle, setPreviewArticle] = useState<any | null>(null);
  // Phase 2 — pending KB article delete (replaces window.confirm).
  const [pendingDeleteArticle, setPendingDeleteArticle] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const fetchArticles = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await supportApi.getKbArticles({
        category: activeCategory === "all" ? undefined : activeCategory,
        search: searchQuery || undefined,
      });
      setArticles(data || []);
    } catch {
      setArticles([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeCategory, searchQuery]);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await supportApi.listKbCategories();
      setCategories(data || []);
    } catch {
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Deep-link support: when the Reports page hands off a zero-result
  // search query as a FAQ candidate, we land here with ?prefillTitle
  // (and ?prefillLocale=ar|en). Open the editor with that title
  // populated in the right language so the supervisor only has to
  // write the body. Cleared from the URL after consumption so a
  // refresh doesn't re-open the dialog.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const prefillConsumedRef = useRef(false);
  useEffect(() => {
    if (!canEdit || prefillConsumedRef.current) return;
    if (categories.length === 0) return; // wait for category list
    const prefillTitle = searchParams?.get("prefillTitle");
    const prefillLocale = searchParams?.get("prefillLocale");
    const editArticleId = searchParams?.get("editArticleId");

    if (prefillTitle) {
      prefillConsumedRef.current = true;
      const isAr = prefillLocale === "ar";
      setEditingArticle({
        titleEn: isAr ? "" : prefillTitle,
        titleAr: isAr ? prefillTitle : "",
        bodyEn: "",
        bodyAr: "",
        category: categories[0]?.slug || "",
        published: false,
      });
      setEditorOpen(true);
      // Strip the query so a refresh doesn't re-trigger.
      router.replace(pathname || "", { scroll: false });
    } else if (editArticleId && articles.length > 0) {
      const target = articles.find((a) => a.id === editArticleId);
      if (target) {
        prefillConsumedRef.current = true;
        setEditingArticle(target);
        setEditorOpen(true);
        router.replace(pathname || "", { scroll: false });
      }
    }
  }, [searchParams, canEdit, categories, articles, router, pathname]);

  const categoryBySlug = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach((c) => m.set(c.slug, c));
    return m;
  }, [categories]);

  const filteredArticles = useMemo(() => {
    let list = [...articles];
    if (statusFilter === "published") list = list.filter((a) => a.published);
    if (statusFilter === "draft") list = list.filter((a) => !a.published);
    list.sort((a, b) => {
      if (sortBy === "views") return (b.viewCount ?? 0) - (a.viewCount ?? 0);
      if (sortBy === "oldest")
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return list;
  }, [articles, statusFilter, sortBy]);

  const stats = [
    {
      label: t("kbPage.stats.totalArticles"),
      value: String(articles.length),
      icon: BookOpen,
      bgColor: "bg-[var(--color-border-subtle)]",
      textColor: "text-[var(--color-primary)]",
    },
    {
      label: t("kbPage.stats.published"),
      value: String(articles.filter((a) => a.published).length),
      icon: CheckCircle,
      bgColor: "bg-[#DCFCE7]",
      textColor: "text-[#16A34A]",
    },
    {
      label: t("kbPage.stats.drafts"),
      value: String(articles.filter((a) => !a.published).length),
      icon: FileText,
      bgColor: "bg-[#FFEDD5]",
      textColor: "text-[#EA580C]",
    },
    {
      label: t("kbPage.stats.totalViews"),
      value: String(articles.reduce((s, a) => s + (a.viewCount || 0), 0)),
      icon: Eye,
      bgColor: "bg-[#EDE9FE]",
      textColor: "text-[#8B5CF6]",
    },
  ];

  function openCreate() {
    setEditingArticle(null);
    setEditorOpen(true);
  }
  function openEdit(article: any) {
    setEditingArticle(article);
    setEditorOpen(true);
  }
  function handleDelete(id: string) {
    const article = articles.find((a) => a.id === id);
    setPendingDeleteArticle({
      id,
      title: article?.titleEn || article?.titleAr || "",
    });
  }

  async function doDeleteArticle(id: string) {
    try {
      await supportApi.deleteKbArticle(id);
      setArticles((prev) => prev.filter((a) => a.id !== id));
      toast.success(t("kbPage.toasts.deleted"));
    } catch {
      toast.error(t("kbPage.toasts.deleteFailed"));
    }
  }

  return (
    <>
      {/* Toolbar — title-less so callers can decide on their own header.
          Hidden in read-only mode so agents see a clean browse view. */}
      {canEdit && (
        <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
          <button
            type="button"
            onClick={() => setCategoryManagerOpen(true)}
            className="flex items-center gap-1.5 h-10 px-3 text-[13px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)]"
          >
            <Tags className="w-4 h-4" />
            <span className="hidden sm:inline">
              {t("kbPage.manageCategories")}
            </span>
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-1.5 h-10 px-4 bg-[var(--color-primary)] hover:bg-[#001d5e] text-white text-sm font-medium rounded-lg"
          >
            <Plus className="w-4 h-4" />
            {t("kbPage.newArticle")}
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 flex items-start gap-3"
            >
              <div
                className={`w-10 h-10 ${stat.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}
              >
                <Icon className={`w-5 h-5 ${stat.textColor}`} />
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-secondary)] font-medium">
                  {stat.label}
                </p>
                <p className="text-xl font-bold text-[var(--color-text-primary)]">
                  {stat.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 mb-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search
              className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("kbPage.searchPlaceholder")}
              className={`w-full h-10 border border-[var(--color-input-border)] rounded-lg text-sm bg-[var(--color-surface-card)] focus:outline-none focus:border-[var(--color-primary)] ${isRTL ? "pr-10 pl-3" : "pl-10 pr-3"}`}
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as typeof statusFilter)}
            className="w-full md:w-40"
            options={[
              { value: "all", label: t("kbPage.filters.allStatus") },
              { value: "published", label: t("kbPage.filters.published") },
              { value: "draft", label: t("kbPage.filters.draft") },
            ]}
          />
          <Select
            value={sortBy}
            onChange={(v) => setSortBy(v as typeof sortBy)}
            className="w-full md:w-44"
            options={[
              { value: "newest", label: t("kbPage.filters.sortNewest") },
              { value: "oldest", label: t("kbPage.filters.sortOldest") },
              { value: "views", label: t("kbPage.filters.sortViews") },
            ]}
          />
        </div>
      </div>

      {/* Category pills */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveCategory("all")}
          className={`px-3 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors ${
            activeCategory === "all"
              ? "bg-[var(--color-primary)] text-white"
              : "bg-[var(--color-surface-card)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-border-subtle)]"
          }`}
        >
          {t("kbPage.tabs.all")}
        </button>
        {categories.map((cat) => {
          const active = activeCategory === cat.slug;
          const label = isRTL && cat.nameAr ? cat.nameAr : cat.nameEn;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.slug)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors ${
                active
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-[var(--color-surface-card)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-border-subtle)]"
              }`}
            >
              {label}
              {cat.articleCount > 0 && (
                <span
                  className={`min-w-[18px] h-4 inline-flex items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-[var(--color-border)] text-[var(--color-text-secondary)]"
                  }`}
                >
                  {cat.articleCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Articles grid */}
      {isLoading ? (
        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-secondary)]" />
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-12 text-center">
          <BookOpen className="w-10 h-10 text-[var(--color-text-secondary)] mx-auto mb-3" />
          <p className="text-sm text-[var(--color-text-primary)] font-medium mb-1">
            {articles.length === 0
              ? t("kbPage.emptyTitle")
              : t("kbPage.noMatches")}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] mb-4">
            {articles.length === 0
              ? t("kbPage.emptyHint")
              : t("kbPage.noMatchesHint")}
          </p>
          {canEdit && articles.length === 0 && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 h-10 px-4 bg-[var(--color-primary)] text-white text-sm font-medium rounded-lg hover:bg-[#001d5e]"
            >
              <Plus className="w-4 h-4" />
              {t("kbPage.newArticle")}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredArticles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              category={categoryBySlug.get(article.category)}
              isRTL={isRTL}
              locale={locale}
              canEdit={canEdit}
              onPreview={() => setPreviewArticle(article)}
              onEdit={() => openEdit(article)}
              onDelete={() => handleDelete(article.id)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {editorOpen && (
        <HelpCenterEditorDialog
          article={editingArticle}
          categories={categories}
          onClose={() => setEditorOpen(false)}
          onSaved={() => {
            setEditorOpen(false);
            fetchArticles();
            fetchCategories();
          }}
        />
      )}

      {categoryManagerOpen && (
        <HelpCenterCategoryManager
          onClose={() => setCategoryManagerOpen(false)}
          onChanged={() => {
            fetchCategories();
            fetchArticles();
          }}
        />
      )}

      {previewArticle && (
        <ArticlePreviewSheet
          article={previewArticle}
          category={categoryBySlug.get(previewArticle.category)}
          onClose={() => setPreviewArticle(null)}
        />
      )}

      <ConfirmDialog
        open={!!pendingDeleteArticle}
        onOpenChange={(o) => !o && setPendingDeleteArticle(null)}
        title={t("kbPage.toasts.confirmDeleteTitle")}
        description={
          pendingDeleteArticle
            ? t("kbPage.toasts.confirmDeleteDescription", {
                name: pendingDeleteArticle.title || t("kbPage.untitled"),
              })
            : ""
        }
        destructive
        confirmLabel={t("kbPage.toasts.delete")}
        onConfirm={async () => {
          if (pendingDeleteArticle) await doDeleteArticle(pendingDeleteArticle.id);
        }}
      />
    </>
  );
}

function ArticleCard({
  article,
  category,
  isRTL,
  locale,
  canEdit,
  onPreview,
  onEdit,
  onDelete,
}: {
  article: any;
  category?: Category;
  isRTL: boolean;
  locale: string;
  canEdit: boolean;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("supportDashboard");
  const title =
    isRTL && article.titleAr
      ? article.titleAr
      : article.titleEn || article.titleAr || t("kbPage.untitled");
  const categoryLabel = category
    ? isRTL && category.nameAr
      ? category.nameAr
      : category.nameEn
    : article.category;

  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5 flex flex-col gap-3 hover:border-[var(--color-primary)] hover:shadow-sm transition-all">
      <div className="flex items-start justify-between gap-2">
        <span className="bg-[#F3F4F6] text-[#4B5563] text-[11px] px-2 py-0.5 rounded-full font-medium">
          {categoryLabel}
        </span>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            article.published
              ? "bg-[#DCFCE7] text-[#15803D]"
              : "bg-[#FFEDD5] text-[#EA580C]"
          }`}
        >
          {article.published ? t("kbPage.status.published") : t("kbPage.status.draft")}
        </span>
      </div>

      <h3
        className="text-sm font-semibold text-[var(--color-text-primary)] line-clamp-2"
        title={title}
      >
        {title}
      </h3>

      <div className="flex items-center gap-3 text-[11px] text-[var(--color-text-secondary)] mt-auto">
        <span className="flex items-center gap-1">
          <Eye className="w-3 h-3" />
          {(article.viewCount ?? 0).toLocaleString()}
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {article.createdAt
            ? new Date(article.createdAt).toLocaleDateString(
                locale === "ar" ? "ar-SA" : "en-US",
                { year: "numeric", month: "short", day: "numeric" },
              )
            : ""}
        </span>
        {article.authorFirstName && (
          <span className="flex items-center gap-1 truncate">
            <UserIcon className="w-3 h-3" />
            {article.authorFirstName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 border-t border-[var(--color-border)] pt-3">
        <button
          type="button"
          onClick={onPreview}
          className="flex items-center gap-1 px-2 py-1 text-[12px] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] rounded-md"
        >
          <Eye className="w-3.5 h-3.5" />
          {t("kbPage.actions.preview")}
        </button>
        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1 px-2 py-1 text-[12px] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] rounded-md"
          >
            <Pencil className="w-3.5 h-3.5" />
            {t("kbPage.actions.edit")}
          </button>
        )}
        {article.published && (
          <Link
            href={`/${locale}/support/kb/${article.id}`}
            target="_blank"
            className="flex items-center gap-1 px-2 py-1 text-[12px] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] rounded-md"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {t("kbPage.actions.viewPublic")}
          </Link>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={onDelete}
            className="ml-auto flex items-center gap-1 px-2 py-1 text-[12px] text-[#DC2626] hover:bg-[#FEE2E2] rounded-md"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function ArticlePreviewSheet({
  article,
  category,
  onClose,
}: {
  article: any;
  category?: Category;
  onClose: () => void;
}) {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const [lang, setLang] = useState<"en" | "ar">(locale === "ar" ? "ar" : "en");
  const title = lang === "ar" ? article.titleAr || article.titleEn : article.titleEn || article.titleAr;
  const body = lang === "ar" ? article.bodyAr || article.bodyEn : article.bodyEn || article.bodyAr;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />
      <aside className={`fixed top-0 h-full w-full max-w-2xl bg-[var(--color-surface-card)] z-[70] shadow-xl overflow-y-auto ${isRTL ? "left-0" : "right-0"}`}>
        <div className="sticky top-0 bg-[var(--color-surface-card)] border-b border-[var(--color-border)] px-5 py-4 flex items-center justify-between z-10">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            {t("kbPage.preview.title")}
          </h3>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 bg-[var(--color-border-subtle)] rounded-md p-0.5">
              <button
                onClick={() => setLang("en")}
                className={`px-2 py-1 text-[11px] font-medium rounded ${
                  lang === "en"
                    ? "bg-[var(--color-surface-card)] text-[var(--color-primary)] shadow-sm"
                    : "text-[var(--color-text-secondary)]"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLang("ar")}
                className={`px-2 py-1 text-[11px] font-medium rounded ${
                  lang === "ar"
                    ? "bg-[var(--color-surface-card)] text-[var(--color-primary)] shadow-sm"
                    : "text-[var(--color-text-secondary)]"
                }`}
              >
                AR
              </button>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-[var(--color-border-subtle)] rounded-lg">
              <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
            </button>
          </div>
        </div>
        <div className="p-6" dir={lang === "ar" ? "rtl" : "ltr"}>
          {category && (
            <span className="inline-block mb-3 bg-[#F3F4F6] text-[#4B5563] text-[11px] px-2 py-0.5 rounded-full font-medium">
              {lang === "ar" && category.nameAr ? category.nameAr : category.nameEn}
            </span>
          )}
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
            {title || t("kbPage.untitled")}
          </h2>
          {body ? (
            <div
              className="kb-article-body prose prose-sm max-w-none text-[var(--color-text-primary)]"
              dangerouslySetInnerHTML={{ __html: body }}
            />
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)] italic">
              {t("kbPage.preview.empty")}
            </p>
          )}
        </div>
      </aside>
    </>
  );
}
