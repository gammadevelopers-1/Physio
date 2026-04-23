"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
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
  Eye,
} from "lucide-react";
import { AdminSidebar, AdminNavbar } from "@/components/admin-dashboard";
import AdminMobileSidebar from "./AdminMobileSidebar";
import { roleRequestsApi, type RoleRequest, type RoleRequestStats } from "@/lib/api";
import { useAdminProfile } from "@/hooks/useAdminProfile";

const statusConfig = {
  PENDING: { badgeBg: "bg-[#FEF3C7]", badgeText: "text-[#92400E]", icon: Clock },
  APPROVED: { badgeBg: "bg-[#DCFCE7]", badgeText: "text-[#166534]", icon: CheckCircle2 },
  REJECTED: { badgeBg: "bg-[#FEE2E2]", badgeText: "text-[#991B1B]", icon: XCircle },
  MORE_INFO: { badgeBg: "bg-[#FFEDD5]", badgeText: "text-[#9A3412]", icon: AlertCircle },
};

const RoleRequestsContent = () => {
  const locale = useLocale();
  const t = useTranslations("adminDashboard");
  const admin = useAdminProfile();
  const isRTL = locale === "ar";
  const router = useRouter();

  const [requests, setRequests] = useState<RoleRequest[]>([]);
  const [stats, setStats] = useState<RoleRequestStats>({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, hasNext: false, hasPrev: false });
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const result = await roleRequestsApi.getAll({
        page: currentPage,
        limit: 10,
        search: searchQuery || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      setRequests(result.data);
      setPagination(result.meta);
      setStats(result.stats);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load role requests");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchQuery, statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getApplicantName = (request: RoleRequest) => {
    const profile = request.profileData as Record<string, string>;
    return profile?.fullNameEnglish || profile?.fullNameArabic || request.user?.email || "Unknown";
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const total = pagination.totalPages;
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(total - 1, currentPage + 1); i++) {
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
      <div className="flex flex-1">
        <div className="hidden lg:block">
          <AdminSidebar admin={admin} />
        </div>
        <AdminMobileSidebar admin={admin} />

        <div className="flex-1 p-4 lg:p-8" dir={isRTL ? "rtl" : "ltr"}>
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              {t("roleRequestsPage.title") || "Role Requests"}
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              {t("roleRequestsPage.subtitle") || "Review and manage instructor role applications"}
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
              <p className="text-2xl font-bold text-[var(--color-text-secondary)]">{stats.total}</p>
              <p className="text-sm text-[var(--color-text-secondary)]">{t("roleRequestsPage.stats.total") || "Total"}</p>
            </div>
            <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
              <p className="text-2xl font-bold text-[#D97706]">{stats.pending}</p>
              <p className="text-sm text-[var(--color-text-secondary)]">{t("roleRequestsPage.stats.pending") || "Pending"}</p>
            </div>
            <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
              <p className="text-2xl font-bold text-[#16A34A]">{stats.approved}</p>
              <p className="text-sm text-[var(--color-text-secondary)]">{t("roleRequestsPage.stats.approved") || "Approved"}</p>
            </div>
            <div className="bg-white rounded-xl border border-[var(--color-border)] p-4">
              <p className="text-2xl font-bold text-[#DC2626]">{stats.rejected}</p>
              <p className="text-sm text-[var(--color-text-secondary)]">{t("roleRequestsPage.stats.rejected") || "Rejected"}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border border-[var(--color-border)] p-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`} />
                <input
                  type="text"
                  placeholder={t("roleRequestsPage.searchPlaceholder") || "Search by name or email..."}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className={`w-full h-10 border border-[var(--color-border)] rounded-lg text-sm outline-none focus:border-[#002D87] ${isRTL ? "pr-10 pl-3" : "pl-10 pr-3"}`}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 px-3 border border-[var(--color-border)] rounded-lg text-sm bg-white outline-none focus:border-[#002D87]"
              >
                <option value="all">{t("roleRequestsPage.filterAll") || "All Status"}</option>
                <option value="PENDING">{t("roleRequestsPage.filterPending") || "Pending"}</option>
                <option value="APPROVED">{t("roleRequestsPage.filterApproved") || "Approved"}</option>
                <option value="REJECTED">{t("roleRequestsPage.filterRejected") || "Rejected"}</option>
                <option value="MORE_INFO">{t("roleRequestsPage.filterMoreInfo") || "More Info"}</option>
              </select>
            </div>
          </div>

          {/* Error */}
          {fetchError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">
              {fetchError}
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-[#002D87]" />
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-16">
                <FileText className="w-10 h-10 text-[var(--color-border)] mx-auto mb-3" />
                <p className="text-sm text-[var(--color-text-secondary)]">{t("roleRequestsPage.noResults") || "No role requests found"}</p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] bg-[#F9FAFB]">
                        <th className="text-start px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                          {t("roleRequestsPage.colApplicant") || "Applicant"}
                        </th>
                        <th className="text-start px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                          {t("roleRequestsPage.colEmail") || "Email"}
                        </th>
                        <th className="text-start px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                          {t("roleRequestsPage.colRole") || "Role"}
                        </th>
                        <th className="text-start px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                          {t("roleRequestsPage.colStatus") || "Status"}
                        </th>
                        <th className="text-start px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                          {t("roleRequestsPage.colSubmitted") || "Submitted"}
                        </th>
                        <th className="text-start px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">
                          {t("roleRequestsPage.colActions") || "Actions"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map((request) => {
                        const config = statusConfig[request.status as keyof typeof statusConfig] || statusConfig.PENDING;
                        const StatusIcon = config.icon;

                        return (
                          <tr
                            key={request.id}
                            onClick={() => router.push(`/${locale}/dashboard/admin/role-requests/${request.id}`)}
                            className="border-b border-[var(--color-border)] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
                          >
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-[var(--color-text-secondary)]">{getApplicantName(request)}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-[var(--color-text-secondary)]">{request.user?.email || "-"}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-sm text-[var(--color-text-secondary)]">{request.requestedRole}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${config.badgeBg} ${config.badgeText}`}>
                                <StatusIcon className="w-3 h-3" />
                                {request.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-[var(--color-text-secondary)]">{formatDate(request.createdAt)}</p>
                            </td>
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <Link
                                href={`/${locale}/dashboard/admin/role-requests/${request.id}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#002D87] bg-[#EFF6FF] rounded-lg hover:bg-[#DBEAFE] transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                {t("roleRequestsPage.review") || "Review"}
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-[var(--color-border)]">
                  {requests.map((request) => {
                    const config = statusConfig[request.status as keyof typeof statusConfig] || statusConfig.PENDING;
                    const StatusIcon = config.icon;

                    return (
                      <Link
                        key={request.id}
                        href={`/${locale}/dashboard/admin/role-requests/${request.id}`}
                        className="block p-4 hover:bg-[#F9FAFB] transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate">{getApplicantName(request)}</p>
                            <p className="text-xs text-[var(--color-text-secondary)] truncate">{request.user?.email}</p>
                          </div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${config.badgeBg} ${config.badgeText}`}>
                            <StatusIcon className="w-3 h-3" />
                            {request.status}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--color-text-secondary)] mt-2">{formatDate(request.createdAt)}</p>
                      </Link>
                    );
                  })}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {t("roleRequestsPage.showing") || "Showing"} {(currentPage - 1) * 10 + 1}-{Math.min(currentPage * 10, pagination.total)} {t("roleRequestsPage.of") || "of"} {pagination.total}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={!pagination.hasPrev}
                        className="p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[#F9FAFB] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                      </button>
                      {getPageNumbers().map((page, i) =>
                        typeof page === "string" ? (
                          <span key={`ellipsis-${i}`} className="px-2 text-sm text-[var(--color-text-secondary)]">...</span>
                        ) : (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`w-8 h-8 rounded-lg text-sm font-medium ${
                              page === currentPage
                                ? "bg-[#002D87] text-white"
                                : "text-[var(--color-text-secondary)] hover:bg-[#F9FAFB]"
                            }`}
                          >
                            {page}
                          </button>
                        )
                      )}
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                        disabled={!pagination.hasNext}
                        className="p-1.5 rounded-lg border border-[var(--color-border)] hover:bg-[#F9FAFB] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default RoleRequestsContent;
