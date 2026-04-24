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
        return "bg-[var(--color-text-primary)] text-white";
      case "instructor":
        return "bg-[var(--color-border-subtle)] text-[#1D4ED8]";
      case "student":
        return "bg-[#DCFCE7] text-[#16A34A]";
      case "manager":
        return "bg-[#EDE9FE] text-[#7C3AED]";
      default:
        return "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
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
        return "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
    }
  };

  const getAvatarBgColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-[var(--color-text-primary)]";
      case "instructor":
        return "bg-[var(--color-primary)]";
      case "student":
        return "bg-[#22C55E]";
      case "manager":
        return "bg-[#8B5CF6]";
      default:
        return "bg-[var(--color-text-secondary)]";
    }
  };

  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[var(--color-primary)]" />
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
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
            <tr className="border-b border-[var(--color-border)]">
              <th
                className={`py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}
              >
                {t("userManagement.user")}
              </th>
              <th
                className={`py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}
              >
                {t("userManagement.role")}
              </th>
              <th
                className={`py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}
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
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
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
      <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
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
