"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { supportApi } from "@/lib/api";
import SupportNavbar from "./SupportNavbar";
import SupportSidebar from "./SupportSidebar";
import SupportMobileSidebar from "./SupportMobileSidebar";
import {
  Inbox,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

const AgentDashboardContent = () => {
  const t = useTranslations("supportDashboard");
  const locale = useLocale();
  const { user } = useAuth();

  const [myTickets, setMyTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const profile = {
    name: user
      ? [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        user.email
      : "",
    email: user?.email || "",
    resolved: 0,
    csat: 0,
    avgFRT: "--",
  };

  const fetchMyTickets = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const data = await supportApi.getTickets({
        assigneeId: user.id,
        limit: 20,
      });
      setMyTickets(data.tickets || []);
    } catch {
      setMyTickets([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchMyTickets();
  }, [fetchMyTickets]);

  const assignedCount = myTickets.filter(
    (t) => t.status === "new" || t.status === "in_progress" || t.status === "on_hold",
  ).length;
  const inProgressCount = myTickets.filter(
    (t) => t.status === "in_progress",
  ).length;
  const resolvedCount = myTickets.filter(
    (t) => t.status === "resolved",
  ).length;

  const stats = [
    {
      label: "Assigned",
      value: assignedCount,
      icon: Inbox,
      iconBg: "bg-[#EFF6FF]",
      iconColor: "text-[#3B82F6]",
    },
    {
      label: "In Progress",
      value: inProgressCount,
      icon: Clock,
      iconBg: "bg-[#FEF9C3]",
      iconColor: "text-[#EAB308]",
    },
    {
      label: "Resolved",
      value: resolvedCount,
      icon: CheckCircle2,
      iconBg: "bg-[#DCFCE7]",
      iconColor: "text-[#22C55E]",
    },
  ];

  const priorityStyles: Record<string, string> = {
    high: "bg-[#FEE2E2] text-[#EF4444]",
    medium: "bg-[#FFEDD5] text-[#F97316]",
    low: "bg-[#DCFCE7] text-[#22C55E]",
  };

  const statusStyles: Record<string, string> = {
    new: "bg-[#DBEAFE] text-[#2563EB]",
    in_progress: "bg-[#FEF9C3] text-[#CA8A04]",
    on_hold: "bg-[#FFEDD5] text-[#EA580C]",
    resolved: "bg-[#DCFCE7] text-[#16A34A]",
    closed: "bg-[#F3F4F6] text-[#6B7280]",
  };

  return (
    <>
      <SupportNavbar profile={profile} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="hidden lg:block lg:flex-shrink-0">
              <SupportSidebar profile={profile} supportSubRole="agent" />
            </div>
            <SupportMobileSidebar profile={profile} supportSubRole="agent" />

            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937]">
                  My Dashboard
                </h1>
                <p className="text-sm text-[#6B7280] mt-1">
                  Welcome back, {profile.name.split(" ")[0] || "Agent"}! Here are your assigned tickets.
                </p>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {stats.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div
                      key={stat.label}
                      className="bg-white rounded-2xl border border-[#E5E7EB] p-5 flex items-center gap-4"
                    >
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.iconBg}`}
                      >
                        <Icon className={`w-6 h-6 ${stat.iconColor}`} />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-[#1F2937]">
                          {stat.value}
                        </p>
                        <p className="text-sm text-[#6B7280]">{stat.label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* My Tickets Table */}
              <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
                <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
                  <h2 className="text-base font-semibold text-[#1F2937]">
                    My Assigned Tickets
                  </h2>
                  <a
                    href={`/${locale}/dashboard/support/agent/my-tickets`}
                    className="text-sm text-[#002D87] hover:underline"
                  >
                    View All →
                  </a>
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-[#002D87]" />
                  </div>
                ) : myTickets.length === 0 ? (
                  <div className="text-center py-12 text-[#6B7280]">
                    <Inbox className="w-10 h-10 mx-auto mb-3 text-[#D1D5DB]" />
                    <p className="text-sm">No tickets assigned to you yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#E5E7EB]">
                          <th className="px-6 py-3 text-left text-xs font-medium text-[#6B7280] uppercase">
                            ID
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-[#6B7280] uppercase">
                            Subject
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-[#6B7280] uppercase">
                            Student
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-[#6B7280] uppercase">
                            Priority
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-[#6B7280] uppercase">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {myTickets
                          .filter((t) => t.status !== "closed")
                          .slice(0, 10)
                          .map((ticket) => (
                            <tr
                              key={ticket.id}
                              className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB] cursor-pointer"
                              onClick={() =>
                                window.location.assign(
                                  `/${locale}/dashboard/support/agent/tickets/${ticket.id}`,
                                )
                              }
                            >
                              <td className="px-6 py-3 text-sm text-[#002D87] font-medium">
                                #{ticket.id?.substring(0, 8)}
                              </td>
                              <td className="px-6 py-3 text-sm text-[#1F2937] max-w-[200px] truncate">
                                {ticket.subject}
                              </td>
                              <td className="px-6 py-3 text-sm text-[#6B7280]">
                                {[ticket.studentFirstName, ticket.studentLastName]
                                  .filter(Boolean)
                                  .join(" ") || "—"}
                              </td>
                              <td className="px-6 py-3">
                                <span
                                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                    priorityStyles[ticket.priority] || ""
                                  }`}
                                >
                                  {ticket.priority}
                                </span>
                              </td>
                              <td className="px-6 py-3">
                                <span
                                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                    statusStyles[ticket.status] || ""
                                  }`}
                                >
                                  {ticket.status?.replace("_", " ")}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
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

export default AgentDashboardContent;
