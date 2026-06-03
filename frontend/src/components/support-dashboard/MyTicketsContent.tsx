"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supportApi } from "@/lib/api";
import { useSupportProfile } from "@/hooks/useSupportProfile";
import SupportNavbar from "./SupportNavbar";
import SupportSidebar from "./SupportSidebar";
import SupportMobileSidebar from "./SupportMobileSidebar";
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
  slaRemaining: string;
  date: string;
  slaBreached: boolean;
}

const MyTicketsContent = () => {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { user } = useAuth();
  const router = useRouter();

  const profile = useSupportProfile();

  const [apiTickets, setApiTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Quick reply state
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Macro state
  const [macros, setMacros] = useState<any[]>([]);
  const [showMacroDropdown, setShowMacroDropdown] = useState(false);
  const [macroPreview, setMacroPreview] = useState<string | null>(null);
  const [isApplyingMacro, setIsApplyingMacro] = useState(false);

  const fetchMyTickets = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      // Fetch tickets assigned to current user
      const data = await supportApi.getTickets({
        assigneeId: user.id,
        limit: 50,
      });
      setApiTickets(data.tickets || []);
    } catch {
      setApiTickets([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchMyTickets();
  }, [fetchMyTickets]);

  // Fetch macros once on mount
  useEffect(() => {
    supportApi
      .getMacros()
      .then((data) => setMacros(Array.isArray(data) ? data : []))
      .catch(() => setMacros([]));
  }, []);

  const myTickets: MyTicket[] = apiTickets.map((raw: any) => ({
    id: raw.id,
    displayId: (raw.id || "").substring(0, 8),
    subject: raw.subject,
    customer:
      [raw.studentFirstName, raw.studentLastName].filter(Boolean).join(" ") ||
      raw.guestName ||
      "Unknown",
    category: raw.category,
    priority: raw.priority,
    status:
      raw.status === "in_progress"
        ? "inProgress"
        : raw.status === "on_hold"
          ? "waiting"
          : raw.status,
    rawStatus: raw.status,
    slaRemaining: "--",
    date: raw.createdAt ? new Date(raw.createdAt).toLocaleDateString() : "",
    slaBreached: Boolean(raw.slaBreachedTtr || raw.slaBreachedFrt),
  }));

  // Compute stats from live data
  const stats = useMemo(
    () => [
      {
        label: t("myTicketsPage.stats.assigned"),
        value: String(apiTickets.length),
        icon: Inbox,
        iconBg: "bg-[#EFF6FF]",
        iconColor: "text-[#3B82F6]",
      },
      {
        label: t("myTicketsPage.stats.inProgress"),
        value: String(
          apiTickets.filter((x: any) => x.status === "in_progress").length,
        ),
        icon: Clock,
        iconBg: "bg-[#FEF9C3]",
        iconColor: "text-[#EAB308]",
      },
      {
        label: t("myTicketsPage.stats.dueToday"),
        value: String(
          apiTickets.filter(
            (x: any) => x.status === "new" || x.status === "in_progress",
          ).length,
        ),
        icon: AlertTriangle,
        iconBg: "bg-[#FFEDD5]",
        iconColor: "text-[#F97316]",
      },
      {
        label: t("myTicketsPage.stats.overdue"),
        value: String(
          apiTickets.filter(
            (x: any) => x.slaBreachedTtr || x.slaBreachedFrt,
          ).length,
        ),
        icon: XCircle,
        iconBg: "bg-[#FEE2E2]",
        iconColor: "text-[#EF4444]",
      },
    ],
    [apiTickets, t],
  );

  const selectedTicket = myTickets.find((x) => x.id === selectedTicketId) || null;

  async function handleSendReply() {
    if (!selectedTicketId || !replyMessage.trim()) return;
    setIsSending(true);
    try {
      await supportApi.addComment(selectedTicketId, {
        message: replyMessage.trim(),
        isInternal: false,
      });
      setReplyMessage("");
      setMacroPreview(null);
      toast.success("Reply sent");
      await fetchMyTickets();
    } catch {
      toast.error("Failed to send reply");
    } finally {
      setIsSending(false);
    }
  }

  async function handleApplyMacro(macroId: string) {
    if (!selectedTicketId) {
      toast.error("Select a ticket first");
      return;
    }
    setIsApplyingMacro(true);
    try {
      const result = await supportApi.applyMacro(selectedTicketId, macroId);
      setMacroPreview(result.resolvedBody);
      setShowMacroDropdown(false);
    } catch {
      toast.error("Failed to apply macro");
    } finally {
      setIsApplyingMacro(false);
    }
  }

  function handleOpenTicket(ticketId: string) {
    router.push(`/${locale}/dashboard/support/agent/tickets/${ticketId}`);
  }

  const tabs = [
    { key: "all", label: t("myTicketsPage.tabs.all") },
    { key: "new", label: t("myTicketsPage.tabs.new") },
    { key: "inProgress", label: t("myTicketsPage.tabs.inProgress") },
    { key: "waiting", label: t("myTicketsPage.tabs.waiting") },
  ];

  const priorityBorderColors: Record<string, string> = {
    high: "border-l-[#EF4444]",
    medium: "border-l-[#F97316]",
    low: "border-l-[#22C55E]",
  };

  const statusStyles: Record<string, string> = {
    new: "bg-[var(--color-border-subtle)] text-[var(--color-primary)]",
    inProgress: "bg-[#FEF9C3] text-[#EAB308]",
    waiting: "bg-[#FFEDD5] text-[#F97316]",
    resolved: "bg-[#DCFCE7] text-[#22C55E]",
    closed: "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]",
  };

  const getSlaColor = (sla: string): string => {
    const hours = parseFloat(sla);
    if (hours < 1) return "text-[#EF4444]";
    if (hours < 3) return "text-[#F97316]";
    return "text-[#22C55E]";
  };

  const filteredTickets = myTickets.filter((ticket) => {
    const matchesTab = activeTab === "all" || ticket.status === activeTab;
    const matchesSearch =
      searchQuery === "" ||
      ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.displayId.includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <>
      <SupportNavbar profile={profile} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar - Hidden on mobile */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <SupportSidebar profile={profile} supportSubRole={user?.supportSubRole} />
            </div>

            {/* Mobile Sidebar */}
            <SupportMobileSidebar profile={profile} supportSubRole={user?.supportSubRole} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                  {t("myTicketsPage.title")}
                </h1>
                <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                  {t("myTicketsPage.subtitle")}
                </p>
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
                        <p className="text-xl font-bold text-[var(--color-text-secondary)]">
                          {stat.value}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tabs + Search */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                <div className="flex gap-1 bg-[var(--color-border-subtle)] rounded-lg p-0.5">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`px-4 py-1.5 text-[13px] font-medium rounded-md transition-colors whitespace-nowrap ${
                        activeTab === tab.key
                          ? "bg-[var(--color-surface-card)] text-[var(--color-text-primary)] shadow-sm"
                          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="relative w-full sm:w-auto">
                  <Search
                    className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`}
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("myTicketsPage.searchPlaceholder")}
                    className={`w-full sm:w-[260px] py-2 border border-[var(--color-input-border)] rounded-lg text-[13px] focus:outline-none focus:border-[var(--color-input-focus)] ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"}`}
                  />
                </div>
              </div>

              {/* Ticket Cards */}
              <div className="space-y-3 mb-6">
                {filteredTickets.map((ticket) => {
                  const slaHours = parseFloat(ticket.slaRemaining);
                  const slaColor = getSlaColor(ticket.slaRemaining);
                  const isUrgent = slaHours < 1;
                  const isSelected = selectedTicketId === ticket.id;

                  return (
                    <div
                      key={ticket.id}
                      onClick={() => setSelectedTicketId(ticket.id)}
                      className={`bg-white rounded-xl border border-[var(--color-border)] p-4 cursor-pointer ${isRTL ? "border-r-[3px]" : "border-l-[3px]"} ${priorityBorderColors[ticket.priority]} hover:shadow-sm transition-all ${isSelected ? "ring-2 ring-[#a37f49] shadow-sm" : ""}`}
                    >
                      {/* Top Row: Ticket ID + Subject */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <span className="text-[13px] font-medium text-[#3B82F6]">
                            #{ticket.displayId}
                          </span>
                          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5 truncate">
                            {ticket.subject}
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenTicket(ticket.id);
                          }}
                          className="flex items-center gap-1 text-[11px] text-[var(--color-text-secondary)] hover:text-[#a37f49] flex-shrink-0"
                          title="Open full detail"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Open
                        </button>
                      </div>

                      {/* Middle Row: Customer + Category */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[13px] text-[var(--color-text-secondary)]">
                          {ticket.customer}
                        </span>
                        <span className="bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)] text-[10px] px-2 py-0.5 rounded-md font-medium">
                          {t(
                            `allTicketsPage.filters.categories.${ticket.category}`
                          )}
                        </span>
                      </div>

                      {/* Bottom Row: Status + SLA + Date */}
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          {/* Status Badge */}
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${statusStyles[ticket.status]}`}
                          >
                            {t(`allTicketsPage.statuses.${ticket.status}`)}
                          </span>

                          {/* SLA Remaining */}
                          <div className={`flex items-center gap-1 ${slaColor}`}>
                            {isUrgent && (
                              <AlertTriangle className="w-3.5 h-3.5 text-[#EF4444]" />
                            )}
                            <Clock className="w-3.5 h-3.5" />
                            <span className="text-[12px] font-medium">
                              {ticket.slaRemaining} {t("myTicketsPage.slaRemaining")}
                            </span>
                          </div>
                        </div>

                        {/* Date */}
                        <span className="text-[12px] text-[var(--color-text-secondary)]">
                          {ticket.date}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {filteredTickets.length === 0 && (
                  <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-8 text-center">
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {t("myTicketsPage.noTickets")}
                    </p>
                  </div>
                )}
              </div>

              {/* Quick Reply Section */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
                {/* Title */}
                <div className="flex items-center gap-2 mb-3">
                  <Send className="w-5 h-5 text-[#a37f49]" />
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                    {t("myTicketsPage.quickReply")}
                  </h3>
                </div>

                {/* Selected Ticket Indicator */}
                {selectedTicket ? (
                  <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-[#FFF8E6] border border-[#a37f49]/30 rounded-lg text-xs">
                    <span className="font-semibold text-[#6b4e24]">
                      Replying to #{selectedTicket.displayId}
                    </span>
                    <span className="text-[#6b4e24] truncate">
                      — {selectedTicket.subject}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTicketId(null);
                        setMacroPreview(null);
                      }}
                      className="ml-auto text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)]"
                      title="Clear selection"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="mb-3 px-3 py-2 bg-[var(--color-surface-page)] border border-dashed border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text-secondary)]">
                    Select a ticket above to reply
                  </div>
                )}

                {/* Macro Preview */}
                {macroPreview && (
                  <div className="mb-3 p-3 bg-[#FFF8E6] border border-[#a37f49]/40 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-[#6b4e24]">
                        Macro Preview
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
                          className="px-2 py-1 text-xs btn-gold text-white rounded"
                        >
                          Insert
                        </button>
                        <button
                          type="button"
                          onClick={() => setMacroPreview(null)}
                          className="px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
                      {macroPreview}
                    </p>
                  </div>
                )}

                {/* Textarea */}
                <textarea
                  rows={3}
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  disabled={!selectedTicketId || isSending}
                  placeholder={t("myTicketsPage.quickReplyPlaceholder")}
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-xl text-[13px] text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-[#a37f49] resize-none mb-3 disabled:bg-[var(--color-surface-page)] disabled:cursor-not-allowed"
                />

                {/* Macros + Send */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  {/* Apply Macro Dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowMacroDropdown(!showMacroDropdown)}
                      disabled={
                        !selectedTicketId || isApplyingMacro || macros.length === 0
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#6b4e24] bg-[#FFF8E6] rounded-full hover:bg-[#FFEFC9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isApplyingMacro ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <MessageSquarePlus className="w-3.5 h-3.5" />
                      )}
                      Apply Macro
                      {macros.length > 0 && (
                        <span className="text-[10px] opacity-70">
                          ({macros.length})
                        </span>
                      )}
                    </button>
                    {showMacroDropdown && macros.length > 0 && (
                      <div
                        className={`absolute bottom-full mb-1 bg-white border border-[var(--color-border)] rounded-lg shadow-lg z-20 min-w-[220px] max-h-60 overflow-y-auto py-1 ${isRTL ? "right-0" : "left-0"}`}
                      >
                        {macros.map((macro) => (
                          <button
                            key={macro.id}
                            type="button"
                            onClick={() => handleApplyMacro(macro.id)}
                            className="w-full text-left px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[#FFF8E6]"
                          >
                            {macro.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Send Button */}
                  <button
                    type="button"
                    onClick={handleSendReply}
                    disabled={
                      !selectedTicketId || !replyMessage.trim() || isSending
                    }
                    className="flex items-center gap-1.5 px-5 py-2 btn-gold text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MyTicketsContent;
