"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { supportApi } from "@/lib/api";
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
  Loader2,
} from "lucide-react";

const TeamContent = () => {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const profile = {
    name: user ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email : "",
    email: user?.email || "",
    resolved: 0,
    csat: 0,
    avgFRT: "--",
  };

  const [apiAgents, setApiAgents] = useState<any[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);

  useEffect(() => {
    async function fetchAgents() {
      try {
        const data = await supportApi.getAgents();
        setApiAgents(data || []);
      } catch {
        setApiAgents([]);
      } finally {
        setIsLoadingAgents(false);
      }
    }
    fetchAgents();
  }, []);

  const agents = apiAgents.map((a: any) => {
    const name = [a.firstName, a.lastName].filter(Boolean).join(" ") || a.email;
    const initials = name
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
    return {
      id: a.userId,
      name,
      initials,
      role: a.supportSubRole === "supervisor" ? "Supervisor" : "Agent",
      status: "online",
      openTickets: 0,
      avgResponse: "--",
      csat: 0,
      workload: 0,
    };
  });

  const stats = [
    {
      label: t("teamPage.stats.totalAgents"),
      value: String(agents.length),
      icon: Users,
      bgColor: "bg-[#EFF6FF]",
      textColor: "text-[#3B82F6]",
    },
    {
      label: t("teamPage.stats.online"),
      value: String(agents.length),
      icon: Wifi,
      bgColor: "bg-[#DCFCE7]",
      textColor: "text-[#16A34A]",
    },
    {
      label: t("teamPage.stats.avgResponse"),
      value: "--",
      icon: Clock,
      bgColor: "bg-[#FFEDD5]",
      textColor: "text-[#EA580C]",
    },
    {
      label: t("teamPage.stats.teamCSAT"),
      value: "--",
      icon: Smile,
      bgColor: "bg-[#EDE9FE]",
      textColor: "text-[#8B5CF6]",
    },
  ];

  const tabs = [
    { key: "all", label: t("teamPage.tabs.all") },
    { key: "online", label: t("teamPage.tabs.online"), count: agents.length },
    { key: "away", label: t("teamPage.tabs.away"), count: 0 },
    { key: "offline", label: t("teamPage.tabs.offline"), count: 0 },
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
        return "bg-[#9CA3AF]";
      default:
        return "bg-[#9CA3AF]";
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
      <div className="bg-[#F9FAFB] min-h-screen">
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
                      className="bg-white rounded-xl border border-[#E5E7EB] p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div
                          className={`w-10 h-10 ${stat.bgColor} rounded-lg flex items-center justify-center`}
                        >
                          <Icon className={`w-5 h-5 ${stat.textColor}`} />
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-[#111827]">
                        {stat.value}
                      </p>
                      <p className="text-sm text-[#6B7280] mt-1">
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
                    className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? "right-3" : "left-3"} w-4 h-4 text-[#9CA3AF]`}
                  />
                  <input
                    type="text"
                    placeholder={t("teamPage.searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full sm:w-[280px] h-10 ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} border border-[#E5E7EB] rounded-lg text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent`}
                  />
                </div>

                {/* Add Agent Button */}
                <button className="btn-gold text-white h-10 px-4 rounded-lg text-sm font-medium flex items-center gap-2">
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
                        ? "bg-[#111827] text-white"
                        : "bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB]"
                    }`}
                  >
                    {tab.label}
                    {tab.count !== undefined && (
                      <span
                        className={`${isRTL ? "mr-1.5" : "ml-1.5"} ${activeTab === tab.key ? "text-white/70" : "text-[#9CA3AF]"}`}
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
                    className="bg-white rounded-xl border border-[#E5E7EB] p-5"
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
                        <h3 className="text-sm font-semibold text-[#111827] truncate">
                          {agent.name}
                        </h3>
                        <p className="text-xs text-[#6B7280]">{agent.role}</p>
                        <span className="inline-flex items-center gap-1 mt-1 text-xs text-[#6B7280]">
                          <span
                            className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)}`}
                          />
                          {getStatusLabel(agent.status)}
                        </span>
                      </div>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-2 mb-4 py-3 border-t border-b border-[#E5E7EB]">
                      <div className="text-center">
                        <p className="text-lg font-bold text-[#111827]">
                          {agent.openTickets}
                        </p>
                        <p className="text-[11px] text-[#6B7280]">
                          {t("teamPage.agentCard.openTickets")}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-[#111827]">
                          {agent.avgResponse}
                        </p>
                        <p className="text-[11px] text-[#6B7280]">
                          {t("teamPage.agentCard.avgResponse")}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-[#111827]">
                          {agent.csat}%
                        </p>
                        <p className="text-[11px] text-[#6B7280]">
                          {t("teamPage.agentCard.csat")}
                        </p>
                      </div>
                    </div>

                    {/* Workload Bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-[#6B7280]">
                          {t("teamPage.agentCard.workload")}
                        </span>
                        <span className="text-xs font-medium text-[#111827]">
                          {agent.workload}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-[#E5E7EB] rounded-full">
                        <div
                          className={`h-1.5 ${getWorkloadColor(agent.workload)} rounded-full transition-all`}
                          style={{ width: `${agent.workload}%` }}
                        />
                      </div>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        className="flex-1 h-9 flex items-center justify-center gap-1.5 border border-[#E5E7EB] rounded-lg text-xs text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
                        title={t("teamPage.actions.message")}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="flex-1 h-9 flex items-center justify-center gap-1.5 border border-[#E5E7EB] rounded-lg text-xs text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
                        title={t("teamPage.actions.stats")}
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        className="flex-1 h-9 flex items-center justify-center gap-1.5 border border-[#E5E7EB] rounded-lg text-xs text-[#6B7280] hover:bg-[#F9FAFB] transition-colors"
                        title={t("teamPage.actions.more")}
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Performance Overview Section */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
                <div className="flex items-center gap-2 mb-5">
                  <TrendingUp className="w-5 h-5 text-[#3B82F6]" />
                  <h2 className="text-lg font-semibold text-[#111827]">
                    {t("teamPage.performance")}
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Best Response Time */}
                  <div className="bg-[#F9FAFB] rounded-xl p-4">
                    <p className="text-sm text-[#6B7280] mb-1">
                      {t("teamPage.performanceCards.bestResponseTime")}
                    </p>
                    <p className="text-2xl font-bold text-[#111827]">--</p>
                    <p className="text-xs text-[#6B7280] mt-1">
                      No data yet
                    </p>
                  </div>

                  {/* Highest CSAT */}
                  <div className="bg-[#F9FAFB] rounded-xl p-4">
                    <p className="text-sm text-[#6B7280] mb-1">
                      {t("teamPage.performanceCards.highestCSAT")}
                    </p>
                    <p className="text-2xl font-bold text-[#111827]">--</p>
                    <p className="text-xs text-[#6B7280] mt-1">
                      No data yet
                    </p>
                  </div>

                  {/* Most Resolved */}
                  <div className="bg-[#F9FAFB] rounded-xl p-4">
                    <p className="text-sm text-[#6B7280] mb-1">
                      {t("teamPage.performanceCards.mostResolved")}
                    </p>
                    <p className="text-2xl font-bold text-[#111827]">--</p>
                    <p className="text-xs text-[#6B7280] mt-1">
                      No data yet
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
