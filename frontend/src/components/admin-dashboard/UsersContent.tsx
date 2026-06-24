"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import AdminSidebar from "./AdminSidebar";
import AdminMobileSidebar from "./AdminMobileSidebar";
import AdminNavbar from "./AdminNavbar";
import { TableRowSkeleton } from "./AdminSkeletons";
import { useAuth } from "@/contexts";
import { adminApi, supportApi, User, CreateUserData, UpdateUserData, PaginatedUsersResponse } from "@/lib/api";
import { toast } from "sonner";
import UserDevicesModal from "./UserDevicesModal";
import Select from "./Select";
import SaudiPhoneInput from "@/components/shared/SaudiPhoneInput";
import {
  localPartFromStored,
  normalizeSaudiMobile,
} from "@/lib/saudi-phone";
import UserAvatar from "./users/UserAvatar";
import UserDetailDrawer from "./users/UserDetailDrawer";
import { ROLE_ORDER } from "./users/userHelpers";
import { usePlatformLocale } from "@/contexts/PlatformLocaleContext";
import { formatPlatformDateReadable, type PlatformLocaleSettings } from "@/lib/platform-locale";
import { FmtDate } from "@/components/ui/Fmt";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
  Mail,
  Send,
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
  const tPhone = useTranslations("commonSettings.phoneField");
  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    role: "STUDENT",
    supportSubRole: "agent" as string,
    supervisorId: "" as string,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active supervisors for the picker shown only when creating a
  // Support Agent. Fetched once on mount because the list is small,
  // changes rarely, and the modal lifetime is short.
  const [supervisors, setSupervisors] = useState<
    Awaited<ReturnType<typeof supportApi.listActiveSupervisors>>
  >([]);
  const [supervisorsLoading, setSupervisorsLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setSupervisorsLoading(true);
    supportApi
      .listActiveSupervisors()
      .then((rows) => {
        if (!cancelled) setSupervisors(rows || []);
      })
      .catch(() => {
        if (!cancelled) setSupervisors([]);
      })
      .finally(() => {
        if (!cancelled) setSupervisorsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.firstName || !form.lastName) {
      toast.error(tToasts("fillRequiredFields"));
      return;
    }

    // No-orphan-agent invariant: a new Support Agent must be tied to
    // a supervisor at creation time. Catch this on the client so we
    // surface a clear error before round-tripping.
    if (
      form.role === "SUPPORT" &&
      form.supportSubRole === "agent" &&
      !form.supervisorId
    ) {
      toast.error(t("usersPage.createUser.supervisorRequired"));
      return;
    }

    setIsSubmitting(true);
    try {
      // Admin no longer chooses the user's password. The BE sends a
      // magic-link invite to the new user's email so they set their
      // own — privacy + compliance win.
      const data: CreateUserData = {
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        role: form.role,
      };
      if (form.phone) {
        const normalized = normalizeSaudiMobile(form.phone);
        if (!normalized) {
          toast.error(tPhone("invalid"));
          setIsSubmitting(false);
          return;
        }
        data.phone = normalized;
      }
      if (form.role === "SUPPORT") {
        data.supportSubRole = form.supportSubRole;
        if (form.supportSubRole === "agent") {
          data.supervisorId = form.supervisorId;
        }
      }
      const result = await adminApi.createUser(data);
      if (result.inviteSent) {
        toast.success(tToasts("userCreatedInviteSent", { email: form.email }));
      } else {
        // User row was created but the email send failed — admin can
        // resend from the user list. Surface this as a warning toast
        // so the admin knows to follow up.
        toast.warning(tToasts("userCreatedInviteFailed", { email: form.email }));
      }
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

          {/* Invite-flow notice — replaces the legacy admin-typed password.
              The user gets a magic-link email to set their own password,
              so the admin never sees or chooses it. */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-border-subtle)] p-3 flex items-start gap-2">
            <Mail className="w-4 h-4 text-[var(--color-primary)] flex-shrink-0 mt-0.5" />
            <div className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              <p className="font-medium text-[var(--color-text-primary)] mb-0.5">
                {t("usersPage.inviteFlowTitle")}
              </p>
              <p>{t("usersPage.inviteFlowDescription")}</p>
            </div>
          </div>

          <SaudiPhoneInput
            value={form.phone}
            onChange={(v) => setForm({ ...form, phone: v })}
          />

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

          {/* Support Sub-Role Picker — shown only when SUPPORT role is selected */}
          {form.role === "SUPPORT" && (
            <div className="p-4 bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg">
              <label className="block text-sm font-medium text-[#1E40AF] mb-3">
                Support Sub-Role *
              </label>
              <div className="space-y-2">
                <label className="flex items-start gap-3 p-3 bg-white rounded-lg border border-[#E5E7EB] cursor-pointer hover:border-[#93C5FD] transition-colors">
                  <input
                    type="radio"
                    name="supportSubRole"
                    value="supervisor"
                    checked={form.supportSubRole === "supervisor"}
                    onChange={() => setForm({ ...form, supportSubRole: "supervisor" })}
                    className="mt-0.5 w-4 h-4 text-[#002D87]"
                  />
                  <div>
                    <span className="text-sm font-medium text-[#1F2937]">Supervisor</span>
                    <p className="text-xs text-[#6B7280] mt-0.5">
                      Sees all tickets, KPIs, manages team, can reassign and configure settings
                    </p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 bg-white rounded-lg border border-[#E5E7EB] cursor-pointer hover:border-[#93C5FD] transition-colors">
                  <input
                    type="radio"
                    name="supportSubRole"
                    value="agent"
                    checked={form.supportSubRole === "agent"}
                    onChange={() => setForm({ ...form, supportSubRole: "agent" })}
                    className="mt-0.5 w-4 h-4 text-[#002D87]"
                  />
                  <div>
                    <span className="text-sm font-medium text-[#1F2937]">Agent</span>
                    <p className="text-xs text-[#6B7280] mt-0.5">
                      Sees only assigned tickets, replies to students, handles support requests
                    </p>
                  </div>
                </label>
              </div>

              {/* Supervisor picker — required for agents so no agent
                  exists without a team supervisor. Hidden for the
                  supervisor sub-role (supervisors lead, they don't
                  belong to another team). */}
              {form.supportSubRole === "agent" && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-[#1E40AF] mb-1.5">
                    {t("usersPage.createUser.supervisorLabel")}
                  </label>
                  <p className="text-xs text-[#6B7280] mb-2">
                    {t("usersPage.createUser.supervisorHint")}
                  </p>
                  {supervisorsLoading ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-[#E5E7EB]">
                      <Loader2 className="w-4 h-4 animate-spin text-[var(--color-text-secondary)]" />
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {t("usersPage.createUser.supervisorLoading")}
                      </span>
                    </div>
                  ) : supervisors.length === 0 ? (
                    <div className="px-3 py-2 bg-[#FEF3C7] border border-[#FDE68A] rounded-lg">
                      <p className="text-xs text-[#92400E] font-medium">
                        {t("usersPage.createUser.noSupervisorsTitle")}
                      </p>
                      <p className="text-xs text-[#92400E] mt-0.5">
                        {t("usersPage.createUser.noSupervisorsHint")}
                      </p>
                    </div>
                  ) : (
                    <Select
                      value={form.supervisorId}
                      onChange={(val) =>
                        setForm({ ...form, supervisorId: val })
                      }
                      options={[
                        {
                          value: "",
                          label: t(
                            "usersPage.createUser.supervisorPlaceholder",
                          ),
                        },
                        ...supervisors.map((s) => ({
                          value: s.userId,
                          label: `${
                            [s.firstName, s.lastName].filter(Boolean).join(" ") ||
                            s.email
                          } · ${t("usersPage.createUser.teamCount", {
                            count: s.teamSize,
                          })}`,
                        })),
                      ]}
                    />
                  )}
                </div>
              )}
            </div>
          )}

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
  const tPhone = useTranslations("commonSettings.phoneField");
  const [form, setForm] = useState({
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    // Decode any stored format (E.164 or legacy free-text) → 9-digit local.
    // Legacy garbage decodes to "" — admin re-enters if they want to keep it.
    phone: localPartFromStored(user.phone),
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
      if (form.phone) {
        const normalized = normalizeSaudiMobile(form.phone);
        if (!normalized) {
          toast.error(tPhone("invalid"));
          setIsSubmitting(false);
          return;
        }
        data.phone = normalized;
      }
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

          <SaudiPhoneInput
            value={form.phone}
            onChange={(v) => setForm({ ...form, phone: v })}
          />

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
  const [showSubRolePicker, setShowSubRolePicker] = useState(false);
  const [selectedSubRole, setSelectedSubRole] = useState<string>("agent");
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>("");

  // Supervisor picker — same data source as Create User. Loaded on
  // mount so the option is ready when the admin flips to SUPPORT.
  const [supervisors, setSupervisors] = useState<
    Awaited<ReturnType<typeof supportApi.listActiveSupervisors>>
  >([]);
  useEffect(() => {
    let cancelled = false;
    supportApi
      .listActiveSupervisors()
      .then((rows) => {
        if (!cancelled) setSupervisors(rows || []);
      })
      .catch(() => {
        if (!cancelled) setSupervisors([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Reassign-team modal state — opens when the admin tries to remove
  // SUPPORT from a supervisor whose team isn't empty. Reassigning is
  // the only way to unblock removal (server enforces the same rule).
  const [reassignFrom, setReassignFrom] = useState<{
    fromSupervisorId: string;
    teamSize: number;
    thenRemoveSupport: boolean;
  } | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState<string>("");
  const [reassigning, setReassigning] = useState(false);

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
    // If adding SUPPORT role, show sub-role picker first
    if (role === "SUPPORT" && !showSubRolePicker) {
      setShowSubRolePicker(true);
      return;
    }

    // Adding SUPPORT/agent must include a supervisor — same invariant
    // as Create User. The BE rejects without one; catch on the client
    // for a clean error path.
    if (
      role === "SUPPORT" &&
      selectedSubRole === "agent" &&
      !selectedSupervisorId
    ) {
      toast.error(t("usersPage.createUser.supervisorRequired"));
      return;
    }

    setActionInProgress(role);
    try {
      const subRole = role === "SUPPORT" ? selectedSubRole : undefined;
      const supervisorId =
        role === "SUPPORT" && selectedSubRole === "agent"
          ? selectedSupervisorId
          : undefined;
      const result = await adminApi.assignRole(
        user.id,
        role,
        subRole,
        supervisorId,
      );
      setUserRoles(result.roles);
      setShowSubRolePicker(false);
      setSelectedSupervisorId("");
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
      // The BE blocks SUPPORT removal when this user is a supervisor
      // with active team members. Detect that error message and pop
      // the reassign-team modal so the admin can move agents to
      // another supervisor and retry in one continuous flow.
      const msg = err instanceof Error ? err.message : String(err);
      const supervisorTeamBlock = /supervisor still has (\d+) agent/i.exec(msg);
      if (role === "SUPPORT" && supervisorTeamBlock) {
        setReassignFrom({
          fromSupervisorId: user.id,
          teamSize: Number(supervisorTeamBlock[1]) || 1,
          thenRemoveSupport: true,
        });
      } else {
        toast.error(msg || "Failed to remove role");
      }
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReassignAndContinue = async () => {
    if (!reassignFrom || !reassignTargetId) {
      toast.error(t("usersPage.manageRoles.reassignPickTarget"));
      return;
    }
    setReassigning(true);
    try {
      const res = await supportApi.reassignSupervisorTeam({
        fromSupervisorId: reassignFrom.fromSupervisorId,
        toSupervisorId: reassignTargetId,
      });
      toast.success(
        t("usersPage.manageRoles.reassignSuccess", { count: res.moved }),
      );
      const followUp = reassignFrom.thenRemoveSupport;
      setReassignFrom(null);
      setReassignTargetId("");
      if (followUp) {
        // Retry the SUPPORT removal now that the team is empty.
        try {
          const result = await adminApi.removeRole(user.id, "SUPPORT");
          setUserRoles(result.roles);
          if (activeRole === "SUPPORT" && result.roles.length > 0) {
            setActiveRole(result.roles[0]);
          }
          toast.success(
            `${t("userManagement.roles.support")} role removed`,
          );
          onUpdated();
        } catch (retryErr) {
          toast.error(
            retryErr instanceof Error
              ? retryErr.message
              : "Failed to remove role",
          );
        }
      } else {
        onUpdated();
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to reassign team",
      );
    } finally {
      setReassigning(false);
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

            {/* Support Sub-Role Picker */}
            {showSubRolePicker && (
              <div className="mt-4 p-4 bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg">
                <p className="text-sm font-medium text-[#1E40AF] mb-3">
                  Select Support Sub-Role
                </p>
                <div className="flex gap-3 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="supportSubRole"
                      value="supervisor"
                      checked={selectedSubRole === "supervisor"}
                      onChange={() => setSelectedSubRole("supervisor")}
                      className="w-4 h-4 text-[#002D87]"
                    />
                    <div>
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">Supervisor</span>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        Sees all tickets, KPIs, can reassign and configure
                      </p>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="supportSubRole"
                      value="agent"
                      checked={selectedSubRole === "agent"}
                      onChange={() => setSelectedSubRole("agent")}
                      className="w-4 h-4 text-[#002D87]"
                    />
                    <div>
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">Agent</span>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        Sees assigned tickets, replies to students
                      </p>
                    </div>
                  </label>
                </div>

                {/* Supervisor picker — required for the agent sub-role. */}
                {selectedSubRole === "agent" && (
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-[#1E40AF] mb-1">
                      {t("usersPage.createUser.supervisorLabel")}
                    </label>
                    {supervisors.length === 0 ? (
                      <div className="px-3 py-2 bg-[#FEF3C7] border border-[#FDE68A] rounded-lg text-xs text-[#92400E]">
                        {t("usersPage.createUser.noSupervisorsHint")}
                      </div>
                    ) : (
                      <Select
                        value={selectedSupervisorId}
                        onChange={(val) => setSelectedSupervisorId(val)}
                        options={[
                          {
                            value: "",
                            label: t(
                              "usersPage.createUser.supervisorPlaceholder",
                            ),
                          },
                          ...supervisors.map((s) => ({
                            value: s.userId,
                            label:
                              [s.firstName, s.lastName]
                                .filter(Boolean)
                                .join(" ") || s.email,
                          })),
                        ]}
                      />
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => handleAddRole("SUPPORT")}
                    disabled={actionInProgress === "SUPPORT"}
                    className="px-3 py-1.5 text-xs font-medium bg-[#002D87] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    {actionInProgress === "SUPPORT" ? "Adding..." : "Confirm & Add Support Role"}
                  </button>
                  <button
                    onClick={() => setShowSubRolePicker(false)}
                    className="px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              </div>
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

        {/* Reassign-team modal — appears when admin tries to remove
            SUPPORT from a supervisor whose team isn't empty. The team
            must move before the role can be dropped. */}
        {reassignFrom && (
          <ModalBackdrop onClose={() => setReassignFrom(null)}>
            <div className="p-6">
              <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">
                {t("usersPage.manageRoles.reassignTitle")}
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                {t("usersPage.manageRoles.reassignDescription", {
                  count: reassignFrom.teamSize,
                  name: getUserName(user),
                })}
              </p>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                {t("usersPage.manageRoles.reassignTargetLabel")}
              </label>
              <Select
                value={reassignTargetId}
                onChange={(val) => setReassignTargetId(val)}
                options={[
                  {
                    value: "",
                    label: t("usersPage.manageRoles.reassignTargetPlaceholder"),
                  },
                  ...supervisors
                    .filter((s) => s.userId !== reassignFrom.fromSupervisorId)
                    .map((s) => ({
                      value: s.userId,
                      label:
                        [s.firstName, s.lastName].filter(Boolean).join(" ") ||
                        s.email,
                    })),
                ]}
              />
              <div className="flex gap-3 mt-5">
                <button
                  type="button"
                  onClick={() => setReassignFrom(null)}
                  disabled={reassigning}
                  className="flex-1 h-10 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] disabled:opacity-50"
                >
                  {t("usersPage.manageRoles.reassignCancel")}
                </button>
                <button
                  type="button"
                  onClick={handleReassignAndContinue}
                  disabled={reassigning || !reassignTargetId}
                  className="flex-1 h-10 bg-[#002D87] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {reassigning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  {t("usersPage.manageRoles.reassignConfirm")}
                </button>
              </div>
            </div>
          </ModalBackdrop>
        )}
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
  };

  const handleResendInvite = async (user: User) => {
    try {
      await adminApi.resendUserInvite(user.id);
      toast.success(t("usersPage.inviteResent", { email: user.email }));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("usersPage.inviteResendFailed"),
      );
    }
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
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap ${
                                  user.activeRole === "SUPPORT" && user.supportSubRole === "supervisor"
                                    ? "bg-[#EDE9FE] text-[#7C3AED]"
                                    : getRoleBadgeStyle(user.activeRole)
                                }`}>
                                  {user.activeRole === "SUPPORT" && user.supportSubRole
                                    ? `${t(`userManagement.roles.${roleKey}`)} · ${user.supportSubRole.charAt(0).toUpperCase() + user.supportSubRole.slice(1)}`
                                    : t(`userManagement.roles.${roleKey}`)}
                                </span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap ${getStatusBadgeStyle(status)}`}>
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
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={(e) => e.stopPropagation()}
                                      className="p-2 hover:bg-[var(--color-border-subtle)] rounded-lg transition-colors"
                                      aria-label={t("usersPage.table.actions")}
                                    >
                                      <MoreVertical className="w-4 h-4 text-[var(--color-text-secondary)]" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align={isRTL ? "start" : "end"}
                                    sideOffset={4}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <DropdownMenuItem
                                      onSelect={() => setDetailUser(user)}
                                    >
                                      <Eye className="w-4 h-4 flex-shrink-0" />
                                      <span>{t("usersPage.actions.viewProfile")}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onSelect={() => setEditingUser(user)}
                                    >
                                      <Edit className="w-4 h-4 flex-shrink-0" />
                                      <span>{t("usersPage.actions.edit")}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onSelect={() => setManagingRolesUser(user)}
                                    >
                                      <Shield className="w-4 h-4 flex-shrink-0" />
                                      <span>{t("usersPage.actions.manageRoles")}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onSelect={() => setViewingDevicesUser(user)}
                                    >
                                      <Smartphone className="w-4 h-4 flex-shrink-0" />
                                      <span>{t("usersPage.actions.devices")}</span>
                                    </DropdownMenuItem>
                                    {/* Resend invite — only meaningful for
                                        admin-created users who haven't yet
                                        completed password setup. The 24h
                                        magic-link token may have expired;
                                        this issues a fresh one and re-mails. */}
                                    {!user.isVerified && (
                                      <DropdownMenuItem
                                        onSelect={() => handleResendInvite(user)}
                                        className="text-[var(--color-primary)] hover:bg-[var(--color-border-subtle)] focus:bg-[var(--color-border-subtle)]"
                                      >
                                        <Send className="w-4 h-4 flex-shrink-0" />
                                        <span>{t("usersPage.actions.resendInvite")}</span>
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onSelect={() => handleSuspendToggle(user)}
                                      className={
                                        user.isActive
                                          ? "text-[#B45309] hover:bg-[#FEF3C7] focus:bg-[#FEF3C7]"
                                          : "text-[#15803D] hover:bg-[#DCFCE7] focus:bg-[#DCFCE7]"
                                      }
                                    >
                                      <UserX className="w-4 h-4 flex-shrink-0" />
                                      <span>
                                        {user.isActive
                                          ? t("usersPage.actions.suspend")
                                          : t("usersPage.actions.activate")}
                                      </span>
                                    </DropdownMenuItem>
                                    {user.id !== currentUser?.id && (
                                      <DropdownMenuItem
                                        danger
                                        onSelect={() => setDeletingUser(user)}
                                      >
                                        <Trash2 className="w-4 h-4 flex-shrink-0" />
                                        <span>{t("usersPage.actions.delete")}</span>
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
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
