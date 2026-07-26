"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supportApi } from "@/lib/api";
import { useSupportProfile } from "@/hooks/useSupportProfile";
import { useSupportOnlineStatus } from "@/hooks/useSupportOnlineStatus";
import SupportNavbar from "./SupportNavbar";
import SupportSidebar from "./SupportSidebar";
import Select from "@/components/admin-dashboard/Select";
import TagFilterDropdown from "./TagFilterDropdown";
import {
  Inbox,
  Clock,
  AlertTriangle,
  XCircle,
  Search,
  Send,
  Loader2,
  MessageSquarePlus,
  ExternalLink,
  Lock,
  CheckCircle2,
  RefreshCw,
  Minus,
  Maximize2,
  X,
} from "lucide-react";

interface MyTicket {
  id: string;
  displayId: string;
  subject: string;
  customer: string;
  category: string;
  priority: "high" | "medium" | "low";
  status: "new" | "inProgress" | "waiting" | "resolved" | "closed";
  rawStatus: string;
  slaRemainingMinutes: number | null;
  slaPaused: boolean;
  slaPausedReason: "on_hold" | "off_hours" | null;
  date: string;
  slaBreached: boolean;
  createdAt: string;
}

// Statuses where the agent must not be able to send a reply.
// Closed = terminal; the customer has to open a new ticket to continue.
const TERMINAL_FOR_REPLY = new Set(["closed"]);

function formatSlaRemaining(minutes: number | null): string {
  if (minutes == null) return "";
  const abs = Math.abs(minutes);
  if (abs >= 60) {
    const hours = Math.round((abs / 60) * 10) / 10;
    return `${hours}h`;
  }
  return `${Math.round(abs)}m`;
}

const MyTicketsContent = () => {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { user } = useAuth();
  const router = useRouter();
  // True when the platform business hours are currently OPEN. When
  // false, the SLA badge renders as "Paused at X min" so the agent
  // doesn't think the timer reset to a full target.
  const { isOnline: supportOnline } = useSupportOnlineStatus();

  const basePath =
    user?.supportSubRole === "supervisor"
      ? `/${locale}/dashboard/support/supervisor`
      : `/${locale}/dashboard/support/agent`;

  const profile = useSupportProfile();

  // ── Data ─────────────────────────────────────────────────────────
  const [apiTickets, setApiTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // tick: bumped every 60s so SLA badges re-render without a full refetch
  const [, setTick] = useState(0);

  // ── Filters / search ────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"sla" | "newest" | "priority">("sla");

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearchQuery(searchInput), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  // ── Quick-reply state ───────────────────────────────────────────
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [composerMinimized, setComposerMinimized] = useState(false);

  // ── Macros ──────────────────────────────────────────────────────
  const [macros, setMacros] = useState<any[]>([]);
  const [showMacroDropdown, setShowMacroDropdown] = useState(false);
  const [macroPreview, setMacroPreview] = useState<string | null>(null);
  const [isApplyingMacro, setIsApplyingMacro] = useState(false);

  // ── Fetch ───────────────────────────────────────────────────────
  const fetchMyTickets = useCallback(
    async (silent = false) => {
      if (!user?.id) return;
      if (silent) setIsRefreshing(true);
      else setIsLoading(true);
      try {
        const data = await supportApi.getTickets({
          assigneeId: user.id,
          limit: 100,
          ...(priorityFilter !== "all" ? { priority: priorityFilter } : {}),
          ...(categoryFilter !== "all" ? { category: categoryFilter } : {}),
          ...(tagFilter.length > 0 ? { tags: tagFilter.join(",") } : {}),
          ...(searchQuery ? { search: searchQuery } : {}),
        });
        setApiTickets(data.tickets || []);
      } catch {
        setApiTickets([]);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [user?.id, priorityFilter, categoryFilter, tagFilter, searchQuery],
  );

  useEffect(() => {
    fetchMyTickets();
  }, [fetchMyTickets]);

  // Auto-refresh every 60s + tick SLA badges. Skipped while the user
  // is composing a reply to avoid surprising re-renders.
  useEffect(() => {
    const id = setInterval(() => {
      setTick((n) => n + 1);
      if (!replyMessage.trim()) fetchMyTickets(true);
    }, 60_000);
    return () => clearInterval(id);
  }, [fetchMyTickets, replyMessage]);

  useEffect(() => {
    supportApi
      .getMacros()
      .then((data) => setMacros(Array.isArray(data) ? data : []))
      .catch(() => setMacros([]));
  }, []);

  // ── Map + derive ────────────────────────────────────────────────
  const allMyTickets: MyTicket[] = useMemo(
    () =>
      apiTickets.map((raw: any) => ({
        id: raw.id,
        displayId: raw.referenceNumber || (raw.id || "").substring(0, 8),
        subject: raw.subject,
        customer:
          [raw.studentFirstName, raw.studentLastName].filter(Boolean).join(" ") ||
          raw.guestName ||
          t("myTicketsPage.unknownCustomer"),
        category: raw.category,
        priority: raw.priority,
        status:
          raw.status === "in_progress"
            ? "inProgress"
            : raw.status === "on_hold"
              ? "waiting"
              : raw.status,
        rawStatus: raw.status,
        slaRemainingMinutes:
          typeof raw.ttrRemainingMinutes === "number"
            ? raw.ttrRemainingMinutes
            : null,
        slaPaused: Boolean(raw.slaPaused),
        slaPausedReason:
          raw.slaPausedReason === "on_hold" ||
          raw.slaPausedReason === "off_hours"
            ? raw.slaPausedReason
            : null,
        date: raw.createdAt ? new Date(raw.createdAt).toLocaleDateString() : "",
        slaBreached: Boolean(raw.slaBreachedTtr || raw.slaBreachedFrt),
        createdAt: raw.createdAt,
      })),
    [apiTickets, t],
  );

  // Tab counters reflect what's in the current priority/category/search
  // result set (predictable: "you see what you filtered to").
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: allMyTickets.length,
      new: 0,
      inProgress: 0,
      waiting: 0,
      resolved: 0,
      closed: 0,
      overdue: 0,
    };
    for (const tk of allMyTickets) {
      counts[tk.status] = (counts[tk.status] || 0) + 1;
      if (tk.slaBreached) counts.overdue += 1;
    }
    return counts;
  }, [allMyTickets]);

  const filteredTickets = useMemo(() => {
    const list = allMyTickets.filter((tk) => {
      if (activeTab === "overdue") return tk.slaBreached;
      if (activeTab !== "all" && tk.status !== activeTab) return false;
      return true;
    });

    // Sort
    const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
    list.sort((a, b) => {
      if (sortBy === "sla") {
        // Breached first (most negative), then ascending remaining; null last.
        const am = a.slaRemainingMinutes;
        const bm = b.slaRemainingMinutes;
        if (am == null && bm == null) return 0;
        if (am == null) return 1;
        if (bm == null) return -1;
        return am - bm;
      }
      if (sortBy === "priority") {
        const d = (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99);
        if (d !== 0) return d;
      }
      // Default newest first
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return list;
  }, [allMyTickets, activeTab, sortBy]);

  // If the selected ticket is no longer in the visible set (filter changed,
  // status changed, reassigned), clear the selection so the reply panel
  // doesn't post to a hidden ticket.
  useEffect(() => {
    if (!selectedTicketId) return;
    const stillVisible = allMyTickets.some((tk) => tk.id === selectedTicketId);
    if (!stillVisible) {
      setSelectedTicketId(null);
      setMacroPreview(null);
    }
  }, [allMyTickets, selectedTicketId]);

  const selectedTicket = useMemo(
    () => allMyTickets.find((x) => x.id === selectedTicketId) || null,
    [allMyTickets, selectedTicketId],
  );

  const replyLocked = selectedTicket
    ? TERMINAL_FOR_REPLY.has(selectedTicket.rawStatus)
    : false;

  // ── Stats ──────────────────────────────────────────────────────
  const stats = useMemo(
    () => [
      {
        label: t("myTicketsPage.stats.assigned"),
        value: String(allMyTickets.length),
        icon: Inbox,
        iconBg: "bg-[#EFF6FF]",
        iconColor: "text-[#3B82F6]",
      },
      {
        label: t("myTicketsPage.stats.inProgress"),
        value: String(allMyTickets.filter((x) => x.status === "inProgress").length),
        icon: Clock,
        iconBg: "bg-[#FEF9C3]",
        iconColor: "text-[#EAB308]",
      },
      {
        label: t("myTicketsPage.stats.dueToday"),
        value: String(
          allMyTickets.filter(
            (x) =>
              x.slaRemainingMinutes != null &&
              x.slaRemainingMinutes >= 0 &&
              x.slaRemainingMinutes <= 8 * 60,
          ).length,
        ),
        icon: AlertTriangle,
        iconBg: "bg-[#FFEDD5]",
        iconColor: "text-[#F97316]",
      },
      {
        label: t("myTicketsPage.stats.overdue"),
        value: String(allMyTickets.filter((x) => x.slaBreached).length),
        icon: XCircle,
        iconBg: "bg-[#FEE2E2]",
        iconColor: "text-[#EF4444]",
      },
    ],
    [allMyTickets, t],
  );

  // ── Actions ─────────────────────────────────────────────────────
  async function handleSendReply() {
    if (!selectedTicketId || !replyMessage.trim() || replyLocked) return;
    setIsSending(true);
    try {
      await supportApi.addComment(selectedTicketId, {
        message: replyMessage.trim(),
        isInternal: false,
      });
      setReplyMessage("");
      setMacroPreview(null);
      toast.success(t("myTicketsPage.toasts.replySent"));
      await fetchMyTickets(true);
    } catch {
      toast.error(t("myTicketsPage.toasts.replyError"));
    } finally {
      setIsSending(false);
    }
  }

  async function handleApplyMacro(macroId: string) {
    if (!selectedTicketId || replyLocked) {
      toast.error(t("myTicketsPage.toasts.selectTicketFirst"));
      return;
    }
    setIsApplyingMacro(true);
    try {
      const result = await supportApi.applyMacro(selectedTicketId, macroId);
      setMacroPreview(result.resolvedBody);
      setShowMacroDropdown(false);
    } catch {
      toast.error(t("myTicketsPage.toasts.applyMacroError"));
    } finally {
      setIsApplyingMacro(false);
    }
  }

  function handleOpenTicket(ticketId: string) {
    router.push(`${basePath}/tickets/${ticketId}`);
  }

  // ── UI helpers ─────────────────────────────────────────────────
  const tabs = [
    { key: "all", label: t("myTicketsPage.tabs.all") },
    { key: "new", label: t("myTicketsPage.tabs.new") },
    { key: "inProgress", label: t("myTicketsPage.tabs.inProgress") },
    { key: "waiting", label: t("myTicketsPage.tabs.waiting") },
    { key: "resolved", label: t("myTicketsPage.tabs.resolved") },
    { key: "overdue", label: t("myTicketsPage.tabs.overdue") },
  ];

  // Physical L/R color classes so we can pair with the RTL-flipped
  // width class below (`border-r-[3px]` in RTL, `border-l-[3px]` in
  // LTR). Tailwind doesn't ship a logical `border-s-[#hex]` color
  // utility, so we mirror it manually per direction.
  const priorityBorderColors: Record<string, string> = isRTL
    ? {
        high: "border-r-[#EF4444]",
        medium: "border-r-[#F97316]",
        low: "border-r-[#22C55E]",
      }
    : {
        high: "border-l-[#EF4444]",
        medium: "border-l-[#F97316]",
        low: "border-l-[#22C55E]",
      };

  const statusStyles: Record<string, string> = {
    new: "bg-[var(--color-border-subtle)] text-[var(--color-primary)]",
    inProgress: "bg-[#FEF9C3] text-[#EAB308]",
    waiting: "bg-[#FFEDD5] text-[#F97316]",
    resolved: "bg-[#DCFCE7] text-[#22C55E]",
    closed: "bg-[#F3F4F6] text-[#4B5563]",
  };

  // SLA badge config — null when nothing meaningful to show.
  function getSlaBadge(tk: MyTicket): {
    label: string;
    className: string;
    Icon: typeof Clock;
    urgent: boolean;
  } | null {
    if (tk.rawStatus === "resolved" || tk.rawStatus === "closed") return null;
    const m = tk.slaRemainingMinutes;
    if (m == null) return null;
    // Prefer the per-ticket pause flag from the BE — single source of
    // truth. Falls back to supportOnline for older API responses still
    // in flight. Covers both off-hours AND on-hold tickets (the global
    // signal only covered off-hours).
    const paused = tk.slaPaused || supportOnline === false;
    if (paused && m >= 0) {
      return {
        label: `${t("myTicketsPage.slaPaused")} — ${formatSlaRemaining(m)}`,
        className: "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]",
        Icon: Clock,
        urgent: false,
      };
    }
    if (m < 0) {
      return {
        label: `${formatSlaRemaining(m)} ${t("myTicketsPage.slaOverBy")}`,
        className: "bg-[#FEE2E2] text-[#DC2626]",
        Icon: AlertTriangle,
        urgent: true,
      };
    }
    if (m < 60) {
      return {
        label: `${formatSlaRemaining(m)} ${t("myTicketsPage.slaLeft")}`,
        className: "bg-[#FEE2E2] text-[#DC2626]",
        Icon: AlertTriangle,
        urgent: true,
      };
    }
    if (m < 180) {
      return {
        label: `${formatSlaRemaining(m)} ${t("myTicketsPage.slaLeft")}`,
        className: "bg-[#FFEDD5] text-[#C2410C]",
        Icon: Clock,
        urgent: false,
      };
    }
    return {
      label: `${formatSlaRemaining(m)} ${t("myTicketsPage.slaLeft")}`,
      className: "bg-[#DCFCE7] text-[#15803D]",
      Icon: Clock,
      urgent: false,
    };
  }

  return (
    <>
      <SupportNavbar profile={profile} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <SupportSidebar profile={profile} supportSubRole={user?.supportSubRole} />
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0 flex flex-col">
              {/* Page Header */}
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                    {t("myTicketsPage.title")}
                  </h1>
                  <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                    {t("myTicketsPage.subtitle")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fetchMyTickets(true)}
                  disabled={isRefreshing}
                  className="flex items-center gap-1.5 px-3 h-9 text-[13px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
                  title={t("myTicketsPage.refresh")}
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">{t("myTicketsPage.refresh")}</span>
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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

              {/* Tickets list — full width. The reply composer floats in
                  at bottom-right only when a ticket is selected (see end
                  of component), so empty space is never wasted. Flex
                  column so the inner list can stretch to match the
                  sidebar's height instead of stopping mid-page. */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="min-w-0 flex-1 flex flex-col min-h-0">
                  {/* Filters card */}
                  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 mb-4">
                    <div className="flex flex-col md:flex-row gap-3 flex-wrap">
                      <div className="relative flex-1 min-w-[240px] md:basis-72">
                        <Search
                          className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
                        />
                        <input
                          type="text"
                          value={searchInput}
                          onChange={(e) => setSearchInput(e.target.value)}
                          placeholder={t("myTicketsPage.searchPlaceholder")}
                          className={`w-full h-10 border border-[var(--color-input-border)] rounded-lg text-sm bg-[var(--color-surface-card)] focus:outline-none focus:border-[var(--color-primary)] ${isRTL ? "pr-10 pl-3" : "pl-10 pr-3"}`}
                        />
                      </div>
                      <Select
                        value={categoryFilter}
                        onChange={setCategoryFilter}
                        className="w-full md:w-40"
                        options={[
                          { value: "all", label: t("allTicketsPage.filters.allCategories") },
                          { value: "login", label: t("allTicketsPage.filters.categories.login") },
                          { value: "certificate", label: t("allTicketsPage.filters.categories.certificate") },
                          { value: "billing", label: t("allTicketsPage.filters.categories.billing") },
                          { value: "content", label: t("allTicketsPage.filters.categories.content") },
                          { value: "technical", label: t("allTicketsPage.filters.categories.technical") },
                        ]}
                      />
                      <Select
                        value={priorityFilter}
                        onChange={setPriorityFilter}
                        className="w-full md:w-36"
                        options={[
                          { value: "all", label: t("allTicketsPage.filters.allPriorities") },
                          { value: "high", label: t("allTicketsPage.filters.priorities.high") },
                          { value: "medium", label: t("allTicketsPage.filters.priorities.medium") },
                          { value: "low", label: t("allTicketsPage.filters.priorities.low") },
                        ]}
                      />
                      <Select
                        value={sortBy}
                        onChange={(v) => setSortBy(v as typeof sortBy)}
                        className="w-full md:w-44"
                        options={[
                          { value: "sla", label: t("myTicketsPage.sort.slaUrgency") },
                          { value: "newest", label: t("myTicketsPage.sort.newest") },
                          { value: "priority", label: t("myTicketsPage.sort.priority") },
                        ]}
                      />
                      <TagFilterDropdown
                        selectedIds={tagFilter}
                        onChange={setTagFilter}
                        className="w-full md:w-56"
                      />
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="bg-[var(--color-surface-card)] rounded-t-xl border border-b-0 border-[var(--color-border)] px-3 py-3">
                    <div className="flex gap-1 overflow-x-auto">
                      {tabs.map((tab) => {
                        const count = tabCounts[tab.key] || 0;
                        const active = activeTab === tab.key;
                        return (
                          <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors flex items-center gap-2 whitespace-nowrap ${
                              active
                                ? "bg-[var(--color-border-subtle)] text-[var(--color-text-primary)]"
                                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                            }`}
                          >
                            {tab.label}
                            {count > 0 && (
                              <span
                                className={`min-w-[18px] h-[18px] inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${
                                  active
                                    ? "bg-[var(--color-primary)] text-white"
                                    : "bg-[var(--color-surface-page)] text-[var(--color-text-secondary)] border border-[var(--color-border)]"
                                }`}
                              >
                                {count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tickets list — fills remaining vertical space so the
                      right column matches the sidebar's height. Scrolls
                      internally when the queue is busier than the box. */}
                  <div className="bg-[var(--color-surface-card)] rounded-b-xl border border-[var(--color-border)] flex-1 flex flex-col min-h-0">
                    <div className="flex-1 min-h-[400px] overflow-y-auto p-3 space-y-2">
                      {isLoading &&
                        Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={`sk-${i}`}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[var(--color-border)]"
                          >
                            <div className="h-3 w-16 bg-[var(--color-border)] rounded animate-pulse" />
                            <div className="h-3 flex-1 bg-[var(--color-border)] rounded animate-pulse" />
                            <div className="h-3 w-14 bg-[var(--color-border)] rounded animate-pulse" />
                            <div className="h-3 w-12 bg-[var(--color-border)] rounded animate-pulse" />
                            <div className="h-3 w-16 bg-[var(--color-border)] rounded animate-pulse" />
                          </div>
                        ))}

                      {!isLoading && filteredTickets.length === 0 && (
                        <div className="py-12 flex flex-col items-center gap-2 text-[var(--color-text-secondary)]">
                          <Inbox className="w-8 h-8" />
                          <p className="text-sm">
                            {t("myTicketsPage.noTickets")}
                          </p>
                        </div>
                      )}

                      {!isLoading &&
                        filteredTickets.map((ticket) => {
                          const isSelected = selectedTicketId === ticket.id;
                          const sla = getSlaBadge(ticket);
                          const ticketReplyLocked = TERMINAL_FOR_REPLY.has(ticket.rawStatus);
                          return (
                            <div
                              key={ticket.id}
                              className={`bg-[var(--color-surface-card)] rounded-lg border border-[var(--color-border)] px-3 py-2.5 transition-all ${isRTL ? "border-r-[3px]" : "border-l-[3px]"} ${priorityBorderColors[ticket.priority]} hover:shadow-sm ${
                                isSelected
                                  ? "ring-2 ring-[var(--color-primary)] border-[var(--color-primary)]"
                                  : ""
                              }`}
                            >
                              {/* Row 1 — identity + subject + date */}
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[12px] font-mono text-[var(--color-primary)] whitespace-nowrap">
                                  #{ticket.displayId}
                                </span>
                                <span
                                  className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${statusStyles[ticket.status]}`}
                                >
                                  {t(`allTicketsPage.statuses.${ticket.status}`)}
                                </span>
                                <h4
                                  className="text-sm font-medium text-[var(--color-text-primary)] truncate flex-1"
                                  title={ticket.subject}
                                >
                                  {ticket.subject}
                                </h4>
                                <span className="text-[11px] text-[var(--color-text-secondary)] whitespace-nowrap shrink-0">
                                  {ticket.date}
                                </span>
                              </div>

                              {/* Row 2 — meta + actions */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className="text-[12px] text-[var(--color-text-secondary)] truncate min-w-0"
                                  title={ticket.customer}
                                >
                                  {ticket.customer}
                                </span>
                                <span className="bg-[#F3F4F6] text-[#4B5563] text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
                                  {t(`allTicketsPage.filters.categories.${ticket.category}`)}
                                </span>
                                {sla && (
                                  <span
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${sla.className}`}
                                  >
                                    <sla.Icon className="w-2.5 h-2.5" />
                                    {sla.label}
                                  </span>
                                )}
                                <div className={`flex items-center gap-1 ${isRTL ? "mr-auto" : "ml-auto"}`}>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedTicketId(ticket.id)}
                                    disabled={ticketReplyLocked}
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                      isSelected
                                        ? "bg-[var(--color-primary)] text-white"
                                        : "text-[var(--color-primary)] hover:bg-[var(--color-border-subtle)]"
                                    }`}
                                    title={
                                      ticketReplyLocked
                                        ? t("myTicketsPage.replyLocked.placeholder")
                                        : t("myTicketsPage.quickReply")
                                    }
                                  >
                                    <Send className="w-3 h-3" />
                                    {isSelected
                                      ? t("myTicketsPage.replyingNow")
                                      : t("myTicketsPage.quickReply")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenTicket(ticket.id)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-border-subtle)] transition-colors"
                                    title={t("myTicketsPage.openDetail")}
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    {t("myTicketsPage.openLabel")}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>

                {/* Floating Reply Composer — Gmail-style docked panel at
                    bottom-right. Only mounted when a ticket is selected so
                    there's never an empty placeholder column wasting space. */}
                {selectedTicket && (
                  <div
                    className={`fixed z-40 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-t-xl shadow-2xl flex flex-col ${
                      isRTL ? "left-4 sm:left-6" : "right-4 sm:right-6"
                    } bottom-0 w-[calc(100vw-2rem)] sm:w-[440px] max-w-[440px] ${
                      composerMinimized ? "" : "max-h-[calc(100vh-80px)]"
                    }`}
                  >
                    {/* Composer header — click to toggle minimize */}
                    <button
                      type="button"
                      onClick={() => setComposerMinimized((v) => !v)}
                      className="flex items-center justify-between gap-2 px-4 py-2.5 bg-[var(--color-primary)] text-white rounded-t-xl cursor-pointer hover:bg-[#001d5e] transition-colors"
                      aria-expanded={!composerMinimized}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Send className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm font-semibold truncate">
                          {t("myTicketsPage.replyingTo")} #{selectedTicket.displayId}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setComposerMinimized((v) => !v);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              setComposerMinimized((v) => !v);
                            }
                          }}
                          className="p-1 hover:bg-white/15 rounded transition-colors cursor-pointer"
                          aria-label={
                            composerMinimized
                              ? t("myTicketsPage.composer.expand")
                              : t("myTicketsPage.composer.minimize")
                          }
                          title={
                            composerMinimized
                              ? t("myTicketsPage.composer.expand")
                              : t("myTicketsPage.composer.minimize")
                          }
                        >
                          {composerMinimized ? (
                            <Maximize2 className="w-3.5 h-3.5" />
                          ) : (
                            <Minus className="w-3.5 h-3.5" />
                          )}
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTicketId(null);
                            setMacroPreview(null);
                            setComposerMinimized(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              setSelectedTicketId(null);
                              setMacroPreview(null);
                              setComposerMinimized(false);
                            }
                          }}
                          className="p-1 hover:bg-white/15 rounded transition-colors cursor-pointer"
                          aria-label={t("myTicketsPage.composer.close")}
                          title={t("myTicketsPage.composer.close")}
                        >
                          <X className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </button>

                    {/* Composer body — collapsed when minimized */}
                    {!composerMinimized && (
                    <div className="p-4 overflow-y-auto">

                    {/* Subject sub-header — supplements the ID in the bar above */}
                    {!replyLocked && (
                      <div
                        className="mb-3 text-xs text-[var(--color-text-secondary)] truncate"
                        title={selectedTicket.subject}
                      >
                        {selectedTicket.subject}
                      </div>
                    )}

                    {/* Locked banner — closed ticket */}
                    {selectedTicket && replyLocked && (
                      <div className="mb-3 flex items-start gap-2 px-3 py-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-xs">
                        <Lock className="w-4 h-4 text-[#DC2626] flex-shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-[#991B1B]">
                            {t("myTicketsPage.replyLocked.title")}
                          </div>
                          <p className="text-[#7F1D1D] mt-0.5">
                            {t("myTicketsPage.replyLocked.bodyClosed")}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleOpenTicket(selectedTicket.id)}
                            className="mt-2 text-[#991B1B] hover:underline font-medium"
                          >
                            {t("myTicketsPage.replyLocked.openTicket")}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTicketId(null);
                            setMacroPreview(null);
                          }}
                          className="text-[#991B1B] flex-shrink-0"
                          aria-label={t("myTicketsPage.clearSelection")}
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Advisory — resolved ticket */}
                    {selectedTicket?.rawStatus === "resolved" && !replyLocked && (
                      <div className="mb-3 flex items-start gap-2 px-3 py-2 bg-[#DCFCE7] border border-[#86EFAC] rounded-lg text-xs">
                        <CheckCircle2 className="w-4 h-4 text-[#15803D] flex-shrink-0 mt-0.5" />
                        <p className="text-[#14532D]">
                          {t("myTicketsPage.resolvedAdvisory")}
                        </p>
                      </div>
                    )}

                    {/* Macro preview */}
                    {macroPreview && !replyLocked && (
                      <div className="mb-3 p-3 bg-[var(--color-border-subtle)] border border-[var(--color-border)] rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-[var(--color-text-primary)]">
                            {t("myTicketsPage.macroPreviewLabel")}
                          </span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setReplyMessage((prev) =>
                                  prev ? prev + "\n\n" + macroPreview : macroPreview,
                                );
                                setMacroPreview(null);
                              }}
                              className="px-2 py-1 text-xs bg-[var(--color-primary)] text-white rounded"
                            >
                              {t("myTicketsPage.insertMacro")}
                            </button>
                            <button
                              type="button"
                              onClick={() => setMacroPreview(null)}
                              className="px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:underline"
                            >
                              {t("myTicketsPage.cancelMacro")}
                            </button>
                          </div>
                        </div>
                        <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">
                          {macroPreview}
                        </p>
                      </div>
                    )}

                    {/* Textarea */}
                    <textarea
                      rows={5}
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      disabled={!selectedTicketId || replyLocked || isSending}
                      placeholder={
                        replyLocked
                          ? t("myTicketsPage.replyLocked.placeholder")
                          : t("myTicketsPage.quickReplyPlaceholder")
                      }
                      className="w-full px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)] resize-none mb-3 disabled:bg-[var(--color-surface-page)] disabled:cursor-not-allowed"
                    />

                    {/* Macros + Send */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowMacroDropdown((v) => !v)}
                          disabled={
                            !selectedTicketId ||
                            replyLocked ||
                            isApplyingMacro ||
                            macros.length === 0
                          }
                          className="flex items-center justify-center sm:justify-start gap-1.5 w-full sm:w-auto px-3 py-2 text-[13px] font-medium text-[var(--color-text-primary)] bg-[var(--color-border-subtle)] rounded-lg hover:bg-[var(--color-border)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isApplyingMacro ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <MessageSquarePlus className="w-3.5 h-3.5" />
                          )}
                          {t("myTicketsPage.applyMacroButton")}
                          {macros.length > 0 && (
                            <span className="text-[10px] opacity-70">({macros.length})</span>
                          )}
                        </button>
                        {showMacroDropdown && macros.length > 0 && (
                          <div
                            className={`absolute bottom-full mb-1 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-lg shadow-lg z-30 min-w-[220px] max-h-60 overflow-y-auto py-1 ${isRTL ? "right-0" : "left-0"}`}
                          >
                            {macros.map((macro) => (
                              <button
                                key={macro.id}
                                type="button"
                                onClick={() => handleApplyMacro(macro.id)}
                                className="w-full text-start px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)]"
                              >
                                {macro.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={handleSendReply}
                        disabled={
                          !selectedTicketId ||
                          replyLocked ||
                          !replyMessage.trim() ||
                          isSending
                        }
                        className="flex items-center justify-center gap-1.5 px-4 py-2 bg-[var(--color-primary)] hover:bg-[#001d5e] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        {t("myTicketsPage.send")}
                      </button>
                    </div>
                    </div>
                    )}
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

export default MyTicketsContent;
