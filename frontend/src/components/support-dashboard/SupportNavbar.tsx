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
  Menu,
  X,
  LogOut,
  User,
  Settings,
  LayoutDashboard,
  ClipboardList,
  Inbox,
  Users,
  BookOpen,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/contexts";
import { usePlatformLocale } from "@/contexts/PlatformLocaleContext";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { getStrapiMediaUrl } from "@/lib/strapi/client";

interface SupportProfile {
  name: string;
  avatar?: string;
}

interface SupportNavbarProps {
  profile: SupportProfile;
}

const SupportNavbar = ({ profile }: SupportNavbarProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const t = useTranslations("navbar");
  const tDashboard = useTranslations("supportDashboard");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const isRTL = locale === "ar";
  const { logout } = useAuth();
  const { allowedLanguages } = usePlatformLocale();
  const showLocaleToggle = allowedLanguages.length > 1;
  const { settings: siteSettings } = useSiteSettings();
  const logoUrl = siteSettings?.logo?.url
    ? getStrapiMediaUrl(siteSettings.logo.url)
    : "/images/logo.png";
  const showSearch = siteSettings?.showSearchBar !== false;

  const dashboardNavItems = [
    {
      label: tDashboard("sidebar.dashboard"),
      href: `/${locale}/dashboard/support`,
      icon: LayoutDashboard,
    },
    {
      label: tDashboard("sidebar.allTickets"),
      href: `/${locale}/dashboard/support/tickets`,
      icon: ClipboardList,
      badge: 23,
    },
    {
      label: tDashboard("sidebar.myTickets"),
      href: `/${locale}/dashboard/support/my-tickets`,
      icon: Inbox,
      badge: 8,
    },
    {
      label: tDashboard("sidebar.team"),
      href: `/${locale}/dashboard/support/team`,
      icon: Users,
    },
    {
      label: tDashboard("sidebar.knowledgeBase"),
      href: `/${locale}/dashboard/support/kb`,
      icon: BookOpen,
    },
    {
      label: tDashboard("sidebar.reports"),
      href: `/${locale}/dashboard/support/reports`,
      icon: BarChart3,
    },
    {
      label: tDashboard("sidebar.settings"),
      href: `/${locale}/dashboard/support/settings`,
      icon: Settings,
    },
  ];

  const isActiveRoute = (href: string) => pathname === href;

  const switchLocale = () => {
    const newLocale = locale === "en" ? "ar" : "en";
    const pathWithoutLocale = pathname.replace(`/${locale}`, "");
    (window as unknown as { __showLocaleSwitchOverlay?: () => void }).__showLocaleSwitchOverlay?.();
    (window as unknown as { __navProgressStart?: () => void }).__navProgressStart?.();
    router.push(`/${newLocale}${pathWithoutLocale}`);
    import("@/lib/api").then(({ profileApi }) => profileApi.update({ language: newLocale }).catch(() => {}));
  };

  return (
    <nav className="sticky top-0 z-50 w-full bg-[var(--color-navbar-bg)] shadow-[0px_1px_2px_0px_rgba(10,13,18,0.05)] px-4 py-3 lg:px-16 lg:py-5">
      <div className="flex items-center justify-between w-full">
        {/* Logo + Nav Links */}
        <div className="flex items-center gap-8">
          {/* Logo */}
          <Link
            href={`/${locale}`}
            className="relative h-10 w-10 lg:h-12 lg:w-12 shrink-0"
          >
            <Image
              src={logoUrl}
              alt={siteSettings?.siteName || "Logo"}
              width={48}
              height={48}
              className="object-contain"
              unoptimized={logoUrl.startsWith("http")}
            />
          </Link>

        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          {/* Language Toggle — hidden when only one locale is allowed */}
          {showLocaleToggle && (
            <button
              onClick={switchLocale}
              className="flex items-center gap-2 text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors cursor-pointer"
            >
              <Globe className="w-5 h-5" strokeWidth={1.67} />
              <span className="text-base leading-6">{t("languageToggle")}</span>
            </button>
          )}

          {/* Separator - Hidden on mobile */}
          <div className="hidden lg:block h-6 w-px bg-[var(--on-surface-variant)] opacity-30" />

          {/* Search Icon - Hidden on mobile; gated by Strapi toggle */}
          {showSearch && (
            <button
              onClick={() => router.push(`/${locale}/search`)}
              className="hidden lg:flex items-center justify-center text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors"
            >
              <Search className="w-5 h-5" strokeWidth={1.67} />
            </button>
          )}

          {/* User Avatar with Dropdown - Hidden on mobile */}
          <div className="hidden lg:block relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[var(--color-border)] bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] flex items-center justify-center">
                {profile.avatar ? (
                  <Image
                    src={profile.avatar}
                    alt={profile.name}
                    width={40}
                    height={40}
                    className="object-cover w-full h-full"
                    unoptimized
                  />
                ) : (
                  <span className="text-sm font-bold text-white">
                    {profile.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .substring(0, 2)}
                  </span>
                )}
              </div>
              <ChevronDown
                className={`w-5 h-5 text-[var(--on-surface-variant)] transition-transform duration-200 ${isUserMenuOpen ? "rotate-180" : ""}`}
                strokeWidth={1.67}
              />
            </button>

            {isUserMenuOpen && (
              <div
                className={`absolute top-full mt-2 bg-[var(--color-surface-card)] rounded-lg shadow-lg border border-[var(--outline-subtle)] py-2 min-w-[180px] z-50 ${isRTL ? "left-0" : "right-0"}`}
              >
                <Link
                  href={`/${locale}/dashboard/support`}
                  className="flex items-center gap-2 px-4 py-2 text-[var(--on-surface-variant)] text-sm hover:bg-[var(--surface-container-low)] hover:text-[var(--on-surface-default)] transition-colors"
                  onClick={() => setIsUserMenuOpen(false)}
                >
                  <User className="w-4 h-4" />
                  {tDashboard("sidebar.dashboard")}
                </Link>
                <Link
                  href={`/${locale}/dashboard/support/settings`}
                  className="flex items-center gap-2 px-4 py-2 text-[var(--on-surface-variant)] text-sm hover:bg-[var(--surface-container-low)] hover:text-[var(--on-surface-default)] transition-colors"
                  onClick={() => setIsUserMenuOpen(false)}
                >
                  <Settings className="w-4 h-4" />
                  {tDashboard("sidebar.settings")}
                </Link>
                <div className="border-t border-[var(--outline-subtle)] my-1" />
                <button onClick={logout} className="flex items-center gap-2 px-4 py-2 w-full text-[var(--functional-red-600)] text-sm hover:bg-red-50 transition-colors">
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
            aria-label={tDashboard("navbar.toggleMenu")}
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" strokeWidth={1.67} />
            ) : (
              <Menu className="w-6 h-6" strokeWidth={1.67} />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-[var(--color-navbar-bg)] border-t border-[var(--outline-subtle)] shadow-lg max-h-[calc(100vh-80px)] overflow-y-auto">
          <div className="flex flex-col px-4 py-4">
            {/* User Info */}
            <div className="flex items-center gap-3 pb-4 mb-4 border-b border-[var(--outline-subtle)]">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] flex items-center justify-center">
                {profile.avatar ? (
                  <Image
                    src={profile.avatar}
                    alt={profile.name}
                    width={40}
                    height={40}
                    className="object-cover w-full h-full"
                    unoptimized
                  />
                ) : (
                  <span className="text-sm font-bold text-white">
                    {profile.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .substring(0, 2)}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                  {profile.name}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {tDashboard("sidebar.supportLead")}
                </p>
              </div>
            </div>

            {/* Dashboard Navigation Links */}
            <div className="space-y-1 mb-4">
              {dashboardNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = isActiveRoute(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isActive
                        ? "bg-[var(--color-border-subtle)] text-[var(--color-primary)]"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)]"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${isActive ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)]"}`}
                    />
                    <span
                      className={`text-sm flex-1 ${isActive ? "font-medium" : ""}`}
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
            </div>

            {/* Divider */}
            <div className="border-t border-[var(--outline-subtle)] my-2" />

            {/* Mobile Action Buttons */}
            {showSearch && (
              <div className="flex items-center gap-4 py-3">
                <button
                  onClick={() => { router.push(`/${locale}/search`); setIsMobileMenuOpen(false); }}
                  className="flex items-center justify-center text-[var(--on-surface-variant)] hover:text-[var(--on-surface-default)] transition-colors"
                >
                  <Search className="w-5 h-5" strokeWidth={1.67} />
                </button>
              </div>
            )}

            {/* Logout Button */}
            <button onClick={logout} className="mt-2 flex items-center justify-center gap-2 h-11 px-5 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-medium w-full hover:bg-red-50 transition-colors">
              <LogOut className="w-4 h-4" />
              {tDashboard("sidebar.logout")}
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default SupportNavbar;
