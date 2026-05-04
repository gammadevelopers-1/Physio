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
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { roleRequestsApi, profileApi } from "@/lib/api";

interface AdminProfile {
  name: string;
  email: string;
  totalUsers: number;
  totalCourses: number;
  uptime: number;
  avatar?: string;
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

  const navItems = [
    {
      label: t("sidebar.dashboard"),
      href: `/${locale}/dashboard/admin`,
      icon: LayoutDashboard,
    },
    {
      label: t("sidebar.users"),
      href: `/${locale}/dashboard/admin/users`,
      icon: Users,
    },
    {
      label: t("sidebar.roles"),
      href: `/${locale}/dashboard/admin/roles`,
      icon: Shield,
    },
    {
      label: t("sidebar.roleRequests"),
      href: `/${locale}/dashboard/admin/role-requests`,
      icon: UserCheck,
      badge: pendingCount > 0 ? pendingCount : undefined,
    },
    {
      label: t("sidebar.courses"),
      href: `/${locale}/dashboard/admin/courses`,
      icon: BookOpen,
    },
    {
      label: t("sidebar.finance"),
      href: `/${locale}/dashboard/admin/finance`,
      icon: DollarSign,
    },
    {
      label: t("sidebar.security"),
      href: `/${locale}/dashboard/admin/security`,
      icon: Lock,
    },
    {
      label: t("sidebar.compliance"),
      href: `/${locale}/dashboard/admin/compliance`,
      icon: FileText,
    },
    {
      label: t("sidebar.reports"),
      href: `/${locale}/dashboard/admin/reports`,
      icon: BarChart3,
    },
    {
      label: t("sidebar.logs"),
      href: `/${locale}/dashboard/admin/logs`,
      icon: ClipboardList,
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
            <div className="w-20 h-20 rounded-full overflow-hidden bg-[var(--color-primary)] flex items-center justify-center relative">
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
                <span className="text-2xl font-bold text-white">
                  {admin.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .substring(0, 2)}
                </span>
              )}
              {/* Admin badge */}
              <div className={`absolute -bottom-1 ${isRTL ? "-left-1" : "-right-1"} w-6 h-6 bg-[#EF4444] rounded-full flex items-center justify-center border-2 border-white`}>
                <Lock className="w-3 h-3 text-white" />
              </div>
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

          {/* Role Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-text-primary)] rounded-full">
            <Crown className="w-4 h-4 text-[#D4A520]" />
            <span className="text-sm font-medium text-white">
              {t("sidebar.superAdmin")}
            </span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="mt-6 flex justify-around py-4 border-t border-[var(--color-border)]">
          <div className="text-center">
            <p className="text-xl font-bold text-[var(--color-text-secondary)]">
              {admin.totalUsers.toLocaleString()}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">{t("sidebar.users")}</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-[var(--color-text-secondary)]">
              {admin.totalCourses}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">{t("sidebar.courses")}</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-[#16A34A]">{admin.uptime}%</p>
            <p className="text-xs text-[var(--color-text-secondary)]">{t("sidebar.uptime")}</p>
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
