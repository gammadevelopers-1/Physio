"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  ClipboardList,
  Inbox,
  Users,
  BookOpen,
  BarChart3,
  Settings,
  X,
  Pencil,
  Headphones,
} from "lucide-react";

interface SupportProfile {
  name: string;
  email: string;
  resolved: number;
  csat: number | null;
  avgFRT: string;
  avatar?: string;
  totalTickets?: number;
  hasAnyTickets?: boolean;
  isLoading?: boolean;
}

interface SupportMobileSidebarProps {
  profile: SupportProfile;
  supportSubRole?: string | null;
}

const SupportMobileSidebar = ({ profile, supportSubRole }: SupportMobileSidebarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("supportDashboard");
  const isRTL = locale === "ar";
  const { user } = useAuth();

  const isSupervisor = supportSubRole === "supervisor";
  const basePath = isSupervisor
    ? `/${locale}/dashboard/support/supervisor`
    : `/${locale}/dashboard/support/agent`;

  const allNavItems = [
    {
      label: t("sidebar.dashboard"),
      href: basePath,
      icon: LayoutDashboard,
      showFor: "all" as const,
    },
    {
      label: t("sidebar.allTickets"),
      href: `${basePath}/tickets`,
      icon: ClipboardList,
      showFor: "supervisor" as const,
    },
    {
      label: t("sidebar.myTickets"),
      href: `${basePath}/my-tickets`,
      icon: Inbox,
      showFor: "all" as const,
    },
    {
      label: t("sidebar.team"),
      href: `${basePath}/team`,
      icon: Users,
      showFor: "supervisor" as const,
    },
    {
      label: t("sidebar.knowledgeBase"),
      href: `${basePath}/kb`,
      icon: BookOpen,
      showFor: "all" as const,
    },
    {
      label: t("sidebar.reports"),
      href: `${basePath}/reports`,
      icon: BarChart3,
      showFor: "supervisor" as const,
    },
    {
      label: t("sidebar.settings"),
      href: `${basePath}/settings`,
      icon: Settings,
      showFor: "all" as const,
    },
  ];

  const navItems = allNavItems.filter(
    (item) => item.showFor === "all" || (item.showFor === "supervisor" && isSupervisor),
  );

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-50"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Drawer */}
      <div
        className={`lg:hidden fixed top-0 ${isRTL ? "right-0" : "left-0"} h-full w-[300px] bg-[#F9FAFB] z-50 transform transition-transform duration-300 overflow-y-auto ${
          isOpen
            ? "translate-x-0"
            : isRTL
              ? "translate-x-full"
              : "-translate-x-full"
        }`}
      >
        {/* Close Button */}
        <button
          onClick={() => setIsOpen(false)}
          className={`absolute top-4 ${isRTL ? "left-4" : "right-4"} w-8 h-8 flex items-center justify-center`}
          aria-label={t("navbar.closeMenu")}
        >
          <X className="w-6 h-6 text-[#6B7280]" />
        </button>

        <div className="p-4 pt-14 flex flex-col gap-4">
          {/* Profile Card */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
            {/* Profile Section */}
            <div className="flex flex-col items-center">
              <div className="relative mb-3">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] flex items-center justify-center relative">
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt={profile.name}
                      width={80}
                      height={80}
                      className="object-cover w-full h-full"
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
                  <div
                    className={`absolute -bottom-1 ${isRTL ? "-left-1" : "-right-1"} w-6 h-6 bg-[#22C55E] rounded-full flex items-center justify-center border-2 border-white`}
                  >
                    <Headphones className="w-3 h-3 text-white" />
                  </div>
                </div>
                <button
                  className={`absolute bottom-0 ${isRTL ? "left-0" : "right-0"} w-7 h-7 bg-[#8B5CF6] rounded-full flex items-center justify-center border-2 border-white`}
                >
                  <Pencil className="w-3.5 h-3.5 text-white" />
                </button>
              </div>

              <h3 className="text-lg font-semibold text-[#1F2937]">
                {profile.name}
              </h3>
              <p className="text-sm text-[#6B7280] mb-2">{profile.email}</p>

              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EDE9FE] rounded-full">
                <Headphones className="w-4 h-4 text-[#8B5CF6]" />
                <span className="text-sm font-medium text-[#8B5CF6]">
                  {supportSubRole === "supervisor" ? "Supervisor" : "Agent"}
                </span>
              </div>
            </div>

            {/* Stats Row */}
            <div className="mt-6 flex justify-around py-4 border-t border-[#E5E7EB]">
              <div className="text-center">
                <p className="text-xl font-bold text-[#1F2937]">
                  {profile.resolved}
                </p>
                <p className="text-xs text-[#6B7280]">
                  {t("sidebar.resolved")}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-[#16A34A]">
                  {profile.csat != null ? profile.csat.toFixed(1) : "—"}
                </p>
                <p className="text-xs text-[#6B7280]">
                  {profile.csat != null ? "CSAT /5" : t("sidebar.csat")}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-[#1F2937]">
                  {profile.avgFRT}
                </p>
                <p className="text-xs text-[#6B7280]">
                  {t("sidebar.avgFRT")}
                </p>
              </div>
            </div>

            {/* View Profile Button */}
            <button className="w-full mt-4 py-2.5 px-4 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#1F2937]">
              {t("sidebar.viewProfile")}
            </button>
          </div>

          {/* Navigation Card */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      active
                        ? "bg-[#F0F7FF] text-[#002D87]"
                        : "text-[#4B5563] hover:bg-[#F9FAFB]"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${active ? "text-[#002D87]" : "text-[#6B7280]"}`}
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
          <div className="bg-[#DCFCE7] rounded-2xl border border-[#E5E7EB] px-4 py-3 flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-[#22C55E] rounded-full" />
            <Headphones className="w-4 h-4 text-[#16A34A]" />
            <span className="text-sm font-medium text-[#16A34A]">
              {t("sidebar.onlineAvailable")}
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default SupportMobileSidebar;
