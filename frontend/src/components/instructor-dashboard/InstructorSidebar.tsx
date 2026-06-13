"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  LayoutDashboard,
  BookOpen,
  Calendar,
  Users,
  ClipboardCheck,
  Award,
  Upload,
  BarChart3,
  Settings,
  Pencil,
  Star,
  Trash2,
  Headphones,
  UserPlus,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { profileApi, SIDEBAR_TAB_KEYS } from "@/lib/api";
import SidebarBadge from "@/components/SidebarBadge";

interface InstructorProfile {
  name: string;
  email: string;
  rating: number;
  totalReviews?: number;
  /** % of instructor-editable profile fields populated. 0-100. */
  profileCompletion: number;
  avatar?: string;
}

interface InstructorSidebarProps {
  instructor: InstructorProfile;
}

const InstructorSidebar = ({ instructor }: InstructorSidebarProps) => {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("instructorDashboard");
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
      href: `/${locale}/dashboard/instructor`,
      icon: LayoutDashboard,
    },
    {
      label: t("sidebar.myCourses"),
      href: `/${locale}/dashboard/instructor/courses`,
      icon: BookOpen,
    },
    {
      label: t("sidebar.sessions"),
      href: `/${locale}/dashboard/instructor/sessions`,
      icon: Calendar,
    },
    {
      label: t("sidebar.students"),
      href: `/${locale}/dashboard/instructor/students`,
      icon: Users,
    },
    {
      label: t("sidebar.assessments"),
      href: `/${locale}/dashboard/instructor/assessments`,
      icon: ClipboardCheck,
    },
    {
      label: t("sidebar.content"),
      href: `/${locale}/dashboard/instructor/content`,
      icon: Upload,
    },
    {
      label: t("sidebar.support"),
      href: `/${locale}/dashboard/instructor/support`,
      icon: Headphones,
    },
    {
      label: t("sidebar.loopedIn"),
      href: `/${locale}/dashboard/instructor/support/looped-in`,
      icon: UserPlus,
    },
    {
      label: t("sidebar.settings"),
      href: `/${locale}/dashboard/instructor/settings`,
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
            <div className="w-20 h-20 rounded-full overflow-hidden bg-[var(--color-border-subtle)]">
              <Image
                src={instructor.avatar || "/images/default-avatar.png"}
                alt={instructor.name}
                width={80}
                height={80}
                className="object-cover w-full h-full"
                unoptimized={!!instructor.avatar}
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
                className={`absolute bottom-0 ${isRTL ? "left-0" : "right-0"} w-7 h-7 bg-[var(--color-primary)] rounded-full flex items-center justify-center border-2 border-white cursor-pointer hover:bg-[#001d5e] transition-colors`}
                aria-label={t("sidebar.editProfile")}
                aria-haspopup="true"
                aria-expanded={avatarMenuOpen}
              >
                <Pencil className="w-3.5 h-3.5 text-white" />
              </button>
              {avatarMenuOpen && (
                <div className={`absolute top-full mt-1 ${isRTL ? "right-0" : "left-0"} bg-[var(--color-surface-card)] rounded-lg shadow-lg border border-[var(--color-border)] py-1 z-50 min-w-[160px]`} role="menu">
                  <button
                    onClick={() => { avatarInputRef.current?.click(); setAvatarMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] transition-colors cursor-pointer"
                    role="menuitem"
                  >
                    <Upload className="w-4 h-4 text-[var(--color-text-secondary)]" />
                    {t("sidebar.uploadPhoto")}
                  </button>
                  {instructor.avatar && (
                    <button
                      onClick={() => { handleRemoveAvatar(); setAvatarMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      role="menuitem"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t("sidebar.removePhoto")}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Name and Email */}
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {instructor.name}
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)] mb-2">{instructor.email}</p>

          {/* Rating Badge — sourced from approved+published instructor reviews */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-[#FEF3C7] rounded-full">
            <Star className="w-4 h-4 text-[var(--color-star)] fill-[var(--color-star)]" />
            <span className="text-sm font-medium text-[#D4A520]">
              {instructor.totalReviews && instructor.totalReviews > 0
                ? `${instructor.rating.toFixed(1)} (${instructor.totalReviews})`
                : `0 ${t("sidebar.rating")}`}
            </span>
          </div>
        </div>

        {/* Profile Completion — % of instructor-editable Settings fields
            populated. Nudges new trainers to fill avatar / bio / socials
            after approval. Same visual pattern as the student sidebar. */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-[var(--color-text-secondary)]">
              {t("sidebar.profileCompletion")}
            </span>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {instructor.profileCompletion}%
            </span>
          </div>
          <div className="w-full h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#16A34A] rounded-full transition-all duration-300"
              style={{ width: `${instructor.profileCompletion}%` }}
            />
          </div>
        </div>

        {/* View Profile Button */}
        <Link
          href={`/${locale}/dashboard/instructor/settings`}
          className="w-full mt-4 py-2.5 px-4 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] transition-colors text-center block"
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
                aria-current={active ? "page" : undefined}
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
                {item.href.endsWith("/support") && (
                  <SidebarBadge tabKey={SIDEBAR_TAB_KEYS.USER_SUPPORT} />
                )}
                {item.href.endsWith("/support/looped-in") && (
                  <SidebarBadge tabKey={SIDEBAR_TAB_KEYS.USER_LOOPED_IN} />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};

export default InstructorSidebar;
