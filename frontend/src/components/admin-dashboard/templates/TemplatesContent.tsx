"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  Mail,
  MessageCircle,
  Search,
  Pencil,
  Loader2,
  FileText,
  CheckCircle2,
} from "lucide-react";
import AdminSidebar from "../AdminSidebar";
import AdminMobileSidebar from "../AdminMobileSidebar";
import AdminNavbar from "../AdminNavbar";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { templatesApi, type TemplateListItem, type TemplateCategory } from "@/lib/api";
import { FmtDate } from "@/components/ui/Fmt";

const CATEGORY_ORDER: TemplateCategory[] = [
  "account",
  "applications",
  "enrollment",
  "sessions",
  "webinars",
  "certificates",
  "assessments",
  "content",
  "whatsapp",
];

export default function TemplatesContent() {
  const t = useTranslations("adminDashboard.templatesPage");
  const tCommon = useTranslations("adminDashboard");
  const locale = useLocale();
  const admin = useAdminProfile();

  const [list, setList] = useState<TemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    templatesApi
      .list()
      .then((data) => {
        if (cancelled) return;
        setList(data);
      })
      .catch(() => {
        if (!cancelled) setList([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (tpl) =>
        tpl.nameEn.toLowerCase().includes(q) ||
        tpl.nameAr.includes(q) ||
        tpl.eventKey.toLowerCase().includes(q) ||
        tpl.descriptionEn.toLowerCase().includes(q) ||
        tpl.descriptionAr.includes(q),
    );
  }, [list, search]);

  const grouped = useMemo(() => {
    const map: Partial<Record<TemplateCategory, TemplateListItem[]>> = {};
    for (const tpl of filtered) {
      (map[tpl.category] ??= []).push(tpl);
    }
    return map;
  }, [filtered]);

  return (
    <>
      <AdminNavbar admin={admin} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <AdminSidebar admin={admin} />
            </div>
            <AdminMobileSidebar admin={admin} />

            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                    {t("title")}
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    {t("subtitle")}
                  </p>
                </div>
                <span className="text-xs text-[var(--color-text-secondary)] font-medium">
                  {list.length} {t("totalTemplates")}
                </span>
              </div>

              {/* Search */}
              <div className="mb-5 relative max-w-md">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="w-full h-10 ps-10 pe-3 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)]" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-xl p-12 text-center">
                  <FileText className="w-10 h-10 text-[var(--color-text-secondary)] mx-auto mb-3 opacity-40" />
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {search ? t("noMatches") : t("noTemplates")}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {CATEGORY_ORDER.filter((cat) => (grouped[cat]?.length ?? 0) > 0).map(
                    (category) => (
                      <CategorySection
                        key={category}
                        category={category}
                        templates={grouped[category]!}
                        locale={locale}
                        t={t}
                        tCommon={tCommon}
                      />
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

interface CategorySectionProps {
  category: TemplateCategory;
  templates: TemplateListItem[];
  locale: string;
  t: ReturnType<typeof useTranslations>;
  tCommon: ReturnType<typeof useTranslations>;
}

function CategorySection({ category, templates, locale, t }: CategorySectionProps) {
  return (
    <section className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <header className="flex items-center gap-2 px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-page)]">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {t(`categories.${category}`)}
        </h2>
        <span className="text-xs text-[var(--color-text-secondary)]">
          · {templates.length}
        </span>
      </header>

      <ul className="divide-y divide-[var(--color-border)]">
        {templates.map((tpl) => {
          const isWhatsApp = tpl.channel === "whatsapp";
          const isAr = locale === "ar";
          const name = isAr ? tpl.nameAr : tpl.nameEn;
          const desc = isAr ? tpl.descriptionAr : tpl.descriptionEn;
          // Land the admin on the editor for the same locale their UI is
          // in — an AR admin editing an AR customer email shouldn't have
          // to click the toggle to see AR content first.
          const editHref = `/${locale}/dashboard/admin/templates/${tpl.eventKey}/${isAr ? "ar" : "en"}`;

          return (
            <li
              key={tpl.eventKey}
              className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--color-surface-page)] transition-colors"
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isWhatsApp
                    ? "bg-green-50 text-green-600"
                    : "bg-[var(--color-border-subtle)] text-[var(--color-primary)]"
                }`}
              >
                {isWhatsApp ? (
                  <MessageCircle className="w-5 h-5" />
                ) : (
                  <Mail className="w-5 h-5" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                    {name}
                  </p>
                  {tpl.edited ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold uppercase tracking-wider">
                      <CheckCircle2 className="w-3 h-3" />
                      {t("editedBadge")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] text-[10px] font-semibold uppercase tracking-wider">
                      {t("defaultBadge")}
                    </span>
                  )}
                  <code className="text-[10px] text-[var(--color-text-secondary)] font-mono">
                    {tpl.eventKey}
                  </code>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] truncate">
                  {desc}
                </p>
                {tpl.edited && tpl.lastUpdatedAt && (
                  <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                    {t("lastUpdated")}{" "}
                    <FmtDate value={tpl.lastUpdatedAt} variant="readable" />
                  </p>
                )}
              </div>

              <Link
                href={editHref}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[var(--color-border)] rounded-lg text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] transition-colors flex-shrink-0"
              >
                <Pencil className="w-3.5 h-3.5" />
                {t("edit")}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
