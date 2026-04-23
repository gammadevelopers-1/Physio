"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import AdminSidebar from "./AdminSidebar";
import AdminMobileSidebar from "./AdminMobileSidebar";
import AdminNavbar from "./AdminNavbar";
import { useAuth } from "@/contexts";
import { adminApi, RoleWithCount } from "@/lib/api";
import { toast } from "sonner";
import {
  Shield,
  Plus,
  Users,
  Check,
  X,
  Edit,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

// ============================================
// Helper: user name from auth context
// ============================================
function getUserName(user: { firstName: string | null; lastName: string | null; email: string }): string {
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : user.email;
}

// ============================================
// Predefined permission sets per system role
// (visual only — backend uses role-based guards)
// ============================================
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
] as const;

type PermissionSet = Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>;

const SYSTEM_PERMISSIONS: Record<string, PermissionSet> = {
  SUPER_ADMIN: Object.fromEntries(permissionCategories.map((c) => [c, { view: true, create: true, edit: true, delete: true }])),
  ADMIN: Object.fromEntries(permissionCategories.map((c) => [c, { view: true, create: true, edit: true, delete: c !== "security" }])),
  MANAGER: {
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
  INSTRUCTOR: {
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
  STUDENT: {
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
  FINANCE: {
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
  SUPPORT: {
    users: { view: true, create: false, edit: false, delete: false },
    courses: { view: true, create: false, edit: false, delete: false },
    content: { view: true, create: false, edit: false, delete: false },
    assessments: { view: false, create: false, edit: false, delete: false },
    certificates: { view: false, create: false, edit: false, delete: false },
    finance: { view: false, create: false, edit: false, delete: false },
    reports: { view: true, create: false, edit: false, delete: false },
    settings: { view: false, create: false, edit: false, delete: false },
    security: { view: false, create: false, edit: false, delete: false },
  },
};

const DEFAULT_PERMISSIONS: PermissionSet = Object.fromEntries(
  permissionCategories.map((c) => [c, { view: false, create: false, edit: false, delete: false }]),
);

function getPermissions(roleName: string): PermissionSet {
  return SYSTEM_PERMISSIONS[roleName] || DEFAULT_PERMISSIONS;
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "var(--color-text-primary)",
  ADMIN: "var(--color-text-primary)",
  MANAGER: "#8B5CF6",
  INSTRUCTOR: "#3B82F6",
  STUDENT: "#22C55E",
  FINANCE: "#F59E0B",
  SUPPORT: "#2563EB",
};

function getRoleColor(roleName: string): string {
  return ROLE_COLORS[roleName] || "var(--color-text-secondary)";
}

// System role names that cannot be deleted
const SYSTEM_ROLE_NAMES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "INSTRUCTOR", "STUDENT", "FINANCE", "SUPPORT"];

// ============================================
// Modal Backdrop
// ============================================
function ModalBackdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ============================================
// Create Role Modal
// ============================================
function CreateRoleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const tToasts = useTranslations("toasts");
  const [form, setForm] = useState({ name: "", displayName: "", description: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.displayName) {
      toast.error(tToasts("roleNameDisplayRequired"));
      return;
    }
    setIsSubmitting(true);
    try {
      await adminApi.createRole({
        name: form.name,
        displayName: form.displayName,
        description: form.description || undefined,
      });
      toast.success(tToasts("roleCreated"));
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create role");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#002D87] flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Create New Role</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#F3F4F6] rounded-lg">
            <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Role Name (key) *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase().replace(/\s+/g, "_") })}
              className="w-full h-10 px-3 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[#002D87]"
              placeholder="e.g. CONTENT_REVIEWER"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Display Name *</label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              className="w-full h-10 px-3 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[#002D87]"
              placeholder="e.g. Content Reviewer"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full h-20 px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[#002D87] resize-none"
              placeholder="What can this role do?"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 h-10 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[#F9FAFB]">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="flex-1 h-10 btn-gold text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Creating...</> : "Create Role"}
            </button>
          </div>
        </form>
      </div>
    </ModalBackdrop>
  );
}

// ============================================
// Edit Role Modal
// ============================================
function EditRoleModal({ role, onClose, onUpdated }: { role: RoleWithCount; onClose: () => void; onUpdated: () => void }) {
  const tToasts = useTranslations("toasts");
  const [form, setForm] = useState({ displayName: role.displayName, description: role.description || "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.displayName) {
      toast.error(tToasts("displayNameRequired"));
      return;
    }
    setIsSubmitting(true);
    try {
      await adminApi.updateRole(role.id, {
        displayName: form.displayName,
        description: form.description || undefined,
      });
      toast.success(tToasts("roleUpdated"));
      onUpdated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#002D87] flex items-center justify-center">
              <Edit className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Edit Role</h2>
              <p className="text-xs text-[var(--color-text-secondary)]">{role.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#F3F4F6] rounded-lg">
            <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Display Name *</label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              className="w-full h-10 px-3 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[#002D87]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full h-20 px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[#002D87] resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 h-10 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[#F9FAFB]">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="flex-1 h-10 btn-gold text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </ModalBackdrop>
  );
}

// ============================================
// Delete Role Confirmation
// ============================================
function DeleteRoleModal({ role, onClose, onDeleted }: { role: RoleWithCount; onClose: () => void; onDeleted: () => void }) {
  const tToasts = useTranslations("toasts");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      await adminApi.deleteRole(role.id);
      toast.success(tToasts("roleDeleted", { name: role.displayName }));
      onDeleted();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete role");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#FEE2E2] flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-[#DC2626]" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Delete Role</h2>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mb-2">
          Are you sure you want to delete <strong>{role.displayName}</strong>?
        </p>
        {role.usersCount > 0 && (
          <p className="text-xs text-[#DC2626] mb-4">
            This role has {role.usersCount} user(s) assigned. Remove the role from all users before deleting.
          </p>
        )}
        <p className="text-xs text-[var(--color-text-secondary)] mb-6">This action cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 h-10 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[#F9FAFB]">
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isSubmitting}
            className="flex-1 h-10 bg-[#DC2626] text-white rounded-lg text-sm font-medium hover:bg-[#B91C1C] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Deleting...</> : "Delete Role"}
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}

// ============================================
// Main RolesContent Component
// ============================================
const RolesContent = () => {
  const t = useTranslations("adminDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { user: currentUser } = useAuth();

  const [roles, setRoles] = useState<RoleWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleWithCount | null>(null);
  const [deletingRole, setDeletingRole] = useState<RoleWithCount | null>(null);

  const fetchRoles = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await adminApi.getRoles();
      setRoles(data);
      // Auto-expand first role
      if (data.length > 0 && !expandedRole) {
        setExpandedRole(data[0].id);
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load roles");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const adminProfile = {
    name: currentUser ? getUserName(currentUser) : "",
    email: currentUser?.email || "",
    totalUsers: roles.reduce((sum, r) => sum + r.usersCount, 0),
    totalCourses: 0,
    uptime: 99.9,
  };

  return (
    <>
      <AdminNavbar admin={adminProfile} />

      <div className="bg-[#F9FAFB] min-h-screen">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar */}
            <div className="hidden lg:block lg:flex-shrink-0">
              <AdminSidebar admin={adminProfile} />
            </div>

            <AdminMobileSidebar admin={adminProfile} />

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Page Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                    {t("rolesPage.title")}
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    {t("rolesPage.subtitle")}
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 btn-gold text-white rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  <span className="text-sm font-medium">{t("rolesPage.createRole")}</span>
                </button>
              </div>

              {/* Loading State */}
              {isLoading && (
                <div className="bg-white rounded-xl border border-[var(--color-border)] py-16 flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-[#002D87] mb-3" />
                  <p className="text-sm text-[var(--color-text-secondary)]">Loading roles...</p>
                </div>
              )}

              {/* Error State */}
              {fetchError && !isLoading && (
                <div className="bg-white rounded-xl border border-[var(--color-border)] py-16 flex flex-col items-center justify-center" role="alert">
                  <AlertCircle className="w-8 h-8 text-[#DC2626] mb-3" />
                  <p className="text-sm text-[#DC2626] mb-4">{fetchError}</p>
                  <button
                    onClick={fetchRoles}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#002D87] rounded-lg hover:bg-[#001d5a] transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retry
                  </button>
                </div>
              )}

              {/* Roles List */}
              {!isLoading && !fetchError && (
                <div className="space-y-4">
                  {roles.map((role) => {
                    const permissions = getPermissions(role.name);
                    const color = getRoleColor(role.name);
                    const isSystem = SYSTEM_ROLE_NAMES.includes(role.name);

                    return (
                      <div
                        key={role.id}
                        className="bg-white rounded-xl border border-[var(--color-border)] overflow-hidden"
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
                              style={{ backgroundColor: `${color}15` }}
                            >
                              <Shield className="w-5 h-5" style={{ color }} />
                            </div>
                            <div>
                              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">
                                {role.displayName}
                              </h3>
                              <p className="text-sm text-[var(--color-text-secondary)]">
                                {role.description || role.name}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-[var(--color-text-secondary)]" />
                              <span className="text-sm text-[var(--color-text-secondary)]">
                                {role.usersCount} {t("rolesPage.users")}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingRole(role);
                                }}
                                className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
                              >
                                <Edit className="w-4 h-4 text-[var(--color-text-secondary)]" />
                              </button>
                              {!isSystem && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingRole(role);
                                  }}
                                  className="p-2 hover:bg-[#FEE2E2] rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4 text-[#DC2626]" />
                                </button>
                              )}
                            </div>

                            {expandedRole === role.id ? (
                              <ChevronDown className="w-5 h-5 text-[var(--color-text-secondary)]" />
                            ) : (
                              <ChevronRight
                                className={`w-5 h-5 text-[var(--color-text-secondary)] ${isRTL ? "rotate-180" : ""}`}
                              />
                            )}
                          </div>
                        </div>

                        {/* Permissions Matrix */}
                        {expandedRole === role.id && (
                          <div className="border-t border-[var(--color-border)] p-4">
                            <h4 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase mb-4">
                              {t("rolesPage.permissions")}
                            </h4>

                            <div className="overflow-x-auto scrollbar-hide">
                              <table className="w-full">
                                <thead>
                                  <tr className="border-b border-[var(--color-border)]">
                                    <th className={`pb-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                                      {t("rolesPage.module")}
                                    </th>
                                    <th className="pb-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase text-center">
                                      {t("rolesPage.view")}
                                    </th>
                                    <th className="pb-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase text-center">
                                      {t("rolesPage.create")}
                                    </th>
                                    <th className="pb-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase text-center">
                                      {t("rolesPage.edit")}
                                    </th>
                                    <th className="pb-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase text-center">
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
                                      <td className={`py-3 text-sm text-[var(--color-text-primary)] capitalize ${isRTL ? "text-right" : "text-left"}`}>
                                        {t(`rolesPage.categories.${category}`)}
                                      </td>
                                      {(["view", "create", "edit", "delete"] as const).map((action) => (
                                        <td key={action} className="py-3 text-center">
                                          {permissions[category]?.[action] ? (
                                            <Check className="w-5 h-5 text-[#16A34A] mx-auto" />
                                          ) : (
                                            <X className="w-5 h-5 text-[#DC2626] mx-auto" />
                                          )}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {roles.length === 0 && (
                    <div className="bg-white rounded-xl border border-[var(--color-border)] py-12 text-center">
                      <p className="text-[var(--color-text-secondary)]">No roles found</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateRoleModal onClose={() => setShowCreateModal(false)} onCreated={fetchRoles} />
      )}
      {editingRole && (
        <EditRoleModal role={editingRole} onClose={() => setEditingRole(null)} onUpdated={fetchRoles} />
      )}
      {deletingRole && (
        <DeleteRoleModal role={deletingRole} onClose={() => setDeletingRole(null)} onDeleted={fetchRoles} />
      )}
    </>
  );
};

export default RolesContent;
