"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import {
  GraduationCap,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  roleRequestsApi,
  type SupportRoleRequestRow,
  type RoleRequestStatus,
} from "@/lib/api";
import { useSupportProfile } from "@/hooks/useSupportProfile";
import SupportNavbar from "./SupportNavbar";
import SupportSidebar from "./SupportSidebar";

const STATUS_TABS: Array<{ key: "ALL" | RoleRequestStatus }> = [
  { key: "ALL" },
  { key: "PENDING" },
  { key: "MORE_INFO" },
  { key: "APPROVED" },
  { key: "REJECTED" },
];

const STATUS_ICONS: Record<RoleRequestStatus, LucideIcon> = {
  PENDING: Clock,
  APPROVED: CheckCircle2,
  REJECTED: XCircle,
  MORE_INFO: AlertTriangle,
};

const STATUS_TONES: Record<RoleRequestStatus, { color: string; bg: string }> = {
  PENDING: { color: "text-[#1D4ED8]", bg: "bg-[#DBEAFE]" },
  APPROVED: { color: "text-[#16A34A]", bg: "bg-[#DCFCE7]" },
  REJECTED: { color: "text-[#DC2626]", bg: "bg-[#FEE2E2]" },
  MORE_INFO: { color: "text-[#B45309]", bg: "bg-[#FEF3C7]" },
};

const PAGE_SIZE = 20;

export default function TrainerApplicationsListContent() {
  const t = useTranslations("supportDashboard.trainerApplication");
  const tCommon = useTranslations("supportDashboard");
  const locale = useLocale();
  const { user } = useAuth();
  const profile = useSupportProfile();

  const [status, setStatus] = useState<"ALL" | RoleRequestStatus>("ALL");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<SupportRoleRequestRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce the search input — fires the API once typing settles.
  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [search]);

  // Reset to page 1 whenever filters change.
  useEffect(() => {
    setPage(1);
  }, [status, debouncedSearch]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    roleRequestsApi.support
      .list({
        status: status === "ALL" ? undefined : status,
        search: debouncedSearch || undefined,
        page,
        limit: PAGE_SIZE,
      })
      .then((res) => {
        if (cancelled) return;
        setRows(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t("list.loadError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, debouncedSearch, page, t]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total],
  );

  return (
    <>
      <SupportNavbar profile={profile} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <SupportSidebar
                profile={profile}
                supportSubRole={user?.supportSubRole}
              />
            </div>

            <div className="flex-1 min-w-0 flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#F3E8FF] flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-[#7C3AED]" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                      {t("list.title")}
                    </h1>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                      {t("list.subtitle")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-4 mb-6">
                <div className="flex flex-col lg:flex-row gap-3">
                  {/* Status tabs */}
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_TABS.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setStatus(tab.key)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                          status === tab.key
                            ? "border-[var(--color-primary)] bg-[#EFF6FF] text-[var(--color-primary)]"
                            : "border-[var(--color-border)] hover:bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
                        }`}
                      >
                        {tab.key === "ALL"
                          ? t("list.tabAll")
                          : t(`status.${tab.key}`)}
                      </button>
                    ))}
                  </div>

                  {/* Search */}
                  <div className="lg:ms-auto relative flex-1 lg:max-w-xs">
                    <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-[var(--color-text-secondary)]" />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t("list.searchPlaceholder")}
                      className="w-full h-9 ps-9 pe-3 text-sm bg-white border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-primary)]"
                    />
                  </div>
                </div>
              </div>

              {/* List */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
                {loading && (
                  <div className="flex items-center justify-center py-16 text-[var(--color-text-secondary)]">
                    <Loader2 className="w-5 h-5 animate-spin me-2" />
                    {t("list.loading")}
                  </div>
                )}

                {!loading && error && (
                  <div className="py-16 px-6 text-center text-[var(--color-text-secondary)]">
                    {error}
                  </div>
                )}

                {!loading && !error && rows.length === 0 && (
                  <div className="py-16 px-6 text-center">
                    <Inbox className="w-8 h-8 mx-auto text-[var(--color-text-secondary)] mb-2" />
                    <p className="text-sm text-[var(--color-text-primary)] font-medium">
                      {t("list.emptyTitle")}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      {t("list.emptyHint")}
                    </p>
                  </div>
                )}

                {!loading && !error && rows.length > 0 && (
                  <ul className="divide-y divide-[var(--color-border)]">
                    {rows.map((row) => {
                      const Icon = STATUS_ICONS[row.status];
                      const tone = STATUS_TONES[row.status];
                      const name = formatApplicantName(row);
                      return (
                        <li key={row.id}>
                          <Link
                            href={`/${locale}/dashboard/support/trainer-applications/${row.id}`}
                            className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--color-surface-page)]"
                          >
                            <div className="w-9 h-9 rounded-full bg-[var(--color-surface-page)] flex items-center justify-center text-xs font-semibold text-[var(--color-text-primary)] flex-shrink-0">
                              {initials(name)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                                  {name}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${tone.color} ${tone.bg}`}
                                >
                                  <Icon className="w-3 h-3" />
                                  {t(`status.${row.status}`)}
                                </span>
                              </div>
                              <div className="text-xs text-[var(--color-text-secondary)] truncate">
                                {row.applicantEmail}
                              </div>
                            </div>
                            <div className="hidden sm:block text-end text-[11px] text-[var(--color-text-secondary)] flex-shrink-0">
                              {t("list.submittedOn")}
                              <div className="text-xs text-[var(--color-text-primary)] font-medium">
                                {formatDate(row.submittedAt, locale)}
                              </div>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Pagination */}
                {!loading && !error && totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {t("list.pageOf", { page, totalPages })}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="p-1.5 border border-[var(--color-border)] rounded disabled:opacity-40 hover:bg-[var(--color-border-subtle)]"
                        aria-label={tCommon("a11y.previousPage")}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={page >= totalPages}
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
                        className="p-1.5 border border-[var(--color-border)] rounded disabled:opacity-40 hover:bg-[var(--color-border-subtle)]"
                        aria-label={tCommon("a11y.nextPage")}
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function formatApplicantName(row: SupportRoleRequestRow): string {
  const fromUser = `${row.applicantFirstName ?? ""} ${row.applicantLastName ?? ""}`.trim();
  if (fromUser) return fromUser;
  const profile = row.profileData as Record<string, string> | undefined;
  return (
    profile?.fullNameEnglish ||
    profile?.fullNameArabic ||
    row.applicantEmail.split("@")[0]
  );
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
