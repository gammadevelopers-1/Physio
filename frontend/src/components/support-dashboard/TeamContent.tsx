"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import SupportNavbar from "./SupportNavbar";
import SupportSidebar from "./SupportSidebar";
import SupportMobileSidebar from "./SupportMobileSidebar";
import {
  Users,
  Wifi,
  Clock,
  Smile,
  Search,
  Plus,
  MessageSquare,
  BarChart3,
  MoreVertical,
  TrendingUp,
} from "lucide-react";

// Mock Support Profile
const mockProfile = {
  name: "Hana Al-Saud",
  email: "h.alsaud@physio.edu.sa",
  resolved: 156,
  csat: 94,
  avgFRT: "1.2h",
};

const TeamContent = () => {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const profile = { ...mockProfile, name: t("names.hanaAlSaud") };

  const agents = [
    {
      id: "1",
      name: t("names.hanaAlSaud"),
      initials: "HA",
      role: t("sidebar.supportLead"),
      status: "online",
      openTickets: 8,
      avgResponse: "1.0h",
      csat: 96,
      workload: 80,
    },
    {
      id: "2",
      name: t("names.mohammedAli"),
      initials: "MA",
      role: t("teamPage.roles.seniorAgent"),
      status: "online",
      openTickets: 6,
      avgResponse: "1.5h",
      csat: 92,
      workload: 60,
    },
    {
      id: "3",
      name: t("names.laylaAhmed"),
      initials: "LA",
      role: t("teamPage.roles.agent"),
      status: "away",
      openTickets: 5,
      avgResponse: "1.3h",
      csat: 94,
      workload: 50,
    },
    {
      id: "4",
      name: t("teamPage.agents.saraKhan"),
      initials: "SK",
      role: t("teamPage.roles.agent"),
      status: "online",
      openTickets: 4,
      avgResponse: "1.8h",
      csat: 91,
      workload: 40,
    },
    {
      id: "5",
      name: t("teamPage.agents.ahmedNasser"),
      initials: "AN",
      role: t("teamPage.roles.juniorAgent"),
      status: "online",
      openTickets: 3,
      avgResponse: "2.1h",
      csat: 88,
      workload: 30,
    },
    {
      id: "6",
      name: t("teamPage.agents.fatimaOmar"),
      initials: "FO",
      role: t("teamPage.roles.juniorAgent"),
      status: "offline",
      openTickets: 0,
      avgResponse: "2.0h",
      csat: 90,
      workload: 0,
    },
  ];

  const stats = [
    {
      label: t("teamPage.stats.totalAgents"),
      value: "6",
      icon: Users,
      bgColor: "bg-[var(--color-border-subtle)]",
      textColor: "text-[var(--color-primary)]",
    },
    {
      label: t("teamPage.stats.online"),
      value: "4",
      icon: Wifi,
      bgColor: "bg-[#DCFCE7]",
      textColor: "text-[#16A34A]",
    },
    {
      label: t("teamPage.stats.avgResponse"),
      value: "1.3h",
      icon: Clock,
      bgColor: "bg-[#FFEDD5]",
      textColor: "text-[#EA580C]",
    },
    {
      label: t("teamPage.stats.teamCSAT"),
      value: "94%",
      icon: Smile,
      bgColor: "bg-[#EDE9FE]",
      textColor: "text-[#8B5CF6]",
    },
  ];

  const tabs = [
    { key: "all", label: t("teamPage.tabs.all") },
    { key: "online", label: t("teamPage.tabs.online"), count: 4 },
    { key: "away", label: t("teamPage.tabs.away"), count: 1 },
    { key: "offline", label: t("teamPage.tabs.offline"), count: 1 },
  ];

  const filteredAgents = agents.filter((agent) => {
    const matchesTab = activeTab === "all" || agent.status === activeTab;
    const matchesSearch =
      searchQuery === "" ||
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.role.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-[#22C55E]";
      case "away":
        return "bg-[#EAB308]";
      case "offline":
        return "bg-[var(--color-text-secondary)]";
      default:
        return "bg-[var(--color-text-secondary)]";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "online":
        return t("teamPage.status.online");
      case "away":
        return t("teamPage.status.away");
      case "offline":
        return t("teamPage.status.offline");
      default:
        return status;
    }
  };

  const getWorkloadColor = (workload: number) => {
    if (workload > 90) return "bg-[#EF4444]";
    if (workload > 70) return "bg-[#EA580C]";
    return "bg-[#16A34A]";
  };

  return (
    <>
      {/* Dashboard Navbar */}
      <SupportNavbar profile={profile} />

      {/* Main Container */}
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
              {/* Page Title */}
              <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--on-surface-default)]">
                  {t("teamPage.title")}
                </h1>
                <p className="text-sm text-[var(--on-surface-variant)] mt-1">
                  {t("teamPage.subtitle")}
                </p>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {stats.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div
                      key={stat.label}
                      className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div
                          className={`w-10 h-10 ${stat.bgColor} rounded-lg flex items-center justify-center`}
                        >
                          <Icon className={`w-5 h-5 ${stat.textColor}`} />
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-[var(--color-text-secondary)]">
                        {stat.value}
                      </p>
                      <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                        {stat.label}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Header with Search and Add Button */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                {/* Search */}
                <div className="relative w-full sm:w-auto">
                  <Search
                    className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "right-3" : "left-3"} w-4 h-4 text-[var(--color-text-secondary)]`}
                  />
                  <input
                    type="text"
                    placeholder={t("teamPage.searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full sm:w-[280px] h-10 ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent`}
                  />
                </div>

                {/* Add Agent Button */}
                <button className="btn-gold text-[var(--color-button-text)] h-10 px-4 rounded-lg text-sm font-medium flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  {t("teamPage.addAgent")}
                </button>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-2 mb-6 overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                      activeTab === tab.key
                        ? "bg-[var(--color-text-primary)] text-white"
                        : "bg-[var(--color-surface-card)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-border-subtle)]"
                    }`}
                  >
                    {tab.label}
                    {tab.count !== undefined && (
                      <span
                        className={`${isRTL ? "mr-1.5" : "ml-1.5"} ${activeTab === tab.key ? "text-white/70" : "text-[var(--color-text-secondary)]"}`}
                      >
                        ({tab.count})
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Agent Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {filteredAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5"
                  >
                    {/* Agent Header */}
                    <div className="flex items-start gap-3 mb-4">
                      {/* Avatar with Status Dot */}
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] flex items-center justify-center">
                          <span className="text-sm font-bold text-white">
                            {agent.initials}
                          </span>
                        </div>
                        <div
                          className={`absolute -bottom-0.5 ${isRTL ? "-left-0.5" : "-right-0.5"} w-3.5 h-3.5 ${getStatusColor(agent.status)} rounded-full border-2 border-white`}
                        />
                      </div>

                      {/* Name and Role */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                          {agent.name}
                        </h3>
                        <p className="text-xs text-[var(--color-text-secondary)]">{agent.role}</p>
                        <span className="inline-flex items-center gap-1 mt-1 text-xs text-[var(--color-text-secondary)]">
                          <span
                            className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)}`}
                          />
                          {getStatusLabel(agent.status)}
                        </span>
                      </div>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-2 mb-4 py-3 border-t border-b border-[var(--color-border)]">
                      <div className="text-center">
                        <p className="text-lg font-bold text-[var(--color-text-secondary)]">
                          {agent.openTickets}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-secondary)]">
                          {t("teamPage.agentCard.openTickets")}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-[var(--color-text-secondary)]">
                          {agent.avgResponse}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-secondary)]">
                          {t("teamPage.agentCard.avgResponse")}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-[var(--color-text-secondary)]">
                          {agent.csat}%
                        </p>
                        <p className="text-[11px] text-[var(--color-text-secondary)]">
                          {t("teamPage.agentCard.csat")}
                        </p>
                      </div>
                    </div>

                    {/* Workload Bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          {t("teamPage.agentCard.workload")}
                        </span>
                        <span className="text-xs font-medium text-[var(--color-text-primary)]">
                          {agent.workload}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-[var(--color-border)] rounded-full">
                        <div
                          className={`h-1.5 ${getWorkloadColor(agent.workload)} rounded-full transition-all`}
                          style={{ width: `${agent.workload}%` }}
                        />
                      </div>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        className="flex-1 h-9 flex items-center justify-center gap-1.5 border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors"
                        title={t("teamPage.actions.message")}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="flex-1 h-9 flex items-center justify-center gap-1.5 border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors"
                        title={t("teamPage.actions.stats")}
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="flex-1 h-9 flex items-center justify-center gap-1.5 border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors"
                        title={t("teamPage.actions.more")}
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Performance Overview Section */}
              <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
                <div className="flex items-center gap-2 mb-5">
                  <TrendingUp className="w-5 h-5 text-[var(--color-primary)]" />
                  <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    {t("teamPage.performance")}
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Best Response Time */}
                  <div className="bg-[var(--color-surface-page)] rounded-xl p-4">
                    <p className="text-sm text-[var(--color-text-secondary)] mb-1">
                      {t("teamPage.performanceCards.bestResponseTime")}
                    </p>
                    <p className="text-2xl font-bold text-[var(--color-text-secondary)]">1.0h</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      {t("names.hanaAlSaud")}
                    </p>
                  </div>

                  {/* Highest CSAT */}
                  <div className="bg-[var(--color-surface-page)] rounded-xl p-4">
                    <p className="text-sm text-[var(--color-text-secondary)] mb-1">
                      {t("teamPage.performanceCards.highestCSAT")}
                    </p>
                    <p className="text-2xl font-bold text-[var(--color-text-secondary)]">96%</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      {t("names.hanaAlSaud")}
                    </p>
                  </div>

                  {/* Most Resolved */}
                  <div className="bg-[var(--color-surface-page)] rounded-xl p-4">
                    <p className="text-sm text-[var(--color-text-secondary)] mb-1">
                      {t("teamPage.performanceCards.mostResolved")}
                    </p>
                    <p className="text-2xl font-bold text-[var(--color-text-secondary)]">45</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      {t("names.mohammedAli")}
                    </p>
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

export default TeamContent;
