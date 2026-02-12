"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Users, ArrowRight, Plus } from "lucide-react";

interface User {
  id: string;
  name: string;
  initials: string;
  role: "admin" | "instructor" | "student" | "manager";
  status: "active" | "suspended" | "pending";
}

interface UserManagementWidgetProps {
  users: User[];
}

const UserManagementWidget = ({ users }: UserManagementWidgetProps) => {
  const t = useTranslations("adminDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

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

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[#002D87]" />
          <h3 className="text-lg font-semibold text-[#1F2937]">
            {t("userManagement.title")}
          </h3>
        </div>
        <Link
          href={`/${locale}/dashboard/admin/users`}
          className="text-sm text-[#0066FF] hover:underline flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          {t("userManagement.addUser")}
        </Link>
      </div>

      {/* User Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E5E7EB]">
              <th
                className={`py-3 text-xs font-medium text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}
              >
                {t("userManagement.user")}
              </th>
              <th
                className={`py-3 text-xs font-medium text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}
              >
                {t("userManagement.role")}
              </th>
              <th
                className={`py-3 text-xs font-medium text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}
              >
                {t("userManagement.status")}
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className="border-b border-[#F3F4F6] last:border-b-0"
              >
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full ${getAvatarBgColor(user.role)} flex items-center justify-center`}
                    >
                      <span className="text-xs font-medium text-white">
                        {user.initials}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-[#1F2937]">
                      {user.name}
                    </span>
                  </div>
                </td>
                <td className="py-3">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeStyle(user.role)}`}
                  >
                    {t(`userManagement.roles.${user.role}`)}
                  </span>
                </td>
                <td className="py-3">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeStyle(user.status)}`}
                  >
                    {t(`userManagement.statuses.${user.status}`)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* View All Link */}
      <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
        <Link
          href={`/${locale}/dashboard/admin/users`}
          className="text-sm text-[#0066FF] hover:underline flex items-center gap-1"
        >
          {t("userManagement.viewAllUsers")}
          <ArrowRight className={`w-4 h-4 ${isRTL ? "rotate-180" : ""}`} />
        </Link>
      </div>
    </div>
  );
};

export default UserManagementWidget;
