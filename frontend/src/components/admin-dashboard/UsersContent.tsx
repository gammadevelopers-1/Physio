"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import AdminSidebar from "./AdminSidebar";
import AdminMobileSidebar from "./AdminMobileSidebar";
import AdminNavbar from "./AdminNavbar";
import { useAuth } from "@/contexts";
import { adminApi, User, CreateUserData, UpdateUserData, PaginatedUsersResponse } from "@/lib/api";
import { toast } from "sonner";
import UserDevicesModal from "./UserDevicesModal";
import {
  Search,
  Plus,
  Download,
  MoreVertical,
  Edit,
  UserX,
  Trash2,
  RefreshCw,
  Loader2,
  AlertCircle,
  X,
  Shield,
  UserPlus,
  Check,
  Smartphone,
} from "lucide-react";

// ============================================
// Helper Functions
// ============================================

function getInitials(user: User): string {
  const first = user.firstName?.[0] || "";
  const last = user.lastName?.[0] || "";
  if (first || last) return (first + last).toUpperCase();
  return user.email[0].toUpperCase();
}

function getUserName(user: User): string {
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : user.email;
}

function getUserStatus(user: User): string {
  if (!user.isActive) return "suspended";
  if (!user.isVerified) return "pending";
  return "active";
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelativeTime(dateStr: string | undefined | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

const ALL_ROLES = ["ADMIN", "INSTRUCTOR", "STUDENT", "TEACHING_ASSISTANT", "MANAGER", "FINANCE", "SUPPORT"] as const;

// ============================================
// Modal Backdrop Component
// ============================================

function ModalBackdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto scrollbar-hide"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ============================================
// Create User Modal
// ============================================

function CreateUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useTranslations("adminDashboard");
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    phone: "",
    role: "STUDENT",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.firstName || !form.lastName) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password)) {
      toast.error("Password must contain uppercase, lowercase, and a number");
      return;
    }

    setIsSubmitting(true);
    try {
      const data: CreateUserData = {
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        role: form.role,
      };
      if (form.phone) data.phone = form.phone;
      await adminApi.createUser(data);
      toast.success("User created successfully");
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
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
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-[#1F2937]">Create New User</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#F3F4F6] rounded-lg">
            <X className="w-5 h-5 text-[#6B7280]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">First Name *</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#002D87]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">Last Name *</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#002D87]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#002D87]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">Password *</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#002D87]"
              placeholder="Min 8 chars, uppercase, lowercase, number"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#002D87]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">Role *</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#002D87]"
            >
              {ALL_ROLES.map((role) => (
                <option key={role} value={role}>
                  {t(`userManagement.roles.${role.toLowerCase()}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#4B5563] hover:bg-[#F9FAFB]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-10 btn-gold text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create User"
              )}
            </button>
          </div>
        </form>
      </div>
    </ModalBackdrop>
  );
}

// ============================================
// Edit User Modal
// ============================================

function EditUserModal({
  user,
  onClose,
  onUpdated,
}: {
  user: User;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [form, setForm] = useState({
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    phone: user.phone || "",
    isActive: user.isActive,
    isVerified: user.isVerified,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName) {
      toast.error("First name and last name are required");
      return;
    }

    setIsSubmitting(true);
    try {
      const data: UpdateUserData = {
        firstName: form.firstName,
        lastName: form.lastName,
        isActive: form.isActive,
        isVerified: form.isVerified,
      };
      if (form.phone) data.phone = form.phone;
      await adminApi.updateUser(user.id, data);
      toast.success("User updated successfully");
      onUpdated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
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
              <h2 className="text-lg font-semibold text-[#1F2937]">Edit User</h2>
              <p className="text-xs text-[#6B7280]">{user.email}</p>
              {user.lastLoginIp && (
                <p className="text-xs text-[#9CA3AF]">Last IP: {user.lastLoginIp}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#F3F4F6] rounded-lg">
            <X className="w-5 h-5 text-[#6B7280]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">First Name *</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#002D87]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">Last Name *</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#002D87]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full h-10 px-3 border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:border-[#002D87]"
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium text-[#374151]">Active</span>
            <button
              type="button"
              onClick={() => setForm({ ...form, isActive: !form.isActive })}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                form.isActive ? "bg-[#16A34A]" : "bg-[#D1D5DB]"
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  form.isActive ? "left-[22px]" : "left-[2px]"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium text-[#374151]">Verified</span>
            <button
              type="button"
              onClick={() => setForm({ ...form, isVerified: !form.isVerified })}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                form.isVerified ? "bg-[#16A34A]" : "bg-[#D1D5DB]"
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  form.isVerified ? "left-[22px]" : "left-[2px]"
                }`}
              />
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#4B5563] hover:bg-[#F9FAFB]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-10 btn-gold text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </ModalBackdrop>
  );
}

// ============================================
// Delete User Confirmation Modal
// ============================================

function DeleteUserModal({
  user,
  onClose,
  onDeleted,
}: {
  user: User;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      await adminApi.deleteUser(user.id);
      toast.success(`${getUserName(user)} has been deleted`);
      onDeleted();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
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
          <h2 className="text-lg font-semibold text-[#1F2937]">Delete User</h2>
        </div>

        <p className="text-sm text-[#4B5563] mb-2">
          Are you sure you want to delete <strong>{getUserName(user)}</strong>?
        </p>
        <p className="text-xs text-[#DC2626] mb-6">
          This action cannot be undone. All user data, roles, and sessions will be permanently removed.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-10 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#4B5563] hover:bg-[#F9FAFB]"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isSubmitting}
            className="flex-1 h-10 bg-[#DC2626] text-white rounded-lg text-sm font-medium hover:bg-[#B91C1C] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete User"
            )}
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}

// ============================================
// Manage Roles Modal
// ============================================

function ManageRolesModal({
  user,
  onClose,
  onUpdated,
}: {
  user: User;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const t = useTranslations("adminDashboard");
  const [userRoles, setUserRoles] = useState<string[]>(user.roles || []);
  const [activeRole, setActiveRole] = useState(user.activeRole);
  const [isLoading, setIsLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [confirmingRemoveRole, setConfirmingRemoveRole] = useState<string | null>(null);

  const availableRoles = ALL_ROLES.filter((r) => !userRoles.includes(r));

  const handleAddRole = async (role: string) => {
    setActionInProgress(role);
    try {
      const result = await adminApi.assignRole(user.id, role);
      setUserRoles(result.roles);
      toast.success(`${t(`userManagement.roles.${role.toLowerCase()}`)} role added`);
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add role");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRemoveRole = async (role: string) => {
    if (userRoles.length <= 1) {
      toast.error("User must have at least one role");
      return;
    }
    setActionInProgress(role);
    try {
      const result = await adminApi.removeRole(user.id, role);
      setUserRoles(result.roles);
      if (activeRole === role && result.roles.length > 0) {
        setActiveRole(result.roles[0]);
      }
      toast.success(`${t(`userManagement.roles.${role.toLowerCase()}`)} role removed`);
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove role");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleSetActiveRole = async (role: string) => {
    setIsLoading(true);
    try {
      await adminApi.updateUser(user.id, { activeRole: role, isVerified: true });
      setActiveRole(role);
      toast.success(`Active role set to ${t(`userManagement.roles.${role.toLowerCase()}`)}`);
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change active role");
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role.toLowerCase()) {
      case "admin":
      case "super_admin":
        return "bg-[#1F2937] text-white";
      case "instructor":
        return "bg-[#DBEAFE] text-[#1D4ED8]";
      case "student":
        return "bg-[#DCFCE7] text-[#16A34A]";
      case "teaching_assistant":
        return "bg-[#CCFBF1] text-[#0D9488]";
      case "manager":
        return "bg-[#EDE9FE] text-[#7C3AED]";
      case "finance":
        return "bg-[#FEF3C7] text-[#D97706]";
      case "support":
        return "bg-[#DBEAFE] text-[#2563EB]";
      default:
        return "bg-[#F3F4F6] text-[#6B7280]";
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
            <div>
              <h2 className="text-lg font-semibold text-[#1F2937]">Manage Roles</h2>
              <p className="text-xs text-[#6B7280]">{getUserName(user)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#F3F4F6] rounded-lg">
            <X className="w-5 h-5 text-[#6B7280]" />
          </button>
        </div>

        {/* Current Roles */}
        <div className="mb-6">
          <p className="text-sm font-medium text-[#374151] mb-3">Current Roles</p>
          <div className="space-y-2">
            {userRoles.map((role) => (
              <div
                key={role}
                className="flex items-center justify-between p-3 bg-[#F9FAFB] rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 text-xs font-medium rounded-full ${getRoleBadgeStyle(role)}`}
                  >
                    {t(`userManagement.roles.${role.toLowerCase()}`)}
                  </span>
                  {role === activeRole && (
                    <span className="text-xs text-[#16A34A] font-medium flex items-center gap-1">
                      <Check className="w-3 h-3" /> Active
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {role !== activeRole && (
                    <button
                      onClick={() => handleSetActiveRole(role)}
                      disabled={isLoading}
                      className="text-xs text-[#002D87] hover:underline disabled:opacity-50"
                    >
                      Set Active
                    </button>
                  )}
                  {confirmingRemoveRole === role ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          handleRemoveRole(role);
                          setConfirmingRemoveRole(null);
                        }}
                        disabled={actionInProgress === role}
                        className="text-xs text-white bg-[#DC2626] hover:bg-[#B91C1C] px-2 py-0.5 rounded disabled:opacity-50"
                      >
                        {actionInProgress === role ? "..." : "Confirm"}
                      </button>
                      <button
                        onClick={() => setConfirmingRemoveRole(null)}
                        className="text-xs text-[#6B7280] hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmingRemoveRole(role)}
                      disabled={actionInProgress === role || userRoles.length <= 1}
                      className="text-xs text-[#DC2626] hover:underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add Role */}
        {availableRoles.length > 0 && (
          <div>
            <p className="text-sm font-medium text-[#374151] mb-3">Add Role</p>
            <div className="flex flex-wrap gap-2">
              {availableRoles.map((role) => (
                <button
                  key={role}
                  onClick={() => handleAddRole(role)}
                  disabled={actionInProgress === role}
                  className="px-3 py-1.5 text-xs font-medium border border-[#E5E7EB] rounded-full hover:bg-[#F9FAFB] disabled:opacity-50 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  {t(`userManagement.roles.${role.toLowerCase()}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full h-10 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#4B5563] hover:bg-[#F9FAFB]"
          >
            Close
          </button>
        </div>
      </div>
    </ModalBackdrop>
  );
}

// ============================================
// Main Users Content Component
// ============================================

const UsersContent = () => {
  const t = useTranslations("adminDashboard");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, hasNext: false, hasPrev: false });
  const [stats, setStats] = useState({ total: 0, active: 0, pending: 0, suspended: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [managingRolesUser, setManagingRolesUser] = useState<User | null>(null);
  const [viewingDevicesUser, setViewingDevicesUser] = useState<User | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    setFetchError(null);
    try {
      const result = await adminApi.getUsers({
        page: currentPage,
        limit: 10,
        search: searchQuery || undefined,
        role: roleFilter !== "all" ? roleFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      setUsers(result.data);
      setPagination(result.meta);
      setStats(result.stats);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setIsLoadingUsers(false);
    }
  }, [currentPage, searchQuery, roleFilter, statusFilter]);

  // Debounce search input (300ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!openDropdownId) return;
    const handleClick = () => setOpenDropdownId(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [openDropdownId]);

  const adminProfile = {
    name: currentUser ? getUserName(currentUser) : "",
    email: currentUser?.email || "",
    totalUsers: stats.total,
    totalCourses: 0,
    uptime: 99.9,
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role.toLowerCase()) {
      case "admin":
      case "super_admin":
        return "bg-[#1F2937] text-white";
      case "instructor":
        return "bg-[#DBEAFE] text-[#1D4ED8]";
      case "student":
        return "bg-[#DCFCE7] text-[#16A34A]";
      case "teaching_assistant":
        return "bg-[#CCFBF1] text-[#0D9488]";
      case "manager":
        return "bg-[#EDE9FE] text-[#7C3AED]";
      case "finance":
        return "bg-[#FEF3C7] text-[#D97706]";
      case "support":
        return "bg-[#DBEAFE] text-[#2563EB]";
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
    switch (role.toLowerCase()) {
      case "admin":
      case "super_admin":
        return "bg-[#1F2937]";
      case "instructor":
        return "bg-[#3B82F6]";
      case "student":
        return "bg-[#22C55E]";
      case "teaching_assistant":
        return "bg-[#0D9488]";
      case "manager":
        return "bg-[#8B5CF6]";
      case "finance":
        return "bg-[#D97706]";
      case "support":
        return "bg-[#2563EB]";
      default:
        return "bg-[#9CA3AF]";
    }
  };

  const handleSuspendToggle = async (user: User) => {
    try {
      await adminApi.updateUser(user.id, { isActive: !user.isActive });
      toast.success(
        user.isActive
          ? `${getUserName(user)} has been suspended`
          : `${getUserName(user)} has been activated`
      );
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    }
    setOpenDropdownId(null);
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
                  <h1 className="text-xl sm:text-2xl font-bold text-[#1F2937]">
                    {t("usersPage.title")}
                  </h1>
                  <p className="text-sm text-[#6B7280] mt-1">
                    {t("usersPage.subtitle")}
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 btn-gold text-white rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  <span className="text-sm font-medium">{t("usersPage.addUser")}</span>
                </button>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-2xl font-bold text-[#1F2937]">{stats.total}</p>
                  <p className="text-sm text-[#6B7280]">{t("usersPage.stats.total")}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-2xl font-bold text-[#16A34A]">{stats.active}</p>
                  <p className="text-sm text-[#6B7280]">{t("usersPage.stats.active")}</p>
                </div>
                <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
                  <p className="text-2xl font-bold text-[#DC2626]">{stats.suspended}</p>
                  <p className="text-sm text-[#6B7280]">{t("usersPage.stats.suspended")}</p>
                </div>
              </div>

              {/* Filters and Search */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 mb-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF] ${isRTL ? "right-3" : "left-3"}`} />
                    <input
                      type="text"
                      placeholder={t("usersPage.searchPlaceholder")}
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className={`w-full h-10 border border-[#E5E7EB] rounded-lg text-sm ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} focus:outline-none focus:border-[#002D87]`}
                    />
                  </div>

                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="h-10 px-4 border border-[#E5E7EB] rounded-lg text-sm text-[#4B5563] focus:outline-none focus:border-[#002D87]"
                  >
                    <option value="all">{t("usersPage.filters.allRoles")}</option>
                    <option value="admin">{t("userManagement.roles.admin")}</option>
                    <option value="instructor">{t("userManagement.roles.instructor")}</option>
                    <option value="student">{t("userManagement.roles.student")}</option>
                    <option value="teaching_assistant">{t("userManagement.roles.teaching_assistant")}</option>
                    <option value="manager">{t("userManagement.roles.manager")}</option>
                    <option value="finance">{t("userManagement.roles.finance")}</option>
                    <option value="support">{t("userManagement.roles.support")}</option>
                  </select>

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

                  <button className="flex items-center gap-2 px-4 h-10 border border-[#E5E7EB] rounded-lg text-sm text-[#4B5563] hover:bg-[#F9FAFB] transition-colors">
                    <Download className="w-4 h-4" />
                    {t("usersPage.export")}
                  </button>
                </div>
              </div>

              {/* Loading State */}
              {isLoadingUsers && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] py-16 flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-[#002D87] mb-3" />
                  <p className="text-sm text-[#6B7280]">Loading users...</p>
                </div>
              )}

              {/* Error State */}
              {fetchError && !isLoadingUsers && (
                <div className="bg-white rounded-xl border border-[#E5E7EB] py-16 flex flex-col items-center justify-center" role="alert">
                  <AlertCircle className="w-8 h-8 text-[#DC2626] mb-3" />
                  <p className="text-sm text-[#DC2626] mb-4">{fetchError}</p>
                  <button
                    onClick={fetchUsers}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#002D87] rounded-lg hover:bg-[#001d5a] transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retry
                  </button>
                </div>
              )}

              {/* Users Table */}
              {!isLoadingUsers && !fetchError && (
                <>
                <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
                  <div className="overflow-x-auto scrollbar-hide">
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
                          <th className={`px-4 py-3 text-xs font-medium text-[#6B7280] uppercase hidden lg:table-cell ${isRTL ? "text-right" : "text-left"}`}>
                            {t("usersPage.table.lastIp")}
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
                        {users.map((user) => {
                          const status = getUserStatus(user);
                          const roleKey = user.activeRole.toLowerCase();
                          return (
                            <tr key={user.id} className="border-b border-[#F3F4F6] hover:bg-[#F9FAFB]">
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-full ${getAvatarBgColor(user.activeRole)} flex items-center justify-center flex-shrink-0`}>
                                    <span className="text-sm font-medium text-white">{getInitials(user)}</span>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-[#1F2937] truncate">{getUserName(user)}</p>
                                    <p className="text-xs text-[#6B7280] truncate">{user.email}</p>
                                    {user.scfhsNumber && (
                                      <p className="text-[10px] text-[#9CA3AF] font-mono truncate">{user.scfhsNumber}</p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getRoleBadgeStyle(user.activeRole)}`}>
                                  {t(`userManagement.roles.${roleKey}`)}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusBadgeStyle(status)}`}>
                                  {t(`userManagement.statuses.${status}`)}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-sm text-[#6B7280] whitespace-nowrap">
                                {formatRelativeTime(user.lastLoginAt)}
                              </td>
                              <td className="px-4 py-4 text-sm text-[#6B7280] whitespace-nowrap hidden lg:table-cell">
                                {user.lastLoginIp || "—"}
                              </td>
                              <td className="px-4 py-4 text-sm text-[#6B7280] whitespace-nowrap">
                                {formatDate(user.createdAt)}
                              </td>
                              <td className="px-4 py-4">
                                <div className="relative">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenDropdownId(openDropdownId === user.id ? null : user.id);
                                    }}
                                    className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
                                  >
                                    <MoreVertical className="w-4 h-4 text-[#6B7280]" />
                                  </button>

                                  {openDropdownId === user.id && (
                                    <div className={`absolute top-full mt-1 bg-white rounded-lg shadow-lg border border-[#E5E7EB] py-1 min-w-[160px] z-10 ${isRTL ? "left-0" : "right-0"}`}>
                                      <button
                                        onClick={() => {
                                          setEditingUser(user);
                                          setOpenDropdownId(null);
                                        }}
                                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#4B5563] hover:bg-[#F9FAFB]"
                                      >
                                        <Edit className="w-4 h-4" />
                                        {t("usersPage.actions.edit")}
                                      </button>
                                      <button
                                        onClick={() => {
                                          setManagingRolesUser(user);
                                          setOpenDropdownId(null);
                                        }}
                                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#4B5563] hover:bg-[#F9FAFB]"
                                      >
                                        <Shield className="w-4 h-4" />
                                        Manage Roles
                                      </button>
                                      <button
                                        onClick={() => {
                                          setViewingDevicesUser(user);
                                          setOpenDropdownId(null);
                                        }}
                                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#4B5563] hover:bg-[#F9FAFB]"
                                      >
                                        <Smartphone className="w-4 h-4" />
                                        Trusted Devices
                                      </button>
                                      <div className="border-t border-[#E5E7EB] my-1" />
                                      <button
                                        onClick={() => handleSuspendToggle(user)}
                                        className={`flex items-center gap-2 w-full px-4 py-2 text-sm ${
                                          user.isActive
                                            ? "text-[#D97706] hover:bg-[#FEF3C7]"
                                            : "text-[#16A34A] hover:bg-[#DCFCE7]"
                                        }`}
                                      >
                                        <UserX className="w-4 h-4" />
                                        {user.isActive ? t("usersPage.actions.suspend") : "Activate"}
                                      </button>
                                      {user.id !== currentUser?.id && (
                                        <button
                                          onClick={() => {
                                            setDeletingUser(user);
                                            setOpenDropdownId(null);
                                          }}
                                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#DC2626] hover:bg-[#FEE2E2]"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                          {t("usersPage.actions.delete")}
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {users.length === 0 && (
                    <div className="py-12 text-center">
                      <p className="text-[#6B7280]">{t("usersPage.noUsers")}</p>
                    </div>
                  )}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-[#6B7280]">
                      Showing {(currentPage - 1) * 10 + 1} to {Math.min(currentPage * 10, pagination.total)} of {pagination.total} users
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={!pagination.hasPrev}
                        className="px-3 py-1.5 text-sm border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === pagination.totalPages || Math.abs(p - currentPage) <= 1)
                        .map((p, idx, arr) => (
                          <span key={p}>
                            {idx > 0 && arr[idx - 1] !== p - 1 && (
                              <span className="px-1 text-[#6B7280]">...</span>
                            )}
                            <button
                              onClick={() => setCurrentPage(p)}
                              className={`w-8 h-8 text-sm rounded-lg ${
                                p === currentPage
                                  ? "bg-[#002D87] text-white"
                                  : "border border-[#E5E7EB] hover:bg-[#F9FAFB] text-[#4B5563]"
                              }`}
                            >
                              {p}
                            </button>
                          </span>
                        ))}
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                        disabled={!pagination.hasNext}
                        className="px-3 py-1.5 text-sm border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onCreated={fetchUsers}
        />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onUpdated={fetchUsers}
        />
      )}

      {deletingUser && (
        <DeleteUserModal
          user={deletingUser}
          onClose={() => setDeletingUser(null)}
          onDeleted={fetchUsers}
        />
      )}

      {managingRolesUser && (
        <ManageRolesModal
          user={managingRolesUser}
          onClose={() => setManagingRolesUser(null)}
          onUpdated={fetchUsers}
        />
      )}

      {viewingDevicesUser && (
        <UserDevicesModal
          user={viewingDevicesUser}
          onClose={() => setViewingDevicesUser(null)}
        />
      )}
    </>
  );
};

export default UsersContent;
