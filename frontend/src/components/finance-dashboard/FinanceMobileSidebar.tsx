"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { profileApi, SIDEBAR_TAB_KEYS } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import SidebarBadge from "@/components/SidebarBadge";
import {
  LayoutDashboard,
  CreditCard,
  FileText,
  RotateCcw,
  Tag,
  BarChart3,
  Shield,
  Settings,
  X,
  Pencil,
  Wallet,
  Upload,
  Trash2,
  Headphones,
  UserPlus,
  Building2,
} from "lucide-react";

interface FinanceProfile {
  name: string;
  email: string;
  revenue: string;
  invoices: number;
  refundRate: number;
  avatar?: string;
}

interface FinanceMobileSidebarProps {
  profile: FinanceProfile;
  pendingRefundCount?: number;
}

const FinanceMobileSidebar = ({ profile, pendingRefundCount = 0 }: FinanceMobileSidebarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("financeDashboard");
  const { refreshUser } = useAuth();
  const isRTL = locale === "ar";

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
      toast.success(t("settingsPage.profile.saved"));
    } catch {
      toast.error(t("settingsPage.profile.avatarError"));
    }
    e.target.value = "";
  };

  const handleRemoveAvatar = async () => {
    try {
      await profileApi.update({ avatar: null });
      await refreshUser();
      toast.success(t("settingsPage.profile.saved"));
    } catch {
      toast.error(t("settingsPage.profile.avatarError"));
    }
  };

  const navItems = [
    {
      label: t("sidebar.dashboard"),
      href: `/${locale}/dashboard/finance`,
      icon: LayoutDashboard,
    },
    {
      label: t("sidebar.payments"),
      href: `/${locale}/dashboard/finance/payments`,
      icon: CreditCard,
    },
    {
      label: t("sidebar.invoices"),
      href: `/${locale}/dashboard/finance/invoices`,
      icon: FileText,
    },
    {
      label: t("sidebar.refunds"),
      href: `/${locale}/dashboard/finance/refunds`,
      icon: RotateCcw,
      badge: pendingRefundCount > 0 ? pendingRefundCount : undefined,
    },
    {
      label: t("sidebar.bankTransfers"),
      href: `/${locale}/dashboard/finance/bank-transfers`,
      icon: Building2,
    },
    {
      label: t("sidebar.discounts"),
      href: `/${locale}/dashboard/finance/discounts`,
      icon: Tag,
    },
    {
      label: t("sidebar.reports"),
      href: `/${locale}/dashboard/finance/reports`,
      icon: BarChart3,
    },
    {
      label: t("sidebar.auditLog"),
      href: `/${locale}/dashboard/finance/audit-log`,
      icon: Shield,
    },
    {
      label: t("sidebar.support"),
      href: `/${locale}/dashboard/finance/support`,
      icon: Headphones,
    },
    {
      label: t("sidebar.loopedIn"),
      href: `/${locale}/dashboard/finance/support/looped-in`,
      icon: UserPlus,
    },
    {
      label: t("sidebar.settings"),
      href: `/${locale}/dashboard/finance/settings`,
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
        role="dialog"
        aria-label="Navigation menu"
        className={`lg:hidden fixed top-0 ${isRTL ? "right-0" : "left-0"} h-full w-[300px] bg-[var(--color-surface-page)] z-50 transform transition-transform duration-300 overflow-y-auto ${
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
          <X className="w-6 h-6 text-[var(--color-text-secondary)]" />
        </button>

        <div className="p-4 pt-14 flex flex-col gap-4">
          {/* Profile Card */}
          <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-5">
            {/* Profile Section */}
            <div className="flex flex-col items-center">
              <div className="relative mb-3">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] flex items-center justify-center relative">
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
                  <div
                    className={`absolute -bottom-1 ${isRTL ? "-left-1" : "-right-1"} w-6 h-6 bg-[#22C55E] rounded-full flex items-center justify-center border-2 border-white`}
                  >
                    <Wallet className="w-3 h-3 text-white" />
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
                    className={`absolute bottom-0 ${isRTL ? "left-0" : "right-0"} w-7 h-7 bg-[var(--color-primary)] rounded-full flex items-center justify-center border-2 border-white cursor-pointer hover:bg-[var(--color-primary-dark)] transition-colors`}
                    aria-label={t("sidebar.editProfile")}
                  >
                    <Pencil className="w-3.5 h-3.5 text-white" />
                  </button>
                  {avatarMenuOpen && (
                    <div className={`absolute top-full mt-1 ${isRTL ? "right-0" : "left-0"} bg-[var(--color-surface-card)] rounded-lg shadow-lg border border-[var(--color-border)] py-1 z-50 min-w-[160px]`}>
                      <button
                        onClick={() => { avatarInputRef.current?.click(); setAvatarMenuOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)] transition-colors cursor-pointer"
                      >
                        <Upload className="w-4 h-4 text-[var(--color-text-secondary)]" />
                        {t("settingsPage.profile.uploadPhoto")}
                      </button>
                      {profile.avatar && (
                        <button
                          onClick={() => { handleRemoveAvatar(); setAvatarMenuOpen(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                          {t("settingsPage.profile.removePhoto")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
                {profile.name}
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)] mb-2">{profile.email}</p>

              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-surface-page)] rounded-full">
                <Wallet className="w-4 h-4 text-[var(--color-primary)]" />
                <span className="text-sm font-medium text-[var(--color-primary)]">
                  {t("sidebar.financeManager")}
                </span>
              </div>
            </div>

            {/* Stats Row */}
            <div className="mt-6 flex justify-around py-4 border-t border-[var(--color-border)]">
              <div className="text-center">
                <p className="text-xl font-bold text-[var(--color-text-primary)]">
                  {profile.revenue}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t("sidebar.revenue")}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-[var(--color-text-primary)]">
                  {profile.invoices}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t("sidebar.invoicesCount")}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-[#16A34A]">
                  {profile.refundRate}%
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t("sidebar.refundRate")}
                </p>
              </div>
            </div>

            {/* View Profile Button */}
            <button
              onClick={() => { router.push(`/${locale}/dashboard/finance/settings`); setIsOpen(false); }}
              className="w-full mt-4 py-2.5 px-4 border border-[var(--color-border)] rounded-lg text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-page)] transition-colors cursor-pointer"
            >
              {t("sidebar.viewProfile")}
            </button>
          </div>

          {/* Navigation Card */}
          <div className="bg-[var(--color-surface-card)] rounded-2xl border border-[var(--color-border)] p-4">
            <nav className="space-y-1" aria-label="Finance navigation">
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
                        ? "bg-[var(--color-border-subtle)] text-[var(--color-primary)]"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-page)]"
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
                    {item.badge && (
                      <span className="bg-[#EF4444] text-white text-[11px] font-semibold px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
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
        </div>
      </div>
    </>
  );
};

export default FinanceMobileSidebar;
