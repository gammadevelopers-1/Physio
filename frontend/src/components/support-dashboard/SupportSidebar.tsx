"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
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
} from "lucide-react";

interface SupportProfile {
  name: string;
  email: string;
  resolved: number;
  csat: number;
  avgFRT: string;
  avatar?: string;
}

interface SupportSidebarProps {
  profile: SupportProfile;
}

const SupportSidebar = ({ profile }: SupportSidebarProps) => {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("supportDashboard");
  const isRTL = locale === "ar";

  const navItems = [
    {
      label: t("sidebar.dashboard"),
      href: `/${locale}/dashboard/support`,
      icon: LayoutDashboard,
    },
    {
      label: t("sidebar.allTickets"),
      href: `/${locale}/dashboard/support/tickets`,
      icon: ClipboardList,
      badge: 23,
    },
    {
      label: t("sidebar.myTickets"),
      href: `/${locale}/dashboard/support/my-tickets`,
      icon: Inbox,
      badge: 8,
    },
    {
      label: t("sidebar.team"),
      href: `/${locale}/dashboard/support/team`,
      icon: Users,
    },
    {
      label: t("sidebar.knowledgeBase"),
      href: `/${locale}/dashboard/support/kb`,
      icon: BookOpen,
    },
    {
      label: t("sidebar.reports"),
      href: `/${locale}/dashboard/support/reports`,
      icon: BarChart3,
    },
    {
      label: t("sidebar.settings"),
      href: `/${locale}/dashboard/support/settings`,
      icon: Settings,
    },
  ];

  const isActive = (href: string) => {
    return pathname === href;
  };

  return (
    <aside className="w-full lg:w-[280px] flex flex-col gap-4">
      {/* Profile Card */}
      <div className="bg-white rounded-2xl border border-[var(--color-border)] p-6">
        {/* Profile Section */}
        <div className="flex flex-col items-center">
          {/* Avatar with edit button */}
          <div className="relative mb-3">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] flex items-center justify-center relative">
              {profile.avatar ? (
                <Image
                  src={profile.avatar}
                  alt={profile.name}
                  width={80}
                  height={80}
                  className="object-cover w-full h-full"
                  unoptimized
                />
              ) : (
                <span className="text-2xl font-bold text-white">
                  {profile.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .substring(0, 2)}
                </span>
              )}
              {/* Online badge */}
              <div
                className={`absolute -bottom-1 ${isRTL ? "-left-1" : "-right-1"} w-6 h-6 bg-[#22C55E] rounded-full flex items-center justify-center border-2 border-white`}
              >
                <Headphones className="w-3 h-3 text-white" />
              </div>
            </div>
            <button
              className={`absolute bottom-0 ${isRTL ? "left-0" : "right-0"} w-7 h-7 bg-[#8B5CF6] rounded-full flex items-center justify-center border-2 border-white`}
              aria-label={t("sidebar.editProfile")}
            >
              <Pencil className="w-3.5 h-3.5 text-white" />
            </button>
          </div>

          {/* Name and Email */}
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {profile.name}
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)] mb-2">{profile.email}</p>

          {/* Role Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EDE9FE] rounded-full">
            <Headphones className="w-4 h-4 text-[#8B5CF6]" />
            <span className="text-sm font-medium text-[#8B5CF6]">
              {t("sidebar.supportLead")}
            </span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="mt-6 flex justify-around py-4 border-t border-[var(--color-border)]">
          <div className="text-center">
            <p className="text-xl font-bold text-[var(--color-text-secondary)]">
              {profile.resolved}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">{t("sidebar.resolved")}</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-[#16A34A]">
              {profile.csat}%
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">{t("sidebar.csat")}</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-[var(--color-text-secondary)]">
              {profile.avgFRT}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)]">{t("sidebar.avgFRT")}</p>
          </div>
        </div>

        {/* View Profile Button */}
        <button className="w-full mt-4 py-2.5 px-4 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-primary)] hover:bg-[#F9FAFB] transition-colors">
          {t("sidebar.viewProfile")}
        </button>
      </div>

      {/* Navigation Card */}
      <div className="bg-white rounded-2xl border border-[var(--color-border)] p-4">
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
                    ? "bg-[#F0F7FF] text-[#002D87]"
                    : "text-[var(--color-text-secondary)] hover:bg-[#F9FAFB]"
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${active ? "text-[#002D87]" : "text-[var(--color-text-secondary)]"}`}
                />
                <span
                  className={`text-sm flex-1 ${active ? "font-medium" : ""}`}
                >
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

      {/* Online Status Bar */}
      <div className="bg-[#DCFCE7] rounded-2xl border border-[var(--color-border)] px-4 py-3 flex items-center gap-2">
        <div className="w-2.5 h-2.5 bg-[#22C55E] rounded-full" />
        <Headphones className="w-4 h-4 text-[#16A34A]" />
        <span className="text-sm font-medium text-[#16A34A]">
          {t("sidebar.onlineAvailable")}
        </span>
      </div>
    </aside>
  );
};

export default SupportSidebar;
