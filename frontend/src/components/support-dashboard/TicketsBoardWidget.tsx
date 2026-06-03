"use client";

import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  ClipboardList,
  ArrowRight,
  Search,
  MoreVertical,
  Loader2,
} from "lucide-react";
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
          displayId: t.id?.substring(0, 8) || t.id,
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
    Closed: "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]",
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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-[var(--color-input-border)] rounded-lg px-3 py-1.5 text-[var(--color-text-secondary)] bg-[var(--color-surface-card)] focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)] focus:border-transparent"
        >
          <option value="all">{t("ticketsBoard.filters.allStatuses")}</option>
          <option value="New">{t("ticketsBoard.statuses.new")}</option>
          <option value="InProgress">
            {t("ticketsBoard.statuses.inProgress")}
          </option>
          <option value="Waiting">{t("ticketsBoard.statuses.waiting")}</option>
          <option value="Resolved">
            {t("ticketsBoard.statuses.resolved")}
          </option>
          <option value="Closed">{t("ticketsBoard.statuses.closed")}</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="text-sm border border-[var(--color-input-border)] rounded-lg px-3 py-1.5 text-[var(--color-text-secondary)] bg-[var(--color-surface-card)] focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)] focus:border-transparent"
        >
          <option value="all">
            {t("ticketsBoard.filters.allPriorities")}
          </option>
          <option value="High">{t("ticketsBoard.priorities.high")}</option>
          <option value="Medium">{t("ticketsBoard.priorities.medium")}</option>
          <option value="Low">{t("ticketsBoard.priorities.low")}</option>
        </select>

        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("ticketsBoard.filters.searchPlaceholder")}
            className="w-full text-sm border border-[var(--color-input-border)] rounded-lg pl-9 pr-3 py-1.5 text-[var(--color-text-secondary)] bg-[var(--color-surface-card)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)] focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      <div>
        <table className="w-full">
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
              <th className="text-left text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase px-3 py-2.5 w-10">
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-[#3B82F6] mx-auto" />
                </td>
              </tr>
            ) : filteredTickets.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-sm text-[var(--color-text-secondary)]">
                  {t("ticketsBoard.noTickets")}
                </td>
              </tr>
            ) : filteredTickets.map((ticket) => (
              <tr
                key={ticket.id}
                onClick={() => router.push(`${basePath}/tickets/${ticket.id}`)}
                className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-border-subtle)] transition-colors cursor-pointer"
              >
                <td className="px-3 py-3">
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
                <td className="px-3 py-3 hidden md:table-cell">
                  <span className="text-[11px] font-medium bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] px-2 py-0.5 rounded-md">
                    {ticket.category}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${priorityStyles[ticket.priority]}`}
                  >
                    {t(
                      `ticketsBoard.priorities.${ticket.priority.toLowerCase()}`
                    )}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusStyles[ticket.status]}`}
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
                <td className="px-3 py-3">
                  <button className="w-7 h-7 flex items-center justify-center rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-border-subtle)] transition-colors">
                    <MoreVertical className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" />
                  </button>
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
