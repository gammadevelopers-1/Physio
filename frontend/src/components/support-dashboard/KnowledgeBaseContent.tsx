"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { supportApi } from "@/lib/api";
import { useSupportProfile } from "@/hooks/useSupportProfile";
import { toast } from "sonner";
import SupportNavbar from "./SupportNavbar";
import SupportSidebar from "./SupportSidebar";
import SupportMobileSidebar from "./SupportMobileSidebar";
import {
  BookOpen,
  CheckCircle,
  FileText,
  Eye,
  Search,
  Plus,
  ThumbsUp,
  Calendar,
  Pencil,
  Trash2,
  MoreVertical,
  Loader2,
} from "lucide-react";

const KnowledgeBaseContent = () => {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  const profile = useSupportProfile();

  const [articles, setArticles] = useState<any[]>([]);
  const [isLoadingArticles, setIsLoadingArticles] = useState(true);
  const [showArticleForm, setShowArticleForm] = useState(false);
  const [editingArticle, setEditingArticle] = useState<any>(null);
  const [articleForm, setArticleForm] = useState({ titleEn: '', titleAr: '', bodyEn: '', bodyAr: '', category: 'technical', published: false });
  const [articleSaving, setArticleSaving] = useState(false);

  const handleSaveArticle = async () => {
    if (!articleForm.titleEn.trim() || !articleForm.bodyEn.trim()) { toast.error('English title and body are required'); return; }
    setArticleSaving(true);
    try {
      const data = {
        titleEn: articleForm.titleEn.trim(),
        titleAr: articleForm.titleAr.trim(),
        bodyEn: articleForm.bodyEn.trim(),
        bodyAr: articleForm.bodyAr.trim(),
        category: articleForm.category,
        published: articleForm.published,
      };
      if (editingArticle) {
        await supportApi.updateKbArticle(editingArticle.id, data);
        toast.success('Article updated');
      } else {
        await supportApi.createKbArticle(data);
        toast.success('Article created');
      }
      setShowArticleForm(false);
      // Refresh list
      const refreshed = await supportApi.getKbArticles({
        category: activeTab === 'all' ? undefined : activeTab,
        search: searchQuery || undefined,
      });
      setArticles(refreshed || []);
    } catch { toast.error('Failed to save article'); }
    finally { setArticleSaving(false); }
  };

  const handleDeleteArticle = async (id: string) => {
    if (!confirm('Delete this article?')) return;
    try {
      await supportApi.deleteKbArticle(id);
      setArticles(prev => prev.filter(a => a.id !== id));
      toast.success('Article deleted');
    } catch { toast.error('Failed to delete article'); }
  };

  useEffect(() => {
    setIsLoadingArticles(true);
    supportApi.getKbArticles({
      category: activeTab === 'all' ? undefined : activeTab,
      search: searchQuery || undefined,
    })
      .then(data => setArticles(data || []))
      .catch(() => setArticles([]))
      .finally(() => setIsLoadingArticles(false));
  }, [activeTab, searchQuery]);

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
      value: String(articles.filter(a => a.published).length),
      icon: CheckCircle,
      bgColor: "bg-[#DCFCE7]",
      textColor: "text-[#16A34A]",
    },
    {
      label: t("kbPage.stats.drafts"),
      value: String(articles.filter(a => !a.published).length),
      icon: FileText,
      bgColor: "bg-[#FFEDD5]",
      textColor: "text-[#EA580C]",
    },
    {
      label: t("kbPage.stats.totalViews"),
      value: String(articles.reduce((sum: number, a: any) => sum + (a.viewCount || 0), 0)),
      icon: Eye,
      bgColor: "bg-[#EDE9FE]",
      textColor: "text-[#8B5CF6]",
    },
  ];

  const tabs = [
    { key: "all", label: t("kbPage.tabs.all") },
    { key: "billing", label: t("kbPage.tabs.billing") },
    { key: "login", label: t("kbPage.tabs.login") },
    { key: "content", label: t("kbPage.tabs.content") },
    { key: "technical", label: t("kbPage.tabs.technical") },
  ];

  const filteredArticles = articles.filter((article) => {
    const matchesTab = activeTab === "all" || article.category === activeTab;
    const matchesSearch =
      searchQuery === "" ||
      article.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const getCategoryStyle = (category: string) => {
    switch (category) {
      case "billing":
        return "bg-[var(--color-border-subtle)] text-[var(--color-primary)]";
      case "login":
        return "bg-[#EDE9FE] text-[#8B5CF6]";
      case "content":
        return "bg-[#FFEDD5] text-[#EA580C]";
      case "technical":
        return "bg-[#FEF9C3] text-[#CA8A04]";
      default:
        return "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "billing":
        return t("kbPage.categories.billing");
      case "login":
        return t("kbPage.categories.login");
      case "content":
        return t("kbPage.categories.content");
      case "technical":
        return t("kbPage.categories.technical");
      default:
        return category;
    }
  };

  return (
    <>
      {/* Dashboard Navbar */}
      <SupportNavbar profile={profile} />

      {/* Main Container */}
      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar - Hidden on mobile */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <SupportSidebar profile={profile} supportSubRole={user?.supportSubRole} />
            </div>

            {/* Mobile Sidebar */}
            <SupportMobileSidebar profile={profile} supportSubRole={user?.supportSubRole} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Title */}
              <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                  {t("kbPage.title")}
                </h1>
                <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                  {t("kbPage.subtitle")}
                </p>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {stats.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div
                      key={stat.label}
                      className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div
                          className={`w-10 h-10 ${stat.bgColor} rounded-lg flex items-center justify-center`}
                        >
                          <Icon className={`w-5 h-5 ${stat.textColor}`} />
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-[var(--color-text-secondary)]">
                        {stat.value}
                      </p>
                      <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                        {stat.label}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Header with Search and New Article Button */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                {/* Search */}
                <div className="relative w-full sm:w-auto">
                  <Search
                    className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "right-3" : "left-3"} w-4 h-4 text-[var(--color-text-secondary)]`}
                  />
                  <input
                    type="text"
                    placeholder={t("kbPage.searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full sm:w-[280px] h-10 ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} border border-[var(--color-input-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)] focus:border-transparent`}
                  />
                </div>

                {/* New Article Button */}
                <button
                  onClick={() => { setEditingArticle(null); setArticleForm({ titleEn: '', titleAr: '', bodyEn: '', bodyAr: '', category: 'technical', published: false }); setShowArticleForm(true); }}
                  className="btn-gold text-[var(--color-button-text)] h-10 px-4 rounded-lg text-sm font-medium flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {t("kbPage.newArticle")}
                </button>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-2 mb-6 overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                      activeTab === tab.key
                        ? "bg-[var(--color-text-primary)] text-white"
                        : "bg-[var(--color-surface-card)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-border-subtle)]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Article Form */}
              {showArticleForm && (
                <div className="mb-6 p-4 border border-[#C7D5F0] bg-[#F0F4FF] rounded-lg">
                  <h4 className="text-sm font-semibold text-[#002D87] mb-3">{editingArticle ? 'Edit Article' : 'Create New Article'}</h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Title (English) *</label>
                        <input type="text" value={articleForm.titleEn} onChange={e => setArticleForm(p => ({...p, titleEn: e.target.value}))}
                          className="w-full h-9 px-3 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[#002D87]" placeholder="Article title in English" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Title (Arabic)</label>
                        <input type="text" value={articleForm.titleAr} onChange={e => setArticleForm(p => ({...p, titleAr: e.target.value}))}
                          className="w-full h-9 px-3 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[#002D87]" placeholder="Article title in Arabic" dir="rtl" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Body (English) *</label>
                        <textarea value={articleForm.bodyEn} onChange={e => setArticleForm(p => ({...p, bodyEn: e.target.value}))}
                          rows={5} className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm resize-none focus:outline-none focus:border-[#002D87]"
                          placeholder="Article content in English..." />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Body (Arabic)</label>
                        <textarea value={articleForm.bodyAr} onChange={e => setArticleForm(p => ({...p, bodyAr: e.target.value}))}
                          rows={5} className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm resize-none focus:outline-none focus:border-[#002D87]"
                          placeholder="Article content in Arabic..." dir="rtl" />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <div>
                        <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">Category</label>
                        <select value={articleForm.category} onChange={e => setArticleForm(p => ({...p, category: e.target.value}))}
                          className="h-9 px-3 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[#002D87]">
                          <option value="technical">Technical</option>
                          <option value="billing">Billing</option>
                          <option value="login">Login</option>
                          <option value="content">Content</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2 pt-4">
                        <button onClick={() => setArticleForm(p => ({...p, published: !p.published}))}
                          className={`w-10 h-5 rounded-full transition-colors flex items-center px-0.5 ${articleForm.published ? 'bg-[#22C55E]' : 'bg-[var(--color-border)]'}`}>
                          <div className={`w-4 h-4 bg-white rounded-full shadow transition-all ${articleForm.published ? 'ms-auto' : ''}`} />
                        </button>
                        <span className="text-xs text-[var(--color-text-secondary)]">{articleForm.published ? 'Published' : 'Draft'}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleSaveArticle} disabled={articleSaving}
                        className="px-4 py-1.5 bg-[#002D87] text-white text-xs font-medium rounded-lg hover:opacity-90 disabled:opacity-50">
                        {articleSaving ? 'Saving...' : editingArticle ? 'Update' : 'Create'}
                      </button>
                      <button onClick={() => setShowArticleForm(false)} className="px-4 py-1.5 text-xs text-[var(--color-text-secondary)] hover:underline">Cancel</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Article Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredArticles.map((article) => (
                  <div
                    key={article.id}
                    className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5"
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-[var(--color-text-secondary)]" />
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${getCategoryStyle(article.category)}`}
                        >
                          {getCategoryLabel(article.category)}
                        </span>
                      </div>

                      {/* Action Dropdown */}
                      <div className="relative">
                        <button
                          onClick={() =>
                            setOpenActionId(
                              openActionId === article.id ? null : article.id
                            )
                          }
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
                        >
                          <MoreVertical className="w-4 h-4 text-[var(--color-text-secondary)]" />
                        </button>

                        {openActionId === article.id && (
                          <div
                            className={`absolute top-full mt-1 ${isRTL ? "left-0" : "right-0"} bg-[var(--color-surface-card)] rounded-lg shadow-lg border border-[var(--color-border)] py-1 min-w-[140px] z-10`}
                          >
                            <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors">
                              <Eye className="w-4 h-4" />
                              {t("kbPage.actions.view")}
                            </button>
                            <button
                              onClick={() => {
                                setEditingArticle(article);
                                setArticleForm({
                                  titleEn: article.titleEn || article.title || '',
                                  titleAr: article.titleAr || '',
                                  bodyEn: article.bodyEn || article.body || '',
                                  bodyAr: article.bodyAr || '',
                                  category: article.category || 'technical',
                                  published: article.published ?? false,
                                });
                                setShowArticleForm(true);
                                setOpenActionId(null);
                              }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                              {t("kbPage.actions.edit")}
                            </button>
                            <button onClick={() => {
                              setOpenActionId(null);
                              handleDeleteArticle(article.id);
                            }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#EF4444] hover:bg-red-50 transition-colors">
                              <Trash2 className="w-4 h-4" />
                              {t("kbPage.actions.delete")}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-2 line-clamp-2">
                      {article.title}
                    </h3>

                    {/* Visibility & Status Badges */}
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          article.visibility === "public"
                            ? "bg-[#DCFCE7] text-[#16A34A]"
                            : "bg-[#FEF9C3] text-[#CA8A04]"
                        }`}
                      >
                        {article.visibility === "public"
                          ? t("kbPage.visibility.public")
                          : t("kbPage.visibility.internal")}
                      </span>
                      {article.status === "draft" && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
                          {t("kbPage.status.draft")}
                        </span>
                      )}
                    </div>

                    {/* Stats Row */}
                    <div className="flex items-center gap-4 pt-3 border-t border-[var(--color-border)]">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                        <Eye className="w-3.5 h-3.5" />
                        <span>
                          {article.views.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>{article.helpful}%</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{article.updated}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default KnowledgeBaseContent;
