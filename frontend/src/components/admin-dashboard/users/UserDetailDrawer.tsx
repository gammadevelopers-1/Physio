"use client";

import { useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  X,
  Mail,
  Phone,
  IdCard,
  Globe2,
  Briefcase,
  GraduationCap,
  Calendar,
  Linkedin,
  Twitter,
  Building,
  Cake,
  UserCircle2,
  Shield,
  Clock,
  MapPin,
  Edit,
  Smartphone,
  UserX,
  Trash2,
} from "lucide-react";
import type { User } from "@/lib/api";
import UserAvatar from "./UserAvatar";
import {
  getUserName,
  getUserNameAr,
  getUserStatus,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  getRoleBadgeStyle,
  getStatusBadgeStyle,
} from "./userHelpers";
import { usePlatformLocale } from "@/contexts/PlatformLocaleContext";

interface Props {
  user: User;
  currentUserId?: string;
  onClose: () => void;
  onEdit: () => void;
  onManageRoles: () => void;
  onViewDevices: () => void;
  onToggleSuspend: () => void;
  onDelete: () => void;
}

/**
 * Slide-in profile panel showing every field we have on a user.
 * Sectioned: Identity, Contact, Professional, Demographics, Roles,
 * Login activity, Quick actions at the bottom.
 */
export default function UserDetailDrawer({
  user,
  currentUserId,
  onClose,
  onEdit,
  onManageRoles,
  onViewDevices,
  onToggleSuspend,
  onDelete,
}: Props) {
  const t = useTranslations("adminDashboard.usersPage");
  const tRoles = useTranslations("userManagement.roles");
  const tStatus = useTranslations("userManagement.statuses");
  const locale = useLocale();
  const isRTL = locale === "ar";
  const platformLocale = usePlatformLocale();

  // Esc to close
  useEffect(() => {
    const handle = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handle);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handle);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const status = getUserStatus(user);
  const arabicName = getUserNameAr(user);

  return (
    <div
      className="fixed inset-0 z-50 flex"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Drawer */}
      <aside
        className={`relative ms-auto h-full w-full max-w-md bg-[var(--color-surface-card)] shadow-2xl flex flex-col ${
          isRTL ? "me-0" : "ms-auto"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-5 border-b border-[var(--color-border)]">
          <button
            type="button"
            onClick={onClose}
            aria-label={t("detail.close")}
            className="absolute top-4 end-4 p-2 hover:bg-[var(--color-border-subtle)] rounded-lg text-[var(--color-text-secondary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-4">
            <UserAvatar user={user} size="xl" showOnlineDot />
            <div className="min-w-0 flex-1 pt-1">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] truncate">
                {getUserName(user)}
              </h2>
              {arabicName && (
                <p className="text-sm text-[var(--color-text-secondary)] truncate" dir="rtl">
                  {arabicName}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span
                  className={`px-2.5 py-1 text-xs font-medium rounded-full ${getRoleBadgeStyle(user.activeRole)}`}
                >
                  {tRoles(user.activeRole.toLowerCase())}
                </span>
                <span
                  className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusBadgeStyle(status)}`}
                >
                  {tStatus(status)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Contact */}
          <Section title={t("detail.contact")}>
            <Field icon={Mail} label={t("detail.email")} value={user.email} mono />
            {user.phone && (
              <Field icon={Phone} label={t("detail.phone")} value={user.phone} />
            )}
          </Section>

          {/* Professional */}
          {(user.department ||
            user.specialty ||
            user.profession ||
            user.qualification ||
            user.scfhsNumber) && (
            <Section title={t("detail.professional")}>
              {user.department && (
                <Field
                  icon={Building}
                  label={t("detail.department")}
                  value={user.department}
                />
              )}
              {user.specialty && (
                <Field
                  icon={Briefcase}
                  label={t("detail.specialty")}
                  value={user.specialty}
                />
              )}
              {user.profession && (
                <Field
                  icon={UserCircle2}
                  label={t("detail.profession")}
                  value={user.profession}
                />
              )}
              {user.qualification && (
                <Field
                  icon={GraduationCap}
                  label={t("detail.qualification")}
                  value={user.qualification}
                />
              )}
              {user.scfhsNumber && (
                <Field
                  icon={IdCard}
                  label={t("detail.scfhs")}
                  value={user.scfhsNumber}
                  mono
                />
              )}
            </Section>
          )}

          {/* Demographics */}
          {(user.nationality || user.gender || user.dateOfBirth || user.nationalId) && (
            <Section title={t("detail.demographics")}>
              {user.nationality && (
                <Field
                  icon={Globe2}
                  label={t("detail.nationality")}
                  value={user.nationality}
                />
              )}
              {user.gender && (
                <Field
                  icon={UserCircle2}
                  label={t("detail.gender")}
                  value={user.gender}
                />
              )}
              {user.dateOfBirth && (
                <Field
                  icon={Cake}
                  label={t("detail.dateOfBirth")}
                  value={formatDate(user.dateOfBirth, platformLocale)}
                />
              )}
              {user.nationalId && (
                <Field
                  icon={IdCard}
                  label={t("detail.nationalId")}
                  value={user.nationalId}
                  mono
                />
              )}
            </Section>
          )}

          {/* Social / bio */}
          {(user.bio || user.linkedin || user.twitter) && (
            <Section title={t("detail.bioSocial")}>
              {user.bio && (
                <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                  {user.bio}
                </p>
              )}
              {user.linkedin && (
                <a
                  href={
                    user.linkedin.startsWith("http")
                      ? user.linkedin
                      : `https://linkedin.com/in/${user.linkedin}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-[#0066FF] hover:underline"
                >
                  <Linkedin className="w-4 h-4" />
                  {user.linkedin}
                </a>
              )}
              {user.twitter && (
                <a
                  href={
                    user.twitter.startsWith("http")
                      ? user.twitter
                      : `https://twitter.com/${user.twitter}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-[#0066FF] hover:underline"
                >
                  <Twitter className="w-4 h-4" />
                  {user.twitter}
                </a>
              )}
            </Section>
          )}

          {/* All assigned roles */}
          {user.roles.length > 1 && (
            <Section title={t("detail.allRoles")}>
              <div className="flex flex-wrap gap-1.5">
                {user.roles.map((role) => (
                  <span
                    key={role}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${getRoleBadgeStyle(role)}`}
                  >
                    <Shield className="w-3 h-3" />
                    {tRoles(role.toLowerCase())}
                    {role === user.activeRole && (
                      <span className="text-[10px] opacity-70">
                        · {t("detail.activeRoleMark")}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Login activity */}
          <Section title={t("detail.loginActivity")}>
            <Field
              icon={Clock}
              label={t("detail.lastLogin")}
              value={`${formatRelativeTime(user.lastLoginAt, platformLocale)} · ${formatDateTime(user.lastLoginAt, platformLocale)}`}
            />
            {user.lastLoginIp && (
              <Field
                icon={MapPin}
                label={t("detail.lastIp")}
                value={user.lastLoginIp}
                mono
              />
            )}
            <Field
              icon={Calendar}
              label={t("detail.joined")}
              value={formatDate(user.createdAt, platformLocale)}
            />
          </Section>
        </div>

        {/* Actions footer */}
        <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface-page)]">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
            >
              <Edit className="w-4 h-4" />
              {t("actions.edit")}
            </button>
            <button
              type="button"
              onClick={onManageRoles}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
            >
              <Shield className="w-4 h-4" />
              {t("actions.manageRoles")}
            </button>
            <button
              type="button"
              onClick={onViewDevices}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-border-subtle)] transition-colors"
            >
              <Smartphone className="w-4 h-4" />
              {t("actions.devices")}
            </button>
            <button
              type="button"
              onClick={onToggleSuspend}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                user.isActive
                  ? "text-[#B45309] border border-[#FDE68A] bg-[#FFFBEB] hover:bg-[#FEF3C7]"
                  : "text-[#15803D] border border-[#BBF7D0] bg-[#F0FDF4] hover:bg-[#DCFCE7]"
              }`}
            >
              <UserX className="w-4 h-4" />
              {user.isActive ? t("actions.suspend") : t("actions.activate")}
            </button>
          </div>
          {user.id !== currentUserId && (
            <button
              type="button"
              onClick={onDelete}
              className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-[#DC2626] border border-[#FCA5A5] bg-[#FEF2F2] rounded-lg hover:bg-[#FEE2E2] transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              {t("actions.delete")}
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

// ─── Local helpers ──────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-secondary)] mb-2.5">
        {title}
      </h3>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)] mb-0.5">
          {label}
        </p>
        <p
          className={`text-sm text-[var(--color-text-primary)] break-words ${
            mono ? "font-mono" : ""
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
