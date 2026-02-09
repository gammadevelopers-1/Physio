"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import AdminSidebar from "./AdminSidebar";
import AdminMobileSidebar from "./AdminMobileSidebar";
import AdminNavbar from "./AdminNavbar";
import {
  ClipboardList,
  Search,
  Download,
  Filter,
  User,
  Settings,
  BookOpen,
  DollarSign,
  Shield,
  FileText,
  LogIn,
  LogOut,
  Edit,
  Trash2,
  Plus,
  Eye,
} from "lucide-react";

// Mock Admin Profile
const mockAdmin = {
  name: "Abdullah Al-Rashid",
  email: "admin@physio.edu.sa",
  totalUsers: 1245,
  totalCourses: 12,
  uptime: 99.9,
};

// Mock Audit Logs
const mockLogs = [
  {
    id: "1",
    timestamp: "2026-02-09 14:32:15",
    user: "Abdullah Al-Rashid",
    action: "Login",
    resource: "Authentication",
    details: "Successful login via 2FA",
    ip: "192.168.1.1",
    type: "auth",
  },
  {
    id: "2",
    timestamp: "2026-02-09 14:28:45",
    user: "Mohammed Al-Khalid",
    action: "Update",
    resource: "User",
    details: "Updated role from Student to Instructor for user ID 245",
    ip: "192.168.1.78",
    type: "user",
  },
  {
    id: "3",
    timestamp: "2026-02-09 14:15:30",
    user: "Dr. Faisal Ahmed",
    action: "Create",
    resource: "Course",
    details: "Created new course: Advanced CPR Training",
    ip: "192.168.1.50",
    type: "course",
  },
  {
    id: "4",
    timestamp: "2026-02-09 13:55:12",
    user: "System",
    action: "Export",
    resource: "Report",
    details: "Automated daily backup completed",
    ip: "127.0.0.1",
    type: "system",
  },
  {
    id: "5",
    timestamp: "2026-02-09 13:42:08",
    user: "Sara Mohammed",
    action: "Delete",
    resource: "Content",
    details: "Deleted draft video from First Aid course",
    ip: "192.168.1.102",
    type: "content",
  },
  {
    id: "6",
    timestamp: "2026-02-09 13:30:00",
    user: "Payment Gateway",
    action: "Create",
    resource: "Payment",
    details: "Payment received: SAR 1,200 from Ahmed K.",
    ip: "External",
    type: "payment",
  },
  {
    id: "7",
    timestamp: "2026-02-09 13:15:22",
    user: "Abdullah Al-Rashid",
    action: "Update",
    resource: "Settings",
    details: "Updated platform notification settings",
    ip: "192.168.1.1",
    type: "settings",
  },
  {
    id: "8",
    timestamp: "2026-02-09 12:58:45",
    user: "Security System",
    action: "Block",
    resource: "Security",
    details: "Blocked IP 103.45.67.89 for suspicious activity",
    ip: "System",
    type: "security",
  },
];

const LogsContent = () => {
  const t = useTranslations("adminDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [resourceFilter, setResourceFilter] = useState("all");

  const getActionIcon = (type: string) => {
    switch (type) {
      case "auth":
        return <LogIn className="w-4 h-4 text-[#3B82F6]" />;
      case "user":
        return <User className="w-4 h-4 text-[#8B5CF6]" />;
      case "course":
        return <BookOpen className="w-4 h-4 text-[#16A34A]" />;
      case "content":
        return <FileText className="w-4 h-4 text-[#F59E0B]" />;
      case "payment":
        return <DollarSign className="w-4 h-4 text-[#D4A520]" />;
      case "settings":
        return <Settings className="w-4 h-4 text-[#6B7280]" />;
      case "security":
        return <Shield className="w-4 h-4 text-[#DC2626]" />;
      case "system":
        return <ClipboardList className="w-4 h-4 text-[#002D87]" />;
      default:
        return <ClipboardList className="w-4 h-4 text-[#6B7280]" />;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action.toLowerCase()) {
      case "create":
        return "bg-[#DCFCE7] text-[#16A34A]";
      case "update":
        return "bg-[#DBEAFE] text-[#1D4ED8]";
      case "delete":
        return "bg-[#FEE2E2] text-[#DC2626]";
      case "login":
        return "bg-[#F0F7FF] text-[#002D87]";
      case "logout":
        return "bg-[#F3F4F6] text-[#6B7280]";
      case "export":
        return "bg-[#EDE9FE] text-[#7C3AED]";
      case "block":
        return "bg-[#FEE2E2] text-[#DC2626]";
      default:
        return "bg-[#F3F4F6] text-[#6B7280]";
    }
  };

  const filteredLogs = mockLogs.filter((log) => {
    const matchesSearch =
      log.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resource.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAction =
      actionFilter === "all" || log.action.toLowerCase() === actionFilter;
    const matchesResource =
      resourceFilter === "all" || log.type === resourceFilter;
    return matchesSearch && matchesAction && matchesResource;
  });

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
                    {t("logsPage.title")}
                  </h1>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {t("logsPage.subtitle")}
                  </p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2.5 border border-[#E5E7EB] rounded-lg text-sm text-[#4B5563] hover:bg-[#F9FAFB] transition-colors">
                  <Download className="w-4 h-4" />
                  {t("logsPage.exportLogs")}
                </button>
              </div>

              {/* Filters */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 mb-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Search */}
                  <div className="flex-1 relative">
                    <Search className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF] ${isRTL ? "right-3" : "left-3"}`} />
                    <input
                      type="text"
                      placeholder={t("logsPage.searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full h-10 border border-[#E5E7EB] rounded-lg text-sm ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} focus:outline-none focus:border-[#002D87]`}
                    />
                  </div>

                  {/* Action Filter */}
                  <select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    className="h-10 px-4 border border-[#E5E7EB] rounded-lg text-sm text-[#4B5563] focus:outline-none focus:border-[#002D87]"
                  >
                    <option value="all">{t("logsPage.filters.allActions")}</option>
                    <option value="create">{t("logsPage.filters.create")}</option>
                    <option value="update">{t("logsPage.filters.update")}</option>
                    <option value="delete">{t("logsPage.filters.delete")}</option>
                    <option value="login">{t("logsPage.filters.login")}</option>
                    <option value="export">{t("logsPage.filters.export")}</option>
                  </select>

                  {/* Resource Filter */}
                  <select
                    value={resourceFilter}
                    onChange={(e) => setResourceFilter(e.target.value)}
                    className="h-10 px-4 border border-[#E5E7EB] rounded-lg text-sm text-[#4B5563] focus:outline-none focus:border-[#002D87]"
                  >
                    <option value="all">{t("logsPage.filters.allResources")}</option>
                    <option value="user">{t("logsPage.filters.users")}</option>
                    <option value="course">{t("logsPage.filters.courses")}</option>
                    <option value="payment">{t("logsPage.filters.payments")}</option>
                    <option value="security">{t("logsPage.filters.security")}</option>
                    <option value="settings">{t("logsPage.filters.settings")}</option>
                  </select>

                  {/* Date Range */}
                  <input
                    type="date"
                    className="h-10 px-3 border border-[#E5E7EB] rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Logs Table */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <tr>
                        <th className={`px-4 py-3 text-xs font-medium text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("logsPage.table.timestamp")}
                        </th>
                        <th className={`px-4 py-3 text-xs font-medium text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("logsPage.table.user")}
                        </th>
                        <th className={`px-4 py-3 text-xs font-medium text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("logsPage.table.action")}
                        </th>
                        <th className={`px-4 py-3 text-xs font-medium text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("logsPage.table.resource")}
                        </th>
                        <th className={`px-4 py-3 text-xs font-medium text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("logsPage.table.details")}
                        </th>
                        <th className={`px-4 py-3 text-xs font-medium text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                          {t("logsPage.table.ip")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((log) => (
                        <tr key={log.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]">
                          <td className="px-4 py-4 text-sm text-[#6B7280] font-mono whitespace-nowrap">
                            {log.timestamp}
                          </td>
                          <td className="px-4 py-4 text-sm text-[#1F2937]">{log.user}</td>
                          <td className="px-4 py-4">
                            <span className={`px-2.5 py-1 text-xs font-medium rounded ${getActionBadge(log.action)}`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              {getActionIcon(log.type)}
                              <span className="text-sm text-[#4B5563]">{log.resource}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-[#6B7280] max-w-xs truncate">
                            {log.details}
                          </td>
                          <td className="px-4 py-4 text-sm text-[#6B7280] font-mono">
                            {log.ip}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredLogs.length === 0 && (
                  <div className="py-12 text-center">
                    <ClipboardList className="w-12 h-12 text-[#9CA3AF] mx-auto mb-4" />
                    <p className="text-[#6B7280]">{t("logsPage.noLogs")}</p>
                  </div>
                )}

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-[#E5E7EB]">
                  <p className="text-sm text-[#6B7280]">
                    {t("logsPage.showing", { count: filteredLogs.length })}
                  </p>
                  <div className="flex items-center gap-2">
                    <button className="px-3 py-1.5 text-sm border border-[#E5E7EB] rounded hover:bg-[#F9FAFB]">
                      {t("logsPage.previous")}
                    </button>
                    <button className="px-3 py-1.5 text-sm btn-gold text-white rounded">1</button>
                    <button className="px-3 py-1.5 text-sm border border-[#E5E7EB] rounded hover:bg-[#F9FAFB]">2</button>
                    <button className="px-3 py-1.5 text-sm border border-[#E5E7EB] rounded hover:bg-[#F9FAFB]">3</button>
                    <button className="px-3 py-1.5 text-sm border border-[#E5E7EB] rounded hover:bg-[#F9FAFB]">
                      {t("logsPage.next")}
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

export default LogsContent;
