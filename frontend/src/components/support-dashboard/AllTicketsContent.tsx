"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { supportApi } from "@/lib/api";
import { useSupportProfile } from "@/hooks/useSupportProfile";
import { toast } from "sonner";
import SupportNavbar from "./SupportNavbar";
import SupportSidebar from "./SupportSidebar";
import Select from "@/components/admin-dashboard/Select";
import {
  FileText,
  ClipboardList,
  CheckCircle,
  Clock,
  Search,
  Eye,
  XCircle,
  RotateCcw,
  Link2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Inbox,
  MoreVertical,
  AlertTriangle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface Ticket {
  id: string;
  displayId: string;
  subject: string;
  customer: string;
  email: string;
  category: string;
  priority: "high" | "medium" | "low";
  status: "new" | "inProgress" | "waiting" | "resolved" | "closed";
  assignee: string | null;
  date: string;
  escalatedAt: string | null;
}

// API status → UI status key
const apiToUiStatus = (s: string): Ticket["status"] => {
  if (s === "in_progress") return "inProgress";
  if (s === "on_hold") return "waiting";
  return (s as Ticket["status"]) || "new";
};

// Tab key → API status value (for the listTickets filter)
const tabToApiStatus: Record<string, string | undefined> = {
  all: undefined,
  new: "new",
  inProgress: "in_progress",
  waiting: "on_hold",
  resolved: "resolved",
  closed: "closed",
};

const AllTicketsContent = () => {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { user } = useAuth();
  const router = useRouter();

  const basePath =
    user?.supportSubRole === "supervisor"
      ? `/${locale}/dashboard/support/supervisor`
      : `/${locale}/dashboard/support/agent`;

  const profile = useSupportProfile();

  // ── Data state ───────────────────────────────────────────────────
  const [apiTickets, setApiTickets] = useState<any[]>([]);
  const [totalTickets, setTotalTickets] = useState(0);
  const [statusBreakdown, setStatusBreakdown] = useState<Record<string, number>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [resolvedThisWeek, setResolvedThisWeek] = useState<number | null>(null);
  const [avgResolutionHours, setAvgResolutionHours] = useState<number | null>(null);
  const pageSize = 10;

  // ── Filter state ─────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [escalatedOnly, setEscalatedOnly] = useState(false);

  // Live category list for the filter dropdown — built-ins keep their
  // localised labels; custom admin-added categories show nameAr/nameEn.
  const [categories, setCategories] = useState<
    { slug: string; nameEn: string; nameAr: string | null; builtin: boolean }[]
  >([]);
  useEffect(() => {
    let cancelled = false;
    supportApi
      .listTicketCategories()
      .then((rows) => {
        if (cancelled) return;
        setCategories(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounce search input → searchQuery (server-side filter)
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  // ── Fetch tickets ────────────────────────────────────────────────
  const fetchTickets = useCallback(async () => {
    setIsLoadingTickets(true);
    try {
      const params: Record<string, any> = {
        page: currentPage,
        limit: pageSize,
      };
      const apiStatus = tabToApiStatus[activeTab];
      if (apiStatus) params.status = apiStatus;
      if (priorityFilter !== "all") params.priority = priorityFilter;
      if (categoryFilter !== "all") params.category = categoryFilter;
      if (escalatedOnly) params.escalated = "1";
      if (searchQuery) params.search = searchQuery;

      const data = await supportApi.getTickets(params);
      setApiTickets(data.tickets || []);
      setTotalTickets(data.total || 0);
    } catch {
      setApiTickets([]);
    } finally {
      setIsLoadingTickets(false);
    }
  }, [currentPage, activeTab, priorityFilter, categoryFilter, escalatedOnly, searchQuery]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // KPIs (statusBreakdown for tabs + cards)
  const fetchKpis = useCallback(() => {
    supportApi
      .getKPIs()
      .then((k) => {
        setResolvedThisWeek(
          typeof k.resolvedThisWeek === "number" ? k.resolvedThisWeek : null,
        );
        setAvgResolutionHours(
          typeof k.avgResolutionHours === "number" ? k.avgResolutionHours : null,
        );
        setStatusBreakdown(k.statusBreakdown || {});
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchKpis();
  }, [fetchKpis]);

  const totalAll = Object.values(statusBreakdown).reduce((a, b) => a + b, 0);
  const openCount =
    (statusBreakdown.new || 0) +
    (statusBreakdown.in_progress || 0) +
    (statusBreakdown.on_hold || 0);

  const stats = [
    {
      label: t("allTicketsPage.stats.totalTickets"),
      value: totalAll > 0 ? String(totalAll) : "--",
      icon: FileText,
      iconBg: "bg-[var(--color-border-subtle)]",
      iconColor: "text-[var(--color-primary)]",
    },
    {
      label: t("allTicketsPage.stats.open"),
      value: openCount > 0 ? String(openCount) : "--",
      icon: ClipboardList,
      iconBg: "bg-[#FFEDD5]",
      iconColor: "text-[#F97316]",
    },
    {
      label: t("allTicketsPage.stats.resolvedThisWeek"),
      value: resolvedThisWeek == null ? "--" : String(resolvedThisWeek),
      icon: CheckCircle,
      iconBg: "bg-[#DCFCE7]",
      iconColor: "text-[#22C55E]",
    },
    {
      label: t("allTicketsPage.stats.avgResolution"),
      value: avgResolutionHours == null ? "--" : `${avgResolutionHours}h`,
      icon: Clock,
      iconBg: "bg-[#F3E8FF]",
      iconColor: "text-[#8B5CF6]",
    },
  ];

  // Map API tickets to display rows
  const tickets: Ticket[] = apiTickets.map((tk: any) => ({
    id: tk.id,
    displayId: tk.referenceNumber || tk.id?.substring(0, 8) || tk.id,
    subject: tk.subject,
    customer:
      [tk.studentFirstName, tk.studentLastName].filter(Boolean).join(" ") ||
      t("allTicketsPage.unknownCustomer"),
    email: tk.studentEmail || "",
    category: tk.category,
    priority: tk.priority,
    status: apiToUiStatus(tk.status),
    assignee:
      [tk.assigneeFirstName, tk.assigneeLastName].filter(Boolean).join(" ") ||
      null,
    date: tk.createdAt ? new Date(tk.createdAt).toLocaleDateString() : "",
    escalatedAt: tk.escalatedAt || null,
  }));

  const totalPages = Math.max(1, Math.ceil(totalTickets / pageSize));

  // Tab counts derived from KPIs.statusBreakdown (global, not page-scoped)
  const tabs = [
    { key: "all", label: t("allTicketsPage.tabs.all"), count: totalAll },
    { key: "new", label: t("allTicketsPage.tabs.new"), count: statusBreakdown.new || 0 },
    {
      key: "inProgress",
      label: t("allTicketsPage.tabs.inProgress"),
      count: statusBreakdown.in_progress || 0,
    },
    {
      key: "waiting",
      label: t("allTicketsPage.tabs.waiting"),
      count: statusBreakdown.on_hold || 0,
    },
    {
      key: "resolved",
      label: t("allTicketsPage.tabs.resolved"),
      count: statusBreakdown.resolved || 0,
    },
    {
      key: "closed",
      label: t("allTicketsPage.tabs.closed"),
      count: statusBreakdown.closed || 0,
    },
  ];

  const priorityStyles: Record<string, string> = {
    high: "bg-[#FEE2E2] text-[#EF4444]",
    medium: "bg-[#FFEDD5] text-[#F97316]",
    low: "bg-[#DCFCE7] text-[#22C55E]",
  };

  const statusStyles: Record<string, string> = {
    new: "bg-[var(--color-border-subtle)] text-[var(--color-primary)]",
    inProgress: "bg-[#FEF9C3] text-[#EAB308]",
    waiting: "bg-[#FFEDD5] text-[#F97316]",
    resolved: "bg-[#DCFCE7] text-[#22C55E]",
    closed: "bg-[#F3F4F6] text-[#4B5563]",
  };

  // ── Row actions ──────────────────────────────────────────────────
  const handleView = (id: string) => {
router.push(`${basePath}/tickets/${id}`);
  };

  const handleCopyLink = async (id: string) => {
try {
      const url = `${window.location.origin}${basePath}/tickets/${id}`;
      await navigator.clipboard.writeText(url);
      toast.success(t("allTicketsPage.toasts.linkCopied"));
    } catch {
      toast.error(t("allTicketsPage.toasts.copyError"));
    }
  };

  const handleResolve = async (id: string) => {
try {
      await supportApi.resolveTicket(id);
      toast.success(t("allTicketsPage.toasts.resolved"));
      fetchTickets();
      fetchKpis();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      toast.error(msg || t("allTicketsPage.toasts.actionFailed"));
    }
  };

  const handleClose = async (id: string) => {
try {
      await supportApi.closeTicket(id);
      toast.success(t("allTicketsPage.toasts.closed"));
      fetchTickets();
      fetchKpis();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      toast.error(msg || t("allTicketsPage.toasts.actionFailed"));
    }
  };

  const handleReopen = async (id: string) => {
try {
      await supportApi.updateTicket(id, { status: "in_progress" });
      toast.success(t("allTicketsPage.toasts.reopened"));
      fetchTickets();
      fetchKpis();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      toast.error(msg || t("allTicketsPage.toasts.actionFailed"));
    }
  };

  return (
    <>
      <SupportNavbar profile={profile} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <SupportSidebar profile={profile} supportSubRole={user?.supportSubRole} />
            </div>

            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                    {t("allTicketsPage.title")}
                  </h1>
                  <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                    {t("allTicketsPage.subtitle")}
                  </p>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {stats.map((stat, index) => {
                  const Icon = stat.icon;
                  return (
                    <div
                      key={index}
                      className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 flex items-start gap-3"
                    >
                      <div
                        className={`w-10 h-10 ${stat.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}
                      >
                        <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                      </div>
                      <div>
                        <p className="text-xs text-[var(--color-text-secondary)] font-medium">
                          {stat.label}
                        </p>
                        <p className="text-xl font-bold text-[var(--color-text-primary)]">
                          {stat.value}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Filters Card — admin-dashboard pattern */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-3 flex-wrap">
                  <div className="relative flex-1 min-w-[240px] md:basis-72">
                    <Search
                      className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-secondary)] start-3`}
                    />
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder={t("allTicketsPage.searchPlaceholder")}
                      className={`w-full h-10 border border-[var(--color-input-border)] rounded-lg text-sm bg-[var(--color-surface-card)] focus:outline-none focus:border-[var(--color-primary)] ps-10 pe-3`}
                    />
                  </div>

                  <Select
                    value={categoryFilter}
                    onChange={(v) => {
                      setCategoryFilter(v);
                      setCurrentPage(1);
                    }}
                    className="w-full md:w-44"
                    options={[
                      { value: "all", label: t("allTicketsPage.filters.allCategories") },
                      ...categories.map((c) => {
                        // Built-in slugs keep their pre-translated label;
                        // custom slugs fall back to nameAr/nameEn directly.
                        const builtinKey = c.builtin
                          ? `allTicketsPage.filters.categories.${c.slug}`
                          : null;
                        const label = builtinKey
                          ? t(builtinKey as any)
                          : (isRTL && c.nameAr ? c.nameAr : c.nameEn || c.slug);
                        return { value: c.slug, label };
                      }),
                    ]}
                  />

                  <Select
                    value={priorityFilter}
                    onChange={(v) => {
                      setPriorityFilter(v);
                      setCurrentPage(1);
                    }}
                    className="w-full md:w-40"
                    options={[
                      { value: "all", label: t("allTicketsPage.filters.allPriorities") },
                      { value: "high", label: t("allTicketsPage.filters.priorities.high") },
                      { value: "medium", label: t("allTicketsPage.filters.priorities.medium") },
                      { value: "low", label: t("allTicketsPage.filters.priorities.low") },
                    ]}
                  />

                  <button
                    type="button"
                    onClick={() => {
                      setEscalatedOnly((prev) => !prev);
                      setCurrentPage(1);
                    }}
                    className={`h-10 px-3 flex items-center justify-center gap-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                      escalatedOnly
                        ? "border-red-300 bg-red-50 text-red-700"
                        : "border-[var(--color-input-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                    }`}
                    title={t("allTicketsPage.filters.escalatedOnly")}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {t("allTicketsPage.filters.escalatedOnly")}
                  </button>
                </div>
              </div>

              {/* Tickets Card */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)]">
                {/* Tabs */}
                <div className="px-5 py-4 border-b border-[var(--color-border-subtle)]">
                  <div className="flex gap-1 bg-[var(--color-border-subtle)] rounded-lg p-1 w-fit overflow-x-auto">
                    {tabs.map((tab) => {
                      const active = activeTab === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => {
                            setActiveTab(tab.key);
                            setCurrentPage(1);
                          }}
                          className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors flex items-center gap-2 whitespace-nowrap ${
                            active
                              ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                          }`}
                        >
                          {tab.label}
                          {tab.count > 0 && (
                            <span
                              className={`min-w-[20px] h-5 inline-flex items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
                                active
                                  ? "bg-[var(--color-primary)] text-white"
                                  : "bg-[var(--color-border)] text-[var(--color-text-secondary)]"
                              }`}
                            >
                              {tab.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Table — horizontal scroll only on table */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1100px]">
                    <thead className="bg-[var(--color-surface-page)] border-b border-[var(--color-border)]">
                      <tr>
                        <th className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase whitespace-nowrap text-start`}>
                          {t("allTicketsPage.columns.ticketId")}
                        </th>
                        <th className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase text-start`}>
                          {t("allTicketsPage.columns.subject")}
                        </th>
                        <th className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase text-start`}>
                          {t("allTicketsPage.columns.customer")}
                        </th>
                        <th className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase whitespace-nowrap text-start`}>
                          {t("allTicketsPage.columns.category")}
                        </th>
                        <th className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase whitespace-nowrap text-start`}>
                          {t("allTicketsPage.columns.priority")}
                        </th>
                        <th className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase whitespace-nowrap text-start`}>
                          {t("allTicketsPage.columns.status")}
                        </th>
                        <th className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase whitespace-nowrap text-start`}>
                          {t("allTicketsPage.columns.assignedTo")}
                        </th>
                        <th className={`py-3 px-4 text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase whitespace-nowrap text-start`}>
                          {t("allTicketsPage.columns.date")}
                        </th>
                        <th className="py-3 px-4 w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoadingTickets &&
                        Array.from({ length: 8 }).map((_, i) => (
                          <tr key={`sk-${i}`} className="border-t border-[var(--color-border)]">
                            {Array.from({ length: 9 }).map((_, j) => (
                              <td key={j} className="px-3 py-3">
                                <div
                                  className={`h-3 bg-[var(--color-border)] rounded animate-pulse ${
                                    j === 1 ? "w-40" : j === 0 ? "w-16" : "w-20"
                                  }`}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}

                      {!isLoadingTickets && tickets.length === 0 && (
                        <tr>
                          <td colSpan={9} className="py-12 text-center">
                            <div className="flex flex-col items-center gap-2 text-[var(--color-text-secondary)]">
                              <Inbox className="w-8 h-8" />
                              <p className="text-sm">
                                {t("allTicketsPage.empty")}
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}

                      {!isLoadingTickets &&
                        tickets.map((ticket) => (
                          <tr
                            key={ticket.id}
                            className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-border-subtle)] transition-colors"
                          >
                            {/* Ticket # */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <button
                                type="button"
                                className="text-[13px] font-medium text-[var(--color-primary)] hover:underline"
                                onClick={() => router.push(`${basePath}/tickets/${ticket.id}`)}
                              >
                                #{ticket.displayId}
                              </button>
                            </td>
                            {/* Subject — truncated to a single line, full text in title */}
                            <td className="py-3 px-4 max-w-[260px]">
                              <span
                                className="block truncate text-[13px] font-medium text-[var(--color-text-primary)]"
                                title={ticket.subject}
                              >
                                {ticket.subject}
                              </span>
                            </td>
                            {/* Customer */}
                            <td className="py-3 px-4 max-w-[220px]">
                              <p
                                className="truncate text-[13px] text-[var(--color-text-primary)] font-medium"
                                title={ticket.customer}
                              >
                                {ticket.customer}
                              </p>
                              <p
                                className="truncate text-[11px] text-[var(--color-text-secondary)]"
                                title={ticket.email}
                              >
                                {ticket.email}
                              </p>
                            </td>
                            {/* Category */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="bg-[#F3F4F6] text-[#4B5563] text-[11px] px-2 py-0.5 rounded-md font-medium">
                                {t(`allTicketsPage.filters.categories.${ticket.category}`)}
                              </span>
                            </td>
                            {/* Priority + Escalated indicator */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${priorityStyles[ticket.priority]}`}
                                >
                                  {t(`allTicketsPage.filters.priorities.${ticket.priority}`)}
                                </span>
                                {ticket.escalatedAt && (
                                  <span
                                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-red-50 text-red-700 ring-1 ring-inset ring-red-200"
                                    title={t("allTicketsPage.escalated")}
                                  >
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    {t("allTicketsPage.escalated")}
                                  </span>
                                )}
                              </div>
                            </td>
                            {/* Status */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${statusStyles[ticket.status]}`}
                              >
                                {t(`allTicketsPage.statuses.${ticket.status}`)}
                              </span>
                            </td>
                            {/* Assigned To */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="text-[13px] text-[var(--color-text-secondary)]">
                                {ticket.assignee || "--"}
                              </span>
                            </td>
                            {/* Date */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="text-[13px] text-[var(--color-text-secondary)]">
                                {ticket.date}
                              </span>
                            </td>
                            {/* Actions — shadcn DropdownMenu, anchors to trigger */}
                            <td className="py-3 px-4 whitespace-nowrap">
                              <DropdownMenu dir={isRTL ? "rtl" : "ltr"}>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    aria-label={t("a11y.ticketActions")}
                                    className="w-8 h-8 flex items-center justify-center border border-[var(--color-border)] rounded-md hover:bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] data-[state=open]:bg-[var(--color-border-subtle)] data-[state=open]:text-[var(--color-primary)] transition-colors"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" sideOffset={4}>
                                  <DropdownMenuItem onSelect={() => handleView(ticket.id)}>
                                    <Eye className="w-4 h-4 flex-shrink-0" />
                                    <span>{t("allTicketsPage.actions.view")}</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => handleCopyLink(ticket.id)}>
                                    <Link2 className="w-4 h-4 flex-shrink-0" />
                                    <span>{t("allTicketsPage.actions.copyLink")}</span>
                                  </DropdownMenuItem>

                                  {ticket.status !== "resolved" && ticket.status !== "closed" && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onSelect={() => handleResolve(ticket.id)}
                                        className="text-[#15803D] hover:bg-[#DCFCE7] focus:bg-[#DCFCE7]"
                                      >
                                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                        <span>{t("allTicketsPage.actions.markResolved")}</span>
                                      </DropdownMenuItem>
                                    </>
                                  )}

                                  {ticket.status === "resolved" && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        danger
                                        onSelect={() => handleClose(ticket.id)}
                                      >
                                        <XCircle className="w-4 h-4 flex-shrink-0" />
                                        <span>{t("allTicketsPage.actions.close")}</span>
                                      </DropdownMenuItem>
                                    </>
                                  )}

                                  {ticket.status === "closed" && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onSelect={() => handleReopen(ticket.id)}
                                        className="text-[var(--color-primary)] hover:bg-[var(--color-border-subtle)] focus:bg-[var(--color-border-subtle)]"
                                      >
                                        <RotateCcw className="w-4 h-4 flex-shrink-0" />
                                        <span>{t("allTicketsPage.actions.reopen")}</span>
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination — admin style with numbered pages */}
                {totalTickets > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3 border-t border-[var(--color-border-subtle)] gap-3">
                    <p className="text-[13px] text-[var(--color-text-secondary)]">
                      {t("allTicketsPage.pagination.showing", {
                        from: totalTickets === 0 ? 0 : (currentPage - 1) * pageSize + 1,
                        to: Math.min(currentPage * pageSize, totalTickets),
                        total: totalTickets,
                      })}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        className="flex items-center gap-1 px-3 py-1.5 text-[13px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                        {t("allTicketsPage.pagination.previous")}
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(
                          (p) =>
                            p === 1 ||
                            p === totalPages ||
                            Math.abs(p - currentPage) <= 1,
                        )
                        .map((p, idx, arr) => (
                          <span key={p} className="flex items-center">
                            {idx > 0 && arr[idx - 1] !== p - 1 && (
                              <span className="px-1 text-[var(--color-text-secondary)]">
                                …
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setCurrentPage(p)}
                              className={`w-8 h-8 text-[13px] rounded-lg ${
                                p === currentPage
                                  ? "bg-[var(--color-primary)] text-white"
                                  : "border border-[var(--color-border)] hover:bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
                              }`}
                            >
                              {p}
                            </button>
                          </span>
                        ))}
                      <button
                        type="button"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        className="flex items-center gap-1 px-3 py-1.5 text-[13px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t("allTicketsPage.pagination.next")}
                        {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
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
};

export default AllTicketsContent;
