"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import AdminSidebar from "./AdminSidebar";
import AdminMobileSidebar from "./AdminMobileSidebar";
import AdminNavbar from "./AdminNavbar";
import {
  Search,
  Plus,
  Filter,
  Download,
  MoreVertical,
  Eye,
  Edit,
  UserX,
  Trash2,
  RefreshCw,
  UserCog,
} from "lucide-react";

// Mock Admin Profile
const mockAdmin = {
  name: "Abdullah Al-Rashid",
  email: "admin@physio.edu.sa",
  totalUsers: 1245,
  totalCourses: 12,
  uptime: 99.9,
};

// Mock Users Data - will be translated in component

const UsersContent = () => {
  const t = useTranslations("adminDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  // Mock Users Data with translations
  const mockUsers = [
    {
      id: "1",
      name: t("usersPage.sampleUsers.drFaisal"),
      email: "faisal.ahmed@physio.edu.sa",
      initials: "FA",
      role: "instructor",
      status: "active",
      lastLogin: t("usersPage.time.hoursAgo", { count: 2 }),
      created: "Jan 15, 2026",
    },
    {
      id: "2",
      name: t("usersPage.sampleUsers.saraMohammed"),
      email: "sara.m@student.physio.edu.sa",
      initials: "SM",
      role: "student",
      status: "active",
      lastLogin: t("usersPage.time.minAgo", { count: 5 }),
      created: "Feb 1, 2026",
    },
    {
      id: "3",
      name: t("usersPage.sampleUsers.mohammedAlKhalid"),
      email: "m.alkhalid@physio.edu.sa",
      initials: "MK",
      role: "manager",
      status: "active",
      lastLogin: t("usersPage.time.dayAgo", { count: 1 }),
      created: "Dec 10, 2025",
    },
    {
      id: "4",
      name: t("usersPage.sampleUsers.khalidHassan"),
      email: "k.hassan@student.physio.edu.sa",
      initials: "KH",
      role: "student",
      status: "pending",
      lastLogin: t("usersPage.time.never"),
      created: "Feb 8, 2026",
    },
    {
      id: "5",
      name: t("usersPage.sampleUsers.fatimaNoor"),
      email: "f.noor@physio.edu.sa",
      initials: "FN",
      role: "instructor",
      status: "suspended",
      lastLogin: t("usersPage.time.weekAgo", { count: 1 }),
      created: "Nov 20, 2025",
    },
    {
      id: "6",
      name: t("usersPage.sampleUsers.ahmedAlSaud"),
      email: "ahmed.saud@student.physio.edu.sa",
      initials: "AS",
      role: "student",
      status: "active",
      lastLogin: t("usersPage.time.hoursAgo", { count: 3 }),
      created: "Jan 28, 2026",
    },
  ];

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-[#1F2937] text-white";
      case "instructor":
        return "bg-[#DBEAFE] text-[#1D4ED8]";
      case "student":
        return "bg-[#DCFCE7] text-[#16A34A]";
      case "manager":
        return "bg-[#EDE9FE] text-[#7C3AED]";
      default:
        return "bg-[#F3F4F6] text-[#6B7280]";
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "active":
        return "bg-[#DCFCE7] text-[#16A34A]";
      case "suspended":
        return "bg-[#FEE2E2] text-[#DC2626]";
      case "pending":
        return "bg-[#FEF3C7] text-[#D97706]";
      case "inactive":
        return "bg-[#F3F4F6] text-[#6B7280]";
      default:
        return "bg-[#F3F4F6] text-[#6B7280]";
    }
  };

  const getAvatarBgColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-[#1F2937]";
      case "instructor":
        return "bg-[#3B82F6]";
      case "student":
        return "bg-[#22C55E]";
      case "manager":
        return "bg-[#8B5CF6]";
      default:
        return "bg-[#9CA3AF]";
    }
  };

  const filteredUsers = mockUsers.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesStatus = statusFilter === "all" || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const stats = {
    total: mockUsers.length,
    active: mockUsers.filter((u) => u.status === "active").length,
    pending: mockUsers.filter((u) => u.status === "pending").length,
    suspended: mockUsers.filter((u) => u.status === "suspended").length,
  };

  return (
    <>
      <AdminNavbar admin={mockAdmin} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <AdminSidebar admin={mockAdmin} />
            </div>

            <AdminMobileSidebar admin={mockAdmin} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937]">
                    {t("usersPage.title")}
                  </h1>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {t("usersPage.subtitle")}
                  </p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2.5 btn-gold text-white rounded-lg transition-colors">
                  <Plus className="w-5 h-5" />
                  <span className="text-sm font-medium">{t("usersPage.addUser")}</span>
                </button>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-2xl font-bold text-[#1F2937]">{stats.total}</p>
                  <p className="text-sm text-[#6B7280]">{t("usersPage.stats.total")}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-2xl font-bold text-[#16A34A]">{stats.active}</p>
                  <p className="text-sm text-[#6B7280]">{t("usersPage.stats.active")}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-2xl font-bold text-[#D97706]">{stats.pending}</p>
                  <p className="text-sm text-[#6B7280]">{t("usersPage.stats.pending")}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-2xl font-bold text-[#DC2626]">{stats.suspended}</p>
                  <p className="text-sm text-[#6B7280]">{t("usersPage.stats.suspended")}</p>
                </div>
              </div>

              {/* Filters and Search */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 mb-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Search */}
                  <div className="flex-1 relative">
                    <Search className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF] ${isRTL ? "right-3" : "left-3"}`} />
                    <input
                      type="text"
                      placeholder={t("usersPage.searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full h-10 border border-[#E5E7EB] rounded-lg text-sm ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} focus:outline-none focus:border-[#002D87]`}
                    />
                  </div>

                  {/* Role Filter */}
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="h-10 px-4 border border-[#E5E7EB] rounded-lg text-sm text-[#4B5563] focus:outline-none focus:border-[#002D87]"
                  >
                    <option value="all">{t("usersPage.filters.allRoles")}</option>
                    <option value="admin">{t("userManagement.roles.admin")}</option>
                    <option value="instructor">{t("userManagement.roles.instructor")}</option>
                    <option value="student">{t("userManagement.roles.student")}</option>
                    <option value="manager">{t("userManagement.roles.manager")}</option>
                  </select>

                  {/* Status Filter */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-10 px-4 border border-[#E5E7EB] rounded-lg text-sm text-[#4B5563] focus:outline-none focus:border-[#002D87]"
                  >
                    <option value="all">{t("usersPage.filters.allStatus")}</option>
                    <option value="active">{t("userManagement.statuses.active")}</option>
                    <option value="pending">{t("userManagement.statuses.pending")}</option>
                    <option value="suspended">{t("userManagement.statuses.suspended")}</option>
                  </select>

                  {/* Export Button */}
                  <button className="flex items-center gap-2 px-4 h-10 border border-[#E5E7EB] rounded-lg text-sm text-[#4B5563] hover:bg-[#F9FAFB] transition-colors">
                    <Download className="w-4 h-4" />
                    {t("usersPage.export")}
                  </button>
                </div>
              </div>

              {/* Users Table */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <tr>
                        <th className={`px-4 py-3 text-xs font-medium text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("usersPage.table.user")}
                        </th>
                        <th className={`px-4 py-3 text-xs font-medium text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("usersPage.table.role")}
                        </th>
                        <th className={`px-4 py-3 text-xs font-medium text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("usersPage.table.status")}
                        </th>
                        <th className={`px-4 py-3 text-xs font-medium text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("usersPage.table.lastLogin")}
                        </th>
                        <th className={`px-4 py-3 text-xs font-medium text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("usersPage.table.created")}
                        </th>
                        <th className={`px-4 py-3 text-xs font-medium text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("usersPage.table.actions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((user) => (
                        <tr key={user.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full ${getAvatarBgColor(user.role)} flex items-center justify-center`}>
                                <span className="text-sm font-medium text-white">{user.initials}</span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-[#1F2937]">{user.name}</p>
                                <p className="text-xs text-[#6B7280]">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getRoleBadgeStyle(user.role)}`}>
                              {t(`userManagement.roles.${user.role}`)}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusBadgeStyle(user.status)}`}>
                              {t(`userManagement.statuses.${user.status}`)}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-sm text-[#6B7280]">{user.lastLogin}</td>
                          <td className="px-4 py-4 text-sm text-[#6B7280]">{user.created}</td>
                          <td className="px-4 py-4">
                            <div className="relative">
                              <button
                                onClick={() => setOpenDropdownId(openDropdownId === user.id ? null : user.id)}
                                className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
                              >
                                <MoreVertical className="w-4 h-4 text-[#6B7280]" />
                              </button>

                              {openDropdownId === user.id && (
                                <div className={`absolute top-full mt-1 bg-white rounded-lg shadow-lg border border-[#E5E7EB] py-1 min-w-[160px] z-10 ${isRTL ? "left-0" : "right-0"}`}>
                                  <button className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#4B5563] hover:bg-[#F9FAFB]">
                                    <Eye className="w-4 h-4" />
                                    {t("usersPage.actions.view")}
                                  </button>
                                  <button className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#4B5563] hover:bg-[#F9FAFB]">
                                    <Edit className="w-4 h-4" />
                                    {t("usersPage.actions.edit")}
                                  </button>
                                  <button className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#4B5563] hover:bg-[#F9FAFB]">
                                    <RefreshCw className="w-4 h-4" />
                                    {t("usersPage.actions.resetPassword")}
                                  </button>
                                  <button className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#4B5563] hover:bg-[#F9FAFB]">
                                    <UserCog className="w-4 h-4" />
                                    {t("usersPage.actions.impersonate")}
                                  </button>
                                  <div className="border-t border-[#E5E7EB] my-1" />
                                  <button className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#D97706] hover:bg-[#FEF3C7]">
                                    <UserX className="w-4 h-4" />
                                    {t("usersPage.actions.suspend")}
                                  </button>
                                  <button className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#DC2626] hover:bg-[#FEE2E2]">
                                    <Trash2 className="w-4 h-4" />
                                    {t("usersPage.actions.delete")}
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

                {filteredUsers.length === 0 && (
                  <div className="py-12 text-center">
                    <p className="text-[#6B7280]">{t("usersPage.noUsers")}</p>
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

export default UsersContent;
