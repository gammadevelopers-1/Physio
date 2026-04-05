"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import { supportApi } from "@/lib/api";
import {
  Search,
  BookOpen,
  Eye,
  Loader2,
  ChevronRight,
} from "lucide-react";

const CATEGORIES = [
  { key: "all", label: "All", labelAr: "الكل" },
  { key: "billing", label: "Billing", labelAr: "الفواتير" },
  { key: "login", label: "Login", labelAr: "تسجيل الدخول" },
  { key: "certificate", label: "Certificate", labelAr: "الشهادات" },
  { key: "content", label: "Content", labelAr: "المحتوى" },
  { key: "technical", label: "Technical", labelAr: "تقني" },
];

export default function PublicKBContent() {
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [articles, setArticles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [lang, setLang] = useState<"en" | "ar">(locale === "ar" ? "ar" : "en");

  useEffect(() => {
    setIsLoading(true);
    supportApi
      .getKbArticles({
        category: activeTab === "all" ? undefined : activeTab,
        search: searchQuery || undefined,
      })
      .then((data) => setArticles(data || []))
      .catch(() => setArticles([]))
      .finally(() => setIsLoading(false));
  }, [activeTab, searchQuery]);

  const getTitle = (a: any) =>
    lang === "ar" ? a.titleAr || a.titleEn || "" : a.titleEn || a.titleAr || "";
  const getBody = (a: any) =>
    lang === "ar" ? a.bodyAr || a.bodyEn || "" : a.bodyEn || a.bodyAr || "";

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#EFF6FF] mb-4">
          <BookOpen className="w-7 h-7 text-[#002D87]" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1F2937] mb-2">
          {isRTL ? "قاعدة المعرفة" : "Knowledge Base"}
        </h1>
        <p className="text-gray-500 text-sm">
          {isRTL
            ? "ابحث عن إجابات لأسئلتك الشائعة"
            : "Find answers to your common questions"}
        </p>
      </div>

      {/* Search + Language Toggle */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isRTL ? "ابحث في المقالات..." : "Search articles..."}
            className="w-full h-10 pl-10 pr-4 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#002D87]"
            dir={isRTL ? "rtl" : "ltr"}
          />
        </div>
        <div className="flex gap-1 bg-[#F3F4F6] rounded-lg p-0.5">
          <button
            onClick={() => setLang("en")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              lang === "en"
                ? "bg-white text-[#002D87] shadow-sm"
                : "text-[#6B7280]"
            }`}
          >
            English
          </button>
          <button
            onClick={() => setLang("ar")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              lang === "ar"
                ? "bg-white text-[#002D87] shadow-sm"
                : "text-[#6B7280]"
            }`}
          >
            العربية
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveTab(cat.key)}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              activeTab === cat.key
                ? "bg-[#002D87] text-white"
                : "bg-white text-[#374151] border border-[#E5E7EB] hover:border-[#002D87]"
            }`}
          >
            {isRTL ? cat.labelAr : cat.label}
          </button>
        ))}
      </div>

      {/* Articles */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#002D87]" />
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="w-12 h-12 text-[#D1D5DB] mx-auto mb-3" />
          <p className="text-sm text-[#6B7280]">
            {isRTL ? "لا توجد مقالات" : "No articles found"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((article) => (
            <div
              key={article.id}
              className="bg-white rounded-xl border border-[#E5E7EB] p-5 hover:shadow-sm transition-shadow"
              dir={lang === "ar" ? "rtl" : "ltr"}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-[#1F2937] mb-1">
                    {getTitle(article)}
                  </h3>
                  <p className="text-xs text-[#6B7280] line-clamp-2 mb-2">
                    {getBody(article)?.substring(0, 200)}
                  </p>
                  <div className="flex items-center gap-3 text-[10px] text-[#9CA3AF]">
                    <span className="px-2 py-0.5 bg-[#F3F4F6] rounded-full capitalize">
                      {article.category}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" /> {article.viewCount || 0} views
                    </span>
                  </div>
                </div>
                <ChevronRight className={`w-4 h-4 text-[#D1D5DB] flex-shrink-0 ${lang === "ar" ? "rotate-180" : ""}`} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
