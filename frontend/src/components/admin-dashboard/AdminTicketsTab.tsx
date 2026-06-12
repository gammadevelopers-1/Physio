"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { supportApi } from "@/lib/api";
import Select from "./Select";
import TagFilterDropdown from "../support-dashboard/TagFilterDropdown";
import {
  Search,
  Loader2,
  AlertTriangle,
  Clock,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

// Admin Tickets tab — list view scoped to the admin support page.
// Reuses the supervisor-side /tickets list endpoint (admin role has
// access). Row click navigates to the admin-scoped detail page at
// /dashboard/admin/support/tickets/[id] (NOT the supervisor route),
// so audit logs and the no-public-reply policy stay admin-context.
//
// URL params drive the initial filter so Overview drill-through links
// can deep-link into a pre-filtered view:
//   ?subTab=tickets&filter=overdue       → all overdue tickets
//   ?subTab=tickets&filter=awaiting      → no first response yet
//   ?subTab=tickets&priority=high        → high-priority only
//   ?subTab=tickets&category=billing     → category filter
//   ?subTab=tickets&assigneeId=<id>      → that agent's queue

type Ticket = {
  id: string;
  referenceNumber: string | null;
  subject: string;
  category: string;
  priority: string;
  status: string;
  assigneeId: string | null;
  assigneeName: string | null;
  studentFirstName: string | null;
  studentLastName: string | null;
  studentEmail: string | null;
  guestName: string | null;
  guestEmail: string | null;
  createdAt: string;
  frtRemainingMinutes: number | null;
  ttrRemainingMinutes: number | null;
  slaBreachedFrt: boolean;
  slaBreachedTtr: boolean;
};

const PAGE_SIZE = 25;

export default function AdminTicketsTab() {
  const t = useTranslations("adminDashboard.supportPage.tickets");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = useLocale();

  // Filter state is seeded from query params on first render and then
  // managed locally; updating filters does NOT push to the URL — the
  // params are a deep-link convenience, not a long-lived state model.
  const initialFilter = searchParams?.get("filter") || "";
  const initialStatus =
    initialFilter === "overdue" || initialFilter === "awaiting"
      ? "" // these are computed filters; status is left wildcard
      : searchParams?.get("status") || "";
  const initialPriority = searchParams?.get("priority") || "";
  const initialCategory = searchParams?.get("category") || "";
  const initialAssignee = searchParams?.get("assigneeId") || "";

  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [priorityFilter, setPriorityFilter] = useState(initialPriority);
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [assigneeFilter, setAssigneeFilter] = useState(initialAssignee);
  const [tagFilter, setTagFilter] = useState<string[]>(() => {
    const raw = searchParams?.get("tags") || "";
    return raw ? raw.split(",").filter(Boolean) : [];
  });
  const [computedFilter, setComputedFilter] = useState<
    "overdue" | "awaiting" | ""
  >(
    initialFilter === "overdue" || initialFilter === "awaiting"
      ? initialFilter
      : "",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await supportApi.getTickets({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        category: categoryFilter || undefined,
        assigneeId: assigneeFilter || undefined,
        search: searchTerm || undefined,
        tags: tagFilter.length > 0 ? tagFilter.join(",") : undefined,
        page,
        limit: PAGE_SIZE,
      });
      let rows = (res.tickets || []) as Ticket[];
      // Computed filters are applied client-side since the list
      // endpoint doesn't expose them as filter params.
      if (computedFilter === "overdue") {
        rows = rows.filter(
          (t) => t.slaBreachedFrt || t.slaBreachedTtr,
        );
      } else if (computedFilter === "awaiting") {
        rows = rows.filter(
          (t) =>
            t.status !== "resolved" &&
            t.status !== "closed" &&
            (t.frtRemainingMinutes === null ||
              t.frtRemainingMinutes !== undefined),
        );
        // 'awaiting' = no first response yet → BE list doesn't expose
        // firstResponseAt directly here; rely on frtRemainingMinutes
        // being non-null (which the BE only computes when FRT hasn't
        // happened yet).
      }
      setTickets(rows);
      setTotal(res.total || rows.length);
    } catch {
      setTickets([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [
    statusFilter,
    priorityFilter,
    categoryFilter,
    assigneeFilter,
    searchTerm,
    tagFilter,
    page,
    computedFilter,
  ]);

  useEffect(() => {
    void fetchTickets();
  }, [fetchTickets]);

  function clearFilters() {
    setStatusFilter("");
    setPriorityFilter("");
    setCategoryFilter("");
    setAssigneeFilter("");
    setTagFilter([]);
    setComputedFilter("");
    setSearchTerm("");
    setPage(1);
  }

  function openTicket(ticketId: string) {
    router.push(`/${locale}/dashboard/admin/support/tickets/${ticketId}`);
  }

  const statusOptions = useMemo(
    () => [
      { value: "", label: t("filters.status.all") },
      { value: "new", label: t("filters.status.new") },
      { value: "in_progress", label: t("filters.status.in_progress") },
      { value: "on_hold", label: t("filters.status.on_hold") },
      { value: "resolved", label: t("filters.status.resolved") },
      { value: "closed", label: t("filters.status.closed") },
    ],
    [t],
  );
  const priorityOptions = useMemo(
    () => [
      { value: "", label: t("filters.priority.all") },
      { value: "high", label: t("filters.priority.high") },
      { value: "medium", label: t("filters.priority.medium") },
      { value: "low", label: t("filters.priority.low") },
    ],
    [t],
  );
  const categoryOptions = useMemo(
    () => [
      { value: "", label: t("filters.category.all") },
      { value: "billing", label: t("filters.category.billing") },
      { value: "login", label: t("filters.category.login") },
      { value: "content", label: t("filters.category.content") },
      { value: "certificate", label: t("filters.category.certificate") },
      { value: "technical", label: t("filters.category.technical") },
      { value: "other", label: t("filters.category.other") },
    ],
    [t],
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {/* Computed-filter pill — shows when admin landed via Overview drill-through */}
      {computedFilter && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg">
          <AlertTriangle className="w-4 h-4 text-[#991B1B]" />
          <span className="text-xs font-medium text-[#991B1B]">
            {computedFilter === "overdue"
              ? t("computedFilter.overdue")
              : t("computedFilter.awaiting")}
          </span>
          <button
            onClick={() => setComputedFilter("")}
            className="ms-auto text-[10px] text-[#991B1B] hover:underline"
          >
            {t("clearFilter")}
          </button>
        </div>
      )}

      {/* Filter bar */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-stretch">
        <div className="relative md:col-span-2">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder={t("searchPlaceholder")}
            className="w-full h-10 ps-9 pe-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
          />
        </div>
        <Select
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
          options={statusOptions}
        />
        <Select
          value={priorityFilter}
          onChange={(v) => {
            setPriorityFilter(v);
            setPage(1);
          }}
          options={priorityOptions}
        />
        <Select
          value={categoryFilter}
          onChange={(v) => {
            setCategoryFilter(v);
            setPage(1);
          }}
          options={categoryOptions}
        />
      </div>

      <div className="md:max-w-sm">
        <TagFilterDropdown
          selectedIds={tagFilter}
          onChange={(ids) => {
            setTagFilter(ids);
            setPage(1);
          }}
        />
      </div>

      {(statusFilter ||
        priorityFilter ||
        categoryFilter ||
        assigneeFilter ||
        tagFilter.length > 0 ||
        searchTerm) && (
        <button
          onClick={clearFilters}
          className="text-xs text-[var(--color-text-secondary)] hover:underline"
        >
          {t("clearAllFilters")}
        </button>
      )}

      {/* Table */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-3 py-2 text-start font-medium text-[10px] uppercase tracking-wide">
                  {t("columns.ref")}
                </th>
                <th className="px-3 py-2 text-start font-medium text-[10px] uppercase tracking-wide">
                  {t("columns.subject")}
                </th>
                <th className="px-3 py-2 text-start font-medium text-[10px] uppercase tracking-wide">
                  {t("columns.customer")}
                </th>
                <th className="px-3 py-2 text-start font-medium text-[10px] uppercase tracking-wide">
                  {t("columns.priority")}
                </th>
                <th className="px-3 py-2 text-start font-medium text-[10px] uppercase tracking-wide">
                  {t("columns.status")}
                </th>
                <th className="px-3 py-2 text-start font-medium text-[10px] uppercase tracking-wide">
                  {t("columns.assignee")}
                </th>
                <th className="px-3 py-2 text-start font-medium text-[10px] uppercase tracking-wide">
                  {t("columns.sla")}
                </th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10">
                    <Loader2 className="w-5 h-5 animate-spin inline text-[var(--color-primary)]" />
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="text-center py-10 text-[var(--color-text-secondary)]"
                  >
                    {t("noTickets")}
                  </td>
                </tr>
              ) : (
                tickets.map((row) => {
                  const customerName =
                    [row.studentFirstName, row.studentLastName]
                      .filter(Boolean)
                      .join(" ") ||
                    row.guestName ||
                    row.studentEmail ||
                    row.guestEmail ||
                    "—";
                  const breached =
                    row.slaBreachedFrt || row.slaBreachedTtr;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => openTicket(row.id)}
                      className="border-t border-[var(--color-border)] hover:bg-[var(--color-border-subtle)] cursor-pointer"
                    >
                      <td className="px-3 py-2 text-xs text-[var(--color-primary)] font-medium tabular-nums">
                        {row.referenceNumber || row.id.slice(0, 8)}
                      </td>
                      <td className="px-3 py-2 max-w-[260px]">
                        <div className="truncate text-[var(--color-text-primary)]">
                          {row.subject}
                        </div>
                      </td>
                      <td className="px-3 py-2 max-w-[180px]">
                        <div className="truncate text-[var(--color-text-secondary)] text-xs">
                          {customerName}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <PriorityBadge priority={row.priority} t={t} />
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={row.status} t={t} />
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                        {row.assigneeName || (
                          <span className="text-[#991B1B]">
                            {t("unassigned")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {breached ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]">
                            <AlertTriangle className="w-3 h-3" />
                            {t("slaBreached")}
                          </span>
                        ) : row.status === "resolved" || row.status === "closed" ? (
                          // Terminal states with no breach → SLA target
                          // was met. Show "Fulfilled" instead of "—" so
                          // the column is informative end-to-end.
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#DCFCE7] text-[#15803D] border border-[#86EFAC]">
                            <CheckCircle2 className="w-3 h-3" />
                            {t("slaFulfilled")}
                          </span>
                        ) : row.frtRemainingMinutes !== null &&
                          row.frtRemainingMinutes !== undefined ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]">
                            <Clock className="w-3 h-3" />
                            {row.frtRemainingMinutes}m
                          </span>
                        ) : (
                          <span className="text-[10px] text-[var(--color-text-secondary)]">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-end">
                        <ArrowRight className="w-4 h-4 text-[var(--color-text-secondary)] inline" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--color-text-secondary)]">
            {t("pageOf", { page, totalPages })}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-xs border border-[var(--color-border)] rounded disabled:opacity-50"
            >
              {t("prev")}
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-xs border border-[var(--color-border)] rounded disabled:opacity-50"
            >
              {t("next")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PriorityBadge({
  priority,
  t,
}: {
  priority: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const styles: Record<string, string> = {
    high: "text-[#991B1B] bg-[#FEE2E2] border-[#FCA5A5]",
    medium: "text-[#92400E] bg-[#FEF3C7] border-[#FDE68A]",
    low: "text-[#15803D] bg-[#DCFCE7] border-[#86EFAC]",
  };
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border ${styles[priority] || "border-[var(--color-border)]"}`}
    >
      {t(`filters.priority.${priority}`)}
    </span>
  );
}

function StatusBadge({
  status,
  t,
}: {
  status: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const styles: Record<string, string> = {
    new: "text-[#1E40AF] bg-[#DBEAFE]",
    in_progress: "text-[#92400E] bg-[#FEF3C7]",
    on_hold: "text-[#6D28D9] bg-[#EDE9FE]",
    resolved: "text-[#15803D] bg-[#DCFCE7]",
    closed: "text-[var(--color-text-secondary)] bg-[var(--color-border-subtle)]",
  };
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded ${styles[status] || ""}`}
    >
      {t(`filters.status.${status}`)}
    </span>
  );
}
