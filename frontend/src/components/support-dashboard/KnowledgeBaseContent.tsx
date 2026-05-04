"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
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
} from "lucide-react";

// Mock Support Profile
const mockProfile = {
  name: "Hana Al-Saud",
  email: "h.alsaud@physio.edu.sa",
  resolved: 156,
  csat: 94,
  avgFRT: "1.2h",
};

const KnowledgeBaseContent = () => {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  const profile = { ...mockProfile, name: t("names.hanaAlSaud") };

  const articles = [
    {
      id: "1",
      title: t("kbPage.articles.howToResetPassword"),
      category: "login",
      visibility: "public",
      views: 2450,
      helpful: 92,
      updated: t("mockDates.feb10_2026"),
      status: "published",
    },
    {
      id: "2",
      title: t("kbPage.articles.paymentMethods"),
      category: "billing",
      visibility: "public",
      views: 1830,
      helpful: 88,
      updated: t("mockDates.feb9_2026"),
      status: "published",
    },
    {
      id: "3",
      title: t("kbPage.articles.certificateDownload"),
      category: "content",
      visibility: "public",
      views: 1560,
      helpful: 95,
      updated: t("mockDates.feb8_2026"),
      status: "published",
    },
    {
      id: "4",
      title: t("kbPage.articles.refundPolicy"),
      category: "billing",
      visibility: "public",
      views: 980,
      helpful: 85,
      updated: t("mockDates.feb7_2026"),
      status: "published",
    },
    {
      id: "5",
      title: t("kbPage.articles.troubleshootVideo"),
      category: "technical",
      visibility: "internal",
      views: 650,
      helpful: 78,
      updated: t("mockDates.feb6_2026"),
      status: "published",
    },
    {
      id: "6",
      title: t("kbPage.articles.escalationProcess"),
      category: "technical",
      visibility: "internal",
      views: 320,
      helpful: 0,
      updated: t("mockDates.feb5_2026"),
      status: "draft",
    },
  ];

  const stats = [
    {
      label: t("kbPage.stats.totalArticles"),
      value: "48",
      icon: BookOpen,
      bgColor: "bg-[var(--color-border-subtle)]",
      textColor: "text-[var(--color-primary)]",
    },
    {
      label: t("kbPage.stats.published"),
      value: "42",
      icon: CheckCircle,
      bgColor: "bg-[#DCFCE7]",
      textColor: "text-[#16A34A]",
    },
    {
      label: t("kbPage.stats.drafts"),
      value: "6",
      icon: FileText,
      bgColor: "bg-[#FFEDD5]",
      textColor: "text-[#EA580C]",
    },
    {
      label: t("kbPage.stats.totalViews"),
      value: "12.4K",
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
              <SupportSidebar profile={profile} />
            </div>

            {/* Mobile Sidebar */}
            <SupportMobileSidebar profile={profile} />

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
                    className={`w-full sm:w-[280px] h-10 ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} border border-[var(--color-input-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent`}
                  />
                </div>

                {/* New Article Button */}
                <button className="btn-gold text-[var(--color-button-text)] h-10 px-4 rounded-lg text-sm font-medium flex items-center gap-2">
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
                            <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors">
                              <Pencil className="w-4 h-4" />
                              {t("kbPage.actions.edit")}
                            </button>
                            <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#EF4444] hover:bg-red-50 transition-colors">
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
