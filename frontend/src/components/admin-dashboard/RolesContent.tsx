"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import AdminSidebar from "./AdminSidebar";
import AdminMobileSidebar from "./AdminMobileSidebar";
import AdminNavbar from "./AdminNavbar";
import {
  Shield,
  Plus,
  Users,
  Check,
  X,
  Edit,
  Copy,
  Trash2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

// Mock Admin Profile
const mockAdmin = {
  name: "Abdullah Al-Rashid",
  email: "admin@physio.edu.sa",
  totalUsers: 1245,
  totalCourses: 12,
  uptime: 99.9,
};

// Mock Roles Data
const mockRoles = [
  {
    id: "1",
    name: "Super Admin",
    description: "Full platform access and control",
    usersCount: 2,
    color: "#1F2937",
    permissions: {
      users: { view: true, create: true, edit: true, delete: true },
      courses: { view: true, create: true, edit: true, delete: true },
      content: { view: true, create: true, edit: true, delete: true },
      assessments: { view: true, create: true, edit: true, delete: true },
      certificates: { view: true, create: true, edit: true, delete: true },
      finance: { view: true, create: true, edit: true, delete: true },
      reports: { view: true, create: true, edit: true, delete: true },
      settings: { view: true, create: true, edit: true, delete: true },
      security: { view: true, create: true, edit: true, delete: true },
    },
  },
  {
    id: "2",
    name: "Course Manager",
    description: "Manage courses, instructors, and content",
    usersCount: 5,
    color: "#8B5CF6",
    permissions: {
      users: { view: true, create: false, edit: false, delete: false },
      courses: { view: true, create: true, edit: true, delete: false },
      content: { view: true, create: true, edit: true, delete: true },
      assessments: { view: true, create: true, edit: true, delete: false },
      certificates: { view: true, create: false, edit: false, delete: false },
      finance: { view: true, create: false, edit: false, delete: false },
      reports: { view: true, create: true, edit: false, delete: false },
      settings: { view: false, create: false, edit: false, delete: false },
      security: { view: false, create: false, edit: false, delete: false },
    },
  },
  {
    id: "3",
    name: "Instructor",
    description: "Create and manage own courses",
    usersCount: 15,
    color: "#3B82F6",
    permissions: {
      users: { view: false, create: false, edit: false, delete: false },
      courses: { view: true, create: true, edit: true, delete: false },
      content: { view: true, create: true, edit: true, delete: false },
      assessments: { view: true, create: true, edit: true, delete: false },
      certificates: { view: true, create: false, edit: false, delete: false },
      finance: { view: false, create: false, edit: false, delete: false },
      reports: { view: true, create: false, edit: false, delete: false },
      settings: { view: false, create: false, edit: false, delete: false },
      security: { view: false, create: false, edit: false, delete: false },
    },
  },
  {
    id: "4",
    name: "Student",
    description: "Access courses and assessments",
    usersCount: 1200,
    color: "#22C55E",
    permissions: {
      users: { view: false, create: false, edit: false, delete: false },
      courses: { view: true, create: false, edit: false, delete: false },
      content: { view: true, create: false, edit: false, delete: false },
      assessments: { view: true, create: false, edit: false, delete: false },
      certificates: { view: true, create: false, edit: false, delete: false },
      finance: { view: false, create: false, edit: false, delete: false },
      reports: { view: false, create: false, edit: false, delete: false },
      settings: { view: false, create: false, edit: false, delete: false },
      security: { view: false, create: false, edit: false, delete: false },
    },
  },
  {
    id: "5",
    name: "Finance",
    description: "Access financial data and reports",
    usersCount: 3,
    color: "#F59E0B",
    permissions: {
      users: { view: true, create: false, edit: false, delete: false },
      courses: { view: true, create: false, edit: false, delete: false },
      content: { view: false, create: false, edit: false, delete: false },
      assessments: { view: false, create: false, edit: false, delete: false },
      certificates: { view: true, create: false, edit: false, delete: false },
      finance: { view: true, create: true, edit: true, delete: false },
      reports: { view: true, create: true, edit: false, delete: false },
      settings: { view: false, create: false, edit: false, delete: false },
      security: { view: false, create: false, edit: false, delete: false },
    },
  },
];

const permissionCategories = [
  "users",
  "courses",
  "content",
  "assessments",
  "certificates",
  "finance",
  "reports",
  "settings",
  "security",
];

const RolesContent = () => {
  const t = useTranslations("adminDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";

  const [expandedRole, setExpandedRole] = useState<string | null>("1");

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
                    {t("rolesPage.title")}
                  </h1>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {t("rolesPage.subtitle")}
                  </p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2.5 btn-gold text-white rounded-lg transition-colors">
                  <Plus className="w-5 h-5" />
                  <span className="text-sm font-medium">{t("rolesPage.createRole")}</span>
                </button>
              </div>

              {/* Roles List */}
              <div className="space-y-4">
                {mockRoles.map((role) => (
                  <div
                    key={role.id}
                    className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden"
                  >
                    {/* Role Header */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#F9FAFB]"
                      onClick={() =>
                        setExpandedRole(expandedRole === role.id ? null : role.id)
                      }
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${role.color}15` }}
                        >
                          <Shield
                            className="w-5 h-5"
                            style={{ color: role.color }}
                          />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-[#1F2937]">
                            {role.name}
                          </h3>
                          <p className="text-sm text-[#6B7280]">
                            {role.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-[#6B7280]" />
                          <span className="text-sm text-[#6B7280]">
                            {role.usersCount} {t("rolesPage.users")}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors">
                            <Edit className="w-4 h-4 text-[#6B7280]" />
                          </button>
                          <button className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors">
                            <Copy className="w-4 h-4 text-[#6B7280]" />
                          </button>
                          {role.id !== "1" && (
                            <button className="p-2 hover:bg-[#FEE2E2] rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4 text-[#DC2626]" />
                            </button>
                          )}
                        </div>

                        {expandedRole === role.id ? (
                          <ChevronDown className="w-5 h-5 text-[#6B7280]" />
                        ) : (
                          <ChevronRight
                            className={`w-5 h-5 text-[#6B7280] ${isRTL ? "rotate-180" : ""}`}
                          />
                        )}
                      </div>
                    </div>

                    {/* Permissions Matrix */}
                    {expandedRole === role.id && (
                      <div className="border-t border-[#E5E7EB] p-4">
                        <h4 className="text-sm font-semibold text-[#6B7280] uppercase mb-4">
                          {t("rolesPage.permissions")}
                        </h4>

                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-[#E5E7EB]">
                                <th className={`pb-3 text-xs font-medium text-[#6B7280] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                                  {t("rolesPage.module")}
                                </th>
                                <th className="pb-3 text-xs font-medium text-[#6B7280] uppercase text-center">
                                  {t("rolesPage.view")}
                                </th>
                                <th className="pb-3 text-xs font-medium text-[#6B7280] uppercase text-center">
                                  {t("rolesPage.create")}
                                </th>
                                <th className="pb-3 text-xs font-medium text-[#6B7280] uppercase text-center">
                                  {t("rolesPage.edit")}
                                </th>
                                <th className="pb-3 text-xs font-medium text-[#6B7280] uppercase text-center">
                                  {t("rolesPage.delete")}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {permissionCategories.map((category) => (
                                <tr
                                  key={category}
                                  className="border-b border-[#F3F4F6] last:border-b-0"
                                >
                                  <td className={`py-3 text-sm text-[#1F2937] capitalize ${isRTL ? "text-right" : "text-left"}`}>
                                    {t(`rolesPage.categories.${category}`)}
                                  </td>
                                  <td className="py-3 text-center">
                                    {role.permissions[category as keyof typeof role.permissions]
                                      .view ? (
                                      <Check className="w-5 h-5 text-[#16A34A] mx-auto" />
                                    ) : (
                                      <X className="w-5 h-5 text-[#DC2626] mx-auto" />
                                    )}
                                  </td>
                                  <td className="py-3 text-center">
                                    {role.permissions[category as keyof typeof role.permissions]
                                      .create ? (
                                      <Check className="w-5 h-5 text-[#16A34A] mx-auto" />
                                    ) : (
                                      <X className="w-5 h-5 text-[#DC2626] mx-auto" />
                                    )}
                                  </td>
                                  <td className="py-3 text-center">
                                    {role.permissions[category as keyof typeof role.permissions]
                                      .edit ? (
                                      <Check className="w-5 h-5 text-[#16A34A] mx-auto" />
                                    ) : (
                                      <X className="w-5 h-5 text-[#DC2626] mx-auto" />
                                    )}
                                  </td>
                                  <td className="py-3 text-center">
                                    {role.permissions[category as keyof typeof role.permissions]
                                      .delete ? (
                                      <Check className="w-5 h-5 text-[#16A34A] mx-auto" />
                                    ) : (
                                      <X className="w-5 h-5 text-[#DC2626] mx-auto" />
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RolesContent;
