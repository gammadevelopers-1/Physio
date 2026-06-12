"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  LayoutDashboard,
  ClipboardList,
  Inbox,
  Users,
  BookOpen,
  BarChart3,
  Settings,
  Pencil,
  Headphones,
  Upload,
  Trash2,
  Bell,
  GraduationCap,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { profileApi, SIDEBAR_TAB_KEYS, type SidebarTabKey } from "@/lib/api";
import { useSupportOnlineStatus } from "@/hooks/useSupportOnlineStatus";
import SidebarBadge from "@/components/SidebarBadge";

interface SupportProfile {
  name: string;
  email: string;
  resolved: number;
  csat: number | null;  // 1-5 star average, null when no responses yet
  avgFRT: string;       // pre-formatted ("18m", "2h 15m", "--")
  avatar?: string;
  totalTickets?: number;
  hasAnyTickets?: boolean;
  isLoading?: boolean;
}

interface SupportSidebarProps {
  profile: SupportProfile;
  supportSubRole?: string | null;
}

const SupportSidebar = ({ profile, supportSubRole }: SupportSidebarProps) => {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("supportDashboard");
  const isRTL = locale === "ar";
  const { user, refreshUser } = useAuth();
  const { isOnline } = useSupportOnlineStatus();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  const closeAvatarMenu = useCallback(() => setAvatarMenuOpen(false), []);

  useEffect(() => {
    if (!avatarMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        closeAvatarMenu();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [avatarMenuOpen, closeAvatarMenu]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { url } = await profileApi.uploadAvatar(file);
      await profileApi.update({ avatar: url });
      await refreshUser();
      toast.success("Profile photo updated");
    } catch {
      toast.error("Failed to upload photo");
    }
    e.target.value = "";
  };

  const handleRemoveAvatar = async () => {
    try {
      await profileApi.update({ avatar: null });
      await refreshUser();
      toast.success("Profile photo removed");
    } catch {
      toast.error("Failed to remove photo");
    }
  };

  const isSupervisor = supportSubRole === "supervisor";

  // Build base path based on sub-role
  const basePath = isSupervisor
    ? `/${locale}/dashboard/support/supervisor`
    : `/${locale}/dashboard/support/agent`;

  const allNavItems: Array<{
    label: string;
    href: string;
    icon: typeof LayoutDashboard;
    showFor: "all" | "supervisor";
    badgeKey?: SidebarTabKey;
    badgeTone?: "info" | "alert";
  }> = [
    {
      label: t("sidebar.dashboard"),
      href: basePath,
      icon: LayoutDashboard,
      showFor: "all",
    },
    {
      label: t("sidebar.allTickets"),
      href: `${basePath}/tickets`,
      icon: ClipboardList,
      showFor: "supervisor",
      badgeKey: SIDEBAR_TAB_KEYS.SUPPORT_ALL_TICKETS,
    },
    {
      label: t("sidebar.myTickets"),
      href: `${basePath}/my-tickets`,
      icon: Inbox,
      showFor: "all",
      badgeKey: SIDEBAR_TAB_KEYS.SUPPORT_MY_TICKETS,
    },
    {
      label: t("sidebar.team"),
      href: `${basePath}/team`,
      icon: Users,
      showFor: "supervisor",
      badgeKey: SIDEBAR_TAB_KEYS.SUPPORT_TEAM,
    },
    {
      label: t("sidebar.alerts"),
      href: `${basePath}/alerts`,
      icon: Bell,
      showFor: "supervisor",
      badgeKey: SIDEBAR_TAB_KEYS.SUPPORT_ALERTS,
      badgeTone: "alert",
    },
    {
      label: t("sidebar.knowledgeBase"),
      href: `${basePath}/kb`,
      icon: BookOpen,
      showFor: "all",
    },
    {
      // Trainer applications — read-only lookup so support can answer
      // applicant questions without admin access. Shared path (not
      // sub-role specific) since the page is read-only either way.
      label: t("sidebar.trainerApplications"),
      href: `/${locale}/dashboard/support/trainer-applications`,
      icon: GraduationCap,
      showFor: "all",
      badgeKey: SIDEBAR_TAB_KEYS.SUPPORT_TRAINER_APPS,
    },
    {
      label: t("sidebar.reports"),
      href: `${basePath}/reports`,
      icon: BarChart3,
      showFor: "supervisor",
    },
    {
      label: t("sidebar.settings"),
      href: `${basePath}/settings`,
      icon: Settings,
      showFor: "all",
    },
  ];

  const navItems = allNavItems.filter(
    (item) => item.showFor === "all" || (item.showFor === "supervisor" && isSupervisor),
  );

  const isActive = (href: string) => {
    if (pathname === href) return true;
    // For dashboard root, only exact match
    if (href === basePath) return pathname === href;
    // For sub-pages, match prefix
    return pathname.startsWith(href + "/");
  };

  return (
    <aside className="w-full lg:w-[280px] flex flex-col gap-4">
      {/* Profile Card */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-6">
        {/* Profile Section */}
        <div className="flex flex-col items-center">
          {/* Avatar with edit button */}
          <div className="relative mb-3">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-[var(--color-border-subtle)] flex items-center justify-center relative">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={profile.name}
                  width={80}
                  height={80}
                  className="object-cover w-full h-full"
                />
              ) : (
                <img
                  src="/images/default-avatar.png"
                  alt={profile.name}
                  width={80}
                  height={80}
                  className="object-cover w-full h-full"
                />
              )}
              {/* Online/offline badge — driven by real business hours */}
              <div
                className={`absolute -bottom-1 ${isRTL ? "-left-1" : "-right-1"} w-6 h-6 rounded-full flex items-center justify-center border-2 border-white ${
                  isOnline === false ? "bg-[var(--color-text-secondary)]" : "bg-[#22C55E]"
                }`}
                title={
                  isOnline === null
                    ? ""
                    : isOnline
                      ? t("sidebar.online")
                      : t("sidebar.offline")
                }
              >
                <Headphones className="w-3 h-3 text-white" />
              </div>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <div ref={avatarMenuRef}>
              <button
                onClick={() => setAvatarMenuOpen((v) => !v)}
                className={`absolute bottom-0 ${isRTL ? "left-0" : "right-0"} w-7 h-7 bg-[var(--color-primary)] rounded-full flex items-center justify-center border-2 border-white cursor-pointer hover:bg-[#001d5e] transition-colors`}
                aria-label={t("sidebar.editProfile")}
                aria-haspopup="true"
                aria-expanded={avatarMenuOpen}
              >
                <Pencil className="w-3.5 h-3.5 text-white" />
              </button>
              {avatarMenuOpen && (
                <div className={`absolute top-full mt-1 ${isRTL ? "right-0" : "left-0"} bg-white rounded-lg shadow-lg border border-[var(--color-border)] py-1 z-50 min-w-[160px]`} role="menu">
                  <button
                    onClick={() => { avatarInputRef.current?.click(); setAvatarMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] transition-colors cursor-pointer"
                    role="menuitem"
                  >
                    <Upload className="w-4 h-4 text-[var(--color-text-secondary)]" />
                    Upload Photo
                  </button>
                  {user?.avatar && (
                    <button
                      onClick={() => { handleRemoveAvatar(); setAvatarMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      role="menuitem"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove Photo
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Name and Email */}
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {profile.name}
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)] mb-2">{profile.email}</p>

          {/* Role + Live Status Pills */}
          <div className="flex items-center flex-wrap justify-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EDE9FE] rounded-full">
              <Headphones className="w-4 h-4 text-[#8B5CF6]" />
              <span className="text-sm font-medium text-[#8B5CF6]">
                {supportSubRole === "supervisor" ? "Supervisor" : "Agent"}
              </span>
            </div>
            {isOnline !== null && (
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${
                  isOnline
                    ? "bg-[#DCFCE7] text-[#16A34A]"
                    : "bg-[#F3F4F6] text-[#4B5563]"
                }`}
                title={t("sidebar.statusDrivenByBusinessHours")}
              >
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    isOnline ? "bg-[#22C55E] animate-pulse" : "bg-[var(--color-text-secondary)]"
                  }`}
                />
                <span className="text-xs font-medium">
                  {isOnline ? t("sidebar.online") : t("sidebar.offline")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Stats Row — real data from useSupportProfile.
            For users who have never been assigned a ticket (new agents,
            supervisors who don't own the queue), show a friendly empty
            state instead of "0 / — / --". */}
        {profile.hasAnyTickets === false && !profile.isLoading ? (
          <div className="mt-6 py-4 border-t border-[var(--color-border)] text-center">
            <p className="text-xs text-[var(--color-text-secondary)]">
              {isSupervisor
                ? "You don't have assigned tickets yet. View your team's performance in Reports."
                : "You haven't been assigned any tickets yet."}
            </p>
          </div>
        ) : (
          <div className="mt-6 flex justify-around py-4 border-t border-[var(--color-border)]">
            <div className="text-center">
              <p className="text-xl font-bold text-[var(--color-text-primary)]">
                {profile.resolved}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">{t("sidebar.resolved")}</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-[#16A34A]">
                {profile.csat != null
                  ? `${profile.csat.toFixed(1)}`
                  : "—"}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {profile.csat != null ? "CSAT /5" : t("sidebar.csat")}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-[var(--color-text-primary)]">
                {profile.avgFRT}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">{t("sidebar.avgFRT")}</p>
            </div>
          </div>
        )}

        {/* View Profile Button */}
        <Link
          href={isSupervisor ? `${basePath}/settings` : `${basePath}/my-tickets`}
          className="block w-full mt-4 py-2.5 px-4 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] transition-colors text-center"
        >
          {t("sidebar.viewProfile")}
        </Link>
      </div>

      {/* Navigation Card */}
      <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-4">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  active
                    ? "bg-[var(--color-border-subtle)] text-[var(--color-primary)]"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${active ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)]"}`}
                />
                <span
                  className={`text-sm flex-1 ${active ? "font-medium" : ""}`}
                >
                  {item.label}
                </span>
                {item.badgeKey && (
                  <SidebarBadge
                    tabKey={item.badgeKey}
                    tone={item.badgeTone || "info"}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

    </aside>
  );
};

export default SupportSidebar;
