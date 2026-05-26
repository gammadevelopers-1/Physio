"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Loader2,
  GraduationCap,
  TrendingUp,
  ListChecks,
  HelpCircle,
} from "lucide-react";
import { AdminSidebar, AdminNavbar } from "@/components/admin-dashboard";
import AdminMobileSidebar from "./AdminMobileSidebar";
import Select from "./Select";
import {
  roleRequestsApi,
  type RoleRequest,
  type RoleRequestStats,
} from "@/lib/api";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { usePlatformLocale } from "@/contexts/PlatformLocaleContext";
import ApplicantAvatar from "./role-requests/ApplicantAvatar";
import {
  getApplicantName,
  getApplicantSubtitle,
  formatRelativeTime,
  daysBetween,
  STATUS_CONFIG,
  type StatusKey,
} from "./role-requests/helpers";

const STATUS_ICONS = {
  PENDING: Clock,
  APPROVED: CheckCircle2,
  REJECTED: XCircle,
  MORE_INFO: AlertCircle,
} as const;

const RoleRequestsContent = () => {
  const locale = useLocale();
  const t = useTranslations("adminDashboard.roleRequestsPage");
  const admin = useAdminProfile();
  const isRTL = locale === "ar";

  const [requests, setRequests] = useState<RoleRequest[]>([]);
  const [stats, setStats] = useState<RoleRequestStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Per-row quick-action busy state
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const result = await roleRequestsApi.getAll({
        page: currentPage,
        limit: 12,
        search: searchQuery || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      setRequests(result.data);
      setPagination(result.meta);
      setStats(result.stats);
    } catch (err) {
      setFetchError(
        err instanceof Error ? err.message : t("toasts.loadFailed"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchQuery, statusFilter, t]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const handleQuickApprove = async (id: string) => {
    setBusyId(id);
    try {
      await roleRequestsApi.approve(id);
      toast.success(t("toasts.approved"));
      fetchRequests();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("toasts.approveFailed"),
      );
    } finally {
      setBusyId(null);
    }
  };

  // MORE_INFO count isn't directly exposed by the stats endpoint —
  // approximate it as the gap between total and the three known buckets
  // so the card stays accurate even before a backend update lands.
  const moreInfoCount = Math.max(
    0,
    stats.total - stats.pending - stats.approved - stats.rejected,
  );

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const total = pagination.totalPages;
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      for (
        let i = Math.max(2, currentPage - 1);
        i <= Math.min(total - 1, currentPage + 1);
        i++
      ) {
        pages.push(i);
      }
      if (currentPage < total - 2) pages.push("...");
      pages.push(total);
    }
    return pages;
  };

  return (
    <>
      <AdminNavbar admin={admin} />
      <div className="flex flex-1 bg-[var(--color-surface-page)] min-h-screen">
        <div className="hidden lg:block">
          <AdminSidebar admin={admin} />
        </div>
        <AdminMobileSidebar admin={admin} />

        <div className="flex-1 p-4 lg:p-8 min-w-0" dir={isRTL ? "rtl" : "ltr"}>
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              {t("title")}
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              {t("subtitle")}
            </p>
          </div>

          {/* Stats — 5 cards including "More info" */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
            <StatCard
              icon={ListChecks}
              iconBg="bg-[var(--color-border-subtle)]"
              iconColor="text-[var(--color-primary)]"
              label={t("stats.total")}
              value={stats.total}
            />
            <StatCard
              icon={Clock}
              iconBg="bg-[#FEF3C7]"
              iconColor="text-[#B45309]"
              label={t("stats.pending")}
              value={stats.pending}
              valueClass="text-[#B45309]"
            />
            <StatCard
              icon={HelpCircle}
              iconBg="bg-[#FFEDD5]"
              iconColor="text-[#9A3412]"
              label={t("stats.moreInfo")}
              value={moreInfoCount}
              valueClass="text-[#9A3412]"
            />
            <StatCard
              icon={CheckCircle2}
              iconBg="bg-[#DCFCE7]"
              iconColor="text-[#15803D]"
              label={t("stats.approved")}
              value={stats.approved}
              valueClass="text-[#15803D]"
            />
            <StatCard
              icon={XCircle}
              iconBg="bg-[#FEE2E2]"
              iconColor="text-[#991B1B]"
              label={t("stats.rejected")}
              value={stats.rejected}
              valueClass="text-[#991B1B]"
            />
          </div>

          {/* Status filter chips */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {(
              [
                { id: "all", label: t("filters.all"), count: stats.total, icon: ListChecks },
                { id: "PENDING", label: t("filters.pending"), count: stats.pending, icon: Clock },
                { id: "MORE_INFO", label: t("filters.moreInfo"), count: moreInfoCount, icon: HelpCircle },
                { id: "APPROVED", label: t("filters.approved"), count: stats.approved, icon: CheckCircle2 },
                { id: "REJECTED", label: t("filters.rejected"), count: stats.rejected, icon: XCircle },
              ]
            ).map((chip) => {
              const active = statusFilter === chip.id;
              const Icon = chip.icon;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setStatusFilter(chip.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    active
                      ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white"
                      : "bg-[var(--color-surface-card)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{chip.label}</span>
                  <span
                    className={`min-w-[18px] text-center px-1 rounded-full text-[10px] font-semibold ${
                      active
                        ? "bg-white/25 text-white"
                        : "bg-[var(--color-border-subtle)] text-[var(--color-text-primary)]"
                    }`}
                  >
                    {chip.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search + sort row */}
          <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-3 mb-5">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search
                  className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${
                    isRTL ? "right-3" : "left-3"
                  }`}
                />
                <input
                  type="text"
                  placeholder={t("searchPlaceholder")}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className={`w-full h-10 border border-[var(--color-input-border)] rounded-lg text-sm outline-none focus:border-[var(--color-primary)] ${
                    isRTL ? "pr-10 pl-3" : "pl-10 pr-3"
                  }`}
                />
              </div>
              <Select
                className="sm:w-52"
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "all", label: t("filters.all") },
                  { value: "PENDING", label: t("filters.pending") },
                  { value: "MORE_INFO", label: t("filters.moreInfo") },
                  { value: "APPROVED", label: t("filters.approved") },
                  { value: "REJECTED", label: t("filters.rejected") },
                ]}
              />
            </div>
          </div>

          {/* Error */}
          {fetchError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 text-sm text-red-700">
              {fetchError}
            </div>
          )}

          {/* Applications list — card style, not a dense table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20 bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)]">
              <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
            </div>
          ) : requests.length === 0 ? (
            <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] py-16 text-center">
              <div className="w-16 h-16 bg-[var(--color-border-subtle)] rounded-full flex items-center justify-center mx-auto mb-4">
                <GraduationCap className="w-8 h-8 text-[var(--color-text-secondary)]" />
              </div>
              <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
                {t("emptyTitle")}
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] max-w-xs mx-auto">
                {t("emptyBody")}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {requests.map((req) => (
                <ApplicationRow
                  key={req.id}
                  req={req}
                  locale={locale}
                  isRTL={isRTL}
                  busy={busyId === req.id}
                  onQuickApprove={handleQuickApprove}
                  t={t}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!isLoading && requests.length > 0 && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-5">
              <p className="text-sm text-[var(--color-text-secondary)]">
                {t("showing", {
                  from: (currentPage - 1) * 12 + 1,
                  to: Math.min(currentPage * 12, pagination.total),
                  total: pagination.total,
                })}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={!pagination.hasPrev}
                  className="p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-border-subtle)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isRTL ? (
                    <ChevronRight className="w-4 h-4" />
                  ) : (
                    <ChevronLeft className="w-4 h-4" />
                  )}
                </button>
                {getPageNumbers().map((p, i) =>
                  typeof p === "string" ? (
                    <span
                      key={`ellipsis-${i}`}
                      className="px-2 text-sm text-[var(--color-text-secondary)]"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCurrentPage(p)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium ${
                        p === currentPage
                          ? "bg-[var(--color-primary)] text-white"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((p) =>
                      Math.min(pagination.totalPages, p + 1),
                    )
                  }
                  disabled={!pagination.hasNext}
                  className="p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-border-subtle)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isRTL ? (
                    <ChevronLeft className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// ─── Subcomponents ──────────────────────────────────────────────

function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  valueClass,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number;
  valueClass?: string;
}) {
  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-3 flex items-center gap-3">
      <div
        className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}
      >
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p
          className={`text-xl font-bold leading-tight ${
            valueClass ?? "text-[var(--color-text-primary)]"
          }`}
        >
          {value}
        </p>
        <p className="text-[11px] text-[var(--color-text-secondary)] truncate">
          {label}
        </p>
      </div>
    </div>
  );
}

function ApplicationRow({
  req,
  locale,
  isRTL,
  busy,
  onQuickApprove,
  t,
}: {
  req: RoleRequest;
  locale: string;
  isRTL: boolean;
  busy: boolean;
  onQuickApprove: (id: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const status = (req.status as StatusKey) ?? "PENDING";
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  const StatusIcon = STATUS_ICONS[status] ?? Clock;
  const name = getApplicantName(req);
  const subtitle = getApplicantSubtitle(req);
  const daysOld = daysBetween(req.createdAt);
  const overdue = status === "PENDING" && daysOld >= 7;
  const platformLocale = usePlatformLocale();
  const localeNarrow: "en" | "ar" = locale === "ar" ? "ar" : "en";

  return (
    <Link
      href={`/${locale}/dashboard/admin/role-requests/${req.id}`}
      className="group block bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:shadow-sm transition-all p-4"
    >
      <div className="flex items-center gap-4">
        <ApplicantAvatar
          request={req}
          size="md"
          showStatusRing={status === "PENDING"}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
              {name}
            </p>
            {overdue && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#FEE2E2] text-[#991B1B] rounded text-[10px] font-bold uppercase tracking-wide">
                <TrendingUp className="w-3 h-3" />
                {t("overdue")}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] truncate">
            {req.user?.email}
            {subtitle && <span className="mx-1">·</span>}
            {subtitle}
          </p>
        </div>

        <div className="hidden sm:flex flex-col items-end gap-1 flex-shrink-0">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.badgeBg} ${cfg.badgeText}`}
          >
            <StatusIcon className="w-3 h-3" />
            {t(`statuses.${status}`)}
          </span>
          <p className="text-[11px] text-[var(--color-text-secondary)]">
            {formatRelativeTime(req.createdAt, localeNarrow, platformLocale)}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {status === "PENDING" && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onQuickApprove(req.id);
              }}
              disabled={busy}
              title={t("actions.quickApprove")}
              className="opacity-0 group-hover:opacity-100 hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#16A34A] text-white rounded-lg text-xs font-medium hover:bg-[#15803D] transition-all disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              {t("actions.approve")}
            </button>
          )}
          {isRTL ? (
            <ChevronLeft className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)] transition-colors" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)] transition-colors" />
          )}
        </div>
      </div>
    </Link>
  );
}

// FileText unused for now — keeping the import for completeness because
// we may surface attachment count on the row in a later pass.
void FileText;

export default RoleRequestsContent;
