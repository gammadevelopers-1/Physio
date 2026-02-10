"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import SupportNavbar from "./SupportNavbar";
import SupportSidebar from "./SupportSidebar";
import SupportMobileSidebar from "./SupportMobileSidebar";
import {
  FileText,
  ClipboardList,
  CheckCircle,
  Clock,
  Search,
  Plus,
  MoreVertical,
  Eye,
  UserPlus,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const mockProfile = {
  name: "Hana Al-Saud",
  email: "h.alsaud@physio.edu.sa",
  resolved: 156,
  csat: 94,
  avgFRT: "1.2h",
};

interface Ticket {
  id: string;
  subject: string;
  customer: string;
  email: string;
  category: string;
  priority: "high" | "medium" | "low";
  status: "new" | "inProgress" | "waiting" | "resolved" | "closed";
  assignee: string | null;
  date: string;
}

const AllTicketsContent = () => {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const profile = { ...mockProfile, name: t("names.hanaAlSaud") };

  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  const stats = [
    {
      label: t("allTicketsPage.stats.totalTickets"),
      value: "384",
      icon: FileText,
      iconBg: "bg-[#EFF6FF]",
      iconColor: "text-[#3B82F6]",
    },
    {
      label: t("allTicketsPage.stats.open"),
      value: "23",
      icon: ClipboardList,
      iconBg: "bg-[#FFEDD5]",
      iconColor: "text-[#F97316]",
    },
    {
      label: t("allTicketsPage.stats.resolvedThisWeek"),
      value: "45",
      icon: CheckCircle,
      iconBg: "bg-[#DCFCE7]",
      iconColor: "text-[#22C55E]",
    },
    {
      label: t("allTicketsPage.stats.avgResolution"),
      value: "4.5h",
      icon: Clock,
      iconBg: "bg-[#F3E8FF]",
      iconColor: "text-[#8B5CF6]",
    },
  ];

  const tickets: Ticket[] = [
    {
      id: "1234",
      subject: t("ticketsBoard.subjects.cannotAccessCourse"),
      customer: t("names.ahmedK"),
      email: "ahmed.k@email.com",
      category: "login",
      priority: "high",
      status: "new",
      assignee: t("names.hanaAlSaud"),
      date: t("mockDates.feb10_2026"),
    },
    {
      id: "1233",
      subject: t("ticketsBoard.subjects.certificateNotReceived"),
      customer: t("names.saraM"),
      email: "sara.m@email.com",
      category: "certificate",
      priority: "medium",
      status: "inProgress",
      assignee: t("names.mohammedAli"),
      date: t("mockDates.feb10_2026"),
    },
    {
      id: "1232",
      subject: t("ticketsBoard.subjects.paymentFailedTwice"),
      customer: t("names.omarA"),
      email: "omar.a@email.com",
      category: "billing",
      priority: "high",
      status: "inProgress",
      assignee: t("names.hanaAlSaud"),
      date: t("mockDates.feb9_2026"),
    },
    {
      id: "1231",
      subject: t("ticketsBoard.subjects.videoNotPlaying"),
      customer: t("names.fatimaN"),
      email: "fatima.n@email.com",
      category: "content",
      priority: "low",
      status: "resolved",
      assignee: t("names.laylaAhmed"),
      date: t("mockDates.feb9_2026"),
    },
    {
      id: "1230",
      subject: t("ticketsBoard.subjects.refundRequest"),
      customer: t("names.khalidH"),
      email: "khalid.h@email.com",
      category: "billing",
      priority: "medium",
      status: "new",
      assignee: null,
      date: t("mockDates.feb8_2026"),
    },
    {
      id: "1229",
      subject: t("ticketsBoard.subjects.loginIssue"),
      customer: t("names.nouraS"),
      email: "noura.s@email.com",
      category: "technical",
      priority: "low",
      status: "waiting",
      assignee: t("names.mohammedAli"),
      date: t("mockDates.feb8_2026"),
    },
    {
      id: "1228",
      subject: t("ticketsBoard.subjects.cannotAccessCourse"),
      customer: t("names.ahmedK"),
      email: "ahmed.k@email.com",
      category: "login",
      priority: "medium",
      status: "closed",
      assignee: t("names.laylaAhmed"),
      date: t("mockDates.feb7_2026"),
    },
    {
      id: "1227",
      subject: t("ticketsBoard.subjects.certificateNotReceived"),
      customer: t("names.saraM"),
      email: "sara.m@email.com",
      category: "certificate",
      priority: "high",
      status: "new",
      assignee: null,
      date: t("mockDates.feb7_2026"),
    },
  ];

  const tabs = [
    { key: "all", label: t("allTicketsPage.tabs.all"), count: tickets.length },
    { key: "new", label: t("allTicketsPage.tabs.new"), count: 8 },
    { key: "inProgress", label: t("allTicketsPage.tabs.inProgress"), count: 7 },
    { key: "waiting", label: t("allTicketsPage.tabs.waiting"), count: 3 },
    { key: "resolved", label: t("allTicketsPage.tabs.resolved"), count: 45 },
    { key: "closed", label: t("allTicketsPage.tabs.closed"), count: 321 },
  ];

  const priorityStyles: Record<string, string> = {
    high: "bg-[#FEE2E2] text-[#EF4444]",
    medium: "bg-[#FFEDD5] text-[#F97316]",
    low: "bg-[#DCFCE7] text-[#22C55E]",
  };

  const statusStyles: Record<string, string> = {
    new: "bg-[#EFF6FF] text-[#3B82F6]",
    inProgress: "bg-[#FEF9C3] text-[#EAB308]",
    waiting: "bg-[#FFEDD5] text-[#F97316]",
    resolved: "bg-[#DCFCE7] text-[#22C55E]",
    closed: "bg-[#F3F4F6] text-[#6B7280]",
  };

  const filteredTickets = tickets.filter((ticket) => {
    const matchesTab = activeTab === "all" || ticket.status === activeTab;
    const matchesStatus =
      statusFilter === "all" || ticket.status === statusFilter;
    const matchesPriority =
      priorityFilter === "all" || ticket.priority === priorityFilter;
    const matchesCategory =
      categoryFilter === "all" || ticket.category === categoryFilter;
    const matchesSearch =
      searchQuery === "" ||
      ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.id.includes(searchQuery);
    return (
      matchesTab &&
      matchesStatus &&
      matchesPriority &&
      matchesCategory &&
      matchesSearch
    );
  });

  return (
    <>
      <SupportNavbar profile={profile} />

      <div className="bg-[#F9FAFB] min-h-screen">
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
                      className="bg-white rounded-xl border border-[#E5E7EB] p-4 flex items-start gap-3"
                    >
                      <div
                        className={`w-10 h-10 ${stat.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}
                      >
                        <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                      </div>
                      <div>
                        <p className="text-xs text-[#6B7280] font-medium">
                          {stat.label}
                        </p>
                        <p className="text-xl font-bold text-[#111827]">
                          {stat.value}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tickets Table */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
                {/* Tabs */}
                <div className="px-5 py-4 border-b border-[#F3F4F6]">
                  <div className="flex gap-1 bg-[#F3F4F6] rounded-lg p-0.5 w-fit overflow-x-auto">
                    {tabs.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-1.5 text-[13px] font-medium rounded-md transition-colors flex items-center gap-2 whitespace-nowrap ${
                          activeTab === tab.key
                            ? "bg-white text-[#111827] shadow-sm"
                            : "text-[#6B7280] hover:text-[#374151]"
                        }`}
                      >
                        {tab.label}
                        <span
                          className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                            activeTab === tab.key
                              ? "bg-[#a37f49] text-white"
                              : "bg-[#E5E7EB] text-[#6B7280]"
                          }`}
                        >
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filters Row */}
                <div className="px-5 py-3 border-b border-[#F3F4F6]">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    {/* Category Filter */}
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="px-3 py-2 border border-[#E5E7EB] rounded-lg text-[13px] text-[#374151] focus:outline-none focus:border-[#a37f49] bg-white"
                    >
                      <option value="all">
                        {t("allTicketsPage.filters.allCategories")}
                      </option>
                      <option value="login">
                        {t("allTicketsPage.filters.categories.login")}
                      </option>
                      <option value="certificate">
                        {t("allTicketsPage.filters.categories.certificate")}
                      </option>
                      <option value="billing">
                        {t("allTicketsPage.filters.categories.billing")}
                      </option>
                      <option value="content">
                        {t("allTicketsPage.filters.categories.content")}
                      </option>
                      <option value="technical">
                        {t("allTicketsPage.filters.categories.technical")}
                      </option>
                    </select>

                    {/* Priority Filter */}
                    <select
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value)}
                      className="px-3 py-2 border border-[#E5E7EB] rounded-lg text-[13px] text-[#374151] focus:outline-none focus:border-[#a37f49] bg-white"
                    >
                      <option value="all">
                        {t("allTicketsPage.filters.allPriorities")}
                      </option>
                      <option value="high">
                        {t("allTicketsPage.filters.priorities.high")}
                      </option>
                      <option value="medium">
                        {t("allTicketsPage.filters.priorities.medium")}
                      </option>
                      <option value="low">
                        {t("allTicketsPage.filters.priorities.low")}
                      </option>
                    </select>

                    {/* Search Input */}
                    <div className="relative flex-1 w-full sm:w-auto">
                      <Search
                        className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] ${isRTL ? "right-3" : "left-3"}`}
                      />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t("allTicketsPage.searchPlaceholder")}
                        className={`w-full py-2 border border-[#E5E7EB] rounded-lg text-[13px] focus:outline-none focus:border-[#a37f49] ${isRTL ? "pr-9 pl-3" : "pl-9 pr-3"}`}
                      />
                    </div>

                    {/* New Ticket Button */}
                    <button className="flex items-center gap-1.5 px-4 py-2 btn-gold text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap">
                      <Plus className="w-4 h-4" />
                      {t("allTicketsPage.newTicket")}
                    </button>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#E5E7EB]">
                        <th
                          className={`py-3 px-4 text-[11px] font-semibold text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}
                        >
                          {t("allTicketsPage.columns.ticketId")}
                        </th>
                        <th
                          className={`py-3 px-4 text-[11px] font-semibold text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}
                        >
                          {t("allTicketsPage.columns.subject")}
                        </th>
                        <th
                          className={`py-3 px-4 text-[11px] font-semibold text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}
                        >
                          {t("allTicketsPage.columns.customer")}
                        </th>
                        <th
                          className={`py-3 px-4 text-[11px] font-semibold text-[#6B7280] uppercase hidden md:table-cell ${isRTL ? "text-right" : "text-left"}`}
                        >
                          {t("allTicketsPage.columns.category")}
                        </th>
                        <th
                          className={`py-3 px-4 text-[11px] font-semibold text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}
                        >
                          {t("allTicketsPage.columns.priority")}
                        </th>
                        <th
                          className={`py-3 px-4 text-[11px] font-semibold text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}
                        >
                          {t("allTicketsPage.columns.status")}
                        </th>
                        <th
                          className={`py-3 px-4 text-[11px] font-semibold text-[#6B7280] uppercase hidden lg:table-cell ${isRTL ? "text-right" : "text-left"}`}
                        >
                          {t("allTicketsPage.columns.assignedTo")}
                        </th>
                        <th
                          className={`py-3 px-4 text-[11px] font-semibold text-[#6B7280] uppercase hidden md:table-cell ${isRTL ? "text-right" : "text-left"}`}
                        >
                          {t("allTicketsPage.columns.date")}
                        </th>
                        <th className="py-3 px-4 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTickets.map((ticket) => (
                        <tr
                          key={ticket.id}
                          className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors"
                        >
                          {/* Ticket # */}
                          <td className="py-3 px-4">
                            <span className="text-[13px] font-medium text-[#3B82F6] cursor-pointer hover:underline">
                              #{ticket.id}
                            </span>
                          </td>
                          {/* Subject */}
                          <td className="py-3 px-4">
                            <span className="text-[13px] font-medium text-[#111827]">
                              {ticket.subject}
                            </span>
                          </td>
                          {/* Customer */}
                          <td className="py-3 px-4">
                            <div>
                              <p className="text-[13px] text-[#374151] font-medium">
                                {ticket.customer}
                              </p>
                              <p className="text-[11px] text-[#9CA3AF]">
                                {ticket.email}
                              </p>
                            </div>
                          </td>
                          {/* Category */}
                          <td className="py-3 px-4 hidden md:table-cell">
                            <span className="bg-[#F3F4F6] text-[#4B5563] text-[10px] px-2 py-0.5 rounded-md font-medium">
                              {t(
                                `allTicketsPage.filters.categories.${ticket.category}`
                              )}
                            </span>
                          </td>
                          {/* Priority */}
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${priorityStyles[ticket.priority]}`}
                            >
                              {t(
                                `allTicketsPage.filters.priorities.${ticket.priority}`
                              )}
                            </span>
                          </td>
                          {/* Status */}
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${statusStyles[ticket.status]}`}
                            >
                              {t(
                                `allTicketsPage.statuses.${ticket.status}`
                              )}
                            </span>
                          </td>
                          {/* Assigned To */}
                          <td className="py-3 px-4 hidden lg:table-cell">
                            <span className="text-[13px] text-[#4B5563]">
                              {ticket.assignee || "--"}
                            </span>
                          </td>
                          {/* Date */}
                          <td className="py-3 px-4 hidden md:table-cell">
                            <span className="text-[13px] text-[#6B7280]">
                              {ticket.date}
                            </span>
                          </td>
                          {/* Actions */}
                          <td className="py-3 px-4">
                            <div className="relative">
                              <button
                                onClick={() =>
                                  setOpenActionId(
                                    openActionId === ticket.id
                                      ? null
                                      : ticket.id
                                  )
                                }
                                className="w-7 h-7 flex items-center justify-center border border-[#E5E7EB] rounded-md hover:bg-[#F9FAFB] text-[#6B7280]"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                              {openActionId === ticket.id && (
                                <div
                                  className={`absolute top-full mt-1 bg-white rounded-lg shadow-lg border border-[#E5E7EB] py-1 min-w-[160px] z-20 ${isRTL ? "left-0" : "right-0"}`}
                                >
                                  <button className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-[#374151] hover:bg-[#F9FAFB]">
                                    <Eye className="w-3.5 h-3.5" />
                                    {t("allTicketsPage.actions.view")}
                                  </button>
                                  <button className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-[#374151] hover:bg-[#F9FAFB]">
                                    <UserPlus className="w-3.5 h-3.5" />
                                    {t("allTicketsPage.actions.assign")}
                                  </button>
                                  <button className="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-[#DC2626] hover:bg-[#FEE2E2]">
                                    <XCircle className="w-3.5 h-3.5" />
                                    {t("allTicketsPage.actions.close")}
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3 border-t border-[#F3F4F6] gap-3">
                  <p className="text-[13px] text-[#6B7280]">
                    {t("allTicketsPage.pagination.showing", {
                      from: 1,
                      to: filteredTickets.length,
                      total: 384,
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    <button className="flex items-center gap-1 px-3 py-1.5 text-[13px] text-[#6B7280] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB]">
                      <ChevronLeft className="w-4 h-4" />
                      {t("allTicketsPage.pagination.previous")}
                    </button>
                    <button className="flex items-center gap-1 px-3 py-1.5 text-[13px] text-[#6B7280] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB]">
                      {t("allTicketsPage.pagination.next")}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AllTicketsContent;
