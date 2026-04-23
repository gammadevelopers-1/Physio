"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
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
} from "lucide-react";

const mockProfile = {
  name: "Hana Al-Saud",
  email: "h.alsaud@physio.edu.sa",
  resolved: 156,
  csat: 94,
  avgFRT: "1.2h",
};

interface MyTicket {
  id: string;
  subject: string;
  customer: string;
  category: string;
  priority: "high" | "medium" | "low";
  status: "new" | "inProgress" | "waiting" | "resolved" | "closed";
  slaRemaining: string;
  date: string;
}

const MyTicketsContent = () => {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const profile = { ...mockProfile, name: t("names.hanaAlSaud") };

  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const stats = [
    {
      label: t("myTicketsPage.stats.assigned"),
      value: "8",
      icon: Inbox,
      iconBg: "bg-[#EFF6FF]",
      iconColor: "text-[#3B82F6]",
    },
    {
      label: t("myTicketsPage.stats.inProgress"),
      value: "5",
      icon: Clock,
      iconBg: "bg-[#FEF9C3]",
      iconColor: "text-[#EAB308]",
    },
    {
      label: t("myTicketsPage.stats.dueToday"),
      value: "2",
      icon: AlertTriangle,
      iconBg: "bg-[#FFEDD5]",
      iconColor: "text-[#F97316]",
    },
    {
      label: t("myTicketsPage.stats.overdue"),
      value: "1",
      icon: XCircle,
      iconBg: "bg-[#FEE2E2]",
      iconColor: "text-[#EF4444]",
    },
  ];

  const myTickets: MyTicket[] = [
    {
      id: "1234",
      subject: t("ticketsBoard.subjects.cannotAccessCourse"),
      customer: t("names.ahmedK"),
      category: "login",
      priority: "high",
      status: "new",
      slaRemaining: "1.5h",
      date: t("mockDates.feb10_2026"),
    },
    {
      id: "1232",
      subject: t("ticketsBoard.subjects.paymentFailedTwice"),
      customer: t("names.omarA"),
      category: "billing",
      priority: "high",
      status: "inProgress",
      slaRemaining: "0.5h",
      date: t("mockDates.feb9_2026"),
    },
    {
      id: "1235",
      subject: t("ticketsBoard.subjects.certificateNotReceived"),
      customer: t("names.saraM"),
      category: "certificate",
      priority: "medium",
      status: "inProgress",
      slaRemaining: "3h",
      date: t("mockDates.feb10_2026"),
    },
    {
      id: "1236",
      subject: t("ticketsBoard.subjects.videoNotPlaying"),
      customer: t("names.fatimaN"),
      category: "content",
      priority: "low",
      status: "waiting",
      slaRemaining: "8h",
      date: t("mockDates.feb9_2026"),
    },
    {
      id: "1237",
      subject: t("ticketsBoard.subjects.refundRequest"),
      customer: t("names.khalidH"),
      category: "billing",
      priority: "medium",
      status: "new",
      slaRemaining: "4h",
      date: t("mockDates.feb8_2026"),
    },
  ];

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
    new: "bg-[#EFF6FF] text-[#3B82F6]",
    inProgress: "bg-[#FEF9C3] text-[#EAB308]",
    waiting: "bg-[#FFEDD5] text-[#F97316]",
    resolved: "bg-[#DCFCE7] text-[#22C55E]",
    closed: "bg-[#F3F4F6] text-[var(--color-text-secondary)]",
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
      ticket.id.includes(searchQuery);
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
              <SupportSidebar profile={profile} />
            </div>

            {/* Mobile Sidebar */}
            <SupportMobileSidebar profile={profile} />

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
                      className="bg-white rounded-xl border border-[var(--color-border)] p-4 flex items-start gap-3"
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
                <div className="flex gap-1 bg-[#F3F4F6] rounded-lg p-0.5">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`px-4 py-1.5 text-[13px] font-medium rounded-md transition-colors whitespace-nowrap ${
                        activeTab === tab.key
                          ? "bg-white text-[var(--color-text-primary)] shadow-sm"
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
                    className={`w-full sm:w-[260px] py-2 border border-[var(--color-border)] rounded-lg text-[13px] focus:outline-none focus:border-[var(--color-primary)] ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"}`}
                  />
                </div>
              </div>

              {/* Ticket Cards */}
              <div className="space-y-3 mb-6">
                {filteredTickets.map((ticket) => {
                  const slaHours = parseFloat(ticket.slaRemaining);
                  const slaColor = getSlaColor(ticket.slaRemaining);
                  const isUrgent = slaHours < 1;

                  return (
                    <div
                      key={ticket.id}
                      className={`bg-white rounded-xl border border-[var(--color-border)] p-4 ${isRTL ? "border-r-[3px]" : "border-l-[3px]"} ${priorityBorderColors[ticket.priority]} hover:shadow-sm transition-shadow`}
                    >
                      {/* Top Row: Ticket ID + Subject */}
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <span className="text-[13px] font-medium text-[#3B82F6] cursor-pointer hover:underline">
                            #{ticket.id}
                          </span>
                          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5 truncate">
                            {ticket.subject}
                          </h4>
                        </div>
                      </div>

                      {/* Middle Row: Customer + Category */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[13px] text-[var(--color-text-secondary)]">
                          {ticket.customer}
                        </span>
                        <span className="bg-[#F3F4F6] text-[var(--color-text-secondary)] text-[10px] px-2 py-0.5 rounded-md font-medium">
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
                  <div className="bg-white rounded-xl border border-[var(--color-border)] p-8 text-center">
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {t("myTicketsPage.noTickets")}
                    </p>
                  </div>
                )}
              </div>

              {/* Quick Reply Section */}
              <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5">
                {/* Title */}
                <div className="flex items-center gap-2 mb-4">
                  <Send className="w-5 h-5 text-[var(--color-primary)]" />
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                    {t("myTicketsPage.quickReply")}
                  </h3>
                </div>

                {/* Textarea */}
                <textarea
                  rows={3}
                  placeholder={t("myTicketsPage.quickReplyPlaceholder")}
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-xl text-[13px] text-[var(--color-text-secondary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)] resize-none mb-3"
                />

                {/* Macros + Send */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  {/* Macro Pills */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button className="px-3 py-1.5 text-[12px] font-medium text-[var(--color-text-secondary)] bg-[#F3F4F6] rounded-full hover:bg-[var(--color-border)] transition-colors">
                      {t("myTicketsPage.macros.acknowledgement")}
                    </button>
                    <button className="px-3 py-1.5 text-[12px] font-medium text-[var(--color-text-secondary)] bg-[#F3F4F6] rounded-full hover:bg-[var(--color-border)] transition-colors">
                      {t("myTicketsPage.macros.needMoreInfo")}
                    </button>
                    <button className="px-3 py-1.5 text-[12px] font-medium text-[var(--color-text-secondary)] bg-[#F3F4F6] rounded-full hover:bg-[var(--color-border)] transition-colors">
                      {t("myTicketsPage.macros.resolved")}
                    </button>
                  </div>

                  {/* Send Button */}
                  <button className="flex items-center gap-1.5 px-5 py-2 btn-gold text-white text-sm font-medium rounded-lg transition-colors">
                    <Send className="w-4 h-4" />
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
