"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  ChevronDown,
  Globe,
  Search,
  ShoppingCart,
  Menu,
  X,
  LogOut,
  User,
  Settings,
  LayoutDashboard,
  Calendar,
} from "lucide-react";
import { useAuth } from "@/contexts";
import DashboardSearchOverlay from "@/components/shared/DashboardSearchOverlay";
import NotificationBell from "@/components/shared/NotificationBell";
import { RoleSwitcherDropdownItems, RoleSwitcherMobileSection } from "@/components/shared/RoleSwitcher";

const TANavbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const t = useTranslations("navbar");
  const tDashboard = useTranslations("taDashboard");
  const tA = useTranslations("accessibility");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const isRTL = locale === "ar";
  const { user, logout } = useAuth();

  const name = user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || ""
    : "";
  const avatar = user?.avatar || undefined;

  const dashboardNavItems = [
    {
      label: tDashboard("sidebar.dashboard"),
      href: `/${locale}/dashboard/teaching-assistant`,
      icon: LayoutDashboard,
    },
    {
      label: tDashboard("sidebar.sessions"),
      href: `/${locale}/dashboard/teaching-assistant/sessions`,
      icon: Calendar,
    },
  ];

  const isActiveRoute = (href: string) => pathname === href;

  const switchLocale = () => {
    const newLocale = locale === "en" ? "ar" : "en";
    const pathWithoutLocale = pathname.replace(`/${locale}`, "");
    router.push(`/${newLocale}${pathWithoutLocale}`);
    import("@/lib/api").then(({ profileApi }) => profileApi.update({ language: newLocale }).catch(() => {}));
  };

  return (
    <nav className="sticky top-0 z-50 w-full bg-[var(--surface-intense)] shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] px-4 py-3 lg:px-16 lg:py-5">
      <div className="flex items-center justify-between w-full">
        {/* Logo + Nav Links */}
        <div className="flex items-center gap-8">
          <Link href={`/${locale}`} className="relative h-10 w-10 lg:h-12 lg:w-12 shrink-0">
            <Image src="/images/logo.png" alt="PhysioGuidance Logo" width={48} height={48} className="object-contain" />
          </Link>

          {/* Nav Links - Hidden on mobile/tablet */}
          <div className="hidden lg:flex items-center gap-8">
            <Link href={`/${locale}`} className="text-[var(--on-surface-variant)] text-base leading-6 hover:text-[var(--on-surface-default)] transition-colors whitespace-nowrap">
              {t("home")}
            </Link>
            <Link href={`/${locale}/courses`} className="text-[var(--on-surface-variant)] text-base leading-6 hover:text-[var(--on-surface-default)] transition-colors whitespace-nowrap">
              {t("courses")}
            </Link>
            <Link href={`/${locale}/become-trainer`} className="text-[var(--on-surface-variant)] text-base leading-6 hover:text-[var(--on-surface-default)] transition-colors whitespace-nowrap">
              {t("becomeTrainer")}
            </Link>
            <Link href={`/${locale}/archived`} className="text-[var(--on-surface-variant)] text-base leading-6 hover:text-[var(--on-surface-default)] transition-colors whitespace-nowrap">
              {t("archive")}
            </Link>
            <Link href={`/${locale}/blogs`} className="text-[var(--on-surface-variant)] text-base leading-6 hover:text-[var(--on-surface-default)] transition-colors whitespace-nowrap">
              {t("blogs")}
            </Link>
            <Link href={`/${locale}/about`} className="text-[var(--on-surface-variant)] text-base leading-6 hover:text-[var(--on-surface-default)] transition-colors whitespace-nowrap">
              {t("about")}
            </Link>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          {/* Language Toggle */}
          <button onClick={switchLocale} className="flex items-center gap-2 text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors cursor-pointer">
            <Globe className="w-5 h-5" strokeWidth={1.67} />
            <span className="text-base leading-6">{t("languageToggle")}</span>
          </button>

          {/* Separator - Hidden on mobile */}
          <div className="hidden lg:block h-6 w-px bg-[var(--on-surface-variant)] opacity-30" />

          {/* Search Icon - Hidden on mobile */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="hidden lg:flex items-center justify-center text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors"
            aria-label={tA("search")}
          >
            <Search className="w-5 h-5" strokeWidth={1.67} />
          </button>

          {/* Notification Bell */}
          <NotificationBell />

          {/* Cart Icon - Hidden on mobile */}
          <Link
            href={`/${locale}/checkout`}
            className="hidden lg:flex items-center justify-center text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors"
            aria-label={tA("cart")}
          >
            <ShoppingCart className="w-5 h-5" strokeWidth={1.67} />
          </Link>

          {/* User Avatar with Dropdown - Hidden on mobile */}
          <div className="hidden lg:block relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 cursor-pointer"
              aria-label={tA("userMenu")}
              aria-haspopup="true"
              aria-expanded={isUserMenuOpen}
            >
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#E5E7EB]">
                <Image src={avatar || "/images/default-avatar.png"} alt={name} width={40} height={40} className="object-cover w-full h-full" unoptimized={!!avatar} />
              </div>
              <ChevronDown className={`w-5 h-5 text-[var(--on-surface-variant)] transition-transform duration-200 ${isUserMenuOpen ? "rotate-180" : ""}`} strokeWidth={1.67} />
            </button>

            {isUserMenuOpen && (
              <div className={`absolute top-full mt-2 bg-white rounded-lg shadow-lg border border-[var(--outline-subtle)] py-2 min-w-[180px] z-50 ${isRTL ? "left-0" : "right-0"}`} role="menu">
                <Link href={`/${locale}/dashboard/teaching-assistant`} className="flex items-center gap-2 px-4 py-2 text-[var(--on-surface-variant)] text-sm hover:bg-[var(--surface-container-low)] hover:text-[var(--on-surface-default)] transition-colors" onClick={() => setIsUserMenuOpen(false)} role="menuitem">
                  <User className="w-4 h-4" />
                  {tDashboard("sidebar.dashboard")}
                </Link>
                <Link href={`/${locale}/dashboard/teaching-assistant/settings`} className="flex items-center gap-2 px-4 py-2 text-[var(--on-surface-variant)] text-sm hover:bg-[var(--surface-container-low)] hover:text-[var(--on-surface-default)] transition-colors" onClick={() => setIsUserMenuOpen(false)} role="menuitem">
                  <Settings className="w-4 h-4" />
                  {tDashboard("sidebar.settings")}
                </Link>
                <RoleSwitcherDropdownItems onSwitch={() => setIsUserMenuOpen(false)} />
                <div className="border-t border-[var(--outline-subtle)] my-1" />
                <button onClick={logout} className="flex items-center gap-2 px-4 py-2 w-full text-[var(--functional-red-600)] text-sm hover:bg-red-50 transition-colors" role="menuitem">
                  <LogOut className="w-4 h-4" />
                  {tDashboard("sidebar.logout")}
                </button>
              </div>
            )}
          </div>

          {/* Hamburger Menu - Mobile only */}
          <button
            className="flex lg:hidden items-center justify-center text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" strokeWidth={1.67} /> : <Menu className="w-6 h-6" strokeWidth={1.67} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-[var(--surface-intense)] border-t border-[var(--outline-subtle)] shadow-lg max-h-[calc(100vh-80px)] overflow-y-auto">
          <div className="flex flex-col px-4 py-4">
            {/* User Info */}
            <div className="flex items-center gap-3 pb-4 mb-4 border-b border-[var(--outline-subtle)]">
              <div className="w-10 h-10 rounded-full overflow-hidden">
                <Image src={avatar || "/images/default-avatar.png"} alt={name} width={40} height={40} className="object-cover w-full h-full" unoptimized={!!avatar} />
              </div>
              <div>
                <p className="text-sm font-medium text-[#1F2937]">{name}</p>
                <p className="text-xs text-[#6B7280]">{tDashboard("title")}</p>
              </div>
            </div>

            {/* Dashboard Navigation Links */}
            <div className="space-y-1 mb-4">
              {dashboardNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = isActiveRoute(item.href);
                return (
                  <Link key={item.href} href={item.href} onClick={() => setIsMobileMenuOpen(false)} aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive ? "bg-[#FFF8E6] text-[#6b4e24]" : "text-[#4B5563] hover:bg-[#F9FAFB]"}`}>
                    <Icon className={`w-5 h-5 ${isActive ? "text-[#6b4e24]" : "text-[#6B7280]"}`} />
                    <span className={`text-sm ${isActive ? "font-medium" : ""}`}>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Divider */}
            <div className="border-t border-[var(--outline-subtle)] my-2" />

            {/* Site Navigation Links */}
            <div className="py-2">
              <p className="px-3 py-2 text-xs font-medium text-[#9CA3AF] uppercase">
                {t("home")}
              </p>
              <Link href={`/${locale}`} className="flex items-center gap-3 px-3 py-2.5 text-[#4B5563] hover:bg-[#F9FAFB] rounded-lg transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                <span className="text-sm">{t("home")}</span>
              </Link>
              <Link href={`/${locale}/courses`} className="flex items-center gap-3 px-3 py-2.5 text-[#4B5563] hover:bg-[#F9FAFB] rounded-lg transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                <span className="text-sm">{t("courses")}</span>
              </Link>
              <Link href={`/${locale}/about`} className="flex items-center gap-3 px-3 py-2.5 text-[#4B5563] hover:bg-[#F9FAFB] rounded-lg transition-colors" onClick={() => setIsMobileMenuOpen(false)}>
                <span className="text-sm">{t("about")}</span>
              </Link>
            </div>

            {/* Divider */}
            <div className="border-t border-[var(--outline-subtle)] my-2" />

            {/* Mobile Action Buttons */}
            <div className="flex items-center gap-4 py-3">
              <button
                onClick={() => { setIsSearchOpen(true); setIsMobileMenuOpen(false); }}
                className="flex items-center justify-center text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors"
                aria-label={tA("search")}
              >
                <Search className="w-5 h-5" strokeWidth={1.67} />
              </button>
              <Link
                href={`/${locale}/checkout`}
                className="flex items-center justify-center text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label={tA("cart")}
              >
                <ShoppingCart className="w-5 h-5" strokeWidth={1.67} />
              </Link>
            </div>

            {/* Role Switcher */}
            <RoleSwitcherMobileSection onSwitch={() => setIsMobileMenuOpen(false)} />

            {/* Logout Button */}
            <button onClick={logout} className="mt-2 flex items-center justify-center gap-2 h-11 px-5 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-medium w-full hover:bg-red-50 transition-colors">
              <LogOut className="w-4 h-4" />
              {tDashboard("sidebar.logout")}
            </button>
          </div>
        </div>
      )}
      <DashboardSearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        role="instructor"
      />
    </nav>
  );
};

export default TANavbar;
