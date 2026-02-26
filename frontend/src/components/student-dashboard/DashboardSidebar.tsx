"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Calendar as CalendarIcon,
  LayoutDashboard,
  BookOpen,
  Heart,
  Award,
  ScrollText,
  BadgeCheck,
  FileText,
  Users,
  Settings,
  PlusCircle,
  Pencil,
  Coins,
  ClipboardList,
  HelpCircle,
  Upload,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { profileApi } from "@/lib/api";
import type { StudentProfile } from "@/hooks/useStudentProfile";

interface DashboardSidebarProps {
  user: StudentProfile;
}

const DashboardSidebar = ({ user }: DashboardSidebarProps) => {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("studentDashboard");
  const isRTL = locale === "ar";
  const { refreshUser } = useAuth();
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
    } catch {
      toast.error(t("settings.avatarUploadError"));
    }
    e.target.value = "";
  };

  const handleRemoveAvatar = async () => {
    try {
      await profileApi.update({ avatar: null });
      await refreshUser();
    } catch {
      toast.error(t("settings.avatarUploadError"));
    }
  };

  const navItems = [
    {
      label: t("sidebar.dashboard"),
      href: `/${locale}/dashboard/student`,
      icon: LayoutDashboard,
    },
    {
      label: t("sidebar.calendar"),
      href: `/${locale}/dashboard/student/calendar`,
      icon: CalendarIcon,
    },
    {
      label: t("sidebar.courses"),
      href: `/${locale}/dashboard/student/courses`,
      icon: BookOpen,
    },
    {
      label: t("sidebar.favorites"),
      href: `/${locale}/dashboard/student/favourites`,
      icon: Heart,
    },
    {
      label: t("sidebar.certifications"),
      href: `/${locale}/dashboard/student/certifications`,
      icon: Award,
    },
    {
      label: t("sidebar.transcript"),
      href: `/${locale}/dashboard/student/transcript`,
      icon: ScrollText,
    },
    {
      label: t("sidebar.badges"),
      href: `/${locale}/dashboard/student/badges`,
      icon: BadgeCheck,
    },
    {
      label: t("sidebar.invoices"),
      href: `/${locale}/dashboard/student/invoices`,
      icon: FileText,
    },
    {
      label: t("sidebar.applications"),
      href: `/${locale}/dashboard/student/applications`,
      icon: ClipboardList,
    },
    {
      label: t("sidebar.support"),
      href: `/${locale}/dashboard/student/support`,
      icon: HelpCircle,
    },
    {
      label: t("sidebar.inviteFriends"),
      href: `/${locale}/dashboard/student/invite-friends`,
      icon: Users,
    },
    {
      label: t("sidebar.settings"),
      href: `/${locale}/dashboard/student/settings`,
      icon: Settings,
    },
  ];

  const isActive = (href: string) => {
    return pathname === href;
  };

  return (
    <aside className="w-full lg:w-[280px] flex flex-col gap-4">
      {/* Profile Card */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
        {/* Profile Section */}
        <div className="flex flex-col items-center">
          {/* Avatar with edit button */}
          <div className="relative mb-3">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100">
              <Image
                src={user.avatar || "/images/default-avatar.png"}
                alt={user.name}
                width={80}
                height={80}
                className="object-cover w-full h-full"
                unoptimized={!!user.avatar}
              />
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
                className={`absolute bottom-0 ${isRTL ? "left-0" : "right-0"} w-7 h-7 bg-[#002D87] rounded-full flex items-center justify-center border-2 border-white cursor-pointer hover:bg-[#001d5e] transition-colors`}
                aria-label={t("settings.changePhoto")}
                aria-haspopup="true"
                aria-expanded={avatarMenuOpen}
              >
                <Pencil className="w-3.5 h-3.5 text-white" />
              </button>
              {avatarMenuOpen && (
                <div className={`absolute top-full mt-1 ${isRTL ? "right-0" : "left-0"} bg-white rounded-lg shadow-lg border border-[#E5E7EB] py-1 z-50 min-w-[160px]`} role="menu">
                  <button
                    onClick={() => { avatarInputRef.current?.click(); setAvatarMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#1F2937] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
                    role="menuitem"
                  >
                    <Upload className="w-4 h-4 text-[#4B5563]" />
                    {t("settings.uploadPhoto")}
                  </button>
                  {user.avatar && (
                    <button
                      onClick={() => { handleRemoveAvatar(); setAvatarMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      role="menuitem"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t("settings.removePhoto")}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Name and Email */}
          <h3 className="text-lg font-semibold text-[#1F2937]">{user.name}</h3>
          <p className="text-sm text-[#6B7280] mb-2">{user.email}</p>

          {/* Points Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-[#F3F4F6] rounded-full">
            <Coins className="w-4 h-4 text-[#D4A520]" />
            <span className="text-sm text-[#4B5563]">
              {user.points} {t("sidebar.points")}
            </span>
          </div>
        </div>

        {/* Profile Completion */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[#4B5563]">
              {t("sidebar.profileCompletion")}
            </span>
            <span className="text-sm font-medium text-[#1F2937]">
              {user.profileCompletion}%
            </span>
          </div>
          <div className="w-full h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#16A34A] rounded-full transition-all duration-300"
              style={{ width: `${user.profileCompletion}%` }}
            />
          </div>
        </div>

        {/* Info Links */}
        <div className="mt-4 space-y-2">
          <Link
            href={`/${locale}/dashboard/student/settings`}
            className="flex items-center gap-2 text-[#D4A520] hover:text-[#B8920E] transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="text-sm font-medium">
              {t("sidebar.personalInformation")}
            </span>
          </Link>
          <Link
            href={`/${locale}/dashboard/student/settings`}
            className="flex items-center gap-2 text-[#D4A520] hover:text-[#B8920E] transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="text-sm font-medium">
              {t("sidebar.contactInformation")}
            </span>
          </Link>
        </div>

        {/* View Profile Button */}
        <Link
          href={`/${locale}/dashboard/student/settings`}
          className="w-full mt-4 py-2.5 px-4 border border-[#E5E7EB] rounded-lg text-sm font-medium text-[#1F2937] hover:bg-[#F9FAFB] transition-colors text-center block"
        >
          {t("sidebar.viewProfile")}
        </Link>
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
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  active
                    ? "bg-[#F0F7FF] text-[#002D87]"
                    : "text-[#4B5563] hover:bg-[#F9FAFB]"
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${active ? "text-[#002D87]" : "text-[#6B7280]"}`}
                />
                <span className={`text-sm ${active ? "font-medium" : ""}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
