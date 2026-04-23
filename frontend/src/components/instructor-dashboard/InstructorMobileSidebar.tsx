"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
  X,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { profileApi } from "@/lib/api";

interface InstructorProfile {
  name: string;
  email: string;
  rating: number;
  courseCompletion: number;
  avatar?: string;
}

interface InstructorMobileSidebarProps {
  instructor: InstructorProfile;
}

const InstructorMobileSidebar = ({
  instructor,
}: InstructorMobileSidebarProps) => {
  const [isOpen, setIsOpen] = useState(false);
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
      label: t("sidebar.settings"),
      href: `/${locale}/dashboard/instructor/settings`,
      icon: Settings,
    },
  ];

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
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Close Button */}
        <button
          onClick={() => setIsOpen(false)}
          className={`absolute top-4 ${isRTL ? "left-4" : "right-4"} w-8 h-8 flex items-center justify-center`}
          aria-label="Close menu"
        >
          <X className="w-6 h-6 text-[#6B7280]" />
        </button>

        <div className="p-4 pt-14 flex flex-col gap-4">
          {/* Profile Card */}
          <div className="bg-white rounded-2xl border border-[var(--color-border)] p-5">
            {/* Profile Section */}
            <div className="flex flex-col items-center">
              <div className="relative mb-3">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100">
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
                    className={`absolute bottom-0 ${isRTL ? "left-0" : "right-0"} w-7 h-7 bg-[#002D87] rounded-full flex items-center justify-center border-2 border-white cursor-pointer hover:bg-[#001d5e] transition-colors`}
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
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#1F2937] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
                        role="menuitem"
                      >
                        <Upload className="w-4 h-4 text-[#4B5563]" />
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

              <h3 className="text-lg font-semibold text-[#1F2937]">
                {instructor.name}
              </h3>
              <p className="text-sm text-[#6B7280] mb-2">{instructor.email}</p>

              <div className="flex items-center gap-1.5 px-3 py-1 bg-[#FEF3C7] rounded-full">
                <Star className="w-4 h-4 text-[#D4A520] fill-[#D4A520]" />
                <span className="text-sm font-medium text-[#D4A520]">
                  {instructor.rating} {t("sidebar.rating")}
                </span>
              </div>
            </div>

            {/* Course Completion */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[#4B5563]">
                  {t("sidebar.courseCompletion")}
                </span>
                <span className="text-sm font-medium text-[#1F2937]">
                  {instructor.courseCompletion}%
                </span>
              </div>
              <div className="w-full h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#D4A520] rounded-full"
                  style={{ width: `${instructor.courseCompletion}%` }}
                />
              </div>
            </div>

            {/* View Profile Button */}
            <Link
              href={`/${locale}/dashboard/instructor/settings`}
              onClick={() => setIsOpen(false)}
              className="w-full mt-4 py-2.5 px-4 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[#1F2937] hover:bg-[#F9FAFB] transition-colors text-center block"
            >
              {t("sidebar.viewProfile")}
            </Link>
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
                    onClick={() => setIsOpen(false)}
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
        </div>
      </div>
    </>
  );
};

export default InstructorMobileSidebar;
