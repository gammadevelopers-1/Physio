"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Users,
  Shield,
  BookOpen,
  DollarSign,
  Lock,
  FileText,
  BarChart3,
  ClipboardList,
  Settings,
  Pencil,
  Crown,
  UserCheck,
  Coins,
  Award,
  Mail,
  Headphones,
  UserPlus,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { roleRequestsApi, profileApi, adminApi, supportApi } from "@/lib/api";

interface AdminProfile {
  name: string;
  email: string;
  avatar?: string;
  /**
   * @deprecated Stats are now fetched by the sidebar itself via
   * `adminApi.getOverviewStats()`. These fields are ignored — callers
   * can pass anything (or omit them). Kept on the type so the existing
   * page-level adminProfile objects keep compiling.
   */
  totalUsers?: number;
  totalCourses?: number;
  uptime?: number;
}

interface AdminSidebarProps {
  admin: AdminProfile;
}

const AdminSidebar = ({ admin }: AdminSidebarProps) => {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("adminDashboard");
  const isRTL = locale === "ar";
  const { refreshUser } = useAuth();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingSupportTeamCount, setPendingSupportTeamCount] = useState(0);
  const [stats, setStats] = useState<{
    totalUsers: number;
    totalCourses: number;
    activeToday: number;
  } | null>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { url } = await profileApi.uploadAvatar(file);
      await profileApi.update({ avatar: url });
      await refreshUser();
    } catch {
      toast.error(t("sidebar.avatarUploadError"));
    }
    e.target.value = "";
  };

  // Fetch real pending role request count
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const result = await roleRequestsApi.getAll({ status: "PENDING", limit: 1 });
        setPendingCount(result.stats.pending);
      } catch {
        // Not admin or not logged in — ignore
      }
    };
    fetchPendingCount();
  }, []);

  // Fetch pending support-team-request count for sidebar badge
  useEffect(() => {
    const fetchSupportPending = async () => {
      try {
        const { count } = await supportApi.getPendingTeamRequestCount();
        setPendingSupportTeamCount(count);
      } catch {
        // Not admin or transient — ignore
      }
    };
    fetchSupportPending();
  }, []);

  // Fetch sidebar profile-card stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const result = await adminApi.getOverviewStats();
        setStats(result);
      } catch {
        // Not admin or transient failure — keep stats null, UI shows "—"
      }
    };
    fetchStats();
  }, []);

  // Sidebar items grouped by domain so the eye moves predictably:
  //   1. Overview (Dashboard)
  //   2. People (Users, then candidates awaiting decision)
  //   3. Learning (Courses + their output: Certificates)
  //   4. Engagement (Points)
  //   5. Money (Finance)
  //   6. Insights & governance (Reports, Compliance, Logs, Security)
  //   7. Config (Settings)
  //
  // Roles & Permissions entry is intentionally absent — the page exists
  // at /dashboard/admin/roles but the granular matrix isn't wired into
  // backend enforcement yet. Restore when the permission system goes
  // truly functional.
  const navItems = [
    // Overview
    {
      label: t("sidebar.dashboard"),
      href: `/${locale}/dashboard/admin`,
      icon: LayoutDashboard,
    },

    // People
    {
      label: t("sidebar.users"),
      href: `/${locale}/dashboard/admin/users`,
      icon: Users,
    },
    {
      label: t("sidebar.roleRequests"),
      href: `/${locale}/dashboard/admin/role-requests`,
      icon: UserCheck,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    {
      label: t("sidebar.support"),
      href: `/${locale}/dashboard/admin/support`,
      icon: Headphones,
      badge: pendingSupportTeamCount > 0 ? pendingSupportTeamCount : undefined,
    },
    {
      label: t("sidebar.loopedIn"),
      href: `/${locale}/dashboard/admin/support/looped-in`,
      icon: UserPlus,
    },

    // Learning
    {
      label: t("sidebar.courses"),
      href: `/${locale}/dashboard/admin/courses`,
      icon: BookOpen,
    },
    {
      label: t("sidebar.certificates"),
      href: `/${locale}/dashboard/admin/certificates`,
      icon: Award,
    },

    // Engagement
    {
      label: t("sidebar.points"),
      href: `/${locale}/dashboard/admin/points`,
      icon: Coins,
    },

    // Money
    {
      label: t("sidebar.finance"),
      href: `/${locale}/dashboard/admin/finance`,
      icon: DollarSign,
    },

    // Insights & governance
    {
      label: t("sidebar.reports"),
      href: `/${locale}/dashboard/admin/reports`,
      icon: BarChart3,
    },
    {
      label: t("sidebar.compliance"),
      href: `/${locale}/dashboard/admin/compliance`,
      icon: FileText,
    },
    {
      label: t("sidebar.logs"),
      href: `/${locale}/dashboard/admin/logs`,
      icon: ClipboardList,
    },
    {
      label: t("sidebar.security"),
      href: `/${locale}/dashboard/admin/security`,
      icon: Lock,
    },

    // Config
    {
      label: t("sidebar.templates"),
      href: `/${locale}/dashboard/admin/templates`,
      icon: Mail,
    },
    {
      label: t("sidebar.settings"),
      href: `/${locale}/dashboard/admin/settings`,
      icon: Settings,
    },
  ];

  const isActive = (href: string) => {
    return pathname === href;
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
              {admin.avatar ? (
                <Image
                  src={admin.avatar}
                  alt={admin.name}
                  width={80}
                  height={80}
                  className="object-cover w-full h-full"
                  unoptimized
                />
              ) : (
                <span className="text-2xl font-bold text-[var(--color-text-primary)]">
                  {admin.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .substring(0, 2)}
                </span>
              )}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <button
              onClick={() => avatarInputRef.current?.click()}
              className={`absolute bottom-0 ${isRTL ? "left-0" : "right-0"} w-7 h-7 bg-[var(--color-primary)] rounded-full flex items-center justify-center border-2 border-white`}
              aria-label={t("sidebar.editProfile")}
            >
              <Pencil className="w-3.5 h-3.5 text-white" />
            </button>
          </div>

          {/* Name and Email */}
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{admin.name}</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mb-2">{admin.email}</p>

          {/* Role Badge — gold-tinted to match brand, same pattern as
              manager (purple) and instructor (default avatar bg). */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-[var(--gold-gold-100)] rounded-full">
            <Crown className="w-4 h-4 text-[var(--color-star)]" />
            <span className="text-sm font-medium text-[var(--color-star)]">
              {t("sidebar.superAdmin")}
            </span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="mt-6 flex justify-around py-4 border-t border-[var(--color-border)]">
          <div className="text-center">
            <p className="text-xl font-bold text-[var(--color-text-secondary)]">
              {stats ? stats.totalUsers.toLocaleString() : "—"}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">{t("sidebar.users")}</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-[var(--color-text-secondary)]">
              {stats ? stats.totalCourses : "—"}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">{t("sidebar.courses")}</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-[#16A34A]">
              {stats ? stats.activeToday : "—"}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">{t("sidebar.activeToday")}</p>
          </div>
        </div>

        {/* View Profile Button */}
        <button className="w-full mt-4 py-2.5 px-4 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] transition-colors">
          {t("sidebar.viewProfile")}
        </button>
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
                <span className={`text-sm flex-1 ${active ? "font-medium" : ""}`}>
                  {item.label}
                </span>
                {item.badge && (
                  <span className="bg-[#EF4444] text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};

export default AdminSidebar;
