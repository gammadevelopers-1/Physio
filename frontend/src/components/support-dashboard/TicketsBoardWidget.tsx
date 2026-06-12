"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  ClipboardList,
  ArrowRight,
  Search,
  Loader2,
} from "lucide-react";
import Select from "@/components/admin-dashboard/Select";
import { supportApi } from "@/lib/api";

interface Ticket {
  id: string;
  displayId: string;
  subject: string;
  customer: string;
  category: string;
  priority: "High" | "Medium" | "Low";
  status: "New" | "InProgress" | "Waiting" | "Resolved" | "Closed";
}

const TicketsBoardWidget = () => {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const router = useRouter();
  const { user } = useAuth();
  const isRTL = locale === "ar";

  const basePath = user?.supportSubRole === 'supervisor'
    ? `/${locale}/dashboard/support/supervisor`
    : `/${locale}/dashboard/support/agent`;

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchTickets = async () => {
      setIsLoading(true);
      try {
        const data = await supportApi.getTickets({ limit: 30 });
        const priorityMap: Record<string, Ticket["priority"]> = {
          high: "High",
          medium: "Medium",
          low: "Low",
        };
        const statusMap: Record<string, Ticket["status"]> = {
          new: "New",
          in_progress: "InProgress",
          on_hold: "Waiting",
          resolved: "Resolved",
          closed: "Closed",
        };
        const mapped: Ticket[] = (data.tickets || []).map((t: any) => ({
          id: t.id,
          displayId: t.referenceNumber || t.id,
          subject: t.subject,
          customer: [t.studentFirstName, t.studentLastName]
            .filter(Boolean)
            .join(" ") || "Unknown",
          category: t.category,
          priority: priorityMap[t.priority] || "Medium",
          status: statusMap[t.status] || "New",
        }));
        setTickets(mapped);
      } catch {
        setTickets([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTickets();
  }, []);

  const priorityStyles: Record<string, string> = {
    High: "bg-[#FEE2E2] text-[#EF4444]",
    Medium: "bg-[#FFEDD5] text-[#F97316]",
    Low: "bg-[#DCFCE7] text-[#22C55E]",
  };

  const statusStyles: Record<string, string> = {
    New: "bg-[var(--color-border-subtle)] text-[var(--color-primary)]",
    InProgress: "bg-[#FEF9C3] text-[#EAB308]",
    Waiting: "bg-[#FFEDD5] text-[#F97316]",
    Resolved: "bg-[#DCFCE7] text-[#22C55E]",
    Closed: "bg-[#F3F4F6] text-[#4B5563]",
  };

  const filteredTickets = tickets.filter((ticket) => {
    const matchesStatus =
      statusFilter === "all" || ticket.status === statusFilter;
    const matchesPriority =
      priorityFilter === "all" || ticket.priority === priorityFilter;
    const matchesSearch =
      searchQuery === "" ||
      ticket.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.customer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesPriority && matchesSearch;
  });

  return (
    <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-[var(--color-primary)]" />
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
            {t("ticketsBoard.title")}
          </h3>
          <span className="bg-[var(--color-primary)] text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
            {tickets.length}
          </span>
        </div>
        <button
          onClick={() => router.push(`${basePath}/tickets`)}
          className="text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] hover:underline flex items-center gap-1"
        >
          {t("ticketsBoard.viewAll")}
          <ArrowRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-page)]">
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          className="w-full sm:w-40"
          options={[
            { value: "all", label: t("ticketsBoard.filters.allStatuses") },
            { value: "New", label: t("ticketsBoard.statuses.new") },
            { value: "InProgress", label: t("ticketsBoard.statuses.inProgress") },
            { value: "Waiting", label: t("ticketsBoard.statuses.waiting") },
            { value: "Resolved", label: t("ticketsBoard.statuses.resolved") },
            { value: "Closed", label: t("ticketsBoard.statuses.closed") },
          ]}
        />

        <Select
          value={priorityFilter}
          onChange={setPriorityFilter}
          className="w-full sm:w-40"
          options={[
            { value: "all", label: t("ticketsBoard.filters.allPriorities") },
            { value: "High", label: t("ticketsBoard.priorities.high") },
            { value: "Medium", label: t("ticketsBoard.priorities.medium") },
            { value: "Low", label: t("ticketsBoard.priorities.low") },
          ]}
        />

        <div className={`relative flex-1 min-w-[180px]`}>
          <Search
            className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("ticketsBoard.filters.searchPlaceholder")}
            className={`w-full h-10 text-sm border border-[var(--color-input-border)] rounded-lg py-1.5 text-[var(--color-text-primary)] bg-[var(--color-surface-card)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)] ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"}`}
          />
        </div>
      </div>

      {/* Table — give the board a real working height so a sparse
           queue doesn't collapse to a 60-px strip below the filters.
           Overflow-y so a busy queue stays scannable without pushing
           the SLA performance section below the fold. */}
      <div className="min-h-[480px] max-h-[640px] overflow-y-auto overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="bg-[var(--color-surface-page)] border-b border-[var(--color-border)]">
              <th className="text-left text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase px-3 py-2.5">
                {t("ticketsBoard.columns.id")}
              </th>
              <th className="text-left text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase px-3 py-2.5">
                {t("ticketsBoard.columns.subject")}
              </th>
              <th className="text-left text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase px-3 py-2.5">
                {t("ticketsBoard.columns.customer")}
              </th>
              <th className="text-left text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase px-3 py-2.5 hidden md:table-cell">
                {t("ticketsBoard.columns.category")}
              </th>
              <th className="text-left text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase px-3 py-2.5">
                {t("ticketsBoard.columns.priority")}
              </th>
              <th className="text-left text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase px-3 py-2.5">
                {t("ticketsBoard.columns.status")}
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-t border-[var(--color-border)]">
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="px-3 py-3">
                      <div
                        className={`h-3 bg-[var(--color-border)] rounded animate-pulse ${
                          j === 1 ? "w-40" : j === 0 ? "w-16" : "w-20"
                        }`}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : filteredTickets.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-sm text-[var(--color-text-secondary)]">
                  {t("ticketsBoard.noTickets")}
                </td>
              </tr>
            ) : filteredTickets.map((ticket) => (
              <tr
                key={ticket.id}
                onClick={() => router.push(`${basePath}/tickets/${ticket.id}`)}
                className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-border-subtle)] transition-colors cursor-pointer"
              >
                <td className="px-3 py-3 whitespace-nowrap">
                  <span className="text-[13px] font-medium text-[var(--color-primary)]">
                    {ticket.displayId}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className="text-[13px] text-[var(--color-text-primary)] line-clamp-1">
                    {ticket.subject}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className="text-[13px] text-[var(--color-text-secondary)]">
                    {ticket.customer}
                  </span>
                </td>
                <td className="px-3 py-3 hidden md:table-cell whitespace-nowrap">
                  <span className="text-[11px] font-medium bg-[#F3F4F6] text-[#4B5563] px-2 py-0.5 rounded-md">
                    {ticket.category}
                  </span>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <span
                    className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${priorityStyles[ticket.priority]}`}
                  >
                    {t(
                      `ticketsBoard.priorities.${ticket.priority.toLowerCase()}`
                    )}
                  </span>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <span
                    className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${statusStyles[ticket.status]}`}
                  >
                    {t(
                      `ticketsBoard.statuses.${
                        ticket.status === "InProgress"
                          ? "inProgress"
                          : ticket.status.toLowerCase()
                      }`
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TicketsBoardWidget;
