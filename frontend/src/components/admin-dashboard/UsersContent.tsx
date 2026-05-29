"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import AdminSidebar from "./AdminSidebar";
import AdminMobileSidebar from "./AdminMobileSidebar";
import AdminNavbar from "./AdminNavbar";
import { TableRowSkeleton } from "./AdminSkeletons";
import { useAuth } from "@/contexts";
import { adminApi, User, CreateUserData, UpdateUserData, PaginatedUsersResponse } from "@/lib/api";
import { toast } from "sonner";
import UserDevicesModal from "./UserDevicesModal";
import Select from "./Select";
import UserAvatar from "./users/UserAvatar";
import UserDetailDrawer from "./users/UserDetailDrawer";
import { ROLE_ORDER } from "./users/userHelpers";
import { usePlatformLocale } from "@/contexts/PlatformLocaleContext";
import { formatPlatformDateReadable, type PlatformLocaleSettings } from "@/lib/platform-locale";
import { FmtDate } from "@/components/ui/Fmt";
import PasswordPolicyHint from "@/components/shared/PasswordPolicyHint";
import { usePasswordPolicy, checkPasswordAgainstPolicy } from "@/hooks/usePasswordPolicy";
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
  Eye,
  Users as UsersIcon,
  GraduationCap,
  Briefcase,
  UserCog,
  Headphones,
  Banknote,
  ShieldCheck,
  Clock,
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

function formatDate(dateStr: string, settings: PlatformLocaleSettings): string {
  return formatPlatformDateReadable(dateStr, settings, "en");
}

function formatRelativeTime(dateStr: string | undefined | null, settings: PlatformLocaleSettings): string {
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
  return formatDate(dateStr, settings);
}

const ALL_ROLES = ["ADMIN", "INSTRUCTOR", "STUDENT", "TEACHING_ASSISTANT", "MANAGER", "FINANCE", "SUPPORT"] as const;

// Per-role icon + accent color used for the role-breakdown chip row
// above the users table. Each chip is clickable to filter the table
// to that role; the active chip uses the accent color as background.
const ROLE_META: Record<
  string,
  { icon: React.ElementType; accent: string }
> = {
  ADMIN: { icon: ShieldCheck, accent: "#DC2626" },
  MANAGER: { icon: UserCog, accent: "#0369A1" },
  INSTRUCTOR: { icon: Briefcase, accent: "#15803D" },
  TEACHING_ASSISTANT: { icon: GraduationCap, accent: "#0E7490" },
  STUDENT: { icon: UsersIcon, accent: "#1D4ED8" },
  FINANCE: { icon: Banknote, accent: "#92740F" },
  SUPPORT: { icon: Headphones, accent: "#B45309" },
};

// ─── Stat & role-chip subcomponents ─────────────────────────────

function StatCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  valueClass,
}: {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  label: string;
  value: number;
  valueClass?: string;
}) {
  return (
    <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 flex items-center gap-3">
      <div
        className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}
      >
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p
          className={`text-2xl font-bold leading-tight ${
            valueClass ?? "text-[var(--color-text-primary)]"
          }`}
        >
          {value}
        </p>
        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 truncate">
          {label}
        </p>
      </div>
    </div>
  );
}

function RoleChip({
  active,
  icon: Icon,
  accent,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: React.ElementType;
  accent: string;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
        active
          ? "text-white shadow-sm"
          : "bg-[var(--color-surface-page)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-border-subtle)]"
      }`}
      style={
        active
          ? { backgroundColor: accent, borderColor: accent }
          : undefined
      }
    >
      <Icon
        className="w-3.5 h-3.5"
        style={active ? undefined : { color: accent }}
      />
      <span>{label}</span>
      <span
        className={`min-w-[20px] text-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
          active
            ? "bg-white/25 text-white"
            : "bg-[var(--color-border-subtle)] text-[var(--color-text-primary)]"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

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
        className="bg-[var(--color-surface-card)] rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto scrollbar-hide"
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
  const tToasts = useTranslations("toasts");
  const { policy: passwordPolicy } = usePasswordPolicy();
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
      toast.error(tToasts("fillRequiredFields"));
      return;
    }
    const policyErrors = checkPasswordAgainstPolicy(form.password, passwordPolicy);
    if (policyErrors.length) {
      toast.error(policyErrors[0]);
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
      toast.success(tToasts("userCreated"));
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
            <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Create New User</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--color-border-subtle)] rounded-lg">
            <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">First Name *</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[#002D87]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Last Name *</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[#002D87]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[#002D87]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Password *</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[#002D87]"
              required
            />
            <PasswordPolicyHint password={form.password} />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[#002D87]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Role *</label>
            <Select
              value={form.role}
              onChange={(val) => setForm({ ...form, role: val })}
              options={ALL_ROLES.map((role) => ({
                value: role,
                label: t(`userManagement.roles.${role.toLowerCase()}`),
              }))}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-10 btn-gold text-[var(--color-button-text)] rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
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
  const tToasts = useTranslations("toasts");
  const [form, setForm] = useState({
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    phone: user.phone || "",
    zoomEmail: user.zoomEmail || "",
    isActive: user.isActive,
    isVerified: user.isVerified,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName) {
      toast.error(tToasts("firstLastNameRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      const data: UpdateUserData = {
        firstName: form.firstName,
        lastName: form.lastName,
        isActive: form.isActive,
        isVerified: form.isVerified,
        // Send trimmed value, or "" to clear. undefined would skip it.
        zoomEmail: form.zoomEmail.trim() || "",
      };
      if (form.phone) data.phone = form.phone;
      await adminApi.updateUser(user.id, data);
      toast.success(tToasts("userUpdated"));
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
            <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
              <Edit className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Edit User</h2>
              <p className="text-xs text-[var(--color-text-secondary)]">{user.email}</p>
              {user.lastLoginIp && (
                <p className="text-xs text-[var(--color-text-secondary)]">Last IP: {user.lastLoginIp}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--color-border-subtle)] rounded-lg">
            <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">First Name *</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[#002D87]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Last Name *</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[#002D87]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[#002D87]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
              Zoom Host Email
            </label>
            <input
              type="email"
              value={form.zoomEmail}
              onChange={(e) => setForm({ ...form, zoomEmail: e.target.value })}
              placeholder={user.email}
              className="w-full h-10 px-3 border border-[var(--color-input-border)] rounded-lg text-sm focus:outline-none focus:border-[#002D87]"
            />
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
              Licensed Zoom seat this user hosts under. Leave blank to use their login email, then the platform default host.
            </p>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">Active</span>
            <button
              type="button"
              onClick={() => setForm({ ...form, isActive: !form.isActive })}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                form.isActive ? "bg-[#16A34A]" : "bg-[var(--color-border)]"
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-[var(--color-surface-card)] rounded-full shadow transition-transform ${
                  form.isActive ? "left-[22px]" : "left-[2px]"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium text-[var(--color-text-secondary)]">Verified</span>
            <button
              type="button"
              onClick={() => setForm({ ...form, isVerified: !form.isVerified })}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                form.isVerified ? "bg-[#16A34A]" : "bg-[var(--color-border)]"
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-[var(--color-surface-card)] rounded-full shadow transition-transform ${
                  form.isVerified ? "left-[22px]" : "left-[2px]"
                }`}
              />
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-10 btn-gold text-[var(--color-button-text)] rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
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
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Delete User</h2>
        </div>

        <p className="text-sm text-[var(--color-text-secondary)] mb-2">
          Are you sure you want to delete <strong>{getUserName(user)}</strong>?
        </p>
        <p className="text-xs text-[#DC2626] mb-6">
          This action cannot be undone. All user data, roles, and sessions will be permanently removed.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-10 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
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
  const tToasts = useTranslations("toasts");
  const [userRoles, setUserRoles] = useState<string[]>(user.roles || []);
  const [activeRole, setActiveRole] = useState(user.activeRole);
  const [isLoading, setIsLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [confirmingRemoveRole, setConfirmingRemoveRole] = useState<string | null>(null);

  // Strict role isolation: STUDENT and INSTRUCTOR are mutually exclusive.
  const hasStudent = userRoles.includes("STUDENT");
  const hasInstructor = userRoles.includes("INSTRUCTOR");
  const availableRoles = ALL_ROLES.filter((r) => {
    if (userRoles.includes(r)) return false;
    if (r === "STUDENT" && hasInstructor) return false;
    if (r === "INSTRUCTOR" && hasStudent) return false;
    return true;
  });

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
      toast.error(tToasts("userMustHaveRole"));
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
        return "bg-[var(--color-text-primary)] text-white";
      case "instructor":
        return "bg-[var(--color-border-subtle)] text-[#1D4ED8]";
      case "student":
        return "bg-[#DCFCE7] text-[#16A34A]";
      case "teaching_assistant":
        return "bg-[#CCFBF1] text-[#0D9488]";
      case "manager":
        return "bg-[#EDE9FE] text-[#7C3AED]";
      case "finance":
        return "bg-[#FEF3C7] text-[#D97706]";
      case "support":
        return "bg-[var(--color-border-subtle)] text-[var(--color-primary-dark)]";
      default:
        return "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
    }
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Manage Roles</h2>
              <p className="text-xs text-[var(--color-text-secondary)]">{getUserName(user)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[var(--color-border-subtle)] rounded-lg">
            <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        {/* Current Roles */}
        <div className="mb-6">
          <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Current Roles</p>
          <div className="space-y-2">
            {userRoles.map((role) => (
              <div
                key={role}
                className="flex items-center justify-between p-3 bg-[var(--color-surface-page)] rounded-lg"
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
                      className="text-xs text-[var(--color-primary)] hover:underline disabled:opacity-50"
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
                        className="text-xs text-[var(--color-text-secondary)] hover:underline"
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
            <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Add Role</p>
            <div className="flex flex-wrap gap-2">
              {availableRoles.map((role) => (
                <button
                  key={role}
                  onClick={() => handleAddRole(role)}
                  disabled={actionInProgress === role}
                  className="px-3 py-1.5 text-xs font-medium border border-[var(--color-border)] rounded-full hover:bg-[var(--color-border-subtle)] disabled:opacity-50 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  {t(`userManagement.roles.${role.toLowerCase()}`)}
                </button>
              ))}
            </div>
            {(hasStudent || hasInstructor) && (
              <p className="text-xs text-[var(--color-text-secondary)] mt-2 italic">
                Student and Instructor roles are mutually exclusive — remove the existing one to add the other.
              </p>
            )}
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full h-10 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
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
  const platformLocale = usePlatformLocale();

  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, hasNext: false, hasPrev: false });
  const [stats, setStats] = useState<{
    total: number;
    active: number;
    pending: number;
    suspended: number;
    byRole?: Record<string, number>;
  }>({ total: 0, active: 0, pending: 0, suspended: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Pre-fill search from `?q=` so other admin surfaces (e.g. the
  // courses page's "view enrolled students" modal) can deep-link
  // directly to a filtered user list.
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q") || "";
  const [searchInput, setSearchInput] = useState(initialQ);
  const [searchQuery, setSearchQuery] = useState(initialQ);
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [managingRolesUser, setManagingRolesUser] = useState<User | null>(null);
  const [viewingDevicesUser, setViewingDevicesUser] = useState<User | null>(null);
  // Right-side detail drawer (View Profile action). Renders the full
  // user record with sections for contact, professional, demographics,
  // social, roles, and login history.
  const [detailUser, setDetailUser] = useState<User | null>(null);

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
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role.toLowerCase()) {
      case "admin":
      case "super_admin":
        return "bg-[var(--color-text-primary)] text-white";
      case "instructor":
        return "bg-[var(--color-border-subtle)] text-[#1D4ED8]";
      case "student":
        return "bg-[#DCFCE7] text-[#16A34A]";
      case "teaching_assistant":
        return "bg-[#CCFBF1] text-[#0D9488]";
      case "manager":
        return "bg-[#EDE9FE] text-[#7C3AED]";
      case "finance":
        return "bg-[#FEF3C7] text-[#D97706]";
      case "support":
        return "bg-[var(--color-border-subtle)] text-[var(--color-primary-dark)]";
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
      case "inactive":
        return "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
      default:
        return "bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]";
    }
  };

  const getAvatarBgColor = (role: string) => {
    switch (role.toLowerCase()) {
      case "admin":
      case "super_admin":
        return "bg-[var(--color-text-primary)]";
      case "instructor":
        return "bg-[var(--color-primary)]";
      case "student":
        return "bg-[#22C55E]";
      case "teaching_assistant":
        return "bg-[#0D9488]";
      case "manager":
        return "bg-[#8B5CF6]";
      case "finance":
        return "bg-[#D97706]";
      case "support":
        return "bg-[var(--color-primary-dark)]";
      default:
        return "bg-[var(--color-text-secondary)]";
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

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await adminApi.exportUsers({
        search: searchQuery || undefined,
        role: roleFilter !== "all" ? roleFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
      });
      toast.success(t("usersPage.exportSuccess"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("usersPage.exportFailed"),
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <AdminNavbar admin={adminProfile} />

      <div className="bg-[var(--color-surface-page)] min-h-screen">
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
                    {t("usersPage.title")}
                  </h1>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                    {t("usersPage.subtitle")}
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 btn-gold text-[var(--color-button-text)] rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  <span className="text-sm font-medium">{t("usersPage.addUser")}</span>
                </button>
              </div>

              {/* Top stats — population health at a glance */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <StatCard
                  icon={UsersIcon}
                  iconColor="text-[var(--color-primary)]"
                  iconBg="bg-[var(--color-border-subtle)]"
                  label={t("usersPage.stats.total")}
                  value={stats.total}
                />
                <StatCard
                  icon={ShieldCheck}
                  iconColor="text-[#16A34A]"
                  iconBg="bg-[#DCFCE7]"
                  label={t("usersPage.stats.active")}
                  value={stats.active}
                  valueClass="text-[#16A34A]"
                />
                <StatCard
                  icon={Clock}
                  iconColor="text-[#B45309]"
                  iconBg="bg-[#FEF3C7]"
                  label={t("usersPage.stats.pending")}
                  value={stats.pending}
                  valueClass="text-[#B45309]"
                />
                <StatCard
                  icon={UserX}
                  iconColor="text-[#DC2626]"
                  iconBg="bg-[#FEE2E2]"
                  label={t("usersPage.stats.suspended")}
                  value={stats.suspended}
                  valueClass="text-[#DC2626]"
                />
              </div>

              {/* Role breakdown — clickable to filter the table to that role */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-3 mb-6">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-secondary)] mb-2 px-1">
                  {t("usersPage.stats.byRoleLabel")}
                </p>
                <div className="flex flex-wrap gap-2">
                  <RoleChip
                    active={roleFilter === "all"}
                    icon={UsersIcon}
                    accent="#64748B"
                    label={t("usersPage.filters.allRoles")}
                    count={stats.total}
                    onClick={() => setRoleFilter("all")}
                  />
                  {ROLE_ORDER.map((role) => {
                    const count = stats.byRole?.[role] ?? 0;
                    const meta = ROLE_META[role];
                    return (
                      <RoleChip
                        key={role}
                        active={roleFilter === role.toLowerCase()}
                        icon={meta.icon}
                        accent={meta.accent}
                        label={t(`userManagement.roles.${role.toLowerCase()}`)}
                        count={count}
                        onClick={() => setRoleFilter(role.toLowerCase())}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Filters and Search */}
              <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] p-4 mb-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-secondary)] ${isRTL ? "right-3" : "left-3"}`} />
                    <input
                      type="text"
                      placeholder={t("usersPage.searchPlaceholder")}
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      className={`w-full h-10 border border-[var(--color-input-border)] rounded-lg text-sm ${isRTL ? "pr-10 pl-4" : "pl-10 pr-4"} focus:outline-none focus:border-[#002D87]`}
                    />
                  </div>

                  <Select
                    value={roleFilter}
                    onChange={setRoleFilter}
                    className="w-40"
                    options={[
                      { value: "all", label: t("usersPage.filters.allRoles") },
                      { value: "admin", label: t("userManagement.roles.admin") },
                      { value: "instructor", label: t("userManagement.roles.instructor") },
                      { value: "student", label: t("userManagement.roles.student") },
                      { value: "teaching_assistant", label: t("userManagement.roles.teaching_assistant") },
                      { value: "manager", label: t("userManagement.roles.manager") },
                      { value: "finance", label: t("userManagement.roles.finance") },
                      { value: "support", label: t("userManagement.roles.support") },
                    ]}
                  />

                  <Select
                    value={statusFilter}
                    onChange={setStatusFilter}
                    className="w-40"
                    options={[
                      { value: "all", label: t("usersPage.filters.allStatus") },
                      { value: "active", label: t("userManagement.statuses.active") },
                      { value: "pending", label: t("userManagement.statuses.pending") },
                      { value: "suspended", label: t("userManagement.statuses.suspended") },
                    ]}
                  />

                  <button
                    type="button"
                    onClick={handleExport}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-4 h-10 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isExporting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    {t("usersPage.export")}
                  </button>
                </div>
              </div>

              {/* Loading State */}
              {isLoadingUsers && (
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <TableRowSkeleton key={i} cols={5} />
                  ))}
                </div>
              )}

              {/* Error State */}
              {fetchError && !isLoadingUsers && (
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] py-16 flex flex-col items-center justify-center" role="alert">
                  <AlertCircle className="w-8 h-8 text-[#DC2626] mb-3" />
                  <p className="text-sm text-[#DC2626] mb-4">{fetchError}</p>
                  <button
                    onClick={fetchUsers}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] rounded-lg hover:bg-[#001d5a] transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retry
                  </button>
                </div>
              )}

              {/* Users Table */}
              {!isLoadingUsers && !fetchError && (
                <>
                <div className="bg-[var(--color-surface-card)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                  <div className="overflow-x-auto scrollbar-hide">
                    <table className="w-full">
                      <thead className="bg-[var(--color-surface-page)] border-b border-[var(--color-border)]">
                        <tr>
                          <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                            {t("usersPage.table.user")}
                          </th>
                          <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                            {t("usersPage.table.role")}
                          </th>
                          <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                            {t("usersPage.table.status")}
                          </th>
                          <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                            {t("usersPage.table.lastLogin")}
                          </th>
                          <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase hidden lg:table-cell ${isRTL ? "text-right" : "text-left"}`}>
                            {t("usersPage.table.lastIp")}
                          </th>
                          <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                            {t("usersPage.table.created")}
                          </th>
                          <th className={`px-4 py-3 text-xs font-medium text-[var(--color-text-secondary)] uppercase ${isRTL ? "text-right" : "text-left"}`}>
                            {t("usersPage.table.actions")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => {
                          const status = getUserStatus(user);
                          const roleKey = user.activeRole.toLowerCase();
                          return (
                            <tr
                              key={user.id}
                              className="border-b border-[var(--color-border-subtle)] hover:bg-[var(--color-border-subtle)] transition-colors cursor-pointer"
                              onClick={(e) => {
                                // Don't open the drawer when the click
                                // originated from the actions-menu button
                                // or its open dropdown.
                                const target = e.target as HTMLElement;
                                if (target.closest("[data-row-action]")) return;
                                setDetailUser(user);
                              }}
                            >
                              <td className="px-4 py-3.5">
                                <div className="flex items-center gap-3">
                                  <UserAvatar user={user} size="md" showOnlineDot />
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                                      {getUserName(user)}
                                    </p>
                                    <p className="text-xs text-[var(--color-text-secondary)] truncate">
                                      {user.email}
                                    </p>
                                    {user.scfhsNumber && (
                                      <p className="text-[10px] text-[var(--color-text-secondary)] font-mono truncate mt-0.5">
                                        SCFHS · {user.scfhsNumber}
                                      </p>
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
                              <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)] whitespace-nowrap">
                                {formatRelativeTime(user.lastLoginAt, platformLocale)}
                              </td>
                              <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)] whitespace-nowrap hidden lg:table-cell">
                                {user.lastLoginIp || "—"}
                              </td>
                              <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)] whitespace-nowrap">
                                <FmtDate value={user.createdAt} variant="readable" locale={locale === "ar" ? "ar" : "en"} />
                              </td>
                              <td className="px-4 py-3.5" data-row-action>
                                <div className="relative inline-block">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenDropdownId(openDropdownId === user.id ? null : user.id);
                                    }}
                                    className="p-2 hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors"
                                    aria-haspopup="true"
                                    aria-expanded={openDropdownId === user.id}
                                  >
                                    <MoreVertical className="w-4 h-4 text-[var(--color-text-secondary)]" />
                                  </button>

                                  {openDropdownId === user.id && (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      className={`absolute top-full mt-1 bg-[var(--color-surface-card)] rounded-lg shadow-lg border border-[var(--color-border)] py-1 min-w-[200px] z-20 ${
                                        isRTL ? "left-0" : "right-0"
                                      }`}
                                      role="menu"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDetailUser(user);
                                          setOpenDropdownId(null);
                                        }}
                                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-start text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] whitespace-nowrap"
                                        role="menuitem"
                                      >
                                        <Eye className="w-4 h-4 flex-shrink-0" />
                                        <span>{t("usersPage.actions.viewProfile")}</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingUser(user);
                                          setOpenDropdownId(null);
                                        }}
                                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-start text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] whitespace-nowrap"
                                        role="menuitem"
                                      >
                                        <Edit className="w-4 h-4 flex-shrink-0" />
                                        <span>{t("usersPage.actions.edit")}</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setManagingRolesUser(user);
                                          setOpenDropdownId(null);
                                        }}
                                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-start text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] whitespace-nowrap"
                                        role="menuitem"
                                      >
                                        <Shield className="w-4 h-4 flex-shrink-0" />
                                        <span>{t("usersPage.actions.manageRoles")}</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setViewingDevicesUser(user);
                                          setOpenDropdownId(null);
                                        }}
                                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-start text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] whitespace-nowrap"
                                        role="menuitem"
                                      >
                                        <Smartphone className="w-4 h-4 flex-shrink-0" />
                                        <span>{t("usersPage.actions.devices")}</span>
                                      </button>
                                      <div className="border-t border-[var(--color-border)] my-1" />
                                      <button
                                        type="button"
                                        onClick={() => handleSuspendToggle(user)}
                                        className={`flex items-center gap-2 w-full px-4 py-2 text-sm text-start whitespace-nowrap ${
                                          user.isActive
                                            ? "text-[#B45309] hover:bg-[#FEF3C7]"
                                            : "text-[#15803D] hover:bg-[#DCFCE7]"
                                        }`}
                                        role="menuitem"
                                      >
                                        <UserX className="w-4 h-4 flex-shrink-0" />
                                        <span>
                                          {user.isActive
                                            ? t("usersPage.actions.suspend")
                                            : t("usersPage.actions.activate")}
                                        </span>
                                      </button>
                                      {user.id !== currentUser?.id && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setDeletingUser(user);
                                            setOpenDropdownId(null);
                                          }}
                                          className="flex items-center gap-2 w-full px-4 py-2 text-sm text-start text-[#DC2626] hover:bg-[#FEE2E2] whitespace-nowrap"
                                          role="menuitem"
                                        >
                                          <Trash2 className="w-4 h-4 flex-shrink-0" />
                                          <span>{t("usersPage.actions.delete")}</span>
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
                      <p className="text-[var(--color-text-secondary)]">{t("usersPage.noUsers")}</p>
                    </div>
                  )}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Showing {(currentPage - 1) * 10 + 1} to {Math.min(currentPage * 10, pagination.total)} of {pagination.total} users
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={!pagination.hasPrev}
                        className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === pagination.totalPages || Math.abs(p - currentPage) <= 1)
                        .map((p, idx, arr) => (
                          <span key={p}>
                            {idx > 0 && arr[idx - 1] !== p - 1 && (
                              <span className="px-1 text-[var(--color-text-secondary)]">...</span>
                            )}
                            <button
                              onClick={() => setCurrentPage(p)}
                              className={`w-8 h-8 text-sm rounded-lg ${
                                p === currentPage
                                  ? "bg-[var(--color-primary)] text-white"
                                  : "border border-[var(--color-border)] hover:bg-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
                              }`}
                            >
                              {p}
                            </button>
                          </span>
                        ))}
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                        disabled={!pagination.hasNext}
                        className="px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] disabled:opacity-50 disabled:cursor-not-allowed"
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

      {detailUser && (
        <UserDetailDrawer
          user={detailUser}
          currentUserId={currentUser?.id}
          onClose={() => setDetailUser(null)}
          onEdit={() => {
            setEditingUser(detailUser);
            setDetailUser(null);
          }}
          onManageRoles={() => {
            setManagingRolesUser(detailUser);
            setDetailUser(null);
          }}
          onViewDevices={() => {
            setViewingDevicesUser(detailUser);
            setDetailUser(null);
          }}
          onToggleSuspend={() => {
            handleSuspendToggle(detailUser);
            setDetailUser(null);
          }}
          onDelete={() => {
            setDeletingUser(detailUser);
            setDetailUser(null);
          }}
        />
      )}
    </>
  );
};

export default UsersContent;
